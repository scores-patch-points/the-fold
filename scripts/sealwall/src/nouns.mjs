// Noun referents. Three sources, in priority order:
//  1. lexicon  (~/.sealwall/lexicon.json: {person:[..], org:[..], project:[..], place:[..], ...})
//  2. roots    (absolute path prefixes -> one stable `path` referent each)
//  3. heuristics: multiword Proper Nouns in prose, and hostnames not on the public allowlist
// Optional `identifiers` mode seals camelCase/snake_case identifiers too (off: breaks model's code skill).
import { readFileSync, existsSync } from 'node:fs';

const PUBLIC_HOSTS = /(^|\.)(github\.com|githubusercontent\.com|npmjs\.org|npmjs\.com|anthropic\.com|openai\.com|opencode\.ai|localhost|example\.(com|org)|w3\.org|mozilla\.org|wikipedia\.org|stackoverflow\.com|python\.org|nodejs\.org|json-schema\.org|googleapis\.com)$/i;
const STOP = new Set('The A An This That These Those It In On At For From To Of And Or But If When Then Note See Error Warning TODO Returns Example Usage Step Run Use Add Fix Update Create Read Write Edit Open Close Set Get Check Make Build Test Install Start Stop Yes No True False None Null JSON HTTP HTTPS API CLI URL HTML CSS SQL UTF'.split(' '));
const PROPER = /\b(?:[A-Z][a-z]{2,}(?:[ \t]+(?:of|de|van|von|la|the)[ \t]+)?[ \t]+)+[A-Z][a-z]{2,}\b/g;
const HOST = /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|dev|ai|co|app|cloud|internal|local|corp|lan|edu|gov)\b/gi;
const IDENT = /\b(?:[a-z]+[A-Z][A-Za-z0-9]*|[A-Za-z]+_[A-Za-z0-9_]+)\b/g;

export class NounSealer {
  constructor({ lexiconPath, roots = [], identifiers = false } = {}) {
    this.roots = roots.map((r) => r.replace(/\/+$/, '')).sort((a, b) => b.length - a.length);
    this.identifiers = identifiers;
    this.lex = [];
    if (lexiconPath && existsSync(lexiconPath)) {
      const j = JSON.parse(readFileSync(lexiconPath, 'utf8'));
      for (const [cls, words] of Object.entries(j))
        for (const w of words) this.lex.push({ cls, word: w, re: new RegExp(`(?<![\\w])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, 'gi') });
      this.lex.sort((a, b) => b.word.length - a.word.length);
    }
  }
  detect(text) {
    const spans = [];
    for (const r of this.roots) {
      let i = -1;
      while ((i = text.indexOf(r, i + 1)) !== -1) spans.push({ start: i, end: i + r.length, cls: 'path', restore: true, value: r });
    }
    for (const l of this.lex) {
      l.re.lastIndex = 0;
      for (const m of text.matchAll(l.re)) spans.push({ start: m.index, end: m.index + m[0].length, cls: l.cls, restore: true, value: m[0] });
    }
    for (const m of text.matchAll(HOST)) if (!PUBLIC_HOSTS.test(m[0])) spans.push({ start: m.index, end: m.index + m[0].length, cls: 'host', restore: true, value: m[0] });
    for (const m of text.matchAll(PROPER)) {
      const words = m[0].split(/\s+/);
      if (words.every((w) => STOP.has(w))) continue;
      const first = words[0];
      let v = m[0], s = m.index;
      if (STOP.has(first)) { v = m[0].slice(first.length).trimStart(); s = m.index + m[0].length - v.length; if (!/\s/.test(v)) continue; }
      spans.push({ start: s, end: s + v.length, cls: 'name', restore: true, value: v });
    }
    if (this.identifiers) for (const m of text.matchAll(IDENT)) spans.push({ start: m.index, end: m.index + m[0].length, cls: 'ident', restore: true, value: m[0] });
    return spans;
  }
}
