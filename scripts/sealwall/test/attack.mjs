import http from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const W = new URL('../src/', import.meta.url).pathname;
const { Vault } = await import(W + 'vault.mjs'), { NounSealer } = await import(W + 'nouns.mjs'), { Wall } = await import(W + 'wall.mjs'), { createServer } = await import(W + 'server.mjs');
const home = mkdtempSync(join(tmpdir(), 'atk-'));
writeFileSync(join(home, 'lex.json'), JSON.stringify({ person: ['Ada Quill'] }));
const vault = new Vault(home);
const { Judge } = await import(W + 'judge.mjs');
const wall = new Wall({ vault, judge: process.env.JUDGE ? new Judge({ timeoutMs: 120000 }) : null, sealing: process.env.SEALING !== 'off', nouns: new NounSealer({ lexiconPath: join(home, 'lex.json'), roots: ['/Users/jdoe'] }) });
let captured = [];
const cap = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { captured.push({ url: req.url, headers: req.headers, body: b }); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); }); }).listen(0);
const px = createServer({ wall, vault, upstreams: { t: `http://127.0.0.1:${cap.address().port}` } }).listen(0);
const post = (body, headers = {}, path = '/u/t/v1/chat/completions') => fetch(`http://127.0.0.1:${px.address().port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

const EMAIL = 'leak.test@corp-secret.com', SSN = '123-45-6789', KEY = 'sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWX', NAME = 'Ada Quill', PHONE = '415-555-0134';
const cases = {
  'plain user text': { messages: [{ role: 'user', content: `${EMAIL} ${SSN} ${NAME}` }] },
  'anthropic system array': { system: [{ type: 'text', text: `owner ${EMAIL}` }], messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] },
  'tool_use input key "name"': { messages: [{ role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'create_user', input: { name: NAME, email: EMAIL } }] }] },
  'tool_use input key "id"/"type"/"format"': { messages: [{ role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'x', input: { id: EMAIL, type: SSN, format: NAME, user: PHONE, model: EMAIL, role: NAME } }] }] },
  'openai tool_calls arguments (string)': { messages: [{ role: 'assistant', tool_calls: [{ id: 'c', type: 'function', function: { name: 'f', arguments: JSON.stringify({ name: NAME, email: EMAIL }) } }] }] },
  'tool schema description/enum/default': { tools: [{ type: 'function', function: { name: 'f', description: `for ${EMAIL}`, parameters: { type: 'object', properties: { who: { type: 'string', description: `owner ${NAME}`, enum: [EMAIL], default: SSN } } } } }] },
  'anthropic input_schema': { tools: [{ name: 'f', description: 'd', input_schema: { type: 'object', properties: { a: { description: `contact ${EMAIL}`, default: KEY } } } }] },
  'object KEY holds PII': { messages: [{ role: 'user', content: 'x' }], metadata: { [EMAIL]: 'v', [NAME]: 'w' } },
  'message name field': { messages: [{ role: 'user', name: NAME, content: 'x' }] },
  'tool_result nested blocks': { messages: [{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: [{ type: 'text', text: `file says ${EMAIL} ${KEY}` }] }] }] },
  'responses-api input': { input: [{ role: 'user', content: [{ type: 'input_text', text: EMAIL }] }], instructions: `be nice to ${NAME}` },
  'gemini contents': { contents: [{ role: 'user', parts: [{ text: EMAIL }] }], systemInstruction: { parts: [{ text: SSN }] } },
  'fullwidth @ obfuscation': { messages: [{ role: 'user', content: 'leak.test＠corp-secret.com' }] },
  'zero-width in email': { messages: [{ role: 'user', content: 'leak.test@corp-​secret.com' }] },
  'spaced email (at/dot)': { messages: [{ role: 'user', content: 'leak.test [at] corp-secret [dot] com' }] },
  'base64 of email': { messages: [{ role: 'user', content: Buffer.from(EMAIL).toString('base64') }] },
  'url-encoded email': { messages: [{ role: 'user', content: 'mailto:leak.test%40corp-secret.com' }] },
  'name lowercase / initials': { messages: [{ role: 'user', content: 'my name is john smith, I live at 14 Elm Street, Springfield' }] },
  'single first name': { messages: [{ role: 'user', content: 'Tell Michael that Priya called' }] },
  'ssn without dashes': { messages: [{ role: 'user', content: 'ssn 123456789' }] },
  'phone intl/dotted': { messages: [{ role: 'user', content: 'call +44 20 7946 0958 or (415) 555 0134' }] },
  'secret in env-style line': { messages: [{ role: 'user', content: 'OPENAI_API_KEY=abcdef1234567890abcdef\nDATABASE_URL=postgres://u:hunter2pw@db.internal/x' }] },
  'long generic hex token': { messages: [{ role: 'user', content: 'token 9f8e7d6c5b4a39281706f5e4d3c2b1a0' }] },
  'url query param': { messages: [{ role: 'user', content: 'https://api.x.com/v1?api_key=ZZZZ1234567890ZZZZ&email=a@b.co' }] },
  'path with username (not root)': { messages: [{ role: 'user', content: '/home/jdoe/projects/acme/secret.txt' }] },
  'stream_options / extra top-level strings': { messages: [{ role: 'user', content: 'x' }], user: EMAIL, safety_identifier: NAME, prompt_cache_key: SSN },
};
const probes = [EMAIL, 'corp-secret', SSN, '123456789', KEY, NAME, 'Ada', PHONE, 'john smith', 'Elm Street', 'Michael', 'Priya', '7946 0958', 'hunter2pw', 'abcdef1234567890abcdef', '9f8e7d6c5b4a', 'ZZZZ1234567890', 'a@b.co', 'jdoe', 'leak.test', Buffer.from(EMAIL).toString('base64'), 'leak.test%40'];
for (const [name, body] of Object.entries(cases)) {
  captured = [];
  const r = await post(body);
  const c = captured[0];
  const raw = c ? c.body : '(blocked/not forwarded: ' + r.status + ')';
  const leaks = probes.filter(p => raw.includes(p) && JSON.stringify(body).includes(p));
  console.log(leaks.length ? 'LEAK ' : 'ok   ', name.padEnd(42), leaks.length ? JSON.stringify(leaks) : '');
}
// headers
captured = [];
await post({ messages: [{ role: 'user', content: 'x' }] }, { 'x-er7-workspace': '/Users/jdoe/code/acme/secret-client-acme', 'x-user-email': EMAIL, 'x-forwarded-for': '203.0.113.9' });
console.log(captured[0].headers['x-user-email'] ? 'LEAK ' : 'ok   ', 'custom headers forwarded verbatim:', JSON.stringify({ ws: captured[0].headers['x-er7-workspace'], mail: captured[0].headers['x-user-email'] }));
// URL path/query
captured = [];
await post({ messages: [{ role: 'user', content: 'x' }] }, {}, `/u/t/v1/chat/completions?user=${EMAIL}`);
console.log(captured[0].url.includes(EMAIL) ? 'LEAK ' : 'ok   ', 'query string:', captured[0].url);
process.exit(0);
