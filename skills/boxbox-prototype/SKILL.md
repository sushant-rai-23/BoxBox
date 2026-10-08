---
name: boxbox-prototype
description: Answer a design question with throwaway code before committing to an approach. Use when a decision depends on something only running code can show, such as whether a library does what is needed, which of two approaches is faster or simpler, or what an interaction feels like, or when the developer says prototype this, spike this, or try both and compare.
---

# Boxbox prototype

Some questions cannot be settled by reading or arguing. Write the least code that answers the question, learn from it, and throw it away.

## 1. State the question first

Write one sentence: "I want to find out whether ..., and I will know by seeing ...". Say what result would mean yes and what would mean no. If you cannot say what would change your mind, a prototype will not help: use **boxbox-grill** or ask the developer.

Tell the developer the question and how long you expect it to take before you start.

## 2. Build it where it cannot leak

- Prefer a scratch folder outside the repo (a temp directory): nothing can leak from there. Use a branch named `proto-<question>` only when the prototype must run inside the codebase. Before cutting it, commit any pending `.boxbox/` changes on the feature branch so they do not travel with you; commit the prototype on its own branch so deleting the branch removes it. Never prototype on a feature or epic branch.
- Write only what answers the question. No tests, no error handling, no polish, hard-coded values are fine.
- Comparing approaches: build each just far enough to compare, and compare them on the same input.
- Do not touch shared data, real services or anything on the "Ask first, always" list in `.boxbox/GUIDE.md`.

## 3. Run it and report

Show the developer what you ran and what you saw: the output, the timing, the number of lines, whatever answers the question. Then say plainly what it means for the decision, and what the prototype did not test.

Measure before you claim. "Approach A took 40 ms and B took 400 ms on 10,000 rows" is a result. "A feels faster" is not.

## 4. Decide, record, delete

1. The developer decides, with the evidence in front of them. Record it as `.boxbox/GUIDE.md` says under "Recording a decision", with the measured result as the reason.
2. Delete the prototype folder, or switch back and delete the branch (`git branch -D proto-<question>`). Ask first if the developer may want to look at it. Check `git status` afterwards: nothing from the prototype may remain.
3. Commit the record on the feature branch: `Boxbox: decision <id> from prototype`.
4. Build the real thing from scratch through **boxbox-build**, test-first. Never merge or copy prototype code into the feature: it was written without tests on purpose.
