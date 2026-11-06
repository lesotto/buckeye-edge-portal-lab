// Glue between the synthetic data, the success definition and the Bayesian model.
import { buildScaler, standardize, fit, predictFast, predictMC, metrics, logit, sigmoid } from "./model.js";
import { FEATURES, JUMPS, CYCLES, label } from "./data.js";

export const ALL_KEYS = FEATURES.map((f) => f.k);

function prepare(rows, scaler, def, th) {
  const out = [];
  for (const p of rows) {
    const y = label(def, th, p);
    if (y === null || y === undefined) continue;
    const s = standardize(scaler, p);
    out.push({ p, g: JUMPS.indexOf(p.jump), z: s.z, y });
  }
  return out;
}

// Fit the full model (or a reduced comparator) on a set of cycles.
export function fitModel(history, cfg, cycles, keys = ALL_KEYS) {
  const pool = history.filter((p) => p.pos === cfg.pos && cycles.includes(p.cycle));
  const scaler = buildScaler(pool, keys);
  const data = prepare(pool, scaler, cfg.def, cfg.th);
  const base = data.length ? data.reduce((a, d) => a + d.y, 0) / data.length : 0.4;
  const prior = { m0: logit(Math.min(0.95, Math.max(0.05, cfg.priorRate ?? 0.4))), s0: 1.5, sigmaBeta: cfg.sigmaBeta };
  const m = fit(data, JUMPS.length, keys.length, prior);
  m.scaler = scaler; m.keys = keys; m.cycles = cycles; m.base = base;
  m.groupCounts = JUMPS.map((j, g) => {
    const d = data.filter((x) => x.g === g);
    return { jump: j, n: d.length, k: d.reduce((a, x) => a + x.y, 0) };
  });
  return m;
}

export function labelledCycles(history, cfg) {
  return CYCLES.map((c) => c.id).filter((cy) => history.some((p) => p.pos === cfg.pos && p.cycle === cy && label(cfg.def, cfg.th, p) !== null));
}

export function scorePlayer(m, p, S = 3000) {
  const std = standardize(m.scaler, p);
  const g = JUMPS.indexOf(p.jump);
  const mc = predictMC(m, g, std, S, hashSeed(p.id));
  return { std, g, ...mc, fast: predictFast(m, g, std.z) };
}
function hashSeed(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// Prior → evidence → posterior waterfall in log-odds, using posterior-mean coefficients.
export function waterfall(m, p, std, blocks) {
  const G = m.G, g = JUMPS.indexOf(p.jump);
  let eta = m.theta[1 + g];
  const steps = [{ name: "Baseline · comparable transfers", p: sigmoid(eta), delta: 0, cls: "estimate", parts: [] }];
  for (const b of blocks) {
    let d = 0; const parts = [];
    m.keys.forEach((k, i) => {
      const f = FEATURE_BY_KEY[k];
      if (f.block !== b) return;
      const c = m.theta[1 + G + i] * std.z[i];
      d += c;
      parts.push({ k, label: f.label, z: std.z[i], beta: m.theta[1 + G + i], sd: Math.sqrt(m.cov[1 + G + i][1 + G + i]), contrib: c, imputed: std.miss.includes(i), raw: p[k] });
    });
    eta += d;
    steps.push({ name: b, p: sigmoid(eta), delta: d, parts, cls: b === "Staff evaluation" ? "staff" : "observed", imputed: parts.length && parts.every((x) => x.imputed) });
  }
  return steps;
}
const FEATURE_BY_KEY = Object.fromEntries(FEATURES.map((f) => [f.k, f]));

// Staff-vs-model disagreement: staff signal pushes against everything else by a meaningful margin.
export function disagreement(m, p, std) {
  const i = m.keys.indexOf("staff");
  if (i < 0 || p.staff === null || p.staff === undefined) return null;
  const G = m.G, g = JUMPS.indexOf(p.jump);
  const staffC = m.theta[1 + G + i] * std.z[i];
  let rest = 0; m.keys.forEach((k, j) => { if (j !== i) rest += m.theta[1 + G + j] * std.z[j]; });
  if (Math.abs(staffC) >= 0.35 && Math.abs(rest) >= 0.35 && Math.sign(staffC) !== Math.sign(rest)) {
    return { staffC, rest, pNoStaff: sigmoid(m.theta[1 + g] + rest) };
  }
  return null;
}

export function backtest(history, cfg) {
  const cyc = labelledCycles(history, cfg);
  if (cyc.length < 2) return null;
  const test = cyc[cyc.length - 1], train = cyc.slice(0, -1);
  const testRows = history.filter((p) => p.pos === cfg.pos && p.cycle === test && label(cfg.def, cfg.th, p) !== null);
  const ys = testRows.map((p) => label(cfg.def, cfg.th, p));
  const run = (keys) => {
    const m = fitModel(history, cfg, train, keys);
    const ps = testRows.map((p) => predictFast(m, JUMPS.indexOf(p.jump), standardize(m.scaler, p).z));
    return { m, ps, met: metrics(ps, ys) };
  };
  const full = run(ALL_KEYS);
  const baseline = run([]);
  const rating = run(["rating"]);
  const staff = run(["staff"]);
  const noStaff = run(ALL_KEYS.filter((k) => k !== "staff"));
  return { test, train, rows: testRows, ys, full, baseline, rating, staff, noStaff };
}

export function learningCurve(history, cfg, board) {
  const cyc = labelledCycles(history, cfg);
  const pts = [];
  for (let n = 1; n <= cyc.length; n++) {
    const m = fitModel(history, cfg, cyc.slice(0, n));
    const widths = board.map((p) => { const s = scorePlayer(m, p, 800); return s.q90 - s.q10; });
    const paramW = board.map((p) => { const s = scorePlayer(m, p, 800); return s.widthParamOnly; });
    pts.push({ cycles: cyc.slice(0, n), n: m.n, width: widths.reduce((a, b) => a + b, 0) / widths.length, paramWidth: paramW.reduce((a, b) => a + b, 0) / paramW.length });
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
