// Recruiting Platform (v3) — synthetic national data + per-program settings.
// Every prospect, school and coach here is fictional. Distances use state centers and are estimates.
import { rng } from "../model.js";

// state: [name, lat, lon, tileRow, tileCol, talentWeight, region]
export const STATES = {
  AK: ["Alaska", 64.2, -149.5, 0, 0, 0.2, "West"], ME: ["Maine", 45.3, -69.2, 0, 11, 0.3, "Northeast"],
  VT: ["Vermont", 44.0, -72.7, 1, 10, 0.2, "Northeast"], NH: ["New Hampshire", 43.7, -71.6, 1, 11, 0.3, "Northeast"],
  WA: ["Washington", 47.4, -120.5, 2, 1, 1.6, "West"], ID: ["Idaho", 44.1, -114.7, 2, 2, 0.6, "West"], MT: ["Montana", 47.0, -109.6, 2, 3, 0.4, "West"],
  ND: ["North Dakota", 47.5, -100.5, 2, 4, 0.3, "Midwest"], MN: ["Minnesota", 46.3, -94.3, 2, 5, 1.2, "Midwest"], IL: ["Illinois", 40.0, -89.2, 2, 6, 2.6, "Midwest"],
  WI: ["Wisconsin", 44.6, -89.9, 2, 7, 1.1, "Midwest"], MI: ["Michigan", 44.3, -85.4, 2, 8, 2.8, "Midwest"], NY: ["New York", 42.9, -75.5, 2, 9, 1.9, "Northeast"],
  RI: ["Rhode Island", 41.7, -71.5, 2, 10, 0.2, "Northeast"], MA: ["Massachusetts", 42.3, -71.8, 2, 11, 1.0, "Northeast"],
  OR: ["Oregon", 43.9, -120.6, 3, 1, 1.1, "West"], NV: ["Nevada", 39.3, -116.6, 3, 2, 1.1, "West"], WY: ["Wyoming", 43.0, -107.6, 3, 3, 0.2, "West"],
  SD: ["South Dakota", 44.4, -100.2, 3, 4, 0.3, "Midwest"], IA: ["Iowa", 42.1, -93.5, 3, 5, 1.1, "Midwest"], IN: ["Indiana", 39.9, -86.3, 3, 6, 2.4, "Midwest"],
  OH: ["Ohio", 40.3, -82.8, 3, 7, 5.2, "Midwest"], PA: ["Pennsylvania", 40.9, -77.8, 3, 8, 3.6, "Northeast"], NJ: ["New Jersey", 40.2, -74.7, 3, 9, 2.6, "Northeast"],
  CT: ["Connecticut", 41.6, -72.7, 3, 10, 0.6, "Northeast"],
  CA: ["California", 37.2, -119.5, 4, 1, 6.4, "West"], UT: ["Utah", 39.3, -111.7, 4, 2, 1.3, "West"], CO: ["Colorado", 39.0, -105.5, 4, 3, 1.2, "West"],
  NE: ["Nebraska", 41.5, -99.8, 4, 4, 0.6, "Midwest"], MO: ["Missouri", 38.4, -92.5, 4, 5, 1.9, "Midwest"], KY: ["Kentucky", 37.5, -85.3, 4, 6, 1.3, "South"],
  WV: ["West Virginia", 38.6, -80.6, 4, 7, 0.6, "South"], VA: ["Virginia", 37.5, -78.9, 4, 8, 2.5, "South"], MD: ["Maryland", 39.0, -76.8, 4, 9, 2.4, "Northeast"],
  DE: ["Delaware", 39.0, -75.5, 4, 10, 0.3, "Northeast"],
  AZ: ["Arizona", 34.3, -111.7, 5, 2, 2.0, "West"], NM: ["New Mexico", 34.4, -106.1, 5, 3, 0.5, "West"], KS: ["Kansas", 38.5, -98.4, 5, 4, 0.9, "Midwest"],
  AR: ["Arkansas", 34.9, -92.4, 5, 5, 1.3, "South"], TN: ["Tennessee", 35.9, -86.4, 5, 6, 2.6, "South"], NC: ["North Carolina", 35.6, -79.4, 5, 7, 3.2, "South"],
  SC: ["South Carolina", 33.9, -80.9, 5, 8, 2.1, "South"],
  OK: ["Oklahoma", 35.6, -97.5, 6, 4, 1.7, "South"], LA: ["Louisiana", 31.1, -92.0, 6, 5, 3.0, "South"], MS: ["Mississippi", 32.7, -89.7, 6, 6, 2.0, "South"],
  AL: ["Alabama", 32.8, -86.8, 6, 7, 3.0, "South"], GA: ["Georgia", 32.7, -83.4, 6, 8, 5.4, "South"],
  HI: ["Hawaii", 20.8, -156.3, 7, 0, 0.5, "West"], TX: ["Texas", 31.5, -99.3, 7, 4, 8.5, "South"], FL: ["Florida", 28.6, -82.4, 7, 9, 7.6, "South"],
};

export const POS = ["QB", "RB", "WR", "TE", "OT", "IOL", "EDGE", "DT", "LB", "CB", "S"];
export const POS_NAME = { QB: "Quarterback", RB: "Running back", WR: "Wide receiver", TE: "Tight end", OT: "Offensive tackle", IOL: "Interior line", EDGE: "Edge rusher", DT: "Defensive tackle", LB: "Linebacker", CB: "Cornerback", S: "Safety" };
export const POS_ALIASES = { QB: ["qb", "qbs", "quarterback", "quarterbacks"], RB: ["rb", "rbs", "running back", "running backs", "tailback", "tailbacks"], WR: ["wr", "wrs", "receiver", "receivers", "wide receiver", "wide receivers", "wideouts"], TE: ["te", "tes", "tight end", "tight ends"], OT: ["ot", "ots", "tackle", "tackles", "offensive tackle", "offensive tackles"], IOL: ["iol", "guard", "guards", "center", "centers", "interior line", "interior linemen"], EDGE: ["edge", "edges", "edge rusher", "edge rushers", "pass rusher", "pass rushers", "defensive end", "defensive ends"], DT: ["dt", "dts", "defensive tackle", "defensive tackles", "nose tackle"], LB: ["lb", "lbs", "linebacker", "linebackers"], CB: ["cb", "cbs", "corner", "corners", "cornerback", "cornerbacks"], S: ["safety", "safeties"] };

// trait lists: [name, critical?]
export const TRAITS = {
  QB: [["Accuracy", 1], ["Decision-making", 1], ["Arm strength", 0], ["Pocket movement", 0], ["Processing speed", 0]],
  RB: [["Vision", 1], ["Contact balance", 1], ["Burst", 0], ["Hands", 0], ["Pass protection", 0]],
  WR: [["Release", 1], ["Hands", 1], ["Route running", 0], ["Separation", 0], ["Run after catch", 0]],
  TE: [["Hands", 1], ["In-line blocking", 1], ["Route running", 0], ["Size and length", 0]],
  OT: [["Pass set", 1], ["Anchor", 1], ["Hand use", 0], ["Feet and length", 0]],
  IOL: [["Anchor", 1], ["Hand use", 1], ["Run-block drive", 0], ["Pull and move", 0]],
  EDGE: [["First step", 1], ["Bend", 1], ["Hand use", 0], ["Run defense", 0], ["Motor", 0]],
  DT: [["Get-off", 1], ["Anchor", 1], ["Hand use", 0], ["Pursuit", 0]],
  LB: [["Instincts", 1], ["Tackling", 1], ["Range", 0], ["Coverage", 0]],
  CB: [["Man coverage", 1], ["Hip fluidity", 1], ["Ball skills", 0], ["Tackling", 0], ["Zone eyes", 0]],
  S: [["Range", 1], ["Tackling", 1], ["Ball skills", 0], ["Communication", 0]],
};
// HS position norms: ht(in), wt, forty, vert(in), shuttle — mean, sd
export const NORMS = {
  QB: [74.5, 205, 4.82, 30, 4.35], RB: [70.5, 200, 4.55, 33, 4.25], WR: [72.5, 185, 4.55, 34, 4.2], TE: [76, 235, 4.78, 31, 4.38],
  OT: [77.5, 295, 5.25, 26, 4.75], IOL: [75.5, 295, 5.3, 25, 4.8], EDGE: [75.5, 240, 4.72, 31, 4.38], DT: [75, 285, 5.0, 28, 4.6],
  LB: [73.5, 220, 4.68, 32, 4.3], CB: [71.5, 180, 4.52, 35, 4.15], S: [72.5, 195, 4.58, 34, 4.2],
};
const SD = [1.6, 0.09, 0.14, 3.2, 0.16]; // ht, wt fraction, forty, vert, shuttle
const PRODUCTION_STAT = { QB: "pass yds", RB: "rush yds", WR: "rec yds", TE: "rec yds", OT: "pressures allowed", IOL: "pressures allowed", EDGE: "sacks", DT: "TFL", LB: "tackles", CB: "PBU", S: "tackles" };

export const RIVALS = ["Lakeshore State", "Great Plains", "Southern Tech", "Bayou A&M", "Pacific Coast", "Mountain State", "Tidewater", "Capital University", "Gulf Coast", "Hill Country", "Piedmont", "Northern Ridge"];
const FIRST = ["Jalen", "Marcus", "Dorian", "Tre", "Isaiah", "Malik", "Caleb", "Xavier", "Darius", "Elijah", "Jaylen", "Andre", "Cameron", "Devin", "Micah", "Trey", "Josiah", "Brandon", "Keon", "Amari", "Zion", "Quentin", "Roman", "Silas", "Bryce", "Nolan", "Grant", "Tyson", "Kendall", "Rashad", "Owen", "Luca", "Desmond", "Kai", "Jordan", "Mason", "Theo", "Emmett", "Corbin", "Reggie", "Dante", "Sterling", "Lamar", "Kobe", "Ty", "Jace", "Bennett", "Hollis", "Ezra", "Brooks", "Myles", "Kingston", "Camden", "Jabari", "Tobias", "Nico", "Ellis", "Rowan", "Cyrus", "Damon"];
const LAST = ["Whitfield", "Okafor", "Brannon", "Castellano", "Pruitt", "Delacroix", "Hargrove", "Mbeki", "Vance", "Holloway", "Fairley", "Ashby", "Kimbrough", "Rutledge", "Osei", "Lindqvist", "Tolliver", "Marchetti", "Sandoval", "Abernathy", "Quarles", "Penrose", "Wakefield", "Oduya", "Garrison", "Teague", "Ellsworth", "Blackwood", "Nakamura", "Fontaine", "Calloway", "Redmond", "Saylor", "Booker", "Dunleavy", "Archer", "Prescott", "Langford", "Mercer", "Hawthorne", "Ibarra", "Kessler", "Montague", "Ridley", "Steward", "Thorne", "Yates", "Ambrose", "Colquitt", "Bellamy", "Crenshaw", "Draper", "Easley", "Fulton", "Gaines", "Hollins", "Iverson", "Jeter", "Kinard", "Lockett"];
const HS_LEVELS = [["7A", 1.0], ["6A", 1.0], ["5A", 0.95], ["4A", 0.88], ["3A", 0.8], ["2A", 0.72], ["1A", 0.65]];
const COL_LEVELS = [["FBS P4", 1.0], ["FBS G6", 0.86], ["FCS", 0.72], ["Division II", 0.6]];
export const PIPE = ["Identified", "Evaluated", "Offered", "Visited", "Committed", "Signed"];

export const PROGRAMS = {
  "osu-demo": { name: "Ohio State (demo)", short: "OSU demo", campus: [39.9612, -82.9988], home: "OH", seed: 2027, color: "#ba0c2f" },
  "demo-state": { name: "Demo State University", short: "Demo State", campus: [33.95, -83.37], home: "GA", seed: 4410, color: "#0e7c86" },
};

export function defaultSettings(pid) {
  const pr = PROGRAMS[pid];
  return {
    program: pid, name: pr.name, home_state: pr.home, campus: { lat: pr.campus[0], lon: pr.campus[1], note: "Campus coordinates; prospect distances use state centers (estimates) until ZIP centers are loaded" },
    weights: { hs: { film: 40, production: 20, testing: 20, character: 20 }, transfer: { film: 30, production: 40, testing: 10, character: 20 } },
    traits: TRAITS, critical_minimum: 5.0, critical_ceiling: 5.9,
    two_grader: { trait_margin: 1.5, mean_margin: 1.0 },
    production: { full_credit_snaps: 400, level_penalty: 2.5 },
    measurables: { hand_timed_correction: 0.24, self_reported_credit: 0.5 },
    availability: { per_game_missed: 0.04, max_penalty: 0.6 },
    bands: { high: 0.3, medium: 0.5, low: 0.8 },
    tiers: [[8, "Blue chip"], [7, "Starter"], [6, "Contributor"], [5, "Depth"], [0, "Pass"]],
    industry_gap_flag: 1.5,
    norms: NORMS,
    var: { replacement: Object.fromEntries(POS.map((p) => [p, 5.0])), position_weight: { QB: 1.6, RB: 0.8, WR: 1.0, TE: 0.7, OT: 1.2, IOL: 0.8, EDGE: 1.3, DT: 0.9, LB: 0.8, CB: 1.0, S: 0.8 }, points_per_grade: 75 },
    roster_targets: { QB: 4, RB: 4, WR: 9, TE: 4, OT: 7, IOL: 8, EDGE: 7, DT: 7, LB: 6, CB: 8, S: 6 },
    attrition: { transfer_out_rate: 0.12 },
    budget: { pool_usd: 8000000, note: "SAMPLE pool for incoming players; the program sets the real figure" },
    fmv: { high_ratio: 1.6, low_ratio: 0.6 },
    likelihood: { intercept: -1.6, contacts: 1.4, official_visit: 1.1, unofficial_visit: 0.25, per_500_miles: -0.35, rival_offer: -0.22, in_state: 0.5, pipeline_school: 0.4, committed: 2.4, note: "Practitioner starting values. Estimates, recalibrated each year." },
    compliance: {
      note: "SAMPLE dates only. The compliance office must load the real NCAA recruiting calendar.",
      periods: [["2026-09-01", "2026-11-22", "Evaluation"], ["2026-11-23", "2026-12-01", "Contact"], ["2026-12-02", "2026-12-06", "Dead"], ["2026-12-07", "2027-01-31", "Contact"], ["2027-02-01", "2027-04-14", "Quiet"], ["2027-04-15", "2027-05-31", "Evaluation"], ["2027-06-01", "2027-07-31", "Quiet"], ["2027-08-01", "2027-08-31", "Dead"]],
      rules: { Contact: ["phone", "in_person", "home_visit", "evaluation", "campus_visit"], Evaluation: ["phone", "evaluation", "campus_visit"], Quiet: ["phone", "campus_visit"], Dead: ["phone"] },
      limits: { evaluations_per_period: 3, in_person_per_year: 6 },
    },
    territories: [
      { id: "A1", coach: "Coach R. Alvarez", states: ["OH", "MI", "IN", "KY", "WV"] },
      { id: "A2", coach: "Coach T. Bishop", states: ["PA", "NJ", "NY", "MD", "VA", "DE", "CT", "MA", "RI", "NH", "VT", "ME"] },
      { id: "A3", coach: "Coach D. Carver", states: ["GA", "FL", "SC", "NC", "AL", "TN"] },
      { id: "A4", coach: "Coach M. Duarte", states: ["TX", "LA", "OK", "AR", "MS", "KS", "MO"] },
      { id: "A5", coach: "Coach J. Ellison", states: ["CA", "AZ", "NV", "UT", "CO", "WA", "OR", "ID", "MT", "WY", "NM", "HI", "AK", "IL", "WI", "MN", "IA", "NE", "SD", "ND"] },
    ],
  };
}

const R2 = (x) => Math.round(x * 100) / 100;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function haversine(a, b, c, d) {
  const toR = Math.PI / 180, dLat = (c - a) * toR, dLon = (d - b) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a * toR) * Math.cos(c * toR) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

function pickW(R, entries) { const tot = entries.reduce((s, e) => s + e[1], 0); let x = R.u() * tot; for (const e of entries) { x -= e[1]; if (x <= 0) return e[0]; } return entries[0][0]; }

export function generateProgram(pid) {
  const pr = PROGRAMS[pid], st = defaultSettings(pid), R = rng(pr.seed);
  const stateW = Object.entries(STATES).map(([k, v]) => [k, v[5] * (k === pr.home ? 2.2 : 1)]);
  const terr = (s) => st.territories.find((t) => t.states.includes(s)) || st.territories[0];
  const used = new Set();
  const name = () => { let n; do { n = FIRST[Math.floor(R.u() * FIRST.length)] + " " + LAST[Math.floor(R.u() * LAST.length)]; } while (used.has(n)); used.add(n); return n; };
  const prospects = [];
  const mk = (i, type, cls) => {
    const pos = POS[Math.floor(R.u() * POS.length)], N = NORMS[pos];
    const state = pickW(R, stateW), S = STATES[state];
    const talent = R.n(); // latent
    const ht = Math.round(N[0] + SD[0] * (R.n() * 0.9 + 0.25 * talent));
    const wt = Math.round(N[1] * (1 + SD[1] * (R.n() * 0.9 + 0.2 * talent)) / 1) ;
    const fortyTrue = N[2] - SD[2] * (0.45 * talent + 0.85 * R.n());
    const src = pickW(R, [["laser", 0.3], ["camp", 0.2], ["hand", 0.3], ["self", 0.2]]);
    const forty = R2(src === "hand" ? fortyTrue - 0.24 + 0.04 * R.n() : src === "self" ? fortyTrue - 0.12 - 0.05 * Math.abs(R.n()) : fortyTrue);
    const vert = Math.round(N[3] + SD[3] * (0.4 * talent + 0.85 * R.n()));
    const shuttle = R2(N[4] - SD[4] * (0.35 * talent + 0.85 * R.n()));
    const lv = type === "transfer" ? pickW(R, COL_LEVELS.map((l, k) => [l, [0.35, 0.35, 0.22, 0.08][k]])) : pickW(R, HS_LEVELS.map((l, k) => [l, [0.15, 0.25, 0.2, 0.15, 0.12, 0.08, 0.05][k]]));
    const snaps = type === "transfer" ? Math.round(clamp(150 + 450 * R.u() + 120 * talent, 40, 900)) : Math.round(clamp(220 + 380 * R.u() + 60 * talent, 30, 800));
    const prodRaw = R2(clamp(5 + 1.25 * talent + 1.0 * R.n() + (1 - lv[1]) * 1.2, 1, 9));
    const traits = TRAITS[pos].map(([t]) => {
      const truth = clamp(5.6 + 1.1 * talent + 0.75 * R.n(), 2, 9);
      const g1 = clamp(Math.round((truth + 0.45 * R.n()) * 2) / 2, 1, 9);
      const off = R.u() < 0.06 ? (R.u() < 0.5 ? -1 : 1) * (1.5 + R.u()) : 0.45 * R.n();
      const g2 = clamp(Math.round((truth + off) * 2) / 2, 1, 9);
      return { t, g1, g2 };
    });
    const graded = R.u() < 0.82;
    const character = R.u() < 0.75 ? clamp(Math.round((6.2 + 1.1 * R.n()) * 2) / 2, 2, 9) : null;
    const missed = R.u() < 0.7 ? 0 : Math.round(1 + 6 * R.u());
    const serious = R.u() < 0.025;
    const indRating = R2(clamp(0.865 + 0.035 * talent + 0.02 * R.n(), 0.79, 0.999) * 1000) / 1000;
    const stars = indRating >= 0.98 ? 5 : indRating >= 0.89 ? 4 : indRating >= 0.84 ? 3 : 2;
    const dist = Math.round(haversine(pr.campus[0], pr.campus[1], S[1], S[2]));
    const nRival = clamp(Math.round(1 + 3.2 * (talent + 1) * R.u()), 0, 10);
    const offers = [];
    for (let k = 0; k < nRival; k++) { const sc = RIVALS[Math.floor(R.u() * RIVALS.length)]; if (!offers.some((o) => o.school === sc)) offers.push({ school: sc, kind: "offer", date: `2026-${String(3 + Math.floor(R.u() * 8)).padStart(2, "0")}-${String(1 + Math.floor(R.u() * 27)).padStart(2, "0")}`, source: "Licensed recruiting feed (sample)" }); }
    const visitsElsewhere = offers.filter(() => R.u() < 0.25).map((o) => ({ school: o.school, kind: R.u() < 0.4 ? "official visit" : "unofficial visit", date: "2026-" + String(6 + Math.floor(R.u() * 5)).padStart(2, "0") + "-" + String(1 + Math.floor(R.u() * 27)).padStart(2, "0"), source: "Licensed recruiting feed (sample)" }));
    const contacts = Math.round(clamp(3 + 3 * R.u() + 2 * talent, 0, 14));
    const ov = R.u() < 0.18 + 0.12 * (talent > 0.8);
    const uv = Math.floor(R.u() * 3);
    let stage = type === "transfer" ? pickW(R, [["Identified", 3], ["Evaluated", 4], ["Offered", 2], ["Visited", 1]]) : pickW(R, [["Identified", 4], ["Evaluated", 4], ["Offered", 3], ["Visited", 1.2], ["Committed", cls === 2027 ? 1.0 : 0.25]]);
    if (stage === "Identified") traits.forEach((x) => (x.g2 = null));
    const film = stage === "Identified" ? 0 : Math.round(2 + 6 * R.u());
    const ask = type === "transfer" || cls === 2027 ? Math.round((40000 + 260000 * Math.max(0, 0.6 + 0.6 * talent + 0.25 * R.n()) ** 2 * (pos === "QB" ? 2.4 : pos === "EDGE" || pos === "OT" ? 1.4 : 1)) / 5000) * 5000 : null;
    const hist = [{ stage: "Identified", date: "2026-0" + (1 + Math.floor(R.u() * 5)) + "-1" + Math.floor(R.u() * 9), by: "Area recruiter" }];
    PIPE.slice(1, PIPE.indexOf(stage) + 1).forEach((s, k) => hist.push({ stage: s, date: `2026-${String(6 + k).padStart(2, "0")}-${String(2 + Math.floor(R.u() * 25)).padStart(2, "0")}`, by: k % 2 ? "Recruiting coordinator" : "Area recruiter" }));
    return {
      id: (type === "transfer" ? "T" : "H") + String(i).padStart(4, "0"), name: name(), pos, type, cls, state, region: S[6], dist, terr: terr(state).id,
      level: lv[0], levelFactor: lv[1], ht, wt, forty, fortySrc: src, vert, shuttle, snaps, prodRaw, prodStat: PRODUCTION_STAT[pos],
      traits: graded ? traits : traits.map((x) => ({ ...x, g1: null, g2: null })), character, missed, serious,
      industry: { stars, rating: indRating, source: "Licensed recruiting service (sample)" },
      offers, visitsElsewhere, contacts, ov, uv, stage, hist, film, ask, pipelineSchool: R.u() < 0.22,
      school: type === "transfer" ? `${["North", "East", "West", "Central", "Coastal", "Upstate"][Math.floor(R.u() * 6)]} ${S[0]} ${lv[0] === "FCS" ? "State" : "University"}` : `${["Central", "North", "Lincoln", "St. Joseph", "Valley", "Ridge", "Riverside", "Eastside"][Math.floor(R.u() * 8)]} HS`,
      talent, addedVia: "Licensed feed (sample)",
    };
  };
  let i = 1;
  for (let k = 0; k < 230; k++) prospects.push(mk(i++, "hs", 2027));
  for (let k = 0; k < 190; k++) prospects.push(mk(i++, "hs", 2028));
  for (let k = 0; k < 110; k++) prospects.push(mk(i++, "hs", 2029));
  for (let k = 0; k < 80; k++) prospects.push(mk(i++, "transfer", 2027));
  // past signee classes with outcomes (for validation)
  const past = [];
  for (const yr of [2021, 2022, 2023, 2024]) for (let k = 0; k < 28; k++) {
    const p = mk(9000 + past.length, R.u() < 0.2 ? "transfer" : "hs", yr);
    const discovered = R.u() < 0.18 ? "late" : "early";
    const z = 1.15 * p.talent + 0.9 * R.n();
    past.push({ ...p, id: "P" + yr + "-" + String(k + 1).padStart(2, "0"), discovered, stage: "Signed", outcome: { starter: z > 0.75, contributor: z > -0.15, bust: z < -0.6 } });
  }
  // discovery queue leads
  const leads = [];
  const srcs = [["Online questionnaire", 3], ["Camp check-in", 2], ["CSV: all-state list", 2], ["CSV: coach nomination", 1.5], ["Licensed feed (sample)", 2]];
  for (let k = 0; k < 36; k++) {
    const dupOf = R.u() < 0.14 ? prospects[Math.floor(R.u() * prospects.length)] : null;
    const pos = dupOf ? dupOf.pos : POS[Math.floor(R.u() * POS.length)], N = NORMS[pos];
    const state = dupOf ? dupOf.state : pickW(R, stateW);
    const nm = dupOf ? (R.u() < 0.5 ? dupOf.name : dupOf.name.replace(/^(\w)\w+/, "$1.")) : name();
    leads.push({ id: "L" + String(k + 1).padStart(3, "0"), name: nm, pos, state, cls: dupOf ? dupOf.cls : 2027 + Math.floor(R.u() * 3), ht: Math.round(N[0] + SD[0] * R.n()), wt: Math.round(N[1] * (1 + SD[1] * R.n())), forty: R2(N[2] - SD[2] * R.n()), fortySrc: pickW(R, [["self", 3], ["camp", 1], ["laser", 0.6], ["hand", 1.2]]), film: R.u() < 0.6, stat: Math.round(R.u() * 1400), source: pickW(R, srcs), received: `2026-${R.u() < 0.6 ? "11-0" + (1 + Math.floor(R.u() * 3)) : "10-" + (10 + Math.floor(R.u() * 20))}` });
  }
  // grader pool + historic graders for ICC
  const graders = ["Evaluator A", "Evaluator B", "Evaluator C", "Evaluator D"];
  return { pid, settings: st, prospects, past, leads, graders, R };
}

export const NEWS_SAMPLES = [
  { src: "Publisher-permitted RSS (sample)", title: "Friday night roundup", text: "Central HS rolled past Lincoln 42-14 behind senior Marcus Whitfield, who rushed for 212 yards and three touchdowns. \"He just doesn't go down on first contact,\" Central coach Dale Price said. On defense, junior Jalen Okafor added 2.5 sacks and forced a fumble. Valley HS quarterback Caleb Hargrove threw for 318 yards and 4 touchdowns in a 35-31 win over Ridge." },
  { src: "Staff upload: scanned print page (sample)", title: "Region semifinal", text: "St. Joseph cornerback Xavier Pruitt broke up 4 passes and intercepted 2 more as St. Joseph held Eastside to 96 passing yards. Eastside receiver Tre Vance still caught 7 passes for 141 yards. Riverside linebacker Isaiah Brannon finished with 14 tackles." },
];
