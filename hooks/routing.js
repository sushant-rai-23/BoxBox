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
    tasks.set(t[1], { epic: epic || t[1].split(".")[0], size, risk: /^yes$/i.test(fields.risk || ""), epicModel });
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

// The routing gate: may this Agent call run as asked? See .boxbox/model-routing/e3-gate/design.md.
// Returns skip (not a Boxbox agent), off (routing is not Boxbox's to enforce), allow or deny.
function gateDecision(q) {
  const input = q.input || {};
  const agent = agentOf(input.subagent_type);
  if (!agent) return { decision: "skip", reason: "not a Boxbox agent", task: "", expected: null };
  const task = taskOfDescription(input.description);
  const deny = (reason, expected = null) => ({ decision: "deny", reason, task, expected });
  if (agent === "builder" ? !/^E\d+\.\d+$/.test(task) : !task)
    return deny(agent === "builder"
      ? `start the description with the task id, like "E2.3 <what>", so the gate can find the task`
      : `start the description with the unit it serves: a task id, an epic id or "setup", like "E2.3 <what>"`);
  const t = (q.tasks && q.tasks.get(task)) || { size: "M", risk: false, epicModel: null };
  const session = q.session || null;
  const e = expectedModel({ agent, mode: q.mode, session: session || "session", size: t.size, risk: t.risk, epicModel: t.epicModel });
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

module.exports = { MODES, SIZE_LINES, parseModels, parsePlanTasks, parseBrief, escalatedTasks, taskOfDescription, gateDecision, expectedModel, familyOf, agentOf };
