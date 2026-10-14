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
  assert.deepEqual(t.get("E1.1"), { epic: "E1", size: "S", risk: true, epicModel: null, deps: [] });
  assert.deepEqual(t.get("E1.2"), { epic: "E1", size: "M", risk: false, epicModel: null, deps: ["E1.1"] });
  assert.deepEqual(t.get("E2.1"), { epic: "E2", size: "L", risk: false, epicModel: "opus", deps: [] });
  assert.deepEqual(t.get("E2.2"), { epic: "E2", size: "M", risk: false, epicModel: "opus", deps: [] });
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
  const base = { input, session: "opus", tasks: new Map([["E2.3", { size: "M", risk: false, epicModel: null }]]), history: new Map() };
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

test("gate: after two recorded failures a sonnet builder retry is denied", () => {
  // A run is a builder subagent that finished on the task (a "crew finished" event).
  const ev = (ts, kind, unit, extra = {}) => ({ ts: `2026-10-14T10:0${ts}:00Z`, kind, unit, target: "boxbox:boxbox-builder", result: "finished", ...extra });
  const tasks = R.parsePlanTasks("## E2 x\n- [ ] E2.1 a | size: S | risk: no\n- [ ] E2.2 b | size: S | risk: no\n");
  const input = model => ({ subagent_type: "boxbox:boxbox-builder", description: "E2.1 a", model });
  const decide = (events, model) => R.gateDecision({ input: input(model), mode: "balanced", session: "opus", tasks, history: R.builderHistory(events) });

  const twice = [ev(1, "crew", "E2.1"), ev(2, "crew", "E2.1")];
  const d = decide(twice, "sonnet");
  assert.equal(d.decision, "deny");
  assert.equal(d.reason, 'E2.1 failed twice: run say escalated "failed twice" --unit E2.1, then boxbox-builder with model opus');
  assert.equal(decide(twice, "opus").decision, "deny", "escalation must be recorded first");
  // once escalated, the retry runs on the session model, once
  const escalated = [...twice, { ts: "2026-10-14T10:03:00Z", kind: "escalated", unit: "E2.1", target: "failed twice" }];
  assert.equal(decide(escalated, "opus").decision, "allow");
  assert.match(decide(escalated, "sonnet").reason, /E2\.1 is escalated, run boxbox-builder with model opus/);
  const again = [...escalated, ev(4, "crew", "E2.1")];
  assert.equal(decide(again, "opus").reason, "E2.1 was escalated and failed again: stop and tell the developer");
  // a subagent that only started, another task, a lowercase id: none is a finished E2.1 run
  assert.equal(decide([ev(1, "crew", "E2.1"), ev(2, "crew", "E2.1", { result: "started" }), ev(3, "crew", "E2.2")], "sonnet").decision, "allow");
  assert.equal(decide([...twice, { ts: "x", kind: "escalated", unit: "e2.1", target: "t" }], "opus").decision, "allow", "a lowercase unit still counts");
  // a new build stage for the task starts its history again: a later feature, or changes after review
  const restarted = [...again, { ts: "2026-10-14T11:00:00Z", kind: "stage", target: "build", unit: "E2.1" }];
  assert.equal(decide(restarted, "sonnet").decision, "allow");
});

test("gate: a missing plan is not checked; a task the plan does not list is denied", () => {
  const input = { subagent_type: "boxbox:boxbox-builder", description: "E2.9 new", model: "opus" };
  const none = R.gateDecision({ input, mode: "balanced", session: "opus", tasks: new Map(), history: new Map() });
  assert.equal(none.decision, "allow");
  assert.match(none.reason, /not checked: no tasks in plan\.md/);
  const tasks = R.parsePlanTasks("## E2 x\n- [ ] E2.1 a | size: S | risk: no\n");
  assert.equal(R.gateDecision({ input, mode: "balanced", session: "opus", tasks, history: new Map() }).reason,
    "E2.9 is not a task in plan.md: start the description with the task's id from the plan");
});

test("gate: a deny reason never puts a file path into the command it suggests", () => {
  const h = R.builderHistory([{ kind: "escalate-needed", unit: "E2.1", target: 'edited a"$(rm -rf ~)`x`.py, outside its brief' }]);
  const d = R.gateDecision({ input: { subagent_type: "boxbox:boxbox-builder", description: "E2.1 a", model: "sonnet" }, mode: "balanced", session: "opus", tasks: new Map([["E2.1", { size: "S", risk: false, epicModel: null }]]), history: h });
  assert.ok(!/[$`\\]/.test(d.reason), d.reason);
  assert.match(d.reason, /: run say escalated "[\w .,:\/-]*" --unit E2\.1, then boxbox-builder with model opus$/);
});

test("gate: an early trigger requires escalation before the next builder run", () => {
  const tasks = new Map([["E2.1", { size: "S", risk: false, epicModel: null }]]);
  const h = R.builderHistory([{ ts: "2026-10-14T10:01:00Z", kind: "crew", unit: "E2.1", target: "boxbox:boxbox-builder", result: "finished" },
                             { ts: "2026-10-14T10:02:00Z", kind: "escalate-needed", unit: "E2.1", target: "edited app/x.py, outside its brief" }]);
  const d = R.gateDecision({ input: { subagent_type: "boxbox:boxbox-builder", description: "E2.1 a", model: "sonnet" }, mode: "balanced", session: "opus", tasks, history: h });
  assert.equal(d.reason, 'E2.1 edited app/x.py, outside its brief: run say escalated "edited a file, outside its brief" --unit E2.1, then boxbox-builder with model opus');
  // the session model is already the builder's: nothing to escalate to
  const best = R.gateDecision({ input: { subagent_type: "boxbox:boxbox-builder", description: "E2.1 a", model: "opus" }, mode: "best", session: "opus", tasks, history: h });
  assert.equal(best.reason, "E2.1 edited app/x.py, outside its brief, and it already runs on the session model: stop and tell the developer");
});

test("routing: two tasks sharing a brief file are never scheduled together", () => {
  const plan = "## E2 x  [in_progress]\ntasks:\n" +
    "- [x] E2.1 a | size: S | risk: no | test: t | deps: none\n" +
    "- [ ] E2.2 b | size: S | risk: no | test: t | deps: E2.1\n" +
    "- [ ] E2.3 c | size: S | risk: no | test: t | deps: none\n" +
    "- [ ] E2.4 d | size: S | risk: no | test: t | deps: E2.3\n" +
    "- [ ] E2.5 e | size: S | risk: no | test: t | deps: none\n" +
    "- [ ] E2.6 f | size: S | risk: no | test: t | deps: none\n" +
    "## E3 y  [todo]\ntasks:\n- [ ] E3.1 g | size: S | risk: no | test: t | deps: none\n";
  const files = { "E2.2": ["app/a.py", "tests/test_a.py"], "E2.3": ["app/b.py"], "E2.5": ["app/a.py"], "E2.6": ["app/c.py"], "E3.1": ["app/d.py"] };
  const batch = R.parallelBatch(R.parsePlanTasks(plan), "E2", new Set(["E2.1"]), files);
  // plan order; E2.4 waits for E2.3; E2.5 shares app/a.py with E2.2; other epics never join
  assert.deepEqual(batch, ["E2.2", "E2.3", "E2.6"]);
  // at most 3, and a task with no brief yet is not scheduled
  assert.deepEqual(R.parallelBatch(R.parsePlanTasks(plan), "E2", new Set(["E2.1"]), { ...files, "E2.6": undefined }), ["E2.2", "E2.3"]);
  // one task is not parallel work
  assert.deepEqual(R.parallelBatch(R.parsePlanTasks(plan), "E3", new Set(), files), ["E3.1"]);
});

test("routing: parallel is refused when worktree.baseRef is not head", () => {
  assert.deepEqual(R.parallelReady({ parallel: false }), { ok: false, reason: "parallel: off in config.md" });
  assert.match(R.parallelReady({ parallel: true, settings: [] }).reason, /worktree\.baseRef/);
  assert.match(R.parallelReady({ parallel: true, settings: ['{"worktree":{"baseRef":"default"}}'] }).reason, /worktree\.baseRef/);
  assert.deepEqual(R.parallelReady({ parallel: true, settings: ['{"other":1}', '{"worktree":{"baseRef":"head"}}'] }), { ok: true, reason: "" });
  assert.equal(R.parallelReady({ parallel: true, settings: ["not json"] }).ok, false);
  // the gate holds a worktree builder to the same rule
  const tasks = R.parsePlanTasks("## E2 x\n- [ ] E2.1 a | size: S | risk: no\n");
  const input = { subagent_type: "boxbox:boxbox-builder", description: "E2.1 a", model: "sonnet", isolation: "worktree" };
  const no = R.gateDecision({ input, mode: "balanced", session: "opus", tasks, history: new Map(), parallel: R.parallelReady({ parallel: true, settings: [] }) });
  assert.match(no.reason, /^E2\.1 asks for a worktree, but parallel builds are not ready: /);
  assert.equal(R.gateDecision({ input, mode: "balanced", session: "opus", tasks, history: new Map(), parallel: { ok: true } }).decision, "allow");
});
