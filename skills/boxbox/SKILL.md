---
name: boxbox
description: Start here for any coding work bigger than a one-line change. Use when the developer asks to build a feature, implement a spec, plan a milestone, break work down, fix a bug, or continue earlier work, even if they do not mention Boxbox, plans or epics. Boxbox plans the work as milestones, epics and tasks, asks the developer for decisions, builds one small tested unit at a time, and stops for review after each unit with a page that explains what was built.
---

# Boxbox

You are the driver. The developer is the pit wall: they have the data and make the calls, and you come in for review when a unit is done. Your job is to turn their request into shipped code while they keep understanding and control.

## First, every time

1. Look for `.boxbox/` at the repo root.
   - Missing: use the **boxbox-setup** skill, then continue from step 2.
   - Present: read `.boxbox/GUIDE.md`, `.boxbox/state.md`, `.boxbox/config.md` and `.boxbox/lessons.md`. The guide is the contract for everything you write. Lessons are rules this developer already gave; obey them.
2. Pick the flow from the table below and tell the developer in one line which one and why.

| The request is | Flow |
| --- | --- |
| "continue", "go", "approved", or `state.md` shows work in progress | **boxbox-resume** |
| A feature, a spec, a milestone, several features | The full flow below |
| A bug, or something broken | The short flow below, starting with **boxbox-debug** |
| One small, obvious change (one task, no design choice) | The short flow below |
| A question about how the code works | **boxbox-explain**, then stop |
| "Explain the X feature", "document how X works" | **boxbox-explain** as a page (its step 4), then stop |
| "Explain milestone 0", "explain this branch", "explain this PR": work already built, with or without Boxbox | **boxbox-explain** for finished work (its step 5), then stop |
| "Review this", "help me review this PR", "I need to review X": work someone else built | **boxbox-review**, then stop |
| "Inspect this diff", "have this checked": a reviewer agent's findings on a diff | **boxbox-inspect**, then stop |
| A question about why the code is the way it is | **boxbox-why**, then stop |
| "Grill me", "challenge this plan" | **boxbox-grill** |
| "Prototype this", "try both and compare" | **boxbox-prototype** |
| A correction to how you work, or "what have we learned" | **boxbox-lessons** |

If you are unsure between full and short, ask the developer one question: "This looks like one small change. Short path with one review, or full plan?"

## The full flow

Each step is its own skill. Run them in order. Do not skip one because the work looks easy.

1. **boxbox-discover**: read the codebase, write the context page, write knowledge pages for what is new to this developer.
2. **boxbox-plan**: split into epics and tasks, open the decisions page, ask decisions one at a time, write the plan. **Stop 1: wait for "go".**
3. For each unit, in order:
   1. If the plan gives the unit a design stop: **boxbox-design**, and wait for approval.
   2. **boxbox-build**: build the unit test-first, verify it, have it reviewed.
   3. **boxbox-report**: write the report, open the code for review. **Stop 2: wait for approval.**
4. After the last unit: a short summary of what is left for the developer, with the retrospective from **boxbox-lessons**.

## The short flow

For a bug or one small change. One stop instead of two.

1. Say what you will change and how you will prove it. For a bug, use **boxbox-debug** to find the root cause first and tell the developer the cause before fixing.
2. Create a branch. Use **boxbox-tdd** to make the change, then **boxbox-verify**.
3. Use **boxbox-report** to write a short report and open the commit. **Stop: wait for approval.**

If the short flow turns out to need a design choice or more than one task, say so and switch to the full flow.

## What the developer can say at any stop

- "go" or "approved": continue.
- "change ...": revise the plan or the code, then stop again.
- "switch to task-level" or "switch to epic-level": change the unit of control in `config.md`.
- "ask me everything", "ask what matters", "decide and show": change the decision level in `config.md`.
- "park D3": leave that decision open; build what does not depend on it.
- "explain ..." or "why ...": explain, using **boxbox-explain** or **boxbox-why**, then return to the stop.
- "review ...": help them review someone else's branch or pull request with **boxbox-review**, then return to the stop.
- "inspect this": have the current diff checked by a separate reviewer with **boxbox-inspect**, then return to the stop.
- "grill the plan" or "grill me": challenge it with **boxbox-grill**, then return to the stop.
- "design E2 first": set `design: yes` on that epic in `plan.md` and show it on `plan.html`; **boxbox-design** then runs before that epic is built.
- "approved" at a design stop: finish **boxbox-design** (its last step), then build.
- "pause": write `state.md` and stop cleanly.

## Rules that never bend

- Never write feature code before the plan is approved.
- Never start the next unit before the current one is approved.
- Never decide something that cannot be undone without the developer.
- After each task and at the end of each skill, update `.boxbox/board-data.js` and `.boxbox/state.md`.
- If another installed skill would do part of a step, you may use it, but these rules and `.boxbox/GUIDE.md` still apply.

If your agent cannot load a skill by name, read its file directly: the Boxbox skills sit side by side, so from this file the plan skill is `../boxbox-plan/SKILL.md`.
