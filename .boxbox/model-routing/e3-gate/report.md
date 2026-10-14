# Report: E3 Routing gate and escalation enforcement
status: approved, 2026-10-14 (developer asked to build E2-E8 without stops; reviewed with the whole feature)
branch: model-routing-e3-gate
pr: none (gh not installed)

## Commits
- e9c4e78 E3.1 Claude Code Agent and Task calls pass a synchronous routing gate
- c59b87e E3.2 the gate denies a wrong model or a missing unit with the agent and model to use
- bd70c15 E3.3 the gate stands aside under models: auto and FORCE, and says why
- b748fbd E3.4 a gate that cannot judge a call allows it and logs gate-error
- 81df492 E3.5 two failed builder runs or an early trigger require one escalation to the session model
- 750429b session model found before the transcript is on disk (found by a live check)
- dc2ecdc review: history from finished runs per build stage; unchecked without a plan; unknown task ids denied; no settings guess; TDD-safe trigger; rotated log read

## Built
- hooks/boxbox-event (bash): Claude Code PreToolUse for Agent/Task runs node synchronously; Codex (turn_id) and all other calls unchanged
- hooks/routing.js: taskOfDescription, builderHistory, gateDecision
- hooks/boxbox-event.js: runGate (deny JSON, gate event, never prints allow), sessionModel/sessionFamily (transcript, then Stop-time cache), subagentTask (meta.json toolUseId -> gate event), checkTriggers (outside brief, 5 code edits without green), readEvents (incl. events.1.jsonl), top-level gate-error on a crash, `sub` on subagent events, Stop writes live/session-model.json
- GUIDE "The gate"; build skill "if a call is denied by Boxbox routing"
- docs/routing-spike.md: FORCE without a model drops the call's model

## Interfaces added or changed
- events: gate {id, target, unit, result allow|deny|off, why, model, expected, note?}, gate-error, escalate-needed {unit, target}, crew events carry unit (task) and sub
- live/session-model.json {session, family}
- deny: hookSpecificOutput.permissionDecision "deny", reason "Boxbox routing: <reason>"

## Decisions and defaults made while building
- A run = a builder subagent that finished on the task; history restarts at the task's `build` stage
- No plan tasks: not checked (allow); unknown task id: deny
- Session model never guessed from settings/env
- Diff-over-3x stays in the build skill (plan accept line reworded)

## Verified
- Live, Claude Code 2.1.296, scratch repo, models: balanced, E1.1 risk: yes: builder on haiku denied "E1.1 is risk: yes, run boxbox-builder with model opus"; the agent retried on opus and it was allowed ($0.42 + $0.23)
- Live: SubagentStart crew event got unit E1.1 (meta.json exists at SubagentStart)
- Tests (all through the real bash hook or node script where it matters): sync path, deny table, FORCE/auto off, plain env note, fail open (no plan, cut payload), session model not from a tool input, turn cache, escalation flow end to end with simulated SubagentStart/Stop, triggers (outside brief, 5 edits), TDD work does not trigger, no file path in the suggested command
- Full suite 108 pass

## Not verified
- A live escalation (two real builder failures, then an opus retry) (D5)
- Codex: only the turn_id exclusion is tested here; E8 runs the Codex fixture through every changed path
- Rotation: readEvents reads events.1.jsonl; no test rotates a 5 MB log

## Cost
Cost: 1.40M tokens for E3 (108k new, 1.29M from cache), about $0.80. Approximate; subagents and this session's logged calls only.

## Outside scope
- skills/boxbox-setup/kit/GUIDE.md, skills/boxbox-build/SKILL.md, docs/routing-spike.md, tests/pitwall/hook.test.js (all needed by the gate's contract)

## Gotchas
- In a session's first turn, PreToolUse fires before Claude Code flushes the transcript: the session model is unknown there. Found live; the Stop hook now records it for later turns.
- say stamps whole seconds; file order, not timestamps, orders events.
- A test that only checks stdout hid a fail-closed path (no plan); assert the gate event's reason too.

## For the next unit
- E4 can rely on: crew events with unit and sub; subagentTask(); the meta.json join is verified live.
- E5 can show: gate, gate-error, escalate-needed, escalated events; the `note` about CLAUDE_CODE_SUBAGENT_MODEL.
- Left alone: a denied Agent call still logs a crew "start" event; FORCE=inherit message wording; a description naming a different cheaper task in the plan is not detected.
