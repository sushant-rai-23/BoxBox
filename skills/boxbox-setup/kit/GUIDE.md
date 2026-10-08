# Boxbox guide

This file is the contract for the `.boxbox/` folder. Every Boxbox skill reads it before writing here. If a skill and this guide disagree, this guide wins, because the developer may have edited it for this repo.

"Box, box" is the call that brings a racing driver into the pits. The agent is the driver; the developer is the pit wall, with the data and the final say. The agent pits for review after every unit.

## The rules

1. **Stop and wait.** After the plan, and after every unit, stop and wait for the developer. Never start the next unit on your own.
2. **Two files for every step.** Markdown for the agent (short, factual). HTML for the developer (explains, teaches).
3. **Teach what was built.** A report explains the concepts in this diff, at the level `config.md` says this developer needs.
4. **Decisions belong to the developer.** Ask them one at a time with a recommendation. Record every one in `decisions.md`.
5. **Small tested slices.** Every task names its first test before any code is written.
6. **Update the board.** After each task and at the end of each skill, rewrite `board-data.js` and `state.md` so they are true.
7. **Stay inside the task.** Anything else worth doing goes under "Later" in the plan.
8. **Never claim what you did not check.** Say what was verified and what was not.

## Ask first, always

Whatever the decision level, ask before any of these:

- Deleting files or data, or rewriting git history.
- Migrations on shared or production data.
- Changing CI, deploy or infrastructure config.
- Adding a paid service or a new production dependency.
- Pushing to a remote, when `config.md` says `push: ask` or `push: no`.
- Anything that sends a message or changes a system outside this repo.

## Folder map

```
.boxbox/
  GUIDE.md            this file
  board.html          the developer's home page. Fixed; never edit it
  board-data.js       the board's data. Rewrite after every step
  config.md           setup answers
  state.md            where the work stands; read first in every session
  decisions.md        every decision, one row each
  glossary.md         project terms, one meaning each
  lessons.md          corrections from the developer and the rule each became
  assets/             style.css and page.js. Fixed; never edit them
  templates/          page skeletons to copy. Fixed; refreshed from the kit by boxbox-setup
  knowledge/<topic>.html
  explained/<feature>.html    how an existing feature works, written on request
  <feature>/          one folder per feature or milestone, lowercase-with-dashes
    context.md   context.html
    decisions.html
    plan.md      plan.html
    <unit>/      e1-<slug> for an epic (the same slug as its branch), e1-2-<slug> when the unit is a task
      design.md  design.html     only when the plan gives the unit a design stop
      report.md  report.html
```

## Hierarchy and ids

| Level | What it is | Id |
| --- | --- | --- |
| Project | This codebase | none |
| Milestone | A group of features with one outcome. A single feature request is one milestone | M1, M2 |
| Epic | The smallest piece a person can use, see or verify on its own. It is where the developer reviews, so size it for one review | E1, E2 (numbered within a milestone) |
| Task | One thin slice with one first test, one commit | E1.1, E1.2 |
| Decision | A choice the developer made | D1, D2 |
| Default | A small choice the agent made | A1, A2 |

Do not invent levels. A small request is one milestone with one epic. Never split epics by layer (model, API, UI): each epic must work end to end.

## Status words

Use exactly these in `board-data.js`, `state.md` and `plan.md`:

`todo` · `in_progress` · `review` (waiting for the developer) · `changes` (developer asked for changes) · `done` · `skipped` · `blocked`

These are for milestones, epics and tasks. Whether the plan itself is approved is a separate line in `plan.md` (`approved: no` or `approved: yes, <date>`).

## Board data

`board-data.js` is JSON inside one assignment, so `board.html` can load it from disk. Keep the first three comment lines. Rewrite the whole object each time; never leave it half true.

```js
window.BOXBOX_BOARD = {
  "project": "Scene ON backend",
  "goal": "One line on what this project is building right now.",
  "updated": "2026-10-08",
  "unit": "epic",
  "decisionLevel": "what matters",
  "waiting": { "what": "Review E1", "detail": "Report and pull request are open.",
               "label": "Open report", "href": "password-reset/e1-request-reset/report.html" },
  "knowledge": [ { "title": "Job queues", "href": "knowledge/job-queues.html" } ],
  "milestones": [ {
    "id": "M1", "title": "Password reset", "goal": "Users can reset a password by email.",
    "status": "in_progress",
    "links": [ { "label": "Context", "href": "password-reset/context.html" },
               { "label": "Decisions", "href": "password-reset/decisions.html" },
               { "label": "Plan", "href": "password-reset/plan.html" } ],
    "epics": [ {
      "id": "E1", "title": "Request a reset email", "outcome": "A known email gets a reset email with a one-time token.",
      "status": "review", "branch": "password-reset-e1-request-reset",
      "pr": "https://github.com/org/repo/pull/12",
      "links": [ { "label": "Report", "href": "password-reset/e1-request-reset/report.html" } ],
      "tasks": [ { "id": "E1.1", "title": "Create and store a hashed token",
                   "test": "token row exists and raw token is not stored",
                   "status": "done", "commit": "a1b2c3d" } ]
    } ]
  } ]
};
```

- Required: `project`, `updated`, `milestones`, and for every milestone, epic and task an `id`, `title` and `status`. Everything else is optional; leave a field out until it is true (`pr`, `commit`, `links`, `branch`).
- `waiting` is `null` when nothing needs the developer. Otherwise it names the one thing they must do next. With no pull request, `detail` says where the code is: the branch and the diff command.
- Links are relative to `.boxbox/`. Only link a page that exists.
- `href` values are relative paths or `http(s)://` URLs. Nothing else.
- Keep the comment lines at the top of the file. Fill `goal` when the first feature is discovered.

## Pages

Every developer page is made by copying a file from `templates/` and filling it.

- Delete the template's instruction comments (`<!-- ... -->`); they are for you, not the reader.
- Replace every `{{...}}`. `{{ROOT}}` is the relative path back to `.boxbox/`: `../` for a page in a feature folder or in `knowledge/`, `../../` for a report or a design page. `{{TITLE}}` is "<page> · <feature title>". `{{FEATURE TITLE}}` is the feature's name in plain words ("Password reset"), not its folder name.
- Use only the classes already in the template and in `assets/style.css`. Never add a `<style>` block, inline styles, or another stylesheet. Never edit `assets/`.
- Delete a section, pill or tag that has nothing true to say. Repeat a component as many times as the content needs, and reorder components inside a section when the content calls for it.
- After writing a page, check it has no `{{` left, then open it for the developer if you can (`open`, `xdg-open` or `start`), and always print its path.

Components you can use on any page:

| Component | Markup | Use for |
| --- | --- | --- |
| Status pill | `<span class="pill ok|warn|acc|bad">` | State at the top of a page |
| Tag | `<span class="tag you|new|known|warn">` | Marking a row |
| Fact grid | `<div class="grid"><div class="fact"><div class="k">…</div><div class="v">…</div></div></div>` | 3 to 6 key facts |
| Walk-through step | `<div class="step"><div class="n">1 · …</div><h3>…</h3>…</div>` | Pieces in the order a request meets them |
| Code | `<div class="file">path</div><pre><code>…</code></pre>` | Real code from the repo, trimmed |
| Code with output | `<div class="cell"><pre class="code"><code>…</code></pre><pre class="out">…</pre></div>` | Teaching: code and exactly what it prints. `out err` for errors |
| Table | `<div class="tablewrap"><table>…</table></div>`; `tr.override` for an overridden recommendation | Decisions, commits, pending work |
| Note | `<div class="note">`, `note ask` for an approval ask | Asides and asks |
| Teaching notes | `<p class="note def|why|when|trap">` | Definition, why it exists, where it is used here, trap |
| Gotcha | `<div class="gotcha"><b>Gotcha we hit.</b> …</div>` | A real problem met and its fix |
| Definitions | `<dl><dt>…</dt><dd>…</dd></dl>` | Names in the code, vocabulary |
| Decision card | `<section class="decision open|answered|parked">` | One decision with its options |
| Check yourself | `<details class="check"><summary>question</summary><div>answer</div></details>` | Two or three questions at the end of a report |
| Epic with tasks | `<section class="epic">` with `<ul class="accept">`, `<ol class="tasks">` (`span.box`, `box done`), `<ul class="fails">` | The plan page |
| Option | `<div class="option">`, plus `rec` for recommended and `chosen` for the one picked | Inside a decision card |
| Mark as done | `<label class="donebox"><input type="checkbox" id="…"> Mark as done</label>` | End of a knowledge section |
| Id and number cells | `<td class="id">`, `<td class="num">` | Ids and commit hashes in tables |

Escape `<`, `>` and `&` inside code as `&lt;`, `&gt;` and `&amp;`.

## Writing for the developer

- Lead with the point: what exists now, what you need from them.
- Plain words, short sentences. Define a term the first time it appears.
- Show real code from this repo, with its path. Never invent output: run it.
- Explain why, not only what. Name the alternative that was not chosen.
- Depth follows `config.md`: teach what is marked `new`, stay brief on what is marked `known`.
- State what you could not verify. Do not write "should work".

## Markdown files

Keep these short. They are read by agents at the start of sessions.

**config.md**

```
# Boxbox config
project: <name>
stack: <languages and frameworks, with versions>
commands:
  test: <command>
  lint: <command or none>
  types: <command or none>
  run: <command or none>
git:
  main: <main branch>
  host: github | gitlab | other | none
  push: yes | ask | no
unit: epic | task
decision_level: everything | what matters | decide and show
developer:
  known: [<stacks and topics the developer knows>]
  new: [<stacks and topics that are new to them>]
models:            # optional; only if the agent lets you choose
  plan: <model>
  build: <model>
  report: <model>
skills:            # stack skills in use for this repo, or "none"
  - <name>: installed from <source> | written for this repo, at <path>
```

**state.md**: rewritten after each task and at the end of each skill.

```
# State
feature: <folder name>
branch: <feature branch, or "not created yet">
phase: discover | decisions | plan-review | design-review | build | unit-review | done     (none before the first request)
unit: <id of the current unit and its status, for example "E1 review", or none>
last_approved: <what the developer last approved, and when>
next: <the one next action>
waiting_for_developer: yes | no     (yes in plan-review, design-review and unit-review, or when a question is open)
notes: <anything a fresh session must know>
```

**decisions.md**: one table, newest last. Never delete a row; add a new one that replaces it.

```
| Id | Feature | Question | Choice | Why | Decided by | Date | Change later |
```

`Decided by` is `developer`, `developer (override)` when they chose against the recommendation, or `agent (default)`. Defaults are recorded here too, with their A ids, when the plan is written and whenever one is made during a build.

**Recording a decision.** Whichever skill it comes from, a decision or default goes in three places: a row in `decisions.md`, a card or a defaults row on the feature's `decisions.html`, and a line under "Decisions" in its `plan.md`.

**glossary.md**: `| Term | Meaning in this project | Not to be confused with |`. Use these words in plans, pages and code.

**lessons.md**: `| Date | What the developer corrected | The rule from now on |`. Read at the start of every session and obey.

**context.md**, **plan.md**, **report.md**: formats are in the discover, plan and report skills.

## Git model

- Each feature gets a feature branch off the main branch: `<feature>`.
- Unit = epic: each epic gets a branch off the feature branch: `<feature>-e1-<slug>`. One commit per task, holding only that task's code and tests. At the stop, open a draft pull request from the epic branch into the feature branch. On approval, squash-merge it, so the feature branch has one commit per epic.
- Unit = task: commit each task on the feature branch and show that commit at the stop.
- Requested changes are new commits, never amended ones, so the developer sees what changed.
- `push: no` or no remote: do not push. Show `git diff <feature>...<epic branch> --stat -- . ':!.boxbox'` and tell the developer how to view the full diff.
- The pull request from the feature branch into main is the developer's to open.
- **`.boxbox/` files are committed separately from code, at these moments only.** (1) When the feature branch is created: one commit, `Boxbox: plan for <feature>`, with the whole `.boxbox/` folder and the agent instruction file setup touched. (2) At each review stop: one commit on the unit's branch, `<E1>: report and board`, with the report and every board, plan and state change made during the unit. (3) After an approval: one commit on the feature branch, `<E1>: approved`. (4) After work outside a unit build changed the records (a design approved, a decision changed by a grill or a prototype, a lesson added): one commit on the feature branch, `Boxbox: <what changed>`. Between those moments `.boxbox/` changes stay uncommitted; that is expected and is not a dirty tree. The squash-merge of an approved epic naturally folds its code and its report into one commit on the feature branch; that is intended.
- When showing a diff to the developer, leave the bookkeeping out: `git diff <base>...<branch> -- . ':!.boxbox'`.
- Pull request descriptions say the unit was built by an agent with Boxbox, and link the report.
