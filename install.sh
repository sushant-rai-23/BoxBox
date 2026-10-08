#!/usr/bin/env bash
# Copy the Boxbox skills into an agent's skills folder.
#   ./install.sh claude            personal skills for Claude Code   (~/.claude/skills)
#   ./install.sh cursor            personal skills for Cursor        (~/.cursor/skills)
#   ./install.sh codex             personal skills for Codex         (~/.agents/skills)
#   ./install.sh <agent> --project same, but into the current repo   (./.claude/skills, ...)
#   ./install.sh --dir <path>      any other agent: give its skills folder
# Run it again to update. It only touches folders named boxbox*.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
agent="${1:-}"
scope="${2:-}"

case "$agent" in
  claude) sub=".claude/skills" ;;
  cursor) sub=".cursor/skills" ;;
  codex)  sub=".agents/skills" ;;
  --dir)  sub="" ;;
  *) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac

if [ "$agent" = "--dir" ]; then
  [ -n "$scope" ] || { echo "Give a folder: ./install.sh --dir <path>"; exit 1; }
  dest="$scope"
elif [ "$scope" = "--project" ]; then
  dest="$PWD/$sub"
else
  dest="$HOME/$sub"
fi

mkdir -p "$dest"
count=0
for skill in "$here"/skills/boxbox*; do
  name="$(basename "$skill")"
  rm -rf "${dest:?}/$name"
  cp -R "$skill" "$dest/$name"
  count=$((count + 1))
done

echo "Installed $count Boxbox skills into $dest"
echo "Start a new agent session in your repo and say what you want to build."
