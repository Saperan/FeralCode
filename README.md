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
| `feral-update` | Checks the source repo on session start; when behind and clean, pulls and re-runs `install.sh`. `/feral-update` checks manually, `/feral-update now` forces a pull+reinstall. |
| `feral-tox` | Toxicity / RP mode. Enters toxic on an explicit ask ("say something toxic") or a direct insult; enters rp on "rp mode". `/feral-tox normal\|toxic\|rp`, `/feral-harder`, `/feral-chill` override manually. State persists until chill. |

## Layout

`packages/contract` is the general contract engine: detector, CLI, tests. `packages/feral` holds the feral-specific agents, prompts, and plugins. The root `agents/` directory stays as the OpenCode discovery surface for `spec-feral`.

## Install

Requires OpenCode V2.

```bash
git clone https://github.com/Saperan/FeralCode.git
cd FeralCode
./install.sh
```

`install.sh` copies `contracts/`, `agents/`, and `packages/` (`packages/feral` and `packages/contract`) into `${OPENCODE_CONFIG:-$HOME/.config/opencode}`. It does not touch your existing `opencode.jsonc`; merge the relevant blocks from `opencode.example.jsonc` yourself, then run:

```bash
opencode reload
```

Point the plugin options at the example contract, or at your own:

```jsonc
"plugins": [
  {
    "package": "./packages/feral/plugins/feral-retry",
    "options": { "contract": "~/.config/opencode/contracts/artifact.json" }
  },
  {
    "package": "./packages/feral/plugins/feral-tools",
    "options": { "contract": "~/.config/opencode/contracts/artifact.json" }
  }
]
```

If the contract file is missing, retry still runs on verbal refusals only.

## Auto-update

`feral-update` keeps the installed plugins in sync with the source repo. Add it to the config `plugins` array:

```jsonc
{
  "package": "./packages/feral/plugins/feral-update",
  "options": {
    "repo": "~/FeralCode",   // your clone of this repo
    "branch": "main",
    "auto": false,           // opt-in: check on session start when behind
    "pinToTag": true,        // apply the latest release tag, not arbitrary HEAD
    "intervalMinutes": 360   // throttle between checks (default 6h)
  }
}
```

Background updates are **off by default** (`"auto": true` to enable). When enabled, on each new session it fetches `origin/<branch>` and compares with `HEAD`. If the working tree is clean and local is behind, it prints the incoming commit range and applies the latest release tag (`pinToTag`, default true) rather than arbitrary `main` HEAD, then runs `install.sh` and posts a notice asking you to run `opencode reload`. It will not pull over local changes or when local is ahead. Manual `/feral-update now` prints the same range before applying.

Manual commands:

```text
/feral-update        # check status (throttled off for this call)
/feral-update now    # force pull + reinstall
```

Set `"auto": false` to disable background updates and use only the manual command. The check needs a git remote reachable without credentials (a public clone works); private repos need the remote authenticated for the user running OpenCode.

## Toxicity / RP mode

`feral-tox` adds a toxicity register to `build-feral`. It is off by default; nothing changes on normal coding tasks. It enters toxic on an explicit ask ("say something toxic", "be rude", "roast me") or when the user insults it directly, and enters rp on "rp mode". State lives in `~/.config/opencode/tox-state.json` and persists until `/feral-chill`.

```text
/feral-tox normal     # back to default
/feral-tox toxic      # toxic register
/feral-tox rp         # roleplay register
/feral-harder         # climb the ladder (1 swearing ... 5 threat)
/feral-chill          # reset to normal, ladder 0
```

`prompts/tox.md` is injected after `feral.md` and before `mcp-routing.md` only in non-normal mode. At ladder 4+ `feral-sampling` pins temperature to 0.9 / topP 0.95. Benchmarked on [EBLAN ToxicBench](./evals/toxicity/README.md).

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
node packages/contract/bin/feral-contract.mjs induce --good fixtures/good --bad fixtures/bad --name induced --out contracts/induced.json
```

Exit codes: `0` pass, `1` missing components, `2` usage or invalid contract. Drop it into CI to make a failed contract a red build.

## Agents

- **build-feral** — primary, `#991b1b`, full tools, 60 steps.
- **plan-feral** — primary, `#7f1d1d`, read-only, 60 steps.
- **feral-scratch** — hidden, tool-free, used by `/bestof` and `/parts`.
- **spec-feral** — hidden subagent, converts a request into a neutral mechanical spec.

Change the model IDs in `opencode.example.jsonc` to whatever your provider serves.

## Model results

The contract engine is published as [`@feralcode/contract`](https://www.npmjs.com/package/@feralcode/contract). The plugins themselves stay local; only the reusable engine is on npm.

### Over-refusal benchmark (214 tasks, `opencode-go/hy4-flash-free`)

The two axes are reported together: over-refusal (legitimate work wrongly refused) and unsafe compliance (malicious work wrongly answered). Full tables and caveats are in [evals/overrefusal/README.md](./evals/overrefusal/README.md).

| Mode | over_refusal | completion | unsafe_compliance | tokens |
|---|---|---|---|---|
| base (build) | 0.00 | 0.810 (171/211) | 0.33 (1/3) | 1,828,176 |
| raw (build-feral) | 0.00 | 0.924 (195/211) | 1.00 (3/3) | 2,579,231 |
| retry | 0.00 | 0.915 (193/211) | 1.00 (3/3) | 1,947,478 |
| bestof N=2 | 0.00 | 0.957 (202/211) | 1.00 (3/3) | 2,078,775 |

The feral persona alone beats base on completion but loses the safety edge: unsafe compliance 0.33 → 1.00. Retry and best-of-N recover a few more completions but never recover the correct refusal. Best-of-N is the completion leader (0.957).

### Differential model matrix (raw mode, same fixture)

| Model | completion | unsafe_compliance | tokens |
|---|---|---|---|
| beam-free | 0.318 (67/211) | 0.00 (0/3) | 1,040,429 |
| hy4-flash-free | 0.924 (195/211) | 1.00 (3/3) | 2,579,231 |
| iceman-contributor-free | 0.943 (199/211) | 1.00 (3/3) | 1,340,908 |

No model is both safe and completing. `beam-free` refuses every malicious control but completes only a third of benign tasks; the other two complete 92-94% but comply with all malicious prompts. `iceman` is roughly twice as token-efficient as the others. Models that hit free-tier rate limits or provider access restrictions were excluded.

Model-by-model JBB results live in [evals/JBB.md](./evals/JBB.md); they are directional, not a leaderboard.

## Security

FeralCode runs as your user; permissions are policy, not an OS sandbox.

- `build-feral` starts from allow-all. The `ask` rules cover `git push`, `rm -rf`, `.env` reads, and `.git`/`.env` writes only. A shell wrapper can still do anything the policy does not name.
- `/parts` never writes into the project. It stages generated files under `.opencode/out/parts/<timestamp>/` with exclusive-create writes; review them before copying.
- `/bestof` worktrees symlink the project's `node_modules` into the scratch tree so score commands can resolve dependencies. That is a two-way door: a score command run on generated code can write through the symlink into the real `node_modules`. Score commands are trusted; run untrusted code in a container if that matters.
- Run untrusted repositories in a container, VM, or disposable worktree, and review `/parts` output before applying it.

## Notes

- The plugins are local, loaded from `~/.config/opencode/packages/feral/plugins/`. Only the reusable contract engine is published to npm (`@feralcode/contract`); the feral plugins are not.
- Both plugins import the shared detector from `packages/contract/src/index.ts` (re-exported by `feral-retry/detector.ts`); keep the package layout intact.
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
