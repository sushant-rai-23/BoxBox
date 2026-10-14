# Report: E5 Pit wall routing views
status: approved, 2026-10-14 (developer asked to build E2-E8 without stops; reviewed with the whole feature)
branch: model-routing-e5-views
pr: none (gh not installed)

## Commits
- 1047121 E5.2 each Boxbox agent has its own lane
- 2dcd609 E5.1, E5.4 events carry the model that made them; state has the routing readout
- d145fe7 E5.1-E5.4 page: model chips, lanes per agent and per parallel builder, Timing by model with savings and escalations, Home routing readout (A21: one commit for the page)
- 4e3e9f8 review: escalation list from the whole log; stale agents and gate-off dropped; partial savings said; Codex-only lanes; demo coverage

## Built
- hooks: laneFor gives builder, scout, runner, writer their own lane
- server: withModels (events get `ranOn`), routingState (mode, warning, gate on/off with reason, active Boxbox agents, last escalation, escalations list), both in state()
- page: model chip (family, full id on hover) on every row that has a model; lanes Driver, Builder (one per running builder in parallel), Scout, Runner, Writer, Pit crew, Steward; Timing "By model" (tokens, cache-read share, cost), savings line labelled estimate (says when partial), "Escalations and routing" list; Home routing readout; new kinds Routing and Escalated in orbs.js; ?demo covers all of it
- a small <style> block in index.html for the chip and readout (the shared boxbox.css is unchanged)

## Interfaces added or changed
- state().events[].ranOn, state().routing {mode, warning, gate {state, reason}, active [{agent, unit, sub, since, session}], lastEscalation, escalations}
- laneFor returns builder | scout | runner | writer for Boxbox agents

## Decisions and defaults made while building
- A21 page changes in one commit
- An agent with no stop is dropped after its session ends or 30 quiet minutes
- A FORCE gate-off is shown "as of the last subagent call"; an auto gate-off is dropped once the mode is no longer auto

## Verified
- Tests: withModels, routingState (active, stale agents, stale gate-off, FORCE wording, warning), laneFor
- Real browser (Playwright, ?demo, kit server): Home readout, Timing by model with chips, savings, the escalations list with all four kinds, Telemetry lanes incl. Builder 1 and Builder 2; no console errors
- Real data: the server's byModel for this repo shows opus 16.3M / sonnet 3.0M / haiku 347k tokens
- Full suite 123 pass

## Not verified
- The page against a live balanced-mode run (D5)
- Rows written by `say` (stages, escalations) and events from before 0.7 carry no chip: they have no model

## Cost
Cost: 1.04M tokens for E5 (86k new, 951k from cache), about $0.62. Approximate; subagents and this session's logged calls only.

## Outside scope
- none beyond the plan's files (orbs.js is in kit/pitwall)

## Gotchas
- The page's existing chip() is for page links: the model chip is modelChip().
- `.lane span{display:block}` in the shared CSS stretched the chip: the pit wall's own style overrides it inside lane titles.
- Playwright cached the page: reload with a new query string after editing.

## For the next unit
- E6 (status line) can read the same numbers: routingState and the token aggregate through Live, or a summary file.
- E7 parallel lanes already render when two builders run.
- Notes left: withModels scans linearly per event (fine for the 200-event window); the feed filter has no Routing or Escalated button (they show under All).
