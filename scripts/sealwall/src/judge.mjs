// Judge: the fold suite's local PII redactor (the-fold/scripts/pii: Presidio + spaCy, reads lowercase/informal text).
//   POST /redact {"texts":[...],"threshold":0.35} -> {"spans":[[{start,end,type,score}],...]}   (JS string offsets)
// Its spans are UNIONED with sealwall's own shapes. If a judge is configured and cannot answer, nothing is forwarded.
const TYPE = {
  PERSON: ['person', true], NAME_CANDIDATE: ['name', true], HANDLE: ['handle', true], ADDRESS: ['address', true],
  EMAIL_ADDRESS: ['email', true], PHONE_NUMBER: ['phone', true], IP_ADDRESS: ['ipv4', true], MAC_ADDRESS: ['mac', true],
  CREDIT_CARD: ['card', false], IBAN_CODE: ['iban', false], US_SSN: ['ssn', false], US_ITIN: ['ssn', false], US_PASSPORT: ['idnum', false],
  US_DRIVER_LICENSE: ['idnum', false], US_BANK_NUMBER: ['idnum', false], UK_NHS: ['idnum', false], MEDICAL_LICENSE: ['idnum', false], CRYPTO: ['secret', false],
  LOCATION: ['loc', true], ORGANIZATION: ['org', true], NRP: ['group', true], URL: ['url', true],
};

export class Judge {
  constructor({ url = 'http://127.0.0.1:18795', threshold = 0.35, timeoutMs = 120000, parallel = 4, nameCandidates = false, fetchImpl = fetch } = {}) {
    this.nameCandidates = nameCandidates;   // NAME_CANDIDATE = any PROPN tag: a candidate generator, far too noisy to seal or to fail on
    this.parallel = parallel;
    this.url = url.replace(/\/+$/, ''); this.threshold = threshold; this.timeoutMs = timeoutMs; this.fetch = fetchImpl;
    this.cache = new Map();           // text -> spans, bounded
  }
  async one(batch) {
    let j;
    try {
      const r = await this.fetch(`${this.url}/redact`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texts: batch, threshold: this.threshold }), signal: AbortSignal.timeout(this.timeoutMs) });
      if (!r.ok) throw new Error(`judge HTTP ${r.status}`);
      j = await r.json();
    } catch (e) { throw new Error(`judge unavailable (${e.message}); failing closed`); }
    if (!Array.isArray(j.spans) || j.spans.length !== batch.length) throw new Error('judge returned a malformed answer; failing closed');
    batch.forEach((t, k) => this.cache.set(t, (j.spans[k] || []).filter((s) => TYPE[s.type] && (s.type !== 'NAME_CANDIDATE' || this.nameCandidates)).map((s) => ({ start: s.start, end: s.end, cls: TYPE[s.type][0], restore: TYPE[s.type][1], value: t.slice(s.start, s.end) }))));
  }
  async spansFor(texts) {
    const need = [...new Set(texts)].filter((t) => t && !this.cache.has(t));
    const batches = [];
    for (let i = 0; i < need.length; i += 12) batches.push(need.slice(i, i + 12));
    for (let i = 0; i < batches.length; i += this.parallel) await Promise.all(batches.slice(i, i + this.parallel).map((b) => this.one(b)));
    if (this.cache.size > 5000) for (const k of [...this.cache.keys()].slice(0, 2500)) this.cache.delete(k);
    return new Map(texts.filter(Boolean).map((t) => [t, this.cache.get(t) || []]));
  }
}
