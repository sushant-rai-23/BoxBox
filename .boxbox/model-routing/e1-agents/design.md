approved: yes, 2026-10-14

# Design: E1 Routing config and fixed-model agents

## Files
- new `agents/boxbox-builder.md`, `agents/boxbox-scout.md`, `agents/boxbox-runner.md`, `agents/boxbox-writer.md`
- new `hooks/routing.js`: pure, zero-dependency; used by tests now and by the gate (E3)
- changed `hooks/boxbox-event.js`: `parseConfig` returns `models`, `parallel` and `modelsWarning` by calling `routing.parseModels` (the one owner of the missing/unknown rule); `SAY_FORM` (boxbox-event.js:262) also pre-approves `say escalated`
- changed `skills/boxbox-setup/kit/pitwall/say`: new verb `escalated`
- changed skills: setup (ask `models:`), plan (size/risk tags, epic `model:`), build (route, escalate), tdd/inspect/report/lessons (who runs what), kit `GUIDE.md` (config block, task line, `escalated` event)

## Agent files (plugin agents load as `boxbox:<name>`)
```yaml
# agents/boxbox-builder.md
name: boxbox-builder
description: Builds one Boxbox task test-first from its brief, commits, returns diff summary and test result.
model: sonnet          # fallback only; Boxbox passes `model` on every call (D1)
tools: Read, Edit, Write, Bash, Grep, Glob
# scout:  model: haiku,  tools: Read, Grep, Glob             (never edits)
# runner: model: haiku,  tools: Read, Edit, Bash, Grep, Glob (mechanical fixes only)
# writer: model: sonnet, tools: Read, Write, Edit, Bash, Grep, Glob (fills templates, runs checker)
```
Each body: a short strict prompt with a "Never" list (builder: files outside the brief, `.boxbox/`; scout: any edit; runner: behaviour or logic; writer: inventing facts, label unknown instead).

## Config (`.boxbox/config.md`)
```
models: best | balanced | save | auto     # missing line (0.6 repos) = auto; unknown value = balanced + warning
parallel: off | on                         # default off
```

## Plan task line and epic override (`plan.md`)
```
- [ ] E2.3 <what changes> | size: S|M|L | risk: yes|no | test: <first test> | done: <check> | deps: <ids>
## E3 <title>  [todo]
model: opus            # optional per-epic override for builder tasks
```
Missing `size` = M, missing `risk` = no.

## hooks/routing.js
```js
type Mode = "best" | "balanced" | "save" | "auto";
type Agent = "builder" | "scout" | "runner" | "writer";
type Family = "opus" | "sonnet" | "haiku" | "fable";

parseModels(configText: string): { mode: Mode, parallel: boolean, warning: string | null }
parsePlanTasks(planText: string): Map<taskId, { epic: string, size: "S"|"M"|"L", risk: boolean, epicModel: Family | null }>
escalatedTasks(events: object[]): Set<taskId>          // events with kind "escalated"
familyOf(modelId: string): Family | null               // "claude-opus-5-5[1m]" -> "opus"
agentOf(subagentType: string): Agent | null            // "boxbox:boxbox-scout" -> "scout"; others -> null
expectedModel(q: { agent: Agent, mode: Mode, session: Family,
                   size?: "S"|"M"|"L", risk?: boolean, epicModel?: Family | null, escalated?: boolean })
  : { model: Family | null, why: string }               // null = pass no model (auto)
```

Rules for `expectedModel`, first match wins:
1. mode `auto` -> null, "models: auto"
2. builder and escalated -> session, "escalated"
3. builder and epicModel -> epicModel, "epic override" (beats `save` on purpose: the developer asked for it by name)
4. builder and (risk or size L) -> session (save: sonnet), "risk: yes" / "size: L"
5. mode table:

| agent | best | balanced | save |
| --- | --- | --- | --- |
| builder | session | sonnet | sonnet |
| scout | session | haiku | haiku |
| runner | session | haiku | haiku |
| writer | session | sonnet | haiku |

## say
```
sh .boxbox/pitwall/say escalated "<one-line reason>" --unit E2.3
-> events.jsonl {"type":"escalated","kind":"escalated","lane":"driver","target":"<reason>","unit":"E2.3",...}
```

## Call contract (skills)
```
Agent(subagent_type: "boxbox:boxbox-builder", description: "E2.3 <short>", model: <expectedModel>, prompt: <task hand-off>)
```
Under `auto`, no `model`. Discover, decisions, plan, design, briefs, inspect, fact-check and approvals are never handed to these agents.

## Path
1. Setup asks `models:` (balanced recommended) and writes it to config.md; `parallel: off` is written and mentioned.
2. boxbox-plan writes each task with size and risk; "use opus for E3" adds `model: opus` under E3.
3. boxbox-build, per task: reads config, the task tags and escalation state, computes the model with the table above, calls `boxbox:boxbox-builder` with `model` and the task id in the description.
4. Escalate when the builder fails the task twice, or early when: its diff is more than 3x the expected size (from the brief, E2; from the size tag until then: S 50, M 150, L 400 changed lines), it edits a file outside the task's files, or it edits the same file 5 times without the test going green. Run `say escalated`, retry once with the session model. A failure there stops and asks the developer. E1 applies these in the build skill; E3 enforces them in the gate.
5. Scout and runner calls get their model the same way; report page-filling goes to the writer.

## Alternatives
- Routing rules as prose in the build skill only: no shared code for the gate and tests to check against; rejected.
- Size/risk in a JSON sidecar written by plan: second source of truth; rejected (A2).
- Return full model ids instead of family aliases: the Agent tool takes aliases and ids change each release; rejected.
- Missing `models:` = balanced: silently changes cost behaviour for 0.6 repos on update; rejected for `auto`.

## Locked in
Agent names (`boxbox:boxbox-builder` etc.), the four mode names, the task-line tags, the `escalated` event kind, the "task id first" description prefix (read by the E3 gate and the E4 cost attribution).
