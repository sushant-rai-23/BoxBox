---
name: boxbox-discover
description: Read the codebase for a feature and write the context page before any planning. Use at the start of the Boxbox flow, or when the developer asks what a feature will touch, what exists today, or what they need to know before deciding. Produces context.md for the agent and context.html for the developer, with project context, technical context, and how the feature can fail.
---

# Boxbox discover

The developer is about to make decisions. Give them what they need to make them well: what exists, what the feature will touch, what is new to them, and how it can go wrong.

Read `.boxbox/GUIDE.md`, `config.md`, `glossary.md` and `lessons.md` first.

## 1. Name the feature

Pick a short folder name, lowercase with dashes (`password-reset`), and a plain title ("Password reset"). Create `.boxbox/<feature>/`. Set `state.md`: `feature`, `phase: discover`, `branch: not created yet`.

## 2. Read the code

Do not ask the developer to describe the codebase. Read it.

- Find the parts this feature will touch and follow one real request or data path through them, end to end.
- Note the conventions you must follow: structure, naming, error handling, how tests are written.
- If the work crosses a boundary (two services, client and server), read both sides.
- If your agent can run subagents, send one to sweep widely and report back. Then check the facts the plan will rest on yourself.
- Stop reading when more reading would not change the plan.
- Write down anything that surprised you.

If the repo is new or empty, say so and propose conventions instead of inventing existing ones.

## 3. Ask what the code cannot tell you

Code does not hold history, team rules, deadlines or who else is affected. Ask the developer up to four short questions, one at a time, only where the answer would change the plan. Examples: "Is anyone else working in this module?", "Is there a reason X is done this way?", "Any deadline or constraint I should plan around?". Record the answers.

## 4. Sort the concepts

List the technical ideas this feature needs (a library, a protocol, a pattern). Mark each `known` or `new` using `developer.known` and `developer.new` in `config.md`. When unsure, ask.

Group the `new` concepts the developer must understand to decide or review into topics, and use the **boxbox-primer** skill to write one knowledge page per topic now, before any decision is asked. Related concepts share a page. Three pages at most for one feature; if it needs more, write the three that the decisions depend on and list the rest under "Go deeper".

## 5. Check you have the skills for this feature

Setup chose skills for the stack the repo had then. A feature can bring something new: a second language, a framework, a domain such as payments or model calls. For each such area, check `skills` in `config.md` and the skills installed for this agent.

If one is missing and it would make you reliably better at this feature, follow step 4 of **boxbox-setup** now: choose between a well-known open-source skill and a short one you write for this project, show the developer the table with your reason, wait for their yes, then install or write it and add it to `config.md`. Do this before the plan, so the plan is written with the skill loaded. If nothing is missing, say so in one line.

## 6. Think about failure

Before any design, list how this feature can fail in real use: bad or hostile input, timeouts, retries and duplicates, partial failure, load, missing permissions, data that is already wrong. Keep only the ones that are real for this feature. The plan must cover each.

## 7. Write the two files

**`.boxbox/<feature>/context.md`** (for agents; short, factual):

```
# Context: <feature>
request: <the developer's request, in their words>
done_means: <what "done" looks like>

## Touches
- <path>: <why>

## Conventions to follow
- <rule, with an example path>

## Commands
test: ... | lint: ... | run: ...

## How it works today
<the request path, as a numbered list with paths>

## From the developer
- <question> -> <answer>

## Concepts
- <concept>: known | new (knowledge/<slug>.html)

## Failure modes
- <failure>: <what the plan must do>

## Surprises
- <fact>

## Open questions
- <question that needs a decision>
```

**`.boxbox/<feature>/context.html`**: copy `.boxbox/templates/context.html` and fill it following the page rules in `GUIDE.md`. `{{ROOT}}` is `../`. Use real code and real paths.

Add new project terms to `glossary.md`.

## 8. Update and continue

- `board-data.js`: set `goal`, and add the milestone (id `M1` for the first, the feature title, status `in_progress`) with a link to the context page. Its epics come from the plan.
- `state.md`: `phase: decisions`.
- Open `context.html` for the developer and print its path. Tell them in two lines what you found and that decisions come next.

Then continue with the **boxbox-plan** skill. There is no stop here, but the developer can read the page while you draft the split.
