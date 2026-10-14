# Report: E1 Routing config and fixed-model agents
status: review
branch: model-routing-e1-agents
pr: none (gh is not installed); branches model-routing and model-routing-e1-agents pushed to origin

## Commits
- b27e74e E1.1 four Boxbox subagents with fixed models and minimal tools
- 40a4bec E1.2 routing rule and models/parallel config
- c41917c E1.3 models and parallel in the GUIDE config, routing rules, setup question
- b6f3433 E1.4 size and risk tags and per-epic model override in plans
- b5095cc E1.5 build routes tasks to Boxbox agents with model and task id, escalates once
- a0ea52c E1.6 report pages go to boxbox-writer; reviews and fact-checks stay on the session model
- c81df65 E1.2 an agent outside Boxbox has no expected model (found while verifying)
- 600ac87 review: report an unknown models: value at session start; pre-approval comment names escalated
- 3efb026 review: say writes valid JSON for any text and refuses an escalation without a unit
- 3bcd3d1 review: auto uses no Boxbox agents; escalation, commit and description rules made exact

## Built
- agents/boxbox-builder.md, boxbox-scout.md, boxbox-runner.md, boxbox-writer.md: the four plugin subagents (sonnet, haiku, haiku, sonnet), minimal tools, strict "Never" lists
- hooks/routing.js: pure routing rule: parseModels, parsePlanTasks, escalatedTasks, expectedModel, familyOf, agentOf
- hooks/boxbox-event.js: parseConfig returns models/parallel/modelsWarning via routing.parseModels; SessionStart reports an unknown models: value (event `warning` + agent context); `say escalated` pre-approved
- skills/boxbox-setup/kit/pitwall/say: verb `escalated`; esc() now drops control characters and cuts before escaping (always valid JSON)
- skills/boxbox-setup/kit/GUIDE.md: config lines `models:` and `parallel:`; new "Model routing" section (table, rule order, call contract, never-routed-down list, escalation)
- skills: setup (question 6), plan (size/risk tags, epic `model:`), build (routing, escalation, builder commit = task commit), report (writer hand-off), inspect (reviewer on session model), boxbox ("use opus for E3")
- tests/pitwall/routing.test.js (new), agents.test.js (new), hook.test.js (+5 tests)

## Interfaces added or changed
- config.md: `models: best | balanced | save | auto` (missing = auto), `parallel: off | on`
- plan.md task line: `| size: S|M|L | risk: yes|no`; epic line `model: <family>`
- routing.expectedModel({agent, mode, session, size?, risk?, epicModel?, escalated?}) -> {model: family|null, why}
- routing.parseModels(text) -> {mode, parallel, warning}; parsePlanTasks(text) -> Map<id,{epic,size,risk,epicModel}>; escalatedTasks(events) -> Set; familyOf(id); agentOf(subagentType)
- parseConfig(text) -> adds {models, parallel, modelsWarning}
- `sh .boxbox/pitwall/say escalated "<reason>" --unit <task id>` -> events.jsonl kind `escalated`
- Agent call contract: subagent_type `boxbox:boxbox-<agent>`, description starts with the unit id, `model` = family alias (none under auto)

## Decisions and defaults made while building
- A12 agent test in tests/pitwall/agents.test.js
- A13 setup refresh copies go to boxbox-runner, not the writer
- A14 boxbox-lessons stays on the session model
- A15 (replaces A1) descriptions start with the unit served: task id, epic id, or `setup`
- A16 (replaces A3's form) `say escalated "<reason>" --unit <id>`; no unit, nothing written
- A17 `models: auto` / no line = no Boxbox agents, no model, no escalation (0.6 behaviour)

## Verified
- Agents exist with expected models and tools -> agents.test.js green; `claude plugin validate .`, `.claude-plugin/plugin.json` and `agents` all pass (2.1.296)
- Agents load and run on the routed model -> real headless session in a scratch repo: boxbox:boxbox-scout with model haiku ran on claude-haiku-5-5 using Glob/Grep only; boxbox:boxbox-runner without model fell back to claude-haiku-5-5 ($0.244)
- Routing rule matches the spec table for all four modes, rule order, builder-only overrides -> routing.test.js (8 tests)
- config parses models/parallel; missing = auto; unknown = balanced + warning -> routing.test.js, hook.test.js
- Unknown models: value is shown -> hook.test.js runs the real hook on SessionStart: warning event + agent context
- Plan tags and epic override parsed -> routing.test.js
- `say escalated` writes the event; pre-approved; valid JSON for any text; refuses without unit -> hook.test.js (3 tests)
- Full suite: node --test tests/pitwall/*.test.js -> 84 pass, 0 fail

## Not verified
- A real Boxbox build in Claude Code following the new build skill (routing decisions made by a live main agent, a live escalation): live runs deferred (D5).
- That the skills' prose leads a fresh agent to route correctly: checked by the independent reviewer reading them, not by a run.
- The setup question in a live setup.
- Nothing enforces routing yet: a main agent can still pass the wrong model (E3 adds the gate).

## Cost
Cost: 6.69M tokens for E1 (434k new, 6.25M from cache), about $2.85. Subagents only: this session's own transcript is not registered, because .boxbox/ was created after the session started.

## Outside scope
- none (the pit wall's check). skills/boxbox/SKILL.md and tests/pitwall/agents.test.js were added to E1's files during review.

## Gotchas
- `claude plugin validate .` validates only marketplace.json: validate `.claude-plugin/plugin.json` and `agents` separately.
- `claude agents --json` lists running sessions, not agent definitions.
- say's esc() cut after escaping, so a long reason could end in a lone backslash (invalid JSON): cut first, then escape.
- `models: auto` with Boxbox agents was not "Claude Code decides": with no model passed, the agent file's model wins (spike 2). Under auto Boxbox now uses plain subagents.
- A session started before `.boxbox/` existed is never registered, so its tokens are missing from the pit wall (add to E4).
- Edits made through Bash (heredocs, python) are invisible to the hook, so the pit wall shows those tasks as claimed, not verified: edit with the Edit and Write tools.

## For the next unit
- E2 can rely on: routing.parsePlanTasks, the builder agent expecting a brief, the "unit id first" description rule.
- E3 can rely on: expectedModel / agentOf / familyOf / escalatedTasks; `models: auto` => gate off; escalation events per unit.
- This repo's own .boxbox/ copies (GUIDE.md, pitwall/say) are older than the kit: refresh them, or `say escalated` will still prompt here.
