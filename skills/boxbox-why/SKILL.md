---
name: boxbox-why
description: Find out why code is the way it is, from evidence. Use when the developer asks why was this built this way, why did we pick X, what is the history of this, is it safe to change or remove this, or before a plan changes something whose reason is not obvious.
---

# Boxbox why

Code shows what was done. The reason is somewhere else, or nowhere. Find it, and be honest about how sure you are. This skill changes no code.

## 1. Look where reasons are written down

Go through these in order and stop when the question is answered.

1. **This project's own records:** `.boxbox/decisions.md`, `.boxbox/glossary.md`, earlier `report.md` files, any ADR or design docs in the repo, comments next to the code.
2. **Git:** `git log --follow -- <file>` for the file's story, `git blame -L <lines> <file>` for the commit that wrote the lines, then `git show <hash>` for its message and what else changed with it. A commit that touched many files together tells you what the change was really about.
3. **The git host,** if `gh` or `glab` is available: the pull request for that commit (`gh pr list --search <hash> --state merged`), its description and review comments, and linked issues.
4. **The code around it:** tests that pin the behaviour, callers that depend on it, a config flag that switches it.

## 2. Answer with a confidence label

Say which of these each part of your answer is:

- **Recorded:** a written reason exists. Quote it and say where it is (commit, pull request, file).
- **Inferred:** no written reason, but the history or the code makes one likely. Say what you saw that points to it.
- **Unknown:** nothing found. Say where you looked.

Never present an inferred reason as recorded. "I could not find why" is a useful answer: it tells the developer to ask a person.

## 3. Say what it means for the change at hand

If the question came up because something is about to change:

- Is the original reason still true?
- What depends on the current behaviour (name the callers and tests)?
- Who to ask, if the history names someone.

## 4. Keep what you learned

If the answer took real digging and will matter again, record it without asking, so the next person does not dig again: a row in `.boxbox/decisions.md` (decided by `history`, with the source and the confidence label), or a term in `.boxbox/glossary.md`. Tell the developer you did. For a quick lookup, record nothing.
