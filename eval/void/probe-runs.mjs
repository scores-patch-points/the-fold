// a quick look at the anchor candidates an ask yields per language (no network)
import { candidateRuns } from "../../fold-chat-void-intl.js";
const asks = [
  ["オーストラリアの首都はどこですか。", "ja", ["の", "は", "です", "か"]],
  ["호주의 수도는 어디입니까?", "ko", []],
  ["Avustralya'nın başkenti neresidir?", "tr", []],
  ["Какая столица Австралии?", "ru", ["Какая"]],
  ["Quelle est la capitale de l'Australie ?", "fr", ["Quelle", "est", "la", "de", "l"]],
];
for (const [a, l, closed] of asks) {
  const r = candidateRuns(a, l, { closedOf: (w) => closed.includes(w) });
  console.log(l, r.size, [...r.keys()].slice(0, 8).join(" | "));
}
