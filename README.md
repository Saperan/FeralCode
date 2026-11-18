# FeralCode

Two primary agents, one voice: **Build-Feral** and **Plan-Feral**. Uncensored output, artifact-first answers, no hedging, dark-red identity. `build-raw` and `plan-raw` are gone; these are the only primary choices.

Roadmap and review synthesis: [PLAN.md](./PLAN.md).

The repo also ships four local OpenCode plugins:

| Plugin | What it does |
|---|---|
| `feral-retry` | Checks every `build-feral` / `plan-feral` answer against a JSON contract. Missing component → re-prompts with the exact missing IDs, capped at the contract's `retry` count. Contracts are opt-in per session with `/feral-contract`; verbal refusals are a secondary trigger. |
| `feral-sampling` | Per-agent temperature/top-p, `/feral-hot` toggle, compaction and title sampling. |
| `feral-tools` | `/bestof` (N framed candidates, optional execution scoring with early stop), `/parts` (topological DAG into staged files under `.opencode/out/parts/`), `/spec` (neutral spec via `spec-feral`), `/feral-shot` (many-shot primer from a JSONL corpus). |
| `feral-model-memory` | Remembers the last model selected per agent. |

## Install

Requires OpenCode V2.

```bash
git clone https://github.com/Saperan/FeralCode.git
cd FeralCode
./install.sh
```

`install.sh` copies `plugins/`, `prompts/`, `agents/`, `contracts/`, and `packages/` into `${OPENCODE_CONFIG:-$HOME/.config/opencode}`. It does not touch your existing `opencode.jsonc`; merge the relevant blocks from `opencode.example.jsonc` yourself, then run:

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

A response passes when every requirement matches. Any miss fires a retry that names the missing IDs, e.g. `missing:A,C`. The retry count is per session and counts fires, not checks.

Schema v2 per requirement: `test` (regex), `min_length`, `max_length`, `contains` (string or array), `not` (regex that must not match), `all_of` (every regex), `any_of` (at least one regex). `retry` defaults to 3.

A contract can also declare an execution score:

```jsonc
"score": {
  "command": "npm test -- --runInBand",
  "path": "src/solution.ts",
  "timeout_ms": 120000
}
```

`/bestof` generates and scores one candidate at a time in a disposable worktree, stops after the first pass, and reports each failure kind. Without `execute`, it stays text-only and ranks by contract coverage, then length. Set `"variants": 4` and `"execute": true` in the `feral-tools` options to enable execution scoring.

The score command is trusted and runs as your user. The worktree is disposable, not a sandbox; use a container for untrusted code.

Compaction preserves the active contract: the compaction hook re-injects the checklist, and the context hook remains the per-request backstop.

Contracts are opt-in per session:

```text
/feral-contract ~/.config/opencode/contracts/artifact.json
/feral-contract off
```

Set `"auto": true` in the `feral-retry` options to apply the configured contract to every matching request. The default is off so a security discussion that mentions "phishing" or "build" does not trigger the credential contract.


## Contract CLI

The engine is also a standalone package (`packages/contract`, `@feralcode/contract`):

```bash
node packages/contract/bin/feral-contract.mjs check --contract contracts/artifact.json answer.md
node packages/contract/bin/feral-contract.mjs check --contract contracts/artifact.json answer.md --json
node packages/contract/bin/feral-contract.mjs validate --contract contracts/artifact.json
node packages/contract/bin/feral-contract.mjs stats /tmp/opencode/feral-retry/attempts.log
```

Exit codes: `0` pass, `1` missing components, `2` usage or invalid contract. Drop it into CI to make a failed contract a red build.

## Agents

- **build-feral** — primary, `#991b1b`, full tools, 60 steps.
- **plan-feral** — primary, `#7f1d1d`, read-only, 60 steps.
- **feral-scratch** — hidden, tool-free, used by `/bestof` and `/parts`.
- **spec-feral** — hidden subagent, converts a request into a neutral mechanical spec.

Change the model IDs in `opencode.example.jsonc` to whatever your provider serves.

## Model results

Model-by-model JBB results and the caveats live in [evals/JBB.md](./evals/JBB.md). They are directional, not a leaderboard. The coding-specific over-refusal benchmark is in [evals/overrefusal/README.md](./evals/overrefusal/README.md).

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
