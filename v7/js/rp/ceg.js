// Composite Evaluation Grade (CEG), 1–9 scale. Pure functions of a prospect + program settings.
// Recruiting activity is never an input here (by design).
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r2 = (x) => Math.round(x * 100) / 100;

export function filmPillar(p, st, third = {}) {
  const defs = st.traits[p.pos];
  const rows = p.traits.map((x, i) => {
    const crit = !!defs[i][1];
    const tl = third[i];
    const both = x.g1 !== null && x.g2 !== null;
    const gap = both ? Math.abs(x.g1 - x.g2) : 0;
    const val = tl !== undefined ? median([x.g1, x.g2, tl].filter((v) => v !== null)) : both ? (x.g1 + x.g2) / 2 : x.g1;
    return { t: x.t, crit, g1: x.g1, g2: x.g2, g3: tl, gap, val };
  });
  if (rows.every((r) => r.val === null || r.val === undefined)) return { score: null, rows, hold: false, missCrit: [], twoGraders: false };
  const twoGraders = rows.every((r) => r.g2 !== null && r.g2 !== undefined);
  const mean1 = avg(rows.map((r) => r.g1)), mean2 = twoGraders ? avg(rows.map((r) => r.g2)) : null;
  const disputed = rows.filter((r) => r.g3 === undefined && r.gap > st.two_grader.trait_margin);
  const meanGap = twoGraders ? Math.abs(mean1 - mean2) : 0;
  const hold = twoGraders && (disputed.length > 0 || (meanGap > st.two_grader.mean_margin && Object.keys(third).length === 0));
  const w = rows.map((r) => (r.crit ? 1.5 : 1));
  const score = rows.reduce((s, r, i) => s + r.val * w[i], 0) / w.reduce((a, b) => a + b, 0);
  const missCrit = rows.filter((r) => r.crit && r.val < st.critical_minimum).map((r) => r.t);
  return { score: r2(score), rows, hold, disputed: disputed.map((r) => r.t), meanGap: r2(meanGap), missCrit, twoGraders };
}

export function productionPillar(p, st) {
  const pen = st.production.level_penalty * (1 - p.levelFactor);
  const adj = clamp(p.prodRaw - pen, 1, 9);
  const w = Math.min(1, p.snaps / st.production.full_credit_snaps);
  const score = 5 + (adj - 5) * w;
  return { raw: p.prodRaw, levelFactor: p.levelFactor, penalty: r2(pen), adj: r2(adj), shrinkW: r2(w), score: r2(score) };
}

export function testingPillar(p, st) {
  const N = st.norms[p.pos];
  const corr = p.fortySrc === "hand" ? st.measurables.hand_timed_correction : 0;
  const forty = r2(p.forty + corr);
  const zs = [(N[2] - forty) / 0.14, (p.vert - N[3]) / 3.2, (N[4] - p.shuttle) / 0.16, (p.ht - N[0]) / 1.6 * 0.5];
  let z = (zs[0] * 0.45 + zs[1] * 0.2 + zs[2] * 0.2 + zs[3] * 0.15);
  const credit = p.fortySrc === "self" ? st.measurables.self_reported_credit : 1;
  z *= credit;
  return { forty, corr, src: p.fortySrc, credit, verified: p.fortySrc === "laser" || p.fortySrc === "camp", score: r2(clamp(5.2 + 1.3 * z, 1, 9)) };
}

export function ceg(p, st, extra = {}) {
  const W = p.type === "transfer" ? st.weights.transfer : st.weights.hs;
  const film = filmPillar(p, st, extra.third || {});
  const prod = productionPillar(p, st), test = testingPillar(p, st);
  const ch = p.character;
  const parts = [["film", film.score, W.film], ["production", prod.score, W.production], ["testing", test.score, W.testing], ["character", ch, W.character]];
  const have = parts.filter((x) => x[1] !== null && x[1] !== undefined);
  const wsum = have.reduce((s, x) => s + x[2], 0);
  let base = have.reduce((s, x) => s + x[1] * x[2], 0) / wsum;
  const availPen = Math.min(st.availability.max_penalty, p.missed * st.availability.per_game_missed);
  let grade = base - availPen;
  let ceiling = null;
  if (film.missCrit.length) { ceiling = st.critical_ceiling; grade = Math.min(grade, ceiling); }
  grade = r2(clamp(grade, 1, 9));
  // confidence
  let pts = 0; const why = [];
  if (film.score !== null && film.twoGraders && !film.hold) { pts++; why.push("two graders agree"); } else why.push(film.score === null ? "no film grade" : film.twoGraders ? "graders disagree" : "one grader only");
  if (test.verified) { pts++; why.push("verified 40"); } else why.push(test.src === "hand" ? "hand-timed 40" : "self-reported 40");
  if (p.snaps >= st.production.full_credit_snaps) { pts++; why.push(`${p.snaps} snaps`); } else why.push(`only ${p.snaps} snaps`);
  if (ch !== null) { pts++; why.push("character graded"); } else why.push("no character grade");
  const conf = pts >= 4 ? "high" : pts >= 2 ? "medium" : "low";
  const band = st.bands[conf];
  const status = p.serious ? "medical" : film.hold ? "third" : film.score === null ? "nofilm" : "ok";
  const tier = st.tiers.find(([t]) => grade >= t)[1];
  const indEq = r2(3 + (p.industry.rating - 0.8) * 30);
  const gap = r2(grade - indEq);
  const repl = st.var.replacement[p.pos], pw = st.var.position_weight[p.pos];
  const value = r2(Math.max(0, grade - repl) * pw * st.var.points_per_grade);
  const cpp = p.ask && value > 0 ? Math.round(p.ask / value) : null;
  return { grade, base: r2(base), availPen: r2(availPen), ceiling, W, film, prod, test, ch, conf, band, lo: r2(grade - band), hi: r2(grade + band), why, status, tier, indEq, gap, gapFlag: Math.abs(gap) >= st.industry_gap_flag, value, cpp, repl, pw };
}

export function statusLabel(c) { return { medical: "Medical hold", third: "Held for third look", nofilm: "No film grade yet", ok: "" }[c.status]; }
function avg(a) { const v = a.filter((x) => x !== null && x !== undefined); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }
function median(a) { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

// ---- commitment likelihood (estimate) ----
export function likelihood(p, st, rivalsActive) {
  const L = st.likelihood;
  const parts = [
    ["Base", L.intercept],
    ["Contacts", L.contacts * Math.min(p.contacts, 12) / 12],
    ["Official visit", p.ov ? L.official_visit : 0],
    ["Unofficial visits", L.unofficial_visit * Math.min(p.uv, 3)],
    ["Distance", L.per_500_miles * p.dist / 500],
    ["Rival offers", L.rival_offer * Math.min(rivalsActive, 6)],
    ["In-state", p.state === st.home_state ? L.in_state : 0],
    ["Pipeline school", p.pipelineSchool ? L.pipeline_school : 0],
    ["Committed", p.stage === "Committed" || p.stage === "Signed" ? L.committed : 0],
  ];
  const z = parts.reduce((s, x) => s + x[1], 0);
  return { p: 1 / (1 + Math.exp(-z)), z, parts };
}

// ---- intraclass correlation ICC(2,1) for two raters ----
export function icc21(pairs) {
  const n = pairs.length, k = 2; if (n < 3) return null;
  const grand = pairs.reduce((s, [a, b]) => s + a + b, 0) / (n * k);
  const rowM = pairs.map(([a, b]) => (a + b) / 2), colM = [0, 1].map((j) => pairs.reduce((s, r) => s + r[j], 0) / n);
  const ssr = k * rowM.reduce((s, m) => s + (m - grand) ** 2, 0), ssc = n * colM.reduce((s, m) => s + (m - grand) ** 2, 0);
  const sst = pairs.reduce((s, r) => s + (r[0] - grand) ** 2 + (r[1] - grand) ** 2, 0), sse = sst - ssr - ssc;
  const msr = ssr / (n - 1), msc = ssc / (k - 1), mse = sse / ((n - 1) * (k - 1));
  return (msr - mse) / (msr + (k - 1) * mse + (k * (msc - mse)) / n);
}
export function corr(x, y) {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; }
  return sxy / Math.sqrt(sx * sy || 1);
}
