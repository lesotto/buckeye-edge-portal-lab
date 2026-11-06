import { RP, prog, S, G, all, byId, can, urgency, queue, online, PROGRAMS, api } from "./store.js";
import { icc21, corr } from "./ceg.js";
import { esc, usd, usdk, pct, kpi, sec, card, head, gradeChip, plink, pmeta, prospectTable, est, sample, bar, stateMap } from "./ui.js";
import { POS, PIPE } from "./data.js";
import { rosterModel, budgetPlan, fmvRows, periodOn } from "./pages_plan.js";
import { rng } from "../model.js";

export const CUI = { terr: "A1", settingsErr: "", endpoints: null };
const cls27 = () => all().filter((p) => p.cls === 2027 && p.type === "hs");

export function pageHC() {
  const P = prog(), commits = cls27().filter((p) => p.stage === "Committed"), needs = rosterModel().filter((r) => r.gap > 0.5);
  const targets = all().filter((p) => p.cls === 2027 && p.stage !== "Committed" && G(p.id).c.status === "ok").sort((a, b) => G(b.id).c.grade - G(a.id).c.grade).slice(0, 10);
  const avg = commits.length ? commits.reduce((s, p) => s + G(p.id).c.grade, 0) / commits.length : 0;
  return head("Head Coach", "The 2027 class at a glance: commitments, top targets, needs still open and rival moves.", sample) +
    `<div class="kpis">${kpi("Commitments", commits.length, "2027 high school")}${kpi("Class avg CEG", avg.toFixed(2), "committed players")}${kpi("Open needs", needs.length, needs.map((r) => r.pos).join(", ") || "none")}${kpi("Rival alerts", P.alerts.filter((a) => !a.read).length, "unread")}</div>
    <div class="grid g2">${card("Top uncommitted targets", "Ranked by CEG; commit chance is an estimate", prospectTable(targets, { cols: ["grade", "stage", "like", "urg"], limit: 10 }))}
    <div class="grid" style="align-content:start">${card("Open needs", "Gap = target − projected 2027 roster", needs.map((r) => `<div class="rp-needrow"><b>${r.pos}</b>${bar(r.gap, 4)}<span class="mono">+${r.gap}</span></div>`).join("") || `<p class="note">No open needs.</p>`)}
    ${card("Rival moves", "Latest alerts", P.alerts.slice(0, 6).map((a) => `<div class="rp-logrow"><span class="mono">${a.ts}</span> ${plink(byId(a.pid))}: ${esc(a.kind)} · ${esc(a.school)}</div>`).join(""))}
    ${card("Commitments", "", commits.slice(0, 12).map((p) => `<div class="rp-logrow">${plink(p)} ${gradeChip(p.id)} <span class="small dim">${pmeta(p)}</span></div>`).join("") || `<p class="note">None yet.</p>`)}</div></div>`;
}

export function pageArea() {
  const P = prog(), st = S(), t = st.territories.find((x) => x.id === CUI.terr) || st.territories[0];
  const mine = all().filter((p) => p.terr === t.id).sort((a, b) => G(b.id).c.grade - G(a.id).c.grade);
  const al = P.alerts.filter((a) => byId(a.pid)?.terr === t.id);
  const tasks = [
    ...mine.filter((p) => G(p.id).c.status === "third").slice(0, 4).map((p) => [p, "Schedule a third look (graders disagree)"]),
    ...mine.filter((p) => p.stage === "Identified").slice(0, 4).map((p) => [p, "First evaluation needed"]),
    ...mine.filter((p) => p.fortySrc === "self" && G(p.id).c.grade >= 6.5).slice(0, 3).map((p) => [p, "Verify the 40 at a camp (self-reported)"]),
    ...mine.filter((p) => urgency(p) >= 60 && p.stage !== "Committed").slice(0, 3).map((p) => [p, "Rival urgency high — call this week"]),
  ];
  const counts = {}; mine.forEach((p) => (counts[p.state] = (counts[p.state] || 0) + 1));
  return head("Area Recruiter", "My territory, my players, what changed this week, alerts and tasks.", sample) +
    `<section class="card card-pad" style="margin-bottom:14px"><div class="filters"><div class="field"><label for="terr">Territory</label><select id="terr" data-rpi="terr">${st.territories.map((x) => `<option value="${x.id}" ${x.id === t.id ? "selected" : ""}>${x.id} · ${esc(x.coach)}</option>`).join("")}</select></div><span class="small dim">${t.states.join(", ")}</span></div></section>
    <div class="kpis">${kpi("My players", mine.length, t.states.length + " states")}${kpi("Alerts", al.length, "rival activity")}${kpi("Tasks", tasks.length, "open")}${kpi("Third looks", mine.filter((p) => G(p.id).c.status === "third").length, "pending")}</div>
    <div class="grid g2">${card("My board", "Top by CEG", prospectTable(mine, { cols: ["grade", "stage", "like"], limit: 12 }))}
    <div class="grid" style="align-content:start">${card("Tasks", "Generated from grades, sources and activity", tasks.map(([p, x]) => `<div class="rp-logrow">${plink(p)} <span class="small">${esc(x)}</span></div>`).join("") || `<p class="note">Nothing open.</p>`)}
    ${card("Alerts this week", "", al.slice(0, 8).map((a) => `<div class="rp-logrow"><span class="mono">${a.ts}</span> ${plink(byId(a.pid))}: ${esc(a.kind)} · ${esc(a.school)}</div>`).join("") || `<p class="note">No alerts in this territory.</p>`)}
    ${card("Territory map", "", stateMap(counts, null))}</div></div>`;
}

export function pageGM() {
  if (!can("budget") && !can("fmv")) return head("General Manager", "Restricted by role.") + `<div class="card card-pad"><p>Visible to the general manager and admin. You are <b>${RP.role}</b> (demo sign-in).</p><div class="row-btns"><button class="btn primary" data-rpa="role" data-id="GM">Switch to General manager (demo)</button></div></div>`;
  const b = budgetPlan(), st = S(), spent = st.budget.pool_usd - b.left;
  const byPos = POS.map((pos) => { const x = b.pick.filter((y) => y.p.pos === pos); return { pos, n: x.length, usd: x.reduce((s, y) => s + y.p.ask, 0), val: x.reduce((s, y) => s + y.c.value, 0) }; });
  const mx = Math.max(...byPos.map((r) => r.usd), 1);
  const f = can("fmv") ? fmvRows() : null;
  return head("General Manager", "Roster investment, the budget plan and value per dollar.", sample) +
    `<div class="kpis">${kpi("Pool", usdk(st.budget.pool_usd), "sample")}${kpi("Planned spend", usdk(spent), b.pick.length + " players")}${kpi("Value per $1M", spent ? ((b.pick.reduce((s, y) => s + y.c.value, 0) / spent) * 1e6).toFixed(0) : "—", "points above replacement")}${kpi("FMV outliers", f ? f.rows.filter((r) => r.flag).length : "GM only", f ? "flagged for review" : "switch role")}</div>
    <div class="grid g2">${card("Investment by position", "Planned allocation", `<table class="t"><tbody>${byPos.map((r) => `<tr><td><b>${r.pos}</b></td><td style="width:45%">${bar(r.usd, mx)}</td><td class="n">${usdk(r.usd)}</td><td class="n">${r.n}</td><td class="n">${r.val.toFixed(0)} pts</td></tr>`).join("")}</tbody></table><div class="row-btns"><button class="btn" data-rpa="go" data-id="budget">Open budget plan</button>${can("fmv") ? `<button class="btn" data-rpa="go" data-id="fmv">Open FMV review</button>` : ""}</div>`)}
    ${card("Best value per dollar", "Need-weighted, from the plan", prospectTable(b.pick.slice(0, 10).map((x) => x.p), { cols: ["grade", "value", "ask", "cpp"], limit: 10 }))}</div>`;
}

export function pageDirector() {
  const P = prog(), counts = PIPE.map((s) => [s, all().filter((p) => p.stage === s).length]), mx = Math.max(...counts.map((c) => c[1]));
  const feeds = [["Licensed recruiting service export", "Daily 05:00", "OK", "2026-11-04 05:02"], ["Licensed stats API", "Hourly", "OK", "2026-11-04 08:00"], ["Film platform API", "Hourly", "OK", "2026-11-04 08:00"], ["Publisher-permitted RSS (3 papers)", "15 min", "Delayed", "2026-11-04 06:45"], ["Online questionnaire", "Real time", RP.backend?.ok ? "OK" : "Server offline", RP.backend?.ok ? "live" : "—"]];
  const flags = P.contactsLog.filter((x) => x.override);
  const cur = periodOn("2026-11-04");
  return head("Recruiting Director", "Operations, pipeline flow, data-feed health and compliance flags.", sample) +
    `<div class="kpis">${kpi("Period", cur ? cur[2] : "—", "sample calendar")}${kpi("Compliance flags", flags.length + (P.blocked || 0), "overrides + blocked")}${kpi("Third looks", all().filter((p) => G(p.id).c.status === "third").length, "grading backlog")}${kpi("Offline queue", queue.list().length, "awaiting sync")}</div>
    <div class="grid g2">${card("Pipeline flow", "All tracked players", counts.map(([s, n]) => `<div class="rp-needrow"><b>${s}</b>${bar(n, mx, "var(--fz)")}<span class="mono">${n}</span></div>`).join(""))}
    ${card("Data-feed health", "Licensed sources only (sample status)", `<table class="t"><thead><tr><th>Feed</th><th>Cadence</th><th>Status</th><th>Last</th></tr></thead><tbody>${feeds.map((f) => `<tr><td>${esc(f[0])}</td><td class="small">${f[1]}</td><td>${f[2] === "OK" ? `<span class="badge b-ok">OK</span>` : `<span class="badge b-flag">${esc(f[2])}</span>`}</td><td class="mono small">${f[3]}</td></tr>`).join("")}</tbody></table>`)}
    ${card("Compliance flags", "Overrides need a coordinator reason", flags.map((x) => `<div class="rp-logrow">${plink(byId(x.pid))} · ${esc(x.type.replace(/_/g, " "))} · “${esc(x.reason)}”</div>`).join("") || `<p class="note">No overrides. ${P.blocked || 0} blocked attempts.</p>`)}
    ${card("This week", "", `<div class="row-btns"><button class="btn" data-rpa="go" data-id="brief">Monday brief draft</button><button class="btn" data-rpa="go" data-id="automation">Automation log</button><button class="btn" data-rpa="go" data-id="compliance">Compliance calendar</button></div>`)}</div>`;
}

// ---------- validation helpers ----------
export function validation() {
  const P = prog(), st = S(), past = P.past;
  const y = (p) => (p.outcome.starter ? 2 : p.outcome.contributor ? 1 : 0);
  const res = {};
  for (const grp of ["hs", "transfer"]) {
    const L = past.filter((p) => (grp === "hs" ? p.type === "hs" : p.type === "transfer"));
    const pil = { film: L.map((p) => G(p.id).c.film.score ?? 5), production: L.map((p) => G(p.id).c.prod.score), testing: L.map((p) => G(p.id).c.test.score), character: L.map((p) => p.character ?? 5) };
    const ys = L.map(y), r = Object.fromEntries(Object.entries(pil).map(([k, v]) => [k, corr(v, ys)]));
    const cur = st.weights[grp], pos = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.max(0.02, v)])), tot = Object.values(pos).reduce((a, b) => a + b, 0);
    const raw = Object.fromEntries(Object.entries(pos).map(([k, v]) => [k, (100 * v) / tot]));
    let sug = Object.fromEntries(Object.keys(cur).map((k) => [k, Math.max(cur[k] - 5, Math.min(cur[k] + 5, raw[k]))]));
    const s2 = Object.values(sug).reduce((a, b) => a + b, 0); sug = Object.fromEntries(Object.entries(sug).map(([k, v]) => [k, Math.round((v * 100) / s2)]));
    const d = 100 - Object.values(sug).reduce((a, b) => a + b, 0); sug.film += d;
    res[grp] = { n: L.length, r, cur, raw, sug };
  }
  // ICC on all double-graded traits (current board)
  const pairs = []; const byPos = {};
  all().forEach((p) => p.traits.forEach((t) => { if (t.g1 !== null && t.g2 !== null) { pairs.push([t.g1, t.g2]); (byPos[p.pos] ||= []).push([t.g1, t.g2]); } }));
  const icc = icc21(pairs), iccPos = Object.fromEntries(Object.entries(byPos).map(([k, v]) => [k, icc21(v)]));
  // grader accuracy: assign evaluators by index
  const graders = P.graders.map((g, gi) => { const L = past.filter((_, i) => i % P.graders.length === gi && G(past[i].id).c.film.score !== null); return { g, n: L.length, r: L.length > 4 ? corr(L.map((p) => G(p.id).c.film.score), L.map(y)) : null }; });
  // hit / bust / find
  const top = past.filter((p) => G(p.id).c.grade >= 7), contrib = past.filter((p) => p.outcome.contributor);
  const hit = top.filter((p) => p.outcome.starter).length / (top.length || 1), bust = top.filter((p) => p.outcome.bust).length / (top.length || 1), find = contrib.filter((p) => p.discovered === "late").length / (contrib.length || 1);
  // likelihood recalibration on synthetic past targets
  const R = rng(91 + RP.pid.length), H = [];
  for (let i = 0; i < 360; i++) { const z = -2.6 + 4.4 * R.u(), truth = 1 / (1 + Math.exp(-(0.72 * z - 0.35))); H.push({ z, p: 1 / (1 + Math.exp(-z)), y: R.u() < truth ? 1 : 0 }); }
  let a = 0, b = 1; for (let it = 0; it < 600; it++) { let ga = 0, gb = 0; H.forEach((h) => { const q = 1 / (1 + Math.exp(-(a + b * h.z))); ga += q - h.y; gb += (q - h.y) * h.z; }); a -= (0.5 * ga) / H.length; b -= (0.5 * gb) / H.length; }
  const bins = [0, 0.2, 0.4, 0.6, 0.8, 1.0001].slice(0, -1).map((lo, i, arr) => { const hi = [0.2, 0.4, 0.6, 0.8, 1.0001][i]; const B = H.filter((h) => h.p >= lo && h.p < hi); return { lo, hi: Math.min(1, hi), n: B.length, pred: B.reduce((s, h) => s + h.p, 0) / (B.length || 1), obs: B.reduce((s, h) => s + h.y, 0) / (B.length || 1) }; });
  return { res, icc, iccPos, graders, hit, bust, find, top: top.length, contrib: contrib.length, recal: { a, b, bins, n: H.length } };
}

export function pageEvalQ() {
  const v = validation();
  return head("Evaluation Quality", "Grader agreement, hit and bust rates and the find rate, measured on synthetic past classes.", sample) +
    `<div class="kpis">${kpi("Grader ICC(2,1)", v.icc.toFixed(2), "all double-graded traits")}${kpi("Hit rate", pct(v.hit), `CEG ≥ 7 who became starters (n=${v.top})`)}${kpi("Bust rate", pct(v.bust), "CEG ≥ 7 who missed")}${kpi("Find rate", pct(v.find), "contributors from late discovery")}</div>
    <div class="grid g2">${card("Agreement by position", "ICC(2,1), two graders per trait. Above 0.75 is good agreement.", `<table class="t"><tbody>${Object.entries(v.iccPos).map(([k, x]) => `<tr><td><b>${k}</b></td><td style="width:55%">${bar(Math.max(0, x), 1, x >= 0.75 ? "var(--ok)" : "var(--hyp)")}</td><td class="n">${x.toFixed(2)}</td></tr>`).join("")}</tbody></table>`)}
    ${card("Grader accuracy vs outcomes", "Correlation of each evaluator's film grade with what happened (synthetic)", `<table class="t"><tbody>${v.graders.map((g) => `<tr><td>${esc(g.g)}</td><td class="n">n=${g.n}</td><td class="n">${g.r === null ? "—" : "r = " + g.r.toFixed(2)}</td></tr>`).join("")}</tbody></table><p class="note">Small samples per grader; read as a direction, not a ranking.</p>`)}</div>`;
}

export function pageAnnual() {
  const v = validation(), st = S();
  const wt = (g) => { const x = v.res[g]; return `<table class="t"><thead><tr><th>Pillar</th><th class="n">r with outcome</th><th class="n">Current</th><th class="n">Unconstrained</th><th class="n">Suggested (±5 cap)</th></tr></thead><tbody>${Object.keys(x.cur).map((k) => `<tr><td>${k}</td><td class="n">${x.r[k].toFixed(2)}</td><td class="n">${x.cur[k]}</td><td class="n dim">${x.raw[k].toFixed(0)}</td><td class="n"><b>${x.sug[k]}</b></td></tr>`).join("")}</tbody></table><p class="note">n = ${x.n} past signees. Outcome = 2 starter, 1 contributor, 0 neither.</p>`; };
  return head("Annual Validation", "Each year: which pillars actually predicted outcomes, suggested reweighting capped at 5 points per year, and recalibration of commitment chances.", sample) +
    `<div class="callout" style="margin-bottom:14px">Run on synthetic 2021–2024 signee classes so every calculation is visible. On real data this runs once a year after outcomes are known; suggestions are applied only by an admin.</div>
    <div class="grid g2">${card("High school weights", "", wt("hs"))}${card("Transfer weights", "", wt("transfer"))}</div>
    <div class="row-btns" style="margin:10px 0 18px">${can("settings") ? `<button class="btn primary" data-rpa="apply-weights">Apply suggested weights (admin)</button>` : `<span class="small dim">Only an admin can apply weights.</span>`}</div>
    <div class="grid g2">${card("Commitment likelihood recalibration " + est, `Platt scaling on ${v.recal.n} past targets: new logit = ${v.recal.a.toFixed(2)} + ${v.recal.b.toFixed(2)} × old logit`, `<table class="t"><thead><tr><th>Predicted bin</th><th class="n">n</th><th class="n">Avg predicted</th><th class="n">Observed</th></tr></thead><tbody>${v.recal.bins.map((b) => `<tr><td>${pct(b.lo)}–${pct(b.hi)}</td><td class="n">${b.n}</td><td class="n">${pct(b.pred)}</td><td class="n ${Math.abs(b.pred - b.obs) > 0.08 ? "neg" : ""}">${pct(b.obs)}</td></tr>`).join("")}</tbody></table><p class="note">${v.recal.b < 0.95 ? "Slope below 1: starting values were overconfident; recalibration pulls chances toward the middle." : "Well calibrated."}</p>`)}
    ${card("Hit, bust and find", "", `<table class="t"><tbody><tr><td>Top grades (CEG ≥ 7)</td><td class="n">${v.top}</td></tr><tr><td>Became starters (hit)</td><td class="n">${pct(v.hit)}</td></tr><tr><td>Missed (bust)</td><td class="n">${pct(v.bust)}</td></tr><tr><td>Contributors from late discovery (find)</td><td class="n">${pct(v.find)} of ${v.contrib}</td></tr><tr><td>Grader ICC(2,1)</td><td class="n">${v.icc.toFixed(2)}</td></tr></tbody></table>`)}</div>`;
}

export function pageProven() {
  const rows = [
    ["CEG scoring engine", "Implemented and tested in this build: four pillars, critical-trait ceilings, two-grader hold, level/sample adjustments, verified measurables, availability, bands, tiers, VAR and cost per point. The source document's worked CB example (7.05, 153.5, $1,628 per point) was not available to us, so v3 does not claim to reproduce it; replacement level and points-per-grade are program settings.", "partial"],
    ["Discovery, search, news scanner, recruiting activity, automation", "Implemented on sample data. Real feeds need signed licenses; no website copying.", "partial"],
    ["Portal Lab: who becomes a regular (real QB data)", "Our measured result on real 2022–2025 quarterback transfers: paired Brier 0.125 vs 0.127 for portal rating alone — a small edge, AUC 0.73 (90% range 0.63–0.83), calibration slope 0.84. On a contribution definition, rating alone wins (0.155 vs 0.159). On opportunity, the full model is clearly better (0.162 vs 0.195). We do not reproduce the document's '9% better for QBs, 5% all positions' claims. 2026 confirmatory test runs after this season.", "partial"],
    ["Portal Lab: who plays well once he gets there", "No demonstrated edge on real data. Not shown as a probability.", "no"],
    ["Portal Lab v1 synthetic weights", "Shown only as a teaching model with an unvalidated warning.", "no"],
    ["Value of staff film grades and planned role", "Untested. Requires the pilot: blind staff ranking and a grader reliability study.", "no"],
    ["Commitment likelihood, distances, lead scores", "Practitioner starting values, labeled as estimates. Distances use state centers.", "partial"],
    ["Compliance calendar", "Ships with SAMPLE dates and sample limits; the compliance office must load the real calendar.", "no"],
    ["Platform: offline queue, per-program storage, roles, PWA, night theme", "Implemented in this demo. Sign-in is a demo role switcher, not SSO. Per-program SQLite on the demo server; production target is PostgreSQL.", "partial"],
  ];
  return head("What Is Proven and What Is Not", "Our own measured status for each capability, rather than the claims in the features document.") +
    `<section class="card"><div class="scroll-x"><table class="t vtab"><thead><tr><th>Capability</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${rows.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${r[2] === "partial" ? `<span class="badge b-hypothesis">Partly shown</span>` : `<span class="badge b-bad">Not shown</span>`}</td><td class="small">${esc(r[1])}</td></tr>`).join("")}</tbody></table></div></section>
    ${sec("Before going live")}<section class="card card-pad"><ol class="rp-ol">${["Replace the demo sign-in with the program's single sign-on (Okta, Azure AD or Google Workspace).", "Load the real NCAA recruiting calendar and keep it current each year.", "Add database migrations before the first schema change after launch.", "Keep the public questionnaire rate-limited (in place on the demo server) and add a CAPTCHA if abuse appears.", "Load ZIP code centers for exact distances.", "Sign data licenses for recruiting services, stats, film platforms and newspapers.", "Run the 2026 Portal Lab confirmatory test and the staff pilot before Portal Lab probabilities inform decisions.", "Review minors' data handling with compliance and counsel; restrict exports."].map((x) => `<li>${esc(x)}</li>`).join("")}</ol></section>`;
}

export function pageSettings() {
  const st = S();
  const eps = CUI.endpoints;
  return head("Platform & Settings", "Program, role, theme, the per-program settings file, the API and install status.") +
    `<div class="grid g2">${card("Program", "Each school has its own data and settings, fully isolated", `<div class="filters"><div class="field"><label for="prog-pick">Program</label><select id="prog-pick" data-rpi="program">${Object.entries(PROGRAMS).map(([k, v]) => `<option value="${k}" ${k === RP.pid ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></div><div class="field"><label for="role-pick">Role (demo sign-in)</label><select id="role-pick" data-rpi="role">${["Evaluator", "Coordinator", "GM", "Admin"].map((r) => `<option ${r === RP.role ? "selected" : ""}>${r}</option>`).join("")}</select></div><div class="field"><label for="theme-pick">Theme</label><select id="theme-pick" data-rpi="theme"><option value="light" ${RP.theme === "light" ? "selected" : ""}>Day</option><option value="dark" ${RP.theme === "dark" ? "selected" : ""}>Night game</option></select></div></div>
      <table class="t" style="margin-top:10px"><thead><tr><th>Role</th><th>Can</th></tr></thead><tbody>${[["Evaluator", "grade film and traits, view boards"], ["Coordinator", "grade, log contacts, override the guard with a reason, promote leads, camps, brief"], ["GM", "budget plan, FMV review (GM only), brief"], ["Admin", "everything except FMV; settings and programs"]].map((r) => `<tr><td><b>${r[0]}</b></td><td class="small">${r[1]}</td></tr>`).join("")}</tbody></table>`)}
    ${card("Server & install", "", `<table class="t"><tbody><tr><td>Backend</td><td>${RP.backend?.ok ? `<span class="badge b-ok">Connected</span> ${esc(RP.backend.db || "")}` : `<span class="badge b-flag">Not connected</span>`}</td></tr><tr><td>Connection</td><td>${online() ? "Online" : "Offline"}</td></tr><tr><td>Offline queue</td><td>${queue.list().length} items</td></tr><tr><td>Installable app</td><td>${"serviceWorker" in navigator ? "Service worker caches the app shell only (no player data)" : "Not supported in this browser"}</td></tr><tr><td>Storage</td><td class="small">Demo: SQLite file per program on the server. Production target: PostgreSQL with Docker.</td></tr></tbody></table><div class="row-btns"><button class="btn" data-rpa="endpoints">List API endpoints</button><button class="btn" data-rpa="export-settings">Download settings file</button></div>
      ${eps ? `<div class="rp-eps">${eps.map((e) => `<div class="mono small">${esc(e)}</div>`).join("")}</div><p class="note">${eps.length} endpoints live on this demo server (the features document describes about 70 in the full product).</p>` : ""}`)}</div>
    ${sec("Settings file · " + esc(st.name))}<section class="card card-pad"><p class="small">Weights, trait lists, position norms, compliance dates, roster targets, budget and likelihood settings. ${can("settings") ? "Edit and apply to re-score everything." : "Read-only for your role."}</p><textarea id="settings-json" class="rp-brief rp-json" aria-label="Settings JSON" ${can("settings") ? "" : "readonly"}>${esc(JSON.stringify(st, null, 2))}</textarea>${CUI.settingsErr ? `<div class="callout sim">${esc(CUI.settingsErr)}</div>` : ""}<div class="row-btns">${can("settings") ? `<button class="btn primary" data-rpa="apply-settings">Apply settings</button><button class="btn" data-rpa="reset-settings">Reset to defaults</button>` : ""}</div></section>`;
}
