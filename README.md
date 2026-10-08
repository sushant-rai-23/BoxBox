# /boxbox

AI coding that pits for review.

"Box, box" is the radio call that brings a Formula 1 driver into the pits. The AI agent is the driver: fast, and doing the driving. You are the pit wall: you have the data, you make the calls, and the car comes in when you say. You type a feature. The agent reads your codebase, splits the work into milestones, epics and tasks, asks you for the decisions that matter, and builds one small tested unit at a time. After every unit it stops, opens the code for review, and shows you a page that explains what was built and why.

You end up with code you can explain, because you made the decisions and read the reasoning.

Just tell your agent: `/boxbox:boxbox let users reset their password by email`. Or skip the command and describe the feature: Boxbox picks it up on its own.

## Install /boxbox

**Claude Code** (CLI and the VS Code extension):

```
/plugin marketplace add sushant-rai-23/BoxBox
/plugin install boxbox@boxbox
```

The same two lines work in a terminal as `claude plugin marketplace add ...` and `claude plugin install ...`. Run them once per machine, then restart Claude Code. Then run `/boxbox:boxbox` inside any project (plugin commands carry the plugin name), or just describe a feature: the session-start hook starts the flow on its own.

To update it later:

```
claude plugin update boxbox@boxbox
```

**Codex:**

```
codex plugin marketplace add sushant-rai-23/BoxBox
codex plugin add boxbox@boxbox
```

To update it later:

```
codex plugin marketplace upgrade boxbox
codex plugin add boxbox@boxbox
```

**Any other agent** (Cursor, Copilot, Gemini CLI, opencode, and more), one command via the skills CLI:

```
npx skills add https://github.com/sushant-rai-23/BoxBox --skill '*'
```

Add `-g` to install globally (available in every project); drop it to scope to the current one. Install all the skills: the entry skill hands off to the others by name.

<details>
<summary>No installer? Copy the skills directly.</summary>

```
git clone https://github.com/sushant-rai-23/BoxBox
cd BoxBox
./install.sh claude      # ~/.claude/skills
./install.sh cursor      # ~/.cursor/skills
./install.sh codex       # ~/.agents/skills
./install.sh --dir <your agent's skills folder>
```

Add `--project` to install into the current repo instead of your home folder. Run it again to update.

Without the session-start hook, start the flow by naming it: "use boxbox to add password reset". After the first run, setup adds a line to the repo's `AGENTS.md` so later sessions start on their own.

</details>

**Also works with:** the repo ships `.claude/skills`, `.agents/skills`, `.cursor/skills` and `.opencode/skills` as links to `skills/`, so a plain clone is picked up by Claude Code, Codex, Cursor and opencode as project skills. Any other agent can be pointed at `skills/boxbox/SKILL.md`. On Windows, enable symlinks in Git (`git config core.symlinks true`) or use `install.sh`.

## What you get

- **A board** (`.boxbox/board.html`): the whole project as a tree of milestones, epics and tasks, with status and links to every page.
- **A context page** before any decision: what exists, what the feature touches, which concepts are new to you, how it can fail.
- **A decisions page**: one card per decision, with options, trade-offs and a recommendation. You answer one at a time.
- **A plan page** you approve before any code is written.
- **A design page** for large epics: data shapes and interfaces, approved before the code.
- **A report per unit** that teaches the code that was just written, at your level, with a pull request to review.
- **Knowledge pages** for anything in the stack that is new to you.
- **An explanation page** for any existing feature, milestone or branch, on request: say "explain the login feature" or "explain milestone 0". Works on code built without Boxbox.
- **Review notes** for a branch or pull request someone else built, at the depth you choose: say "help me review PR 42".

Every step also writes a short Markdown file, so a new session or a different model can pick up where the last one stopped.

## Use

In your repo, tell the agent what you want:

```
Let users reset their password by email.
```

The first time, Boxbox sets itself up: it reads the repo and asks you four short questions (what you know, where to stop for review, how many decisions you want to make, whether it may push). Then:

1. It opens the **context page**.
2. It opens the **decisions page** and asks you each decision.
3. It opens the **plan** and waits. Say `go`.
4. It builds the first unit, has it reviewed by a separate agent, opens the **report** and a draft pull request, and waits. Say `approved`, or say what to change.
5. It repeats step 4 for each unit.

Things you can say at any stop: `go`, `change ...`, `switch to task-level`, `ask me everything`, `decide and show`, `park D3`, `explain ...`, `why ...`, `review ...`, `grill the plan`, `design E2 first`, `prototype ...`, `pause`.

Open `.boxbox/board.html` in a browser at any time to see where things stand.

## How much control

| Setting | Options |
| --- | --- |
| Unit of control | `epic` (stop after each feature) or `task` (stop after each small change) |
| Decision level | `everything`, `what matters` (default), `decide and show` |
| Pushing | `yes`, `ask`, `no` |

All three live in `.boxbox/config.md` and can be changed whenever you like. Whatever the level, the agent never does something that cannot be undone without asking.

## The skills and how to use them

Nineteen skills. Most run on their own as part of the flow. Each can also be called directly with `/boxbox:<name>` followed by what you want, in your own words.

### Flow

| Skill | What it does | Runs on its own | Call it directly | Produces |
| --- | --- | --- | --- | --- |
| `boxbox` | Entry point: picks the flow for the request | On any feature, bug or planning request, via the session-start hook | `/boxbox:boxbox let users reset their password by email` | The flow: context, decisions, plan, then one unit at a time |
| `boxbox-setup` | One-time setup: reads the stack, asks four questions | When `.boxbox/` is missing | `/boxbox:boxbox-setup change the unit to task` | `.boxbox/` with `config.md`, the board and the templates |
| `boxbox-discover` | Reads the code a feature will touch, writes the context page | First step of the full flow | `/boxbox:boxbox-discover what would a password reset touch?` | `context.md` and `context.html`; knowledge pages for what is new to you |
| `boxbox-plan` | Splits the work, asks decisions one at a time, writes the plan | After discover | `/boxbox:boxbox-plan re-plan E2 with magic links` | `decisions.html`, `plan.md` and `plan.html`; stops for `go` |
| `boxbox-design` | Data shapes and interfaces for a large epic, for approval before code | When the plan marks an epic `design: yes` | `/boxbox:boxbox-design design E2 first` | `design.md` and `design.html`; stops for approval |
| `boxbox-build` | Builds one unit test-first, verifies it, has it inspected | After `go`, and after each unit is approved | `/boxbox:boxbox-build continue with E2` | One commit per task on the unit's branch |
| `boxbox-report` | Writes the report, opens the code for review, handles your reply | After every built unit | `/boxbox:boxbox-report write the report for E1` | `report.md`, `report.html`, a draft pull request; stops |
| `boxbox-primer` | Teaches one concept, up to the level this project needs | When discover or explain marks a concept new to you | `/boxbox:boxbox-primer teach me job queues` | `knowledge/<topic>.html` |
| `boxbox-resume` | Picks up or pauses work | On `continue`, `go`, `approved`, or when `state.md` shows work in progress | `/boxbox:boxbox-resume where were we?` | Work resumed at the right stop, or `state.md` written for a pause |
| `boxbox-explain` | Explains code or finished work, in chat or as a page. Works on code built without Boxbox | On `explain ...` or `how does X work` at any stop | `/boxbox:boxbox-explain explain milestone 0` | An answer in chat, or `explained/<name>.html` with pieces, commits, decisions, checks and findings |
| `boxbox-review` | Helps you review a branch or pull request you did not build, at the depth you choose. Never approves or merges | Only when you ask | `/boxbox:boxbox-review help me review PR 42` | `reviews/<name>.md` and `.html`: start here, each piece, evidence, findings, a checklist |

### Craft

| Skill | What it does | Runs on its own | Call it directly | Produces |
| --- | --- | --- | --- | --- |
| `boxbox-tdd` | Test-first loop: failing test, least code, refactor | Every task in a build | `/boxbox:boxbox-tdd add a regression test for the empty-cart bug` | A test that failed first, then the code that passes it |
| `boxbox-debug` | Root cause before any fix | On a bug, or when a test fails for an unknown reason | `/boxbox:boxbox-debug why does login return 500 on an empty email?` | The cause, with evidence, before a fix |
| `boxbox-verify` | Proves work by running it, now | Before any claim of done, before every report | `/boxbox:boxbox-verify prove E1 works end to end` | Evidence per acceptance criterion, or "not verified" with the reason |
| `boxbox-inspect` | A separate reviewer agent checks the agent's own diff; acts on your review comments | After every unit is verified, and on requested changes | `/boxbox:boxbox-inspect check this diff` | Findings by severity, fixes as new commits, a review note for the report |
| `boxbox-why` | Finds why code is the way it is, from git and issue history | On `why ...` at any stop; before a plan changes something whose reason is unclear | `/boxbox:boxbox-why why is the session store in Redis?` | An answer with its evidence and how sure it is |
| `boxbox-grill` | Challenges a plan or a decision with hard questions | Offered at the plan stop when a decision is costly to reverse | `/boxbox:boxbox-grill grill the plan` | Holes found, decisions changed, recorded in `decisions.md` |
| `boxbox-prototype` | Throwaway code to settle a design question | When a decision depends on something only running code can show | `/boxbox:boxbox-prototype try both and compare` | A comparison and a recommendation; the code is thrown away |
| `boxbox-lessons` | Turns your corrections into rules and checks | When you correct how the agent works; at the end of a feature | `/boxbox:boxbox-lessons what have we learned?` | A row in `lessons.md`, and a check when a mistake repeats |

## Status

Version 0.4.0. Built and tried with Claude Code. The Codex, Cursor and skills-CLI paths follow what other skill packs ship and have not been run end to end on those agents yet.

## License

MIT. See `NOTICE.md` for the projects whose ideas this builds on.
