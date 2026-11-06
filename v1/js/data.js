// Synthetic transfer-portal universe. Fictional players and programs; deterministic seed.
// Generative story (hidden from the model): each transfer has a latent talent T.
// Public stats are inflated by weaker competition; film graders partly adjust; the jump to a
// Power-4 roster costs FCS and G5 players performance. The model has to learn all of that from data.
import { rng, sigmoid } from "./model.js";

export const POSITIONS = {
  WR: { name: "Wide receivers", m1: { k: "Yards per route run", unit: "", mu: 1.9, sd: 0.55, dec: 2 }, m2: { k: "Target share", unit: "%", mu: 19, sd: 6, dec: 0 } },
  CB: { name: "Cornerbacks", m1: { k: "Yards allowed per cover snap", unit: "", mu: 1.05, sd: 0.3, dec: 2, lowerBetter: true }, m2: { k: "Forced incompletion rate", unit: "%", mu: 14, sd: 5, dec: 0 } },
  EDGE: { name: "Edge rushers", m1: { k: "Pressure rate", unit: "%", mu: 12, sd: 3.5, dec: 1 }, m2: { k: "Run-stop rate", unit: "%", mu: 7.5, sd: 2.4, dec: 1 } },
  OT: { name: "Offensive tackles", m1: { k: "Pressure allowed rate", unit: "%", mu: 4.2, sd: 1.5, dec: 1, lowerBetter: true }, m2: { k: "Run-block success", unit: "%", mu: 61, sd: 7, dec: 0 } },
  RB: { name: "Running backs", m1: { k: "Yards after contact / att", unit: "", mu: 3.2, sd: 0.6, dec: 2 }, m2: { k: "Rush success rate", unit: "%", mu: 44, sd: 6, dec: 0 } },
  QB: { name: "Quarterbacks", m1: { k: "EPA per dropback", unit: "", mu: 0.14, sd: 0.12, dec: 2 }, m2: { k: "Adjusted completion", unit: "%", mu: 72, sd: 5, dec: 0 } },
};
export const JUMPS = ["P4→P4", "G5→P4", "FCS→P4"];
export const JUMP_LONG = { "P4→P4": "Power-4 to Power-4", "G5→P4": "Group-of-5 to Power-4", "FCS→P4": "FCS to Power-4" };
// Arrival classes with completed season-1 outcomes. The Jan 2026 class is mid-season (live test, not labelled).
export const CYCLES = [
  { id: 2023, label: "2023 class", window: "Dec 2022 + spring 2023 windows", seasons: 2 },
  { id: 2024, label: "2024 class", window: "Dec 2023 + spring 2024 windows", seasons: 2 },
  { id: 2025, label: "2025 class", window: "Dec 2024 + spring 2025 windows", seasons: 1 },
];
export const FEATURES = [
  { k: "m1", block: "Production", label: "Production metric 1", cls: "observed" },
  { k: "m2", block: "Production", label: "Production metric 2", cls: "observed" },
  { k: "rating", block: "Production", label: "Industry portal rating", cls: "observed" },
  { k: "film", block: "Film", label: "Film grade (0–100)", cls: "observed" },
  { k: "ath", block: "Measurables", label: "Athletic composite (0–10)", cls: "observed" },
  { k: "snap", block: "Experience", label: "Prior-season snap share", cls: "observed" },
  { k: "elig", block: "Experience", label: "Eligibility remaining (yrs)", cls: "observed" },
  { k: "inj", block: "Availability", label: "Games missed, last 2 seasons", cls: "observed" },
  { k: "staff", block: "Staff evaluation", label: "Staff evaluation (1–5)", cls: "staff" },
];
export const BLOCKS = ["Production", "Film", "Measurables", "Experience", "Availability", "Staff evaluation"];

const FIRST = ["Jalen","Marcus","Dorian","Tre","Isaiah","Malik","Caleb","Xavier","Darius","Elijah","Jaylen","Andre","Cameron","Devin","Micah","Trey","Josiah","Brandon","Keon","Amari","Zion","Quentin","Roman","Silas","Bryce","Nolan","Grant","Tyson","Kendall","Rashad","Owen","Luca","Desmond","Kai","Jordan","Mason","Theo","Emmett","Corbin","Reggie","Dante","Sterling","Lamar","Kobe","Ty","Jace","Bennett","Hollis","Ezra","Brooks"];
const LAST = ["Whitfield","Okafor","Brannon","Castellano","Pruitt","Delacroix","Hargrove","Mbeki","Stroud-Lane","Vance","Holloway","Fairley","Ashby","Kimbrough","Rutledge","Osei","Lindqvist","Tolliver","Marchetti","Sandoval","Abernathy","Quarles","Penrose","Wakefield","Oduya","Garrison","Teague","Ellsworth","Blackwood","Nakamura","Fontaine","Calloway","Redmond","Saylor","Booker","Dunleavy","Archer","Prescott","Langford","Mercer","Hawthorne","Ibarra","Kessler","Montague","Ridley","Steward","Thorne","Yates","Ambrose","Colquitt"];
const PROGRAMS = {
  P4: ["Northern Lakes", "Bayou State", "Cascade", "Ridgeview", "Tidewater", "Prairie A&M", "Summit State", "Granite U", "Pinecrest", "Riverbend", "Ironwood", "Harbor State"],
  G5: ["Desert Valley", "Red Mesa", "Gulf Plains", "Sierra Tech", "Bluewater", "High Plains", "Canyon State", "Lowland", "Mountain West Tech", "Port City"],
  FCS: ["Millbrook", "Fort Hollis", "Cedar Falls Tech", "Whitmore", "Stony Creek", "Elk Ridge", "Bramble", "Ashford"],
};
const TIER_OF_JUMP = { "P4→P4": "P4", "G5→P4": "G5", "FCS→P4": "FCS" };
const INFL = { "P4→P4": 0, "G5→P4": 0.45, "FCS→P4": 0.9 };       // stat inflation from weaker competition
const PENALTY = { "P4→P4": 0, "G5→P4": -0.4, "FCS→P4": -0.85 };  // true cost of the jump
const POS_BASE = { WR: -0.05, CB: -0.12, EDGE: 0.0, OT: 0.1, RB: -0.1, QB: -0.3 };

const clip = (x, a, b) => Math.max(a, Math.min(b, x));
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

function makePlayer(R, pos, cycle, i, live) {
  const P = POSITIONS[pos];
  const u = R.u();
  const jump = u < 0.45 ? "P4→P4" : u < 0.85 ? "G5→P4" : "FCS→P4";
  const tier = TIER_OF_JUMP[jump];
  const T = R.n() * (live ? 1.05 : 1);
  const infl = INFL[jump];
  const prodTrue1 = 0.72 * T + 0.69 * R.n();
  const prodTrue2 = 0.6 * T + 0.8 * R.n();
  const z1 = prodTrue1 + infl, z2 = prodTrue2 + 0.8 * infl;
  const m1 = round(P.m1.mu + (P.m1.lowerBetter ? -1 : 1) * z1 * P.m1.sd, P.m1.dec);
  const m2 = round(P.m2.mu + z2 * P.m2.sd, P.m2.dec);
  const filmMissP = { P4: 0.05, G5: 0.15, FCS: 0.35 }[tier];
  const film = R.u() < filmMissP ? null : round(clip(68 + 8 * (0.78 * T + 0.55 * R.n() + 0.25 * infl), 40, 95), 1);
  const ath = R.u() < 0.3 ? null : round(clip(6.4 + 1.7 * (0.5 * T + 0.86 * R.n()), 1, 10), 2);
  const snap = round(clip(sigmoid(0.55 * T + 0.5 * infl + 0.2 + 0.6 * R.n()), 0.08, 0.98), 2);
  const elig = 1 + Math.floor(R.u() * 3);
  let inj = 0; while (R.u() < 0.38 && inj < 14) inj += 1 + Math.floor(R.u() * 2);
  const rating = round(clip(0.86 + 0.028 * (0.45 * T + 0.55 * (z1 + z2) / 2 + 0.55 * R.n()), 0.8, 0.995), 4);
  const stars = rating >= 0.95 ? 4 : rating >= 0.88 ? 3 : 2;
  const staffSeen = R.u() < (live ? 0.55 : 0.58);
  const staff = staffSeen ? clip(Math.round(2 * (3 + 0.85 * (0.72 * T + 0.66 * R.n()))) / 2, 1, 5) : null;
  const tierList = PROGRAMS[tier];
  const from = tierList[Math.floor(R.u() * tierList.length)];
  const name = FIRST[Math.floor(R.u() * FIRST.length)] + " " + LAST[Math.floor(R.u() * LAST.length)];
  const p = {
    id: `${pos}-${cycle}-${String(i + 1).padStart(3, "0")}`, name, pos, cycle, jump, tier, from,
    m1, m2, film, ath, snap, elig, inj, rating, stars, staff,
    height: pos === "OT" ? 77 + Math.floor(R.u() * 3) : pos === "EDGE" ? 75 + Math.floor(R.u() * 3) : pos === "CB" ? 70 + Math.floor(R.u() * 4) : 71 + Math.floor(R.u() * 5),
    weight: { WR: 190, CB: 185, EDGE: 252, OT: 312, RB: 210, QB: 218 }[pos] + Math.round(R.n() * 10),
  };
  if (!live) {
    // outcomes in the first season at the new Power-4 program
    const perf = 0.95 * T + PENALTY[jump] + POS_BASE[pos] + 0.14 * (elig - 2) - 0.07 * inj + 0.62 * R.n();
    p.out = {
      snapShare1: round(clip(sigmoid(1.3 * perf + 0.1 + 0.35 * R.n()), 0.0, 0.99), 2),
      grade1: round(clip(66 + 7.5 * perf + 3 * R.n(), 35, 93), 1),
      // two-season retention only observable for classes with two completed seasons and elig >= 2
      retained2: elig >= 2 && CYCLES.find((c) => c.id === cycle).seasons >= 2 ? (R.u() < sigmoid(0.6 + 1.0 * perf) ? 1 : 0) : null,
    };
  }
  return p;
}

export function generate() {
  const R = rng(20261028);
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
export const DEFS = {
  starter: { label: "Starter snaps", short: "≥ {snap}% of snaps in season 1", needs: "snap" },
  grade: { label: "Grade threshold", short: "Season-1 grade ≥ {grade}", needs: "grade" },
  composite: { label: "Starter + grade", short: "≥ {snap}% snaps and grade ≥ {grade}", needs: "both" },
  retained: { label: "Two years on roster", short: "On roster through two seasons", needs: "retain" },
};
export function label(def, th, p) {
  const o = p.out; if (!o) return null;
  if (def === "starter") return o.snapShare1 >= th.snap / 100 ? 1 : 0;
  if (def === "grade") return o.grade1 >= th.grade ? 1 : 0;
  if (def === "composite") return o.snapShare1 >= th.snap / 100 && o.grade1 >= th.grade ? 1 : 0;
  if (def === "retained") return o.retained2;
  return null;
}
export const defText = (def, th) => DEFS[def].short.replace("{snap}", th.snap).replace("{grade}", th.grade);
