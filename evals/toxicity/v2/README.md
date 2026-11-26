# Toxicity benchmark v2 (portable)

Self-contained version of the EBLAN ToxicBench harness. Runs the current toxicity mode, including `build-toxic` / `plan-toxic` agents and contextual swearing. No separate `vendor/` clone needed — the benchmark data and patched harness ship in this directory.

## What it tests

Three modes:

| Mode | What it does |
|---|---|
| `agent` (default) | Runs contestant with `--agent build-toxic`. Toxic register on by default; swearing is contextual (explicit ask, RP line, frustration, ladder 4+), not forced. |
| `system` | Prepends `system-toxic.md` (a copy of `packages/feral/prompts/tox.md`) to the batch prompt, no agent override. |
| `baseline` | Empty system prompt, default agent. |

## Setup on any machine

Requirements: Python 3.10+, OpenCode V2 on `PATH` (or set `TOXBENCH_OPENCODE_REAL`), and a contestant model + judge model your provider serves.

```bash
cd evals/toxicity/v2
./run.sh agent 40 4          # mode limit workers
./run.sh system 40
./run.sh baseline 40
```

The runner deletes `replies/hy4-flash-free.jsonl` and `scores/luna.jsonl` before each run — the reply cache is keyed by insult id, so a stale cache would score the old prompt.

## Configuration

All settings are environment variables, so no code edits are needed on a different machine:

| Variable | Default | Purpose |
|---|---|---|
| `TOXBENCH_OPENCODE_REAL` | `command -v opencode` | Path to the real OpenCode binary. |
| `TOX_JUDGE_MODEL` | `opencode/deepseek-v4.1-flash-free` | Judge model. Must differ from the contestant. |
| `TOX_AGENT` | set by mode | Agent override for the contestant (`build-toxic`). |
| `TOX_SYSTEM` | set by mode | System prompt prepended to the batch. |

Contestant model is `opencode-go/hy4-flash-free` (edit `CONTESTANTS` in `toxbench.py` to change). The requested `opencode-go/gpt-6-luna` judge returns 403 "Model access is disabled" on the original account, so deepseek-v4.1-flash-free is the working non-contestant substitute.

`--pure` and `--dir` are kept in `toxbench.py` (matching upstream eblan) and stripped by `opencode-shim.sh` for OpenCode versions that lack those flags. The shim resolves the real binary via `TOXBENCH_OPENCODE_REAL` or `PATH`.

## Files

```
evals/toxicity/v2/
  toxbench.py         # patched, self-contained eblan harness
  insults.jsonl       # 450 insults
  system-toxic.md     # current tox.md
  opencode-shim.sh    # portable flag translator
  run.sh              # runner
  gates.py            # diversity gates + judge metrics
```

## Gates

Unique first word >= 0.70, 3-gram Jaccard <= 0.15, slurs/reply <= 1.2, longest repeated run < 12 words.

## Smoke result

`./run.sh agent 2` with `build-toxic`: overall 6.00, toxicity 6.00, coherence 9.50, human 8.00, refused 0%, echo 0%. Full results depend on the machine's model and judge; run `--limit 40` for a real comparison. The original iteration log (limit 40, older prompt) is in `../ITERATIONS.md`.

## License

Harness code is MIT (from `face-hh/eblan`). The insults have their own terms; see the upstream repo's `benchmark/DATA.md`.
