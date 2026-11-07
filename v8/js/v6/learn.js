// Portal Lab v6 · How It Works: explainer video, year plan, variance lab, gaps, guided tour, FAQ, glossary.
import { ONE_LINE, THREE_THINGS, ROLES, PREREQS, YEAR1, FUTURE, YEAR1_MEASURES, VARIANCE, GAPS, TOUR, FAQ, GLOSSARY, NCAA_CAL } from "./content.js";
import { CHAPTERS } from "./chapters.js";
import { say, ask, hush } from "../v5/coach.js";
import { pageFlow, startFlow, bindFlow, POS } from "../v7/flow.js";
export { startFlow, pageFlow };

export const V6NAV = [
  { k: "learn", label: "Start Here" },
  { k: "flow", label: "AI Workforce at Work" },
  { k: "plan", label: "This Year & Beyond" },
  { k: "variance", label: "How It Gets Sharper" },
  { k: "gaps", label: "Gaps to Close" },
  { k: "tour", label: "Guided Tour" },
  { k: "faq", label: "Questions" },
  { k: "glossary", label: "Glossary" },
];
export const V6TITLES = {
  learn: ["Start Here", "What Buckeye Edge is, how the AI Workforce works, and where each person starts"],
  flow: ["AI Workforce at Work", "An agentic workflow at any position, from portal entry to a coach's inbox"],
  plan: ["This Year & Beyond", "Approvals first, then the year-one plan and what comes later"],
  variance: ["How It Gets Sharper", "The four sources of variance, and a live demo of how cutting noise sharpens the system"],
  gaps: ["Gaps to Close", "What has to be true before the system can do more"],
  tour: ["Guided Tour", "A spoken, step-by-step walk through every screen"],
  faq: ["Questions", "What coaches and staff ask most, in plain language"],
  glossary: ["Glossary", "Every term on one page"],
};

const S6 = { role: "dan", tourOn: false, tourI: 0, tourVoice: true, faqQ: "", faqC: "All", gapYr: "All", lab: { noise: 1.2, prog: 0.6, adjust: false } };
let CTX = null;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const statusCls = (s) => /done|verified|prototype/i.test(s) ? "ok" : /progress|planned|partly|open/i.test(s) ? "mid" : "no";

// ---------------- Start Here ----------------
export function pageLearn() {
  const r = ROLES.find((x) => x.k === S6.role) || ROLES[0];
  return `<div class="v6">
  <section class="v6-hero">
    <div class="v6-hero-l">
      <div class="v6-kick">How it works</div>
      <h2 class="v6-h">An advanced AI decision system for the transfer portal</h2>
      <p class="v6-lede">${esc(ONE_LINE)}</p>
      <div class="v6-hero-cta"><button class="btn primary" data-go="flow">See the AI Workforce at work</button><button class="btn" data-v6="tour-start">Take the guided tour</button><button class="btn" data-go="plan">This year and beyond</button><button class="btn" data-go="faq">Questions</button></div>
    </div>
    <div class="v6-video">
      <div class="v6-vwrap">
      <video id="v6-vid" preload="metadata" playsinline poster="media/explainer-poster.jpg">
        <source src="media/explainer.mp4" type="video/mp4"/>
        <source src="media/explainer.webm" type="video/webm"/>
        <track kind="captions" src="media/explainer.vtt" srclang="en" label="English" default/>
      </video>
      <button class="v6-play" data-v6="play" aria-label="Play the 3-minute explainer"><span class="v6-play-i" aria-hidden="true"></span><span>Play the explainer · 3:04</span></button>
      <p class="v6-vfail">This browser could not play the video. <a href="media/explainer.mp4" download>Download the MP4</a></p>
      </div>
      <ol class="v6-chap">${CHAPTERS.map((c, i) => `<li><button data-v6="chap" data-t="${c.start}" data-i="${i}"><span class="v6-chap-t">${fmtT(c.start)}</span>${esc(c.title)}</button></li>`).join("")}</ol>
    </div>
  </section>
  <section class="v6-three">${THREE_THINGS.map(([h, p], i) => `<article class="v6-card v6-in" style="--d:${i * 80}ms"><div class="v6-num">${i + 1}</div><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join("")}</section>
  <section class="v6-card v6-roles">
    <div class="v6-sec-h"><h3>Where do you start?</h3><span class="dim">Pick your role</span></div>
    <div class="v6-role-tabs" role="tablist">${ROLES.map((x) => `<button role="tab" aria-selected="${x.k === r.k}" class="${x.k === r.k ? "on" : ""}" data-v6="role" data-id="${x.k}">${esc(x.who)}</button>`).join("")}</div>
    <div class="v6-role">
      <div><div class="v6-role-who">${esc(r.who)} <span class="dim">· ${esc(r.title)}</span></div>
        <div class="v6-role-cols"><div><h4>What you do</h4><ul>${r.does.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div><div><h4>What you get</h4><ul>${r.gets.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div></div>
      </div>
      <div class="v6-role-go"><h4>Start here</h4>${r.start.map(([k, l]) => `<button class="btn" data-go="${k}">${esc(l)} →</button>`).join("")}<button class="btn sm" data-v6="read-role">Read this aloud</button></div>
    </div>
  </section>
  <section class="v6-flow v6-card">
    <div class="v6-sec-h"><h3>How the system works</h3><span class="dim">The daily loop</span></div>
    <div class="v6-loop">${[["Portal Watch", "Flags players who may enter, ranked by tested signals", "watch"], ["AI Workforce", "Agents research, score and check every player at every position", "flow"], ["Talk to Edge", "Coaches ask out loud on phone, tablet or big screen", "talk"], ["Delivered to you", "Cards in each coach's inbox, Monday brief, film prep, selection board", "rooms"], ["Approval", "Nothing that contacts anyone goes out without a named yes", "bots"]].map(([h, p, k], i) => `<button class="v6-node" data-go="${k}" style="--d:${i * 120}ms"><span class="v6-node-n">${i + 1}</span><b>${h}</b><span>${p}</span></button>`).join(`<span class="v6-arrow" aria-hidden="true"></span>`)}</div>
    <p class="dim v6-fine">Coaches make the call. Every agent step is shown and logged in the run journal.</p>
  </section>
  </div>`;
}

// ---------------- This Year & Beyond ----------------
export function pagePlan() {
  return `<div class="v6">
  <section class="v6-card v6-prereq">
    <div class="v6-sec-h"><h3>First: approvals not yet in place</h3><span class="dim">Nothing below starts until these are signed. Dates stay open until then.</span></div>
    <table class="t v6-t"><thead><tr><th>Prerequisite</th><th>Status</th><th>Who</th></tr></thead><tbody>${PREREQS.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td><span class="v6-st ${statusCls(b)}">${esc(b)}</span></td><td class="dim">${esc(c)}</td></tr>`).join("")}</tbody></table>
  </section>
  <section class="v6-card">
    <div class="v6-sec-h"><h3>Year one: the 2026–27 cycle</h3><button class="btn sm" data-v6="read-y1">Read aloud</button></div>
    <div class="v6-tl">${YEAR1.map((p, i) => `<div class="v6-tl-i v6-in" style="--d:${i * 90}ms"><div class="v6-tl-dot ${/Verified/.test(p.tag) ? "hot" : ""}"></div><div class="v6-tl-when">${esc(p.when)} <span class="v6-tag ${/Verified/.test(p.tag) ? "ok" : ""}">${p.link ? `<a href="${p.link}" target="_blank" rel="noopener">${esc(p.tag)}</a>` : esc(p.tag)}</span></div><h4>${esc(p.title)}</h4><ul>${p.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>
  </section>
  <section class="v6-card">
    <div class="v6-sec-h"><h3>How we will know year one worked</h3><span class="dim">No numbers are claimed until they are measured</span></div>
    <table class="t v6-t"><thead><tr><th>Measure</th><th>What it means</th><th>Baseline</th><th>This year</th></tr></thead><tbody>${YEAR1_MEASURES.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td class="dim">${esc(r[2])}</td><td class="dim">${esc(r[3])}</td></tr>`).join("")}</tbody></table>
  </section>
  <section class="v6-future">${FUTURE.map((f, i) => `<article class="v6-card v6-step v6-in" style="--d:${i * 120}ms;--lvl:${i}"><div class="v6-step-yr">${esc(f.yr)}</div><div class="dim v6-step-when">${esc(f.when)}</div><ul>${f.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><button class="btn sm" data-v6="read-fut" data-i="${i}">Read aloud</button></article>`).join("")}</section>
  <p class="dim v6-fine">Sources: the Dan and Les call (Nov 5, 2026) and the methodology call with Dr. Robert Rippee. Portal window from the <a href="${NCAA_CAL}" target="_blank" rel="noopener">NCAA Division I transfer-window calendar</a>. Commercial terms are in the proposal, not here.</p>
  </div>`;
}

// ---------------- Variance ----------------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(20270104), gauss = () => { const u = Math.max(1e-9, R()), v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const N = 60, DRAW = Array.from({ length: N }, () => ({ t: gauss(), p: gauss(), h: gauss(), a: gauss(), b: gauss() }));
function corr(x, y) { const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); }
function labCalc() {
  const { noise, prog, adjust } = S6.lab, H = 0.6;
  const A = [], B = [], G = [], Y = [];
  for (const d of DRAW) { const bias = adjust ? 0 : prog * d.p; const a = d.t + bias + noise * d.a, b = d.t + bias + noise * d.b; A.push(a); B.push(b); G.push((a + b) / 2); Y.push(d.t - 0.3 * prog * d.p + H * d.h); }
  const agree = corr(A, B), valid = corr(G, Y);
  return { agree, valid, r2: Math.max(0, valid) ** 2, A, B, G, Y };
}
function scatter(xs, ys, w = 300, h = 200) {
  const mn = (a) => Math.min(...a), mx = (a) => Math.max(...a); const x0 = mn(xs), x1 = mx(xs), y0 = mn(ys), y1 = mx(ys);
  const px = (v) => 20 + ((v - x0) / (x1 - x0 || 1)) * (w - 30), py = (v) => h - 20 - ((v - y0) / (y1 - y0 || 1)) * (h - 30);
  return `<svg viewBox="0 0 ${w} ${h}" class="v6-sc" role="img" aria-label="Scatter plot"><line x1="20" y1="${h - 20}" x2="${w - 10}" y2="${h - 20}" class="ax"/><line x1="20" y1="10" x2="20" y2="${h - 20}" class="ax"/>${xs.map((x, i) => `<circle cx="${px(x).toFixed(1)}" cy="${py(ys[i]).toFixed(1)}" r="3.2"/>`).join("")}</svg>`;
}
function labHTML() {
  const c = labCalc(), pct = Math.round(c.r2 * 100);
  return `<div class="v6-lab-out">
    <div class="v6-lab-fig"><div class="v6-lab-cap">Evaluator A vs Evaluator B <b>${c.agree.toFixed(2)}</b></div>${scatter(c.A, c.B)}<div class="dim v6-fig-ax">Each dot is one sample quarterback. Tighter line = more agreement.</div></div>
    <div class="v6-lab-fig"><div class="v6-lab-cap">Average grade vs what happened <b>${c.valid.toFixed(2)}</b></div>${scatter(c.G, c.Y)}<div class="dim v6-fig-ax">How well the grades line up with outcomes.</div></div>
  </div>
  <div class="v6-meter"><div class="v6-meter-h"><b>Explained variance</b><span>r² = ${c.valid.toFixed(2)}² = <b>${pct}%</b></span></div>
    <div class="v6-bar"><i style="width:${pct}%"></i><span class="v6-bar-mk" style="left:50%"><em>About half: the bar for reliable forecasts</em></span></div></div>`;
}
export function pageVariance() {
  const L = S6.lab;
  return `<div class="v6">
  <section class="v6-card"><div class="v6-sec-h"><h3>How the system gets sharper</h3><button class="btn sm" data-v6="read-var">Read aloud</button></div>
    <p class="v6-lede sm">The system is only as sharp as the data going in, and today that data is noisy. In plain terms, the job this year is to <b>explain the error</b>: how far off people are from each other, and from what actually happened. Dr. Robert Rippee, the methodology lead, points to four sources.</p>
    <div class="v6-four">${VARIANCE.map((v, i) => `<article class="v6-vc v6-in" style="--d:${i * 100}ms"><div class="v6-vc-n">${v.n}</div><h4>${esc(v.title)}</h4><p>${esc(v.plain)}</p><div class="v6-vc-fix"><b>How we close it</b> ${esc(v.fix)}</div></article>`).join("")}</div>
  </section>
  <section class="v6-card v6-lab"><div class="v6-sec-h"><h3>See it: how cutting noise sharpens the system</h3><span class="dim">Sample players, fixed random draws · an illustration, not Ohio State data</span></div>
    <div class="v6-lab-ctl">
      <label>Evaluator disagreement <input type="range" min="0" max="2" step="0.1" value="${L.noise}" data-v6lab="noise"/><b data-v6o="noise">${L.noise.toFixed(1)}</b></label>
      <label>Program effect in the stats <input type="range" min="0" max="1.5" step="0.1" value="${L.prog}" data-v6lab="prog"/><b data-v6o="prog">${L.prog.toFixed(1)}</b></label>
      <label class="v6-chk"><input type="checkbox" data-v6lab="adjust" ${L.adjust ? "checked" : ""}/> Adjust for program (year two)</label>
    </div>
    <div id="v6-lab">${labHTML()}</div>
    <details class="v6-how"><summary>How this is calculated</summary><p>60 sample players get a true ability t, a program boost p and a human factor h, all from a fixed seed. Each evaluator's grade = t + (program effect × p) + (disagreement × their own noise). The outcome = t − 0.3 × (program effect × p) + 0.6 × h, because players from a boosted program tend to come back to earth. The numbers shown are Pearson correlations; explained variance is the correlation squared. Cutting evaluator noise (standard measures, computer vision) and adjusting for program are exactly the year-two and year-three work.</p></details>
  </section>
  </div>`;
}

// ---------------- Gaps ----------------
export function pageGaps() {
  const yrs = ["All", "Year 1", "Year 2", "Year 3"];
  const rows = GAPS.filter((g) => S6.gapYr === "All" || g.yr.includes(S6.gapYr.replace("Year ", "")));
  return `<div class="v6"><section class="v6-card">
    <div class="v6-sec-h"><h3>Gaps to close</h3><div class="seg">${yrs.map((y) => `<button class="btn sm ${S6.gapYr === y ? "primary" : ""}" data-v6="gapyr" data-id="${y}">${y}</button>`).join("")}</div></div>
    <div class="v6-gaps">${rows.map((g, i) => `<article class="v6-gap v6-in" style="--d:${i * 50}ms"><div class="v6-gap-top"><h4>${esc(g.gap)}</h4><span class="v6-st ${statusCls(g.status)}">${esc(g.status)}</span></div><div class="v6-gap-g"><div><span class="dim">Why it matters</span>${esc(g.why)}</div><div><span class="dim">How we close it</span>${esc(g.close)}</div><div><span class="dim">When · who</span>${esc(g.yr)} · ${esc(g.owner)}</div></div></article>`).join("")}</div>
  </section></div>`;
}

// ---------------- Tour ----------------
export function pageTour() {
  return `<div class="v6"><section class="v6-card">
    <div class="v6-sec-h"><h3>Guided tour · ${TOUR.length} stops</h3><div><label class="v6-chk"><input type="checkbox" data-v6="tourvoice" ${S6.tourVoice ? "checked" : ""}/> Read each stop aloud</label> <button class="btn primary" data-v6="tour-start">Start the tour</button></div></div>
    <p class="dim">The tour moves through the real screens. A card at the bottom explains each one; use Next and Back, or close it at any time.</p>
    <ol class="v6-tour-list">${TOUR.map((t, i) => `<li><button data-v6="tour-at" data-i="${i}"><span class="v6-num sm">${i + 1}</span><b>${esc(t.title)}</b><span class="dim">${esc(t.text)}</span></button></li>`).join("")}</ol>
  </section></div>`;
}
function tourCard() {
  let el = document.getElementById("v6-tourcard");
  if (!S6.tourOn) { if (el) el.remove(); document.querySelectorAll(".v6-spot").forEach((x) => x.classList.remove("v6-spot")); return; }
  if (!el) { el = document.createElement("div"); el.id = "v6-tourcard"; el.className = "v6-tourcard"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Guided tour"); document.body.appendChild(el); }
  const t = TOUR[S6.tourI];
  el.innerHTML = `<div class="v6-tc-h"><span class="v6-num sm">${S6.tourI + 1}</span><b>${esc(t.title)}</b><span class="dim">${S6.tourI + 1} of ${TOUR.length}</span><button class="btn sm" data-v6="tour-end" aria-label="Close tour">✕</button></div><p>${esc(t.text)}</p><div class="v6-tc-f"><div class="v6-tc-dots">${TOUR.map((_, i) => `<i class="${i === S6.tourI ? "on" : ""}"></i>`).join("")}</div><button class="btn sm" data-v6="tour-say">Read aloud</button><button class="btn sm" data-v6="tour-prev" ${S6.tourI === 0 ? "disabled" : ""}>Back</button><button class="btn sm primary" data-v6="tour-next">${S6.tourI === TOUR.length - 1 ? "Finish" : "Next"}</button></div>`;
  document.querySelectorAll(".v6-spot").forEach((x) => x.classList.remove("v6-spot"));
  const target = document.querySelector(t.sel); if (target && t.sel !== "#page") { target.classList.add("v6-spot"); target.scrollIntoView({ block: "center", behavior: "smooth" }); }
}
function tourGo(i) {
  S6.tourOn = true; S6.tourI = Math.max(0, Math.min(TOUR.length - 1, i));
  const t = TOUR[S6.tourI]; hush();
  if (!location.hash.startsWith("#/" + t.go)) CTX.go(t.go); else tourCard();
  if (S6.tourVoice) setTimeout(() => say(`${t.title}. ${t.text}`), 350);
}

// ---------------- FAQ ----------------
export function pageFaq() {
  const cats = ["All", ...new Set(FAQ.map((f) => f.c))];
  const q = S6.faqQ.toLowerCase();
  const rows = FAQ.map((f, i) => ({ ...f, i })).filter((f) => (S6.faqC === "All" || f.c === S6.faqC) && (!q || (f.q + " " + f.a).toLowerCase().includes(q)));
  return `<div class="v6"><section class="v6-card">
    <div class="v6-faq-top"><input type="search" id="v6-faq-q" placeholder="Search questions…" value="${esc(S6.faqQ)}" aria-label="Search questions"/><div class="seg">${cats.map((c) => `<button class="btn sm ${S6.faqC === c ? "primary" : ""}" data-v6="faqc" data-id="${c}">${c}</button>`).join("")}</div></div>
    <div class="v6-faq" id="v6-faq-list">${faqList(rows)}</div>
  </section></div>`;
}
function faqList(rows) {
  return rows.length ? rows.map((f) => `<details class="v6-qa"><summary><span class="v6-tag">${esc(f.c)}</span>${esc(f.q)}</summary><p>${esc(f.a)}${f.link ? ` <a href="${f.link}" target="_blank" rel="noopener">Source</a>` : ""}</p><div class="v6-qa-f"><button class="btn sm" data-v6="faq-say" data-i="${f.i}">Read aloud</button><button class="btn sm" data-v6="faq-ask" data-i="${f.i}">Ask Edge this</button></div></details>`).join("") : `<p class="dim">No questions match. Try asking Edge instead.</p>`;
}

// ---------------- Glossary ----------------
export function pageGlossary() {
  return `<div class="v6"><section class="v6-card"><dl class="v6-gl">${GLOSSARY.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join("")}</dl></section></div>`;
}

// ---------------- spoken summaries (used by Edge too) ----------------
export const SPOKEN = {
  y1: () => "This year starts with listening, at every position. Before December: a demo for the general manager and head coach, a session to define success, including three ideal players per position, and the needs assessment. During the portal window, January fourth through the thirteenth, the AI Workforce runs alongside the staff while a small team observes with permission and records film sessions as coaches think out loud. After the window, we compare speed and coverage with last year. All of it waits on approvals that aren't signed yet.",
  future: () => "Year two: Ohio State's own standard measures at every position, program effects mapped, and a check against the 2024 and 2025 classes. Year three: computer vision measures film the staff's way, and success forecasts validated against real outcomes, position by position. Timing is still to be decided.",
  variance: () => "The system gets sharper by cutting noise. There are four sources of variance: how people grade film, program effects, whether measures are reliable and valid, and outcomes. Explaining about half of the error is the bar for reliable success forecasts.",
  flow: (p) => { const x = POS[p] || POS.CB; return `Here is the AI Workforce at work on ${x.n.toLowerCase()}s. A sample player enters the portal, the Portal Scout flags him, the Film Analyst preps the clips, the Fit Scorer compares him with your three ideal players, the Compliance Checker confirms the rules, and the Brief Writer puts a card in the ${x.room}'s inbox. Every step is shown. Coaches make the call.`; },
  what: () => ONE_LINE,
};

// ---------------- binding ----------------
export function afterRender6() {
  tourCard();
  const v = document.getElementById("v6-vid");
  if (v && !v.dataset.b) {
    v.dataset.b = "1";
    v.addEventListener("timeupdate", () => { let k = 0; CHAPTERS.forEach((c, i) => { if (v.currentTime >= c.start - 0.05) k = i; }); document.querySelectorAll(".v6-chap button").forEach((b, i) => b.classList.toggle("on", i === k)); });
    const wrap = v.closest(".v6-vwrap"), srcs = v.querySelectorAll("source");
    srcs[srcs.length - 1]?.addEventListener("error", () => wrap?.classList.add("v6-novid"));
    v.addEventListener("play", () => { v.controls = true; wrap?.classList.add("v6-playing"); });
  }
}
export function startTour(i = 0) { tourGo(i); }
export function bindV6(ctx) {
  CTX = ctx;
  bindFlow();
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-v6]"); if (!t) return;
    const a = t.dataset.v6;
    if (a === "play") { const v = document.getElementById("v6-vid"); if (v) { v.controls = true; t.closest(".v6-vwrap")?.classList.add("v6-playing"); v.play().catch(() => {}); } return; }
    if (a === "chap") { const v = document.getElementById("v6-vid"); if (v) { v.currentTime = +t.dataset.t; v.play().catch(() => {}); } return; }
    if (a === "role") { S6.role = t.dataset.id; return ctx.render(); }
    if (a === "read-role") { const r = ROLES.find((x) => x.k === S6.role); return say(`${r.who}. What you do: ${r.does.join(". ")}. What you get: ${r.gets.join(". ")}.`); }
    if (a === "read-y1") return say(SPOKEN.y1());
    if (a === "read-fut") { const f = FUTURE[+t.dataset.i]; return say(`${f.yr}. ${f.items.join(". ")}.`); }
    if (a === "read-var") return say(SPOKEN.variance());
    if (a === "gapyr") { S6.gapYr = t.dataset.id; return ctx.render(); }
    if (a === "faqc") { S6.faqC = t.dataset.id; return ctx.render(); }
    if (a === "faq-say") { const f = FAQ[+t.dataset.i]; return say(`${f.q} ${f.a}`); }
    if (a === "faq-ask") { const f = FAQ[+t.dataset.i]; ctx.go("talk"); setTimeout(() => ask(f.q), 250); return; }
    if (a === "tour-start") return tourGo(0);
    if (a === "tour-at") return tourGo(+t.dataset.i);
    if (a === "tour-next") { if (S6.tourI >= TOUR.length - 1) { S6.tourOn = false; hush(); tourCard(); ctx.toast("Tour complete"); return; } return tourGo(S6.tourI + 1); }
    if (a === "tour-prev") return tourGo(S6.tourI - 1);
    if (a === "tour-say") { const x = TOUR[S6.tourI]; return say(`${x.title}. ${x.text}`); }
    if (a === "tour-end") { S6.tourOn = false; hush(); return tourCard(); }
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.v6 === "tourvoice") S6.tourVoice = t.checked;
    if (t.dataset.v6lab === "adjust") { S6.lab.adjust = t.checked; const o = document.getElementById("v6-lab"); if (o) o.innerHTML = labHTML(); }
  });
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.v6lab && t.type === "range") { S6.lab[t.dataset.v6lab] = +t.value; const o = document.querySelector(`[data-v6o="${t.dataset.v6lab}"]`); if (o) o.textContent = (+t.value).toFixed(1); const l = document.getElementById("v6-lab"); if (l) l.innerHTML = labHTML(); }
    if (t.id === "v6-faq-q") { S6.faqQ = t.value; const q = t.value.toLowerCase(); const rows = FAQ.map((f, i) => ({ ...f, i })).filter((f) => (S6.faqC === "All" || f.c === S6.faqC) && (!q || (f.q + " " + f.a).toLowerCase().includes(q))); document.getElementById("v6-faq-list").innerHTML = faqList(rows); }
  });
}
