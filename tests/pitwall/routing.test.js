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
