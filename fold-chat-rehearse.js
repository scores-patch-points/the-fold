// fold-chat-rehearse.js — THE REHEARSAL WITNESS: the agent tests its own prediction.
//
// readAsk already makes the model say what a thing that satisfies the ask would DO (its SATISFY line). Until now that sentence was
// only fed back into the outline; nothing ever did what it says. This organ turns the sentence MECHANICALLY into a rehearsal and
// judges what the page does when it is rehearsed:
//
//   ACTIONS     the page's own controls whose labels the sentence names (stemmed word or exact digit/symbol, the same join
//               missingAtoms makes between the ask and the render), pressed in the order the sentence names them; the page's
//               inputs filled with the sentence's own numbers, in order (a fixed probe when it names none).
//   EXPECTATION the sentence's remaining numbers must appear once it has been acted on; the page must RESPOND to a control the
//               sentence names; nothing may throw; no JavaScript failure rendering (NaN, undefined, Infinity, [object Object]) may
//               newly appear.
//   A GAP       a sentence that names nothing this page offers to do (or no sentence at all) is a NAMED GAP — never a pass. A gap
//               does not by itself un-hold a page; it is said.
//
// The model writes no plan, no JSON: it only spoke the sentence. Extraction and judgment are code. PURE: no clock, no IO, no DOM —
// the in-frame executor is a script string the caller injects (rehearsalScript), and its report comes back as plain data.
import { stemOf } from "./fold-chat-frame.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

/** The value typed into an input when the sentence names no number of its own. Declared, not measured: a number every numeric field
 *  accepts and every text field echoes. */
export const PROBE = "7";
/** JavaScript's own failure renderings — what a broken computation prints. A rehearsal that makes one appear has failed. */
export const JUNK = /\b(NaN|undefined|Infinity)\b|\[object Object\]/;

const FW = functionWordsOf("en");
const TOKEN = /\d+(?:[.,]\d+)*|[\p{L}]+|[+\-−×*÷/=%]/gu;
const isNum = (t) => /^\d/.test(t);
const isSym = (t) => /^[+\-−×*÷/=%]$/.test(t);
const keyOf = (t) => (isNum(t) ? t.replace(/,/g, "") : isSym(t) ? t : stemOf(t.toLowerCase(), "en"));
/** The sentence (or a label) as ordered tokens: { t, k } — the written form and its join key (stem, number or symbol). Pure. */
export function tokensOf(s) {
  return (String(s ?? "").match(TOKEN) || []).map((t) => ({ t, k: keyOf(t) }));
}
/** A label's join keys: its content words (function words dropped), digits and symbols. A label of nothing else is unjoinable. */
function labelKeys(label) {
  return tokensOf(label).filter((x) => isNum(x.t) || isSym(x.t) || (x.t.length > 1 && !FW.has(x.t.toLowerCase()))).map((x) => x.k);
}
// A number written right before a unit of time is a DURATION the page takes, not a value it shows.
const TIME_UNIT = /^(ms|millisecond|second|sec|minute|min|hour|hr)s?$/i;

/**
 * planRehearsal(satisfy, observation) → { gap } | { actions, expect, named, wait }
 *   observation: { controls: [{ i, label }], inputs: [{ i, kind }] } — what the frame reports, in document order.
 *   actions: [{ fill: i, value } | { click: i, label }]; expect: { values: [string], respond: bool }; wait: ms the sentence names.
 * Pure.
 */
export function planRehearsal(satisfy, observation = {}) {
  const s = String(satisfy ?? "").trim();
  if (!s) return { gap: "no SATISFY line was read — the prediction cannot be rehearsed" };
  const controls = (observation.controls || []).map((c) => ({ ...c, keys: labelKeys(c.label) })).filter((c) => c.keys.length);
  const inputs = observation.inputs || [];
  const toks = tokensOf(s);
  // walk the sentence in order: a token a control's label carries is a press (a word-label once, a digit/symbol key each time it is said)
  const presses = [], used = new Set(), nums = [];
  let durationMs = 0;
  toks.forEach((tok, at) => {
    const hit = controls.find((c) => c.keys.includes(tok.k) && ((isNum(tok.t) || isSym(tok.t)) ? c.keys.length === 1 : !used.has(c.i)));
    if (hit) { presses.push({ click: hit.i, label: hit.label, at }); used.add(hit.i); return; }
    if (isNum(tok.t)) {
      const next = toks[at + 1];
      if (next && TIME_UNIT.test(next.t)) { const n = Number(tok.k); const unit = next.t.toLowerCase(); durationMs = Math.max(durationMs, /^ms|^milli/.test(unit) ? n : /^h/.test(unit) ? n * 3600e3 : /^min/.test(unit) ? n * 60e3 : n * 1e3); return; }
      nums.push({ v: tok.k, at });
    }
  });
  // THE ONLY WAY TO ACT: a sentence that names no control, on a page that offers exactly one, can only mean that one.
  const offered = observation.controls || [];
  if (!presses.length && offered.length === 1 && labelKeys(offered[0].label).length) presses.push({ click: offered[0].i, label: offered[0].label, at: toks.length, only: true });
  if (!presses.length && !inputs.length) return { gap: `the sentence names nothing this page offers to do (it has ${observation.controls?.length || 0} control(s), none named; no inputs): “${s.slice(0, 120)}”` };
  // the sentence's own numbers fill the inputs, in order; what is left is what the acted-on page must show
  const fills = inputs.map((inp, j) => ({ fill: inp.i, value: j < nums.length ? nums[j].v : PROBE }));
  const values = nums.slice(inputs.length).map((n) => n.v);
  const quoted = [...s.matchAll(/["“]([^"”]{1,40})["”]/g)].map((m) => m[1]).filter((q) => !controls.some((c) => c.label.toLowerCase() === q.toLowerCase()));
  return {
    actions: [...fills, ...presses.map(({ click, label }) => ({ click, label }))],
    expect: { values: [...values, ...quoted], respond: presses.length > 0 || fills.length > 0 },
    named: presses.map((p) => p.label),
    only: presses.some((p) => p.only),
    wait: durationMs,
  };
}

/**
 * judgeRehearsal(plan, run) → { ok, finding, gap }
 *   run: { err: [string], before: { text, sig }, snaps: [{ text, sig }], missing: [label] } — the executor's report.
 * A failure is a FINDING (it re-opens the turn); "no response" with no named control is a GAP, not a failure. Pure.
 */
export function judgeRehearsal(plan, run) {
  if (!plan || plan.gap) return { ok: null, gap: plan ? plan.gap : "no plan", finding: null };
  if (!run) return { ok: null, gap: "the rehearsal frame never reported", finding: null };
  const did = describe(plan);
  if (run.err && run.err.length) return { ok: false, finding: `rehearsing it (${did}) made the page throw: ${String(run.err[0]).slice(0, 120)}` };
  if (run.missing && run.missing.length) return { ok: false, finding: `rehearsing it (${did}): the control${run.missing.length > 1 ? "s" : ""} ${run.missing.map((m) => `“${m}”`).join(", ")} could not be pressed` };
  // THE CANVAS ALLOWS FORMS (the artifact iframe is allow-scripts allow-forms): a submit the page does not prevent RELOADS it for the
  // person, and whatever it showed is gone. The rehearsal frame stops the reload so it can say so.
  if (run.reloads && run.reloads.length) return { ok: false, finding: `rehearsing it (${did}): pressing ${run.reloads[0] ? `“${run.reloads[0]}”` : "Enter"} submits a form and reloads the page — whatever it showed is lost` };
  const before = run.before || { text: "", sig: "" };
  const snaps = run.snaps || [];
  const junkBefore = JUNK.test(before.text);
  const junk = snaps.find((x) => JUNK.test(x.text) && !junkBefore);
  if (junk) return { ok: false, finding: `rehearsing it (${did}), the page showed “${(JUNK.exec(junk.text) || [""])[0]}” — the computation is broken` };
  const responded = snaps.some((x) => x.text !== before.text || x.sig !== before.sig);
  if (plan.expect.respond && !responded) {
    if (!plan.named.length) return { ok: null, gap: `filling the inputs (${did}) changed nothing, and the sentence names no control to press`, finding: null };
    return { ok: false, finding: `rehearsing it (${did}) changed nothing on the page — the prediction says it would respond` };
  }
  // THE VALUES: the sentence's left-over numbers are the outcomes it names — one of them, or (when it names two or more) a number
  // between them ("a number from 1 to 6"), must be shown once acted on. A quoted word must be shown as written.
  const vals = plan.expect.values || [];
  const numsV = vals.filter((v) => /^\d/.test(v)).map((v) => Number(String(v).replace(/,/g, "")));
  const words = vals.filter((v) => !/^\d/.test(v));
  const lo = Math.min(...numsV), hi = Math.max(...numsV);
  const numOk = !numsV.length || snaps.some((x) => numbersIn(x.text).some((n) => numsV.includes(n) || (numsV.length > 1 && n >= lo && n <= hi && !numbersIn(before.text).includes(n))));
  const missingWords = words.filter((w) => !snaps.some((x) => norm(x.text).includes(norm(w))));
  if (!numOk || missingWords.length) return { ok: false, finding: `rehearsing it (${did}), the page never showed ${[...(numOk ? [] : [numsV.length > 1 ? `any of ${numsV.join(", ")} (or a number between them)` : `“${numsV[0]}”`]), ...missingWords.map((w) => `“${w}”`)].join(" or ")} — the prediction says it would` };
  return { ok: true, finding: null, line: `rehearsed: ${did} → it responded${(plan.expect.values || []).length ? ` and showed ${plan.expect.values.join(", ")}` : ""}` };
}
const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ");
/** The numbers a text shows, as numbers (1,000 = 1000 = 1000.00; "0" is not inside "10"). */
const numbersIn = (text) => (String(text ?? "").match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || []).map((n) => Number(n.replace(/,/g, "")));
function describe(plan) {
  const bits = plan.actions.map((a) => (a.click != null ? `press “${a.label}”` : `type ${a.value}`));
  return bits.length ? bits.join(", ") : "no action";
}

/**
 * regressionFinding(held, now) → string | null — a later page must not lose what an earlier page of the SAME turn held.
 *   held: { atoms: Set<string>, rehearsed: [label] | null } (accumulated); now: { shown: string (labels + text, lowercased),
 *   rehearsal: judgeRehearsal result }. Pure.
 */
export function regressionFinding(held, now) {
  if (!held) return null;
  const lost = [...(held.atoms || [])].filter((a) => !String(now.shown || "").includes(String(a).toLowerCase()));
  if (lost.length) return `this version lost ${lost.map((a) => `“${a}”`).join(", ")}, which an earlier version of the page showed`;
  if (held.rehearsed && now.rehearsal && now.rehearsal.ok !== true) {
    return `an earlier version passed its rehearsal (${held.rehearsed.length ? held.rehearsed.map((l) => `“${l}”`).join(", ") : "it responded"}); this one does not${now.rehearsal.finding ? "" : ` (${now.rehearsal.gap || "no rehearsal"})`}`;
  }
  return null;
}

// ── the in-frame parts (strings injected into the sandboxed srcdoc; the frame has allow-scripts only) ─────────────────────────────
// What the page offers to do, in document order: pressable controls with their labels, and text-like inputs. The same definition is
// used to OBSERVE and to ACT, so a control the plan names is the control the executor presses.
const FIND_JS = `function __vis(el){var r=el.getClientRects();if(!r.length)return false;var s=getComputedStyle(el);return s.visibility!=="hidden"&&s.display!=="none";}
function __lab(el){return String(el.tagName==="INPUT"?(el.value||el.getAttribute("aria-label")||""):(el.getAttribute("aria-label")||el.innerText||el.textContent||"")).replace(/\\s+/g," ").trim();}
function __ctrls(){var out=[];var all=document.querySelectorAll("body *");for(var i=0;i<all.length&&out.length<80;i++){var el=all[i];if(!__vis(el))continue;var t=el.tagName;if(t==="A"){var hr=el.getAttribute("href");if(hr&&!/^\s*(#|javascript:)/i.test(hr))continue;}var cl=/^(BUTTON|A|SUMMARY)$/.test(t)||(t==="INPUT"&&/^(button|submit|reset)$/i.test(el.type))||el.getAttribute("role")==="button"||el.hasAttribute("onclick");if(!cl&&getComputedStyle(el).cursor==="pointer"){var l0=__lab(el);cl=l0.length>0&&l0.length<=24&&!(el.parentElement&&getComputedStyle(el.parentElement).cursor==="pointer"&&__lab(el.parentElement)===l0);}if(!cl)continue;var l=__lab(el);if(!l||l.length>40)continue;out.push(el);}return out;}
function __ins(){var q=document.querySelectorAll('input:not([type]),input[type=text],input[type=number],input[type=search],input[type=tel],input[type=email],input[type=url],textarea');var out=[];for(var i=0;i<q.length;i++)if(__vis(q[i]))out.push(q[i]);return out;}
function __snap(skip){var vals=[];var q=document.querySelectorAll("input,textarea,select,output");for(var i=0;i<q.length;i++){if(skip&&skip.indexOf(q[i])>=0)continue;if(q[i].type==="checkbox"||q[i].type==="radio")continue;vals.push(String(q[i].value||""));}var text=String((document.body&&document.body.innerText)||"")+"\\n"+vals.join("\\n");var sig=[];var all=document.querySelectorAll("html,body,body *");for(var j=0;j<all.length&&j<400;j++){var s=getComputedStyle(all[j]);sig.push(s.backgroundColor+s.color+s.opacity+s.display+s.visibility);}return {text:text,sig:sig.join("|")};}`;

/** The observation's extra fields (controls + inputs), for observePage's injected script to post. */
export const OBSERVE_JS = `${FIND_JS}
function __offer(){try{return {controls:__ctrls().map(function(el,i){return {i:i,label:__lab(el)};}),inputs:__ins().map(function(el,i){return {i:i,kind:el.tagName==="TEXTAREA"?"textarea":(el.type||"text")};})};}catch(x){return {controls:[],inputs:[]};}}`;

/** rehearsalScript(plan, { ms }) — the executor: after load (+ms), snapshot, act step by step (a snapshot after each), wait what the
 *  sentence names, snapshot again, and post { __rehearse, err, before, snaps, missing } to the parent. */
export function rehearsalScript(plan, { ms = 1200, settle = 1200 } = {}) {
  const steps = JSON.stringify((plan && plan.actions) || []);
  const wait = Math.max(settle, Number(plan && plan.wait) || 0);
  return `<script>(function(){var e=[];window.onerror=function(m){e.push(String(m));};window.addEventListener("unhandledrejection",function(ev){e.push(String(ev.reason&&ev.reason.message||ev.reason));});${FIND_JS}
var steps=${steps.replace(/</g, "\\u003c")};
var reloads=[],cur=null;window.addEventListener("submit",function(ev){if(!ev.defaultPrevented){reloads.push(cur);ev.preventDefault();}});
function fire(el,type){try{el.dispatchEvent(new Event(type,{bubbles:true}));}catch(x){}}
function key(el,k){try{el.dispatchEvent(new KeyboardEvent("keydown",{key:k,bubbles:true}));el.dispatchEvent(new KeyboardEvent("keyup",{key:k,bubbles:true}));}catch(x){}}
window.addEventListener("load",function(){setTimeout(function(){var e0=e.length;var ins=__ins(),cs=__ctrls(),filled=[],snaps=[],missing=[];var tofill=[];for(var f=0;f<steps.length;f++)if(steps[f].fill!=null&&ins[steps[f].fill])tofill.push(ins[steps[f].fill]);var before=__snap(tofill);var k=0;
function next(){if(k>=steps.length){setTimeout(function(){snaps.push(__snap(tofill));try{parent.postMessage({__rehearse:1,err:e.slice(e0),before:before,snaps:snaps,missing:missing,reloads:reloads},"*");}catch(x){}},${wait});return;}var st=steps[k++];cur=st.label||null;
try{if(st.fill!=null){var el=ins[st.fill];if(el){el.focus&&el.focus();var d=Object.getOwnPropertyDescriptor(el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,"value");d&&d.set?d.set.call(el,st.value):(el.value=st.value);fire(el,"input");fire(el,"change");key(el,st.value.slice(-1));filled.push(el);}}
else if(st.click!=null){var c=cs[st.click];if(c&&String(c.innerText||c.value||c.getAttribute("aria-label")||"").replace(/\\s+/g," ").trim()){["pointerdown","mousedown","pointerup","mouseup"].forEach(function(t){try{c.dispatchEvent(new MouseEvent(t,{bubbles:true}));}catch(x){}});c.click();}else missing.push(st.label);}}catch(x){e.push(String(x&&x.message||x));}
setTimeout(function(){snaps.push(__snap(tofill));next();},150);}
next();},${ms});});})();<\/script>`;
}

export default { PROBE, JUNK, tokensOf, planRehearsal, judgeRehearsal, regressionFinding, OBSERVE_JS, rehearsalScript };
