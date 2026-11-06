// Hand-built SVG charts (no external dependencies).
const pct = (x) => Math.round(x * 100);

export function intervalBar(s, base = null, w = 170, h = 22) {
  const ref = base ?? 0.5;
  const X = (v) => 4 + v * (w - 8);
  return `<svg class="ibar" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Posterior ${pct(s.mean)} percent, 80 percent range ${pct(s.q10)} to ${pct(s.q90)}">
    <line x1="${X(0)}" x2="${X(1)}" y1="${h / 2}" y2="${h / 2}" stroke="#e4e4e1" stroke-width="1"/>
    <line x1="${X(ref)}" x2="${X(ref)}" y1="1" y2="${h - 1}" stroke="${base == null ? "#c9c9c4" : "#2b2e35"}" stroke-width="${base == null ? 1 : 1.5}" stroke-dasharray="2 2"/>
    <line x1="${X(s.q05)}" x2="${X(s.q95)}" y1="${h / 2}" y2="${h / 2}" stroke="#ba0c2f" stroke-opacity=".45" stroke-width="1.5"/>
    <rect x="${X(s.q10)}" y="${h / 2 - 5}" width="${Math.max(2, X(s.q90) - X(s.q10))}" height="10" rx="3" fill="#ba0c2f" fill-opacity=".22" stroke="#ba0c2f" stroke-opacity=".5"/>
    <circle cx="${X(s.mean)}" cy="${h / 2}" r="4" fill="#ba0c2f" stroke="#fff" stroke-width="1.5"/>
  </svg>`;
}

export function density(draws, baseDraws, w = 520, h = 170) {
  const B = 50, pad = { l: 8, r: 8, t: 10, b: 24 };
  const hist = (d) => { const c = new Array(B).fill(0); for (const v of d) c[Math.min(B - 1, Math.floor(v * B))]++; return c.map((x) => x / d.length); };
  const a = hist(draws), b = baseDraws ? hist(baseDraws) : null;
  const max = Math.max(...a, ...(b || [0]));
  const bw = (w - pad.l - pad.r) / B, H = h - pad.t - pad.b;
  const bars = (arr, cls) => arr.map((v, i) => `<rect class="${cls}" x="${pad.l + i * bw + 0.5}" y="${pad.t + H - (v / max) * H}" width="${Math.max(0.5, bw - 1)}" height="${(v / max) * H}"/>`).join("");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => `<text x="${pad.l + t * (w - pad.l - pad.r)}" y="${h - 6}" text-anchor="middle" class="ax">${pct(t)}%</text>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Posterior distribution of success probability">
    ${b ? bars(b, "d-base") : ""}${bars(a, "d-post")}
    <line x1="${pad.l}" x2="${w - pad.r}" y1="${pad.t + H}" y2="${pad.t + H}" stroke="#d4d4d0"/>
    ${ticks}
  </svg>`;
}

export function waterfallChart(steps, final, w = 640, h = 240) {
  const pad = { l: 34, r: 10, t: 14, b: 54 };
  const n = steps.length + 1, bw = (w - pad.l - pad.r) / n, H = h - pad.t - pad.b;
  const Y = (p) => pad.t + H - p * H;
  let out = "";
  [0, 0.25, 0.5, 0.75, 1].forEach((t) => { out += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="#efefec"/><text x="${pad.l - 6}" y="${Y(t) + 3}" text-anchor="end" class="ax">${pct(t)}</text>`; });
  let prev = 0;
  steps.forEach((s, i) => {
    const x = pad.l + i * bw + bw * 0.18, ww = bw * 0.64;
    let y0, y1, fill;
    if (i === 0) { y0 = Y(s.p); y1 = Y(0); fill = "#9aa0a8"; }
    else { y0 = Y(Math.max(prev, s.p)); y1 = Y(Math.min(prev, s.p)); fill = s.imputed ? "#c9c9c4" : s.p >= prev ? "#1f8a4c" : "#c8102e"; }
    out += `<rect x="${x}" y="${y0}" width="${ww}" height="${Math.max(1.5, y1 - y0)}" fill="${fill}" rx="2"/>`;
    const lab = i === 0 ? `${pct(s.p)}%` : `${s.p >= prev ? "+" : "−"}${Math.abs(pct(s.p) - pct(prev))}`;
    out += `<text x="${x + ww / 2}" y="${y0 - 4}" text-anchor="middle" class="vl">${s.imputed ? "est." : lab}</text>`;
    if (i < steps.length - 1 || true) out += `<line x1="${x + ww}" x2="${x + bw}" y1="${Y(s.p)}" y2="${Y(s.p)}" stroke="#9aa0a8" stroke-dasharray="2 2"/>`;
    const words = (i === 0 ? "Comparable moves" : s.name).split(" ");
    words.forEach((wd, j) => (out += `<text x="${x + ww / 2}" y="${h - pad.b + 14 + j * 11}" text-anchor="middle" class="ax">${wd}</text>`));
    prev = s.p;
  });
  const x = pad.l + steps.length * bw + bw * 0.18, ww = bw * 0.64;
  out += `<rect x="${x}" y="${Y(final.mean)}" width="${ww}" height="${Y(0) - Y(final.mean)}" fill="#ba0c2f" rx="2"/>`;
  out += `<line x1="${x + ww / 2}" x2="${x + ww / 2}" y1="${Y(final.q90)}" y2="${Y(final.q10)}" stroke="#17191d" stroke-width="1.5"/>`;
  out += `<line x1="${x + ww / 2 - 6}" x2="${x + ww / 2 + 6}" y1="${Y(final.q90)}" y2="${Y(final.q90)}" stroke="#17191d" stroke-width="1.5"/><line x1="${x + ww / 2 - 6}" x2="${x + ww / 2 + 6}" y1="${Y(final.q10)}" y2="${Y(final.q10)}" stroke="#17191d" stroke-width="1.5"/>`;
  out += `<text x="${x + ww / 2}" y="${Y(final.q90) - 5}" text-anchor="middle" class="vl">${pct(final.mean)}%</text>`;
  out += `<text x="${x + ww / 2}" y="${h - pad.b + 14}" text-anchor="middle" class="ax">Posterior</text><text x="${x + ww / 2}" y="${h - pad.b + 25}" text-anchor="middle" class="ax">(80% range)</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Baseline to posterior waterfall">${out}</svg>`;
}

export function forest(rows, w = 560) {
  const rh = 26, pad = { l: 200, r: 20, t: 10, b: 26 }, h = pad.t + rows.length * rh + pad.b;
  const lim = Math.max(1, ...rows.map((r) => Math.abs(r.m) + 2 * r.sd));
  const X = (v) => pad.l + ((v + lim) / (2 * lim)) * (w - pad.l - pad.r);
  let out = `<line x1="${X(0)}" x2="${X(0)}" y1="${pad.t}" y2="${h - pad.b}" stroke="#c9c9c4" stroke-dasharray="3 3"/>`;
  rows.forEach((r, i) => {
    const y = pad.t + i * rh + rh / 2;
    const col = r.m - 1.645 * r.sd > 0 ? "#1f8a4c" : r.m + 1.645 * r.sd < 0 ? "#c8102e" : "#7a7e86";
    out += `<text x="${pad.l - 10}" y="${y + 4}" text-anchor="end" class="lab">${r.label}</text>`;
    out += `<line x1="${X(r.m - 1.645 * r.sd)}" x2="${X(r.m + 1.645 * r.sd)}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="2"/>`;
    out += `<circle cx="${X(r.m)}" cy="${y}" r="4.5" fill="${col}"/>`;
    out += `<text x="${w - 4}" y="${y + 4}" text-anchor="end" class="ax mono">${r.m >= 0 ? "+" : ""}${r.m.toFixed(2)}</text>`;
  });
  [-lim, -lim / 2, 0, lim / 2, lim].forEach((t) => (out += `<text x="${X(t)}" y="${h - 8}" text-anchor="middle" class="ax">${t.toFixed(1)}</text>`));
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Learned evidence weights with 90 percent intervals">${out}</svg>`;
}

export function shrinkChart(groups, w = 520, h = 200) {
  const pad = { l: 92, r: 30, t: 16, b: 30 }, rh = (h - pad.t - pad.b) / groups.length;
  const X = (v) => pad.l + v * (w - pad.l - pad.r);
  let out = "";
  [0, 0.25, 0.5, 0.75].forEach((t) => (out += `<line x1="${X(t)}" x2="${X(t)}" y1="${pad.t}" y2="${h - pad.b}" stroke="#efefec"/><text x="${X(t)}" y="${h - 10}" text-anchor="middle" class="ax">${pct(t)}%</text>`));
  groups.forEach((g, i) => {
    const y = pad.t + i * rh + rh / 2;
    out += `<text x="${pad.l - 10}" y="${y - 2}" text-anchor="end" class="lab">${g.jump}</text><text x="${pad.l - 10}" y="${y + 11}" text-anchor="end" class="ax">n = ${g.n}</text>`;
    out += `<line x1="${X(g.lo)}" x2="${X(g.hi)}" y1="${y}" y2="${y}" stroke="#7b4fd6" stroke-width="2"/>`;
    out += `<circle cx="${X(g.raw)}" cy="${y}" r="5" fill="#fff" stroke="#2f6fdb" stroke-width="2"/>`;
    out += `<circle cx="${X(g.pooled)}" cy="${y}" r="5" fill="#7b4fd6"/>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Baseline success rates by level jump">${out}</svg>`;
}

export function lineChart(pts, { w = 520, h = 180, xl = "", yl = "", mark = null, fmtX = (x) => x, fmtY = (y) => y.toFixed(1) }) {
  const pad = { l: 46, r: 14, t: 14, b: 32 };
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), yr = y1 - y0 || 1;
  const X = (v) => pad.l + ((v - x0) / (x1 - x0 || 1)) * (w - pad.l - pad.r), Y = (v) => pad.t + (1 - (v - y0) / yr) * (h - pad.t - pad.b);
  let out = `<polyline fill="none" stroke="#7b4fd6" stroke-width="2" points="${pts.map((p) => X(p.x) + "," + Y(p.y)).join(" ")}"/>`;
  pts.forEach((p) => (out += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3.5" fill="${mark === p.x ? "#ba0c2f" : "#7b4fd6"}"/><text x="${X(p.x)}" y="${h - 14}" text-anchor="middle" class="ax">${fmtX(p.x)}</text>`));
  [y0, (y0 + y1) / 2, y1].forEach((t) => (out += `<text x="${pad.l - 6}" y="${Y(t) + 3}" text-anchor="end" class="ax">${fmtY(t)}</text>`));
  out += `<text x="${(w + pad.l) / 2}" y="${h - 1}" text-anchor="middle" class="ax">${xl}</text>`;
  out += `<text x="10" y="${h / 2}" transform="rotate(-90 10 ${h / 2})" text-anchor="middle" class="ax">${yl}</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="${yl} by ${xl}">${out}</svg>`;
}

export function calibration(series, w = 300, h = 300) {
  const pad = { l: 40, r: 12, t: 12, b: 34 }, S = Math.min(w - pad.l - pad.r, h - pad.t - pad.b);
  const X = (v) => pad.l + v * S, Y = (v) => pad.t + (1 - v) * S;
  let out = `<rect x="${pad.l}" y="${pad.t}" width="${S}" height="${S}" fill="#fafaf8" stroke="#e4e4e1"/>`;
  out += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}" stroke="#c9c9c4" stroke-dasharray="4 3"/>`;
  [0, 0.5, 1].forEach((t) => (out += `<text x="${X(t)}" y="${pad.t + S + 14}" text-anchor="middle" class="ax">${pct(t)}%</text><text x="${pad.l - 6}" y="${Y(t) + 3}" text-anchor="end" class="ax">${pct(t)}%</text>`));
  series.forEach((s) => {
    out += `<polyline fill="none" stroke="${s.color}" stroke-width="1.8" points="${s.bins.map((b) => X(b.pred) + "," + Y(b.obs)).join(" ")}"/>`;
    s.bins.forEach((b) => (out += `<circle cx="${X(b.pred)}" cy="${Y(b.obs)}" r="${2.5 + Math.sqrt(b.n) / 3}" fill="${s.color}" fill-opacity=".85"/>`));
  });
  out += `<text x="${pad.l + S / 2}" y="${h - 4}" text-anchor="middle" class="ax">Predicted chance of success</text>`;
  out += `<text x="12" y="${pad.t + S / 2}" transform="rotate(-90 12 ${pad.t + S / 2})" text-anchor="middle" class="ax">Observed success rate</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" class="chart sq" role="img" aria-label="Calibration of predictions on held-out class">${out}</svg>`;
}

export function bars(items, { w = 520, h = 170, fmt = (v) => v.toFixed(2), color = "#7b4fd6" } = {}) {
  const pad = { l: 10, r: 10, t: 18, b: 34 }, bw = (w - pad.l - pad.r) / items.length, max = Math.max(...items.map((i) => i.v)) || 1, H = h - pad.t - pad.b;
  let out = "";
  items.forEach((it, i) => {
    const x = pad.l + i * bw + bw * 0.2, ww = bw * 0.6, bh = (it.v / max) * H;
    out += `<rect x="${x}" y="${pad.t + H - bh}" width="${ww}" height="${bh}" fill="${it.color || color}" rx="3"/>`;
    out += `<text x="${x + ww / 2}" y="${pad.t + H - bh - 5}" text-anchor="middle" class="vl">${fmt(it.v)}</text>`;
    out += `<text x="${x + ww / 2}" y="${h - 18}" text-anchor="middle" class="ax">${it.l}</text>`;
    if (it.s) out += `<text x="${x + ww / 2}" y="${h - 6}" text-anchor="middle" class="ax">${it.s}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Bar chart">${out}</svg>`;
}
