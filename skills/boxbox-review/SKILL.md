---
name: boxbox-review
description: Have finished work reviewed by a separate reviewer before the developer sees it, and act on review feedback. Use after a Boxbox unit is built and verified, when the developer asks for a code review of a branch or diff, or when responding to the developer's review or pull request comments.
---

# Boxbox review

The agent that wrote the code is the worst placed to judge it. A second pair of eyes that did not write it comes first; the developer's eyes come after.

## 1. Get a separate reviewer

**If your agent can run subagents:** start a fresh one as the reviewer. It must not see the build conversation. Give it only:

- the diff: `git diff <base>...HEAD` (base is the feature branch for an epic, or the previous commit for a task)
- the unit's outcome, acceptance criteria and failure modes from `plan.md`
- the conventions from `context.md` and the decisions that apply
- the checklist below, and this instruction: "Report findings as a list. For each: file and line, what is wrong, why it matters, severity (must fix, should fix, note). Do not fix anything. Say what you checked and found fine."

If your agent lets you pick a model for a subagent, a different model from the one that built the unit is better still.

**If you cannot run subagents:** review it yourself, after verification is finished. Read the whole diff top to bottom, file by file, against the checklist, as if a stranger wrote it. Say in the report that the review was not independent.

## 2. The checklist

- **Does what was asked.** Every acceptance criterion is met and a test proves it. Nothing extra was built.
- **Tests are real.** Each would fail if the behaviour broke. None only assert that a mock was called. None were weakened.
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

## Responding to the developer's review

- Read every comment before changing anything.
- If a comment is unclear, ask. If you think it is technically wrong, say so with evidence and let them decide. Agreement you do not mean helps nobody.
- Make each requested change as its own small commit so they can see it.
- A correction about how you work goes into `.boxbox/lessons.md`.
