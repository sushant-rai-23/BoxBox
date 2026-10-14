# Report: E6 Status line
status: approved, 2026-10-14 (developer asked to build E2-E8 without stops; reviewed with the whole feature)
branch: model-routing-e6-statusline
pr: none (gh not installed)

## Commits
- 02a0b53 E6.1 status line from .boxbox/live: task, model, cost, tests; paused; your move
- 43d83f9 E6.2 setup asks before adding the status line to the project's settings
- 1c829d4 review: no control characters; this session's agent, tests and stage only; answered questions and stale agents drop out; PAUSING until held; cost labelled session; setup reads local and global settings and guards the command
- fddd3fc review: an answer in the question tool clears the waiting card (pit wall too)

## Built
- skills/boxbox-setup/kit/pitwall/statusline (node): reads stdin from Claude Code and the end of .boxbox/live/events.jsonl, stage.json, waiting.json, PAUSE, held
- boxbox-setup question 7: project (.claude/settings.json) or just me (.claude/settings.local.json); reads local, project and global settings (never writes global); guarded command `[ ! -f .boxbox/pitwall/statusline ] || node .boxbox/pitwall/statusline`; a check that must print a line
- hook: PostToolUse of AskUserQuestion deletes waiting.json
- GUIDE folder map lists statusline

## Interfaces added or changed
- Line forms: `<unit> · <agent> <model> · session $X · <n/m tests | tests failing>`, `PAUSING|PAUSED · <unit> · session $X`, `Your move: <what> · session $X`

## Decisions and defaults made while building
- A22 no pre-approval needed (Claude Code runs it itself)
- The cost shown is Claude Code's session cost, labelled "session" (the pit wall has the exact per-unit, per-model numbers)
- Status line differs from the spec example by the word "session"

## Verified
- statusline.test.js: 7 tests incl. the main line in under 50 ms (median of 5), paused vs pausing, your move until the agent acts, stale stage, stale agent, other session's tests ignored, tests failing, no control characters, nothing without .boxbox or on bad input
- Real data in this repo: `E6 · session $0.00 · 126/126 tests`
- The guarded command from a subfolder exits 0 with no output
- Full suite 131 pass

## Not verified
- In a live Claude Code CLI session with this kit (the command itself was shown working in Step 0, section 9)
- The VS Code extension (spike: not verified there)
- Whether Claude Code started in a subdirectory loads the root project's settings (the guard makes either case quiet)

## Cost
Cost: 879k tokens for E6 (77k new, 801k from cache), about $0.55. Approximate; subagents and this session's logged calls only.

## Outside scope
- hooks/boxbox-event.js, tests/pitwall/hook.test.js (the waiting card fix)

## Gotchas
- Node starts in about 20-30 ms here: the 50 ms budget leaves room only for small tail reads.
- This repo's own .boxbox/ copies (pitwall/, GUIDE.md, templates/) predate 0.7: refresh them before using the status line here (E8).

## For the next unit
- E7: worktrees have no .boxbox/live (it is git-ignored), so the status line there falls back to the session model and cost.
