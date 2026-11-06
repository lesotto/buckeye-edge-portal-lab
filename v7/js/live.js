import { C as CF } from "./college.js";
// Live Portal Intel: real Perplexity web search + a researched/refreshable list of the 30 players
// most likely to enter the January 2027 transfer portal. Real players are never scored by the synthetic model.
import { LIKELY, SRC, SIGNALS, BASE, RETRIEVED_AT, likelihood } from "./likely.js";

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);
const RAW = window.__API_BASE__ || "__PORT_8006__";
const API = RAW.startsWith("__PORT_") ? (LOCAL.has(location.hostname) ? "http://localhost:8006" : null) : RAW;

export const L = {
  health: null, mode: "search", q: "", recency: "month", busy: false, err: "", res: null,
  dataset: "seed", liveData: null, job: null, jobSteps: [], jobElapsed: 0, jobErr: "",
  posF: "all", sort: "likely", open: null,
  rq: null, rbusy: false, rres: null, rerr: "",
};

const QUICK = [
  "college football players who announced they will enter the transfer portal 2027",
  "college football players redshirting this season with plans to transfer",
  "Group of Five stars Power 4 programs will target in the 2027 transfer portal",
  "Ohio State Buckeyes transfer portal needs 2027",
];

async function call(path, body) {
  if (!API) throw new Error("Backend not configured on this host");
  const r = await fetch(API + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" } : { credentials: "same-origin" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail ? (typeof j.detail === "string" ? j.detail : "Invalid request") : `HTTP ${r.status}`);
  return j;
}

export async function checkHealth(render) {
  try { L.health = await call("/api/health"); } catch { L.health = { live: false, offline: true }; }
  if (L.health.cached && !L.liveData) { try { L.liveData = await call("/api/portal/latest"); } catch {} }
  render();
}

const safe = (u) => (/^https?:\/\//i.test(String(u || "")) ? u : "#");
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const SIG_KEYS = Object.keys(SIGNALS);

function rows() {
  let list;
  if (L.dataset === "live" && L.liveData) {
    const key = (n) => n.toLowerCase().replace(/[^a-z]/g, "");
    const seedBy = Object.fromEntries(LIKELY.map((p) => [key(p.name), p]));
    const live = L.liveData.players.map((p) => { const sd = seedBy[key(p.name)];
      const sig = [...new Set([...(p.sig || []), ...(sd ? sd.sig : [])])].filter((k) => k !== "intent" || p.status === "announced_intent" || (sd && sd.sig.includes("intent")));
      return { ...p, sig, srcs: [...(p.urls || []).map((u) => ({ t: host(u), u, d: p.source_date || "" })), ...(sd ? sd.src.map((k) => SRC[k]) : [])].filter((s, i, a) => a.findIndex((x) => x.u === s.u) === i).slice(0, 4), origin: sd ? "both" : "new" }; });
    const have = new Set(live.map((p) => key(p.name)));
    const fill = LIKELY.filter((p) => !have.has(key(p.name))).map((p) => ({ ...p, status: p.sig.includes("intent") ? "announced_intent" : "watch_list", srcs: p.src.map((k) => SRC[k]), origin: "seed" }));
    list = [...live, ...fill.sort((a, b) => likelihood(b).v - likelihood(a).v)].slice(0, 30);
  } else {
    list = LIKELY.map((p) => ({ ...p, status: p.sig.includes("intent") ? "announced_intent" : "watch_list", srcs: p.src.map((k) => SRC[k]), origin: "seed" }));
  }
  list = list.map((p, i) => ({ ...p, rank0: i + 1, lk: likelihood(p) }));
  if (L.posF !== "all") list = list.filter((p) => p.pos === L.posF);
  if (L.sort === "likely") list.sort((a, b) => b.lk.v - a.lk.v || a.rank0 - b.rank0);
  if (L.sort === "pos") list.sort((a, b) => a.pos.localeCompare(b.pos) || b.lk.v - a.lk.v);
  if (L.sort === "school") list.sort((a, b) => a.school.localeCompare(b.school));
  return list;
}

const STATUS = { announced_intent: ["Reported intent", "b-ok"], reported_likely: ["Reported likely", "b-estimate"], watch_list: ["Media watch list", "b-hypothesis"] };

export function pageLive(esc, badge) {
  const h = L.health;
  const conn = !h ? `<span class="badge b-hypothesis">Checking…</span>` : h.live ? `<span class="badge b-ok">Live · Perplexity API</span>` : `<span class="badge b-bad">Offline · showing researched list</span>`;
  const all = rows();
  const positions = [...new Set((L.dataset === "live" && L.liveData ? L.liveData.players : LIKELY).map((p) => p.pos))].sort();
  const res = L.res;
  let out = "";
  if (L.err) out = `<div class="lv-err">${esc(L.err)}</div>`;
  else if (L.busy) out = `<div class="rs-log"><div><span class="t">0s</span><span class="a">${L.mode === "search" ? "Search API" : "Agent API"}</span>${L.mode === "search" ? "POST /search · ranking live web results…" : "POST /v1/agent · effort=low · web_search · composing a cited answer…"}</div></div>`;
  else if (res && res.kind === "search") out = `<div class="lv-meta">${res.results.length} results · ${res.ms} ms · ${esc(res.endpoint)}</div><ol class="lv-results">${res.results.map((r) => `<li><a href="${esc(safe(r.url))}" target="_blank" rel="noopener">${esc(r.title)}</a><div class="lv-host">${esc(host(r.url))}${r.date ? " · " + esc(r.date) : ""}</div><p>${esc((r.snippet || "").replace(/\s+/g, " ").slice(0, 300))}…</p></li>`).join("")}</ol>`;
  else if (res && res.kind === "ask") {
    const ans = esc(res.answer).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*([^*\n]+)\*/g, "$1").replace(/\[(\d+)\]/g, (m, n) => { const s = res.sources[+n - 1]; return s ? `<a class="lv-cite" href="${esc(safe(s.url))}" target="_blank" rel="noopener">${n}</a>` : m; }).replace(/\n\n/g, "</p><p>");
    out = `<div class="lv-meta">${res.ms} ms · ${esc(res.endpoint)} · model ${esc(res.usage?.model || "")} · cost $${(Number(res.usage?.cost_usd) || 0).toFixed(4)}</div>
      <div class="rs-log" style="min-height:0;margin-bottom:10px">${res.steps.map((s, i) => `<div><span class="t">${i + 1}</span><span class="a">${esc(s.kind)}</span>${esc(s.detail)}</div>`).join("") || `<div class="dim">No tool steps reported</div>`}</div>
      <div class="lv-answer"><p>${ans}</p></div>
      <ol class="lv-srcs">${res.sources.map((s) => `<li><a href="${esc(safe(s.url))}" target="_blank" rel="noopener">${esc(s.title || host(s.url))}</a> <span>${esc(host(s.url))}${s.date ? " · " + esc(s.date) : ""}</span></li>`).join("")}</ol>`;
  } else out = `<div class="lv-quick">${QUICK.map((q) => `<button class="rs-mq" data-act="lv-quick" data-q="${esc(q)}"><b>Try</b><span>${esc(q)}</span></button>`).join("")}</div>`;

  const ds = L.dataset === "live" && L.liveData ? `Live refresh · ${esc(L.liveData.retrieved_at)} · ${L.liveData.players.length} sourced players found by ${L.liveData.usage?.agents || 4} agents, topped up to 30 from the researched list${L.liveData.usage?.cost_usd != null ? ` · cost $${(Number(L.liveData.usage.cost_usd) || 0).toFixed(3)}` : ""}` : `Researched seed list · retrieved ${RETRIEVED_AT} · 30 players · ${Object.keys(SRC).length} cited articles`;
  const jobOn = L.job && L.job.status === "running";
  const jobPanel = L.job ? `<div class="rs-log" aria-live="polite" style="margin:0 16px 12px">
      <div><span class="t">0s</span><span class="a">orchestrator</span>Refresh job ${esc(L.job.id)} started</div>
      ${L.jobSteps.map((s) => `<div><span class="t">·</span><span class="a">${esc(s.kind)}</span>${esc(s.detail)}</div>`).join("")}
      ${jobOn ? `<div><span class="t">${L.jobElapsed}s</span><span class="a">agent</span>Searching, reading and structuring sources… (typically 1–4 minutes)</div>` : ""}
      ${L.job.status === "done" ? `<div><span class="t">${L.jobElapsed}s</span><span class="a">done</span>Live list ready — switched the table to the live refresh</div>` : ""}
      ${L.jobErr ? `<div style="color:#ff9aa9"><span class="t">${L.jobElapsed}s</span><span class="a">error</span>${esc(L.jobErr)} — the researched list stays in place</div>` : ""}</div>` : "";

  const table = all.map((p) => {
    const st = STATUS[p.status] || STATUS.watch_list, isOpen = L.open === p.name;
    const bar = `<div class="lk lk-heur" title="Heuristic index, not a model probability"><div class="lk-bar"><i style="width:${Math.round(p.lk.v * 100)}%"></i></div><b>${Math.round(p.lk.v * 100)}</b></div>`;
    return `<tr class="${isOpen ? "lv-open" : ""}"><td class="mono">${p.rank0}</td>
      <td><button class="lnk" data-act="lv-open" data-n="${esc(p.name)}"><b>${esc(p.name)}</b></button><div class="note" style="margin:2px 0 0">${esc(p.pos)} · ${esc(p.school)}${p.conf ? " · " + esc(p.conf) : ""}</div></td>
      <td>${esc(p.yr || "—")}<div class="note" style="margin:2px 0 0">${esc(p.elig || "")}</div></td>
      <td class="lv-stat">${esc(p.stats)}</td>
      <td class="lv-why">${esc(p.why)}</td>
      <td><span class="badge ${st[1]}">${st[0]}</span>${p.origin === "new" ? `<span class="lv-org new">New from web</span>` : p.origin === "both" ? `<span class="lv-org both">Confirmed by refresh</span>` : p.origin === "seed" && L.dataset === "live" ? `<span class="lv-org">From researched list</span>` : ""}<div class="lv-sigs">${p.sig.map((k) => `<span class="lv-sig" title="${esc(SIGNALS[k]?.l || k)}">${esc(k)}</span>`).join("")}</div></td>
      <td>${bar}</td>
      <td class="lv-src">${p.srcs.map((s) => `<a href="${esc(safe(s.u))}" target="_blank" rel="noopener" title="${esc(s.t)}">${esc(host(s.u))}</a>`).join("")}</td>
      <td><div class="row-btns" style="flex-wrap:nowrap;margin-top:0"><button class="btn sm" data-act="lv-research" data-n="${esc(p.name)}" data-s="${esc(p.school)}" data-p="${esc(p.pos)}" ${!h?.live || L.rbusy ? "disabled" : ""}>Research live</button>${CF.health?.connected ? `<button class="btn sm" data-act="cf-lookup" data-n="${esc(p.name)}" data-t="${esc(p.school)}" title="Usage and PPA from CollegeFootballData.com">College stats</button>` : ""}</div></td></tr>
      ${isOpen ? `<tr class="lv-calc"><td></td><td colspan="8"><b>How the index is calculated</b> <span class="mono">base ${BASE.toFixed(2)}${p.lk.parts.map((x) => ` ${x.w >= 0 ? "+" : "−"} ${Math.abs(x.w).toFixed(2)} (${x.l})`).join("")} = ${p.lk.v.toFixed(2)}</span><div class="note">A transparent, rules-based ranking of reported signals — not a probability and not the Bayesian success model. Clamped to 0.05–0.95.</div></td></tr>` : ""}`;
  }).join("");

  const rr = L.rres;
  const rpanel = L.rq ? `<section class="card card-pad" id="lv-rpanel" style="margin-top:14px"><div class="card-h"><div><h3>Live research: ${esc(L.rq.name)}</h3><p>Perplexity Agent API · web_search · structured findings, each with its own source</p></div><div class="sp"></div>${badge("hypothesis")}</div>
      ${L.rbusy ? `<div class="rs-log"><div><span class="t">0s</span><span class="a">Agent API</span>POST /v1/agent · effort=low · searching public sources for ${esc(L.rq.name)} (${esc(L.rq.pos)}, ${esc(L.rq.school)})…</div></div>` : ""}
      ${L.rerr ? `<div class="lv-err">${esc(L.rerr)}</div>` : ""}
      ${rr ? `<div class="lv-meta">${rr.ms} ms · ${esc(rr.endpoint)} · cost $${(Number(rr.usage?.cost_usd) || 0).toFixed(4)} · ${rr.findings.length} findings</div>
        <div class="rs-log" style="min-height:0;margin-bottom:10px">${rr.steps.map((s, i) => `<div><span class="t">${i + 1}</span><span class="a">${esc(s.kind)}</span>${esc(s.detail)}</div>`).join("")}</div>
        <p>${esc(rr.summary)}</p>
        <div class="scroll-x"><table class="t"><thead><tr><th>Category</th><th>Finding</th><th>Statement</th><th>Source</th></tr></thead><tbody>
        ${rr.findings.map((f) => `<tr><td class="mono">${esc(f.category)}</td><td>${esc(f.claim)}</td><td>${f.statement === "observed" ? badge("observed") : badge("hypothesis")}</td><td><a href="${esc(safe(f.source_url))}" target="_blank" rel="noopener">${esc(host(f.source_url))}</a>${f.source_date ? `<div class="note" style="margin:0">${esc(f.source_date)}</div>` : ""}</td></tr>`).join("")}</tbody></table></div>
        <p class="note">Findings go to the staff for review. They are logged to the Run Journal and never change a probability on their own.</p>` : ""}</section>` : "";

  return `
  <div class="callout fz"><b>Live web data.</b> This page calls the Perplexity API from a FuzeBox backend; the key stays on the server. Every player below is named in public reporting as a <b>possible</b> January 2027 portal entrant — reported speculation with a source, not a confirmed entry. Real players are not scored by the synthetic Bayesian model; that requires the staff's success definition and data first.</div>
  <section class="card card-pad" style="margin-top:14px">
    <div class="card-h"><div><h3>Search the web</h3><p>Web search returns ranked live results; Ask returns a short cited answer from an agent that searches for you.</p></div><div class="sp"></div>${conn}</div>
    <form class="lv-bar" data-form="lv-search">
      <div class="lv-modes" role="tablist"><button type="button" class="${L.mode === "search" ? "on" : ""}" data-act="lv-mode" data-m="search">Web search</button><button type="button" class="${L.mode === "ask" ? "on" : ""}" data-act="lv-mode" data-m="ask">Ask with citations</button></div>
      <input id="lv-q" type="search" maxlength="300" value="${esc(L.q)}" placeholder="${L.mode === "search" ? "Search the internet, e.g. Xavier Atkins transfer portal" : "Ask, e.g. Which edge rushers could hit the 2027 portal?"}" aria-label="Search query" autocomplete="off"/>
      ${L.mode === "search" ? `<select id="lv-rec" aria-label="Recency"><option value="" ${!L.recency ? "selected" : ""}>Any time</option>${["day", "week", "month", "year"].map((r) => `<option value="${r}" ${L.recency === r ? "selected" : ""}>Past ${r}</option>`).join("")}</select>` : ""}
      <button class="btn primary" type="submit" ${L.busy || !h?.live ? "disabled" : ""}>${L.busy ? "Searching…" : L.mode === "search" ? "Search" : "Ask"}</button>
    </form>
    ${h && !h.live ? `<p class="note">Live search is offline on this host. The researched list below still works, and every source link opens directly.</p>` : ""}
    <div class="lv-out">${out}</div>
  </section>
  <section class="card" style="margin-top:14px">
    <div class="card-h"><div><h3>Top 30 likely transfers · January 2027 window</h3><p>${ds}</p></div><div class="sp"></div>
      <div class="lv-tools">
        <div class="lv-modes"><button class="${L.dataset === "seed" ? "on" : ""}" data-act="lv-ds" data-d="seed">Researched list</button><button class="${L.dataset === "live" ? "on" : ""}" data-act="lv-ds" data-d="live" ${L.liveData ? "" : "disabled"}>Live refresh</button></div>
        <select id="lv-pos" aria-label="Position"><option value="all">All positions</option>${positions.map((p) => `<option ${L.posF === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
        <select id="lv-sort" aria-label="Sort"><option value="likely" ${L.sort === "likely" ? "selected" : ""}>Sort: heuristic index</option><option value="pos" ${L.sort === "pos" ? "selected" : ""}>Sort: position</option><option value="school" ${L.sort === "school" ? "selected" : ""}>Sort: school</option></select>
        <button class="btn fz" data-act="lv-refresh" ${!h?.live || jobOn ? "disabled" : ""}>${jobOn ? `Refreshing… ${L.jobElapsed}s` : "Refresh from the web"}</button>
      </div></div>
    <div class="callout heur" style="margin:0 16px 12px"><b>Heuristic, not scored.</b> The index ranks reported signals with fixed, visible rules. It is not a probability, the Bayesian model does not score real players, and live research stays behind the OSU sponsor-approval and compliance gate.</div>
    ${jobPanel}
    <div class="scroll-x"><table class="t lv-table"><thead><tr><th>#</th><th>Player</th><th>Class / elig.</th><th>2026 evidence</th><th>Reported reason</th><th>Status · signals</th><th>Heuristic index <span class="badge b-heuristic">not a probability</span></th><th>Sources</th><th></th></tr></thead><tbody>${table || `<tr><td colspan="9" class="note">No players for this filter.</td></tr>`}</tbody></table></div>
    <div class="lv-legend">${SIG_KEYS.map((k) => `<span><span class="lv-sig">${k}</span>${esc(SIGNALS[k].l)} <b>${SIGNALS[k].w > 0 ? "+" : "−"}${Math.abs(SIGNALS[k].w).toFixed(2)}</b></span>`).join("")}</div>
    <p class="note" style="padding:0 16px 14px">The portal window opens in early January 2027: <a href="${SRC.market.u}" target="_blank" rel="noopener">USA TODAY</a> reports a two-week window from Jan. 2, while earlier reports cited Jan. 4 — confirm against the NCAA calendar. No medical, academic or NIL details are collected. Click a name to see its calculation.</p>
  </section>
  ${rpanel}`;
}

export function bindLive({ render, log, toast, go }) {
  const doSearch = async () => {
    const q = (document.querySelector("#lv-q")?.value || "").trim(); if (q.length < 2) return;
    L.q = q; L.recency = document.querySelector("#lv-rec")?.value ?? L.recency; L.busy = true; L.err = ""; L.res = null; render();
    try {
      if (L.mode === "search") { const r = await call("/api/search", { query: q, recency: L.recency || null, max_results: 10 }); L.res = { kind: "search", ...r }; log("live.search", `Web search: ${q}`, { query: q, recency: L.recency || "any" }, { results: r.results.length, ms: r.ms, top: r.results.slice(0, 3).map((x) => x.url) }, "observed"); }
      else { const r = await call("/api/ask", { question: q }); L.res = { kind: "ask", ...r }; log("live.ask", `Ask: ${q}`, { question: q }, { sources: r.sources.length, steps: r.steps.length, cost_usd: r.usage?.cost_usd ?? null, ms: r.ms }, "hypothesis"); }
    } catch (e) { L.err = e.message; }
    L.busy = false; render();
  };
  document.addEventListener("submit", (e) => { if (e.target.dataset.form === "lv-search") { e.preventDefault(); doSearch(); } });
  document.addEventListener("change", (e) => {
    if (e.target.id === "lv-pos") { L.posF = e.target.value; render(); }
    if (e.target.id === "lv-sort") { L.sort = e.target.value; render(); }
    if (e.target.id === "lv-rec") L.recency = e.target.value;
  });
  document.addEventListener("input", (e) => { if (e.target.id === "lv-q") L.q = e.target.value; });
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-act^='lv-']"); if (!t) return;
    const a = t.dataset.act;
    if (a === "lv-mode") { L.mode = t.dataset.m; L.res = null; L.err = ""; render(); }
    if (a === "lv-quick") { L.q = t.dataset.q; render(); doSearch(); }
    if (a === "lv-ds") { L.dataset = t.dataset.d; render(); }
    if (a === "lv-open") { L.open = L.open === t.dataset.n ? null : t.dataset.n; render(); }
    if (a === "lv-refresh") {
      try {
        const r = await call("/api/portal/refresh", {}); L.job = { id: r.job, status: "running" }; L.jobSteps = []; L.jobErr = ""; L.jobElapsed = 0; render();
        log("live.refresh.start", "Refresh top-30 likely transfers from the web", { job: r.job, effort: "medium", tools: ["web_search", "fetch_url"], schema: "portal_watch_2027" }, {}, "hypothesis");
        const tick = async () => {
          try {
            const j = await call(`/api/portal/job/${r.job}`); L.jobSteps = j.steps; L.jobElapsed = j.elapsed; L.job.status = j.status;
            if (j.status === "done") { L.liveData = j.result; L.dataset = "live"; toast(`Live list ready · ${j.result.players.length} sourced players`); log("live.refresh.done", "Live top-30 list ready", { job: r.job }, { players: j.result.players.length, dropped_unsourced: j.result.dropped_unsourced, cost_usd: j.result.usage?.cost_usd ?? null, ms: j.result.ms }, "hypothesis"); }
            else if (j.status === "error") { L.jobErr = j.error; }
            else setTimeout(tick, 3000);
          } catch (err) { L.jobErr = err.message; L.job.status = "error"; }
          render();
        };
        setTimeout(tick, 2500);
      } catch (err) { L.job = { id: "—", status: "error" }; L.jobErr = err.message; render(); }
    }
    if (a === "lv-research") {
      if (!t.dataset.n) return;
      if (!location.hash.startsWith("#/live")) go("live");
      L.rq = { name: t.dataset.n, school: t.dataset.s, pos: t.dataset.p }; L.rbusy = true; L.rres = null; L.rerr = ""; render();
      document.querySelector("#lv-rpanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      try { const r = await call("/api/research", L.rq); L.rres = r; log("research.live", `Live research: ${L.rq.name}`, { player: L.rq.name, school: L.rq.school, pos: L.rq.pos }, { findings: r.findings.length, cost_usd: r.usage?.cost_usd ?? null, ms: r.ms, sources: r.findings.map((f) => f.source_url) }, "hypothesis"); }
      catch (err) { L.rerr = err.message; }
      L.rbusy = false; render();
    }
  });
}

export const liveReady = () => !!(L.health && L.health.live);
