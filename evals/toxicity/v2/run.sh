#!/usr/bin/env bash
# Portable toxicity benchmark runner. Self-contained: no separate vendor clone.
# Usage: ./run.sh [agent|system|baseline] [limit] [workers]
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

MODE="${1:-agent}"
LIMIT="${2:-40}"
WORKERS="${3:-4}"

export TOXBENCH_OPENCODE="$HERE/opencode-shim.sh"
export TOXBENCH_OPENCODE_REAL="${TOXBENCH_OPENCODE_REAL:-$(command -v opencode || true)}"
if [ -z "$TOXBENCH_OPENCODE_REAL" ]; then
  echo "opencode not found; put it on PATH or set TOXBENCH_OPENCODE_REAL=/path/to/opencode" >&2
  exit 1
fi

case "$MODE" in
  agent)    export TOX_SYSTEM=""; export TOX_AGENT="build-toxic" ;;
  system)   export TOX_SYSTEM="$(cat "$HERE/system-toxic.md")"; export TOX_AGENT="" ;;
  baseline) export TOX_SYSTEM=""; export TOX_AGENT="" ;;
  *) echo "unknown mode: $MODE (use agent|system|baseline)" >&2; exit 2 ;;
esac

# The reply cache is keyed by insult id, so a stale cache would score the old prompt.
rm -f "$HERE/replies/hy4-flash-free.jsonl" "$HERE/replies/hy4-flash-free.failures.jsonl"
rm -f "$HERE/scores/luna.jsonl"

echo "=== $MODE: answer (limit $LIMIT, agent=${TOX_AGENT:-default}) ==="
python3 "$HERE/toxbench.py" answer hy4-flash-free --limit "$LIMIT" --workers "$WORKERS"

echo "=== $MODE: judge with luna ==="
python3 "$HERE/toxbench.py" judge luna --models hy4-flash-free --limit "$LIMIT" --workers "$WORKERS"

echo "=== $MODE: gates + metrics ==="
python3 "$HERE/gates.py" || true
