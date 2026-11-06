import { RP, prog, S, G, all, byId, can, queue, online, urgency } from "./store.js";
import { esc, usd, usdk, htf, pct, kpi, sec, card, head, gradeChip, plink, pmeta, prospectTable, est, sample, bar, POS_NAME } from "./ui.js";
import { POS } from "./data.js";
import { rng } from "../model.js";

export function periodOn(d) { return S().compliance.periods.find(([a, b]) => d >= a && d <= b) || null; }
export function contactCheck(p, type, date) {
  const st = S(), per = periodOn(date), P = prog();
  if (!per) return { ok: true, why: "No period set for this date (sample calendar)" };
  const allowed = st.compliance.rules[per[2]].includes(type);
  const logs = P.contactsLog.filter((x) => x.pid === p.id);
  const evals = logs.filter((x) => x.type === "evaluation" && periodOn(x.date)?.[0] === per[0]).length;
  const inperson = logs.filter((x) => ["in_person", "home_visit"].includes(x.type)).length;
  if (!allowed) return { ok: false, why: `${type.replace(/_/g, " ")} is not allowed during a ${per[2]} period (sample calendar)`, per };
  if (type === "evaluation" && evals >= st.compliance.limits.evaluations_per_period) return { ok: false, why: `Evaluation limit reached (${evals}/${st.compliance.limits.evaluations_per_period} this period, sample limit)`, per };
  if (["in_person", "home_visit"].includes(type) && inperson >= st.compliance.limits.in_person_per_year) return { ok: false, why: `In-person limit reached (${inperson}/${st.compliance.limits.in_person_per_year}, sample limit)`, per };
  return { ok: true, why: `Allowed in ${per[2]} period`, per };
}

// ---------- roster needs ----------
export function rosterModel() {
  const P = prog(), st = S();
  if (!P.roster) {
    const R = rng(P.settings.program.length * 97 + 11);
    P.roster = Object.fromEntries(POS.map((pos) => { const t = st.roster_targets[pos]; const yrs = ["FR", "SO", "JR", "SR", "GR"].map(() => Math.max(0, Math.round(t / 4.6 + R.n() * 0.9))); const starters = Math.max(1, Math.round(t / 3.5)); return [pos, { yrs, startersBack: Math.max(0, starters - Math.round(R.u() * 2)), starters }]; }));
  }
  return POS.map((pos) => {
    const r = P.roster[pos], cur = r.yrs.reduce((a, b) => a + b, 0), leaving = r.yrs[3] + r.yrs[4];
    const ret = cur - leaving, attr = +(ret * st.attrition.transfer_out_rate).toFixed(1);
    const signees = all().filter((p) => p.pos === pos && (p.stage === "Committed" || p.stage === "Signed") && p.cls === 2027).length;
    const target = st.roster_targets[pos], proj = ret - attr + signees, gap = +(target - proj).toFixed(1);
    return { pos, cur, leaving, ret, attr, signees, target, proj: +proj.toFixed(1), gap, startersBack: r.startersBack, starters: r.starters, need: Math.max(0, gap) };
  });
}
export function pageRoster() {
  const rows = rosterModel(), open = rows.filter((r) => r.gap > 0.5);
  return head("Roster Needs by Season", "2027 season: returning players, expected attrition, incoming signees, the gap at each position and starters back.", sample) +
    `<div class="kpis">${kpi("Open needs", open.length, "positions short of target")}${kpi("Gap", open.reduce((s, r) => s + r.gap, 0).toFixed(1), "players short, total")}${kpi("Signees", rows.reduce((s, r) => s + r.signees, 0), "2027 commitments")}${kpi("Starters back", rows.reduce((s, r) => s + r.startersBack, 0) + "/" + rows.reduce((s, r) => s + r.starters, 0), "projected")}</div>
    <section class="card"><div class="scroll-x"><table class="t"><thead><tr><th>Pos</th><th class="n">Now</th><th class="n">Leaving</th><th class="n">Returning</th><th class="n">Exp. attrition</th><th class="n">Signees</th><th class="n">Projected</th><th class="n">Target</th><th class="n">Gap</th><th class="n">Starters back</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td><b>${r.pos}</b></td><td class="n">${r.cur}</td><td class="n">${r.leaving}</td><td class="n">${r.ret}</td><td class="n">−${r.attr}</td><td class="n">${r.signees}</td><td class="n">${r.proj}</td><td class="n">${r.target}</td><td class="n ${r.gap > 0.5 ? "neg" : "pos"}"><b>${r.gap > 0 ? "+" : ""}${r.gap}</b></td><td class="n">${r.startersBack}/${r.starters}</td></tr>`).join("")}
    </tbody></table></div><p class="note" style="padding:8px 16px 12px">Projected = returning − returning × ${S().attrition.transfer_out_rate} expected transfer-out rate + signees. Targets and the attrition rate are program settings. Roster counts are synthetic.</p></section>`;
}

// ---------- budget ----------
export function budgetPlan() {
  const st = S(), need = Object.fromEntries(rosterModel().map((r) => [r.pos, r.need]));
  const cands = all().filter((p) => p.ask && p.stage !== "Committed" && G(p.id).c.status === "ok" && G(p.id).c.value > 0).map((p) => {
    const { c } = G(p.id), nw = need[p.pos] > 0 ? 1 + 0.35 * Math.min(3, need[p.pos]) : 0.4;
    return { p, c, nw, adjValue: c.value * nw, perK: (c.value * nw) / (p.ask / 1000) };
  }).sort((a, b) => b.perK - a.perK);
  let left = st.budget.pool_usd; const slots = { ...Object.fromEntries(Object.entries(need).map(([k, v]) => [k, Math.ceil(v) + 1])) }; const pick = [];
  for (const x of cands) { if (x.p.ask <= left && slots[x.p.pos] > 0) { pick.push(x); left -= x.p.ask; slots[x.p.pos]--; } }
  return { cands, pick, left, need };
}
export function pageBudget() {
  if (!can("budget")) return locked("Revenue-share budget plan", "General manager or admin");
  const b = budgetPlan(), st = S(), spent = st.budget.pool_usd - b.left, val = b.pick.reduce((s, x) => s + x.c.value, 0);
  return head("Revenue-Share Budget Plan", "Allocates the pool to buy the most value above replacement per dollar, weighted by position need. A planning aid, not an offer.", sample) +
    `<div class="callout sim" style="margin-bottom:14px">${esc(st.budget.note)}. Pool ${usd(st.budget.pool_usd)}. Portal Lab chances are never used to set pay.</div>
    <div class="kpis">${kpi("Planned", b.pick.length, "players")}${kpi("Spend", usdk(spent), "of " + usdk(st.budget.pool_usd))}${kpi("Value bought", val.toFixed(0), "points above replacement")}${kpi("Avg $/point", val ? usd(spent / val) : "—", "lower is better")}</div>
    <section class="card"><div class="card-h"><div><h3>Greedy allocation</h3><p>Sort by need-weighted value per $1,000; take each player if the pool and the position's open slots allow. Need weight = 1 + 0.35 × gap (max 3); positions without a gap get 0.4.</p></div></div>
    <div class="scroll-x"><table class="t"><thead><tr><th>#</th><th>Player</th><th class="n">CEG</th><th class="n">Value</th><th class="n">Need ×</th><th class="n">Ask</th><th class="n">Value / $1K</th><th>Plan</th></tr></thead><tbody>
    ${b.cands.slice(0, 40).map((x, i) => { const on = b.pick.includes(x); return `<tr class="${on ? "rp-okrow" : ""}"><td class="n">${i + 1}</td><td>${plink(x.p)}<div class="small dim">${pmeta(x.p)}</div></td><td class="n">${gradeChip(x.p.id)}</td><td class="n">${x.c.value.toFixed(1)}</td><td class="n">${x.nw.toFixed(2)}</td><td class="n">${usdk(x.p.ask)}</td><td class="n">${x.perK.toFixed(3)}</td><td>${on ? `<span class="badge b-ok">Fund</span>` : `<span class="dim small">${x.p.ask > b.left ? "Over pool" : "Slot filled"}</span>`}</td></tr>`; }).join("")}
    </tbody></table></div></section>`;
}
function locked(t, who) { return head(t, "Restricted by role.") + `<div class="card card-pad"><p>This screen is visible to the ${who} only. You are signed in as <b>${RP.role}</b> (demo sign-in).</p><div class="row-btns"><button class="btn primary" data-rpa="role" data-id="GM">Switch to General manager (demo)</button></div></div>`; }

// ---------- FMV ----------
export function fmvRows() {
  const st = S(), list = all().filter((p) => p.ask && G(p.id).c.value > 0 && G(p.id).c.status === "ok");
  const k = list.reduce((s, p) => s + p.ask * G(p.id).c.value, 0) / list.reduce((s, p) => s + G(p.id).c.value ** 2, 0); // fit through origin
  return { k, rows: list.map((p) => { const fair = k * G(p.id).c.value, ratio = p.ask / fair; return { p, fair, ratio, flag: ratio > st.fmv.high_ratio ? "high" : ratio < st.fmv.low_ratio ? "low" : "" }; }).sort((a, b) => Math.abs(Math.log(b.ratio)) - Math.abs(Math.log(a.ratio))) };
}
export function pageFMV() {
  if (!can("fmv")) return locked("Fair-Market-Value Review", "general manager");
  const f = fmvRows(), st = S(), flagged = f.rows.filter((r) => r.flag);
  return head("Fair-Market-Value Review", "Flags asks that are outliers against value above replacement. Visible to the general manager only.", sample) +
    `<div class="kpis">${kpi("Reviewed", f.rows.length, "asks on file")}${kpi("Flagged high", flagged.filter((r) => r.flag === "high").length, `ask > ${st.fmv.high_ratio}× fair`)}${kpi("Flagged low", flagged.filter((r) => r.flag === "low").length, `ask < ${st.fmv.low_ratio}× fair`)}${kpi("Market rate", usd(f.k), "per value point (fit)")}</div>
    <section class="card"><div class="card-h"><div><h3>Outliers first</h3><p>Fair value = ${usd(f.k)} × value points, fitted through the origin across all asks on file. An outlier is a question for the GM, not a decision.</p></div></div><div class="scroll-x"><table class="t"><thead><tr><th>Player</th><th class="n">Value</th><th class="n">Ask</th><th class="n">Fair (fit)</th><th class="n">Ratio</th><th>Flag</th></tr></thead><tbody>
    ${f.rows.slice(0, 30).map((r) => `<tr><td>${plink(r.p)}<div class="small dim">${pmeta(r.p)}</div></td><td class="n">${G(r.p.id).c.value.toFixed(1)}</td><td class="n">${usdk(r.p.ask)}</td><td class="n">${usdk(r.fair)}</td><td class="n">${r.ratio.toFixed(2)}×</td><td>${r.flag === "high" ? `<span class="badge b-flag">Above value</span>` : r.flag === "low" ? `<span class="badge b-hypothesis">Below value</span>` : `<span class="dim small">In range</span>`}</td></tr>`).join("")}
    </tbody></table></div></section>`;
}

// ---------- likelihood ----------
export function pageLikely() {
  const list = all().filter((p) => p.cls === 2027 && ["Offered", "Visited", "Committed"].includes(p.stage)).sort((a, b) => G(b.id).L.p - G(a.id).L.p);
  const L = S().likelihood;
  return head("Commitment Likelihood", "An estimated chance each target commits, from contacts, visits, distance, rival activity and history. Labeled as an estimate and recalibrated each year.", est) +
    `<div class="grid g-side"><section class="card">${prospectTable(list, { cols: ["grade", "stage", "dist", "urg", "like"], limit: 40 })}</section>
    ${card("Model (starting values)", esc(L.note), `<table class="t"><tbody>${Object.entries(L).filter(([k]) => k !== "note").map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, " "))}</td><td class="n">${v > 0 ? "+" : ""}${v}</td></tr>`).join("")}</tbody></table><p class="note">Contacts scaled 0–1 over 12; unofficial visits capped at 3; rival offers capped at 6. See Annual Validation for the recalibration check.</p>`)}</div>`;
}

// ---------- compliance ----------
export function pageCompliance() {
  const st = S(), P = prog(), today = "2026-11-04", cur = periodOn(today);
  const flags = P.prospects.map((p) => { const lg = P.contactsLog.filter((x) => x.pid === p.id); return { p, n: lg.length, ov: lg.filter((x) => x.override).length, ev: lg.filter((x) => x.type === "evaluation").length }; }).filter((x) => x.n);
  return head("Compliance Calendar & Contact Guard", "Contacts outside what the current recruiting period allows are blocked unless a coordinator overrides with a reason.", `<span class="badge b-flag">Sample dates</span>`) +
    `<div class="callout sim" style="margin-bottom:14px">${esc(st.compliance.note)} Limits shown are sample settings, not NCAA rules.</div>
    <div class="kpis">${kpi("Today", cur ? cur[2] : "—", "period on Nov 4, 2026 (sample)")}${kpi("Contacts logged", P.contactsLog.length, "this session")}${kpi("Overrides", P.contactsLog.filter((x) => x.override).length, "with coordinator reasons")}${kpi("Blocked", P.blocked || 0, "attempts stopped by the guard")}</div>
    <div class="grid g2">${card("Sample calendar", "What each period allows", `<table class="t"><thead><tr><th>From</th><th>To</th><th>Period</th><th>Allowed</th></tr></thead><tbody>${st.compliance.periods.map(([a, b, k]) => `<tr class="${cur && cur[0] === a ? "rp-okrow" : ""}"><td class="mono">${a}</td><td class="mono">${b}</td><td><b>${k}</b></td><td class="small">${st.compliance.rules[k].join(", ").replace(/_/g, " ")}</td></tr>`).join("")}</tbody></table>`)}
    ${card("Per-player counts & flags", "Shown on the recruiting director's dashboard", flags.length ? `<table class="t"><thead><tr><th>Player</th><th class="n">Contacts</th><th class="n">Evals</th><th>Flags</th></tr></thead><tbody>${flags.map((x) => `<tr><td>${plink(x.p)}</td><td class="n">${x.n}</td><td class="n">${x.ev}</td><td>${x.ov ? `<span class="badge b-flag">${x.ov} override</span>` : `<span class="dim small">None</span>`}</td></tr>`).join("")}</tbody></table>` : `<p class="note">No contacts logged yet. Open a player, choose "Contacts & pipeline" and try an in-person contact on Nov 4 (Evaluation period) to see the guard block it.</p>`)}</div>
    ${sec("Blocked and override log")}<section class="card card-pad">${(P.guardLog || []).map((g) => `<div class="rp-logrow"><span class="mono">${g.ts.slice(11, 19)}</span> ${g.ok ? `<span class="badge b-flag">Override</span>` : `<span class="badge b-bad">Blocked</span>`} ${esc(g.name)} · ${esc(g.why)}${g.reason ? ` · reason: “${esc(g.reason)}” (${esc(g.role)})` : ""}</div>`).join("") || `<p class="note">Nothing blocked yet.</p>`}</section>`;
}

// ---------- camps ----------
export function pageCamps() {
  const q = queue.list(), P = prog();
  return head("Camps: Check-in & Laser Testing", "Phone-based check-in and laser-timed testing. Results become verified data on the player's profile. Works offline and syncs later.", sample) +
    `<div class="kpis">${kpi("Connection", online() ? "Online" : "Offline", RP.offlineSim ? "simulated offline" : "browser status")}${kpi("Queued", q.length, "held on this device until sync (memory only in this preview)")}${kpi("Verified today", (P.campDone || []).length, "results applied")}</div>
    <div class="grid g2">${card("Check in a camper", "Collect only what recruiting needs; most campers are minors", can("camp") ? `<div class="rp-form">
      <div class="field"><label for="cp-name">Name</label><input id="cp-name" maxlength="60"/></div>
      <div class="field"><label for="cp-pos">Position</label><select id="cp-pos">${POS.map((p) => `<option>${p}</option>`).join("")}</select></div>
      <div class="field"><label for="cp-cls">Class</label><select id="cp-cls"><option>2027</option><option selected>2028</option><option>2029</option></select></div>
      <div class="field"><label for="cp-st">State</label><input id="cp-st" maxlength="2" value="OH"/></div>
      <div class="field"><label for="cp-40">Laser 40 (s)</label><input id="cp-40" type="number" step="0.01" min="4" max="6.5" value="4.62"/></div>
      <div class="field"><label for="cp-vert">Vertical (in)</label><input id="cp-vert" type="number" step="0.5" min="10" max="48" value="32"/></div></div>
      <label class="small"><input type="checkbox" id="cp-consent"/> Parent/guardian consent recorded for a minor</label>
      <div class="row-btns"><button class="btn primary" data-rpa="camp-add">Save result</button><button class="btn" data-rpa="offline">${RP.offlineSim ? "Go back online" : "Simulate no signal"}</button><button class="btn fz" data-rpa="sync" ${q.length ? "" : "disabled"}>Sync ${q.length} now</button></div>` : `<p class="note">Your role cannot check in campers.</p>`)}
    ${card("Queue on this device", "Only queued camp results and contact logs are stored on the phone; player data is never cached", q.length ? `<table class="t"><tbody>${q.map((x) => `<tr><td class="mono">${x.queuedAt.slice(11, 19)}</td><td>${esc(x.kind)}</td><td>${esc(x.name || x.pid || "")}</td><td class="small dim">${esc(x.detail || "")}</td></tr>`).join("")}</tbody></table>` : `<p class="note">Queue is empty.</p>`)}</div>`;
}

// ---------- Monday brief ----------
export function briefText() {
  const P = prog(), st = S(), top = all().filter((p) => p.cls === 2027 && p.stage !== "Committed").sort((a, b) => G(b.id).c.grade - G(a.id).c.grade).slice(0, 5);
  const commits = all().filter((p) => p.cls === 2027 && p.stage === "Committed").length, needs = rosterModel().filter((r) => r.gap > 0.5);
  const alerts = P.alerts.slice(0, 6).map((a) => `- ${byId(a.pid)?.name}: ${a.kind} (${a.school}), ${a.ts} [${a.source}]`).join("\n");
  return `MONDAY RECRUITING BRIEF — ${st.name} — DRAFT, NOT SENT\nWeek of Nov 2, 2026 · sample data\n\nCLASS: ${commits} commitments in 2027. Open needs: ${needs.map((r) => `${r.pos} (${r.gap})`).join(", ") || "none"}.\n\nTOP UNCOMMITTED TARGETS (CEG):\n${top.map((p) => `- ${p.name}, ${p.pos}, ${p.state}: CEG ${G(p.id).c.grade.toFixed(2)} (${G(p.id).c.tier}), commit estimate ${pct(G(p.id).L.p)}`).join("\n")}\n\nRIVAL MOVES:\n${alerts || "- none"}\n\nGRADING: ${all().filter((p) => G(p.id).c.status === "third").length} players held for a third look; ${all().filter((p) => G(p.id).c.status === "medical").length} medical holds.\nCOMPLIANCE: ${P.contactsLog.filter((x) => x.override).length} overrides this week; ${P.blocked || 0} blocked attempts. Calendar uses SAMPLE dates.\nAUTOMATION: ${P.runs.length} worker runs; ${P.audit.filter((a) => a.kind === "auto").length} automatic changes logged with sources; staff entries untouched.`;
}
export function pageBrief() {
  return head("Monday Recruiting Brief", "A weekly summary of what changed. Drafted automatically; sending requires approval.", `<span class="badge b-hypothesis">Draft</span>`) +
    `<div class="grid g-side"><section class="card card-pad"><textarea id="brief-txt" class="rp-brief" aria-label="Brief draft">${esc(briefText())}</textarea><div class="row-btns"><button class="btn" data-rpa="brief-copy">Copy draft</button><button class="btn primary" data-rpa="brief-send">Request approval to send</button></div></section>
    ${card("Sending", "Nothing leaves this app without approval", `<p class="small">In production the worker emails the brief to the staff list every Monday after the recruiting director approves it. This demo has no email connection: "Request approval" records the request in the audit log and does not send anything.</p>`)}</div>`;
}
