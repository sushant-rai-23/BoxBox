# Plan: Boxbox 0.7.0 model routing
approved: yes, 2026-10-14
branch: model-routing
unit: epic
goal: Cheaper models do routine work through fixed-model subagents, every task gets a brief, a gate enforces the routing, and the pit wall and a status line show exact cost per model, with Codex unchanged apart from briefs.

## Decisions
- D1 How models are set: always pass `model` on every Agent call except under `models: auto`; agent files hold the balanced models as a fallback; the gate checks equality (developer)
- D2 Cheaper template work: writer subagent only, no skill `model:` lines (developer)
- D3 Parallel base branch: require `worktree.baseRef: "head"` in project settings; refuse otherwise (developer)
- D4 Gate on internal error: fail open and log `gate-error` (developer)
- D5 Done: ship 0.7.0 on tests; README marks live-only items "not yet verified in a live session" (override)
- A1 Builder/runner call descriptions start with the task id (default)
- A2 `| size: S|M|L | risk: yes|no` on task lines; `model: opus` line on an epic (default)
- A3 `say escalated --unit <id> --why` -> events kind `escalated` (default)
- A4 Subagent transcript registered at SubagentStart (derived path); task via meta.json toolUseId (default)
- A5 Savings = subagent tokens re-priced at session-model rates, labelled estimate (default)
- A6 Status line at kit/pitwall/statusline, installed in project settings after asking (default)
- A7 .claude/worktrees/ added to .gitignore when parallel is on (default)
- A8 Fixtures: trimmed Step 0 transcripts (default)
- A9 hooks-codex.json unchanged (default)
- A10 Model chip shows the family, full id on hover (default)
- A11 GUIDE config: `models:` and `parallel:` replace the old block (default)

## E1 Routing config and fixed-model agents  [done]
outcome: In a Claude Code session, Boxbox builds tasks through boxbox-builder, searches through boxbox-scout, runs checks through boxbox-runner and fills pages through boxbox-writer, each on the model the repo's `models:` mode and the task's size and risk call for; escalation retries on the session model and is logged.
branch: model-routing-e1-agents
depends: none
design: yes, because it adds the public config (`models:`, `parallel:`), four agent definitions and the routing rule every later epic checks against
files: agents/**, skills/boxbox/SKILL.md, tests/pitwall/agents.test.js, hooks/boxbox-event.js, hooks/routing.js, skills/boxbox-setup/kit/GUIDE.md, skills/boxbox-setup/kit/pitwall/say, skills/boxbox-setup/SKILL.md, skills/boxbox-plan/SKILL.md, skills/boxbox-build/SKILL.md, skills/boxbox-tdd/SKILL.md, skills/boxbox-inspect/SKILL.md, skills/boxbox-report/SKILL.md, skills/boxbox-lessons/SKILL.md, tests/pitwall/routing.test.js, tests/pitwall/hook.test.js
accept:
- `agents/` holds boxbox-builder (sonnet), boxbox-scout (haiku), boxbox-runner (haiku), boxbox-writer (sonnet), each with a short strict prompt and only the tools it needs; `claude plugin validate .` passes
- One pure function gives the expected model for (agent, task size, risk, epic override, escalation, mode, session model), matching the spec table for best, balanced, save and auto; table-tested
- `config.md` parses `models:` and `parallel:`; setup asks `models:` recommending balanced and mentions `parallel:` without asking
- boxbox-plan tags tasks with size and risk and records per-epic `model: opus`; boxbox-build passes `model` and the task id on every builder/runner call and never routes discover, plan, design, briefs, inspect, fact-check or approvals down
- Escalation rules (two failures, diff over 3x, edits outside the brief, 5 edits without green) are in boxbox-build; `say escalated` writes an `escalated` event; a failure on the session model stops and asks the developer
- Report page-filling goes to boxbox-writer (D2); setup refresh copies to boxbox-runner (A13); boxbox-lessons stays on the session model (A14)
fails:
- Unknown or misspelt mode in config.md: treated as `balanced` with a warning event (E1.2)
- `auto` mode: the function returns "no model", the skills pass none (E1.2)
- Escalation loops: at most one escalation per task, then stop (E1.5)
tasks:
- [x] E1.1 Ship the four agent files with strict prompts and minimal tools | test: `agents: four boxbox agents with expected models and tools` reads agents/*.md frontmatter | done: test green, `claude plugin validate .` passes | deps: none
- [x] E1.2 Parse `models:` and `parallel:` and compute a call's expected model from mode, size, risk, epic override and escalation | test: `routing: balanced sends an M builder task to sonnet and a risky one to the session model` | done: table test over all four modes green | deps: none
- [x] E1.3 GUIDE config format and setup question for `models:`; `parallel:` mentioned, default off | no cheap test, verify: GUIDE config block and setup step read correctly; parseConfig test on the GUIDE example | deps: E1.2
- [x] E1.4 boxbox-plan tags tasks `size`/`risk` and records epic `model: opus`; a plan.md parser reads them | test: `routing: plan parser reads size, risk and epic model override from a plan.md` | done: parser test green | deps: E1.2
- [x] E1.5 boxbox-build routes tasks to the agents with `model` and the task id, applies escalation, and `say escalated` logs it | test: `say escalated writes an escalated event with unit and reason` | done: test green; build skill text reviewed against the spec table | deps: E1.2, E1.4
- [x] E1.6 Hand template work to boxbox-writer in report, lessons and setup refresh; keep inspect, fact-check and decisions on the session model | no cheap test, verify: skill text names boxbox-writer only for template filling and never for judgement steps | deps: E1.1

## E2 Task briefs  [done]
outcome: Before each task, the main model writes `.boxbox/<feature>/<epic>/tasks/<id>.md` from the current code; builders (Claude Code) or the main agent (Codex) build from it; it is linked from the board and the pit wall and quoted in the report.
branch: model-routing-e2-briefs
depends: E1
design: no
files: skills/boxbox-build/SKILL.md, skills/boxbox-report/SKILL.md, skills/boxbox-setup/kit/GUIDE.md, skills/boxbox-setup/kit/templates/**, tools/gen-templates.py, skills/boxbox-setup/kit/pitwall/check-page.js, skills/boxbox-setup/kit/pitwall/server.js, skills/boxbox-setup/kit/pitwall/index.html, agents/boxbox-builder.md, tests/pitwall/**
accept:
- GUIDE documents the brief format: goal and acceptance, files and functions with file:line and exact excerpts, interface, test cases, what not to touch, done check and commands, expected diff size
- boxbox-build writes the brief just before each task, after a scout pulls excerpts, never at plan time
- Every subagent prompt is the fixed part (GUIDE rules, conventions, commands) first and the brief second, with nothing that changes per call in the fixed part
- The board's task has a `brief` link; the pit wall shows it; the report template has a per-task brief quote the checker validates
- Under Codex the main agent builds from the brief itself
fails:
- A brief quotes code that has since moved: not checked; the brief records `base`, the commit its excerpts describe, and is written just before its task, so the window for drift is one task (changed during review of E2)
- The fixed part changes mid-feature and cache reads fall: built only from files that do not change during a feature (E2.2)
tasks:
- [x] E2.1 Brief format in GUIDE and the folder map; brief parser for expected diff size and files | test: `brief: parser reads files and expected diff size from a brief` | done: test green | deps: none
- [x] E2.2 boxbox-build writes the brief before each task and hands builders fixed part then brief | no cheap test, verify: skill text has the order and the "no timestamps in the fixed part" rule; builder agent prompt expects a brief | deps: E2.1
- [x] E2.3 Report template gets a per-task brief quote and the checker validates it | test: `check-page: a report brief quote must match the brief file` | done: test green, templates regenerated | deps: E2.1
- [x] E2.4 Board and pit wall link each task's brief | test: `server: board task brief link is served under /b/` | done: test green | deps: E2.1

## E3 Routing gate and escalation enforcement  [done]
outcome: A subagent call that breaks the routing rules is denied with a reason naming the right agent and model, and the agent retries; under `models: auto` or the FORCE override the gate stands aside and the pit wall says why.
branch: model-routing-e3-gate
depends: E1, E2
design: yes, because it adds a synchronous decision path to the hook that every Agent call passes through, and its failure behaviour (D4)
files: hooks/boxbox-event, hooks/boxbox-event.js, hooks/routing.js, tests/pitwall/gate.test.js, tests/pitwall/routing.test.js
accept:
- Only Claude Code Agent and Task calls take the new synchronous node path; other calls keep the background path; Codex payloads (with `turn_id`) are untouched
- The gate judges only `boxbox:*` agents; a wrong model, a missing task id, or a builder retry after two failures not on the session model is denied with a reason like "E2.3 is risk: yes, run boxbox-builder with model opus"
- `models: auto` or FORCE on: the gate allows everything and logs why; plain `CLAUDE_CODE_SUBAGENT_MODEL` is logged as information
- Early-escalation triggers observed from subagent tool events (edits outside the brief, 5 edits of one code file without a green test run) require escalation before that task's next builder call; the diff-over-3x check stays with the build skill, because the hook does not see diffs (changed during review of E3)
- Any internal error allows the call and logs `gate-error` (D4)
fails:
- The gate blocks real work: only boxbox agents judged; fail open (E3.1, E3.4)
- Gate latency on every call: synchronous only for Agent/Task (E3.1)
- Resolution order changes in a future Claude Code: the gate compares passed model to expected and never resolves; FORCE detected (E3.3)
tasks:
- [x] E3.1 Synchronous gate path for Claude Code Agent/Task calls only | test: `gate: an Agent call reaches the gate synchronously and a Bash call stays in the background` | done: test green; no-.boxbox fast path still under 50 ms | deps: none
- [x] E3.2 Deny wrong model or missing task id with a reason naming the right agent and model | test: `gate: a risky task on sonnet is denied with "run boxbox-builder with model opus"` | done: table test green | deps: E3.1
- [x] E3.3 Stand aside under `models: auto` and FORCE, and say why | test: `gate: FORCE on allows any model and logs gate-off with the reason` | done: test green | deps: E3.2
- [x] E3.4 Fail open on internal errors with a gate-error event | test: `gate: an unparsable plan.md allows the call and logs gate-error` | done: test green | deps: E3.2
- [x] E3.5 Escalation state: two failures or an early trigger require the session model for the task's next builder call | test: `gate: after two recorded failures a sonnet builder retry is denied` | done: test green | deps: E3.2

## E4 Exact cost per model  [done]
outcome: Tokens and cost are counted per model, per subagent and per task from the main transcript plus every subagent transcript, including subagents still running, with the cache-read share per model and a labelled "saved versus all on the session model" estimate.
branch: model-routing-e4-cost
depends: E1
design: yes, because it changes the token data the server serves to the page and to `--summary`
files: skills/boxbox-setup/kit/pitwall/server.js, skills/boxbox-setup/kit/pitwall/prices.json, hooks/boxbox-event.js, tests/pitwall/server.test.js, tests/pitwall/fixtures/**
accept:
- prices.json prices claude-sonnet-5-5 cache reads at $0.10/M, matching Claude Code's reported cost
- A subagent's transcript is registered at SubagentStart; its tokens count while it runs; nothing is counted twice
- Per-model totals for a fixture session (main plus three subagents) match a hand count to the token
- Each subagent's task comes from its Agent call's task id (meta.json toolUseId), so parallel subagents land on the right task
- Cache-read share per model and the savings estimate are served; `--summary <unit>` prints cost by model
- Codex sessions still show their model per session with empty prices
fails:
- Double counting: dedupe per message id per transcript; the main transcript has no sidechain lines (E4.2)
- A subagent killed before SubagentStop: registered at start, so still counted (E4.2)
- `[1m]` model ids unpriced: normalise the suffix before lookup (E4.1)
tasks:
- [x] E4.1 Fix the Sonnet cache-read price and price `[1m]` ids | test: `server: priceFor matches claude-opus-5-5[1m] and sonnet cache read costs 0.1 per million` | done: test green | deps: none
- [x] E4.2 Register subagent transcripts at SubagentStart and attach each to its task through meta.json | test: `server: a running subagent's tokens count under its task before SubagentStop` | done: test green on fixtures | deps: E4.1
- [x] E4.3 Aggregate tokens, cost and cache-read share by model | test: `server: per-model totals match a hand count of the spike fixtures` | done: test green | deps: E4.2
- [x] E4.4 Savings estimate and `--summary` by model | test: `server: saved estimate re-prices subagent tokens at the session model's rates` | done: test green | deps: E4.3
- [x] E4.5 Register a Claude Code session on its first hook event when SessionStart fired before .boxbox/ existed | size: S | risk: no | test: `hook: a session the pit wall never saw start is registered on its first event` | done: test green | deps: none

## E5 Pit wall routing views  [done]
outcome: Every Telemetry and Team radio row carries a model chip; builder, scout, runner and writer each get a lane; Timing shows cost, tokens and cache-read share by model, escalations and the savings estimate; Home shows the mode, active agents, last escalation and why the gate is off when it is.
branch: model-routing-e5-views
depends: E3, E4
design: no
files: skills/boxbox-setup/kit/pitwall/index.html, skills/boxbox-setup/kit/pitwall/server.js, hooks/boxbox-event.js, tests/pitwall/**
accept:
- Feed rows show a family chip with the full id on hover (A10)
- Lanes: driver, builder, scout, runner, writer, steward; parallel builders each get their own lane
- Timing has a by-model table (tokens, cost, cache-read share), an escalations list and the savings line marked "estimate"
- Home has a routing readout; `?demo` data covers the new fields
fails:
- A subagent type outside Boxbox: falls into a generic crew lane (E5.2)
tasks:
- [x] E5.1 Model on each event row and a chip in the feed | test: `hook: subagent tool events carry the subagent's model` | done: test green; demo page shows chips | deps: none
- [x] E5.2 Lanes per Boxbox agent and per parallel builder | test: `hook: laneFor maps boxbox:boxbox-scout to the scout lane` | done: test green | deps: none
- [x] E5.3 Timing by model, escalations and savings | no cheap test, verify: `?demo` page shows the three new blocks with values from the state payload | deps: none
- [x] E5.4 Home routing readout with gate-off reason | test: `server: state reports mode, active agents, last escalation and gate-off reason` | done: test green; demo shows the readout | deps: none

## E6 Status line  [done]
outcome: Under the prompt, Claude Code CLI shows one line like `E2.3 · builder sonnet · $0.42 · 14/14 tests`, or `PAUSED`, or `Your move: D3`, installed only after the developer agrees.
branch: model-routing-e6-statusline
depends: E4
design: no
files: skills/boxbox-setup/kit/pitwall/statusline, skills/boxbox-setup/SKILL.md, hooks/boxbox-event.js, tests/pitwall/statusline.test.js
accept:
- Reads `.boxbox/live/` only and finishes in under 50 ms; prints nothing on any error
- Setup asks before writing `statusLine` into the project's `.claude/settings.json`, merging rather than overwriting, and never touches user settings
- The status line command is pre-approved like `say`
fails:
- Missing or partial live files: prints nothing (E6.1)
- An existing statusLine in project settings: setup shows it and asks before replacing (E6.2)
tasks:
- [x] E6.1 Status line script from live data | test: `statusline: prints task, model, cost and tests from live files in under 50 ms` | done: test green | deps: none
- [x] E6.2 Setup offers to install it into project settings | no cheap test, verify: setup text asks first, merges one key, shows an existing statusLine | deps: E6.1

## E7 Parallel tasks  [done]
outcome: With `parallel: on` and `worktree.baseRef: "head"`, independent tasks of one epic build at once in worktree builders (at most 3), merge back in plan order with one commit per task, and fall back to one at a time on any conflict or red suite.
branch: model-routing-e7-parallel
depends: E2, E5
design: no
files: skills/boxbox-build/SKILL.md, skills/boxbox-setup/SKILL.md, skills/boxbox-setup/kit/GUIDE.md, agents/boxbox-builder.md, hooks/routing.js, tests/pitwall/routing.test.js
accept:
- A pure function picks tasks that can run together: same epic, no dependency between them, no overlapping brief files, at most 3
- Parallel refuses to start without `worktree.baseRef: "head"` and says why (D3); setup asks to set it and ignores .claude/worktrees/ (A7)
- boxbox-build merges task branches in plan order (one commit per task), runs the full suite once, and on a conflict or red suite stops parallel for the epic and reports it
fails:
- Overlapping files: never scheduled together (E7.1)
- Wrong base branch: refuse (E7.2)
- Conflict or red suite: fall back (E7.3)
tasks:
- [x] E7.1 Choose tasks that can build together | test: `routing: two tasks sharing a brief file are never scheduled together` | done: test green | deps: none
- [x] E7.2 Base-branch check and setup step | test: `routing: parallel is refused when worktree.baseRef is not head` | done: test green | deps: E7.1
- [x] E7.3 Build skill: worktree builders, ordered merge, fallback | no cheap test, verify: skill text covers order, one commit per task, full suite once, fallback and report | deps: E7.1, E7.2

## E8 Release 0.7.0  [done]
outcome: README explains routing with a Claude Code vs Codex table and marks live-only checks as not yet verified in a live session (D5); version is 0.7.0 everywhere; all tests and `claude plugin validate .` pass.
branch: model-routing-e8-release
depends: E1, E2, E3, E4, E5, E6, E7
design: no
files: README.md, .claude-plugin/**, .codex-plugin/**, .cursor-plugin/**, docs/routing-spike.md, tests/pitwall/**
accept:
- README: a routing section, a feature/Claude Code/Codex table, and the live-only items listed as "not yet verified in a live session"
- 0.7.0 in all four manifests and the README
- Full suite green; `claude plugin validate .` passes; a Codex fixture run through the hook errors nowhere
tasks:
- [x] E8.1 Codex regression: the Codex fixture through every changed hook path behaves as in 0.6 | test: `hook: a Codex PreToolUse never reaches the routing gate` | done: test green | deps: none
- [x] E8.2 README table, routing section, live-only caveats, and docs/routing-spike.md linked | no cheap test, verify: read the README section against the spec's Part 7 | deps: none
- [x] E8.3 Version 0.7.0 everywhere and the release checks | test: `release: every manifest says 0.7.0` | done: suite green, validate passes | deps: E8.1, E8.2

## Only the developer can do
- Before tagging: decide whether to run the deferred live checks on a scratch repo (spec "done means" 2, 3 live, 4, 5 live, 8, 9).
- After release: run `claude plugin update boxbox@boxbox` and restart Claude Code to pick up the agents.

## Later
- Live end-to-end checks on a demo repo (deferred by the developer).
- Use Claude Code's own routing if it ships one (`models: auto` already steps aside).
- opusplan-style mode integration (spike 8: exists, follows plan mode not Boxbox stages).
- A `subagentStatusLine` from the plugin for subagent rows (plugins can ship that one).
- Codex prices in prices.json.
