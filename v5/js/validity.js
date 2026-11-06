// Validity Scorecard: Messick's (1995) six aspects applied to the Portal Lab (Assessment, Table 2),
// with what the v2 build adds and what only the OSU pilot can establish.
import { FEATURES, DEFS } from "./data.js";

const ASPECTS = [
  { a: "Content", q: "Do the inputs represent what transfer success requires at the destination?", st: "Partial", c: "partial",
    was: "No destination or behavioral inputs.",
    v2: "Adds the continuous program rating gap, destination and origin program effects, returning production at the position, incoming same-position transfers and head-coach change. Adds a behavioral and post-decision variance component.",
    pilot: "Coordinator-continuity coding, scheme-fit tags, and an estimate of the behavioral variance from real outcomes." },
  { a: "Substantive", q: "Is there a theory linking inputs to the outcome?", st: "Partial", c: "partial",
    was: "Production theory supported; film and staff mechanisms unstated.",
    v2: "Weights are labelled as associations, not causes, on every profile. The what-if is labelled as a comparison with similar players, not a within-player effect.",
    pilot: "A stated mechanism for film and staff grades, tested in the reliability study." },
  { a: "Structural", q: "Does the scoring structure match the construct?", st: "Plausible", c: "high",
    was: "Hierarchical structure is appropriate.",
    v2: "Crossed random effects for programs; the paired outcome separates opportunity from contribution; the 3×3 outcome grid shows the full outcome space.",
    pilot: "Confirm the paired outcome with the staff before data access (pre-registration)." },
  { a: "Generalizability", q: "Do results hold across positions, programs and seasons?", st: "Not established", c: "weak",
    was: "Single synthetic held-out class.",
    v2: "Walk-forward folds on synthetic data; a real quarterback backtest on 2022–2025 classes with bootstrap intervals and results by fold.",
    pilot: "Real backtests for other position groups, which need licensed snap counts for offensive line, linebackers and defensive backs." },
  { a: "External", q: "Do scores relate to independent criteria as expected?", st: "Not established", c: "weak",
    was: "Criteria contaminated by the grading provider and by staff-controlled opportunity.",
    v2: "Same-provider rule enforced in code. Staff grades are also judged on contribution only, a criterion the staff does not control. The real QB test uses public usage and PPA, independent of any grader.",
    pilot: "Inter-rater reliability (ICC(2,1), ICC(2,k)) with at least three staff and the provider; blind staff rankings against the model." },
  { a: "Consequential", q: "What happens when decisions are made on the scores?", st: "Not addressed", c: "unmeasured",
    was: "Performative effects unmodelled.",
    v2: "Board positions and shifts against comparable moves replace single-player verdicts; estimates beyond 10–90% are flagged; every score is hash-chained in the Run Journal.",
    pilot: "Prospective January 2027 test with locked scores and a record of which players were pursued and how much opportunity each received." },
];

export function pageValidity(esc, S) {
  const bt = S.bt;
  const vb = (v) => `<span class="vb vb-${v.c}">${esc(v.l)}</span>`;
  return `
  <div class="callout fz">Validity belongs to the use of a score, not to the model (Messick, 1995). This page records where the evidence stands on each aspect, what this build adds, and what only the OSU pilot can establish. It is reviewed again after each step of the Pilot Design.</div>
  <section class="card" style="margin-top:14px"><div class="card-h"><div><h3>Messick's six aspects · current status</h3><p>Status follows the Assessment (Table 2). The v2 build moves the evidence forward but does not change any status until real outcomes are in.</p></div></div>
    <div class="scroll-x"><table class="t vtab"><thead><tr><th>Aspect</th><th>Question</th><th>Status</th><th>What v2 adds</th><th>What the pilot must establish</th></tr></thead><tbody>
    ${ASPECTS.map((x) => `<tr><td><b>${x.a}</b></td><td>${esc(x.q)}<div class="dim small">Before: ${esc(x.was)}</div></td><td><span class="vb vb-${x.c}">${x.st}</span></td><td>${esc(x.v2)}</td><td>${esc(x.pilot)}</td></tr>`).join("")}</tbody></table></div></section>
  <div class="grid g2" style="margin-top:14px">
    <section class="card"><div class="card-h"><div><h3>Instruments · provenance and validity status</h3><p>Where each input comes from, kept separate from what is known about its measurement quality.</p></div></div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Input</th><th>Provenance</th><th>Validity status</th></tr></thead><tbody>
      ${FEATURES.map((f) => `<tr><td>${esc(f.label)}</td><td>${esc(f.prov)}</td><td>${vb(f.valid)}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="card"><div class="card-h"><div><h3>Success definitions · can they be verified?</h3><p>Accuracy claims are restricted to outcomes that can be checked on historical data.</p></div></div>
      <div class="scroll-x"><table class="t"><thead><tr><th>Definition</th><th>Verifiability</th></tr></thead><tbody>
      ${Object.values(DEFS).map((d) => `<tr><td><b>${esc(d.label)}</b><div class="dim small">${esc(d.short.replace("{snap}", S.cfg.th.snap).replace("{grade}", S.cfg.th.grade))}</div></td><td>${vb(d.verif)}</td></tr>`).join("")}</tbody></table></div>
      <p class="note" style="padding:0 16px 14px">Only "Two years on roster" is fully verifiable from public records today. The paired definition is verifiable for offensive players through public usage and PPA.</p></section>
  </div>
  ${bt ? `<section class="card card-pad" style="margin-top:14px"><div class="card-h"><div><h3>Current evidence snapshot · ${esc(S.cfg.pos)}, synthetic</h3></div></div>
    <div class="specs">
      <div><span>Held-out class</span><b>${bt.test} · ${bt.rows.length} transfers</b></div>
      <div><span>Brier · full / rating-only / staff-only</span><b>${bt.full.met.brier.toFixed(3)} / ${bt.rating.met.brier.toFixed(3)} / ${bt.staff.met.brier.toFixed(3)}</b></div>
      <div><span>Calibration slope</span><b>${bt.full.met.slope.toFixed(2)}</b></div>
      <div><span>Staff grades and AUC</span><b>${bt.full.met.auc.toFixed(3)} with · ${bt.noStaff.met.auc.toFixed(3)} without</b></div>
      <div><span>Real-data evidence</span><b><button class="lnk" data-go="qbreal">Real QB Backtest</button></b></div>
    </div></section>` : ""}`;
}
