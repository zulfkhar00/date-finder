#!/bin/sh
# PreToolUse (Edit|Write|MultiEdit|NotebookEdit): block source edits without a claimed task.
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"
[ -f .beads/guard-off ] && exit 0
FILE=$(python3 -c 'import json,sys;d=json.load(sys.stdin);i=d.get("tool_input",{});print(i.get("file_path") or i.get("notebook_path") or "")' 2>/dev/null)
case "$FILE" in
  "") exit 0;;
  "$CLAUDE_PROJECT_DIR"/*) REL=${FILE#"$CLAUDE_PROJECT_DIR"/};;
  *) exit 0;;  # outside the repo
esac
case "$REL" in docs/*|.beads/*|.claude/*|*.md) exit 0;; esac
C=.beads/.guard-ok; if [ -f "$C" ] && [ $(( $(date +%s) - $(stat -f %m "$C") )) -lt 300 ]; then exit 0; fi  # bd takes ~7s; cache a pass for 5 min
if [ -f .beadhub ] && command -v bdh >/dev/null 2>&1; then T=bdh; else T=bd; fi
ME=${BEADS_ACTOR:-$(git config user.name)}
JSON=$($T list --status in_progress --assignee "$ME" --json 2>/dev/null)
if [ $? -ne 0 ] || [ -z "$JSON" ]; then
  echo "Coordination check failed ($T unavailable). Tell the user before editing $REL (docs/agent-coordination.md)." >&2; exit 2; fi
N=$(printf '%s' "$JSON" | python3 -c 'import json,sys;print(len(json.load(sys.stdin) or []))' 2>/dev/null || echo 0)
if [ "$N" = 0 ]; then
  rm -f "$C"; echo "No in_progress task claimed by '$ME'. Follow docs/agent-coordination.md: check overlap ($T list --status in_progress), create/claim a task ($T create … ; $T update <id> --claim), then edit $REL." >&2; exit 2; fi
touch "$C"; exit 0
