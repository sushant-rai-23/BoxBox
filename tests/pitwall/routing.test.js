// Tests for hooks/routing.js: the routing rule every Boxbox subagent call is checked against.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../../hooks/routing.js");

test("routing: balanced sends an M builder task to sonnet and a risky one to the session model", () => {
  const base = { agent: "builder", mode: "balanced", session: "opus" };
  assert.equal(R.expectedModel({ ...base, size: "M", risk: false }).model, "sonnet");
  const risky = R.expectedModel({ ...base, size: "M", risk: true });
  assert.equal(risky.model, "opus");
  assert.match(risky.why, /risk: yes/);
});

test("routing: the mode table for every agent, session opus", () => {
  const want = {
    best:     { builder: "opus",   scout: "opus",  runner: "opus",  writer: "opus" },
    balanced: { builder: "sonnet", scout: "haiku", runner: "haiku", writer: "sonnet" },
    save:     { builder: "sonnet", scout: "haiku", runner: "haiku", writer: "haiku" },
    auto:     { builder: null,     scout: null,    runner: null,    writer: null }
  };
  for (const mode of Object.keys(want))
    for (const agent of Object.keys(want[mode]))
      assert.equal(R.expectedModel({ agent, mode, session: "opus", size: "M" }).model, want[mode][agent], `${mode} ${agent}`);
});

test("routing: risky or L builder tasks go to the session model, or sonnet under save", () => {
  for (const q of [{ risk: true }, { size: "L" }]) {
    assert.equal(R.expectedModel({ agent: "builder", mode: "balanced", session: "opus", ...q }).model, "opus");
    assert.equal(R.expectedModel({ agent: "builder", mode: "best", session: "opus", ...q }).model, "opus");
    assert.equal(R.expectedModel({ agent: "builder", mode: "save", session: "opus", ...q }).model, "sonnet");
  }
  assert.equal(R.expectedModel({ agent: "builder", mode: "balanced", session: "opus", size: "L" }).why, "size: L");
  // risk only moves the builder
  assert.equal(R.expectedModel({ agent: "scout", mode: "balanced", session: "opus", risk: true }).model, "haiku");
});

test("routing: first match wins: auto, then escalated, then epic override, then risk", () => {
  const q = { agent: "builder", session: "opus", risk: true, epicModel: "sonnet", escalated: true };
  assert.deepEqual(R.expectedModel({ ...q, mode: "auto" }), { model: null, why: "models: auto" });
  assert.deepEqual(R.expectedModel({ ...q, mode: "save" }), { model: "opus", why: "escalated" });
  assert.deepEqual(R.expectedModel({ ...q, mode: "save", escalated: false }), { model: "sonnet", why: "epic override" });
  // the epic override beats save on purpose: the developer asked for that model
  assert.equal(R.expectedModel({ agent: "builder", mode: "save", session: "opus", epicModel: "opus" }).model, "opus");
  // escalation and overrides apply to builders only
  assert.equal(R.expectedModel({ agent: "runner", mode: "balanced", session: "opus", escalated: true, epicModel: "opus" }).model, "haiku");
});

test("routing: parseModels reads mode and parallel; missing is auto, unknown is balanced with a warning", () => {
  assert.deepEqual(R.parseModels("# Boxbox config\nmodels: save\nparallel: on\n"), { mode: "save", parallel: true, warning: null });
  assert.deepEqual(R.parseModels("models: balanced   # recommended\n"), { mode: "balanced", parallel: false, warning: null });
  assert.deepEqual(R.parseModels("project: x\n"), { mode: "auto", parallel: false, warning: null });
  const odd = R.parseModels("models: cheap\n");
  assert.equal(odd.mode, "balanced");
  assert.match(odd.warning, /cheap/);
  // an indented key under another block is not the top-level setting
  assert.equal(R.parseModels("old:\n  models: save\n").mode, "auto");
});

test("routing: familyOf and agentOf", () => {
  assert.equal(R.familyOf("claude-opus-5-5[1m]"), "opus");
  assert.equal(R.familyOf("claude-haiku-5-5"), "haiku");
  assert.equal(R.familyOf("sonnet"), "sonnet");
  assert.equal(R.familyOf("gpt-5"), null);
  assert.equal(R.familyOf(""), null);
  assert.equal(R.agentOf("boxbox:boxbox-scout"), "scout");
  assert.equal(R.agentOf("boxbox-scout"), null);
  assert.equal(R.agentOf("Explore"), null);
});

test("routing: plan parser reads size, risk and epic model override from a plan.md", () => {
  const plan = [
    "# Plan: Resets", "approved: yes, 2026-10-14", "",
    "## E1 Request a reset  [done]", "outcome: x", "files: app/resets.py", "tasks:",
    "- [x] E1.1 store a hashed token | size: S | risk: yes | test: token row exists | done: green | deps: none",
    "- [ ] E1.2 send the email | test: an email is queued | done: green | deps: E1.1",
    "", "## E2 Set a new password  [todo]", "model: opus", "outcome: y", "tasks:",
    "- [ ] E2.1 accept the link | size: L | risk: no | test: link works | done: green | deps: none",
    "- [ ] E2.2 expire it | size: m | test: model: haiku in the text is not an override | done: green | deps: none"
  ].join("\n");
  const t = R.parsePlanTasks(plan);
  assert.deepEqual(t.get("E1.1"), { epic: "E1", size: "S", risk: true, epicModel: null });
  assert.deepEqual(t.get("E1.2"), { epic: "E1", size: "M", risk: false, epicModel: null });
  assert.deepEqual(t.get("E2.1"), { epic: "E2", size: "L", risk: false, epicModel: "opus" });
  assert.deepEqual(t.get("E2.2"), { epic: "E2", size: "M", risk: false, epicModel: "opus" });
  assert.equal(t.size, 4);
  assert.equal(R.parsePlanTasks("").size, 0);
});

test("routing: escalatedTasks collects escalated units from events", () => {
  const ev = [{ kind: "stage", unit: "E2.1" }, { kind: "escalated", unit: "E2.3", target: "failed twice" }, { kind: "escalated", unit: "" }];
  assert.deepEqual([...R.escalatedTasks(ev)], ["E2.3"]);
});

test("routing: an agent that is not Boxbox's has no expected model", () => {
  assert.deepEqual(R.expectedModel({ agent: "Explore", mode: "balanced", session: "opus" }), { model: null, why: "not a Boxbox agent" });
  assert.deepEqual(R.expectedModel({ agent: undefined, mode: "best", session: "opus" }), { model: null, why: "not a Boxbox agent" });
});

test("gate: a risky task on sonnet is denied with \"run boxbox-builder with model opus\"", () => {
  const tasks = R.parsePlanTasks("## E2 x\n- [ ] E2.1 a | size: S | risk: no\n- [ ] E2.3 b | size: M | risk: yes\n");
  const g = input => R.gateDecision({ input, mode: "balanced", session: "opus", tasks, history: new Map() });
  const risky = g({ subagent_type: "boxbox:boxbox-builder", description: "E2.3 hash it", model: "sonnet" });
  assert.equal(risky.decision, "deny");
  assert.equal(risky.reason, "E2.3 is risk: yes, run boxbox-builder with model opus");
  assert.deepEqual(g({ subagent_type: "boxbox:boxbox-builder", description: "E2.3 hash it", model: "opus" }).decision, "allow");
  assert.equal(g({ subagent_type: "boxbox:boxbox-builder", description: "E2.1 link", model: "sonnet" }).decision, "allow");
  assert.equal(g({ subagent_type: "boxbox:boxbox-builder", description: "E2.1 link", model: "claude-sonnet-5-5" }).decision, "allow", "a full id counts by family");
  // no model passed where one is expected
  assert.equal(g({ subagent_type: "boxbox:boxbox-builder", description: "E2.1 link" }).reason, "E2.1 is models: balanced, run boxbox-builder with model sonnet");
  // scout and runner follow the table, with a task id, an epic id or setup
  assert.equal(g({ subagent_type: "boxbox:boxbox-scout", description: "E2.3 excerpts", model: "haiku" }).decision, "allow");
  assert.equal(g({ subagent_type: "boxbox:boxbox-runner", description: "setup refresh kit", model: "sonnet" }).reason, "setup is models: balanced, run boxbox-runner with model haiku");
  assert.equal(g({ subagent_type: "boxbox:boxbox-writer", description: "E2 report page", model: "sonnet" }).decision, "allow");
  // not a Boxbox agent: not judged
  assert.equal(g({ subagent_type: "Explore", description: "anything", model: "haiku" }).decision, "skip");
});

test("gate: a call without its unit first is denied; a builder needs a task id", () => {
  const g = input => R.gateDecision({ input, mode: "balanced", session: "opus", tasks: new Map(), history: new Map() });
  assert.match(g({ subagent_type: "boxbox:boxbox-builder", description: "hash the token", model: "sonnet" }).reason, /start the description with the task id, like "E2\.3 <what>"/);
  assert.match(g({ subagent_type: "boxbox:boxbox-builder", description: "E2 everything", model: "sonnet" }).reason, /task id/);
  assert.match(g({ subagent_type: "boxbox:boxbox-scout", description: "look around", model: "haiku" }).reason, /start the description with the unit/);
  // a task the plan does not list is built as size M, risk no
  assert.equal(g({ subagent_type: "boxbox:boxbox-builder", description: "E9.9 new", model: "sonnet" }).decision, "allow");
});

test("gate: an unknown session model fails open when the session model is expected", () => {
  const tasks = R.parsePlanTasks("## E2 x\n- [ ] E2.3 b | size: M | risk: yes\n");
  const d = R.gateDecision({ input: { subagent_type: "boxbox:boxbox-builder", description: "E2.3 b", model: "haiku" }, mode: "balanced", session: null, tasks, history: new Map() });
  assert.equal(d.decision, "allow");
  assert.match(d.reason, /session model unknown/);
});

test("gate: FORCE on or models: auto turns the gate off, with the reason", () => {
  const input = { subagent_type: "boxbox:boxbox-builder", description: "E2.3 b", model: "haiku" };
  const base = { input, session: "opus", tasks: new Map(), history: new Map() };
  const f = R.gateDecision({ ...base, mode: "balanced", force: "haiku" });
  assert.equal(f.decision, "off");
  assert.match(f.reason, /CLAUDE_CODE_SUBAGENT_MODEL_FORCE is on: every subagent runs on haiku/);
  const a = R.gateDecision({ ...base, mode: "auto" });
  assert.deepEqual([a.decision, a.reason], ["off", "models: auto: Claude Code decides"]);
  // FORCE with no model to force: the call's model is ignored, the agent file decides
  assert.match(R.gateDecision({ ...base, mode: "balanced", force: "inherit" }).reason, /ignores the model passed on a call/);
  // no FORCE (a plain CLAUDE_CODE_SUBAGENT_MODEL is only a default): the passed model still wins, so the gate judges
  assert.equal(R.gateDecision({ ...base, mode: "balanced", force: "" }).decision, "deny");
});
