---
name: boxbox-resume
description: Pick up Boxbox work in a new session, with a different model, or after a pause. Use when the developer says continue, resume, go, approved or where were we, when .boxbox/state.md shows work in progress, or when the developer asks to pause or hand off.
---

# Boxbox resume

Everything needed to continue is in files. Trust the files and the git history, not memory.

## To resume

1. Read `.boxbox/GUIDE.md`, `state.md`, `config.md`, `lessons.md`, then the current feature's `plan.md` and `context.md`, and the last `report.md` if there is one.
2. Check reality against `state.md`:
   - `git status` and `git branch --show-current`: right branch, clean tree outside `.boxbox/`?
   - `git log --oneline -10`: do the commits match the tasks marked done?
   - Run the test command: still green?
3. Tell the developer where things stand in at most five lines: feature, phase, current unit, what was last approved, and the one next action.
4. If files and git disagree (a task marked done with no commit, uncommitted changes, a failing suite), say exactly what differs and ask before fixing anything.
5. Continue with the skill for the phase:

| `phase` in state.md | Do |
| --- | --- |
| `none` | wait for a request, then **boxbox** |
| `discover` | **boxbox-discover** |
| `decisions` | **boxbox-plan**, from the unanswered decisions |
| `plan-review` | wait for the developer's "go" or changes |
| `design-review` | wait for approval or changes to the design, then **boxbox-design** step 4 |
| `build` | **boxbox-build** for the unit named in `unit`, from its first task not done |
| `unit-review` | wait for approval or changes, then **boxbox-report** step 6 |
| `done` | summarise and ask what is next |

If `waiting_for_developer: yes`, do not build anything. Say what you are waiting for and where the page is.

## To pause or hand off

Before stopping mid-work:

1. Leave the tree clean: commit finished work; for half-done work, tell the developer and let them choose to commit it as work in progress or leave it.
2. Rewrite `state.md` fully. In `notes`, put anything a fresh session could not work out from the files: what you were in the middle of, what you had just learned, what you were about to try.
3. Update `board-data.js`.
4. Tell the developer the one line to say to continue: "continue the <feature> work".
