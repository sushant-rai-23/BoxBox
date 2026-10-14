# Glossary

The project's own words, one meaning each. Use them in plans, pages and code.

| Term | Meaning in this project | Not to be confused with |
| --- | --- | --- |
| Session model | The model the main conversation runs on (Opus by default); `inherit` agents use it | The model a subagent runs on |
| Routing | Choosing which model does which piece of work, via fixed-model subagents | Claude Code's own model choice (`models: auto`) |
| Routing gate | The PreToolUse check on Agent/Task calls that denies a call breaking the routing rules | The pause gate, which holds every tool call while paused |
| Brief | `.boxbox/<feature>/<epic>/tasks/<id>.md`: everything one task's builder needs, written just before the task | The plan's one-line task entry |
| Escalation | Retrying a task once on the session model after a cheaper model failed or drifted; logged as `escalated` | Asking the developer, which comes after a failed escalation |
| FORCE override | `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`: every subagent uses `CLAUDE_CODE_SUBAGENT_MODEL`; turns the gate off | `CLAUDE_CODE_SUBAGENT_MODEL` alone, which is only a default |
| Lane | One row of the pit wall's Telemetry, one worker's activity (driver, builder, scout, runner, writer, steward) | A git branch |
