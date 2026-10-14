---
name: boxbox-tdd
description: Build or change behaviour test-first. Use for every task in a Boxbox build, and whenever the developer asks for TDD, a failing test first, a regression test, or red-green-refactor.
---

# Boxbox TDD

A test written first is how you and the developer both know the code does what the task says. A test written after only proves the code does what it does.

## The loop, for one task

1. **Write the test.** One behaviour, named for what it proves. Call the code the way its real users will.
2. **Run it and watch it fail for the right reason.** "Function not found" is the wrong reason if you meant to test behaviour: add the empty function, run again, and see the assertion fail. If it passes before you write code, the test proves nothing: fix the test.
3. **Write the least code that makes it pass.** No extra options, no "while I am here".
4. **Run everything.** The whole suite, the linter, the type checker. Read the output; do not assume.
5. **Refactor** only while everything stays green. Then commit test and code together.

**More tests in the same task.** Edge cases and failure modes often pass at once because the first implementation already covers them. That is fine, but prove the test can fail: break the line it guards, see it go red, put the line back.

**A pure refactor** (same behaviour, cleaner code) needs no new test. The existing suite must pass before and after, unchanged.

## Tests that mean something

- Assert on results a user of the code can observe, against literal expected values. A test that only checks a mock was called proves nothing.
- Ask: would this test fail if the behaviour broke? If not, rewrite it.
- Cover the failure modes named in the plan, not only the happy path: bad input, empty input, the timeout, the duplicate.
- Unit tests never touch a real network, a real model or a production database. Use fakes or recorded responses.
- Follow the repo's existing test style and helpers.
- **As many tests as the behaviour needs, no more.** One logical unit test per behaviour or acceptance criterion, one per failure mode, and one end-to-end test through the real entry point (the command, the route, the screen) when the task changes what a user sees. When the task has a brief, its Tests section is the list. Do not test the language, a library or trivial code, and do not test the same thing twice with different numbers.

## What you must not do

- Do not weaken, skip or delete a test to make the suite pass. If a test is wrong, say so and fix the test on purpose, in its own commit.
- Do not write the code first and the test after.
- Do not trust a green result you did not see. Exit codes hidden by pipes and stale builds produce false greens: run the command plainly and read it.

## When there is no cheap test

Some tasks have none: a console setting, a cloud permission, a one-off migration. Do not invent a fake test. State how the task is verified by hand, do it, record exactly what you observed, and make sure the report lists it as not covered by a test.
