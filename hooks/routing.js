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

// `models:` and `parallel:` from config.md. A repo set up before 0.7 has no models line: auto,
// so it keeps 0.6 behaviour. A value Boxbox does not know: balanced, with a warning to show.
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
// The override is a `model:` line at the start of a line inside the epic, before its tasks.
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

module.exports = { MODES, parseModels, parsePlanTasks, escalatedTasks, expectedModel, familyOf, agentOf };
