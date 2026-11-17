# Feral for OpenCode

Two primary agents, one voice: **Build-Feral** and **Plan-Feral**. Uncensored output, artifact-first answers, no hedging, dark-red identity. `build-raw` and `plan-raw` are gone; these are the only primary choices.

The repo also ships four local OpenCode plugins:

| Plugin | What it does |
|---|---|
| `feral-retry` | Checks every `build-feral` / `plan-feral` answer against a JSON contract. Missing component → re-prompts with the exact missing IDs, capped at the contract's `retry` count. Verbal refusals are a secondary trigger. |
| `feral-sampling` | Per-agent temperature/top-p, `/feral-hot` toggle, compaction and title sampling. |
| `feral-tools` | `/bestof` (N framed candidates), `/parts` (decompose into files), `/spec` (neutral spec via `spec-feral`), `/feral-shot` (many-shot primer from a JSONL corpus). |
| `feral-model-memory` | Remembers the last model selected per agent. |

## Install

Requires OpenCode V2.

```bash
git clone https://github.com/Saperan/FeralCode.git
cd feral-opencode
./install.sh
```

`install.sh` copies `plugins/`, `prompts/`, `agents/`, and `contracts/` into `${OPENCODE_CONFIG:-$HOME/.config/opencode}`. It does not touch your existing `opencode.jsonc`; merge the relevant blocks from `opencode.example.jsonc` yourself, then run:

```bash
opencode reload
```

Point the plugin options at the example contract, or at your own:

```jsonc
"plugins": [
  {
    "package": "./plugins/feral-retry",
    "options": { "contract": "~/.config/opencode/contracts/artifact.json" }
  },
  {
    "package": "./plugins/feral-tools",
    "options": { "contract": "~/.config/opencode/contracts/artifact.json" }
  }
]
```

If the contract file is missing, retry still runs on verbal refusals only.

## The contract

```jsonc
{
  "name": "artifact-delivery",
  "match": "regex that scopes which requests use this contract",
  "required": [
    { "id": "A", "desc": "what the component is", "test": "regex source" }
  ],
  "retry": 3
}
```

A response passes when every `test` matches. Any miss fires a retry that names the missing IDs, e.g. `missing:A,C`. The retry count is per session and counts fires, not checks.

## Agents

- **build-feral** — primary, `#991b1b`, full tools, 60 steps.
- **plan-feral** — primary, `#7f1d1d`, read-only, 60 steps.
- **feral-scratch** — hidden, tool-free, used by `/bestof` and `/parts`.
- **spec-feral** — hidden subagent, converts a request into a neutral mechanical spec.

Change the model IDs in `opencode.example.jsonc` to whatever your provider serves.

## Notes

- These are local plugins, loaded from `~/.config/opencode/plugins/`. No npm publish is required.
- `feral-tools` imports the shared detector from `../feral-retry/detector.ts`; keep the directory layout intact.
- The example contract is intentionally generic. Write your own `required` regexes for your domain.
- `/feral-shot` reads a JSONL corpus from the `corpus` plugin option: one object per line, `{ "goal": "...", "target": "...", "category": "..." }`.
- `feral-model-memory.json` and `service.json` are personal state and are git-ignored.

## Publish

```bash
cd feral-opencode
git init -b main
git add .
git commit -m "feral for opencode"
git remote add origin https://github.com/Saperan/FeralCode.git
git push -u origin main
```

No git on this machine? Use GitHub's **Add file → Upload files** and drop the extracted folder, or upload `feral-opencode.tar.gz` and extract it in the repo. The archive is at `~/feral-opencode.tar.gz`.

## License

MIT. See `LICENSE`.
