# Context: model-routing
request: Boxbox 0.7.0. Cheaper models do routine work through fixed-model subagents (builder, scout, runner, writer) while the session model keeps judgement and review. Every task gets a brief. A PreToolUse gate enforces the routing, subagent tokens are counted exactly per model, the pit wall and a status line show it, and parallel worktree builds are optional. All of this is Claude Code only; Codex behaves as in 0.6, plus task briefs. Full spec: the developer's pasted prompt (Parts 1 to 7, "Done means" 1 to 11).
done_means: Step 0 written up (docs/routing-spike.md, done in discovery). The 0.7 agents, config, gate, briefs, per-model accounting, pit wall views, status line and parallel mode are built and tested. `claude plugin validate .` passes and the version is 0.7.0 everywhere. Live end-to-end runs on a demo repo are deferred by the developer ("no demo for now").

## Touches
- agents/ (new): boxbox-builder, boxbox-scout, boxbox-runner, boxbox-writer agent files. Plugin agents load as `boxbox:<name>`.
- hooks/hooks.json: add a matcher for the Agent/Task gate. SubagentStart/Stop are already registered (hooks.json:105-126).
- hooks/boxbox-event: the bash fast path sends only SessionStart and pit wall PreToolUse calls to node synchronously (boxbox-event:50). The gate needs a synchronous path for `"tool_name":"Agent"` and `"Task"`.
- hooks/boxbox-event.js: SubagentStart/Stop handling (400-413), parseConfig (236-242) reads only `test:` and `pitwall:`, laneFor (200-204) knows only the driver, crew and steward lanes, classify (105-106) ignores `input.model`.
- skills/boxbox-setup/kit/pitwall/server.js: ingestClaudeLines (79-98) already records `model` and `sub` on each entry. aggregate (198-237) has no grouping by model or by subagent. refreshSessions (378-389) registers subagent transcripts only at SubagentStop. summary (648) prints the cost for `--summary`.
- skills/boxbox-setup/kit/pitwall/index.html: the Timing view (126-143, renderTiming 564-579), the lanes (renderLanes 511-531), feed rows (rowHTML 237-245), Home (49-85), demo data (633-727).
- skills/boxbox-setup/kit/pitwall/prices.json: per-model rates. There is no entry for `[1m]` ids.
- skills/boxbox-plan, boxbox-build, boxbox-tdd, boxbox-inspect, boxbox-report, boxbox-setup, boxbox-lessons: briefs, size and risk tags, the routing rules, escalation, `model:` frontmatter, the setup questions.
- skills/boxbox-setup/kit/GUIDE.md: the config format (the `models:` block at GUIDE.md:241-244 is replaced), folder map (`tasks/<id>.md`), events (`escalated`), plan task line.
- tools/gen-templates.py and kit/templates: the report template's per-task brief quote and per-model cost.
- README.md: a Claude Code vs Codex table, and the version (README.md:186).
- Version 0.6.0 appears in: .claude-plugin/plugin.json:4, .claude-plugin/marketplace.json:9, .codex-plugin/plugin.json:3, .cursor-plugin/plugin.json:5, README.md:186.
- tests/pitwall/*.test.js: new unit tests, plus fixtures from the Step 0 transcripts.

## Conventions to follow
- No dependencies. Node 18+ built-ins only (server.js:10-16). The hooks are bash plus one node file.
- Pure functions sit in a "pure parts (tested)" block and are exported for tests (server.js:26). Tests use node:test with mkdtemp repos (tests/pitwall/gate.test.js:13-21).
- The hook must stay fast and fail open, except for the pause gate, which fails closed (boxbox-event:22-40). With no `.boxbox`, it exits 0 in well under 50 ms (gate.test.js:23).
- events.jsonl never holds file contents, prompt text or command output (GUIDE.md:126).
- Kit files are copied with `cp`, never rewritten (boxbox-setup step 1). The hooks always run the plugin's own server.js (`--box`).
- Skills are plain Markdown with `name` and `description` frontmatter only, today.

## Commands
test: node --test tests/pitwall/*.test.js | lint: none | validate: claude plugin validate . | run: node .boxbox/pitwall/server.js --ensure

## How it works today
1. Claude Code fires a hook. hooks.json runs `bash hooks/boxbox-event <Event>` (hooks.json:35-45).
2. boxbox-event finds `.boxbox/`, applies the pause gate on PreToolUse, then runs boxbox-event.js in the background. It runs synchronously only for SessionStart and pit wall commands (boxbox-event:50-54).
3. boxbox-event.js appends an event to `.boxbox/live/events.jsonl`. A subagent shows as `crew` started/finished (400-413). SubagentStop also adds the subagent transcript to `sessions.jsonl`, under the parent's session id (410-412).
4. server.js tails every transcript in sessions.jsonl (refreshSessions 378-389, Tail 338). ingestClaudeLines keeps one entry per message with its model (79-98). aggregate buckets entries by the stage active at their timestamp into epic, task and session totals (198-237).
5. index.html renders the state over SSE: Home, Board, Telemetry (lanes), Map, Timing (per session with a Model column, per task), Garage.

## From the developer
- Main surface? -> both the CLI and VS Code. The status line is CLI-only (VS Code not verified), so the pit wall Home readout must carry the same information.
- Where to run the live "done means" checks? -> a scratch demo repo was chosen, then "no demo for now": live runs are deferred and verification uses tests and recorded fixtures.
- Budget for verification sessions? -> up to $30 (Step 0 used $2.70).
- Deadline or other contributors? -> none. Plan for quality, ship epic by epic.

## Concepts
- Claude Code subagents, agent files, model resolution, the routing gate: new (knowledge/subagent-model-routing.html)
- Prompt caching, cache reads and writes, per-model token accounting: new (knowledge/prompt-caching-and-token-accounting.html)
- Git worktrees, per-task branches, merging back in order: new (knowledge/git-worktrees-and-merging.html)
- Claude Code hooks (PreToolUse deny, SubagentStart/Stop): new (covered on the routing page)
- Status line command and its stdin JSON: new (covered on the routing page)
- Node HTTP server, SSE, node:test: new (already used by 0.6; not needed to decide)

## Failure modes
- The gate denies a legitimate call (a bug in its rules, an unknown agent type): the gate only judges `boxbox:*` agent types and passes everything else; its rules are pure functions with table tests; config `models: auto` turns it off.
- The gate blocks or slows every tool call: only Agent/Task calls take the synchronous node path; all other events keep the background path; a timing test.
- Boxbox and Claude Code disagree on resolution order (a future version changes it): the order is one function citing the spike; FORCE is detected from the environment and turns the gate off; `models: auto` steps aside.
- Subagent tokens counted twice, or missed while a subagent runs: derive the transcript path at SubagentStart; dedupe by message id per transcript; a fixture test against real spike transcripts; the main transcript has no sidechain lines (spike 5).
- Parallel subagents attributed to the wrong task: stage.json holds one unit, so a subagent's task comes from its Agent call (task id in the description or brief path), joined through meta.json `toolUseId`.
- A worktree branches from main instead of the epic branch (spike 7): parallel mode requires `worktree.baseRef: "head"` in project settings and refuses without it.
- Merge conflicts or a red suite after merging parallel tasks: stop parallel mode for the epic, finish one task at a time, report it.
- Escalation loops or silent push-through: max one escalation per task, logged as `escalated`; a failure on the session model stops and asks the developer.
- The brief goes stale (written at plan time, code moved on): written just before the task from current code; quote excerpts with file:line, so check-page-style quote checking can catch drift.
- The prompt cache misses because the fixed part changes: the fixed part is built from files that do not change during a feature; no timestamps; the cache-read share is shown per model so a regression is visible.
- The status line is slow or crashes the prompt: reads `.boxbox/live/` only, no network, no git; a timing test under 50 ms; it prints nothing on any error.
- Codex breaks on Claude-Code-only parts: agent files and the gate are inert under Codex (the gate keys on `"tool_name":"Agent"`, and Codex sends `turn_id`); tests on the Codex fixture.
- Setup overwrites the developer's `.claude/settings.json`: merge one key and ask first; never touch user-global settings.
- Prices: model ids with a `[1m]` suffix go unpriced; the savings estimate is labelled an estimate.

## Surprises
- 0.6 already collects `model` and `sub` on every token entry but never groups by them (server.js:79-98, 198-237).
- GUIDE.md documents a `models:` block (plan/build/report) that nothing reads (GUIDE.md:241-244).
- A plugin cannot ship the main status line, only `subagentStatusLine` (spike 9).
- `CLAUDE_CODE_SUBAGENT_MODEL` alone no longer overrides anything; only `_FORCE=1` does (spike 3).
- Worktree subagents branch from the remote's default branch, not the current branch (spike 7).
- Hooks see the tool as `Agent`; result summaries call it `Task` (spike 6).
- Each subagent transcript has a `.meta.json` with the Agent call's `toolUseId` and requested `model` (spike 5).
- The directory form `node --test tests/pitwall/` fails on Node 24; the file glob works.
- prices.json:70 prices claude-sonnet-5-5 cache_read at 0.2 $/M; Claude Code's own costUSD for a spike Sonnet subagent ($0.0020236) matches only at 0.1. Pit wall overprices Sonnet cache reads 2x.

## Open questions
- How is a subagent's model decided when the main agent omits `model`? Boxbox can pass `model` on every call, or rely on the agent files and pass it only to escalate.
- Where does the gate get a task's risk and size: parse plan.md each time, or a small JSON the plan skill writes?
- How does a subagent's work attach to a task when tasks run in parallel?
- Is `boxbox-writer` worth shipping in 0.7, or should report pages be split into a sonnet skill?
- Parallel mode: is it worth building in 0.7 at all, given the base-branch caveat and that it stays off by default?
- The release is large. How should it split into epics, and in what order?
