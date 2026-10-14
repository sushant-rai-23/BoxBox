approved: recorded without a stop, 2026-10-14 (developer asked to build E2-E8 without stops; reviewed with the whole feature)

# Design: E3 Routing gate and escalation enforcement

## Files
- hooks/boxbox-event (bash): Claude Code `PreToolUse` with `"tool_name":"Agent"` or `"Task"` runs node synchronously (like pit wall commands); everything else unchanged. Codex payloads (`"turn_id"`) never take it.
- hooks/routing.js: pure `gateDecision`, `taskOfDescription`, `builderHistory`
- hooks/boxbox-event.js: gathers inputs, prints a deny, logs a `gate` event; maps subagents to tasks at SubagentStart; flags early-escalation triggers from subagent edits
- tests: routing.test.js (decision table), gate.test.js (real bash hook, sync path, timing), hook.test.js (triggers)

## Decision (pure)
```js
gateDecision({
  input,          // tool_input: { subagent_type, description, model? }
  mode,           // config models:
  force,          // CLAUDE_CODE_SUBAGENT_MODEL_FORCE set (and CLAUDE_CODE_SUBAGENT_MODEL set)
  session,        // family of the main session's model, or null
  tasks,          // parsePlanTasks(plan.md of state.md's feature)
  history         // builderHistory(events): Map<task, { runs, escalatedAt, runsAfterEscalation, triggered }>
}) -> { decision: "skip" | "off" | "allow" | "deny", reason, task, expected }
```
Order:
1. Not a `boxbox:*` agent -> skip (no event).
2. FORCE on -> off, "CLAUDE_CODE_SUBAGENT_MODEL_FORCE is on: Claude Code picks every subagent's model".
3. `models: auto` -> off, "models: auto".
4. Description must start with the unit: builder `E2.3`, others `E2.3`, `E2` or `setup` -> else deny "start the description with the task id, like \"E2.3 <what>\"".
5. Builder history for the task:
   - escalated and already ran once since -> deny "E2.3 was escalated and failed again: stop and tell the developer".
   - not escalated and (2 runs, or a trigger) -> deny "E2.3 <failed twice | edited outside its brief | ...>: run say escalated, then boxbox-builder with model <session>".
6. expected = expectedModel(...). If expected is the session model and the session is unknown -> allow, reason "session model unknown" (fail open, D4).
7. familyOf(input.model) !== expected -> deny "<why>: run boxbox-<agent> with model <expected>" (e.g. "E2.3 is risk: yes, run boxbox-builder with model opus").
8. else allow.
Any thrown error -> the hook allows and logs `gate-error` (D4).

## Events (events.jsonl)
- `{kind:"gate", id:<tool_use_id>, target:<subagent_type>, unit:<task>, result:"allow"|"deny"|"off", why:<reason>, model:<requested>, expected}`
- `{kind:"crew", result:"started", sub:<agent_id>, unit:<task>}`: task from `agent-<id>.meta.json` toolUseId joined to the gate event id (A4)
- `{kind:"escalate-needed", unit:<task>, sub:<agent_id>, target:<reason>}`: an edit outside the brief's files, or the 5th edit of one file with no passing test since
- `{kind:"gate-error", target:<message>}`

A builder run = a `gate` event with result allow for a builder on that task. A deny is printed as
`{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"<reason>"}}`; an allow prints nothing (never auto-approves).

## Session model
The last `message.model` in the main transcript's final 256 KB, as a family.

## Not covered by the gate
- Diff more than 3x the expected size: the hook does not see diffs; the build skill checks it from the builder's commit.

## Alternatives
- Gate allows by printing permissionDecision allow: would skip the developer's permission prompts; rejected.
- Count failures from `say failed` events: another verb to forget; a third builder call already means two attempts did not finish the task; rejected.
- Read the session model from settings: wrong under /model switches; the transcript is what ran.

## Changed during build and review (2026-10-14)
- A run is a builder subagent that finished on the task (crew finished, tied to its task through agent-<id>.meta.json, verified live), not a gate allow. A task's history starts again at its latest `build` stage, so earlier features and pre-review runs do not count.
- No tasks in plan.md: builder calls are allowed, "not checked". A task id the plan does not list is denied.
- Session model: transcript, then this session's model recorded at the end of its last turn (Stop). Settings and ANTHROPIC_MODEL are not used (they can disagree with --model and /model); unknown means not checked.
- The gate reads events.1.jsonl too, so escalation state survives a log rotation.
- The 5-edit trigger counts only successful edits to code files; any test command that exits 0 counts as green.
- File paths never appear in the say command a deny reason suggests.
