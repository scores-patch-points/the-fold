// Wall: sanitize outbound JSON, restore inbound JSON/SSE. Fails closed (throws) on any error.
import { detectPII, looksLikeSecret, resolve, deobfuscate, decodePercent, b64Spans } from './pii.mjs';
import { OPEN, CLOSE, TOKEN_RE } from './vault.mjs';

// keys whose string values are protocol structure, not content
const SKIP = new Set(['model', 'role', 'type', 'id', 'tool_call_id', 'tool_use_id', 'name', 'stop', 'stop_reason', 'finish_reason', 'object', 'format', 'encoding', 'media_type', 'anthropic_version', 'api_key', 'parameters', 'input_schema', 'tool_choice', 'response_format', 'stream_options', 'cache_control', 'mimeType', 'mime_type', 'role', 'method', 'url_citation']);

const OPAQUE = new Set(['image', 'image_url', 'input_image', 'input_audio', 'audio', 'file', 'document', 'video']);

// Keys that classify their string value outright (value sealed whole, whatever it looks like).
const SECRET_KEY = /^(pass(word|wd)?|secret|token|api[-_]?key|auth(orization)?|cookie|session[-_]?(id|token)?|credentials?|private[-_]?key|access[-_]?(key|token)|client[-_]?secret|cvv|ssn|social[-_]?security)$/i;
const IDENT_KEY = /^(e?-?mail|phone|mobile|tel|address|street|zip|postal[-_]?code|first[-_]?name|last[-_]?name|full[-_]?name|surname|user[-_]?name|user[-_]?id|dob|birth[-_]?(date|day)|ip([-_]?address)?|user|owner|author|assignee|reporter)$/i;
const MANDATORY = new Set(['person', 'handle', 'address', 'email', 'phone', 'ipv4', 'ipv6', 'mac', 'card', 'iban', 'ssn', 'idnum', 'secret', 'dob', 'homedir']);
// Protocol identifiers: redacted when they look like secrets, but kept in an API-valid ASCII shape.
const ID_KEYS = new Set(['id', 'tool_call_id', 'tool_use_id', 'call_id', 'item_id', 'response_id', 'previous_response_id', 'message_id', 'request_id']);
// Blobs the provider itself issued and must get back verbatim (thinking signatures, encrypted reasoning).
const OPAQUE_KEYS = new Set(['signature', 'encrypted_content']);
const FREE_KEYS = new Set(['input', 'arguments', 'args', 'metadata', 'params', 'extra_body']);
const personish = (v) => /\s/.test(v) || /^[A-Z][a-z]+$/.test(v);

export class Wall {
  constructor({ vault, nouns, judge = null, verify = true, sealing = true, audit = () => {} }) {
    // sealing is the OPTIONAL layer (noun referents). Redaction (PII, secrets, suspected keys) has no switch.
    this.sealing = sealing; this.vault = vault; this.nouns = nouns; this.judge = judge; this.verify = verify; this.audit = audit; this.judged = new Map(); }

  // Nothing is exempt: every string, key, schema and description is normalized, detected and sealed.
  // Protocol tokens (role, type, model ids, tool names) contain nothing detectable, so they pass unchanged.
  sealText(text, stats = {}) {
    if (!text) return text;
    let t = decodePercent(deobfuscate(text));
    // MANDATORY layer: shapes + judge PII + lexicon persons. No configuration can turn it off.
    const judged = this.judged.get(t) || [];
    const mandatory = [...b64Spans(t), ...detectPII(t), ...judged.filter((x) => MANDATORY.has(x.cls))];
    const nouns = this.nouns.detect(t);
    mandatory.push(...nouns.filter((x) => x.cls === 'person'));
    // OPTIONAL layer: noun referents
    const optional = this.sealing ? [...nouns.filter((x) => x.cls !== 'person'), ...judged.filter((x) => !MANDATORY.has(x.cls))] : [];
    const spans = resolve([...mandatory, ...optional]);
    if (!spans.length) return t;
    let out = '', pos = 0;
    for (const s of spans) {
      out += t.slice(pos, s.start) + this.vault.seal(s.cls, s.value, s.restore);
      pos = s.end;
      stats[s.cls] = (stats[s.cls] || 0) + 1;
    }
    return out + t.slice(pos);
  }

  sealJSON(node, stats = {}, key = '', free = false) {
    if (typeof node === 'string') {
      if (OPAQUE_KEYS.has(key)) return node;
      if (ID_KEYS.has(key) && /^[A-Za-z0-9_-]+$/.test(node)) return looksLikeSecret(node) || detectPII(node).length ? (stats.id = (stats.id || 0) + 1, this.vault.pseudo(node)) : node;
      if (SECRET_KEY.test(key) && node.length >= 4) { stats.keysecret = (stats.keysecret || 0) + 1; return this.vault.seal('secret', node, false); }
      if (IDENT_KEY.test(key) && node.trim()) { stats.keyident = (stats.keyident || 0) + 1; return this.vault.seal(key.toLowerCase().replace(/[^a-z]/g, '') || 'ident', node, true); }
      if (this.sealing && free && /^(name|title|label|contact|person|customer|client|recipient|sender|from|to)$/i.test(key) && personish(node)) { stats.keyname = (stats.keyname || 0) + 1; return this.vault.seal('name', node, true); }
      return this.sealText(node, stats);
    }
    if (Array.isArray(node)) return node.map((x) => this.sealJSON(x, stats, key, free));
    if (node && typeof node === 'object') {
      if (OPAQUE.has(node.type) || 'inlineData' in node || 'fileData' in node || 'input_audio' in node || 'image_url' in node || (node.source && node.source.type === 'base64'))
        throw new Error(`opaque part (${node.type || Object.keys(node)[0]}) cannot be inspected; blocked`);
      const o = {};
      for (const [k, v] of Object.entries(node)) o[this.sealText(k, stats)] = this.sealJSON(v, stats, k, free || FREE_KEYS.has(k));
      return o;
    }
    return node;
  }

  // strings exactly as sealText will see them (values and keys)
  collect(node, out = new Set(), key = '') {
    const norm = (x) => decodePercent(deobfuscate(x));
    if (typeof node === 'string') { if (!OPAQUE_KEYS.has(key) && !(ID_KEYS.has(key) && /^[A-Za-z0-9_-]+$/.test(node))) out.add(norm(node)); }
    else if (Array.isArray(node)) node.forEach((x) => this.collect(x, out, key));
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) { out.add(norm(k)); this.collect(v, out, k); }
    return out;
  }

  // Invariant, checked on EVERY request: after sealing, the mandatory detectors find nothing outside tokens.
  residual(node, key = '') {
    const check = (t) => {
      const bare = decodePercent(deobfuscate(t)).replace(TOKEN_RE, ' ');
      const left = detectPII(bare).concat(b64Spans(bare));
      if (left.length) throw new Error(`residual ${left[0].cls} after sealing; refusing to forward`);
    };
    if (typeof node === 'string') { if (!OPAQUE_KEYS.has(key) && !(ID_KEYS.has(key) && /^[A-Za-z0-9_-]+$/.test(node))) check(node); }
    else if (Array.isArray(node)) node.forEach((x) => this.residual(x, key));
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) { check(k); this.residual(v, k); }
  }

  // Parse-first entry: the judge reads every string, its spans join ours, then we seal, then the judge re-reads the SEALED text.
  async sealRequest(body, stats = {}) {
    if (!this.judge) { const o = this.sealJSON(body, stats); this.residual(o); return o; }
    this.judged = await this.judge.spansFor([...this.collect(body)]);
    const sealed = this.sealJSON(body, stats);
    this.judged = new Map();
    this.residual(sealed);
    if (this.verify) {
      const texts = [...this.collect(sealed)];
      const again = await this.judge.spansFor(texts);
      for (const [t, spans] of again) {
        const inTok = [...t.matchAll(TOKEN_RE)].map((m) => [m.index, m.index + m[0].length]);
        const left = spans.filter((sp) => !inTok.some(([a, b]) => sp.start >= a && sp.end <= b) && /^(person|handle|address|email|phone|card|iban|ssn|idnum|secret)$/.test(sp.cls));
        if (left.length) throw new Error(`verify: judge still reports ${left[0].cls} after sealing`);
      }
    }
    return sealed;
  }

  unsealJSON(node) {
    if (typeof node === 'string') return this.vault.unseal(node);
    if (Array.isArray(node)) return node.map((x) => this.unsealJSON(x));
    if (node && typeof node === 'object') { const o = {}; for (const [k, v] of Object.entries(node)) o[this.vault.unseal(k)] = this.unsealJSON(v); return o; }
    return node;
  }
}

// Streaming: tokens may be split across deltas. Hold back from the last unclosed OPEN.
export class StreamRestorer {
  constructor(vault) { this.vault = vault; this.buf = new Map(); }
  push(field, piece) {
    const s = (this.buf.get(field) || '') + piece;
    const i = s.lastIndexOf(OPEN);
    let hold = '';
    let emit = s;
    if (i !== -1 && s.indexOf(CLOSE, i) === -1 && s.length - i <= 32) { emit = s.slice(0, i); hold = s.slice(i); }
    this.buf.set(field, hold);
    return this.vault.unseal(emit);
  }
  flush(field) { const h = this.buf.get(field) || ''; this.buf.set(field, ''); return this.vault.unseal(h); }
  fields() { return [...this.buf.entries()].filter(([, v]) => v).map(([k]) => k); }
}

// Every string leaf of an SSE event (any provider shape: OpenAI, Anthropic, Gemini, ...)
// except protocol keys. Each path gets its own carry buffer.
export function streamSlots(ev) {
  const slots = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string') { if (!SKIP.has(k)) slots.push({ f: `${path}.${k}`, get: () => node[k], set: (x) => { node[k] = x; } }); }
      else walk(v, `${path}.${k}`);
    }
  };
  walk(ev, '');
  return slots;
}
