# Report: E8 Release 0.7.0
status: approved, 2026-10-14 (developer asked to build E2-E8 without stops; reviewed with the whole feature)
branch: model-routing-e8-release
pr: none (gh not installed)

## Commits
- a169752 release review: no Boxbox agents under auto anywhere; escalation history survives a resume; brief folders and globs; stale kit notice; README claims match what was checked
- e0f7256 E8.1 Codex regression: no gate, no Claude-only state, rollout tokens as in 0.6
- 9d8ea0c E8.2 README: model routing, task briefs, the gate, cost by model, Claude Code vs Codex, what is not yet verified live
- 6828aab E8.3 version 0.7.0 everywhere

## Built
- tests/pitwall/codex.test.js: a Codex PreToolUse (spawn_agent, and even Agent/Task with turn_id) prints nothing and logs no gate event; Codex SessionStart gets no models warning; Codex sessions register at SessionStart, never as late; no session-model cache; Codex rollout tokens per model with no price and no savings
- README: Home, Telemetry and Timing rows; Models and Parallel settings; "Cheaper models, same judgement (Claude Code)" with the agent table, briefs, gate, escalation, cost, status line, parallel; Claude Code vs Codex table; the not-yet-verified-live list (D5); Status 0.7.0
- tests/pitwall/release.test.js and version 0.7.0 in .claude-plugin/plugin.json, .claude-plugin/marketplace.json, .codex-plugin/plugin.json, .cursor-plugin/plugin.json
- This repo's own .boxbox/ refreshed from the kit (board, assets, templates, pitwall, GUIDE)

## Verified
- Whole-release review (separate agent): 1 must fix (auto still used Boxbox agents in report, brief and refresh steps), 4 should fix; all fixed in a169752
- Full suite 144 pass
- `claude plugin validate .`, `.claude-plugin/plugin.json` (also --strict) and `agents`: Validation passed (Claude Code 2.1.296)
- No 0.6.0 left in tracked files outside docs/design

## Not verified
- A live Codex session with 0.7 (as in 0.6, Codex is built from its docs and unverified end to end)

## Cost
Cost: the pit wall's E8 figure (3.96M tokens, about $1.67) is mostly the release-wide review subagent, which ran during E8's stages. The release page's writer ran under unit M1. Subagents only (this session's own transcript is not registered by the 0.6 hooks it runs under).

## Outside scope
- none

## Gotchas
- None new.
