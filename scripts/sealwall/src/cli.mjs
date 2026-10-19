#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Vault } from './vault.mjs';
import { NounSealer } from './nouns.mjs';
import { Wall } from './wall.mjs';
import { createServer } from './server.mjs';
import { Judge } from './judge.mjs';

const [cmd = 'help', ...rest] = process.argv.slice(2);
const vault = new Vault();
const cfgPath = process.env.SEALWALL_CONFIG || join(vault.dir, 'config.json');
const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {};
const nouns = new NounSealer({ lexiconPath: join(vault.dir, 'lexicon.json'), roots: cfg.roots || [process.cwd()], identifiers: !!cfg.identifiers });
const judge = cfg.judge ? new Judge(typeof cfg.judge === 'object' ? cfg.judge : {}) : null;
const wall = new Wall({ vault, nouns, judge, verify: cfg.verify !== false, sealing: cfg.sealing !== false, coveredScripts: cfg.coveredScripts || [] });
const stdin = () => readFileSync(0, 'utf8');

// Redaction is non-negotiable: refuse to serve if the mandatory layer does not redact its own canaries.
function selfTest() {
  const canary = 'a.canary@example-corp.com 123-45-6789 sk-ant-api03-CANARYCANARYCANARYCANARY Zk3pQ9vL2mXr8TbN4wYh7JcA5sDf postgres://u:canarypw9@h/db';
  const out = wall.sealText(canary);
  for (const raw of ['a.canary@', '123-45-6789', 'CANARYCANARY', 'Zk3pQ9vL2m', 'canarypw9']) if (out.includes(raw)) { console.error(`sealwall self-test FAILED: ${raw} survived redaction`); process.exit(1); }
}
if (cmd === 'serve') {
  selfTest();
  // a bad request must never take the firewall down (down = every model call fails closed)
  process.on('uncaughtException', (e) => console.error('sealwall uncaught:', e.message));
  process.on('unhandledRejection', (e) => console.error('sealwall unhandled:', e && e.message));
  const upstreams = cfg.upstreams || {};
  const port = +(process.env.SEALWALL_PORT || cfg.port || 8791);
  createServer({ wall, vault, upstreams, allowHosts: cfg.allowHosts || [] }).listen(port, '127.0.0.1', () =>
    console.error(`sealwall on http://127.0.0.1:${port}  routes: ${Object.keys(upstreams).map((k) => `/u/${k}`).join(' ') || '(none — edit ' + cfgPath + ')'}`));
} else if (cmd === 'seal') process.stdout.write(wall.sealText(stdin()));
else if (cmd === 'unseal') process.stdout.write(vault.unseal(stdin()));
else if (cmd === 'opencode-config') {
  // provider entries to merge into ~/.config/opencode/opencode.jsonc (opencode AND foldcode read the same file)
  const port = process.env.SEALWALL_PORT || cfg.port || 8791;
  const provider = {};
  for (const name of Object.keys(cfg.upstreams || {}))
    provider[`sealed-${name}`] = { name: `Sealed · ${name}`, npm: '@ai-sdk/openai-compatible', options: { baseURL: `http://127.0.0.1:${port}/u/${name}/v1` }, models: Object.fromEntries((cfg.models?.[name] || []).map((m) => [m, { name: m }])) };
  console.log(JSON.stringify({ provider }, null, 2));
} else console.log(`sealwall <serve|seal|unseal|opencode-config>
  serve            run the firewall proxy (config: ${cfgPath})
  seal   < text    show what a remote model would see
  unseal < text    restore sealed referents locally`);
