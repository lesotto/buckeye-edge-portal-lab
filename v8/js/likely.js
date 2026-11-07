// Researched seed list: 30 players named in public media as possible January 2027 transfer-portal entrants or targets.
// Every entry is REPORTED SPECULATION from the cited article, not a confirmed portal entry. No medical, academic or NIL detail.
export const RETRIEVED_AT = "2026-10-28";
export const SRC = {
  si7: { t: "SI / College Football HQ — 7 players who could be top targets", u: "https://www.si.com/fannation/college/cfb-hq/transfer-portal/college-football-transfer-portal-7-players-who-could-be-top-targets-this-offseason", d: "2026-10-19" },
  siqb: { t: "SI / College Football HQ — The quarterback decisions for 2027", u: "https://www.si.com/fannation/college/cfb-hq/transfer-portal/college-football-transfer-portal-quarterback-decisions-2027", d: "2026-10-20" },
  espnNcs: { t: "ESPN — NC State fires Dave Doeren: personnel priorities", u: "https://www.espn.com/college-football/story/_/id/50270580/nc-state-doeren-candidates-roster", d: "2026-10-24" },
  ybNcs: { t: "Yardbarker — NC State: possible transfers to watch", u: "https://www.yardbarker.com/general_sports/articles/nc_state_possible_transfers_to_watch/s1_17106_44474868", d: "2026-10-28" },
  espnBay: { t: "ESPN — Baylor fires Aranda: roster priorities", u: "https://www.espn.com/college-football/story/_/id/50277698/baylor-fires-aranda-candidates-roster-priorities", d: "2026-10-28" },
  ybBay: { t: "Yardbarker — Baylor: possible transfers to watch", u: "https://www.yardbarker.com/college_football/articles/baylor_possible_transfers_to_watch/s1_17106_44479547", d: "2026-10-27" },
  yhMd: { t: "Yahoo Sports — 4 Maryland players who could be poached", u: "https://sports.yahoo.com/articles/4-maryland-players-could-poached-161241123.html", d: "2026-10-22" },
  cbsAtk: { t: "CBS Sports — Auburn dismisses Xavier Atkins; he reveals portal intentions", u: "https://www.cbssports.com/college-football/news/auburn-dismisses-xavier-atkins-all-transfer-portal/", d: "2026-10-20" },
  capMd: { t: "Capital Gazette — Maryland stars uncertain about futures after Locksley exit", u: "https://www.capitalgazette.com/2026/10/27/maryland-football-malik-washington-sidney-stewart-futures-mike-locksley-firing/", d: "2026-10-27" },
  market: { t: "USA TODAY via Yahoo — Transfer portal isn't open, but the bidding already is", u: "https://sports.yahoo.com/articles/college-football-transfer-portal-hasn-091238578.html", d: "2026-10-27" },
};
// Signals used by the transparent portal-likelihood index (weights shown in the UI).
export const SIGNALS = {
  intent: { l: "Publicly reported intent to enter the portal", w: 0.45 },
  coach: { l: "Head coach fired mid-season", w: 0.30 },
  depth: { l: "Benched / depth-chart pressure", w: 0.25 },
  up: { l: "Group-of-6 or FCS production, Power 4 interest", w: 0.20 },
  moved: { l: "Has transferred before", w: 0.10 },
  coord: { l: "Followed a coordinator who may not stay", w: 0.10 },
  elig: { l: "2+ seasons of eligibility left", w: 0.05 },
  stay: { l: "Retention push or NFL path reported", w: -0.15 },
};
export const BASE = 0.15;
export const LIKELY = [
  { name: "Bryce Underwood", pos: "QB", school: "Michigan", conf: "Big Ten", yr: "Sophomore", elig: "2 seasons", stats: "881 pass yds, 5 TD, 4 INT in first 5 games; benched at halftime vs Penn State", why: "Benched; Whittingham did not commit to a starter. Several QB-needy programs linked for January.", sig: ["depth", "elig"], src: ["si7", "siqb"] },
  { name: "Braden Atkinson", pos: "QB", school: "Oregon State", conf: "Pac-12", yr: "Sophomore", elig: "2 seasons", stats: "2,604 pass yds, 24 TD, 2 INT; 300+ yds in all 7 games", why: "Former Mercer standout and Jerry Rice Award winner; Power 4 staffs expected to look hard. Oregon State expected to prioritize retaining him.", sig: ["up", "moved", "elig", "stay"], src: ["si7", "siqb"] },
  { name: "Jesse Legree", pos: "WR", school: "Oregon State", conf: "Pac-12", yr: "True freshman", elig: "3 seasons", stats: "Nation-leading 1,040 rec yds, 14 TD; 100+ yds and a TD in every game", why: "Most remaining eligibility on the SI list; top Heisman-watch name. No intent to transfer reported.", sig: ["up", "elig"], src: ["si7"] },
  { name: "Dylan Riley", pos: "RB", school: "Boise State", conf: "Mountain West", yr: "Junior", elig: "1 season", stats: "835 rush yds (4th in FBS); only FBS player with three 70+ yd runs", why: "Splits carries with Sire Gaines; a Power 4 lead-back role is the pitch.", sig: ["up"], src: ["si7"] },
  { name: "Andrew Zock", pos: "EDGE", school: "Toledo", conf: "MAC", yr: "Junior", elig: "1 season", stats: "7 sacks, sack in 6 straight games; 9 hurries vs Eastern Michigan", why: "Followed Mike Jacobs from Mercer; Colorado scheduled a visit last cycle.", sig: ["up", "moved"], src: ["si7"] },
  { name: "DJ Kelly", pos: "CB", school: "James Madison", conf: "Sun Belt", yr: "Sophomore", elig: "2 seasons", stats: "Team-high 4 INT, 2 in the red zone vs Marshall", why: "Already transferred once (Toledo); JMU 7-0 in its first season under Billy Napier.", sig: ["up", "moved", "elig"], src: ["si7"] },
  { name: "Jahiem White", pos: "RB", school: "North Texas", conf: "American", yr: "Not stated", elig: "Not stated", stats: "687 rush yds, 9 TD, 7.2 ypc through 6 games; 219 yds at Tulsa", why: "Former Big 12 back seeking a fresh start; efficiency is reported to be back to his early-career level.", sig: ["up", "moved"], src: ["si7"] },
  { name: "Arch Manning", pos: "QB", school: "Texas", conf: "SEC", yr: "Not stated", elig: "Not stated", stats: "No 2026 totals in source; consistency and decision-making questioned", why: "A different system is floated as a cleaner evaluation before the 2028 draft; staying is equally possible.", sig: ["stay"], src: ["siqb"] },
  { name: "Xavier Atkins", pos: "LB", school: "Auburn", conf: "SEC", yr: "Not stated", elig: "Not stated", stats: "All-American linebacker (per CBS Sports)", why: "No longer with the Auburn program; CBS reports he revealed an intention to enter the transfer portal.", sig: ["intent"], src: ["cbsAtk"] },
  { name: "Dylan Raiola", pos: "QB", school: "Oregon", conf: "Big Ten", yr: "Not stated", elig: "Not stated", stats: "No 2026 totals in source; struggled vs Nebraska", why: "Oregon projected to chase a proven portal starter; may re-enter the portal rather than face an uncertain depth chart.", sig: ["depth", "moved"], src: ["siqb"] },
  { name: "CJ Bailey", pos: "QB", school: "NC State", conf: "ACC", yr: "Junior", elig: "2 seasons", stats: "373 yds in upset of Louisville; 2025: 3,105 yds, 69%, 31 total TD", why: "Doeren fired; ESPN says tampering starts now and Bailey would have good options.", sig: ["coach", "elig"], src: ["espnNcs", "ybNcs"] },
  { name: "Keenan Jackson", pos: "WR", school: "NC State", conf: "ACC", yr: "Junior", elig: "2 seasons", stats: "30 rec, 456 yds, 6 TD through 7 games", why: "Stepped into WR1 role after the top three pass catchers left; retention priority.", sig: ["coach", "elig"], src: ["espnNcs", "ybNcs"] },
  { name: "Preston Douglas", pos: "TE", school: "NC State", conf: "ACC", yr: "Not stated", elig: "3 seasons", stats: "No 2026 totals in source", why: "Named by ESPN as a major retention priority after the coaching change.", sig: ["coach", "elig"], src: ["espnNcs"] },
  { name: "Popo Aguirre", pos: "LB", school: "NC State", conf: "ACC", yr: "Fifth-year eligible", elig: "1 season", stats: "61 tackles (27 solo), 3 fumble recoveries; ACC tackles leader", why: "Miami transfer with 47 career games; coaching change opens the door.", sig: ["coach", "moved"], src: ["espnNcs"] },
  { name: "Elijah Satchell", pos: "EDGE", school: "NC State", conf: "ACC", yr: "True freshman", elig: "3 seasons", stats: "Team-high 4 sacks, 1 FF on ~20 snaps a game", why: "Productive in a part-time role; coaching change.", sig: ["coach", "elig"], src: ["espnNcs", "ybNcs"] },
  { name: "Spike Sowells Jr.", pos: "OL", school: "NC State", conf: "ACC", yr: "Sophomore", elig: "3 seasons", stats: "2025 Freshman All-America; 1 sack allowed in 210 pass-pro snaps (2025)", why: "ESPN calls him critical for the new staff to retain.", sig: ["coach", "elig"], src: ["espnNcs"] },
  { name: "DJ Lagway", pos: "QB", school: "Baylor", conf: "Big 12", yr: "Junior", elig: "2 seasons", stats: "11th in Big 12 QBR; career 5,531 yds, 37 TD, 27 INT", why: "Aranda fired; next staff may not prioritize him. Would be his third school.", sig: ["coach", "moved", "elig"], src: ["espnBay", "ybBay"] },
  { name: "Devon Jordan", pos: "CB", school: "Baylor", conf: "Big 12", yr: "Junior", elig: "Not stated", stats: "30 tackles, team-high 3 INT, 6 PD; 10.71 100m", why: "Oklahoma transfer who plays outside and nickel; plug-and-play profile.", sig: ["coach", "moved"], src: ["ybBay"] },
  { name: "Kaleb Burns", pos: "LB", school: "Baylor", conf: "Big 12", yr: "Sophomore", elig: "3 seasons", stats: "20 tackles, 3 TFL, 1 sack, 2 PBU through 7 games", why: "Sideline-to-sideline off-ball linebacker; coaching change.", sig: ["coach", "elig"], src: ["ybBay"] },
  { name: "Koltin Sieracki", pos: "OL", school: "Baylor", conf: "Big 12", yr: "Junior", elig: "Not stated", stats: "No stats; 6-4, 317, center and guard experience", why: "Experienced interior linemen with center size are rare in the portal.", sig: ["coach"], src: ["ybBay"] },
  { name: "Bo Onu", pos: "S", school: "Baylor", conf: "Big 12", yr: "Sophomore", elig: "Not stated", stats: "16 tackles, 4 TFL, 3 sacks, 1 FF through 7 games", why: "Box-safety hybrid; Yardbarker expects heavy portal pursuit on upside.", sig: ["coach"], src: ["ybBay"] },
  { name: "Micah Gifford", pos: "S", school: "Baylor", conf: "Big 12", yr: "Senior", elig: "1 season", stats: "3 INT, 2 FF, 37 tackles through 7 games", why: "Converted receiver; eligible for a fifth year in 2027.", sig: ["coach"], src: ["espnBay"] },
  { name: "Daniel Cobbs", pos: "DB", school: "Baylor", conf: "Big 12", yr: "Senior", elig: "1 season", stats: "23 tackles, 4 TFL, 3 sacks, 3 PBU", why: "Followed DC Joe Klanderman from Kansas State; good options if Klanderman isn't retained.", sig: ["coach", "moved", "coord"], src: ["espnBay"] },
  { name: "Ryan Davis", pos: "DB", school: "Baylor", conf: "Big 12", yr: "Not stated", elig: "1 season", stats: "No 2026 totals in source", why: "Kansas State transfer tied to the Klanderman staff situation.", sig: ["coach", "moved", "coord"], src: ["espnBay"] },
  { name: "Jadon Porter", pos: "WR", school: "Baylor", conf: "Big 12", yr: "Junior", elig: "2 seasons", stats: "12 rec, 199 yds, 2 TD", why: "Flashed potential behind two departing seniors; coaching change.", sig: ["coach", "elig"], src: ["espnBay"] },
  { name: "Dre'lon Miller", pos: "WR", school: "Baylor", conf: "Big 12", yr: "Not stated", elig: "2 seasons", stats: "No 2026 totals in source", why: "Colorado transfer with two years left; coaching change.", sig: ["coach", "moved", "elig"], src: ["espnBay"] },
  { name: "Zion Elee", pos: "EDGE", school: "Maryland", conf: "Big Ten", yr: "Freshman", elig: "Multiple seasons", stats: "Forced a fumble vs Ohio State (Oct 10); five-star, No. 2 player in cycle (ESPN)", why: "Highest-rated recruit in program history; Locksley out.", sig: ["coach", "elig"], src: ["yhMd"] },
  { name: "Zahir Mathis", pos: "EDGE", school: "Maryland", conf: "Big Ten", yr: "Sophomore", elig: "Multiple seasons", stats: "2025: 35 tackles, 8.5 TFL, 6 sacks", why: "Flipped from Ohio State to Maryland; coaching change.", sig: ["coach", "elig"], src: ["yhMd"] },
  { name: "Malik Washington", pos: "QB", school: "Maryland", conf: "Big Ten", yr: "Not stated", elig: "Not stated", stats: "No 2026 totals in source", why: "If Maryland doesn't hire an offensive-minded coach, could leave to be developed elsewhere.", sig: ["coach"], src: ["yhMd", "capMd"] },
  { name: "Sidney Stewart", pos: "LB", school: "Maryland", conf: "Big Ten", yr: "Sophomore", elig: "Multiple seasons", stats: "No 2026 totals in source; LB/edge hybrid", why: "Former Maryland DC Brent Pry now at Virginia Tech — the Hokies could be a player.", sig: ["coach", "coord", "elig"], src: ["yhMd", "capMd"] },
];
export function likelihood(p) {
  const parts = p.sig.map((k) => ({ k, l: SIGNALS[k].l, w: SIGNALS[k].w }));
  const v = Math.max(0.05, Math.min(0.95, BASE + parts.reduce((a, b) => a + b.w, 0)));
  return { v, parts };
}
