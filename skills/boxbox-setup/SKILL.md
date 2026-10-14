---
name: boxbox-setup
description: Set up Boxbox in a repository, once. Use when .boxbox/ does not exist yet, or when the developer asks to set up, configure or reconfigure Boxbox, change the unit of control or decision level, or install skills for this repo's stack.
---

# Boxbox setup

Make the `.boxbox/` folder, learn how this repo works, ask the developer how much control they want, and get the right skills in place. Takes a few minutes. Do it once per repo.

If `.boxbox/config.md` already exists, this is a reconfigure: show the current config, ask what to change, change only that.

**Refreshing the kit.** After the pack is updated, or when a skill reports a template missing, copy the fixed files from the kit over the repo's copies: `board.html`, `assets/`, `templates/`, and everything in `pitwall/` except `prices.json` (copy that one only if the developer never edited it). Restart a running pit wall afterwards: `kill $(cat .boxbox/live/pid)`, then `node .boxbox/pitwall/server.js --ensure`. For `GUIDE.md`, compare first: if the repo's copy differs from the kit's only because the kit is newer, replace it; if the developer edited it, show them the difference and ask. Never touch `config.md`, `state.md`, `decisions.md`, `glossary.md`, `lessons.md` or `board-data.js`.

## 1. Copy the kit

The kit is the folder named `kit` in the same directory as this SKILL.md (in Claude Code: `${CLAUDE_SKILL_DIR}/kit`).

Copy its whole contents into `.boxbox/` at the repo root:

```
mkdir -p .boxbox && cp -Rn "<kit path>/." .boxbox/
```

`-n` keeps any file that is already there. Never overwrite an existing `config.md`, `state.md`, `decisions.md`, `glossary.md`, `lessons.md` or `board-data.js`.

Copy only with `cp`. Never recreate kit files by reading them and writing them out: the pit wall's files are too large to copy that way, and a rewritten `server.js` or hook script is no longer the tested one. If `mkdir` or `cp` is refused, ask the developer to allow it or to run the command themselves, and wait. Never skip setup or switch to another flow because of it.

Then, in this order:

1. Read `.boxbox/GUIDE.md`. It is the contract for everything below.
2. Add `.boxbox/live/` to the repo's `.gitignore` (create the file if there is none). That folder holds the pit wall's live data and is never committed.
3. Run `sh .boxbox/pitwall/say stage setup --why "setting up Boxbox in this repo"`.
4. If `node --version` shows 18 or later, start the pit wall without opening it, so the developer can watch setup: `node .boxbox/pitwall/server.js --ensure`. Print the URL it returns.

From here, keep telling the pit wall where you are (see "Stage events" in `GUIDE.md`).

## 2. Learn the repo

Run `sh .boxbox/pitwall/say stage learn-repo`.

Read, do not ask. Find:

- Languages, frameworks and versions.
- The commands to test, lint, type-check and run. Run the test command once to confirm it works and note how long it takes.
- The main branch, whether there is a remote, and whether it is GitHub or GitLab (`git remote -v`). Check whether `gh` or `glab` is installed.
- Instruction files already present: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, contributing guides. Follow them.
- Skills already installed for this agent.

## 3. Ask the developer

Ask one question at a time. Put your recommended answer first. Use your agent's question tool if it has one. Right before each question, run `sh .boxbox/pitwall/say ask "<the question in a few words>" --kind setup`, so the pit wall shows it as your move. There are up to six questions; skip only the ones this step says to skip.

1. **What you know.** "This repo uses <stack list>. Which of these do you know well, and which are new to you?" This sets how much the reports teach. Write the answer into `config.md` as two lists of concrete topics, in the developer's words (`known: [JavaScript, Node HTTP servers]`, `new: [cryptography]`).
2. **Unit of control.** "Where should I stop for your review: after each epic (one feature), or after each task (one small change)?" Recommend epic. Recommend task if most of the stack is new to them.
3. **Decision level.** "How many decisions do you want to make?"
   - `everything`: I ask every open decision.
   - `what matters` (recommended): I ask what is hard to change later or shapes the design. I pick small reversible defaults and list them for you to override.
   - `decide and show`: I ask only what cannot be undone, and list everything else.
4. **Pushing.** Only if there is a remote: "May I push branches and open draft pull requests for your review?" Answers: `yes`, `ask` each time, `no` (local diffs only).
5. **Pit wall.** Only if Node 18+ is installed (`node --version`): "Open the pit wall in your browser when a session starts? It is a local live page showing what I am doing, what waits on you, and what it costs." Answers: `yes` (recommended, writes `pitwall: open`), `start it but don't open` (`pitwall: start`), `off` (`pitwall: off`). Without Node, write `pitwall: off` and say the classic board is their home page.
6. **Models.** Only in Claude Code: "Which models should my helpers use? `balanced` (recommended): Sonnet builds, Haiku searches and runs checks, and your session model keeps planning and review. `best`: everything on your session model. `save`: cheapest, Haiku for everything but building. `auto`: Boxbox sets no models and Claude Code decides." Write the answer as `models:`. Then write `parallel: off` and say in one line that `parallel: on` builds independent tasks at once in separate worktrees, if they want it later. In Codex, skip this question and write neither line.

Do not ask anything the repo already answered. With no remote, do not ask about pushing: set `push: no`.

## 4. Skills for this stack

Run `sh .boxbox/pitwall/say stage install-skills`.

Work out which skills would make you reliably good at this repo's stack: one per main framework or domain, at most three. If the stack is small or you already handle it well, the right answer is none: say so in one line, write `skills: none` in `config.md`, and move on. Otherwise, for each, choose:

- **Use an existing one** when a well-known, maintained, open-source skill covers it. Check what is already installed first. If you have web access, look for one (for example on skills.sh or the framework's own docs). Read the whole skill before proposing it; skip any that runs scripts you do not understand or has no clear license.
- **Write a short one** when nothing good exists or the need is specific to this project. It holds this repo's conventions only: structure, naming, error handling, test style, commands, the gotchas you found. Under 150 lines. Save it in the project skills folder your agent reads: `.claude/skills/<name>/SKILL.md` for Claude Code, `.cursor/skills/` for Cursor, `.agents/skills/` for Codex. If you are not sure where your agent reads project skills, ask the developer.

Show the developer the list before doing anything:

| Skill | Install or write | Why |
| --- | --- | --- |

Wait for their yes. Then install or write. Do not spend long here: a thin correct skill now beats a perfect one later, and it can grow through `lessons.md`.

## 5. Write the files

Using the formats in `GUIDE.md`:

- `config.md` with everything above, including the `pitwall:` line.
- `state.md` with `phase: none` and `next: waiting for a feature request`.
- `decisions.md`, `glossary.md`, `lessons.md` came with the kit, with their header rows. Leave them.
- `board-data.js`: set `project`, `unit`, `decisionLevel`, `updated`. Leave `milestones` empty.

Add one line to the repo's agent instruction file (`AGENTS.md`, or `CLAUDE.md` if that is what the repo uses; create `AGENTS.md` if neither exists):

```
This repo uses Boxbox. For any feature, bug or planning work, use the boxbox skill, and read .boxbox/GUIDE.md and .boxbox/state.md first.
```

Do not commit yet. The `.boxbox/` folder and this instruction file are committed together when the first feature branch is created (see the git model in `GUIDE.md`).

## 6. Tell the developer

Unless `pitwall: off`, open the pit wall: `node .boxbox/pitwall/server.js --ensure --open` (with `pitwall: start`, leave out `--open`), and print the URL.

**In Codex**, the live feed and pause need Codex to trust Boxbox's hooks once. Tell the developer: "Run /hooks in Codex and trust the Boxbox hooks. Do it again after every Boxbox update, since an update changes them." Until then the pit wall shows a note saying so.

In a few lines: what you found, what you set (unit, decision level, pushing, pit wall), which skills are in place, and that the pit wall is their home page (`.boxbox/board.html` without it). Then return to the **boxbox** skill and continue with their request.
