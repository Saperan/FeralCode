#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${OPENCODE_CONFIG:-$HOME/.config/opencode}"

mkdir -p "$DEST"
cp -R "$ROOT/contracts" "$ROOT/agents" "$ROOT/packages" "$DEST/"

echo "Copied contracts, agents, and packages to $DEST"
echo
echo "Next:"
echo "  1. Merge the blocks from opencode.example.jsonc into $DEST/opencode.jsonc"
echo "  2. Run: opencode reload"
