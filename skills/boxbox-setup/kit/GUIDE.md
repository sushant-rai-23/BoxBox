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
8. **Never claim what you did not check.** Say what was verified and what was not. The pit wall marks a task "verified" only from a test run it saw itself (see "Observed and claimed").

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
  assets/             boxbox.css and boxbox.js (style.css and page.js only for pages from 0.5). Fixed; never edit them
  templates/          page templates to copy, brief.md for task briefs, and _components.html, the gallery of every allowed block. Fixed; refreshed from the kit by boxbox-setup
  pitwall/            the live pit wall: server.js, index.html, orbs.js, prices.json, say, check-page.js, statusline (Claude Code's status line). Fixed, except prices.json
  live/               written by the hooks and the pit wall while you work. Local only; never committed
  knowledge/<topic>.html
  explained/<feature>.html    how an existing feature works, written on request
  reviews/<name>.md  reviews/<name>.html    notes for a person reviewing work they did not build
  <feature>/          one folder per feature or milestone, lowercase-with-dashes
    context.md   context.html
    decisions.html
    plan.md      plan.html
    <unit>/      e1-<slug> for an epic (the same slug as its branch), e1-2-<slug> when the unit is a task
      design.md  design.html     only when the plan gives the unit a design stop
      tasks/<task id>.md         the task's brief, written just before the task (see "Task briefs")
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
  "project": "example-app",
  "goal": "One line on what this project is building right now.",
  "updated": "2026-10-08",
  "unit": "epic",
  "decisionLevel": "what matters",
  "waiting": { "what": "Review E1", "detail": "Report and pull request are open.",
               "label": "Open report", "href": "password-reset/e1-request-reset/report.html" },
  "knowledge": [ { "title": "Job queues", "href": "knowledge/job-queues.html" } ],
  "modules": [ { "name": "Reset tokens", "files": ["app/resets.py"], "role": "Creates and checks one-time reset tokens." },
               { "name": "Tests", "files": ["tests/**"], "role": "pytest suites." } ],
  "milestones": [ {
    "id": "M1", "title": "Password reset", "goal": "Users can reset a password by email.",
    "status": "in_progress",
    "links": [ { "label": "Context", "href": "password-reset/context.html" },
               { "label": "Decisions", "href": "password-reset/decisions.html" },
               { "label": "Plan", "href": "password-reset/plan.html" } ],
    "epics": [ {
      "id": "E1", "title": "Request a reset email", "outcome": "A known email gets a reset email with a one-time token.",
      "status": "review", "branch": "password-reset-e1-request-reset",
      "files": ["app/resets.py", "app/routes.py", "tests/test_resets.py"],
      "pr": "https://github.com/org/repo/pull/12",
      "links": [ { "label": "Report", "href": "password-reset/e1-request-reset/report.html" } ],
      "tasks": [ { "id": "E1.1", "title": "Create and store a hashed token",
                   "test": "token row exists and raw token is not stored",
                   "brief": "password-reset/e1-request-reset/tasks/E1.1.md",
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
- `modules`: the parts of the codebase, each with a plain `name`, the `files` globs it covers, and a one-line `role`. boxbox-discover fills it; the pit wall's Map draws it. Five to twelve modules for most repos.
- `files` on an epic: the globs it expects to touch, tests included (`app/resets.py`, `tests/**`). boxbox-plan fills it. The pit wall flags any edit outside the current epic's `files`, marks an approved epic "changed after approval" when one of its files is edited later, and shows the plan as behind when edited files match no epic.

## The pit wall and the live folder

The pit wall is a local page (`node .boxbox/pitwall/server.js`, on `127.0.0.1` only) that shows the developer what the agent is doing, where the work stands, what waits on them, and what it costs. Hooks feed it every tool call; the skills feed it the stage they are in. Nothing leaves the machine.

`.boxbox/live/` holds its data: `events.jsonl` (one line per action or stage, never file contents, prompt text or command output), `sessions.jsonl`, `stage.json`, `waiting.json`, and `PAUSE` while the developer has paused. It is listed in the repo's `.gitignore` and is never committed.

**Pause.** While `.boxbox/live/PAUSE` exists, the hook holds your next tool call. If the developer resumes, the call runs and you notice nothing. If they do not, after about nine minutes the call is denied with the message "The developer paused Boxbox from the pit wall...": then stop, update `state.md`, say you are paused, and wait for "continue". boxbox-build also checks for `PAUSE` before each task.

## Stage events

At the start of each skill and at each step below, tell the pit wall where you are with one short command. Run it as it is, on its own: no `&&`, no pipes, no redirects, and the relative path as shown, so it runs without a permission prompt. The same goes for `node .boxbox/pitwall/server.js`. Say nothing about it in the chat, and if `.boxbox/pitwall/say` does not exist (Cursor, an older repo), skip it.

```
sh .boxbox/pitwall/say stage <stage> [--unit E2.3] [--why "<one line>"]
sh .boxbox/pitwall/say ask "<what you need>" [--kind decision|plan|design|unit|setup] [--stage <stage>]
```

Use `ask` whenever you stop for the developer: each decision card (`"D3: how strict should rate limiting be?"`), stop 1, a design stop, stop 2, a setup question. It shows a full-width "Your move: answer in chat" bar until their next message.

| Stage | When |
| --- | --- |
| `setup`, `learn-repo`, `install-skills` | boxbox-setup, steps 1, 2 and 4 |
| `discover`, `knowledge` | boxbox-discover; `knowledge` while writing knowledge pages |
| `decisions`, `plan`, `plan-review` | boxbox-plan: asking decisions, writing the plan, stop 1 |
| `design`, `design-review` | boxbox-design and its stop, with `--unit` |
| `build` | boxbox-build, once per task, with `--unit E1.2 --why "<the task's first test>"` |
| `verify`, `inspect`, `report`, `unit-review` | the end of a unit, with `--unit`; `unit-review` is stop 2 |
| `approved`, `merged` | after the developer approves, and after the squash-merge |
| `debug` | boxbox-debug |
| `explain`, `explain-check`, `explain-board` | boxbox-explain for finished work: reading, checking, the board |
| `review`, `review-notes` | boxbox-review |

Tokens are counted per unit by these stages: everything between `build --unit E2.3` and the next stage belongs to E2.3.

If a skill forgets to say its stage, the hook infers one from the Boxbox page being written (context, decisions, plan, design, report) and marks it "inferred". It only moves the flow forward or to a new unit. Say the stage anyway: an inferred stage comes late, so tokens before it land in the previous unit.

## Observed and claimed

When you run the test command from `config.md`, the hook records the result it saw. A task shows as **verified** on the pit wall only when a passing run it observed came after the task's last edit. A task you marked done without such a run shows as **claimed**. Do not write "verified" on the board yourself; set the task to `done` and let the pit wall decide. If the pit wall shows "claimed" for a task you believe is tested, run the test command again.

## Task briefs

Before each task, the main agent writes its brief: `cp .boxbox/templates/brief.md .boxbox/<feature>/<unit>/tasks/<task id>.md`, then fills it. Write it just before the task, from the plan line and the code as it is now, never at plan time: earlier tasks change the code it describes. A brief holds:

- **Header** (the lines before the first `##`): `task`, `size`, `risk`, `expected_diff` (changed lines; S about 50, M 150, L 400), `files` (every file the task may edit, tests included) and `base` (the commit it was written against). The routing gate and escalation read these. Copy `size` and `risk` from the task line in `plan.md`; if the two ever disagree, `plan.md` wins. Nothing checks the excerpts against later code: `base` tells a reader which commit they describe.
- **Goal**: one sentence, plus the acceptance criteria it serves.
- **Code to touch**: each file and function as `path:line`, with the exact current lines. In Claude Code, get the excerpts from `boxbox:boxbox-scout`, so the builder does not explore.
- **Interface**: what to build against, from the design page if there is one.
- **Tests**: the first test, then edge cases from the epic's failure modes.
- **Do not touch**: out-of-scope files, patterns to avoid, the decisions that apply.
- **Done when** and **Commands**: the done check, and the test, lint and type commands.

**Prompt order.** Every subagent prompt is the fixed part first, then the brief: (1) the rules that never change during a feature (this guide's rules, the conventions and commands from `context.md`, the rules of boxbox-tdd), (2) the brief. Never put a timestamp, a counter or anything else that changes per call into the fixed part: the API caches a prompt's unchanged beginning, and a cache read costs far less than fresh input.

**Who builds from it.** In Claude Code, `boxbox:boxbox-builder` receives only the fixed part and the brief. In Codex, the main agent builds from the brief itself.

**Where it shows.** Add `"brief": "<feature>/<unit>/tasks/<task id>.md"` to the task in `board-data.js`; the board and the pit wall link it. The report quotes each task's goal from its brief (see the report template).

## Model routing (Claude Code only)

Boxbox ships four subagents in the plugin's `agents/` folder: `boxbox:boxbox-builder` builds one task from its brief, `boxbox:boxbox-scout` reads and searches and never edits, `boxbox:boxbox-runner` runs checks and fixes only mechanical failures, and `boxbox:boxbox-writer` fills page templates from facts it is handed. `models:` in `config.md` sets their models:

| Agent | best | balanced | save |
| --- | --- | --- | --- |
| builder | session | sonnet | sonnet |
| scout | session | haiku | haiku |
| runner | session | haiku | haiku |
| writer | session | sonnet | haiku |

"session" is the main conversation's model. With `auto`, Boxbox steps aside as in 0.6: it uses no Boxbox agent and passes no model, so plain subagents run on whatever Claude Code chooses, and nothing is escalated. The rule lives in the plugin's `hooks/routing.js`; for a builder task, the first match wins:

1. `models: auto`: no Boxbox agent, no model.
2. The task was escalated: the session model.
3. Its epic has a `model:` line in `plan.md`: that model (even under `save`; the developer asked for it).
4. The task is `risk: yes` or `size: L`: the session model (`save`: sonnet).
5. The table above.

**Every call passes `model`** (except under `auto`), as the family alias (`opus`, `sonnet`, `haiku`), never a full model id. **Every description starts with the unit it serves:** the task id for builder calls and for scout or runner calls made for one task (`Agent(subagent_type: "boxbox:boxbox-builder", description: "E2.3 <short>", model: "sonnet", prompt: ...)`), the epic id for work on a whole epic (`"E2 report page"`), and `setup` for setup work (`"setup refresh kit"`).

**Never routed down:** discover, decisions, plan, design, writing task briefs, inspect (code review), the page fact-check, and every approval stay on the session model.

**Escalation** (not under `auto`). Retry a builder task once on the session model when the builder failed it twice, or earlier when its diff is more than 3 times the expected size (S 50, M 150, L 400 changed lines, or the brief's estimate), it edited a file outside the brief's `files`, or it edited the same file 5 times without the test going green. Before the retry, run `sh .boxbox/pitwall/say escalated "<one-line reason>" --unit <task id>`. If it fails on the session model too, stop and tell the developer. If the builder already ran on the session model (`best`, a risky or `L` task, an epic override naming it), there is nothing to escalate to: stop and tell the developer at once. Never escalate the same task twice.

**The gate.** In Claude Code, a hook checks every call to a Boxbox agent against these rules before it runs. A call that breaks them is denied with a reason that names the agent and model to use, or the step to take (`say escalated`, or stop and tell the developer): do exactly that, then call again. Under `models: auto`, or when `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is set (to anything but `0` or `false`), the gate stands aside and the pit wall says why. If the gate cannot judge a call (no plan, an unknown session model, an error), the call runs and the pit wall says so. A task's history (finished builder runs, escalation) starts again at its `say stage build --unit <task id>`, so say that stage before each task, also when you rework a task after review. The gate does not see diffs: the 3-times-the-expected-size check is yours, from the builder's commit.

Codex has no subagent models: under Codex, `models:` and `parallel:` are ignored and the main agent builds every task itself.

## Pages

Every developer page is a template from `templates/`, copied and filled. The agent writes content only, never layout or CSS: the templates hold the finished page, so a page costs the tokens of what it says and nothing for how it looks. There is one template per page: `context`, `decisions`, `plan`, `design`, `report`, `knowledge`, `explain` and `review`.

**The workflow, every time:**

1. Copy the template with `cp`. For example: `cp .boxbox/templates/report.html .boxbox/password-reset/e1-request/report.html`. Never write a page from scratch or from memory, and never start from another page.
2. Fill the sections (below). Replace `{{ROOT}}` with the path back to `.boxbox/`: `../` for a page in a feature folder, `knowledge/`, `explained/` or `reviews/`, and `../../` for a design or report page. `{{TITLE}}` is "<page>: <feature title>" (for a review, "Review: <name>"). `{{FEATURE TITLE}}` is the feature's name in plain words ("Password reset"), not its folder name.
3. Run the checker: `node .boxbox/pitwall/check-page.js <the page>`. Fix every problem it lists and run it again until it prints `OK`. It is pre-approved, so it never asks for permission.
4. For a report, context, review or explain page, run the fact-check: **boxbox-inspect** in page mode. A fresh agent checks the claims against the repo and lists the false ones; fix them and run the checker again.
5. Only then open the page for the developer if you can (`open`, `xdg-open` or `start`), and always print its path.

**Sections.** A template is a list of `<section data-section="<name>">` blocks. Each has a heading, a comment saying what goes in it and how deep, and sample markup built from the real components.

- You may: replace placeholders and sample content inside a section; delete a section marked `data-required="no"` when it has nothing true to say; copy a section marked `data-repeat` once per item (one decision card per decision); add a new section, built only from components in `templates/_components.html`, with its own `data-section` name, `data-required="no"` and an `id`.
- You may not: write `<style>` or a `style=` attribute; use a class that is not in `templates/_components.html`; change the head, the bar, the contents column, the footer shell or the scripts; delete a `data-required="yes"` section.
- Delete the template's instruction comments once the page is filled.
- Double braces inside real code (a template language, a format string) are part of the code: keep them. The checker only flags a template's own placeholders inside code.
- Escape `<`, `>` and `&` inside code as `&lt;`, `&gt;` and `&amp;`.

**Components.** `templates/_components.html` shows every block once with its exact markup: page shell, margin note, status, new or known, callout, facts, metric strip, code with numbered notes, before and after, file change, annotated file tree, diagrams (boxes and arrows, sequence, flow), request path, timeline, comparison, risk and test tables, decision, glossary term, check yourself, manual checklist, findings, epics and tasks, and links to other pages. Copy from there. Status colours are fixed and always carry a word: `live` in progress, `done`, `verified` (a run the pit wall saw), `move` needs the developer, `flag` outside scope or failing, none for to do, `claimed` (done with no run seen). Risks and findings use one scale: `flag` is high or must fix, `move` is medium or should fix, no colour is low or a note.

**Depth.** The pages are for a developer who should be able to learn the work cold, without opening chat. Each required section sets `data-min-words`, the least prose it needs, and some also set `data-min-items` (questions, links) or `data-needs="svg"` (a diagram). Code blocks and diagrams do not count, so a page cannot pass on pasted code. These are floors: a section about something `config.md` marks `new` usually needs far more. Always use real code and real file paths from this repo, never generic examples. What each page must cover:

| Page | Required sections |
| --- | --- |
| Context | what the project is and who it serves; the architecture as a diagram of the real modules; how a request travels today; patterns and conventions to follow, with file references; constraints; what this touches and must not touch; concepts (known or new); how it can fail; open questions; glossary |
| Knowledge | the idea in plain words with one analogy; why it exists; how it works step by step, with a diagram; how this repo uses it, with file and line; a worked example traced through real code; common mistakes; when not to use it; check yourself (3 to 5 questions); further reading (2 to 4 trusted links) |
| Decisions | one section per decision: the question, why it matters now, options compared in a table, the recommendation and why, the cost to change later, who decided |
| Plan | goal and non-goals; milestones, epics and tasks, each task with its first test, how it can fail and its files; the order and why; risks; where it stops for the developer; how we will know the milestone is done |
| Design | the problem; the shape as a diagram; the interfaces (signatures, routes, schemas); alternatives considered; risks and what this locks in; what to approve |
| Report | what now exists and how to see it working; the request path through the new code; file by file, with annotated code; tests and what each proves, marked observed or claimed from the pit wall; decisions made while building; trade-offs and rejected alternatives; risks and edge cases not covered; a manual checklist; how to roll back; cost; files outside scope (if any); check yourself |
| Explain | the report's teaching sections, plus a map of the pieces and what is unclear or looks risky in the existing code |
| Review | what the change claims to do; the request path; per-file notes; questions for the author; risks; a review checklist at the depth the reviewer chose |

**Reliability.** A page is only useful if it is true. Four rules make it checkable:

- **Label where each claim comes from.** In the required sections of report, context, review and explain pages, every paragraph, list item, table row and definition carries `data-evidence`, on itself or on its list, table, figure or margin note: `observed` (the pit wall or you saw it run), `code` (you read it in the repo), `inferred` (your reasoning), `unknown` (nobody knows yet) or `source` (a link to the source, in the same block). The page shows the label after the claim. Label a whole list or table only when every item has the same source; when they differ, label each item. **"unknown" is allowed; guessing is not.** On knowledge pages, every claim that is not about this repo is `source`, with the link.
- **Facts come from data, not from you.** Test results, changed files and line counts, commits, the branch, tokens, cost and time are read, not written from memory. Mark each with `data-source` (`pitwall:tests`, `pitwall:task`, `pitwall:tokens`, `pitwall:cost`, `pitwall:time`, `git:diff`, `git:commits`, `git:commit`, `git:branch`) and write exactly what the data says: `node .boxbox/pitwall/server.js --summary <unit>` for tokens and cost, `git diff --numstat` and `git rev-list --count` for the range on the page's `data-range`. With no pit wall data, write "not recorded".
- **References point at real lines.** Quote repo code exactly with `<pre data-quote="path:first-last">` (add `@<commit>` for code that has changed since). Cite lines as `path:line` in `<code>` or `span.at` (a line at another commit takes its own `data-commit`). Name tests with `<code data-test>`, exactly as in the test file. The article's `data-commit` says which commit the page describes.
- **Reports end with "Verify these yourself":** the three claims that matter most if they are wrong, each with how to check it in a minute.

**Checker.** `node .boxbox/pitwall/check-page.js <page> [more pages]` fails when a page has a leftover `{{...}}` placeholder, a `<style>` block or `style=` attribute, a class that is not in the gallery, a missing required section, a required section under its minimum length, a link to a Boxbox page or anchor that does not exist, a section without the items or diagram its template asks for, a claim without an evidence label, a fact that disagrees with git or the pit wall, a quote that does not match the repo, a file:line or test name or commit that does not exist, a link to an anchor that does not exist on the other page, a diagram with no text alternative, a script or stylesheet the template does not load, or writing that reads as machine-made: a line joined with middle dots, an arrow after text, or "should work". It reads the required sections and their minimums from the template, never from the page.

**Older pages.** Pages written by Boxbox 0.5 still load `assets/style.css` and `assets/page.js`, which stay in the kit for them. Do not convert them unless the developer asks; write every new page from the 0.6 templates.

## Writing for the developer

- Lead with the point: what exists now, what you need from them.
- Plain words, short sentences. Define a term the first time it appears.
- Show real code from this repo, with its path. Never invent output: run it.
- Explain why, not only what. Name the alternative that was not chosen.
- Depth follows `config.md`: teach what is marked `new`, stay brief on what is marked `known`. Depth means more explanation of what is new, never padding about what they already know.
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
models: best | balanced | save | auto   # Claude Code only: which models Boxbox's subagents use (see "Model routing"); a missing line means auto
parallel: off | on                     # Claude Code only: build independent tasks of one epic at once in worktrees; off by default
pitwall: open | start | off   # open the pit wall in the browser at session start, start it without opening, or no pit wall
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
- **`.boxbox/live/` is never committed.** It is in the repo's `.gitignore` (setup adds it). If it ever shows in `git status`, add the line back; never stage it.
- When showing a diff to the developer, leave the bookkeeping out: `git diff <base>...<branch> -- . ':!.boxbox'`.
- Pull request descriptions say the unit was built by an agent with Boxbox, and link the report.
