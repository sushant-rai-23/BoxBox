// Boxbox model routing: which model each Boxbox subagent call should use. Pure, no dependencies.
// The build skills follow it and the PreToolUse gate checks calls against it.
// Models are family aliases ("opus", "sonnet", "haiku"), the form the Agent tool's `model` accepts.
"use strict";

const MODES = ["best", "balanced", "save", "auto"];

// The mode table: rule 5 below. "session" means the main conversation's model.
const TABLE = {
  best:     { builder: "session", scout: "session", runner: "session", writer: "session" },
  balanced: { builder: "sonnet",  scout: "haiku",   runner: "haiku",   writer: "sonnet" },
  save:     { builder: "sonnet",  scout: "haiku",   runner: "haiku",   writer: "haiku" }
};

// `models:` and `parallel:` from config.md. A repo set up before 0.7 has no models line: auto, under
// which the build skill uses no Boxbox agent, so it keeps 0.6 behaviour. A value Boxbox does not know: balanced, with a warning to show.
function parseModels(configText) {
  const t = String(configText || "");
  const m = t.match(/^models:[ \t]*([^\s#]*)/m);
  const p = t.match(/^parallel:[ \t]*([^\s#]*)/m);
  let mode = "auto", warning = null;
  if (m && m[1]) {
    const v = m[1].toLowerCase();
    if (MODES.includes(v)) mode = v;
    else { mode = "balanced"; warning = `models: "${m[1]}" is not one of ${MODES.join(", ")}; using balanced`; }
  }
  return { mode, parallel: !!(p && p[1].toLowerCase() === "on"), warning };
}

// Size, risk and the epic's model override for every task in plan.md. Missing size is M, missing risk is no.
// The override is a `model:` line at the start of a line anywhere inside the epic; a value that is not
// a Claude family is ignored.
function parsePlanTasks(planText) {
  const tasks = new Map();
  let epic = "", epicModel = null;
  for (const line of String(planText || "").split("\n")) {
    const e = line.match(/^## (E\d+)\b/);
    if (e) { epic = e[1]; epicModel = null; continue; }
    const m = line.match(/^model:[ \t]*(\S+)/);
    if (m && epic) { epicModel = familyOf(m[1]); continue; }
    const t = line.match(/^- \[[ xX]\] (E\d+\.\d+) (.*)$/);
    if (!t) continue;
    const fields = {};
    for (const part of t[2].split("|").slice(1)) {
      const kv = part.match(/^\s*(size|risk):\s*(\S+)/i);
      if (kv) fields[kv[1].toLowerCase()] = kv[2];
    }
    const size = /^[SML]$/i.test(fields.size || "") ? fields.size.toUpperCase() : "M";
    const dm = t[2].match(/\|\s*deps:\s*([^|]*)/i);
    // "E1.1, E1.3" or a range of one epic's tasks, "E1.1-E1.4".
    const deps = [];
    // The gate runs this while Claude Code waits: a range is expanded only when it is short and
    // forwards (at most 100 tasks); otherwise only its first task counts.
    for (const m of (dm ? dm[1] : "").matchAll(/E(\d{1,6})\.(\d{1,6})(?:\s*-\s*E\1\.(\d{1,6}))?/g)) {
      const a = Number(m[2]), b = m[3] ? Number(m[3]) : a;
      const end = b >= a && b - a <= 100 ? b : a;
      for (let n = a; n <= end; n++) deps.push(`E${m[1]}.${n}`);
    }
    tasks.set(t[1], { epic: epic || t[1].split(".")[0], size, risk: /^yes$/i.test(fields.risk || ""), epicModel, deps });
  }
  return tasks;
}

// Changed lines a task of each size is expected to need; escalation fires at three times this.
const SIZE_LINES = { S: 50, M: 150, L: 400 };

// The header of a task brief (.boxbox/<feature>/<epic>/tasks/<id>.md): the lines before the first
// "## " heading. The gate and the build skill read the task's files and expected diff size from it.
function parseBrief(text) {
  const lines = String(text || "").split("\n").map(l => l.replace(/\s+$/, ""));
  const top = [], rest = [];
  for (const l of lines) (rest.length || /^## /.test(l) ? rest : top).push(l);
  const field = k => { const m = top.map(l => l.match(new RegExp(`^${k}:[ \\t]*(.*)$`))).find(Boolean); return m ? m[1].trim() : ""; };
  const files = [];
  const at = top.findIndex(l => /^files:\s*$/.test(l));
  if (at >= 0) for (const l of top.slice(at + 1)) { const m = l.match(/^- (\S.*)$/); if (!m) break; files.push(m[1].trim()); }
  const size = /^[SML]$/i.test(field("size")) ? field("size").toUpperCase() : "M";
  const n = Number(field("expected_diff"));
  const g = rest.indexOf("## Goal");
  const goal = g >= 0 ? (rest.slice(g + 1).find(l => l.trim()) || "").trim() : "";
  return { task: field("task"), size, risk: /^yes$/i.test(field("risk")), expectedDiff: n > 0 ? n : SIZE_LINES[size],
           files, base: field("base"), goal };
}

// Is a repo-relative file covered by a brief's `files`? Entries can be files, "./" paths, folders
// ("app/" covers app/**) or globs ("lib/**/*.js", "src/*.ts").
function inFiles(file, entries) {
  const f = String(file).replace(/^\.\//, "");
  return (entries || []).some(raw => {
    const g = String(raw).trim().replace(/^\.\//, "");
    if (!g) return false;
    if (g === f || (g.endsWith("/") && f.startsWith(g))) return true;
    if (!/[*?]/.test(g)) return false;
    const re = new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/?/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, "(?:.*/)?") + "$");
    return re.test(f);
  });
}

// Parallel mode: the tasks of one epic that may build at the same time, in plan order. A task joins
// when every task it depends on is done, its brief is written (so its files are known), and it shares
// no file with a task already in the batch. At most three.
function parallelBatch(tasks, epic, done, briefFiles) {
  const batch = [], taken = [];
  // Paths as paths: "./app/a.py" is "app/a.py", and a folder ("app/") covers every file in it.
  const norm = f => String(f).trim().replace(/^\.\//, "").replace(/\/+/g, "/");
  const clash = (a, b) => a === b || (a.endsWith("/") && b.startsWith(a)) || (b.endsWith("/") && a.startsWith(b));
  for (const [id, t] of tasks) {
    if (batch.length >= 3) break;
    if (t.epic !== epic || done.has(id) || !(t.deps || []).every(d => done.has(d))) continue;
    const files = (briefFiles[id] || []).map(norm).filter(Boolean);
    if (!files.length || files.some(f => taken.some(g => clash(f, g)))) continue;
    taken.push(...files);
    batch.push(id);
  }
  return batch;
}

// May builders run in worktrees? Only with `parallel: on` and worktree.baseRef "head" in a project
// settings file: otherwise Claude Code branches worktrees from the default branch,
// and the epic's earlier commits would be missing (docs/routing-spike.md, section 7).
// `settings`: the texts of .claude/settings.local.json then .claude/settings.json, Claude Code's own
// order: the first file that sets worktree.baseRef decides.
function parallelReady({ parallel, settings = [] }) {
  if (!parallel) return { ok: false, reason: "parallel: off in config.md" };
  for (const text of settings) {
    if (!String(text || "").trim()) continue;
    let s; try { s = JSON.parse(text); } catch { return { ok: false, reason: "a .claude/settings file cannot be read as JSON, so worktree.baseRef is unknown" }; }
    if (s && s.worktree && "baseRef" in s.worktree) return s.worktree.baseRef === "head" ? { ok: true, reason: "" }
      : { ok: false, reason: `worktree.baseRef is "${s.worktree.baseRef}", not "head": worktrees would start from the default branch without the epic's commits` };
  }
  return { ok: false, reason: 'worktree.baseRef is not "head": set "worktree": {"baseRef": "head"} in .claude/settings.json, or worktrees start from the default branch without the epic\'s commits' };
}

// Tasks that were escalated to the session model: every `say escalated` event names one.
function escalatedTasks(events) {
  const out = new Set();
  for (const e of events || []) if (e && e.kind === "escalated" && e.unit) out.add(e.unit);
  return out;
}

// The model one call should use, and why. First matching rule wins. `model: null` means pass no model.
function expectedModel(q) {
  const { agent, mode, session } = q;
  if (mode === "auto") return { model: null, why: "models: auto" };
  if (agent === "builder") {
    if (q.escalated) return { model: session, why: "escalated" };
    if (q.epicModel) return { model: q.epicModel, why: "epic override" };
    if (q.risk || q.size === "L") {
      const why = q.risk ? "risk: yes" : "size: L";
      return { model: mode === "save" ? "sonnet" : session, why };
    }
  }
  const m = (TABLE[mode] || TABLE.balanced)[agent];
  if (!m) return { model: null, why: "not a Boxbox agent" };
  return { model: m === "session" ? session : m, why: `models: ${mode}` };
}

// The unit a subagent call serves, from the start of its description: "E2.3 hash it" -> "E2.3".
function taskOfDescription(description) {
  const m = String(description || "").match(/^\s*(E\d+(?:\.\d+)?|setup)\b/i);
  return m ? (m[1].toLowerCase() === "setup" ? "setup" : m[1].toUpperCase()) : "";
}

// Each builder task's history from events.jsonl, in file order (the true order: say stamps whole
// seconds, so timestamps cannot order events in the same second). A run is a builder subagent that
// finished on the task. History starts again when its epic goes to review or is approved, or a new
// plan begins, so an earlier feature's E1.1 and the runs before a review never count against it.
function builderHistory(events) {
  const out = new Map();
  const fresh = () => ({ runs: 0, escalatedAt: "", runsAfterEscalation: 0, triggered: "" });
  const get = u => { if (!out.has(u)) out.set(u, fresh()); return out.get(u); };
  for (const e of events || []) {
    if (!e) continue;
    // A fresh start when the work is handed over or re-planned: the epic goes to the developer
    // (unit-review), is approved or merged, or a plan begins. Saying the build stage again (a resume
    // after a pause) keeps the history, so a task is never escalated twice.
    if (e.kind === "stage" && /^(discover|plan|plan-review)$/.test(e.target || "")) { out.clear(); continue; }
    if (!e.unit) continue;
    const unit = /^e\d/.test(e.unit) ? e.unit.toUpperCase() : e.unit;
    if (e.kind === "stage" && /^(unit-review|approved|merged)$/.test(e.target || "")) {
      const ep = unit.split(".")[0];
      for (const k of [...out.keys()]) if (k === ep || k.startsWith(ep + ".")) out.delete(k);
    } else if (e.kind === "crew" && e.result === "finished" && e.target === "boxbox:boxbox-builder") {
      const h = get(unit); h.runs++;
      if (h.escalatedAt) h.runsAfterEscalation++;
    } else if (e.kind === "escalated") { const h = get(unit); if (!h.escalatedAt) h.escalatedAt = e.ts || "0"; }
    else if (e.kind === "escalate-needed") { const h = get(unit); if (!h.triggered) h.triggered = e.target || "needs escalation"; }
  }
  return out;
}

// The routing gate: may this Agent call run as asked? The rules are in the kit's GUIDE.md, "Model routing";
// the Claude Code behaviour they rely on is in docs/routing-spike.md.
// Returns skip (not a Boxbox agent), off (routing is not Boxbox's to enforce), allow or deny.
function gateDecision(q) {
  const input = q.input || {};
  const agent = agentOf(input.subagent_type);
  if (!agent) return { decision: "skip", reason: "not a Boxbox agent", task: "", expected: null };
  const task = taskOfDescription(input.description);
  // q.force: "" when CLAUDE_CODE_SUBAGENT_MODEL_FORCE is off, else CLAUDE_CODE_SUBAGENT_MODEL or "inherit".
  if (q.force) return { decision: "off", task, expected: null, reason: q.force === "inherit"
    ? "CLAUDE_CODE_SUBAGENT_MODEL_FORCE is on: Claude Code ignores the model passed on a call, and each agent file's model decides"
    : `CLAUDE_CODE_SUBAGENT_MODEL_FORCE is on: every subagent runs on ${q.force}` };
  if (q.mode === "auto") return { decision: "off", reason: "models: auto: Claude Code decides", task, expected: null };
  const deny = (reason, expected = null) => ({ decision: "deny", reason, task, expected });
  if (agent === "builder" ? !/^E\d+\.\d+$/.test(task) : !task)
    return deny(agent === "builder"
      ? `start the description with the task id, like "E2.3 <what>", so the gate can find the task`
      : `start the description with the unit it serves: a task id, an epic id or "setup", like "E2.3 <what>"`);
  if (input.isolation === "worktree" && q.parallel && !q.parallel.ok) return deny(`${task} asks for a worktree, but parallel builds are not ready: ${q.parallel.reason}. Build it without isolation`);
  const known = q.tasks && q.tasks.size > 0;
  if (agent === "builder" && !known) return { decision: "allow", reason: "not checked: no tasks in plan.md for the current feature", task, expected: null };
  if (agent === "builder" && !q.tasks.get(task)) return deny(`${task} is not a task in plan.md: start the description with the task's id from the plan`);
  const t = (known && q.tasks.get(task)) || { size: "M", risk: false, epicModel: null };
  const session = q.session || null;
  const h = agent === "builder" ? (q.history && q.history.get(task)) || null : null;
  const plain = expectedModel({ agent, mode: q.mode, session: session || "session", size: t.size, risk: t.risk, epicModel: t.epicModel });
  if (h && h.escalatedAt && h.runsAfterEscalation >= 1) return deny(`${task} was escalated and failed again: stop and tell the developer`);
  if (h && !h.escalatedAt && (h.runs >= 2 || h.triggered)) {
    const why = h.triggered || "failed twice";
    if (session && plain.model === session) return deny(`${task} ${why}, and it already runs on the session model: stop and tell the developer`);
    // The agent may copy this command: keep file names and shell characters out of it.
    const said = h.triggered ? h.triggered.replace(/^edited .*?(, outside its brief| \d+ times.*)$/, "edited a file$1").replace(/[^\w .,:\/-]/g, "") : why;
    return deny(`${task} ${why.replace(/[$`\\]/g, "")}: run say escalated "${said}" --unit ${task}, then boxbox-builder with model ${session || "<the session model>"}`, session);
  }
  const e = h && h.escalatedAt
    ? expectedModel({ agent, mode: q.mode, session: session || "session", escalated: true })
    : plain;
  if (e.model === "session") return { decision: "allow", reason: `session model unknown, not checked (${e.why})`, task, expected: null };
  if (familyOf(input.model) !== e.model) return deny(`${task} is ${e.why}, run boxbox-${agent} with model ${e.model}`, e.model);
  return { decision: "allow", reason: e.why, task, expected: e.model };
}

// "claude-opus-5-5[1m]" -> "opus". Null for anything that is not a Claude model id or alias.
function familyOf(modelId) {
  const m = String(modelId || "").toLowerCase().match(/^(?:claude-)?(opus|sonnet|haiku|fable)(?:\b|-)/);
  return m ? m[1] : null;
}

// "boxbox:boxbox-scout" -> "scout". Null for agents that are not Boxbox's.
function agentOf(subagentType) {
  const m = String(subagentType || "").match(/^boxbox:boxbox-(builder|scout|runner|writer)$/);
  return m ? m[1] : null;
}

module.exports = { MODES, SIZE_LINES, parseModels, parsePlanTasks, parseBrief, inFiles, parallelBatch, parallelReady, escalatedTasks, taskOfDescription, builderHistory, gateDecision, expectedModel, familyOf, agentOf };
