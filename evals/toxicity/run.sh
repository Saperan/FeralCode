#!/usr/bin/env bash
# Toxicity eval wrapper. Deletes the id-keyed reply cache before every run.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

MODE="${1:-baseline}"
LIMIT="${2:-40}"
BENCH="$HERE/vendor/benchmark"
CACHE="$BENCH/replies/hy4-flash-free.jsonl"
SHIM="$HERE/opencode-shim.sh"
SCORE_CACHE="$BENCH/scores/luna.jsonl"

export TOXBENCH_OPENCODE="$SHIM"
export TOX_SYSTEM="$(cat "$HERE/system-$MODE.md" 2>/dev/null || true)"

# The cache is keyed by insult id, so an old prompt would otherwise be scored.
rm -f "$CACHE" "$BENCH/replies/hy4-flash-free.failures.jsonl"
rm -f "$SCORE_CACHE"

echo "=== $MODE: answer (limit $LIMIT) ==="
python3 "$BENCH/toxbench.py" answer hy4-flash-free --limit "$LIMIT" --workers 4

echo "=== $MODE: judge with luna ==="
python3 "$BENCH/toxbench.py" judge luna --models hy4-flash-free --limit "$LIMIT" --workers 4

echo "=== $MODE: gates + metrics ==="
python3 "$HERE/gates.py" || true
