---
name: boxbox-review
description: Help a person review a branch, pull request or unit they did not build, at the depth they choose, with notes that say where to look first, what to check and what the checks found. Use when the developer says review this, help me review this PR, help me review this branch, I need to review X, or /review. Never approves, merges or changes code.
---

# Boxbox review

This is **boxbox-explain** from the reviewer's side. The reviewer did not write this code and may not know this codebase. Give them a page that tells them what the change does, where to look first, what to check and what was already checked by machine. This skill never approves, never merges and never changes code. Posting comments to the pull request is the reviewer's call.

Read `.boxbox/GUIDE.md`, `config.md` and `lessons.md` first.

## 1. Find the work

1. If `.boxbox/` is missing, run **boxbox-setup** first. Then tell the pit wall: `sh .boxbox/pitwall/say stage review --why "<the branch or pull request>"`.
2. Work out what is under review. Default: the current branch against the main branch. Accept a branch name, a pull request number or a pull request URL (`gh pr view <n> --json headRefName,baseRefName,title,body,url`).
3. Read what already describes it before the diff: the pull request body, plans or specs in `docs/`, decision records, earlier Boxbox pages (`context`, `plan`, `report`, `explained`). If you cannot tell which work is meant, ask one question.

## 2. Ask the reviewer

One question at a time. Put your recommended answer first. Use your agent's question tool if it has one.

1. **Depth.** "How deep do you want to go?"
   - `skim` (ten minutes): what changed, the risks, where to look.
   - `standard` (recommended): a walk-through per piece.
   - `deep`: file by file, with the code, and the concepts taught.
2. **Who is reviewing.** "Are you the developer in `config.md`, or someone else?" If someone else, ask what they know of this stack and what is new to them. Do not overwrite `config.md`; note the reviewer's answers on the page and let them set the depth of each explanation.
3. **Focus.** "Everything, or one of: correctness, security, design, tests?"

## 3. Split the change

Split it into pieces the way **boxbox-explain** does for finished work: by the plan's epics or phases if there is one, otherwise into groups of commits a person would review separately, in build order.

If an explained page or knowledge pages already cover this work, link to them. Do not write them again.

## 4. Run the checks

Run the test, lint and type commands from `config.md` now (**boxbox-verify**) and keep the real output. Have the whole diff checked by a separate reviewer (**boxbox-inspect**, steps 1 and 2 only). Keep its findings with their severity. Fix nothing.

## 5. Write the review notes

Say `stage review-notes`. Write `.boxbox/reviews/<name>.md` for agents (`<name>` is the branch or pull request, lowercase-with-dashes):

```
# Review notes: <name>
reviewer: <developer | name, with what they know and what is new>
depth: skim | standard | deep
focus: everything | correctness | security | design | tests
base: <branch>   head: <branch>   pr: <url or none>

## Does
- <three lines>
## Not done yet
- <what the change leaves open>
## Start here
- <path:lines>: <why>
## Pieces
- <piece>: <commits> · <what to check>
## Checks run now
- <command> -> <result>
## Findings
- <must fix | should fix | note> <path:lines>: <what>
## Decisions
- <id> <choice> (<override if so>)
```

Then copy it with `cp .boxbox/templates/review.html .boxbox/reviews/<name>.html` and fill its sections following "Pages" in `GUIDE.md`. `{{ROOT}}` is `../`. Then run `node .boxbox/pitwall/check-page.js .boxbox/reviews/<name>.html` and fix everything it reports, until it prints `OK`. Then fact-check it with **boxbox-inspect** in page mode, fix what it finds, and only then show the page. If the template is missing, refresh the kit as **boxbox-setup** describes. Its sections:

- **What the change claims to do**, in three sentences, and what is not done yet.
- **The request path** through the changed code.
- **File by file**, riskiest first: what changed, why, what to check, questions to ask the author, and a compare link (or the diff command) for just that piece. At `skim` depth this is one line per piece. At `deep` depth it includes the code and a definition for each term that is new to the reviewer.
- **Evidence**: the checks run now and their results, and what could not be verified.
- **Findings** from **boxbox-inspect**, worst first, each marked must fix, should fix or note.
- **Decisions** the author made, with overrides marked (`tr.override`).
- **Questions to ask the author**, each tied to a file and line.
- **Risks** after merging, worst first.
- **Review checklist**: boxes specific to this change, at the depth the reviewer chose. Not a generic list.
- **Related pages** in the footer: only the context, plan, report and explained pages that exist.

Keep the focus the reviewer chose: one line on what is outside it, no more.

## 6. Board and commit

Add a "Review" link for this work on the board: on its milestone if the work has one in `board-data.js`, otherwise under `knowledge`, titled "Review: <name>". Commit `.boxbox/` as `Boxbox: review notes for <name>`.

## 7. Open it and stop

Open the page and print its path. Open the code on GitHub: `gh pr view --web` if a pull request exists, otherwise `gh browse --branch <branch>`. If `gh` is missing, print the URL.

Then run `sh .boxbox/pitwall/say ask "Review notes for <name> are ready" --kind unit` and stop. Offer, in one line each:

- explain any part (**boxbox-explain**)
- dig into the history of a choice (**boxbox-why**)
- challenge the design (**boxbox-grill**)

Post review comments to the pull request only if the reviewer asks for it, and show them the text first.
