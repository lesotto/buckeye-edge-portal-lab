import { RP, prog, S, G, all, byId, can, urgency, queue } from "./store.js";
import { statusLabel } from "./ceg.js";
import { esc, usd, usdk, htf, pct, kpi, sec, card, head, gradeChip, plink, pmeta, prospectTable, est, sample, POS_NAME, bar } from "./ui.js";
import { POS, PIPE } from "./data.js";
import { periodOn, contactCheck } from "./pages_plan.js";

export const UI = { bf: { pos: "all", type: "all", cls: "all", tier: "all", sort: "grade" }, ptab: "ceg" };

export function pageBoard() {
  const f = UI.bf;
  let list = all().filter((p) => (f.pos === "all" || p.pos === f.pos) && (f.type === "all" || (f.type === "transfer" ? p.type === "transfer" : p.type === "hs" && String(p.cls) === f.type)) && (f.tier === "all" || G(p.id).c.tier === f.tier));
  const key = { grade: (p) => -G(p.id).c.grade, like: (p) => -G(p.id).L.p, urg: (p) => -urgency(p), value: (p) => -G(p.id).c.value, dist: (p) => p.dist }[f.sort];
  list = list.slice().sort((a, b) => key(a) - key(b));
  const sel = (id, opts, v) => `<select data-rpi="bf" data-k="${id}">${opts.map(([k, l]) => `<option value="${k}" ${String(v) === k ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  const holds = list.filter((p) => G(p.id).c.status === "third").length, med = list.filter((p) => G(p.id).c.status === "medical").length, flags = list.filter((p) => G(p.id).c.gapFlag).length;
  return head("National Board", "Every prospect and transfer graded the same way on the 1–9 Composite Evaluation Grade (CEG). Click a name for the full calculation.", sample) +
    `<div class="kpis">${kpi("Players", list.length, "matching filters")}${kpi("Third looks", holds, "graders disagree beyond margin")}${kpi("Medical holds", med, "hold, not a number")}${kpi("Industry gaps", flags, "≥1.5 vs industry rating")}</div>
    <section class="card"><div class="card-h"><div class="filters">
      <div class="field"><label>Position</label>${sel("pos", [["all", "All"], ...POS.map((p) => [p, p])], f.pos)}</div>
      <div class="field"><label>Group</label>${sel("type", [["all", "All"], ["2027", "HS 2027"], ["2028", "HS 2028"], ["2029", "HS 2029"], ["transfer", "Transfers"]], f.type)}</div>
      <div class="field"><label>Tier</label>${sel("tier", [["all", "All"], ...S().tiers.map((t) => [t[1], t[1]])], f.tier)}</div>
      <div class="field"><label>Sort</label>${sel("sort", [["grade", "CEG"], ["value", "Value above replacement"], ["like", "Commit estimate"], ["urg", "Rival urgency"], ["dist", "Distance"]], f.sort)}</div>
    </div></div>${prospectTable(list, { cols: ["grade", "tier", "stage", "value", "like", "urg"], limit: 60 })}<p class="note" style="padding:0 16px 12px">Showing up to 60. Commit estimate and urgency are estimates; neither changes the grade.</p></section>`;
}

function clipsFor(p) { // film clips tied to traits (synthetic ids)
  return p.traits.slice(0, 4).map((t, i) => ({ id: `${p.id}-C${i + 1}`, trait: t.t, label: ["vs. top opponent, Q2", "4th-quarter drive", "red-zone snap", "two-minute drill"][i], src: "Film platform (licensed, sample)" }));
}
export function profileSeries(p) { // position profile: season totals, per game, trend, big games
  const games = 10, base = Math.max(1, p.prodRaw) * ({ QB: 26, RB: 13, WR: 9, TE: 5, EDGE: 0.13, DT: 0.18, LB: 1.0, CB: 0.12, S: 0.9, OT: -0.35, IOL: -0.3 }[p.pos] || 1);
  const g = Array.from({ length: games }, (_, i) => Math.max(0, +(Math.abs(base) * (0.75 + 0.5 * Math.abs(Math.sin(p.id.charCodeAt(3) + i * 1.7)) + 0.03 * i)).toFixed(1)));
  const tot = g.reduce((a, b) => a + b, 0), per = tot / games, big = g.map((v, i) => [v, i]).filter(([v]) => v > per * 1.3).map(([, i]) => i + 1);
  return { g, tot, per, trend: g.slice(-3).reduce((a, b) => a + b, 0) / 3 - g.slice(0, 3).reduce((a, b) => a + b, 0) / 3, big };
}

export function pageProspect(id) {
  const P = prog(), p = byId(id) || all()[0], { c, L } = G(p.id), st = S();
  const W = c.W, ev = P.activity.filter((e) => e.pid === p.id);
  const pill = c.status !== "ok" ? `<span class="badge ${c.status === "medical" ? "b-bad" : "b-hypothesis"}">${statusLabel(c)}</span>` : "";
  const top = `<div class="rp-ph"><div class="rp-ph-l"><div class="eyebrow">${POS_NAME[p.pos]} · ${p.type === "transfer" ? "Transfer from " + esc(p.school) + " (" + p.level + ")" : esc(p.school) + " · " + p.level + " · Class of " + p.cls}</div>
    <h1 class="page-title">${esc(p.name)}</h1><p class="page-desc">${esc(p.state)} · ${htf(p.ht)}, ${p.wt} lb · ${p.dist.toLocaleString()} mi from campus (estimate from state center) · Territory ${p.terr} · ${esc(p.stage)} ${pill}</p>
    <div class="row-btns"><button class="btn sm" data-rpa="watch" data-id="${p.id}">${P.watch.has(p.id) ? "On watchlist" : "Add to watchlist"}</button><button class="btn sm" data-rpa="go" data-id="similar/${p.id}">Players like this one</button>${can("contact") ? `<button class="btn sm" data-rpa="ptab" data-id="contact">Log a contact</button>` : ""}</div></div>
    <div class="rp-bigg">${gradeChip(p.id)}<div class="small dim">${c.status === "medical" ? "Medical hold" : `${esc(c.tier)} · ${c.lo.toFixed(2)}–${c.hi.toFixed(2)}`}<br/>${c.conf} confidence (±${c.band})</div></div></div>`;
  const tabs = [["ceg", "CEG calculation"], ["traits", "Trait grades & film"], ["profile", "Position profile"], ["activity", "Who's recruiting him"], ["contact", "Contacts & pipeline"]];
  const tabBar = `<div class="tabs">${tabs.map(([k, l]) => `<button data-rpa="ptab" data-id="${k}" class="${UI.ptab === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
  let body = "";
  if (UI.ptab === "ceg") {
    const rows = [["Film", c.film.score, W.film, c.film.score === null ? "No film grade yet — weight redistributed" : `Mean of ${c.film.rows.length} traits (critical traits ×1.5)${c.film.twoGraders ? ", two graders" : ", one grader"}`],
      ["Production", c.prod.score, W.production, `${c.prod.raw} raw − ${c.prod.penalty} level discount (${p.level}) = ${c.prod.adj}; × ${c.prod.shrinkW} sample weight (${p.snaps}/${st.production.full_credit_snaps} snaps) toward 5.0`],
      ["Athletic testing", c.test.score, W.testing, `40: ${p.forty.toFixed(2)} ${c.test.src}${c.test.corr ? ` + ${c.test.corr} hand-time correction = ${c.test.forty.toFixed(2)}` : ""}${c.test.credit < 1 ? ` · self-reported, counted at ${c.test.credit * 100}%` : c.test.verified ? " · verified, full credit" : ""}; vertical ${p.vert}", shuttle ${p.shuttle}`],
      ["Character", c.ch, W.character, c.ch === null ? "Not graded yet — weight redistributed" : "Staff interview and references grade"]];
    const have = rows.filter((r) => r[1] !== null), ws = have.reduce((s, r) => s + r[2], 0);
    body = `<div class="grid g-side"><section class="card card-pad"><div class="card-h"><div><h3>How the ${c.grade.toFixed(2)} was built</h3><p>${p.type === "transfer" ? "Transfer" : "High school"} weights ${W.film}/${W.production}/${W.testing}/${W.character}. Same rules for every player.</p></div></div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Pillar</th><th class="n">Score</th><th class="n">Weight</th><th class="n">Contribution</th><th>How</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><b>${r[0]}</b></td><td class="n">${r[1] === null ? "—" : r[1].toFixed(2)}</td><td class="n">${r[1] === null ? "—" : ((100 * r[2]) / ws).toFixed(1) + "%"}</td><td class="n">${r[1] === null ? "—" : ((r[1] * r[2]) / ws).toFixed(2)}</td><td class="small">${esc(r[3])}</td></tr>`).join("")}
      <tr><td><b>Weighted base</b></td><td class="n" colspan="3">${c.base.toFixed(2)}</td><td></td></tr>
      <tr><td>Availability</td><td class="n" colspan="3">−${c.availPen.toFixed(2)}</td><td class="small">${p.missed} games missed × ${st.availability.per_game_missed} (max ${st.availability.max_penalty})${p.serious ? " · serious medical issue → hold" : ""}</td></tr>
      ${c.ceiling ? `<tr><td>Critical-trait ceiling</td><td class="n" colspan="3">≤ ${c.ceiling}</td><td class="small">Below ${st.critical_minimum} on: ${esc(c.film.missCrit.join(", "))}</td></tr>` : ""}
      <tr><td><b>CEG</b></td><td class="n" colspan="3"><b>${c.grade.toFixed(2)}</b></td><td class="small">Band ±${c.band} (${c.conf}: ${esc(c.why.join(", "))})</td></tr></tbody></table></div></section>
      <div class="grid" style="align-content:start">${card("Value above replacement", "Weighted by position; cost per point from the player's ask", `<div class="rp-calc">max(0, ${c.grade.toFixed(2)} − ${c.repl.toFixed(1)}) × ${c.pw} position weight × ${st.var.points_per_grade} = <b>${c.value.toFixed(1)}</b><br/>${p.ask ? `Ask ${usd(p.ask)} ÷ ${c.value.toFixed(1)} = <b>${c.cpp ? usd(c.cpp) + " per point" : "no value above replacement"}</b>` : "No ask on file"}</div><p class="note">Replacement level, weights and points per grade are program settings, not fixed constants.</p>`)}
      ${card("Industry comparison", p.industry.source, `<div class="rp-calc">${p.industry.stars}★ · ${p.industry.rating.toFixed(3)} → CEG-equivalent ${c.indEq.toFixed(2)}<br/>Gap ${c.gap > 0 ? "+" : ""}${c.gap.toFixed(2)} ${c.gapFlag ? `<span class="badge b-flag">Second look</span>` : `<span class="badge b-ok">Within ${st.industry_gap_flag}</span>`}</div>`)}
      ${card("Commitment likelihood " + est, "From contacts, visits, distance, rival activity and history", `<div class="rp-calc">${L.parts.filter((x) => x[1]).map((x) => `${esc(x[0])} ${x[1] >= 0 ? "+" : ""}${x[1].toFixed(2)}`).join("<br/>")}<br/>logit ${L.z.toFixed(2)} → <b>${pct(L.p)}</b></div><p class="note">Practitioner starting values, recalibrated annually. Never changes the grade.</p>`)}</div></div>`;
  }
  if (UI.ptab === "traits") {
    const defs = st.traits[p.pos], third = P.third[p.id] || {};
    const opt = (v, k, i) => can("grade") ? `<select data-rpi="trait" data-id="${p.id}" data-i="${i}" data-k="${k}" aria-label="${k} grade"><option value="">—</option>${Array.from({ length: 17 }, (_, j) => 1 + j / 2).map((x) => `<option ${x === v ? "selected" : ""}>${x}</option>`).join("")}</select>` : (v ?? "—");
    const clips = clipsFor(p);
    body = `<div class="grid g-side"><section class="card"><div class="card-h"><div><h3>${POS_NAME[p.pos]} trait grades</h3><p>Two graders per trait. A gap above ${st.two_grader.trait_margin} on any trait, or above ${st.two_grader.mean_margin} on the mean, holds the grade for a third look. Critical traits (★) below ${st.critical_minimum} cap the grade at ${st.critical_ceiling}.</p></div></div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Trait</th><th>Grader 1</th><th>Grader 2</th><th class="n">Gap</th><th>Third look</th><th class="n">Used</th></tr></thead><tbody>
      ${c.film.rows.map((r, i) => `<tr class="${r.gap > st.two_grader.trait_margin && r.g3 === undefined ? "rp-warnrow" : ""}"><td>${defs[i][1] ? "★ " : ""}${esc(r.t)}${P.staffLocked[p.id + ":" + i] ? ` <span class="badge b-staff">Staff entry</span>` : ""}</td><td>${opt(r.g1, "g1", i)}</td><td>${opt(r.g2, "g2", i)}</td><td class="n">${r.g1 !== null && r.g2 !== null ? r.gap.toFixed(1) : "—"}</td><td>${r.gap > st.two_grader.trait_margin || third[i] !== undefined ? (can("grade") ? `<select data-rpi="third" data-id="${p.id}" data-i="${i}" aria-label="Third look"><option value="">Pending</option>${Array.from({ length: 17 }, (_, j) => 1 + j / 2).map((x) => `<option ${x === third[i] ? "selected" : ""}>${x}</option>`).join("")}</select>` : third[i] ?? "Pending") : `<span class="dim">—</span>`}</td><td class="n">${r.val === null || r.val === undefined ? "—" : r.val.toFixed(2)}</td></tr>`).join("")}
      </tbody></table></div><p class="note" style="padding:0 16px 12px">Film pillar ${c.film.score === null ? "—" : c.film.score.toFixed(2)} · mean gap between graders ${c.film.meanGap ?? 0}. ${can("grade") ? "Changing a grade re-scores the player immediately and is logged as a staff entry that automation will never overwrite." : "Your role can view grades but not change them."}</p></section>
      ${card("Film clips tied to traits", "Each clip supports a specific trait grade", clips.map((k) => `<div class="rp-clip"><div class="rp-clip-th" aria-hidden="true">▶</div><div><b>${esc(k.trait)}</b><div class="small dim">${esc(k.label)} · ${k.id}</div><div class="small dim">${esc(k.src)}</div></div></div>`).join("") + `<p class="note">Clips are references into the licensed film platform; nothing is copied into this app.</p>`)}</div>`;
  }
  if (UI.ptab === "profile") {
    const s = profileSeries(p), mx = Math.max(...s.g);
    body = `<div class="grid g2">${card(`Position profile · ${esc(p.prodStat)}`, "Rebuilt by the automation worker from licensed stats feeds (sample)", `<div class="kpis">${kpi("Season", s.tot.toFixed(0), p.prodStat)}${kpi("Per game", s.per.toFixed(1), "10 games")}${kpi("Trend", (s.trend >= 0 ? "+" : "") + s.trend.toFixed(1), "last 3 vs first 3")}${kpi("Big games", s.big.length, s.big.length ? "weeks " + s.big.join(", ") : "none")}</div><div class="rp-spark">${s.g.map((v, i) => `<div title="Week ${i + 1}: ${v}"><i style="height:${(100 * v) / (mx || 1)}%" class="${s.big.includes(i + 1) ? "big" : ""}"></i><span>${i + 1}</span></div>`).join("")}</div>`)}
      ${card("Measurables", "Source decides how much each number counts", `<table class="t"><tbody><tr><td>Height / weight</td><td class="n">${htf(p.ht)} / ${p.wt}</td></tr><tr><td>40-yard dash</td><td class="n">${p.forty.toFixed(2)} (${p.fortySrc}${p.fortySrc === "hand" ? `, corrected ${(p.forty + 0.24).toFixed(2)}` : ""})</td></tr><tr><td>Vertical</td><td class="n">${p.vert}"</td></tr><tr><td>Shuttle</td><td class="n">${p.shuttle.toFixed(2)}</td></tr><tr><td>Snaps (last season)</td><td class="n">${p.snaps}</td></tr><tr><td>Games missed (2 seasons)</td><td class="n">${p.missed}</td></tr><tr><td>Production grade (raw)</td><td class="n">${can("grade") ? `<select data-rpi="prod" data-id="${p.id}" aria-label="Staff production grade">${Array.from({ length: 17 }, (_, j) => 1 + j / 2).map((x) => `<option ${Math.abs(x - p.prodRaw) < 0.26 ? "selected" : ""}>${x}</option>`).join("")}</select>` : p.prodRaw}${P.staffLocked[p.id + ":prod"] ? ` <span class="badge b-staff">Staff entry</span>` : P.suggested[p.id] ? ` <span class="badge b-estimate">Worker suggestion</span>` : ""}</td></tr></tbody></table><p class="note">Laser or camp-verified times count in full; self-reported counts at ${st.measurables.self_reported_credit * 100}%; hand-timed 40s add ${st.measurables.hand_timed_correction}s.</p>`)}</div>`;
  }
  if (UI.ptab === "activity") {
    const u = urgency(p);
    body = `<div class="grid g-side">${card("Who's recruiting him", `Urgency ${u}/100 · informs urgency, never changes the grade`, `<div class="scroll-x"><table class="t"><thead><tr><th>Date</th><th>School</th><th>Event</th><th>Source</th></tr></thead><tbody>${ev.map((e) => `<tr><td class="mono">${e.date}</td><td>${esc(e.school)}</td><td>${esc(e.kind)}</td><td class="small dim">${esc(e.source)}</td></tr>`).join("") || `<tr><td colspan="4" class="dim">No rival activity recorded.</td></tr>`}</tbody></table></div>`)}
      ${card("Urgency score", "How it is computed", `<div class="rp-calc">10 × ${p.offers.length} offers + 14 × ${ev.filter((e) => e.date >= "2026-10-01").length} events since Oct 1 + 18 × ${ev.filter((e) => /official/.test(e.kind)).length} official visits elsewhere${ev.some((e) => /commitment elsewhere/.test(e.kind)) ? " + 30 (committed elsewhere)" : ""} = <b>${u}</b> (cap 100)</div><p class="note">Fictional rival schools. Activity comes from licensed recruiting data or the news scanner.</p>`)}</div>`;
  }
  if (UI.ptab === "contact") {
    const log = P.contactsLog.filter((x) => x.pid === p.id);
    const per = periodOn(UI.cdate || "2026-11-04");
    body = `<div class="grid g2">${card("Log a contact", `Compliance guard checks the recruiting period. ${esc(st.compliance.note)}`, can("contact") || can("override") ? `<div class="rp-form">
      <div class="field"><label for="ct-date">Date</label><input id="ct-date" type="date" value="${UI.cdate || "2026-11-04"}" data-rpi="cdate"/></div>
      <div class="field"><label for="ct-type">Type</label><select id="ct-type">${[["phone", "Phone / text"], ["in_person", "In-person, off campus"], ["home_visit", "Home visit"], ["evaluation", "Evaluation (watch practice/game)"], ["campus_visit", "Campus visit"]].map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
      <div class="field" style="grid-column:1/-1"><label for="ct-note">Note</label><input id="ct-note" maxlength="140" placeholder="Short note (no medical or family details)"/></div>
      <div class="field" style="grid-column:1/-1"><label for="ct-why">Override reason (coordinator only)</label><input id="ct-why" maxlength="140" placeholder="Required only to override a block" ${can("override") ? "" : "disabled"}/></div></div>
      <p class="small">Period on ${esc(UI.cdate || "2026-11-04")}: <b>${per ? per[2] : "None set"}</b> (sample) · allowed: ${per ? st.compliance.rules[per[2]].join(", ").replace(/_/g, " ") : "—"}</p>
      <div class="row-btns"><button class="btn primary" data-rpa="contact" data-id="${p.id}">Log contact</button><span class="small dim">${RP.role === "Coordinator" ? "You can override a block with a reason." : "Overrides need the Coordinator role."}</span></div>` : `<p class="note">Your role cannot log contacts.</p>`)}
      ${card("Contact log & pipeline history", `${p.contacts} prior contacts on file`, `<table class="t"><tbody>${log.map((x) => `<tr><td class="mono">${x.date}</td><td>${esc(x.type.replace(/_/g, " "))}</td><td>${x.override ? `<span class="badge b-flag">Override</span> ${esc(x.reason)}` : `<span class="badge b-ok">Allowed</span>`}${x.queued ? ` <span class="badge b-hypothesis">Queued offline</span>` : ""}</td></tr>`).join("")}${p.hist.map((h) => `<tr><td class="mono">${h.date}</td><td>Pipeline → ${esc(h.stage)}</td><td class="small dim">${esc(h.by)}</td></tr>`).join("")}</tbody></table>`)}</div>`;
  }
  return top + tabBar + body;
}
