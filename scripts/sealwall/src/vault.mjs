// Vault: key + append-only content-addressed log of referents.
// referent id = HMAC(key, class|normalized) -> stable across turns, sessions, restarts.
// Sealed form seen by the remote model:  ⟦cls.xxxxxxxx⟧
import { createHmac, randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const TOKEN_RE = /⟦([a-z0-9_]+)\.([0-9a-f]{8})⟧/g;
export const OPEN = '⟦', CLOSE = '⟧';

export class Vault {
  constructor(dir = process.env.SEALWALL_HOME || join(homedir(), '.sealwall')) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const kp = join(dir, 'key');
    if (!existsSync(kp)) writeFileSync(kp, randomBytes(32).toString('hex'), { mode: 0o600 });
    this.key = readFileSync(kp, 'utf8').trim();
    this.logPath = join(dir, 'referents.jsonl');
    this.byId = new Map();   // "cls.id" -> {value, restore}
    if (existsSync(this.logPath)) {
      for (const line of readFileSync(this.logPath, 'utf8').split('\n')) {
        if (!line) continue;
        try { const r = JSON.parse(line); this.byId.set(`${r.cls}.${r.id}`, r); } catch {}
      }
    }
  }
  norm(v) { return v.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '); }
  seal(cls, value, restore = true) {
    const id = createHmac('sha256', this.key).update(`${cls}|${this.norm(value)}`).digest('hex').slice(0, 8);
    const k = `${cls}.${id}`;
    if (!this.byId.has(k)) {
      // one-way classes persist only the id, never the value
      const rec = { cls, id, restore, value: restore ? value : null, t: Date.now() };
      this.byId.set(k, rec);
      appendFileSync(this.logPath, JSON.stringify(rec) + '\n', { mode: 0o600 });
    }
    return `${OPEN}${k}${CLOSE}`;
  }
  // Protocol ids must stay ASCII [A-Za-z0-9_-] (Anthropic/OpenAI validate them): keyed, deterministic, shape-preserving.
  pseudo(value) {
    const m = value.match(/^([A-Za-z]+_)?/);
    const h = createHmac('sha256', this.key).update(`id|${value}`).digest('hex');
    return `${m[1] || ''}${h.slice(0, Math.max(16, Math.min(value.length - (m[1] || '').length, 48)))}`;
  }
  // asJsonFragment: the text sits inside a JSON string (streamed tool-call arguments), so restored values are escaped
  unseal(text, asJsonFragment = false) {
    return text.replace(TOKEN_RE, (m, cls, id) => {
      const r = this.byId.get(`${cls}.${id}`);
      if (!(r && r.restore && r.value != null)) return m;
      return asJsonFragment ? JSON.stringify(r.value).slice(1, -1) : r.value;
    });
  }
}
