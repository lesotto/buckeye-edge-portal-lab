// Portal Lab v6 · "How It Works" content.
// Drawn from two recorded calls: "Dan & Les" (Nov 5, 2026) and "Buckeye Edge Portal-Papers and alternative
// methodology" (Les Ottolenghi, Mike Porter, Dr. Robert Rippee). Pricing and internal commercial terms are
// deliberately left out: they belong in the proposal, not the staff explainer.

export const NCAA_CAL = "https://ncaaorg.s3.amazonaws.com/compliance/d1/D1Comp_UndergraduateTransferWindows.pdf";

export const ONE_LINE = "Year one is a decision aid, not a crystal ball. It helps your staff look at more players, faster, using your own method. Coaches decide; the system keeps score and shows its work.";

export const THREE_THINGS = [
  ["It does not pick players.", "It gathers public information, organizes what the staff already says and grades, and puts it in one place. The staff vote decides."],
  ["It starts with quarterbacks and skill positions.", "That is where the data is cleanest. Other positions come later, as data and validation allow."],
  ["Prediction is earned, not assumed.", "A model that says how likely a player is to succeed at Ohio State is a year-three goal, and only if it passes checks against seasons where we already know the answer."],
];

// Role guides
export const ROLES = [
  { k: "dan", who: "Dan", title: "Program lead for the pilot",
    does: ["Confirms or rejects each AI-written requirements summary", "Sets up the general manager meeting that defines success", "Brings the full list of portal-entry signals to test", "Decides what is in and out of scope for the demo before December"],
    gets: ["A working demo to show the general manager and head coach", "A tested signal list with real results, not opinions", "A plan where every date that is not signed stays open"],
    start: [["learn", "Watch the 3-minute explainer"], ["plan", "This year and beyond"], ["signals", "Your signals, tested"]] },
  { k: "gm", who: "General manager", title: "Owns the board and the budget",
    does: ["Defines what success looks like at each position, beyond needing a dude", "Names three ideal players per position as the baseline", "Sets the needs list that drives budget priorities"],
    gets: ["Roster needs and the selection board on one screen", "Every quarterback in the portal, and every one who might enter, in one queue", "A Monday brief drafted for you, sent only when you approve"],
    start: [["roster", "Roster Needs"], ["rooms", "Selection Room scene"], ["lead", "Leaderboard"]] },
  { k: "hc", who: "Head coach", title: "Final say",
    does: ["Nothing new. Ask questions out loud when you want an answer", "Vote on the selection board; your vote is recorded as the head coach's"],
    gets: ["A spoken answer in a few seconds, with the report on screen", "Alerts held until after the game unless you say otherwise"],
    start: [["talk", "Talk to Edge"], ["devices", "Phone and big-screen views"]] },
  { k: "coach", who: "Position coaches", title: "Film and fit",
    does: ["Talk through film the way you already do; with permission, that talk is captured", "Answer a few questions afterwards: what you looked for, and why that frame"],
    gets: ["Film-room prep notes for each target: what to watch, clips to pull, questions to settle", "Your own words become the standard measures in year two"],
    start: [["rooms", "Film Room scene"], ["talk", "Ask for film prep"]] },
  { k: "staff", who: "Talent and personnel staff", title: "Run the queue",
    does: ["Hire staff bots and give them tasks in plain words", "Check sources before anything goes on the board", "Approve or decline anything that would contact someone"],
    gets: ["Portal Watch alerts ranked by tested signals", "Research with sources attached, not rumors", "One place instead of spreadsheets and texts"],
    start: [["watch", "Portal Watch"], ["bots", "Staff Bots"], ["tour", "Guided tour"]] },
  { k: "comp", who: "Compliance", title: "Guardrails",
    does: ["Review what is recorded, stored and who can see it", "Confirm contact rules and the calendar"],
    gets: ["Nothing goes out without a named approval", "A log of every action, who asked and what was sent", "No use of leaked competitor information"],
    start: [["compliance", "Compliance calendar"], ["journal", "Run journal"]] },
];

// Prerequisites: lead with what is not yet approved.
export const PREREQS = [
  ["Program sponsor sign-off and statement of work", "Not approved", "Ohio State and FuzeBox"],
  ["Data-sharing agreement (rosters, grades, past selections and outcomes)", "Not approved", "Ohio State"],
  ["Consent to observe and record film-room sessions", "Not approved", "Staff, with compliance"],
  ["Privacy (FERPA) and NCAA compliance review", "Not started", "Ohio State compliance"],
  ["Access to systems of record (spreadsheets, analytics tools)", "Not approved", "Ohio State"],
  ["Staff sign-in and saved history", "Not built", "FuzeBox, after approval"],
  ["Methodology review: is the data big enough for the variance study?", "In progress", "Dr. Robert Rippee and a university research partner"],
];

// Year-one timeline. Only the portal window is a verified date; everything else is a target or TBD.
export const YEAR1 = [
  { when: "Now – late November 2026", tag: "Target", title: "Define success",
    items: ["Demo for the general manager and head coach (Dan asked for this before December)", "General manager meeting: what success looks like at each position", "Three ideal players per position, named by staff, as the baseline", "Dan's full list of portal-entry signals, to be tested on real data", "End-of-November needs assessment for 2027"] },
  { when: "December 2026", tag: "TBD, after approvals", title: "Connect and measure the baseline",
    items: ["Connect spreadsheets and systems of record into one format", "Turn on Portal Watch alerts, staff bots and the voice surface", "Measure today: how long one evaluation takes, how many quarterbacks get a real look"] },
  { when: "January 4 – 13, 2027", tag: "Verified · NCAA calendar", link: NCAA_CAL, title: "Portal window: watch and listen",
    items: ["Live use during the window", "A small team on site for three to four days at the peak (dates TBD)", "With permission, record film sessions as coaches think out loud, like the Manning brothers' broadcast", "Short follow-ups afterwards: what were you looking for, and why that frame"] },
  { when: "February – summer 2027", tag: "TBD", title: "Compare and study the variance",
    items: ["Compare speed and coverage with last year", "Transcripts become the data set", "Variance study: how much of the disagreement can we explain (structural equation modeling, if the data is big enough)"] },
  { when: "2027 season", tag: "TBD", title: "Track outcomes",
    items: ["Follow how the players we evaluated actually performed", "This becomes the answer key for later validation"] },
];

export const FUTURE = [
  { yr: "Year 2", when: "2027–28 cycle · timing TBD", items: ["Write down Ohio State's own standard measures: what makes a great quarterback here", "Expand to one to three more skill positions", "Map program effects: how a jump in level changes a player's numbers", "Retrospective validation: rerun the model on the 2024 and 2025 classes and see how close it gets"] },
  { yr: "Year 3", when: "2028–29 cycle · timing TBD", items: ["Computer-vision agents measure film the way the staff defined it, cutting grading noise", "Estimate how much variance is left: the human part no one can measure", "A predictor engine, only if validation holds: how likely is this player to succeed at Ohio State"] },
  { yr: "Beyond", when: "Years 4–5 · TBD", items: ["More positions as data allows, up to the full roster", "Recalibrate every year against real outcomes", "The goal discussed: move from roughly a coin flip toward better odds. It is a goal to test, not a promise"] },
];

export const YEAR1_MEASURES = [
  ["Coverage", "Share of quarterbacks in the portal, or signaling they might enter, who get a staff look", "Measured in December, before the window", "Measured during the window"],
  ["Speed", "Hours from a player entering the portal to the first staff review", "Measured in December", "Measured during the window"],
  ["Effort", "Staff time per evaluation", "Measured in December", "Measured during the window"],
  ["Consistency", "How often two evaluators agree on the same player", "Unknown today", "First measured from recorded sessions"],
];

export const VARIANCE = [
  { n: 1, k: "measure", title: "Film grading", plain: "Two evaluators can watch the same ten quarterbacks and disagree on most of them. There is no standard way to grade film yet, and Dr. Rippee estimated the gap between raters could be very large.", fix: "Year 1: record and measure it. Year 2: standard measures. Year 3: computer vision measures film the same way every time." },
  { n: 2, k: "program", title: "Program effect", plain: "A quarterback who dominated at a smaller program may face a different world in the Big Ten. The coaching, facilities and competition change, so the numbers change too. Dr. Rippee cited a study finding the program effect can be bigger than the individual effect.", fix: "Year 2: map how a jump in level changes a player's numbers." },
  { n: 3, k: "psych", title: "Measures that hold up", plain: "Is a measure reliable (it comes out the same every time) and valid (it predicts what happens next)? Most measures in use today have never been checked.", fix: "Years 1–2: check each measure we use, and keep only the ones that hold up." },
  { n: 4, k: "outcome", title: "Outcomes", plain: "What actually happened to the players we rated? A player who hates living somewhere can struggle no matter what the film says. Part of this is human, and some of it will never be measurable.", fix: "Year 1: track outcomes. Year 3: estimate how much is left that no one can explain." },
];

export const GAPS = [
  { gap: "Success is not defined in data terms", why: "Without it, nothing can be scored or improved", close: "General manager meeting; three ideal players per position", yr: "Year 1", owner: "Dan and general manager", status: "Planned" },
  { gap: "Collection is informal (hallway talk, film room, spreadsheets)", why: "Decisions are hard to review, repeat or learn from", close: "Voice capture, staff bots and one shared format", yr: "Year 1", owner: "FuzeBox", status: "Prototype (v5)" },
  { gap: "No team history to fit a model (past selections and outcomes)", why: "A model fitted to Ohio State needs Ohio State's own data", close: "Data-sharing agreement, then load past seasons", yr: "Year 1", owner: "Ohio State", status: "Not approved" },
  { gap: "Portal-entry signals are only partly tested", why: "Alerts are only as good as the signals behind them", close: "Test Dan's full list on real rosters, keep what holds up", yr: "Year 1", owner: "Dan and FuzeBox", status: "Partly done (v4)" },
  { gap: "Disagreement between evaluators is unmeasured", why: "Noise in grades flows straight into any model", close: "Recorded sessions, then a variance study", yr: "Year 1–2", owner: "Methodology team", status: "Needs consent" },
  { gap: "No standard way to grade film", why: "Each evaluator grades from personal experience", close: "Write Ohio State's own measures with the staff", yr: "Year 2", owner: "Staff and methodology team", status: "Not started" },
  { gap: "Program effects are unmeasured", why: "Stats from a lower level overstate or hide ability", close: "Map how a jump in level changes a player's numbers", yr: "Year 2", owner: "Methodology team", status: "Not started" },
  { gap: "Measures have not been checked for reliability and validity", why: "An unchecked measure can look precise and still be wrong", close: "Check each measure before it is weighted", yr: "Year 1–2", owner: "Methodology team", status: "Not started" },
  { gap: "Outcomes are not linked back to evaluations", why: "There is no answer key to learn from", close: "Track the players evaluated, season by season", yr: "Year 1–3", owner: "Ohio State and FuzeBox", status: "Not started" },
  { gap: "No validated predictor", why: "Claiming prediction too early would mislead the staff", close: "Retrospective validation first, predictor only if it holds", yr: "Year 3", owner: "Methodology team", status: "Not started" },
  { gap: "Compensation data is limited", why: "Budget decisions rely on partial public ranges", close: "Use published ranges, clearly labeled; add team data if approved", yr: "Year 1–2", owner: "General manager", status: "Open" },
  { gap: "Production basics: sign-in, saved history, durable operations", why: "A demo is not a system the staff can rely on", close: "Build after approvals, with a compliance review", yr: "Year 1", owner: "FuzeBox", status: "Not built" },
];

// Guided tour steps
export const TOUR = [
  { go: "learn", sel: ".v6-video", title: "Start here", text: "This three-minute video explains the whole plan. Chapters on the right jump to each part." },
  { go: "talk", sel: ".v5-stage", title: "Talk to Edge", text: "Tap the mic and ask a question out loud, or type it. Edge answers out loud and builds the report next to the chat. Try: what are our biggest roster needs?" },
  { go: "talk", sel: ".v5-chips", title: "Suggestions", text: "Not sure what to ask? Tap a suggestion. Answers about needs, the watchlist, the brief, film and selection come straight from app data in under a second." },
  { go: "watch", sel: "#page", title: "Portal Watch", text: "Real 2026 rosters, ranked by the signals that held up when we tested them on past portal classes. It is a pattern score, not a report that a player is leaving." },
  { go: "signals", sel: "#page", title: "Signal Test", text: "Dan's signals, tested on real data. Group of Five overperformers entered the portal at 27 percent versus 18 percent. Distance from home mostly disappeared once in-state players were accounted for." },
  { go: "roster", sel: "#page", title: "Roster Needs", text: "Gaps at each position after expected departures and signees. The general manager's real needs list replaces the sample numbers." },
  { go: "rooms", sel: "#page", title: "Rooms and reports", text: "Five short scenes show how the staff would use this in the hallway, the film room, the Monday meeting, the selection room and on game day. Press play scene to hear one." },
  { go: "bots", sel: "#page", title: "Staff Bots", text: "Hire bots from the pool and give each a task in plain words. Watch the steps and the sources. Anything that would contact someone goes to the approval queue first." },
  { go: "lead", sel: "#page", title: "Leaderboard", text: "Three boards: Portal Watch on real data, the target board with staff votes, and how the bots are performing." },
  { go: "devices", sel: "#page", title: "Devices", text: "The same assistant on the big screen, a tablet in the film room, and a phone in the hallway. The watch view is optional; Dan said it is not a priority." },
  { go: "plan", sel: "#page", title: "This year and beyond", text: "What happens before December, during the January window, and in later years. Anything not signed or verified stays marked as to be decided." },
  { go: "faq", sel: "#page", title: "Questions", text: "The questions coaches and staff ask most, in plain language. Any answer can be sent to Edge with one tap." },
];

export const FAQ = [
  { c: "Basics", q: "What is this, in one sentence?", a: "A decision aid that helps the staff look at more transfer-portal players, faster, using the staff's own method. It organizes information; coaches decide." },
  { c: "Basics", q: "Does it pick players for us?", a: "No. It ranks and summarizes. The staff vote decides, and the system records who decided what." },
  { c: "Basics", q: "Why start with quarterbacks?", a: "Quarterbacks have the most data and the clearest stats. Dr. Rippee pointed to NFL studies suggesting quarterbacks and defensive ends were among the more predictable positions. Linemen and defensive backs are muddier, so they come later." },
  { c: "Basics", q: "Does any other program have this?", a: "Dan told us he is not aware of any program with a system like this. We have not verified that independently." },
  { c: "This year", q: "What do we get this year?", a: "Portal alerts based on tested signals, research bots that show their sources, a talk-to-it assistant on phone, tablet and big screen, and reports for roster needs, the Monday brief, film-room prep and the selection board." },
  { c: "This year", q: "When is the portal window?", a: "January 4 to 13, 2027, according to the NCAA Division I transfer-window calendar." , link: NCAA_CAL },
  { c: "This year", q: "Why come on site during the window instead of before?", a: "Most top players don't declare until the window opens, and that is when the staff does the most evaluating. Watching the real process at its peak is the point." },
  { c: "This year", q: "What does recording the film room mean?", a: "With permission, we capture coaches talking through film the way the Manning brothers talk through a game. We never interrupt. Afterwards we ask what you were looking for and why. The words become data; the recordings stay under Ohio State's control." },
  { c: "This year", q: "How will we know year one worked?", a: "Compare this year to last: how many quarterbacks got a real look, how fast after they entered, and how much staff time each evaluation took. The baseline is measured in December, before the window." },
  { c: "Method", q: "Why not just build a prediction model now?", a: "Because the inputs are noisy. Film grades differ between evaluators, programs differ, many measures have never been checked, and outcomes vary. A model trained on noise just carries the noise forward." },
  { c: "Method", q: "What is variance, in football terms?", a: "How far off people are from each other, and from what actually happened. Explaining the variance means finding out why. If we can explain about half of it, a prediction tool becomes worth building." },
  { c: "Method", q: "What is a program effect?", a: "The part of a player's results that comes from his program, not from him. A quarterback who looked great at a smaller school can struggle in the Big Ten, and a player moving up to better coaching can improve." },
  { c: "Method", q: "What is structural equation modeling (SEM)?", a: "A statistics method that estimates how much each factor, such as grading, program or measurement, contributes to the differences we see. Whether our data is big enough for it is still being checked." },
  { c: "Method", q: "What is retrospective validation?", a: "Running the model on past classes where we already know what happened, like 2024 and 2025, to see how close it gets before anyone relies on it." },
  { c: "Method", q: "What does pattern score mean on Portal Watch?", a: "A statistical estimate from past portal classes of how often players with a similar profile entered the portal. It is not a report that a specific player is leaving." },
  { c: "Future", q: "What comes in year two and year three?", a: "Year two: Ohio State's own standard measures, more skill positions, program effects mapped and validation on past classes. Year three: computer vision measuring film the staff's way, and a predictor only if validation holds." },
  { c: "Future", q: "Will it ever say whether we should go after a player?", a: "That is the year-three goal: an estimate of how likely a player is to succeed at Ohio State specifically. It will only ship if it beats past seasons in a fair test." },
  { c: "Trust", q: "Does anything get sent automatically?", a: "No. Bots research and draft. Anything that would contact a person, or send a brief, waits for a named approval." },
  { c: "Trust", q: "Will it use leaked competitor information?", a: "No. Dan flagged that as an organizational risk, and the system only uses public, licensed or Ohio State-provided data." },
  { c: "Trust", q: "Who sees player data?", a: "Only approved Ohio State staff, after a privacy and compliance review. Real sign-in and saved history are not built yet and depend on that review." },
  { c: "Using it", q: "Do coaches have to learn anything?", a: "No. Talk to it on a phone or tablet the way you would talk to an analyst. Typing works too." },
  { c: "Using it", q: "Why does the mic not work for me?", a: "Voice needs microphone permission and a browser with speech support, such as Chrome or Edge. Inside some embedded previews the mic is blocked; typing works everywhere." },
  { c: "Using it", q: "Is the data real?", a: "Portal Watch, Signal Test, the real quarterback backtest and college data use real public data. Board players, rosters and scenes elsewhere are fictional samples, labeled on every screen." },
];

export const GLOSSARY = [
  ["Decision aid", "A tool that organizes information so people decide faster and more consistently. It does not decide for them."],
  ["Signal", "A pattern in public data linked to something happening, such as a player entering the portal."],
  ["Pattern score", "How often players with a similar profile entered the portal in past classes. A statistical estimate, not a report about a person."],
  ["Variance", "How much results differ, between evaluators and from what actually happened."],
  ["Explained variance", "The share of those differences we can account for. About half is the bar discussed for a useful predictor."],
  ["Measurement error", "Differences that come from how something was measured, such as two evaluators grading the same film differently."],
  ["Program effect", "The part of a player's results that comes from the program around him."],
  ["Reliability", "A measure comes out the same way every time."],
  ["Validity", "A measure actually predicts what it claims to predict."],
  ["Psychometrics", "The discipline of checking that measures are reliable and valid."],
  ["Structural equation modeling (SEM)", "A method that estimates how much each factor contributes to the differences we see."],
  ["Retrospective validation", "Testing a model on past seasons where the outcome is already known."],
  ["Computer vision", "Software that measures things in video, such as release time or depth of drop, the same way every time."],
  ["Staff bot", "An AI agent that runs a task, such as research, and shows its steps and sources."],
  ["Approval queue", "Where anything that would contact someone waits for a named person to approve it."],
];
