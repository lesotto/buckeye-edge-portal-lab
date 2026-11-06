// Deep Research agent for Portal Lab.
// Two modes:
//  1. Simulated run on a synthetic watch-list player: visible agent steps and findings mapped to the ontology.
//     Sources are fictional and labelled; nothing leaves the browser.
//  2. Real-player brief: builds a cited, scoped research request and opens it in Perplexity
//     (or copies it into a Perplexity Computer task). The app never sends player data anywhere itself.
import { rng } from "./model.js";

export const TRACKS = [
  { k: "prod", label: "Production in context", onto: "SeasonProduction", q: (s) => `${s.name} ${s.school} ${s.posName} season stats opponent strength` },
  { k: "role", label: "Role and scheme", onto: "SeasonProduction", q: (s) => `${s.name} ${s.school} alignment snaps scheme role` },
  { k: "avail", label: "Availability (public box scores)", onto: "Availability", q: (s) => `${s.name} ${s.school} games played missed last two seasons` },
  { k: "xfer", label: "Transfer context", onto: "TransferEvent", q: (s) => `${s.name} transfer portal entry eligibility remaining` },
  { k: "film", label: "Public scouting notes", onto: "FilmGrade", q: (s) => `${s.name} ${s.posName} scouting report strengths weaknesses` },
  { k: "comp", label: "Comparable transfers", onto: "Outcome", q: (s) => `${s.posName} transfers from ${s.level} to Power-4 first-season results` },
];

export const STEPS = [
  { agent: "Research planner", what: "Turns the player record into six scoped research questions, one per ontology class" },
  { agent: "Web research", what: "Runs the questions against public sources only" },
  { agent: "Evidence extractor", what: "Pulls dated, cited claims and maps each to an ontology class" },
  { agent: "Verifier", what: "Cross-checks claims against what the model already holds; flags conflicts" },
  { agent: "Staff review", what: "Nothing reaches the model until a staff member accepts it" },
];

export const SCOPE_RULES = [
  "Public sources only, every claim cited with a URL and date",
  "No medical, academic or NIL / financial information",
  "No contact with the player, family or current staff (NCAA contact rules)",
  "Findings are hypotheses until a staff member accepts them",
];

export function buildBrief(s) {
  const who = `${s.name}${s.school ? `, ${s.posName} at ${s.school}` : `, ${s.posName}`}${s.level ? ` (${s.level})` : ""}`;
  return `Deep research brief: transfer portal evaluation.
Player: ${who}. Context: a Power-4 program evaluating him ahead of the January 2027 transfer portal window.

Research these six areas using public sources only, and cite every claim with a URL and date:
1. Production in context: last two seasons of position stats, adjusted for the strength of the opponents faced.
2. Role and scheme: where he lined up, snap counts, and the scheme he played in.
3. Availability: games played and missed from public box scores (no medical detail).
4. Transfer context: portal entry date, eligibility remaining, any prior transfers.
5. Public scouting notes: published evaluations of strengths and weaknesses, with the evaluator named.
6. Comparable transfers: similar ${s.posName.toLowerCase()} who made the same jump to Power-4 and how their first season went.

Exclude medical, academic and NIL or financial information.
Return a table with columns: finding, ontology class (Season Production, Availability, Transfer Event, Film Grade, Program, Competition Level, Observed Outcome), statement type (verified fact, media report, opinion), source URL, date. Flag any reports that conflict with each other.`;
}
export const perplexityUrl = (q) => "https://www.perplexity.ai/search?q=" + encodeURIComponent(q);

export const marketQueries = (posName) => [
  { t: `January 2026 window: ${posName} who moved to Power-4`, q: `Which ${posName.toLowerCase()} transferred to Power-4 programs in the January 2026 college football transfer portal window, and how did they perform in the 2026 season? Cite sources.` },
  { t: `${posName} likely to enter the January 2027 window`, q: `Which Power-4 and Group-of-5 ${posName.toLowerCase()} with eligibility remaining are reported as likely to enter the January 2027 college football transfer portal window? Public reports only, cite sources and dates.` },
  { t: "Success rates by level jump", q: `What does public research and data show about first-season success rates for college football transfers by level jump (FCS to FBS, Group-of-5 to Power-4, Power-4 to Power-4)? Cite sources.` },
];

// Simulated findings for a synthetic player. ctx: { posName, m1Label, m1Fmt, comps, dis, schemeHint }
export function simulateFindings(p, ctx) {
  const R = rng(p.id.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);
  const ri = (a, b) => a + Math.floor(R.u() * (b - a + 1));
  const F = [];
  const strong = p.tier === "P4" ? ri(6, 9) : p.tier === "G5" ? ri(2, 5) : ri(0, 2);
  F.push({ k: "prod", onto: "SeasonProduction", cls: "observed",
    claim: p.tier === "P4"
      ? `${ctx.m1Label} of ${ctx.m1Fmt} came against a full Power-4 schedule; ${strong} of 12 opponents finished with winning records.`
      : `${ctx.m1Label} of ${ctx.m1Fmt} came mostly against ${p.tier} opponents; only ${strong} of 12 finished with winning records.`,
    check: p.tier === "P4" ? "Consistent with the model's Power-4 baseline." : `Already priced in: the ${p.jump} baseline discounts ${p.tier} production.`,
    action: "none", src: "Box scores and schedule (synthetic CollegeFootballData feed)" });
  F.push({ k: "role", onto: "SeasonProduction", cls: "observed",
    claim: `${ri(55, 92)}% of snaps at his projected spot; ${ctx.schemeHint(R)}.`,
    check: "Scheme fit is a staff judgement; the model does not score it.", action: "confirm",
    src: `${p.from} game participation reports (fictional)` });
  F.push({ k: "avail", onto: "Availability", cls: "observed",
    claim: `Public box scores show ${p.inj} game${p.inj === 1 ? "" : "s"} missed over the last two seasons.`,
    check: "Matches the value already in the model.", action: "none", src: "Box scores (synthetic)" });
  F.push({ k: "xfer", onto: "TransferEvent", cls: "observed",
    claim: `Entered the January 2027 window on Jan ${ri(4, 9)}; ${p.elig} year${p.elig > 1 ? "s" : ""} of eligibility; ${R.u() < 0.8 ? "first transfer" : "second transfer"}.`,
    check: "Eligibility matches the portal record.", action: "none", src: "Portal entry record (synthetic)" });
  const filmCls = "hypothesis";
  F.push({ k: "film", onto: "FilmGrade", cls: filmCls,
    claim: ctx.dis
      ? `Two published scouting notes rate him ${ctx.dis.rest > 0 ? "higher" : "lower"} than your staff grade does (${ctx.dis.rest > 0 ? "\"plays faster than his testing\"" : "\"production inflated by soft coverage\""}).`
      : `Published scouting notes are broadly in line with his film grade${p.film !== null ? ` of ${p.film.toFixed(1)}` : ""}.`,
    check: ctx.dis ? "Conflicts with the staff grade: queue a film review." : "No conflict with existing evidence.",
    action: ctx.dis ? "film" : "none", src: "Regional scouting newsletter and beat report (fictional)" });
  const cs = ctx.comps.slice(0, 3);
  F.push({ k: "comp", onto: "Outcome", cls: "observed",
    claim: `Closest past ${p.jump} transfers: ${cs.map((c) => `${c.h.name} (${c.h.cycle}, ${c.y ? "met the bar" : "did not"})`).join(", ")}.`,
    check: `${cs.filter((c) => c.y).length} of ${cs.length} succeeded; these are already in the model's training data.`, action: "none",
    src: "Labelled transfer history (synthetic)" });
  return F.map((f, i) => ({ ...f, id: `RF-${p.id}-${i + 1}`, query: TRACKS.find((t) => t.k === f.k).q({ name: p.name, school: p.from, posName: ctx.posName.replace(/s$/, "").toLowerCase(), level: { P4: "Power-4", G5: "Group-of-5", FCS: "FCS" }[p.tier] }), nSources: ri(3, 9) }));
}
