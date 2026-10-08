# Boxbox

AI coding that pits for review.

"Box, box" is the radio call that brings a Formula 1 driver into the pits. The AI agent is the driver: fast, and doing the driving. You are the pit wall: you have the data, you make the calls, and the car comes in when you say. You type a feature. The agent reads your codebase, splits the work into milestones, epics and tasks, asks you for the decisions that matter, and builds one small tested unit at a time. After every unit it stops, opens the code for review, and shows you a page that explains what was built and why.

You end up with code you can explain, because you made the decisions and read the reasoning.

## Install

### Claude Code (CLI and the VS Code extension)

Run these once on your machine. The first line registers this repo as a plugin source; the second installs the plugin. Then restart Claude Code.

```
claude plugin marketplace add sushant-rai-23/BoxBox
claude plugin install boxbox@boxbox
```

The same two commands work typed into the chat box, with `/plugin` in place of `claude plugin`.

To update later: `claude plugin update boxbox@boxbox`. To install from a local clone instead, give the folder path in place of `sushant-rai-23/BoxBox`.

The plugin includes a session-start hook, so the flow starts on its own when you describe a feature.

### Cursor, Codex, or any other agent that reads skill folders

```
./install.sh cursor      # ~/.cursor/skills
./install.sh codex       # ~/.agents/skills
./install.sh claude      # ~/.claude/skills, if you prefer plain skills to the plugin
./install.sh --dir <your agent's skills folder>
```

Add `--project` to install into the current repo instead of your home folder.

Without the hook, start the flow by naming it: "use boxbox to add password reset". After the first run, setup adds a line to the repo's `AGENTS.md` so later sessions start on their own.

## What you get

- **A board** (`.boxbox/board.html`): the whole project as a tree of milestones, epics and tasks, with status and links to every page.
- **A context page** before any decision: what exists, what the feature touches, which concepts are new to you, how it can fail.
- **A decisions page**: one card per decision, with options, trade-offs and a recommendation. You answer one at a time.
- **A plan page** you approve before any code is written.
- **A design page** for large epics: data shapes and interfaces, approved before the code.
- **A report per unit** that teaches the code that was just written, at your level, with a pull request to review.
- **Knowledge pages** for anything in the stack that is new to you.
- **An explanation page** for any existing feature, on request: say "explain the login feature".

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

Things you can say at any stop: `go`, `change ...`, `switch to task-level`, `ask me everything`, `decide and show`, `park D3`, `explain ...`, `why ...`, `grill the plan`, `design E2 first`, `prototype ...`, `pause`.

Open `.boxbox/board.html` in a browser at any time to see where things stand.

## How much control

| Setting | Options |
| --- | --- |
| Unit of control | `epic` (stop after each feature) or `task` (stop after each small change) |
| Decision level | `everything`, `what matters` (default), `decide and show` |
| Pushing | `yes`, `ask`, `no` |

All three live in `.boxbox/config.md` and can be changed whenever you like. Whatever the level, the agent never does something that cannot be undone without asking.

## The skills

| Flow | |
| --- | --- |
| `boxbox` | Entry point. Picks the flow for the request |
| `boxbox-setup` | One-time setup for a repo |
| `boxbox-discover` | Reads the code, writes the context page |
| `boxbox-plan` | Splits the work, collects decisions, writes the plan |
| `boxbox-build` | Builds one unit, test-first |
| `boxbox-report` | Writes the report, opens the code for review, handles your reply |
| `boxbox-primer` | Writes a knowledge page |
| `boxbox-resume` | Picks up or pauses work |

| Craft | |
| --- | --- |
| `boxbox-tdd` | Test-first loop |
| `boxbox-debug` | Root cause before fix |
| `boxbox-verify` | Prove it by running it |
| `boxbox-review` | A separate reviewer, and acting on your comments |
| `boxbox-how` | Explain how part of the codebase works |
| `boxbox-why` | Find why code is the way it is, from git and issue history |
| `boxbox-grill` | Challenge a plan or a decision before it is built |
| `boxbox-design` | Data shapes and interfaces for your approval before a large epic |
| `boxbox-prototype` | Throwaway code to settle a design question |
| `boxbox-lessons` | Turn your corrections into rules and checks |

## Status

Version 0.3.0. Built and tried with Claude Code. The Cursor and Codex manifests and install paths follow what other skill packs ship and have not been run on those agents yet.

## License

MIT. See `NOTICE.md` for the projects whose ideas this builds on.
