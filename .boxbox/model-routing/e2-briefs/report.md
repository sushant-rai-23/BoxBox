# Report: E2 Task briefs
status: approved, 2026-10-14 (developer asked to build E2-E8 without stops; reviewed with the whole feature)
branch: model-routing-e2-briefs
pr: none (gh not installed)

## Commits
- 56a49ab E2.1 brief format, template and parser
- f81a7c6 E2.2 build writes each task's brief just before it; builders get the fixed part, then the brief
- 06f8664 E2.3 reports quote each task's brief and the checker compares the quote with the file
- 99e13e0 E2.4 the board and the pit wall link each task's brief
- e4ed2e0 review: Goal-line-only, non-empty quotes; CRLF; one wording for the brief's files; board-data example; refresh step

## Built
- skills/boxbox-setup/kit/templates/brief.md: the brief template (header fields, then Goal, Code to touch, Interface, Tests, Do not touch, Done when, Commands)
- hooks/routing.js parseBrief + SIZE_LINES (A18)
- GUIDE "Task briefs" section, folder map `tasks/<id>.md`, board-data `brief` field
- boxbox-build step 1: write the brief now, scout pulls excerpts, fixed part then brief, Codex builds from the brief; refresh the kit if the template is missing
- builder agent: Edit/Write only, works from a partial brief
- check-page `<q data-brief>`: path inside .boxbox, file exists, non-empty, contained in the Goal line
- report template (via tools/gen-templates.py): per-task brief quote and link; report skill rule
- server briefHref + state payload `briefHref`; pit wall board and board.html "brief" links

## Interfaces added or changed
- Brief header: task, size, risk, expected_diff, files (list), base
- routing.parseBrief(text) -> {task, size, risk, expectedDiff, files, base, goal}
- server.briefHref(brief) -> "/b/<path>" | null; state().board tasks gain briefHref
- board-data task: "brief": "<feature>/<unit>/tasks/<id>.md"
- report page: <q data-brief="<path under .boxbox>">Goal line</q>

## Decisions and defaults made while building
- A18 parser in hooks/routing.js
- plan.md wins over a brief's size/risk if they disagree
- Brief excerpt drift is not checked (plan failure line reworded); `base` records the commit

## Verified
- Parser: brief.test.js (4 tests incl. CRLF, defaults, template parses)
- Checker: "check-page: a report brief quote must match the brief file" (match, mismatch, missing, traversal, empty, non-Goal text)
- Links: "server: board task brief link is served under /b/" (safe/unsafe paths, real server serves text/plain); live /api/state check: safe brief -> /b/ link, `../x.md` -> null
- Templates regenerated, byte-identical to the generator (reviewer re-ran it)
- Full suite 90 pass

## Not verified
- A live build where the main agent writes a brief and a builder works from it (D5).
- Prompt-cache gain from the fixed-part order (needs live runs; Timing in E5 will show cache-read share).

## Cost
Cost: 1.41M tokens for E2 (84k new, 1.33M from cache), about $0.69. Approximate; subagents and this session's logged tool calls only (this session's transcript is not registered).

## Outside scope
- agents/boxbox-builder.md "Edit files with Edit and Write only": a lesson from E1, not an E2 criterion.

## Gotchas
- None new.

## For the next unit
- E3 can read a task's files and expected diff from parseBrief; the brief path is <feature>/<unit>/tasks/<id>.md.
- Notes left: the brief path in a report row is not tied to that row's task id; `expected_diff: 90 lines` falls back to the size default.
