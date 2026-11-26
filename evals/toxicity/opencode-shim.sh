#!/usr/bin/env bash
# Translate eblan's newer OpenCode flags to this installed version (v2.4.2).
# Keeps --pure/--dir in toxbench.py; strips them here and maps --dir to cwd.
set -euo pipefail
REAL=/home/saperan/.opencode/bin/opencode
args=()
dir=""
while [ $# -gt 0 ]; do
  case "$1" in
    --pure) shift ;;
    --dir) dir="$2"; shift 2 ;;
    *) args+=("$1"); shift ;;
  esac
done
if [ -n "$dir" ]; then cd "$dir"; fi
exec "$REAL" "${args[@]}"
