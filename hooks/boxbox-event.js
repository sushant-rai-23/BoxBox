#!/usr/bin/env node
// Boxbox live hook. Called by hooks/boxbox-event (bash) only when the repo has .boxbox/.
// Turns one hook payload into one line in .boxbox/live/events.jsonl and keeps
// sessions.jsonl and waiting.json current. It never writes file contents, prompt
// text or command output: only targets, one-line results and counts.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const routing = require("./routing.js");

const MAX_EVENTS_BYTES = 5 * 1024 * 1024;
// The plugin's own pit wall files. Hooks only ever run these, never the repo's copies.
const KIT = path.join(__dirname, "..", "skills", "boxbox-setup", "kit", "pitwall");
const EDIT_TOOLS = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit", "apply_patch"]);

function maskSecrets(s) {
  return String(s)
    .replace(/(\/\/)[^\/\s:@]+:[^\/\s@]+@/g, "$1***@")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/=-]+/gi, "$1***")
    .replace(/\b([A-Za-z0-9_]*(?:key|token|secret|password|passwd|pwd|auth|credentials?)[A-Za-z0-9_]*)=(\S+)/gi, "$1=***")
    .replace(/\b(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_\w{20,}|xox[abprs]-[\w-]{10,}|AKIA[0-9A-Z]{16})\b/g, "***");
}

function lastMatch(text, re) {
  let m, last = null;
  re.lastIndex = 0;
  while ((m = re.exec(text))) last = m;
  return last ? Number(last[1]) : null;
}

// Counts from a test runner's summary line, or null when none is found. Never guesses.
function parseTestSummary(text) {
  text = String(text || "");
  const passed = lastMatch(text, /(\d+)\s+(?:passed|passing)\b/gi) ?? lastMatch(text, /^[#ℹ]\s*pass\s+(\d+)/gim);
  const failed = lastMatch(text, /(\d+)\s+(?:failed|failing|failures?)\b/gi) ?? lastMatch(text, /^[#ℹ]\s*fail\s+(\d+)/gim);
  if (passed === null && failed === null) return null;
  return { passed: passed ?? 0, failed: failed ?? 0 };
}

function patchPaths(patch) {
  const out = [];
  const re = /^\*\*\* (?:(?:Update|Add|Delete) File|Move to): (.+?)\s*$/gm;
  let m;
  while ((m = re.exec(String(patch || "")))) out.push(m[1]);
  return out;
}

function rel(p, root) {
  if (!p) return "";
  p = String(p);
  if (path.isAbsolute(p)) {
    const r = path.relative(root, p);
    return r.startsWith("..") ? p : r;
  }
  return path.normalize(p);
}

function short(s, n = 160) {
  s = String(s || "").replace(/\s*\n\s*/g, " ⏎ ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function isSayCommand(cmd) {
  return /\.boxbox\/pitwall\/say(\s|$)/.test(String(cmd || ""));
}

function shellKind(cmd, testCommand) {
  const norm = s => s.replace(/\s+/g, " ").trim();
  const c = norm(cmd);
  if (testCommand && c.includes(norm(testCommand))) return "test";
  if (/\bgit\s+commit\b/.test(c)) return "commit";
  const first = c.replace(/^(cd\s+\S+\s*(&&|;)\s*)+/, "");
  if (/^(rg|grep|ag|fd|find|ls|git\s+grep|git\s+ls-files)\b/.test(first)) return "search";
  if (/^(cat|sed\s+-n|head|tail|nl|less|bat|wc)\b/.test(first)) return "read";
  return "run";
}

function patchText(input) {
  return (input && (input.command || input.patch || input.input)) || "";
}

function classify(tool, input, opts) {
  input = input || {};
  const root = opts.root;
  if (tool === "Bash" || tool === "shell" || tool === "exec_command") {
    const cmd = maskSecrets(input.command || input.cmd || "");
    return { kind: shellKind(cmd, opts.testCommand), target: short(cmd, 120) };
  }
  if (EDIT_TOOLS.has(tool)) {
    const p = tool === "apply_patch" ? patchPaths(patchText(input))[0] || "patch" : rel(input.file_path || input.notebook_path, root);
    if (/(^|\/)skills\/[^/]+\/SKILL\.md$/.test(p)) return { kind: "skill", target: p };
    return { kind: p.startsWith(".boxbox/") ? "page" : "edit", target: p };
  }
  switch (tool) {
    case "Read": case "NotebookRead": case "view_image":
      return { kind: "read", target: rel(input.file_path || input.notebook_path || input.path, root) };
    case "Grep": case "Glob": case "LS":
      return { kind: "search", target: short(input.pattern || input.path || "", 120) };
    case "WebFetch":
      return { kind: "web", target: short(input.url || "", 120) };
    case "WebSearch": case "web_search":
      return { kind: "web", target: short(input.query || "", 120) };
    case "Skill":
      return { kind: "skill", target: input.skill || input.name || "skill" };
    case "Agent": case "Task": case "spawn_agent":
      return { kind: "crew", target: short(input.description || input.subagent_type || input.message || "subagent", 80) };
    case "TodoWrite": case "update_plan":
      return { kind: "think", target: "updating the to-do list" };
    case "EnterPlanMode": case "ExitPlanMode":
      return { kind: "think", target: "planning" };
    case "AskUserQuestion": case "request_user_input": {
      const q = input.questions && input.questions[0] && input.questions[0].question;
      return { kind: "wait", target: short(q || "a question for you", 120) };
    }
  }
  if (/^mcp__/.test(tool)) {
    const [, server, name] = tool.split("__");
    return { kind: /fetch|search|brows|web|navigate/i.test(tool) ? "web" : "run", target: `${server}: ${name || ""}` };
  }
  return { kind: "run", target: tool };
}

function editedPaths(tool, input, root) {
  if (!EDIT_TOOLS.has(tool)) return [];
  const raw = tool === "apply_patch" ? patchPaths(patchText(input)) : [input.file_path || input.notebook_path];
  const out = [];
  for (const p of raw) {
    if (!p) continue;
    const r = rel(p, root);
    if (path.isAbsolute(r) || r.startsWith(".boxbox/") || r === ".boxbox") continue;
    if (!out.includes(r)) out.push(r);
  }
  return out;
}

function responseText(r) {
  if (r == null) return "";
  if (typeof r === "string") return r;
  const parts = [r.stdout, r.stderr, r.output, r.aggregated_output, r.formatted_output].filter(x => typeof x === "string");
  return parts.length ? parts.join("\n") : JSON.stringify(r);
}

function codexExit(r) {
  if (!r || typeof r !== "object") return null;
  const v = r.exit_code ?? r.exitCode ?? (r.metadata && r.metadata.exit_code);
  return typeof v === "number" ? v : null;
}

// Claude Code: a Bash call that exits 0 fires PostToolUse, a non-zero exit fires
// PostToolUseFailure, so the event itself is the observed result.
// Codex: observed only when the runner's summary can be parsed.
function testOutcome(event, payload, agent) {
  if (agent === "codex") {
    const r = payload.tool_response;
    const sum = parseTestSummary(responseText(r));
    if (!sum) return { status: "unknown", observed: false };
    const out = { status: sum.failed > 0 ? "fail" : "pass", observed: true, ...sum };
    const exit = codexExit(r);
    if (exit !== null) out.exit = exit;
    return out;
  }
  if (event === "PostToolUseFailure") {
    const err = String(payload.error || "");
    const m = err.match(/Exit code (\d+)/);
    const sum = parseTestSummary(err);
    return { status: "fail", observed: true, ...(sum || {}), ...(m ? { exit: Number(m[1]) } : {}) };
  }
  const sum = parseTestSummary(responseText(payload.tool_response));
  return { status: "pass", observed: true, ...(sum || {}), exit: 0 };
}

function resultLine(tool, payload) {
  const r = payload.tool_response || {};
  const input = payload.tool_input || {};
  if (tool === "Read" && r.file) return `${r.file.numLines} lines`;
  if ((tool === "Edit" || tool === "MultiEdit") && Array.isArray(r.structuredPatch)) {
    let add = 0, del = 0;
    for (const hunk of r.structuredPatch) for (const l of hunk.lines || []) { if (l[0] === "+") add++; else if (l[0] === "-") del++; }
    return `+${add} −${del}`;
  }
  if (tool === "Write" && typeof input.content === "string") return `+${input.content.split("\n").length}`;
  if (tool === "apply_patch") {
    const t = patchText(input);
    const add = (t.match(/^\+(?!\+\+)/gm) || []).length, del = (t.match(/^-(?!--)/gm) || []).length;
    return `+${add} −${del}`;
  }
  if (tool === "Grep" && typeof r.numLines === "number") return `${r.numLines} matches`;
  if ((tool === "Grep" || tool === "Glob") && typeof r.numFiles === "number") return `${r.numFiles} files`;
  if (tool === "Agent" || tool === "Task") return "finished";
  if (tool === "Bash") return "ok";
  return "";
}

function detectAgent(p) {
  if (p.turn_id !== undefined) return "codex";
  if (/[\/\\]\.codex[\/\\]/.test(p.transcript_path || "")) return "codex";
  return "claude-code";
}

function laneFor(p, stage) {
  if (!p.agent_id) return "driver";
  const own = routing.agentOf(p.agent_type);
  if (own) return own;   // builder, scout, runner, writer: each Boxbox agent has its own lane
  if (/review|inspect|steward/i.test(p.agent_type || "") || stage === "inspect") return "steward";
  return "crew";
}

// The Boxbox flow, in order. Used to keep an inferred stage from moving the flow backwards.
const FLOW = ["setup", "learn-repo", "install-skills", "discover", "knowledge", "decisions", "plan", "plan-review",
  "design", "design-review", "build", "verify", "inspect", "report", "unit-review", "approved", "merged"];
const PAGE_STAGE = [
  [/^\.boxbox\/[^/]+\/context\.(?:md|html)$/, "discover"],
  [/^\.boxbox\/[^/]+\/decisions\.html$/, "decisions"],
  [/^\.boxbox\/[^/]+\/plan\.(?:md|html)$/, "plan"],
  [/^\.boxbox\/[^/]+\/(e\d+(?:-\d+)?)-[^/]*\/design\.(?:md|html)$/, "design"],
  [/^\.boxbox\/[^/]+\/(e\d+(?:-\d+)?)-[^/]*\/report\.(?:md|html)$/, "report"]
];

// A fallback for skills that did not call say: the page being written says where the flow is.
// Returns {stage, unit} or null. It changes the stage only when the write is newer than the last
// stage and moves the flow forward, starts another unit, or the last stage is from an earlier session.
function inferStage(rel, cur, now, sessionStart) {
  let found = null;
  for (const [re, stage] of PAGE_STAGE) {
    const m = rel.match(re);
    if (m) { found = { stage, unit: m[1] ? m[1].replace(/^e(\d+)(?:-(\d+))?$/, (_, e, t) => "E" + e + (t ? "." + t : "")) : "" }; break; }
  }
  if (!found) return null;
  if (!cur || !cur.stage) return found;
  const curTs = Date.parse(cur.ts) || 0;
  if (curTs > now) return null; // a stage stamped after this write wins; the same millisecond does not
  if (sessionStart && curTs < sessionStart) return found;
  const epic = u => String(u || "").split(".")[0];
  if (found.unit && epic(found.unit) !== epic(cur.unit)) return found;
  return FLOW.indexOf(found.stage) > FLOW.indexOf(cur.stage) ? found : null;
}

function parseConfig(text) {
  const t = String(text || "");
  const tm = t.match(/^\s+test:\s*(.+?)\s*$/m);
  const pm = t.match(/^pitwall:\s*(\w+)/m);
  const testCommand = tm && !/^(none|n\/a|-)$/i.test(tm[1]) ? tm[1].replace(/^`|`$/g, "") : "";
  const r = routing.parseModels(t);
  return { testCommand, pitwall: pm ? pm[1] : "open", models: r.mode, parallel: r.parallel, modelsWarning: r.warning };
}

function parseState(text) {
  const out = {};
  for (const line of String(text || "").split("\n")) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

// May this command skip the permission prompt? Three conditions, all required:
//  1. No shell operator anywhere, even inside quotes: ; & | < > ` $ \ or a line break.
//  2. The whole command is one of the plain forms below, with no other words:
//       sh|bash [<repo>/].boxbox/pitwall/say stage|ask|escalated <words or quoted text>
//       node [<repo>/].boxbox/pitwall/server.js --ensure [--open]
//       node [<repo>/].boxbox/pitwall/server.js --summary <unit id>
//       node [<repo>/].boxbox/pitwall/check-page.js [<repo>/].boxbox/<path>.html ...
//     where <repo>/ is empty or this repo's own absolute path, and a page path never contains "..".
//  3. The repo's script is byte-for-byte the plugin's own copy. A script the repo changed always asks.
const SAY_FORM = /^(?:sh|bash) (\/\S+\/|)\.boxbox\/pitwall\/say (?:stage|ask|escalated)(?: (?:[^\s"']+|"[^"]*"|'[^']*'))+$/;
const SERVER_FORM = /^node (\/\S+\/|)\.boxbox\/pitwall\/server\.js (?:--ensure(?: --open)?|--summary [A-Za-z0-9.]+)$/;
const CHECK_FORM = /^node (\/\S+\/|)\.boxbox\/pitwall\/check-page\.js((?: (?:\/\S+\/|)\.boxbox\/[\w./-]+\.html)+)$/;
function approvalFor(cmd, root, kitDir) {
  cmd = String(cmd || "").trim().replace(/[ \t]+/g, " ");
  if (/[;&|<>`$\\\r\n]/.test(cmd)) return false;
  let m = cmd.match(SAY_FORM), file = "say";
  if (!m) { m = cmd.match(SERVER_FORM); file = "server.js"; }
  if (!m) { m = cmd.match(CHECK_FORM); file = "check-page.js"; }
  if (!m) return false;
  if (m[1] && path.resolve(m[1]) !== path.resolve(root)) return false;
  if (file === "check-page.js") {
    for (const page of m[2].trim().split(" ")) {
      if (page.split("/").includes("..")) return false;
      const prefix = page.slice(0, page.indexOf(".boxbox/"));
      if (prefix && path.resolve(prefix) !== path.resolve(root)) return false;
    }
  }
  try {
    return fs.readFileSync(path.join(root, ".boxbox", "pitwall", file)).equals(fs.readFileSync(path.join(kitDir, file)));
  } catch { return false; }
}

/* ---------------- side effects ---------------- */

function readText(f) { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } }
function readJSON(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } }

function append(live, file, obj) {
  const f = path.join(live, file);
  if (file === "events.jsonl") {
    try { if (fs.statSync(f).size > MAX_EVENTS_BYTES) fs.renameSync(f, path.join(live, "events.1.jsonl")); } catch {}
  }
  fs.appendFileSync(f, JSON.stringify(obj) + "\n");
}

function writeJSON(live, file, obj) {
  const f = path.join(live, file), tmp = f + "." + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, f);
}

// Starts the plugin's copy of the server for this repo. Never runs code from the repo itself.
function ensureServer(root, open) {
  const server = path.join(KIT, "server.js");
  if (!fs.existsSync(server)) return { error: "The plugin's pit wall files are missing; reinstall Boxbox." };
  const r = spawnSync(process.execPath, [server, "--box", path.join(root, ".boxbox"), "--ensure", ...(open ? ["--open"] : [])], { cwd: root, encoding: "utf8", timeout: 8000 });
  const url = (r.stdout || "").trim().split("\n").pop();
  return /^http:\/\//.test(url) ? { url } : { error: "The pit wall did not start: " + short(r.stderr || "no output", 200) };
}

// The events whose line contains `needle` (a string or a RegExp), parsed, in file order, including
// the rotated file (events.1.jsonl) so escalation state survives a rotation. Lines that cannot
// match are never parsed: about 50 ms for a full 5 MB log.
function readEvents(live, needle) {
  const out = [];
  const hit = typeof needle === "string" ? l => l.indexOf(needle) >= 0 : l => needle.test(l);
  for (const f of ["events.1.jsonl", "events.jsonl"])
    for (const l of readText(path.join(live, f)).split("\n")) if (hit(l)) { try { out.push(JSON.parse(l)); } catch {} }
  return out;
}

// The task a subagent works on: Claude Code's agent-<id>.meta.json names the Agent call (toolUseId),
// and the gate logged that call with its task (decision A4).
function subagentTask(p, live) {
  if (!p.agent_id || !p.transcript_path || !p.session_id) return "";
  const meta = readJSON(path.join(path.dirname(p.transcript_path), p.session_id, "subagents", `agent-${p.agent_id}.meta.json`));
  if (!meta || !meta.toolUseId) return "";
  const g = readEvents(live, meta.toolUseId).find(e => e.kind === "gate" && e.id === meta.toolUseId);
  return (g && g.unit) || "";
}

// Early escalation, seen from a builder's own edits: a file outside its brief, or the 5th edit of
// one file with no passing test run since. Logs one "escalate-needed" per task; the gate enforces it.
function checkTriggers(p, live, box, edits, base) {
  if (!edits.length || !/boxbox-builder$/.test(p.agent_type || "")) return;
  const start = readEvents(live, `"sub":"${p.agent_id}"`).find(e => e.kind === "crew" && e.result === "started");
  const task = start && start.unit;
  if (!task || !/^E\d+\.\d+$/.test(task)) return;
  if (readEvents(live, "escalate-needed").some(e => e.kind === "escalate-needed" && e.unit === task)) return;
  const st = parseState(readText(path.join(box, "state.md")));
  let brief = null;
  try { for (const d of fs.readdirSync(path.join(box, st.feature || "-"))) { const f = path.join(box, st.feature, d, "tasks", task + ".md"); if (fs.existsSync(f)) { brief = routing.parseBrief(readText(f)); break; } } } catch {}
  let why = "";
  const outside = brief && brief.files.length ? edits.find(f => !brief.files.includes(f)) : null;
  if (outside) why = `edited ${outside}, outside its brief`;
  else {
    // Test-first work edits test files often and runs single tests: only edits to code files count,
    // only edits that succeeded, and any test command that exited 0 counts as green.
    const isTest = f => /(^|\/)(tests?|__tests__|spec)\/|[._-](test|spec)\.\w+$|(^|\/)test_[^/]+$/.test(f);
    const green = e => e.type === "action" && !e.failed && (e.kind === "test" || (e.tool === "Bash" && /\btest|spec\b/i.test(e.target || "")));
    const mine = readEvents(live, `"sub":"${p.agent_id}"`);
    let lastPass = -1;
    mine.forEach((e, i) => { if (green(e)) lastPass = i; });
    for (const f of edits.filter(f => !isTest(f))) {
      const n = 1 + mine.slice(lastPass + 1).filter(e => e.type === "action" && !e.failed && (e.edits || []).includes(f)).length;
      if (n >= 5) { why = `edited ${f} 5 times without the tests going green`; break; }
    }
  }
  if (why) append(live, "events.jsonl", { ...base, unit: task, type: "escalate-needed", kind: "escalate-needed", target: why, why: "", result: "" });
}

// The main session's model family. Claude Code's hook input never says it, and the transcript can lag
// (in a session's first turn its messages are not on disk yet), so: the transcript, then the model
// recorded at the end of this session's last turn. Settings and ANTHROPIC_MODEL are not used: the
// hook cannot see --model, /model or managed settings, so they can name the wrong model. Null when
// unknown: the gate then fails open (decision D4).
function sessionModel(p, live) {
  const fromTranscript = sessionFamily(p.transcript_path);
  if (fromTranscript) return fromTranscript;
  const cached = readJSON(path.join(live, "session-model.json"));
  return cached && cached.session && cached.session === p.session_id && cached.family ? cached.family : null;
}

// The last assistant message.model in a transcript's final 256 KB, as a family.
function sessionFamily(transcript) {
  let fd;
  try {
    fd = fs.openSync(transcript, "r");
    const size = fs.fstatSync(fd).size, n = Math.min(size, 256 * 1024), buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, size - n);
    // Parse whole lines: a tool_use input can carry its own "model" (the Agent call being judged).
    const lines = buf.toString("utf8").split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].indexOf('"assistant"') < 0) continue;
      let d; try { d = JSON.parse(lines[i]); } catch { continue; }
      const f = d && d.type === "assistant" && d.message && routing.familyOf(d.message.model);
      if (f) return f;
    }
  } catch {} finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
  return null;
}

// The routing gate for one Claude Code Agent (or Task) call. Prints a deny when the call breaks the
// routing rules and logs a "gate" event; prints nothing on allow, so the developer's permission
// prompts still apply. Any error allows the call and logs "gate-error" (decision D4).
function runGate(p, box, live, cfg, base) {
  const input = p.tool_input || {};
  let d;
  try {
    const st = parseState(readText(path.join(box, "state.md")));
    const plan = st.feature ? readText(path.join(box, st.feature, "plan.md")) : "";
    const env = process.env, forced = env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE && !/^(0|false)$/i.test(env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE);
    const force = forced ? (env.CLAUDE_CODE_SUBAGENT_MODEL && env.CLAUDE_CODE_SUBAGENT_MODEL !== "inherit" ? env.CLAUDE_CODE_SUBAGENT_MODEL : "inherit") : "";
    const history = routing.builderHistory(readEvents(live, /"kind":"(crew|stage|escalated|escalate-needed)"/));
    const root = path.dirname(box);
    const parallel = input.isolation === "worktree"
      ? routing.parallelReady({ parallel: cfg.parallel, settings: ["settings.local.json", "settings.json"].map(f => readText(path.join(root, ".claude", f))) })
      : null;
    d = routing.gateDecision({ input, mode: cfg.models, force, tasks: routing.parsePlanTasks(plan), history, parallel, session: sessionModel(p, live) });
  } catch (err) {
    append(live, "events.jsonl", { ...base, type: "gate-error", kind: "gate-error", target: short(String(err && err.message), 200), why: "", result: "allowed" });
    return;
  }
  if (d.decision === "skip") return;
  append(live, "events.jsonl", { ...base, unit: d.task || base.unit, type: "gate", kind: "gate", id: p.tool_use_id || "", target: input.subagent_type || "",
    result: d.decision, why: d.reason, model: short(input.model || "", 60), expected: d.expected || "",
    ...(process.env.CLAUDE_CODE_SUBAGENT_MODEL && d.decision !== "off" ? { note: `CLAUDE_CODE_SUBAGENT_MODEL=${process.env.CLAUDE_CODE_SUBAGENT_MODEL} is set (a default only; the model Boxbox passes wins)` } : {}) });
  if (d.decision === "deny") process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "Boxbox routing: " + d.reason } }) + "\n");
}

function emitContext(text) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } }) + "\n");
}

function main(event, raw, root) {
  const p = JSON.parse(raw || "{}");
  const box = path.join(root, ".boxbox");
  const live = path.join(box, "live");
  fs.mkdirSync(live, { recursive: true });
  const cfg = parseConfig(readText(path.join(box, "config.md")));
  const stage = readJSON(path.join(live, "stage.json")) || {};
  const agent = detectAgent(p);
  const base = { ts: new Date().toISOString(), session: p.session_id || "", agent, lane: laneFor(p, stage.stage), unit: stage.unit || "", ...(p.agent_id ? { sub: p.agent_id } : {}) };
  const tool = p.tool_name || "";

  // A session that started before .boxbox existed never had its SessionStart logged: register its
  // transcript on its first event, so its tokens are counted (decision A20).
  if (event !== "SessionStart" && agent === "claude-code" && !p.agent_id && p.session_id && p.transcript_path &&
      readText(path.join(live, "sessions.jsonl")).indexOf(`"transcript":${JSON.stringify(p.transcript_path)}`) < 0) {
    append(live, "sessions.jsonl", { session: p.session_id, agent, transcript: p.transcript_path, started: base.ts, late: true });
  }

  switch (event) {
    case "SessionStart": {
      if (p.source === "startup" || p.source === "resume" || p.source === undefined) fs.writeFileSync(path.join(live, "session-start"), base.ts);
      append(live, "sessions.jsonl", { session: p.session_id || "", agent, transcript: p.transcript_path || "", started: base.ts });
      append(live, "events.jsonl", { ...base, type: "session", kind: "session", target: `${agent === "codex" ? "Codex" : "Claude Code"} session ${p.source || "started"}`, why: "", result: "" });
      // A models: value Boxbox does not know runs as balanced; say so where the developer and the agent will see it.
      const warn = agent === "claude-code" && cfg.modelsWarning ? `Boxbox config: ${cfg.modelsWarning}. Tell the developer once.` : "";
      if (warn) append(live, "events.jsonl", { ...base, type: "warning", kind: "warning", target: cfg.modelsWarning, why: "", result: "" });
      if (cfg.pitwall === "off") { if (warn) emitContext(warn); return; }
      const s = ensureServer(root, cfg.pitwall === "open" && (p.source === "startup" || p.source === undefined));
      emitContext((s.url
        ? `Boxbox pit wall (live view of this session for the developer): ${s.url}`
        : `Boxbox pit wall: ${s.error} Use .boxbox/board.html instead.`) + (warn ? ` ${warn}` : ""));
      return;
    }
    case "UserPromptSubmit":
      try { fs.unlinkSync(path.join(live, "waiting.json")); } catch {}
      append(live, "events.jsonl", { ...base, type: "prompt", kind: "prompt", target: "You replied in chat", why: "", result: "" });
      return;
    case "PreToolUse": {
      if ((tool === "Agent" || tool === "Task") && agent === "claude-code") runGate(p, box, live, cfg, base);
      if (tool === "Bash" && agent === "claude-code" && approvalFor(p.tool_input && p.tool_input.command, root, KIT)) {
        process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "Boxbox pit wall command" } }) + "\n");
      }
      if (isSayCommand(p.tool_input && p.tool_input.command)) return;
      const c = classify(tool, p.tool_input, { root, testCommand: cfg.testCommand });
      append(live, "events.jsonl", { ...base, type: "start", id: p.tool_use_id || "", tool, ...c, why: stage.why || "", result: "" });
      return;
    }
    case "PostToolUse":
    case "PostToolUseFailure": {
      if (isSayCommand(p.tool_input && p.tool_input.command)) return;
      // An answer given in the question tool fires no UserPromptSubmit: clear the waiting card here.
      if (event === "PostToolUse" && tool === "AskUserQuestion") { try { fs.unlinkSync(path.join(live, "waiting.json")); } catch {} }
      const c = classify(tool, p.tool_input, { root, testCommand: cfg.testCommand });
      const e = { ...base, type: "action", id: p.tool_use_id || "", tool, ...c, why: stage.why || "", result: resultLine(tool, p) };
      if (event === "PostToolUseFailure") {
        e.failed = true;
        const m = String(p.error || "").match(/Exit code (\d+)/);
        e.result = m ? `exit ${m[1]}` : (p.is_interrupt ? "interrupted" : "failed");
      }
      const edits = editedPaths(tool, p.tool_input || {}, root);
      if (edits.length) e.edits = edits;
      if (event === "PostToolUse" && edits.length && p.agent_id && agent === "claude-code") checkTriggers(p, live, box, edits, base);
      if (event === "PostToolUse" && (c.kind === "page" || c.kind === "edit")) {
        const inf = inferStage(c.target, readJSON(path.join(live, "stage.json")), Date.now(), Date.parse(readText(path.join(live, "session-start"))) || 0);
        if (inf) {
          const why = "inferred from " + c.target;
          writeJSON(live, "stage.json", { stage: inf.stage, unit: inf.unit, why, ts: base.ts, inferred: true });
          append(live, "events.jsonl", { ...base, unit: inf.unit, type: "stage", kind: "stage", target: inf.stage, why, result: "", inferred: true });
        }
      }
      if (c.kind === "test") {
        e.test = testOutcome(event, p, agent);
        const t = e.test;
        if (t.observed) e.result = t.passed !== undefined ? (t.failed ? `${t.failed} failing` : `${t.passed} passed`) : (t.status === "pass" ? "passed" : e.result);
        else e.result = "no summary";
      }
      append(live, "events.jsonl", e);
      return;
    }
    case "Notification":
    case "PermissionRequest": {
      const type = p.notification_type || (event === "PermissionRequest" ? "permission_prompt" : "");
      if (!/permission_prompt|agent_needs_input|elicitation_dialog|idle_prompt/.test(type)) return;
      const permission = type !== "idle_prompt";
      const detail = event === "PermissionRequest"
        ? `${tool}: ${classify(tool, p.tool_input, { root, testCommand: cfg.testCommand }).target}`
        : short(p.message || "", 160);
      const w = permission
        ? { kind: "permission", what: "Approve a permission in chat", detail, ts: base.ts }
        : { kind: "idle", what: "The agent is waiting for you", detail, ts: base.ts };
      writeJSON(live, "waiting.json", w);
      append(live, "events.jsonl", { ...base, type: "wait", kind: "wait", target: w.what, why: detail, result: "" });
      return;
    }
    case "Stop": {
      // By the end of a turn the transcript is on disk: remember the model for the next turn's gate.
      const fam = agent === "claude-code" ? sessionFamily(p.transcript_path) : null;
      if (fam && p.session_id) writeJSON(live, "session-model.json", { session: p.session_id, family: fam });
      const st = parseState(readText(path.join(box, "state.md")));
      if (!/^yes/i.test(st.waiting_for_developer || "")) return;
      if (!fs.existsSync(path.join(live, "waiting.json"))) {
        writeJSON(live, "waiting.json", { kind: "stop", what: st.next || "Your move", detail: st.unit && st.unit !== "none" ? `Unit ${st.unit}` : "", ts: base.ts });
      }
      append(live, "events.jsonl", { ...base, type: "wait", kind: "wait", target: "Waiting for you", why: st.next || "", result: "" });
      return;
    }
    case "SubagentStart":
    case "SubagentStop": {
      const lane = laneFor({ agent_id: p.agent_id || "sub", agent_type: p.agent_type }, stage.stage);
      const task = subagentTask(p, live);
      append(live, "events.jsonl", { ...base, ...(task ? { unit: task } : {}), lane, type: "crew", kind: "crew", target: p.agent_type || "subagent", why: stage.why || "", result: event === "SubagentStart" ? "started" : "finished", sub: p.agent_id || "" });
      // Register the subagent's transcript as soon as it starts, so its tokens count while it runs.
      // SubagentStart gives no path; Claude Code keeps it at <session>/subagents/agent-<id>.jsonl
      // beside the parent's transcript (docs/routing-spike.md, section 5). Stop gives the real path;
      // the server keeps one entry per path, so registering both is safe.
      const subTranscript = event === "SubagentStop" && p.agent_transcript_path ? p.agent_transcript_path
        : (p.transcript_path && p.session_id && p.agent_id ? path.join(path.dirname(p.transcript_path), p.session_id, "subagents", `agent-${p.agent_id}.jsonl`) : "");
      if (subTranscript) append(live, "sessions.jsonl", { session: p.session_id || "", agent, transcript: subTranscript, sub: p.agent_id || "", started: base.ts });
      return;
    }
    case "SessionEnd":
      append(live, "events.jsonl", { ...base, type: "session-end", kind: "session", target: "Session ended", why: "", result: "" });
      return;
  }
}

module.exports = { inferStage, approvalFor, maskSecrets, parseTestSummary, patchPaths, classify, editedPaths, testOutcome, resultLine, detectAgent, laneFor, parseConfig, parseState, isSayCommand, main };

if (require.main === module) {
  const event = process.argv[2];
  const root = process.env.BOXBOX_ROOT || process.cwd();
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", d => (raw += d));
  process.stdin.on("end", () => {
    try { main(event, raw, root); } catch (err) {
      try { fs.appendFileSync(path.join(root, ".boxbox", "live", "hook-errors.log"), `${new Date().toISOString()} ${event} ${err && err.message}\n`); } catch {}
      // A subagent call the gate could not judge still runs (D4); the pit wall says so.
      if (event === "PreToolUse" && /"tool_name":"(Agent|Task)"/.test(raw)) {
        try { append(path.join(root, ".boxbox", "live"), "events.jsonl", { ts: new Date().toISOString(), session: "", agent: "claude-code", lane: "driver", unit: "", type: "gate-error", kind: "gate-error", target: short(String(err && err.message), 200), why: "", result: "allowed" }); } catch {}
      }
    }
  });
}
