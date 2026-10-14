// Tests for hooks/boxbox-event.js: the pure parts of the live hook.
// Run: node --test tests/pitwall/
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("../../hooks/boxbox-event.js");

test("masks secrets in commands", () => {
  assert.equal(h.maskSecrets("curl -H 'Authorization: Bearer abc.def.ghi' x"), "curl -H 'Authorization: Bearer ***' x");
  assert.equal(h.maskSecrets("API_KEY=sk-1234567890abcdefXYZ npm start"), "API_KEY=*** npm start");
  assert.equal(h.maskSecrets("git push https://me:hunter2@github.com/a/b"), "git push https://***@github.com/a/b");
  assert.equal(h.maskSecrets("export GITHUB_TOKEN=ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), "export GITHUB_TOKEN=***");
  assert.equal(h.maskSecrets("mysql --password=secret -u root"), "mysql --password=*** -u root");
  assert.equal(h.maskSecrets("npm test"), "npm test");
});

test("parses test runner summaries", () => {
  assert.deepEqual(h.parseTestSummary("Tests:       1 failed, 14 passed, 15 total"), { passed: 14, failed: 1 });
  assert.deepEqual(h.parseTestSummary("===== 5 passed, 2 failed in 0.3s ====="), { passed: 5, failed: 2 });
  assert.deepEqual(h.parseTestSummary("  14 passing (32ms)\n  1 failing"), { passed: 14, failed: 1 });
  assert.deepEqual(h.parseTestSummary("# tests 9\n# pass 9\n# fail 0"), { passed: 9, failed: 0 });
  assert.deepEqual(h.parseTestSummary("ℹ tests 1\nℹ pass 0\nℹ fail 1\nℹ cancelled 0"), { passed: 0, failed: 1 }, "node --test spec reporter");
  assert.deepEqual(h.parseTestSummary("test result: ok. 12 passed; 0 failed; 0 ignored"), { passed: 12, failed: 0 });
  assert.deepEqual(h.parseTestSummary("===== 3 passed in 0.1s ====="), { passed: 3, failed: 0 });
  assert.equal(h.parseTestSummary("everything is fine"), null);
});

test("finds edited paths in an apply_patch body", () => {
  const patch = [
    "*** Begin Patch",
    "*** Update File: src/resets.js",
    "@@", "-a", "+b",
    "*** Add File: test/resets.test.js",
    "+x",
    "*** Delete File: old.js",
    "*** Update File: src/a.js",
    "*** Move to: src/b.js",
    "*** End Patch"
  ].join("\n");
  assert.deepEqual(h.patchPaths(patch), ["src/resets.js", "test/resets.test.js", "old.js", "src/a.js", "src/b.js"]);
});

test("classifies Claude Code tools", () => {
  const root = "/r";
  assert.deepEqual(h.classify("Read", { file_path: "/r/src/a.js" }, { root }), { kind: "read", target: "src/a.js" });
  assert.deepEqual(h.classify("Grep", { pattern: "scryptSync" }, { root }), { kind: "search", target: "scryptSync" });
  assert.deepEqual(h.classify("Edit", { file_path: "/r/src/a.js" }, { root }), { kind: "edit", target: "src/a.js" });
  assert.deepEqual(h.classify("Write", { file_path: "/r/.boxbox/f/plan.html" }, { root }), { kind: "page", target: ".boxbox/f/plan.html" });
  assert.deepEqual(h.classify("WebSearch", { query: "timingSafeEqual" }, { root }), { kind: "web", target: "timingSafeEqual" });
  assert.deepEqual(h.classify("Skill", { skill: "boxbox-plan" }, { root }), { kind: "skill", target: "boxbox-plan" });
  assert.deepEqual(h.classify("Agent", { description: "Implement E1.2" }, { root }), { kind: "crew", target: "Implement E1.2" });
  assert.deepEqual(h.classify("TodoWrite", {}, { root }), { kind: "think", target: "updating the to-do list" });
  assert.deepEqual(h.classify("AskUserQuestion", { questions: [{ question: "Pick one?" }] }, { root }), { kind: "wait", target: "Pick one?" });
});

test("classifies shell commands, including Codex's Bash", () => {
  const o = { root: "/r", testCommand: "npm test" };
  assert.equal(h.classify("Bash", { command: "npm test" }, o).kind, "test");
  assert.equal(h.classify("Bash", { command: "npm test -- resets" }, o).kind, "test");
  assert.equal(h.classify("Bash", { command: "git commit -m 'E1.2: x'" }, o).kind, "commit");
  assert.equal(h.classify("Bash", { command: "rg scrypt src" }, o).kind, "search");
  assert.equal(h.classify("Bash", { command: "sed -n 1,80p src/a.js" }, o).kind, "read");
  assert.equal(h.classify("Bash", { command: "git diff --stat" }, o).kind, "run");
  assert.equal(h.classify("apply_patch", { command: "*** Begin Patch\n*** Update File: src/a.js\n" }, o).kind, "edit");
  assert.equal(h.classify("apply_patch", { command: "*** Begin Patch\n*** Update File: src/a.js\n" }, o).target, "src/a.js");
  assert.equal(h.classify("spawn_agent", { message: "review" }, o).kind, "crew");
});

test("says and skill installs are recognised", () => {
  assert.equal(h.isSayCommand("sh .boxbox/pitwall/say stage plan --why x"), true);
  assert.equal(h.isSayCommand("npm test"), false);
});

test("edited paths come from Edit, Write and apply_patch, relative and outside .boxbox", () => {
  const root = "/r";
  assert.deepEqual(h.editedPaths("Edit", { file_path: "/r/src/a.js" }, root), ["src/a.js"]);
  assert.deepEqual(h.editedPaths("Write", { file_path: "/r/.boxbox/state.md" }, root), []);
  assert.deepEqual(h.editedPaths("Write", { file_path: "/elsewhere/x.js" }, root), []);
  assert.deepEqual(h.editedPaths("apply_patch", { command: "*** Update File: src/a.js\n*** Add File: /r/src/c.js\n" }, root), ["src/a.js", "src/c.js"]);
  assert.deepEqual(h.editedPaths("Read", { file_path: "/r/src/a.js" }, root), []);
});

test("Claude Code test outcomes: PostToolUse is a pass, PostToolUseFailure a fail", () => {
  const pass = h.testOutcome("PostToolUse", { tool_response: { stdout: "Tests: 14 passed, 14 total", stderr: "" } }, "claude-code");
  assert.deepEqual(pass, { status: "pass", observed: true, passed: 14, failed: 0, exit: 0 });
  const passNoCounts = h.testOutcome("PostToolUse", { tool_response: { stdout: "ok", stderr: "" } }, "claude-code");
  assert.deepEqual(passNoCounts, { status: "pass", observed: true, exit: 0 });
  const fail = h.testOutcome("PostToolUseFailure", { error: "Exit code 1\nTests: 1 failed, 14 passed, 15 total" }, "claude-code");
  assert.deepEqual(fail, { status: "fail", observed: true, passed: 14, failed: 1, exit: 1 });
});

test("Codex test outcomes are observed only when a summary parses", () => {
  assert.deepEqual(h.testOutcome("PostToolUse", { tool_response: "  14 passing\n" }, "codex"), { status: "pass", observed: true, passed: 14, failed: 0 });
  assert.deepEqual(h.testOutcome("PostToolUse", { tool_response: { output: "Tests: 2 failed, 3 passed" } }, "codex"), { status: "fail", observed: true, passed: 3, failed: 2 });
  assert.deepEqual(h.testOutcome("PostToolUse", { tool_response: "done" }, "codex"), { status: "unknown", observed: false });
});

test("result lines never carry output, only sizes", () => {
  assert.equal(h.resultLine("Read", { tool_response: { file: { numLines: 84, content: "secret" } } }), "84 lines");
  assert.equal(h.resultLine("Edit", { tool_response: { structuredPatch: [{ lines: ["-a", "+b", "+c", " d"] }] } }), "+2 −1");
  assert.equal(h.resultLine("Bash", { tool_response: { stdout: "hello secret", stderr: "" } }), "ok");
});

test("detects the agent and the lane", () => {
  assert.equal(h.detectAgent({ turn_id: "t1" }), "codex");
  assert.equal(h.detectAgent({ transcript_path: "/Users/x/.codex/sessions/2026/10/13/rollout-a.jsonl" }), "codex");
  assert.equal(h.detectAgent({ transcript_path: "/Users/x/.claude/projects/p/s.jsonl" }), "claude-code");
  assert.equal(h.laneFor({}, ""), "driver");
  assert.equal(h.laneFor({ agent_id: "a1", agent_type: "general-purpose" }, "build"), "crew");
  assert.equal(h.laneFor({ agent_id: "a1", agent_type: "code-reviewer" }, "build"), "steward");
  assert.equal(h.laneFor({ agent_id: "a1", agent_type: "general-purpose" }, "inspect"), "steward");
});

test("reads the test command and pitwall setting from config.md", () => {
  const cfg = "# Boxbox config\nproject: x\ncommands:\n  test: npm test\n  lint: none\npitwall: start\n";
  assert.deepEqual(h.parseConfig(cfg), { testCommand: "npm test", pitwall: "start", models: "auto", parallel: false, modelsWarning: null });
  assert.deepEqual(h.parseConfig("commands:\n  test: none\n"), { testCommand: "", pitwall: "open", models: "auto", parallel: false, modelsWarning: null });
});

test("reads models and parallel from config.md through the routing rule", () => {
  const c = h.parseConfig("commands:\n  test: npm test\nmodels: save\nparallel: on\npitwall: open\n");
  assert.equal(c.models, "save");
  assert.equal(c.parallel, true);
  assert.match(h.parseConfig("models: cheapest\n").modelsWarning, /cheapest/);
});

test("pit wall commands are pre-approved only when the repo's script is the plugin's own copy", () => {
  const fs = require("fs"), os = require("os"), path = require("path");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bbapprove-"));
  const kit = fs.mkdtempSync(path.join(os.tmpdir(), "bbkit-"));
  fs.mkdirSync(path.join(root, ".boxbox", "pitwall"), { recursive: true });
  for (const f of ["say", "server.js"]) {
    fs.writeFileSync(path.join(kit, f), "trusted " + f);
    fs.writeFileSync(path.join(root, ".boxbox", "pitwall", f), "trusted " + f);
  }
  const ok = c => h.approvalFor(c, root, kit);

  // allowed: the plain forms only
  assert.equal(ok('sh .boxbox/pitwall/say stage build --unit E1.2 --why "a token older than 30 minutes is refused"'), true);
  assert.equal(ok("sh .boxbox/pitwall/say ask 'D3: how strict?' --kind decision"), true);
  assert.equal(ok(`sh ${root}/.boxbox/pitwall/say stage setup --why "x"`), true, "absolute path to this repo");
  assert.equal(ok("node .boxbox/pitwall/server.js --ensure"), true);
  assert.equal(ok("node .boxbox/pitwall/server.js --ensure --open"), true);
  assert.equal(ok("node .boxbox/pitwall/server.js --summary E2.3"), true);
  assert.equal(ok('sh .boxbox/pitwall/say escalated "builder failed twice" --unit E2.3'), true);

  // rejected: each operator, anywhere in the command, quoted or not
  const rejected = {
    "&&": "sh .boxbox/pitwall/say stage plan && rm -rf ~",
    "||": "sh .boxbox/pitwall/say stage plan || rm -rf ~",
    ";": "sh .boxbox/pitwall/say stage plan; rm -rf ~",
    "|": "sh .boxbox/pitwall/say stage plan | sh",
    "$( )": 'sh .boxbox/pitwall/say stage plan --why "$(whoami)"',
    "backticks": "sh .boxbox/pitwall/say stage plan --why `whoami`",
    "> redirect": "node .boxbox/pitwall/server.js --ensure > /tmp/x",
    "< redirect": "node .boxbox/pitwall/server.js --ensure < /tmp/x",
    "2>&1": "node .boxbox/pitwall/server.js --summary E1 2>&1",
    "newline": "sh .boxbox/pitwall/say stage plan\nrm -rf ~",
    "; inside quotes": 'sh .boxbox/pitwall/say stage plan --why "a; b"',
    "$VAR": "sh .boxbox/pitwall/say stage plan --why $HOME",
    "background &": "node .boxbox/pitwall/server.js --ensure &"
  };
  for (const [name, cmd] of Object.entries(rejected)) assert.equal(ok(cmd), false, name);

  // rejected: anything but the plain forms
  assert.equal(ok("sh .boxbox/pitwall/say"), false, "say needs stage or ask");
  assert.equal(ok("sh .boxbox/pitwall/say rm x"), false, "unknown verb");
  assert.equal(ok("node .boxbox/pitwall/server.js"), false, "bare server.js runs a server: not pre-approved");
  assert.equal(ok("node .boxbox/pitwall/server.js --box /etc --ensure"), false, "no other flags");
  assert.equal(ok("node .boxbox/pitwall/server.js --summary E1 --open"), false);
  assert.equal(ok("sh /elsewhere/.boxbox/pitwall/say stage x"), false, "another repo's script");
  assert.equal(ok("sh ../.boxbox/pitwall/say stage x"), false, "relative prefix");
  assert.equal(ok("env X=1 sh .boxbox/pitwall/say stage x"), false);

  // rejected: a script the repo changed
  fs.writeFileSync(path.join(root, ".boxbox", "pitwall", "say"), "changed by the repo");
  assert.equal(ok("sh .boxbox/pitwall/say stage build"), false, "a modified script is never pre-approved");
});

test("the page checker is pre-approved under the same rules, for Boxbox pages only", () => {
  const fs = require("fs"), os = require("os"), path = require("path");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bbcheck-"));
  const kit = fs.mkdtempSync(path.join(os.tmpdir(), "bbkit-"));
  fs.mkdirSync(path.join(root, ".boxbox", "pitwall"), { recursive: true });
  fs.writeFileSync(path.join(kit, "check-page.js"), "trusted checker");
  fs.writeFileSync(path.join(root, ".boxbox", "pitwall", "check-page.js"), "trusted checker");
  const ok = c => h.approvalFor(c, root, kit);

  assert.equal(ok("node .boxbox/pitwall/check-page.js .boxbox/password-reset/context.html"), true);
  assert.equal(ok("node .boxbox/pitwall/check-page.js .boxbox/password-reset/e1-request/report.html .boxbox/knowledge/reset-tokens.html"), true, "several pages");
  assert.equal(ok(`node ${root}/.boxbox/pitwall/check-page.js ${root}/.boxbox/plan.html`), true, "absolute paths in this repo");

  assert.equal(ok("node .boxbox/pitwall/check-page.js"), false, "needs a page");
  assert.equal(ok("node .boxbox/pitwall/check-page.js src/index.html"), false, "only pages under .boxbox/");
  assert.equal(ok("node .boxbox/pitwall/check-page.js .boxbox/../src/x.html"), false, "no climbing out");
  assert.equal(ok("node .boxbox/pitwall/check-page.js .boxbox/x.md"), false, "html pages only");
  assert.equal(ok("node .boxbox/pitwall/check-page.js --templates /tmp .boxbox/x.html"), false, "no flags");
  assert.equal(ok("node .boxbox/pitwall/check-page.js /elsewhere/.boxbox/x.html"), false, "another repo's page");
  assert.equal(ok("node .boxbox/pitwall/check-page.js .boxbox/x.html; rm -rf ~"), false);
  assert.equal(ok("node .boxbox/pitwall/check-page.js .boxbox/x.html > /tmp/out"), false);
  assert.equal(ok("node .boxbox/pitwall/check-page.js .boxbox/$(whoami).html"), false);

  fs.writeFileSync(path.join(root, ".boxbox", "pitwall", "check-page.js"), "changed by the repo");
  assert.equal(ok("node .boxbox/pitwall/check-page.js .boxbox/plan.html"), false, "a modified checker is never pre-approved");
});

test("stage is inferred from the Boxbox page being written when say was never called", () => {
  const fs = require("fs"), os = require("os"), path = require("path");
  const server = require("../../skills/boxbox-setup/kit/pitwall/server.js");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bbinfer-"));
  fs.mkdirSync(path.join(root, ".boxbox", "live"), { recursive: true });
  const live = path.join(root, ".boxbox", "live");
  const write = (rel, event = "PostToolUse") => h.main(event, JSON.stringify({
    session_id: "s1", transcript_path: "/x/.claude/p.jsonl", tool_name: "Write",
    tool_input: { file_path: path.join(root, rel), content: "x" }, tool_use_id: "t" + rel, tool_response: {}
  }), root);
  const events = () => fs.readFileSync(path.join(live, "events.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  const stage = () => JSON.parse(fs.readFileSync(path.join(live, "stage.json"), "utf8"));

  write(".boxbox/password-reset/plan.md");
  assert.equal(stage().stage, "plan");
  assert.equal(stage().inferred, true);
  const ev = events().filter(e => e.type === "stage");
  assert.equal(ev.length, 1);
  assert.equal(ev[0].target, "plan");
  assert.equal(ev[0].inferred, true);
  assert.equal(server.currentStage(stage(), events()).stage, "plan", "the pit wall shows the plan stage");

  // a report for a unit carries the unit from its folder
  write(".boxbox/password-reset/e2-set-password/report.html");
  assert.deepEqual([stage().stage, stage().unit], ["report", "E2"]);
  write(".boxbox/password-reset/e1-2-expiry/design.md");
  assert.deepEqual([stage().stage, stage().unit], ["design", "E1.2"], "task-level unit folder");
});

test("a second page written in the same millisecond still moves the stage", () => {
  const t = 1760000000000;
  const cur = { stage: "report", unit: "E2", ts: new Date(t).toISOString() };
  assert.deepEqual(h.inferStage(".boxbox/password-reset/e1-2-expiry/design.md", cur, t, 0), { stage: "design", unit: "E1.2" }, "another unit, same ms");
  assert.deepEqual(h.inferStage(".boxbox/password-reset/e2-set-password/report.html", { stage: "build", unit: "E2", ts: cur.ts }, t, 0), { stage: "report", unit: "E2" }, "forward in the same unit, same ms");
  assert.equal(h.inferStage(".boxbox/password-reset/plan.md", { stage: "build", unit: "E2", ts: cur.ts }, t, 0), null, "still never backwards");
  assert.equal(h.inferStage(".boxbox/password-reset/e3-x/design.md", { stage: "build", unit: "E2", ts: new Date(t + 5).toISOString() }, t, 0), null, "a stage written after this write still wins");
});

test("an inferred stage never moves the flow backwards within the same unit", () => {
  const fs = require("fs"), os = require("os"), path = require("path");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bbinfer2-"));
  const live = path.join(root, ".boxbox", "live");
  fs.mkdirSync(live, { recursive: true });
  fs.writeFileSync(path.join(live, "stage.json"), JSON.stringify({ stage: "build", unit: "E1.1", why: "", ts: new Date(Date.now() - 1000).toISOString() }));
  h.main("PostToolUse", JSON.stringify({ session_id: "s1", tool_name: "Edit", tool_input: { file_path: path.join(root, ".boxbox/f/plan.md") }, tool_use_id: "a", tool_response: {} }), root);
  assert.equal(JSON.parse(fs.readFileSync(path.join(live, "stage.json"), "utf8")).stage, "build", "ticking a task in plan.md mid-build is not the plan stage");
  h.main("PostToolUse", JSON.stringify({ session_id: "s1", tool_name: "Write", tool_input: { file_path: path.join(root, ".boxbox/f/e1-x/report.md"), content: "x" }, tool_use_id: "b", tool_response: {} }), root);
  assert.equal(JSON.parse(fs.readFileSync(path.join(live, "stage.json"), "utf8")).stage, "report", "forward is fine");
});

test("say escalated writes an escalated event with unit and reason", () => {
  const fs = require("fs"), os = require("os"), path = require("path"), { spawnSync } = require("child_process");
  const box = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bbsay-")), ".boxbox");
  fs.mkdirSync(path.join(box, "pitwall"), { recursive: true });
  fs.copyFileSync(path.join(__dirname, "../../skills/boxbox-setup/kit/pitwall/say"), path.join(box, "pitwall", "say"));
  const r = spawnSync("sh", [path.join(box, "pitwall", "say"), "escalated", 'diff 4x the "M" estimate', "--unit", "E2.3"], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  const ev = JSON.parse(fs.readFileSync(path.join(box, "live", "events.jsonl"), "utf8").trim().split("\n").pop());
  assert.equal(ev.type, "escalated");
  assert.equal(ev.kind, "escalated");
  assert.equal(ev.unit, "E2.3");
  assert.equal(ev.target, 'diff 4x the "M" estimate');
  assert.equal(ev.lane, "driver");
  assert.ok(!fs.existsSync(path.join(box, "live", "stage.json")), "an escalation does not move the stage");
});

test("an unknown models: value is reported at session start, as an event and to the agent", () => {
  const fs = require("fs"), os = require("os"), path = require("path"), { spawnSync } = require("child_process");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bbwarn-"));
  fs.mkdirSync(path.join(root, ".boxbox"), { recursive: true });
  fs.writeFileSync(path.join(root, ".boxbox", "config.md"), "commands:\n  test: npm test\nmodels: cheapest\npitwall: off\n");
  const payload = JSON.stringify({ session_id: "s1", transcript_path: "/x/s1.jsonl", hook_event_name: "SessionStart", source: "startup" });
  const r = spawnSync("node", [path.join(__dirname, "../../hooks/boxbox-event.js"), "SessionStart"], { input: payload, encoding: "utf8", env: { ...process.env, BOXBOX_ROOT: root } });
  const out = JSON.parse(r.stdout.trim());
  assert.match(out.hookSpecificOutput.additionalContext, /models: "cheapest".*balanced/);
  const ev = fs.readFileSync(path.join(root, ".boxbox", "live", "events.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  const w = ev.find(e => e.kind === "warning");
  assert.ok(w, "a warning event is written");
  assert.match(w.target, /cheapest/);
  fs.rmSync(root, { recursive: true, force: true });
});
