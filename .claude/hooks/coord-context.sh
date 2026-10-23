#!/bin/sh
# UserPromptSubmit: show the live shared task state so overlap checks happen automatically.
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"
if [ -f .beadhub ] && command -v bdh >/dev/null 2>&1; then T=bdh; elif command -v bd >/dev/null 2>&1; then T=bd; else
  echo "[coordination] bd/bdh not installed — tell the user before starting substantial work."; exit 0; fi
OUT=$( ( $T list --status in_progress --brief 2>/dev/null || echo "(task list unavailable)" ) | head -25 )
echo "[coordination via $T] In-progress work across agents (follow docs/agent-coordination.md before editing code):"
echo "$OUT"
[ "$T" = bd ] && echo "[coordination] bdh not registered here — claims are local only; say so if you claim."
exit 0
