// v5 Coach Surfaces: talk-to-Edge voice assistant, staff rooms with generated reports,
// leaderboards, an assign-your-own AI Workforce, and device surfaces (desktop, tablet, phone, watch).
// Voice uses the browser's own speech recognition and speech synthesis. Answers come from a local
// intent router over the app's data first (instant, offline), then from the backend agent for anything else.
import { SPOKEN, startTour, startFlow } from "../v6/learn.js";
import { YEAR1, FUTURE, VARIANCE } from "../v6/content.js";
import { W } from "../watch.js";
import { briefText } from "../rp/pages_plan.js";

const API = (() => { const b = window.__API_BASE__ || "__PORT_8006__"; const LOCAL = new Set(["localhost", "127.0.0.1"]); return b.startsWith("__PORT_") ? (LOCAL.has(location.hostname) ? "http://localhost:8006" : null) : b.replace(/\/$/, ""); })();

export const V5NAV = [
  { k: "talk", label: "Talk to Edge" },
  { k: "rooms", label: "Rooms & Reports" },
  { k: "lead", label: "Leaderboard" },
  { k: "bots", label: "AI Workforce" },
  { k: "devices", label: "Devices" },
];
export const V5TITLES = {
  talk: ["Talk to Edge", "Speak or type. Edge answers out loud and puts the report on screen"],
  rooms: ["Rooms & Reports", "How the staff uses Edge in the hallway, film room, Monday meeting and selection room"],
  lead: ["Leaderboard", "Portal watch, target board and the AI Workforce, ranked"],
  bots: ["AI Workforce", "Assign AI agents, give them a task, watch them work and hand off"],
  devices: ["Devices", "The same assistant on desktop, tablet, phone and watch"],
};

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const V = {
  ctx: null, state: "idle", interim: "", msgs: [], reports: [], room: "hallway", speak: true, hands: false,
  voices: [], voiceIx: 0, drawer: false, sceneIx: 0, playing: null, votes: {}, leadTab: "watch",
  hired: ["scout", "brief", "film"], runs: [], approvals: [], botTasks: {}, botBusy: {}, botOpen: "scout",
};
const ROOMS = { hallway: "Hallway", film: "Film Room", monday: "Monday Meeting", selection: "Selection Room", gameday: "Game Day" };
const GRPN = { QB: "quarterbacks", RB: "running backs", WR: "receivers", TE: "tight ends", DL: "defensive linemen", LB: "linebackers", DB: "defensive backs" };
const BOARDPOS = { QB: "QB", RB: "RB", WR: "WR", DB: "CB", DL: "EDGE", OT: "OT" };
const P = (x) => Math.round(x * 100) + "%";
const now = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------------- data helpers ----------------
const watch = () => (W.data ? W.data.watch : []);
const topWatch = (g, n = 3) => watch().filter((r) => !g || r.grp === g).slice(0, n);
export const watchTop = (g, n = 3) => topWatch(g, n);
const openNeeds = () => V.ctx.needs().filter((n) => n.gap > 0.5).sort((a, b) => b.gap - a.gap);
const sig = () => W.data && W.data.univariate;

export function contextString() {
  const c = V.ctx, lines = [];
  if (W.data) {
    const u = W.data.univariate, t = W.data.tests[1];
    lines.push(`REAL PUBLIC DATA (CollegeFootballData.com). Signal test on ${t.n} players, ${t.test}: Group of Five top-15% producers entered ${P(u.g5_over.pooled.rate_with)} vs ${P(u.g5_over.pooled.rate_without)} (adjusted odds ${t.odds.g5_over.or}); 500+ miles from home adjusted odds ${t.odds.far.or} (mostly explained by in-state); head-coach change ${t.odds.coach_change.or}x; in-state ${t.odds.in_state.or}x. Ranking skill AUC ${t.auc_all}.`);
    lines.push("Watchlist pattern scores (statistical, not intent): " + Object.keys(GRPN).map((g) => g + ": " + topWatch(g, 3).map((r) => `${r.name} (${r.team}, ${P(r.p)}, production pctl ${Math.round(r.pct * 100)})`).join("; ")).join(" | "));
  }
  lines.push("SAMPLE DATA (synthetic roster): open needs " + openNeeds().map((n) => `${n.pos} gap ${n.gap}`).join(", ") + ".");
  const b = c.board("starter").slice(0, 6);
  lines.push(`SAMPLE DATA (synthetic portal board, ${c.pos()}): ` + b.map((r) => `${r.name} from ${r.from}, low ${P(r.q10)}, mid ${P(r.mean)}, high ${P(r.q90)}`).join("; "));
  lines.push("Calendar: NCAA Division I transfer-window calendar lists the FBS football window as January 4 to 13, 2027 (10 days). Coach's needs assessment due end of November.");
  return lines.join("\n").slice(0, 5800);
}

// ---------------- voice ----------------
function loadVoices() {
  if (!window.speechSynthesis) return;
  const all = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  const nat = (v) => (/natural|neural|online|premium|enhanced/i.test(v.name) ? 0 : /google|samantha|daniel|aria|jenny|guy|ava|allison/i.test(v.name) ? 1 : 2);
  V.voices = (all.length ? all : speechSynthesis.getVoices()).slice().sort((a, b) => nat(a) - nat(b));
}
const PERSONA = { edge: [0, 1.0, 1.0], HC: [1, 0.9, 0.98], GM: [2, 1.0, 1.0], DC: [3, 0.95, 1.0], OC: [4, 1.0, 1.0], DB: [5, 1.0, 1.0], AN: [6, 1.05, 1.02], RD: [7, 1.0, 1.0] };
// Narrator voiceover: every fixed explanation has a pre-recorded studio clip (same narrator as the explainer video).
// Only live, open-ended answers fall back to the browser's own voice.
const VO = { map: null, loading: null, audio: null };
const VO_BASE = new URL("../../media/voice/", import.meta.url).href;
export function voKey(who, text) {
  const s = (who || "edge") + "|" + String(text).replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
  let h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}
function voLoad() { return (VO.loading ||= fetch(VO_BASE + "manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((m) => (VO.map = m))); }
export function hush() { if (VO.audio) { const a = VO.audio; VO.audio = null; a.pause(); } if (window.speechSynthesis) speechSynthesis.cancel(); }
function browserSay(text, who) {
  return new Promise((res) => {
    if (!window.speechSynthesis) return res();
    const u = new SpeechSynthesisUtterance(text.replace(/\[\d+\]/g, ""));
    const [ix, pitch, rate] = PERSONA[who] || PERSONA.edge;
    if (V.voices.length) u.voice = V.voices[(who === "edge" ? V.voiceIx : ix + V.voiceIx) % V.voices.length];
    u.pitch = pitch; u.rate = rate;
    u.onend = u.onerror = () => res();
    speechSynthesis.speak(u);
  });
}
export function say(text, who = "edge") {
  if (window.__voCollect) { window.__voCollect.push([who || "edge", String(text || "")]); return Promise.resolve(); }
  return new Promise(async (res) => {
    if (!V.speak || !text) return res();
    const m = await voLoad(), f = m[voKey(who, text)];
    if (!f) return browserSay(text, who).then(res);
    hush();
    const a = new Audio(VO_BASE + f); VO.audio = a;
    let done = false; const fin = () => { if (done) return; done = true; if (VO.audio === a) VO.audio = null; res(); };
    a.onended = fin; a.onpause = fin; a.onerror = () => { if (done) return; done = true; browserSay(text, who).then(res); };
    a.play().catch(() => { if (done) return; done = true; browserSay(text, who).then(res); });
  });
}
function setState(s) {
  V.state = s;
  document.querySelectorAll(".v5-orb").forEach((o) => { o.dataset.state = s; });
  document.querySelectorAll(".v5-state").forEach((o) => { o.textContent = STATE_TXT[s]; });
  const fab = document.getElementById("v5-fab"); if (fab) fab.dataset.state = s;
}
const STATE_TXT = { idle: "Tap the mic and talk", listening: "Listening…", thinking: "Thinking…", speaking: "Speaking…" };
let rec = null;
export function listen() {
  if (!SR) { V.ctx.toast("Voice input isn't available in this browser. Type instead."); document.getElementById("v5-in")?.focus(); return; }
  if (V.state === "listening") { rec && rec.stop(); return; }
  hush();
  rec = new SR(); rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
  let final = "";
  rec.onresult = (e) => { let t = ""; for (const r of e.results) { if (r.isFinal) final = r[0].transcript; else t += r[0].transcript; } V.interim = final || t; document.querySelectorAll(".v5-interim").forEach((el) => (el.textContent = V.interim)); };
  rec.onerror = (e) => { setState("idle"); if (e.error === "not-allowed" || e.error === "service-not-allowed") V.ctx.toast("Microphone is blocked here. Open the published site or type instead."); };
  rec.onend = () => { const q = (final || V.interim).trim(); V.interim = ""; if (q) ask(q); else setState("idle"); };
  setState("listening");
  try { rec.start(); } catch { setState("idle"); }
}

// ---------------- intent router ----------------
function flowPos(t) {
  const m = [["QB", /quarterback|\bqbs?\b/], ["RB", /running back|\brbs?\b/], ["WR", /receiver|wideout|\bwrs?\b/], ["TE", /tight end|\btes?\b/], ["OT", /offensive tackle|\bots?\b/], ["IOL", /guard|center|interior/], ["EDGE", /edge rush|edge defender|pass rush/], ["DT", /defensive tackle|\bdts?\b|nose/], ["LB", /linebacker|\blbs?\b/], ["CB", /corner|\bcbs?\b/], ["S", /safet/], ["KP", /kicker|punter|specialist/]];
  const h = m.find(([, r]) => r.test(t)); return h ? h[0] : null;
}
function parseGroup(t) {
  if (/quarterback|\bqbs?\b/.test(t)) return "QB";
  if (/running back|\brbs?\b|tailback/.test(t)) return "RB";
  if (/receiver|wideout|\bwrs?\b/.test(t)) return "WR";
  if (/tight end|\btes?\b/.test(t)) return "TE";
  if (/linebacker|\blbs?\b/.test(t)) return "LB";
  if (/corner|safet|defensive back|\bdbs?\b|\bcbs?\b|secondary/.test(t)) return "DB";
  if (/edge|pass rush|d-?line|defensive line|\bdl\b|tackle/.test(t)) return /offensive tackle|\bot\b|left tackle/.test(t) ? "OT" : "DL";
  if (/offensive line|\bot\b|o-?line/.test(t)) return "OT";
  return null;
}
const BOTWORDS = { scout: /scout/, carousel: /carousel|coach(ing)? change|hot seat/, film: /film (bot|agent)|film analyst/, market: /market|nil/, compliance: /compliance|rule/, brief: /brief writer/, fit: /fit scor|\bfit\b/, opponent: /opponent/, verifier: /fact|verify|check (this|that)/ };

async function route(text) {
  const t = text.toLowerCase(), g = parseGroup(t);
  const wantsBot = /\b(send|run|deploy|dispatch|have|get|put)\b.*\b(bot|agent|scout|carousel|compliance|market|opponent|fact|fit)/.test(t);
  if (wantsBot) {
    const id = Object.keys(BOTWORDS).find((k) => BOTWORDS[k].test(t)) || "scout";
    const task = g ? `${BOTS[id].task} Focus: ${GRPN[g] || g}.` : BOTS[id].task;
    if (!V.hired.includes(id)) V.hired.push(id);
    setTimeout(() => runBot(id, task), 50);
    return { text: `Sending ${BOTS[id].name} now${g ? ` on ${GRPN[g] || g}` : ""}. You'll see its steps on the AI Workforce board, and anything that would contact someone waits for your approval.`, report: null, via: "local" };
  }
  if (/ai workforce|workflow|agentic|every position|all (the )?positions|at work\b/.test(t)) { const fp = flowPos(t); setTimeout(() => startFlow(fp), 900); return { text: SPOKEN.flow(fp), via: "local" }; }
  if (/how does (this|it|the system|edge) work|tutorial|guided tour|give me a tour|walk me through|show me around/.test(t)) { setTimeout(() => startTour(0), 1200); return { text: SPOKEN.what() + " I'll start the guided tour now.", via: "local" }; }
  if (/year (two|2|three|3|four|five)|future years|long[- ]term|roadmap|down the road|next year/.test(t)) return { text: SPOKEN.future(), report: { kind: "plan" }, via: "local" };
  if (/this year|year (one|1)\b|timeline|what happens (next|in january|this winter)|before december|plan for the window/.test(t)) return { text: SPOKEN.y1(), report: { kind: "plan" }, via: "local" };
  if (/variance|why (not|can'?t|don'?t) (we |you )?predict|explain the error|program effect|measurement error|reliab|validity/.test(t)) return { text: SPOKEN.variance(), report: { kind: "variance" }, via: "local" };
  if (/what is (this|edge|buckeye edge)|what does (this|it) do/.test(t)) return { text: SPOKEN.what(), via: "local" };
  if (/\b(hi|hello|hey)\b|what can you do|help/.test(t) && t.length < 40) return { text: "I'm Edge. Ask me about roster needs, who might enter the portal at a position, the Monday brief, a film-room prep note, or who we'd pick for a starter versus depth. I can also send an AI Workforce agent to research something, or run a full workflow at any position.", via: "local" };
  if (/leaderboard|who'?s (on )?top|\brankings\b/.test(t) && !/starter|backup|depth|upside/.test(t)) { setTimeout(() => V.ctx.go("lead"), 900); return { text: "Opening the leaderboard. Portal Watch is on top, ranked by pattern score, with the target board and the bots next to it.", via: "local" }; }
  if (/monday|brief|staff meeting|summary of the week/.test(t)) return { text: briefSpoken(), report: { kind: "brief" }, via: "local" };
  if (/film|tape|clips?|cut-?ups?/.test(t)) { await maybePos(g); return { text: filmSpoken(), report: { kind: "film" }, via: "local" }; }
  if (/starter|backup|depth|select|choose|pick|vote|who do we take|board/.test(t)) { await maybePos(g); const mode = /backup|depth|upside/.test(t) ? "backup" : "starter"; return { text: selSpoken(mode), report: { kind: "selection", mode }, via: "local" }; }
  if (/signal|distance|far from home|group of five|g5|overperform/.test(t)) return { text: sigSpoken(), report: { kind: "signals" }, via: "local" };
  if (/might|enter|leav|portal|watch ?list|transfer/.test(t) && !/rule|allowed|when/.test(t)) return { text: watchSpoken(g), report: { kind: "watch", g }, via: "local" };
  if (/need|hole|gap|short|thin|roster/.test(t)) return { text: needsSpoken(), report: { kind: "needs" }, via: "local" };
  return null;
}
async function maybePos(g) { const bp = BOARDPOS[g]; if (bp && bp !== V.ctx.pos()) await V.ctx.setPos(bp); }

function needsSpoken() {
  const o = openNeeds().slice(0, 3);
  return `In the sample roster, our biggest gaps are ${o.map((n) => `${n.pos} at ${n.gap}`).join(", ")}. That's players short of target after expected attrition and signees. The real needs list replaces this when the coach's assessment lands at the end of November. Want me to send the Portal Scout after ${o[0]?.pos || "the top need"}?`;
}
function watchSpoken(g) {
  if (!W.data) return "The watchlist hasn't loaded yet.";
  const rows = topWatch(g, 3);
  return `On the real 2026 rosters, the top pattern scores${g ? ` among ${GRPN[g] || g}` : ""} are ${rows.map((r) => `${r.name} at ${r.team}`).join(", ")}, each around ${P(rows[0].p)}. That's a statistical pattern from public data, not a claim about anyone's plans. ${rows[0].signals.includes("g5_over") ? "They're Group of Five overperformers, which is the signal that held up best." : ""}`;
}
function sigSpoken() {
  const u = sig(), t = W.data.tests[1];
  return `Dan's Group of Five signal is real: those players entered at ${P(u.g5_over.pooled.rate_with)} versus ${P(u.g5_over.pooled.rate_without)}, and it held after controls. Distance from home mostly disappears once in-state is counted. A head-coach change is the biggest signal, about ${t.odds.coach_change.or} times.`;
}
function briefSpoken() { const o = openNeeds().slice(0, 2); return `Draft Monday brief is up. Headlines: the portal window is January fourth through the thirteenth, per the NCAA calendar, our top sample gaps are ${o.map((n) => n.pos).join(" and ")}, and Group of Five overperformers are the watchlist signal to trust. It's a draft; sending needs approval.`; }
function filmSpoken() { const r = V.ctx.board("starter")[0]; return r ? `Film room prep for ${r.name}, ${r.pos} from ${r.from}, sample data. His film grade is ${r.film ?? "not graded"} and his floor estimate is ${P(r.q10)}. I've listed the clip types to pull and three questions for the position coach.` : "No player is selected."; }
function selSpoken(mode) { const b = V.ctx.board(mode).slice(0, 3); return `For ${mode === "starter" ? "a starter, ranked by the safe low end" : "depth and upside, ranked by the high end"} at ${V.ctx.pos()}, the board says ${b.map((r) => `${r.name} at ${P(mode === "starter" ? r.q10 : r.q90)}`).join(", ")}. Sample players. The staff vote decides; I just keep score.`; }

export async function ask(text) {
  const c = V.ctx;
  V.msgs.push({ who: "coach", text, t: now(), room: V.room });
  setState("thinking"); paint();
  let r = await route(text);
  if (!r) {
    if (!API) r = { text: "I can answer that with live research once the backend is connected. On this preview I can still do needs, the watchlist, the Monday brief, film prep and the selection board.", via: "offline" };
    else {
      try {
        const res = await fetch(API + "/api/v5/talk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, screen: "talk", room: ROOMS[V.room], context: contextString() }) });
        const j = await res.json();
        if (!res.ok) throw new Error(j.detail || res.status);
        r = { text: j.answer || "No answer came back.", sources: j.sources, steps: j.steps, via: "agent", ms: j.ms };
      } catch (e) { r = { text: `Live research isn't reachable right now (${String(e.message || e).slice(0, 80)}). Try a needs, watchlist, brief, film or selection question.`, via: "offline" }; }
    }
  }
  const m = { who: "edge", text: r.text, t: now(), via: r.via, sources: r.sources, steps: r.steps, ms: r.ms, room: V.room };
  if (r.report) { m.report = r.report; V.reports.unshift({ ...r.report, t: now(), room: V.room, q: text }); V.reports = V.reports.slice(0, 8); }
  V.msgs.push(m);
  c.log("edge.talk", `Coach asked Edge: ${text.slice(0, 80)}`, { room: ROOMS[V.room] }, { via: r.via, report: r.report?.kind || null }, r.via === "agent" ? "observed" : "estimate");
  c.render(); paint();
  setState("speaking");
  await say(r.text);
  setState("idle");
  if (V.hands && SR) setTimeout(listen, 400);
}

// ---------------- reports ----------------
export function reportHTML(rep) {
  const c = V.ctx;
  const head = (title, sub, tag) => `<div class="v5-rep-h"><div><div class="v5-rep-k">${esc(ROOMS[rep.room] || "Report")} · ${esc(rep.t || now())}</div><h3>${title}</h3><p>${sub}</p></div>${tag}</div>`;
  const real = `<span class="badge b-ok">Real public data</span>`, sample = `<span class="badge b-bad">Sample data</span>`;
  const plan6 = `<span class="badge b-ok">From the recorded calls</span>`;
  if (rep.kind === "plan") return head("The plan: this year and beyond", "Approvals first; anything unsigned stays TBD", plan6) +
    `<ol class="v6-mini-tl">${YEAR1.map((p) => `<li><b>${esc(p.when)}</b> · ${esc(p.title)}<span class="dim"> · ${esc(p.tag)}</span></li>`).join("")}${FUTURE.map((f) => `<li><b>${esc(f.yr)}</b> · ${esc(f.items[0])}<span class="dim"> · ${esc(f.when)}</span></li>`).join("")}</ol><button class="btn sm" data-go="plan">Open the full plan →</button>`;
  if (rep.kind === "variance") return head("Why not predict yet", "Four sources of variance", plan6) +
    `<div class="v6-mini-v">${VARIANCE.map((v) => `<div><b>${v.n}. ${esc(v.title)}</b><span class="dim">${esc(v.fix)}</span></div>`).join("")}</div><button class="btn sm" data-go="variance">Try the variance demo →</button>`;
  if (rep.kind === "needs") {
    const rows = c.needs().sort((a, b) => b.gap - a.gap);
    const mapG = { QB: "QB", RB: "RB", WR: "WR", TE: "TE", OT: null, IOL: null, EDGE: "DL", DT: "DL", LB: "LB", CB: "DB", S: "DB" };
    return head("Roster Needs", "Gap = target minus projected roster after attrition and signees", sample) +
      `<div class="v5-bars">${rows.map((n) => `<div class="v5-bar"><span>${n.pos}</span><i style="--w:${Math.max(0, Math.min(100, (n.gap / 6) * 100))}%" class="${n.gap > 0.5 ? "hot" : ""}"></i><b>${n.gap > 0 ? "+" : ""}${n.gap}</b></div>`).join("")}</div>
      <div class="v5-rep-sec">Who might fill it · real watchlist</div>
      ${openNeeds().slice(0, 3).map((n) => { const g = mapG[n.pos]; const w = g ? topWatch(g, 2) : []; return `<div class="v5-line"><b>${n.pos}</b> ${w.length ? w.map((r) => `${esc(r.name)} <span class="dim">${esc(r.team)} · ${P(r.p)}</span>`).join(" · ") : `<span class="dim">no watchlist group for this position yet</span>`}</div>`; }).join("")}`;
  }
  if (rep.kind === "watch") {
    const rows = topWatch(rep.g, 6);
    return head(`Might Enter${rep.g ? " · " + (GRPN[rep.g] || rep.g) : ""}`, "Pattern score from public data, not a report on intent", real) +
      `<table class="t v5-t"><tbody>${rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(r.name)}</b><div class="dim">${esc(r.team)} · ${esc(r.grp)}</div></td><td class="n">${Math.round(r.pct * 100)}<div class="dim">prod.</div></td><td class="n"><b>${P(r.p)}</b></td></tr>`).join("")}</tbody></table>`;
  }
  if (rep.kind === "signals") {
    const u = sig(), t = W.data.tests[1];
    return head("Dan's Signals · Verdict", `${t.n.toLocaleString()} players, ${esc(t.test)}`, real) +
      `<div class="v5-verdicts"><div class="ok"><b>Group of Five overperformer</b><span>${P(u.g5_over.pooled.rate_with)} vs ${P(u.g5_over.pooled.rate_without)} · adjusted ${t.odds.g5_over.or}×</span><em>More likely to enter</em></div>
      <div class="even"><b>500+ miles from home</b><span>${P(u.far.pooled.rate_with)} vs ${P(u.far.pooled.rate_without)} · adjusted ${t.odds.far.or}×</span><em>About even once in-state is counted</em></div>
      <div class="ok"><b>Head-coach change</b><span>adjusted ${t.odds.coach_change.or}×</span><em>Biggest signal</em></div></div>`;
  }
  if (rep.kind === "brief") {
    const o = openNeeds().slice(0, 4), u = sig();
    return head("Monday Staff Brief · Draft", "Requires approval before it goes to the staff list", `<span class="badge b-hypothesis">Draft</span>`) +
      `<div class="v5-brief"><div><h4>What changed</h4><p>The NCAA calendar lists the portal window as January 4 – 13, 2027 (10 days). Group of Five overperformance held up as an entry signal (${u ? P(u.g5_over.pooled.rate_with) + " vs " + P(u.g5_over.pooled.rate_without) : "—"}).</p></div>
      <div><h4>Portal watch</h4><p>${["QB", "WR", "DB"].map((g) => `${GRPN[g]}: ${topWatch(g, 2).map((r) => esc(r.name)).join(", ")}`).join(". ")}. Pattern scores, not reports.</p></div>
      <div><h4>Needs (sample)</h4><p>${o.map((n) => `${n.pos} +${n.gap}`).join(" · ")}</p></div>
      <div><h4>Decisions due</h4><p>Coach's needs assessment by end of November. Starter-or-depth call at each open need before the window opens.</p></div>
      <div><h4>Risks</h4><p>Name-matched portal data undercounts entries. Class year is missing from the source.</p></div></div>
      <details class="v5-raw"><summary>Full text draft (v3 brief)</summary><pre>${esc(briefText())}</pre></details>
      <div class="row-btns"><button class="btn sm primary" data-v5="approve-brief">Request approval to send</button></div>`;
  }
  if (rep.kind === "film") {
    const r = c.board("starter")[0]; if (!r) return "";
    const CLIPS = { CB: ["Press at the line", "Off-man transitions", "Ball skills at the catch point", "Run support"], WR: ["Release vs press", "Contested catches", "Route stems at depth", "Run after catch"], EDGE: ["First step / get-off", "Counter moves", "Run fits", "Effort plays"], OT: ["Pass set vs speed", "Hand placement", "Run-game drive", "Recovery"], RB: ["Vision / cutback", "Pass protection", "Yards after contact", "Routes"], QB: ["Progressions", "Pocket movement", "Third down", "Off-platform throws"] };
    return head(`Film Room · ${esc(r.name)}`, `${esc(r.pos)} · ${esc(r.from)} · ${esc(r.jump || "")}`, sample) +
      `<div class="v5-film"><div class="v5-film-screen" aria-hidden="true"><div class="v5-film-play">▶</div><div class="v5-film-tl">${(CLIPS[r.pos] || CLIPS.CB).map((k, i) => `<span style="left:${10 + i * 22}%">${i + 1}</span>`).join("")}</div></div>
      <div class="v5-film-side"><div class="v5-kv"><span>Film grade</span><b>${r.film ?? "—"}</b></div><div class="v5-kv"><span>Floor / mid / ceiling</span><b>${P(r.q10)} / ${P(r.mean)} / ${P(r.q90)}</b></div><div class="v5-kv"><span>Size</span><b>${r.height ? Math.floor(r.height / 12) + "'" + (r.height % 12) + '"' : "—"} · ${r.weight || "—"} lb</b></div><div class="v5-kv"><span>Snap share last year</span><b>${r.snap != null ? P(r.snap) : "—"}</b></div></div></div>
      <div class="v5-rep-sec">Clip types to pull</div><div>${(CLIPS[r.pos] || CLIPS.CB).map((k, i) => `<span class="rp-tag">${i + 1} · ${k}</span>`).join(" ")}</div>
      <div class="v5-rep-sec">Questions for the position coach</div><ol class="v5-ol"><li>Does the tape match the ${r.film ?? "—"} film grade against Power 4 speed?</li><li>Is the low end (${P(r.q10)}) a scheme problem or a player problem?</li><li>What would make you move him from depth to starter?</li></ol>`;
  }
  if (rep.kind === "selection") {
    const b = c.board(rep.mode || "starter").slice(0, 6);
    return head(`Selection Room · ${esc(c.pos())}`, rep.mode === "backup" ? "Ranked for depth and upside (90th percentile)" : "Ranked for a starter (10th percentile)", sample) +
      `<table class="t v5-t"><thead><tr><th>#</th><th>Player</th><th class="n">Low</th><th class="n">High</th><th class="n">Votes</th><th></th></tr></thead><tbody>${b.map((r, i) => { const v = V.votes[r.id] || {}; const yes = Object.values(v).filter((x) => x === 1).length, no = Object.values(v).filter((x) => x === -1).length; return `<tr><td class="n">${i + 1}</td><td><b>${esc(r.name)}</b><div class="dim">${esc(r.from)}</div></td><td class="n">${P(r.q10)}</td><td class="n">${P(r.q90)}</td><td class="n">${yes}–${no}</td><td><button class="btn sm" data-v5="vote" data-id="${r.id}" data-v="1" aria-label="Vote yes on ${esc(r.name)}">Yes</button> <button class="btn sm" data-v5="vote" data-id="${r.id}" data-v="-1" aria-label="Vote no on ${esc(r.name)}">No</button></td></tr>`; }).join("")}</tbody></table>
      <p class="dim" style="font-size:11px;margin-top:6px">Edge ranks and keeps score. The staff vote decides. Your vote counts as the head coach's.</p>`;
  }
  return "";
}

// ---------------- talk surface ----------------
const CHIPS = ["What are our biggest roster needs?", "Who might enter at receiver?", "Give me the Monday brief", "Film room prep on our top corner", "Who do we take for a starter?", "Did Dan's signals hold up?", "Send the carousel bot", "What's the latest on the coaching carousel?"];
function orb(size = "") { return `<button class="v5-orb ${size}" data-state="${V.state}" data-v5="mic" aria-label="Talk to Edge"><span class="r1"></span><span class="r2"></span><span class="r3"></span><span class="core"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span><span class="eq"><i></i><i></i><i></i><i></i><i></i></span></button>`; }
function msgsHTML(n = 40) {
  const list = V.msgs.slice(-n);
  if (!list.length) return `<div class="v5-msg edge"><div class="v5-av">E</div><div><div class="v5-bub">I'm Edge, your staff's voice analyst. I can pull roster needs, the portal watchlist, the Monday brief, film-room prep and the selection board, or send an AI Workforce agent to research something. What do you want to dig into?</div><div class="v5-meta">${now()}</div></div></div>`;
  return list.map((m) => `<div class="v5-msg ${m.who === "coach" ? "me" : "edge"}">${m.who === "coach" ? "" : `<div class="v5-av">E</div>`}<div><div class="v5-bub">${esc(m.text)}</div><div class="v5-meta">${m.t}${m.who !== "coach" ? ` · ${m.via === "agent" ? `live research${m.ms ? ` · ${(m.ms / 1000).toFixed(1)}s` : ""}` : m.via === "offline" ? "offline" : "from app data"}` : ""}${m.who !== "coach" ? ` · <button class="v5-link" data-v5="replay" data-i="${V.msgs.indexOf(m)}">Play</button>` : ""}</div>${m.sources && m.sources.length ? `<div class="v5-src">${m.sources.slice(0, 4).map((s, i) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">[${i + 1}] ${esc((s.title || s.url).slice(0, 60))}</a>`).join("")}</div>` : ""}</div></div>`).join("");
}
function talkCore(compact) {
  return `<div class="v5-talk ${compact ? "compact" : ""}">
    <div class="v5-stage">${orb(compact ? "sm" : "")}<div class="v5-state">${STATE_TXT[V.state]}</div><div class="v5-interim">${esc(V.interim)}</div></div>
    <div class="v5-msgs" id="${compact ? "v5-msgs-d" : "v5-msgs"}">${msgsHTML(compact ? 6 : 40)}</div>
    <div class="v5-chips">${CHIPS.slice(0, compact ? 4 : 8).map((c) => `<button class="v5-chip" data-v5="chip" data-q="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <form class="v5-input" data-v5form="1"><input id="${compact ? "v5-in-d" : "v5-in"}" placeholder="Type or tap the mic…" aria-label="Message Edge" autocomplete="off"/><button class="btn primary" type="submit">Send</button></form>
  </div>`;
}
export function pageTalk() {
  const rooms = Object.entries(ROOMS).map(([k, l]) => `<button class="btn sm ${V.room === k ? "primary" : ""}" data-v5="room" data-id="${k}">${l}</button>`).join("");
  const voiceOpts = V.voices.slice(0, 12).map((v, i) => `<option value="${i}" ${i === V.voiceIx ? "selected" : ""}>${esc(v.name.slice(0, 28))}</option>`).join("");
  return `<div class="v5-wrap">
    <section class="v5-panel">
      <div class="v5-top"><div class="seg">${rooms}</div><div class="v5-opts"><label><input type="checkbox" data-v5="speak" ${V.speak ? "checked" : ""}/> Talk back</label><label><input type="checkbox" data-v5="hands" ${V.hands ? "checked" : ""}/> Hands-free</label>${voiceOpts ? `<select data-v5="voice" aria-label="Edge voice">${voiceOpts}</select>` : ""}</div></div>
      ${talkCore(false)}
      <p class="dim v5-fine">${SR ? "Voice uses your browser's speech recognition; the mic needs permission. In the in-app preview the mic may be blocked, so open the published site or type." : "This browser has no speech recognition. Typing works the same way, and answers are still read aloud."} Questions about needs, the watchlist, brief, film and selection are answered instantly from app data; anything else goes to live research${API ? "" : " when the backend is connected"}.</p>
    </section>
    <section class="v5-reports"><div class="v5-rep-title">On screen <span class="dim">· reports Edge built from the conversation</span></div>
      ${V.reports.length ? V.reports.map((r) => `<article class="v5-rep">${reportHTML(r)}</article>`).join("") : `<article class="v5-rep v5-empty"><h3>Reports land here</h3><p>Say "what are our biggest needs" or tap a suggestion. Each answer that has a report puts it on this side so the staff can see it on the big screen while Edge talks.</p></article>`}
    </section></div>`;
}

// ---------------- rooms (example conversations -> reports) ----------------
function scenes() {
  const c = V.ctx, o = openNeeds(), b = c.board("starter"), wr = topWatch("WR", 2), db = topWatch("DB", 2), u = sig();
  return [
    { k: "hallway", dev: "Phone", title: "Hallway · 40 seconds between meetings", rep: { kind: "needs", room: "hallway" }, lines: [
      ["HC", "Edge, where are we thinnest for next year?"],
      ["edge", needsSpoken()],
      ["HC", `Yeah. Send the scout on ${o[0]?.pos || "receivers"} and put it in Monday's brief.`],
      ["edge", "Portal Scout is running. I'll add its findings to the Monday draft for your approval."]] },
    { k: "film", dev: "Tablet", title: "Film Room · position coach and analyst", rep: { kind: "film", room: "film" }, lines: [
      ["DB", `Pull up ${b[0]?.name || "our top corner"}. What am I watching for?`],
      ["edge", filmSpoken()],
      ["AN", `His floor is ${b[0] ? P(b[0].q10) : "—"}. That's the number I'd argue about.`],
      ["DB", "Tag every press rep against a top-40 opponent. If he holds up, he's a starter."],
      ["edge", "Tagged. I'll queue the press-coverage cut-up and note your call next to his grade."]] },
    { k: "monday", dev: "Desktop", title: "Monday Meeting · GM and recruiting director", rep: { kind: "brief", room: "monday" }, lines: [
      ["GM", "Edge, give us the week in a minute."],
      ["edge", briefSpoken()],
      ["RD", `Who's on the receiver watchlist right now?`],
      ["edge", `Top pattern scores at receiver are ${wr.map((r) => `${r.name} at ${r.team}`).join(" and ")}. Public-data pattern, not their plans.`],
      ["GM", "Send it to the staff list once I approve."]] },
    { k: "selection", dev: "Big screen", title: "Selection Room · the decision", rep: { kind: "selection", room: "selection", mode: "starter" }, lines: [
      ["HC", "We need a starter, not a project. Who's safest?"],
      ["edge", selSpoken("starter")],
      ["DC", `I like ${b[1]?.name || "the second guy"}. Higher ceiling.`],
      ["edge", `${b[1] ? `${b[1].name}'s high end is ${P(b[1].q90)}; his low end is ${P(b[1].q10)}.` : ""} If you want upside instead, say "rank for depth" and I'll re-sort.`],
      ["HC", "Starter. Put it to a vote."]] },
    { k: "gameday", dev: "Watch", title: "Game Day · a tap on the wrist", rep: { kind: "signals", room: "gameday" }, lines: [
      ["edge", `Heads up: a head-coach change is the strongest portal signal we measured, about ${W.data ? W.data.tests[1].odds.coach_change.or : "1.6"} times. ${db[0] ? `${db[0].name} at ${db[0].team} is the top defensive back on the watchlist.` : ""}`],
      ["HC", "Save it for Sunday."],
      ["edge", "Saved to Sunday's queue. No alerts until the final whistle."]] },
  ];
}
const WHO = { HC: "Head Coach", GM: "General Manager", DC: "Def. Coordinator", OC: "Off. Coordinator", DB: "DB Coach", AN: "Analyst", RD: "Recruiting Director", edge: "Edge" };
export function pageRooms() {
  const sc = scenes(), s = sc[V.sceneIx] || sc[0];
  return `<div class="callout fz"><b>How the staff would actually use it.</b> Five short scenes, each on the device that fits the room. Press Play to hear them, with a different synthetic voice for each person. The report each scene produces is built live from the app's data. Scenes are example conversations; the people are roles, not real staff.</div>
  <div class="v5-scenes">${sc.map((x, i) => `<button class="v5-scene ${i === V.sceneIx ? "on" : ""}" data-v5="scene" data-i="${i}"><span>${esc(x.dev)}</span><b>${esc(x.title.split(" · ")[0])}</b></button>`).join("")}</div>
  <div class="v5-wrap"><section class="v5-panel"><div class="v5-top"><div><div class="v5-rep-k">${esc(s.dev)}</div><h3 style="margin:2px 0 0">${esc(s.title)}</h3></div><button class="btn primary sm" data-v5="play">${V.playing === s.k ? "Stop" : "Play scene"}</button></div>
    <div class="v5-msgs">${s.lines.map(([w, t], i) => `<div class="v5-msg ${w === "edge" ? "edge" : "staff"} ${V.playing === s.k && V.playLine === i ? "live" : ""}"><div class="v5-av ${w === "edge" ? "" : "st"}">${w === "edge" ? "E" : w}</div><div><div class="v5-who">${WHO[w]}</div><div class="v5-bub">${esc(t)}</div></div></div>`).join("")}</div></section>
    <section class="v5-reports"><div class="v5-rep-title">Report this scene produces</div><article class="v5-rep">${reportHTML({ ...s.rep, t: "Example" })}</article></section></div>`;
}
async function playScene() {
  const s = scenes()[V.sceneIx];
  if (V.playing) { V.playing = null; hush(); V.ctx.render(); return; }
  V.playing = s.k; const was = V.speak; V.speak = true;
  for (let i = 0; i < s.lines.length && V.playing === s.k; i++) { V.playLine = i; V.ctx.render(); await say(s.lines[i][1], s.lines[i][0]); if (false) await new Promise((r) => setTimeout(r, 900)); }
  V.speak = was; V.playing = null; V.playLine = null; V.ctx.render();
}

// ---------------- leaderboard ----------------
export function pageLead() {
  const tabs = [["watch", "Portal Watch · real"], ["targets", "Target Board · sample"], ["bots", "AI Workforce"]];
  const tabH = `<div class="seg">${tabs.map(([k, l]) => `<button class="btn sm ${V.leadTab === k ? "primary" : ""}" data-v5="lead" data-id="${k}">${l}</button>`).join("")}</div>`;
  let body = "";
  if (V.leadTab === "watch") {
    const rows = watch().slice().sort((a, b) => b.p - a.p || b.pct - a.pct).slice(0, 25);
    body = `<section class="card card-pad"><div class="card-h"><div><h3>Most likely to enter · top 25, all groups</h3><p>Pattern score from the model tested on the last two portal classes. Ties broken by production. Statistical, not a report on intent.</p></div><div class="sp"></div><span class="badge b-ok">Real public data</span></div>
      <ol class="v5-lb">${rows.map((r, i) => `<li><span class="v5-rank ${i < 3 ? "top" : ""}">${i + 1}</span><span class="v5-lb-n"><b>${esc(r.name)}</b><span class="dim">${esc(r.team)} · ${esc(r.grp)} · ${esc(r.conf)}</span></span><span class="v5-lb-bar"><i style="--w:${r.pct * 100}%"></i></span><span class="v5-lb-v">${P(r.p)}<span class="dim">prod ${Math.round(r.pct * 100)}</span></span></li>`).join("")}</ol></section>`;
  } else if (V.leadTab === "targets") {
    const rows = V.ctx.board("starter").map((r) => { const v = V.votes[r.id] || {}; const net = Object.values(v).reduce((a, b) => a + b, 0); return { ...r, net, score: r.q10 * 100 + net * 5 }; }).sort((a, b) => b.score - a.score).slice(0, 15);
    body = `<section class="card card-pad"><div class="card-h"><div><h3>Target board · ${esc(V.ctx.pos())}</h3><p>Starter floor (10th percentile) plus staff votes from the Selection Room (each net vote = 5 points). Change position at the top of the screen.</p></div><div class="sp"></div><span class="badge b-bad">Sample players</span></div>
      <ol class="v5-lb">${rows.map((r, i) => `<li><span class="v5-rank ${i < 3 ? "top" : ""}">${i + 1}</span><span class="v5-lb-n"><b>${esc(r.name)}</b><span class="dim">${esc(r.from)} · ${r.need ? "open need" : "covered"}</span></span><span class="v5-lb-bar"><i style="--w:${r.q10 * 100}%"></i></span><span class="v5-lb-v">${Math.round(r.score)}<span class="dim">votes ${r.net >= 0 ? "+" : ""}${r.net}</span></span></li>`).join("")}</ol></section>`;
  } else {
    const by = {}; V.runs.forEach((r) => { const b = (by[r.bot] = by[r.bot] || { runs: 0, src: 0, ok: 0, ms: 0 }); b.runs++; b.src += (r.sources || []).length; b.ok += r.ok ? 1 : 0; b.ms += r.ms || 0; });
    const rows = Object.entries(BOTS).map(([k, b]) => ({ k, ...b, ...(by[k] || { runs: 0, src: 0, ok: 0, ms: 0 }) })).sort((a, b) => b.ok - a.ok || b.src - a.src);
    body = `<section class="card card-pad"><div class="card-h"><div><h3>AI Workforce · this session</h3><p>Completed runs, sources cited and average time. Counts start at zero and reset when the page reloads.</p></div></div>
      <ol class="v5-lb">${rows.map((r, i) => `<li><span class="v5-rank ${i < 3 && r.ok ? "top" : ""}">${i + 1}</span><span class="v5-lb-n"><b>${esc(r.name)}</b><span class="dim">${V.hired.includes(r.k) ? "assigned" : "in pool"}</span></span><span class="v5-lb-bar"><i style="--w:${Math.min(100, r.src * 8)}%"></i></span><span class="v5-lb-v">${r.ok}<span class="dim">runs · ${r.src} sources${r.runs ? ` · ${((r.ms / r.runs) / 1000).toFixed(0)}s avg` : ""}</span></span></li>`).join("")}</ol></section>`;
  }
  return tabH + body;
}

// ---------------- AI Workforce ----------------
export const BOTS = {
  scout: { name: "Portal Scout", mono: "PS", hue: 352, role: "Finds public reporting on players who may enter or have entered the portal, by position and need.", reads: "Web search · watchlist · needs", task: "Find current public reporting on players likely to enter the January portal at our top open need, with dates.", guard: "Labels speculation as reported. Never contacts players." },
  carousel: { name: "Carousel Watcher", mono: "CW", hue: 28, role: "Tracks head-coach and coordinator changes and which rosters are exposed.", reads: "Web search · coaching news", task: "List head-coach changes and hot-seat reporting from the last two weeks and the rosters most exposed to departures.", guard: "Coach change is our strongest measured signal (about 1.6×)." },
  film: { name: "Film Analyst", mono: "FA", hue: 210, role: "Writes film-room prep: what to watch, clip types to pull, questions for the coach.", reads: "Board player · grades · public game notes", task: "Write a film-room prep note for our top-ranked player at the current position.", guard: "Never invents play counts or grades." },
  market: { name: "NIL Market Analyst", mono: "NM", hue: 140, role: "Summarizes published transfer-market ranges by position group.", reads: "Web search · published reports", task: "Summarize public reporting on transfer-market pricing by position group this cycle.", guard: "Published ranges only, never an individual athlete's figures." },
  compliance: { name: "Compliance Checker", mono: "CC", hue: 265, role: "Checks an action against current NCAA transfer and contact rules.", reads: "Official NCAA sources", task: "Before the January window opens, what contact with players who have not entered the portal is allowed?", guard: "Anything unclear goes to the compliance office." },
  brief: { name: "Brief Writer", mono: "BW", hue: 45, role: "Turns the week's data into the Monday staff brief.", reads: "Watchlist · needs · signal test · agent findings", task: "Write this week's Monday staff brief from the context.", guard: "Draft only. Sending needs approval." },
  opponent: { name: "Opponent Intel", mono: "OI", hue: 190, role: "Summarizes an opponent's roster changes and school-reported availability.", reads: "Web search · school releases", task: "Summarize recent public reporting on our next opponent's roster changes and availability.", guard: "School-reported availability only." },
  fit: { name: "Fit Scorer", mono: "FS", hue: 100, role: "Compares a player with the three ideal players the staff named at his position and shows every factor and weight.", reads: "Board · staff ideal profiles · grades", task: "Compare our top-ranked player at the current position with the staff's three ideal profiles, factor by factor, with weights.", guard: "Shows every weight. Uses only staff-defined ideals." },
  verifier: { name: "Fact Checker", mono: "FC", hue: 300, role: "Checks claims against current public sources: confirmed, contradicted or unverified.", reads: "Web search", task: "Check: the January 2027 FBS football transfer portal window runs January 4 to 13 and is 10 days long.", guard: "Shows its sources for every verdict." },
};
function offlineReport(id) {
  const c = V.ctx;
  if (id === "brief") return briefText();
  if (id === "film") { const r = c.board("starter")[0]; return r ? `Film prep: ${r.name} (${r.pos}, ${r.from}, sample). Film grade ${r.film ?? "—"}; floor ${P(r.q10)}, ceiling ${P(r.q90)}. Pull: first five snaps of each half, every third-down rep, every rep against a top-40 opponent. Ask: does the floor reflect scheme or player?` : "No player on the board."; }
  if (id === "scout") { const n = openNeeds()[0]; return `Offline draft from the real watchlist. Top need (sample): ${n ? n.pos : "—"}. Highest pattern scores: ${Object.keys(GRPN).slice(0, 4).map((g) => `${GRPN[g]}: ${topWatch(g, 2).map((r) => `${r.name} (${r.team})`).join(", ")}`).join("; ")}. Live web research needs the backend.`; }
  return "This agent needs live research. Connect the backend (published site) to run it.";
}
export async function runBot(id, task) {
  const c = V.ctx, b = BOTS[id]; if (!b || V.botBusy[id]) return;
  const run = { bot: id, task, t: now(), steps: [{ k: "plan", d: `Read context: watchlist (${watch().length}), needs (${c.needs().length}), board (${c.board("starter").length})` }], status: "running" };
  V.runs.unshift(run); V.botBusy[id] = run; c.render();
  const t0 = performance.now();
  try {
    if (!API) throw new Error("offline");
    run.steps.push({ k: "agent", d: "Sent to research agent with web search" }); c.render();
    const res = await fetch(API + "/api/v5/bot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bot: id, task, context: contextString() }) });
    const j = await res.json(); if (!res.ok || j.error) throw new Error(j.detail || j.error || res.status);
    (j.steps || []).forEach((s) => run.steps.push({ k: s.kind, d: s.detail }));
    Object.assign(run, { report: j.report, sources: j.sources, ms: j.ms, ok: true, status: "done", via: "live" });
  } catch (e) {
    Object.assign(run, { report: offlineReport(id), sources: [], ms: Math.round(performance.now() - t0), ok: id === "brief" || id === "film" || id === "scout", status: "done", via: "offline", note: String(e.message || e) === "offline" ? "Backend not connected: offline draft from app data." : `Live research failed (${String(e.message || e).slice(0, 60)}): offline draft.` });
  }
  const m = /needs approval[:\s]*([\s\S]{0,400})/i.exec(run.report || "");
  const ask = m ? m[1].replace(/[*_#]/g, "").trim() : "";
  const none = !ask || /^(none|n\/a|no outward|nothing)\b/i.test(ask);
  if (m && !none) m[1] = ask;
  if (id === "brief" || (m && !none)) V.approvals.unshift({ bot: id, what: id === "brief" ? "Send the Monday brief to the staff list" : m[1].split("\n").filter(Boolean)[0]?.slice(0, 160) || "Outward action", t: now(), state: "pending" });
  delete V.botBusy[id];
  c.log("bot.run", `${b.name}: ${task.slice(0, 80)}`, { bot: id }, { via: run.via, sources: (run.sources || []).length }, run.via === "live" ? "observed" : "estimate");
  c.toast(`${b.name} finished`); c.render();
}
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^#+\s*(.+)$/gm, "<b>$1</b>").replace(/\n/g, "<br/>");
export function pageBots() {
  const card = (id) => { const b = BOTS[id], on = V.hired.includes(id); return `<div class="v5-bot ${on ? "on" : ""}" style="--h:${b.hue}"><div class="v5-bot-av">${b.mono}</div><div class="v5-bot-b"><b>${b.name}</b><p>${b.role}</p><div class="dim" style="font-size:11px">Reads: ${b.reads}</div><div class="dim" style="font-size:11px">Guardrail: ${b.guard}</div></div><button class="btn sm ${on ? "" : "primary"}" data-v5="hire" data-id="${id}">${on ? "Assigned ✓" : "Assign"}</button></div>`; };
  const mine = V.hired.map((id) => { const b = BOTS[id], busy = V.botBusy[id], last = V.runs.find((r) => r.bot === id); const open = V.botOpen === id; return `<article class="v5-mine ${open ? "open" : ""}" style="--h:${b.hue}"><button class="v5-mine-h" data-v5="open" data-id="${id}" aria-expanded="${open}"><span class="v5-bot-av sm">${b.mono}</span><b>${b.name}</b><span class="v5-pill ${busy ? "run" : last ? "done" : ""}">${busy ? "Working…" : last ? `Done ${last.t}` : "Ready"}</span></button>
    ${open ? `<div class="v5-mine-b"><label class="dim" for="bt-${id}" style="font-size:11px">Task</label><textarea id="bt-${id}" data-bt="${id}" rows="2">${esc(V.botTasks[id] || b.task)}</textarea><div class="row-btns"><button class="btn primary sm" data-v5="run" data-id="${id}" ${busy ? "disabled" : ""}>${busy ? "Working…" : "Send it"}</button><button class="btn sm" data-v5="fire" data-id="${id}">Unassign</button></div>
      ${last ? `<div class="v5-steps">${last.steps.map((s) => `<div><span>${esc(s.k)}</span>${esc(String(s.d || "").slice(0, 120))}</div>`).join("")}${last.status === "running" ? `<div class="pulse"><span>…</span>working</div>` : ""}</div>
      ${last.report ? `<div class="v5-out">${last.note ? `<div class="callout sim" style="margin-bottom:8px">${esc(last.note)}</div>` : ""}<div class="v5-out-t">${md(last.report)}</div>${(last.sources || []).length ? `<div class="v5-src">${last.sources.map((s, i) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">[${i + 1}] ${esc((s.title || s.url).slice(0, 70))}</a>`).join("")}</div>` : ""}</div>` : ""}` : ""}</div>` : ""}</article>`; }).join("");
  const appr = V.approvals.length ? V.approvals.map((a, i) => `<div class="v5-appr"><div><b>${esc(BOTS[a.bot].name)}</b> wants to: ${esc(a.what)}<div class="dim" style="font-size:11px">${a.t} · ${a.state}</div></div>${a.state === "pending" ? `<div><button class="btn sm primary" data-v5="appr" data-i="${i}" data-v="approved">Approve</button> <button class="btn sm" data-v5="appr" data-i="${i}" data-v="declined">Decline</button></div>` : ""}</div>`).join("") : `<p class="dim" style="font-size:12px">Nothing waiting. Any agent step that would contact a person, post or send lands here first.</p>`;
  return `<div class="callout fz"><b>Your AI Workforce.</b> Assign agents from the pool, give each a task in plain words (or tell Edge "send the scout on corners"), and watch the steps as they work. Agents read the same data you see, research the public web and hand results to each other. They never contact anyone: outward actions wait in the approval queue, and approving here only records the decision in this demo.</div>
  <div class="v5-wrap"><section class="v5-panel"><div class="v5-top"><h3 style="margin:0">Assigned agents · ${V.hired.length}</h3><button class="btn sm" data-v5="runall" ${!V.hired.length ? "disabled" : ""}>Run all assigned</button></div>${mine || `<p class="dim">No agents assigned yet.</p>`}
    <h3 style="margin:18px 0 8px">Approval queue</h3>${appr}</section>
    <section class="v5-reports"><div class="v5-rep-title">Workforce pool · ${Object.keys(BOTS).length} agents</div><div class="v5-pool">${Object.keys(BOTS).map(card).join("")}</div>
    <p class="dim" style="font-size:11px">Scheduled runs (every Monday at 6 AM, every morning during the window) are TBD and would need approval. In this version, agents run when you send them or when you start a workflow.</p></section></div>`;
}

// ---------------- devices ----------------
export function pageDevices() {
  const c = V.ctx, o = openNeeds().slice(0, 3), last = V.msgs.filter((m) => m.who === "edge").slice(-1)[0], b = c.board("starter")[0], w = topWatch(null, 3);
  const pendings = V.approvals.filter((a) => a.state === "pending").length;
  return `<div class="callout fz"><b>One assistant, four surfaces.</b> The same Edge and the same data, shaped for the room: the big screen in the selection room, a tablet in the film room, a phone in the hallway, and a watch on the sideline. Each frame below is live: tap the mics.</div>
  <div class="v5-devs">
    <figure class="v5-dev desk"><div class="v5-scr"><div class="v5-mini-h"><b>BUCKEYE EDGE</b><span>Selection Room</span></div><div class="v5-mini-k"><div><span>Open needs</span><b>${o.length ? openNeeds().length : 0}</b></div><div><span>Watchlist</span><b>${watch().length}</b></div><div><span>Bots on staff</span><b>${V.hired.length}</b></div><div><span>Approvals</span><b>${pendings}</b></div></div><div class="v5-mini-rows">${c.board("starter").slice(0, 4).map((r, i) => `<div><span>${i + 1}</span><b>${esc(r.name)}</b><em>${P(r.q10)}</em></div>`).join("")}</div>${orb("xs")}</div><figcaption>Desktop / big screen · selection room</figcaption></figure>
    <figure class="v5-dev tab"><div class="v5-scr"><div class="v5-mini-h"><b>Film Room</b><span>${b ? esc(b.name) : ""}</span></div><div class="v5-film-screen sm"><div class="v5-film-play">▶</div></div><div class="v5-mini-tags"><span>Press at the line</span><span>Ball skills</span><span>Run support</span></div><div class="v5-mini-say">“Tag every press rep against a top-40 opponent.”</div>${orb("xs")}</div><figcaption>Tablet · film room</figcaption></figure>
    <figure class="v5-dev phone"><div class="v5-scr"><div class="v5-notch"></div><div class="v5-mini-h"><b>Edge</b><span>Hallway</span></div><div class="v5-mini-chat">${last ? `<div class="e">${esc(last.text.slice(0, 160))}${last.text.length > 160 ? "…" : ""}</div>` : `<div class="e">Ask me where we're thinnest.</div>`}${o.map((n) => `<div class="pill">${n.pos} +${n.gap}</div>`).join("")}</div>${orb("sm")}<div class="v5-state">${STATE_TXT[V.state]}</div></div><figcaption>Phone · hallway</figcaption></figure>
    <figure class="v5-dev watch"><div class="v5-scr"><div class="v5-w-time">${now()}</div><div class="v5-w-t">Edge</div><div class="v5-w-a">${w[0] ? esc(w[0].name) : ""}<span>${w[0] ? P(w[0].p) + " pattern" : ""}</span></div>${orb("xs")}<div class="v5-w-n">${pendings} to approve</div></div><figcaption>Watch · sideline</figcaption></figure>
  </div>
  <div class="grid g2" style="margin-top:14px"><section class="card card-pad"><h3 style="margin:0 0 6px">How it fits each room</h3><table class="t"><tbody>
    <tr><td><b>Hallway</b></td><td>Phone. One question, a spoken answer, a single card. Push to talk.</td></tr>
    <tr><td><b>Film room</b></td><td>Tablet. Player card, clip tags and the coach's notes, captured by voice while the tape runs.</td></tr>
    <tr><td><b>Monday meeting</b></td><td>Desktop. The brief on screen, read aloud, sent only after approval.</td></tr>
    <tr><td><b>Selection room</b></td><td>Big screen. Board ranked for starter or depth, live staff votes, Edge keeps score.</td></tr>
    <tr><td><b>Game day</b></td><td>Watch. Glanceable alerts, held until after the game unless the head coach says otherwise.</td></tr></tbody></table></section>
  <section class="card card-pad"><h3 style="margin:0 0 6px">What's real and what's next</h3><p class="small">Real now: voice in and out in the browser, the intent router over real watchlist and signal data, live research for open questions on the published site, AI Workforce agents that run real web research with visible steps and sources, agentic workflows at every position, and the approval queue.</p><p class="small">Not built yet (needs approval and TBD timelines): native iPad, iPhone and Apple Watch apps, a lifelike talking avatar, wake-word listening, real film integration, single sign-on and staff accounts, and saved history across sessions.</p></section></div>`;
}

// ---------------- floating mic + drawer ----------------
function paint() {
  const d = document.getElementById("v5-drawer");
  if (d) { d.hidden = !V.drawer; if (V.drawer) d.querySelector(".v5-d-b").innerHTML = talkCore(true); }
  document.querySelectorAll(".v5-msgs").forEach((el) => (el.scrollTop = el.scrollHeight));
  setState(V.state);
}
export function bindV5(ctx) {
  V.ctx = ctx;
  loadVoices(); if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { loadVoices(); };
  const fab = document.createElement("div");
  fab.innerHTML = `<button id="v5-fab" class="v5-fab" data-v5="fab" data-state="idle" aria-label="Open Edge voice assistant"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Edge</span></button>
    <aside id="v5-drawer" class="v5-drawer" hidden aria-label="Edge assistant"><div class="v5-d-h"><b>Edge</b><span class="dim">${ROOMS[V.room]}</span><button class="btn sm" data-v5="full">Full screen</button><button class="btn sm" data-v5="close" aria-label="Close">✕</button></div><div class="v5-d-b"></div></aside>`;
  document.body.appendChild(fab);
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-v5]"); if (!t) return;
    const a = t.dataset.v5;
    if (a === "mic") return listen();
    if (a === "fab") { if (location.hash.startsWith("#/talk")) return listen(); V.drawer = !V.drawer; return paint(); }
    if (a === "close") { V.drawer = false; return paint(); }
    if (a === "full") { V.drawer = false; paint(); return ctx.go("talk"); }
    if (a === "chip") return ask(t.dataset.q);
    if (a === "replay") { const m = V.msgs[+t.dataset.i]; if (m) { const was = V.speak; V.speak = true; setState("speaking"); await say(m.text); V.speak = was; setState("idle"); } return; }
    if (a === "room") { V.room = t.dataset.id; return ctx.render(); }
    if (a === "scene") { V.sceneIx = +t.dataset.i; V.playing = null; hush(); return ctx.render(); }
    if (a === "play") return playScene();
    if (a === "lead") { V.leadTab = t.dataset.id; return ctx.render(); }
    if (a === "vote") { const id = t.dataset.id; V.votes[id] = { ...(V.votes[id] || {}), HC: +t.dataset.v }; ctx.log("selection.vote", `Head coach votes ${+t.dataset.v > 0 ? "yes" : "no"} on ${id}`, { id }, {}, "staff"); ctx.toast("Vote recorded"); ctx.render(); return paint(); }
    if (a === "hire") { const id = t.dataset.id; if (V.hired.includes(id)) V.hired = V.hired.filter((x) => x !== id); else { V.hired.push(id); V.botOpen = id; } return ctx.render(); }
    if (a === "fire") { V.hired = V.hired.filter((x) => x !== t.dataset.id); return ctx.render(); }
    if (a === "open") { V.botOpen = V.botOpen === t.dataset.id ? null : t.dataset.id; return ctx.render(); }
    if (a === "run") { const id = t.dataset.id; return runBot(id, V.botTasks[id] || BOTS[id].task); }
    if (a === "runall") { for (const id of V.hired) runBot(id, V.botTasks[id] || BOTS[id].task); return; }
    if (a === "appr") { const x = V.approvals[+t.dataset.i]; x.state = t.dataset.v; ctx.log("approval." + x.state, `${x.state} · ${BOTS[x.bot].name}: ${x.what.slice(0, 80)}`, {}, { sent: false }, "staff"); ctx.toast(`${x.state === "approved" ? "Approved" : "Declined"} · recorded only, nothing was sent`); return ctx.render(); }
    if (a === "approve-brief") { V.approvals.unshift({ bot: "brief", what: "Send the Monday brief to the staff list", t: now(), state: "pending" }); ctx.toast("Added to the approval queue · nothing was sent"); return; }
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.v5 === "speak") V.speak = t.checked;
    if (t.dataset.v5 === "hands") V.hands = t.checked;
    if (t.dataset.v5 === "voice") { V.voiceIx = +t.value; say("This is Edge.", "edge"); }
  });
  document.addEventListener("input", (e) => { const t = e.target; if (t.dataset && t.dataset.bt) V.botTasks[t.dataset.bt] = t.value; });
  document.addEventListener("submit", (e) => { const f = e.target.closest("[data-v5form]"); if (!f) return; e.preventDefault(); const inp = f.querySelector("input"); const q = inp.value.trim(); if (q) { inp.value = ""; ask(q); } });
  document.addEventListener("keydown", (e) => { if (e.key === " " && e.altKey) { e.preventDefault(); listen(); } });
}
export const afterRender = () => { document.querySelectorAll(".v5-msgs").forEach((el) => (el.scrollTop = el.scrollHeight)); setState(V.state); };
