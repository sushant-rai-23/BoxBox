// Boxbox board data. The agent rewrites this file after every step.
// It is JSON inside one assignment so board.html can load it from disk.
// Format: see "Board data" in .boxbox/GUIDE.md.
window.BOXBOX_BOARD = {
  "project": "boxbox",
  "goal": "Boxbox 0.7.0: cheaper models do routine work through fixed-model subagents, every task gets a brief, and the pit wall shows exact cost per model.",
  "updated": "2026-10-14",
  "unit": "epic",
  "decisionLevel": "what matters",
  "waiting": null,
  "knowledge": [ { "title": "Subagents and model routing", "href": "knowledge/subagent-model-routing.html" }, { "title": "Prompt caching and token accounting", "href": "knowledge/prompt-caching-and-token-accounting.html" }, { "title": "Git worktrees and merging", "href": "knowledge/git-worktrees-and-merging.html" } ],
  "modules": [
    { "name": "Entry and flow skills", "files": ["skills/boxbox/**", "skills/boxbox-resume/**", "skills/boxbox-lessons/**"], "role": "Pick the flow, resume work, record the developer's corrections." },
    { "name": "Planning skills", "files": ["skills/boxbox-discover/**", "skills/boxbox-plan/**", "skills/boxbox-design/**", "skills/boxbox-primer/**", "skills/boxbox-grill/**", "skills/boxbox-prototype/**"], "role": "Read the code, ask decisions, write the plan and teaching pages." },
    { "name": "Build skills", "files": ["skills/boxbox-build/**", "skills/boxbox-tdd/**", "skills/boxbox-verify/**", "skills/boxbox-debug/**"], "role": "Build one unit test-first and prove it works." },
    { "name": "Review and report skills", "files": ["skills/boxbox-inspect/**", "skills/boxbox-report/**", "skills/boxbox-review/**", "skills/boxbox-explain/**", "skills/boxbox-why/**"], "role": "Independent review, fact-checked pages, explaining code." },
    { "name": "Setup and kit", "files": ["skills/boxbox-setup/SKILL.md", "skills/boxbox-setup/kit/GUIDE.md", "skills/boxbox-setup/kit/board.html", "skills/boxbox-setup/kit/*.md", "skills/boxbox-setup/kit/board-data.js"], "role": "Creates .boxbox/ in a repo; the GUIDE is the contract for every page and file." },
    { "name": "Page templates and assets", "files": ["skills/boxbox-setup/kit/templates/**", "skills/boxbox-setup/kit/assets/**", "tools/gen-templates.py"], "role": "The fixed page shells the agent fills, and the generator that writes them." },
    { "name": "Pit wall server", "files": ["skills/boxbox-setup/kit/pitwall/server.js", "skills/boxbox-setup/kit/pitwall/prices.json", "skills/boxbox-setup/kit/pitwall/say"], "role": "Local server: tails transcripts, counts tokens and cost, serves the live page." },
    { "name": "Pit wall page", "files": ["skills/boxbox-setup/kit/pitwall/index.html", "skills/boxbox-setup/kit/pitwall/orbs.js"], "role": "The live page: Home, Board, Telemetry, Map, Timing, Garage." },
    { "name": "Page checker", "files": ["skills/boxbox-setup/kit/pitwall/check-page.js"], "role": "Checks pages against templates, git and pit wall facts." },
    { "name": "Hooks", "files": ["hooks/**"], "role": "Feed every agent event to .boxbox/live, the pause gate, pre-approval of Boxbox commands." },
    { "name": "Plugin manifests and install", "files": [".claude-plugin/**", ".codex-plugin/**", ".cursor-plugin/**", ".opencode/**", "install.sh", "README.md"], "role": "How each agent installs Boxbox; the public docs." },
    { "name": "Tests", "files": ["tests/**"], "role": "node:test suites for the hook, gate, server and page checker." }
  ],
  "milestones": [ {
    "id": "M1", "title": "Boxbox 0.7.0: model routing", "goal": "Cheaper models for routine work, a brief per task, exact cost per model, Codex unchanged.",
    "status": "in_progress",
    "links": [ { "label": "Context", "href": "model-routing/context.html" }, { "label": "Decisions", "href": "model-routing/decisions.html" }, { "label": "Plan", "href": "model-routing/plan.html" } ],
    "epics": [
 {
  "id": "E1",
  "title": "Routing config and fixed-model agents",
  "outcome": "In a Claude Code session, Boxbox builds tasks through boxbox-builder, searches through boxbox-scout, runs checks through boxbox-runner and fills pages through boxbox-writer, each on the model the repo's `models:` mode and the task's size and risk call for; escalation retries on the session model and is logged.",
  "status": "todo",
  "branch": "model-routing-e1-agents",
  "files": [
   "agents/**",
   "hooks/boxbox-event.js",
   "hooks/routing.js",
   "skills/boxbox-setup/kit/GUIDE.md",
   "skills/boxbox-setup/kit/pitwall/say",
   "skills/boxbox-setup/SKILL.md",
   "skills/boxbox-plan/SKILL.md",
   "skills/boxbox-build/SKILL.md",
   "skills/boxbox-tdd/SKILL.md",
   "skills/boxbox-inspect/SKILL.md",
   "skills/boxbox-report/SKILL.md",
   "skills/boxbox-lessons/SKILL.md",
   "tests/pitwall/routing.test.js",
   "tests/pitwall/hook.test.js"
  ],
  "tasks": [
   {
    "id": "E1.1",
    "title": "Ship the four agent files with strict prompts and minimal tools",
    "test": "`agents: four boxbox agents with expected models and tools` reads agents/*.md frontmatter",
    "status": "todo"
   },
   {
    "id": "E1.2",
    "title": "Parse `models:` and `parallel:` and compute a call's expected model from mode, size, risk, epic override and escalation",
    "test": "`routing: balanced sends an M builder task to sonnet and a risky one to the session model`",
    "status": "todo"
   },
   {
    "id": "E1.3",
    "title": "GUIDE config format and setup question for `models:`; `parallel:` mentioned, default off",
    "test": "no cheap test, verify: GUIDE config block and setup step read correctly; parseConfig test on the GUIDE example",
    "status": "todo"
   },
   {
    "id": "E1.4",
    "title": "boxbox-plan tags tasks `size`/`risk` and records epic `model: opus`; a plan.md parser reads them",
    "test": "`routing: plan parser reads size, risk and epic model override from a plan.md`",
    "status": "todo"
   },
   {
    "id": "E1.5",
    "title": "boxbox-build routes tasks to the agents with `model` and the task id, applies escalation, and `say escalated` logs it",
    "test": "`say escalated writes an escalated event with unit and reason`",
    "status": "todo"
   },
   {
    "id": "E1.6",
    "title": "Hand template work to boxbox-writer in report, lessons and setup refresh; keep inspect, fact-check and decisions on the session model",
    "test": "no cheap test, verify: skill text names boxbox-writer only for template filling and never for judgement steps",
    "status": "todo"
   }
  ]
 },
 {
  "id": "E2",
  "title": "Task briefs",
  "outcome": "Before each task, the main model writes `.boxbox/<feature>/<epic>/tasks/<id>.md` from the current code; builders (Claude Code) or the main agent (Codex) build from it; it is linked from the board and the pit wall and quoted in the report.",
  "status": "todo",
  "branch": "model-routing-e2-briefs",
  "files": [
   "skills/boxbox-build/SKILL.md",
   "skills/boxbox-report/SKILL.md",
   "skills/boxbox-setup/kit/GUIDE.md",
   "skills/boxbox-setup/kit/templates/**",
   "tools/gen-templates.py",
   "skills/boxbox-setup/kit/pitwall/check-page.js",
   "skills/boxbox-setup/kit/pitwall/server.js",
   "skills/boxbox-setup/kit/pitwall/index.html",
   "agents/boxbox-builder.md",
   "tests/pitwall/**"
  ],
  "tasks": [
   {
    "id": "E2.1",
    "title": "Brief format in GUIDE and the folder map; brief parser for expected diff size and files",
    "test": "`brief: parser reads files and expected diff size from a brief`",
    "status": "todo"
   },
   {
    "id": "E2.2",
    "title": "boxbox-build writes the brief before each task and hands builders fixed part then brief",
    "test": "no cheap test, verify: skill text has the order and the \"no timestamps in the fixed part\" rule; builder agent prompt expects a brief",
    "status": "todo"
   },
   {
    "id": "E2.3",
    "title": "Report template gets a per-task brief quote and the checker validates it",
    "test": "`check-page: a report brief quote must match the brief file`",
    "status": "todo"
   },
   {
    "id": "E2.4",
    "title": "Board and pit wall link each task's brief",
    "test": "`server: board task brief link is served under /b/`",
    "status": "todo"
   }
  ]
 },
 {
  "id": "E3",
  "title": "Routing gate and escalation enforcement",
  "outcome": "A subagent call that breaks the routing rules is denied with a reason naming the right agent and model, and the agent retries; under `models: auto` or the FORCE override the gate stands aside and the pit wall says why.",
  "status": "todo",
  "branch": "model-routing-e3-gate",
  "files": [
   "hooks/boxbox-event",
   "hooks/boxbox-event.js",
   "hooks/routing.js",
   "tests/pitwall/gate.test.js",
   "tests/pitwall/routing.test.js"
  ],
  "tasks": [
   {
    "id": "E3.1",
    "title": "Synchronous gate path for Claude Code Agent/Task calls only",
    "test": "`gate: an Agent call reaches the gate synchronously and a Bash call stays in the background`",
    "status": "todo"
   },
   {
    "id": "E3.2",
    "title": "Deny wrong model or missing task id with a reason naming the right agent and model",
    "test": "`gate: a risky task on sonnet is denied with \"run boxbox-builder with model opus\"`",
    "status": "todo"
   },
   {
    "id": "E3.3",
    "title": "Stand aside under `models: auto` and FORCE, and say why",
    "test": "`gate: FORCE on allows any model and logs gate-off with the reason`",
    "status": "todo"
   },
   {
    "id": "E3.4",
    "title": "Fail open on internal errors with a gate-error event",
    "test": "`gate: an unparsable plan.md allows the call and logs gate-error`",
    "status": "todo"
   },
   {
    "id": "E3.5",
    "title": "Escalation state: two failures or an early trigger require the session model for the task's next builder call",
    "test": "`gate: after two recorded failures a sonnet builder retry is denied`",
    "status": "todo"
   }
  ]
 },
 {
  "id": "E4",
  "title": "Exact cost per model",
  "outcome": "Tokens and cost are counted per model, per subagent and per task from the main transcript plus every subagent transcript, including subagents still running, with the cache-read share per model and a labelled \"saved versus all on the session model\" estimate.",
  "status": "todo",
  "branch": "model-routing-e4-cost",
  "files": [
   "skills/boxbox-setup/kit/pitwall/server.js",
   "skills/boxbox-setup/kit/pitwall/prices.json",
   "hooks/boxbox-event.js",
   "tests/pitwall/server.test.js",
   "tests/pitwall/fixtures/**"
  ],
  "tasks": [
   {
    "id": "E4.1",
    "title": "Fix the Sonnet cache-read price and price `[1m]` ids",
    "test": "`server: priceFor matches claude-opus-5-5[1m] and sonnet cache read costs 0.1 per million`",
    "status": "todo"
   },
   {
    "id": "E4.2",
    "title": "Register subagent transcripts at SubagentStart and attach each to its task through meta.json",
    "test": "`server: a running subagent's tokens count under its task before SubagentStop`",
    "status": "todo"
   },
   {
    "id": "E4.3",
    "title": "Aggregate tokens, cost and cache-read share by model",
    "test": "`server: per-model totals match a hand count of the spike fixtures`",
    "status": "todo"
   },
   {
    "id": "E4.4",
    "title": "Savings estimate and `--summary` by model",
    "test": "`server: saved estimate re-prices subagent tokens at the session model's rates`",
    "status": "todo"
   }
  ]
 },
 {
  "id": "E5",
  "title": "Pit wall routing views",
  "outcome": "Every Telemetry and Team radio row carries a model chip; builder, scout, runner and writer each get a lane; Timing shows cost, tokens and cache-read share by model, escalations and the savings estimate; Home shows the mode, active agents, last escalation and why the gate is off when it is.",
  "status": "todo",
  "branch": "model-routing-e5-views",
  "files": [
   "skills/boxbox-setup/kit/pitwall/index.html",
   "skills/boxbox-setup/kit/pitwall/server.js",
   "hooks/boxbox-event.js",
   "tests/pitwall/**"
  ],
  "tasks": [
   {
    "id": "E5.1",
    "title": "Model on each event row and a chip in the feed",
    "test": "`hook: subagent tool events carry the subagent's model`",
    "status": "todo"
   },
   {
    "id": "E5.2",
    "title": "Lanes per Boxbox agent and per parallel builder",
    "test": "`hook: laneFor maps boxbox:boxbox-scout to the scout lane`",
    "status": "todo"
   },
   {
    "id": "E5.3",
    "title": "Timing by model, escalations and savings",
    "test": "no cheap test, verify: `?demo` page shows the three new blocks with values from the state payload",
    "status": "todo"
   },
   {
    "id": "E5.4",
    "title": "Home routing readout with gate-off reason",
    "test": "`server: state reports mode, active agents, last escalation and gate-off reason`",
    "status": "todo"
   }
  ]
 },
 {
  "id": "E6",
  "title": "Status line",
  "outcome": "Under the prompt, Claude Code CLI shows one line like `E2.3 \u00b7 builder sonnet \u00b7 $0.42 \u00b7 14/14 tests`, or `PAUSED`, or `Your move: D3`, installed only after the developer agrees.",
  "status": "todo",
  "branch": "model-routing-e6-statusline",
  "files": [
   "skills/boxbox-setup/kit/pitwall/statusline",
   "skills/boxbox-setup/SKILL.md",
   "hooks/boxbox-event.js",
   "tests/pitwall/statusline.test.js"
  ],
  "tasks": [
   {
    "id": "E6.1",
    "title": "Status line script from live data",
    "test": "`statusline: prints task, model, cost and tests from live files in under 50 ms`",
    "status": "todo"
   },
   {
    "id": "E6.2",
    "title": "Setup offers to install it into project settings",
    "test": "no cheap test, verify: setup text asks first, merges one key, shows an existing statusLine",
    "status": "todo"
   }
  ]
 },
 {
  "id": "E7",
  "title": "Parallel tasks",
  "outcome": "With `parallel: on` and `worktree.baseRef: \"head\"`, independent tasks of one epic build at once in worktree builders (at most 3), merge back in plan order with one commit per task, and fall back to one at a time on any conflict or red suite.",
  "status": "todo",
  "branch": "model-routing-e7-parallel",
  "files": [
   "skills/boxbox-build/SKILL.md",
   "skills/boxbox-setup/SKILL.md",
   "skills/boxbox-setup/kit/GUIDE.md",
   "agents/boxbox-builder.md",
   "hooks/routing.js",
   "tests/pitwall/routing.test.js"
  ],
  "tasks": [
   {
    "id": "E7.1",
    "title": "Choose tasks that can build together",
    "test": "`routing: two tasks sharing a brief file are never scheduled together`",
    "status": "todo"
   },
   {
    "id": "E7.2",
    "title": "Base-branch check and setup step",
    "test": "`routing: parallel is refused when worktree.baseRef is not head`",
    "status": "todo"
   },
   {
    "id": "E7.3",
    "title": "Build skill: worktree builders, ordered merge, fallback",
    "test": "no cheap test, verify: skill text covers order, one commit per task, full suite once, fallback and report",
    "status": "todo"
   }
  ]
 },
 {
  "id": "E8",
  "title": "Release 0.7.0",
  "outcome": "README explains routing with a Claude Code vs Codex table and marks live-only checks as not yet verified in a live session (D5); version is 0.7.0 everywhere; all tests and `claude plugin validate .` pass.",
  "status": "todo",
  "branch": "model-routing-e8-release",
  "files": [
   "README.md",
   ".claude-plugin/**",
   ".codex-plugin/**",
   ".cursor-plugin/**",
   "docs/routing-spike.md",
   "tests/pitwall/**"
  ],
  "tasks": [
   {
    "id": "E8.1",
    "title": "Codex regression: the Codex fixture through every changed hook path behaves as in 0.6",
    "test": "`hook: a Codex PreToolUse never reaches the routing gate`",
    "status": "todo"
   },
   {
    "id": "E8.2",
    "title": "README table, routing section, live-only caveats, and docs/routing-spike.md linked",
    "test": "no cheap test, verify: read the README section against the spec's Part 7",
    "status": "todo"
   },
   {
    "id": "E8.3",
    "title": "Version 0.7.0 everywhere and the release checks",
    "test": "`release: every manifest says 0.7.0`",
    "status": "todo"
   }
  ]
 }
]
  } ]
};
