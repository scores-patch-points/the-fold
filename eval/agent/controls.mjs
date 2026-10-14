// eval/agent/controls.mjs — the hidden tests' own controls (PREREG.md §Instrument). For every ask: a hand-written reference page that
// does the job must PASS its hidden test (positive control), and the same page with its scripts removed — the right labels, no
// behaviour — must FAIL it (negative control). A test that fails either control measures nothing and is fixed BEFORE any agent run.
//   node eval/agent/controls.mjs
import { chromium } from "playwright";
import { runHidden, loadHidden } from "./hidden.mjs";

const page = (body, js) => `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body>${body}<script>${js}</script></body></html>`;
const conv = (from, to, f, dp = 2) => page(`<h1>${from} to ${to}</h1><label>${from} <input id="a" type="number"></label><button id="b">Convert</button><p>Result: <span id="o"></span></p>`,
  `const c=()=>{const v=parseFloat(a.value);o.textContent=isNaN(v)?'':(${f})(v).toFixed(${dp})+' ${to}'};b.onclick=c;a.oninput=c;`);
export const REF = {
  calc: page(`<div id="d">0</div>${["7", "8", "9", "+", "4", "5", "6", "-", "1", "2", "3", "*", "0", "C", "=", "/"].map((k) => `<div class="k" style="cursor:pointer;display:inline-block;padding:8px">${k}</div>`).join("")}`,
    `let e='';document.querySelectorAll('.k').forEach(k=>k.addEventListener('click',()=>{const t=k.textContent;if(t==='C')e='';else if(t==='=')e=String(eval(e));else e+=t;d.textContent=e||'0';}));`),
  tip: page(`<label>Bill <input id="b" type="number"></label><label>Tip % <input id="p" type="number" value="15"></label><button id="go">Calculate</button><p>Tip: $<span id="t">0.00</span> Total: $<span id="s">0.00</span></p>`,
    `go.onclick=()=>{const b1=+b.value,p1=+p.value;t.textContent=(b1*p1/100).toFixed(2);s.textContent=(b1+b1*p1/100).toFixed(2);};`),
  "km-m": conv("Kilometres", "m", "v=>v*1000", 0),
  "c-f": conv("Celsius", "°F", "v=>v*9/5+32", 1),
  countdown: page(`<h1>Countdown</h1><div id="d">10</div><button id="s">Start</button>`, `s.onclick=()=>{let n=10;const i=setInterval(()=>{n--;d.textContent=n;if(n<=0)clearInterval(i);},1000);};`),
  stopwatch: page(`<div id="d">00:00.0</div><button id="s">Start</button><button id="r">Reset</button>`,
    `let t0=0,iv=null;s.onclick=()=>{t0=Date.now();iv=setInterval(()=>{const ms=Date.now()-t0;d.textContent='00:'+String(Math.floor(ms/1000)).padStart(2,'0')+'.'+Math.floor(ms%1000/100);},100);};`),
  todo: page(`<h1>To-do</h1><input id="i" placeholder="New task"><button id="a">Add</button><ul id="l"></ul>`, `a.onclick=()=>{const li=document.createElement('li');li.textContent=i.value;l.append(li);i.value='';};`),
  counter: page(`<h1>Counter</h1><p>Count: <span id="c">0</span></p><button id="p">+</button><button id="r">Reset</button>`, `let n=0;p.onclick=()=>{c.textContent=++n;};r.onclick=()=>{n=0;c.textContent=0;};`),
  bmi: page(`<label>Weight (kg) <input id="w" type="number"></label><label>Height (cm) <input id="h" type="number"></label><button id="b">Calculate BMI</button><p id="o"></p>`,
    `b.onclick=()=>{const m=h.value/100;o.textContent='BMI: '+(w.value/(m*m)).toFixed(1);};`),
  wordcount: page(`<textarea id="t"></textarea><p>Words: <span id="n">0</span></p>`, `t.oninput=()=>{n.textContent=t.value.trim()?t.value.trim().split(/\\s+/).length:0;};`),
  password: page(`<p id="o">Click to generate</p><button id="g">Generate Password</button>`, `g.onclick=()=>{const c='abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';let s='';for(let i=0;i<14;i++)s+=c[Math.floor(Math.random()*c.length)];o.textContent=s;};`),
  dice: page(`<div id="d">?</div><button id="r">Roll</button>`, `r.onclick=()=>{d.textContent=1+Math.floor(Math.random()*6);};`),
  "lb-kg": conv("Pounds", "kg", "v=>v*0.45359237", 2),
  percent: page(`<p>What is <input id="p" type="number"> % of <input id="v" type="number">?</p><button id="b">Calculate</button><p id="o"></p>`, `b.onclick=()=>{o.textContent='Result: '+(p.value*v.value/100);};`),
  charcount: page(`<textarea id="t"></textarea><p><span id="n">280</span> characters left</p>`, `t.oninput=()=>{n.textContent=280-t.value.length;};`),
  upper: page(`<input id="i"><button id="b">Convert</button><p id="o"></p>`, `b.onclick=()=>{o.textContent=i.value.toUpperCase();};`),
  reverse: page(`<input id="i"><button id="b">Reverse</button><p id="o"></p>`, `b.onclick=()=>{o.textContent=[...i.value].reverse().join('');};`),
  interest: page(`<input id="p" placeholder="Principal"><input id="r" placeholder="Rate %"><input id="t" placeholder="Years"><button id="b">Calculate</button><p id="o"></p>`,
    `b.onclick=()=>{const I=p.value*r.value*t.value/100;o.textContent='Interest: '+I.toFixed(2)+' Total: '+(+p.value+I).toFixed(2);};`),
  "mi-km": conv("Miles", "km", "v=>v*1.609344", 2),
  darkmode: page(`<h1>Hello</h1><button id="t">Toggle dark mode</button>`, `t.onclick=()=>{document.body.style.background=document.body.style.background==='black'?'white':'black';document.body.style.color='gray';};`),
  traffic: page(`<div id="r" style="width:40px;height:40px;background:red"></div><div id="y" style="width:40px;height:40px;background:#333"></div><div id="g" style="width:40px;height:40px;background:#333"></div>`,
    `const L=[r,y,g],C=['red','yellow','green'];let i=0;setInterval(()=>{L.forEach(x=>x.style.background='#333');i=(i+1)%3;L[i].style.background=C[i];},2000);`),
  oddeven: page(`<h1>Odd or Even?</h1><input id="n" type="number"><button id="b">Check</button><p id="o"></p>`, `b.onclick=()=>{o.textContent=n.value+' is '+(n.value%2?'odd':'even');};`),
  timestable: page(`<input id="n" type="number"><button id="b">Generate</button><table id="o"></table>`, `b.onclick=()=>{o.innerHTML='';for(let i=1;i<=10;i++)o.innerHTML+='<tr><td>'+n.value+' x '+i+' = '+n.value*i+'</td></tr>';};`),
  circle: page(`<label>Radius <input id="r" type="number"></label><button id="b">Calculate</button><p id="o"></p>`, `b.onclick=()=>{o.textContent='Area: '+(Math.PI*r.value*r.value).toFixed(2);};`),
};
// A second style for asks whose hidden test has a second alternative: the other common layout must pass too.
export const REF2 = {
  calc: page(`<input id="a" type="number"><select id="op"><option>+</option><option>-</option></select><input id="b" type="number"><button id="g">=</button><p id="o"></p>`,
    `g.onclick=()=>{o.textContent=op.value==='+'?(+a.value + +b.value):(a.value-b.value);};`),
  tip: page(`<input id="b" type="number" placeholder="Bill"><button class="p">10%</button><button class="p">15%</button><button class="p">20%</button><p id="o"></p>`,
    `document.querySelectorAll('.p').forEach(x=>x.onclick=()=>{const p=parseInt(x.textContent);o.textContent='Tip: '+(b.value*p/100).toFixed(2);});`),
  todo: page(`<input id="i"><ul id="l"></ul>`, `i.onkeydown=(e)=>{if(e.key==='Enter'){const li=document.createElement('li');li.textContent=i.value;l.append(li);i.value='';}};`),
  darkmode: page(`<label>Dark <input type="checkbox" id="c"></label>`, `c.onchange=()=>{document.body.style.background=c.checked?'#111':'#fff';};`),
  bmi: page(`<input id="h" placeholder="Height (m)"><input id="w" placeholder="Weight (kg)"><button id="b">Go</button><p id="o"></p>`, `b.onclick=()=>{o.textContent=(w.value/(h.value*h.value)).toFixed(2);};`),
};
const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "");

if (import.meta.url === `file://${process.argv[1]}`) {
  const H = loadHidden();
  const browser = await chromium.launch();
  let bad = 0;
  for (const [id, alts] of Object.entries(H.tests)) {
    const pos = await runHidden(browser, REF[id], alts, H.act);
    const neg = await runHidden(browser, strip(REF[id]), alts, H.act);
    const pos2 = REF2[id] ? await runHidden(browser, REF2[id], alts, H.act) : null;
    const neg2 = REF2[id] ? await runHidden(browser, strip(REF2[id]), alts, H.act) : null;
    const ok = pos.pass && !neg.pass && (!pos2 || pos2.pass) && (!neg2 || !neg2.pass);
    if (!ok) bad++;
    console.log(`${ok ? "ok " : "BAD"} ${id.padEnd(10)} +${pos.pass ? "pass" : "FAIL"} −${neg.pass ? "PASS" : "fail"}${pos2 ? ` +2${pos2.pass ? "pass" : "FAIL"} −2${neg2.pass ? "PASS" : "fail"}` : ""}${pos.pass ? "" : "  " + pos.whys.join("; ")}${pos2 && !pos2.pass ? "  2:" + pos2.whys.join("; ") : ""}`);
  }
  for (const id of Object.keys(REF)) if (!H.tests[id]) { console.log("BAD no hidden test for", id); bad++; }
  await browser.close();
  console.log(bad ? `${bad} control(s) failed` : "every hidden test passes its reference page and fails it without behaviour");
  process.exit(bad ? 1 : 0);
}
