// Portal Lab v8 · built from the Nov 6 Screen Review Readout (Dan | Les).
// Every v8 screen maps to a deck slide. Staff inputs stay in this browser (localStorage) in the demo.

export const V8NAV = [
  { k: "whatsnew", label: "What Changed in v8" },
  { k: "core", label: "Coach Core (1·2·6·7)" },
  { k: "grades", label: "Staff Grades & Decisions" },
  { k: "flags", label: "Flags to the GM" },
  { k: "market", label: "Market Analysis" },
  { k: "timeline", label: "Entry Timeline" },
  { k: "launch", label: "Launch Agent Set" },
  { k: "ask", label: "Staff Questions" },
];
export const V8TITLES = {
  whatsnew: ["What Changed in v8", "Every requirement from the Nov 6 screen review, and where it now lives"],
  core: ["Coach Core", "Dan's priority pages 1, 2, 6 and 7 from the v1 menu, in one place"],
  grades: ["Staff Grades & Decisions", "Each expert input kept separately, attributed and dated, plus a readable decision log"],
  flags: ["Flags to the GM", "Coaches flag players to the GM inside the platform"],
  market: ["Market Analysis", "Is the market right, or just guessing? Signals other programs use, checked against what happened"],
  timeline: ["Entry Timeline", "Portal entries don't arrive on a schedule, so detection has to run well before mid-December"],
  launch: ["Launch Agent Set", "A small set of agents at launch, with the full AI Workforce shown as the vision"],
  ask: ["Staff Questions", "Questions from staff, routed to Dan, the GM or the build team"],
};
export const V8KEYS = V8NAV.map((n) => n.k);

const KEY = "be-v8-state";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const ST = Object.assign({ inputs: {}, decisions: [], flags: [], questions: [], who: { name: "Position coach (demo)", role: "Position coach" } }, load());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch {} };
const ROLES = ["Head coach", "Position coach", "Area recruiter", "General manager", "Personnel director", "Analyst"];
const now = () => new Date().toISOString().replace("T", " ").slice(0, 16);
let X = null; // context from app.js

const card = (h, p, body, right = "") => `<section class="card card-pad"><div class="card-h"><div><h3>${h}</h3>${p ? `<p>${p}</p>` : ""}</div><div class="sp"></div>${right}</div>${body}</section>`;
const tag = (t, cls = "") => `<span class="v8tag ${cls}">${t}</span>`;

// ---------- range helpers ----------
// The 80% range on the posterior end (deck slide 5). If no approved method exists, the
// spread of staff judgments is shown instead and labeled as such (brief task 3).
export function rangeMarker(s, esc) {
  const lo = Math.round(s.q10 * 100), hi = Math.round(s.q90 * 100), mid = Math.round(s.mean * 100), base = Math.round(s.base * 100);
  const L = (v) => `${Math.max(0, Math.min(100, v))}%`;
  return `<div class="v8range" role="img" aria-label="80 percent range ${lo} to ${hi} percent">
    <div class="v8r-track"><div class="v8r-band" style="left:${L(lo)};width:${L(hi - lo)}"></div>
      <div class="v8r-base" style="left:${L(base)}" title="Comparable-move base rate"></div>
      <div class="v8r-mid" style="left:${L(mid)}"></div></div>
    <div class="v8r-scale"><span>0%</span><span>50%</span><span>100%</span></div>
    <div class="v8r-read"><b>80% range: ${lo}% to ${hi}%</b> · middle ${mid}% · comparable moves ${base}% (dashed)</div>
    <div class="v8r-plain">In plain terms: in 8 of 10 simulated outcomes this player lands between ${lo}% and ${hi}%. A wide band means less certainty. ${tag("Demo model · method pending Rippee/Nasim approval", "warn")}</div>
  </div>`;
}
function staffSpread(pid) {
  const xs = (ST.inputs[pid] || []).map((i) => i.grade);
  if (!xs.length) return null;
  return { n: xs.length, lo: Math.min(...xs), hi: Math.max(...xs) };
}
export function profileExtras(p, s) {
  const esc = X.esc, sp = staffSpread(p.id), ins = ST.inputs[p.id] || [], fl = ST.flags.filter((f) => f.pid === p.id);
  return card("80% range on the posterior (v8)", "Requested by Dan: mark the 80% range so the spread is clear to non-technical staff (S1 12:43).", rangeMarker(s, esc)) +
    card("Spread of staff judgments", "Every expert input listed separately. No averaging.",
      (sp ? `<div class="v8spread"><b>${sp.lo.toFixed(1)} to ${sp.hi.toFixed(1)}</b> across ${sp.n} input${sp.n > 1 ? "s" : ""} ${tag("spread of staff judgments, not a statistical interval")}</div>` : `<div class="note">No attributed inputs yet.</div>`) +
      (ins.length ? `<table class="t"><thead><tr><th>Who</th><th>Role</th><th class="n">Grade</th><th>When</th><th>Why</th></tr></thead><tbody>${ins.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.role)}</td><td class="n">${i.grade.toFixed(1)}</td><td class="mono">${i.at}</td><td>${esc(i.why || "—")}</td></tr>`).join("")}</tbody></table>` : "") +
      `<div class="row-btns"><button class="btn sm primary" data-v8="sel" data-id="${p.id}">Add an attributed grade</button><button class="btn sm" data-v8="flag-open" data-id="${p.id}">Flag to GM${fl.length ? ` (${fl.length})` : ""}</button></div>`);
}

// ---------- pages ----------
const REQS = [
  ["Board with staff grade", "3–4", "Approved. Staff grade now attributed (who, role, time, rationale) and the reorder rule is shown on screen.", "grades", "Built"],
  ["Player profile: baseline to player", "5", "Approved layout kept. Profile now also lists each expert input separately with a decision log.", "player", "Built"],
  ["80% range on the posterior end", "5", "Marked on every profile as a plain-language band. Labeled as demo model until a method is approved.", "player", "Built · method pending"],
  ["Decision aid for Year Zero", "6", "Unvalidated numbers read as demo values; four fields kept separate.", "grades", "Built"],
  ["Pages 1, 2, 6 and 7 first for coaches", "3, 7", "Coach Core groups v1 menu items 1 Portal Board, 2 Player Profile, 6 Deep Research, 7 Live Portal Intel.", "core", "Built · mapping to confirm"],
  ["Market analysis", "8", "New screen: market signals vs. what happened after the move, with the arithmetic shown.", "market", "Built · fictional sample"],
  ["Build everything, show coaches simple views", "9", "Calibration, backtests and ontology stay in Analyst mode.", "core", "Built"],
  ["Personas and coach-to-GM channel", "10", "New Flags to the GM inbox; flag from any profile. Persona needs await the GM meeting.", "flags", "Built · personas open"],
  ["AI companion per coach", "11", "Talk to Edge and Plain-English Search carried over from v5/v3.", "talk", "Carried over"],
  ["Signal tests", "13", "Carried over from v4; Dan's candidate list still to come.", "signals", "Open"],
  ["Natural voice", "14", "Recorded narrator voice in place of the computer voice.", "rooms", "Built"],
  ["Small agent set at launch", "15", "New Launch Agent Set: four agents on, full roster shown as the vision.", "launch", "Built"],
  ["Every device incl. watch", "16", "Carried over from v5.", "devices", "Carried over"],
  ["Questions section for staff", "17", "New Staff Questions screen with routing.", "ask", "Built"],
  ["Future vision as the target state", "18", "v7 How It Works kept as the vision section.", "learn", "Carried over"],
  ["Detection before mid-December", "19–20", "New Entry Timeline with the four waves and the Dec 14 feature lock.", "timeline", "Built"],
];
function pageWhatsNew() {
  const esc = X.esc;
  return `<div class="callout"><b>Version 8 is built from the Nov 6 screen review with Dan.</b> Each row below is a requirement from the readout deck and the screen where it now lives. Numbers on every screen are demo values, not validated results. Players are fictional unless a screen says otherwise.</div>
  ${card("Requirements from the readout, and where they live", "Click a row to open the screen.", `<div class="scroll-x"><table class="t"><thead><tr><th>Requirement</th><th>Deck slide</th><th>What v8 does</th><th>Status</th></tr></thead><tbody>${REQS.map(([r, sl, w, go, st]) => `<tr class="v8row" data-go="${go}"><td><b>${esc(r)}</b></td><td class="mono">${sl}</td><td>${esc(w)}</td><td>${tag(st, /pending|open|confirm|fictional/i.test(st) ? "warn" : /Carried/.test(st) ? "" : "ok")}</td></tr>`).join("")}</tbody></table></div>`)}
  <div class="grid g2" style="margin-top:14px">
  ${card("Still open for the GM session", "From the deck's open questions. v8 does not decide these.", `<ol class="v8ol"><li>Which metrics matter most for each position, and what counts as success?</li><li>Which personas get which screens and which data?</li><li>Which signals should we test first?</li><li>Which Year Zero features are must-haves, and which wait?</li></ol>`)}
  ${card("Four fields, kept separate", "So nobody reads one number as another.", `<table class="t"><tbody>
    <tr><td><b>Staff grade</b></td><td>Named expert input, attributed and dated. Never called calibrated.</td></tr>
    <tr><td><b>Portal-entry likelihood</b></td><td>Public reporting and signals. Not intent.</td></tr>
    <tr><td><b>Commit likelihood</b></td><td>Staff judgment for now. Demo coefficients are not used.</td></tr>
    <tr><td><b>On-field success</b></td><td>Pending Ohio State's success definition.</td></tr></tbody></table>`)}
  </div>`;
}
function pageCore() {
  const it = [["1", "board", "Portal Board", "Ranked list per position. Staff grade moves the ranking under a rule shown on screen.", "\"I'm a big fan of this page.\""],
    ["2", "player", "Player Profile", "Baseline to player, what moves it, and now the 80% range band.", "\"It's exactly how I would present it.\""],
    ["6", "research", "Deep Research", "Cited public evidence that waits for staff review before it touches anything.", ""],
    ["7", "live", "Live Portal Intel", "Who may enter, with sources. Reported intent is not confirmed entry.", ""]];
  return `<div class="callout"><b>Dan: "The biggest movers at this point for our staff are 1, 2, 6, and 7."</b> (S1 16:11). In the v1 menu those are Portal Board, Player Profile, Deep Research and Live Portal Intel. Pages 4 and 5, calibration and ontology, are the ones Dan called mainly for him, so they stay in Analyst mode. The mapping still needs Dan's confirmation.</div>
  <div class="v8core">${it.map(([n, k, t, d, q]) => `<button class="v8tile" data-go="${k}"><span class="v8n">${n}</span><b>${t}</b><span>${d}</span>${q ? `<em>${q}</em>` : ""}</button>`).join("")}</div>`;
}
function pageGrades(param) {
  const esc = X.esc, board = X.boardFor().slice().sort((a, b) => X.S.scores[b.id].shift - X.S.scores[a.id].shift);
  const pid = (param && board.find((b) => b.id === param)?.id) || ST.sel || board[0].id;
  const p = board.find((b) => b.id === pid), ins = ST.inputs[pid] || [], sp = staffSpread(pid);
  const rows = board.map((b, i) => { const s2 = staffSpread(b.id); return `<tr class="${b.id === pid ? "sel" : ""}"><td class="n">${i + 1}</td><td><button class="lnk" data-v8="sel" data-id="${b.id}"><b>${esc(b.name)}</b></button><div class="dim small">${b.jump}</div></td><td class="n">${(ST.inputs[b.id] || []).length}</td><td class="n">${s2 ? `${s2.lo.toFixed(1)}–${s2.hi.toFixed(1)}` : `<span class="dim">—</span>`}</td></tr>`; }).join("");
  const dec = ST.decisions.filter((d) => d.pid === pid);
  return `<div class="callout"><b>Ranking rule shown on screen:</b> the board orders players by the demo model's shift against comparable moves. The model uses the latest grade entered for a player, and every grade is kept in the log below. When staff disagree, the spread is shown, never an average. ${tag("Rule pending Ohio State's success definition", "warn")}</div>
  <div class="grid g-side" style="margin-top:14px">
    <div class="grid">
      ${card(`${esc(p.name)} · attributed inputs`, "Name, role, date and rationale saved with every grade (brief task 1).", `
        <div class="v8form">
          <div class="field"><label for="v8-name">Your name</label><input id="v8-name" value="${esc(ST.who.name)}"/></div>
          <div class="field"><label for="v8-role">Role</label><select id="v8-role">${ROLES.map((r) => `<option ${r === ST.who.role ? "selected" : ""}>${r}</option>`).join("")}</select></div>
          <div class="field"><label for="v8-grade">Grade (1–5)</label><select id="v8-grade">${[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => `<option ${v === 3.5 ? "selected" : ""}>${v.toFixed(1)}</option>`).join("")}</select></div>
          <div class="field wide"><label for="v8-why">Rationale (optional)</label><input id="v8-why" placeholder="e.g., Press technique on film vs. Group of Five receivers"/></div>
        </div>
        <div class="row-btns"><button class="btn primary sm" data-v8="grade-save" data-id="${pid}">Save grade</button><button class="btn sm" data-player="${pid}">Open profile</button></div>
        ${sp ? `<div class="v8spread"><b>${sp.lo.toFixed(1)} to ${sp.hi.toFixed(1)}</b> across ${sp.n} input${sp.n > 1 ? "s" : ""} ${tag("spread of staff judgments, not a statistical interval")}</div>` : ""}
        ${ins.length ? `<table class="t"><thead><tr><th>Who</th><th>Role</th><th class="n">Grade</th><th>When</th><th>Why</th></tr></thead><tbody>${ins.slice().reverse().map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.role)}</td><td class="n">${i.grade.toFixed(1)}</td><td class="mono">${i.at}</td><td>${esc(i.why || "—")}</td></tr>`).join("")}</tbody></table>` : `<div class="note">No grades yet for this player.</div>`}`)}
      ${card("Decision log", "Logged decisions can be read back (brief task 2).", `
        <div class="row-btns" style="margin-top:0">${["Pursue", "Hold", "Film review", "Pass"].map((d) => `<button class="btn sm" data-v8="decide" data-d="${d}" data-id="${pid}">${d}</button>`).join("")}</div>
        ${dec.length ? `<table class="t"><thead><tr><th>Decision</th><th>Who</th><th>When</th></tr></thead><tbody>${dec.slice().reverse().map((d) => `<tr><td><b>${esc(d.d)}</b></td><td>${esc(d.name)} · ${esc(d.role)}</td><td class="mono">${d.at}</td></tr>`).join("")}</tbody></table>` : `<div class="note">No decisions logged.</div>`}`)}
    </div>
    ${card(`${esc(X.posName())} board`, "Pick a player. Counts show attributed inputs.", `<div class="v8list"><table class="t"><thead><tr><th class="n">#</th><th>Player</th><th class="n">Inputs</th><th class="n">Spread</th></tr></thead><tbody>${rows}</tbody></table></div>`)}
  </div>`;
}
function pageFlags() {
  const esc = X.esc, open = ST.flags.filter((f) => f.status !== "Closed");
  return `<div class="callout"><b>Coach-to-GM channel.</b> A coach flags a player from any profile, the GM sees it here, and every step is logged. Who can flag and who sees flags will be set after Dan's GM meeting. ${tag("Roles pending", "warn")}</div>
  <div class="kpis" style="margin-top:14px"><div class="kpi"><div class="l">Open flags</div><div class="v">${open.length}</div><div class="s">waiting on the GM</div></div><div class="kpi"><div class="l">All flags</div><div class="v">${ST.flags.length}</div><div class="s">stored in this browser for the demo</div></div></div>
  ${card("Flag a player", "", `<div class="v8form"><div class="field"><label for="v8-fp">Player</label><select id="v8-fp">${X.boardFor().map((b) => `<option value="${b.id}">${esc(b.name)} · ${b.jump}</option>`).join("")}</select></div>
    <div class="field"><label for="v8-fu">Urgency</label><select id="v8-fu"><option>Look this week</option><option>Before the window</option><option>Urgent</option></select></div>
    <div class="field wide"><label for="v8-fn">Note to the GM</label><input id="v8-fn" placeholder="Why this player, in one line"/></div></div>
    <div class="row-btns"><button class="btn primary sm" data-v8="flag-save">Send flag to GM</button></div>`)}
  ${card("GM inbox", "Acknowledge, put on the Monday agenda, or close.", ST.flags.length ? `<div class="scroll-x"><table class="t"><thead><tr><th>Player</th><th>From</th><th>Urgency</th><th>Note</th><th>When</th><th>Status</th><th></th></tr></thead><tbody>${ST.flags.slice().reverse().map((f) => `<tr><td><button class="lnk" data-player="${f.pid}"><b>${esc(f.pname)}</b></button></td><td>${esc(f.name)} · ${esc(f.role)}</td><td>${esc(f.u)}</td><td>${esc(f.note || "—")}</td><td class="mono">${f.at}</td><td>${tag(f.status, f.status === "New" ? "warn" : "ok")}</td><td><div class="row-btns" style="margin:0">${["Acknowledged", "Monday agenda", "Closed"].map((s) => `<button class="btn sm" data-v8="flag-st" data-i="${f.i}" data-s="${s}">${s}</button>`).join("")}</div></td></tr>`).join("")}</tbody></table></div>` : `<div class="note">No flags yet. Flag a player above or from his profile.</div>`)}`;
}
function pageMarket() {
  const esc = X.esc, pos = X.S.cfg.pos;
  const H = X.history().filter((h) => h.pos === pos && h.jump !== "P4→P4" && h.out);
  const ok = (h) => h.out.snapShare1 >= 0.5;
  const q = (arr, f) => { const v = arr.map(f).filter((x) => x != null).sort((a, b) => a - b); return v[Math.floor(v.length * 0.67)]; };
  const qlo = (arr, f) => { const v = arr.map(f).filter((x) => x != null).sort((a, b) => a - b); return v[Math.floor(v.length * 0.33)]; };
  const sigs = [
    ["Portal rating (3+ stars)", (h) => h.stars >= 3, "What most programs sort on first"],
    [`Production: ${X.m1Label()} in the ${X.m1Lower() ? "best (lowest)" : "top"} third`, X.m1Lower() ? ((t) => (h) => h.m1 <= t)(qlo(H, (h) => h.m1)) : ((t) => (h) => h.m1 >= t)(q(H, (h) => h.m1)), "The stat line, like \"650 receiving yards\" for a receiver"],
    ["Film grade in the top third", ((t) => (h) => h.film != null && h.film >= t)(q(H, (h) => h.film)), "What the tape says"],
    ["Last-season snap share 60%+", (h) => h.snap >= 0.6, "Was he an every-down player"],
  ];
  const all = H.filter(ok).length / Math.max(1, H.length);
  const res = sigs.map(([n, f, d]) => { const hi = H.filter(f), lo = H.filter((h) => !f(h)); const kh = hi.filter(ok).length, kl = lo.filter(ok).length; const ph = kh / Math.max(1, hi.length), pl = kl / Math.max(1, lo.length); return { n, d, hn: hi.length, kh, ph, ln: lo.length, kl, pl, lift: ph - pl }; }).sort((a, b) => b.lift - a.lift);
  const pc = (x) => Math.round(x * 100);
  const verdict = (r) => r.lift > 0.08 ? tag("Works", "ok") : r.lift > 0.02 ? tag("Weak") : r.lift < -0.05 ? tag("Points the wrong way", "warn") : tag("Guesswork", "warn");
  return `<div class="callout sim"><b>Fictional sample.</b> Dan asked: "is the market actually doing what's correct, or are they just kind of guessing?" (S1 17:25). This screen shows the method on ${H.length} fictional Group of Five and FCS transfers to Power Four programs. The real version first needs a feasibility check: can open data link these movers to their production before and after the move? ${tag("Feasibility only · no conclusions", "warn")}</div>
  <div class="v8steps"><div><span>1</span><b>What the market uses</b><em>Signals programs rely on when taking non-P4 players</em></div><div><span>2</span><b>Who got taken</b><em>${H.length} non-P4 to P4 moves at ${esc(X.posName())}</em></div><div><span>3</span><b>How they performed</b><em>Success here = 50%+ snap share in year one (placeholder until Ohio State defines success)</em></div><div class="red"><span>4</span><b>Verdict for Ohio State</b><em>Which signals separate hits from misses</em></div></div>
  ${card("Signal check, with the arithmetic shown", `Overall hit rate: ${H.filter(ok).length} of ${H.length} = ${pc(all)}%. Lift = hit rate with the signal minus hit rate without it.`, `<div class="scroll-x"><table class="t"><thead><tr><th>Market signal</th><th class="n">With signal</th><th class="n">Without</th><th class="n">Lift</th><th>Verdict</th></tr></thead><tbody>${res.map((r) => `<tr><td><b>${esc(r.n)}</b><div class="dim small">${esc(r.d)}</div></td><td class="n">${r.kh} of ${r.hn} = <b>${pc(r.ph)}%</b></td><td class="n">${r.kl} of ${r.ln} = ${pc(r.pl)}%</td><td class="n ${r.lift >= 0 ? "pos" : "neg"}"><b>${r.lift >= 0 ? "+" : ""}${pc(r.lift)} pts</b></td><td>${verdict(r)}</td></tr>`).join("")}</tbody></table></div>
  <p class="note">Verdict thresholds (+8 pts works, +2 pts weak) are illustrative. Market analysis is about selections and outcomes, not player price, which is a separate Phase 2 feature.</p>`)}`;
}
function pageTimeline() {
  const today = new Date(), lock = new Date("2026-12-14T00:00:00"), days = Math.max(0, Math.ceil((lock - today) / 864e5));
  const waves = [["End of regular season", "Some players declare right away, even on playoff teams", "Warm"], ["End of November", "Earliest point you really know who's entering", "Hot"], ["Mid to late December", "A wave of announcements", "Strong"], ["Right before the portal opens", "Late declarers; top players may hold out or renegotiate", "Strong"]];
  return `<div class="callout"><b>Dan: portal entries don't arrive on a schedule</b> (S1 37:09). Collection and signal detection have to run well before mid-December, not when the portal opens.</div>
  <div class="kpis" style="margin-top:14px"><div class="kpi"><div class="l">Feature lock target</div><div class="v">Dec 14</div><div class="s">${days} days from today · stated in the meeting</div></div><div class="kpi"><div class="l">Staff tryout</div><div class="v">~3 wks</div><div class="s">Nov–Dec · dates TBD</div></div><div class="kpi"><div class="l">Live private version</div><div class="v">TBD</div><div class="s">Discussed for Nov 9 · hosting approval open</div></div></div>
  <div class="v8tl">${waves.map(([t, d, lv], i) => `<div class="v8tl-i ${i === 1 ? "red" : ""}"><i></i><b>${t}</b><span>${d}</span>${tag(lv + " signal", lv === "Hot" ? "warn" : lv === "Strong" ? "ok" : "")}</div>`).join("")}</div>
  ${card("Signal levels", "How a player moves from watch to likely entrant. Sources are public reporting until data agreements are approved.", `<table class="t"><tbody><tr><td><b>Warm</b></td><td>One public signal, such as reduced snaps, a coaching change or an NIL report</td></tr><tr><td><b>Hot</b></td><td>Two or more independent signals, or a credible reporter's note</td></tr><tr><td><b>Strong</b></td><td>The player or school says it publicly. This is still reported, not a confirmed portal entry</td></tr></tbody></table>`)}`;
}
const AGENTS = [["Portal Scout", "Watches public reporting and raises warm, hot and strong signals", true], ["Research Agent", "Gathers cited evidence on one player for staff review", true], ["Monday Brief", "Builds the one-page Monday meeting brief from the board", true], ["Fact-Checker", "Checks every claim against its source before staff see it", true], ["Opponent Intel", "Prepares opponent tendencies for game week", false], ["Roster & Budget Planner", "Roster needs and budget scenarios", false], ["Compliance Watch", "Calendar and rule reminders", false], ["Data Analyst (Dan)", "Calibration, backtests and usage reports", false], ["Camp Coordinator", "Camp invites and follow-ups", false], ["Film Room Assistant", "Pulls clips by situation", false]];
function pageLaunch() {
  const esc = X.esc;
  return `<div class="callout"><b>Dan: "I do want to keep it simple for them initially, but I want them to see the extent of what this can be."</b> (S1 30:00). Four agents start switched on. The rest are shown as the vision and stay off until staff ask for them.</div>
  <div class="v8agents">${AGENTS.map(([n, d, on]) => `<div class="v8ag ${on ? "on" : ""}"><b>${esc(n)}</b><span>${esc(d)}</span>${on ? tag("At launch", "ok") : tag("Vision")}</div>`).join("")}</div>`;
}
function pageAsk() {
  const esc = X.esc;
  const seed = [["What counts as success at each position?", "Dan + GM"], ["Who sees which screens?", "Dan + GM"], ["Is any number on this screen validated?", "Build team"]];
  return `<div class="callout"><b>Requested by Dan</b> for his explainer: a place for staff questions (S1 32:39). Questions are stored in this browser for the demo and routed to the person who can answer.</div>
  ${card("Ask a question", "", `<div class="v8form"><div class="field wide"><label for="v8-q">Question</label><input id="v8-q" placeholder="Type a question for Dan, the GM or the build team"/></div><div class="field"><label for="v8-qr">Route to</label><select id="v8-qr"><option>Dan</option><option>General manager</option><option>Build team</option></select></div></div><div class="row-btns"><button class="btn primary sm" data-v8="ask">Submit</button></div>`)}
  ${card("Questions so far", "", `<table class="t"><thead><tr><th>Question</th><th>Route</th><th>Status</th></tr></thead><tbody>${ST.questions.slice().reverse().map((q) => `<tr><td>${esc(q.q)}</td><td>${esc(q.r)}</td><td>${tag("Open", "warn")}</td></tr>`).join("")}${seed.map(([q, r]) => `<tr><td>${esc(q)}</td><td>${r}</td><td>${tag("Open: GM meeting", "warn")}</td></tr>`).join("")}</tbody></table>`)}`;
}
export const V8PAGES = { whatsnew: pageWhatsNew, core: pageCore, grades: (p) => pageGrades(p), flags: pageFlags, market: pageMarket, timeline: pageTimeline, launch: pageLaunch, ask: pageAsk };

// ---------- events ----------
export function bindV8(ctx) {
  X = ctx;
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-v8]"); if (!t) return;
    const a = t.dataset.v8, id = t.dataset.id, v = (s) => document.querySelector(s)?.value;
    if (a === "sel") { ST.sel = id; save(); return X.go("grades", id); }
    if (a === "grade-save") {
      ST.who = { name: v("#v8-name") || "Staff (demo)", role: v("#v8-role") };
      const g = +v("#v8-grade"), why = v("#v8-why");
      (ST.inputs[id] = ST.inputs[id] || []).push({ ...ST.who, grade: g, why, at: now() }); save();
      await X.applyGrade(id, g, ST.who);
      X.toast(`Saved ${g.toFixed(1)} from ${ST.who.name} (${ST.who.role}) · board re-ranked`); return X.render();
    }
    if (a === "decide") { ST.decisions.push({ pid: id, d: t.dataset.d, ...ST.who, at: now() }); save(); X.log("v8.decision", `${t.dataset.d}: ${X.findPlayer(id).name}`, { player: id, by: ST.who.name, role: ST.who.role }, {}, "staff"); X.toast(`Logged: ${t.dataset.d}`); return X.render(); }
    if (a === "flag-open") return X.go("flags");
    if (a === "flag-save") { const pid = v("#v8-fp"), p = X.findPlayer(pid); ST.flags.push({ i: ST.flags.length, pid, pname: p.name, u: v("#v8-fu"), note: v("#v8-fn"), ...ST.who, at: now(), status: "New" }); save(); X.log("v8.flag", `Flag to GM: ${p.name}`, { player: pid, by: ST.who.name }, {}, "staff"); X.toast("Flag sent to the GM inbox"); return X.render(); }
    if (a === "flag-st") { const f = ST.flags[+t.dataset.i]; f.status = t.dataset.s; save(); X.log("v8.flag", `GM: ${f.status} · ${f.pname}`, {}, {}, "staff"); return X.render(); }
    if (a === "ask") { const q = v("#v8-q"); if (!q) return X.toast("Type a question first"); ST.questions.push({ q, r: v("#v8-qr"), at: now() }); save(); X.toast("Question routed"); return X.render(); }
  });
}
