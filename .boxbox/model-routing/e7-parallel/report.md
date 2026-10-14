# Report: E7 Parallel tasks
status: approved, 2026-10-14 (developer asked to build E2-E8 without stops; reviewed with the whole feature)
branch: model-routing-e7-parallel
pr: none (gh not installed)

## Commits
- 0c9353c E7.1, E7.2 pick tasks that can build together; worktree builders need parallel: on and worktree.baseRef head
- a2ce515 E7.3 parallel builds in worktrees, checked, merged back in plan order on a temporary branch, falling back to one at a time
- d14411c review: worktree edit paths map to repo files; settings order for baseRef; paths compared as paths; subagent events keep their own task; worktree rule before the no-plan shortcut

## Built
- hooks/routing.js: parsePlanTasks reads `deps`; parallelBatch (plan order, deps done, briefs written, no shared file or folder, at most 3); parallelReady (parallel: on and worktree.baseRef "head", local settings before project, unreadable settings refused); gateDecision denies a worktree builder when not ready
- hooks/boxbox-event.js: reads the settings files for the gate; strips `.claude/worktrees/<name>/` from edit paths; a subagent's events take its own task from its crew start
- boxbox-build "Parallel tasks": readiness, briefs for the batch (the one exception to writing briefs ahead), start together with isolation worktree, per-builder checks (diff, scope, base is the epic, exactly one commit), cherry-pick in plan order on `<epic>-batch`, full suite once, fast-forward, fall back one at a time on conflict or red, tidy worktrees, keep task branches for the developer
- boxbox-setup: turning parallel on asks before writing baseRef (project or local), needs models other than auto, ignores .claude/worktrees/
- GUIDE: a Parallel tasks paragraph

## Decisions and defaults made while building
- Merge on a temporary `-batch` branch and fast-forward: no history rewrite; deleting the local scratch branch needs no question
- A builder with 0 or more than 1 commit leaves the batch and is built alone

## Verified
- Tests: parallelBatch (deps, order, epic, missing brief, overlap, ./ and folder paths, cap 3), parallelReady (off, missing, wrong value, local over project, bad JSON), gate deny for worktree builders through the real bash hook, worktree edit paths, subagent unit tagging
- Live (Claude Code 2.1.296, scratch repo): PreToolUse tool_input carries `isolation: "worktree"`; a worktree subagent's hooks run in the worktree with CLAUDE_PROJECT_DIR = main checkout (docs/routing-spike.md section 7)
- Real git in a scratch repo: a clean batch lands one commit per task in plan order; a conflict leaves the epic untouched and the tree clean; the commit-count and merge-base checks catch 2 commits, 0 commits and a wrong base
- Full suite 138 pass

## Not verified
- A live parallel run with two Boxbox builders and a merge (D5)
- One full-suite run out of about twenty showed one failing test under heavy machine load; it did not reproduce in 13 later runs (likely a timing test; see gotchas)

## Cost
Cost: 1.07M tokens for E7 (79k new, 986k from cache), about $0.59. Approximate; subagents and this session's logged calls only.

## Outside scope
- docs/routing-spike.md (worktree hook facts), hooks/boxbox-event.js, tests/pitwall/hook.test.js

## Gotchas
- `git cherry-pick <branch>` takes only the tip commit: the skill now checks the count first.
- node --test runs test files in parallel: a median wall-time check measured the machine's load; the status line test now uses the best of 7 runs.

## For the next unit
- E8: the README lists parallel as Claude Code only and not verified live.
