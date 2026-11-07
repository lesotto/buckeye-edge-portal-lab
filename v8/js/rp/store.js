// Per-program state for the v3 recruiting platform. Player data stays in memory (never cached on the device);
// only the offline camp/contact queue and UI preferences are stored locally, namespaced by program.
import { generateProgram, defaultSettings, PROGRAMS, STATES, haversine } from "./data.js";
import { ceg, likelihood } from "./ceg.js";

const LOCAL = new Set(["localhost", "127.0.0.1", ""]);
export const API = (() => { const b = window.__API_BASE__ || "__PORT_8006__"; return b.startsWith("__PORT_") ? (LOCAL.has(location.hostname) ? "http://localhost:8006" : null) : b.replace(/\/$/, ""); })();
// Session-only preferences and offline queue (kept in memory for the hosted preview; a production build would use device storage).
const MEM = {};
const ls = { get: (k, d) => (k in MEM ? JSON.parse(MEM[k]) : d), set: (k, v) => { MEM[k] = JSON.stringify(v); } };

export const RP = { pid: ls.get("rp:program", "osu-demo"), role: ls.get("rp:role", "Admin"), theme: ls.get("rp:theme", document.documentElement.dataset.theme || "light"), progs: {}, ctx: null, backend: null, offlineSim: false };
export const ROLES = {
  Evaluator: ["grade", "view"], Coordinator: ["grade", "view", "contact", "override", "promote", "camp", "brief"],
  GM: ["view", "budget", "fmv", "brief"], Admin: ["grade", "view", "contact", "promote", "camp", "brief", "budget", "settings", "programs"],
};
export const can = (perm) => ROLES[RP.role].includes(perm);

export function prog() {
  if (!RP.progs[RP.pid]) {
    const D = generateProgram(RP.pid);
    RP.progs[RP.pid] = { ...D, third: {}, watch: new Set(), saved: [], alerts: [], audit: [], runs: [], contactsLog: [], activity: buildActivity(D), promoted: new Set(), dismissed: new Set(), scans: [], questionnaire: [], staffLocked: {}, suggested: {}, cache: null, version: 1 };
    seedAlerts(RP.progs[RP.pid]);
  }
  return RP.progs[RP.pid];
}
export function S() { return prog().settings; }
export function all() { return prog().prospects; }
export function byId(id) { const P = prog(); return P.prospects.find((p) => p.id === id) || P.past.find((p) => p.id === id); }
export function rivalsActive(p) { return p.offers.length; }

export function scored() {
  const P = prog();
  if (!P.cache || P.cache.v !== P.version) {
    const m = new Map();
    for (const p of P.prospects.concat(P.past)) { const c = ceg(p, P.settings, { third: P.third[p.id] || {} }); const L = likelihood(p, P.settings, rivalsActive(p)); m.set(p.id, { c, L }); }
    P.cache = { v: P.version, m };
  }
  return P.cache.m;
}
export const G = (id) => scored().get(id);
export function bump() { prog().version++; }

export function audit(op, detail, source = "Staff (demo user)", kind = "staff") {
  const P = prog(); const e = { ts: new Date().toISOString(), op, detail, source, kind, role: RP.role, program: RP.pid };
  P.audit.unshift(e); if (P.audit.length > 400) P.audit.pop();
  if (RP.ctx?.log) RP.ctx.log("rp." + op, detail, { program: RP.pid, role: RP.role, source }, {}, kind === "auto" ? "estimate" : kind === "staff" ? "staff" : "observed");
  api("/api/rp/audit", { method: "POST", body: e }).catch(() => {});
  return e;
}

export async function api(path, { method = "GET", body } = {}) {
  if (API === null) throw new Error("server not connected");
  const r = await fetch(API + path, { method, headers: { "Content-Type": "application/json", "X-Program": RP.pid, "X-Role": RP.role }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || `HTTP ${r.status}`);
  return j;
}
export async function checkBackend(render) {
  try { RP.backend = await api("/api/rp/health"); } catch { RP.backend = { ok: false }; }
  render && render();
}

// ---- offline queue (camp results + contact logs) ----
const QK = () => `rp:${RP.pid}:queue`;
export const queue = { list: () => ls.get(QK(), []), push: (item) => { const q = queue.list(); q.push({ ...item, qid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), queuedAt: new Date().toISOString() }); ls.set(QK(), q); return q.length; }, clear: (ids) => ls.set(QK(), queue.list().filter((x) => !ids.includes(x.qid))) };
export const online = () => navigator.onLine && !RP.offlineSim;
export async function syncQueue() {
  const q = queue.list(); if (!q.length) return { sent: 0 };
  if (!online()) return { sent: 0, offline: true };
  try { const r = await api("/api/rp/sync", { method: "POST", body: { items: q } }); queue.clear(r.accepted || q.map((x) => x.qid)); return { sent: (r.accepted || q).length, server: true }; }
  catch { queue.clear(q.map((x) => x.qid)); return { sent: q.length, server: false }; }
}

export function setProgram(pid) { RP.pid = pid; ls.set("rp:program", pid); }
export function setRole(r) { RP.role = r; ls.set("rp:role", r); }
export function setTheme(t) { RP.theme = t; ls.set("rp:theme", t); document.documentElement.dataset.theme = t; }

// ---- recruiting activity (never an input to CEG) ----
function buildActivity(D) {
  const ev = [];
  for (const p of D.prospects) { for (const o of p.offers) ev.push({ pid: p.id, ...o }); for (const v of p.visitsElsewhere) ev.push({ pid: p.id, ...v }); }
  const rec = D.prospects.filter((p) => p.offers.length >= 3).slice(0, 18);
  rec.forEach((p, i) => ev.push({ pid: p.id, school: p.offers[0].school, kind: i % 5 === 0 ? "commitment elsewhere" : i % 7 === 0 ? "decommitment" : "offer", date: "2026-11-0" + (1 + (i % 3)), source: i % 2 ? "Licensed recruiting feed (sample)" : "News scanner (sample)" }));
  return ev.sort((a, b) => (a.date < b.date ? 1 : -1));
}
function seedAlerts(P) {
  P.activity.filter((e) => e.date >= "2026-11-01").slice(0, 14).forEach((e) => P.alerts.push({ ts: e.date, pid: e.pid, kind: e.kind, school: e.school, source: e.source, read: false }));
}
export function urgency(p) {
  const P = prog(); const ev = P.activity.filter((e) => e.pid === p.id);
  const recent = ev.filter((e) => e.date >= "2026-10-01").length;
  const ov = ev.filter((e) => /official/.test(e.kind)).length;
  return Math.min(100, Math.round(10 * p.offers.length + 14 * recent + 18 * ov + (ev.some((e) => /commitment elsewhere/.test(e.kind)) ? 30 : 0)));
}
export { PROGRAMS, STATES, defaultSettings, haversine };
