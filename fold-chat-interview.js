// fold-chat-interview.js — the fold asking, so it can help. Pure; node-testable.
//
// "a mode where it asks questions to learn about the user in ways that would be helpful for them ...
// helpful for the app to better assist" (user, 2026-10-11). A short, consenting interview: a handful
// of questions, each stating WHY it is asked and what the person gets. Every answer becomes one
// auditable memory ABOUT THE PERSON (fold-chat-memorystore), phrased in their own terms — never an
// inference, never a model's guess. The person can skip any question, and every memory stays editable.
//
// The interview only ASKS; it stores nothing itself. The caller turns an answer into a memory entry.

/** The questions, in order. `mem` phrases the answer as a first-person memory; `skip` is honest about
 *  what happens if they pass. */
export const QUESTIONS = Object.freeze([
  {
    id: "name", q: "What should I call you?",
    why: "so I address you the way you want, and never invent a name",
    help: "a name I get right from here on",
    mem: (a) => `my name is ${a}`,
  },
  {
    id: "place", q: "Where are you based? A city or country is plenty.",
    why: "so questions like “who is the president?” read as YOUR president, and times match your clock",
    help: "local context for place- and time-dependent questions",
    mem: (a) => `I am based in ${a}`,
  },
  {
    id: "work", q: "What do you spend your days on — a job, a study, a project?",
    why: "so I can pitch answers at your world instead of a generic one",
    help: "answers aimed at what you actually do",
    mem: (a) => `I spend my time on ${a}`,
  },
  {
    id: "wants", q: "When you ask me something, what do you usually want — a quick fact, a long draft, code, a source you can check?",
    why: "so the default shape of an answer fits you",
    help: "less re-asking; the answer arrives in the form you want",
    mem: (a) => `I usually want ${a} from an assistant`,
  },
  {
    id: "topics", q: "What are you into, or always curious about?",
    why: "so I can offer the connecting thread when a topic touches what you know",
    help: "the fold reads new material against what matters to you",
    mem: (a) => `I am interested in ${a}`,
  },
  {
    id: "avoid", q: "Anything you'd rather I never assume, do, or bring up?",
    why: "so I stay inside the bounds you set",
    help: "no repeats of a thing you've told me you don't want",
    mem: (a) => `I do not want ${a}`,
  },
]);

/** The next unanswered question, or null when the interview is done. */
export function nextQuestion(answered = []) {
  const done = new Set((answered || []).map((x) => (typeof x === "string" ? x : x?.id)).filter(Boolean));
  return QUESTIONS.find((q) => !done.has(q.id)) || null;
}

/** Turn an answer into a memory entry about the person (source "stated"), or null if empty/passed. */
export function entryFor(id, answer, { at = null } = {}) {
  const q = QUESTIONS.find((x) => x.id === id);
  const a = String(answer ?? "").trim();
  if (!q || !a) return null;
  return { text: q.mem(a), source: "stated", at };
}

/** How far along: { asked, total, done }. */
export function progress(answered = []) {
  const done = new Set((answered || []).map((x) => (typeof x === "string" ? x : x?.id)).filter((id) => QUESTIONS.some((q) => q.id === id)));
  return { asked: done.size, total: QUESTIONS.length, done: done.size >= QUESTIONS.length };
}
