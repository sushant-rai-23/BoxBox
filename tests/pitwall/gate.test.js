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

// A repo set up for routing: config, state naming the feature, and a plan with one risky task.
function routedRepo(models = "balanced") {
  const d = repo(true);
  fs.writeFileSync(path.join(d, ".boxbox/config.md"), `commands:\n  test: npm test\nmodels: ${models}\npitwall: off\n`);
  fs.writeFileSync(path.join(d, ".boxbox/state.md"), "# State\nfeature: resets\n");
  fs.mkdirSync(path.join(d, ".boxbox/resets"), { recursive: true });
  fs.writeFileSync(path.join(d, ".boxbox/resets/plan.md"), "## E2 Set a password  [in_progress]\ntasks:\n- [ ] E2.1 accept the link | size: S | risk: no | test: x\n- [ ] E2.3 hash it | size: M | risk: yes | test: y\n");
  return d;
}
function agentCall(d, input, env = {}) {
  const tr = path.join(d, "s1.jsonl");
  if (!fs.existsSync(tr)) fs.writeFileSync(tr, JSON.stringify({ type: "assistant", message: { id: "m1", model: "claude-opus-5-5[1m]", usage: { input_tokens: 1, output_tokens: 1 } } }) + "\n");
  const payload = JSON.stringify({ session_id: "s1", transcript_path: tr, cwd: d, hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: input, tool_use_id: "tu1" });
  return spawnSync("bash", [HOOK, "PreToolUse"], { input: payload, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: d, CLAUDE_CODE_SUBAGENT_MODEL: "", CLAUDE_CODE_SUBAGENT_MODEL_FORCE: "", ...env } });
}
const events = d => { try { return fs.readFileSync(path.join(d, ".boxbox/live/events.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse); } catch { return []; } };

test("gate: an Agent call reaches the gate synchronously and a Bash call stays in the background", () => {
  const d = routedRepo();
  const r = agentCall(d, { subagent_type: "boxbox:boxbox-builder", description: "E2.1 accept the link", model: "sonnet", prompt: "p" });
  assert.equal(r.status, 0);
  const g = events(d).find(e => e.kind === "gate");
  assert.ok(g, "the gate event is written before the hook returns");
  assert.equal(g.result, "allow");
  assert.equal(g.unit, "E2.1");
  assert.equal(r.stdout, "", "an allowed call prints nothing, so permission prompts still apply");
  // A Bash call still goes to the background: the hook returns before node has written anything.
  const t = process.hrtime.bigint();
  const b = run(d, "PreToolUse");
  assert.ok(Number(process.hrtime.bigint() - t) / 1e6 < 40, "a Bash call does not wait for node");
  assert.equal(b.stdout, "");
});

test("gate: a wrong model is denied by the real hook with the reason", () => {
  const d = routedRepo();
  const r = agentCall(d, { subagent_type: "boxbox:boxbox-builder", description: "E2.3 hash it", model: "haiku", prompt: "p" });
  const out = JSON.parse(r.stdout.trim());
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /E2\.3 is risk: yes, run boxbox-builder with model/);
  assert.equal(events(d).find(e => e.kind === "gate").result, "deny");
});

test("gate: the session model is the transcript's message.model, never a tool input's model", () => {
  const d = routedRepo();
  const line = { type: "assistant", message: { id: "m2", model: "claude-opus-5-5", content: [{ type: "tool_use", name: "Agent", input: { subagent_type: "boxbox:boxbox-builder", model: "sonnet" } }], usage: { input_tokens: 1 } } };
  fs.writeFileSync(path.join(d, "s1.jsonl"), "partial line cut by the 256 KB window\n" + JSON.stringify(line) + "\n");
  const r = agentCall(d, { subagent_type: "boxbox:boxbox-builder", description: "E2.3 hash it", model: "sonnet", prompt: "p" });
  assert.match(r.stdout, /E2\.3 is risk: yes, run boxbox-builder with model opus/);
});

test("gate: FORCE on allows any model and logs gate-off with the reason", () => {
  const d = routedRepo();
  const r = agentCall(d, { subagent_type: "boxbox:boxbox-builder", description: "E2.3 hash it", model: "haiku", prompt: "p" },
    { CLAUDE_CODE_SUBAGENT_MODEL: "haiku", CLAUDE_CODE_SUBAGENT_MODEL_FORCE: "1" });
  assert.equal(r.stdout, "");
  const g = events(d).find(e => e.kind === "gate");
  assert.equal(g.result, "off");
  assert.match(g.why, /FORCE is on/);
  // FORCE without a model: Claude Code ignores the model passed on a call and the agent file decides
  const d2 = routedRepo();
  assert.equal(agentCall(d2, { subagent_type: "boxbox:boxbox-builder", description: "E2.3 hash it", model: "haiku", prompt: "p" }, { CLAUDE_CODE_SUBAGENT_MODEL_FORCE: "1" }).stdout, "");
  assert.match(events(d2).find(e => e.kind === "gate").why, /ignores the model passed on a call/);
});

test("gate: an unparsable plan.md allows the call and logs gate-error", () => {
  // The plan is unreadable, then the payload itself is cut off: either way the call goes through.
  const d = routedRepo();
  fs.rmSync(path.join(d, ".boxbox/resets/plan.md"));
  fs.mkdirSync(path.join(d, ".boxbox/resets/plan.md"));
  const r1 = agentCall(d, { subagent_type: "boxbox:boxbox-builder", description: "E2.3 hash it", model: "sonnet", prompt: "p" });
  assert.equal(r1.stdout, "", "no plan: the task counts as size M, risk no, and sonnet is allowed");
  const cut = '{"session_id":"s1","hook_event_name":"PreToolUse","tool_name":"Agent","tool_input":{"subagent_type":"boxbox:boxbox-bui';
  const r2 = spawnSync("bash", [HOOK, "PreToolUse"], { input: cut, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: d } });
  assert.equal(r2.status, 0);
  assert.equal(r2.stdout, "", "a broken gate never denies");
  const e = events(d).find(x => x.kind === "gate-error");
  assert.ok(e, "the failure shows on the pit wall");
  assert.equal(e.result, "allowed");
});
