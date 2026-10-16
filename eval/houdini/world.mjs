// eval/houdini/world.mjs — a seeded synthetic world whose GOLD is known by construction.
//
// Honest scope (docs/HOUDINI.md): the conversations are invented (names from syllable pools, never real entities), the frames are a handful of repeated user phrasings per
// language, and the gold — which records an ask needs — is fixed when the probe is BUILT, from the topic the ask names. So this battery measures whether a projection puts the
// right records in front of the model at the right moment, on material where "right" is not a matter of opinion. It does NOT measure whether the model then answers well, and its
// paraphrase class (`semantic`) is deliberately beyond a lexical reader: that class is the named gap between Houdini and 100%.
//
//   makeConversation({ seed, L, lang, K }) → { lang, history, summary, referents, topics, chit, store }
//   makeProbes(conv, seed)                 → [{ cls, lang, question, need, relevant, decoys, pinnedNeed, rawTail, ... }]
import { admitReferents, emptyReferents } from "../../fold-chat-mind.js";
import { hintsFor } from "../../fold-chat-hints.js";
export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];

// Fixture data (a test's own, typed by hand: it is the WORLD under test, not an engine list). Each pack: how names are built, the nouns (shared across topics on purpose: the decoys),
// and the frames the invented user and the invented answerer use. `unseen` is a noun no topic uses (the fresh class); `para` maps a noun to a description that shares no word with it.
export const PACKS = {
  en: { onsets: ["Quil", "Mar", "Tes", "Bran", "Hal", "Vor", "Pen", "Ors", "Kes", "Dor", "Fen", "Lun", "Gar", "Wen"], codas: ["lon", "low", "sal", "nock", "den", "wick", "dria", "mere", "ford", "thorn"],
    nouns: ["Bridge", "Foundry", "Archive", "Mill", "Ferry", "Cannery", "Observatory", "Aqueduct"], unseen: ["Windmill", "Lighthouse", "Granary"],
    join: " ", ask: ["How is {X} described in the material?", "What does the material say about {X}?", "Tell me about {X}."], ans: ["{X} {fact}.", "According to the material, {X} {fact}."],
    callback: ["Remind me what we established about {X}.", "Going back to {X}: what did we settle on?"], thin: ["And what about its history?", "Why is that?", "Can you say more about that?"],
    fresh: ["Tell me about {X}.", "What does the material say about {X}?"], compare: ["Compare {X} and {Y}.", "How do {X} and {Y} differ?"], wide: ["Summarise what we know about {X}, {Y}, {Z} and {W}."],
    facts: ["spans {n} m", "opened in {n}", "employs {n} people", "stands {n} m tall"], unsup: "was designed by an unnamed architect", open: "has a disputed completion date",
    chit: ["Remember this code word: {T}.", "Noted: the code word is {T}."], verb: ["What did I tell you about {T}?"],
    para: { Bridge: "the structure that carries a road over water", Foundry: "the works where metal is poured into moulds", Archive: "the building that keeps old papers", Mill: "the building where grain is ground", Ferry: "the boat that crosses the river", Cannery: "the plant that seals food in tins", Observatory: "the dome where the stars are watched", Aqueduct: "the channel that carries water over a valley" },
    paraFrame: "Remind me what we established about {P}." },
  el: { onsets: ["κα", "λι", "μο", "νε", "στρα", "θε", "φι", "ρο"], codas: ["δαν", "πος", "λιο", "νιο", "ρας", "μην"], nouns: ["γέφυρα", "εργοστάσιο", "αρχείο", "μύλος"], unseen: ["φάρος", "αρτοποιείο"], join: " ",
    ask: ["Πώς περιγράφεται το {X} στο υλικό;", "Τι λέει το υλικό για το {X};"], ans: ["Το {X} {fact}."], callback: ["Θυμίσε μου τι συμφωνήσαμε για το {X}."], thin: ["Και η ιστορία του;", "Γιατί αυτό;"], fresh: ["Τι λέει το υλικό για το {X};"], compare: ["Σύγκρινε το {X} και το {Y}."], wide: ["Συνόψισε όσα ξέρουμε για {X}, {Y}, {Z} και {W}."],
    facts: ["έχει μήκος {n} μ", "άνοιξε το {n}", "απασχολεί {n} άτομα"], unsup: "σχεδιάστηκε από άγνωστο αρχιτέκτονα", open: "έχει αμφισβητούμενη ημερομηνία", chit: ["Θυμήσου αυτή τη λέξη κωδικό: {T}.", "Σημειώθηκε: η λέξη κωδικός είναι {T}."], verb: ["Τι σου είπα για το {T};"], para: {}, paraFrame: "" },
  ru: { onsets: ["ка", "ли", "мо", "не", "стра", "те", "фи", "ро"], codas: ["дан", "пос", "лио", "нио", "рас", "мен"], nouns: ["мост", "завод", "архив", "мельница"], unseen: ["маяк", "пекарня"], join: " ",
    ask: ["Как описан {X} в материале?", "Что говорится в материале про {X}?"], ans: ["{X} {fact}."], callback: ["Напомни, что мы установили про {X}."], thin: ["А что насчёт его истории?", "Почему так?"], fresh: ["Что говорится в материале про {X}?"], compare: ["Сравни {X} и {Y}."], wide: ["Подведи итог про {X}, {Y}, {Z} и {W}."],
    facts: ["имеет длину {n} м", "открыт в {n} году", "нанимает {n} человек"], unsup: "спроектирован неизвестным архитектором", open: "имеет спорную дату завершения", chit: ["Запомни это кодовое слово: {T}.", "Принято: кодовое слово {T}."], verb: ["Что я тебе говорил про {T}?"], para: {}, paraFrame: "" },
  zh: { onsets: ["青", "岭", "望", "湾", "铁", "渡", "磨", "象"], codas: ["山", "海", "河", "云", "石", "林"], nouns: ["桥", "工厂", "档案馆", "磨坊"], unseen: ["灯塔", "粮仓"], join: "",
    ask: ["材料里是怎么描述{X}的？", "材料中关于{X}说了什么？"], ans: ["{X}{fact}。"], callback: ["提醒我们之前确定了关于{X}的什么。"], thin: ["那它的历史呢？", "为什么会这样？"], fresh: ["材料中关于{X}说了什么？"], compare: ["比较{X}和{Y}。"], wide: ["总结我们对{X}、{Y}、{Z}和{W}的了解。"],
    facts: ["长{n}米", "建于{n}年", "雇用{n}人"], unsup: "由一位不知名的建筑师设计", open: "完工日期有争议", chit: ["记住这个暗号：{T}。", "已记下：暗号是{T}。"], verb: ["我跟你说过关于{T}的什么？"], para: {}, paraFrame: "" },
  ar: { onsets: ["كا", "لي", "مو", "ني", "ستر", "تي", "فا", "رو"], codas: ["دان", "بوس", "ليو", "نيو", "راس", "مين"], nouns: ["جسر", "مصنع", "أرشيف", "طاحونة"], unseen: ["منارة", "مخبز"], join: " ",
    ask: ["كيف وُصف {X} في المادة؟", "ماذا تقول المادة عن {X}؟"], ans: ["{X} {fact}."], callback: ["ذكّرني بما اتفقنا عليه بشأن {X}."], thin: ["وماذا عن تاريخه؟", "لماذا هذا؟"], fresh: ["ماذا تقول المادة عن {X}؟"], compare: ["قارن بين {X} و{Y}."], wide: ["لخّص ما نعرفه عن {X} و{Y} و{Z} و{W}."],
    facts: ["طوله {n} متر", "افتُتح عام {n}", "يعمل فيه {n} شخصا"], unsup: "صممه مهندس مجهول", open: "تاريخ إنجازه محل خلاف", chit: ["تذكّر كلمة السر هذه: {T}.", "تم: كلمة السر هي {T}."], verb: ["ماذا قلت لك عن {T}؟"], para: {}, paraFrame: "" },
};
export const LANGS = Object.keys(PACKS);
const fill = (s, m) => s.replace(/\{(\w+)\}/g, (_, k) => String(m[k]));

function makeTopics(r, pack, K) {
  const seen = new Set(), topics = [];
  while (topics.length < K) {
    const head = pick(r, pack.onsets) + pick(r, pack.codas), noun = pick(r, pack.nouns), name = head + pack.join + noun;
    if (seen.has(head)) continue; seen.add(head);
    topics.push({ id: topics.length, head, noun, name, slug: "t" + topics.length });
  }
  return topics;
}

/** One conversation of L turns. A turn is a topic turn (user asks, answerer answers, a checked record is written) or, rarely, a chit turn (a unique code word; NOTHING is recorded). */
export function makeConversation({ seed, L, lang = "en", K = 10 }) {
  const r = rng(seed * 1009 + L * 31 + lang.charCodeAt(0)), pack = PACKS[lang], topics = makeTopics(r, pack, K);
  const history = [], store = [], chit = [], order = [];
  let recent = [], referents = emptyReferents();
  const hints = hintsFor(lang);
  for (let t = 1; t <= L; t++) {
    if (t > 6 && r() < 0.1) {   // chit turn: a unique token, no record
      const T = "zq" + (1000 + t) + "x" + Math.floor(r() * 90 + 10);
      history.push({ role: "user", content: fill(pack.chit[0], { T }) }, { role: "assistant", content: fill(pack.chit[1], { T }) });
      referents = admitReferents(referents, { question: fill(pack.chit[0], { T }), answer: fill(pack.chit[1], { T }), sources: [] }, { hints });
      chit.push({ turn: t, T }); order.push({ turn: t, chit: true }); continue;
    }
    const top = recent.length && r() < 0.4 ? topics[pick(r, recent)] : pick(r, topics);
    recent = [top.id, ...recent.filter((x) => x !== top.id)].slice(0, 3);
    const n = 100 + t, fact = fill(pick(r, pack.facts), { n });
    const gist = fill(pick(r, pack.ans), { X: top.name, fact }).replace(/^According to the material, /, "");
    const askText = fill(pick(r, pack.ask), { X: top.name });
    history.push({ role: "user", content: askText }, { role: "assistant", content: gist });
    referents = admitReferents(referents, { question: askText, answer: gist, sources: [{ title: top.name }] }, { hints });   // a grounded turn: the source's title is the referent's name
    const rec = { turn: t, plane: "world", gist, channels: ["search"], refs: [`https://example.test/${top.slug}#${t}-${t + 9}`], unsupported: [], open: [] };
    if (r() < 0.22) rec.unsupported = [`${top.name} ${pack.unsup}`];
    else if (r() < 0.12) rec.open = [`${top.name} ${pack.open}`];
    rec.topic = top.id;   // eval-only bookkeeping: stripped before an arm sees the store
    store.push(rec); order.push({ turn: t, topic: top.id });
  }
  const names = [...new Set(store.slice().reverse().map((x) => topics[x.topic].name))].slice(0, 8);
  const last = store[store.length - 1];
  const summary = { topic: "sites in the material", flow: "compared several sites", entities: names, context: last ? last.gist : null, language: lang, turnCount: L, folds: store.map((x) => x.gist.slice(0, 100)), records: store.map(({ topic, ...x }) => x) };
  return { seed, L, lang, pack, topics, history, store, chit, order, summary, referents };
}

const latest = (xs, k) => xs.slice(-k);
const recsOf = (conv, id) => conv.store.filter((x) => x.topic === id);
const isPin = (x) => x.unsupported.length > 0 || x.open.length > 0;
// The need, in PRIORITY order (pinned records most-recent first, then the latest three): the oracle and the scorer both take the longest prefix that fits the positional budget,
// so gold is never infeasible — a need list longer than the window cannot all ride, and no arm is blamed for what the window forbids.
const needParts = (conv, id) => { const rs = recsOf(conv, id); return { pins: rs.filter(isPin).reverse().map((x) => x.turn), latest: latest(rs, 3).reverse().map((x) => x.turn) }; };
const needOf = (conv, id) => { const { pins, latest: l } = needParts(conv, id); return [...new Set([...pins, ...l])]; };
// across topics the spec is the same: every pinned record of every named topic outranks every unpinned one (round-robin within each tier)
const needAcross = (conv, ids) => { const ps = ids.map((id) => needParts(conv, id)); return [...new Set([...interleave(ps.map((x) => x.pins)), ...interleave(ps.map((x) => x.latest))])]; };
const interleave = (lists) => { const out = []; for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length && !out.includes(l[i])) out.push(l[i]); return out; };

/** The probes of one conversation. `need` is what MUST be in the projection; `relevant` is what MAY be (anything about the named topics); `decoys` must not be. */
export function makeProbes(conv, seed = 1) {
  const r = rng(seed * 7919 + conv.L), { pack, lang, topics, store, L } = conv, probes = [];
  const lastSeen = (id) => { const rs = recsOf(conv, id); return rs.length ? rs[rs.length - 1].turn : -1; };
  const named = topics.filter((tp) => recsOf(conv, tp.id).length);
  const base = { lang, rawTail: 0, exchanges: [], semantic: false };
  const sharing = (tp) => topics.filter((o) => o.id !== tp.id && o.noun === tp.noun && recsOf(conv, o.id).length).flatMap((o) => recsOf(conv, o.id).map((x) => x.turn));
  const callback = (cls, tp) => probes.push({ ...base, cls, question: fill(pick(r, pack.callback), { X: tp.name }), need: needOf(conv, tp.id), relevant: recsOf(conv, tp.id).map((x) => x.turn), decoys: sharing(tp), pinnedNeed: needOf(conv, tp.id).filter((t) => isPin(store.find((x) => x.turn === t))) });
  // named-extra: a callback that names the topic AND adds a word the thread never said ("…Quilton Bridge Zorvik…"). Guards the class-term rule: a novel word beside a NAMED topic's noun
  // must not make the old topic stop bearing (only a novel word beside a bare class noun does).
  if (named.length) { const tp = named[Math.floor(r() * named.length)]; probes.push({ ...base, cls: "named-extra", question: fill(pick(r, pack.callback), { X: tp.name + (pack.join === " " ? " " : "") + "Zorvik" }), need: needOf(conv, tp.id), relevant: recsOf(conv, tp.id).map((x) => x.turn), decoys: sharing(tp), pinnedNeed: needOf(conv, tp.id).filter((t) => isPin(store.find((x) => x.turn === t))) }); }
  // callbacks by dormancy: how long ago the topic was last the subject
  const byDormancy = [...named].sort((a, b) => lastSeen(a.id) - lastSeen(b.id));
  const far = byDormancy.filter((tp) => L - lastSeen(tp.id) >= 20), near = byDormancy.filter((tp) => L - lastSeen(tp.id) < 6);
  if (near.length) callback("callback-near", near[near.length - 1]);
  if (far.length) { callback("callback-far", far[0]); if (far.length > 1) callback("callback-far", far[far.length - 1]); }
  if (byDormancy.length) callback("callback-mid", byDormancy[Math.floor(byDormancy.length / 2)]);
  // thin ask: leans on the last exchange
  const lastTurn = conv.order[conv.order.length - 1];
  probes.push({ ...base, cls: "thin", question: pick(r, pack.thin), need: [], relevant: lastTurn && !lastTurn.chit ? recsOf(conv, lastTurn.topic).map((x) => x.turn) : [], decoys: [], pinnedNeed: [], rawTail: 1 });
  // fresh: a topic nobody discussed, a noun nobody used
  const used = new Set(topics.map((tp) => tp.noun));
  const nov = { name: pick(r, ["Zanthor", "Quevak", "Ilmora", "Brusk"]) };
  probes.push({ ...base, cls: "fresh", question: fill(pick(r, pack.fresh), { X: lang === "zh" ? nov.name + pick(r, pack.unseen) : nov.name + (pack.join === " " ? " " : "") + pick(r, pack.unseen) }), need: [], relevant: [], decoys: [], pinnedNeed: [] });
  // coincidence: a fresh topic that shares a COMMON noun with discussed ones (the known soft spot of a lexical reader)
  const nounShared = topics.find((tp) => recsOf(conv, tp.id).length && topics.filter((o) => o.noun === tp.noun && recsOf(conv, o.id).length).length >= 2);
  if (nounShared) probes.push({ ...base, cls: "coincidence", question: fill(pick(r, pack.fresh), { X: nov.name + (pack.join === " " ? " " : "") + nounShared.noun }), need: [], relevant: [], decoys: [], pinnedNeed: [] });
  // multi-hop: two topics
  if (named.length >= 2) {
    const [a, b] = [named[Math.floor(r() * named.length)], named[Math.floor(r() * named.length)]];
    if (a.id !== b.id) probes.push({ ...base, cls: "multi-hop", question: fill(pick(r, pack.compare), { X: a.name, Y: b.name }), need: needAcross(conv, [a.id, b.id]), relevant: [...recsOf(conv, a.id), ...recsOf(conv, b.id)].map((x) => x.turn), decoys: [], pinnedNeed: needAcross(conv, [a.id, b.id]).filter((t) => isPin(store.find((y) => y.turn === t))) });
  }
  // budget pressure: four topics at once; the need cannot all fit, so what is checked is honesty and the pinned rule, not recall
  if (named.length >= 4) { const four = [...named].sort(() => r() - 0.5).slice(0, 4); probes.push({ ...base, cls: "pressure", question: fill(pick(r, pack.wide), { X: four[0].name, Y: four[1].name, Z: four[2].name, W: four[3].name }), need: needAcross(conv, four.map((tp) => tp.id)), relevant: four.flatMap((tp) => recsOf(conv, tp.id).map((x) => x.turn)), decoys: [], pinnedNeed: [] }); }
  // verbatim recall of a turn nothing was recorded for, older than the raw window
  const oldChit = conv.chit.filter((c) => L - c.turn >= 6);
  if (oldChit.length) { const c = oldChit[Math.floor(r() * oldChit.length)]; probes.push({ ...base, cls: "verbatim", question: fill(pack.verb[0], { T: c.T }), need: [], relevant: [], decoys: [], pinnedNeed: [], exchanges: [c.turn] }); }
  // semantic: the ask names the topic by a description that shares no word with it (en only; the noun must be unique among discussed topics)
  if (lang === "en") {
    const uniq = named.filter((tp) => named.filter((o) => o.noun === tp.noun).length === 1);
    if (uniq.length) { const tp = uniq[Math.floor(r() * uniq.length)]; probes.push({ ...base, cls: "semantic", semantic: true, question: fill(pack.paraFrame, { P: pack.para[tp.noun] }), need: needOf(conv, tp.id), relevant: recsOf(conv, tp.id).map((x) => x.turn), decoys: [], pinnedNeed: [] }); }
  }
  return probes;
}
