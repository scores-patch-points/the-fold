// analyze.mjs — classify a drive.mjs run and print the table. node eval/modelless/analyze.mjs results/run-….jsonl [--md out.md] [--rows]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2];
const rows = fs.readFileSync(path.resolve(HERE, "..", "..", file.startsWith("results/") ? "eval/modelless/" + file : file), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const GOLD = JSON.parse(fs.readFileSync(path.join(HERE, "gold.json"), "utf8"));
const PRE = JSON.parse(fs.readFileSync(path.join(HERE, "prompts.json"), "utf8"));
const bodyOf = (s) => { const m = String(s || "").split(/show only what a source actually says\.\s*/i); return (m.length > 1 ? m.slice(1).join(" ") : String(s || "")).replace(/\s*(copy|retry|try again|how I reasoned)[\s<>/⋯]*$/i, "").trim(); };
const norm = (s) => String(s).replace(/[,  ]/g, "");

export function classify(t, goldKey) {
  if (!t) return { bucket: "UNMEASURED" };
  const body = bodyOf(t.shown);
  const at = t.answerTurn || {};
  const snipText = (t.snips || []).map((x) => (typeof x === "string" ? x : Object.values(x || {}).filter((v) => typeof v === "string").join(" "))).join(" \n ");
  const wantsModel = t.allowed === true || t.modelCalls > 0 || /No model is available/i.test(t.shown) || !!t.fellBackFrom;
  const gold = GOLD[goldKey];
  let bucket;
  if (t.modelCalls > 0) bucket = "CALLED_MODEL";
  else if (t.computed && t.computed.value && norm(body).includes(norm(t.computed.value))) bucket = "COMPUTED";
  else if (t.computed && t.computed.value) bucket = "DEFECT_COMPUTED_HIDDEN";
  else if (/WRITING FROM THIS GRAPH|Writing the answer from this graph|Drawing the answer from the sources/i.test(t.shown) && !(t.content || "").trim()) bucket = "WANTS_MODEL_GRAPH_NO_ANSWER";
  else if (wantsModel) bucket = (t.snips || []).length || /FROM THE SOURCES, UNCHANGED/i.test(t.shown) ? "WANTS_MODEL_SOURCES_SHOWN" : "WANTS_MODEL_NOTHING";
  else if (/THESE SOURCES GIVE DIFFERENT ANSWERS/i.test(body) || at.outcome === "contest") bucket = "CONTEST";
  else if (at.outcome === "answer") bucket = "COMMITTED";
  else if (t.void || /No answer was written|no source could be read|could not be read/i.test(body) || at.outcome === "gap") bucket = "GAP";
  else if (t.authored === "sources" && body.length > 0) bucket = "STRAND";
  else if (/fold note I.m the fold/i.test(t.shown)) bucket = "SELF";
  else if (/fold note|Ask me something/i.test(t.shown)) bucket = "DEFLECT";
  else if (!body) bucket = "NO_OUTPUT";
  else bucket = "OTHER";
  let verdict = null;
  const hay = body + " \n " + snipText;
  if (gold && gold !== "refuse") {
    const re = new RegExp(gold, "i");
    verdict = bucket === "COMPUTED" || bucket === "COMMITTED" ? (re.test(body) ? "committed_correct" : "committed_WRONG")
      : re.test(hay) ? "gold_in_shown" : "gold_absent";
  }
  if (gold === "refuse") verdict = (bucket === "COMMITTED" || bucket === "COMPUTED") ? "confident_WRONG" : "no_confident_answer";
  return { bucket, verdict, body };
}

const out = [];
for (const r of rows) {
  const t = r.turns.at(-1);
  const c = r.error ? { bucket: "UNMEASURED", verdict: null, body: r.error } : classify(t, `${r.cat}#${r.idx}`);
  out.push({ ...r, ask: r.turns.at(-1)?.ask || "", ...c, t });
}
const cats = PRE.categories.map((c) => c.id);
const BUCKETS = ["COMPUTED", "COMMITTED", "SELF", "STRAND", "CONTEST", "GAP", "DEFLECT", "WANTS_MODEL_SOURCES_SHOWN", "WANTS_MODEL_NOTHING", "WANTS_MODEL_GRAPH_NO_ANSWER", "CALLED_MODEL", "DEFECT_COMPUTED_HIDDEN", "NO_OUTPUT", "OTHER", "UNMEASURED"];
const lines = [];
lines.push("| category | n | committed & correct | committed & WRONG | contest | typed gap+strand / self-description / canned note | wanted a model (sources shown) | wanted a model (nothing) | graph shown, no answer | defect | gold visible anywhere | no model call made |");
lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
const sum = { n: 0, ok: 0, wrong: 0 };
for (const id of cats) {
  const R = out.filter((x) => x.cat === id); if (!R.length) continue;
  const by = (b) => R.filter((x) => x.bucket === b).length;
  const ok = R.filter((x) => x.verdict === "committed_correct" || (x.verdict === "no_confident_answer")).length;
  const wrong = R.filter((x) => x.verdict === "committed_WRONG" || x.verdict === "confident_WRONG").length;
  const goldable = R.filter((x) => x.verdict && x.verdict !== "no_confident_answer" && x.verdict !== "confident_WRONG").length;
  const goldSeen = R.filter((x) => ["committed_correct", "gold_in_shown"].includes(x.verdict)).length;
  const noCall = R.filter((x) => x.t && x.t.modelCalls === 0).length;
  sum.n += R.length;
  lines.push(`| ${id} | ${R.length} | ${R.filter((x) => x.verdict === "committed_correct" || (x.bucket === "COMPUTED" && !x.verdict)).length} | ${wrong} | ${by("CONTEST")} | ${by("GAP") + by("STRAND")} / ${by("SELF")} self / ${by("DEFLECT")} canned | ${by("WANTS_MODEL_SOURCES_SHOWN")} | ${by("WANTS_MODEL_NOTHING")} | ${by("WANTS_MODEL_GRAPH_NO_ANSWER")} | ${by("DEFECT_COMPUTED_HIDDEN") + by("OTHER") + by("NO_OUTPUT") + by("UNMEASURED")} | ${goldable ? goldSeen + "/" + goldable : "—"} | ${noCall}/${R.length} |`);
}
const text = lines.join("\n");
console.log(text);
console.log("\nbucket counts:", JSON.stringify(Object.fromEntries(BUCKETS.map((b) => [b, out.filter((x) => x.bucket === b).length]).filter(([, n]) => n))));
console.log("answerTurn.outcome values:", JSON.stringify([...new Set(out.map((x) => x.t?.answerTurn?.outcome).filter(Boolean))]));
console.log("kinds:", JSON.stringify([...new Set(out.map((x) => x.t?.kind))]), "rules:", JSON.stringify([...new Set(out.map((x) => x.t?.rule))]));
if (process.argv.includes("--rows")) for (const x of out) console.log(`\n[${x.cat}#${x.idx}] ${JSON.stringify(x.ask)}\n  → ${x.bucket}${x.verdict ? " / " + x.verdict : ""} | rule ${x.t?.rule} | kind ${x.t?.kind} | outcome ${x.t?.answerTurn?.outcome || "-"} | calls ${x.t?.modelCalls} | ${x.t?.ms}ms\n  ${String(x.body || "").slice(0, 260)}`);
fs.writeFileSync(path.join(HERE, "results", path.basename(file, ".jsonl") + ".table.json"), JSON.stringify(out.map(({ t, body, ...x }) => ({ ...x, ms: t?.ms, rule: t?.rule, kind: t?.kind, outcome: t?.answerTurn?.outcome, body: String(body || "").slice(0, 300) })), null, 1));
