import { generate, POSITIONS, JUMPS, JUMP_LONG, CYCLES, FEATURES, BLOCKS, DEFS, defText, label } from "./data.js";
import { fitModel, labelledCycles, scorePlayer, waterfall, disagreement, backtest, learningCurve, comparables, ALL_KEYS } from "./engine.js";
import { sigmoid, rng, sha256, standardize } from "./model.js";
import * as C from "./charts.js";
import { ONTOLOGY, ONTO_EDGES } from "./ontology.js";
import * as RS from "./research.js";
import { pageLive, bindLive, checkHealth, liveReady, L as LIVE } from "./live.js";
import { pageCollege, bindCollege, checkCollege, C as COLLEGE } from "./college.js";
import { feedHTML, bindFeed } from "./feed.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => Math.round(x * 100);
const MODEL_VERSION = "portal-bayes-0.3.0";

// ---------------- state ----------------
const DATA = generate();
const S = {
  cfg: { pos: "CB", def: "starter", th: { snap: 50, grade: 70 }, sigmaBeta: 1.0 },
  staffEdits: {},          // id -> staff grade (live inputs from the staff)
  whatIf: {},              // id -> { film, ath, m1 } simulated overrides
  model: null, scores: {}, bt: null, lc: null,
  sort: "mean", jumpF: "all", onlyFlags: false, hideOutcomes: true,
  research: null, researchFlags: {}, real: { name: "", school: "", pos: null, level: "Group-of-5" },
  receipts: [], dataHash: "", selReceipt: null, tamper: null, ontoSel: "TransferEvent",
  telemetry: { fits: 0, fitMs: 0, scores: 0, draws: 0, startedAt: Date.now() },
};
const boardFor = () => DATA.board.filter((p) => p.pos === S.cfg.pos).map((p) => (S.staffEdits[p.id] !== undefined ? { ...p, staff: S.staffEdits[p.id] } : p));
const histFor = () => DATA.history.filter((p) => p.pos === S.cfg.pos);
const findPlayer = (id) => boardFor().find((p) => p.id === id) || DATA.history.find((p) => p.id === id);

// ---------------- ledger ----------------
async function log(op, intent, inputs = {}, outputs = {}, cls = "estimate") {
  const prev = S.receipts.length ? S.receipts[S.receipts.length - 1].hash : "0".repeat(64);
  const body = {
    seq: S.receipts.length + 1, ts: new Date().toISOString(), actor: "Personnel staff · demo user", agent: AGENT_OF[op] || "Portal Scoring Agent",
    op, intent, statement_class: cls, model_version: MODEL_VERSION, data_hash: S.dataHash.slice(0, 16),
    inputs, outputs, cost: { llm_tokens: 0, llm_usd: 0, compute: "in-browser" }, prev,
  };
  body.hash = await sha256(prev + JSON.stringify(body));
  S.receipts.push(body);
  const tip = $("#chain-tip"); if (tip) tip.textContent = body.hash.slice(0, 20) + "…";
  const cnt = $("#chain-n"); if (cnt) cnt.textContent = S.receipts.length;
  return body;
}
const AGENT_OF = { "dataset.load": "Data Intake Agent", "model.fit": "Bayesian Fit Agent", "board.score": "Portal Scoring Agent", "player.score": "Portal Scoring Agent", "staff.eval": "Staff Evidence Agent", "staff.import": "Staff Evidence Agent", "whatif.simulate": "Scenario Agent", "backtest.run": "Validation Agent", "board.export": "Portal Scoring Agent", "chain.verify": "FuzeBox Verifier" };
async function verifyChain(list) {
  let prev = "0".repeat(64);
  for (let i = 0; i < list.length; i++) {
    const { hash, ...body } = list[i];
    if (body.prev !== prev) return { ok: false, at: i + 1, why: "prev-hash link broken" };
    const h = await sha256(prev + JSON.stringify(body));
    if (h !== hash) return { ok: false, at: i + 1, why: "receipt contents changed after signing" };
    prev = hash;
  }
  return { ok: true, n: list.length };
}

// ---------------- compute ----------------
function refit() {
  const t0 = performance.now();
  const cyc = labelledCycles(DATA.history, S.cfg);
  S.model = fitModel(DATA.history, S.cfg, cyc);
  S.bt = backtest(DATA.history, S.cfg);
  S.lc = null;
  S.scores = {};
  for (const p of boardFor()) S.scores[p.id] = scorePlayer(S.model, p);
  const ms = performance.now() - t0;
  S.telemetry.fits += 1 + (S.bt ? 5 : 0); S.telemetry.fitMs += ms; S.telemetry.scores += boardFor().length; S.telemetry.draws += boardFor().length * 3000;
  return ms;
}
function rescore(id) {
  const p = boardFor().find((x) => x.id === id);
  if (p) S.scores[id] = scorePlayer(S.model, p);
  S.telemetry.scores++; S.telemetry.draws += 3000;
}
async function refitAndLog(reason) {
  showBusy(true);
  await new Promise((r) => setTimeout(r, 30));
  const ms = refit();
  const m = S.model;
  await log("model.fit", reason, { position: S.cfg.pos, success_definition: defText(S.cfg.def, S.cfg.th), cycles: m.cycles, prior_sd_beta: S.cfg.sigmaBeta },
    { n_transfers: m.n, tau_empirical_bayes: m.tau, newton_iterations: m.iters, base_rate: +m.base.toFixed(3), heldout_auc: S.bt ? +S.bt.full.met.auc.toFixed(3) : null, heldout_brier: S.bt ? +S.bt.full.met.brier.toFixed(4) : null, fit_ms: Math.round(ms) }, "estimate");
  await log("board.score", `Score ${S.cfg.pos} watch list`, { players: boardFor().length, draws_per_player: 3000 }, { top3: topN(3).map((p) => `${p.name} ${pct(S.scores[p.id].mean)}%`) }, "estimate");
  showBusy(false);
}
const topN = (n) => boardFor().sort((a, b) => S.scores[b.id].mean - S.scores[a.id].mean).slice(0, n);
function showBusy(on) { const b = $("#busy"); if (b) b.hidden = !on; }

// ---------------- formatting helpers ----------------
const P = () => POSITIONS[S.cfg.pos];
const fmtM = (spec, v) => (v === null || v === undefined ? "—" : spec.dec === 0 ? Math.round(v) + spec.unit : v.toFixed(spec.dec) + spec.unit);
const fmtRaw = (k, p) => {
  const v = p[k];
  if (v === null || v === undefined) return `<span class="dim">not available</span>`;
  if (k === "m1") return fmtM(P().m1, v);
  if (k === "m2") return fmtM(P().m2, v);
  if (k === "rating") return v.toFixed(4) + ` <span class="dim">(${p.stars}★)</span>`;
  if (k === "snap") return pct(v) + "%";
  if (k === "film") return v.toFixed(1);
  if (k === "ath") return v.toFixed(2);
  if (k === "inj") return v + " games";
  if (k === "elig") return v + (v === 1 ? " yr" : " yrs");
  if (k === "staff") return v.toFixed(1) + " / 5";
  return v;
};
const featLabel = (k) => (k === "m1" ? P().m1.k : k === "m2" ? P().m2.k : FEATURES.find((f) => f.k === k).label);
const badge = (c) => ({ observed: `<span class="badge b-observed">Observed</span>`, estimate: `<span class="badge b-estimate">Statistical estimate</span>`, hypothesis: `<span class="badge b-hypothesis">Hypothesis to evaluate</span>`, simulated: `<span class="badge b-simulated">Simulated</span>`, staff: `<span class="badge b-staff">Staff evaluation</span>` }[c] || "");
const tierBadge = (t) => `<span class="tier t-${t}">${t}</span>`;
function certainty(s) {
  const w = s.q90 - s.q10;
  return w < 0.15 ? { l: "High", c: "ok" } : w < 0.28 ? { l: "Medium", c: "mid" } : { l: "Low", c: "low" };
}
const completeness = (p) => ALL_KEYS.filter((k) => p[k] !== null && p[k] !== undefined).length;

// ---------------- navigation ----------------
const NAV = [
  { k: "board", n: "1", label: "Portal Board" },
  { k: "player", n: "2", label: "Player Profile" },
  { k: "test", n: "3", label: "Known-Player Test" },
  { k: "model", n: "4", label: "Model & Calibration" },
  { k: "ontology", n: "5", label: "Portal Ontology" },
  { k: "research", n: "6", label: "Deep Research" },
  { k: "live", n: "7", label: "Live Portal Intel" },
  { k: "college", n: "8", label: "College Data" },
  { k: "setup", n: "9", label: "Pilot Setup" },
  { k: "journal", n: "10", label: "Run Journal", fz: true },
];
const TITLES = {
  board: ["Portal Board", "Every candidate with a probability of success and a confidence range"],
  player: ["Player Profile", "Baseline → player evidence → posterior, with every input shown"],
  test: ["Known-Player Test", "What the model said about a class before it played — check it against players you know"],
  model: ["Model & Calibration", "The Bayesian model, its learned weights, pooling and honest held-out performance"],
  ontology: ["Portal Ontology", "The classes and links that turn portal data into evidence the model can use"],
  research: ["Deep Research", "A research agent that gathers cited public evidence on a player and hands it to the staff for review"],
  live: ["Live Portal Intel", "Live Perplexity web search and the 30 players most likely to enter the January 2027 portal, with sources"],
  college: ["College Data", "Real portal classes, observed base rates, Ohio State returning production and player usage and PPA from CollegeFootballData.com"],
  setup: ["Pilot Setup", "The three inputs we need from the staff, the data plan and the path to the January window"],
  journal: ["FuzeBox Run Journal", "Append-only, hash-chained receipts for every fit, score and staff input"],
};
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  const [s, p] = h.split("/");
  return [VNAV().some((n) => n.k === s) ? s : "board", p ? decodeURIComponent(p) : undefined];
}
const VNAV = () => NAV.filter((n) => n.k !== "college" || COLLEGE.health?.connected).map((n, i) => ({ ...n, n: String(i + 1) }));
function go(s, p) { location.hash = "#/" + s + (p ? "/" + encodeURIComponent(p) : ""); }

// ---------------- shell ----------------
function shell() {
  const [screen] = route();
  $("#nav").innerHTML = `<div class="nav-sec">Portal Lab</div>` + VNAV().filter((n) => !n.fz).map((n) => `<button data-go="${n.k}" class="${screen === n.k ? "on" : ""}"><span class="nn">${n.n}</span>${n.label}</button>`).join("") +
    `<div class="nav-sec">FuzeBox OS</div>` + VNAV().filter((n) => n.fz).map((n) => `<button data-go="${n.k}" class="fz ${screen === n.k ? "on" : ""}"><span class="nn">${n.n}</span>${n.label}</button>`).join("") +
    `<div class="nav-sec">Buckeye Edge core</div><div class="nav-note">Athlete Intelligence · Scheme Explorer · Route &amp; Matchup · Game Planning · Replay — in the main Buckeye Edge app</div>`;
  $("#mnav").innerHTML = VNAV().map((n) => `<button data-go="${n.k}" class="${screen === n.k ? "on" : ""} ${n.fz ? "fz" : ""}">${n.label}</button>`).join("");
  const [t, d] = TITLES[screen];
  $("#crumb").textContent = t; $("#crumb-sub").textContent = d;
  const pill = document.querySelector(".synthetic-pill"); if (pill) { pill.textContent = screen === "live" ? "Live web data" : screen === "college" ? "Real college data" : "Synthetic data"; pill.classList.toggle("live", screen === "live" || screen === "college"); }
  $("#cfg-pos").innerHTML = Object.entries(POSITIONS).map(([k, v]) => `<option value="${k}" ${k === S.cfg.pos ? "selected" : ""}>${v.name}</option>`).join("");
  $("#cfg-def").innerHTML = Object.entries(DEFS).map(([k, v]) => `<option value="${k}" ${k === S.cfg.def ? "selected" : ""}>${v.label}</option>`).join("");
}

// ---------------- deep research ----------------
const SCHEME = { CB: ["primarily press-man outside", "mostly off-zone in a Cover 3 shell", "split between boundary and field corner"], WR: ["mostly outside X receiver", "primarily slot in a spread offense", "moved across all three spots"], EDGE: ["mostly a 4-3 end with his hand down", "stand-up outside linebacker in a 3-4", "rushed from both sides"], OT: ["left tackle in a zone-heavy run scheme", "right tackle in a gap scheme", "started at both tackle spots"], RB: ["lead back in an outside-zone scheme", "split carries in a gap scheme", "third-down back with pass-pro duties"], QB: ["shotgun spread with heavy RPO usage", "under-center play-action offense", "air-raid with quick game"] };
function researchCtx(p) {
  const st = S.scores[p.id].std;
  return { posName: P().name, m1Label: P().m1.k.toLowerCase().replace(/^./, (c) => c.toUpperCase()), m1Fmt: fmtM(P().m1, p.m1),
    comps: comparables(DATA.history, S.model, S.cfg, p, st), dis: disagreement(S.model, p, st),
    schemeHint: (R) => { const a = SCHEME[S.cfg.pos]; return a[Math.floor(R.u() * a.length)]; } };
}
async function runResearch(id) {
  const p = findPlayer(id); if (!p) return;
  const findings = RS.simulateFindings(p, researchCtx(p));
  S.research = { pid: id, step: 0, findings, decisions: {}, done: false, startedAt: Date.now(), log: [] };
  await log("research.plan", `Research plan for ${p.name}`, { player: id, tracks: RS.TRACKS.map((t) => t.k), scope: "public sources only" }, { questions: findings.length }, "simulated");
  const tick = (ms) => new Promise((r) => setTimeout(r, ms));
  const lines = [
    () => findings.map((f) => `query → "${f.query}"`),
    () => findings.map((f) => `${RS.TRACKS.find((t) => t.k === f.k).label}: ${f.nSources} sources read`),
    () => findings.map((f) => `${f.id} → pl:${f.onto} · ${f.cls === "observed" ? "verified fact" : "report / opinion"}`),
    () => findings.map((f) => `${f.id}: ${f.check}`),
    () => [`${findings.length} findings waiting for staff review`],
  ];
  for (let i = 0; i < RS.STEPS.length; i++) {
    S.research.step = i;
    for (const l of lines[i]()) { S.research.log.push({ i, l, t: ((Date.now() - S.research.startedAt) / 1000).toFixed(1) }); if (route()[0] === "research") render(); await tick(70); }
    await tick(260);
  }
  S.research.done = true; S.research.step = RS.STEPS.length;
  await log("research.run", `Research run for ${p.name}`, { player: id, sources_read: findings.reduce((a, f) => a + f.nSources, 0) }, { findings: findings.length, conflicts: findings.filter((f) => f.action === "film").length }, "simulated");
  if (route()[0] === "research") render();
}
function pageResearch(param) {
  const board = boardFor().slice().sort((a, b) => S.scores[b.id].mean - S.scores[a.id].mean);
  const pid = (param && board.find((b) => b.id === param)?.id) || S.research?.pid || board[0].id;
  const p = findPlayer(pid), s = S.scores[pid];
  const R0 = S.research && S.research.pid === pid ? S.research : null;
  const opts = board.map((b) => `<option value="${b.id}" ${b.id === pid ? "selected" : ""}>${esc(b.name)} · ${b.jump} · ${pct(S.scores[b.id].mean)}%</option>`).join("");
  const steps = RS.STEPS.map((st, i) => { const state = !R0 ? "idle" : R0.done || i < R0.step ? "done" : i === R0.step ? "run" : "idle";
    return `<li class="rs-step ${state}"><span class="rs-dot"></span><div><b>${st.agent}</b><em>${st.what}</em></div><span class="rs-st">${state === "done" ? "done" : state === "run" ? "running…" : "waiting"}</span></li>`; }).join("");
  const logHtml = R0 ? R0.log.slice(-14).map((x) => `<div><span class="t">${x.t}s</span><span class="a">${esc(RS.STEPS[x.i].agent)}</span>${esc(x.l)}</div>`).join("") : `<div class="dim">Agent activity appears here when a run starts.</div>`;
  const findings = R0 && R0.done ? R0.findings.map((f) => { const d = R0.decisions[f.id];
    return `<tr class="${d ? "dec-" + d : ""}"><td class="mono">${f.id.split("-").pop()}</td><td><b>${esc(RS.TRACKS.find((t) => t.k === f.k).label)}</b><div class="rs-claim">${esc(f.claim)}</div><div class="rs-check">Verifier: ${esc(f.check)}</div><div class="rs-src">Source: ${esc(f.src)} · ${f.nSources} read</div></td>
      <td><span class="mono">pl:${f.onto}</span></td><td>${badge(f.cls)}</td>
      <td>${d ? `<span class="badge ${d === "accept" ? "b-ok" : "b-bad"}">${d === "accept" ? "Accepted" : "Rejected"}</span>${d === "accept" && f.action === "film" ? `<div class="note" style="margin:4px 0 0">Film review queued on the board</div>` : ""}` :
        `<div class="row-btns" style="margin:0"><button class="btn sm primary" data-act="rf-accept" data-id="${f.id}">Accept</button><button class="btn sm" data-act="rf-reject" data-id="${f.id}">Reject</button></div>${f.action === "film" ? `<div class="note" style="margin:4px 0 0">Accepting queues a film review</div>` : f.action === "confirm" ? `<div class="note" style="margin:4px 0 0">Confirm with position coach</div>` : ""}`}</td></tr>`; }).join("") : "";
  const rp = { ...S.real, pos: S.real.pos || S.cfg.pos }; const sub = { name: rp.name.trim(), school: rp.school.trim(), posName: POSITIONS[rp.pos].name.replace(/s$/, ""), level: rp.level };
  const brief = sub.name ? RS.buildBrief(sub) : "";
  return `
  <div class="callout sim"><b>Simulated research run.</b> The watch list is synthetic, so the agent's sources and findings below are fictional and labelled. For a real player, use <b>Research a real player</b> below: it builds the same scoped brief and opens it in Perplexity.</div>
  <div class="grid g-side" style="margin-top:14px">
    <div class="grid">
      <section class="card card-pad">
        <div class="card-h"><div><h3>Research a watch-list player</h3><p>Five reviewed agents. Every step and query is shown; nothing reaches the model until the staff accepts it.</p></div><div class="sp"></div>${badge("simulated")}</div>
        <div class="rs-top">
          <div class="field"><label for="rs-pick">Player</label><select id="rs-pick">${opts}</select></div>
          <div class="rs-pmeta">${tierBadge(p.tier)} ${esc(p.from)} · ${p.jump} · current estimate <b>${pct(s.mean)}%</b> (${pct(s.q10)}–${pct(s.q90)}%)</div>
          <button class="btn primary" data-act="research-run" data-id="${pid}" ${R0 && !R0.done ? "disabled" : ""}>${R0 && !R0.done ? "Running…" : R0 ? "Run again" : "Run deep research"}</button>
        </div>
        <ol class="rs-steps">${steps}</ol>
        <div class="rs-log" aria-live="polite">${logHtml}</div>
      </section>
      ${R0 && R0.done ? `<section class="card">
        <div class="card-h"><div><h3>Findings for staff review</h3><p>Each finding is mapped to a class in the portal ontology. Accept or reject; every decision is written to the Run Journal.</p></div></div>
        <div class="scroll-x"><table class="t rs-table"><thead><tr><th>#</th><th>Finding</th><th>Ontology class</th><th>Statement</th><th>Staff decision</th></tr></thead><tbody>${findings}</tbody></table></div>
        <p class="note" style="padding:0 16px 14px">Research does not change the probability directly. It feeds the staff grade and the film review queue, which the model does use, so the effect stays visible and owned by a person.</p>
      </section>` : ""}
      <section class="card card-pad">
        <div class="card-h"><div><h3>Research a real player</h3><p>Builds a scoped, cited research brief and opens it in Perplexity. Nothing is sent until you click.</p></div></div>
        <div class="rs-form">
          <div class="field"><label for="rp-name">Player name</label><input id="rp-name" data-real="name" value="${esc(rp.name)}" placeholder="Full name" autocomplete="off"/></div>
          <div class="field"><label for="rp-school">Current school</label><input id="rp-school" data-real="school" value="${esc(rp.school)}" placeholder="School" autocomplete="off"/></div>
          <div class="field"><label for="rp-pos">Position</label><select id="rp-pos" data-real="pos">${Object.entries(POSITIONS).map(([k, v]) => `<option value="${k}" ${k === rp.pos ? "selected" : ""}>${v.name}</option>`).join("")}</select></div>
          <div class="field"><label for="rp-level">Level</label><select id="rp-level" data-real="level">${["Power-4", "Group-of-5", "FCS"].map((l) => `<option ${l === rp.level ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        </div>
        <textarea class="rs-brief" id="rs-brief" readonly aria-label="Research brief">${esc(brief || "Enter a player name to build the brief.")}</textarea>
        <div class="row-btns">
          ${brief ? `<a class="btn primary" href="${RS.perplexityUrl(brief)}" target="_blank" rel="noopener" data-act="research-launch">Open in Perplexity</a><button class="btn" data-act="research-copy">Copy brief for Perplexity Computer</button>` : `<button class="btn primary" disabled>Open in Perplexity</button><button class="btn" disabled>Copy brief for Perplexity Computer</button>`}
        </div>
        <p class="note">Perplexity Computer runs the brief as a multi-step task and can return the findings table as a spreadsheet for upload. In the pilot, a FuzeBox backend calls the Perplexity Agent API directly and writes findings straight into this review queue.</p>
      </section>
    </div>
    <div class="grid" style="align-content:start">
      <section class="card card-pad">
        <div class="card-h"><div><h3>Research guardrails</h3><p>Enforced in the brief and by the verifier agent.</p></div></div>
        <ul class="rs-rules">${RS.SCOPE_RULES.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      </section>
      <section class="card card-pad">
        <div class="card-h"><div><h3>${esc(P().name)}: market research</h3><p>Position-group questions with real public answers. Opens in Perplexity.</p></div></div>
        <div class="rs-market">${RS.marketQueries(P().name).map((m) => `<a class="rs-mq" href="${RS.perplexityUrl(m.q)}" target="_blank" rel="noopener" data-act="research-launch"><b>${esc(m.t)}</b><span>${esc(m.q)}</span></a>`).join("")}</div>
      </section>
      <section class="card card-pad">
        <div class="card-h"><div><h3>Live mode (pilot)</h3><p>Perplexity Agent API with web search, called from a FuzeBox backend.</p></div><div class="sp"></div>${liveReady() ? `<span class="badge b-ok">Connected</span>` : `<span class="badge b-hypothesis">${LIVE.health ? "Offline on this host" : "Checking…"}</span>`}</div>
        <div class="specs">
          <div><span>API</span><b><a href="https://docs.perplexity.ai/docs/agent-api/tools/web-search" target="_blank" rel="noopener">Agent API · web_search</a></b></div>
          <div><span>Key</span><b>Held server-side, never in the browser</b></div>
          <div><span>Output</span><b>Cited findings as Research Finding nodes</b></div>
          <div><span>Needs</span><b>OSU sponsor approval and compliance check</b></div>
        </div>
        <div class="row-btns" style="margin-top:10px"><button class="btn fz sm" data-act="lv-research" data-n="${esc(sub.name)}" data-s="${esc(sub.school)}" data-p="${esc(sub.posName)}" ${liveReady() && sub.name ? "" : "disabled"}>Run live research on ${sub.name ? esc(sub.name) : "the real player"}</button><button class="btn sm" data-go="live">Open Live Portal Intel</button></div>
        <p class="note">Uses the name in <b>Research a real player</b>. Results appear on the Live Portal Intel page.</p>
      </section>
    </div>
  </div>`;
}

// ---------------- pages ----------------
function pageBoard() {
  const m = S.model, bt = S.bt;
  let rows = boardFor().map((p) => ({ p, s: S.scores[p.id], dis: disagreement(m, p, S.scores[p.id].std) }));
  if (S.jumpF !== "all") rows = rows.filter((r) => r.p.jump === S.jumpF);
  if (S.onlyFlags) rows = rows.filter((r) => r.dis || S.researchFlags[r.p.id]);
  const key = { mean: (r) => r.s.mean, cons: (r) => r.s.q10, up: (r) => r.s.q90, cert: (r) => -(r.s.q90 - r.s.q10) }[S.sort];
  rows.sort((a, b) => key(b) - key(a));
  const avgW = boardFor().reduce((a, p) => a + S.scores[p.id].q90 - S.scores[p.id].q10, 0) / boardFor().length;
  const nFlags = boardFor().filter((p) => disagreement(m, p, S.scores[p.id].std)).length;
  const kpis = `<div class="kpis">
    ${kpi("Watch list", boardFor().length, "", `${P().name} · synthetic`)}
    ${kpi("Comparable transfers", m.n, "", `${m.cycles.length} completed classes (${m.cycles.join(", ")})`)}
    ${kpi("Base rate", pct(m.base), "%", `succeeded: ${esc(defText(S.cfg.def, S.cfg.th))}`)}
    ${kpi("Held-out AUC", bt ? bt.full.met.auc.toFixed(2) : "—", "", bt ? `vs ${bt.baseline.met.auc.toFixed(2)} baseline-only · ${bt.test} class` : "needs 2+ labelled classes")}
    ${kpi("Avg 80% range", pct(avgW), " pts", "narrows with each portal cycle")}
    ${kpi("Film review queue", nFlags, "", "staff and model disagree")}
  </div>`;
  const steps = `<div class="how">
    <div class="how-step"><div class="hn">1</div><div><b>Baseline</b><p>How comparable transfers performed: same position, same jump in competition level. Partially pooled across jumps.</p>${badge("estimate")}</div></div>
    <div class="how-step"><div class="hn">2</div><div><b>Player evidence</b><p>Stats, film grade, measurables, experience, availability and your staff's evaluation update that baseline.</p>${badge("observed")} ${badge("staff")}</div></div>
    <div class="how-step"><div class="hn">3</div><div><b>Result</b><p>A probability of success with an 80% range. Missing evidence widens the range instead of being guessed.</p>${badge("estimate")}</div></div>
  </div>`;
  const table = `<section class="card">
    <div class="card-h"><div><h3>${esc(P().name)} · pre-window watch list</h3><p>Success = ${esc(defText(S.cfg.def, S.cfg.th))}. Bar shows mean (dot), 80% range (box) and 90% range (line). Dashed line = 50%.</p></div><div class="sp"></div>
      <div class="filters">
        <div class="field"><label for="f-sort">Rank by</label><select id="f-sort">
          ${[["mean", "Posterior mean"], ["cons", "Conservative (10th pct)"], ["up", "Upside (90th pct)"], ["cert", "Most certain"]].map(([k, l]) => `<option value="${k}" ${S.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field"><label for="f-jump">Level jump</label><select id="f-jump"><option value="all">All</option>${JUMPS.map((j) => `<option ${S.jumpF === j ? "selected" : ""}>${j}</option>`).join("")}</select></div>
        <label class="chk"><input type="checkbox" id="f-flags" ${S.onlyFlags ? "checked" : ""}/> Review queue only</label>
        <button class="btn sm" data-act="export">Export CSV</button>
        <label class="btn sm" for="csv-in">Import staff grades</label><input type="file" id="csv-in" accept=".csv,text/csv" hidden/>
      </div></div>
    <div class="scroll-x"><table class="t board">
      <thead><tr><th>#</th><th>Player</th><th>From</th><th>Jump</th><th class="n">Elig</th><th class="n">${esc(P().m1.k)}</th><th class="n">Film</th><th>Staff grade</th><th>P(success)</th><th class="n">Mean</th><th class="n">80% range</th><th>Certainty</th><th>Evidence</th></tr></thead>
      <tbody>${rows.map((r, i) => {
        const c = certainty(r.s);
        return `<tr class="${r.dis ? "flag" : ""}">
          <td class="n">${i + 1}</td>
          <td><button class="lnk" data-player="${r.p.id}"><b>${esc(r.p.name)}</b></button><div class="mono dim">${r.p.id}</div></td>
          <td>${tierBadge(r.p.tier)} ${esc(r.p.from)}</td>
          <td class="mono">${r.p.jump}</td>
          <td class="n">${r.p.elig}</td>
          <td class="n">${fmtM(P().m1, r.p.m1)}</td>
          <td class="n">${r.p.film === null ? '<span class="dim">—</span>' : r.p.film.toFixed(1)}</td>
          <td><select class="staff-sel" style="width:96px" data-staff="${r.p.id}" aria-label="Staff grade for ${esc(r.p.name)}"><option value="">Not graded</option>${[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => `<option value="${v}" ${r.p.staff === v ? "selected" : ""}>${v.toFixed(1)}</option>`).join("")}</select></td>
          <td>${C.intervalBar(r.s)}</td>
          <td class="n"><b>${pct(r.s.mean)}%</b></td>
          <td class="n">${pct(r.s.q10)}–${pct(r.s.q90)}%</td>
          <td><span class="cert c-${c.c}">${c.l}</span></td>
          <td><span class="evid">${completeness(r.p)}/9</span>${r.dis || S.researchFlags[r.p.id] ? ` <span class="badge b-hypothesis" title="${S.researchFlags[r.p.id] ? "Queued from Deep Research" : "Staff grade pulls against the rest of the evidence"}">Film review</span>` : ""}</td></tr>`;
      }).join("")}</tbody></table></div>
    ${rows.length ? "" : `<div class="empty">No players match these filters.</div>`}
  </section>`;
  return kpis + feedHTML(P().name) + steps + table + `<p class="note" style="margin-top:12px">Change a staff grade in the table and the player is re-scored instantly and written to the Run Journal. A "Film review" flag means the staff grade and the rest of the evidence point in opposite directions — a film question, not a verdict.</p>`;
}
const kpi = (l, v, u, s) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}${u ? `<small>${u}</small>` : ""}</div><div class="s">${s}</div></div>`;

function pagePlayer(id) {
  const board = boardFor();
  const p = (id && findPlayer(id)) || board.sort((a, b) => S.scores[b.id].mean - S.scores[a.id].mean)[0];
  const m = S.model;
  const isBoard = !!S.scores[p.id];
  const s = isBoard ? S.scores[p.id] : scorePlayer(m, p);
  const steps = waterfall(m, p, s.std, BLOCKS);
  // baseline distribution: sample alpha_j from its marginal posterior
  const g = JUMPS.indexOf(p.jump), R = rng(11), sd = Math.sqrt(m.cov[1 + g][1 + g]);
  const baseDraws = Array.from({ length: 3000 }, () => sigmoid(m.theta[1 + g] + sd * R.n()));
  const comps = comparables(DATA.history, m, S.cfg, p, s.std);
  const dis = disagreement(m, p, s.std);
  const gc = m.groupCounts[g];
  const wi = S.whatIf[p.id];
  let sim = null;
  if (wi) { const q = { ...p, ...wi }; sim = scorePlayer(m, q); }
  const c = certainty(s);
  const missing = ALL_KEYS.filter((k) => p[k] === null || p[k] === undefined);
  const evRows = steps.slice(1).flatMap((st) => st.parts.map((x) => `<tr>
      <td>${esc(st.name)}</td><td>${esc(featLabel(x.k))}</td><td class="n">${fmtRaw(x.k, p)}</td>
      <td class="n">${x.imputed ? '<span class="dim">imputed</span> ' : ""}${x.z >= 0 ? "+" : ""}${x.z.toFixed(2)}</td>
      <td class="n">${x.beta >= 0 ? "+" : ""}${x.beta.toFixed(2)} <span class="dim">± ${x.sd.toFixed(2)}</span></td>
      <td class="n ${x.contrib >= 0 ? "pos" : "neg"}">${x.contrib >= 0 ? "+" : ""}${x.contrib.toFixed(2)}</td>
      <td>${x.imputed ? badge("estimate") : x.k === "staff" ? badge("staff") : badge("observed")}</td></tr>`)).join("");
  const opts = board.sort((a, b) => a.name.localeCompare(b.name)).map((b) => `<option value="${b.id}" ${b.id === p.id ? "selected" : ""}>${esc(b.name)} · ${b.jump}</option>`).join("");
  return `
  <div class="ph">
    <div><div class="eyebrow">${esc(P().name)} · ${isBoard ? "2027 window watch list" : `${p.cycle} class (history)`} · <span class="mono">${p.id}</span></div>
      <h1 class="pname">${esc(p.name)}</h1>
      <div class="pmeta">${tierBadge(p.tier)} ${esc(p.from)} <span class="dot">·</span> ${JUMP_LONG[p.jump]} <span class="dot">·</span> ${p.elig} yr${p.elig > 1 ? "s" : ""} eligibility <span class="dot">·</span> ${Math.floor(p.height / 12)}'${p.height % 12}" ${p.weight} lb <span class="dot">·</span> portal rating ${p.rating.toFixed(4)} (${p.stars}★)</div></div>
    <div class="field"><label for="pick">Switch player</label><select id="pick">${opts}</select></div>
  </div>
  <div class="grid g-side">
    <div class="grid">
      <section class="card card-pad">
        <div class="card-h"><div><h3>Chance of success</h3><p>${esc(defText(S.cfg.def, S.cfg.th))}</p></div><div class="sp"></div>${badge("estimate")}</div>
        <div class="post">
          <div class="post-big"><div class="pb">${pct(s.mean)}<small>%</small></div><div class="ps">80% range <b>${pct(s.q10)}–${pct(s.q90)}%</b><br/>90% range ${pct(s.q05)}–${pct(s.q95)}%<br/>P(better than a coin flip) <b>${pct(s.pAbove50)}%</b><br/>Certainty <span class="cert c-${c.c}">${c.l}</span></div></div>
          <div class="post-chart">${C.density(s.draws, baseDraws)}<div class="legend"><span><i style="background:#c9ccd2"></i>Baseline: comparable ${p.jump} transfers</span><span><i style="background:#ba0c2f"></i>This player after his evidence</span></div></div>
        </div>
      </section>
      <section class="card card-pad">
        <div class="card-h"><div><h3>From baseline to this player</h3><p>Each block of evidence moves the odds. Weights were learned from ${m.n} past transfers; grey = evidence not available, estimated from what we do know.</p></div></div>
        ${C.waterfallChart(steps, s)}
        <p class="note">Baseline: ${gc.k} of ${gc.n} comparable ${p.jump} ${esc(S.cfg.pos)} transfers succeeded (${pct(gc.k / Math.max(1, gc.n))}% observed); the pooled estimate for a cohort-average player is ${pct(steps[0].p)}%.</p>
      </section>
      <section class="card">
        <div class="card-h"><div><h3>Evidence behind the number</h3><p>z = standard deviations from the comparable-transfer average. Contribution = weight × z, in log-odds.</p></div></div>
        <div class="scroll-x"><table class="t"><thead><tr><th>Block</th><th>Input</th><th class="n">Value</th><th class="n">z vs cohort</th><th class="n">Learned weight</th><th class="n">Contribution</th><th>Class</th></tr></thead><tbody>${evRows}</tbody></table></div>
      </section>
      <section class="card">
        <div class="card-h"><div><h3>Comparable transfers</h3><p>Nearest past ${p.jump} ${esc(S.cfg.pos)} transfers on the same evidence, with what actually happened.</p></div><div class="sp"></div>${badge("observed")}</div>
        <div class="scroll-x"><table class="t"><thead><tr><th>Player</th><th>Class</th><th>From</th><th class="n">${esc(P().m1.k)}</th><th class="n">Film</th><th class="n">Season-1 snaps</th><th class="n">Season-1 grade</th><th>Outcome</th></tr></thead>
        <tbody>${comps.map((x) => `<tr><td><button class="lnk" data-player="${x.h.id}">${esc(x.h.name)}</button></td><td class="mono">${x.h.cycle}</td><td>${tierBadge(x.h.tier)} ${esc(x.h.from)}</td><td class="n">${fmtM(P().m1, x.h.m1)}</td><td class="n">${x.h.film ?? "—"}</td><td class="n">${pct(x.h.out.snapShare1)}%</td><td class="n">${x.h.out.grade1}</td><td>${x.y ? '<span class="badge b-ok">Success</span>' : '<span class="badge b-bad">Not met</span>'}</td></tr>`).join("")}</tbody></table></div>
      </section>
    </div>
    <div class="grid" style="align-content:start">
      ${isBoard ? `<section class="card card-pad">
        <div class="card-h"><div><h3>Your staff's evaluation</h3><p>Enters the model as evidence with a weight learned from how well past staff grades predicted outcomes.</p></div></div>
        <div class="staff-in"><input type="range" id="staff-r" min="1" max="5" step="0.5" value="${p.staff ?? 3}" ${p.staff === null || p.staff === undefined ? 'data-empty="1"' : ""}/><output id="staff-o">${p.staff === null || p.staff === undefined ? "Not graded" : p.staff.toFixed(1)}</output></div>
        <div class="row-btns"><button class="btn primary sm" data-act="staff-apply" data-id="${p.id}">Apply grade</button><button class="btn sm" data-act="staff-clear" data-id="${p.id}">Clear</button></div>
        ${dis ? `<div class="callout" style="margin-top:10px"><b>Film review queued.</b> Your grade pulls ${dis.staffC > 0 ? "up" : "down"} while the rest of the evidence pulls ${dis.rest > 0 ? "up" : "down"}. Without the staff grade the model says ${pct(dis.pNoStaff)}%.</div>` : ""}
      </section>` : `<div class="callout fz">Historical player — outcome is known. Staff inputs are only enabled for the live watch list.</div>`}
      ${isBoard ? `<section class="card card-pad">
        <div class="card-h"><div><h3>Deep research</h3><p>Send a research agent for cited public evidence on this player. Findings wait for staff review before they touch the model.</p></div></div>
        ${S.research && S.research.pid === p.id && S.research.done ? `<div class="note" style="margin:0 0 8px">${S.research.findings.length} findings · ${Object.values(S.research.decisions).filter((d) => d === "accept").length} accepted</div>` : ""}
        <div class="row-btns" style="margin-top:0"><button class="btn primary sm" data-act="research-open" data-id="${p.id}">Research this player</button></div>
      </section>` : ""}
      <section class="card card-pad">
        <div class="card-h"><div><h3>Why the range is this wide</h3><p>Two sources of uncertainty, separated.</p></div></div>
        <div class="unc"><div><span>Model uncertainty</span><b>${pct(s.widthParamOnly)} pts</b><em>shrinks with more portal cycles</em></div><div><span>Missing evidence</span><b>${Math.max(0, pct(s.q90 - s.q10) - pct(s.widthParamOnly))} pts</b><em>${missing.length ? "shrinks when we collect: " + missing.map(featLabel).join(", ") : "none — full evidence on file"}</em></div></div>
      </section>
      ${isBoard ? `<section class="card card-pad ${wi ? "sim-on" : ""}">
        <div class="card-h"><div><h3>What-if</h3><p>Test how the estimate would move. Kept separate from the observed record.</p></div><div class="sp"></div>${badge("simulated")}</div>
        ${wi ? `<div class="sim-banner">SIMULATED — NOT THIS PLAYER'S RECORD</div>` : ""}
        ${whatIfSlider("film", "Film grade", 40, 95, 0.5, wi?.film ?? p.film ?? 68)}
        ${whatIfSlider("ath", "Athletic composite", 1, 10, 0.1, wi?.ath ?? p.ath ?? 6.4)}
        ${whatIfSlider("inj", "Games missed", 0, 14, 1, wi?.inj ?? p.inj)}
        <div class="row-btns"><button class="btn sm" data-act="sim-run" data-id="${p.id}">Simulate</button>${wi ? `<button class="btn sm" data-act="sim-clear" data-id="${p.id}">Clear simulation</button>` : ""}</div>
        ${sim ? `<div class="sim-out">Simulated: <b>${pct(sim.mean)}%</b> (80% range ${pct(sim.q10)}–${pct(sim.q90)}%) vs observed ${pct(s.mean)}%</div>` : ""}
      </section>` : ""}
      <section class="card card-pad">
        <div class="card-h"><div><h3>In the knowledge graph</h3><p>This player as ontology facts.</p></div></div>
        <div class="triples">${triples(p).map((t) => `<div><span class="s">${esc(t[0])}</span><span class="pr">${esc(t[1])}</span><span class="o">${esc(t[2])}</span></div>`).join("")}</div>
      </section>
    </div>
  </div>`;
}
const whatIfSlider = (k, l, a, b, st, v) => `<div class="wi"><label for="wi-${k}">${l}</label><input type="range" id="wi-${k}" data-wi="${k}" min="${a}" max="${b}" step="${st}" value="${v}"/><output id="wo-${k}">${(+v).toFixed(st < 1 ? 1 : 0)}</output></div>`;
function triples(p) {
  const T = [
    [p.id, "rdf:type", "pl:Athlete"], [p.id, "pl:position", "pl:PositionGroup/" + p.pos],
    [`te:${p.id}`, "pl:transferOf", p.id], [`te:${p.id}`, "pl:fromProgram", `prog:${p.from}`], [`prog:${p.from}`, "pl:competesAt", `lvl:${p.tier}`],
    [`te:${p.id}`, "pl:levelJump", `jump:${p.jump}`], [`te:${p.id}`, "pl:window", p.cycle === 2027 ? "2027 window (Jan 4, 2027)" : `${p.cycle} class`],
    [`sp:${p.id}`, "pl:" + (P().m1.k.replace(/[^A-Za-z]/g, "")), String(p.m1)],
  ];
  if (p.film !== null) T.push([`fg:${p.id}`, "pl:filmGrade", String(p.film)]);
  if (p.staff !== null && p.staff !== undefined) T.push([`se:${p.id}`, "pl:staffGrade", String(p.staff)]);
  if (S.scores[p.id]) T.push([`est:${p.id}`, "pl:posteriorMean", (S.scores[p.id].mean).toFixed(3)], [`est:${p.id}`, "pl:underDefinition", `def:${S.cfg.def}@v1`], [`est:${p.id}`, "fz:recordedIn", "fz:RunJournal"]);
  return T;
}

function pageTest() {
  const bt = S.bt;
  if (!bt) return `<div class="callout">This success definition has fewer than two labelled classes for ${esc(P().name)}, so there is nothing to hold out yet. Two-year retention needs two completed seasons.</div>`;
  const rows = bt.rows.map((p, i) => ({ p, pr: bt.full.ps[i], y: bt.ys[i] })).sort((a, b) => b.pr - a.pr);
  const met = (x) => `<td class="n">${x.met.auc.toFixed(3)}</td><td class="n">${x.met.brier.toFixed(3)}</td><td class="n">${x.met.logloss.toFixed(3)}</td>`;
  const top20 = rows.slice(0, 20), hit = top20.filter((r) => r.y).length;
  return `
  <div class="callout fz"><b>How to use this with your staff.</b> The model was fitted on the ${bt.train.join(" + ")} classes only, then asked about the ${bt.test} class before any of them played a snap at their new school. Keep outcomes hidden, have the staff call the players they know, then reveal.</div>
  <div class="kpis" style="margin-top:14px">
    ${kpi("Held-out class", bt.test, "", `${bt.rows.length} ${esc(S.cfg.pos)} transfers`)}
    ${kpi("Model AUC", bt.full.met.auc.toFixed(2), "", "0.5 = coin flip, 1.0 = perfect ranking")}
    ${kpi("Top-20 hit rate", pct(hit / 20), "%", `vs ${pct(bt.full.met.base)}% base rate`)}
    ${kpi("Brier score", bt.full.met.brier.toFixed(3), "", `baseline-only ${bt.baseline.met.brier.toFixed(3)} · lower is better`)}
  </div>
  <div class="grid g2">
    <section class="card card-pad"><div class="card-h"><div><h3>Calibration on the held-out class</h3><p>When the model says 60%, do about 60% succeed? Points near the dashed line = honest probabilities.</p></div></div>
      <div class="cal-wrap">${C.calibration([{ bins: bt.baseline.met.bins, color: "#9aa0a8" }, { bins: bt.full.met.bins, color: "#ba0c2f" }])}
      <div class="legend v"><span><i style="background:#ba0c2f"></i>Full Bayesian model</span><span><i style="background:#9aa0a8"></i>Baseline only (level jump)</span></div></div></section>
    <section class="card"><div class="card-h"><div><h3>Against simpler approaches</h3><p>Same held-out class, same success definition.</p></div></div>
      <table class="t"><thead><tr><th>Approach</th><th class="n">AUC</th><th class="n">Brier</th><th class="n">Log loss</th></tr></thead><tbody>
      <tr><td><b>Full Bayesian model</b></td>${met(bt.full)}</tr>
      <tr><td>Without staff evaluations</td>${met(bt.noStaff)}</tr>
      <tr><td>Industry portal rating only</td>${met(bt.rating)}</tr>
      <tr><td>Staff evaluation only</td>${met(bt.staff)}</tr>
      <tr><td>Baseline only (level jump)</td>${met(bt.baseline)}</tr></tbody></table>
      <p class="note" style="padding:0 16px 14px">The gap between "full model" and "without staff evaluations" is the measured value of your staff's grades — the number the pilot will establish on real data.</p></section>
  </div>
  <section class="card" style="margin-top:14px">
    <div class="card-h"><div><h3>${bt.test} class · ranked by what the model said beforehand</h3><p>Outcomes ${S.hideOutcomes ? "hidden" : "shown"}.</p></div><div class="sp"></div><button class="btn sm ${S.hideOutcomes ? "primary" : ""}" data-act="reveal">${S.hideOutcomes ? "Reveal outcomes" : "Hide outcomes"}</button></div>
    <div class="scroll-x"><table class="t"><thead><tr><th>#</th><th>Player</th><th>From</th><th>Jump</th><th class="n">Predicted</th><th class="n">Season-1 snaps</th><th class="n">Season-1 grade</th><th>Outcome</th></tr></thead><tbody>
      ${rows.slice(0, 40).map((r, i) => `<tr><td class="n">${i + 1}</td><td><button class="lnk" data-player="${r.p.id}">${esc(r.p.name)}</button></td><td>${tierBadge(r.p.tier)} ${esc(r.p.from)}</td><td class="mono">${r.p.jump}</td><td class="n"><b>${pct(r.pr)}%</b></td>
      ${S.hideOutcomes ? `<td class="n dim">hidden</td><td class="n dim">hidden</td><td class="dim">hidden</td>` : `<td class="n">${pct(r.p.out.snapShare1)}%</td><td class="n">${r.p.out.grade1}</td><td>${r.y ? '<span class="badge b-ok">Success</span>' : '<span class="badge b-bad">Not met</span>'}</td>`}</tr>`).join("")}
    </tbody></table></div><p class="note" style="padding:8px 16px 14px">Showing the top 40 of ${rows.length}. In the pilot this list is your real transfers and your league's — players your staff already has an opinion on.</p></section>`;
}

function pageModel() {
  const m = S.model;
  if (!S.lc) S.lc = learningCurve(DATA.history, S.cfg, boardFor());
  const G = m.G;
  const coef = m.keys.map((k, i) => ({ label: featLabel(k), m: m.theta[1 + G + i], sd: Math.sqrt(m.cov[1 + G + i][1 + G + i]) }));
  const groups = JUMPS.map((j, g) => {
    const gc = m.groupCounts[g], sd = Math.sqrt(m.cov[1 + g][1 + g]);
    return { jump: j, n: gc.n, raw: gc.k / Math.max(1, gc.n), pooled: sigmoid(m.theta[1 + g]), lo: sigmoid(m.theta[1 + g] - 1.645 * sd), hi: sigmoid(m.theta[1 + g] + 1.645 * sd) };
  });
  return `
  <div class="grid g2">
    <section class="card card-pad"><div class="card-h"><div><h3>The model</h3><p>Hierarchical Bayesian logistic regression, fitted live in this browser.</p></div><div class="sp"></div>${badge("estimate")}</div>
      <div class="math">
        <div><span class="mv">y<sub>i</sub></span> ~ Bernoulli(<span class="mv">p<sub>i</sub></span>) &nbsp;&nbsp;— did transfer <i>i</i> meet the staff's definition of success</div>
        <div>logit(<span class="mv">p<sub>i</sub></span>) = <span class="mv">α</span><sub>jump(i)</sub> + Σ<sub>k</sub> <span class="mv">β<sub>k</sub></span> · <span class="mv">x<sub>ik</sub></span> &nbsp;&nbsp;— baseline + evidence</div>
        <div><span class="mv">α</span><sub>j</sub> ~ Normal(<span class="mv">μ</span>, <span class="mv">τ</span>²) &nbsp;&nbsp;— level jumps share strength (partial pooling)</div>
        <div><span class="mv">μ</span> ~ Normal(logit 0.40, 1.5²) · <span class="mv">β<sub>k</sub></span> ~ Normal(0, ${S.cfg.sigmaBeta.toFixed(2)}²)</div>
        <div><span class="mv">x</span><sub>missing</sub> | <span class="mv">x</span><sub>observed</sub> ~ conditional Normal from the cohort covariance</div>
      </div>
      <div class="specs">
        <div><span>Posterior</span><b>Laplace approximation (Newton MAP + inverse Hessian), ${m.iters} iterations</b></div>
        <div><span>τ (pooling strength)</span><b>${m.tau} — chosen by empirical Bayes (max marginal likelihood)</b></div>
        <div><span>Prediction</span><b>3,000 Monte Carlo draws per player over parameters and missing evidence</b></div>
        <div><span>Training data</span><b>${m.n} labelled ${esc(S.cfg.pos)} transfers · classes ${m.cycles.join(", ")}</b></div>
        <div><span>Fit time</span><b>${Math.round(m.fitMs)} ms in-browser · 0 LLM tokens</b></div>
      </div>
      <div class="field" style="margin-top:12px"><label for="sb">Prior strength on evidence weights (σ<sub>β</sub>): <b id="sb-o">${S.cfg.sigmaBeta.toFixed(2)}</b> — smaller = more skeptical of evidence</label><input type="range" id="sb" min="0.15" max="2.5" step="0.05" value="${S.cfg.sigmaBeta}"/></div>
    </section>
    <section class="card card-pad"><div class="card-h"><div><h3>Learned evidence weights</h3><p>Change in log-odds per 1 SD above the comparable-transfer average, with 90% intervals. Green/red = clearly helps/hurts.</p></div></div>${C.forest(coef)}</section>
  </div>
  <div class="grid g3" style="margin-top:14px">
    <section class="card card-pad"><div class="card-h"><div><h3>Baselines by level jump</h3><p>Open circle = raw observed rate. Filled = pooled Bayesian baseline with 90% interval.</p></div></div>${C.shrinkChart(groups, 380, 200)}</section>
    <section class="card card-pad"><div class="card-h"><div><h3>How much to pool</h3><p>Marginal likelihood across τ. The peak is the data's answer.</p></div></div>${C.lineChart(m.tauCurve.map((t) => ({ x: Math.log(t.tau), y: t.logML, t: t.tau })), { w: 380, h: 200, xl: "τ (log scale)", yl: "log marginal likelihood", mark: Math.log(m.tau), fmtX: (x) => { const v = +Math.exp(x).toFixed(2); return [0.05, 0.2, 0.65, 1.75, 3.5].includes(v) ? v : ""; }, fmtY: (y) => y.toFixed(0) })}</section>
    <section class="card card-pad"><div class="card-h"><div><h3>Sharper with every portal cycle</h3><p>Average 80% range on today's watch list as completed classes are added.</p></div></div>
      ${C.bars(S.lc.map((x, i) => ({ l: `${i + 1} class${i ? "es" : ""}`, s: `n = ${x.n}`, v: x.width * 100 })), { w: 380, h: 200, fmt: (v) => v.toFixed(0) + " pts" })}</section>
  </div>
  <section class="card card-pad" style="margin-top:14px"><div class="card-h"><div><h3>What this model does not claim</h3></div></div>
    <ul class="lim">
      <li>All players, programs and outcomes here are synthetic. The held-out numbers show the method works on data with known structure; they are not evidence of accuracy on real players.</li>
      <li>Probabilities are associations from past transfers, not guarantees, and not a substitute for film or the staff's judgement.</li>
      <li>The Laplace approximation is exact enough for this model size; the production build adds full MCMC (Stan/PyMC NUTS) as a cross-check on every refit.</li>
      <li>Medical, academic and NIL data are out of scope for v1. Anything used must clear OSU compliance and data-sharing review first.</li>
    </ul></section>`;
}

function pageOntology() {
  const sel = ONTOLOGY.find((n) => n.id === S.ontoSel) || ONTOLOGY[0];
  const W = 980, H = 520;
  const pos = Object.fromEntries(ONTOLOGY.map((n) => [n.id, n]));
  const edges = ONTO_EDGES.map((e) => {
    const a = pos[e[0]], b = pos[e[1]];
    const on = sel.id === e[0] || sel.id === e[1];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    return `<g class="oe ${on ? "on" : ""}"><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>${on ? `<text x="${mx}" y="${my - 4}" text-anchor="middle">${esc(e[2])}</text>` : ""}</g>`;
  }).join("");
  const nodes = ONTOLOGY.map((n) => `<g class="on-node l-${n.layer} ${n.id === sel.id ? "sel" : ""}" data-onto="${n.id}" tabindex="0" role="button" aria-label="${esc(n.label)}"><rect x="${n.x - 66}" y="${n.y - 17}" width="132" height="34" rx="7"/><text x="${n.x}" y="${n.y + 4}" text-anchor="middle">${esc(n.label)}</text></g>`).join("");
  return `
  <div class="callout fz">The portal ontology <b>extends</b> the Buckeye Edge football ontology — it does not replace it. <b>Athlete</b> is the shared node: the same athlete who has routes, coverages and situations in the play graph now also has transfer events, evaluations and success estimates.</div>
  <div class="grid g-side" style="margin-top:14px">
    <section class="card card-pad">
      <div class="legend"><span><i style="background:#2b2e35"></i>Buckeye Edge core (existing)</span><span><i style="background:#ba0c2f"></i>Portal evidence</span><span><i style="background:#7b4fd6"></i>Inference</span><span><i style="background:#0e7c86"></i>FuzeBox governance</span></div>
      <svg viewBox="0 0 ${W} ${H}" class="onto" role="img" aria-label="Portal ontology graph">${edges}${nodes}</svg>
      <p class="note">Click any class to see its definition, properties, source and statement class.</p>
    </section>
    <section class="card card-pad" style="align-self:start">
      <div class="eyebrow">${esc(sel.layerName)}</div>
      <h3 class="oname">${esc(sel.label)}</h3>
      <p>${esc(sel.def)}</p>
      <div class="specs">
        <div><span>Key properties</span><b>${sel.props.map(esc).join(" · ")}</b></div>
        <div><span>Source</span><b>${esc(sel.source)}</b></div>
        <div><span>Statement class</span><b>${badge(sel.cls)}</b></div>
        <div><span>Links</span><b>${ONTO_EDGES.filter((e) => e[0] === sel.id || e[1] === sel.id).map((e) => `${esc(pos[e[0]].label)} <i>${esc(e[2])}</i> ${esc(pos[e[1]].label)}`).join("<br/>")}</b></div>
      </div>
    </section>
  </div>
  <section class="card" style="margin-top:14px"><div class="card-h"><div><h3>Class catalogue</h3><p>${ONTOLOGY.length} classes · ${ONTO_EDGES.length} relationships. Every model input is a property on one of these classes, so every number can be traced back to its source.</p></div></div>
    <div class="scroll-x"><table class="t"><thead><tr><th>Class</th><th>Layer</th><th>Definition</th><th>Source</th><th>Class</th></tr></thead><tbody>
    ${ONTOLOGY.map((n) => `<tr><td><button class="lnk" data-onto="${n.id}"><b>${esc(n.label)}</b></button></td><td>${esc(n.layerName)}</td><td>${esc(n.def)}</td><td>${esc(n.source)}</td><td>${badge(n.cls)}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function pageSetup() {
  const th = S.cfg.th;
  return `
  <div class="callout"><b>Prerequisites not yet approved:</b> an OSU football sponsor, a data-sharing agreement, FERPA/privacy review of any student-athlete data, licence rights for paid grading data (e.g. PFF), and a compliance check that pre-window evaluation stays within NCAA contact rules. Nothing below runs on real data until these clear.</div>
  <div class="grid g3" style="margin-top:14px">
    <section class="card card-pad"><div class="eyebrow">Input 1 · from the staff</div><h3 class="oname">Definition of success</h3>
      <p class="note">Pick a rule and set the thresholds. The whole app refits on change — this is the most important decision in the model.</p>
      ${Object.entries(DEFS).map(([k, v]) => `<label class="radio"><input type="radio" name="def" value="${k}" ${S.cfg.def === k ? "checked" : ""}/> <b>${v.label}</b><span>${esc(defText(k, th))}</span></label>`).join("")}
      <div class="wi"><label for="th-snap">Snap share threshold</label><input type="range" id="th-snap" min="25" max="80" step="5" value="${th.snap}"/><output>${th.snap}%</output></div>
      <div class="wi"><label for="th-grade">Grade threshold</label><input type="range" id="th-grade" min="55" max="85" step="1" value="${th.grade}"/><output>${th.grade}</output></div>
      <button class="btn primary sm" data-act="apply-def">Apply and refit</button>
    </section>
    <section class="card card-pad"><div class="eyebrow">Input 2 · from the staff</div><h3 class="oname">Starting position group</h3>
      <p class="note">One group first, built and tested properly, then extend. Groups with clear production stats (CB, WR, EDGE) validate fastest.</p>
      ${Object.entries(POSITIONS).map(([k, v]) => `<label class="radio"><input type="radio" name="pos" value="${k}" ${S.cfg.pos === k ? "checked" : ""}/> <b>${v.name}</b><span>${esc(v.m1.k)} · ${esc(v.m2.k)}</span></label>`).join("")}
    </section>
    <section class="card card-pad"><div class="eyebrow">Input 3 · from the staff</div><h3 class="oname">Internal evaluation data</h3>
      <p class="note">Anything the staff already keeps. Past grades on players who later transferred anywhere are the most valuable — they let the model measure how predictive the staff's eye is.</p>
      <ul class="lim"><li>Staff grades / board rankings from past portal cycles</li><li>Scheme-fit tags and position-coach notes</li><li>Practice GPS (Catapult-style) for players already on the roster — calibration only</li></ul>
      <button class="btn sm" data-act="template">Download staff-grade CSV template</button>
    </section>
  </div>
  <section class="card" style="margin-top:14px"><div class="card-h"><div><h3>Data plan — what we supply vs what the staff supplies</h3></div></div>
    <div class="scroll-x"><table class="t"><thead><tr><th>Evidence</th><th>Source</th><th>Supplied by</th><th>Access</th></tr></thead><tbody>
      <tr><td>Portal entries, origin, destination, rating, stars, eligibility status</td><td>CollegeFootballData.com <span class="mono">/player/portal</span></td><td>FuzeBox</td><td>Public API (key)</td></tr>
      <tr><td>Player usage, season stats, PPA</td><td>CollegeFootballData.com <span class="mono">/player/usage</span>, <span class="mono">/stats/player/season</span></td><td>FuzeBox</td><td>Public API (key)</td></tr>
      <tr><td>High-school recruiting profile</td><td>CollegeFootballData.com <span class="mono">/recruiting/players</span></td><td>FuzeBox</td><td>Public API (key)</td></tr>
      <tr><td>Snap counts and film grades</td><td>Licensed grading provider</td><td>OSU licence</td><td>Prerequisite — rights to use in a model</td></tr>
      <tr><td>Measurables (camp, combine, pro-day)</td><td>Public reports + staff testing</td><td>Both</td><td>Mixed</td></tr>
      <tr><td>Staff evaluations, scheme fit</td><td>OSU personnel staff</td><td>OSU</td><td>Internal — stays inside the department</td></tr>
      <tr><td>Outcomes for past transfers (snaps, grades, roster status)</td><td>Public stats + licensed snaps</td><td>FuzeBox</td><td>Public / licensed</td></tr>
    </tbody></table></div></section>
  <div class="grid g2" style="margin-top:14px">
    <section class="card card-pad"><div class="card-h"><div><h3>30-minute working session</h3></div></div>
      <ol class="agenda"><li><b>5 min</b> — Walk the board and one player profile (this demo).</li><li><b>10 min</b> — Agree the success definition and thresholds.</li><li><b>5 min</b> — Pick the position group.</li><li><b>10 min</b> — List the internal data that exists, who owns it, and what review it needs.</li></ol></section>
    <section class="card card-pad"><div class="card-h"><div><h3>Path to the January window</h3></div></div>
      <ol class="agenda"><li><b>Date TBD</b> — Working session; prerequisites above start moving.</li><li><b>TBD (target: ~2 weeks after data access)</b> — Working model on one position group, last three completed portal classes.</li><li><b>TBD</b> — Blind test with the staff on players they already know (Known-Player Test page).</li><li><b>Jan 4, 2027</b> — 10-day portal window opens (first business day after Jan 1). Board scores live entrants daily.</li></ol></section>
  </div>`;
}

function pageJournal() {
  const sel = S.receipts.find((r) => r.seq === S.selReceipt) || S.receipts[S.receipts.length - 1];
  const T = S.telemetry;
  return `
  <div class="kpis">
    ${kpi("Receipts", S.receipts.length, "", "append-only, hash-chained")}
    ${kpi("Model fits", T.fits, "", `${Math.round(T.fitMs)} ms total compute`)}
    ${kpi("Players scored", T.scores, "", `${(T.draws / 1e6).toFixed(2)}M posterior draws`)}
    ${kpi("LLM cost", "$0", "", "deterministic math, no model calls")}
  </div>
  <div class="row-btns" style="margin-bottom:12px"><button class="btn fz" data-act="verify">Verify chain</button><button class="btn" data-act="tamper">Tamper test (on a copy)</button><button class="btn" data-act="export-chain">Export journal JSON</button><span id="verify-out" class="vout">${S.tamper ? S.tamper : ""}</span></div>
  <div class="grid g-side">
    <section class="card">${S.receipts.slice().reverse().map((r) => `<div class="chain-row ${sel && r.seq === sel.seq ? "sel" : ""}" data-rc="${r.seq}"><span class="mono">R-${String(r.seq).padStart(4, "0")}</span><span class="hide-m"><b>${esc(r.agent)}</b><br/><span class="dim">${esc(r.op)}</span></span><span>${esc(r.intent)}</span><span class="hide-m">${badge(r.statement_class === "simulated" ? "simulated" : r.statement_class === "staff" ? "staff" : r.statement_class === "observed" ? "observed" : "estimate")}</span><span class="hash">${r.hash.slice(0, 16)}…</span></div>`).join("")}</section>
    <section class="card card-pad" style="align-self:start"><div class="card-h"><div><h3>Receipt R-${sel ? String(sel.seq).padStart(4, "0") : ""}</h3><p>Who asked, what ran, on which data, what it produced and what it cost.</p></div></div><pre class="json">${esc(JSON.stringify(sel, null, 2))}</pre></section>
  </div>`;
}

// ---------------- render ----------------
function render() {
  const [screen, param] = route();
  shell();
  const el = $("#page");
  el.innerHTML = { board: pageBoard, player: () => pagePlayer(param), test: pageTest, model: pageModel, ontology: pageOntology, research: () => pageResearch(param), live: () => pageLive(esc, badge), college: () => pageCollege(esc, badge), setup: pageSetup, journal: pageJournal }[screen]();
  $("#chain-n").textContent = S.receipts.length;
  if (screen === "college" && COLLEGE.autoload) COLLEGE.autoload();
}

// ---------------- events ----------------
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-go],[data-player],[data-act],[data-onto],[data-rc]");
  if (!t) return;
  if (t.dataset.go) return go(t.dataset.go);
  if (t.dataset.player) {
    const id = t.dataset.player; go("player", id);
    const p = findPlayer(id);
    if (p && S.scores[id]) log("player.score", `Open profile: ${p.name}`, { player: id }, { mean: +S.scores[id].mean.toFixed(3), range80: [+S.scores[id].q10.toFixed(3), +S.scores[id].q90.toFixed(3)] }, "estimate");
    return;
  }
  if (t.dataset.onto) { S.ontoSel = t.dataset.onto; return render(); }
  if (t.dataset.rc) { S.selReceipt = +t.dataset.rc; return render(); }
  const a = t.dataset.act, id = t.dataset.id;
  if (a === "research-launch") { sha256(t.href).then((h) => log("research.launch", "Open research question in Perplexity", { url_sha256: h.slice(0, 16) }, { destination: "perplexity.ai (opened by user)" }, "hypothesis")); return; }
  if (a === "staff-apply") {
    const v = +$("#staff-r").value; S.staffEdits[id] = v; rescore(id);
    const s = S.scores[id];
    await log("staff.eval", `Staff grade ${v.toFixed(1)} for ${findPlayer(id).name}`, { player: id, staff_grade: v, evaluator: "Position coach (demo)" }, { mean: +s.mean.toFixed(3), range80: [+s.q10.toFixed(3), +s.q90.toFixed(3)] }, "staff");
    toast(`Re-scored: ${pct(s.mean)}% (${pct(s.q10)}–${pct(s.q90)}%)`); render();
  }
  if (a === "staff-clear") { S.staffEdits[id] = null; rescore(id); await log("staff.eval", `Clear staff grade for ${findPlayer(id).name}`, { player: id, staff_grade: null }, { mean: +S.scores[id].mean.toFixed(3) }, "staff"); render(); }
  if (a === "sim-run") {
    const wi = {}; document.querySelectorAll("[data-wi]").forEach((x) => (wi[x.dataset.wi] = +x.value));
    S.whatIf[id] = wi; const p = findPlayer(id); const sim = scorePlayer(S.model, { ...p, ...wi });
    await log("whatif.simulate", `What-if for ${p.name}`, { player: id, overrides: wi }, { simulated_mean: +sim.mean.toFixed(3) }, "simulated"); render();
  }
  if (a === "research-open") return go("research", id);
  if (a === "research-run") { runResearch(id); return; }
  if (a === "rf-accept" || a === "rf-reject") {
    const R0 = S.research, f = R0.findings.find((x) => x.id === id), dec = a === "rf-accept" ? "accept" : "reject";
    R0.decisions[id] = dec; const pl = findPlayer(R0.pid);
    if (dec === "accept" && f.action === "film") S.researchFlags[R0.pid] = true;
    await log("research.finding", `${dec === "accept" ? "Accept" : "Reject"} ${f.id} (${f.onto}) for ${pl.name}`, { finding: f.id, ontology: "pl:" + f.onto, statement: f.cls, reviewer: "Personnel director (demo)" }, { decision: dec, film_review_queued: dec === "accept" && f.action === "film" }, "hypothesis");
    toast(dec === "accept" ? (f.action === "film" ? "Accepted · film review queued on the board" : "Accepted · added to the player's record") : "Rejected · logged"); return render();
  }
  if (a === "research-copy") {
    const ta = $("#rs-brief"); try { await navigator.clipboard.writeText(ta.value); } catch { ta.select(); document.execCommand("copy"); }
    log("research.brief", "Copy research brief for Perplexity Computer", { prompt_sha256: (await sha256(ta.value)).slice(0, 16) }, { destination: "Perplexity Computer (manual paste)" }, "hypothesis");
    toast("Brief copied — paste it into a new Perplexity Computer task"); return;
  }
  if (a === "sim-clear") { delete S.whatIf[id]; render(); }
  if (a === "reveal") { S.hideOutcomes = !S.hideOutcomes; if (!S.hideOutcomes) log("backtest.run", `Reveal ${S.bt.test} outcomes`, { held_out: S.bt.test }, { auc: +S.bt.full.met.auc.toFixed(3) }, "observed"); render(); }
  if (a === "export") {
    const rows = boardFor().map((p) => { const s = S.scores[p.id]; return [p.id, p.name, p.pos, p.from, p.tier, p.jump, p.elig, p.m1, p.m2, p.film ?? "", p.ath ?? "", p.staff ?? "", s.mean.toFixed(4), s.q10.toFixed(4), s.q90.toFixed(4)]; });
    download(`portal-board-${S.cfg.pos}.csv`, "id,name,pos,from,tier,jump,elig,m1,m2,film,athletic,staff_grade,p_mean,p_q10,p_q90\n" + rows.map((r) => r.join(",")).join("\n"));
    log("board.export", "Export board CSV", { position: S.cfg.pos }, { rows: rows.length }, "estimate");
  }
  if (a === "template") download("staff-grades-template.csv", "player_id,staff_grade\n" + boardFor().slice(0, 5).map((p) => `${p.id},`).join("\n"));
  if (a === "apply-def") {
    S.cfg.def = document.querySelector('input[name="def"]:checked').value;
    S.cfg.th.snap = +$("#th-snap").value; S.cfg.th.grade = +$("#th-grade").value;
    await refitAndLog(`Success definition → ${defText(S.cfg.def, S.cfg.th)}`); toast("Refitted on the new definition"); render();
  }
  if (a === "verify") { const r = await verifyChain(S.receipts); S.tamper = r.ok ? `✓ Chain verified · ${r.n} receipts recomputed in the browser` : `✗ Break at R-${r.at}: ${r.why}`; await log("chain.verify", "Verify Run Journal", {}, { ok: r.ok, n: S.receipts.length }, "observed"); render(); }
  if (a === "tamper") {
    const copy = JSON.parse(JSON.stringify(S.receipts));
    const target = copy.find((r) => r.op === "board.score") || copy[1];
    target.outputs = { ...target.outputs, top3: ["(edited) a different player 99%"] };
    const r = await verifyChain(copy);
    S.tamper = r.ok ? "Tamper not detected (unexpected)" : `Tamper test: edited R-${target.seq} on a copy → verifier flags R-${r.at} (${r.why}). Original journal untouched.`;
    render();
  }
  if (a === "export-chain") download("fuzebox-run-journal.json", JSON.stringify(S.receipts, null, 2));
});

document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.id === "cfg-pos" || (t.name === "pos" && t.type === "radio")) { S.cfg.pos = t.value; S.staffEdits = {}; await refitAndLog(`Position group → ${POSITIONS[t.value].name}`); const [sc] = route(); if (sc === "player") go("player", topN(1)[0].id); render(); }
  if (t.id === "cfg-def") { S.cfg.def = t.value; await refitAndLog(`Success definition → ${defText(S.cfg.def, S.cfg.th)}`); render(); }
  if (t.id === "f-sort") { S.sort = t.value; render(); }
  if (t.id === "f-jump") { S.jumpF = t.value; render(); }
  if (t.id === "f-flags") { S.onlyFlags = t.checked; render(); }
  if (t.id === "pick") go("player", t.value);
  if (t.id === "rs-pick") go("research", t.value);
  if (t.dataset.real) { S.real[t.dataset.real] = t.value; render(); }
  if (t.dataset.staff) {
    const id = t.dataset.staff, v = t.value === "" ? null : +t.value; S.staffEdits[id] = v; rescore(id);
    const s = S.scores[id];
    await log("staff.eval", `Staff grade ${v === null ? "cleared" : v.toFixed(1)} for ${findPlayer(id).name}`, { player: id, staff_grade: v, evaluator: "Position coach (demo)" }, { mean: +s.mean.toFixed(3), range80: [+s.q10.toFixed(3), +s.q90.toFixed(3)] }, "staff");
    toast(`${findPlayer(id).name}: ${pct(s.mean)}% (${pct(s.q10)}–${pct(s.q90)}%)`); render();
  }
  if (t.id === "sb") { S.cfg.sigmaBeta = +t.value; await refitAndLog(`Prior strength σβ → ${S.cfg.sigmaBeta.toFixed(2)}`); render(); }
  if (t.id === "csv-in" && t.files[0]) {
    const txt = await t.files[0].text(); let n = 0;
    txt.split(/\r?\n/).slice(1).forEach((line) => { const [id, g] = line.split(","); if (id && g && boardFor().some((p) => p.id === id.trim())) { S.staffEdits[id.trim()] = Math.max(1, Math.min(5, +g)); rescore(id.trim()); n++; } });
    await log("staff.import", `Import staff grades CSV (${t.files[0].name})`, { rows: n }, { rescored: n }, "staff"); toast(`Imported ${n} staff grades`); render();
  }
});
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "staff-r") $("#staff-o").textContent = (+t.value).toFixed(1);
  if (t.dataset.wi) $("#wo-" + t.dataset.wi).textContent = (+t.value).toFixed(t.step < 1 ? 1 : 0);
  if (t.id === "th-snap") t.nextElementSibling.textContent = t.value + "%";
  if (t.id === "th-grade") t.nextElementSibling.textContent = t.value;
  if (t.id === "sb") $("#sb-o").textContent = (+t.value).toFixed(2);
});
document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.dataset?.onto) { S.ontoSel = e.target.dataset.onto; render(); } });
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

function download(name, text) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2600); }

// ---------------- boot ----------------
(async function boot() {
  S.dataHash = await sha256(JSON.stringify(DATA.history));
  await log("dataset.load", "Load synthetic portal history + 2027 watch list", { history_rows: DATA.history.length, watch_list: DATA.board.length, classes: CYCLES.map((c) => c.id), positions: Object.keys(POSITIONS) }, { data_sha256: S.dataHash }, "observed");
  await refitAndLog("Initial fit");
  bindFeed();
  bindLive({ render, log, toast, go });
  bindCollege({ render, log, toast, go });
  checkHealth(render);
  checkCollege(render);
  $("#boot").remove();
  render();
})();
