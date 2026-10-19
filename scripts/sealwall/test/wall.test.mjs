import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Vault } from '../src/vault.mjs';
import { NounSealer } from '../src/nouns.mjs';
import { Wall } from '../src/wall.mjs';
import { createServer } from '../src/server.mjs';

const home = mkdtempSync(join(tmpdir(), 'sw-'));
writeFileSync(join(home, 'lex.json'), JSON.stringify({ person: ['Ada Quill'], project: ['Zephyrus'] }));
const vault = new Vault(home);
const wall = new Wall({ vault, nouns: new NounSealer({ lexiconPath: join(home, 'lex.json'), roots: ['/Users/jdoe/code/acme'] }) });

test('redacts PII and secrets, stable referents', () => {
  const t = 'mail ada@corp.com, ssn 123-45-6789, card 4111 1111 1111 1111, key sk-ant-abcdefghijklmnopqrstuvwx, call 415-555-0134';
  const a = wall.sealText(t), b = wall.sealText(t);
  assert.equal(a, b);
  for (const raw of ['ada@corp.com', '123-45-6789', '4111 1111', 'sk-ant-abc', '415-555-0134']) assert.ok(!a.includes(raw), raw);
  assert.equal(vault.unseal(a).includes('ada@corp.com'), true);        // restorable
  assert.equal(vault.unseal(a).includes('123-45-6789'), false);        // one-way
  assert.equal(vault.unseal(a).includes('sk-ant'), false);
});

test('nouns: lexicon, roots, proper nouns, case-insensitive stable', () => {
  const s = wall.sealText('Ada Quill works on Zephyrus in /Users/jdoe/code/acme/src with Grace Hopper');
  for (const raw of ['Ada Quill', 'Zephyrus', '/Users/jdoe', 'Grace Hopper']) assert.ok(!s.includes(raw), raw);
  assert.equal(wall.sealText('ada quill'), wall.sealText('ADA QUILL'));
  assert.equal(vault.unseal(s), 'Ada Quill works on Zephyrus in /Users/jdoe/code/acme/src with Grace Hopper');
});

test('protocol structure untouched', () => {
  const o = wall.sealJSON({ model: 'claude-x', messages: [{ role: 'user', content: 'hi ada@corp.com' }], tools: [{ type: 'function', function: { name: 'read_file', parameters: { a: 'Ada Quill' } } }] });
  assert.equal(o.model, 'claude-x'); assert.equal(o.tools[0].function.name, 'read_file');
  assert.ok(!o.messages[0].content.includes('ada@'));
});

test('proxy end-to-end: seals request, restores streamed response split mid-token', async () => {
  let seen;
  const up = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      seen = JSON.parse(b);
      const tok = seen.messages[0].content.match(/⟦[^⟧]+⟧/)[0];
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const mid = Math.floor(tok.length / 2);
      for (const piece of ['Hello ', tok.slice(0, mid), tok.slice(mid), '!']) res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: piece } }] })}\n\n`);
      res.write('data: [DONE]\n\n'); res.end();
    });
  }).listen(0);
  const px = createServer({ wall, vault, upstreams: { t: `http://127.0.0.1:${up.address().port}` } }).listen(0);
  const r = await fetch(`http://127.0.0.1:${px.address().port}/u/t/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stream: true, messages: [{ role: 'user', content: 'ping ada@corp.com' }] }) });
  const txt = await r.text();
  const got = txt.split('\n').filter((l) => l.startsWith('data: {')).map((l) => JSON.parse(l.slice(6)).choices[0].delta.content).join('');
  assert.ok(!seen.messages[0].content.includes('ada@corp.com'));
  assert.equal(got, 'Hello ada@corp.com!');
  up.close(); px.close();
});

test('strict: opaque parts and non-inspectable bodies are blocked, never forwarded', () => {
  assert.throws(() => wall.sealJSON({ messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', data: 'AAAA' } }] }] }));
  assert.throws(() => wall.sealJSON({ contents: [{ parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }] }] }));
  assert.ok(!wall.sealJSON({ user: 'ada@corp.com' }).user.includes('ada@'));
});

test('gemini-shaped stream restores via generic slots', async () => {
  const { StreamRestorer, streamSlots } = await import('../src/wall.mjs');
  const tok = vault.seal('email', 'q@z.org');
  const sr = new StreamRestorer(vault);
  let out = '';
  for (const piece of [tok.slice(0, 5), tok.slice(5)]) {
    const ev = { candidates: [{ content: { parts: [{ text: piece }] } }] };
    for (const s of streamSlots(ev)) s.set(sr.push(s.f, s.get()));
    out += ev.candidates[0].content.parts[0].text;
  }
  assert.equal(out, 'q@z.org');
});

test('judge: spans from the redactor are sealed; verify and outage fail closed', async () => {
  const { Judge } = await import('../src/judge.mjs');
  const fake = async (url, init) => {
    const { texts } = JSON.parse(init.body);
    return { ok: true, json: async () => ({ spans: texts.map((t) => [...t.matchAll(/priya|john smith/gi)].map((m) => ({ start: m.index, end: m.index + m[0].length, type: 'PERSON', score: 0.9 }))) }) };
  };
  const w = new Wall({ vault, nouns: wall.nouns, judge: new Judge({ fetchImpl: fake }) });
  const out = await w.sealRequest({ messages: [{ role: 'user', content: 'tell priya and john smith' }] });
  assert.ok(!/priya|john smith/i.test(JSON.stringify(out)));
  assert.equal(w.vault.unseal(out.messages[0].content), 'tell priya and john smith');
  const down = new Wall({ vault, nouns: wall.nouns, judge: new Judge({ fetchImpl: async () => { throw new Error('ECONNREFUSED'); } }) });
  await assert.rejects(() => down.sealRequest({ messages: [{ role: 'user', content: 'hi' }] }), /failing closed/);
});

test('redaction is unconditional: sealing OFF still redacts PII and suspected keys, leaves nouns', () => {
  const w = new Wall({ vault, nouns: wall.nouns, sealing: false });
  const t = 'Ada Quill at ada@corp.com used key Zk3pQ9vL2mXr8TbN4wYh7JcA5sDf and Grace Hopper visited Paris';
  const o = w.sealText(t);
  assert.ok(!o.includes('ada@corp.com') && !o.includes('Zk3pQ9vL2mXr8TbN4wYh7JcA5sDf'));
  assert.ok(!o.includes('Ada Quill'));                       // lexicon person is PII: still redacted
  assert.ok(o.includes('Grace Hopper') && o.includes('Paris')); // nouns untouched when sealing is off
});

test('suspected keys: vendor shapes, high-entropy tokens, env/secret keys; not slugs/ids', () => {
  for (const k of ['glpat-abcdefghij1234567890', 'AKIAIOSFODNN7EXAMPLE', 'Zk3pQ9vL2mXr8TbN4wYh7JcA5sDf', 'postgres://u:hunter2pw@db/x']) assert.ok(!/hunter2pw|glpat-abc|AKIAIOS|Zk3pQ9/.test(wall.sealText(`x ${k} y`)), k);
  for (const ok of ['claude-sonnet-4-5-20250929', 'read_file', 'getUserProfile2', 'LanguageModelV3CallOptions', 'SQLiteEffectRelationalQueryV2', '20260127222353_familiar_lady_ursula', 'gemini-2.0-flash', '550e8400-e29b-41d4-a716-446655440000']) assert.equal(wall.sealText(ok), ok, ok);
});

test('residual invariant: a detector bypass is caught before forwarding', async () => {
  const w = new Wall({ vault, nouns: wall.nouns });
  assert.throws(() => w.residual({ a: 'raw ada@corp.com leaked' }), /residual/);
  assert.doesNotThrow(() => w.residual(w.sealJSON({ a: 'ada@corp.com' })));
});

test('protocol ids: redacted but API-valid and consistent; provider signatures pass verbatim', () => {
  const id = 'toolu_01NSbhSJdF1R6Uz81RRKxd55';
  const o = wall.sealJSON({ messages: [{ role: 'assistant', content: [{ type: 'tool_use', id, name: 'f', input: {} }, { type: 'thinking', thinking: 't', signature: 'Ev8CCrIBCBIYAbCdEf12345XyZ' }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] }] });
  const a = o.messages[0].content[0].id, b = o.messages[1].content[0].tool_use_id;
  assert.notEqual(a, id); assert.equal(a, b); assert.match(a, /^toolu_[A-Za-z0-9_-]+$/);
  assert.equal(o.messages[0].content[1].signature, 'Ev8CCrIBCBIYAbCdEf12345XyZ');
  wall.residual(o);
});

test('opencode session headers are forwarded (upstream requires them); identity headers are not', async () => {
  let seen;
  const up = http.createServer((req, res) => { seen = req.headers; res.end('{}'); }).listen(0);
  const px = createServer({ wall, vault, upstreams: { t: `http://127.0.0.1:${up.address().port}` } }).listen(0);
  await fetch(`http://127.0.0.1:${px.address().port}/u/t/v1/x`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-opencode-session': 'ses_abc123', 'x-opencode-request': 'req_9', 'x-er7-workspace': '/Users/jdoe/code/acme', 'x-user-email': 'a@b.co' }, body: '{}' });
  assert.equal(seen['x-opencode-session'], 'ses_abc123'); assert.equal(seen['x-opencode-request'], 'req_9');
  assert.equal(seen['x-er7-workspace'], undefined); assert.equal(seen['x-user-email'], undefined);
  up.close(); px.close();
});
