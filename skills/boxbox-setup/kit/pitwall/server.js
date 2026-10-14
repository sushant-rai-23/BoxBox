#!/usr/bin/env node
// Boxbox pit wall server. Node 18+, no dependencies. Lives in .boxbox/pitwall/.
//   node .boxbox/pitwall/server.js                 run the server (127.0.0.1 only)
//   node .boxbox/pitwall/server.js --ensure [--open]   start it if it is not running, print its URL
//   node .boxbox/pitwall/server.js --summary <unit>    print tokens, cost and scope flags for a unit
//   --box <path>   the .boxbox folder to serve (default: the one this file sits in). The hooks run the
//                  plugin's own copy of this file with --box, so a repo's files are never executed.
// Serves the pit wall page and .boxbox/ read-only. The only writes are POST /api/pause and
// /api/resume, which create or delete .boxbox/live/PAUSE and need the token from .boxbox/live/token.
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");

const PITWALL = __dirname;
const boxArg = process.argv.indexOf("--box");
const BOX = boxArg > 0 && process.argv[boxArg + 1] ? path.resolve(process.argv[boxArg + 1]) : path.resolve(PITWALL, "..");
const ROOT = path.resolve(BOX, "..");
const LIVE = path.join(BOX, "live");
const FIRST_PORT = 4747;
const IDLE_EXIT_MS = 2 * 60 * 60 * 1000;

/* ================= pure parts (tested) ================= */

function parseBoard(text) {
  const t = String(text || "");
  const eq = t.indexOf("window.BOXBOX_BOARD");
  if (eq < 0) return null;
  const a = t.indexOf("{", eq), b = t.lastIndexOf("}");
  if (a < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

function parseState(text) {
  const out = {};
  for (const line of String(text || "").split("\n")) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const escRe = s => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
function globToRegExp(g) {
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") {
        i++;
        if (g[i + 1] === "/") { i++; re += "(?:.*/)?"; } else re += ".*";
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "{") {
      const j = g.indexOf("}", i);
      if (j < 0) { re += "\\{"; continue; }
      re += "(?:" + g.slice(i + 1, j).split(",").map(escRe).join("|") + ")";
      i = j;
    } else re += escRe(c);
  }
  return new RegExp("^" + re + "$");
}
function matchAny(p, globs) {
  if (!Array.isArray(globs)) return false;
  return globs.some(g => {
    g = String(g).replace(/^\.\//, "").replace(/\/$/, "");
    if (globToRegExp(g).test(p)) return true;
    return !/[*?{]/.test(g) && p.startsWith(g + "/");
  });
}

// A task's brief as a link the pit wall can open: a plain .md path inside .boxbox, served under /b/.
function briefHref(brief) {
  const p = String(brief || "");
  return /^[\w.-]+(\/[\w.-]+)*\.md$/.test(p) && !p.split("/").includes("..") ? "/b/" + p : null;
}

// "claude-opus-5-5[1m]" -> "opus" (the same rule as hooks/routing.js; the kit cannot load the hooks).
function familyOf(model) {
  const m = String(model || "").toLowerCase().match(/^(?:claude-)?(opus|sonnet|haiku|fable)(?:\b|-)/);
  return m ? m[1] : null;
}

function usageTotal(e) { return e.input + e.output + e.cacheWrite5m + e.cacheWrite1h + e.cacheRead; }

// Claude Code writes one assistant message on several lines while it streams, with usage
// growing. Keep one entry per message.id: the line with the highest usage.
function ingestClaudeLines(byId, lines, meta) {
  for (const line of lines) {
    if (!line || line.indexOf('"usage"') < 0) continue;
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    const m = d.message;
    if (d.type !== "assistant" || !m || !m.usage) continue;
    const u = m.usage, cc = u.cache_creation;
    const e = {
      ts: d.timestamp || "", model: m.model || "", session: meta.session || "", agent: "claude-code", sub: meta.sub || "",
      input: u.input_tokens || 0, output: u.output_tokens || 0,
      cacheWrite5m: cc ? cc.ephemeral_5m_input_tokens || 0 : u.cache_creation_input_tokens || 0,
      cacheWrite1h: cc ? cc.ephemeral_1h_input_tokens || 0 : 0,
      cacheRead: u.cache_read_input_tokens || 0
    };
    const id = m.id || d.uuid;
    const old = byId.get(id);
    if (!old || usageTotal(e) >= usageTotal(old)) byId.set(id, old ? { ...e, ts: old.ts } : e);
  }
}

// Codex writes running totals; each new total minus the last one is what that turn used.
function ingestCodexLines(st, lines, meta) {
  const out = [];
  for (const line of lines) {
    if (!line) continue;
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    if (d.type === "turn_context" && d.payload && d.payload.model) { st.model = d.payload.model; continue; }
    if (d.type !== "event_msg" || !d.payload || d.payload.type !== "token_count") continue;
    const t = d.payload.info && d.payload.info.total_token_usage;
    if (!t) continue;
    const p = st.prev || { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, total_tokens: 0 };
    if ((t.total_tokens || 0) <= (p.total_tokens || 0)) continue;
    st.prev = t;
    const dIn = (t.input_tokens || 0) - (p.input_tokens || 0);
    const dCached = (t.cached_input_tokens || 0) - (p.cached_input_tokens || 0);
    out.push({
      ts: d.timestamp || "", model: st.model || "", session: meta.session || "", agent: "codex", sub: "",
      input: dIn - dCached, output: (t.output_tokens || 0) - (p.output_tokens || 0), cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: dCached
    });
  }
  return out;
}

function priceFor(model, prices) {
  const table = (prices && prices.models) || {};
  model = String(model || "").replace(/\[[^\]]*\]$/, "");   // "claude-opus-5-5[1m]": the tag names the context window, not another model
  const keys = Object.keys(table).sort((a, b) => b.length - a.length);
  // Exact id, or the id plus a date suffix. "claude-opus-5-7" must not take "claude-opus-5"'s price.
  const k = keys.find(k => model === k || (model.startsWith(k) && /^[-@]\d{6,}$/.test(model.slice(k.length))));
  return k ? table[k] : null;
}

// Cost of one entry in dollars, or null when a needed rate is missing. Never guesses a rate.
function costOf(e, p) {
  if (!p) return null;
  const parts = [[e.input, p.input], [e.output, p.output], [e.cacheWrite5m, p.cache_write_5m], [e.cacheWrite1h, p.cache_write_1h], [e.cacheRead, p.cache_read]];
  let sum = 0;
  for (const [n, rate] of parts) {
    if (!n) continue;
    if (typeof rate !== "number") return null;
    sum += n * rate;
  }
  return sum / 1e6;
}

function blank(id, name) { return { id, name, fresh: 0, cache: 0, tokens: 0, cost: 0, priced: true, ms: 0 }; }
function add(row, e, prices, unpriced) {
  const fresh = e.input + e.output + e.cacheWrite5m + e.cacheWrite1h;
  row.fresh += fresh; row.cache += e.cacheRead; row.tokens += fresh + e.cacheRead;
  const c = costOf(e, priceFor(e.model, prices));
  if (c === null) { row.priced = false; if (unpriced && e.model) unpriced.add(e.model); }
  else row.cost += c;
}

// A unit row's tokens and cost per model: { "claude-opus-5-5": { tokens, cost } }.
function addModel(row, e, prices) {
  row.models = row.models || {};
  const m = row.models[e.model || "unknown"] = row.models[e.model || "unknown"] || blank();
  add(m, e, prices, null);
}

// "Saved versus all on the session model": every subagent token re-priced at the rates of its
// session's own model (the model of the session's main transcript). An estimate: the session model
// might have used fewer tokens for the same work.
function savings(entries, prices) {
  const mainModel = new Map();
  for (const e of entries) if (!e.sub && e.model) { const m = mainModel.get(e.session) || {}; m[e.model] = (m[e.model] || 0) + usageTotal(e); mainModel.set(e.session, m); }
  const top = m => Object.entries(m || {}).sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || "";
  let actual = 0, atSession = 0, priced = true, sessionModel = "";
  for (const e of entries) {
    if (!e.sub) continue;
    const sm = top(mainModel.get(e.session));
    sessionModel = sessionModel || sm;
    const a = costOf(e, priceFor(e.model, prices)), b = costOf(e, priceFor(sm, prices));
    if (a === null || b === null) { priced = false; continue; }
    actual += a; atSession += b;
  }
  return { estimate: true, sessionModel, actual, atSessionModel: atSession, saved: atSession - actual, priced };
}

function totals(entries, prices) {
  const row = blank("all", "All"), unpriced = new Set();
  for (const e of entries) add(row, e, prices, unpriced);
  return { fresh: row.fresh, cache: row.cache, tokens: row.tokens, ...costFields(row), unpriced: [...unpriced] };
}

// A cost is shown only for what has a price; with no priced tokens at all it is null.
function costFields(row) {
  return { cost: row.priced ? row.cost : (row.cost > 0 ? row.cost : null), partial: !row.priced && row.cost > 0 };
}

function stageTimeline(events) {
  return events.filter(e => e.type === "stage").map(e => ({ t: Date.parse(e.ts), stage: e.target, unit: e.unit || "", why: e.why || "" }))
    .filter(e => !isNaN(e.t)).sort((a, b) => a.t - b.t);
}

const STAGE_GROUP = {
  setup: "Setup", "learn-repo": "Setup", "install-skills": "Setup",
  discover: "Plan", knowledge: "Plan", decisions: "Plan", plan: "Plan", "plan-review": "Plan",
  explain: "Explain", "explain-check": "Explain", "explain-board": "Explain",
  review: "Review", "review-notes": "Review", debug: "Debug"
};
const GROUP_NAME = { Setup: "Setup and repo", Plan: "Discover and plan", Explain: "Explain finished work", Review: "Review notes", Debug: "Debugging", Outside: "Outside the Boxbox flow" };

function bucketOf(s) {
  if (!s) return { epic: "Outside", task: null };
  if (s.unit) {
    const epic = s.unit.split(".")[0];
    return { epic, task: s.unit.includes(".") ? s.unit : null };
  }
  return { epic: STAGE_GROUP[s.stage] || "Outside", task: null };
}

function stageAt(t, timeline) {
  let found = null;
  for (const s of timeline) { if (s.t <= t) found = s; else break; }
  return found;
}

function activeMilestone(board) {
  const ms = (board && board.milestones) || [];
  return ms.find(m => m.status === "in_progress" || m.status === "review" || m.status === "changes") || ms[ms.length - 1] || null;
}

// Which task each subagent worked on: the hook tags its crew events with the task of the Agent call
// that started it. A subagent's tokens go to that task, even while another unit's stage is current.
function subagentUnits(events) {
  const out = new Map();
  for (const e of events || []) if (e && e.kind === "crew" && e.sub && /^E\d+\.\d+$/.test(e.unit || "")) out.set(e.sub, e.unit);
  return out;
}

function aggregate(entries, timeline, prices, board, now, subUnits = new Map()) {
  const ms = activeMilestone(board);
  const epicTitle = id => { const e = ms && (ms.epics || []).find(x => x.id === id); return e ? e.title : GROUP_NAME[id] || id; };
  const taskTitle = id => { for (const e of (ms && ms.epics) || []) for (const t of e.tasks || []) if (t.id === id) return t.title; return ""; };
  const byEpic = new Map(), byTask = new Map(), sessions = new Map(), unpriced = new Set(), byModel = new Map();
  const all = blank("all", "All");
  for (const e of entries) {
    // Per model: the raw counts too, for the cache-read share (cache reads over all input sent).
    const mk = e.model || "unknown";
    if (!byModel.has(mk)) byModel.set(mk, { ...blank(mk, mk), model: mk, family: familyOf(mk), input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    const mr = byModel.get(mk);
    add(mr, e, prices, null);
    mr.input += e.input; mr.output += e.output; mr.cacheRead += e.cacheRead; mr.cacheWrite += e.cacheWrite5m + e.cacheWrite1h;
    const own = e.sub && subUnits.get(e.sub);
    const b = own ? bucketOf({ unit: own }) : bucketOf(stageAt(Date.parse(e.ts), timeline));
    if (!byEpic.has(b.epic)) byEpic.set(b.epic, blank(b.epic, epicTitle(b.epic)));
    add(byEpic.get(b.epic), e, prices, unpriced);
    addModel(byEpic.get(b.epic), e, prices);
    if (b.task) {
      if (!byTask.has(b.task)) byTask.set(b.task, blank(b.task, taskTitle(b.task)));
      add(byTask.get(b.task), e, prices, null);
      addModel(byTask.get(b.task), e, prices);
    }
    add(all, e, prices, null);
    const key = e.session || "unknown";
    if (!sessions.has(key)) sessions.set(key, { session: key, agent: e.agent, models: new Set(), units: new Set(), tokens: 0, cost: 0, priced: true, first: e.ts });
    const s = sessions.get(key);
    const r = blank(); add(r, e, prices, null);
    s.tokens += r.tokens; s.cost += r.cost; s.priced = s.priced && r.priced;
    if (e.model) s.models.add(e.model);
    if (b.epic !== "Outside") s.units.add(b.task || b.epic);
    if (e.ts < s.first) s.first = e.ts;
  }
  // Time on each unit: from its stage until the next stage, or now for the current one.
  for (let i = 0; i < timeline.length; i++) {
    const s = timeline[i], end = i + 1 < timeline.length ? timeline[i + 1].t : now;
    const b = bucketOf(s), ms2 = Math.max(0, end - s.t);
    if (byEpic.has(b.epic)) byEpic.get(b.epic).ms += ms2;
    if (b.task && byTask.has(b.task)) byTask.get(b.task).ms += ms2;
  }
  const fin = r => ({ ...r, ...costFields(r) });
  return {
    total: { fresh: all.fresh, cache: all.cache, tokens: all.tokens, ...costFields(all), unpriced: [...unpriced] },
    byEpic: [...byEpic.values()].map(fin),
    byTask: [...byTask.values()].map(fin),
    savings: savings(entries, prices),
    byModel: [...byModel.values()].map(r => ({ ...fin(r), cacheReadShare: r.input + r.cacheWrite + r.cacheRead ? r.cacheRead / (r.input + r.cacheWrite + r.cacheRead) : 0 }))
      .sort((a, b) => b.tokens - a.tokens),
    sessions: [...sessions.values()].map(s => ({ ...s, models: [...s.models], units: [...s.units], ...costFields(s) }))
      .sort((a, b) => (a.first < b.first ? -1 : 1))
  };
}

const epicOf = unit => (unit ? String(unit).split(".")[0] : "");
const isWild = g => /[*?{]/.test(g);
const wildBase = g => String(g).replace(/^\.\//, "").split(/[*?{]/)[0].replace(/\/$/, "");
// Do two globs share any file? Exact for plain paths; for two wildcards, by their folders.
function globsOverlap(a, b) {
  if (a === b) return true;
  if (!isWild(a)) return matchAny(a, [b]);
  if (!isWild(b)) return matchAny(b, [a]);
  const x = wildBase(a), y = wildBase(b);
  return x === y || x.startsWith(y + "/") || y.startsWith(x + "/") || !x || !y;
}

function drift(board, events, currentUnit, now) {
  const ms = activeMilestone(board);
  const epics = (ms && ms.epics) || [];
  const declared = epics.filter(e => Array.isArray(e.files) && e.files.length);
  const cur = epicOf(currentUnit);
  const curEpic = epics.find(e => e.id === cur);
  const out = { currentEpic: cur, scope: (curEpic && curEpic.files) || [], outside: [], changedAfterApproval: [], behind: [], files: [], modules: [] };
  const edits = events.filter(e => e.type === "action" && Array.isArray(e.edits));
  const files = new Map(), changed = new Set(), behind = new Set(), seenOutside = new Set();
  for (const ev of edits) {
    const eid = epicOf(ev.unit);
    const epic = epics.find(e => e.id === eid);
    for (const p of ev.edits) {
      const inScope = epic && epic.files && epic.files.length ? matchAny(p, epic.files) : null;
      if (eid && eid === cur) {
        const f = files.get(p) || { path: p, edits: 0, in: inScope !== false };
        f.edits++; files.set(p, f);
      }
      if (inScope === false && !seenOutside.has(eid + " " + p)) {
        seenOutside.add(eid + " " + p);
        out.outside.push({ path: p, epic: eid, ts: ev.ts, owner: (declared.find(x => x.id !== eid && matchAny(p, x.files)) || {}).id || "" });
      }
      for (const other of declared) if (other.id !== eid && other.status === "done" && matchAny(p, other.files)) changed.add(other.id);
      if (eid && declared.length && !declared.some(x => matchAny(p, x.files))) behind.add(p);
    }
  }
  out.files = [...files.values()];
  out.changedAfterApproval = [...changed];
  out.behind = [...behind];
  const recentCut = now - 10 * 60 * 1000;
  for (const m of (board && board.modules) || []) {
    const globs = m.files || m.paths || [];
    let total = 0, recent = 0, outsideHit = false;
    for (const ev of edits) for (const p of ev.edits) {
      if (!matchAny(p, globs)) continue;
      total++;
      if (Date.parse(ev.ts) >= recentCut) recent++;
      if (epicOf(ev.unit) === cur && curEpic && curEpic.files && !matchAny(p, curEpic.files)) outsideHit = true;
    }
    const inScope = globs.some(g => out.scope.some(sg => globsOverlap(g, sg)));
    out.modules.push({ name: m.name, files: globs, role: m.role || "", total, recent, inScope, outside: outsideHit });
  }
  return out;
}

function verification(board, events) {
  const ms = activeMilestone(board);
  const lastEdit = {}, passes = [];
  for (const e of events) {
    if (e.type !== "action") continue;
    const t = Date.parse(e.ts);
    if (Array.isArray(e.edits) && e.edits.length && e.unit) lastEdit[e.unit] = Math.max(lastEdit[e.unit] || 0, t);
    if (e.test && e.test.observed && e.test.status === "pass") passes.push(t);
  }
  const res = { tasks: {}, epics: {} };
  for (const m of (board && board.milestones) || []) for (const ep of m.epics || []) {
    let all = true, any = false;
    for (const task of ep.tasks || []) {
      if (!/^(done|review)$/.test(task.status)) { all = false; continue; }
      any = true;
      const edit = m === ms ? (lastEdit[task.id] || lastEdit[ep.id] || 0) : 0;
      const v = edit && passes.some(p => p > edit) ? "verified" : "claimed";
      if (!res.tasks[task.id] || m === ms) res.tasks[task.id] = v;
      if (v !== "verified") all = false;
    }
    if (any && all && m === ms) res.epics[ep.id] = "verified";
  }
  return res;
}

function currentStage(stage, events) {
  const outside = { stage: "outside", unit: "", why: "", ts: "" };
  if (!stage || !stage.stage) return outside;
  // say writes whole seconds (macOS date has no milliseconds): count a stage as the end of its second.
  const st = Date.parse(stage.ts) + (/\.\d+Z$/.test(stage.ts || "") ? 0 : 999);
  const lastStart = events.filter(e => e.type === "session" && /startup|resume|started/.test(e.target || "")).reduce((m, e) => Math.max(m, Date.parse(e.ts) || 0), 0);
  if (lastStart > st) return { ...outside, last: stage };
  return stage;
}

/* ================= live data ================= */

function readText(f) { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } }
function readJSON(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } }
// The repo's prices.json is the developer's to edit; fall back to the copy next to this file.
function readPrices() { return readJSON(path.join(BOX, "pitwall", "prices.json")) || readJSON(path.join(PITWALL, "prices.json")) || { models: {} }; }

class Tail {
  constructor() { this.offset = 0; this.rest = ""; this.ino = null; }
  read(file) {
    let st;
    try { st = fs.statSync(file); } catch { return { lines: [], reset: false }; }
    let reset = false;
    if (st.size < this.offset || (this.ino !== null && st.ino !== this.ino)) { this.offset = 0; this.rest = ""; reset = true; }
    this.ino = st.ino;
    if (st.size === this.offset) return { lines: [], reset };
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(st.size - this.offset);
    fs.readSync(fd, buf, 0, buf.length, this.offset);
    fs.closeSync(fd);
    this.offset = st.size;
    const text = this.rest + buf.toString("utf8");
    const lines = text.split("\n");
    this.rest = lines.pop();
    return { lines, reset };
  }
}

class Live {
  constructor(box) {
    this.box = box; this.live = path.join(box, "live");
    this.events = []; this.evTail = new Tail(); this.readOld = false;
    this.sessions = new Map(); this.sessTail = new Tail();
    this.transcripts = new Map(); // file -> {tail, kind, session, sub, byId|state, entries}
    this.garage = { at: 0, docs: [] };
    this.lastActivity = Date.now();
  }
  refreshEvents() {
    const oldEvents = () => readText(path.join(this.live, "events.1.jsonl")).split("\n").map(safeJSON).filter(Boolean);
    if (!this.readOld) { this.readOld = true; this.events = oldEvents(); }
    const { lines, reset } = this.evTail.read(path.join(this.live, "events.jsonl"));
    if (reset) this.events = oldEvents(); // rotated: what we had is now in events.1.jsonl
    let grew = false;
    for (const l of lines) { const e = safeJSON(l); if (e) { this.events.push(e); grew = true; } }
    if (grew) this.lastActivity = Date.now();
    return grew;
  }
  refreshSessions() {
    const { lines } = this.sessTail.read(path.join(this.live, "sessions.jsonl"));
    for (const l of lines) {
      const s = safeJSON(l);
      if (!s || !s.transcript) continue;
      if (!this.transcripts.has(s.transcript)) {
        const kind = s.agent === "codex" ? "codex" : "claude";
        this.transcripts.set(s.transcript, { tail: new Tail(), kind, session: s.session, sub: s.sub || "", byId: new Map(), state: {}, entries: [] });
      }
      if (!s.sub) this.sessions.set(s.session, s);
    }
  }
  refreshTokens() {
    let grew = false;
    for (const [file, t] of this.transcripts) {
      const { lines, reset } = t.tail.read(file);
      if (reset) { t.byId = new Map(); t.state = {}; t.entries = []; }
      if (!lines.length) continue;
      grew = true;
      if (t.kind === "claude") ingestClaudeLines(t.byId, lines, { session: t.session, sub: t.sub });
      else t.entries.push(...ingestCodexLines(t.state, lines, { session: t.session }));
    }
    if (grew) this.lastActivity = Date.now();
    return grew;
  }
  entries() {
    const out = [];
    for (const t of this.transcripts.values()) {
      if (t.kind === "claude") out.push(...t.byId.values()); else out.push(...t.entries);
    }
    return out;
  }
  refreshGarage(force) {
    if (!force && Date.now() - this.garage.at < 5000) return;
    const docs = [];
    const skip = new Set(["assets", "templates", "pitwall", "live"]);
    const walk = (dir, relDir, depth) => {
      let list;
      try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const d of list) {
        const rel = relDir ? relDir + "/" + d.name : d.name;
        if (d.isDirectory()) { if (!skip.has(rel) && depth < 4) walk(path.join(dir, d.name), rel, depth + 1); continue; }
        const isPage = /\.html$/.test(d.name) && rel !== "board.html";
        const isRecord = !relDir && /^(glossary|lessons|decisions)\.md$/.test(d.name);
        if (!isPage && !isRecord) continue;
        let title = d.name, mtime = 0;
        try {
          mtime = fs.statSync(path.join(dir, d.name)).mtimeMs;
          if (isPage) { const head = readText(path.join(dir, d.name)).slice(0, 3000); const m = head.match(/<title>([^<]*)<\/title>/i); if (m) title = m[1].trim(); }
          else title = d.name.replace(/\.md$/, "").replace(/^./, c => c.toUpperCase());
        } catch {}
        const shelf = /^knowledge\//.test(rel) || isRecord ? "Knowledge" : /^(explained|reviews)\/|\/report\.html$/.test(rel) ? "Reports and reviews" : "Plans and decisions";
        docs.push({ href: rel, title, shelf, mtime });
      }
    };
    walk(this.box, "", 0);
    docs.sort((a, b) => b.mtime - a.mtime);
    this.garage = { at: Date.now(), docs };
  }
  codexUntrusted() {
    // A Codex session in this repo with no hook events at all means its hooks are not trusted yet.
    const known = new Set([...this.sessions.values()].filter(s => s.agent === "codex").map(s => s.session));
    const base = path.join(os.homedir(), ".codex", "sessions");
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const back of [0, 1]) {
      const d = new Date(Date.now() - back * 86400000);
      const dir = path.join(base, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0"));
      let names;
      try { names = fs.readdirSync(dir); } catch { continue; }
      for (const n of names) {
        if (!/^rollout-.*\.jsonl$/.test(n)) continue;
        const f = path.join(dir, n);
        try {
          if (fs.statSync(f).mtimeMs < cutoff) continue;
          const fd = fs.openSync(f, "r"); const buf = Buffer.alloc(4096); const len = fs.readSync(fd, buf, 0, 4096, 0); fs.closeSync(fd);
          const meta = safeJSON(buf.slice(0, len).toString("utf8").split("\n")[0]);
          if (!meta || !meta.payload || path.resolve(meta.payload.cwd || "") !== path.resolve(this.box, "..")) continue;
          const id = meta.payload.id || "";
          if (!known.has(id) && ![...this.transcripts.keys()].includes(f)) return true;
        } catch {}
      }
    }
    return false;
  }
  refresh() {
    const a = this.refreshEvents();
    this.refreshSessions();
    const b = this.refreshTokens();
    return a || b;
  }
  state() {
    this.refresh();
    this.refreshGarage(false);
    const board = parseBoard(readText(path.join(this.box, "board-data.js")));
    for (const m of (board && board.milestones) || []) for (const e of m.epics || []) for (const t of e.tasks || []) t.briefHref = briefHref(t.brief);
    const st = parseState(readText(path.join(this.box, "state.md")));
    const stage = currentStage(readJSON(path.join(this.live, "stage.json")), this.events);
    const unit = stage.unit || (stage.last && stage.last.unit) || "";
    const timeline = stageTimeline(this.events);
    const now = Date.now();
    const agents = [...new Set([...this.sessions.values()].map(s => s.agent))];
    if (this.untrustedAt === undefined || now - this.untrustedAt > 15000) { this.untrustedAt = now; this.untrusted = this.codexUntrusted(); }
    return {
      now: new Date(now).toISOString(),
      root: path.basename(path.resolve(this.box, "..")),
      board, modules: (board && board.modules) || [],
      state: st, stage,
      waiting: readJSON(path.join(this.live, "waiting.json")),
      paused: { requested: fs.existsSync(path.join(this.live, "PAUSE")), held: fs.existsSync(path.join(this.live, "held")) },
      events: this.events.slice(-200),
      timeline: timeline.slice(-60).map(s => ({ ts: new Date(s.t).toISOString(), stage: s.stage, unit: s.unit, why: s.why })),
      tokens: aggregate(this.entries(), timeline, readPrices(), board, now, subagentUnits(this.events)),
      drift: drift(board, this.events, unit, now),
      verification: verification(board, this.events),
      garage: this.garage.docs,
      agents,
      codexUntrusted: this.untrusted
    };
  }
}

function safeJSON(l) { if (!l) return null; try { return JSON.parse(l); } catch { return null; } }

/* ================= server ================= */

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".md": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };

function serve() {
  fs.mkdirSync(LIVE, { recursive: true });
  const token = crypto.randomBytes(16).toString("hex");
  fs.writeFileSync(path.join(LIVE, "token"), token, { mode: 0o600 });
  const live = new Live(BOX);
  const clients = new Set();
  let port = FIRST_PORT;

  const send = (res, code, body, type, extra) => { res.writeHead(code, { "Content-Type": type || "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...(extra || {}) }); res.end(body); };
  // Pages under /b/ come from the repo. Sandbox them to an opaque origin so they cannot read the
  // pause token from this server. Their "mark as done" ticks then do not persist here.
  const SANDBOX = { "Content-Security-Policy": "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads" };
  const okHost = req => new RegExp(`^(127\\.0\\.0\\.1|localhost):${port}$`).test(req.headers.host || "");

  const server = http.createServer((req, res) => {
    if (!okHost(req)) return send(res, 403, "Forbidden");
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const p = url.pathname;
    if (req.method === "POST" && (p === "/api/pause" || p === "/api/resume")) {
      const origin = req.headers.origin;
      if (req.headers["x-boxbox-token"] !== token || (origin && !new RegExp(`^http://(127\\.0\\.0\\.1|localhost):${port}$`).test(origin))) return send(res, 403, "Forbidden");
      try {
        if (p === "/api/pause") fs.writeFileSync(path.join(LIVE, "PAUSE"), new Date().toISOString());
        else fs.rmSync(path.join(LIVE, "PAUSE"), { force: true });
      } catch (err) { return send(res, 500, JSON.stringify({ ok: false, error: err.message }), TYPES[".json"]); }
      push();
      return send(res, 200, JSON.stringify({ ok: true }), TYPES[".json"]);
    }
    if (req.method !== "GET") return send(res, 405, "Method not allowed");
    if (p === "/" || p === "/index.html") {
      const html = readText(path.join(PITWALL, "index.html")).replace("__BOXBOX_TOKEN__", token);
      return send(res, 200, html, TYPES[".html"]);
    }
    if (p === "/orbs.js") return send(res, 200, readText(path.join(PITWALL, "orbs.js")), TYPES[".js"]);
    // The shared look comes from the kit next to this server, never from the repo's .boxbox/assets:
    // a repo's CSS could otherwise read the pause token from this page.
    if (p === "/boxbox.css") return send(res, 200, readText(path.join(PITWALL, "..", "assets", "boxbox.css")), TYPES[".css"]);
    if (p === "/boxbox.js") return send(res, 200, readText(path.join(PITWALL, "..", "assets", "boxbox.js")), TYPES[".js"]);
    if (p === "/favicon.ico") { res.writeHead(204); return res.end(); }
    if (p === "/api/ping") return send(res, 200, JSON.stringify({ boxbox: true, root: ROOT, clients: clients.size }), TYPES[".json"]);
    if (p === "/api/state") return send(res, 200, JSON.stringify(live.state()), TYPES[".json"]);
    if (p === "/api/stream") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
      res.write(`data: ${JSON.stringify(live.state())}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (p.startsWith("/b/")) {
      let rel;
      try { rel = decodeURIComponent(p.slice(3)); } catch { return send(res, 400, "Bad path"); }
      const file = path.resolve(BOX, rel);
      const relToBox = path.relative(BOX, file);
      if (relToBox.startsWith("..") || path.isAbsolute(relToBox) || relToBox.split(path.sep)[0] === "live") return send(res, 403, "Forbidden");
      fs.readFile(file, (err, buf) => {
        if (err) return send(res, 404, "Not found");
        const ext = path.extname(file).toLowerCase();
        send(res, 200, buf, TYPES[ext] || "application/octet-stream", ext === ".html" || ext === ".svg" ? SANDBOX : null);
      });
      return;
    }
    send(res, 404, "Not found");
  });

  let timer = null;
  function push() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!clients.size) return;
      const data = `data: ${JSON.stringify(live.state())}\n\n`;
      for (const c of clients) c.write(data);
    }, 250);
  }
  for (const dir of [BOX, LIVE]) {
    try { fs.watch(dir, () => push()); } catch {}
  }
  // Transcripts and pages live outside the watched folders or deeper in them: poll those.
  setInterval(() => { if (live.refresh()) push(); }, 1500);
  setInterval(() => { live.refreshGarage(true); push(); }, 10000);
  setInterval(() => { for (const c of clients) c.write(": keep-alive\n\n"); }, 20000);
  setInterval(() => {
    if (!clients.size && Date.now() - live.lastActivity > IDLE_EXIT_MS) shutdown();
  }, 60000);

  function shutdown() {
    for (const f of ["port", "pid", "token"]) {
      try { if (f !== "pid" || readText(path.join(LIVE, "pid")).trim() === String(process.pid)) fs.rmSync(path.join(LIVE, f), { force: true }); } catch {}
    }
    process.exit(0);
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  server.on("error", err => {
    if (err.code === "EADDRINUSE" && port < FIRST_PORT + 50) { port++; server.listen(port, "127.0.0.1"); }
    else { console.error(err.message); process.exit(1); }
  });
  server.on("listening", () => {
    fs.writeFileSync(path.join(LIVE, "port"), String(port));
    fs.writeFileSync(path.join(LIVE, "pid"), String(process.pid));
    console.log(`http://127.0.0.1:${port}/`);
  });
  server.listen(port, "127.0.0.1");
}

/* ================= --ensure and --summary ================= */

function ping(port) {
  return new Promise(resolve => {
    const req = http.get({ host: "127.0.0.1", port, path: "/api/ping", timeout: 800 }, res => {
      let b = ""; res.on("data", d => (b += d)); res.on("end", () => { const j = safeJSON(b); resolve(j && j.boxbox && j.root === ROOT ? j : null); });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try { spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore" }).unref(); } catch {}
}

async function ensure(open) {
  fs.mkdirSync(LIVE, { recursive: true });
  const running = async () => {
    const port = Number(readText(path.join(LIVE, "port")).trim());
    return port ? { port, info: await ping(port) } : null;
  };
  let r = await running();
  if (!r || !r.info) {
    const log = fs.openSync(path.join(LIVE, "server.log"), "a");
    spawn(process.execPath, [__filename, "--box", BOX], { cwd: ROOT, detached: true, stdio: ["ignore", log, log] }).unref();
    for (let i = 0; i < 40; i++) {
      await new Promise(res => setTimeout(res, 100));
      r = await running();
      if (r && r.info) break;
    }
  }
  if (!r || !r.info) { console.error("The pit wall did not start. See .boxbox/live/server.log."); process.exit(1); }
  const url = `http://127.0.0.1:${r.port}/`;
  if (open && !r.info.clients) openBrowser(url);
  console.log(url);
}

function summary(unit) {
  const live = new Live(BOX);
  const st = live.state();
  const epic = epicOf(unit);
  const row = unit.includes(".") ? st.tokens.byTask.find(r => r.id === unit) : st.tokens.byEpic.find(r => r.id === epic);
  const fmt = n => (n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n));
  if (!row) console.log(`Cost: no tokens recorded for ${unit}.`);
  else console.log(`Cost: ${fmt(row.tokens)} tokens for ${unit} (${fmt(row.fresh)} new, ${fmt(row.cache)} from cache)` +
    (row.cost === null ? ", no price for this model" : `, about $${row.cost.toFixed(2)}`) + (row.priced ? "" : " (some models have no price)") + ".");
  if (row && row.models) {
    const parts = Object.entries(row.models).map(([m, r]) => ({ m: familyOf(m) || m, r })).sort((a, b) => b.r.cost - a.r.cost || b.r.tokens - a.r.tokens);
    console.log("By model: " + parts.map(({ m, r }) => `${m} ${fmt(r.tokens)} tokens ` + (r.priced ? `$${r.cost.toFixed(2)}` : "no price")).join(", ") + ".");
  }
  const outside = st.drift.outside.filter(o => o.epic === epic);
  console.log(outside.length ? "Edited outside scope: " + outside.map(o => o.path).join(", ") : "Edited outside scope: none.");
}

module.exports = { parseBoard, parseState, briefHref, globToRegExp, matchAny, ingestClaudeLines, ingestCodexLines, priceFor, costOf, totals, stageTimeline, subagentUnits, aggregate, drift, verification, currentStage, Live };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--ensure")) ensure(args.includes("--open"));
  else if (args.includes("--summary")) summary(args[args.indexOf("--summary") + 1] || "");
  else serve();
}
