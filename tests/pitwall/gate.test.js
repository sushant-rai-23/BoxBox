// Tests for hooks/boxbox-event (bash): the no-.boxbox fast path and the pause gate.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync, spawn } = require("child_process");

const HOOK = path.resolve(__dirname, "../../hooks/boxbox-event");
const PAYLOAD = JSON.stringify({ session_id: "s1", transcript_path: "/tmp/x.jsonl", cwd: "/tmp", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "echo hi" }, tool_use_id: "t1" });

function repo(withBoxbox) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "bbgate-"));
  fs.mkdirSync(path.join(d, ".git"));
  if (withBoxbox) fs.mkdirSync(path.join(d, ".boxbox", "live"), { recursive: true });
  return d;
}
function run(dir, event, env = {}) {
  return spawnSync("bash", [HOOK, event], { input: PAYLOAD, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir, ...env } });
}

test("no .boxbox: exits 0, writes nothing, well under 50 ms", () => {
  const d = repo(false);
  const times = [];
  for (let i = 0; i < 5; i++) {
    const t = process.hrtime.bigint();
    const r = run(d, "PreToolUse");
    times.push(Number(process.hrtime.bigint() - t) / 1e6);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
  }
  assert.deepEqual(fs.readdirSync(d), [".git"]);
  times.sort((a, b) => a - b);
  assert.ok(times[2] < 50, `median ${times[2]} ms`);
});

test("paused past the limit: denies with the paused message", () => {
  const d = repo(true);
  fs.writeFileSync(path.join(d, ".boxbox/live/PAUSE"), "");
  const r = run(d, "PreToolUse", { BOXBOX_PAUSE_LIMIT: "1" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /The developer paused Boxbox from the pit wall/);
  assert.equal(fs.existsSync(path.join(d, ".boxbox/live/held")), false);
});

test("resume while held: the call is allowed", async () => {
  const d = repo(true);
  const pause = path.join(d, ".boxbox/live/PAUSE");
  fs.writeFileSync(pause, "");
  const child = spawn("bash", [HOOK, "PreToolUse"], { env: { ...process.env, CLAUDE_PROJECT_DIR: d, BOXBOX_PAUSE_LIMIT: "20" } });
  child.stdin.end(PAYLOAD);
  await new Promise(r => setTimeout(r, 1200));
  assert.equal(fs.existsSync(path.join(d, ".boxbox/live/held")), true, "held marker while waiting");
  fs.unlinkSync(pause);
  const code = await new Promise(r => child.on("exit", r));
  assert.equal(code, 0);
  assert.equal(fs.existsSync(path.join(d, ".boxbox/live/held")), false);
});

test("fails closed: an error while paused denies", () => {
  const d = repo(true);
  fs.writeFileSync(path.join(d, ".boxbox/live/PAUSE"), "");
  fs.mkdirSync(path.join(d, ".boxbox/live/held")); // writing the marker now fails
  const r = run(d, "PreToolUse", { BOXBOX_PAUSE_LIMIT: "30" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /paused Boxbox/);
});

test("not paused: logs the action in the background", async () => {
  const d = repo(true);
  const r = run(d, "PreToolUse");
  assert.equal(r.status, 0);
  const f = path.join(d, ".boxbox/live/events.jsonl");
  for (let i = 0; i < 40 && !fs.existsSync(f); i++) await new Promise(r => setTimeout(r, 50));
  const e = JSON.parse(fs.readFileSync(f, "utf8").trim());
  assert.equal(e.type, "start");
  assert.equal(e.kind, "run");
  assert.equal(e.target, "echo hi");
});
