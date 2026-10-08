---
name: boxbox-primer
description: Write a knowledge page that teaches the developer one technology or concept, up to the level this project needs. Use when boxbox-discover marks a concept as new to the developer, or when the developer asks to learn, be taught, or get a primer on a language, framework, tool or idea used in this repo.
---

# Boxbox primer

Write one page that takes this developer from where they are to being able to read and review this project's use of the topic. Not a full course. Only what this project needs. A topic can hold several related concepts; one page per topic, not per term.

Read `.boxbox/GUIDE.md` and `config.md` first.

## 1. Set the scope

- **Who:** what `config.md` says they know. Teach by comparison with it where that helps ("like a Kotlin data class, but...").
- **How far:** list the things they will meet in this repo's code for this topic. The page covers those and the ideas beneath them, and stops.
- **Order:** each idea uses only ideas already covered.

## 2. Get the facts right

Do not teach from memory alone. Check the official documentation for the version this repo uses, if you have web access. Note the pages you used; they go under "Go deeper". If you could not reach the docs, say so in the "Not checked" note at the top of the page and mark the links as not opened.

## 3. Write the page

Copy `.boxbox/templates/knowledge.html` to `.boxbox/knowledge/<slug>.html` and fill it. `{{ROOT}}` is `../`.

- One short section per idea: a plain definition, how it works, code with exactly what it prints, why it exists, where it shows up in this project (with a path), and the common trap.
- **Run every code example** and paste the real output. If you cannot run it, say so on the page instead of guessing.
- Write examples whose output is the same every run. For anything random or timed, print a stable fact about it (a length, a comparison, true or false), not the raw value.
- Small examples. One idea each.
- Each section ends with the "Mark as done" control from the template, with a unique id.
- Plain words. Define each term the first time.

Keep it readable in one sitting. If the topic is large, write two pages, basics first, and link them.

## 4. Link it

- Add it to `knowledge` in `.boxbox/board-data.js`.
- Link it from the concept's row on the context page.
- Open it and print its path.
