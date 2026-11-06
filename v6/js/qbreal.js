// Real QB backtest (Assessment, Pilot step 3): real quarterback transfers from CollegeFootballData.com.
// Walk-forward: fit only on earlier classes, test on the next. Last fold = fit 2022–2024, test 2025.
// Criterion is public and independent of any grading provider:
//   opportunity  = season-one usage at the destination >= starter-level threshold
//   contribution = season-one PPA per play at or above expectation for the size of the move
//                  (expectation = linear fit of PPA on rating gap, training classes only)
//   paired       = both
import { buildScaler, standardize, fit, predictFast, metrics, bootstrap, logit, sigmoid } from "./model.js";
import * as C from "./charts.js";

const Q = { data: null, err: null, crit: "paired", usageTh: 0.25, res: null, hide: true, ctx: null, loading: false };
const FCS_RATING = -25;   // FCS origins have no SP+; assigned below the FBS minimum (stated assumption)
const JUMPQ = ["P4→P4", "G5→P4", "FCS→P4", "P4→G5", "G5→G5", "FCS→G5"];
const FEATS = [
  { k: "ppa_pass", l: "Pre-transfer PPA per pass play", g: "Production" },
  { k: "ppa_rush", l: "Pre-transfer rushing PPA", g: "Production" },
  { k: "usage", l: "Pre-transfer usage share", g: "Experience" },
  { k: "log_att", l: "Pre pass attempts (log)", g: "Experience" },
  { k: "rating", l: "Portal rating (composite)", g: "Industry rating" },
  { k: "gap", l: "Rating gap (SP+, dest − origin)", g: "Move context" },
  { k: "ret_pass", l: "Dest. returning pass PPA", g: "Move context" },
  { k: "inc", l: "Other QBs in, same cycle", g: "Move context" },
  { k: "hc", l: "Dest. head-coach change", g: "Move context" },
];
const SETS = {
  full: FEATS.map((f) => f.k),
  rating: ["rating", "gap", "ret_pass", "inc", "hc"],
  production: ["ppa_pass", "ppa_rush", "usage", "log_att", "gap", "ret_pass", "inc", "hc"],
  context: ["gap", "ret_pass", "inc", "hc"],
};
const SET_LABEL = { full: "Full model", rating: "Portal rating only (+ move context)", production: "Pre-transfer production only (+ move context)", context: "Move context only (reference)" };

function feat(r) {
  const pre = r.pre || {};
  const oR = r.origin_rating ?? (r.origin_tier === "FCS" ? FCS_RATING : null);
  return {
    ppa_pass: pre.pass_att >= 20 ? pre.ppa_pass : null,
    ppa_rush: pre.ppa_rush ?? null,
    usage: r.pre ? pre.usage_overall ?? null : 0,
    log_att: r.pre ? Math.log1p(pre.pass_att || 0) : 0,
    rating: r.portal_rating ?? null,
    gap: r.dest_rating != null && oR != null ? r.dest_rating - oR : null,
    ret_pass: r.dest_returning_pass_ppa ?? null,
    inc: Math.max(0, (r.dest_qb_transfers_in_same_cycle ?? 1) - 1),
    hc: r.dest_hc_change == null ? null : r.dest_hc_change ? 1 : 0,
  };
}
const dirOf = (gap) => (gap == null ? "Unknown" : gap > 6 ? "Up" : gap < -6 ? "Down" : "Lateral");

function outcomes(rows, train) {
  // expectation for PPA given move size, from training rows with meaningful volume
  const pts = train.filter((r) => r.post1 && (r.post1.ppa_plays_est ?? 0) >= 50 && r.f.gap != null).map((r) => [r.f.gap, r.post1.ppa_all]);
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  const b = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / Math.max(1e-9, pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0));
  const exp = (gap) => my + b * ((gap ?? mx) - mx);
  for (const r of rows) {
    const u = r.post1?.usage_overall ?? 0, vol = r.post1?.ppa_plays_est ?? 0;
    r.o = { usage: u, opp: u >= Q.usageTh ? 1 : 0, ppa: r.post1?.ppa_all ?? null, exp: exp(r.f.gap) };
    r.o.contrib = vol >= 50 && r.o.ppa != null && r.o.ppa >= r.o.exp ? 1 : 0;
    r.o.paired = r.o.opp && r.o.contrib ? 1 : 0;
    const du = u - (r.pre?.usage_overall ?? 0);
    r.o.band = !r.post1 || du <= -0.15 || (vol >= 50 && r.o.ppa < r.o.exp - 0.15) ? "Less" : du >= 0.1 && r.o.contrib ? "More" : "Similar";
  }
  return { slope: b, intercept: my - b * mx, n };
}

function runFold(all, trainC, testC, keysSet, crit) {
  const train = all.filter((r) => trainC.includes(r.cycle)), test = all.filter((r) => r.cycle === testC);
  const ex = outcomes([...train, ...test], train);
  const dests = [...new Set(train.map((r) => r.dest))];
  const res = {};
  let fx = null;
  for (const [name, keys] of Object.entries(SETS)) {
    if (keysSet && !keysSet.includes(name)) continue;
    const raw = (r) => Object.fromEntries(keys.map((k) => [k, r.f[k]]));
    const scaler = buildScaler(train.map(raw), keys);
    const prep = (r) => ({ g: Math.max(0, JUMPQ.indexOf(r.jump)), z: standardize(scaler, raw(r)).z, y: r.o[crit], r: [dests.indexOf(r.dest)] });
    const data = train.map(prep);
    const base = data.reduce((a, d) => a + d.y, 0) / data.length;
    const prior = { m0: logit(Math.min(0.95, Math.max(0.05, base))), s0: 1.5, sigmaBeta: 1.0, reFactors: [{ levels: dests.length }], fixed: fx };
    const m = fit(data, JUMPQ.length, keys.length, prior);
    if (name === "full") fx = { tau: m.tau, tauR: m.tauR };
    const ps = test.map((r) => { const d = prep(r); return predictFast(m, d.g, d.z, d.r); });
    const ys = test.map((r) => r.o[crit]);
    res[name] = { m, keys, ps, ys, met: metrics(ps, ys), ci: bootstrap(ps, ys, 200, testC), scaler };
  }
  return { trainC, testC, train, test, ex, res, dests };
}

function compute() {
  const rows = Q.data.rows.filter((r) => r.cycle <= 2025).map((r) => ({ ...r, jump: `${r.origin_tier}→${r.dest_tier}`, f: feat(r) }));
  rows.forEach((r) => (r.dir = dirOf(r.f.gap)));
  const t0 = performance.now();
  const folds = [[[2022], 2023], [[2022, 2023], 2024], [[2022, 2023, 2024], 2025]].map(([tr, te]) => runFold(rows, tr, te, null, Q.crit));
  const last = folds[folds.length - 1];
  // report each criterion separately for the full and rating-only models on the last fold
  const byCrit = ["opp", "contrib", "paired"].map((c) => ({ c, f: runFold(rows, last.trainC, last.testC, ["full", "rating"], c) }));
  Q.res = { rows, folds, last, byCrit, ms: performance.now() - t0 };
}

export function bindQBReal(ctx) {
  Q.ctx = ctx;
  document.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.id === "qb-crit") { Q.crit = t.value; compute(); await logFit(); ctx.render(); }
    if (t.id === "qb-th") { Q.usageTh = +t.value; compute(); await logFit(); ctx.render(); }
  });
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act='qb-reveal']"); if (!t) return;
    Q.hide = !Q.hide; ctx.render();
  });
}
async function load() {
  if (Q.data || Q.loading) return; Q.loading = true;
  try {
    const r = await fetch("./data/qb_real.json"); if (!r.ok) throw new Error("HTTP " + r.status);
    Q.data = await r.json();
    await Q.ctx.log("qbreal.load", "Load real QB transfers (CollegeFootballData.com)", { rows: Q.data.rows.length, calls_used_to_build: Q.data.calls_used, generated: Q.data.generated }, { classes: Object.keys(Q.data.coverage) }, "observed");
    compute(); await logFit();
  } catch (e) { Q.err = String(e.message || e); }
  Q.loading = false; Q.ctx.render();
}
async function logFit() {
  const L = Q.res.last;
  await Q.ctx.log("qbreal.fit", `Real QB backtest · criterion ${Q.crit}`, { train: L.trainC, test: L.testC, usage_threshold: Q.usageTh, predictors: SETS.full }, { brier_full: +L.res.full.met.brier.toFixed(4), brier_rating_only: +L.res.rating.met.brier.toFixed(4), auc_full: +L.res.full.met.auc.toFixed(3), calibration_slope: +L.res.full.met.slope.toFixed(3), n_test: L.test.length }, "estimate");
}

const pct = (x) => Math.round(x * 100);
const f2 = (x, d = 3) => (x == null || Number.isNaN(x) ? "—" : x.toFixed(d));
const kpi = (l, v, u, s) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}${u ? `<small>${u}</small>` : ""}</div><div class="s">${s}</div></div>`;
const CRIT = { paired: "Paired: starter-level usage and PPA at or above expectation", opp: "Opportunity only: starter-level usage", contrib: "Contribution only: PPA at or above expectation for the move" };
const GRID = { Up: { More: "Ascent", Similar: "Step-up held", Less: "Absorbed" }, Lateral: { More: "Opportunity gain", Similar: "Lateral move", Less: "Displacement" }, Down: { More: "Opportunity transfer", Similar: "Relocation", Less: "Decline" } };

export function pageQBReal(esc, badge) {
  if (!Q.data && !Q.err) { load(); return `<div class="empty">Loading real quarterback transfers…</div>`; }
  if (Q.err) return `<div class="callout">Could not load the real QB dataset (${esc(Q.err)}).</div>`;
  const R = Q.res, L = R.last, F = L.res;
  const met = (x) => `<td class="n"><b>${f2(x.met.brier)}</b><br/><span class="dim small">${f2(x.ci.brier[0])}–${f2(x.ci.brier[1])}</span></td><td class="n">${f2(x.met.slope, 2)}</td><td class="n">${f2(x.met.ece)}</td><td class="n">${f2(x.met.auc)}<br/><span class="dim small">${f2(x.ci.auc[0], 2)}–${f2(x.ci.auc[1], 2)}</span></td>`;
  const cov = Q.data.coverage;
  const covRows = Object.entries(cov).map(([y, c]) => `<tr><td class="mono">${y}</td><td class="n">${c.portal_qb_entries}</td><td class="n">${c.fbs_destination}</td><td class="n">${c.matched_pre_stats}</td><td class="n">${c.matched_post_stats}</td><td>${+y === 2026 ? "Season in progress — not labelled" : +y === 2025 ? "Test class" : "Training class"}</td></tr>`).join("");
  const G = F.full.m.G, coef = F.full.keys.map((k, i) => ({ label: FEATS.find((f) => f.k === k).l, m: F.full.m.theta[1 + G + i], sd: Math.sqrt(F.full.m.cov[1 + G + i][1 + G + i]) }));
  const test = L.test.map((r, i) => ({ r, p: F.full.ps[i], pr: F.rating.ps[i] })).sort((a, b) => b.p - a.p);
  const cnt = {}; L.test.forEach((r) => { if (r.dir !== "Unknown") cnt[r.dir + r.o.band] = (cnt[r.dir + r.o.band] || 0) + 1; });
  const nKnown = L.test.filter((r) => r.dir !== "Unknown").length || 1;
  const grid = `<table class="t grid3"><thead><tr><th>Move direction</th><th>More play and contribution</th><th>Similar</th><th>Less</th></tr></thead><tbody>${["Up", "Lateral", "Down"].map((d) => `<tr><th>${d}</th>${["More", "Similar", "Less"].map((b) => `<td class="g3 g3-${b}"><b>${GRID[d][b]}</b><span>${cnt[d + b] || 0} · ${pct((cnt[d + b] || 0) / nKnown)}%</span></td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const ratingBeats = F.rating.met.brier < F.full.met.brier;
  return `
  <div class="callout fz"><b>Real data, real names, public sources.</b> ${Q.data.rows.length} quarterback portal entries with an FBS destination, classes 2022–2026, from <a href="https://collegefootballdata.com" target="_blank" rel="noopener">CollegeFootballData.com</a> (${Q.data.calls_used} API calls to build, cached). The model is fitted in this browser on the 2022–2024 classes and scores the 2025 class blind. This is a retrospective backtest of the method; it does not score current portal players and makes no recommendation about any individual.</div>
  <div class="row-btns" style="margin:12px 0">
    <div class="field"><label for="qb-crit">Criterion</label><select id="qb-crit">${Object.entries(CRIT).map(([k, v]) => `<option value="${k}" ${Q.crit === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
    <div class="field"><label for="qb-th">Starter-level usage</label><select id="qb-th">${[0.2, 0.25, 0.3, 0.35].map((v) => `<option value="${v}" ${Q.usageTh === v ? "selected" : ""}>≥ ${pct(v)}% of team plays</option>`).join("")}</select></div>
  </div>
  <div class="kpis">
    ${kpi("Brier · full model", f2(F.full.met.brier), "", `rating-only ${f2(F.rating.met.brier)} · production-only ${f2(F.production.met.brier)}`)}
    ${kpi("Calibration slope", f2(F.full.met.slope, 2), "", "1.00 = honest; below 1 = overconfident")}
    ${kpi("AUC", f2(F.full.met.auc, 2), "", `90% bootstrap ${f2(F.full.ci.auc[0], 2)}–${f2(F.full.ci.auc[1], 2)} · literature range 0.64–0.71`)}
    ${kpi("Test class", L.testC, "", `${L.test.length} QBs · base rate ${pct(F.full.met.base)}% · trained on ${L.train.length}`)}
    ${kpi("Fit time", Math.round(R.ms), " ms", "3 folds × 4 models + criteria, in-browser")}
  </div>
  ${ratingBeats ? `<div class="callout" style="margin-bottom:14px"><b>Honest result:</b> on the 2025 class the portal-rating-only model has a lower Brier score than the full model (${f2(F.rating.met.brier)} vs ${f2(F.full.met.brier)}). On this criterion the extra public inputs have not yet earned their place.</div>` : `<div class="callout fz" style="margin-bottom:14px">On the 2025 class the full model's Brier score is ${f2(F.full.met.brier)} against ${f2(F.rating.met.brier)} for portal rating alone. Check the bootstrap intervals before reading this as an improvement: one class of ${L.test.length} players is a small test.</div>`}
  <div class="grid g2">
    <section class="card"><div class="card-h"><div><h3>Incremental value over simpler models · 2025 class</h3><p>${esc(CRIT[Q.crit])}. Brier and AUC with 90% bootstrap intervals.</p></div></div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Approach</th><th class="n">Brier</th><th class="n">Cal. slope</th><th class="n">Cal. error</th><th class="n">AUC</th></tr></thead><tbody>
      ${Object.keys(SETS).map((k) => `<tr><td>${k === "full" ? "<b>" + SET_LABEL[k] + "</b>" : k === "context" ? `<span class="dim">${SET_LABEL[k]}</span>` : SET_LABEL[k]}</td>${met(F[k])}</tr>`).join("")}</tbody></table></div></section>
    <section class="card card-pad"><div class="card-h"><div><h3>Calibration · 2025 class</h3><p>Quintiles of predicted probability against the observed rate.</p></div></div>
      <div class="cal-wrap">${C.calibration([{ bins: F.rating.met.bins, color: "#9aa0a8" }, { bins: F.full.met.bins, color: "#ba0c2f" }])}
      <div class="legend v"><span><i style="background:#ba0c2f"></i>Full model</span><span><i style="background:#9aa0a8"></i>Portal rating only</span></div></div></section>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <section class="card"><div class="card-h"><div><h3>Walk-forward folds</h3><p>Each fold fits only on earlier classes.</p></div></div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Train → test</th><th class="n">n test</th><th class="n">Brier full</th><th class="n">Brier rating-only</th><th class="n">Cal. slope</th><th class="n">AUC</th></tr></thead><tbody>
      ${R.folds.map((f) => `<tr><td class="mono">${f.trainC.join(" + ")} → ${f.testC}</td><td class="n">${f.test.length}</td><td class="n">${f2(f.res.full.met.brier)}</td><td class="n">${f2(f.res.rating.met.brier)}</td><td class="n">${f2(f.res.full.met.slope, 2)}</td><td class="n">${f2(f.res.full.met.auc)}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="card"><div class="card-h"><div><h3>Each criterion reported separately</h3><p>2025 class. Opportunity is partly a staff decision; contribution is not.</p></div></div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Criterion</th><th class="n">Base rate</th><th class="n">Brier full</th><th class="n">Brier rating-only</th><th class="n">AUC full</th></tr></thead><tbody>
      ${R.byCrit.map((b) => `<tr><td>${esc(CRIT[b.c])}</td><td class="n">${pct(b.f.res.full.met.base)}%</td><td class="n">${f2(b.f.res.full.met.brier)}</td><td class="n">${f2(b.f.res.rating.met.brier)}</td><td class="n">${f2(b.f.res.full.met.auc)}</td></tr>`).join("")}</tbody></table></div>
      <p class="note" style="padding:0 16px 14px">Expectation for the move: season-one PPA = ${f2(L.ex.intercept)} ${L.ex.slope >= 0 ? "+" : "−"} ${f2(Math.abs(L.ex.slope), 4)} × rating gap, fitted on ${L.ex.n} training QBs with 50+ plays.</p></section>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <section class="card card-pad"><div class="card-h"><div><h3>Learned weights · real data</h3><p>Log-odds per 1 SD, 90% intervals, fitted on 2022–2024. Associations, not causes.</p></div></div>${C.forest(coef)}</section>
    <section class="card card-pad"><div class="card-h"><div><h3>2025 class · outcome classes</h3><p>Move direction from the SP+ gap (±6 points) by change in usage and PPA against expectation. ${L.test.length - nKnown} players with no rating for one school are left out.</p></div></div>${grid}</section>
  </div>
  <section class="card" style="margin-top:14px">
    <div class="card-h"><div><h3>2025 class · ranked by what the model said beforehand</h3><p>${esc(CRIT[Q.crit])}. Outcomes ${Q.hide ? "hidden" : "shown"}.</p></div><div class="sp"></div><button class="btn sm ${Q.hide ? "primary" : ""}" data-act="qb-reveal">${Q.hide ? "Reveal outcomes" : "Hide outcomes"}</button></div>
    <div class="scroll-x"><table class="t"><thead><tr><th>#</th><th>Player</th><th>Move</th><th class="n">Gap</th><th class="n">Pre PPA/pass</th><th class="n">Model</th><th class="n">Rating-only</th><th class="n">Usage 2025</th><th class="n">PPA vs expected</th><th>Outcome class</th><th>Met</th></tr></thead><tbody>
    ${test.slice(0, 60).map((x, i) => { const r = x.r; return `<tr><td class="n">${i + 1}</td><td><b>${esc(r.name)}</b></td><td>${esc(r.origin)} → ${esc(r.dest)} <span class="dim">(${r.jump})</span></td><td class="n mono">${r.f.gap == null ? "—" : (r.f.gap >= 0 ? "+" : "") + r.f.gap.toFixed(1)}</td><td class="n">${f2(r.f.ppa_pass, 2)}</td><td class="n"><b>${pct(x.p)}%</b></td><td class="n">${pct(x.pr)}%</td>
      ${Q.hide ? `<td class="n dim">hidden</td><td class="n dim">hidden</td><td class="dim">hidden</td><td class="dim">hidden</td>` : `<td class="n">${pct(r.o.usage)}%</td><td class="n">${r.o.ppa == null ? "did not play" : `${f2(r.o.ppa, 2)} vs ${f2(r.o.exp, 2)}`}</td><td>${r.dir === "Unknown" ? "—" : GRID[r.dir][r.o.band]}</td><td>${r.o[Q.crit] ? '<span class="badge b-ok">Met</span>' : '<span class="badge b-bad">Not met</span>'}</td>`}</tr>`; }).join("")}
    </tbody></table></div><p class="note" style="padding:8px 16px 14px">Showing the top 60 of ${test.length}.</p></section>
  <div class="grid g2" style="margin-top:14px">
    <section class="card"><div class="card-h"><div><h3>Coverage by class</h3><p>Name + team matching between portal entries and season stats.</p></div></div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Class</th><th class="n">QB entries</th><th class="n">FBS destination</th><th class="n">Pre stats</th><th class="n">Season-one stats</th><th>Role</th></tr></thead><tbody>${covRows}</tbody></table></div></section>
    <section class="card card-pad"><div class="card-h"><div><h3>Known limits of this backtest</h3></div></div>
      <ul class="lim">
        <li>Opponent-adjusted EPA (CFBD WEPA) needs a paid tier and returned 401 on the free key, so raw PPA is used. Rushing PPA stands in for designed-run EPA; it includes scrambles.</li>
        <li>Usage is the share of team plays involving the player, not snap share. A player with no season-one stats is counted as not meeting either criterion.</li>
        <li>FCS origins have no SP+ rating and are assigned ${FCS_RATING}. Origin-program effects are left out on real data because most origins appear once; destination effects are kept.</li>
        <li>About a quarter of portal entries do not match pre-transfer stats (mostly backups, redshirts and JUCO or Division II origins). Their production inputs are imputed and widen the uncertainty.</li>
        <li>Historical outcomes reflect staff decisions made without this model, so this test cannot estimate performative effects. That is the job of the prospective test.</li>
      </ul></section>
  </div>`;
}
