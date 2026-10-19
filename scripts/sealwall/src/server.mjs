// HTTP proxy. Route: /u/<upstream>/<path...>  ->  config.upstreams[<upstream>] + <path>
// Works for OpenAI-compatible (/v1/chat/completions) and Anthropic (/v1/messages), stream or not.
import http from 'node:http';
import https from 'node:https';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Wall, StreamRestorer, streamSlots } from './wall.mjs';

// Only these request headers are forwarded; everything else (x-er7-*, x-forwarded-*, cookies, custom
// identity headers, SDK telemetry) is dropped. user-agent is sealed. Credentials pass: the upstream needs them.
const HEADER_ALLOW = new Set(['content-type', 'accept', 'authorization', 'x-api-key', 'x-goog-api-key', 'anthropic-version', 'anthropic-beta', 'openai-beta', 'user-agent']);
// opencode/foldcode routing + session headers: the upstream rejects a request without them. Values are sealed like any other text.
const HEADER_ALLOW_PREFIX = /^(x-opencode-|x-session-|x-parent-session|x-title$|http-referer$)/;
const QUERY_PASS = new Set(['alt', 'key', 'api-version', 'beta', 'limit', 'after', 'before']);

// Header values must be latin-1/ASCII: sealed tokens use [ ] there and anything non-printable becomes '?'.
const asciiHeader = (t) => t.replace(/⟦/g, '[').replace(/⟧/g, ']').replace(/[^\x20-\x7e]/g, '?');

export function createServer({ wall, vault, upstreams, allowHosts = [], log = console.error }) {
  const hostOk = (h) => allowHosts.some((a) => (a.startsWith('*.') ? h.endsWith(a.slice(1)) : h === a));
  const auditFile = join(vault.dir, 'audit.jsonl');
  const audit = (rec) => { try { appendFileSync(auditFile, JSON.stringify({ t: new Date().toISOString(), ...rec }) + '\n', { mode: 0o600 }); } catch {} };

  return http.createServer((req, res) => handle(req, res).catch((e) => {
    audit({ route: 'internal', blocked: `handler error: ${e.message}` });
    try { if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: `sealwall: refused (${e.message})` } })); } catch {}
  }));

  async function handle(req, res) {
    if (req.url === '/health') return res.end('ok');
    // /u/<name>/...  named upstream      /h/<host>/...  any allow-listed https host
    let m = req.url.match(/^\/u\/([^/]+)(\/.*)?$/), target;
    if (m && upstreams[m[1]]) target = new URL(upstreams[m[1]].replace(/\/+$/, '') + (m[2] || '/'));
    else if ((m = req.url.match(/^\/h\/([^/]+)(\/.*)?$/)) && hostOk(m[1].toLowerCase())) target = new URL(`https://${m[1]}${m[2] || '/'}`);
    else { res.writeHead(404); return res.end('sealwall: route not allowed'); }

    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = Buffer.concat(chunks), stream = false, stats = {};
    try {
      if (body.length && !/json/.test(req.headers['content-type'] || '')) throw new Error('non-JSON body cannot be inspected; blocked');
      if (body.length) {
        const j = JSON.parse(body.toString('utf8'));
        stream = !!j.stream;
        body = Buffer.from(JSON.stringify(await wall.sealRequest(j, stats)));
      }
    } catch (e) {            // fail closed: nothing leaves unsealed
      audit({ route: m[1], blocked: String(e.message) });
      res.writeHead(502, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: `sealwall: refused to forward (${e.message})` } }));
    }
    audit({ route: m[1], path: m[2], sealed: stats, bytes: body.length });

    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (HEADER_ALLOW.has(k) || HEADER_ALLOW_PREFIX.test(k)) headers[k] = (k === 'user-agent' || HEADER_ALLOW_PREFIX.test(k)) ? asciiHeader(wall.sealText(String(v))) : v;
    // query string: pass only protocol params; seal the rest. The path itself must be PII-free or the call is refused.
    try {
      if (wall.sealText(decodeURIComponent(target.pathname)) !== decodeURIComponent(target.pathname)) throw new Error('PII in URL path');
      const qs = new URLSearchParams();
      for (const [k, v] of target.searchParams) qs.append(QUERY_PASS.has(k.toLowerCase()) ? k : wall.sealText(k), QUERY_PASS.has(k.toLowerCase()) ? v : wall.sealText(v));
      target.search = qs.toString();
    } catch (e) {
      audit({ route: m[1], blocked: String(e.message) });
      res.writeHead(502, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: `sealwall: refused to forward (${e.message})` } }));
    }
    headers['content-length'] = body.length;
    const lib = target.protocol === 'https:' ? https : http;
    const up = lib.request(target, { method: req.method, headers }, (ur) => {
      const ct = ur.headers['content-type'] || '';
      const out = { ...ur.headers }; delete out['content-length']; delete out['content-encoding']; delete out['transfer-encoding'];
      if (/event-stream/.test(ct)) {
        res.writeHead(ur.statusCode, out);
        pipeSSE(ur, res, vault);
      } else if (/json/.test(ct)) {
        const bs = []; ur.on('data', (c) => bs.push(c));
        ur.on('end', () => {
          let txt = Buffer.concat(bs).toString('utf8');
          try { txt = JSON.stringify(wall.unsealJSON(JSON.parse(txt))); } catch { txt = vault.unseal(txt); }
          res.writeHead(ur.statusCode, out); res.end(txt);
        });
      } else if (/ndjson|text\//.test(ct)) {
        res.writeHead(ur.statusCode, out);
        const sr = new StreamRestorer(vault); ur.setEncoding('utf8');
        ur.on('data', (c) => res.write(sr.push('t', c)));
        ur.on('end', () => { res.write(sr.flush('t')); res.end(); });
      } else { res.writeHead(ur.statusCode, ur.headers); ur.pipe(res); }
    });
    up.on('error', (e) => { res.writeHead(502); res.end(`sealwall upstream error: ${e.message}`); });
    up.end(body);
  }
}

function pipeSSE(ur, res, vault) {
  const sr = new StreamRestorer(vault);
  let tail = '', last = null;
  const handleEvent = (raw) => {
    const lines = raw.split('\n');
    const di = lines.findIndex((l) => l.startsWith('data:'));
    if (di === -1) return raw + '\n\n';
    const data = lines[di].slice(5).trim();
    if (data === '[DONE]') return flushAll() + raw + '\n\n';
    let ev; try { ev = JSON.parse(data); } catch { return vault.unseal(raw) + '\n\n'; }
    for (const s of streamSlots(ev)) s.set(sr.push(s.f, s.get(), s.json));
    last = ev;
    const stop = ev.type === 'content_block_stop' || ev.type === 'message_stop' || (ev.choices || []).some((c) => c.finish_reason) || (ev.candidates || []).some((c) => c.finishReason);
    lines[di] = 'data: ' + JSON.stringify(ev);
    return (stop ? flushAll() : '') + lines.join('\n') + '\n\n';
  };
  // emit any held partial token as a synthetic event (rare: truncated token)
  const flushAll = () => {
    let o = '';
    for (const f of sr.fields()) {
      const txt = sr.flush(f, /\.(arguments|partial_json)$/.test(f));
      if (!txt || !last) continue;
      const ev = JSON.parse(JSON.stringify(last));
      for (const s of streamSlots(ev)) if (s.f === f) s.set(txt);
      o += 'data: ' + JSON.stringify(ev) + '\n\n';
    }
    return o;
  };
  ur.setEncoding('utf8');
  ur.on('data', (c) => {
    tail += c;
    let i;
    while ((i = tail.search(/\r?\n\r?\n/)) !== -1) {
      const m = tail.slice(i).match(/^\r?\n\r?\n/)[0];
      res.write(handleEvent(tail.slice(0, i).replace(/\r/g, '')));
      tail = tail.slice(i + m.length);
    }
  });
  ur.on('end', () => { if (tail.trim()) res.write(handleEvent(tail)); res.write(flushAll()); res.end(); });
}
