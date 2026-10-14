---
name: boxbox-build
description: Build one approved unit of a Boxbox plan, test-first, then verify and review it. Use after the developer approves the plan or approves the previous unit, or when they ask to build, implement or continue the next epic or task. Builds only the current unit, never the next one.
---

# Boxbox build

Build exactly one unit: one epic, or one task if the unit of control is task. Then hand over to **boxbox-report** and stop.

Read `.boxbox/GUIDE.md`, `config.md`, `lessons.md`, `state.md`, and the feature's `plan.md` and `context.md` first.

## Before you start

- Confirm in `state.md` that the plan is approved and the previous unit, if any, is approved. If not, stop and ask.
- If the unit is marked `design: yes` in `plan.md`, confirm its design is approved. If not, use **boxbox-design** first. Build to the approved shapes.
- Confirm no task in this unit is `blocked` by a parked decision. If one is, tell the developer and ask whether to decide it now or skip that task.
- Check the working tree is clean outside `.boxbox/` and the agent instruction file setup touched; Boxbox's own uncommitted files are expected. If the developer has other uncommitted work, ask what to do with it. Never stash, reset or discard their work on your own.

## Branches

Follow the git model in `GUIDE.md`.

- First unit of a feature: create the feature branch from the main branch. Set `branch` in `state.md` and `plan.md`, then make one commit on it, `Boxbox: plan for <feature>`, with the whole `.boxbox/` folder and the agent instruction file.
- Unit = epic: create the epic branch from the feature branch.
- Unit = task: work on the feature branch.

Update `state.md` (`phase: build`, `unit: E1 in_progress`) and set the unit to `in_progress` in `board-data.js` and in its heading in `plan.md`.

From here until the review stop, `.boxbox/` changes stay uncommitted. Task commits hold code and tests only.

## For each task, in order

0. **Check for a pause, then say the stage.** If `.boxbox/live/PAUSE` exists, the developer paused from the pit wall: update `state.md` (`next: continue <task id>`), say you are paused, and wait for "continue". Do not start the task. Otherwise run `sh .boxbox/pitwall/say stage build --unit <E1.2> --why "<the task's first test>"`.
1. **Write the brief.** If `.boxbox/templates/brief.md` is missing (a repo set up before 0.7), refresh the kit first as **boxbox-setup** describes. Copy `.boxbox/templates/brief.md` to `.boxbox/<feature>/<unit>/tasks/<task id>.md` and fill it now, from the task line and the code as it is at this moment (see "Task briefs" in `GUIDE.md`). Never write briefs ahead, at plan time or for later tasks. The brief needs the exact excerpts and `path:line` of every function the task touches. If you have already read those files in this session and they have not changed since, copy the excerpts yourself: starting a subagent costs more than that. If they span files you have not read yet, in Claude Code ask `boxbox:boxbox-scout` for them (under `models: auto`, a plain subagent, or read them yourself) and paste what it returns. Writing the brief is judgement: you write it, on the session model. Add `"brief"` to the task in `board-data.js`.
   **Fresh context if you can.** If your agent can run subagents, give each task to a fresh one. Hand it only, in this order: (a) the fixed part: the rules of `GUIDE.md` and **boxbox-tdd**, and the conventions and commands from `context.md`, the same text for every task of the feature, with no timestamps or counters in it; (b) the brief. Do not hand it this conversation. If you cannot run subagents (Codex), build from the brief yourself: re-read it before starting and keep to its files.
   - **In Claude Code, use Boxbox's agents and route them** (see "Model routing" in `GUIDE.md`), unless `config.md` says `models: auto` or has no `models:` line: then use a plain fresh subagent as above, pass no model, and skip escalation. Otherwise build with `boxbox:boxbox-builder`; send searches for excerpts to `boxbox:boxbox-scout` and check runs to `boxbox:boxbox-runner`. Work out each call's model from `models:`, the task's `size` and `risk` tags, its epic's `model:` line and whether it was escalated, and pass it as `model`. Start every description with the task id: `"E1.2 tokens expire"`. Ask for a foreground run (`run_in_background: false`) unless the task can wait.
   - **Never hand these to a Boxbox agent or a cheaper model:** discover, decisions, plan, design, writing task briefs, inspect, the page fact-check, any approval. They stay with you on the session model.
   - **Escalate, once** (not under `auto`). Retry on the session model when the builder failed the task twice, or as soon as its diff is more than 3 times the expected size (S 50, M 150, L 400 changed lines, or the brief's estimate), it edited a file outside the brief's `files`, or it edited the same file 5 times without the test going green. First run `sh .boxbox/pitwall/say escalated "<one-line reason>" --unit <E1.2>`, then call the builder again with the session model. If it fails on the session model too, or the builder already ran on the session model, stop: update `state.md`, tell the developer what was tried and what failed, and wait. Never escalate a task twice and never push through.
   - **If a call is denied by "Boxbox routing",** read the reason and do exactly what it says (another model, the task id first, `say escalated`, or stop). Never work around the gate by switching to a plain subagent.
   - **The builder's commit is the task's commit.** Then steps 2 and 4 are its work: read its diff yourself and run step 3's checks on its commit. If a check fails, the task is not done: send it back to the builder (that counts as a failure) or escalate. Never add a second commit for the task on top of a builder's without saying so in the report.
2. **Test first.** Follow **boxbox-tdd**: write the test, watch it fail for the right reason, write the least code that passes.
3. **Run every check.** The full test suite, the linter and the type checker from `config.md`. All green before you go on.
4. **Commit.** One commit per task, holding that task's code and tests and nothing from `.boxbox/`: `E1.2: tokens expire after 15 minutes`. Never commit with a failing check.
5. **Tick it off.** Mark the task done in `plan.md` and `plan.html` (`data-st="done"` on the task's `li`), and set its status and commit hash in `board-data.js`. Keep the epic's status mark on `plan.html` current. Leave these uncommitted. Set it to `done`, never "verified": the pit wall marks it verified only if it saw the passing test run itself after the task's last edit.

A task with no cheap test: do it, verify it the way the plan says, and record exactly what you observed.

## Parallel tasks (Claude Code, `parallel: on`)

Off by default. When `config.md` says `parallel: on` (and `models:` is not `auto`), independent tasks of the current epic can build at the same time, each in its own worktree. See "Git worktrees and merging" in `.boxbox/knowledge/` if it exists.

1. **Check it can run.** `"worktree": {"baseRef": "head"}` must be set in `.claude/settings.local.json`, or in `.claude/settings.json` when the local file does not set `baseRef` (Claude Code reads the local file first). Without it, worktrees start from the default branch and miss the epic's earlier commits, and the routing gate denies worktree builders. If it is missing, say so once and build one task at a time.
2. **Pick the batch.** In parallel mode only, write the briefs of the candidate tasks before starting them: this is the one exception to "never write briefs ahead", and each brief is still written from the code as it is now. A batch is the tasks, in plan order, whose `deps` are all done and whose briefs' `files` share no file and no folder, at most 3. Apply this rule by hand; it is `parallelBatch` in the plugin's `hooks/routing.js`. One task is not a batch: build it as usual.
3. **Start them together.** For each task: `say stage build --unit <task id>`, then one `boxbox:boxbox-builder` call with `isolation: "worktree"`, its `model`, and the task id first in the description, all in the same message so they run at once. Each builder commits on its own branch; the Agent result names `worktreeBranch` and `worktreePath`. The pit wall shows each one as its own lane.
4. **Check each builder before merging anything.** Note the epic branch's commit, `<base>`. For each task, as in step 1 above: read its diff, check its size against the brief and that it stayed in the brief's `files`. Then check its branch:
   - `git merge-base --is-ancestor <base> <task branch>` must succeed: the worktree started from the epic. If not, the base setting did not hold: stop parallel mode and say so.
   - `git rev-list --count <base>..<task branch>` must be `1`. `0` means the builder failed: that task leaves the batch and is built one at a time later (it counts as one failure for escalation). More than `1`: leave the task out the same way, never cherry-pick part of it.
5. **Merge back in plan order, without rewriting anything.** The tasks that passed step 4:
   ```
   git switch -c <epic branch>-batch
   git cherry-pick <task branch>        # once per task, in plan order: one commit per task
   <full test command from config.md>
   git switch <epic branch> && git merge --ff-only <epic branch>-batch && git branch -d <epic branch>-batch
   ```
   The epic branch only moves forward. The `-batch` branch is a local scratch copy, never pushed, so deleting it is not rewriting history and needs no question.
6. **On any conflict or a red suite:** `git cherry-pick --abort` if one is in progress, switch back to the epic branch, delete the `-batch` branch (`git branch -D`), and stop parallel mode for this epic: build the rest one task at a time, including every task of the failed batch, from their briefs, on the epic branch as usual (escalation then works as above). Record it as a gotcha in the report: which tasks, which file conflicted or which test failed.
7. **Tidy up.** After the batch is merged or abandoned, `git worktree remove <worktreePath>` for each task. If git refuses because the worktree has leftover files, leave it and list it in the report. Keep the `worktree-agent-*` branches; the report lists them, and deleting them after approval is the developer's call.
8. Escalation, the gate and ticking off work per task exactly as above. A task built in a batch that later fails is rebuilt one at a time, never in a new batch.

## When something goes wrong

- A test fails and you do not know why: use **boxbox-debug**. Do not guess at fixes.
- A small deviation from the task's wording that keeps its behaviour and acceptance criteria (a helper lands in a later task, a file gets a different name): carry on, and record it as a default (next A id) in `decisions.md` and in the defaults table on `decisions.html`, so the report mentions it.
- A task is much bigger than planned, an acceptance criterion cannot be met, or tasks need adding or removing: stop. Tell the developer what you found and re-plan that epic with **boxbox-plan**. Do not push through.
- You need to do something on the "Ask first, always" list in `GUIDE.md`: stop and ask.
- You see something worth doing outside the task: add it under "Later" in `plan.md` and move on.
- You must edit a file outside the epic's `files`: do it only if the task needs it, and say so in the report. The pit wall flags it for the developer either way.
- A new decision comes up: if it is easy to change, choose, and record it as a default the same way. Otherwise stop and ask it like any other decision, and add its card to `decisions.html`.

## When all tasks in the unit are done

1. **boxbox-verify**: prove the unit meets every acceptance criterion by running it, and prove each failure mode is handled.
2. **boxbox-inspect**: have a separate reviewer check the whole diff. Fix what it finds, as new commits, and re-run the checks.
3. **boxbox-report**: write the report, open the code for the developer, and stop.

**Never start the next unit.** The developer's approval of this one is the only thing that starts it.
