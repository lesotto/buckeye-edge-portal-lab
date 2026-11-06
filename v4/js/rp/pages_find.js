import { RP, prog, S, G, all, byId, can, audit, api, bump, urgency, STATES } from "./store.js";
import { esc, usd, usdk, htf, pct, kpi, sec, card, head, gradeChip, plink, pmeta, prospectTable, est, sample, stateMap, bar, POS_NAME } from "./ui.js";
import { POS, POS_ALIASES, RIVALS, NEWS_SAMPLES, NORMS } from "./data.js";

export const FUI = { q: "6'1+ corners in the south under 4.6", mapSel: null, simId: null, news: NEWS_SAMPLES[0].text, newsSrc: NEWS_SAMPLES[0].src, scan: null, ai: null, aiBusy: false, actF: "all" };

// ---------- plain-English search ----------
export function parseQuery(q0) {
  const q = " " + q0.toLowerCase().replace(/[’`]/g, "'") + " ", F = [], X = [];
  const add = (fn, txt) => { F.push(fn); X.push(txt); };
  let m;
  if ((m = q.match(/(\d)\s*['-]\s*(\d{1,2})\s*("|'')?\s*(\+|or taller|and up)?/))) { const h = +m[1] * 12 + +m[2]; add((p) => p.ht >= h, `height ≥ ${m[1]}'${m[2]}"`); }
  const posHits = POS.filter((P) => POS_ALIASES[P].some((a) => new RegExp(`\\b${a}\\b`).test(q)));
  if (posHits.length) add((p) => posHits.includes(p.pos), `position: ${posHits.join(" or ")}`);
  if (/\bin[- ]state\b/.test(q)) { const hs = S().home_state; add((p) => p.state === hs, `in-state (${hs})`); }
  const sts = Object.entries(STATES).filter(([k, v]) => new RegExp(`\\b${v[0].toLowerCase()}\\b`).test(q) || new RegExp(`\\bin ${k.toLowerCase()}\\b`).test(q)).map(([k]) => k);
  if (sts.length) add((p) => sts.includes(p.state), `state: ${sts.join(", ")}`);
  const regs = ["midwest", "south", "west", "northeast"].filter((r) => q.includes(" " + r + " ") || q.includes(" the " + r));
  if (regs.length) add((p) => regs.includes(p.region.toLowerCase()), `region: ${regs.join(", ")}`);
  if ((m = q.match(/class of (20\d\d)|\b(20(?:27|28|29))\b/))) { const y = +(m[1] || m[2]); add((p) => p.cls === y && p.type === "hs", `HS class of ${y}`); }
  if (/\btransfers?\b|\bportal\b/.test(q)) add((p) => p.type === "transfer", "transfers only");
  if ((m = q.match(/(under|sub|below|faster than)\s*(4\.\d{1,2}|5\.\d{1,2})/))) { const t = +m[2]; add((p) => p.forty + (p.fortySrc === "hand" ? 0.24 : 0) < t, `40 under ${t} (hand times corrected +0.24)`); }
  if ((m = q.match(/(over|above|at least)\s*(\d{3})\s*(lb|lbs|pounds)/))) { const w = +m[2]; add((p) => p.wt >= w, `weight ≥ ${w}`); }
  if ((m = q.match(/within\s*(\d{2,4})\s*(mi|miles)/))) { const d = +m[1]; add((p) => p.dist <= d, `within ${d} miles (estimate from state centers)`); }
  if (/with film|has film|film on file/.test(q)) add((p) => p.film > 0, "has film clips");
  if (/likely to commit|likely commits?/.test(q)) add((p) => G(p.id).L.p >= 0.5, "commit estimate ≥ 50%");
  if (/verified/.test(q)) add((p) => ["laser", "camp"].includes(p.fortySrc), "verified 40 only");
  if (/blue[- ]chip/.test(q)) add((p) => G(p.id).c.grade >= 8, "CEG ≥ 8 (blue chip)");
  else if (/starters?\b/.test(q) && !/starters back/.test(q)) add((p) => G(p.id).c.grade >= 7, "CEG ≥ 7 (starter+)");
  if ((m = q.match(/(ceg|grade)\s*(over|above|>=?)\s*(\d(\.\d)?)/))) { const g = +m[3]; add((p) => G(p.id).c.grade >= g, `CEG ≥ ${g}`); }
  if (/uncommitted|not committed/.test(q)) add((p) => p.stage !== "Committed", "not committed");
  return { F, X };
}
export function runSearch(q) { const { F, X } = parseQuery(q); return { X, list: all().filter((p) => F.every((f) => f(p))).sort((a, b) => G(b.id).c.grade - G(a.id).c.grade) }; }

export function pageSearch() {
  const P = prog(), r = runSearch(FUI.q);
  const ex = ["corners in Georgia", "in-state edge rushers within 300 miles", "likely to commit", "transfers tackles over 290 lbs verified", "uncommitted receivers in the south"];
  return head("Plain-English Search", "Type the way a coach talks. The parser shows exactly how it read the request.", sample) +
    `<section class="card card-pad"><div class="rp-searchbar"><input id="q-in" value="${esc(FUI.q)}" aria-label="Search prospects" placeholder="e.g. in-state edge rushers within 300 miles"/><button class="btn primary" data-rpa="search">Search</button><button class="btn" data-rpa="save-search">Save search</button></div>
    <div class="rp-chips">${ex.map((e) => `<button class="btn sm" data-rpa="ex" data-id="${esc(e)}">${esc(e)}</button>`).join("")}</div>
    <p class="small" style="margin:10px 0 0">Read as: ${r.X.length ? r.X.map((x) => `<span class="rp-tag">${esc(x)}</span>`).join(" ") : `<span class="dim">no filters recognized — showing everyone</span>`} → <b>${r.list.length}</b> players</p></section>
    <div class="grid g-side" style="margin-top:14px"><section class="card">${prospectTable(r.list, { cols: ["grade", "tier", "stage", "dist", "like"], limit: 40 })}</section>
    <div class="grid" style="align-content:start">${card("Saved searches", "Alert when a new player matches", P.saved.length ? P.saved.map((s, i) => `<div class="rp-logrow"><button class="rp-plink" data-rpa="ex" data-id="${esc(s.q)}">${esc(s.q)}</button><div class="small dim">${s.n} matches when saved · ${runSearch(s.q).list.length} now${runSearch(s.q).list.length > s.n ? ` · <b class="neg">${runSearch(s.q).list.length - s.n} new</b>` : ""}</div></div>`).join("") : `<p class="note">None yet.</p>`)}
    ${card("Watchlist", "Players you are tracking", P.watch.size ? [...P.watch].map((id) => byId(id)).map((p) => `<div class="rp-logrow">${plink(p)} ${gradeChip(p.id)}<div class="small dim">${pmeta(p)}</div></div>`).join("") : `<p class="note">Add players from their profile.</p>`)}</div></div>`;
}

// ---------- map ----------
export function pageMap() {
  const counts = {}; all().forEach((p) => (counts[p.state] = (counts[p.state] || 0) + 1));
  const sel = FUI.mapSel, list = sel ? all().filter((p) => p.state === sel).sort((a, b) => G(b.id).c.grade - G(a.id).c.grade) : [];
  const terr = S().territories;
  return head("National Map", "Prospects by state. Click a state to drill in. Distances are from state centers (estimates) until ZIP centers are loaded.", sample) +
    `<div class="grid g-side"><section class="card card-pad">${stateMap(counts, sel)}<p class="note">Shade = number of tracked prospects.</p></section>
    <div class="grid" style="align-content:start">${card("Territories", "Area recruiter assignments", `<table class="t"><tbody>${terr.map((t) => `<tr><td><b>${t.id}</b></td><td>${esc(t.coach)}</td><td class="n">${all().filter((p) => p.terr === t.id).length}</td></tr>`).join("")}</tbody></table>`)}
    ${sel ? card(`${STATES[sel][0]} · ${list.length} prospects`, `${STATES[sel][6]} · ~${list[0]?.dist?.toLocaleString() ?? "—"} mi (estimate)`, prospectTable(list, { cols: ["grade", "stage"], limit: 15 })) : card("Pick a state", "", `<p class="note">Select any tile.</p>`)}</div></div>`;
}

// ---------- similar ----------
export function similar(p, n = 10) {
  const st = S(), N = NORMS[p.pos], vec = (x) => { const c = G(x.id).c; return [(x.ht - N[0]) / 1.6, (x.wt - N[1]) / (N[1] * 0.09), (N[2] - (x.forty + (x.fortySrc === "hand" ? 0.24 : 0))) / 0.14, (c.prod.score - 5) / 1.2, ((c.film.score ?? 5) - 5) / 1.0, (c.test.score - 5) / 1.2]; };
  const a = vec(p);
  return all().concat(prog().past).filter((x) => x.pos === p.pos && x.id !== p.id).map((x) => { const b = vec(x); const d = Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0)); return { x, d }; }).sort((u, v) => u.d - v.d).slice(0, n);
}
export function pageSimilar(id) {
  const p = byId(id || FUI.simId) || all().find((x) => x.pos === "CB");
  const s = similar(p);
  return head("Players Like This One", "Closest matches at the same position on size, testing, production and grades (standardized distance). Includes past signees with known outcomes.") +
    `<section class="card card-pad"><div class="filters"><div class="field"><label for="sim-pick">Player</label><select id="sim-pick" data-rpi="sim">${all().slice().sort((a, b) => G(b.id).c.grade - G(a.id).c.grade).slice(0, 150).map((x) => `<option value="${x.id}" ${x.id === p.id ? "selected" : ""}>${esc(x.name)} · ${x.pos} · ${G(x.id).c.grade.toFixed(2)}</option>`).join("")}</select></div></div>
    <p class="small">${plink(p)} · ${pmeta(p)} · ${htf(p.ht)}, ${p.wt} lb, 40 ${p.forty.toFixed(2)} (${p.fortySrc}) · CEG ${gradeChip(p.id)}</p></section>
    <section class="card" style="margin-top:14px"><div class="scroll-x"><table class="t"><thead><tr><th>Match</th><th class="n">Distance</th><th class="n">CEG</th><th>Size</th><th class="n">40</th><th>Outcome</th></tr></thead><tbody>
    ${s.map(({ x, d }) => `<tr><td>${plink(x)}<div class="small dim">${pmeta(x)}${x.id.startsWith("P") ? " · past signee" : ""}</div></td><td class="n">${d.toFixed(2)}</td><td class="n">${gradeChip(x.id)}</td><td>${htf(x.ht)}, ${x.wt}</td><td class="n">${x.forty.toFixed(2)}</td><td>${x.outcome ? (x.outcome.starter ? `<span class="badge b-ok">Became starter</span>` : x.outcome.bust ? `<span class="badge b-bad">Bust</span>` : `<span class="badge b-heuristic">Contributor/depth</span>`) : `<span class="dim small">—</span>`}</td></tr>`).join("")}
    </tbody></table></div><p class="note" style="padding:8px 16px 12px">Past outcomes are synthetic. A comparison, not a forecast.</p></section>`;
}

// ---------- discovery ----------
export function leadScore(l) {
  const N = NORMS[l.pos] || NORMS.WR, z = (N[2] - (l.forty + (l.fortySrc === "hand" ? 0.24 : 0))) / 0.14 * (l.fortySrc === "self" ? 0.5 : 1);
  const parts = [["Size vs position", Math.max(0, Math.min(25, 12 + 6 * (l.ht - N[0]) / 1.6))], ["Speed", Math.max(0, Math.min(25, 12 + 8 * z))], ["Verified", ["laser", "camp"].includes(l.fortySrc) ? 15 : 0], ["Film", l.film ? 15 : 0], ["Production", Math.min(10, l.stat / 140)], ["Territory priority", ["OH", "MI", "PA", "GA", "FL", "TX"].includes(l.state) ? 10 : 4]];
  return { s: Math.round(Math.min(100, parts.reduce((a, b) => a + b[1], 0))), parts };
}
export function dupOf(l) {
  const ln = l.name.split(" ").pop().toLowerCase(), fi = l.name[0].toLowerCase();
  return all().find((p) => p.state === l.state && p.cls === l.cls && p.pos === l.pos && p.name.split(" ").pop().toLowerCase() === ln && p.name[0].toLowerCase() === fi) || null;
}
export function pageDiscovery() {
  const P = prog(), leads = P.leads.filter((l) => !P.promoted.has(l.id) && !P.dismissed.has(l.id)).map((l) => ({ l, sc: leadScore(l), dup: dupOf(l) })).sort((a, b) => b.sc.s - a.sc.s);
  return head("Discovery Queue", "New names from the online questionnaire, camp check-ins, CSV imports and licensed feeds. Each lead is scored 0–100, checked for duplicates and can be promoted in one click.", sample) +
    `<div class="kpis">${kpi("In queue", leads.length, "awaiting review")}${kpi("Possible duplicates", leads.filter((x) => x.dup).length, "matched to the board")}${kpi("Promoted", P.promoted.size, "this session")}${kpi("Questionnaires", P.questionnaire.length, "received this session")}</div>
    <div class="grid g-side"><section class="card"><div class="scroll-x"><table class="t"><thead><tr><th>Lead</th><th class="n">Score</th><th>Source</th><th>Check</th><th></th></tr></thead><tbody>
    ${leads.map(({ l, sc, dup }) => `<tr><td><b>${esc(l.name)}</b><div class="small dim">${l.pos} · ${l.state} · ${l.cls} · ${htf(l.ht)}, ${l.wt} · 40 ${l.forty.toFixed(2)} (${l.fortySrc})</div></td><td class="n" title="${esc(sc.parts.map((p) => p[0] + " " + p[1].toFixed(0)).join(" · "))}"><b>${sc.s}</b></td><td class="small">${esc(l.source)}<div class="dim">${l.received}</div></td><td>${dup ? `<span class="badge b-flag">Possible duplicate</span><div class="small">of ${plink(dup)}</div>` : `<span class="badge b-ok">New</span>`}</td><td>${can("promote") ? `<button class="btn sm primary" data-rpa="promote" data-id="${l.id}">${dup ? "Merge" : "Promote"}</button> <button class="btn sm" data-rpa="dismiss" data-id="${l.id}">Dismiss</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div><p class="note" style="padding:8px 16px 12px">Lead score = size + speed (self-reported at half credit) + verified + film + production + territory priority; hover a score for its parts. Starting values, labeled as an estimate.</p></section>
    <div class="grid" style="align-content:start">${card("CSV import", "Camps, all-state lists, coach nominations, licensed exports", `<p class="small mono">name,pos,state,class,height_in,weight,forty,forty_source,film</p><textarea id="csv-txt" class="rp-brief" style="min-height:90px" aria-label="CSV rows">name,pos,state,class,height_in,weight,forty,forty_source,film\nDeShawn Mills,CB,OH,2028,73,178,4.49,laser,yes\nCarter Bloom,OT,PA,2028,78,290,5.18,hand,no</textarea><div class="row-btns"><button class="btn" data-rpa="csv">Import rows</button></div>`)}
    ${card("Sources", "No website copying: licensed exports, APIs, permitted RSS and staff uploads only", `<p class="small">The questionnaire is public at <button class="rp-plink" data-rpa="go" data-id="questionnaire">Online questionnaire</button>.</p>`)}</div></div>`;
}
export function pageQuestionnaire() {
  return head("Online Recruiting Questionnaire", "The public form prospects fill out themselves. Protected against simple bots: hidden honeypot field, minimum fill time and a rate limit on the server.") +
    `<div class="grid g-side"><section class="card card-pad"><form id="qform" class="rp-form" autocomplete="off" onsubmit="return false">
    <div class="field"><label for="qf-name">Full name</label><input id="qf-name" required maxlength="60"/></div>
    <div class="field"><label for="qf-pos">Position</label><select id="qf-pos">${POS.map((p) => `<option>${p}</option>`).join("")}</select></div>
    <div class="field"><label for="qf-cls">Graduation year</label><select id="qf-cls"><option>2027</option><option selected>2028</option><option>2029</option></select></div>
    <div class="field"><label for="qf-st">State</label><select id="qf-st">${Object.entries(STATES).map(([k, v]) => `<option value="${k}" ${k === "OH" ? "selected" : ""}>${v[0]}</option>`).join("")}</select></div>
    <div class="field"><label for="qf-ht">Height (inches)</label><input id="qf-ht" type="number" min="60" max="84" value="72"/></div>
    <div class="field"><label for="qf-wt">Weight (lb)</label><input id="qf-wt" type="number" min="120" max="380" value="185"/></div>
    <div class="field"><label for="qf-40">40 time (self-reported)</label><input id="qf-40" type="number" step="0.01" min="4" max="6.5" value="4.6"/></div>
    <div class="field"><label for="qf-film">Film link</label><input id="qf-film" type="url" placeholder="https://"/></div>
    <div class="rp-hp" aria-hidden="true"><label for="qf-web">Website</label><input id="qf-web" tabindex="-1" autocomplete="off"/></div></form>
    <label class="small"><input type="checkbox" id="qf-ok"/> I am 18 or my parent/guardian approves sending this information</label>
    <div class="row-btns"><button class="btn primary" data-rpa="qsubmit">Submit questionnaire</button><span class="small dim" id="qf-msg"></span></div></section>
    ${card("What we collect", "Most prospects are minors", `<p class="small">Only what recruiting needs: name, position, class, state, size, a self-reported 40 and an optional film link. No contact details for minors are stored in this demo. Self-reported numbers count at half credit until verified at a camp.</p>`)}</div>`;
}

// ---------- recruiting activity ----------
export function pageActivity() {
  const P = prog(), f = FUI.actF, ev = P.activity.filter((e) => f === "all" || e.kind.includes(f)).slice(0, 60);
  const comp = {}; P.activity.forEach((e) => (comp[e.school] = (comp[e.school] || 0) + 1));
  const top = Object.entries(comp).sort((a, b) => b[1] - a[1]);
  const hot = all().slice().sort((a, b) => urgency(b) - urgency(a)).slice(0, 12);
  return head("Recruiting Activity", "Who is recruiting whom: offers, visits, commitments, decommitments and portal entries from news or licensed data. Activity informs urgency and never changes a grade.", sample) +
    `<div class="kpis">${kpi("Unread alerts", P.alerts.filter((a) => !a.read).length, "rival offers, visits, commitments")}${kpi("Events", P.activity.length, "fictional rival schools")}${kpi("Most active rival", esc(top[0][0]), top[0][1] + " events")}</div>
    <div class="grid g-side"><section class="card"><div class="card-h"><div class="filters"><div class="field"><label>Event</label><select data-rpi="actF">${[["all", "All"], ["offer", "Offers"], ["visit", "Visits"], ["commitment", "Commitments"], ["decommitment", "Decommitments"]].map(([k, l]) => `<option value="${k}" ${f === k ? "selected" : ""}>${l}</option>`).join("")}</select></div><button class="btn sm" data-rpa="alerts-read">Mark alerts read</button></div></div>
    <div class="scroll-x"><table class="t"><thead><tr><th>Date</th><th>Player</th><th>School</th><th>Event</th><th>Source</th></tr></thead><tbody>${ev.map((e) => { const p = byId(e.pid); return `<tr><td class="mono">${e.date}</td><td>${plink(p)}</td><td>${esc(e.school)}</td><td>${esc(e.kind)}</td><td class="small dim">${esc(e.source)}</td></tr>`; }).join("")}</tbody></table></div></section>
    ${card("Highest urgency", "Where rivals are moving fastest", prospectTable(hot, { cols: ["grade", "urg"], limit: 12 }))}</div>`;
}

// ---------- news scanner ----------
const SCHOOLS_RX = /\b((?:Central|North|Lincoln|St\. Joseph|Valley|Ridge|Riverside|Eastside)(?: HS)?)\b/g;
export function scanText(text) {
  const sents = text.match(/[^.!?]+[.!?]+["”]?/g) || [text];
  const out = [];
  const statRx = /(rushed for|threw for|caught \d+ passes for|added|finished with|broke up|intercepted|had)\s*([\d.]+)\s*(yards|sacks|tackles|passes|touchdowns|more)?/gi;
  const nameRx = /\b([A-Z][a-z]+ [A-Z][a-z]+(?:-[A-Z][a-z]+)?)\b/g;
  const skip = new Set(["Friday Night", "Region Semifinal"]);
  sents.forEach((s) => {
    const names = [...s.matchAll(nameRx)].map((m) => m[1]).filter((n) => !skip.has(n) && !/^(Central|North|Lincoln|Valley|Ridge|Riverside|Eastside|St) /.test(n) && !/ (HS|High)$/.test(n));
    const stats = []; let m; const rx = new RegExp(statRx.source, "gi");
    while ((m = rx.exec(s))) stats.push(`${m[1]} ${m[2]}${m[3] ? " " + m[3] : ""}`);
    const tds = s.match(/(\w+|\d+) touchdowns?/i);
    if (tds && !stats.some((x) => /touchdown/.test(x))) stats.push(tds[0]);
    if (names.length && stats.length) {
      const nm = names.find((n) => !/coach/i.test(s.slice(Math.max(0, s.indexOf(n) - 8), s.indexOf(n)))) || names[0];
      const school = (s.match(SCHOOLS_RX) || [])[0] || "";
      const big = stats.some((x) => { const v = parseFloat(x.replace(/[^\d.]/g, "")); return (/yards/.test(x) && v >= 150) || (/sacks/.test(x) && v >= 2) || (/tackles/.test(x) && v >= 12) || /intercepted 2|4 touchdowns|three touchdowns/.test(x); });
      const match = all().find((p) => p.name === nm);
      out.push({ name: nm, school, stats, quote: s.trim(), big, match: match?.id || null });
    }
  });
  return out;
}
export function pageNews() {
  const r = FUI.scan;
  return head("News & Game-Coverage Scanner", "Reads game stories and box scores from licensed feeds, publisher-permitted RSS, pasted text and scanned pages. Pulls out players, schools and stats, flags big games and keeps the quoted sentence behind every number.", sample) +
    `<div class="grid g2"><section class="card card-pad"><div class="row-btns" style="margin-top:0">${NEWS_SAMPLES.map((n, i) => `<button class="btn sm" data-rpa="news-sample" data-id="${i}">${esc(n.title)}</button>`).join("")}</div>
    <textarea id="news-txt" class="rp-brief" aria-label="Article text">${esc(FUI.news)}</textarea><p class="small dim">Source: ${esc(FUI.newsSrc)}</p>
    <div class="row-btns"><button class="btn primary" data-rpa="news-scan">Scan text</button><button class="btn fz" data-rpa="news-ai" ${FUI.aiBusy ? "disabled" : ""}>${FUI.aiBusy ? "AI reader working…" : "Use AI reader (live)"}</button></div>
    <p class="note">The AI reader sends only the pasted text to the server, which asks Perplexity to extract players and stats with the supporting sentence. It does not browse.</p></section>
    <section class="card"><div class="card-h"><div><h3>Extracted ${r ? `· ${r.length} players` : ""}</h3><p>Rule-based reader. Every number carries the sentence it came from.</p></div></div>
    ${r ? `<div class="scroll-x"><table class="t"><thead><tr><th>Player</th><th>Stats</th><th>Quoted sentence</th></tr></thead><tbody>${r.map((x) => `<tr><td><b>${esc(x.name)}</b>${x.big ? ` <span class="badge b-flag">Big game</span>` : ""}<div class="small dim">${esc(x.school)}</div>${x.match ? `<div class="small">On board: ${plink(byId(x.match))}</div>` : `<div class="small dim">Not on board</div>`}</td><td class="small">${x.stats.map(esc).join("<br/>")}</td><td class="small">“${esc(x.quote)}”</td></tr>`).join("")}</tbody></table></div>` : `<p class="note" style="padding:0 16px 14px">Scan the sample to see extraction.</p>`}
    ${FUI.ai ? `<div style="padding:0 16px 14px">${sec("AI reader")}${FUI.ai.error ? `<div class="callout sim">${esc(FUI.ai.error)}</div>` : `<table class="t"><tbody>${(FUI.ai.players || []).map((x) => `<tr><td><b>${esc(x.name)}</b><div class="small dim">${esc(x.school || "")}</div></td><td class="small">${esc((x.stats || []).join("; "))}</td><td class="small">“${esc(x.quote || "")}”</td></tr>`).join("")}</tbody></table><p class="note">${FUI.ai.ms ? `${FUI.ai.ms} ms · ` : ""}${esc(FUI.ai.endpoint || "")}</p>`}</div>` : ""}</section></div>`;
}

// ---------- automation worker ----------
export function runWorker() {
  const P = prog(), st = S(), log = [];
  const t = () => new Date().toISOString();
  // 1. poll feeds (sample): new stat lines for a handful of players
  const locked = all().filter((p) => P.staffLocked[p.id + ":prod"]);
  const touched = locked.concat(all().filter((p, i) => (i + P.runs.length * 7) % 53 === 0 && !locked.includes(p))).slice(0, 8);
  log.push({ step: "Poll feeds", detail: `Licensed stats feed (sample): ${touched.length} new game lines; recruiting feed: ${P.runs.length ? 1 : 3} new events`, source: "Licensed feeds (sample)" });
  // 2. rebuild profiles + suggest production grades (never overwrite staff entries)
  let sug = 0, skipped = 0;
  touched.forEach((p) => {
    if (P.staffLocked[p.id + ":prod"]) { skipped++; return; }
    const old = p.prodRaw; p.prodRaw = Math.min(9, +(p.prodRaw + 0.2).toFixed(2)); P.suggested[p.id] = { from: old, to: p.prodRaw, ts: t() }; sug++;
    audit("auto.production", `Production suggestion ${old} → ${p.prodRaw} for ${p.name}`, "Automation worker · licensed stats feed (sample)", "auto");
  });
  log.push({ step: "Rebuild position profiles", detail: `${touched.length} profiles rebuilt (season totals, per game, trend, big games)`, source: "Automation worker" });
  log.push({ step: "Suggest production grades", detail: `${sug} suggestions applied; ${skipped} skipped because a staff entry exists`, source: "Automation worker" });
  // 3. new activity → alerts
  const p0 = all()[(P.runs.length * 31 + 5) % all().length], sc = RIVALS[P.runs.length % RIVALS.length];
  const e = { pid: p0.id, school: sc, kind: "offer", date: "2026-11-04", source: "Licensed recruiting feed (sample)" };
  P.activity.unshift(e); p0.offers.push({ school: sc, kind: "offer", date: e.date, source: e.source });
  P.alerts.unshift({ ts: e.date, pid: p0.id, kind: "offer", school: sc, source: e.source, read: false });
  audit("auto.activity", `Rival offer: ${sc} → ${p0.name}`, e.source, "auto");
  bump();
  log.push({ step: "Re-score everyone", detail: `${all().length} prospects re-scored on CEG; grades unaffected by activity`, source: "CEG engine" });
  log.push({ step: "Update commitment chances", detail: `${p0.name}: now ${Math.round(100 * G(p0.id).L.p)}% (rival offer added)`, source: "Likelihood model (estimate)" });
  log.push({ step: "Raise alerts", detail: `1 rival offer alert; saved searches re-checked (${P.saved.length})`, source: "Alert rules" });
  log.push({ step: "Draft Monday brief", detail: "Draft refreshed; not sent (approval required)", source: "Brief writer" });
  P.runs.unshift({ ts: t(), log });
  return log;
}
export function pageAutomation() {
  const P = prog(), auto = P.audit.filter((a) => a.kind === "auto");
  return head("Automation Worker", "Polls feeds, rebuilds position profiles, suggests production grades, re-scores everyone, updates commitment chances, raises alerts and drafts the Monday brief. Every automatic change is logged with its source; staff entries are never overwritten.", sample) +
    `<div class="row-btns" style="margin:0 0 14px"><button class="btn primary" data-rpa="worker">Run worker now</button><span class="small dim">In production this runs on a schedule. ${P.runs.length} runs this session.</span></div>
    <div class="grid g2">${card("Latest run", P.runs[0] ? P.runs[0].ts : "Not run yet", P.runs[0] ? P.runs[0].log.map((l, i) => `<div class="rp-step"><span class="rp-stepn">${i + 1}</span><div><b>${esc(l.step)}</b><div class="small">${esc(l.detail)}</div><div class="small dim">${esc(l.source)}</div></div></div>`).join("") : `<p class="note">Run the worker to see each step.</p>`)}
    ${card("Automatic changes (with source)", `${auto.length} entries`, auto.length ? auto.slice(0, 30).map((a) => `<div class="rp-logrow"><span class="mono">${a.ts.slice(11, 19)}</span> ${esc(a.detail)}<div class="small dim">${esc(a.source)}</div></div>`).join("") : `<p class="note">None yet.</p>`)}</div>`;
}
