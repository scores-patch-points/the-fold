// fold-chat-lang-facts.js — facts the PERSON states about themselves, read in their language. Pure; node-testable.
//
// The fold serves many languages; a memory that only hears English is not a memory — it is a
// filter that silently drops everything a Spanish, Arabic, Mandarin or Hindi speaker says about
// themselves (falsified 2026-10-11: 2 of 30 self-statements read across 15 languages). So the
// intro phrases, the place phrases and the "remember …" instructions are DECLARED per language
// here (II.11), matched as a union — the forms are distinctive enough that reading them all is
// safe, and it needs no language detector to run first.
//
// What it reads, and what it refuses:
//   NAME      an explicit introduction ("me llamo", "меня зовут", "我叫", "私の名前は", …). The
//             English copula ("I'm …") is trusted only when the word is not a predicate/state, so
//             "I'm tired" and "vivo en Madrid" never become a person's name.
//   PLACE     where the person lives/works/studies ("vivo en Madrid", "东京に住んでいます", …).
//   REMEMBER  an explicit instruction to keep something ("recuerda que …", "记住 …").
// A capture is stored VERBATIM (the person's own words), never paraphrased, never invented.

import { FUNCTION_WORDS } from "./fold-chat-function-words.js";

export const MAX_TEXT = 240;

const clean = (text) => { const t = String(text ?? "").replace(/\s+/g, " ").trim(); return t.length > MAX_TEXT ? t.slice(0, MAX_TEXT - 1).trimEnd() + "…" : t; };

// Every known function word, across the fold's languages (the union), so a
// recurring "the"/"de"/"من" is never mistaken for a name by recurrence below.
const ALL_FW = new Set();
for (const arr of Object.values(FUNCTION_WORDS || {})) for (const w of arr || []) ALL_FW.add(String(w).toLowerCase());

// A word that FOLLOWS "I'm / I am" but is NOT a name: a preposition, a state, a role, a gerund.
const NOT_A_NAME = new Set("from in at on to of for with about into near by over under out up down off back here there not no so too very just still always never really quite rather good fine ok okay sorry tired busy ready sure happy sad angry hungry thirsty lost done new old young working looking trying going planning learning thinking hoping asking wondering curious confused afraid glad interested excited worried aware able unable based located living staying coming leaving heading around through across against between among during before after above below the a an and or but if then".split(" "));
const STOP = /^(a|an|the|not|no|just|here|fine|good|ok|okay|sorry|asking|wondering|curious|confused)$/i;
// Intro artifacts that are not names (a bare "is"/particle left where a name should be).
const NOT_NAME_MULTI = new Set(["है", "हूँ", "हूं", "हैं", "です", "だ", "입니까", "입니다", "이에요", "예요", "是", "叫", "اسمي", "שמי", "名前", "이름"]);

// Each intro regex ends where the NAME begins (the name is read from the rest).
// `\b` is ASCII in JS, so it never fires before Cyrillic/Greek/etc. A Unicode-aware
// left edge is used instead: not preceded by a letter or combining mark.
const NB = "(?<![\\p{L}\\p{M}])";
export const NAME_INTROS = Object.freeze([
  new RegExp(NB + "(?:my name(?:'s| is)|call me|i go by|you can call me)\\s+", "iu"),   // English
  new RegExp(NB + "(?:me llamo|mi nombre es)\\s+", "iu"),                               // Spanish
  new RegExp(NB + "(?:je m'appelle|mon nom est|je me nomme)\\s+", "iu"),                // French
  new RegExp(NB + "(?:ich heiße|ich heisse|mein name ist)\\s+", "iu"),                  // German
  new RegExp(NB + "(?:meu nome é|me chamo|chamo-me)\\s+", "iu"),                        // Portuguese
  new RegExp(NB + "(?:mi chiamo|il mio nome è|il mio nome e)\\s+", "iu"),               // Italian
  new RegExp(NB + "(?:ik heet|mijn naam is)\\s+", "iu"),                                // Dutch
  new RegExp(NB + "(?:меня зовут|моё имя|мое имя|меня звать)\\s+", "iu"),               // Russian
  /(?:اسمي|إسمي|انا اسمي)\s*:?\s*/u,                                                    // Arabic
  /(?:שמי|השם שלי)\s+/u,                                                                // Hebrew
  new RegExp(NB + "(?:με λένε|με λενε|το όνομά μου είναι|το ονομα μου ειναι)\\s+", "iu"),   // Greek
  /(?:我叫|我的名字(?:是|叫)?|我的名是)\s*/u,                                            // Chinese
  /(?:私の名前は|名前は|私は)(?=[\p{L}\p{M}])/u,                                        // Japanese (only unambiguous intros)
  /(?:제 이름은|내 이름은|제 이름|내 이름)\s*/u,                                        // Korean
  /(?:मेरा नाम|मेरा नाम है)\s*/u,                                                       // Hindi
]);

// Place clauses, matched WHOLE (the clause is stored verbatim).
export const PLACE = Object.freeze([
  new RegExp(NB + "(?:i (?:live|am based|am located|work|study)\\s+(?:in|at|near)|i'?m (?:based )?(?:in|from)|my (?:home|office|city) is)\\s+[^.,;!?\\n]{2,60}", "iu"),
  new RegExp(NB + "(?:vivo|resido|trabajo|estudio|estoy basado)\\s+en\\s+[^.,;!?\\n]{2,60}", "iu"),          // Spanish
  new RegExp(NB + "(?:j'habite|je vis|je travaille|j'étudie)\\s+(?:à|a|en|au)\\s+[^.,;!?\\n]{2,60}", "iu"),  // French
  new RegExp(NB + "(?:ich wohne|ich lebe|ich arbeite|ich studiere)\\s+(?:in|in der|im)\\s+[^.,;!?\\n]{2,60}", "iu"),   // German
  new RegExp(NB + "(?:moro|vivo|trabalho|estudo)\\s+(?:em|no|na)\\s+[^.,;!?\\n]{2,60}", "iu"),               // Portuguese
  new RegExp(NB + "(?:vivo|abito|risiedo|lavoro|studio)\\s+(?:a|in|nel|nella)\\s+[^.,;!?\\n]{2,60}", "iu"),  // Italian
  new RegExp(NB + "(?:ik woon|ik leef|ik werk|ik studeer|ik zit)\\s+in\\s+[^.,;!?\\n]{2,60}", "iu"),         // Dutch
  new RegExp(NB + "(?:я живу|я работаю|я учусь)\\s+в\\s+[^.,;!?\\n]{2,60}", "iu"),                           // Russian
  /(?:أعيش|اسكن|أعمل|أدرس)\s+في\s+[^.,;!?\n]{2,60}/u,                                                        // Arabic
  /(?:אני גר|אני גרה|אני עובד|אני עובדת|אני לומד|אני לומדת)\s+ב[^.,;!?\n]{2,60}/u,                            // Hebrew
  new RegExp(NB + "(?:μένω|ζω|εργάζομαι|σπουδάζω)\\s+(?:στην|στη|στον|στο|σε)\\s+[^.,;!?\\n]{2,60}", "iu"),   // Greek
  /(?:我住在|我住|我(?:现在)?在)[^。，,.\n]{2,40}/u,                                                          // Chinese
  /[^、。\n]{2,20}(?:に住んでいます|に住んでいる|に住んでる|に住む|在住)/u,                                   // Japanese
  /[^.\n]{2,20}에\s*살(?:아요|고 있어요|고 있다|아|지요)/u,                                                   // Korean
  /मैं\s+[^।\n]{2,30}\s+में\s+(?:रहता|रहती|काम करता|काम करती|पढ़ता|पढ़ती)\s+हूँ/u,                            // Hindi
]);

// Explicit "keep this" instructions; group 1 is what to keep.
export const REMEMBER = Object.freeze([
  new RegExp(NB + "(?:please\\s+)?(?:remember|note|keep in mind|don'?t forget)\\s+(?:that\\s+)?(.{2,200})", "iu"),   // English
  new RegExp(NB + "recuerda(?: que)?\\s+(.{2,200})", "iu"),                                                          // Spanish
  new RegExp(NB + "(?:retiens|souviens-toi)(?: que)?\\s+(.{2,200})", "iu"),                                          // French
  new RegExp(NB + "(?:merk(?:e)? dir|denk daran)(?:,)?\\s+(?:dass\\s+)?(.{2,200})", "iu"),                           // German
  new RegExp(NB + "(?:lembra(?:-te)?|lembre-se)(?: que)?\\s+(.{2,200})", "iu"),                                      // Portuguese
  new RegExp(NB + "(?:ricorda|ricordati)(?: che)?\\s+(.{2,200})", "iu"),                                             // Italian
  new RegExp(NB + "(?:onthoud|denk eraan)(?: dat)?\\s+(.{2,200})", "iu"),                                            // Dutch
  new RegExp(NB + "запомни(?:,)?\\s+(?:что\\s+)?(.{2,200})", "iu"),                                                  // Russian
  /(?:تذكر|تذكّر)\s*(?:أن|ان)?\s*(.{2,200})/u,                                                                        // Arabic
  /זכור\s*(?:ש)?(.{2,200})/u,                                                                                         // Hebrew
  new RegExp(NB + "θυμήσου\\s+(?:ότι\\s+)?(.{2,200})", "iu"),                                                        // Greek
  /(?:记住|請記住|请记住|牢記|牢记|記住)\s*[:：]?\s*(.{2,200})/u,                                                       // Chinese
  /(?:覚えておいて|忘れないで)\s*[:：]?\s*(.{2,200})/u,                                                                // Japanese
  /(?:기억해|잊지 마)\s*[:：]?\s*(.{2,200})/u,                                                                        // Korean
  /(?:याद रख(?:ें|ना)|याद रखें)\s*(?:कि\s+)?(.{2,200})/u,                                                            // Hindi
]);

const NAME_TOKEN = /[\p{L}\p{M}][\p{L}\p{M}'’.·\u2010-\u2015-]*/gu;
const PARTICLE = /(?:です|だ|といいます|と言います|という|입니다|이에요|예요|이에|이야|야|是|啦|啊|哦|呢|है|हूँ|हूं|हैं)$/u;
const isStop = (t) => STOP.test(t) || NOT_A_NAME.has(t.toLowerCase()) || NOT_NAME_MULTI.has(t);

/** Read a name from the text after an intro. `multi` (explicit introductions only) reads a
 *  multi-word name — "María José", "عبد الله", "राहुल कुमार" — a run of name tokens bounded by a
 *  function word/punctuation, each continuing token mirroring the first token's casing in a cased
 *  script (so "María José" extends but "María y José" stops at "y"; a caseless script extends by
 *  default). The copula form stays single-token: "I'm <word>" is too ambiguous to extend. */
function captureName(rest, { multi = false } = {}) {
  const s = String(rest ?? "").replace(/^[\s:：,、]+/, "");
  const toks = [];
  let end = 0, m;
  const head = s.slice(0, 80);
  NAME_TOKEN.lastIndex = 0;
  while ((m = NAME_TOKEN.exec(head)) !== null) {
    if (toks.length && !/^\s+$/.test(s.slice(end, m.index))) break;   // tokens must be whitespace-separated
    toks.push(m[0]); end = m.index + m[0].length;
    if (!multi || toks.length >= 4) break;
  }
  if (!toks.length) return null;
  if (isStop(toks[0])) return null;                  // "my name is not important" is not a name
  let name = toks[0];
  const wantUpper = /^\p{Lu}/u.test(toks[0]);
  for (let i = 1; i < toks.length; i++) {
    const t = toks[i];
    if (isStop(t)) break;
    const cased = /\p{Lu}|\p{Ll}/u.test(t);
    if (cased && /^\p{Lu}/u.test(t) !== wantUpper) break;   // a cased token of the other case ends it
    name += " " + t;
  }
  name = name.replace(PARTICLE, "").trim();          // a glued particle on the last token ("민수입니다")
  if (!name || isStop(name)) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Learn a name the person states about themselves, in any of the fold's languages. */
export function extractStatedName(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  for (const re of NAME_INTROS) {                    // explicit introductions may carry a multi-word name
    const m = t.match(re);
    if (m && typeof m.index === "number") {
      const name = captureName(t.slice(m.index + m[0].length), { multi: true });
      if (name) return name;
    }
  }
  // the English copula, single-token and gated, so a self-description is never a name
  const cop = t.match(/\bi(?:'m| am)\s+([\p{L}\p{M}][\p{L}\p{M}'’-]*)/iu);
  if (cop && !NOT_A_NAME.has(cop[1].toLowerCase()) && !STOP.test(cop[1])) return cop[1].charAt(0).toUpperCase() + cop[1].slice(1);
  return null;
}

/** Every fact the person states about themselves, in their own words: name, place, an explicit
 *  "remember", and (English) a preference. Deduped, each bounded. */
export function statedStatements(text) {
  const t = String(text ?? "").trim();
  if (!t) return [];
  const out = [];
  const add = (s) => { const c = clean(s).replace(/[.!?。！？]+$/u, "").trim(); if (c) out.push(c); };
  for (const re of REMEMBER) { const m = t.match(re); if (m && m[1]) add(m[1]); }
  const nm = extractStatedName(t);
  if (nm) add(`my name is ${nm}`);
  for (const re of PLACE) { const m = t.match(re); if (m && m[0]) { add(String(m[0]).split(/\s+and\s+/i)[0]); break; } }
  const pref = t.match(/\bi (?:prefer|like|love|enjoy|hate|avoid|use|drive|read|speak|drink|eat|have|own|want|need)\b[^.!?\n]{1,140}/i);
  if (pref) add(pref[0]);
  return [...new Set(out)];
}

/**
 * CHAMPOLLION: a name read from RECURRENCE, with no phrase table and no English prior —
 * the decipherment cue that works in ANY script (a host with one bad day... no: a referent
 * the person keeps naming is a referent). Returns [{ name, count }] for tokens the person
 * repeats across their OWN messages at least `min` times, function words removed.
 *
 * It is a SUGGESTION, never a fact: the caller offers it (e.g. pre-filling the interview's
 * "what should I call you?") and the PERSON confirms or edits it. A name is never auto-stored
 * from recurrence alone — II.9: the store may not originate an identity.
 * DECLARED LIMIT (Chomsky): this reads frequency, not syntax; a common non-name noun the
 * person repeats ("project") will also be suggested — hence the confirm, never the commit.
 */
export function attestedNames(messages, { min = 3, max = 5 } = {}) {
  const counts = new Map();
  for (const m of messages || []) {
    const text = typeof m === "string" ? m : (m?.role === "assistant" ? "" : String(m?.text ?? m?.content ?? ""));
    if (!text) continue;
    for (const tok of text.match(/[\p{L}\p{M}][\p{L}\p{M}'-]*/gu) || []) {
      if (tok.length < 2) continue;
      const k = tok.toLowerCase();
      if (ALL_FW.has(k)) continue;
      const e = counts.get(k) || { name: tok, count: 0 };
      e.count++; e.name = tok;
      counts.set(k, e);
    }
  }
  return [...counts.values()].filter((e) => e.count >= min).sort((a, b) => b.count - a.count).slice(0, max);
}
