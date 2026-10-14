# Boxbox config
project: boxbox
stack: Node.js 24 (zero-dependency pit wall server, node:test), bash hooks, Markdown skills, static HTML/CSS/JS page templates, Python 3 (tools/gen-templates.py); ships as a Claude Code / Codex / Cursor plugin
commands:
  test: node --test tests/pitwall/*.test.js
  lint: none
  types: none
  run: node .boxbox/pitwall/server.js --ensure
  validate: claude plugin validate .
git:
  main: main
  host: github
  push: yes
unit: epic
decision_level: what matters
developer:
  known: []
  new: [Node.js, bash hooks, Claude Code plugin mechanics (skills, hooks, subagents), Claude Code subagents and model routing, prompt caching and token accounting, git worktrees and merges, static HTML/CSS/JS pages]
pitwall: open
skills: none
