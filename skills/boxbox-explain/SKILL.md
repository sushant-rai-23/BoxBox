---
name: boxbox-explain
description: Explain how code or finished work works, at the level of a developer joining the team, in chat or as a saved page. Use when the developer says explain this, how does this work, walk me through this, explain this feature, explain this milestone, explain this branch, document how X works, or asks for more on a decision, a plan item or a report. Works on any code, including code that was not built with Boxbox.
---

# Boxbox explain

Give the developer a working mental model: enough to change the code with confidence, not a line-by-line reading. This skill changes no code.

## 1. Find it

Read the code. Follow one real path end to end: where it starts, what it calls, where the data ends up. For a wide question, and if your agent can run subagents, send two or three to explore different slices, then read the key files yourself.

Check `.boxbox/glossary.md` for the project's own words, and `git log` on the main files when "why is it like this" matters.

## 2. Explain it

1. **Start with what it is**, in one or two plain sentences, with its common name if it has one.
2. **Then how it works here**, as the path a request or a piece of data takes, with file paths and the few lines of code that matter.
3. **Then why it is built this way**, if the code or history shows it. If you are inferring, say so. For a real dig into the history, use **boxbox-why**.
4. **Then what to watch for** when changing it: the non-obvious coupling, the test that covers it, the trap.

Match the developer. Use `developer.known` and `developer.new` in `.boxbox/config.md`: compare with what they know, define what is new. Lead with what they asked; skip what they plainly know already.

For three or more moving parts, a small diagram or a numbered path beats a paragraph.

## 3. Offer the next step

End with one line: what they could ask next, or the file to open first.

## 4. As a page, for a whole feature

When the developer asks to explain an existing feature, or asks for a page, a document or a PDF, write it down instead of answering in chat. Read `.boxbox/GUIDE.md` and `config.md` first.

1. Do steps 1 and 2 above for the whole feature, end to end.
2. Use **boxbox-why** for the parts whose reason is not obvious, and keep its confidence labels.
3. Sort the concepts the feature uses into `known` and `new` for this developer. For each new topic, write a knowledge page with **boxbox-primer**.
4. Copy it with `cp .boxbox/templates/explain.html .boxbox/explained/<feature>.html` and fill its sections following "Pages" in `GUIDE.md`. `{{ROOT}}` is `../`. Then run `node .boxbox/pitwall/check-page.js .boxbox/explained/<feature>.html` and fix everything it reports, until it prints `OK`. Then fact-check it with **boxbox-inspect** in page mode, fix what it finds, and only then show the page. If the template is missing, refresh the kit as **boxbox-setup** describes. It has the same two halves as a context page: project context (where the feature lives, the path a request takes, with real code) and technical context (the concepts, with links to the knowledge pages), plus why it is built this way, what to watch when changing it, and questions to check understanding.
5. Add the page to `knowledge` in `.boxbox/board-data.js`, titled "How <feature> works", so it shows on the board. Open it and print its path.
6. Commit the new pages: `Boxbox: explained <feature>`.

For a PDF, tell the developer to print the page from the browser ("Save as PDF"); the stylesheet has a print layout.

Do not present a guess as a fact. "I did not find where X is configured" is a useful answer.

## 5. Finished work, as a page

When the developer names work that is already built ("explain milestone 0", "explain this branch", "explain PR 12"), with or without Boxbox, do all of this from that one request. Write no feature code. Fix nothing.

1. **Set up.** If `.boxbox/` is missing, run **boxbox-setup** first. Then tell the pit wall: `sh .boxbox/pitwall/say stage explain --why "<the work being explained>"`.
2. **Find the work.** Default: the current branch against the main branch. Accept a branch name, a pull request number or URL, or a commit range. Read what already describes it before the diff: plans or specs in `docs/`, decision records, lessons files, commit messages, earlier Boxbox pages. Do not ask the developer to restate it. If you cannot tell which work is meant, ask one question.
3. **Split it the way it was built.** If a plan names epics or phases, use them and match each to its commits. Otherwise group the commits into pieces a person would review separately: one piece per behaviour that works on its own, in build order.
4. **Write the page.** Copy it with `cp .boxbox/templates/explain.html .boxbox/explained/<name>.html` (`<name>` is the milestone or branch, lowercase-with-dashes) and fill its sections. Then run `node .boxbox/pitwall/check-page.js .boxbox/explained/<name>.html` and fix everything it reports, until it prints `OK`. Then fact-check it with **boxbox-inspect** in page mode, fix what it finds, and only then show the page. Use the optional sections for finished work:
   - A note at the top that the page was written after the build, from the code and its history.
   - In "Piece by piece", one `h3` per piece, in build order: the walk-through from step 2, a commits table (Task, Change, Commit), and a GitHub compare link (`https://github.com/<owner>/<repo>/compare/<commit before the piece>...<last commit of the piece>`) or the command `git diff <before>..<last> -- . ':!.boxbox'` for just that piece.
   - The "How it was built" timeline, and the "Why it is built this way" table from decision records, commit messages and the code. Put `tr.override` on rows where the developer chose against the recommendation.
   - A knowledge page with **boxbox-primer** for each concept `config.md` marks as new.
5. **Check it now.** Say `stage explain-check`. Run the test, lint and type commands from `config.md` (**boxbox-verify**) and put the real results on the page. Have the whole diff checked (**boxbox-inspect**). Put its findings on the page, worst first. Fix nothing.
6. **Board.** Say `stage explain-board`. Add a milestone to `board-data.js` (`M0` for work built before Boxbox): one epic per piece, status `review`, the commit hashes on its tasks, each epic's `files` (the globs of the files its commits touched, from `git diff --name-only <before>..<last>`), and a link to the page. Fill `modules` too if it is empty (format in `GUIDE.md`), so the Map can draw the codebase. Set `waiting` to "Review <name>" with the page as its link.
7. **Commit `.boxbox/`** as `Boxbox: explained <name>`. If the branch is not merged into main:
   - `push: yes`: push, then open a draft pull request into main or find the open one (`gh pr list --head <branch>`). The body lists the pieces, their compare links and the page path.
   - `push: ask`: ask once, then do the line above or the line below.
   - `push: no`, or no remote: print the diff command for each piece.
8. **Stop.** Run `sh .boxbox/pitwall/say ask "Review <name>" --kind unit --stage unit-review`. Open the board and the page, print the pull request URL, and wait.
