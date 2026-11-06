// Buckeye Edge · Portal Lab v2 — Bayesian engine
// Hierarchical Bayesian logistic regression fitted in the browser.
//   y_i ~ Bernoulli(sigmoid(eta_i))
//   eta_i = alpha[move(i)] + u_dest[d(i)] + v_orig[o(i)] + sum_k beta_k * x_ik   (x standardized)
//   alpha_j  ~ Normal(mu, tau^2)       partial pooling across move-direction classes
//   u_d, v_o ~ Normal(0, tauR^2)       crossed random effects for destination and origin programs
//   mu       ~ Normal(m0, s0^2)        league-wide baseline for the position
//   beta_k   ~ Normal(0, sigmaBeta^2)  weakly informative, user-adjustable
// Posterior: Laplace approximation (Newton-Raphson MAP + inverse Hessian).
// tau and tauR: empirical Bayes, coordinate grid search on the Laplace marginal likelihood.
// Prediction adds a behavioral / post-decision term e ~ Normal(0, sigmaB^2) on the logit
// scale, so the interval separates parameter, missing-evidence and behavioral uncertainty.
// Missing features: conditional Gaussian imputation from the cohort covariance;
// at prediction time missing values are sampled, so missing evidence widens the interval.

export const sigmoid = (z) => 1 / (1 + Math.exp(-z));
export const logit = (p) => Math.log(p / (1 - p));

// ---------- seeded RNG ----------
export function rng(seed) {
  let a = seed >>> 0;
  const u = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  const n = () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let x, y, r;
    do { x = 2 * u() - 1; y = 2 * u() - 1; r = x * x + y * y; } while (r >= 1 || r === 0);
    const m = Math.sqrt(-2 * Math.log(r) / r);
    spare = y * m; return x * m;
  };
  return { u, n };
}

// ---------- tiny linear algebra ----------
const zeros = (r, c) => Array.from({ length: r }, () => new Float64Array(c));
export function cholesky(A) {
  const n = A.length, L = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-12));
      else L[i][j] = s / L[j][j];
    }
  }
  return L;
}
function cholSolve(L, b) {
  const n = L.length, y = new Float64Array(n), x = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
  return x;
}
export function invertSPD(A) {
  const n = A.length, L = cholesky(A), inv = zeros(n, n);
  for (let j = 0; j < n; j++) {
    const e = new Float64Array(n); e[j] = 1;
    const col = cholSolve(L, e);
    for (let i = 0; i < n; i++) inv[i][j] = col[i];
  }
  return inv;
}
const logDetFromChol = (L) => { let s = 0; for (let i = 0; i < L.length; i++) s += 2 * Math.log(L[i][i]); return s; };

// ---------- standardization + conditional imputation ----------
export function buildScaler(rows, keys) {
  const mean = {}, sd = {};
  for (const k of keys) {
    const v = rows.map((r) => r[k]).filter((x) => x !== null && x !== undefined);
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    const s = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, v.length - 1)) || 1;
    mean[k] = m; sd[k] = s;
  }
  // covariance of standardized features on pairwise-complete rows
  const K = keys.length, C = zeros(K, K);
  for (let a = 0; a < K; a++) for (let b = a; b < K; b++) {
    let s = 0, n = 0;
    for (const r of rows) {
      const x = r[keys[a]], y = r[keys[b]];
      if (x == null || y == null) continue;
      s += ((x - mean[keys[a]]) / sd[keys[a]]) * ((y - mean[keys[b]]) / sd[keys[b]]); n++;
    }
    C[a][b] = C[b][a] = n > 2 ? s / (n - 1) : (a === b ? 1 : 0);
  }
  for (let a = 0; a < K; a++) C[a][a] = Math.max(C[a][a], 1e-3) + 1e-6;
  return { keys, mean, sd, cov: C };
}

// returns { z: Float64Array(K) (observed or conditional mean), miss: int[], condMean, condChol }
export function standardize(scaler, raw) {
  const { keys, mean, sd, cov } = scaler, K = keys.length;
  const z = new Float64Array(K), obs = [], miss = [];
  keys.forEach((k, i) => {
    const v = raw[k];
    if (v === null || v === undefined || Number.isNaN(v)) miss.push(i);
    else { z[i] = (v - mean[k]) / sd[k]; obs.push(i); }
  });
  if (!miss.length) return { z, miss, condChol: null };
  // conditional Gaussian: mu_M|O = S_MO S_OO^-1 z_O ; S_M|O = S_MM - S_MO S_OO^-1 S_OM
  const nO = obs.length, nM = miss.length;
  let condMean = new Float64Array(nM), condCov = zeros(nM, nM);
  if (nO === 0) {
    for (let a = 0; a < nM; a++) for (let b = 0; b < nM; b++) condCov[a][b] = cov[miss[a]][miss[b]];
  } else {
    const Soo = zeros(nO, nO);
    for (let a = 0; a < nO; a++) for (let b = 0; b < nO; b++) Soo[a][b] = cov[obs[a]][obs[b]];
    const Loo = cholesky(Soo);
    const zO = new Float64Array(nO); obs.forEach((i, a) => (zO[a] = z[i]));
    const w = cholSolve(Loo, zO);
    const SinvSom = miss.map((m) => cholSolve(Loo, Float64Array.from(obs.map((o) => cov[o][m]))));
    for (let a = 0; a < nM; a++) {
      let s = 0; for (let b = 0; b < nO; b++) s += cov[miss[a]][obs[b]] * w[b];
      condMean[a] = s;
      for (let c = 0; c < nM; c++) {
        let t = 0; for (let b = 0; b < nO; b++) t += cov[miss[a]][obs[b]] * SinvSom[c][b];
        condCov[a][c] = cov[miss[a]][miss[c]] - t;
      }
    }
  }
  for (let a = 0; a < nM; a++) { condCov[a][a] = Math.max(condCov[a][a], 1e-4); z[miss[a]] = condMean[a]; }
  return { z, miss, condChol: cholesky(condCov) };
}

// ---------- fit ----------
// data: [{ g: groupIndex, z: Float64Array, y: 0|1, r?: int[] (level index per crossed random-effect factor) }]
// Parameter vector: [mu, alpha_1..G, beta_1..K, u^(1)_1..L1, u^(2)_1..L2, ...]
//   alpha_j ~ N(mu, tau^2) (level-jump pooling);  u^(f)_l ~ N(0, tauR_f^2) (crossed program effects)
function fitAtTau(data, G, K, prior, tau, tauR = []) {
  const RF = prior.reFactors || [];
  const offs = []; let tot = 1 + G + K;
  for (const f of RF) { offs.push(tot); tot += f.levels; }
  const D = tot;
  const th = new Float64Array(D);
  const base = prior.m0;
  th[0] = base; for (let j = 0; j < G; j++) th[1 + j] = base;
  const t2 = tau * tau, s02 = prior.s0 * prior.s0, sb2 = prior.sigmaBeta * prior.sigmaBeta;
  const r2 = RF.map((_, f) => (tauR[f] ?? 0.3) ** 2);
  const rowIdx = (d) => {
    const idx = [1 + d.g], val = [1];
    for (let k = 0; k < K; k++) { idx.push(1 + G + k); val.push(d.z[k]); }
    RF.forEach((_, f) => { const l = d.r ? d.r[f] : -1; if (l >= 0) { idx.push(offs[f] + l); val.push(1); } });
    return { idx, val };
  };
  const rows = data.map((d) => ({ ...rowIdx(d), y: d.y }));
  const etaOf = (t, rw) => { let e = 0; for (let a = 0; a < rw.idx.length; a++) e += t[rw.idx[a]] * rw.val[a]; return e; };
  const logPost = (t) => {
    let lp = 0;
    for (const rw of rows) { const eta = etaOf(t, rw); lp += rw.y * eta - (eta > 0 ? eta + Math.log1p(Math.exp(-eta)) : Math.log1p(Math.exp(eta))); }
    lp -= (t[0] - prior.m0) ** 2 / (2 * s02);
    for (let j = 0; j < G; j++) lp -= (t[1 + j] - t[0]) ** 2 / (2 * t2);
    for (let k = 0; k < K; k++) lp -= t[1 + G + k] ** 2 / (2 * sb2);
    RF.forEach((f, fi) => { for (let l = 0; l < f.levels; l++) lp -= t[offs[fi] + l] ** 2 / (2 * r2[fi]); });
    return lp;
  };
  const priorH = (H) => {
    H[0][0] += 1 / s02;
    for (let j = 0; j < G; j++) { H[1 + j][1 + j] += 1 / t2; H[0][0] += 1 / t2; H[0][1 + j] -= 1 / t2; H[1 + j][0] -= 1 / t2; }
    for (let k = 0; k < K; k++) H[1 + G + k][1 + G + k] += 1 / sb2;
    RF.forEach((f, fi) => { for (let l = 0; l < f.levels; l++) H[offs[fi] + l][offs[fi] + l] += 1 / r2[fi]; });
  };
  const likH = (H, g) => {
    for (const rw of rows) {
      const p = sigmoid(etaOf(th, rw)), r = rw.y - p, w = p * (1 - p);
      for (let a = 0; a < rw.idx.length; a++) {
        if (g) g[rw.idx[a]] += r * rw.val[a];
        for (let b = 0; b < rw.idx.length; b++) H[rw.idx[a]][rw.idx[b]] += w * rw.val[a] * rw.val[b];
      }
    }
  };
  let H, cur = logPost(th), iters = 0;
  for (let it = 0; it < 60; it++) {
    iters = it + 1;
    const g = new Float64Array(D); H = zeros(D, D);
    likH(H, g);
    g[0] += -(th[0] - prior.m0) / s02;
    for (let j = 0; j < G; j++) { const dlt = th[1 + j] - th[0]; g[1 + j] -= dlt / t2; g[0] += dlt / t2; }
    for (let k = 0; k < K; k++) g[1 + G + k] -= th[1 + G + k] / sb2;
    RF.forEach((f, fi) => { for (let l = 0; l < f.levels; l++) g[offs[fi] + l] -= th[offs[fi] + l] / r2[fi]; });
    priorH(H);
    const step = cholSolve(cholesky(H), g);
    let lam = 1, next, nv;
    for (let h = 0; h < 20; h++) {
      next = th.map((v, i) => v + lam * step[i]); nv = logPost(next);
      if (nv >= cur - 1e-10) break; lam /= 2;
    }
    const delta = Math.max(...step.map((s) => Math.abs(s * lam)));
    th.set(next); cur = nv;
    if (delta < 1e-7) break;
  }
  H = zeros(D, D); likH(H, null); priorH(H);
  const LH = cholesky(H);
  let logNorm = -0.5 * Math.log(2 * Math.PI * s02) - G * 0.5 * Math.log(2 * Math.PI * t2) - K * 0.5 * Math.log(2 * Math.PI * sb2);
  RF.forEach((f, fi) => { logNorm -= f.levels * 0.5 * Math.log(2 * Math.PI * r2[fi]); });
  const logML = cur + logNorm + (D / 2) * Math.log(2 * Math.PI) - 0.5 * logDetFromChol(LH);
  const covM = invertSPD(H);
  return { theta: th, cov: covM, logML, iters, tau, tauR: RF.map((_, f) => tauR[f] ?? 0.3), reOffs: offs, reFactors: RF, D, G, K };
}

export const TAU_GRID = [0.05, 0.1, 0.2, 0.3, 0.45, 0.65, 0.9, 1.25, 1.75, 2.5, 3.5];
export const TAU_R_GRID = [0.05, 0.15, 0.3, 0.5, 0.8];

// Empirical Bayes: pooling SDs chosen by maximizing the Laplace marginal likelihood (coordinate-wise grid search).
export function fit(data, G, K, prior) {
  const t0 = performance.now();
  const RF = prior.reFactors || [];
  if (prior.fixed) { const e = fitAtTau(data, G, K, prior, prior.fixed.tau, prior.fixed.tauR || []); e.tauCurve = []; e.tauRCurves = []; e.n = data.length; e.fitMs = performance.now() - t0; return e; }
  let tauR = RF.map(() => 0.3);
  const evals = TAU_GRID.map((tau) => fitAtTau(data, G, K, prior, tau, tauR));
  let best = evals[0];
  for (const e of evals) if (e.logML > best.logML) best = e;
  const tauRCurves = [];
  RF.forEach((_, f) => {
    const curve = [];
    for (const tr of TAU_R_GRID) {
      const trial = tauR.slice(); trial[f] = tr;
      const e = fitAtTau(data, G, K, prior, best.tau, trial);
      curve.push({ tau: tr, logML: e.logML });
      if (e.logML > best.logML) best = e;
    }
    tauR = best.tauR.slice();
    tauRCurves.push(curve);
  });
  best.tauCurve = evals.map((e) => ({ tau: e.tau, logML: e.logML }));
  best.tauRCurves = tauRCurves;
  best.n = data.length;
  best.fitMs = performance.now() - t0;
  return best;
}

// index/value list for one prediction; unseen random-effect levels contribute their prior variance
function predIdx(m, g, z, r = []) {
  const idx = [1 + g], val = [1]; let extraV = 0;
  for (let k = 0; k < m.K; k++) { idx.push(1 + m.G + k); val.push(z[k]); }
  (m.reFactors || []).forEach((_, f) => { const l = r[f] ?? -1; if (l >= 0) { idx.push(m.reOffs[f] + l); val.push(1); } else extraV += m.tauR[f] ** 2; });
  return { idx, val, extraV };
}
export function etaMoments(m, g, z, r) {
  const { idx, val, extraV } = predIdx(m, g, z, r);
  let mean = 0, v = extraV;
  for (let a = 0; a < idx.length; a++) {
    mean += m.theta[idx[a]] * val[a];
    for (let b = 0; b < idx.length; b++) v += val[a] * val[b] * m.cov[idx[a]][idx[b]];
  }
  return { mean, v };
}
// fast Bayesian predictive (probit approximation to the logistic-normal integral)
export function predictFast(m, g, z, r) {
  const { mean, v } = etaMoments(m, g, z, r);
  return sigmoid(mean / Math.sqrt(1 + (Math.PI * v) / 8));
}

// Monte Carlo posterior for P(success): parameter + missing-data uncertainty (mean, used for ranking and
// calibration), plus a behavioral / post-decision variance component sigmaB on the individual log-odds
// (used for the reported ranges). sigmaB is a stated assumption until estimated on real outcomes.
export function predictMC(m, g, std, S = 3000, seed = 7, r = [], sigmaB = 0) {
  const R = rng(seed);
  const { idx, extraV } = predIdx(m, g, std.z, r);
  const n = idx.length, sub = zeros(n, n);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) sub[a][b] = m.cov[idx[a]][idx[b]];
  const Lc = cholesky(sub), mu = idx.map((i) => m.theta[i]);
  const K = m.K, nM = std.miss.length, em = new Float64Array(nM);
  const out = new Float64Array(S), outB = new Float64Array(S), outParamOnly = new Float64Array(S);
  const e = new Float64Array(n), t = new Float64Array(n), sdX = Math.sqrt(extraV);
  for (let s = 0; s < S; s++) {
    for (let i = 0; i < n; i++) e[i] = R.n();
    for (let i = 0; i < n; i++) { let acc = mu[i]; for (let k = 0; k <= i; k++) acc += Lc[i][k] * e[k]; t[i] = acc; }
    const z = Float64Array.from(std.z);
    // t[0] = alpha_g, t[1..K] = betas, t[K+1..] = observed random effects
    let reSum = sdX * R.n(); for (let i = K + 1; i < n; i++) reSum += t[i];
    let etaP = t[0] + reSum; for (let k = 0; k < K; k++) etaP += t[1 + k] * z[k];
    outParamOnly[s] = sigmoid(etaP);
    if (nM) {
      for (let a = 0; a < nM; a++) em[a] = R.n();
      for (let a = 0; a < nM; a++) { let acc = 0; for (let b = 0; b <= a; b++) acc += std.condChol[a][b] * em[b]; z[std.miss[a]] += acc; }
    }
    let eta = t[0] + reSum; for (let k = 0; k < K; k++) eta += t[1 + k] * z[k];
    out[s] = sigmoid(eta);
    outB[s] = sigmoid(eta + sigmaB * R.n());
  }
  const qs = (arr) => { const sorted = Float64Array.from(arr).sort(); return (p) => sorted[Math.min(S - 1, Math.floor(p * S))]; };
  const q = qs(outB), qn = qs(out), sp = qs(outParamOnly);
  const mean = out.reduce((a, b) => a + b, 0) / S;
  return {
    draws: outB, mean, q05: q(0.05), q10: q(0.1), q50: q(0.5), q90: q(0.9), q95: q(0.95),
    pAbove50: outB.filter((x) => x > 0.5).length / S,
    widthParamOnly: sp(0.9) - sp(0.1),
    widthNoBehav: qn(0.9) - qn(0.1),
  };
}

// ---------- scoring ----------
export function metrics(ps, ys) {
  const n = ps.length; if (!n) return null;
  let brier = 0, ll = 0;
  for (let i = 0; i < n; i++) {
    const p = Math.min(1 - 1e-6, Math.max(1e-6, ps[i]));
    brier += (p - ys[i]) ** 2; ll -= ys[i] * Math.log(p) + (1 - ys[i]) * Math.log(1 - p);
  }
  // AUC via rank
  const idx = ps.map((p, i) => [p, ys[i]]).sort((a, b) => a[0] - b[0]);
  let rankSum = 0, nPos = 0;
  for (let i = 0; i < n; i++) if (idx[i][1] === 1) { rankSum += i + 1; nPos++; }
  const nNeg = n - nPos;
  const auc = nPos && nNeg ? (rankSum - (nPos * (nPos + 1)) / 2) / (nPos * nNeg) : NaN;
  // calibration bins (quintiles of prediction)
  const bins = [];
  const B = 5;
  for (let b = 0; b < B; b++) {
    const lo = Math.floor((b * n) / B), hi = Math.floor(((b + 1) * n) / B);
    const seg = idx.slice(lo, hi); if (!seg.length) continue;
    bins.push({ pred: seg.reduce((a, s) => a + s[0], 0) / seg.length, obs: seg.reduce((a, s) => a + s[1], 0) / seg.length, n: seg.length });
  }
  let ece = 0; for (const b of bins) ece += (b.n / n) * Math.abs(b.pred - b.obs);
  return { n, brier: brier / n, logloss: ll / n, auc, bins, base: ys.reduce((a, b) => a + b, 0) / n, ece, slope: calSlope(ps, ys) };
}

// ---------- SHA-256 (WebCrypto with pure-JS fallback) ----------
function sha256js(ascii) {
  const rr = (v, a) => (v >>> a) | (v << (32 - a));
  const bytes = new TextEncoder().encode(ascii);
  const l = bytes.length, words = [];
  const K = [], H = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let c = 2; primeCounter < 64; c++) {
    if (!isComposite[c]) {
      for (let i = 0; i < 313; i += c) isComposite[i] = c;
      H[primeCounter] = (Math.pow(c, 0.5) * 4294967296) | 0;
      K[primeCounter++] = (Math.pow(c, 1 / 3) * 4294967296) | 0;
    }
  }
  let hash = H.slice(0, 8);
  const padded = new Uint8Array(((l + 9 + 63) >> 6) << 6);
  padded.set(bytes); padded[l] = 0x80;
  const bitLen = l * 8;
  padded[padded.length - 4] = (bitLen >>> 24) & 255; padded[padded.length - 3] = (bitLen >>> 16) & 255;
  padded[padded.length - 2] = (bitLen >>> 8) & 255; padded[padded.length - 1] = bitLen & 255;
  for (let i = 0; i < padded.length; i += 4) words.push((padded[i] << 24) | (padded[i + 1] << 16) | (padded[i + 2] << 8) | padded[i + 3]);
  for (let j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16), old = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + K[i] +
        (w[i] = i < 16 ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(t1 + t2) | 0].concat(hash); hash[4] = (hash[4] + t1) | 0; hash.length = 8;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
  }
  return hash.map((h) => (h >>> 0).toString(16).padStart(8, "0")).join("");
}
export async function sha256(str) {
  try {
    if (globalThis.crypto?.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (e) { /* fall through */ }
  return sha256js(str);
}
export const canonical = (o) => JSON.stringify(o, Object.keys(flatKeys(o)).sort());
function flatKeys(o, acc = {}) {
  if (o && typeof o === "object") for (const k of Object.keys(o)) { acc[k] = 1; flatKeys(o[k], acc); }
  return acc;
}

// calibration slope: logistic regression of y on logit(p). 1.0 = well calibrated; < 1 = overconfident.
export function calSlope(ps, ys) {
  const x = ps.map((p) => logit(Math.min(1 - 1e-4, Math.max(1e-4, p))));
  let a = 0, b = 1;
  for (let it = 0; it < 30; it++) {
    let ga = 0, gb = 0, haa = 0, hab = 0, hbb = 0;
    for (let i = 0; i < x.length; i++) { const p = sigmoid(a + b * x[i]), w = p * (1 - p), r = ys[i] - p; ga += r; gb += r * x[i]; haa += w; hab += w * x[i]; hbb += w * x[i] * x[i]; }
    haa += 1e-6; hbb += 1e-6;
    const det = haa * hbb - hab * hab; if (Math.abs(det) < 1e-12) break;
    const da = (hbb * ga - hab * gb) / det, db = (haa * gb - hab * ga) / det;
    a += da; b += db; if (Math.abs(da) + Math.abs(db) < 1e-8) break;
  }
  return b;
}
// bootstrap 90% intervals for Brier and AUC
export function bootstrap(ps, ys, B = 200, seed = 99) {
  const R = rng(seed), n = ps.length, br = [], au = [];
  for (let b = 0; b < B; b++) {
    const P = [], Y = [];
    for (let i = 0; i < n; i++) { const j = Math.floor(R.u() * n); P.push(ps[j]); Y.push(ys[j]); }
    const m = metrics(P, Y); br.push(m.brier); if (!Number.isNaN(m.auc)) au.push(m.auc);
  }
  br.sort((a, b) => a - b); au.sort((a, b) => a - b);
  const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
  return { brier: [q(br, 0.05), q(br, 0.95)], auc: [q(au, 0.05), q(au, 0.95)] };
}
