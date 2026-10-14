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
      { ts: "2026-10-14T10:00:01Z", kind: "gate", result: "allow", target: "boxbox:boxbox-builder", unit: "E2.3", model: "sonnet", expected: "sonnet" },
      { ts: "2026-10-14T10:00:02Z", kind: "crew", result: "started", target: "boxbox:boxbox-builder", unit: "E2.3", sub: "a1" },
      { ts: "2026-10-14T10:00:03Z", kind: "test", type: "action", test: { status: "pass", observed: true, passed: 14, failed: 0 } }
    ]
  });
  const times = [];
  let out = "";
  for (let i = 0; i < 5; i++) {
    const t = process.hrtime.bigint();
    const r = run(root);
    times.push(Number(process.hrtime.bigint() - t) / 1e6);
    assert.equal(r.status, 0);
    out = r.stdout;
  }
  assert.equal(out, "E2.3 · builder sonnet · $0.42 · 14/14 tests\n");
  times.sort((a, b) => a - b);
  assert.ok(times[2] < 50, `median ${times[2]} ms`);
});

test("statusline: paused, waiting on the developer, or between tasks", () => {
  const paused = box({ PAUSE: "", "stage.json": JSON.stringify({ stage: "build", unit: "E2.3" }) });
  assert.equal(run(paused).stdout, "PAUSED · E2.3 · $0.42\n");
  const asked = box({ "waiting.json": JSON.stringify({ kind: "decision", what: "D3: how strict should rate limiting be?" }), "stage.json": JSON.stringify({ stage: "decisions" }) });
  assert.equal(run(asked).stdout, "Your move: D3: how strict should rate limiting be? · $0.42\n");
  // no subagent running: the session's own model
  const idle = box({ "stage.json": JSON.stringify({ stage: "plan" }), "events.jsonl": [{ kind: "test", type: "action", test: { status: "fail", observed: true, passed: 12, failed: 2 } }] });
  assert.equal(run(idle).stdout, "plan · opus · $0.42 · 12/14 tests\n");
});

test("statusline: prints nothing without .boxbox, on bad input, or when a file is broken", () => {
  const none = fs.mkdtempSync(path.join(os.tmpdir(), "bbsl-none-"));
  assert.equal(run(none).stdout, "");
  assert.equal(spawnSync(process.execPath, [SCRIPT], { input: "not json", encoding: "utf8" }).stdout, "");
  const broken = box({ "stage.json": "{ not json", "events.jsonl": "garbage\n" });
  const r = run(broken);
  assert.equal(r.status, 0);
  assert.equal(r.stderr, "");
  assert.equal(r.stdout, "opus · $0.42\n", "broken live files: what stdin says, nothing more");
});
