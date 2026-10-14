// world.mjs — a deterministic Wikipedia for the model-free battery. The REAL page runs; only the network is replaced.
// Why: the live web rate-limits (429) and varies run to run, so a live battery cannot tell a fold defect from a bad day. This world
// holds retrieval PERFECT (every answerable ask has its page) and keeps the live CONFOUNDERS (the sentences that made the live run
// answer "Polonius", "sisters", "second-largest", "52,075 species"), so what it measures is the fold's answering layer alone.
// It also resolves bare relation words as titles ("Wrote", "Largest", "Painted") the way the live title door can.
// Page texts are written for this test (facts are true as of 2026-10); they are not Wikipedia's wording.

export const PAGES = {
  "Australia": "Australia, officially the Commonwealth of Australia, is a country comprising the mainland of the Australian continent, the island of Tasmania and numerous smaller islands. The capital city of Australia is Canberra, and its most populous city is Sydney. Australia has a population of about 27 million people.",
  "Canberra": "Canberra is the capital city of Australia. Founded following the federation of the colonies of Australia as the seat of government for the new nation, it is located in the Australian Capital Territory. Canberra was founded in 1913. The city has a population of about 470,000.",
  "Prime Minister of Australia": "The prime minister of Australia is the head of government of Australia. The current prime minister is Anthony Albanese, who has held the office since 23 May 2022.",
  "Canada": "Canada is a country in North America. Its capital is Ottawa, and its most populous city is Toronto. Canada has a population of about 41 million people.",
  "Ottawa": "Ottawa is the capital city of Canada. It is located in the province of Ontario at the confluence of the Ottawa River and the Rideau River. Ottawa has a population of about one million people.",
  "Prime Minister of Canada": "The prime minister of Canada is the head of government of Canada. The current prime minister is Mark Carney, who took office on 14 March 2025.",
  "France": "France is a country located primarily in Western Europe. Its capital is Paris. France has a population of about 68 million people.",
  "Paris": "Paris is the capital and most populous city of France. The city has a population of 2,102,650 residents, and the metropolitan area has a population of about 13 million. Paris is located on the river Seine.",
  "President of France": "The president of France, officially the President of the French Republic, is the head of state of France. The current president is Emmanuel Macron, who took office on 14 May 2017 and was re-elected in 2022.",
  "Emmanuel Macron": "Emmanuel Macron (born 21 December 1977 in Amiens) is a French politician who has served as president of France since 14 May 2017. Macron was born in Amiens, France.",
  "Hamlet": "The Tragedy of Hamlet, Prince of Denmark, often shortened to Hamlet, is a tragedy written by William Shakespeare sometime between 1599 and 1601. Ophelia has been wooed by Hamlet. Polonius, who is spying on the conversation behind an arras, calls for help and Hamlet stabs wildly, killing Polonius. Hamlet dies on the floor in front of Horatio, proclaiming \"the rest is silence\". In 1768, Voltaire wrote a negative review of Hamlet.",
  "William Shakespeare": "William Shakespeare (baptised 26 April 1564 – 23 April 1616) was an English playwright, poet and actor. Shakespeare was born in Stratford-upon-Avon, Warwickshire. He wrote about 39 plays, including Hamlet.",
  "Mona Lisa": "The Mona Lisa is a half-length portrait painting by the Italian artist Leonardo da Vinci. The Mona Lisa was painted by Leonardo da Vinci between about 1503 and 1519. It is on permanent display at the Louvre in Paris, where it has hung since 1797. The second wife of Lisa's father, Caterina di Mariotto Rucellai, and Francesco's first wife were sisters, members of the Rucellai family.",
  "Leonardo da Vinci": "Leonardo da Vinci (1452 – 1519) was an Italian polymath of the High Renaissance. He painted the Mona Lisa and The Last Supper. Leonardo was born in Vinci, in the Republic of Florence.",
  "Louvre": "The Louvre is the world's most-visited museum and a historic landmark in Paris, France. The Mona Lisa is kept at the Louvre.",
  "Eiffel Tower": "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is named after the engineer Gustave Eiffel. The Eiffel Tower is 330 metres (1,083 ft) tall. It was completed in 1889.",
  "Albert Einstein": "Albert Einstein (14 March 1879 – 18 April 1955) was a German-born theoretical physicist. Einstein was born in Ulm, in the Kingdom of Württemberg in the German Empire. Einstein received the 1921 Nobel Prize in Physics.",
  "Nobel Prize in Chemistry": "The Nobel Prize in Chemistry is awarded annually by the Royal Swedish Academy of Sciences. Marie Curie received the 1911 Nobel Prize in Chemistry.",
  "United States Declaration of Independence": "The Declaration of Independence was adopted by the Second Continental Congress on July 4, 1776. The Declaration of Independence was signed on August 2, 1776, at the Pennsylvania State House in Philadelphia.",
  "Penicillin": "Penicillin was discovered in 1928 by the Scottish physician Alexander Fleming at St Mary's Hospital in London. But penicillin F is unstable, difficult to isolate, and produced by the mould in small quantities. Fleming shared the 1945 Nobel Prize in Physiology or Medicine with Howard Florey and Ernst Chain.",
  "Alexander Fleming": "Sir Alexander Fleming (6 August 1881 – 11 March 1955) was a Scottish physician and microbiologist. Fleming was born at Lochfield farm near Darvel, in Ayrshire, Scotland. Fleming discovered penicillin in 1928.",
  "Jupiter": "Jupiter is the fifth planet from the Sun and the largest planet in the Solar System. Jupiter is the largest planet in the solar system, with a diameter of 142,984 km.",
  "Saturn": "Saturn is the sixth planet from the Sun. Saturn is the second-largest planet in the Solar System, after Jupiter, with a diameter of 116,460 km.",
  "Solar System": "The Solar System is the gravitationally bound system of the Sun and the objects that orbit it. The largest planet in the Solar System is Jupiter. The Solar System has eight planets.",
  "Planet": "A planet is a large, rounded astronomical body that orbits a star. Jupiter is the largest planet in the Solar System.",
  "Spider": "Spiders are air-breathing arthropods that have eight legs, chelicerae with fangs, and spinnerets that extrude silk. According to the World Spider Catalog there are 52,075 species of spider. All spiders have eight legs.",
  "Gold": "Gold is a chemical element; its chemical symbol is Au (from Latin aurum) and its atomic number is 79. Gold is a bright, slightly orange-yellow, dense, soft, malleable metal.",
  "World War II": "World War II, also known as the Second World War, was a global conflict between two coalitions, the Allies and the Axis powers. World War II lasted from 1 September 1939 to 2 September 1945. World War II ended in 1945.",
  "Charles III": "Charles III (born 14 November 1948 in London) is King of the United Kingdom and the 14 other Commonwealth realms. Charles became king on 8 September 2022. The wife of Charles III is Camilla.",
  "Monarchy of the United Kingdom": "The monarchy of the United Kingdom is the constitutional form of government by which a hereditary monarch reigns as head of state. The current monarch is King Charles III, who acceded to the throne on 8 September 2022. William IV was the last king of the House of Hanover.",
  "Camilla, Queen Consort": "Camilla (born Camilla Rosemary Shand, 17 July 1947 in London) is Queen of the United Kingdom. Camilla was born in London. She is the wife of Charles III.",
  "United Kingdom": "The United Kingdom of Great Britain and Northern Ireland is a country in Europe. Its capital is London. The monarch of the United Kingdom is King Charles III.",
  "United Nations": "The United Nations is an intergovernmental organization. In an effort to enhance transparency, in 2016 the organization held its first public debate between candidates for secretary-general. The current secretary-general is António Guterres.",
  "Secretary-General of the United Nations": "The secretary-general of the United Nations is the chief administrative officer of the organization. The current secretary-general is António Guterres of Portugal, who took office on 1 January 2017.",
  "António Guterres": "António Guterres (born 30 April 1949 in Lisbon) is a Portuguese politician who has served as secretary-general of the United Nations since 1 January 2017.",
  "Pope": "The pope is the bishop of Rome and the head of the Catholic Church. The current pope is Leo XIV, who was elected on 8 May 2025 on the second day of the 2025 papal conclave.",
  "Pope Leo XIV": "Pope Leo XIV (born Robert Francis Prevost on 14 September 1955 in Chicago) is the head of the Catholic Church. He was elected pope on 8 May 2025.",
  "President of the United States": "The president of the United States is the head of state and head of government of the United States. The current president is Donald Trump, who took office on January 20, 2025, as the 47th president.",
  "Donald Trump": "Donald Trump (born June 14, 1946, in Queens, New York City) is an American politician and businessman who is the 47th and current president of the United States. Trump was born in Queens.",
  "Queens": "Queens is a borough of New York City. Donald Trump was born in Queens.",
  "United States": "The United States of America is a country primarily located in North America. Its capital is Washington, D.C.",
  "List of French monarchs": "Louis XVI was the last king of France before the fall of the monarchy during the French Revolution; he reigned from 1774 until 1792. France has been a republic since 1870.",
  "Mars": "Mars is the fourth planet from the Sun. No human has walked on Mars. Mars has two small moons, Phobos and Deimos.",
  "Sun": "The Sun is the star at the centre of the Solar System. The Sun is orbited by eight planets. The Sun has no moons.",
  "Mark Carney": "Mark Carney (born 16 March 1965 in Fort Smith, Northwest Territories) is a Canadian economist and politician who has served as the prime minister of Canada since 14 March 2025.",
  "Anthony Albanese": "Anthony Albanese (born 2 March 1963 in Sydney) is an Australian politician who has served as the prime minister of Australia since 23 May 2022.",
  "Emperor Norton": "Joshua Norton (1818 – 1880) was a resident of San Francisco who in 1859 proclaimed himself Norton I, Emperor of the United States. He died in 1880.",
};
// Titles that are not pages but REDIRECT, and bare relation words that the live title door can resolve (the 2026-10-12 hazard).
export const REDIRECTS = {
  "uk": "United Kingdom", "u.k.": "United Kingdom", "us": "United States", "usa": "United States", "un": "United Nations",
  "king of the uk": "Monarchy of the United Kingdom", "king": "Monarchy of the United Kingdom", "monarch": "Monarchy of the United Kingdom",
  "camilla": "Camilla, Queen Consort", "pope": "Pope", "president": "President of the United States",
  "wrote": "Hamlet",                 // a bare verb that resolves: the title door's hazard
  "largest": "Jupiter", "painted": "Mona Lisa", "discovered": "Penicillin", "born": "Charles III",
  "secretary-general": "Secretary-General of the United Nations", "leo xiv": "Pope Leo XIV", "king charles iii": "Charles III", "charles iii": "Charles III",
  "second world war": "World War II", "ww2": "World War II", "world war 2": "World War II",
  "declaration of independence": "United States Declaration of Independence",
  "solar system": "Solar System", "planet": "Planet", "legs": "Spider", "leg": "Spider",
};

const canon = new Map(Object.keys(PAGES).map((t) => [t.toLowerCase(), t]));
const STOP = new Set("a an the of is are was were do does did who whom what which when where how many much in on at to for by from with and or as it its has have had be been this that these those there their his her him she he they them not no can will would should could may might must shall than then so such very just also into over under about between and".split(" "));
const words = (s) => String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];

export function resolveTitle(t) {
  const norm = String(t).replace(/_/g, " ").trim();
  const k = norm.toLowerCase();
  if (canon.has(k)) return { title: canon.get(k), redirectedFrom: null };
  if (Object.prototype.hasOwnProperty.call(REDIRECTS, k)) return { title: REDIRECTS[k], redirectedFrom: norm };
  return null;
}

export function search(q, n = 5) {
  const qw = [...new Set(words(q).filter((w) => w.length > 2 && !STOP.has(w)))];
  const scored = Object.entries(PAGES).map(([title, text]) => {
    const tw = new Set(words(title)), xw = new Set(words(text));
    let s = 0; for (const w of qw) { if (tw.has(w)) s += 3; else if (xw.has(w)) s += 1; }
    return { title, text, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.title.length - b.title.length);
  return scored.slice(0, n);
}

/** Route the network of a Playwright page into this world. Returns a log of what the page asked for. */
export async function installWorld(page) {
  const log = { searches: [], titles: [], extracts: [], refused: [] };
  const cors = { "access-control-allow-origin": "*" };
  const json = (route, body, status = 200) => route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
  await page.route(/wikipedia\.org\/w\/api\.php/, (route) => {
    const u = route.request().url();
    const p = new URL(u).searchParams;
    if (p.get("list") === "search") {
      const q = p.get("srsearch") || ""; log.searches.push(q);
      return json(route, { query: { search: search(q, 8).map((x) => ({ title: x.title, snippet: x.text.slice(0, 140), wordcount: x.text.split(/\s+/).length })) } });
    }
    if (p.get("prop") === "extracts") {
      const t = p.get("titles") || ""; log.extracts.push(t);
      const r = resolveTitle(t);
      if (!r) return json(route, { query: { pages: { "-1": { ns: 0, title: t, missing: "" } } } });
      return json(route, { query: { pages: { 1: { pageid: 1, ns: 0, title: r.title, extract: PAGES[r.title] } } } });
    }
    if (p.get("prop") === "pageprops" || p.get("redirects")) {
      const asked = (p.get("titles") || "").split("|"); log.titles.push(asked);
      const normalized = [], redirects = [], pages = {}; let neg = -1, id = 1;
      for (const t of asked) {
        const nrm = t.replace(/_/g, " "); const first = nrm.charAt(0).toUpperCase() + nrm.slice(1);
        if (first !== t) normalized.push({ from: t, to: first });
        const r = resolveTitle(first);
        if (!r) { pages[String(neg--)] = { ns: 0, title: first, missing: "" }; continue; }
        if (r.redirectedFrom || r.title !== first) redirects.push({ from: first, to: r.title });   // MediaWiki keeps "Solar system" as a redirect to "Solar System"
        pages[String(id++)] = { pageid: id, ns: 0, title: r.title };
      }
      return json(route, { batchcomplete: "", query: { ...(normalized.length ? { normalized } : {}), ...(redirects.length ? { redirects } : {}), pages } });
    }
    return json(route, {});
  });
  // the page READS a referent's page as HTML from /wiki/<Title> (direct first, then relays): serve the same fixture text as a page
  await page.route(/https?:\/\/[a-z-]+\.wikipedia\.org\/wiki\//, (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/wiki\//, ""));
    const r = resolveTitle(path);
    log.extracts.push("html:" + path);
    if (!r) return route.fulfill({ status: 404, headers: cors, contentType: "text/html", body: "<html><body><h1>Not found</h1></body></html>" });
    const paras = PAGES[r.title].split(/(?<=[.!?])\s+(?=[A-Z"])/).reduce((acc, sentence, i) => { const k = Math.floor(i / 3); (acc[k] = acc[k] || []).push(sentence); return acc; }, []).map((g) => "<p>" + g.join(" ") + "</p>").join("\n");
    return route.fulfill({ status: 200, headers: cors, contentType: "text/html; charset=utf-8", body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${r.title} - Wikipedia</title></head><body><main id="content"><h1>${r.title}</h1>\n${paras}</main></body></html>` });
  });
  // every other outbound door is refused: this world has one source, the encyclopedia, held perfect
  await page.route(/(duckduckgo|brave\.com|bing\.com|google\.com|api\.github\.com|archive\.org|openalex|crossref|r\.jina\.ai|allorigins|corsproxy|microlink|workers\.dev|wikidata\.org)/, (r) => { log.refused.push(r.request().url().slice(0, 80)); return r.abort(); });
  await page.route(/\/heimdall\/api\/(search|page)/, (r) => { log.refused.push("heimdall relay"); return r.abort(); });
  return log;
}
