// College Data: real CollegeFootballData.com (CFBD) data pulled by the FuzeBox backend.
// Portal classes, observed base rates (the real-data starting point for the Bayesian model),
// Ohio State returning production and per-player usage / PPA lookups.

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);
const RAW = window.__API_BASE__ || "__PORT_8006__";
const API = RAW.startsWith("__PORT_") ? (LOCAL.has(location.hostname) ? "http://localhost:8006" : null) : RAW;
const ATTR_URL = "https://collegefootballdata.com";

export const C = {
  health: null, year: null, pos: "all", status: "all", q: "",
  portal: null, pbusy: false, perr: "",
  rates: null, rbusy: false, rerr: "", rsel: null, rgrp: "ALL",
  ret: null, retbusy: false, reterr: "",
  pq: "", pteam: "", player: null, plbusy: false, plerr: "",
  loaded: false,
};

async function get(path, params = {}) {
  if (!API) throw new Error("Backend not configured on this host");
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
  const r = await fetch(`${API}${path}${qs ? "?" + qs : ""}`, { credentials: "same-origin" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof j.detail === "string" ? j.detail : `HTTP ${r.status}`);
  return j;
}

export async function checkCollege(render) {
  try { C.health = await get("/api/cfbd/health"); } catch { C.health = { connected: false }; }
  if (C.year == null) C.year = C.health.season || 2026;
  render();
}

const pct = (x, d = 0) => (x == null || isNaN(x) ? "—" : (x * 100).toFixed(d) + "%");
const num = (x, d = 3) => (x == null || x === "" || isNaN(+x) ? "—" : (+x).toFixed(d));
const GROUPS = ["QB", "RB", "WR", "TE", "OL", "EDGE", "DL", "LB", "CB", "S", "ATH", "ST", "Other"];
const LVL = { "Power 4": "b-ok", "Group of 5 / Ind.": "b-estimate", "Non-FBS": "b-hypothesis" };

export function pageCollege(esc, badge) {
  const h = C.health;
  const conn = !h ? `<span class="badge b-hypothesis">Checking…</span>` : h.connected ? `<span class="badge b-ok">Live · CollegeFootballData API</span>` : `<span class="badge b-bad">Not connected on this host</span>`;
  const years = [2022, 2023, 2024, 2025, 2026].filter((y) => y <= (h?.season || 2026));

  // ---------- portal class ----------
  const P = C.portal, S = P?.summary;
  const kpi = (l, v, n) => `<div class="cf-kpi"><div class="l">${l}</div><div class="v">${v}</div>${n ? `<div class="n">${n}</div>` : ""}</div>`;
  const maxG = S ? Math.max(...Object.values(S.by_group).map((g) => g.n)) : 1;
  const portal = C.perr ? `<div class="lv-err">${esc(C.perr)}</div>` : C.pbusy && !P ? `<div class="rs-log"><div><span class="t">0s</span><span class="a">CFBD</span>GET /player/portal?year=${C.year} · GET /teams/fbs?year=${C.year} · joining conferences…</div></div>` : !P ? "" : `
    <div class="lv-meta">${P.ms} ms · ${esc(P.endpoint)}${P.cached ? " · served from server cache" : " · fresh pull"}</div>
    <div class="cf-kpis">
      ${kpi("Portal entries", S.entries.toLocaleString(), `${S.withdrawn} withdrew · ${(S.entries - S.withdrawn).toLocaleString()} active`)}
      ${kpi("Found a new school", pct(S.placed / S.entries), `${S.placed.toLocaleString()} players`)}
      ${kpi("Immediately eligible", pct(S.immediate / S.entries), "")}
      ${kpi("Left a Power 4 school", pct(S.from_power / S.entries), `${S.from_power.toLocaleString()} players`)}
      ${kpi("Moved up to Power 4", S.moved_up.toLocaleString(), "from Group of 5 / independent")}
      ${kpi("Ohio State", `${S.to_osu} in · ${S.from_osu} out`, "")}
    </div>
    <div class="cf-bars">${Object.entries(S.by_group).map(([g, v]) => `<button class="cf-bar ${C.pos === g ? "on" : ""}" data-act="cf-pos" data-g="${esc(g)}" title="Filter to ${esc(g)}"><span class="g">${esc(g)}</span><span class="b"><i style="width:${(v.n / maxG) * 100}%"></i><em style="width:${(v.placed / maxG) * 100}%"></em></span><span class="v">${v.n}<small> · ${pct(v.placed / v.n)} placed</small></span></button>`).join("")}</div>
    <div class="note" style="margin:4px 0 10px">Bar = entries; darker fill = found a new school. Click a position to filter the table.</div>
    <div class="scroll-x"><table class="t"><thead><tr><th>Player</th><th>Pos</th><th>From</th><th>To</th><th>Move</th><th>Eligibility</th><th>Rating</th><th>Date</th></tr></thead><tbody>
    ${P.rows.map((r) => `<tr><td><button class="lnk" data-act="cf-lookup" data-n="${esc(r.name)}" data-t="${esc(r.dest || r.origin || "")}"><b>${esc(r.name)}</b></button></td><td class="mono">${esc(r.pos)}</td>
      <td>${esc(r.origin || "—")}<div><span class="badge ${LVL[r.origin_level] || ""}" style="font-size:10px">${esc(r.origin_level)}</span></div></td>
      <td>${r.dest ? esc(r.dest) + `<div><span class="badge ${LVL[r.dest_level] || ""}" style="font-size:10px">${esc(r.dest_level)}</span></div>` : `<span class="dim">Uncommitted</span>`}</td>
      <td>${r.move ? `<span class="cf-move ${r.move}">${r.move === "up" ? "▲ Up" : r.move === "down" ? "▼ Down" : "Lateral"}</span>` : "—"}</td>
      <td>${esc(r.elig || "—")}</td><td class="mono">${r.rating ? num(r.rating, 4) : "—"}${r.stars ? ` <span class="dim">${r.stars}★</span>` : ""}</td><td class="mono">${esc(r.date || "—")}</td></tr>`).join("") || `<tr><td colspan="8" class="note">No entries match.</td></tr>`}
    </tbody></table></div>
    <p class="note">Showing ${P.rows.length} of ${P.matched.toLocaleString()} matching entries, highest recruiting rating first. Click a name to pull his usage and PPA.</p>`;

  // ---------- base rates / priors ----------
  const R = C.rates;
  const g = R?.groups?.[C.rgrp];
  const rates = C.rerr ? `<div class="lv-err">${esc(C.rerr)}</div>` : C.rbusy && !R ? `<div class="rs-log"><div><span class="t">0s</span><span class="a">CFBD</span>Pulling five portal classes and conference maps (cached after the first pull)…</div></div>` : !R ? "" : `
    <div class="lv-meta">${R.ms} ms · ${esc(R.endpoint)} · ${esc(R.note)}</div>
    <div class="scroll-x"><table class="t"><thead><tr><th>Position</th><th>Entries</th><th>Found a school</th><th>Landed at Power 4</th><th>G5 → Power 4</th><th>Starting estimate · placement</th><th>Starting estimate · move up</th></tr></thead><tbody>
    ${Object.entries(R.groups).filter(([k]) => GROUPS.includes(k) || k === "ALL").map(([k, v]) => { const t = v.total; return `<tr class="${C.rgrp === k ? "lv-open" : ""}"><td><button class="lnk" data-act="cf-grp" data-g="${esc(k)}"><b>${k === "ALL" ? "All positions" : esc(k)}</b></button></td><td class="mono">${t.n.toLocaleString()}</td><td>${pct(t.placed / t.n)}</td><td>${pct(t.p4 / t.n)}</td><td>${t.up} / ${t.g5} <span class="dim">(${pct(t.up / Math.max(1, t.g5), 1)})</span></td>
      <td><div class="cf-ci"><span style="left:${v.prior_placed.lo80 * 100}%;width:${(v.prior_placed.hi80 - v.prior_placed.lo80) * 100}%"></span><b style="left:${v.prior_placed.mean * 100}%"></b></div><span class="mono">${pct(v.prior_placed.mean, 1)}</span></td>
      <td><div class="cf-ci"><span style="left:${v.prior_up_given_g5.lo80 * 100}%;width:${Math.max(0.6, (v.prior_up_given_g5.hi80 - v.prior_up_given_g5.lo80) * 100)}%"></span><b style="left:${v.prior_up_given_g5.mean * 100}%"></b></div><span class="mono">${pct(v.prior_up_given_g5.mean, 1)}</span></td></tr>`; }).join("")}
    </tbody></table></div>
    ${g ? `<div class="cf-calc"><b>How the starting estimate is calculated · ${C.rgrp === "ALL" ? "all positions" : esc(C.rgrp)}</b>
      <div class="mono">Placement: start with Beta(1, 1) (no opinion) + ${g.total.placed.toLocaleString()} placed + ${(g.total.n - g.total.placed).toLocaleString()} not placed → Beta(${g.prior_placed.a.toLocaleString()}, ${g.prior_placed.b.toLocaleString()}) → mean ${pct(g.prior_placed.mean, 1)}, 80% range ${pct(g.prior_placed.lo80, 1)}–${pct(g.prior_placed.hi80, 1)}</div>
      <div class="mono">Move up: Beta(1, 1) + ${g.total.up} moved up + ${g.total.g5 - g.total.up} did not (of ${g.total.g5} Group of 5 entrants) → Beta(${g.prior_up_given_g5.a}, ${g.prior_up_given_g5.b}) → mean ${pct(g.prior_up_given_g5.mean, 1)}, 80% range ${pct(g.prior_up_given_g5.lo80, 1)}–${pct(g.prior_up_given_g5.hi80, 1)}</div>
      <div class="scroll-x" style="margin-top:8px"><table class="t"><thead><tr><th>Season</th><th>Entries</th><th>Found a school</th><th>Landed at Power 4</th><th>G5 → Power 4</th><th>Avg. rating</th></tr></thead><tbody>
      ${Object.entries(g.by_year).map(([y, v]) => `<tr><td class="mono">${y}</td><td class="mono">${v.n}</td><td>${pct(v.placed / v.n)}</td><td>${pct(v.p4 / v.n)}</td><td>${v.up} / ${v.g5}</td><td class="mono">${num(v.avg_rating, 4)}</td></tr>`).join("")}</tbody></table></div>
      <div class="note">These are real, observed counts. They replace the synthetic baseline as the place each player's estimate starts. "Success" here is only "found a new school" or "moved up". The staff's own success definition (starts, snaps, grades) still has to be agreed and joined in.</div></div>` : ""}`;

  // ---------- returning production ----------
  const T = C.ret;
  const retKeys = [["percentPPA", "All production (PPA)"], ["percentPassingPPA", "Passing PPA"], ["percentReceivingPPA", "Receiving PPA"], ["percentRushingPPA", "Rushing PPA"], ["usage", "All usage"], ["passingUsage", "Passing usage"], ["receivingUsage", "Receiving usage"], ["rushingUsage", "Rushing usage"]];
  const ret = C.reterr ? `<div class="lv-err">${esc(C.reterr)}</div>` : C.retbusy && !T ? `<div class="rs-log"><div><span class="t">0s</span><span class="a">CFBD</span>GET /player/returning?year=${C.year}&conference=Big Ten…</div></div>` : !T ? "" : !T.osu ? `<p class="note">No returning-production row for Ohio State in ${T.year}.</p>` : `
    <div class="lv-meta">${T.ms} ms · ${esc(T.endpoint)}${T.cached ? " · served from server cache" : ""}</div>
    <div class="scroll-x"><table class="t"><thead><tr><th>Measure</th><th>Ohio State</th><th>Big Ten median</th><th>Gap</th><th>OSU rank (of ${T.teams})</th></tr></thead><tbody>
    ${retKeys.map(([k, l]) => { const o = +T.osu[k], a = +T.big_ten_avg[k], d = o - a; return `<tr><td>${l}</td><td class="mono">${pct(o)}</td><td class="mono">${pct(a)}</td><td class="mono" style="color:${d < -0.05 ? "var(--sim)" : d > 0.05 ? "var(--ok)" : "inherit"}">${d >= 0 ? "+" : ""}${(d * 100).toFixed(0)} pts</td><td class="mono">${T.osu_rank[k] ?? "—"}</td></tr>`; }).join("")}
    </tbody></table></div>
    <p class="note">Share of last season's production and usage that returns. Ohio State is compared with the Big Ten median because a few teams report more than 100% when last season's total was small or negative. Low returning share at a position is a roster-need signal for the portal board. It's observed data, but it is not a recommendation by itself.</p>`;

  // ---------- player lookup ----------
  const L = C.player;
  const ppaRow = (o) => o ? ["all", "pass", "rush", "firstDown", "secondDown", "thirdDown", "standardDowns", "passingDowns"].map((k) => `<td class="mono">${num(o[k], 3)}</td>`).join("") : `<td colspan="8" class="dim">—</td>`;
  const usageRow = (o) => o ? ["overall", "pass", "rush", "firstDown", "secondDown", "thirdDown", "standardDowns", "passingDowns"].map((k) => `<td class="mono">${pct(+o[k], 1)}</td>`).join("") : `<td colspan="8" class="dim">—</td>`;
  const look = C.plerr ? `<div class="lv-err">${esc(C.plerr)}</div>` : C.plbusy ? `<div class="rs-log"><div><span class="t">0s</span><span class="a">CFBD</span>GET /player/search?searchTerm=${esc(C.pq)} → GET /player/season/overview…</div></div>` : !L ? "" : !L.match ? `<p class="note">No CFBD player matched “${esc(L.query)}”.</p>` : `
    <div class="lv-meta">${L.ms} ms · ${esc(L.endpoint)}</div>
    <div class="cf-player"><div><h4>${esc(L.match.name)}</h4><div class="note" style="margin:2px 0">${esc(L.match.position || "")} · ${esc(L.match.team || "")}${L.match.height ? ` · ${Math.floor(L.match.height / 12)}'${L.match.height % 12}"` : ""}${L.match.weight ? ` · ${L.match.weight} lb` : ""}</div>
      ${L.match.stints?.length ? `<div class="note" style="margin:2px 0">Team history: ${L.match.stints.map((s) => `${esc(s.team)}${s.start ? ` (${esc(String(s.start))}${s.end && s.end !== s.start ? "–" + esc(String(s.end)) : ""})` : ""}`).join(" → ")}</div>` : ""}
      ${L.candidates?.length ? `<div class="note" style="margin:2px 0">Other matches: ${L.candidates.map((c) => `${esc(c.name)} (${esc(c.position || "")}, ${esc(c.team || "")})`).join("; ")}</div>` : ""}</div>${badge("observed")}</div>
    ${L.seasons.length ? L.seasons.map((s) => `<div class="cf-season"><b>${s.year} · ${esc(s.team || "")} · ${s.games ?? "—"} games</b>
      <div class="scroll-x"><table class="t"><thead><tr><th></th><th>All</th><th>Pass</th><th>Rush</th><th>1st down</th><th>2nd down</th><th>3rd down</th><th>Standard downs</th><th>Passing downs</th></tr></thead><tbody>
        <tr><td>Usage (share of team plays)</td>${usageRow(s.usage)}</tr>
        <tr><td>PPA per play (avg)</td>${ppaRow(s.ppa?.average)}</tr>
        <tr><td>PPA total</td>${ppaRow(s.ppa?.total)}</tr></tbody></table></div>
      ${s.box?.length ? `<div class="cf-box">${s.box.map((c) => `<div><span class="dim">${esc(c.cat)}</span> ${c.stats.map((x) => `${esc(x.k)} <b>${esc(String(x.v ?? "—"))}</b>`).join(" · ")}</div>`).join("")}</div>` : ""}</div>`).join("") : `<p class="note">No ${(C.health?.season || 2026) - 1}–${C.health?.season || 2026} season overview on file for this player yet.</p>`}
    <p class="note">PPA (predicted points added) measures how many expected points a player's plays added, adjusted for down, distance and field position. Usage is his share of the team's plays. Both are observed inputs the Bayesian model can use once the staff agree the success definition.</p>`;

  return `
  <div class="callout fz"><b>Real college data.</b> Portal classes, team histories, usage and PPA come from the CollegeFootballData API, called by the FuzeBox backend. The key stays on the server, and results are cached to respect the source's usage limits. These numbers are observed facts. They set the real starting point for the Bayesian model. They don't change any synthetic scores on the Portal Board until the staff approve the pilot. <a href="${ATTR_URL}" target="_blank" rel="noopener">Data provided by CollegeFootballData.com</a>.</div>

  <section class="card card-pad" style="margin-top:14px">
    <div class="card-h"><div><h3>Portal class explorer</h3><p>Every portal entry for a season, joined to FBS conferences so each move is labelled up, down or lateral.</p></div><div class="sp"></div>${conn}</div>
    <div class="lv-tools" style="margin-bottom:10px">
      <select id="cf-year" aria-label="Season">${years.map((y) => `<option ${C.year === y ? "selected" : ""}>${y}</option>`).join("")}</select>
      <select id="cf-pos" aria-label="Position"><option value="all">All positions</option>${GROUPS.map((g) => `<option ${C.pos === g ? "selected" : ""}>${g}</option>`).join("")}</select>
      <select id="cf-status" aria-label="Status"><option value="all" ${C.status === "all" ? "selected" : ""}>All entries</option><option value="placed" ${C.status === "placed" ? "selected" : ""}>Found a school</option><option value="open" ${C.status === "open" ? "selected" : ""}>Uncommitted</option><option value="osu" ${C.status === "osu" ? "selected" : ""}>Ohio State in or out</option></select>
      <form data-form="cf-q" style="display:flex;gap:6px"><input id="cf-q" type="search" maxlength="40" value="${esc(C.q)}" placeholder="Name or school" aria-label="Filter by name or school"/><button class="btn sm" type="submit">Filter</button></form>
      <button class="btn fz sm" data-act="cf-load" ${!h?.connected || C.pbusy ? "disabled" : ""}>${C.pbusy ? "Pulling…" : P ? "Refresh" : "Pull portal data"}</button>
    </div>
    ${!h?.connected && h ? `<p class="note">College data is not connected on this host.</p>` : portal}
  </section>

  <section class="card card-pad" style="margin-top:14px">
    <div class="card-h"><div><h3>Observed base rates · the model's real starting point</h3><p>How often players at each position found a new school, and how often Group of 5 players moved up to Power 4, from ${years[0]} to ${years[years.length - 1]}. Withdrawn entries are excluded: for 2026 that is 4,484 entries − 151 withdrawn = 4,333 counted, which is why the two totals differ.</p></div><div class="sp"></div>${badge("observed")}</div>
    ${R ? "" : `<button class="btn fz sm" data-act="cf-rates" ${!h?.connected || C.rbusy ? "disabled" : ""}>${C.rbusy ? "Pulling five seasons…" : "Calculate base rates"}</button>`}
    ${rates}
  </section>

  <section class="card card-pad" style="margin-top:14px">
    <div class="card-h"><div><h3>Ohio State returning production · ${C.year}</h3><p>Where the roster lost the most production. This is the need side of the portal board.</p></div><div class="sp"></div>${badge("observed")}</div>
    ${T ? "" : `<button class="btn fz sm" data-act="cf-ret" ${!h?.connected || C.retbusy ? "disabled" : ""}>${C.retbusy ? "Pulling…" : "Pull returning production"}</button>`}
    ${ret}
  </section>

  <section class="card card-pad" style="margin-top:14px" id="cf-lookup">
    <div class="card-h"><div><h3>Player lookup</h3><p>Team history, usage and PPA for any FBS player. Works for names on the Live Portal Intel top 30.</p></div></div>
    <form class="lv-bar" data-form="cf-player">
      <input id="cf-pq" type="search" maxlength="60" value="${esc(C.pq)}" placeholder="Player name, e.g. Xavier Atkins" aria-label="Player name" autocomplete="off"/>
      <input id="cf-pt" type="search" maxlength="60" value="${esc(C.pteam)}" placeholder="School (optional)" aria-label="School" autocomplete="off" style="max-width:200px"/>
      <button class="btn primary" type="submit" ${!h?.connected || C.plbusy ? "disabled" : ""}>${C.plbusy ? "Looking up…" : "Look up"}</button>
    </form>
    ${look}
  </section>`;
}

export function bindCollege({ render, log, toast, go }) {
  const loadPortal = async () => {
    C.pbusy = true; C.perr = ""; render();
    try {
      const r = await get("/api/cfbd/portal", { year: C.year, pos: C.pos, status: C.status, q: C.q });
      C.portal = r;
      log("cfbd.portal", `Portal class ${r.year}${C.pos !== "all" ? " · " + C.pos : ""}`, { year: r.year, pos: C.pos, status: C.status, q: C.q || null }, { entries: r.summary.entries, placed: r.summary.placed, matched: r.matched, cached: r.cached, ms: r.ms }, "observed");
    } catch (e) { C.perr = e.message; }
    C.pbusy = false; render();
  };
  const loadRates = async () => {
    C.rbusy = true; C.rerr = ""; render();
    try {
      const r = await get("/api/cfbd/baserates", { first: 2022, last: C.health?.season || 2026 });
      C.rates = r; const a = r.groups.ALL;
      log("cfbd.baserates", "Observed portal base rates (Beta priors)", { years: r.years }, { entries: a?.total.n, prior_placed: a?.prior_placed, prior_up: a?.prior_up_given_g5, ms: r.ms }, "observed");
    } catch (e) { C.rerr = e.message; }
    C.rbusy = false; render();
  };
  const loadRet = async () => {
    C.retbusy = true; C.reterr = ""; render();
    try {
      const r = await get("/api/cfbd/returning", { year: C.year });
      C.ret = r;
      log("cfbd.returning", `Ohio State returning production ${r.year}`, { year: r.year, team: "Ohio State", conference: "Big Ten" }, { percentPPA: r.osu?.percentPPA ?? null, big_ten_median: r.big_ten_avg.percentPPA, rank: r.osu_rank.percentPPA, ms: r.ms }, "observed");
    } catch (e) { C.reterr = e.message; }
    C.retbusy = false; render();
  };
  const lookup = async () => {
    if ((C.pq || "").trim().length < 3) return;
    C.plbusy = true; C.plerr = ""; C.player = null; render();
    document.querySelector("#cf-lookup")?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const r = await get("/api/cfbd/player", { name: C.pq.trim(), team: C.pteam.trim() });
      C.player = r;
      log("cfbd.player", `Player lookup: ${C.pq.trim()}`, { name: C.pq.trim(), team: C.pteam.trim() || null }, { matched: r.match?.name ?? null, team: r.match?.team ?? null, seasons: r.seasons.map((s) => s.year), ms: r.ms }, "observed");
    } catch (e) { C.plerr = e.message; }
    C.plbusy = false; render();
  };
  C.autoload = () => { if (!C.loaded && C.health?.connected) { C.loaded = true; loadPortal(); } };

  document.addEventListener("change", (e) => {
    const id = e.target.id;
    if (id === "cf-year") { C.year = +e.target.value; C.ret = null; loadPortal(); }
    if (id === "cf-pos") { C.pos = e.target.value; loadPortal(); }
    if (id === "cf-status") { C.status = e.target.value; loadPortal(); }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "cf-q") C.q = e.target.value;
    if (e.target.id === "cf-pq") C.pq = e.target.value;
    if (e.target.id === "cf-pt") C.pteam = e.target.value;
  });
  document.addEventListener("submit", (e) => {
    const f = e.target.dataset.form;
    if (f === "cf-q") { e.preventDefault(); loadPortal(); }
    if (f === "cf-player") { e.preventDefault(); lookup(); }
  });
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act^='cf-']"); if (!t) return;
    const a = t.dataset.act;
    if (a === "cf-load") loadPortal();
    if (a === "cf-rates") loadRates();
    if (a === "cf-ret") loadRet();
    if (a === "cf-grp") { C.rgrp = t.dataset.g; render(); }
    if (a === "cf-pos") { C.pos = C.pos === t.dataset.g ? "all" : t.dataset.g; loadPortal(); }
    if (a === "cf-lookup") {
      C.pq = t.dataset.n || ""; C.pteam = t.dataset.t || "";
      if (!location.hash.startsWith("#/college")) go("college");
      setTimeout(lookup, 30);
    }
  });
}

export const collegeReady = () => !!(C.health && C.health.connected);
