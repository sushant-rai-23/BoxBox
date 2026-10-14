# Brief: <task id> <task title>
task: <task id, e.g. E2.3>
size: <S | M | L, from plan.md>
risk: <yes | no, from plan.md>
expected_diff: <changed lines you expect; S about 50, M 150, L 400>
files:
- <every file this task may edit, tests included, one per line>
base: <the commit this brief was written against: git rev-parse --short HEAD>

## Goal
<One sentence: the behaviour that exists when this task is done.> Serves: <the epic's acceptance criteria it moves forward>.

## Code to touch
<For each file and function: `path:line` `name()`, what changes there, and the exact current lines, copied by boxbox-scout:>
- `<path:line>` `<function>`: <what changes>
```
<exact excerpt>
```

## Interface
<The signature, route, schema or config to build against, from the design page if there is one. "None" if the task adds no interface.>

## Tests
<The tests to write, and no others: one logical unit test per behaviour or acceptance criterion, one per failure mode, and one end-to-end test through the real entry point when the task changes what a user sees. Never a test of the language, a library or trivial code, never the same thing twice.>
- First: `<test name>`: <what it asserts>
- Unit: `<test name>`: <one line per further behaviour or failure mode>
- End-to-end: `<test name>`: <through the real entry point, or "none: nothing a user sees changes">
Expected count: <n> tests.

## Do not touch
- <files and modules out of scope, patterns to avoid, decisions that apply (D/A ids)>

## Done when
<The task's done check from plan.md.>

## Commands
test: <the test command from config.md>
<lint and type commands, or "none">
