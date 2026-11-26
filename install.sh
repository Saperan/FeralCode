#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${OPENCODE_CONFIG:-$HOME/.config/opencode}"

if [ "${1:-}" = "--uninstall" ]; then
  rm -rf "$DEST/contracts" "$DEST/agents" "$DEST/packages"
  rm -f "$DEST/model-memory.json" "$DEST/tox-state.json"
  echo "Removed installed FeralCode files from $DEST"
  echo "Plugin entries in $DEST/opencode.jsonc are left for you to remove manually."
  exit 0
fi

mkdir -p "$DEST"
cp -R "$ROOT/contracts" "$ROOT/agents" "$ROOT/packages" "$DEST/"

echo "Copied contracts, agents, and packages to $DEST"

CONFIG="$DEST/opencode.jsonc"
if [ -f "$CONFIG" ] && [ -f "$ROOT/merge-config.py" ]; then
  python3 "$ROOT/merge-config.py" "$ROOT/opencode.example.jsonc" "$CONFIG"
  echo "Merged new agents/plugins into $CONFIG (backup: $CONFIG.bak)"
fi

echo
echo "Next:"
echo "  Run: opencode reload"
