---
name: boxbox-plan
description: Split a feature into epics and tasks, get the developer's decisions, and write the plan for approval. Use after boxbox-discover, or when the developer asks to plan, break down, re-plan or change the scope of work. Produces the decisions page, plan.md and plan.html, then stops and waits for the developer to approve before any code is written.
---

# Boxbox plan

Turn the context into a plan the developer approves. No feature code is written in this skill.

Read `.boxbox/GUIDE.md`, `config.md`, `lessons.md`, and `.boxbox/<feature>/context.md` first.

## 1. Draft the split

**Epics.** An epic is the smallest piece a person can use, see or verify on its own. It is also where the developer reviews, so size it for one review: a diff they can read in one sitting.

- A small request is one epic. Do not invent more.
- A larger feature usually splits into two to four epics along what a person does ("ask for a reset email", "set a new password with the link"), never along layers ("the model", "the API").
- Order epics so each can ship without the next.
- Give each a short slug; its branch is `<feature>-e1-<slug>` and its report folder is `e1-<slug>`.
- Each epic has a one-line outcome, acceptance criteria that can be checked, what it depends on, the failure modes from the context that it must handle, and the files it expects to touch, as globs, tests included. The pit wall flags any edit outside them, so list what the epic really needs, not every file in the module.

If the request holds several groups of features with different outcomes, make several milestones, each with its own epics. Plan the first milestone in detail and the later ones as one line each.

**Tasks.** Split each epic into tasks. A task is a thin slice that runs end to end through every layer it needs, small enough for one sitting and one commit.

- Slice by behaviour ("a token expires after 15 minutes"), not by layer ("write the model").
- Each task states: what changes in one sentence, the test written first, how to tell it is done, and which tasks it depends on. The first test is the one that drives the task; more tests for edge cases and failure modes are added while building.
- Describe behaviour, not code. Do not name helper functions in a task line unless the task cannot be understood without them.
- A task that cannot name its first test is too vague: split it or sharpen it.
- A task with no cheap test (a console setting, a permission) says so and states how it is verified by hand. Mark steps only the developer can do.
- Give each task a size and a risk tag. `size: S` is under about 50 changed lines, `M` under 150, `L` more. Mark `risk: yes` when it touches auth, payments, crypto, data migrations, concurrency, or anything `context.md` lists as dangerous. In Claude Code these tags pick the builder's model (see "Model routing" in `GUIDE.md`): risky and `L` tasks stay on the session model.
- If a change makes later tasks easier, do it first as its own task.

**Design stops.** Mark an epic `design: yes` when it adds a new module, a data model, a public interface or a boundary between services, or when its shape would be costly to change once built. That epic gets a design page and an approval before any of its code is written (**boxbox-design**). Small epics that follow an existing pattern do not need one. Say in the plan why each marked epic is marked.

**Unknowns only code can settle.** If a decision depends on something you can only learn by running code (does the library do this, which approach is faster), say so on its card and offer a prototype (**boxbox-prototype**) before the developer decides.

The request may come with a suggested list. Treat it as input. Regroup it if the code shows a better split, and say why.

## 2. Collect the decisions

Tell the pit wall: `sh .boxbox/pitwall/say stage decisions`.

List every choice the code and the request do not settle. For each, judge how hard it is to change later: `easy`, `costly`, or `cannot be undone`.

Sort them by the decision level in `config.md`:

| Level | Ask the developer | Decide yourself and list as a default |
| --- | --- | --- |
| `everything` | every decision | nothing |
| `what matters` | costly, cannot be undone, or shapes the design | easy ones |
| `decide and show` | cannot be undone | everything else |

Anything on the "Ask first, always" list in `GUIDE.md` is asked at every level.

## 3. Open the decisions page before asking

Copy it with `cp .boxbox/templates/decisions.html .boxbox/<feature>/decisions.html`. Copy its decision section once per decision to ask (ids `d1`, `d2`...), hardest to change first. Each has:

- the question, as a question
- why it matters: what it changes in the build
- two to four options, each with what it means in this codebase and its gains and costs
- your recommendation and the reason, tied to a fact in the context
- how hard it is to change later, and why
- links to the part of the context page or the knowledge page to read first

List the defaults you chose in the table at the bottom, with ids A1, A2. Then run `node .boxbox/pitwall/check-page.js .boxbox/<feature>/decisions.html` and fix everything it reports, until it prints `OK`. Only then show the page.

Open the page and tell the developer: "N decisions need you. The page has the reasoning for each. Read them, take any to your team, and tell me when to start asking." If there are three or fewer, start asking straight away.

## 4. Ask one at a time

Ask each decision as a single question with the options and your recommendation first. Use your agent's question tool if it has one. Never ask two in one message. Right before each one, run `sh .boxbox/pitwall/say ask "D3: <the question>" --kind decision`, so the pit wall shows it as "your move".

The developer can:

- **Answer.** Record it.
- **Ask for more.** Explain with code from this repo, using **boxbox-explain** if needed. Then ask again.
- **Park it.** Mark it parked. Tasks that depend on it become `blocked`; plan the rest.
- **Override a default.** Record it as a decision.

After each answer, add a row to `.boxbox/decisions.md` (format in `GUIDE.md`; `developer (override)` when they chose against your recommendation) and update its section on the page: the status to `<span class="status" data-st="done">answered</span>`, the chosen row `tr.chosen` (`chosen override` when it went against your recommendation), and the "Decided by" line. Run the checker again.

If an answer changes the split, change it and say what moved.

**Then ask about the defaults, once.** "I chose defaults A1 to An for the small things; they are at the bottom of the decisions page. Want any of them different?" If the developer changes one, record it as a new decision (next D id, `developer (override)`), keep the A row on the page with "Replaced by D4" added after its old choice, and add an answered card at the end of the cards: the old default shown as the recommended option, the developer's choice as the chosen one.

Record the defaults that stand in `decisions.md` too, with their A ids and `agent (default)`.

## 5. Write the plan

Tell the pit wall: `sh .boxbox/pitwall/say stage plan`.

**`.boxbox/<feature>/plan.md`** (for agents):

```
# Plan: <feature title>
approved: no
branch: <feature branch, to be created at build>
unit: epic | task
goal: <one sentence>

## Decisions
- D1 <decision>: <choice> (developer | override)
- A1 <default>: <choice> (default)

## E1 <title>  [todo]
outcome: <what a person can use or verify>
branch: <feature>-e1-<slug>
depends: <none | E0>
design: no | yes, because <reason>
model: <opus | sonnet | haiku>   (only when the developer asked for one model on this epic's builder tasks, "use opus for E3")
files: <globs this epic expects to touch, tests included: src/resets.js, test/resets.test.js>
accept:
- <checkable criterion>
fails:
- <failure mode>: <how handled> (E1.3), or "not testable: <why, and what limits the risk>"
tasks:
- [ ] E1.1 <what changes> | size: S | risk: no | test: <first test> | done: <check> | deps: <none>
- [ ] E1.2 <what changes> | size: S | risk: no | no cheap test, verify: <manual check> | you

## Only the developer can do
- <when>: <step>

## Later
- <noticed, out of scope>
```

**`.boxbox/<feature>/plan.html`**: copy it with `cp .boxbox/templates/plan.html .boxbox/<feature>/plan.html` and fill its sections following "Pages" in `GUIDE.md`. `{{ROOT}}` is `../`. One `article.epic` per epic; every task names its first test, how it can fail and its files. Overridden recommendations get the `override` row class. Then run `node .boxbox/pitwall/check-page.js .boxbox/<feature>/plan.html` and fix everything it reports, until it prints `OK`. Only then show the page. Every epic shows its acceptance criteria under "Done when": the developer is approving what "done" means, not only the task list.

## 6. Update and stop

- `board-data.js`: every epic and task with status `todo`, each epic's `files` from `plan.md`, links to context, decisions and plan, and `waiting` set to "Approve the plan" with a link to `plan.html`. If `modules` is empty (discover was skipped), fill it now.
- `state.md`: `phase: plan-review`, `waiting_for_developer: yes`, `next: build E1 after approval`.
- Open `plan.html` and print its path.

Then run `sh .boxbox/pitwall/say ask "Stop 1: approve the plan" --kind plan --stage plan-review` and stop. Say what the plan is in three lines, name the first unit, and ask for "go" or changes. Remind them they can change the unit of control, reorder epics, or add or remove a design stop now. If the plan holds a decision that is costly or cannot be undone, offer to challenge it first: "say 'grill the plan' if you want me to try to break it".

**Do not write feature code until the developer approves.** When they do: set `approved: yes, <date>` in `plan.md`, update `state.md` (`last_approved`, `phase: build`, `unit: E1 todo`, `waiting_for_developer: no`), change the status marks and the "Your move" callout on `plan.html` as its comments describe (then run the checker again), clear `waiting` on the board, and continue with the **boxbox-build** skill for the first unit.

## If the plan grows

If the plan grows well beyond the request, say so and propose what to cut. If the developer changes scope later, re-run this skill for the affected epics and keep the ids of finished work.
