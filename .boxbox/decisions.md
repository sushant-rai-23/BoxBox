# Decisions

Every decision for this project, newest last. Never delete a row; add a new one that replaces it.

| Id | Feature | Question | Choice | Why | Decided by | Date | Change later |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | model-routing | How does Boxbox set a subagent's model? | Always pass `model` on each Agent call (except `models: auto`); agent files hold balanced models as fallback; the gate checks equality | Only option where best/balanced/save work from one plugin; gate independent of Claude Code's resolution order | developer | 2026-10-14 | costly |
| D2 | model-routing | Skill `model:` lines or the writer subagent for template work? | Writer subagent only; no skill gets a `model:` line | Skill frontmatter is fixed per plugin and lasts the whole turn, so it cannot follow the mode | developer | 2026-10-14 | easy |
| D3 | model-routing | How do parallel worktree builders start from the epic branch? | Require `worktree.baseRef: "head"` in project .claude/settings.json (setup asks when parallel is turned on); parallel refuses without it | Documented setting, verified in Step 0, fails loudly | developer | 2026-10-14 | easy |
| D4 | model-routing | Routing gate on internal error: allow or deny? | Fail open: allow, and log a `gate-error` event shown on the pit wall | The gate protects money, not control; a wrongly blocked session is the top risk | developer | 2026-10-14 | easy |
| D5 | model-routing | What does done mean with live demo runs deferred? | Ship 0.7.0 on tests alone; README marks live-only items "not yet verified in a live session" | Developer: "no demo for now" | developer (override) | 2026-10-14 | easy |
| A1 | model-routing | How does the gate know a call's task? | Builder/runner call descriptions start with the task id ("E2.3 ..."); calls without one are denied with that reason | Parallel builders share one current unit | agent (default) | 2026-10-14 | easy |
| A2 | model-routing | Where do size, risk and epic overrides live? | Task line `\| size: M \| risk: yes`; epic line `model: opus` in plan.md | plan.md is already the source of truth | agent (default) | 2026-10-14 | easy |
| A3 | model-routing | How is escalation recorded? | `say escalated --unit E2.3 --why "..."` -> events.jsonl kind `escalated`; the gate reads it | Reuses the say channel | agent (default) | 2026-10-14 | easy |
| A4 | model-routing | How are subagent tokens attached? | Register transcript at SubagentStart from the derived path; task from meta.json toolUseId joined to the Agent call | SubagentStart has no path (spike 5) | agent (default) | 2026-10-14 | easy |
| A5 | model-routing | How is "saved" estimated? | Re-price subagent tokens at the session model's rates, labelled estimate | Simplest honest counterfactual | agent (default) | 2026-10-14 | easy |
| A6 | model-routing | Where does the status line live? | kit/pitwall/statusline (node), installed in project .claude/settings.json after asking, pre-approved | Plugins cannot ship it (spike 9) | agent (default) | 2026-10-14 | easy |
| A7 | model-routing | Worktree folder in git status | Setup adds .claude/worktrees/ to .gitignore when parallel is on | Seen untracked in spike 7 | agent (default) | 2026-10-14 | easy |
| A8 | model-routing | Test fixtures | Trimmed copies of the Step 0 transcripts, prompts reduced to "ping" | Real data, no private content | agent (default) | 2026-10-14 | easy |
| A9 | model-routing | Codex hooks | hooks-codex.json unchanged; Codex gets task briefs only | Spec: Codex as in 0.6 | agent (default) | 2026-10-14 | easy |
| A10 | model-routing | Model chip text | Family name (opus/sonnet/haiku), full id on hover | Fits a feed row | agent (default) | 2026-10-14 | easy |
| A11 | model-routing | GUIDE config block | Replace unused `models: plan/build/report` with `models: best\|balanced\|save\|auto` and `parallel: off\|on` | Nothing reads the old block | agent (default) | 2026-10-14 | easy |
