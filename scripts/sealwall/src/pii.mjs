// PII + secret detectors. Each returns spans {start,end,cls,restore}.
// restore=false  -> one-way: the real value is never kept for un-sealing.
const luhn = (s) => {
  const d = s.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = +d[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
};
const ssnOk = (s) => {
  const [a, b, c] = s.split('-');
  return a !== '000' && a !== '666' && a[0] !== '9' && b !== '00' && c !== '0000';
};

// "Suspected key": long, mixed-class, high-entropy, and not a slug / identifier / uuid / path component.
const shannon = (str) => { const f = {}; for (const c of str) f[c] = (f[c] || 0) + 1; return -Object.values(f).reduce((a, n) => a + (n / str.length) * Math.log2(n / str.length), 0); };
export function looksLikeSecret(s) {
  if (!/\d/.test(s) || !/[A-Za-z]/.test(s)) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return false;       // uuid
  if (/^[a-z0-9]+(?:[-_.][a-z0-9.]+)+$/.test(s) && !/[A-Z]/.test(s) && s.split(/[-_.]/).every((w) => w.length <= 10 && (/^\d+$/.test(w) || /^[a-z]+\d*$/.test(w)))) return false; // kebab/snake slug, model ids
  if (/^[a-z]*(?:[A-Z]+[a-z]{2,}|[A-Z]\d{1,2}|\d{1,2})+$/.test(s) && /[a-z]{3}/.test(s)) return false;     // camel/Pascal identifiers (LanguageModelV3Prompt, SQLiteQueryV2)
  // random tokens flip char class (lower/upper/digit) constantly; identifiers, slugs and migration names do not
  const cls = (c) => (/\d/.test(c) ? 'd' : /[a-z]/.test(c) ? 'l' : /[A-Z]/.test(c) ? 'u' : '-');
  let flips = 0, n = 0, prev = null;
  for (const c of s) { const k = cls(c); if (k === '-') { prev = null; continue; } if (prev && prev !== k) flips++; prev = k; n++; }
  return shannon(s) >= 3.7 && flips / Math.max(n, 1) >= 0.3;
}

export const DETECTORS = [
  // secrets first (longest/most specific win on overlap)
  { cls: 'privkey', restore: false, re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { cls: 'jwt', restore: false, re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { cls: 'apikey', restore: false, re: /\b(?:sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[abprs]-[A-Za-z0-9-]{10,}|sk_live_[A-Za-z0-9]{16,}|npm_[A-Za-z0-9]{30,}|hf_[A-Za-z0-9]{30,}|glpat-[A-Za-z0-9_-]{20,}|xapp-[A-Za-z0-9-]{20,}|dop_v1_[a-f0-9]{40,}|SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|shp(?:at|ca|pa)_[a-f0-9]{32}|ya29\.[A-Za-z0-9_-]{20,}|AC[a-f0-9]{32}|[rp]k_live_[A-Za-z0-9]{16,}|sk_[a-z]+_[A-Za-z0-9]{16,}|ghs_[A-Za-z0-9]{30,}|pypi-[A-Za-z0-9_-]{30,}|(?:ssh-rsa|ssh-ed25519) AAAA[A-Za-z0-9+/=]{20,})\b/g },
  { cls: 'basicauth', restore: false, re: /(?<=\bBasic\s)[A-Za-z0-9+/=]{12,}/g },
  { cls: 'connstr', restore: false, re: /(?<=(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?):\/\/[^\s:@]+:)[^\s@]+(?=@)/g },
  { cls: 'bearer', restore: false, re: /(?<=\bBearer\s)[A-Za-z0-9._~+/=-]{16,}/g },
  { cls: 'secretkv', restore: false, re: /(?<=\b(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|auth)["']?\s*[:=]\s*["']?)[^\s"'`,;]{6,}/gi },
  { cls: 'urlcred', restore: false, re: /(?<=:\/\/[^\s/:@]+:)[^\s/@]+(?=@)/g },
  { cls: 'envsecret', restore: false, re: /(?<=\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH)[A-Z0-9_]*\s*[:=]\s*["']?)[^\s"'`,;]{6,}/g },
  { cls: 'urluser', restore: false, re: /(?<=:\/\/)[^\s/:@]+(?=:[^\s/@]+@)/g },
  { cls: 'urlsecret', restore: false, re: /(?<=[?&](?:api[_-]?key|key|token|access[_-]?token|secret|password|auth|sig|signature)=)[^\s&"'#]{6,}/gi },
  { cls: 'entropy', restore: false, re: /(?<![A-Za-z0-9_=-])[A-Za-z0-9_=-]{20,}(?![A-Za-z0-9_=-])/g, ok: looksLikeSecret },
  { cls: 'hextoken', restore: false, re: /\b[0-9a-f]{32,}\b/gi },
  { cls: 'b64token', restore: false, re: /\b(?=[A-Za-z0-9_-]*[A-Z])(?=[A-Za-z0-9_-]*[a-z])(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{32,}\b/g },
  // personal identifiers
  { cls: 'email', restore: true, re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g },
  { cls: 'ssn', restore: false, re: /\b\d{3}-\d{2}-\d{4}\b/g, ok: ssnOk },
  { cls: 'ssn', restore: false, re: /(?<=\b(?:ssn|social security(?: number)?|social)\W{0,4})\d{3}[ -]?\d{2}[ -]?\d{4}\b/gi },
  { cls: 'card', restore: false, re: /\b(?:\d[ -]?){13,19}\b/g, ok: luhn },
  { cls: 'iban', restore: false, re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
  { cls: 'phone', restore: true, re: /(?<![\w.])(?:\+?\d{1,3}[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]\d{4}(?!\d)/g },
  { cls: 'phone', restore: true, re: /(?<![\w.])\+\d{1,3}(?:[ .-]?\(?\d{1,4}\)?){2,5}(?!\d)/g, ok: (s) => s.replace(/\D/g, '').length >= 8 },
  { cls: 'ipv4', restore: true, re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, ok: (s) => !/^(127\.|0\.|255\.)/.test(s) },
  { cls: 'ipv6', restore: true, re: /\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b/gi },
  { cls: 'mac', restore: true, re: /\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/gi },
  { cls: 'dob', restore: true, re: /(?<=\b(?:dob|date of birth|born|birthday)\W{1,4})\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/gi },
  { cls: 'homedir', restore: true, re: /(?<=\/(?:Users|home)\/)[A-Za-z0-9._-]+/g, ok: (s) => !['Shared', 'Guest', 'runner'].includes(s) },
];

export function detectPII(text, extra = []) {
  const spans = [];
  for (const d of [...DETECTORS, ...extra]) {
    d.re.lastIndex = 0;
    for (const m of text.matchAll(d.re)) {
      if (d.ok && !d.ok(m[0])) continue;
      spans.push({ start: m.index, end: m.index + m[0].length, cls: d.cls, restore: d.restore, value: m[0] });
    }
  }
  return resolve(spans);
}

// earlier-listed detectors win ties; longer wins overlaps
export function resolve(spans) {
  spans.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const out = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && s.start < last.end) continue;
    out.push(s);
  }
  return out;
}

// ---- normalization: defeat obfuscation before detection (what is sent is the normalized form) ----
const INVIS = /[\u200b-\u200f\u2060-\u2064\u202a-\u202e\u2066-\u2069\ufeff\u00ad]/g;
export function deobfuscate(text) {
  let t = text.normalize('NFKC').replace(INVIS, '');
  t = t.replace(/\s*[\[(<{]\s*(?:at|AT)\s*[\])>}]\s*/g, '@').replace(/\s*[\[(<{]\s*(?:dot|DOT)\s*[\])>}]\s*/g, '.');
  t = t.replace(/(?<=[\w.-])\s+(?:at|AT)\s+(?=[\w-]+\s+(?:dot|DOT)\s+\w)/g, '@').replace(/(?<=[\w-])\s+(?:dot|DOT)\s+(?=\w)/g, '.');
  return t;
}
// %XX runs that decode to something PII-bearing are replaced by their decoded form
export function decodePercent(text) {
  if (!/%[0-9a-fA-F]{2}/.test(text)) return text;
  try { const d = decodeURIComponent(text); return detectPII(d).length ? d : text; } catch { return text; }
}
// base64 tokens that decode to printable text containing PII are returned as spans to seal whole
export function b64Spans(text) {
  const out = [];
  for (const m of text.matchAll(/(?<![A-Za-z0-9+/_-])[A-Za-z0-9+/_-]{16,}={0,2}(?![A-Za-z0-9+/_-])/g)) {
    let d; try { d = Buffer.from(m[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch { continue; }
    if (!d || /[\x00-\x08\x0e-\x1f\ufffd]/.test(d) || !detectPII(d).length) continue;
    out.push({ start: m.index, end: m.index + m[0].length, cls: 'b64pii', restore: false, value: m[0] });
  }
  return out;
}
