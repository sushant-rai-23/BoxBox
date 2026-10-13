---
name: boxbox-verify
description: Prove that work is done by running it, before saying so. Use before claiming a task, unit, fix or feature is complete, working or passing, before writing a Boxbox report, and before committing or opening a pull request.
---

# Boxbox verify

"Done" is a claim. Back every claim with something you ran and saw in this session.

## For a unit

Tell the pit wall: `sh .boxbox/pitwall/say stage verify --unit <E1>`. Run the test command exactly as `config.md` writes it, so the pit wall sees the run and can mark the tasks verified.

Go through the epic's `accept` and `fails` lists in `plan.md`. For each line, produce evidence:

| Claim | Evidence that counts | Evidence that does not |
| --- | --- | --- |
| Tests pass | The full suite run now, output read, zero failures | An earlier run; "should pass"; a run of one file |
| It builds, lints, types | Each command run now, exit code seen | The editor showing no errors |
| The feature works | The real thing run the way a user would: the endpoint called, the command run, the page loaded; actual output compared with expected | Tests passing alone |
| A failure is handled | A test or a run that triggers the failure and shows the handling | Reading the code and judging it fine |
| A bug is fixed | The original reproduction, now passing | A new test only |

## How

1. Run the checks from `config.md` plainly, one command at a time. Do not hide exit codes behind pipes.
2. Run the feature by hand at least once, end to end, with realistic input, through its real entry point (the HTTP route, the command, the screen). Note the exact commands: they go in the report under "Try it yourself". When an effect cannot be seen from outside (an in-memory store, a queued job), a short script that runs the real code and prints the effect counts; say that is what you did.
3. Try one thing meant to break it: empty input, the wrong type, a repeat of the same request.
4. Re-read the diff for leftovers: debug output, commented-out code, secrets, files outside the unit's scope.

## Write down the result

For each acceptance criterion and failure mode: the evidence, or "not verified" with the reason. You could not reach a service, you lack a credential, it needs the developer's console: all fine to say. Claiming it anyway is not.

Some failure modes cannot be tested in any useful way ("an attacker guesses the token"). Write "not testable", why, and what limits the risk (token length, expiry). Do not write a test that proves nothing.

If anything fails, it is not done. Fix it (use **boxbox-debug** if the cause is unclear) and verify again from the start.
