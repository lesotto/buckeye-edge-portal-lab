// Portal Lab v7 · AI Workforce at work: an agentic workflow at every position.
// A sample portal entry triggers a chain of AI Workforce agents; each step shows what it read, what it did and
// (for the Fit Scorer) the full calculation. The result is delivered to the right coach's inbox. "Run it live"
// sends the same chain to the real research agents on the backend.
import { V, BOTS, runBot, say, hush, watchTop } from "../v5/coach.js";

const mdl = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const POS = {
  QB: { n: "Quarterback", room: "QB coach", depth: 0.85, watch: "QB", f: [["Accuracy under pressure", 30], ["Decision speed", 25], ["Production vs level", 20], ["Arm talent", 15], ["Durability", 10]], clips: ["Third-and-long dropbacks", "Pressure in the pocket", "Red-zone reads"] },
  RB: { n: "Running back", room: "RB coach", depth: 0.7, watch: "RB", f: [["Vision", 25], ["Burst", 20], ["Contact balance", 20], ["Receiving", 20], ["Pass protection", 15]], clips: ["Inside zone reads", "Yards after contact", "Blitz pickup"] },
  WR: { n: "Wide receiver", room: "WR coach", depth: 0.75, watch: "WR", f: [["Release vs press", 25], ["Separation", 25], ["Hands", 20], ["Speed", 15], ["Production vs level", 15]], clips: ["Release vs press", "Contested catches", "Third-down routes"] },
  TE: { n: "Tight end", room: "TE coach", depth: 0.6, watch: "TE", f: [["In-line blocking", 30], ["Route running", 25], ["Hands", 20], ["Size", 15], ["Versatility", 10]], clips: ["In-line blocks", "Seam routes", "Red-zone targets"] },
  OT: { n: "Offensive tackle", room: "OL coach", depth: 0.45, watch: null, f: [["Pass set", 30], ["Anchor", 20], ["Length", 20], ["Run fit", 15], ["Durability", 15]], clips: ["Speed rush sets", "Counter moves", "Down blocks"] },
  IOL: { n: "Interior offensive line", room: "OL coach", depth: 0.4, watch: null, f: [["Anchor", 30], ["Run blocking", 25], ["Hand use", 20], ["Communication", 15], ["Durability", 10]], clips: ["Double teams", "Stunts and twists", "Second-level blocks"] },
  EDGE: { n: "Edge rusher", room: "DL coach", depth: 0.8, watch: "DL", f: [["Get-off", 25], ["Bend", 20], ["Hand use", 20], ["Run defense", 20], ["Production vs level", 15]], clips: ["Get-off on third down", "Counter moves", "Setting the edge"] },
  DT: { n: "Defensive tackle", room: "DL coach", depth: 0.55, watch: "DL", f: [["Anchor vs double teams", 30], ["Get-off", 20], ["Hand use", 20], ["Pass rush", 15], ["Stamina", 15]], clips: ["Double-team anchors", "Penetration snaps", "Late-game reps"] },
  LB: { n: "Linebacker", room: "LB coach", depth: 0.6, watch: "LB", f: [["Diagnosis", 30], ["Range", 20], ["Tackling", 20], ["Coverage", 20], ["Leadership", 10]], clips: ["Run fits", "Zone drops", "Open-field tackles"] },
  CB: { n: "Cornerback", room: "DB coach", depth: 0.5, watch: "DB", f: [["Press technique", 25], ["Ball skills", 25], ["Speed", 20], ["Run support", 15], ["Size", 15]], clips: ["Press at the line", "Ball skills at the catch point", "Run support"] },
  S: { n: "Safety", room: "DB coach", depth: 0.5, watch: "DB", f: [["Range", 25], ["Diagnosis", 25], ["Tackling", 20], ["Ball skills", 15], ["Communication", 15]], clips: ["Single-high range", "Alley fits", "Disguise and rotation"] },
  KP: { n: "Kicker or punter", room: "Special teams coordinator", depth: 0.7, watch: null, f: [["Accuracy", 35], ["Distance", 25], ["Under pressure", 25], ["Operation time", 15]], clips: ["Kicks of 45+ yards", "Late-game attempts", "Directional punts"] },
};
export const POSK = Object.keys(POS);
const depthLbl = (d) => (d >= 0.7 ? "Deeper data" : d >= 0.5 ? "Medium data" : "Thinner data");

// Seeded numbers so each position always shows the same sample run.
function rng(seed) { let x = seed; return () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648); }
function sample(k) {
  const r = rng([...k].reduce((a, c) => a + c.charCodeAt(0) * 97, 7));
  const id = 4000 + Math.floor(r() * 5000);
  const rows = POS[k].f.map(([name, w]) => { const ideal = 84 + Math.round(r() * 10); const cand = Math.max(55, Math.min(99, ideal - 18 + Math.round(r() * 26))); return { name, w, ideal, cand, ratio: Math.min(1, cand / ideal) }; });
  const fit = rows.reduce((a, x) => a + x.w * x.ratio, 0);
  const driver = rows.slice().sort((a, b) => b.w * (1 - b.ratio) - a.w * (1 - a.ratio))[0];
  const best = rows.slice().sort((a, b) => b.w * b.ratio - a.w * a.ratio)[0];
  const pscore = 0.18 + r() * 0.2;
  return { id, rows, fit, driver, best, pscore };
}

export const F = { pos: "CB", step: -1, timer: null, narrate: true, live: false, liveIx: -1, inbox: [] };

function steps(k) {
  const p = POS[k], s = sample(k), w = p.watch ? watchTop(p.watch, 2) : [];
  return [
    { a: "trigger", who: "Portal feed", mono: "PF", t: "6:02 AM", h: `Sample player ${s.id} (${k}) enters the portal`, d: `${p.n} from a Group of Five program. Sample event for the demo.`, say: `At six oh two, a sample ${p.n.toLowerCase()} enters the portal.` },
    { a: "scout", who: BOTS.scout.name, mono: "PS", t: "6:03 AM", h: "Flagged and prioritized", d: `He was already on Portal Watch: pattern score ${Math.round(s.pscore * 100)}% before entry (sample). The signal behind it, Group of Five top-15% production, held up on real rosters (adjusted 1.28× in 2025, 1.44× in 2026).${w.length ? ` Also on the real ${p.watch} watchlist: ${w.map((x) => `${x.name} (${x.team})`).join(", ")}. Pattern scores, not intent.` : ""}`, say: "The Portal Scout flags him and checks the signals." },
    { a: "film", who: BOTS.film.name, mono: "FA", t: "6:07 AM", h: "Film-room prep ready", d: `Clips to pull: ${p.clips.join(" · ")}. Questions for the ${p.room}: does his production hold against Power Four opponents? Is the weakest factor technique or scheme?`, say: `The Film Analyst lines up the clips for the ${p.room}.` },
    { a: "fit", who: BOTS.fit.name, mono: "FS", t: "6:11 AM", h: `Fit ${s.fit.toFixed(0)} of 100 against your three ideal ${p.n.toLowerCase()}s`, d: `Strongest: ${s.best.name}. Biggest gap: ${s.driver.name}.`, calc: s, say: `The Fit Scorer compares him with your three ideal players. Fit ${s.fit.toFixed(0)} out of 100, with ${s.driver.name.toLowerCase()} the biggest gap.` },
    { a: "compliance", who: BOTS.compliance.name, mono: "CC", t: "6:15 AM", h: "Rules checked", d: "He is in the portal, inside the January 4–13, 2027 window on the NCAA calendar, so programs may contact him under NCAA transfer rules. Any outreach from us still waits for a named approval. Anything unclear goes to the compliance office.", say: "The Compliance Checker confirms the contact rules." },
    { a: "brief", who: BOTS.brief.name, mono: "BW", t: "6:18 AM", h: `Card delivered to the ${p.room}`, d: "One card: who he is, why he fits, what to watch, and the next decision. Sources and every step above travel with it.", say: `By six nineteen, the ${p.room} has a card on his phone.` },
  ];
}

function calcHTML(c) {
  return `<div class="v7-calc"><table class="t"><thead><tr><th>Factor</th><th class="n">Weight</th><th class="n">Ideal</th><th class="n">Player</th><th class="n">Ratio</th><th class="n">Points</th></tr></thead><tbody>
  ${c.rows.map((x) => `<tr><td>${esc(x.name)}</td><td class="n">${x.w}</td><td class="n">${x.ideal}</td><td class="n">${x.cand}</td><td class="n">${x.ratio.toFixed(2)}</td><td class="n"><b>${(x.w * x.ratio).toFixed(1)}</b></td></tr>`).join("")}
  <tr class="v7-tot"><td colspan="5">Fit = Σ weight × ratio, where ratio = min(player ÷ ideal average, 1)</td><td class="n"><b>${c.fit.toFixed(1)}</b></td></tr></tbody></table>
  <p class="dim v7-fine">Weights and the three ideal players come from the staff (the general manager session). Numbers here are sample values for the demo.</p></div>`;
}

function inboxHTML(k) {
  const p = POS[k], s = sample(k), done = F.step >= 5;
  const card = done ? `<div class="v7-card v7-slide"><div class="v7-card-h"><span class="v7-av sm">BW</span><b>New ${esc(p.n.toLowerCase())} in the portal</b><span class="dim">6:19 AM</span></div>
    <div class="v7-card-b"><div class="v7-kv"><span>Player</span><b>Sample ${s.id} · ${k}</b></div><div class="v7-kv"><span>Fit</span><b>${s.fit.toFixed(0)} / 100</b></div><div class="v7-kv"><span>Strength</span><b>${esc(s.best.name)}</b></div><div class="v7-kv"><span>Watch</span><b>${esc(s.driver.name)}</b></div><div class="v7-kv"><span>Film</span><b>${p.clips.length} clip sets ready</b></div></div>
    <div class="v7-card-f"><button class="btn sm primary" data-v7="board">Add to board</button><button class="btn sm" data-v7="contact">Request contact</button><button class="btn sm" data-v7="ask">Ask Edge</button></div>
    <div class="v7-lock">Contact waits for a named approval</div></div>` : `<div class="v7-empty">${F.step < 0 ? "Press Play to start the workflow." : "The AI Workforce is working…"}</div>`;
  const prior = F.inbox.filter((x) => x.k !== k).slice(0, 3).map((x) => `<div class="v7-mini"><b>${esc(x.room)}</b> · ${esc(x.h)}<span class="dim">${esc(x.state)}</span></div>`).join("");
  return `<div class="v7-phone"><div class="v7-phone-h"><b>Inbox</b><span>${esc(p.room)}</span></div>${card}${prior ? `<div class="v7-prior"><div class="dim">Delivered earlier</div>${prior}</div>` : ""}</div>`;
}

function liveHTML() {
  if (!F.live) return "";
  const chain = ["scout", "film", "fit", "compliance", "brief"];
  return `<section class="v6-card v7-live"><div class="v6-sec-h"><h3>Live run · real research agents</h3><span class="dim">Results also appear on the AI Workforce page</span></div>
  <ol class="v7-live-l">${chain.map((id, i) => { const r = V.runs.find((x) => x.bot === id && x.flow === F.flowId); const st = r ? (r.status === "running" ? "Working…" : r.via === "live" ? `Done · ${(r.sources || []).length} sources · ${(r.ms / 1000).toFixed(0)}s` : "Offline draft") : i === F.liveIx ? "Starting…" : "Queued"; return `<li class="${r && r.status === "done" ? "ok" : r ? "run" : ""}"><span class="v7-av sm">${BOTS[id].mono}</span><b>${esc(BOTS[id].name)}</b><span class="dim">${st}</span>${r && r.report ? `<div class="v7-live-out">${mdl(r.report.slice(0, 420))}${r.report.length > 420 ? "…" : ""}</div>` : ""}</li>`; }).join("")}</ol></section>`;
}

function bodyHTML() {
  const k = F.pos, S = steps(k);
  return `<div class="v7-pipe">${S.map((x, i) => `<article class="v7-step ${i <= F.step ? "on" : ""} ${i === F.step ? "now" : ""}" data-a="${x.a}"><div class="v7-step-h"><span class="v7-av">${x.mono}</span><div><b>${esc(x.who)}</b><span class="dim">${x.t}</span></div></div><h4>${esc(x.h)}</h4>${i <= F.step ? `<p>${esc(x.d)}</p>${x.calc && i <= F.step ? calcHTML(x.calc) : ""}` : `<p class="dim">Waiting for hand-off</p>`}</article>`).join(`<span class="v7-hand" aria-hidden="true"></span>`)}</div>`;
}

export function pageFlow() {
  const k = F.pos;
  return `<div class="v6 v7">
  <section class="v6-card v7-top"><div class="v6-sec-h"><h3>The AI Workforce at work</h3><span class="dim">An agentic workflow, start to finish</span></div>
    <p class="v6-lede sm">When something happens in the portal, the AI Workforce acts on its own: each agent does one job, shows its work and hands off to the next, until a finished card reaches the right coach. Pick any position.</p>
    <div class="v7-pos" role="tablist">${POSK.map((p) => `<button role="tab" aria-selected="${p === k}" class="${p === k ? "on" : ""}" data-v7="pos" data-id="${p}"><b>${p === "KP" ? "K/P" : p}</b><i style="--w:${Math.round(POS[p].depth * 100)}%"></i></button>`).join("")}</div>
    <div class="v7-ctl"><button class="btn primary" data-v7="play">${F.tok && F.step < 5 ? "Playing…" : F.step >= 5 ? "Replay" : "Play the workflow"}</button><button class="btn" data-v7="step">Next step</button><button class="btn" data-v7="live">Run it live with the AI Workforce</button><label class="v6-chk"><input type="checkbox" data-v7="narrate" ${F.narrate ? "checked" : ""}/> Narrate</label>
      <span class="dim v7-depth">${esc(POS[k].n)} · ${depthLbl(POS[k].depth)} today (planning estimate, measured this year)</span></div>
  </section>
  <div class="v7-grid"><section id="v7-body">${bodyHTML()}</section><aside id="v7-inbox">${inboxHTML(k)}</aside></div>
  <div id="v7-live">${liveHTML()}</div>
  <section class="v6-card"><div class="v6-sec-h"><h3>What the AI Workforce brings each person</h3><span class="dim">Delivered, not searched for</span></div>
    <div class="v7-brings">${[
      ["General manager", "Monday brief draft, needs board changes overnight, market ranges by position"],
      ["Head coach", "A three-line summary after each decision meeting, and alerts held until after games"],
      ["Position coaches", "A card for every new portal player in their room, with fit, film prep and the next decision"],
      ["Talent and personnel staff", "Portal Watch alerts at every position, research with sources, a queue to work"],
      ["Compliance", "Every requested contact in one approval queue, with who asked and why"],
      ["Dan", "Signal tests on real data, and a weekly read on how the system is performing"],
    ].map(([w, d]) => `<div class="v7-bring"><b>${w}</b><span>${d}</span></div>`).join("")}</div>
    <p class="dim v7-fine">Workflows run here when you press Play or Run it live. Scheduled and event-triggered runs need the approvals on This Year &amp; Beyond.</p>
  </section></div>`;
}

function paintFlow() {
  const b = document.getElementById("v7-body"), i = document.getElementById("v7-inbox"), l = document.getElementById("v7-live");
  if (b) b.innerHTML = bodyHTML(); if (i) i.innerHTML = inboxHTML(F.pos); if (l) l.innerHTML = liveHTML();
  const pb = document.querySelector('[data-v7="play"]'); if (pb) pb.textContent = F.tok && F.step < 5 ? "Playing…" : F.step >= 5 ? "Replay" : "Play the workflow";
  const tgt = F.step >= 5 && innerWidth <= 1100 ? document.getElementById("v7-inbox") : document.querySelector(".v7-step.now");
  if (F.step >= 0) tgt?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function deliver() {
  const p = POS[F.pos], s = sample(F.pos);
  F.inbox = [{ k: F.pos, room: p.room, h: `Sample ${s.id} · ${F.pos} · fit ${s.fit.toFixed(0)}`, state: "delivered" }, ...F.inbox.filter((x) => x.k !== F.pos)].slice(0, 8);
  V.ctx?.log?.("workflow.delivered", `AI Workforce card to ${p.room}: sample ${s.id} (${F.pos}), fit ${s.fit.toFixed(1)}`, { pos: F.pos }, { sent: false }, "estimate");
}
function advance() {
  if (F.step >= 5) { stop(); return Promise.resolve(); }
  F.step++; const S = steps(F.pos)[F.step];
  if (F.step === 5) deliver();
  paintFlow();
  return F.narrate ? say(S.say) : Promise.resolve();
}
function stop() { F.tok = null; clearInterval(F.timer); F.timer = null; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export async function playFlow() {
  stop(); hush(); F.step = -1; paintFlow();
  const tok = (F.tok = {});
  while (F.tok === tok && F.step < 5) {
    const t0 = Date.now(); await advance();
    if (F.tok !== tok) return;
    const spent = Date.now() - t0; await wait(F.narrate ? Math.max(500, 1500 - spent) : 1500);
  }
  if (F.tok === tok) F.tok = null;
  paintFlow();
}
export function startFlow(pos) { if (pos && POS[pos]) F.pos = pos; F.step = -1; V.ctx?.go?.("flow"); setTimeout(playFlow, 500); }

async function runLive() {
  const p = POS[F.pos], s = sample(F.pos);
  F.live = true; F.flowId = Date.now(); paintFlow();
  const focus = `Position: ${p.n} (${F.pos}). Workflow: a ${p.n.toLowerCase()} from a Group of Five program has entered the transfer portal (sample player ${s.id}).`;
  const tasks = {
    scout: `${focus} Find current public reporting on ${p.n.toLowerCase()}s who have entered or may enter the January 2027 portal, with dates.`,
    film: `${focus} Write film-room prep for the ${p.room}: what to watch, clips to pull (${p.clips.join(", ")}), and questions to settle.`,
    fit: `${focus} Staff ideal-profile factors and weights: ${p.f.map(([n, w]) => `${n} ${w}%`).join(", ")}. Sample player scores: ${s.rows.map((x) => `${x.name} ${x.cand} vs ideal ${x.ideal}`).join(", ")}. Compute fit = sum of weight × min(player ÷ ideal, 1), show each factor\'s points, the total out of 100 and the biggest gap.`,
    compliance: `${focus} Under current NCAA rules, what contact with this player is allowed now that he has entered the portal, and what must go to the compliance office?`,
    brief: `${focus} Write a five-line card for the ${p.room}: who, why he fits, what to watch on film, compliance status, and the next decision. Mark it DRAFT.`,
  };
  const chain = Object.keys(tasks);
  for (let i = 0; i < chain.length; i++) {
    F.liveIx = i; paintFlow();
    if (!V.hired.includes(chain[i])) V.hired.push(chain[i]);
    const run = runBot(chain[i], tasks[chain[i]]);
    const r = V.runs.find((x) => x.bot === chain[i] && !x.flow); if (r) r.flow = F.flowId; paintFlow();
    await run; paintFlow();
  }
  F.liveIx = -1; paintFlow();
}

export function bindFlow() {
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-v7]"); if (!t) return;
    const a = t.dataset.v7;
    if (a === "pos") { stop(); hush(); F.pos = t.dataset.id; F.step = -1; V.ctx?.render?.(); return; }
    if (a === "play") return playFlow();
    if (a === "step") { stop(); hush(); if (F.step >= 5) F.step = -1; advance(); return; }
    if (a === "live") return runLive();
    if (a === "board") { V.ctx?.toast?.("Added to the board as a sample entry"); V.ctx?.log?.("workflow.board", `Board add: sample (${F.pos})`, {}, { sent: false }, "estimate"); return; }
    if (a === "contact") { const s = sample(F.pos); V.approvals.unshift({ bot: "brief", what: `Contact sample player ${s.id} (${F.pos}) on behalf of the ${POS[F.pos].room}`, t: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), state: "pending" }); V.ctx?.toast?.("Request added to the approval queue on the AI Workforce page"); return; }
    if (a === "ask") { V.ctx?.go?.("talk"); return; }
  });
  document.addEventListener("change", (e) => { const t = e.target.closest('[data-v7="narrate"]'); if (t) F.narrate = t.checked; });
}
