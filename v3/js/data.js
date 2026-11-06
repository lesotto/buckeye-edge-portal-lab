// Synthetic transfer-portal universe (v2). Fictional players and programs; deterministic seed.
// Generative story (hidden from the model): each transfer has a latent talent T.
// v2 changes, following the Rippee assessment (Nov 2026):
//  - continuous program rating gap (destination minus origin) instead of three level-jump classes alone
//  - destination and origin program effects (crossed random effects), incl. an Ohio State development effect
//  - roster-context covariates: returning production at the position, same-position transfers in the
//    same cycle, head-coach change at the destination
//  - production inputs are opponent-adjusted before entry (only a small residual inflation remains)
//  - QB adds designed-run EPA; measurables carry a timing protocol (only electronic timing is used)
//  - a behavioral / post-decision shock on every outcome, and staff-induced opportunity at Ohio State
//  - a paired outcome: opportunity (usage change) + level-adjusted contribution, mapped to Table 8 classes
import { rng, sigmoid } from "./model.js";

export const POSITIONS = {
  WR: { name: "Wide receivers", m1: { k: "Opp-adj. yards per route run", unit: "", mu: 1.9, sd: 0.55, dec: 2 }, m2: { k: "Opp-adj. target share", unit: "%", mu: 19, sd: 6, dec: 0 } },
  CB: { name: "Cornerbacks", m1: { k: "Opp-adj. yards per cover snap", unit: "", mu: 1.05, sd: 0.3, dec: 2, lowerBetter: true }, m2: { k: "Opp-adj. forced incompletion rate", unit: "%", mu: 14, sd: 5, dec: 0 } },
  EDGE: { name: "Edge rushers", m1: { k: "Opp-adj. pressure rate", unit: "%", mu: 12, sd: 3.5, dec: 1 }, m2: { k: "Opp-adj. run-stop rate", unit: "%", mu: 7.5, sd: 2.4, dec: 1 } },
  OT: { name: "Offensive tackles", m1: { k: "Opp-adj. pressure allowed rate", unit: "%", mu: 4.2, sd: 1.5, dec: 1, lowerBetter: true }, m2: { k: "Opp-adj. run-block success", unit: "%", mu: 61, sd: 7, dec: 0 } },
  RB: { name: "Running backs", m1: { k: "Opp-adj. yards after contact / att", unit: "", mu: 3.2, sd: 0.6, dec: 2 }, m2: { k: "Opp-adj. rush success rate", unit: "%", mu: 44, sd: 6, dec: 0 } },
  QB: { name: "Quarterbacks", m1: { k: "Opp-adj. EPA per dropback", unit: "", mu: 0.14, sd: 0.12, dec: 2 }, m2: { k: "Designed-run EPA per carry", unit: "", mu: 0.05, sd: 0.15, dec: 2 } },
};
export const JUMPS = ["P4→P4", "G5→P4", "FCS→P4"];
export const JUMP_LONG = { "P4→P4": "Power-4 to Power-4", "G5→P4": "Group-of-5 to Power-4", "FCS→P4": "FCS to Power-4" };
// Arrival classes with completed season-1 outcomes. The Jan 2027 window is the live, unlabelled class.
export const CYCLES = [
  { id: 2023, label: "2023 class", window: "Dec 2022 + spring 2023 windows", seasons: 2 },
  { id: 2024, label: "2024 class", window: "Dec 2023 + spring 2024 windows", seasons: 2 },
  { id: 2025, label: "2025 class", window: "Dec 2024 + spring 2025 windows", seasons: 1 },
];
// prov = where the value comes from; valid = what is known about its measurement quality (Assessment, Table 4)
export const FEATURES = [
  { k: "gap", block: "Program context", label: "Program rating gap (dest − origin, SP+-style pts)", cls: "observed", prov: "Public team ratings (SP+ / Elo / talent)", valid: { l: "Public, reproducible", c: "high" } },
  { k: "ret", block: "Program context", label: "Returning production at position, destination", cls: "observed", prov: "Public returning-production data", valid: { l: "Public; usage-based", c: "high" } },
  { k: "inc", block: "Program context", label: "Same-position transfers in, same cycle", cls: "observed", prov: "Portal destination records", valid: { l: "Public count", c: "high" } },
  { k: "hc", block: "Program context", label: "Head-coach change at destination (0/1)", cls: "observed", prov: "Public coaching records", valid: { l: "Public; coordinator changes not yet coded", c: "partial" } },
  { k: "m1", block: "Production", label: "Production metric 1", cls: "observed", prov: "Play-by-play, opponent-adjusted before entry", valid: { l: "Reliability varies by metric", c: "partial" } },
  { k: "m2", block: "Production", label: "Production metric 2", cls: "observed", prov: "Play-by-play, opponent-adjusted before entry", valid: { l: "Reliability varies by metric", c: "partial" } },
  { k: "rating", block: "Production", label: "Industry portal rating", cls: "observed", prov: "Recruiting services", valid: { l: "Validity shown at team level only", c: "partial" } },
  { k: "film", block: "Film", label: "Film grade (0–100)", cls: "observed", prov: "Licensed grading provider", valid: { l: "No published reliability", c: "weak" } },
  { k: "ath", block: "Measurables", label: "Athletic composite (0–10), electronic timing only", cls: "observed", prov: "Camp / pro-day / staff testing", valid: { l: "Weak; protocol-dependent", c: "weak" } },
  { k: "snap", block: "Experience", label: "Prior-season snap share", cls: "observed", prov: "Participation charts", valid: { l: "Observed count", c: "high" } },
  { k: "elig", block: "Experience", label: "Eligibility remaining (yrs)", cls: "observed", prov: "Administrative record", valid: { l: "Administrative record", c: "high" } },
  { k: "inj", block: "Availability", label: "Games missed, last 2 seasons", cls: "observed", prov: "Public box scores (counts only)", valid: { l: "Incomplete; reasons unknown", c: "partial" } },
  { k: "staff", block: "Staff evaluation", label: "Staff evaluation (1–5)", cls: "staff", prov: "OSU personnel staff", valid: { l: "Reliability unmeasured", c: "unmeasured" } },
];
export const BLOCKS = ["Program context", "Production", "Film", "Measurables", "Experience", "Availability", "Staff evaluation"];
export const PLAYER_BLOCKS = BLOCKS.slice(1);
export const DEST_OSU = "Ohio State";
// Synthetic Ohio State context for the January 2027 board (illustrative, not real roster data)
export const OSU_CONTEXT = { rating: 27, ret: { WR: 0.62, CB: 0.41, EDGE: 0.55, OT: 0.48, RB: 0.35, QB: 0.7 }, inc: { WR: 2, CB: 1, EDGE: 1, OT: 2, RB: 1, QB: 0 }, hc: 0 };

const FIRST = ["Jalen","Marcus","Dorian","Tre","Isaiah","Malik","Caleb","Xavier","Darius","Elijah","Jaylen","Andre","Cameron","Devin","Micah","Trey","Josiah","Brandon","Keon","Amari","Zion","Quentin","Roman","Silas","Bryce","Nolan","Grant","Tyson","Kendall","Rashad","Owen","Luca","Desmond","Kai","Jordan","Mason","Theo","Emmett","Corbin","Reggie","Dante","Sterling","Lamar","Kobe","Ty","Jace","Bennett","Hollis","Ezra","Brooks"];
const LAST = ["Whitfield","Okafor","Brannon","Castellano","Pruitt","Delacroix","Hargrove","Mbeki","Stroud-Lane","Vance","Holloway","Fairley","Ashby","Kimbrough","Rutledge","Osei","Lindqvist","Tolliver","Marchetti","Sandoval","Abernathy","Quarles","Penrose","Wakefield","Oduya","Garrison","Teague","Ellsworth","Blackwood","Nakamura","Fontaine","Calloway","Redmond","Saylor","Booker","Dunleavy","Archer","Prescott","Langford","Mercer","Hawthorne","Ibarra","Kessler","Montague","Ridley","Steward","Thorne","Yates","Ambrose","Colquitt"];
const PROGRAMS = {
  P4: ["Northern Lakes", "Bayou State", "Cascade", "Ridgeview", "Tidewater", "Prairie A&M", "Summit State", "Granite U", "Pinecrest", "Riverbend", "Ironwood", "Harbor State"],
  G5: ["Desert Valley", "Red Mesa", "Gulf Plains", "Sierra Tech", "Bluewater", "High Plains", "Canyon State", "Lowland", "Mountain West Tech", "Port City"],
  FCS: ["Millbrook", "Fort Hollis", "Cedar Falls Tech", "Whitmore", "Stony Creek", "Elk Ridge", "Bramble", "Ashford"],
};
export const DEST_PROGRAMS = [...PROGRAMS.P4, DEST_OSU];
export const ORIGIN_PROGRAMS = [...PROGRAMS.P4, ...PROGRAMS.G5, ...PROGRAMS.FCS];
const TIER_OF_JUMP = { "P4→P4": "P4", "G5→P4": "G5", "FCS→P4": "FCS" };
const TIER_RATING = { P4: [9, 8], G5: [-7, 6], FCS: [-23, 6] };   // mean, sd of program rating
const INFL = { "P4→P4": 0, "G5→P4": 0.45, "FCS→P4": 0.9 };        // raw stat inflation from weaker competition
const POS_BASE = { WR: -0.05, CB: -0.12, EDGE: 0.0, OT: 0.1, RB: -0.1, QB: -0.3 };
const PROTOCOLS = ["electronic", "electronic", "hand-timed", "self-reported"];

const clip = (x, a, b) => Math.max(a, Math.min(b, x));
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

// fixed (hidden) program effects
function programEffects() {
  const R = rng(5150);
  const dest = Object.fromEntries(DEST_PROGRAMS.map((p) => [p, 0.35 * R.n()]));
  dest[DEST_OSU] = 0.3;   // a modest positive destination development effect, to be estimated
  const orig = Object.fromEntries(ORIGIN_PROGRAMS.map((p) => [p, 0.2 * R.n()]));
  const rating = {};
  for (const [t, list] of Object.entries(PROGRAMS)) for (const p of list) rating[p] = round(TIER_RATING[t][0] + TIER_RATING[t][1] * R.n(), 1);
  rating[DEST_OSU] = OSU_CONTEXT.rating;
  return { dest, orig, rating };
}
const PE = programEffects();
export const PROGRAM_RATING = PE.rating;

export const moveDir = (gap) => (gap > 6 ? "Up" : gap < -6 ? "Down" : "Lateral");

function makePlayer(R, pos, cycle, i, live) {
  const P = POSITIONS[pos];
  const u = R.u();
  const jump = u < 0.45 ? "P4→P4" : u < 0.85 ? "G5→P4" : "FCS→P4";
  const tier = TIER_OF_JUMP[jump];
  const T = R.n() * (live ? 1.05 : 1);
  const infl = INFL[jump];
  const tierList = PROGRAMS[tier];
  const from = tierList[Math.floor(R.u() * tierList.length)];
  const dest = live ? DEST_OSU : R.u() < 0.1 ? DEST_OSU : PROGRAMS.P4[Math.floor(R.u() * PROGRAMS.P4.length)];
  const gap = round(PE.rating[dest] - PE.rating[from], 1);
  const ret = live ? OSU_CONTEXT.ret[pos] : round(clip(0.5 + 0.18 * R.n(), 0.05, 0.95), 2);
  const inc = live ? OSU_CONTEXT.inc[pos] : Math.min(4, Math.floor(-Math.log(R.u()) * 1.2));
  const hc = live ? OSU_CONTEXT.hc : R.u() < 0.18 ? 1 : 0;
  const prodTrue1 = 0.72 * T + 0.69 * R.n();
  const prodTrue2 = 0.6 * T + 0.8 * R.n();
  // opponent adjustment removes most of the competition inflation before entry
  const z1 = prodTrue1 + 0.2 * infl, z2 = prodTrue2 + 0.15 * infl;
  const m1 = round(P.m1.mu + (P.m1.lowerBetter ? -1 : 1) * z1 * P.m1.sd, P.m1.dec);
  const m2 = round(P.m2.mu + z2 * P.m2.sd, P.m2.dec);
  const filmMissP = { P4: 0.05, G5: 0.15, FCS: 0.35 }[tier];
  const film = R.u() < filmMissP ? null : round(clip(68 + 8 * (0.78 * T + 0.55 * R.n() + 0.25 * infl), 40, 95), 1);
  const athMiss = R.u() < 0.2;
  const athProto = athMiss ? null : PROTOCOLS[Math.floor(R.u() * PROTOCOLS.length)];
  const protoBias = athProto === "hand-timed" ? 0.5 : athProto === "self-reported" ? 0.9 : 0;
  const protoNoise = athProto === "electronic" ? 0.86 : 1.4;
  const athRaw = athMiss ? null : round(clip(6.4 + 1.7 * (0.5 * T + protoNoise * R.n() + protoBias), 1, 10), 2);
  const ath = athProto === "electronic" ? athRaw : null;   // restrict to electronic timing (Rec. 8)
  const snap = round(clip(sigmoid(0.55 * T + 0.5 * infl + 0.2 + 0.6 * R.n()), 0.08, 0.98), 2);
  const elig = 1 + Math.floor(R.u() * 3);
  let inj = 0; while (R.u() < 0.38 && inj < 14) inj += 1 + Math.floor(R.u() * 2);
  const rating = round(clip(0.86 + 0.028 * (0.45 * T + 0.55 * (prodTrue1 + infl + prodTrue2 + 0.8 * infl) / 2 + 0.55 * R.n()), 0.8, 0.995), 4);
  const stars = rating >= 0.95 ? 4 : rating >= 0.88 ? 3 : 2;
  const staffSeen = R.u() < (live ? 0.55 : 0.58);
  const staff = staffSeen ? clip(Math.round(2 * (3 + 0.85 * (0.72 * T + 0.66 * R.n()))) / 2, 1, 5) : null;
  const name = FIRST[Math.floor(R.u() * FIRST.length)] + " " + LAST[Math.floor(R.u() * LAST.length)];
  const p = {
    id: `${pos}-${cycle}-${String(i + 1).padStart(3, "0")}`, name, pos, cycle, jump, tier, from, dest,
    originRating: PE.rating[from], destRating: PE.rating[dest], gap, dir: moveDir(gap), ret, inc, hc,
    m1, m2, film, ath, athRaw, athProto, snap, elig, inj, rating, stars, staff,
    height: pos === "OT" ? 77 + Math.floor(R.u() * 3) : pos === "EDGE" ? 75 + Math.floor(R.u() * 3) : pos === "CB" ? 70 + Math.floor(R.u() * 4) : 71 + Math.floor(R.u() * 5),
    weight: { WR: 190, CB: 185, EDGE: 252, OT: 312, RB: 210, QB: 218 }[pos] + Math.round(R.n() * 10),
  };
  if (!live) {
    const behav = 0.55 * R.n();                       // behavioral / post-decision shock (fit, adjustment, NIL, coaching)
    const perf = 0.95 * T - 0.022 * gap + POS_BASE[pos] + 0.14 * (elig - 2) - 0.07 * inj
      + PE.dest[dest] + PE.orig[from] - 0.9 * (ret - 0.5) - 0.12 * inc - 0.25 * hc + behav + 0.35 * R.n();
    // staff-induced opportunity: at Ohio State, the staff that graded him also decides his snaps
    const staffPush = dest === DEST_OSU && staff !== null ? 0.35 * (staff - 3) : 0;
    const snapShare1 = round(clip(sigmoid(1.3 * perf + 0.1 + staffPush + 0.35 * R.n()), 0.0, 0.99), 2);
    const contrib1 = round(0.8 * (perf + 0.022 * gap) + 0.55 * R.n(), 2);   // level-adjusted contribution (z vs expectation for the move)
    p.out = {
      snapShare1,
      grade1: round(clip(66 + 7.5 * perf + 3 * R.n(), 35, 93), 1),
      contrib1,
      rawContrib1: round(contrib1 - 0.03 * gap, 2),
      retained2: elig >= 2 && CYCLES.find((c) => c.id === cycle).seasons >= 2 ? (R.u() < sigmoid(0.6 + 1.0 * perf) ? 1 : 0) : null,
    };
    p.out.oppChange = round(snapShare1 - snap, 2);
    p.out.cls = outcomeClass(p);
  }
  return p;
}

// ---------- Table 8 outcome classes: move direction x play-and-contribution ----------
export const OUTCOME_GRID = {
  Up: { More: "Ascent", Similar: "Step-up held", Less: "Absorbed" },
  Lateral: { More: "Opportunity gain", Similar: "Lateral move", Less: "Displacement" },
  Down: { More: "Opportunity transfer", Similar: "Relocation", Less: "Decline" },
};
export function playBand(p) {
  const o = p.out; if (!o) return null;
  if (o.oppChange <= -0.15 || o.contrib1 < -0.6) return "Less";
  if (o.oppChange >= 0.1 && o.contrib1 >= 0) return "More";
  return "Similar";
}
export function outcomeClass(p) { const b = playBand(p); return b ? OUTCOME_GRID[p.dir][b] : null; }

export function generate() {
  const R = rng(20261104);
  const history = [], board = [];
  for (const pos of Object.keys(POSITIONS)) {
    for (const c of CYCLES) for (let i = 0; i < 150; i++) history.push(makePlayer(R, pos, c.id, i, false));
    for (let i = 0; i < 40; i++) {
      const p = makePlayer(R, pos, 2027, i, true);
      p.id = `${pos}-W27-${String(i + 1).padStart(3, "0")}`;
      board.push(p);
    }
  }
  return { history, board };
}

// ---------- success definitions (versioned rules) ----------
// verif: can the criterion be checked on historical data from public sources? (Assessment, Sec. 8.5)
// usesGrade: criterion is a provider grade -> the same provider's film grade is removed as a predictor (Rec. 2)
export const DEFS = {
  paired: { label: "Paired: opportunity + contribution", short: "Held or gained his role, and level-adjusted contribution at or above expectation for the move", verif: { l: "Partly public: offense via usage + PPA; defense needs licensed data", c: "partial" } },
  starter: { label: "Starter snaps", short: "≥ {snap}% of snaps in season 1", verif: { l: "Needs licensed snap counts", c: "weak" } },
  grade: { label: "Grade threshold", short: "Season-1 grade ≥ {grade}", verif: { l: "Licensed grade; film predictor removed", c: "weak" }, usesGrade: true },
  composite: { label: "Starter + grade", short: "≥ {snap}% snaps and grade ≥ {grade}", verif: { l: "Licensed snaps and grade; film predictor removed", c: "weak" }, usesGrade: true },
  retained: { label: "Two years on roster", short: "On roster through two seasons", verif: { l: "Publicly verifiable (rosters)", c: "high" } },
  contribution: { label: "Contribution only", short: "Level-adjusted contribution at or above expectation (a criterion the staff does not control)", verif: { l: "Partly public (PPA for offense)", c: "partial" } },
};
export function label(def, th, p) {
  const o = p.out; if (!o) return null;
  if (def === "paired") { const b = playBand(p); return b === "More" || b === "Similar" ? 1 : 0; }
  if (def === "starter") return o.snapShare1 >= th.snap / 100 ? 1 : 0;
  if (def === "grade") return o.grade1 >= th.grade ? 1 : 0;
  if (def === "composite") return o.snapShare1 >= th.snap / 100 && o.grade1 >= th.grade ? 1 : 0;
  if (def === "retained") return o.retained2;
  if (def === "contribution") return o.contrib1 >= 0 ? 1 : 0;
  return null;
}
export const defText = (def, th) => DEFS[def].short.replace("{snap}", th.snap).replace("{grade}", th.grade);
