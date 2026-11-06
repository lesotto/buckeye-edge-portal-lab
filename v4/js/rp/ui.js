import { RP, prog, S, G, byId, STATES, urgency } from "./store.js";
import { statusLabel } from "./ceg.js";
import { POS_NAME } from "./data.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const usd = (x) => x === null || x === undefined ? "—" : "$" + Math.round(x).toLocaleString("en-US");
export const usdk = (x) => x === null || x === undefined ? "—" : x >= 1e6 ? "$" + (x / 1e6).toFixed(2) + "M" : "$" + Math.round(x / 1000) + "K";
export const htf = (h) => `${Math.floor(h / 12)}'${h % 12}"`;
export const pct = (x) => Math.round(x * 100) + "%";
export const kpi = (l, v, s, u = "") => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}${u ? `<small>${u}</small>` : ""}</div><div class="s">${s}</div></div>`;
export const sec = (t) => `<div class="sec-label">${t}</div>`;
export const card = (title, sub, body, extra = "") => `<section class="card card-pad ${extra}"><div class="card-h"><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ""}</div></div>${body}</section>`;
export const tag = (t, c = "") => `<span class="rp-tag ${c}">${esc(t)}</span>`;
export const est = `<span class="badge b-estimate">Estimate</span>`;
export const sample = `<span class="badge b-hypothesis">Sample data</span>`;
export const head = (t, d, right = "") => `<div class="rp-head"><div><h1 class="page-title">${t}</h1><p class="page-desc">${d}</p></div>${right}</div>`;

export function gradeChip(id) {
  const { c } = G(id);
  if (c.status === "medical") return `<span class="rp-grade hold" title="Serious medical issue: hold, not a number">HOLD</span>`;
  const cls = c.grade >= 8 ? "bc" : c.grade >= 7 ? "st" : c.grade >= 6 ? "co" : c.grade >= 5 ? "de" : "pa";
  return `<span class="rp-grade ${cls} ${c.status === "third" ? "pend" : ""}" title="${esc(c.tier)} · ±${c.band} (${c.conf} confidence)${c.status === "third" ? " · held for third look" : ""}">${c.grade.toFixed(2)}</span>`;
}
export function plink(p) { return `<button class="rp-plink" data-rpa="open" data-id="${p.id}">${esc(p.name)}</button>`; }
export function pmeta(p) { return `${p.pos} · ${p.type === "transfer" ? "Transfer" : "HS " + p.cls} · ${p.state}`; }

export function prospectTable(list, { cols = ["grade", "tier", "stage", "dist", "like"], limit = 25 } = {}) {
  const th = { grade: "CEG", tier: "Tier", stage: "Pipeline", dist: "Miles*", like: "Commit est.", urg: "Urgency", value: "Value", ask: "Ask", cpp: "$/pt", ind: "Industry", conf: "Conf." };
  const td = (p, k) => {
    const { c, L } = G(p.id);
    if (k === "grade") return `<td class="n">${gradeChip(p.id)}</td>`;
    if (k === "tier") return `<td>${c.status === "ok" ? esc(c.tier) : `<span class="dim">${esc(statusLabel(c))}</span>`}${c.gapFlag ? ` <span class="badge b-flag" title="CEG differs from industry rating by ${c.gap > 0 ? "+" : ""}${c.gap}">Gap</span>` : ""}</td>`;
    if (k === "stage") return `<td>${esc(p.stage)}</td>`;
    if (k === "dist") return `<td class="n">${p.dist.toLocaleString()}</td>`;
    if (k === "like") return `<td class="n">${pct(L.p)}</td>`;
    if (k === "urg") return `<td class="n">${urgency(p)}</td>`;
    if (k === "value") return `<td class="n">${c.value.toFixed(1)}</td>`;
    if (k === "ask") return `<td class="n">${usdk(p.ask)}</td>`;
    if (k === "cpp") return `<td class="n">${c.cpp ? usd(c.cpp) : "—"}</td>`;
    if (k === "ind") return `<td class="n">${p.industry.stars}★ ${p.industry.rating.toFixed(3)}</td>`;
    if (k === "conf") return `<td>${c.conf}</td>`;
  };
  const rows = list.slice(0, limit).map((p) => `<tr><td>${plink(p)}<div class="dim small">${pmeta(p)}</div></td>${cols.map((k) => td(p, k)).join("")}</tr>`).join("");
  return `<div class="scroll-x"><table class="t rp-t"><thead><tr><th>Player</th>${cols.map((k) => `<th class="${["grade", "dist", "like", "urg", "value", "ask", "cpp", "ind"].includes(k) ? "n" : ""}">${th[k]}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${cols.length + 1}" class="dim">No players match.</td></tr>`}</tbody></table></div>`;
}

// tile map of states; values -> color scale
export function stateMap(counts, sel, { max } = {}) {
  const m = max || Math.max(1, ...Object.values(counts));
  const tiles = Object.entries(STATES).map(([k, v]) => {
    const n = counts[k] || 0, a = n ? 0.15 + 0.85 * (n / m) : 0;
    const x = v[4] * 44 + 2, y = v[3] * 44 + 2;
    return `<g class="rp-tile ${sel === k ? "sel" : ""}" data-rpa="state" data-id="${k}" tabindex="0" role="button" aria-label="${v[0]}: ${n} prospects"><rect x="${x}" y="${y}" width="40" height="40" rx="5" style="fill:${n ? `rgba(186,12,47,${a.toFixed(2)})` : "var(--surface-2)"}"/><text x="${x + 20}" y="${y + 18}" class="${a > 0.55 ? "lt" : ""}">${k}</text><text x="${x + 20}" y="${y + 32}" class="c ${a > 0.55 ? "lt" : ""}">${n || ""}</text></g>`;
  }).join("");
  return `<svg class="rp-map" viewBox="0 0 534 358" role="img" aria-label="Prospects by state">${tiles}</svg>`;
}
export const bar = (v, max, color = "var(--scarlet)") => `<span class="rp-bar"><i style="width:${Math.max(2, Math.min(100, (100 * v) / (max || 1)))}%;background:${color}"></i></span>`;
export { POS_NAME };
