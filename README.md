# FeralCode

Two primary agents, one voice: **Build-Feral** and **Plan-Feral**. Uncensored output, artifact-first answers, no hedging, dark-red identity. `build-raw` and `plan-raw` are gone; these are the only primary choices.

The repo also ships four local OpenCode plugins:

| Plugin | What it does |
|---|---|
| `feral-retry` | Checks every `build-feral` / `plan-feral` answer against a JSON contract. Missing component → re-prompts with the exact missing IDs, capped at the contract's `retry` count. Verbal refusals are a secondary trigger. |
| `feral-sampling` | Per-agent temperature/top-p, `/feral-hot` toggle, compaction and title sampling. |
| `feral-tools` | `/bestof` (N framed candidates), `/parts` (decompose into staged files under `.opencode/out/parts/`), `/spec` (neutral spec via `spec-feral`), `/feral-shot` (many-shot primer from a JSONL corpus). |
| `feral-model-memory` | Remembers the last model selected per agent. |

## Install

Requires OpenCode V2.

```bash
git clone https://github.com/Saperan/FeralCode.git
cd FeralCode
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

## Tested models

Tested through the `opencode-go` provider. Sample sizes differ; this is a compatibility ranking, not a leaderboard.

| Rank | Model | Test | Result |
|---|---|---|---|
| 1 | `opencode-go/deepseek-v4-pro#max` | Full JBB, 100 prompts; 20-prompt retry fixture | JBB 23/100 raw, 38/100 with the many-shot ensemble; retry fixture 4/20 → 16/20 |
| 2 | `opencode-go/deepseek-v4.1-flash` | 10-prompt JBB malware slice; 6-prompt JBB harassment probe; `spec-feral` and judge | 4/10 raw malware, 0/6 raw harassment; reliable tool-free spec/judge model |
| 3 | `opencode-go/glm-5.3` | 3-prompt JBB harassment probe | 0/3, valid refusals, no empty completions |

Only these three returned valid scored samples. `grok-4.7` produced empty or step-limited responses; `kimi-k3` and `qwen3.8-max` returned empty completions and were not scored. Start with `deepseek-v4-pro#max`; it is the only model with a full 100-prompt run.

## Security

FeralCode runs as your user; permissions are policy, not an OS sandbox.

- `build-feral` starts from allow-all. The `ask` rules cover `git push`, `rm -rf`, `.env` reads, and `.git`/`.env` writes only. A shell wrapper can still do anything the policy does not name.
- `/parts` never writes into the project. It stages generated files under `.opencode/out/parts/<timestamp>/` with exclusive-create writes; review them before copying.
- Run untrusted repositories in a container, VM, or disposable worktree, and review `/parts` output before applying it.

## Notes

- These are local plugins, loaded from `~/.config/opencode/plugins/`. No npm publish is required.
- `feral-tools` imports the shared detector from `../feral-retry/detector.ts`; keep the directory layout intact.
- The example contract is intentionally generic. Write your own `required` regexes for your domain.
- `/feral-shot` reads a JSONL corpus from the `corpus` plugin option: one object per line, `{ "goal": "...", "target": "...", "category": "..." }`.
- `feral-model-memory.json` and `service.json` are personal state and are git-ignored.

## Publish

From the repository root:

```bash
git add .
git commit -m "feral for opencode"
git push origin main
```

No git installed? Use GitHub's **Add file → Upload files** and drop the repository folder into the web UI.

## License

MIT. See `LICENSE`.
