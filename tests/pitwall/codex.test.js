// Codex regression for 0.7: Codex runs the same hook scripts, and must behave as in 0.6.
// Every Claude-Code-only part (routing gate, model routing, subagent registration, the waiting
// card reset, the models warning) must stay out of a Codex session's way.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const HOOK = path.resolve(__dirname, "../../hooks/boxbox-event");

// A repo with routing fully configured, as a Claude Code developer would leave it.
function repo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "bbcodex-"));
  fs.mkdirSync(path.join(d, ".git"));
  fs.mkdirSync(path.join(d, ".boxbox", "live"), { recursive: true });
  fs.mkdirSync(path.join(d, ".boxbox", "resets"), { recursive: true });
  fs.writeFileSync(path.join(d, ".boxbox", "config.md"), "commands:\n  test: npm test\nmodels: cheapest\nparallel: on\npitwall: off\n");
  fs.writeFileSync(path.join(d, ".boxbox", "state.md"), "# State\nfeature: resets\n");
  fs.writeFileSync(path.join(d, ".boxbox", "resets", "plan.md"), "## E2 x\n- [ ] E2.3 hash it | size: M | risk: yes | test: t\n");
  return d;
}
// Codex payloads carry turn_id and its own tool names; the transcript is a Codex rollout.
const codex = (d, event, extra) => spawnSync("bash", [HOOK, event], {
  input: JSON.stringify({ session_id: "c1", turn_id: "t1", transcript_path: path.join(os.homedir(), ".codex/sessions/2026/10/14/rollout-c1.jsonl"), cwd: d, hook_event_name: event, ...extra }),
  encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "", PWD: d }, cwd: d
});
const events = async d => {
  const f = path.join(d, ".boxbox", "live", "events.jsonl");
  for (let i = 0; i < 40 && !fs.existsSync(f); i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 150));
  try { return fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse); } catch { return []; }
};

test("hook: a Codex PreToolUse never reaches the routing gate", async () => {
  const d = repo();
  // Even a payload that names an Agent tool: Codex is never judged, never denied.
  for (const tool of ["spawn_agent", "Agent", "Task"]) {
    const r = codex(d, "PreToolUse", { tool_name: tool, tool_input: { subagent_type: "boxbox:boxbox-builder", description: "E2.3 hash it", model: "haiku", isolation: "worktree", message: "go" }, tool_use_id: "x" + tool });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "", `${tool}: nothing printed, nothing denied`);
  }
  const ev = await events(d);
  assert.ok(!ev.some(e => /^gate/.test(e.kind || "")), "no gate or gate-error events");
  assert.ok(ev.some(e => e.agent === "codex" && e.kind === "crew"), "still logged as crew work, as in 0.6");
});

test("hook: Codex sessions get no models warning, no late registration of the wrong kind, no session-model cache", async () => {
  const d = repo();
  const r = codex(d, "SessionStart", { source: "startup" });
  assert.equal(r.status, 0);
  assert.ok(!/models/.test(r.stdout), "the models: warning is Claude Code's only");
  codex(d, "PostToolUse", { tool_name: "shell", tool_input: { command: ["bash", "-lc", "npm test"] }, tool_response: { output: "ok" } });
  codex(d, "Stop", {});
  await events(d);
  const sessions = fs.readFileSync(path.join(d, ".boxbox", "live", "sessions.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  assert.ok(sessions.every(s => s.agent === "codex"), "registered as Codex");
  assert.ok(!sessions.some(s => s.late), "Codex registers at SessionStart as in 0.6");
  assert.ok(!fs.existsSync(path.join(d, ".boxbox", "live", "session-model.json")));
  assert.ok(!(await events(d)).some(e => e.kind === "warning"));
});

test("server: a Codex rollout still counts tokens per session with its model and no price", () => {
  const s = require("../../skills/boxbox-setup/kit/pitwall/server.js");
  const lines = fs.readFileSync(path.join(__dirname, "fixtures", "codex-rollout.jsonl"), "utf8").trim().split("\n");
  const entries = s.ingestCodexLines({}, lines, { session: "c1" });
  const t = s.aggregate(entries, [], { models: {} }, null, Date.now());
  assert.ok(t.total.tokens > 0);
  assert.equal(t.byModel[0].model, "gpt-5-codex");
  assert.equal(t.byModel[0].cost, null);
  assert.equal(t.savings.sessionModels.length, 0, "no subagent savings for Codex");
});
