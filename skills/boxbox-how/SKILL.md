---
name: boxbox-how
description: Explain how a part of the codebase or an existing feature works, at the level of a developer joining the team, in chat or as a saved page with project and technical context. Use when the developer asks how does this work, explain this feature, walk me through this, where does X happen, where should this live, document how X works, or asks for more explanation of a decision, a plan item or a report.
---

# Boxbox how

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
4. Copy `.boxbox/templates/explain.html` to `.boxbox/explained/<feature>.html` and fill it. `{{ROOT}}` is `../`. If the template is missing, refresh the kit as **boxbox-setup** describes. It has the same two halves as a context page: project context (where the feature lives, the path a request takes, with real code) and technical context (the concepts, with links to the knowledge pages), plus why it is built this way, what to watch when changing it, and questions to check understanding.
5. Add the page to `knowledge` in `.boxbox/board-data.js`, titled "How <feature> works", so it shows on the board. Open it and print its path.
6. Commit the new pages: `Boxbox: explained <feature>`.

For a PDF, tell the developer to print the page from the browser ("Save as PDF"); the stylesheet has a print layout.

Do not present a guess as a fact. "I did not find where X is configured" is a useful answer.
