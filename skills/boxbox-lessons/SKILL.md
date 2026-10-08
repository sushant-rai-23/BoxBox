---
name: boxbox-lessons
description: Turn the developer's corrections and repeated mistakes into rules and checks so they do not happen again. Use when the developer corrects how you work or says do not do that again, when the same mistake or review comment appears a second time, at the end of a feature for a short retrospective, or when the developer asks what have we learned or to review the lessons.
---

# Boxbox lessons

A correction that lives only in this conversation is lost when the session ends. Write it down, then try to make the mistake impossible.

## When the developer corrects you

1. Fix the thing in front of you.
2. Add a row to `.boxbox/lessons.md` straight away (it is committed with the next `.boxbox/` commit, or on its own as `Boxbox: lesson added` when no unit is in progress): the date, what was corrected, and the rule from now on. Write the rule so a fresh agent could follow it without this conversation: "Run the full test command, never a single file, before saying tests pass", not "be more careful".
3. If the correction is about project facts and not behaviour (a term, a convention, a decision), put it where it belongs instead: `glossary.md`, `decisions.md`, or the project's stack skill.

## When a mistake happens twice

A rule in a text file depends on someone reading it. A check does not. For anything that has gone wrong twice, or that would be costly once, climb this ladder and stop at the first rung that works:

1. **Structure.** Can the code be shaped so the mistake cannot be written? A type that rules out the bad state, one function everyone must go through, a removed duplicate.
2. **Lint or type rule.** Can the tooling reject it, with a message that names the fix?
3. **Test.** Can a test fail when it happens?
4. **Script or hook.** Can a pre-commit or CI check catch it?
5. **Written rule.** Only when none of the above fit: the row in `lessons.md`, or a line in the project's stack skill or `.boxbox/GUIDE.md`.

Propose the check to the developer before adding it: what it catches, where it goes, what it costs. Changing lint, CI or hook config is on the "Ask first, always" list. Prove the check works by making the mistake once on purpose and seeing it fail. Then note in `lessons.md` that the rule is now enforced, and by what.

A check is code or config, so it gets its own commit, separate from `.boxbox/`: `Lesson: <what the check enforces>`, on the current feature branch. With no feature in progress, ask the developer which branch it belongs on. Make sure the check does not fire on things it should not (a test hook should not block a commit that only touches `.boxbox/`).

## At the end of a feature

A short retrospective, in the closing summary. From the reports, the review notes and `lessons.md`, tell the developer:

- What went wrong more than once, and what you propose to do about each.
- What Boxbox asked you too much or too little. Suggest a change to `unit` or `decision_level` in `config.md` if the stops did not fit.
- Which rows in `lessons.md` are now enforced by a check and can be shortened, and which contradict each other.

Keep `lessons.md` short enough to read at the start of every session. Merge duplicates. Never delete a rule the developer gave without asking.
