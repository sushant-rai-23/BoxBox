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

module.exports = { MODES, parseModels, expectedModel, familyOf, agentOf };
