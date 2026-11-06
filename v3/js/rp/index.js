// v3 Recruiting Platform: navigation, routing and event wiring. Plugs into the v2 Portal Lab shell.
import { RP, prog, S, G, all, byId, can, audit, api, bump, queue, online, syncQueue, setProgram, setRole, setTheme, checkBackend, defaultSettings } from "./store.js";
import { pageBoard, pageProspect, UI } from "./pages_eval.js";
import { pageSearch, pageMap, pageSimilar, pageDiscovery, pageQuestionnaire, pageActivity, pageNews, pageAutomation, FUI, scanText, runWorker, dupOf } from "./pages_find.js";
import { pageRoster, pageBudget, pageFMV, pageLikely, pageCompliance, pageCamps, pageBrief, contactCheck } from "./pages_plan.js";
import { pageHC, pageArea, pageGM, pageDirector, pageEvalQ, pageAnnual, pageProven, pageSettings, CUI } from "./pages_cmd.js";
import { NEWS_SAMPLES, POS, STATES } from "./data.js";

export const RP_NAV = [
  { k: "hc", g: "Command", label: "Head Coach" }, { k: "area", g: "Command", label: "Area Recruiter" }, { k: "gm", g: "Command", label: "General Manager" }, { k: "director", g: "Command", label: "Recruiting Director" }, { k: "evalq", g: "Command", label: "Evaluation Quality" },
  { k: "prospects", g: "Evaluate", label: "National Board (CEG)" }, { k: "prospect", g: "Evaluate", label: "Prospect Profile" },
  { k: "search", g: "Find", label: "Plain-English Search" }, { k: "map", g: "Find", label: "National Map" }, { k: "similar", g: "Find", label: "Players Like This" }, { k: "discovery", g: "Find", label: "Discovery Queue" }, { k: "questionnaire", g: "Find", label: "Questionnaire" }, { k: "activity", g: "Find", label: "Recruiting Activity" }, { k: "news", g: "Find", label: "News Scanner" }, { k: "automation", g: "Find", label: "Automation Worker" },
  { k: "roster", g: "Plan", label: "Roster Needs" }, { k: "budget", g: "Plan", label: "Budget Plan" }, { k: "fmv", g: "Plan", label: "FMV Review" }, { k: "likely", g: "Plan", label: "Commit Likelihood" }, { k: "compliance", g: "Plan", label: "Compliance" }, { k: "camps", g: "Plan", label: "Camps" }, { k: "brief", g: "Plan", label: "Monday Brief" },
  { k: "annual", g: "Measure", label: "Annual Validation" }, { k: "proven", g: "Measure", label: "What Is Proven" }, { k: "settings", g: "Measure", label: "Platform & Settings" },
];
export const RP_TITLES = Object.fromEntries(RP_NAV.map((n) => [n.k, [n.label, ""]]));
const SUBS = { hc: "Class at a glance", area: "Territory, players, alerts and tasks", gm: "Roster investment and value per dollar", director: "Operations, feeds and compliance", evalq: "Grader agreement, hit, bust and find", prospects: "Composite Evaluation Grade, 1–9", prospect: "CEG calculation, traits, film and activity", search: "Type the way a coach talks", map: "Prospects by state", similar: "Nearest matches", discovery: "Leads, scores and duplicates", questionnaire: "Public prospect form", activity: "Who is recruiting whom", news: "Extract players and stats with quotes", automation: "Background worker and its log", roster: "Needs by position", budget: "Revenue-share allocation", fmv: "GM only", likely: "Estimates", compliance: "Sample calendar and contact guard", camps: "Offline check-in and laser times", brief: "Draft, approval required", annual: "Reweighting and recalibration", proven: "Our measured status", settings: "Program, roles, settings, API" };
Object.keys(RP_TITLES).forEach((k) => (RP_TITLES[k][1] = SUBS[k]));
export const isRP = (k) => RP_NAV.some((n) => n.k === k);

export function rpPage(screen, param) {
  prog();
  const f = { hc: pageHC, area: pageArea, gm: pageGM, director: pageDirector, evalq: pageEvalQ, prospects: pageBoard, prospect: () => pageProspect(param || UI.lastId), search: pageSearch, map: pageMap, similar: () => pageSimilar(param), discovery: pageDiscovery, questionnaire: pageQuestionnaire, activity: pageActivity, news: pageNews, automation: pageAutomation, roster: pageRoster, budget: pageBudget, fmv: pageFMV, likely: pageLikely, compliance: pageCompliance, camps: pageCamps, brief: pageBrief, annual: pageAnnual, proven: pageProven, settings: pageSettings }[screen];
  if (screen === "prospect" && param) UI.lastId = param;
  if (screen === "questionnaire") FUI.qStart = Date.now();
  return `<div class="rp">${f()}</div>`;
}
export function rpBar() {
  return `<div class="rp-bar-top"><span class="rp-prog">${prog().settings.name}</span><label class="sr" for="rp-role-top">Role</label><select id="rp-role-top" data-rpi="role" title="Demo sign-in role">${["Evaluator", "Coordinator", "GM", "Admin"].map((r) => `<option ${r === RP.role ? "selected" : ""}>${r}</option>`).join("")}</select><button class="btn sm" data-rpa="theme" aria-label="Toggle night theme">${RP.theme === "dark" ? "Day" : "Night"}</button></div>`;
}

export function bindRP(ctx) {
  RP.ctx = ctx; setTheme(RP.theme);
  const re = () => ctx.render();
  checkBackend(re);
  window.addEventListener("online", async () => { const r = await syncQueue(); if (r.sent) ctx.toast(`Back online · synced ${r.sent} queued items`); re(); });
  window.addEventListener("offline", re);
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("./sw.js").catch(() => {});

  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-rpa]"); if (!t) return;
    const a = t.dataset.rpa, id = t.dataset.id, P = prog();
    if (a === "open") { UI.ptab = "ceg"; return ctx.go("prospect", id); }
    if (a === "go") { const [s, p] = id.split("/"); return ctx.go(s, p); }
    if (a === "ptab") { UI.ptab = id; return re(); }
    if (a === "watch") { P.watch.has(id) ? P.watch.delete(id) : P.watch.add(id); audit("watchlist", `${P.watch.has(id) ? "Add" : "Remove"} ${byId(id).name}`); return re(); }
    if (a === "state") { FUI.mapSel = FUI.mapSel === id ? null : id; return re(); }
    if (a === "role") { setRole(id); audit("role", `Demo sign-in as ${id}`); ctx.toast(`Signed in as ${id} (demo)`); return re(); }
    if (a === "theme") { setTheme(RP.theme === "dark" ? "light" : "dark"); return re(); }
    if (a === "search") { FUI.q = document.getElementById("q-in").value; return re(); }
    if (a === "ex") { FUI.q = id; return ctx.go("search"); }
    if (a === "save-search") { const { runSearch } = await import("./pages_find.js"); FUI.q = document.getElementById("q-in").value; P.saved.unshift({ q: FUI.q, n: runSearch(FUI.q).list.length }); audit("search.save", `Save search “${FUI.q}”`); ctx.toast("Saved · you'll be alerted when a new player matches"); return re(); }
    if (a === "contact") {
      const p = byId(id), type = document.getElementById("ct-type").value, date = document.getElementById("ct-date").value || "2026-11-04", reason = (document.getElementById("ct-why")?.value || "").trim();
      const chk = contactCheck(p, type, date);
      P.guardLog ||= [];
      if (!chk.ok) {
        if (!(can("override") && reason.length >= 8)) { P.blocked = (P.blocked || 0) + 1; P.guardLog.unshift({ ts: new Date().toISOString(), name: p.name, why: chk.why, ok: false }); audit("compliance.block", `Blocked: ${p.name} · ${chk.why}`, "Compliance guard", "rule"); ctx.toast(can("override") ? "Blocked · add an override reason (8+ characters) to proceed" : "Blocked by the compliance guard · a coordinator can override with a reason"); return re(); }
        P.guardLog.unshift({ ts: new Date().toISOString(), name: p.name, why: chk.why, ok: true, reason, role: RP.role });
      }
      const rec = { pid: id, type, date, note: document.getElementById("ct-note").value.slice(0, 140), override: !chk.ok, reason: chk.ok ? "" : reason, queued: !online() };
      P.contactsLog.unshift(rec); p.contacts++; bump();
      if (!online()) queue.push({ kind: "contact", pid: id, name: p.name, detail: `${type} ${date}` }); else api("/api/rp/sync", { method: "POST", body: { items: [{ kind: "contact", ...rec, qid: "c" + Date.now() }] } }).catch(() => {});
      audit("contact.log", `${rec.override ? "Override" : "Contact"}: ${p.name} · ${type} · ${date}${rec.override ? " · reason: " + reason : ""}`);
      ctx.toast(rec.override ? "Logged with coordinator override" : rec.queued ? "Saved offline · will sync" : "Contact logged"); return re();
    }
    if (a === "promote" || a === "dismiss") {
      const l = P.leads.find((x) => x.id === id);
      if (a === "dismiss") { P.dismissed.add(id); audit("lead.dismiss", `Dismiss lead ${l.name}`); return re(); }
      const d = dupOf(l);
      if (d) { P.promoted.add(id); audit("lead.merge", `Merge lead ${l.name} into ${d.name} (source: ${l.source})`); ctx.toast(`Merged into ${d.name}`); return re(); }
      const base = all().find((x) => x.pos === l.pos && x.type === "hs") ;
      const np = { ...structuredClone(base), id: "H" + String(9000 + P.promoted.size), name: l.name, state: l.state, cls: l.cls, ht: l.ht, wt: l.wt, forty: l.forty, fortySrc: l.fortySrc, stage: "Identified", traits: base.traits.map((t) => ({ t: t.t, g1: null, g2: null })), character: null, offers: [], visitsElsewhere: [], contacts: 0, ov: false, uv: 0, film: l.film ? 1 : 0, ask: null, hist: [{ stage: "Identified", date: "2026-11-04", by: "Promoted from discovery queue" }], addedVia: l.source, snaps: 120 + (l.stat % 300), prodRaw: 5 + Math.min(2, l.stat / 900) };
      P.prospects.unshift(np); P.promoted.add(id); bump();
      audit("lead.promote", `Promote ${l.name} to the board (source: ${l.source})`);
      ctx.toast(`${l.name} added to the board · needs a first evaluation`); return re();
    }
    if (a === "csv") {
      const rows = document.getElementById("csv-txt").value.trim().split(/\r?\n/).slice(1); let n = 0, bad = 0;
      rows.forEach((r, i) => { const [name, pos, state, cls, ht, wt, forty, src, film] = r.split(",").map((x) => x.trim()); const PU = (pos || "").toUpperCase(), SU = (state || "OH").toUpperCase(); if (!name || !POS.includes(PU) || !STATES[SU]) { bad++; return; } P.leads.unshift({ id: "LC" + Date.now().toString(36) + i, name, pos: PU, state: SU, cls: [2027, 2028, 2029].includes(+cls) ? +cls : 2028, ht: +ht || 72, wt: +wt || 190, forty: +forty || 4.8, fortySrc: ["laser", "camp", "hand", "self"].includes((src || "").toLowerCase()) ? src.toLowerCase() : "self", film: /^y/i.test(film || "") || +film > 0, stat: 0, source: "CSV import (staff upload)", received: "2026-11-04" }); n++; });
      audit("lead.csv", `CSV import: ${n} rows accepted, ${bad} rejected (unknown position or state)`); ctx.toast(`Imported ${n} leads${bad ? ` · ${bad} rejected (unknown position or state)` : ""}`); return re();
    }
    if (a === "qsubmit") {
      const v = (x) => document.getElementById(x).value, msg = document.getElementById("qf-msg");
      if (!v("qf-name").trim()) { msg.textContent = "Name is required."; return; }
      if (!document.getElementById("qf-ok").checked) { msg.textContent = "Please confirm the consent box."; return; }
      const body = { name: v("qf-name").trim().slice(0, 60), pos: v("qf-pos"), cls: +v("qf-cls"), state: v("qf-st"), ht: +v("qf-ht"), wt: +v("qf-wt"), forty: +v("qf-40"), film: v("qf-film").slice(0, 200), website: v("qf-web"), elapsed_ms: Date.now() - (FUI.qStart || Date.now()) };
      let server = "";
      try { const r = await api("/api/rp/questionnaire", { method: "POST", body }); server = r.id ? ` · stored on server as ${r.id}` : ""; }
      catch (err) { msg.textContent = "Not accepted: " + err.message; audit("questionnaire.reject", `Questionnaire rejected: ${err.message}`, "Questionnaire guard", "rule"); return; }
      P.questionnaire.unshift(body); P.leads.unshift({ id: "LQ" + Date.now().toString(36), name: body.name, pos: body.pos, state: body.state, cls: body.cls, ht: body.ht, wt: body.wt, forty: body.forty, fortySrc: "self", film: !!body.film, stat: 0, source: "Online questionnaire", received: "2026-11-04" });
      audit("questionnaire", `Questionnaire from ${body.name}${server}`, "Online questionnaire", "observed");
      ctx.toast("Received · added to the discovery queue" + server); FUI.qStart = Date.now(); return ctx.go("discovery");
    }
    if (a === "alerts-read") { P.alerts.forEach((x) => (x.read = true)); return re(); }
    if (a === "news-sample") { FUI.news = NEWS_SAMPLES[+id].text; FUI.newsSrc = NEWS_SAMPLES[+id].src; FUI.scan = null; FUI.ai = null; return re(); }
    if (a === "news-scan") { FUI.news = document.getElementById("news-txt").value; FUI.scan = scanText(FUI.news); audit("news.scan", `Scanner: ${FUI.scan.length} players extracted (${FUI.newsSrc})`, FUI.newsSrc, "auto"); return re(); }
    if (a === "news-ai") {
      FUI.news = document.getElementById("news-txt").value; FUI.aiBusy = true; re();
      try { FUI.ai = await api("/api/rp/scan", { method: "POST", body: { text: FUI.news.slice(0, 4000) } }); audit("news.ai", `AI reader: ${(FUI.ai.players || []).length} players`, "Perplexity Agent API via server", "auto"); }
      catch (err) { FUI.ai = { error: "AI reader unavailable: " + err.message + ". The rule-based scanner still works." }; }
      FUI.aiBusy = false; return re();
    }
    if (a === "worker") { const lg = runWorker(); ctx.toast(`Worker run complete · ${lg.length} steps logged`); return re(); }
    if (a === "camp-add") {
      const v = (x) => document.getElementById(x).value;
      if (!v("cp-name").trim()) return ctx.toast("Name is required");
      if (!document.getElementById("cp-consent").checked) return ctx.toast("Record guardian consent first");
      const item = { kind: "camp", name: v("cp-name").trim().slice(0, 60), pos: v("cp-pos"), cls: +v("cp-cls"), state: v("cp-st").toUpperCase().slice(0, 2), forty: +v("cp-40"), vert: +v("cp-vert"), detail: `laser 40 ${v("cp-40")} · vert ${v("cp-vert")}` };
      const match = all().find((p) => p.name.toLowerCase() === item.name.toLowerCase());
      if (match) { match.forty = item.forty; match.fortySrc = "laser"; match.vert = item.vert; bump(); audit("camp.verify", `Camp: verified laser 40 ${item.forty} for ${match.name}`, "Camp check-in (laser)", "observed"); }
      (P.campDone ||= []).push(item);
      if (!online()) { queue.push(item); ctx.toast("No signal · saved on this device, will sync"); }
      else { queue.push(item); const r = await syncQueue(); ctx.toast(match ? `Verified on ${match.name}'s profile · synced` : `Saved · synced ${r.sent}${r.server ? " to server" : ""}`); }
      return re();
    }
    if (a === "offline") { RP.offlineSim = !RP.offlineSim; if (!RP.offlineSim) { const r = await syncQueue(); if (r.sent) ctx.toast(`Back online · synced ${r.sent} items${r.server ? " to the server" : ""}`); } return re(); }
    if (a === "sync") { const r = await syncQueue(); ctx.toast(r.offline ? "Still offline" : `Synced ${r.sent} items${r.server ? " to the server" : ""}`); return re(); }
    if (a === "brief-copy") { const ta = document.getElementById("brief-txt"); try { await navigator.clipboard.writeText(ta.value); } catch { ta.select(); document.execCommand("copy"); } return ctx.toast("Draft copied"); }
    if (a === "brief-send") { audit("brief.request", "Approval requested for Monday brief (not sent)"); return ctx.toast("Approval requested · nothing was sent"); }
    if (a === "apply-weights") { const { validation } = await import("./pages_cmd.js"); const v = validation(); S().weights.hs = v.res.hs.sug; S().weights.transfer = v.res.transfer.sug; bump(); audit("settings.weights", `Apply suggested weights HS ${JSON.stringify(v.res.hs.sug)} transfer ${JSON.stringify(v.res.transfer.sug)}`, "Annual validation"); ctx.toast("Weights applied · everyone re-scored"); return re(); }
    if (a === "apply-settings") { try { const j = JSON.parse(document.getElementById("settings-json").value); if (!j.weights || !j.traits) throw new Error("Missing weights or traits"); prog().settings = j; bump(); CUI.settingsErr = ""; audit("settings.apply", "Settings file updated"); api("/api/rp/settings", { method: "POST", body: j }).catch(() => {}); ctx.toast("Settings applied · everyone re-scored"); } catch (err) { CUI.settingsErr = "Not applied: " + err.message; } return re(); }
    if (a === "reset-settings") { prog().settings = defaultSettings(RP.pid); bump(); CUI.settingsErr = ""; audit("settings.reset", "Settings reset to defaults"); return re(); }
    if (a === "export-settings") { const b = new Blob([JSON.stringify(S(), null, 2)], { type: "application/json" }); const l = document.createElement("a"); l.href = URL.createObjectURL(b); l.download = `settings-${RP.pid}.json`; l.click(); return; }
    if (a === "endpoints") { try { CUI.endpoints = (await api("/api/rp/endpoints")).endpoints; } catch { CUI.endpoints = ["Server not connected"]; } return re(); }
  });

  document.addEventListener("change", (e) => {
    const t = e.target; if (!t.dataset.rpi) return;
    const k = t.dataset.rpi, P = prog();
    if (k === "bf") { UI.bf[t.dataset.k] = t.value; return re(); }
    if (k === "trait") { const p = byId(t.dataset.id), i = +t.dataset.i, v = t.value === "" ? null : +t.value; p.traits[i][t.dataset.k] = v; P.staffLocked[p.id + ":" + i] = true; bump(); audit("grade.trait", `${p.name}: ${p.traits[i].t} ${t.dataset.k === "g1" ? "grader 1" : "grader 2"} → ${v ?? "cleared"} · CEG now ${G(p.id).c.grade.toFixed(2)}`); ctx.toast(`Re-scored · CEG ${G(p.id).c.grade.toFixed(2)}`); return re(); }
    if (k === "third") { const p = byId(t.dataset.id), i = +t.dataset.i; P.third[p.id] ||= {}; if (t.value === "") delete P.third[p.id][i]; else P.third[p.id][i] = +t.value; bump(); audit("grade.third", `${p.name}: third look on ${p.traits[i].t} → ${t.value || "cleared"} · CEG ${G(p.id).c.grade.toFixed(2)}`); return re(); }
    if (k === "prod") { const p = byId(t.dataset.id); p.prodRaw = +t.value; P.staffLocked[p.id + ":prod"] = true; delete P.suggested[p.id]; bump(); audit("grade.production", `${p.name}: staff production grade ${t.value} (automation will not overwrite)`); return re(); }
    if (k === "cdate") { UI.cdate = t.value; return re(); }
    if (k === "sim") return ctx.go("similar", t.value);
    if (k === "terr") { CUI.terr = t.value; return re(); }
    if (k === "actF") { FUI.actF = t.value; return re(); }
    if (k === "program") { setProgram(t.value); prog(); audit("program", `Switch program → ${S().name}`); ctx.toast(`Now viewing ${S().name} · separate data and settings`); return re(); }
    if (k === "role") { setRole(t.value); audit("role", `Demo sign-in as ${t.value}`); return re(); }
    if (k === "theme") { setTheme(t.value); return re(); }
  });
  document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.dataset?.rpa === "state") { e.preventDefault(); e.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); } if (e.key === "Enter" && e.target.id === "q-in") { FUI.q = e.target.value; re(); } });
  FUI.qStart = Date.now();
}
