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
1. **Fresh context if you can.** If your agent can run subagents, give each task to a fresh one. Hand it only: the task line from `plan.md`, the epic's acceptance criteria and failure modes, the conventions and commands from `context.md`, the decisions that apply, and the rules of **boxbox-tdd**. Do not hand it this conversation. If you cannot run subagents, do the task yourself and re-read the task line before starting.
   - **In Claude Code, use Boxbox's agents and route them** (see "Model routing" in `GUIDE.md`). Build with `boxbox:boxbox-builder`; send searches for excerpts to `boxbox:boxbox-scout` and check runs to `boxbox:boxbox-runner`. Work out each call's model from `models:` in `config.md`, the task's `size` and `risk` tags, its epic's `model:` line and whether it was escalated, and pass it as `model` (pass none under `models: auto`). Start every description with the task id: `"E1.2 tokens expire"`. Ask for a foreground run (`run_in_background: false`) unless the task can wait.
   - **Escalate, once.** Retry on the session model when the builder failed the task twice, or as soon as its diff is more than 3 times the expected size (S 50, M 150, L 400 changed lines, or the brief's estimate), it edited a file outside the task's files, or it edited the same file 5 times without the test going green. First run `sh .boxbox/pitwall/say escalated "<one-line reason>" --unit <E1.2>`, then call the builder again with the session model. If it fails on the session model too, stop: update `state.md`, tell the developer what was tried and what failed, and wait. Never escalate a task twice and never push through.
   - Read the builder's diff yourself before ticking the task off. Its report is a claim; the commit and the test run are the evidence.
2. **Test first.** Follow **boxbox-tdd**: write the test, watch it fail for the right reason, write the least code that passes.
3. **Run every check.** The full test suite, the linter and the type checker from `config.md`. All green before you go on.
4. **Commit.** One commit per task, holding that task's code and tests and nothing from `.boxbox/`: `E1.2: tokens expire after 15 minutes`. Never commit with a failing check.
5. **Tick it off.** Mark the task done in `plan.md` and `plan.html` (`data-st="done"` on the task's `li`), and set its status and commit hash in `board-data.js`. Keep the epic's status mark on `plan.html` current. Leave these uncommitted. Set it to `done`, never "verified": the pit wall marks it verified only if it saw the passing test run itself after the task's last edit.

A task with no cheap test: do it, verify it the way the plan says, and record exactly what you observed.

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
