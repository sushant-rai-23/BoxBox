# Report: E4 Exact cost per model
status: approved, 2026-10-14 (developer asked to build E2-E8 without stops; reviewed with the whole feature)
branch: model-routing-e4-cost
pr: none (gh not installed)

## Commits
- 9f152e1 E4.1 Sonnet 5.5 cache reads at $0.10 per million; [1m] model ids priced
- 89d24b4 E4.2 subagent transcripts count from SubagentStart, under the task of the call that started them
- 026d94a E4.3 tokens, cost and cache-read share by model
- ed26322 E4.4 saved-versus-session-model estimate and --summary by model
- ca74894 E4.5 a session that started before .boxbox existed is registered on its first event (A20)
- ae6a78e review: one count per subagent; savings at the session's model at the time; task from the start event; no $0 for unpriced models; checked against Claude Code's own totals

## Built
- prices.json: claude-sonnet-5-5 cache_read 0.1; notes on [1m] and the source of the Sonnet rate
- server.js: priceFor ignores a trailing [tag]; familyOf; subagentUnits (start event wins); aggregate(…, subUnits) buckets a subagent's tokens under its own task; byModel rows {model, family, input, output, cacheRead, cacheWrite, tokens, cost, cacheReadShare}; per-unit `models`; savings(); refreshSessions dedupes a subagent by (session, sub); --summary prints "By model:"
- hooks/boxbox-event.js: SubagentStart registers the derived subagent transcript path; an unknown Claude Code session is registered on its first event
- fixtures/routing-session: trimmed real transcripts of Step 0 run "a" plus Claude Code's own modelUsage for it

## Interfaces added or changed
- state().tokens.byModel[], tokens.savings {estimate, sessionModel, sessionModels, actual, atSessionModel, saved, priced, note}, byEpic/byTask[].models
- --summary <unit>: new line "By model: opus 1.2M tokens $0.80, sonnet …"
- sessions.jsonl: subagents at start; `late: true` for sessions registered after their start

## Decisions and defaults made while building
- A20 E4.5 added
- Savings re-price subagents only, at the session's model when each subagent started; main-session tokens are not re-priced
- cache-read share = cache reads / (fresh input + cache writes + cache reads)

## Verified
- Per-model totals for the fixture session equal Claude Code's own modelUsage to the token and its costUSD to 1e-9 for Opus and Sonnet; Haiku equals a hand count of the two Haiku transcripts (Claude Code's title calls are in no transcript)
- Sonnet cost of a real subagent reproduces Claude Code's $0.0020236 at the new rate
- A running subagent counts under its task; two spellings of its path count once; a stop event cannot move it to another task
- Savings: re-priced at the right model across a mid-session switch; a session with no main transcript says why it cannot estimate; unpriced models show no cost
- Real data: `--summary E3` prints "By model: opus 1.40M tokens $0.80."
- Full suite 119 pass

## Not verified
- A live run where a cheaper subagent's tokens show up while it runs (the path is the one Claude Code used in Step 0 and the E3 live check)
- "Within 1%" on a live balanced-mode feature run (D5)

## Cost
Cost: 809k tokens for E4 (82k new, 726k from cache), about $0.56. Approximate; subagents and this session's logged calls only.

## Outside scope
- hooks/boxbox-event.js, tests/pitwall/hook.test.js, docs/routing-spike.md (subagent registration and E4.5)

## Gotchas
- A commit went in with a failing test because a command chain checked grep's exit code; folded into one green commit before anything was pushed. Commits now go through a script that checks the test run's exit code.

## For the next unit
- E5 can draw: tokens.byModel (family, cacheReadShare, cost null when unpriced), tokens.savings (label "estimate", note), per-unit models, gate/escalated/escalate-needed/gate-error events.
- E6 can read the same numbers through Live, or a small summary file.
