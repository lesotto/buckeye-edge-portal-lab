import { DEST_PROGRAMS as DEST_PROGRAMS_LIST } from "./data.js";
import { generate, POSITIONS, JUMPS, JUMP_LONG, CYCLES, FEATURES, BLOCKS, PLAYER_BLOCKS, DEFS, defText, label, OUTCOME_GRID, playBand, DEST_OSU, OSU_CONTEXT } from "./data.js";
import { fitModel, labelledCycles, scorePlayer, waterfall, disagreement, backtest, learningCurve, comparables, ALL_KEYS, CONTEXT_KEYS, activeKeys, FEATURE_BY_KEY } from "./engine.js";
import { pageQBReal, bindQBReal } from "./qbreal.js";
import { pageValidity } from "./validity.js";
import { sigmoid, rng, sha256, standardize } from "./model.js";
import * as C from "./charts.js";
import { ONTOLOGY, ONTO_EDGES } from "./ontology.js";
import * as RS from "./research.js";
import { pageLive, bindLive, checkHealth, liveReady, L as LIVE } from "./live.js";
import { pageCollege, bindCollege, checkCollege, C as COLLEGE } from "./college.js";
import { RP_NAV, RP_TITLES, isRP, rpPage, bindRP, rpBar } from "./rp/index.js";
import { pageWatch, pageSignals, bindWatch } from "./watch.js";
import { V6NAV, V6TITLES, pageLearn, pagePlan, pageVariance, pageGaps, pageTour, pageFaq, pageGlossary, bindV6, afterRender6 } from "./v6/learn.js";
import { V5NAV, V5TITLES, pageTalk, pageRooms, pageLead, pageBots, pageDevices, bindV5, afterRender } from "./v5/coach.js";
import { rosterModel } from "./rp/pages_plan.js";
import { kpi as rpKpi } from "./rp/ui.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => Math.round(x * 100);
const MODEL_VERSION = "portal-bayes-0.4.0";

// ---------------- state ----------------
const DATA = generate();
const S = {
  cfg: { pos: "CB", def: "paired", th: { snap: 50, grade: 70 }, sigmaBeta: 1.0, sigmaB: 0.5 },
  staffEdits: {},          // id -> staff grade (live inputs from the staff)
  whatIf: {},              // id -> { film, ath, m1 } simulated overrides
  seq: {},                 // id -> { n, k } season-one games for the sequential update
  model: null, scores: {}, bt: null, lc: null,
  sort: "shift", jumpF: "all", onlyFlags: false, hideOutcomes: true,
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
const AGENT_OF = { "qbreal.load": "Data Intake Agent", "qbreal.fit": "Validation Agent", "player.update": "Portal Scoring Agent", "dataset.load": "Data Intake Agent", "model.fit": "Bayesian Fit Agent", "board.score": "Portal Scoring Agent", "player.score": "Portal Scoring Agent", "staff.eval": "Staff Evidence Agent", "staff.import": "Staff Evidence Agent", "whatif.simulate": "Scenario Agent", "backtest.run": "Validation Agent", "board.export": "Portal Scoring Agent", "chain.verify": "FuzeBox Verifier" };
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
    { n_transfers: m.n, tau_empirical_bayes: m.tau, newton_iterations: m.iters, base_rate: +m.base.toFixed(3), heldout_brier: S.bt ? +S.bt.full.met.brier.toFixed(4) : null, heldout_brier_rating_only: S.bt ? +S.bt.rating.met.brier.toFixed(4) : null, heldout_brier_staff_only: S.bt ? +S.bt.staff.met.brier.toFixed(4) : null, calibration_slope: S.bt ? +S.bt.full.met.slope.toFixed(3) : null, heldout_auc: S.bt ? +S.bt.full.met.auc.toFixed(3) : null, tau_dest: m.tauR?.[0], tau_origin: m.tauR?.[1], sigma_behavioral: S.cfg.sigmaB, predictors: m.keys, fit_ms: Math.round(ms) }, "estimate");
  await log("board.score", `Score ${S.cfg.pos} watch list`, { players: boardFor().length, draws_per_player: 3000 }, { top3: topN(3).map((p) => `${p.name} ${pts(S.scores[p.id].shift)} vs comparable moves`) }, "estimate");
  showBusy(false);
}
const topN = (n) => boardFor().sort((a, b) => S.scores[b.id].shift - S.scores[a.id].shift).slice(0, n);
function showBusy(on) { const b = $("#busy"); if (b) b.hidden = !on; }

// ---------------- formatting helpers ----------------
const P = () => POSITIONS[S.cfg.pos];
const fmtM = (spec, v) => (v === null || v === undefined ? "—" : spec.dec === 0 ? Math.round(v) + spec.unit : v.toFixed(spec.dec) + spec.unit);
const fmtRaw = (k, p) => {
  const v = p[k];
  if (k === "ath" && (v === null || v === undefined) && p.athRaw != null) return `<span class="dim">${p.athRaw.toFixed(2)} ${esc(p.athProto)} — excluded</span>`;
  if (v === null || v === undefined) return `<span class="dim">not available</span>`;
  if (k === "m1") return fmtM(P().m1, v);
  if (k === "m2") return fmtM(P().m2, v);
  if (k === "rating") return v.toFixed(4) + ` <span class="dim">(${p.stars}★)</span>`;
  if (k === "snap") return pct(v) + "%";
  if (k === "film") return v.toFixed(1);
  if (k === "ath") return v.toFixed(2) + ` <span class="dim">(electronic)</span>`;
  if (k === "gap") return (v >= 0 ? "+" : "") + v.toFixed(1) + ` <span class="dim">(${p.dir})</span>`;
  if (k === "ret") return pct(v) + "%";
  if (k === "inc") return String(v);
  if (k === "hc") return v ? "Yes" : "No";
  if (k === "inj") return v + " games";
  if (k === "elig") return v + (v === 1 ? " yr" : " yrs");
  if (k === "staff") return v.toFixed(1) + " / 5";
  return v;
};
const featLabel = (k) => (k === "m1" ? P().m1.k : k === "m2" ? P().m2.k : FEATURES.find((f) => f.k === k).label);
const vbadge = (k) => { const v = FEATURE_BY_KEY[k].valid; return `<span class="vb vb-${v.c}" title="Validity status">${esc(v.l)}</span>`; };
const verifBadge = (def) => { const v = DEFS[def].verif; return `<span class="vb vb-${v.c}">${esc(v.l)}</span>`; };
const sgn = (x, d = 0) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d);
const pts = (x) => sgn(x * 100) + " pts";
const FLAG_TXT = { extreme: "Outside 10–90%: individual calibration not yet shown", single: "One input drives most of the shift" };
const flagBadges = (s) => s.flags.map((f) => `<span class="badge b-flag" title="${FLAG_TXT[f]}">${f === "extreme" ? "Extreme" : "1 input"}</span>`).join(" ");
const badge = (c) => ({ heuristic: `<span class="badge b-heuristic">Heuristic index</span>`, observed: `<span class="badge b-observed">Observed</span>`, estimate: `<span class="badge b-estimate">Statistical estimate</span>`, hypothesis: `<span class="badge b-hypothesis">Hypothesis to evaluate</span>`, simulated: `<span class="badge b-simulated">Simulated</span>`, staff: `<span class="badge b-staff">Staff evaluation</span>` }[c] || "");
const tierBadge = (t) => `<span class="tier t-${t}">${t}</span>`;
function certainty(s) {
  const w = s.q90 - s.q10;
  return w < 0.15 ? { l: "High", c: "ok" } : w < 0.28 ? { l: "Medium", c: "mid" } : { l: "Low", c: "low" };
}
const PLAYER_KEYS = ALL_KEYS.filter((k) => !CONTEXT_KEYS.includes(k));
const completeness = (p) => PLAYER_KEYS.filter((k) => p[k] !== null && p[k] !== undefined).length;
const rankOf = (id) => boardFor().slice().sort((a, b) => S.scores[b.id].shift - S.scores[a.id].shift).findIndex((p) => p.id === id) + 1;

// ---------------- navigation ----------------
const NAV = [
  { k: "board", n: "1", label: "Portal Board" },
  { k: "player", n: "2", label: "Player Profile" },
  { k: "test", n: "3", label: "Known-Player Test" },
  { k: "qbreal", n: "4", label: "Real QB Backtest" },
  { k: "model", n: "4", label: "Model & Calibration" },
  { k: "validity", n: "5", label: "Validity Scorecard" },
  { k: "ontology", n: "5", label: "Portal Ontology" },
  { k: "research", n: "6", label: "Deep Research" },
  { k: "live", n: "7", label: "Live Portal Intel" },
  { k: "college", n: "8", label: "College Data" },
  { k: "setup", n: "9", label: "Pilot Design" },
  { k: "journal", n: "10", label: "Run Journal", fz: true },
];
const TITLES = {
  ...RP_TITLES,
  ...V5TITLES,
  ...V6TITLES,
  watch: ["Portal Watch", "Who might enter the January 2027 window, and who matches our needs once they do"],
  signals: ["Signal Test", "Dan's entry signals tested on real 2022–2026 rosters and portal classes"],
  board: ["Portal Board", "Board positions and shifts against comparable moves, with ranges — not verdicts"],
  player: ["Player Profile", "The log-odds evidence table first, then the shift from comparable moves"],
  test: ["Known-Player Test", "Walk-forward test on synthetic classes, led by calibration and Brier score against portal-rating-only and staff-grade-only models"],
  qbreal: ["Real QB Backtest", "Real quarterback transfers from CollegeFootballData.com: fit on 2022–2024 classes, tested on 2025"],
  model: ["Model & Calibration", "The Bayesian model, program effects, learned weights and pooling"],
  validity: ["Validity Scorecard", "Where the evidence stands on each of Messick's six validity aspects, and what the pilot must establish"],
  ontology: ["Portal Ontology", "The classes and links that turn portal data into evidence the model can use"],
  research: ["Deep Research", "A research agent that gathers cited public evidence on a player and hands it to the staff for review"],
  live: ["Live Portal Intel", "Live Perplexity web search and the 30 players most likely to enter the January 2027 portal, with sources"],
  college: ["College Data", "Real portal classes, observed base rates, Ohio State returning production and player usage and PPA from CollegeFootballData.com"],
  setup: ["Pilot Design", "A pre-registered, six-step validation design, the staff inputs and the data plan"],
  journal: ["FuzeBox Run Journal", "Append-only, hash-chained receipts for every fit, score and staff input"],
};
const V4 = [{ k: "watch", label: "Portal Watch" }, { k: "signals", label: "Signal Test" }];
const STAFF = new Set(["learn", "plan", "variance", "gaps", "tour", "faq", "glossary", "talk", "rooms", "lead", "bots", "devices", "watch", "signals", "roster", "likely", "live", "brief"]);
const MODE = { v: "staff" };
const visible = (k) => MODE.v === "analyst" || STAFF.has(k);
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  const [s, p] = h.split("/");
  return [V6NAV.some((n) => n.k === s) || V5NAV.some((n) => n.k === s) || V4.some((n) => n.k === s) || VNAV().some((n) => n.k === s) || isRP(s) ? s : "learn", p ? decodeURIComponent(p) : undefined];
}
const VNAV = () => NAV.filter((n) => n.k !== "college" || COLLEGE.health?.connected).map((n, i) => ({ ...n, n: String(i + 1) }));
function go(s, p) { location.hash = "#/" + s + (p ? "/" + encodeURIComponent(p) : ""); }

// ---------------- shell ----------------
function shell() {
  const [screen] = route();
  const groups = [...new Set(RP_NAV.map((n) => n.g))];
  $("#mode-sw").innerHTML = [["staff", "Staff"], ["analyst", "Analyst"]].map(([k, l]) => `<button data-mode="${k}" class="${MODE.v === k ? "on" : ""}" aria-pressed="${MODE.v === k}">${l}</button>`).join("");
  const b = (n, cls = "") => `<button data-go="${n.k}" class="${cls} ${screen === n.k ? "on" : ""}">${n.label}</button>`;
  const v4 = `<div class="nav-sec">How It Works · v6</div>` + V6NAV.map((n) => b(n)).join("") + `<div class="nav-sec">Coach Surfaces</div>` + V5NAV.map((n) => b(n)).join("") + `<div class="nav-sec">Portal Watch</div>` + V4.map((n) => b(n)).join("");
  const rpG = groups.map((g) => { const items = RP_NAV.filter((n) => n.g === g && visible(n.k)); return items.length ? `<div class="nav-sec">${g}</div>` + items.map((n) => b(n)).join("") : ""; }).join("");
  const lab = VNAV().filter((n) => !n.fz && visible(n.k)), fz = VNAV().filter((n) => n.fz && visible(n.k));
  $("#nav").innerHTML = v4 + rpG + (lab.length ? `<div class="nav-sec">Transfer Portal Lab</div>` + lab.map((n) => b(n)).join("") : "") + (fz.length ? `<div class="nav-sec">FuzeBox OS</div>` + fz.map((n) => b(n, "fz")).join("") : "") +
    (MODE.v === "staff" ? `<div class="nav-sec dim" style="text-transform:none;letter-spacing:0">Switch to Analyst for the model, backtests, ontology and the full recruiting platform.</div>` : "");
  $("#mnav").innerHTML = `<button data-mode="${MODE.v === "staff" ? "analyst" : "staff"}">${MODE.v === "staff" ? "Analyst ▸" : "◂ Staff"}</button>` + V6NAV.map((n) => b(n)).join("") + V5NAV.map((n) => b(n)).join("") + V4.map((n) => b(n)).join("") + RP_NAV.filter((n) => visible(n.k)).map((n) => b(n)).join("") + VNAV().filter((n) => visible(n.k)).map((n) => b(n, n.fz ? "fz" : "")).join("");
  document.body.classList.toggle("rp-on", isRP(screen));
  document.body.classList.toggle("v4-screen", ["watch", "signals", "talk", "rooms", "lead", "bots", "devices", "learn", "plan", "variance", "gaps", "tour", "faq", "glossary"].includes(screen));
  document.body.classList.toggle("v5-talkscreen", screen === "talk");
  const rb = $("#rp-bar"); if (rb) rb.innerHTML = rpBar();
  const [t, d] = TITLES[screen];
  $("#crumb").textContent = t; $("#crumb-sub").textContent = d;
  const pill = document.querySelector(".synthetic-pill"); if (pill) { pill.textContent = screen === "live" ? "Live web data" : screen === "college" || screen === "qbreal" || screen === "watch" || screen === "signals" ? "Real college data" : ["learn", "plan", "variance", "gaps", "tour", "faq", "glossary"].includes(screen) ? "How it works" : ["talk", "rooms", "lead", "bots", "devices"].includes(screen) ? "Voice · real + sample data" : isRP(screen) ? "Fictional players" : "Synthetic data"; pill.classList.toggle("live", ["live", "college", "watch", "signals", "qbreal"].includes(screen)); }
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
  const board = boardFor().slice().sort((a, b) => S.scores[b.id].shift - S.scores[a.id].shift);
  const pid = (param && board.find((b) => b.id === param)?.id) || S.research?.pid || board[0].id;
  const p = findPlayer(pid), s = S.scores[pid];
  const R0 = S.research && S.research.pid === pid ? S.research : null;
  const opts = board.map((b) => `<option value="${b.id}" ${b.id === pid ? "selected" : ""}>${esc(b.name)} · ${b.jump} · ${pts(S.scores[b.id].shift)}</option>`).join("");
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
          <div class="rs-pmeta">${tierBadge(p.tier)} ${esc(p.from)} · ${p.jump} · board position ${rankOf(pid)} · shift <b>${pts(s.shift)}</b> vs comparable moves</div>
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
  if (S.onlyFlags) rows = rows.filter((r) => r.dis || S.researchFlags[r.p.id] || r.s.flags.length);
  const key = { shift: (r) => r.s.shift, cons: (r) => r.s.shiftLo, up: (r) => r.s.shiftHi, cert: (r) => -(r.s.q90 - r.s.q10) }[S.sort] || ((r) => r.s.shift);
  rows.sort((a, b) => key(b) - key(a));
  const avgW = boardFor().reduce((a, p) => a + S.scores[p.id].q90 - S.scores[p.id].q10, 0) / boardFor().length;
  const nFlags = boardFor().filter((p) => disagreement(m, p, S.scores[p.id].std)).length;
  const nExt = boardFor().filter((p) => S.scores[p.id].flags.length).length;
  const best = bt ? [["portal rating only", bt.rating], ["staff grade only", bt.staff]].sort((x, y) => x[1].met.brier - y[1].met.brier)[0] : null;
  const kpis = `<div class="kpis">
    ${kpi("Watch list", boardFor().length, "", `${P().name} · synthetic · destination ${DEST_OSU}`)}
    ${kpi("Held-out Brier", bt ? bt.full.met.brier.toFixed(3) : "—", "", bt ? `vs ${best[1].met.brier.toFixed(3)} ${best[0]} · lower is better` : "needs 2+ labelled classes")}
    ${kpi("Calibration slope", bt ? bt.full.met.slope.toFixed(2) : "—", "", bt ? `1.00 = honest · ${bt.test} class held out` : "")}
    ${kpi("Comparable transfers", m.n, "", `${m.cycles.length} completed classes (${m.cycles.join(", ")})`)}
    ${kpi("Avg 80% range", pct(avgW), " pts", `includes ±${S.cfg.sigmaB.toFixed(2)} behavioral SD`)}
    ${kpi("Review queue", nFlags + nExt, "", `${nFlags} staff–model splits · ${nExt} range flags`)}
  </div>`;
  const steps = `<div class="how">
    <div class="how-step"><div class="hn">1</div><div><b>Comparable moves</b><p>How past transfers did on the same kind of move: level jump, program rating gap, destination and origin program, returning production and incoming competition.</p>${badge("estimate")}</div></div>
    <div class="how-step"><div class="hn">2</div><div><b>Player evidence</b><p>Opponent-adjusted production, film, electronically timed measurables, experience, availability and the staff's evaluation shift that base rate up or down.</p>${badge("observed")} ${badge("staff")}</div></div>
    <div class="how-step"><div class="hn">3</div><div><b>Board position</b><p>The output is a shift against comparable moves and a place on the board, with a range that includes behavioral and post-decision variance. It is not a verdict on one player.</p>${badge("estimate")}</div></div>
  </div>`;
  const table = `<section class="card">
    <div class="card-h"><div><h3>${esc(P().name)} · pre-window watch list</h3><p>Success = ${esc(defText(S.cfg.def, S.cfg.th))} ${verifBadge(S.cfg.def)}. Shift = this player's estimate minus the base rate for comparable moves to ${DEST_OSU}. Bar shows the estimate against a dashed base-rate marker.</p></div><div class="sp"></div>
      <div class="filters">
        <div class="field"><label for="f-sort">Rank by</label><select id="f-sort">
          ${[["shift", "Shift vs comparable moves"], ["cons", "Conservative (10th pct)"], ["up", "Upside (90th pct)"], ["cert", "Most certain"]].map(([k, l]) => `<option value="${k}" ${S.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field"><label for="f-jump">Level jump</label><select id="f-jump"><option value="all">All</option>${JUMPS.map((j) => `<option ${S.jumpF === j ? "selected" : ""}>${j}</option>`).join("")}</select></div>
        <label class="chk"><input type="checkbox" id="f-flags" ${S.onlyFlags ? "checked" : ""}/> Review queue only</label>
        <button class="btn sm" data-act="export">Export CSV</button>
        <label class="btn sm" for="csv-in">Import staff grades</label><input type="file" id="csv-in" accept=".csv,text/csv" hidden/>
      </div></div>
    <div class="scroll-x"><table class="t board">
      <thead><tr><th>Board</th><th>Player</th><th>From</th><th class="n">Gap</th><th class="n">${esc(P().m1.k)}</th><th class="n">Film</th><th>Staff grade</th><th>Estimate vs base</th><th class="n">Shift</th><th class="n">80% range</th><th>Certainty</th><th>Evidence</th></tr></thead>
      <tbody>${rows.map((r, i) => {
        const c = certainty(r.s);
        return `<tr class="${r.dis ? "flag" : ""}">
          <td class="n"><b>${i + 1}</b></td>
          <td><button class="lnk" data-player="${r.p.id}"><b>${esc(r.p.name)}</b></button><div class="mono dim">${r.p.id} · ${r.p.elig} yr${r.p.elig === 1 ? "" : "s"}</div></td>
          <td class="from">${tierBadge(r.p.tier)} ${esc(r.p.from)}</td>
          <td class="n mono">${sgn(r.p.gap, 1)}</td>
          <td class="n">${fmtM(P().m1, r.p.m1)}</td>
          <td class="n">${r.p.film === null || activeKeys(S.cfg).indexOf("film") < 0 ? '<span class="dim">—</span>' : r.p.film.toFixed(1)}</td>
          <td><select class="staff-sel" style="width:84px" data-staff="${r.p.id}" aria-label="Staff grade for ${esc(r.p.name)}"><option value="">None</option>${[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => `<option value="${v}" ${r.p.staff === v ? "selected" : ""}>${v.toFixed(1)}</option>`).join("")}</select></td>
          <td>${C.intervalBar(r.s, r.s.base, 136)}</td>
          <td class="n ${r.s.shift >= 0 ? "pos" : "neg"}"><b>${pts(r.s.shift)}</b></td>
          <td class="n">${sgn(r.s.shiftLo * 100)} to ${sgn(r.s.shiftHi * 100)}</td>
          <td><span class="cert c-${c.c}">${c.l}</span></td>
          <td><span class="evid">${completeness(r.p)}/${PLAYER_KEYS.length}</span>${r.dis || S.researchFlags[r.p.id] ? ` <span class="badge b-hypothesis" title="${S.researchFlags[r.p.id] ? "Queued from Deep Research" : "Staff grade pulls against the rest of the evidence"}">Film review</span>` : ""} ${flagBadges(r.s)}</td></tr>`;
      }).join("")}</tbody></table></div>
    ${rows.length ? "" : `<div class="empty">No players match these filters.</div>`}
  </section>`;
  const banner = `<div class="callout"><b>Read this board as positions, not verdicts.</b> All players and outcomes are synthetic. Real players are not scored by this model. Synthetic held-out scores run higher than the 0.64–0.71 AUC range the literature suggests is realistic for real transfers, because the generator's structure is known. Estimates above 90% or below 10% are flagged until individual-level calibration is shown on real outcomes.</div>`;
  const R0 = rng(77), means = boardFor().map((p) => S.scores[p.id].mean), sims = [];
  for (let i = 0; i < 2000; i++) sims.push(means.reduce((a, q) => a + (R0.u() < q ? 1 : 0), 0));
  sims.sort((a, b) => a - b);
  const outlook = `<section class="card card-pad" style="margin-bottom:14px"><div class="card-h"><div><h3>Class-level outlook</h3><p>Expected number of these ${means.length} ${esc(P().name.toLowerCase())} transfers who meet the success definition, with an 80% range from 2,000 simulated classes. Steadier than any single player's number.</p></div></div><div class="rp-calc">Σ player estimates = <b>${means.reduce((a, b) => a + b, 0).toFixed(1)}</b> expected · 80% range ${sims[200]}–${sims[1800]}</div><div class="callout sim" style="margin-top:10px"><b>Not market value.</b> These are chances of on-field outcomes on synthetic data. They should not set NIL or revenue-sharing pay.</div></section>`;
  return banner + kpis + outlook + steps + table + `<p class="note" style="margin-top:12px">Change a staff grade in the table and the player is re-scored instantly and written to the Run Journal. A "Film review" flag means the staff grade and the rest of the evidence point in opposite directions — a film question, not a verdict.</p>`;
}
const kpi = (l, v, u, s) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}${u ? `<small>${u}</small>` : ""}</div><div class="s">${s}</div></div>`;

function pagePlayer(id) {
  const board = boardFor();
  const p = (id && findPlayer(id)) || board.sort((a, b) => S.scores[b.id].shift - S.scores[a.id].shift)[0];
  const m = S.model;
  const isBoard = !!S.scores[p.id];
  const s = isBoard ? S.scores[p.id] : scorePlayer(m, p);
  const steps = waterfall(m, p, s.std);
  // comparable-move base distribution: sample the base log-odds with its posterior SD
  const R = rng(11), g = JUMPS.indexOf(p.jump), sd = Math.sqrt(m.cov[1 + g][1 + g]);
  const baseDraws = Array.from({ length: 3000 }, () => sigmoid(s.baseEta + sd * R.n() + S.cfg.sigmaB * R.n()));
  const comps = comparables(DATA.history, m, S.cfg, p, s.std);
  const dis = disagreement(m, p, s.std);
  const gc = m.groupCounts[g];
  const wi = S.whatIf[p.id];
  let sim = null, simRank = null;
  if (wi) {
    const q = { ...p, ...wi }; sim = scorePlayer(m, q);
    simRank = boardFor().filter((x) => x.id !== p.id && S.scores[x.id].shift > sim.shift).length + 1;
  }
  const c = certainty(s);
  const missing = activeKeys(S.cfg).filter((k) => !CONTEXT_KEYS.includes(k) && (p[k] === null || p[k] === undefined));
  const rank = isBoard ? rankOf(p.id) : null;
  const allParts = steps.flatMap((st) => st.parts.map((x) => ({ ...x, step: st.name })));
  const evRows = allParts.map((x) => `<tr class="${x.block === "Program context" ? "ctx" : ""}">
      <td>${esc(x.step === "Comparable moves" ? "Move context" : x.step)}</td><td>${esc(featLabel(x.k))}</td><td class="n">${fmtRaw(x.k, p)}</td>
      <td class="n">${x.imputed ? '<span class="dim">imputed</span> ' : ""}${x.z >= 0 ? "+" : ""}${x.z.toFixed(2)}</td>
      <td class="n">${x.beta >= 0 ? "+" : ""}${x.beta.toFixed(2)} <span class="dim">± ${x.sd.toFixed(2)}</span></td>
      <td class="n ${x.contrib >= 0 ? "pos" : "neg"}"><b>${x.contrib >= 0 ? "+" : ""}${x.contrib.toFixed(2)}</b></td>
      <td>${x.imputed ? badge("estimate") : x.k === "staff" ? badge("staff") : badge("observed")}<div class="dim small">${esc(FEATURE_BY_KEY[x.k].prov)}</div></td>
      <td>${vbadge(x.k)}</td></tr>`).join("");
  const playerSum = allParts.filter((x) => x.block !== "Program context").reduce((a, x) => a + x.contrib, 0);
  const opts = board.slice().sort((a, b) => a.name.localeCompare(b.name)).map((b) => `<option value="${b.id}" ${b.id === p.id ? "selected" : ""}>${esc(b.name)} · ${b.jump}</option>`).join("");
  const wM = s.widthParamOnly, wX = Math.max(0, s.widthNoBehav - s.widthParamOnly), wB = Math.max(0, (s.q90 - s.q10) - s.widthNoBehav);
  const seq = S.seq[p.id];
  let seqOut = "";
  if (isBoard && seq) {
    // Beta prior matched to the estimate's draws, updated with games in which he held the role
    const mu = s.draws.reduce((a, b) => a + b, 0) / s.draws.length, v = s.draws.reduce((a, b) => a + (b - mu) ** 2, 0) / s.draws.length;
    const k0 = Math.max(2, mu * (1 - mu) / Math.max(1e-4, v) - 1), a0 = mu * k0, b0 = (1 - mu) * k0;
    const a1 = a0 + seq.k, b1 = b0 + (seq.n - seq.k), m1 = a1 / (a1 + b1);
    seqOut = `<div class="sim-out">Prior ${pct(mu)}% (worth ${k0.toFixed(1)} games of evidence) + ${seq.k} of ${seq.n} games in the role → <b>${pct(m1)}%</b>. Beta(${a0.toFixed(1)}, ${b0.toFixed(1)}) → Beta(${a1.toFixed(1)}, ${b1.toFixed(1)}).</div>`;
  }
  return `
  <div class="ph">
    <div><div class="eyebrow">${esc(P().name)} · ${isBoard ? "January 2027 watch list" : `${p.cycle} class (history)`} · <span class="mono">${p.id}</span></div>
      <h1 class="pname">${esc(p.name)}</h1>
      <div class="pmeta">${tierBadge(p.tier)} ${esc(p.from)} → ${esc(p.dest)} <span class="dot">·</span> ${JUMP_LONG[p.jump]}, rating gap ${sgn(p.gap, 1)} (${p.dir}) <span class="dot">·</span> ${p.elig} yr${p.elig > 1 ? "s" : ""} eligibility <span class="dot">·</span> ${Math.floor(p.height / 12)}'${p.height % 12}" ${p.weight} lb <span class="dot">·</span> portal rating ${p.rating.toFixed(4)} (${p.stars}★)</div></div>
    <div class="field"><label for="pick">Switch player</label><select id="pick">${opts}</select></div>
  </div>
  <div class="grid g-side">
    <div class="grid">
      <section class="card">
        <div class="card-h"><div><h3>Evidence behind the estimate</h3><p>Read this first. z = standard deviations from the comparable-transfer average. Contribution = learned weight × z, in log-odds. Move-context rows set the comparable-move base rate; the other rows add up to the player's shift (${playerSum >= 0 ? "+" : ""}${playerSum.toFixed(2)} log-odds).</p></div></div>
        <div class="callout noncausal"><b>Associations, not causes.</b> A positive weight means past transfers with higher values on this input met the success definition more often. It does not mean that raising this player's value would raise his chance, and the weights are not effects of coaching or development.</div>
        <div class="scroll-x"><table class="t"><thead><tr><th>Block</th><th>Input</th><th class="n">Value</th><th class="n">z vs cohort</th><th class="n">Learned weight</th><th class="n">Contribution</th><th>Provenance</th><th>Validity status</th></tr></thead><tbody>${evRows}</tbody></table></div>
        ${activeKeys(S.cfg).includes("film") ? "" : `<p class="note" style="padding:0 16px 12px">The film grade is left out under this success definition, because the criterion is a grade from the same provider (Assessment, Recommendation 2).</p>`}
      </section>
      <section class="card card-pad">
        <div class="card-h"><div><h3>Shift against comparable moves</h3><p>${esc(defText(S.cfg.def, S.cfg.th))}</p></div><div class="sp"></div>${badge("estimate")} ${verifBadge(S.cfg.def)}</div>
        <div class="post">
          <div class="post-big"><div class="pb ${s.shift >= 0 ? "pos" : "neg"}">${sgn(s.shift * 100)}<small> pts</small></div><div class="ps">vs comparable-move base rate <b>${pct(s.base)}%</b><br/>80% range of shift <b>${sgn(s.shiftLo * 100)} to ${sgn(s.shiftHi * 100)}</b><br/>${rank ? `Board position <b>${rank} of ${boardFor().length}</b><br/>` : ""}Estimate ${pct(s.mean)}% (${pct(s.q10)}–${pct(s.q90)}%) · Certainty <span class="cert c-${c.c}">${c.l}</span>${s.flags.length ? `<br/>${flagBadges(s)}` : ""}</div></div>
          <div class="post-chart">${C.density(s.draws, baseDraws)}<div class="legend"><span><i style="background:#c9ccd2"></i>Comparable moves to ${esc(p.dest)}</span><span><i style="background:#ba0c2f"></i>This player after his evidence</span></div></div>
        </div>
        ${s.flags.includes("extreme") ? `<div class="callout" style="margin-top:10px"><b>Flagged, not capped.</b> The estimate is outside 10–90%. No individual-level calibration on real outcomes exists yet, so treat it as "well above / well below comparable moves" rather than as a near-certainty.</div>` : ""}
      </section>
      <section class="card card-pad">
        <div class="card-h"><div><h3>Same evidence in percentage points</h3><p>Secondary view. Each block moves the odds from the comparable-move base; the order of blocks changes the point steps but not the end result.</p></div></div>
        ${C.waterfallChart(steps, s)}
        <p class="note">Level-jump cohort: ${gc.k} of ${gc.n} comparable ${p.jump} ${esc(S.cfg.pos)} transfers succeeded (${pct(gc.k / Math.max(1, gc.n))}% observed). With this move's rating gap, destination and roster context the base rate is ${pct(steps[0].p)}%.</p>
      </section>
      <section class="card">
        <div class="card-h"><div><h3>Comparable transfers</h3><p>Nearest past ${p.jump} ${esc(S.cfg.pos)} transfers on the same evidence, with what actually happened and their outcome class.</p></div><div class="sp"></div>${badge("observed")}</div>
        <div class="scroll-x"><table class="t"><thead><tr><th>Player</th><th>Class</th><th>Move</th><th class="n">${esc(P().m1.k)}</th><th class="n">Snaps before → after</th><th class="n">Contribution</th><th>Outcome class</th><th>Met definition</th></tr></thead>
        <tbody>${comps.map((x) => `<tr><td><button class="lnk" data-player="${x.h.id}">${esc(x.h.name)}</button></td><td class="mono">${x.h.cycle}</td><td>${tierBadge(x.h.tier)} ${esc(x.h.from)} → ${esc(x.h.dest)} <span class="dim">(${x.h.dir})</span></td><td class="n">${fmtM(P().m1, x.h.m1)}</td><td class="n">${pct(x.h.snap)}% → ${pct(x.h.out.snapShare1)}%</td><td class="n">${sgn(x.h.out.contrib1, 2)}</td><td>${esc(x.h.out.cls)}</td><td>${x.y ? '<span class="badge b-ok">Met</span>' : '<span class="badge b-bad">Not met</span>'}</td></tr>`).join("")}</tbody></table></div>
      </section>
    </div>
    <div class="grid" style="align-content:start">
      ${isBoard ? `<section class="card card-pad">
        <div class="card-h"><div><h3>Your staff's evaluation</h3><p>Enters as evidence with a learned weight. Its reliability is unmeasured until the inter-rater study (Pilot Design, step 2).</p></div></div>
        <div class="staff-in"><input type="range" id="staff-r" min="1" max="5" step="0.5" value="${p.staff ?? 3}" ${p.staff === null || p.staff === undefined ? 'data-empty="1"' : ""}/><output id="staff-o">${p.staff === null || p.staff === undefined ? "Not graded" : p.staff.toFixed(1)}</output></div>
        <div class="row-btns"><button class="btn primary sm" data-act="staff-apply" data-id="${p.id}">Apply grade</button><button class="btn sm" data-act="staff-clear" data-id="${p.id}">Clear</button></div>
        ${dis ? `<div class="callout" style="margin-top:10px"><b>Film review queued.</b> Your grade pulls ${dis.staffC > 0 ? "up" : "down"} while the rest of the evidence pulls ${dis.rest > 0 ? "up" : "down"}. Without the staff grade the estimate is ${pct(dis.pNoStaff)}%.</div>` : ""}
      </section>` : `<div class="callout fz">Historical player — outcome is known (${esc(p.out.cls)}). Staff inputs are only enabled for the live watch list.</div>`}
      ${isBoard ? `<section class="card card-pad">
        <div class="card-h"><div><h3>Deep research</h3><p>Send a research agent for cited public evidence on this player. Findings wait for staff review before they touch the model.</p></div></div>
        ${S.research && S.research.pid === p.id && S.research.done ? `<div class="note" style="margin:0 0 8px">${S.research.findings.length} findings · ${Object.values(S.research.decisions).filter((d) => d === "accept").length} accepted</div>` : ""}
        <div class="row-btns" style="margin-top:0"><button class="btn primary sm" data-act="research-open" data-id="${p.id}">Research this player</button></div>
      </section>` : ""}
      <section class="card card-pad">
        <div class="card-h"><div><h3>Why the range is this wide</h3><p>Three sources of uncertainty, separated.</p></div></div>
        <div class="unc three"><div><span>Model uncertainty</span><b>${pct(wM)} pts</b><em>shrinks with more portal cycles</em></div><div><span>Missing evidence</span><b>${pct(wX)} pts</b><em>${missing.length ? "shrinks when we collect: " + missing.map(featLabel).join(", ") : "none — full evidence on file"}</em></div><div><span>Behavioral and post-decision</span><b>${pct(wB)} pts</b><em>fit, adjustment, NIL, coaching changes; σ = ${S.cfg.sigmaB.toFixed(2)} log-odds, an assumption until estimated on real outcomes</em></div></div>
      </section>
      ${isBoard ? `<section class="card card-pad">
        <div class="card-h"><div><h3>After he arrives</h3><p>Sequential update once season-one games are played (Recommendation 7). Simple illustration: games in which he held the role.</p></div><div class="sp"></div>${badge("estimate")}</div>
        <div class="wi"><label for="sq-n">Games played</label><input type="range" id="sq-n" min="0" max="12" step="1" value="${seq?.n ?? 4}"/><output id="sqo-n">${seq?.n ?? 4}</output></div>
        <div class="wi"><label for="sq-k">Games in the role</label><input type="range" id="sq-k" min="0" max="12" step="1" value="${seq?.k ?? 2}"/><output id="sqo-k">${seq?.k ?? 2}</output></div>
        <div class="row-btns"><button class="btn sm" data-act="seq-run" data-id="${p.id}">Update</button>${seq ? `<button class="btn sm" data-act="seq-clear" data-id="${p.id}">Clear</button>` : ""}</div>
        ${seqOut}
      </section>` : ""}
      ${isBoard ? `<section class="card card-pad ${wi ? "sim-on" : ""}">
        <div class="card-h"><div><h3>What-if</h3><p>Compare him with similar past players who had different values. Kept separate from the observed record.</p></div><div class="sp"></div>${badge("simulated")}</div>
        ${wi ? `<div class="sim-banner">SIMULATED — NOT THIS PLAYER'S RECORD · A COMPARISON WITH SIMILAR PLAYERS, NOT A WITHIN-PLAYER EFFECT</div>` : ""}
        ${activeKeys(S.cfg).includes("film") ? whatIfSlider("film", "Film grade", 40, 95, 0.5, wi?.film ?? p.film ?? 68) : `<p class="note small">Film grade is removed from the model under this definition (same-provider rule).</p>`}
        ${whatIfSlider("ath", "Athletic composite (electronic)", 1, 10, 0.1, wi?.ath ?? p.ath ?? 6.4)}
        ${whatIfSlider("inj", "Games missed", 0, 14, 1, wi?.inj ?? p.inj)}
        <div class="row-btns"><button class="btn sm" data-act="sim-run" data-id="${p.id}">Simulate</button>${wi ? `<button class="btn sm" data-act="sim-clear" data-id="${p.id}">Clear simulation</button>` : ""}</div>
        ${sim ? `<div class="sim-out">Past transfers on comparable moves with these values sat at a shift of <b>${pts(sim.shift)}</b> (board position ${simRank} of ${boardFor().length}), against his observed ${pts(s.shift)} (position ${rank}). This says how differently such players fared; it is not a prediction of what would happen if he himself improved.</div>` : ""}
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
    [`te:${p.id}`, "pl:levelJump", `jump:${p.jump}`], [`te:${p.id}`, "pl:toProgram", `prog:${p.dest}`], [`te:${p.id}`, "pl:ratingGap", String(p.gap)], [`te:${p.id}`, "pl:moveDirection", p.dir], [`te:${p.id}`, "pl:window", p.cycle === 2027 ? "2027 window (Jan 4, 2027)" : `${p.cycle} class`],
    [`sp:${p.id}`, "pl:" + (P().m1.k.replace(/[^A-Za-z]/g, "")), String(p.m1)],
  ];
  if (p.film !== null) T.push([`fg:${p.id}`, "pl:filmGrade", String(p.film)]);
  if (p.athProto) T.push([`ms:${p.id}`, "pl:timingProtocol", p.athProto]);
  if (p.out) T.push([`oc:${p.id}`, "pl:outcomeClass", p.out.cls]);
  if (p.staff !== null && p.staff !== undefined) T.push([`se:${p.id}`, "pl:staffGrade", String(p.staff)]);
  if (S.scores[p.id]) T.push([`est:${p.id}`, "pl:shiftVsComparableMoves", (S.scores[p.id].shift).toFixed(3)], [`est:${p.id}`, "pl:boardPosition", String(rankOf(p.id))], [`est:${p.id}`, "pl:underDefinition", `def:${S.cfg.def}@v2`], [`est:${p.id}`, "fz:recordedIn", "fz:RunJournal"]);
  return T;
}

function outcomeGrid(rows) {
  const dirs = ["Up", "Lateral", "Down"], bands = ["More", "Similar", "Less"];
  const cnt = {}; for (const p of rows) { const k = p.dir + "|" + playBand(p); cnt[k] = (cnt[k] || 0) + 1; }
  const tot = rows.length || 1;
  return `<table class="t grid3"><thead><tr><th>Move direction</th><th>More play and contribution</th><th>Similar</th><th>Less</th></tr></thead><tbody>${dirs.map((d) => `<tr><th>${d}</th>${bands.map((b) => { const n = cnt[d + "|" + b] || 0; return `<td class="g3 g3-${b}"><b>${esc(OUTCOME_GRID[d][b])}</b><span>${n} · ${pct(n / tot)}%</span></td>`; }).join("")}</tr>`).join("")}</tbody></table>`;
}
function pageTest() {
  const bt = S.bt;
  if (!bt) return `<div class="callout">This success definition has fewer than two labelled classes for ${esc(P().name)}, so there is nothing to hold out yet. Two-year retention needs two completed seasons.</div>`;
  const rows = bt.rows.map((p, i) => ({ p, pr: bt.full.ps[i], y: bt.ys[i] })).sort((a, b) => b.pr - a.pr);
  const ci = (x, k) => `<span class="dim small">${x.ci[k][0].toFixed(3)}–${x.ci[k][1].toFixed(3)}</span>`;
  const met = (x) => `<td class="n"><b>${x.met.brier.toFixed(3)}</b><br/>${ci(x, "brier")}</td><td class="n">${x.met.slope.toFixed(2)}</td><td class="n">${x.met.ece.toFixed(3)}</td><td class="n">${x.met.logloss.toFixed(3)}</td><td class="n">${x.met.auc.toFixed(3)}<br/>${ci(x, "auc")}</td>`;
  const top20 = rows.slice(0, 20), hit = top20.filter((r) => r.y).length;
  const staffHurts = bt.noStaff.met.auc > bt.full.met.auc;
  const ratingBeats = bt.rating.met.brier < bt.full.met.brier;
  const foldRows = bt.folds.map((f) => `<tr><td class="mono">${f.train.join(" + ")} → ${f.test}</td><td class="n">${f.rows.length}</td><td class="n">${f.full.met.brier.toFixed(3)}</td><td class="n">${f.rating.met.brier.toFixed(3)}</td><td class="n">${f.staff.met.brier.toFixed(3)}</td><td class="n">${f.full.met.slope.toFixed(2)}</td><td class="n">${f.full.met.auc.toFixed(3)}</td></tr>`).join("");
  return `
  <div class="callout fz"><b>How to use this with your staff.</b> Walk-forward: the model is fitted only on classes before each test class, then rolled forward one class at a time. The last fold fits on ${bt.train.join(" + ")} and scores the ${bt.test} class before any of them played a snap at the new school. Keep outcomes hidden, have the staff rank the players they know blind, then reveal.</div>
  <div class="callout" style="margin-top:10px"><b>Synthetic data, honest reading.</b> These players are generated from a known structure, so discrimination runs higher than the realistic 0.64–0.71 AUC range for real transfers. The headline is therefore calibration and Brier score against the portal-rating-only and staff-grade-only models, not AUC over a level-jump baseline.${staffHurts ? ` On this fold, adding staff grades <b>lowers</b> AUC (${bt.full.met.auc.toFixed(3)} with vs ${bt.noStaff.met.auc.toFixed(3)} without) — a reminder that an unmeasured instrument can add noise.` : ""}${ratingBeats ? ` Portal rating alone has a <b>lower</b> Brier score than the full model here (${bt.rating.met.brier.toFixed(3)} vs ${bt.full.met.brier.toFixed(3)}); the extra inputs have not earned their place for this group.` : ""}</div>
  <div class="kpis" style="margin-top:14px">
    ${kpi("Brier score", bt.full.met.brier.toFixed(3), "", `rating-only ${bt.rating.met.brier.toFixed(3)} · staff-only ${bt.staff.met.brier.toFixed(3)}`)}
    ${kpi("Calibration slope", bt.full.met.slope.toFixed(2), "", "1.00 = honest; below 1 = overconfident")}
    ${kpi("Calibration error", bt.full.met.ece.toFixed(3), "", "mean gap, predicted vs observed")}
    ${kpi("Top-20 hit rate", pct(hit / 20), "%", `vs ${pct(bt.full.met.base)}% base rate`)}
    ${kpi("AUC", bt.full.met.auc.toFixed(2), "", `90% bootstrap ${bt.full.ci.auc[0].toFixed(2)}–${bt.full.ci.auc[1].toFixed(2)}`)}
  </div>
  <div class="grid g2">
    <section class="card card-pad"><div class="card-h"><div><h3>Calibration on the held-out class</h3><p>When the model says 60%, do about 60% succeed? Points near the dashed line = honest probabilities.</p></div></div>
      <div class="cal-wrap">${C.calibration([{ bins: bt.rating.met.bins, color: "#9aa0a8" }, { bins: bt.full.met.bins, color: "#ba0c2f" }])}
      <div class="legend v"><span><i style="background:#ba0c2f"></i>Full Bayesian model</span><span><i style="background:#9aa0a8"></i>Portal rating only</span></div></div></section>
    <section class="card"><div class="card-h"><div><h3>Incremental value over simpler models</h3><p>Same held-out ${bt.test} class, same success definition. Brier and AUC with 90% bootstrap intervals.</p></div></div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Approach</th><th class="n">Brier</th><th class="n">Cal. slope</th><th class="n">Cal. error</th><th class="n">Log loss</th><th class="n">AUC</th></tr></thead><tbody>
      <tr><td><b>Full Bayesian model</b></td>${met(bt.full)}</tr>
      <tr><td>Portal rating only (+ move context)</td>${met(bt.rating)}</tr>
      <tr><td>Staff grade only (+ move context)</td>${met(bt.staff)}</tr>
      <tr><td>Without staff evaluations</td>${met(bt.noStaff)}</tr>
      <tr><td class="dim">Move context only (reference)</td>${met(bt.baseline)}</tr></tbody></table></div>
      <p class="note" style="padding:0 16px 14px">The comparison that matters is the full model against the portal-rating-only and staff-grade-only rows. Overlapping intervals mean the difference is not established on one class.</p></section>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <section class="card"><div class="card-h"><div><h3>Walk-forward folds</h3><p>Each row fits only on earlier classes.</p></div></div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Train → test</th><th class="n">n</th><th class="n">Brier full</th><th class="n">Brier rating-only</th><th class="n">Brier staff-only</th><th class="n">Cal. slope</th><th class="n">AUC</th></tr></thead><tbody>${foldRows}</tbody></table></div></section>
    <section class="card"><div class="card-h"><div><h3>Staff grades against a criterion the staff does not control</h3><p>Opportunity is partly decided by the staff that gave the grade. Judged on level-adjusted contribution alone (Recommendation 6):</p></div></div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Approach · contribution-only criterion</th><th class="n">Brier</th><th class="n">AUC</th></tr></thead><tbody>
      <tr><td>Full model</td><td class="n">${bt.fullContrib.met.brier.toFixed(3)}</td><td class="n">${bt.fullContrib.met.auc.toFixed(3)}</td></tr>
      <tr><td>Portal rating only</td><td class="n">${bt.ratingContrib.met.brier.toFixed(3)}</td><td class="n">${bt.ratingContrib.met.auc.toFixed(3)}</td></tr>
      <tr><td>Staff grade only</td><td class="n">${bt.staffContrib.met.brier.toFixed(3)}</td><td class="n">${bt.staffContrib.met.auc.toFixed(3)}</td></tr></tbody></table></div>
      <p class="note" style="padding:0 16px 14px">By move direction, full model on the ${bt.test} class: ${bt.byDir.map((d) => `${d.dir} n=${d.n}${d.met ? `, Brier ${d.met.brier.toFixed(3)}` : " (too few)"}`).join(" · ")}.</p></section>
  </div>
  <section class="card card-pad" style="margin-top:14px"><div class="card-h"><div><h3>What actually happened · ${bt.test} class outcome classes</h3><p>Success has two dimensions: the direction of the move and the play and level-adjusted contribution delivered (Assessment, Table 8). The current definition — ${esc(defText(S.cfg.def, S.cfg.th))} — is one region of this grid.</p></div></div>
    ${outcomeGrid(bt.rows)}</section>
  <section class="card" style="margin-top:14px">
    <div class="card-h"><div><h3>${bt.test} class · ranked by what the model said beforehand</h3><p>Outcomes ${S.hideOutcomes ? "hidden" : "shown"}.</p></div><div class="sp"></div><button class="btn sm ${S.hideOutcomes ? "primary" : ""}" data-act="reveal">${S.hideOutcomes ? "Reveal outcomes" : "Hide outcomes"}</button></div>
    <div class="scroll-x"><table class="t"><thead><tr><th>#</th><th>Player</th><th>Move</th><th class="n">Predicted</th><th class="n">Snaps before → after</th><th class="n">Contribution</th><th>Outcome class</th><th>Met</th></tr></thead><tbody>
      ${rows.slice(0, 40).map((r, i) => `<tr><td class="n">${i + 1}</td><td><button class="lnk" data-player="${r.p.id}">${esc(r.p.name)}</button></td><td>${tierBadge(r.p.tier)} ${esc(r.p.from)} → ${esc(r.p.dest)} <span class="dim">(${r.p.dir})</span></td><td class="n"><b>${pct(r.pr)}%</b></td>
      ${S.hideOutcomes ? `<td class="n dim">hidden</td><td class="n dim">hidden</td><td class="dim">hidden</td><td class="dim">hidden</td>` : `<td class="n">${pct(r.p.snap)}% → ${pct(r.p.out.snapShare1)}%</td><td class="n">${sgn(r.p.out.contrib1, 2)}</td><td>${esc(r.p.out.cls)}</td><td>${r.y ? '<span class="badge b-ok">Met</span>' : '<span class="badge b-bad">Not met</span>'}</td>`}</tr>`).join("")}
    </tbody></table></div><p class="note" style="padding:8px 16px 14px">Showing the top 40 of ${rows.length}. In the pilot this list is real transfers — players your staff already has an opinion on. See Real QB Backtest for the first real-data version.</p></section>`;
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
        <div>logit(<span class="mv">p<sub>i</sub></span>) = <span class="mv">α</span><sub>jump(i)</sub> + <span class="mv">u</span><sub>dest(i)</sub> + <span class="mv">v</span><sub>origin(i)</sub> + Σ<sub>k</sub> <span class="mv">β<sub>k</sub></span> · <span class="mv">x<sub>ik</sub></span> &nbsp;&nbsp;— comparable move + evidence</div>
        <div><span class="mv">α</span><sub>j</sub> ~ Normal(<span class="mv">μ</span>, <span class="mv">τ</span>²) &nbsp;&nbsp;— level jumps share strength (partial pooling)</div>
        <div><span class="mv">u</span><sub>d</sub> ~ Normal(0, <span class="mv">τ</span><sub>dest</sub>²), <span class="mv">v</span><sub>o</sub> ~ Normal(0, <span class="mv">τ</span><sub>origin</sub>²) &nbsp;&nbsp;— crossed program effects</div>
        <div><span class="mv">x</span> includes the continuous rating gap, returning production, incoming same-position transfers and head-coach change</div>
        <div>reported range: logit <span class="mv">p̃</span> = logit <span class="mv">p</span> + <span class="mv">ε</span>, <span class="mv">ε</span> ~ Normal(0, <span class="mv">σ</span><sub>B</sub>²) &nbsp;&nbsp;— behavioral / post-decision variance</div>
        <div><span class="mv">μ</span> ~ Normal(logit 0.40, 1.5²) · <span class="mv">β<sub>k</sub></span> ~ Normal(0, ${S.cfg.sigmaBeta.toFixed(2)}²)</div>
        <div><span class="mv">x</span><sub>missing</sub> | <span class="mv">x</span><sub>observed</sub> ~ conditional Normal from the cohort covariance</div>
      </div>
      <div class="specs">
        <div><span>Posterior</span><b>Laplace approximation (Newton MAP + inverse Hessian), ${m.iters} iterations</b></div>
        <div><span>τ (pooling strength)</span><b>${m.tau} — chosen by empirical Bayes (max marginal likelihood)</b></div>
        <div><span>Program effects</span><b>τ<sub>dest</sub> ${m.tauR[0]} across ${Object.keys(m.reCounts[0]).length} destinations · τ<sub>origin</sub> ${m.tauR[1]} across ${Object.keys(m.reCounts[1]).length} origins (empirical Bayes)</b></div>
        <div><span>Behavioral SD σ<sub>B</sub></span><b>${S.cfg.sigmaB.toFixed(2)} log-odds — widens individual ranges; a stated assumption until estimated on real outcomes</b></div>
        <div><span>Prediction</span><b>3,000 Monte Carlo draws per player over parameters and missing evidence</b></div>
        <div><span>Training data</span><b>${m.n} labelled ${esc(S.cfg.pos)} transfers · classes ${m.cycles.join(", ")}</b></div>
        <div><span>Fit time</span><b>${Math.round(m.fitMs)} ms in-browser · 0 LLM tokens</b></div>
      </div>
      <div class="field" style="margin-top:12px"><label for="sb">Prior strength on evidence weights (σ<sub>β</sub>): <b id="sb-o">${S.cfg.sigmaBeta.toFixed(2)}</b> — smaller = more skeptical of evidence</label><input type="range" id="sb" min="0.15" max="2.5" step="0.05" value="${S.cfg.sigmaBeta}"/></div>
      <div class="field" style="margin-top:12px"><label for="sbh">Behavioral and post-decision SD (σ<sub>B</sub>): <b id="sbh-o">${S.cfg.sigmaB.toFixed(2)}</b> — larger = wider individual ranges</label><input type="range" id="sbh" min="0" max="1.5" step="0.05" value="${S.cfg.sigmaB}"/></div>
    </section>
    <section class="card card-pad"><div class="card-h"><div><h3>Learned evidence weights</h3><p>Change in log-odds per 1 SD above the comparable-transfer average, with 90% intervals. Green/red = clearly helps/hurts.</p></div></div>${C.forest(coef)}</section>
  </div>
  <div class="grid g3" style="margin-top:14px">
    <section class="card card-pad"><div class="card-h"><div><h3>Baselines by level jump</h3><p>Open circle = raw observed rate. Filled = pooled Bayesian baseline with 90% interval.</p></div></div>${C.shrinkChart(groups, 380, 200)}</section>
    <section class="card card-pad"><div class="card-h"><div><h3>How much to pool</h3><p>Marginal likelihood across τ. The peak is the data's answer.</p></div></div>${C.lineChart(m.tauCurve.map((t) => ({ x: Math.log(t.tau), y: t.logML, t: t.tau })), { w: 380, h: 200, xl: "τ (log scale)", yl: "log marginal likelihood", mark: Math.log(m.tau), fmtX: (x) => { const v = +Math.exp(x).toFixed(2); return [0.05, 0.2, 0.65, 1.75, 3.5].includes(v) ? v : ""; }, fmtY: (y) => y.toFixed(0) })}</section>
    <section class="card card-pad"><div class="card-h"><div><h3>Sharper with every portal cycle</h3><p>Average 80% range on today's watch list as completed classes are added.</p></div></div>
      ${C.bars(S.lc.map((x, i) => ({ l: `${i + 1} class${i ? "es" : ""}`, s: `n = ${x.n}`, v: x.width * 100 })), { w: 380, h: 200, fmt: (v) => v.toFixed(0) + " pts" })}</section>
  </div>
  <section class="card card-pad" style="margin-top:14px"><div class="card-h"><div><h3>Destination program effects</h3><p>Posterior mean ± 90% interval in log-odds, after accounting for the rating gap and roster context. ${esc(DEST_OSU)}'s value is the destination development effect the pilot needs to estimate on real data.</p></div></div>
    ${C.forest(destEffects(m))}</section>
  <section class="card card-pad" style="margin-top:14px"><div class="card-h"><div><h3>What this model does not claim</h3></div></div>
    <ul class="lim">
      <li>The weights are associations, not causes. Nothing here estimates what coaching or development would change.</li>
      <li>Performative effects are not modelled: once a staff acts on a score, it changes who gets opportunity. The prospective test (Pilot Design, step 5) records pursuit and opportunity so this can be estimated.</li>
      <li>All players, programs and outcomes here are synthetic. The held-out numbers show the method works on data with known structure; they are not evidence of accuracy on real players.</li>
      <li>Probabilities are associations from past transfers, not guarantees, and not a substitute for film or the staff's judgement.</li>
      <li>The Laplace approximation is exact enough for this model size; the production build adds full MCMC (Stan/PyMC NUTS) as a cross-check on every refit.</li>
      <li>Medical, academic and NIL data are out of scope for v1. Anything used must clear OSU compliance and data-sharing review first.</li>
    </ul></section>`;
}

function destEffects(m) {
  const lv = Object.keys(m.reCounts[0]).map(Number);
  return lv.map((l) => { const i = m.reOffs[0] + l; return { label: `${DEST_PROGRAMS_LIST[l]} (n=${m.reCounts[0][l]})`, m: m.theta[i], sd: Math.sqrt(m.cov[i][i]) }; }).sort((a, b) => b.m - a.m);
}
function pageOntology() {
  const sel = ONTOLOGY.find((n) => n.id === S.ontoSel) || ONTOLOGY[0];
  const W = 980, H = 620;
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

const PILOT_STEPS = [
  { t: "Pre-register before data access", d: "Record the success criteria, position group, model specification, comparison models (portal rating only, staff grade only), metrics and the decision rule for declaring success. Prevents tuning the criterion to the result.", who: "FuzeBox + OSU sponsor", need: "OSU sponsor", out: "Signed pre-registration, hashed into the Run Journal" },
  { t: "Establish measurement properties", d: "At least three staff members and the licensed provider grade a common set of transfers from completed classes. Report ICC(2,1) for single raters and ICC(2,k) for the averaged grade, and agreement between instruments, before either grade carries a large weight.", who: "OSU staff + provider", need: "Licensed film access; staff time", out: "Reliability table per instrument" },
  { t: "Walk-forward backtest, QBs first", d: "Fit only on classes before each test season and roll forward. Quarterbacks first, because usage and PPA give a public paired criterion. Report calibration slope, Brier, log loss, AUC and top-20 hit rate with bootstrap intervals, by position and size of move.", who: "FuzeBox", need: "None for QBs (public data) — see Real QB Backtest", out: "Backtest report; first version live in this app" },
  { t: "Compare with blind staff rankings", d: "Staff rank a held-out class without outcomes or model output. Compare staff ranking, model ranking and the hybrid to isolate the model's incremental value.", who: "OSU staff", need: "Staff time; outcome blinding", out: "Staff vs model vs hybrid table" },
  { t: "Prospective test in the January 2027 window", d: "Score the live class before decisions, lock the scores in the Run Journal, and evaluate against season-one outcomes. Record which transfers were pursued and how much opportunity each received, so performative effects can be estimated.", who: "FuzeBox + OSU", need: "All prerequisites above", out: "Locked, hash-chained pre-decision scores" },
  { t: "Report against the validity framework", d: "Present results by Messick's six aspects so stakeholders see which are supported, which remain open and what the next cycle must establish.", who: "FuzeBox", need: "Steps 1–5", out: "Updated Validity Scorecard" },
];
function pageSetup() {
  const th = S.cfg.th;
  return `
  <div class="callout"><b>Prerequisites not yet approved:</b> an OSU football sponsor, a data-sharing agreement, FERPA/privacy review of any student-athlete data, licence rights for paid grading and tracking data (PFF / Teamworks or similar), and an NCAA compliance check that pre-window evaluation stays within contact rules. Nothing below runs on OSU data until these clear. All dates are TBD.</div>
  <section class="card" style="margin-top:14px"><div class="card-h"><div><h3>Pre-registered pilot validation design</h3><p>Six steps, adapted from the Assessment (Section 10.2). Results count as evidence rather than demonstration only if step 1 happens before data access.</p></div></div>
    <div class="scroll-x"><table class="t pilot"><thead><tr><th>#</th><th>Step</th><th>Owner</th><th>Depends on</th><th>Output</th><th>Status</th></tr></thead><tbody>
    ${PILOT_STEPS.map((x, i) => `<tr><td class="n"><b>${i + 1}</b></td><td><b>${esc(x.t)}</b><div class="note" style="margin:2px 0 0">${esc(x.d)}</div></td><td>${esc(x.who)}</td><td>${esc(x.need)}</td><td>${esc(x.out)}</td><td>${i === 2 ? '<span class="badge b-hypothesis">QB prototype built</span>' : '<span class="badge b-bad">Not started · TBD</span>'}</td></tr>`).join("")}</tbody></table></div>
    <p class="note" style="padding:0 16px 14px">Only the OSU pilot can supply the reliability study, blind staff rankings, licensed snaps for offensive line, linebackers and defensive backs, coordinator-change coding, and the prospective test.</p></section>
  <div class="callout" style="margin-top:14px"><b>January 2027 window dates conflict in public reporting.</b> <a href="https://www.usatoday.com/story/sports/ncaaf/2026/10/27/college-football-transfer-portal-when-window-open-rumors-rules/92451447007/" target="_blank" rel="noopener">USA TODAY</a> describes a two-week window from January 2, 2027; the <a href="https://www.nationalfootballpost.com/2026/10/23/college-football-transfer-portal-nil" target="_blank" rel="noopener">National Football Post</a> describes a 10-day window from January 4. Confirm against the NCAA calendar before locking the prospective scoring date.</div>
  <div class="grid g3" style="margin-top:14px">
    <section class="card card-pad"><div class="eyebrow">Input 1 · from the staff</div><h3 class="oname">Definition of success</h3>
      <p class="note">Pick a rule and set the thresholds. The whole app refits on change. Each rule shows whether it can be checked on historical data from public sources; accuracy claims are restricted to verifiable outcomes.</p>
      ${Object.entries(DEFS).map(([k, v]) => `<label class="radio"><input type="radio" name="def" value="${k}" ${S.cfg.def === k ? "checked" : ""}/> <b>${v.label}</b><span>${esc(defText(k, th))}</span><span>${verifBadge(k)}</span></label>`).join("")}
      <div class="wi"><label for="th-snap">Snap share threshold</label><input type="range" id="th-snap" min="25" max="80" step="5" value="${th.snap}"/><output>${th.snap}%</output></div>
      <div class="wi"><label for="th-grade">Grade threshold</label><input type="range" id="th-grade" min="55" max="85" step="1" value="${th.grade}"/><output>${th.grade}</output></div>
      <button class="btn primary sm" data-act="apply-def">Apply and refit</button>
      <p class="note">Rule enforced in code: when the criterion is a provider grade, that provider's film grade is removed as a predictor.</p>
    </section>
    <section class="card card-pad"><div class="eyebrow">Input 2 · from the staff</div><h3 class="oname">Starting position group</h3>
      <p class="note">Quarterbacks first for real-data validation, because a public paired criterion exists. Defensive groups and the offensive line need licensed snaps.</p>
      ${Object.entries(POSITIONS).map(([k, v]) => `<label class="radio"><input type="radio" name="pos" value="${k}" ${S.cfg.pos === k ? "checked" : ""}/> <b>${v.name}</b><span>${esc(v.m1.k)} · ${esc(v.m2.k)}</span></label>`).join("")}
    </section>
    <section class="card card-pad"><div class="eyebrow">Input 3 · from the staff</div><h3 class="oname">Internal evaluation data</h3>
      <p class="note">Past grades on players who later transferred anywhere are the most valuable: they let the reliability study and the model measure how predictive the staff's eye is.</p>
      <ul class="lim"><li>Staff grades and board rankings from past portal cycles, with evaluator IDs (for ICC)</li><li>Scheme-fit tags and position-coach notes</li><li>Measurement protocol for every test (electronic vs hand-timed)</li><li>Which transfers were pursued, and season-one opportunity given</li></ul>
      <button class="btn sm" data-act="template">Download staff-grade CSV template</button>
    </section>
  </div>
  <section class="card" style="margin-top:14px"><div class="card-h"><div><h3>Data plan — what we supply vs what the staff supplies</h3></div></div>
    <div class="scroll-x"><table class="t"><thead><tr><th>Evidence</th><th>Source</th><th>Supplied by</th><th>Access</th></tr></thead><tbody>
      <tr><td>Portal entries, origin, destination, rating, stars, eligibility status</td><td>CollegeFootballData.com <span class="mono">/player/portal</span></td><td>FuzeBox</td><td>Public API (key)</td></tr>
      <tr><td>Program ratings for the continuous rating gap</td><td>CollegeFootballData.com <span class="mono">/ratings/sp</span>, <span class="mono">/talent</span></td><td>FuzeBox</td><td>Public API (key)</td></tr>
      <tr><td>Returning production, head-coach changes, incoming same-position transfers</td><td>CollegeFootballData.com <span class="mono">/player/returning</span>, <span class="mono">/coaches</span>, <span class="mono">/player/portal</span></td><td>FuzeBox</td><td>Public API (key)</td></tr>
      <tr><td>Player usage, season stats, PPA (incl. QB rushing PPA)</td><td>CollegeFootballData.com <span class="mono">/player/usage</span>, <span class="mono">/ppa/players/season</span></td><td>FuzeBox</td><td>Public API (key)</td></tr>
      <tr><td>Opponent-adjusted EPA</td><td>CollegeFootballData.com <span class="mono">/wepa/players/passing</span></td><td>FuzeBox</td><td>Paid CFBD tier — returned 401 on the free key</td></tr>
      <tr><td>Coordinator changes</td><td>Program releases, staff directories</td><td>FuzeBox (manual coding)</td><td>Public; not yet coded</td></tr>
      <tr><td>Snap counts and film grades</td><td>Licensed grading provider</td><td>OSU licence</td><td>Prerequisite — rights to use in a model</td></tr>
      <tr><td>Measurables with protocol</td><td>Public reports + staff testing</td><td>Both</td><td>Mixed; electronic timing only in the model</td></tr>
      <tr><td>Staff evaluations, scheme fit</td><td>OSU personnel staff</td><td>OSU</td><td>Internal — stays inside the department</td></tr>
    </tbody></table></div></section>
  <div class="grid g2" style="margin-top:14px">
    <section class="card card-pad"><div class="card-h"><div><h3>30-minute working session</h3></div></div>
      <ol class="agenda"><li><b>5 min</b> — Walk the board, one player profile and the Validity Scorecard.</li><li><b>10 min</b> — Agree the paired success definition and the pre-registration items.</li><li><b>5 min</b> — Confirm quarterbacks first; pick the second group.</li><li><b>10 min</b> — List internal data, owners, and the reviews it needs.</li></ol></section>
    <section class="card card-pad"><div class="card-h"><div><h3>Path to the January window</h3></div></div>
      <ol class="agenda"><li><b>Date TBD</b> — Working session; prerequisites start moving.</li><li><b>TBD</b> — Pre-registration signed (step 1).</li><li><b>TBD</b> — Reliability study and real backtest (steps 2–3).</li><li><b>TBD</b> — Blind staff ranking session (step 4).</li><li><b>Jan 2 or Jan 4, 2027 (reports conflict)</b> — Window opens; scores locked before decisions (step 5).</li></ol></section>
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

// ---------------- v4 watch context ----------------
const NEED_POS = { CB: ["CB", "S"], WR: ["WR"], EDGE: ["EDGE", "DT"], OT: ["OT", "IOL"], RB: ["RB"], QB: ["QB"] };
const WCTX = {
  esc, badge: (k) => badge(k), kpi: rpKpi, toast: (m) => toast(m), render: () => render(), log: (...a) => log(...a),
  needs: () => { try { return rosterModel(); } catch { return []; } },
  go: (sc, p) => go(sc, p), pos: () => S.cfg.pos,
  setPos: async (pos) => { if (S.cfg.pos === pos) return; S.cfg.pos = pos; S.staffEdits = {}; await refitAndLog(`Position group → ${POSITIONS[pos].name} (asked by voice)`); const sel = document.getElementById("cfg-pos"); if (sel) sel.value = pos; },
  board: (mode) => {
    const open = new Set(WCTX.needs().filter((n) => n.gap > 0.5).map((n) => n.pos));
    const rows = boardFor().map((p) => ({ ...p, ...S.scores[p.id], need: (NEED_POS[p.pos] || [p.pos]).some((x) => open.has(x)) })).filter((r) => r.q10 !== undefined);
    return rows.sort((a, b) => (mode === "starter" ? b.q10 - a.q10 : b.q90 - a.q90));
  },
};

// ---------------- render ----------------
function render() {
  const [screen, param] = route();
  shell();
  const el = $("#page");
  if (isRP(screen)) { el.innerHTML = rpPage(screen, param); $("#chain-n").textContent = S.receipts.length; const mb = document.querySelector("#mnav .on"); if (mb) mb.scrollIntoView({ inline: "center", block: "nearest" }); return; }
  el.innerHTML = { learn: pageLearn, plan: pagePlan, variance: pageVariance, gaps: pageGaps, tour: pageTour, faq: pageFaq, glossary: pageGlossary, talk: pageTalk, rooms: pageRooms, lead: pageLead, bots: pageBots, devices: pageDevices, watch: () => pageWatch(WCTX), signals: () => pageSignals(WCTX), board: pageBoard, player: () => pagePlayer(param), test: pageTest, qbreal: () => pageQBReal(esc, badge), validity: () => pageValidity(esc, S), model: pageModel, ontology: pageOntology, research: () => pageResearch(param), live: () => pageLive(esc, badge), college: () => pageCollege(esc, badge), setup: pageSetup, journal: pageJournal }[screen]();
  $("#chain-n").textContent = S.receipts.length;
  if (screen === "college" && COLLEGE.autoload) COLLEGE.autoload();
  afterRender();
  afterRender6();
}

// ---------------- events ----------------
document.addEventListener("click", async (e) => {
  const md = e.target.closest("[data-mode]");
  if (md) { MODE.v = md.dataset.mode; log("mode.switch", `Switch to ${MODE.v} view`, {}, {}, "staff"); const [sc] = route(); if (!visible(sc)) go("watch"); return render(); }
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
    toast(`Re-scored: ${pts(s.shift)} vs comparable moves · board position ${rankOf(id)}`); render();
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
  if (a === "seq-run") { const n = +$("#sq-n").value, k = Math.min(n, +$("#sq-k").value); S.seq[id] = { n, k }; await log("player.update", `Sequential update for ${findPlayer(id).name}`, { player: id, games: n, in_role: k }, { prior_mean: +S.scores[id].mean.toFixed(3) }, "estimate"); render(); }
  if (a === "seq-clear") { delete S.seq[id]; render(); }
  if (a === "reveal") { S.hideOutcomes = !S.hideOutcomes; if (!S.hideOutcomes) log("backtest.run", `Reveal ${S.bt.test} outcomes`, { held_out: S.bt.test }, { auc: +S.bt.full.met.auc.toFixed(3) }, "observed"); render(); }
  if (a === "export") {
    const rows = boardFor().map((p) => { const s = S.scores[p.id]; return [rankOf(p.id), p.id, p.name, p.pos, p.from, p.tier, p.jump, p.gap, p.elig, p.m1, p.m2, p.film ?? "", p.ath ?? "", p.staff ?? "", s.base.toFixed(4), s.shift.toFixed(4), s.shiftLo.toFixed(4), s.shiftHi.toFixed(4), s.mean.toFixed(4), s.flags.join("|")]; });
    download(`portal-board-${S.cfg.pos}.csv`, "board_position,id,name,pos,from,tier,jump,rating_gap,elig,m1,m2,film,athletic_electronic,staff_grade,comparable_move_base,shift,shift_q10,shift_q90,estimate_mean,flags\n" + rows.map((r) => r.join(",")).join("\n"));
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
    toast(`${findPlayer(id).name}: ${pts(s.shift)} vs comparable moves · board position ${rankOf(id)}`); render();
  }
  if (t.id === "sb") { S.cfg.sigmaBeta = +t.value; await refitAndLog(`Prior strength σβ → ${S.cfg.sigmaBeta.toFixed(2)}`); render(); }
  if (t.id === "sbh") { S.cfg.sigmaB = +t.value; await refitAndLog(`Behavioral SD σB → ${S.cfg.sigmaB.toFixed(2)}`); render(); }
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
  if (t.id === "sbh") $("#sbh-o").textContent = (+t.value).toFixed(2);
  if (t.id === "sq-n" || t.id === "sq-k") $("#sqo-" + t.id.slice(3)).textContent = t.value;
});
document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.dataset?.onto) { S.ontoSel = e.target.dataset.onto; render(); } });
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

function download(name, text) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2600); }

// ---------------- boot ----------------
(async function boot() {
  S.dataHash = await sha256(JSON.stringify(DATA.history));
  await log("dataset.load", "Load synthetic portal history (v2 generator) + 2027 watch list", { history_rows: DATA.history.length, watch_list: DATA.board.length, classes: CYCLES.map((c) => c.id), positions: Object.keys(POSITIONS) }, { data_sha256: S.dataHash }, "observed");
  await refitAndLog("Initial fit");
  bindLive({ render, log, toast, go });
  bindCollege({ render, log, toast, go });
  bindQBReal({ render, log, toast });
  bindRP({ render, log, toast, go });
  bindWatch(WCTX);
  bindV5(WCTX);
  bindV6(WCTX);
  checkHealth(render);
  checkCollege(render);
  $("#boot").remove();
  render();
})();
