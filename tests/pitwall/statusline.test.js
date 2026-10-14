// Tests for kit/pitwall/statusline: the one line Claude Code shows under the prompt.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "../../skills/boxbox-setup/kit/pitwall/statusline");

function box(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bbsl-"));
  fs.mkdirSync(path.join(root, ".boxbox", "live"), { recursive: true });
  for (const [f, body] of Object.entries(files)) fs.writeFileSync(path.join(root, ".boxbox", "live", f), typeof body === "string" ? body : body.map(x => JSON.stringify(x)).join("\n") + "\n");
  return root;
}
// What Claude Code sends on stdin (docs/routing-spike.md, section 9).
const input = (root, extra = {}) => JSON.stringify({ session_id: "s1", cwd: path.join(root, "src"), workspace: { current_dir: path.join(root, "src"), project_dir: root }, model: { id: "claude-opus-5-5", display_name: "Opus 5.5" }, cost: { total_cost_usd: 0.4249 }, ...extra });
const run = (root, extra) => spawnSync(process.execPath, [SCRIPT], { input: input(root, extra), encoding: "utf8" });

test("statusline: prints task, model, cost and tests from live files in under 50 ms", () => {
  const root = box({
    "stage.json": JSON.stringify({ stage: "build", unit: "E2.3", why: "x", ts: "2026-10-14T10:00:00Z" }),
    "events.jsonl": [
      { ts: new Date(Date.now() - 3000).toISOString(), kind: "gate", result: "allow", target: "boxbox:boxbox-builder", unit: "E2.3", model: "sonnet", expected: "sonnet" },
      { ts: new Date(Date.now() - 2000).toISOString(), kind: "crew", result: "started", target: "boxbox:boxbox-builder", unit: "E2.3", sub: "a1" },
      { ts: new Date(Date.now() - 1000).toISOString(), kind: "test", type: "action", test: { status: "pass", observed: true, passed: 14, failed: 0 } }
    ]
  });
  const times = [];
  let out = "";
  for (let i = 0; i < 7; i++) {
    const t = process.hrtime.bigint();
    const r = run(root);
    times.push(Number(process.hrtime.bigint() - t) / 1e6);
    assert.equal(r.status, 0);
    out = r.stdout;
  }
  assert.equal(out, "E2.3 · builder sonnet · session $0.42 · 14/14 tests\n");
  // The best of 7 runs, node's own start included: the suite runs test files in parallel, so a
  // median measures the machine's load, not the script.
  times.sort((a, b) => a - b);
  assert.ok(times[0] < 50, `best ${times[0]} ms`);
});

test("statusline: paused, waiting on the developer, or between tasks", () => {
  const paused = box({ PAUSE: "", "stage.json": JSON.stringify({ stage: "build", unit: "E2.3" }) });
  assert.equal(run(paused).stdout, "PAUSING · E2.3 · session $0.42\n");
  const asked = box({ "waiting.json": JSON.stringify({ kind: "decision", what: "D3: how strict should rate limiting be?" }), "stage.json": JSON.stringify({ stage: "decisions" }) });
  assert.equal(run(asked).stdout, "Your move: D3: how strict should rate limiting be? · session $0.42\n");
  // no subagent running: the session's own model
  const idle = box({ "stage.json": JSON.stringify({ stage: "plan" }), "events.jsonl": [{ kind: "test", type: "action", test: { status: "fail", observed: true, passed: 12, failed: 2 } }] });
  assert.equal(run(idle).stdout, "plan · opus · session $0.42 · 12/14 tests\n");
});

test("statusline: prints nothing without .boxbox, on bad input, or when a file is broken", () => {
  const none = fs.mkdtempSync(path.join(os.tmpdir(), "bbsl-none-"));
  assert.equal(run(none).stdout, "");
  assert.equal(spawnSync(process.execPath, [SCRIPT], { input: "not json", encoding: "utf8" }).stdout, "");
  const broken = box({ "stage.json": "{ not json", "events.jsonl": "garbage\n" });
  const r = run(broken);
  assert.equal(r.status, 0);
  assert.equal(r.stderr, "");
  assert.equal(r.stdout, "opus · session $0.42\n", "broken live files: what stdin says, nothing more");
});

test("statusline: never prints control characters from the live files", () => {
  const root = box({ "stage.json": JSON.stringify({ stage: "build", unit: "E1\u001b[2K\u009b‮" }),
    "events.jsonl": [{ ts: new Date().toISOString(), session: "s1", kind: "crew", result: "started", target: "boxbox:boxbox-builder\u001b]0;pwned\u0007", sub: "a1" }] });
  const out = run(root).stdout;
  assert.ok(!/[\u0000-\u0009\u000b-\u001f\u007f-\u009f‪-‮⁦-⁩]/.test(out), JSON.stringify(out));
});

test("statusline: only this session's live agent, test run and stage; a pause is PAUSING until it holds", () => {
  const now = Date.now(), iso = ms => new Date(now - ms).toISOString();
  const root = box({
    "stage.json": JSON.stringify({ stage: "build", unit: "E2.3", ts: iso(60000) }),
    "events.jsonl": [
      { ts: iso(2 * 3600e3), session: "old", kind: "crew", result: "started", target: "boxbox:boxbox-scout", sub: "x" },          // another session's, never stopped
      { ts: iso(50000), session: "s1", kind: "gate", result: "allow", target: "boxbox:boxbox-builder", unit: "E2.3", model: "", expected: "" },
      { ts: iso(40000), session: "s1", kind: "crew", result: "started", target: "boxbox:boxbox-builder", unit: "E2.3", sub: "b1" },
      { ts: iso(30000), session: "old", type: "action", kind: "test", test: { status: "pass", observed: true, passed: 9, failed: 0 } },
      { ts: iso(20000), session: "s1", type: "action", kind: "test", test: { status: "fail", observed: false } }
    ]
  });
  assert.equal(run(root).stdout, "E2.3 · builder opus · session $0.42 · tests failing\n", "no model from the gate: the session's own; a failing run without counts");
  fs.writeFileSync(path.join(root, ".boxbox", "live", "PAUSE"), "");
  assert.equal(run(root).stdout, "PAUSING · E2.3 · session $0.42\n");
  fs.writeFileSync(path.join(root, ".boxbox", "live", "held"), "");
  assert.equal(run(root).stdout, "PAUSED · E2.3 · session $0.42\n");
});

test("statusline: a question answered in the question tool stops showing as your move", () => {
  const now = Date.now(), iso = ms => new Date(now - ms).toISOString();
  const root = box({ "waiting.json": JSON.stringify({ kind: "decision", what: "D3: how strict?", ts: iso(60000) }), "stage.json": JSON.stringify({ stage: "decisions", ts: iso(90000) }) });
  assert.equal(run(root).stdout, "Your move: D3: how strict? · session $0.42\n");
  fs.writeFileSync(path.join(root, ".boxbox", "live", "events.jsonl"), JSON.stringify({ ts: iso(1000), session: "s1", type: "action", kind: "edit", target: "app/x.py" }) + "\n");
  assert.equal(run(root).stdout, "decisions · opus · session $0.42\n", "the agent acted after the question: it was answered");
});

test("statusline: a stage from before this session started is not shown as current", () => {
  const now = Date.now(), iso = ms => new Date(now - ms).toISOString();
  const root = box({ "stage.json": JSON.stringify({ stage: "build", unit: "E2.3", ts: iso(86400e3) }),
    "events.jsonl": [{ ts: iso(60000), session: "s1", type: "session", kind: "session", target: "Claude Code session startup" }] });
  assert.equal(run(root).stdout, "opus · session $0.42\n");
});
