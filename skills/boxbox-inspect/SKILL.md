---
name: boxbox-inspect
description: Have finished work reviewed by a separate reviewer before the developer sees it, and act on review feedback. Use after a Boxbox unit is built and verified, when the developer asks for a code review of a branch or diff, when responding to the developer's review or pull request comments, and in page mode after writing a report, context, review or explain page, to fact-check its claims against the repo before the developer sees it.
---

# Boxbox inspect

The agent that wrote the code is the worst placed to judge it. A second pair of eyes that did not write it comes first; the developer's eyes come after.

## 1. Get a separate reviewer

For a Boxbox unit, tell the pit wall: `sh .boxbox/pitwall/say stage inspect --unit <E1>`. The reviewer subagent then shows in the Steward lane.

**If your agent can run subagents:** start a fresh one as the reviewer. It must not see the build conversation. Give it only:

- the diff: `git diff <base>...HEAD` (base is the feature branch for an epic, or the previous commit for a task)
- the unit's outcome, acceptance criteria and failure modes from `plan.md`
- the conventions from `context.md` and the decisions that apply
- the checklist below, and this instruction: "Report findings as a list. For each: file and line, what is wrong, why it matters, severity (must fix, should fix, note). Do not fix anything. Say what you checked and found fine."

If your agent lets you pick a model for a subagent, a different model from the one that built the unit is better still. In Claude Code the reviewer and the page fact-checker always run on the session model: never use a Boxbox agent for them and never route them down (see "Model routing" in `GUIDE.md`). Under `models: balanced` or `save` most builder tasks ran on a cheaper model, so the reviewer usually differs from the builder; risky and `L` tasks, and epics with a `model:` override, may have run on the same model.

**If you cannot run subagents:** review it yourself, after verification is finished. Read the whole diff top to bottom, file by file, against the checklist, as if a stranger wrote it. Say in the report that the review was not independent.

## 2. The checklist

- **Does what was asked.** Every acceptance criterion is met and a test proves it. Nothing extra was built.
- **Tests are real.** Each would fail if the behaviour broke. None only assert that a mock was called. None were weakened.
- **Tests are not padded.** No two tests check the same thing, none tests the language, a library or trivial code, and each task has its end-to-end test when a user sees the change. Flag duplicates as "should fix" with the test names.
- **Fails safely.** Each failure mode in the plan is handled and tested. Errors, timeouts and empty inputs do not crash or hang. Nothing fails silently.
- **Safe.** No secrets, keys or personal data in code, logs or tests. Input from outside is checked at the boundary. No new way to bypass a permission.
- **Fits the codebase.** Names, structure and style match what is there. It uses the project's existing helpers instead of new copies. Terms match `glossary.md`.
- **Simple.** No wrapper with one caller, no option nobody asked for, no dead code, no leftover debug output. Could it be smaller?
- **Stays in scope.** Nothing outside the unit changed.
- **Explainable.** A developer could follow each file. Anything surprising has a comment saying why.

## 3. Act on the findings

- **Must fix and should fix:** check each against the code first. If the reviewer is right, fix it as a new commit, `<E1> review: <what changed>`, and re-run all checks. A fix that changes behaviour gets a failing test first (**boxbox-tdd**); a pure refactor does not. If the reviewer is wrong, do not change the code; note why.
- **A finding that conflicts with the plan or a recorded decision:** do not quietly pick a side. Tell the developer.
- **Notes:** leave the code, record them.

Write a short review note for the report: what was checked, what was fixed because of it, what was left alone and why, and anything still uncertain.

## Page mode: fact-check a page before the developer sees it

Run this after writing a report, context, review or explain page, once `check-page.js` prints `OK`. The checker proves the page's references and facts exist; it cannot tell whether a sentence about behaviour is true. A fresh pair of eyes does that.

1. **A separate fact-checker.** If your agent can run subagents, start a fresh one that did not write the page. Give it only the page's path, the repo, and this instruction:

   "Read `<page>`. For every claim labelled `inferred`, and every claim about how the code behaves (labelled `code` or `observed`), check it against the repo at the commit in the article's `data-commit`: open the files and lines it cites, read the code, run a test if that is the only way to know. List every claim that is false or unsupported, with the page line, what it says, what is actually true, and the evidence (path:line, command output). Say which claims you checked and found true. Do not edit the page."

   Without subagents, do it yourself, claim by claim, as if a stranger wrote the page, and say on the page that the fact-check was not independent.
2. **Fix what it found.** Correct each false claim, or relabel it `unknown` if the truth cannot be established. Never keep a claim you could not support by relabelling it `inferred`. Run `check-page.js` again.
3. **Then show the page.** In your message, say in one line how many claims were checked and how many were corrected.

On a knowledge page, the fact-checker also opens each `source` link and confirms it supports the claim next to it.

## Responding to the developer's review

- Read every comment before changing anything.
- If a comment is unclear, ask. If you think it is technically wrong, say so with evidence and let them decide. Agreement you do not mean helps nobody.
- Make each requested change as its own small commit so they can see it.
- A correction about how you work goes into `.boxbox/lessons.md`.
