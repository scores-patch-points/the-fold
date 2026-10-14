// fold-chat-reason-lint.js — the fold's MODELLESS reasoning: derive claims from the read, lint each
// inference with khora's Kelsen linter (vendored byte-identical), and surface the linted reasoning
// as a murmur — IN THE LANGUAGE THAT WAS READ (fold-chat-murmur-i18n.js). No model.
//
// Claim recovery is language- and script-aware: per-language relation lexicons (functional/acyclic/
// symmetric), clause spans instead of English capitalization for han/she — a claim that cannot be
// recovered is a typed gap, never a fabricated finding.
import { lintGfp } from "./vendor/khora/native/organs/reasoning-lint.js";
import { claimFromTriple } from "./vendor/khora/native/kernel/gfp-claim.js";
import { detectLang, RELATIONS_OF, RELATION_VERBS, ARG1_TAILS, ARG1_PREPS } from "./fold-chat-murmur-i18n.js";

// explicit codepoints only — no ranges, no unescaped ] (a – range silently poisons the class)
// (also cuts `(`‑inserted asides and the em/en dashes as normal clause edges)
const CLAUSE_BOUNDARY = /[\u3002\uFF01\uFF1F!?.,\uFF0C\u3001\uFF1B\uFF1A:\u2026\u2014\u2013\u00AB\u00BB\u201E\u201C\u201D\u2019"()\uFF09\]]/u;
const SPACED = new Set(["latin", "cyrillic"]);
const fold = (s) => String(s || "").normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
const NAME_RE = /\b([\p{Lu}][\p{L}\p{M}]*\b(?:[\s\-\u2010][\p{Lu}][\p{L}\p{M}]*\b)*)/gu;

const clip = (s) => {
  const i = s.search(CLAUSE_BOUNDARY);
  return (i === -1 ? s : s.slice(0, i)).trim();
};

/** Strip a clause-final adverbial tail off an ARG1 span — a claim's object is what the verb acts on,
 *  not when/always ("Alice beats Bob every time" claims beats(Alice, Bob)). Curated per language. */
function arg1Span(s, lang) {
  let out = clip(s);
  for (const prep of ARG1_PREPS[lang] || []) {
    const re = new RegExp(`^${prep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "iu");
    if (re.test(out)) { out = out.replace(re, "").trim(); break; }
  }
  for (const tail of ARG1_TAILS[lang] || []) {
    const re = new RegExp(`\\s+${tail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "iu");
    if (re.test(out)) { out = out.replace(re, "").trim(); break; }
  }
  return out;
}

/** The subject of a latin/cyrillic clause: the fragment nearest the VERB (a comma separates the leading
 *  sentence 'In the game, Alice...' from its subject; the capitalization run alone would only ever give
 *  "The" or "This" — a determiner). Operate on the RAW pre-verb span — commas split, they do not clip. */
function arg0Span(pre, lang) {
  const cut = String(pre).lastIndexOf(",");
  const span = cut === -1 ? String(pre) : String(pre).slice(cut + 1);
  return clip(span).replace(/^(the|a|an|die|der|das|ein|eine|el|la|los|las|un|una|le|les|the|an)\s+/iu, "").trim();
}

/** Mechanically derive gfpClaims from a read, in the language of each passage. Latin/cyrillic keep the
 *  capitalized-subject heuristic; han (zh/ja) and Hebrew recover spans around the relation verb — a
 *  spaced clause boundary replaces the caps that those scripts do not have. */
export function deriveClaims(passages, { relations = null } = {}) {
  const claims = [];
  for (const p of passages || []) {
    const text = String(p?.text || "").replace(/\s+/g, " ");
    if (!text) continue;
    const { lang, script } = detectLang(text);
    const rel = relations || RELATIONS_OF(lang);
    const verbList = [...(rel.acyclic || []), ...(rel.functional || []), ...(rel.symmetric || [])];
    const verbs = new Set(verbList.map(fold));
    const sents = script === "han"
      ? text.split(/[\u3002\uFF01\uFF1F!?]/u).map((s) => s.trim()).filter(Boolean)
      : text.split(/(?<=[.!?。！？])\s+/u).slice(0, 60);
    for (const s of sents) {
      if (script === "han" || script === "hebrew") {
        // pivot-less scripts: the verb pivots the span; a clause boundary stands in for caps. Hebrew is
        // spaced but has no case — same pivot, whitespace tokens are joined back into spans.
        const toks = s.split(" ").filter(Boolean);
        const body = toks.join(" ");
        for (const word of verbList) {
          const v = String(word);
          if (!body.includes(v)) continue;
          const at = body.indexOf(v);
          const head = clip(body.slice(0, at));
          const tail = clip(body.slice(at + v.length));
          if (!head || !tail) continue;
          const cleanTail = tail.replace(/^(的|了|は|が|を|に|の|את|על|עם|של)/u, "").trim();
          const cleanHead = head.replace(/(的|了|は|が|を|に|の|ה)$/u, "").trim();
          const ARG0 = cleanHead || head;
          const ARG1 = cleanTail || tail;
          if (ARG0.length < 1 || ARG1.length < 1) continue;
          claims.push(claimFromTriple(ARG0, word, ARG1, { ground: p.ref || p.source || "/", basis: { witness: p.ref || p.url || null } }));
          break; // one pivot per clause in a pivot-less script
        }
      } else {
        const toks = s.split(" ");
        for (let i = 0; i < toks.length; i++) {
          const raw = toks[i];
          const v = fold(raw.replace(/[^\p{L}\p{N}]/gu, ""));
          if (!verbs.has(v) || v.length < 2) continue;
          const a0 = arg0Span(toks.slice(0, i).join(" "), lang);
          const a1 = arg1Span(toks.slice(i + 1).join(" "), lang);
          if (!a0 || !a1 || a0.length < 3) continue;
          claims.push(claimFromTriple(a0, raw.replace(/[^\p{L}\p{N}]/gu, ""), a1, { ground: p.ref || p.source || "/", basis: { witness: p.ref || p.url || null } }));
        }
      }
    }
  }
  return claims;
}

/** Lint the turn's read, modelless: derive claims (language-aware), run the Kelsen linter at STRICT (a
 *  directed cycle in a declared-acyclic relation is begging the question, and the standard ladder would
 *  hide it), and the murmur's honest lines — in the language that was read. */
export function lintTurn({ passages = [], relations = null, strictness = "strict", lang = null } = {}) {
  const claims = deriveClaims(passages, { relations });
  const langs = [...new Set(claims.map((c) => c.lang || detectLang(String(passages?.[0]?.text || "")).lang))];
  const opts = { strictness };
  const relUnion = { acyclic: [], functional: [], symmetric: [] };
  for (const l of langs) { const r = RELATIONS_OF(l); relUnion.acyclic.push(...r.acyclic); relUnion.functional.push(...r.functional); relUnion.symmetric.push(...r.symmetric); }
  const result = lintGfp(claims, { ...opts, ...relUnion });
  const findings = Array.isArray(result.findings) ? result.findings : [];
  return {
    lang: lang || (langs[0] || "en"),
    claims,
    ok: !!result.ok,
    counts: result.counts || {},
    unjudged: result.unjudged || 0,
    apart: result.apart || 0,
    findings,
    lines: murmurLinesGov({ claims, findings }, lang || langs[0] || "en"),
  };
}

/** The murmur lines — rendered in the language of the read (i18n registry): what was recovered, what the
 *  lint found, and the honest "nothing to lint" gap, all in-language. */
import { murmurSay } from "./fold-chat-murmur-i18n.js";
function murmurLinesGov({ claims = [], findings = [] }, lang = "en") {
  const L = lang || "en";
  const lines = [];
  if (!claims.length) return [{ op: "reason", text: murmurSay("reason.none", {}, L).text, lang: L }];
  lines.push({ op: "reason", text: murmurSay("reason.claims", { count: claims.length }, L).text, lang: L });
  for (const f of findings) {
    const dying = String(f.note || f.detail || f.kind || "").split("—")[0].trim();
    if (f.kind === "circular") {
      // the cycle itself is language-neutral — a chain of ARG0→ARG1 keys
      const ring = dying || "…";
      lines.push({ op: "reason", text: murmurSay("reason.circular", { note: ring }, L).text, lang: L });
    } else if (String(f.kind || "").includes("not_a_claim")) {
      lines.push({ op: "reason", text: murmurSay("reason.door", {}, L).text, lang: L });
    } else {
      lines.push({ op: "reason", text: murmurSay("reason.finding", { note: ringNote(f) }, L).text, lang: L });
    }
  }
  if (!findings.length) lines.push({ op: "reason", text: murmurSay("reason.clear", {}, L).text, lang: L });
  return lines;
}
const ringNote = (f) => String(f.note || f.detail || f.kind || "").replace(/\s+/g, " ").trim();

export default { deriveClaims, lintTurn, murmurLines: murmurLinesGov, RELATION_VERBS };