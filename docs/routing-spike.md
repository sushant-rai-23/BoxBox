# Routing spike (Boxbox 0.7.0, Step 0)

Checked on 2026-10-14 against **Claude Code 2.1.296** (the native binary the VS Code extension runs), session model Opus 5.5. Each check ran a real headless or interactive session with a throwaway plugin (agents pinned to `sonnet` and `haiku`, a skill with `model: sonnet`, a worktree agent, and hooks that log every input). Where the binary and the docs at code.claude.com agree, both are cited. Where they differ, the observed behaviour wins and the difference is called out.

Result: **all nine hold.** Two of them need care, and the plan changes because of them (marked **Changes the plan**).

| # | Question | Result |
| --- | --- | --- |
| 1 | Plugin agent `model:` is honoured | Yes |
| 2 | Per-call `model` beats the agent file | Yes |
| 3 | `CLAUDE_CODE_SUBAGENT_MODEL` / `_FORCE` are detectable | Yes, with a note on semantics |
| 4 | Skill `model:` lasts one turn | Yes |
| 5 | `SubagentStart` / `SubagentStop` give id, type, transcript | Yes, but the transcript path only arrives on Stop |
| 6 | `PreToolUse` on the Agent tool can deny with a reason | Yes |
| 7 | `isolation: worktree` | Yes, but it branches from the remote default branch |
| 8 | An "opusplan" mode exists | Yes |
| 9 | A plugin can provide a status line | No: only a project or user setting can. The command works |

## 1. Subagent model field

A plugin agent `spike-sonnet.md` with `model: sonnet` ran on `claude-sonnet-5-5`, and `spike-haiku.md` with `model: haiku` ran on `claude-haiku-5-5`. Both values come from `message.model` in the subagent's transcript, in a session whose main model was `claude-opus-5-5`. Each assistant line also carries `requestedModel`, which matched `message.model` in every run.

Plugin agents load as `<plugin>:<name>` (`spike:spike-sonnet`). Docs: plugin agents support `name, description, model, effort, maxTurns, tools, disallowedTools, skills, memory, background, omitClaudeMd, isolation, color`. They ignore `hooks`, `mcpServers` and `permissionMode`.

## 2. Per-call model and resolution order

The same `spike-sonnet` agent, called with `model: "haiku"`, ran on `claude-haiku-5-5`, so **the call's `model` wins over the agent file**. The call's model is also written to the subagent's `agent-<id>.meta.json` as `"model": "haiku"`.

Observed order, which matches the docs and the resolver in the binary:

1. `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` with `CLAUDE_CODE_SUBAGENT_MODEL` set: that model, always.
2. The Agent call's `model` parameter.
3. The agent file's `model:` (`inherit` means the main session's model).
4. `CLAUDE_CODE_SUBAGENT_MODEL` (a default only).
5. The main session's model.

## 3. Overrides

- `CLAUDE_CODE_SUBAGENT_MODEL=haiku` on its own: `spike-sonnet` still ran on **sonnet**. Since v2.1.251 the variable is a default, not an override.
- With `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` added: `spike-sonnet` ran on **haiku**. The main agent passed no `model`; under FORCE the Agent tool's own description drops the line that says `model` overrides the definition.
- Both variables reach hook processes, including when they are set through `env` in `.claude/settings.json`. So the Boxbox hook can read them from its environment and report them.

- FORCE with no `CLAUDE_CODE_SUBAGENT_MODEL` (read from the 2.1.296 resolver, not run): the call's `model` is dropped and each agent file's `model:` decides. So FORCE on its own also takes the choice away from Boxbox.

**Changes the plan:** the prompt names only the FORCE override as a reason to turn the gate off. A plain `CLAUDE_CODE_SUBAGENT_MODEL` changes nothing for Boxbox, because every Boxbox agent file names a model. Only FORCE, or FORCE plus the variable, disables the gate. The pit wall should still show the plain variable, as information.

## 4. Skill model

`/spike:spike-skill`, a skill with `model: sonnet`, answered on `claude-sonnet-5-5`. The next prompt in the same session (`--resume`) answered on `claude-opus-5-5`. Docs: "The override applies for the rest of the current turn ... The session model resumes when you send your next prompt."

The override covers the whole turn, not part of a skill. So "only the page-filling part of a skill on sonnet" needs either a separate small skill or a hand-off to `boxbox-writer`.

## 5. Hooks for subagents

- `SubagentStart` input: `session_id, transcript_path` (the parent's), `cwd, prompt_id, agent_id, agent_type, hook_event_name`. It has **no transcript path and no model**.
- `SubagentStop` input adds `agent_transcript_path` (`~/.claude/projects/<project>/<session>/subagents/agent-<agent_id>.jsonl`), `last_assistant_message`, `stop_hook_active` and `permission_mode`.
- Beside each subagent transcript sits `agent-<agent_id>.meta.json`: `{agentType, description, toolUseId, spawnDepth, requestShape, model?}`. `toolUseId` is the `tool_use_id` of the Agent call's `PreToolUse`, which joins a subagent to the call the gate saw.
- The main transcript holds no subagent lines (`isSidechain` count was 0), so adding the subagent transcripts to it does not double count.
- Tool events fired inside a subagent carry `agent_id` and `agent_type`. Boxbox 0.6 already uses this for its lanes.

**Changes the plan:** the subagent's transcript path is not given at start. It can be derived from the parent transcript path plus `agent_id`, so a running subagent can be counted before it stops. Model and tokens come from the subagent's own transcript, not from the hook.

## 6. Enforcement

A plugin `PreToolUse` hook with matcher `*` saw `tool_name: "Agent"` and `tool_input: {description, prompt, subagent_type, model?, run_in_background?}`. `model` is present only when the caller passes one. It returned:

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Routing gate: use spike:spike-sonnet instead of spike-haiku."}}
```

The call was denied. The main agent read the reason and retried with `spike:spike-sonnet`, which ran. The result's `permission_denials` lists the denied call under `tool_name: "Task"`, but hooks see `"Agent"`. The gate should match both.

The hook does not see which model a call *will* resolve to when `model` is omitted. The gate has to compute it from the agent file and the order in 2.

## 7. Worktree isolation

An agent with `isolation: worktree` ran in `<repo>/.claude/worktrees/agent-<agent_id>`, on a new branch `worktree-agent-<agent_id>`, and its commit stayed on that branch. The Agent tool result returned `agentId`, `worktreePath` and `worktreeBranch`. The worktree stays on disk while it has commits. The `.claude/` folder showed up untracked in the main checkout.

**Changes the plan:** the base branch is the remote's default branch, not the current branch. The tests:

- With a remote whose HEAD is `master`, and the session on an `epic` branch, the worktree branched from `master` and the epic's commits were missing.
- Without a remote, it branched from the current HEAD.
- With `"worktree": {"baseRef": "head"}` in `.claude/settings.json`, it branched from the current branch.

Parallel mode must therefore set `worktree.baseRef: "head"` in the project settings (asked at setup) or refuse to run. Boxbox should also make sure `.claude/worktrees/` is ignored.

## 8. "opusplan"

`--model opusplan` exists. A prompt in default mode answered on `claude-sonnet-5-5`, and the same prompt in `--permission-mode plan` answered on `claude-opus-5-5`. Docs: "uses `opus` during plan mode, then switches to `sonnet` for execution." The switch follows Claude Code's plan *mode*, not Boxbox's plan stage, so Boxbox does not build on it in 0.7.

## 9. Status line

- **A plugin cannot provide the main status line.** Docs: from a plugin's `settings.json`, "Only two keys take effect from a plugin, `agent` and `subagentStatusLine`; every other key is dropped." So setup must offer to write `statusLine` into the project's `.claude/settings.json`.
- **The command works.** A `statusLine` command in a project `.claude/settings.json` ran in an interactive CLI session (2.1.296) and its line was shown under the prompt.
- **Input it received** (JSON on stdin): `session_id, transcript_path, cwd, prompt_id, session_name, effort.level, model.{id, display_name}, workspace.{current_dir, project_dir, added_dirs}, version, output_style.name, cost.{total_cost_usd, total_duration_ms, total_api_duration_ms, total_lines_added, total_lines_removed}, context_window.{total_input_tokens, total_output_tokens, context_window_size, current_usage, used_percentage, remaining_percentage}, exceeds_200k_tokens, prompt_cache.{warm, ttl, hit_ratio, cache_write_tokens, ...}, fast_mode, thinking.enabled, rate_limits.{five_hour, seven_day}`.
- **Updates and timeout.** Docs: updates are debounced at 300 ms, and a running script is cancelled when a new update arrives. No timeout is documented.

**Not verified:** whether the VS Code extension shows the status line. Only the terminal CLI was checked.

## Other observations

- Claude Code's own per-model totals and cost for run "a" are saved in `tests/pitwall/fixtures/routing-session/model-usage.json`, beside trimmed copies of that run's transcripts (ids, models and usage only). The pit wall's per-model counts are tested against it: Opus and Sonnet match to the token and to the cent.

- `modelUsage` in a session result also counts Claude Code's own small Haiku calls (for example the session title). These calls are not in any transcript, so "per-model totals from transcripts" will slightly undercount Haiku against the result's own total. That is expected.
- Subagents launched without `run_in_background` were recorded as `requestShape: "background"`, which is the default in this version. A foreground run needs `run_in_background: false`.
- The headless spike runs cost $2.70 in total (summed from each result's `total_cost_usd`), almost all of it Opus main-session turns. The interactive status-line run used Haiku and is not included.
- Caching between subagents works: in the first run, the `spike-sonnet` call wrote 4,462 cache tokens, the first Haiku call wrote 4,460, and the second Haiku call (`spike-haiku`) read those 4,460 from the cache (`cache_read_input_tokens: 4460`). The same fixed system prompt and agent text made the prefixes identical.
