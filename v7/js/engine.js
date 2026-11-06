// Glue between the synthetic data, the success definition and the Bayesian model (v2).
import { buildScaler, standardize, fit, predictFast, predictMC, metrics, bootstrap, logit, sigmoid } from "./model.js";
import { FEATURES, JUMPS, CYCLES, DEFS, PLAYER_BLOCKS, DEST_PROGRAMS, ORIGIN_PROGRAMS, label } from "./data.js";

export const ALL_KEYS = FEATURES.map((f) => f.k);
export const CONTEXT_KEYS = FEATURES.filter((f) => f.block === "Program context").map((f) => f.k);
// Rec. 2: never use the same grading provider for predictor and criterion
export const activeKeys = (cfg, keys = ALL_KEYS) => (DEFS[cfg.def]?.usesGrade ? keys.filter((k) => k !== "film") : keys);
export const reIdx = (p) => [DEST_PROGRAMS.indexOf(p.dest), ORIGIN_PROGRAMS.indexOf(p.from)];
const RE_FACTORS = [{ name: "Destination program", levels: DEST_PROGRAMS.length }, { name: "Origin program", levels: ORIGIN_PROGRAMS.length }];

function prepare(rows, scaler, def, th) {
  const out = [];
  for (const p of rows) {
    const y = label(def, th, p);
    if (y === null || y === undefined) continue;
    const s = standardize(scaler, p);
    out.push({ p, g: JUMPS.indexOf(p.jump), z: s.z, y, r: reIdx(p) });
  }
  return out;
}

// Fit the full model (or a reduced comparator) on a set of cycles.
export function fitModel(history, cfg, cycles, keys = activeKeys(cfg), fixed = null, defOverride = null) {
  const def = defOverride || cfg.def;
  const pool = history.filter((p) => p.pos === cfg.pos && cycles.includes(p.cycle));
  const scaler = buildScaler(pool, keys);
  const data = prepare(pool, scaler, def, cfg.th);
  const base = data.length ? data.reduce((a, d) => a + d.y, 0) / data.length : 0.4;
  const prior = { m0: logit(Math.min(0.95, Math.max(0.05, cfg.priorRate ?? 0.4))), s0: 1.5, sigmaBeta: cfg.sigmaBeta, reFactors: cfg.programEffects === false ? [] : RE_FACTORS, fixed };
  const m = fit(data, JUMPS.length, keys.length, prior);
  m.scaler = scaler; m.keys = keys; m.cycles = cycles; m.base = base; m.sigmaB = cfg.sigmaB ?? 0; m.def = def;
  m.groupCounts = JUMPS.map((j, g) => {
    const d = data.filter((x) => x.g === g);
    return { jump: j, n: d.length, k: d.reduce((a, x) => a + x.y, 0) };
  });
  m.reCounts = RE_FACTORS.map((_, f) => { const c = {}; for (const d of data) { const l = d.r[f]; if (l >= 0) c[l] = (c[l] || 0) + 1; } return c; });
  return m;
}

export function labelledCycles(history, cfg) {
  return CYCLES.map((c) => c.id).filter((cy) => history.some((p) => p.pos === cfg.pos && p.cycle === cy && label(cfg.def, cfg.th, p) !== null));
}

// comparable-move base rate: same level jump, rating gap, destination, origin and roster context,
// with every player-specific input held at the cohort average
export function moveBase(m, p, std) {
  const G = m.G, g = JUMPS.indexOf(p.jump), r = reIdx(p);
  let eta = m.theta[1 + g];
  (m.reFactors || []).forEach((_, f) => { if (r[f] >= 0) eta += m.theta[m.reOffs[f] + r[f]]; });
  m.keys.forEach((k, i) => { if (CONTEXT_KEYS.includes(k)) eta += m.theta[1 + G + i] * std.z[i]; });
  return { eta, p: sigmoid(eta) };
}

export function scorePlayer(m, p, S = 3000) {
  const std = standardize(m.scaler, p);
  const g = JUMPS.indexOf(p.jump);
  const mc = predictMC(m, g, std, S, hashSeed(p.id), reIdx(p), m.sigmaB);
  const mb = moveBase(m, p, std);
  // largest single-input contribution (log-odds) — flags estimates driven by one input
  let top = null, totAbs = 0;
  m.keys.forEach((k, i) => { if (CONTEXT_KEYS.includes(k)) return; const c = m.theta[1 + m.G + i] * std.z[i]; totAbs += Math.abs(c); if (!top || Math.abs(c) > Math.abs(top.c)) top = { k, c }; });
  const flags = [];
  if (mc.mean > 0.9 || mc.mean < 0.1) flags.push("extreme");
  if (top && Math.abs(top.c) >= 1.0 && Math.abs(top.c) / Math.max(1e-6, totAbs) > 0.5) flags.push("single");
  return { std, g, ...mc, fast: predictFast(m, g, std.z, reIdx(p)), base: mb.p, baseEta: mb.eta, shift: mc.mean - mb.p, shiftLo: mc.q10 - mb.p, shiftHi: mc.q90 - mb.p, top, flags };
}
function hashSeed(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// Comparable-move base → player evidence → posterior, in log-odds, using posterior-mean coefficients.
export function waterfall(m, p, std, blocks = PLAYER_BLOCKS) {
  const G = m.G;
  const mb = moveBase(m, p, std);
  let eta = mb.eta;
  const ctxParts = [];
  m.keys.forEach((k, i) => { const f = FEATURE_BY_KEY[k]; if (f.block !== "Program context") return; ctxParts.push(part(m, p, std, k, i)); });
  const steps = [{ name: "Comparable moves", p: mb.p, delta: 0, cls: "estimate", parts: ctxParts }];
  for (const b of blocks) {
    let d = 0; const parts = [];
    m.keys.forEach((k, i) => {
      const f = FEATURE_BY_KEY[k];
      if (f.block !== b) return;
      const x = part(m, p, std, k, i); d += x.contrib; parts.push(x);
    });
    if (!parts.length) continue;
    eta += d;
    steps.push({ name: b, p: sigmoid(eta), delta: d, parts, cls: b === "Staff evaluation" ? "staff" : "observed", imputed: parts.length && parts.every((x) => x.imputed) });
  }
  return steps;
}
function part(m, p, std, k, i) {
  const G = m.G, f = FEATURE_BY_KEY[k];
  return { k, label: f.label, block: f.block, z: std.z[i], beta: m.theta[1 + G + i], sd: Math.sqrt(m.cov[1 + G + i][1 + G + i]), contrib: m.theta[1 + G + i] * std.z[i], imputed: std.miss.includes(i), raw: p[k] };
}
export const FEATURE_BY_KEY = Object.fromEntries(FEATURES.map((f) => [f.k, f]));

// Staff-vs-model disagreement: staff signal pushes against everything else by a meaningful margin.
export function disagreement(m, p, std) {
  const i = m.keys.indexOf("staff");
  if (i < 0 || p.staff === null || p.staff === undefined) return null;
  const G = m.G;
  const staffC = m.theta[1 + G + i] * std.z[i];
  let rest = 0; m.keys.forEach((k, j) => { if (j !== i && !CONTEXT_KEYS.includes(k)) rest += m.theta[1 + G + j] * std.z[j]; });
  if (Math.abs(staffC) >= 0.35 && Math.abs(rest) >= 0.35 && Math.sign(staffC) !== Math.sign(rest)) {
    const mb = moveBase(m, p, std);
    return { staffC, rest, pNoStaff: sigmoid(mb.eta + rest) };
  }
  return null;
}

// Walk-forward backtest: fit only on classes before each test class, roll forward one class at a time.
export function backtest(history, cfg) {
  const cyc = labelledCycles(history, cfg);
  if (cyc.length < 2) return null;
  const keysFull = activeKeys(cfg);
  const folds = [];
  for (let t = 1; t < cyc.length; t++) {
    const test = cyc[t], train = cyc.slice(0, t);
    const testRows = history.filter((p) => p.pos === cfg.pos && p.cycle === test && label(cfg.def, cfg.th, p) !== null);
    const ys = testRows.map((p) => label(cfg.def, cfg.th, p));
    const full = fitModel(history, cfg, train, keysFull);
    const fx = { tau: full.tau, tauR: full.tauR };
    const run = (keys, defO = null) => {
      const m = keys === keysFull && !defO ? full : fitModel(history, cfg, train, keys, fx, defO);
      const yy = defO ? testRows.map((p) => label(defO, cfg.th, p)) : ys;
      const ps = testRows.map((p) => predictFast(m, JUMPS.indexOf(p.jump), standardize(m.scaler, p).z, reIdx(p)));
      const met = metrics(ps, yy);
      return { m, ps, ys: yy, met, ci: bootstrap(ps, yy, 150, test) };
    };
    const ctx = CONTEXT_KEYS;
    const R = {
      full: run(keysFull),
      noStaff: run(keysFull.filter((k) => k !== "staff")),
      rating: run(["rating"]),
      staff: run(["staff"]),
      baseline: run(ctx),
    };
    // Rec. 6: staff-grade validity judged against a criterion the staff does not control
    R.staffContrib = run(["staff"], "contribution");
    R.ratingContrib = run(["rating"], "contribution");
    R.fullContrib = run(activeKeys({ ...cfg, def: "contribution" }), "contribution");
    // break out by move direction
    const byDir = ["Up", "Lateral", "Down"].map((d) => {
      const ix = testRows.map((p, i) => (p.dir === d ? i : -1)).filter((i) => i >= 0);
      return { dir: d, n: ix.length, met: ix.length >= 8 ? metrics(ix.map((i) => R.full.ps[i]), ix.map((i) => ys[i])) : null };
    });
    folds.push({ test, train, rows: testRows, ys, ...R, byDir });
  }
  const last = folds[folds.length - 1];
  return { ...last, folds };
}

export function learningCurve(history, cfg, board) {
  const cyc = labelledCycles(history, cfg);
  const pts = [];
  for (let n = 1; n <= cyc.length; n++) {
    const m = fitModel(history, cfg, cyc.slice(0, n));
    const sc = board.map((p) => scorePlayer(m, p, 600));
    pts.push({ cycles: cyc.slice(0, n), n: m.n, width: sc.reduce((a, s) => a + s.q90 - s.q10, 0) / sc.length, paramWidth: sc.reduce((a, s) => a + s.widthParamOnly, 0) / sc.length });
  }
  return pts;
}

export function comparables(history, m, cfg, p, std, k = 8) {
  const pool = history.filter((h) => h.pos === p.pos && h.jump === p.jump && m.cycles.includes(h.cycle) && label(cfg.def, cfg.th, h) !== null);
  return pool
    .map((h) => {
      const z = standardize(m.scaler, h).z;
      let d = 0; for (let i = 0; i < z.length; i++) d += (z[i] - std.z[i]) ** 2;
      return { h, d: Math.sqrt(d), y: label(cfg.def, cfg.th, h) };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, k);
}
