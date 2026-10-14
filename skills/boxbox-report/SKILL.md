---
name: boxbox-report
description: Write the report for a finished unit, open the code for the developer's review, and stop. Use when a Boxbox unit has been built, verified and reviewed, when the developer approves or asks for changes on a unit, or when they ask for a report or explanation of what was just built. Produces report.md for the agent and a teaching report.html for the developer.
---

# Boxbox report

The developer must be able to read this page, understand the code, and decide with confidence. "If you cannot explain it, do not merge it" is the bar; this page is how they get there.

Read `.boxbox/GUIDE.md` and `config.md` first. Create `.boxbox/<feature>/<unit>/`, named `e1-<slug>` with the same slug as the unit's branch. Tell the pit wall: `sh .boxbox/pitwall/say stage report --unit <E1>`.

Get the unit's cost and scope from the pit wall, if `.boxbox/pitwall/server.js` exists and Node is installed: `node .boxbox/pitwall/server.js --summary <E1>` prints a "Cost:" line (tokens, new versus cache, and an approximate cost from `prices.json`) and an "Edited outside scope:" line. It reads the session logs directly, so the server need not be running. Without it, leave both out; never estimate tokens or cost yourself.

## 1. Write report.md (for agents)

```
# Report: <unit id> <title>
status: review
branch: <branch>
pr: <url or none>

## Commits
- <hash> <task id, or "review"> <one line>

## Built
- <path>: <what it is>

## Interfaces added or changed
- <function, endpoint, table, config key>: <signature or shape>

## Decisions and defaults made while building
- <id> <choice>: <why>

## Verified
- <acceptance criterion> -> <test or run, with the result>
- <failure mode> -> <test>

## Not verified
- <what could not be confirmed, and why>

## Cost
<the "Cost:" line from --summary, as printed>

## Outside scope
- <file edited outside the epic's files, and why>, or "none"

## Gotchas
- <problem met>: <cause> -> <fix>

## For the next unit
- <what the next unit can rely on>
```

## 2. Write report.html (for the developer)

Copy it with `cp .boxbox/templates/report.html .boxbox/<feature>/<unit>/report.html` and fill its sections following "Pages" in `GUIDE.md`. `{{ROOT}}` is `../../`. Then run `node .boxbox/pitwall/check-page.js .boxbox/<feature>/<unit>/report.html` and fix everything it reports, until it prints `OK`. Then fact-check it with **boxbox-inspect** in page mode, fix what it finds, and only then show the page.

**In Claude Code, hand the page-filling to `boxbox:boxbox-writer`** (with `model` from "Model routing" in `GUIDE.md`). Give it the page path and the facts, in this order: the fixed part (the "Pages" and "Writing for the developer" sections of `GUIDE.md`, the developer's `known` and `new` lists), then `report.md`, the diff (`git diff <base>...HEAD -- . ':!.boxbox'`), the `--summary` output and the test output. It fills and checks the page; you stay responsible for it. Read what it returns, especially every claim it marked `unknown`. The fact-check is never handed to the writer: it runs on the session model.

- **Order the pieces the way a request meets them**, not the order you wrote them.
- **Use the real code** from the diff, trimmed to what matters, with its path.
- **Depth follows the developer.** For anything `config.md` marks as new, explain the concept before the code and define each term. For what they know, one line is enough. Where it helps, compare with a stack they know.
- **Say why.** For each real design choice, name the alternative and the trade-off.
- **Facts come from data.** Test results, line counts, commits, tokens, cost and time are what the pit wall and git say: `node .boxbox/pitwall/server.js --summary <unit>`, `git diff --numstat <before>..<last>`, `git rev-list --count <before>..<last>`. Set the article's `data-range` and `data-commit` to the unit's commits. Each task's state is the pit wall's: `verified` only for a passing run it saw after the task's last edit, `claimed` otherwise.
- **Each task quotes its brief.** In the tests section, every task carries the Goal line of its brief in `<q data-brief="<feature>/<unit>/tasks/<task id>.md">`, copied exactly, and links the brief; the checker compares the quote with the file. A task built without a brief (work from before 0.7) says so instead.
- **Every claim is labelled** (`observed`, `code`, `inferred`, `unknown`, `source`). "unknown" is allowed; guessing is not. Quote code with `data-quote`, cite lines as `path:line`, name tests with `data-test`.
- **Verify these yourself** closes the report: the three claims that matter most if they are wrong, each with a one-minute way to check it.
- **Gotchas are real ones** you hit, with cause and fix, as callouts. No invented ones.
- **Risks** include the separate reviewer's findings that were left alone, and why. If the review was not independent, say so.
- **Not verified** is honest. "Nothing" only if true.
- **Cost**: the numbers from `--summary` in the Cost section. Say it is approximate.
- **Outside scope**: every file from "Edited outside scope", each with why it had to change. Leave the section out when there are none.
- **Check yourself**: two or three questions that test understanding of this unit, each with its answer folded. Ask about why and what-if, not trivia.
- **What now exists**: the commands to run it by hand and the real output.
- **Test it by hand** and **How to roll back**: concrete steps and commands, never generic ones.

For a short-flow change, keep the same template. Required sections stay; say briefly why one has little to say rather than deleting it.

## 3. Update the board, then commit the bookkeeping

- `board-data.js`: unit status `review`, a "Report" link, and `waiting` set to "Review <unit id>" with a link to the report. With no pull request, put the branch and the diff command in `waiting.detail`.
- `plan.md`: the unit's heading to `[review]`. `plan.html`: the epic's status mark to `<span class="status" data-st="move">your review</span>`.
- `state.md`: `phase: unit-review`, `unit: <id> review`, `waiting_for_developer: yes`.

Then make one commit on the unit's branch, `<E1>: report and board`, with everything under `.boxbox/` that changed during this unit. This is the only `.boxbox/` commit for the unit.

## 4. Open the code for review

Follow `git.push` in `config.md`.

- **Unit = epic, pushing allowed:** push the epic branch and open a draft pull request into the feature branch (`gh pr create --draft --base <feature> --head <epic branch>`, or `glab mr create --draft`). Title: `<E1> <title>`. Body:

  ```
  <two-line summary>

  Report: .boxbox/<feature>/<unit>/report.html
  Plan: .boxbox/<feature>/plan.html
  Tasks: <id and one line each>
  Not verified: <list or "nothing">

  Built by an AI agent using Boxbox and reviewed by a separate agent. Needs human review before merge.
  ```

  Open it in the browser if you can (`gh pr view --web`), and always print the URL.
- **Unit = task:** show the commit (`gh browse <hash>` if available), or print `git show <hash> --stat` and the command to see the full diff.
- **No pushing or no remote:** print `git diff <base>...<branch> --stat -- . ':!.boxbox'` in the chat, and give the same command without `--stat` for the full diff. Put both in the report's review note in place of the link.

If a pull request URL only exists after pushing, add it to `board-data.js` and `report.md` afterwards and amend nothing: it goes in with the next `.boxbox/` commit.

## 5. Stop

Open `report.html` and print its path.

Then run `sh .boxbox/pitwall/say ask "Stop 2: review <unit id>" --kind unit --stage unit-review --unit <unit id>` and stop. Say in three lines what was built, where the report and the code are, and what you need: approve, or tell me what to change.

## 6. When the developer replies

**They approve.**

0. Tell the pit wall: `sh .boxbox/pitwall/say stage approved --unit <E1>`, and after the merge in step 1, `stage merged --unit <E1>`.
1. Unit = epic: squash-merge the epic branch into the feature branch with the message `<E1> <title>` followed by the task list. Use the host's merge if a pull request is open (`gh pr merge --squash`), otherwise `git merge --squash`. Do not delete branches unless asked.
2. Record the approval everywhere it shows:
   - `plan.md` and `plan.html`: the unit to `done`.
   - `report.md`: `status: approved, <date>`. `report.html`: the "Your move" callout becomes `data-kind="note"` saying it was approved on <date>. Run the checker again.
   - `board-data.js`: the unit to `done`; `waiting` to `null`.
   - `state.md`: `last_approved`, `waiting_for_developer: no`, and `phase: build` with `unit: <next id> todo` if units remain, or `phase: done` with `unit: none` if not.

   Commit these on the feature branch as `<E1>: approved`.
3. If units remain: name the next one and continue with **boxbox-build**.
4. If it was the last: set the milestone to `done`, clear `waiting` or set it to the developer's own next step, and give the closing summary: what was built, the steps only they can do, the "Later" list, the short retrospective from **boxbox-lessons**, and that opening the pull request into the main branch is theirs.

**They ask for changes.**

1. Set the unit to `changes`. If they commented on the pull request, read the comments (`gh pr view --comments`).
2. If a request is unclear or you think it is wrong, say so and discuss before changing anything. Do not agree just to be agreeable.
3. Make the changes as new commits with **boxbox-tdd**, then **boxbox-verify**, and **boxbox-inspect** if the change is more than small.
4. Add a "Changes after your review" section to `report.md`, and to `report.html` as a new section built from the gallery (`data-section="changes-after-review" data-required="no"`): what they asked, what changed, the new commits. Run the checker again.
5. If they corrected how you work, use **boxbox-lessons**: record the rule, and if it is the second time, propose a check.
6. Set the unit back to `review` and stop again.
