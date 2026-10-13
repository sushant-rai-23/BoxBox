// Tests for the pit wall server's pure parts: token counting, attribution, scope, verification.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const s = require("../../skills/boxbox-setup/kit/pitwall/server.js");

const fx = f => fs.readFileSync(path.join(__dirname, "fixtures", f), "utf8").split("\n");
const PRICES = { models: { "claude-opus-5-5": { input: 4, output: 20, cache_write_5m: 5, cache_write_1h: 8, cache_read: 0.2 } } };

test("Claude usage: each message.id counted once, keeping the line with the highest usage", () => {
  const byId = new Map();
  s.ingestClaudeLines(byId, fx("claude-session.jsonl"), { session: "s1" });
  assert.equal(byId.size, 2);
  const a = byId.get("msg_A");
  assert.equal(a.output, 117, "the last, growing line wins over the first partial one");
  assert.equal(a.cacheWrite5m, 1000);
  const t = s.totals([...byId.values()], PRICES);
  assert.equal(t.fresh, 10 + 117 + 1000 + 5 + 200);
  assert.equal(t.cache, 3000);
  assert.equal(t.tokens, 4332);
  assert.ok(Math.abs(t.cost - 0.012) < 1e-9, `cost ${t.cost}`);
});

test("Claude usage: a line arriving in a later read updates the same message", () => {
  const lines = fx("claude-session.jsonl");
  const byId = new Map();
  s.ingestClaudeLines(byId, lines.slice(0, 2), { session: "s1" });
  assert.equal(byId.get("msg_A").output, 1);
  s.ingestClaudeLines(byId, lines.slice(2), { session: "s1" });
  assert.equal(byId.get("msg_A").output, 117);
});

test("Codex usage: deltas of the running total, duplicates skipped, model from turn_context", () => {
  const st = {};
  const entries = s.ingestCodexLines(st, fx("codex-rollout.jsonl"), { session: "c1" });
  assert.equal(entries.length, 2);
  assert.equal(entries[0].model, "gpt-5-codex");
  const t = s.totals(entries, PRICES);
  assert.equal(t.tokens, 3850, "matches total_tokens in the log");
  assert.equal(t.cache, 1800);
  assert.equal(t.cost, null, "no price for this model: tokens only, never a guess");
  assert.deepEqual(t.unpriced, ["gpt-5-codex"]);
});

test("prices match by model id prefix and never invent a missing rate", () => {
  assert.ok(s.priceFor("claude-opus-5-5", PRICES));
  assert.ok(s.priceFor("claude-opus-5-5-20261001", PRICES));
  assert.equal(s.priceFor("claude-opus-5", PRICES), null);
  assert.equal(s.priceFor("claude-opus-5-5-7", PRICES), null, "a newer model never borrows an older price");
  const p = { input: 1, output: 2 };
  assert.equal(s.costOf({ input: 1e6, output: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 5 }, p), null);
  assert.equal(s.costOf({ input: 1e6, output: 1e6, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0 }, p), 3);
});

test("tokens go to the unit whose stage was active at the time", () => {
  const events = [
    { ts: "2026-10-13T09:59:00.000Z", type: "stage", target: "plan", unit: "" },
    { ts: "2026-10-13T10:04:00.000Z", type: "stage", target: "build", unit: "E1.1" }
  ];
  const byId = new Map();
  s.ingestClaudeLines(byId, fx("claude-session.jsonl"), { session: "s1" });
  const board = { milestones: [{ id: "M1", status: "in_progress", epics: [{ id: "E1", title: "Ask for a reset email", status: "in_progress", tasks: [{ id: "E1.1", title: "Hashed token", status: "in_progress" }] }] }] };
  const agg = s.aggregate([...byId.values()], s.stageTimeline(events), PRICES, board, Date.parse("2026-10-13T10:10:00Z"));
  const plan = agg.byEpic.find(r => r.id === "Plan");
  const e1 = agg.byEpic.find(r => r.id === "E1");
  assert.equal(plan.fresh + plan.cache, 1127);
  assert.equal(e1.fresh + e1.cache, 3205);
  assert.equal(e1.name, "Ask for a reset email");
  assert.equal(agg.byTask.find(r => r.id === "E1.1").tokens, 3205);
  assert.equal(agg.sessions[0].tokens, 4332);
  assert.equal(agg.byEpic.find(r => r.id === "E1").ms, 6 * 60000);
});

test("globs", () => {
  assert.ok(s.matchAny("src/resets.js", ["src/resets.js"]));
  assert.ok(s.matchAny("src/a/b.js", ["src/**"]));
  assert.ok(s.matchAny("src/b.js", ["src/**/*.js"]));
  assert.ok(s.matchAny("test/resets.test.js", ["test/*.test.{js,ts}"]));
  assert.ok(s.matchAny("src/users/x.js", ["src/users"]), "a plain folder covers what is inside");
  assert.ok(!s.matchAny("src/mailer.js", ["src/resets.js", "test/**"]));
});

const BOARD = {
  modules: [
    { name: "Reset tokens", files: ["src/resets.js"], role: "tokens" },
    { name: "Mailer", files: ["src/mailer.js"], role: "email" },
    { name: "Tests", files: ["test/**"], role: "tests" }
  ],
  milestones: [{ id: "M1", status: "in_progress", epics: [
    { id: "E1", title: "Ask", status: "done", files: ["src/mailer.js", "test/mailer.test.js"], tasks: [{ id: "E1.1", title: "a", status: "done" }] },
    { id: "E2", title: "Set", status: "in_progress", files: ["src/resets.js", "test/**"], tasks: [
      { id: "E2.1", title: "x", status: "done" }, { id: "E2.2", title: "y", status: "done" }, { id: "E2.3", title: "z", status: "in_progress" }] }
  ] }]
};

test("scope: edits outside the epic's files are flagged, approved epics marked changed, plan behind", () => {
  const events = [
    { ts: "2026-10-13T10:00:00Z", type: "action", unit: "E2.1", edits: ["src/resets.js"] },
    { ts: "2026-10-13T10:01:00Z", type: "action", unit: "E2.1", edits: ["test/resets.test.js"] },
    { ts: "2026-10-13T10:02:00Z", type: "action", unit: "E2.2", edits: ["src/mailer.js"] },
    { ts: "2026-10-13T10:03:00Z", type: "action", unit: "E2.2", edits: ["docs/notes.md"] },
    { ts: "2026-10-13T10:04:00Z", type: "action", unit: "", edits: [".gitignore"] }
  ];
  const d = s.drift(BOARD, events, "E2.3", Date.parse("2026-10-13T10:05:00Z"));
  assert.deepEqual(d.outside.map(o => o.path), ["src/mailer.js", "docs/notes.md"]);
  assert.deepEqual(d.changedAfterApproval, ["E1"]);
  assert.deepEqual(d.behind, ["docs/notes.md"]);
  assert.deepEqual(d.files.map(f => [f.path, f.in]), [["src/resets.js", true], ["test/resets.test.js", true], ["src/mailer.js", false], ["docs/notes.md", false]]);
  const mailer = d.modules.find(m => m.name === "Mailer");
  assert.equal(mailer.outside, true);
  assert.equal(mailer.inScope, false, "a sibling file in the same folder is not in scope");
  assert.equal(d.modules.find(m => m.name === "Tests").inScope, true);
  assert.equal(d.modules.find(m => m.name === "Reset tokens").inScope, true);
  assert.equal(mailer.recent, 1);
});

test("no files declared: no scope checks", () => {
  const d = s.drift({ milestones: [{ id: "M1", status: "in_progress", epics: [{ id: "E1", status: "todo", tasks: [] }] }] }, [{ ts: "x", type: "action", unit: "E1.1", edits: ["a.js"] }], "E1.1", Date.now());
  assert.deepEqual(d.outside, []);
  assert.deepEqual(d.behind, []);
});

test("verified only when an observed passing run follows the task's last edit", () => {
  const events = [
    { ts: "2026-10-13T10:00:00Z", type: "action", unit: "E2.1", edits: ["src/resets.js"] },
    { ts: "2026-10-13T10:01:00Z", type: "action", unit: "E2.1", kind: "test", test: { status: "pass", observed: true } },
    { ts: "2026-10-13T10:02:00Z", type: "action", unit: "E2.2", kind: "test", test: { status: "pass", observed: true } },
    { ts: "2026-10-13T10:03:00Z", type: "action", unit: "E2.2", edits: ["src/resets.js"] },
    { ts: "2026-10-13T10:04:00Z", type: "action", unit: "E2.2", kind: "test", test: { status: "unknown", observed: false } }
  ];
  const v = s.verification(BOARD, events);
  assert.equal(v.tasks["E2.1"], "verified");
  assert.equal(v.tasks["E2.2"], "claimed", "the only pass came before its last edit");
  assert.equal(v.tasks["E2.3"], undefined, "not done yet: no label");
  assert.equal(v.epics.E2, undefined);
  assert.equal(v.tasks["E1.1"], "claimed", "done with no observed run");
});

test("board-data.js parses with its comment lines", () => {
  const b = s.parseBoard('// a\n// b\nwindow.BOXBOX_BOARD = {"project":"x","milestones":[]};\n');
  assert.equal(b.project, "x");
  assert.equal(s.parseBoard("garbage"), null);
});

test("current stage is 'outside the flow' when a session started after the last stage", () => {
  const stage = { stage: "build", unit: "E1.2", why: "x", ts: "2026-10-13T10:00:00Z" };
  const evs = [{ ts: "2026-10-13T11:00:00Z", type: "session", target: "Claude Code session startup" }];
  assert.equal(s.currentStage(stage, evs).stage, "outside");
  assert.equal(s.currentStage(stage, [{ ts: "2026-10-13T09:00:00Z", type: "session", target: "Claude Code session startup" }]).stage, "build");
  assert.equal(s.currentStage(null, []).stage, "outside");
  const sameSecond = { stage: "build", unit: "E1.2", ts: "2026-10-13T09:23:49Z" };
  assert.equal(s.currentStage(sameSecond, [{ ts: "2026-10-13T09:23:49.610Z", type: "session", target: "Claude Code session startup" }]).stage, "build", "say writes whole seconds");
});
