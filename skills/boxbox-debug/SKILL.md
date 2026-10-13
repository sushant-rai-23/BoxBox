---
name: boxbox-debug
description: Find the root cause of a bug, failing test or unexpected behaviour before changing code. Use when something is broken, a test fails for a reason you do not understand, a fix did not work, or the developer says debug, diagnose or why is this failing.
---

# Boxbox debug

Find the cause, tell the developer, then fix it. A fix without a known cause is a guess, and guesses pile up.

## 1. Reproduce

If the repo has `.boxbox/`, tell the pit wall: `sh .boxbox/pitwall/say stage debug --why "<the symptom in one line>"`.

Get the failure to happen on demand with one command, and write that command down. If you cannot reproduce it, say so and gather more facts: exact error, logs, inputs, what changed recently (`git log`, `git diff`).

## 2. Read before you theorise

Read the whole error and the whole stack trace. Read the code on the path. Check your assumptions against what is actually there: the installed version, the real config value, the real data.

## 3. One hypothesis at a time

State it as a sentence: "It fails because X, so if I do Y I will see Z." Do Y. If you do not see Z, the hypothesis is wrong: drop it, do not stretch it.

- Change one thing at a time.
- Narrow the problem: halve the input, the code path or the commit range (`git bisect`).
- Add temporary logging to see real values. Remove it afterwards.

## 4. Ask why until you reach the cause

A null check that silences a crash is a symptom fix. Ask why the value was null, and why that happened, until you reach the thing that, once fixed, makes the whole class of failure impossible.

If two fixes built on the same assumption have failed, the assumption is wrong. Question it before trying a third.

## 5. Tell the developer before fixing

In a few lines: what failed, the root cause with the evidence, the fix you propose, and anything else the same cause may have broken. For a one-line cause in code you are already building, say it and proceed. For anything that changes design or behaviour, wait for their answer.

## 6. Fix with a test

Use **boxbox-tdd**: first a test that fails because of the bug, then the fix. Run everything. If the developer corrected your approach, or this is the second bug of the same kind, use **boxbox-lessons**.

## Stop and ask when

- You have spent three hypotheses without progress. Say what you ruled out.
- The cause is outside this task: another service, infrastructure, data.
- The fix needs something on the "Ask first, always" list in `.boxbox/GUIDE.md`.
