// Live data search feed for the Portal Board.
// Calls the Buckeye Edge backend on Vercel (Perplexity Sonar web search). Results are real, sourced and dated.
const API = "https://buckeye-edge-portal-lab-v143.vercel.app";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const TTL = 15 * 60 * 1000;
export const LF = { q: "", rec: "week", busy: false, res: null, err: "", live: null, at: 0, ms: 0, cost: null, pos: "" };

const defaultQ = (posName) => `College football transfer portal ${posName} news Ohio State`;
const cacheKey = () => `lf:${LF.rec}:${LF.q}`;

function body() {
  if (LF.busy) return `<div class="lf-busy">Searching the web for current reporting…</div>`;
  if (LF.err) return `<div class="lf-err">${esc(LF.err)}</div>`;
  if (!LF.res) return `<div class="lf-busy">Loading the feed…</div>`;
  if (!LF.res.length) return `<div class="lf-busy">No current results for that search. Try a wider time window.</div>`;
  return `<ol class="lf-list">${LF.res.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title || r.url)}</a>
      <div class="lf-meta"><span>${esc(host(r.url))}</span>${r.date ? `<span>${esc(r.date)}</span>` : ""}</div>
      ${r.snippet ? `<p>${esc(r.snippet)}</p>` : ""}</li>`).join("")}</ol>`;
}
export function feedInner() {
  const status = LF.live === null ? `<span class="badge b-hypothesis">Checking…</span>` : LF.live ? `<span class="badge b-ok">Live · Perplexity web search</span>` : `<span class="badge b-bad">Live search offline</span>`;
  const when = LF.at ? `Updated ${new Date(LF.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${LF.ms ? ` · ${(LF.ms / 1000).toFixed(1)} s` : ""}${LF.cost != null ? ` · $${LF.cost.toFixed(3)}` : ""}` : "";
  return `<div class="card-h"><div><h3>Live data search feed</h3><p>Current public reporting from the open web. Every item links to its source and shows its date. Reporting is reported, not confirmed.</p></div><div class="sp"></div>${status}</div>
    <form class="lf-form" id="lf-form">
      <input id="lf-q" value="${esc(LF.q)}" aria-label="Search the transfer portal news" maxlength="300">
      <select id="lf-rec" aria-label="Time window">${[["day", "Past day"], ["week", "Past week"], ["month", "Past month"], ["year", "Past year"]].map(([k, l]) => `<option value="${k}" ${LF.rec === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <button class="btn sm primary" ${LF.busy ? "disabled" : ""}>Search</button>
      <button type="button" class="btn sm" data-lf="refresh" ${LF.busy ? "disabled" : ""}>Refresh</button>
    </form>
    ${body()}
    <p class="note lf-foot">${when ? esc(when) + " · " : ""}Perplexity Sonar via the FuzeBox backend. Search results are not player statistics and do not change the model scores.</p>`;
}
export function feedHTML(posName) {
  if (LF.pos !== posName) { LF.pos = posName; LF.q = defaultQ(posName); LF.res = null; LF.err = ""; setTimeout(() => run(false), 0); }
  return `<section class="card card-pad lf" id="lf-box" style="margin-bottom:14px">${feedInner()}</section>`;
}
const paint = () => { const el = document.querySelector("#lf-box"); if (el) el.innerHTML = feedInner(); };

async function run(force) {
  LF.err = "";
  const k = cacheKey();
  if (!force) { try { const c = JSON.parse(sessionStorage.getItem(k) || "null"); if (c && Date.now() - c.at < TTL) { Object.assign(LF, { res: c.res, at: c.at, ms: c.ms, cost: c.cost }); return paint(); } } catch {} }
  LF.busy = true; paint();
  try {
    const r = await fetch(API + "/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: LF.q, recency: LF.rec, scope: "portal" }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.detail || `Search failed (${r.status})`);
    Object.assign(LF, { res: j.results || [], at: Date.now(), ms: j.ms || 0, cost: j.usage?.cost_usd ?? null });
    try { sessionStorage.setItem(k, JSON.stringify({ res: LF.res, at: LF.at, ms: LF.ms, cost: LF.cost })); } catch {}
  } catch (e) { LF.err = /Failed to fetch|NetworkError/i.test(e.message) ? "Could not reach the live search backend." : e.message; LF.res = LF.res || []; }
  LF.busy = false; paint();
}
export function bindFeed() {
  fetch(API + "/api/health").then((r) => r.json()).then((h) => { LF.live = !!h.live; paint(); }).catch(() => { LF.live = false; paint(); });
  document.addEventListener("submit", (e) => { if (e.target.id !== "lf-form") return; e.preventDefault(); const q = document.querySelector("#lf-q")?.value.trim(); if (q && q.length >= 2) LF.q = q; LF.rec = document.querySelector("#lf-rec")?.value || LF.rec; run(false); });
  document.addEventListener("click", (e) => { if (e.target.closest?.("[data-lf='refresh']")) { const q = document.querySelector("#lf-q")?.value.trim(); if (q && q.length >= 2) LF.q = q; LF.rec = document.querySelector("#lf-rec")?.value || LF.rec; run(true); } });
}
