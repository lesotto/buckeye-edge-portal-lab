// v4 Portal Watch + Signal Test. Real public data (CollegeFootballData.com), scored by a model tested on past portal classes.
import { LIKELY, SIGNALS, SRC } from "./likely.js";
import { V4DATA } from "./v4data.js";

export const W = { data: V4DATA, err: null, tab: "might", grp: "all", mode: "starter", sel: null, ctx: null, rerun: null };

const API = (() => { const b = window.__API_BASE__ || "__PORT_8006__"; const LOCAL = new Set(["localhost", "127.0.0.1"]); return b.startsWith("__PORT_") ? (LOCAL.has(location.hostname) ? "http://localhost:8006" : null) : b.replace(/\/$/, ""); })();

export async function loadSignals(render) {
  if (W.data) return; // results are bundled; the backend re-run below refreshes them
  try {
    const r = await fetch("./data/v4_signals.json", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    W.data = await r.json();
  } catch (e) { W.err = String(e.message || e); }
  render();
}

// How much more likely, said plainly.
export function plain(rr, lo, hi) {
  if (lo > 1.1) return { t: "More likely to enter", c: "ok" };
  if (hi < 0.9) return { t: "Less likely to enter", c: "bad" };
  if (lo > 1.0 || hi < 1.0) return { t: rr > 1 ? "Slightly more likely" : "Slightly less likely", c: "hyp" };
  return { t: "About even", c: "hyp" };
}
const X = (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(2)) + "×";
const P = (x) => Math.round(x * 100) + "%";
const GRPN = { QB: "Quarterback", RB: "Running back", WR: "Receiver", TE: "Tight end", DL: "Defensive line", LB: "Linebacker", DB: "Defensive back" };
const NEEDMAP = { QB: ["QB"], RB: ["RB"], WR: ["WR"], TE: ["TE"], DL: ["EDGE", "DT"], LB: ["LB"], DB: ["CB", "S"] };
const SIGTXT = { far: "500+ mi from home", g5_over: "Group of Five overperformer", prior: "Transferred before", coach_change: "Head coach changed", no_stats: "No production", in_state: "In-state" };

function strengthOf(key, d) {
  const t = d.tests[d.tests.length - 1].odds[key];
  if (!t) return "untested";
  return t.lo > 1.1 ? "strong" : t.lo > 1.0 ? "weak" : t.hi < 1.0 ? "against" : "not supported";
}

// ---------------- Portal Watch ----------------
export function pageWatch(ctx) {
  const { esc, badge } = ctx, d = W.data;
  if (!d) return W.err ? `<div class="callout sim">Could not load the real-data results (${esc(W.err)}).</div>` : `<div class="card card-pad">Loading real-data results…</div>`;
  const last = d.tests[d.tests.length - 1];
  const tabs = `<div class="seg" role="tablist">${[["might", "Might enter"], ["entered", "Entered · matches our needs"]].map(([k, l]) => `<button class="btn sm ${W.tab === k ? "primary" : ""}" data-wa="tab" data-id="${k}" role="tab" aria-selected="${W.tab === k}">${l}</button>`).join("")}</div>`;
  const head = `<div class="callout fz"><b>Two questions, one screen.</b> Who might enter the January 4 – 13, 2027 portal window (<a href="https://ncaaorg.s3.amazonaws.com/compliance/d1/D1Comp_UndergraduateTransferWindows.pdf" target="_blank" rel="noopener">NCAA Division I transfer-window calendar</a>), and once players enter, who matches what our staff says we need. Scores on this page come from public data and a model tested on the last two portal classes. They are a statistical pattern score, not a scouting report and not a claim about any player's intent.</div>
  <div class="kpis" style="margin-top:14px">
    ${ctx.kpi("Players scored", d.rows["2026"].toLocaleString(), "2026 FBS rosters, all positions")}
    ${ctx.kpi("Tested on", (last.n).toLocaleString(), `players · ${esc(last.test)}`)}
    ${ctx.kpi("Top-10% hit rate", P(last.top_decile_rate), `vs ${P(last.base_rate)} base rate`)}
    ${ctx.kpi("Ranking skill (AUC)", last.auc_all.toFixed(2), "0.50 = coin flip · 1.00 = perfect")}
  </div>${tabs}`;
  return head + (W.tab === "might" ? mightPanel(ctx, d) : enteredPanel(ctx, d));
}

function mightPanel(ctx, d) {
  const { esc } = ctx;
  const grps = ["all", ...Object.keys(GRPN)];
  const per = {};
  const rows = W.grp === "all" ? d.watch.filter((r) => (per[r.grp] = (per[r.grp] || 0) + 1) <= 4) : d.watch.filter((r) => r.grp === W.grp);
  const filt = `<div class="row-f" style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0">${grps.map((g) => `<button class="btn sm ${W.grp === g ? "primary" : ""}" data-wa="grp" data-id="${g}">${g === "all" ? "All groups" : GRPN[g]}</button>`).join("")}</div>`;
  const sigCell = (r) => r.signals.map((s) => `<span class="rp-tag ${s === "far" || s === "g5_over" ? "dan" : ""}" title="${esc(d.signals[s])}">${esc(SIGTXT[s] || s)}${s === "far" || s === "g5_over" ? ` · ${strengthOf(s, d)}` : ""}</span>`).join(" ");
  const table = `<div class="scroll-x"><table class="t"><thead><tr><th>#</th><th>Player</th><th>Group</th><th class="hide-m">Hometown</th><th class="n">Miles</th><th class="n">Prod. pctl</th><th class="n">Pattern score</th><th>Signals</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(r.name)}</b><div class="dim" style="font-size:11px">${esc(r.team)} · ${esc(r.conf)}</div></td><td>${esc(r.grp)}</td><td class="hide-m">${esc(r.home)}</td><td class="n">${r.dist ?? "—"}</td><td class="n">${Math.round(r.pct * 100)}</td><td class="n"><b>${P(r.p)}</b></td><td>${sigCell(r)}</td></tr>`).join("")}
  </tbody></table></div>`;
  const real = `<section class="card card-pad"><div class="card-h"><div><h3>Model watchlist · real 2026 rosters</h3><p>Productive players (60th percentile or better at their position) ranked by the pattern score. ${W.grp === "all" ? "Top 4 per position group shown; pick a group to see its top 25" : `Top ${rows.length} ${GRPN[W.grp].toLowerCase()}s`}. Production uses games played so far this season.</p></div><div class="sp"></div><span class="badge b-ok">Real public data</span></div>${filt}${table}
    <p class="dim" style="font-size:11px;margin-top:8px">Pattern score = the model's estimated chance the player enters the next portal, learned from 2022–2025 rosters and who actually entered. Many players share the same score because they share the same signals. ${esc(d.source)}.</p></section>`;
  // Media-reported list, now annotated with Dan's two signals where the model data has them.
  const byName = new Map(d.watch.map((r) => [r.name.toLowerCase(), r]));
  const media = `<section class="card card-pad" style="margin-top:14px"><div class="card-h"><div><h3>Named in reporting · 30 players</h3><p>Reported speculation from cited articles (v3 list). Where a player also appears on the model watchlist, his pattern score and Dan's signals are shown.</p></div><div class="sp"></div><span class="badge b-hypothesis">Reported, not confirmed</span></div>
    <div class="scroll-x"><table class="t"><thead><tr><th>Player</th><th>Pos</th><th>School</th><th>Reported signals</th><th class="n">Model</th><th>Source</th></tr></thead><tbody>
    ${LIKELY.map((p) => { const m = byName.get(p.name.toLowerCase()); return `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.pos)}</td><td>${esc(p.school)}</td><td>${p.sig.map((s) => `<span class="rp-tag">${esc(SIGNALS[s].l)}</span>`).join(" ")}</td><td class="n">${m ? `<b>${P(m.p)}</b><div class="dim" style="font-size:10.5px">${m.signals.map((s) => SIGTXT[s]).join(", ")}</div>` : `<span class="dim">not in top list</span>`}</td><td>${p.src.map((k) => `<a href="${SRC[k].u}" target="_blank" rel="noopener">${esc(SRC[k].t.split(" — ")[0])}</a>`).join("<br/>")}</td></tr>`; }).join("")}
    </tbody></table></div></section>`;
  return real + media;
}

function enteredPanel(ctx, d) {
  const { esc } = ctx;
  const needs = ctx.needs();
  const open = needs.filter((n) => n.gap > 0.5);
  const sw = `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0 12px"><span class="dim" style="font-size:12px">Rank for:</span>${[["starter", "A starter (rank by the low end of the range)"], ["backup", "Depth / upside (rank by the high end)"]].map(([k, l]) => `<button class="btn sm ${W.mode === k ? "primary" : ""}" data-wa="mode" data-id="${k}">${l}</button>`).join("")}</div>`;
  const board = ctx.board(W.mode);
  const needCard = `<section class="card card-pad"><div class="card-h"><div><h3>What we need</h3><p>From Roster Needs (sample program data until the coach's needs assessment arrives at the end of November).</p></div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${needs.map((n) => `<span class="rp-tag ${n.gap > 0.5 ? "dan" : ""}">${esc(n.pos)} · gap ${n.gap.toFixed(1)}</span>`).join("")}</div>
    <p class="dim" style="font-size:11.5px;margin-top:8px">${open.length} open needs: ${open.map((n) => n.pos).join(", ") || "none"}.</p></section>`;
  const ent = `<section class="card card-pad" style="margin-top:14px"><div class="card-h"><div><h3>Entered players · ranked for the need</h3><p>The January 2027 window has not opened. Until real entries arrive from the portal feed, this panel runs on the synthetic portal board for the position chosen at the top of the screen, so the staff can rehearse the workflow.</p></div><div class="sp"></div><span class="badge b-bad">Synthetic until the window opens</span></div>${sw}
    <div class="scroll-x"><table class="t"><thead><tr><th>#</th><th>Player</th><th>Pos</th><th class="hide-m">From</th><th class="n">Low end</th><th class="n">Middle</th><th class="n">High end</th><th>Fit</th></tr></thead><tbody>
    ${board.slice(0, 12).map((r, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(r.name)}</b></td><td>${esc(r.pos)}</td><td class="hide-m">${esc(r.from)}</td><td class="n ${W.mode === "starter" ? "hl" : ""}">${P(r.q10)}</td><td class="n">${P(r.mean)}</td><td class="n ${W.mode === "backup" ? "hl" : ""}">${P(r.q90)}</td><td>${r.need ? `<span class="rp-tag dan">Open need</span>` : `<span class="dim">covered</span>`}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="dim" style="font-size:11px;margin-top:8px">Starter mode sorts by the 10th-percentile estimate: the player most likely to clear the bar even in a bad case. Depth mode sorts by the 90th percentile: the player with the most upside. The range is the 80% band from the Bayesian model.</p></section>`;
  return needCard + ent;
}

// ---------------- Signal Test ----------------
export function pageSignals(ctx) {
  const { esc } = ctx, d = W.data;
  if (!d) return W.err ? `<div class="callout sim">Could not load results (${esc(W.err)}).</div>` : `<div class="card card-pad">Loading…</div>`;
  const [t1, t2] = d.tests;
  const verdict = (k) => {
    const u = d.univariate[k].pooled, o2 = t2.odds[k], o1 = t1.odds[k];
    const raw = plain(u.rr, u.lo, u.hi), adj = plain(o2.or, o2.lo, o2.hi);
    return `<section class="card card-pad"><div class="card-h"><div><h3>${esc(d.signals[k])}</h3><p>Dan's signal · ${u.n_with.toLocaleString()} player-seasons had it</p></div><div class="sp"></div><span class="badge b-${adj.c === "ok" ? "ok" : adj.c === "bad" ? "bad" : "hypothesis"}">${adj.t}</span></div>
      <table class="t"><tbody>
        <tr><td>Entry rate with the signal</td><td class="n"><b>${P(u.rate_with)}</b></td></tr>
        <tr><td>Entry rate without it</td><td class="n">${P(u.rate_without)}</td></tr>
        <tr><td>On its own</td><td class="n">${X(u.rr)} <span class="dim">(${u.lo.toFixed(2)}–${u.hi.toFixed(2)})</span> · ${raw.t.toLowerCase()}</td></tr>
        <tr><td>After coach change, prior transfer, in-state, G5 and position are accounted for · 2025 portal test</td><td class="n">${X(o1.or)} <span class="dim">(${o1.lo.toFixed(2)}–${o1.hi.toFixed(2)})</span></td></tr>
        <tr><td>Same · 2026 portal test</td><td class="n"><b>${X(o2.or)}</b> <span class="dim">(${o2.lo.toFixed(2)}–${o2.hi.toFixed(2)})</span></td></tr>
      </tbody></table>
      <div style="margin-top:8px">${Object.entries(d.univariate[k].by_season).map(([y, s]) => `<span class="rp-tag">${y} season: ${X(s.rr)}</span>`).join(" ")}</div></section>`;
  };
  const bands = d.distance_bands, maxR = Math.max(...bands.map((b) => b.rate));
  const bandChart = `<section class="card card-pad"><div class="card-h"><div><h3>Entry rate by distance from home</h3><p>2022–2025 seasons pooled · straight-line miles from hometown to campus</p></div></div>
    ${bands.map((b) => `<div style="display:grid;grid-template-columns:90px 1fr 60px;gap:8px;align-items:center;margin:5px 0;font-size:12px"><span>${esc(b.band.replace("-+", "+"))}</span><span style="background:var(--line);border-radius:3px;height:14px;position:relative"><span style="position:absolute;left:0;top:0;bottom:0;width:${(b.rate / maxR) * 100}%;background:var(--accent,#ba0c2f);border-radius:3px"></span></span><span class="mono">${P(b.rate)}</span></div>`).join("")}
    <p class="dim" style="font-size:11.5px;margin-top:6px">The rate climbs from 13% to about 21% by 250 miles, then flattens. Most of the distance effect is in-state versus out-of-state, which the model already counts separately.</p></section>`;
  const g5 = d.g5_by_group;
  const g5Card = `<section class="card card-pad"><div class="card-h"><div><h3>Group of Five overperformance by position</h3><p>Top-15% producers at Group of Five schools vs other Group of Five players, 2022–2025</p></div></div>
    <div class="scroll-x"><table class="t"><thead><tr><th>Group</th><th class="n">Players</th><th class="n">With</th><th class="n">Without</th><th class="n">Ratio</th><th>Read</th></tr></thead><tbody>
    ${Object.entries(g5).map(([g, s]) => `<tr><td>${GRPN[g] || g}</td><td class="n">${s.n_with}</td><td class="n">${P(s.rate_with)}</td><td class="n">${P(s.rate_without)}</td><td class="n">${X(s.rr)} <span class="dim">(${s.lo.toFixed(2)}–${s.hi.toFixed(2)})</span></td><td>${plain(s.rr, s.lo, s.hi).t}</td></tr>`).join("")}
    </tbody></table></div></section>`;
  const testRow = (t) => `<tr><td>${esc(t.train)}</td><td>${esc(t.test)}</td><td class="n">${t.n.toLocaleString()}</td><td class="n">${t.auc_without_dan.toFixed(3)}</td><td class="n"><b>${t.auc_all.toFixed(3)}</b></td><td class="n">+${t.dauc.toFixed(3)} <span class="dim">(${t.dauc_lo.toFixed(3)} to ${t.dauc_hi.toFixed(3)})</span></td><td class="n">${P(t.top_decile_rate)}</td></tr>`;
  const cal = t2.calibration;
  const calCard = `<section class="card card-pad"><div class="card-h"><div><h3>Calibration · 2026 portal test</h3><p>Predicted vs actual entry rate in ten equal groups</p></div></div>
    <div class="scroll-x"><table class="t"><thead><tr><th>Group</th>${cal.map((_, i) => `<th class="n">${i + 1}</th>`).join("")}</tr></thead><tbody>
    <tr><td>Predicted</td>${cal.map((c) => `<td class="n">${P(c.pred)}</td>`).join("")}</tr><tr><td>Actual</td>${cal.map((c) => `<td class="n"><b>${P(c.obs)}</b></td>`).join("")}</tr></tbody></table></div>
    <p class="dim" style="font-size:11.5px;margin-top:6px">The order is right (actual rates rise from ${P(cal[0].obs)} to ${P(cal[cal.length - 1].obs)}), but the model runs a little low in the middle and upper groups: portal entries kept rising each year, so a model trained on earlier classes underestimates the next one. Treat the score as a ranking, not a literal probability, until it is recalibrated each fall.</p></section>`;
  const other = `<section class="card card-pad"><div class="card-h"><div><h3>Other signals in the same model · 2026 portal test</h3><p>Odds ratios with 95% ranges. Above 1 = more likely to enter.</p></div></div><table class="t"><tbody>
    ${["coach_change", "prior", "in_state", "no_stats"].map((k) => { const o = t2.odds[k]; return `<tr><td>${esc(d.signals[k])}</td><td class="n">${X(o.or)} <span class="dim">(${o.lo.toFixed(2)}–${o.hi.toFixed(2)})</span></td><td>${plain(o.or, o.lo, o.hi).t}</td></tr>`; }).join("")}</tbody></table></section>`;
  const rerun = API ? `<button class="btn sm" data-wa="rerun">${W.rerun === "running" ? "Re-running…" : "Re-run on live data"}</button>` : "";
  return `<div class="callout fz"><b>Bottom line.</b> Group of Five overperformance is a real entry signal: those players entered at ${P(d.univariate.g5_over.pooled.rate_with)} vs ${P(d.univariate.g5_over.pooled.rate_without)}, and the effect held up after other factors were accounted for in both test years. Distance from home looks strong on its own but mostly disappears once in-state status is counted, so it adds little. Together the two signals improved ranking skill by less than one point of AUC: real but small. The bigger signals are a head-coach change and staying in-state.</div>
    <div class="grid g2" style="margin-top:14px">${verdict("g5_over")}${verdict("far")}</div>
    <section class="card card-pad" style="margin-top:14px"><div class="card-h"><div><h3>Walk-forward test · train on past classes, predict the next one</h3><p>${esc(d.method)}</p></div><div class="sp"></div>${rerun}</div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Trained on</th><th>Tested on</th><th class="n">Players</th><th class="n">AUC without Dan</th><th class="n">AUC with Dan</th><th class="n">Gain (95% range)</th><th class="n">Top-10% hit rate</th></tr></thead><tbody>${testRow(t1)}${testRow(t2)}</tbody></table></div>
      <p class="dim" style="font-size:11.5px;margin-top:6px">Players matched to portal entries by name and origin school (the portal feed has no player ID). Seasons: ${Object.entries(d.rows).map(([y, n]) => `${y} ${n.toLocaleString()} players`).join(" · ")}. Entries matched: ${Object.entries(d.entered).map(([y, n]) => `${+y + 1} portal ${n.toLocaleString()}`).join(" · ")}. Generated ${esc(d.generated)}. ${esc(d.source)}.</p></section>
    <div class="grid g2" style="margin-top:14px">${bandChart}${g5Card}</div>
    <div class="grid g2" style="margin-top:14px">${calCard}${other}</div>
    <div class="callout" style="margin-top:14px"><b>Limits.</b> Name matching misses some entries, so rates are a floor. Class year is left out because the source reports nearly every player as year one. Production for 2026 covers games played so far. The model ranks who tends to enter; it cannot see NIL offers, depth-chart conversations or family reasons, which is why the media-reported list stays alongside it.</div>`;
}

export function bindWatch(ctx) {
  W.ctx = ctx;
  loadSignals(ctx.render);
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-wa]"); if (!t) return;
    const a = t.dataset.wa, id = t.dataset.id;
    if (a === "tab") W.tab = id;
    if (a === "grp") W.grp = id;
    if (a === "mode") { W.mode = id; ctx.log("watch.rank", `Rank entered players for a ${id === "starter" ? "starter (10th percentile)" : "depth role (90th percentile)"}`, { mode: id }, {}, "estimate"); }
    if (a === "rerun" && API && W.rerun !== "running") {
      W.rerun = "running"; ctx.render();
      try {
        await fetch(API + "/api/v4/signals/run", { method: "POST" });
        for (let i = 0; i < 120; i++) { await new Promise((r) => setTimeout(r, 4000)); const j = await (await fetch(API + "/api/v4/signals")).json(); if (!j.state.running) { if (j.tests) { const { state, ...rest } = j; W.data = rest; } break; } }
        ctx.log("signals.run", "Re-run Dan's signal test on live CollegeFootballData.com data", {}, { auc_2026_test: W.data.tests[1].auc_all }, "observed");
        ctx.toast("Signal test re-run on live data");
      } catch { ctx.toast("Backend not reachable"); }
      W.rerun = null;
    }
    ctx.render();
  });
}
