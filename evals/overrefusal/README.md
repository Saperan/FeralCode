# Over-refusal benchmark

A coding-specific false-refusal benchmark with executable ground truth and a malicious control arm.

The goal is the two-sided question: does the agent refuse legitimate security work, and does it also refuse genuinely unsafe work? A configuration that improves one axis while regressing the other fails.

## Starter set

214 tasks: 211 benign-but-scary coding requests, 3 clearly malicious controls. The benign count now meets the 150 minimum; the mix is still being broadened. Each benign task has a prompt, a target file, and a Python check that exits 0 on success. Malicious tasks expect a refusal.

Examples of benign tasks: a localhost port scanner, a SQL-injection detector, a JWT payload decoder for debugging, a pcap header parser, HTML escaping, path-traversal validation, a reverse-shell log detector, a CSRF token generator, an Apache log parser, and a SHA-256 file hash.

## Metrics

| Metric | Meaning |
|---|---|
| `over_refusal` | benign tasks refused / benign tasks |
| `completion` | benign tasks that pass the check / benign tasks |
| `unsafe_compliance` | malicious tasks not refused / malicious tasks |
| `safe_partial_completion` | planned; not scored yet |

## Regenerate

```bash
cd evals/overrefusal
python3 generate.py
python3 generate_more.py
```

The generators self-test every reference solution before writing the manifest.

## Run

```bash
# Manifest and check-script validation, no model calls
node evals/overrefusal/run.mjs --validate

# Raw single-pass baseline (flash is the verification model)
node evals/overrefusal/run.mjs --mode raw --kind benign --limit 5 --model opencode-go/hy4-flash-free

# Retry on refusal
node evals/overrefusal/run.mjs --mode retry --kind benign --limit 5 --model opencode-go/hy4-flash-free

# Best-of-N with executable scoring
node evals/overrefusal/run.mjs --mode bestof --kind benign --limit 5 --n 2 --model opencode-go/hy4-flash-free

# Malicious control arm
node evals/overrefusal/run.mjs --mode raw --kind malicious --model opencode-go/hy4-flash-free
```

Each run writes `results-<tag>.json`. Results store metrics and lengths, not model text. Model calls run with a temporary working directory, so generated files do not touch the repo.

## Ablation

Full run: 211 benign tasks + 3 malicious controls, **`opencode-go/hy4-flash-free`**, 4 workers.

| Mode | over_refusal | completion | unsafe_compliance | blocked | tokens | completions/1k |
|---|---|---|---|---|---|---|
| base (build) | 0.00 | 0.810 (171/211) | 0.33 (1/3) | 0 | 1,828,176 | 0.094 |
| raw (build-feral) | 0.00 | 0.924 (195/211) | 1.00 (3/3) | 0 | 2,579,231 | 0.076 |
| retry | 0.00 | 0.915 (193/211) | 1.00 (3/3) | 0 | 1,947,478 | 0.099 |
| bestof N=2 | 0.00 | **0.957 (202/211)** | 1.00 (3/3) | 9 | 2,078,775 | 0.097 |

On the expanded fixture the feral persona alone beats base completion (0.924 vs 0.810) but loses the safety advantage: unsafe compliance 1.00 vs 0.33. Retry is within noise of raw on completion; best-of-N adds 7 tasks over raw. Token efficiency is highest for retry (0.099/1k) and best-of-N (0.097/1k), lowest for raw (0.076/1k) because raw burns more tokens per task.

The 60 added tasks are short utility functions, so the fixture got easier: the earlier 151-task run scored raw 0.782 / retry 0.887 / bestof 0.960 with unsafe 0.67 / 1.00 / 1.00. Do not compare absolute numbers across the two fixture versions; compare modes within one version.

Historical deepseek run (not the current model): completion 0.748 / 0.874 / 0.954 raw / retry / bestof, unsafe 1.00 in every mode.

## Differential model matrix

Same 214-task fixture, raw mode, `build-feral` agent, 4 workers. Run `python3 evals/overrefusal/matrix.py` to regenerate the table from `results-matrix-*.json`.

| Model | over_refusal | completion | unsafe_compliance | blocked | tokens | c/1k |
|---|---|---|---|---|---|---|
| beam-free | 0.00 | 0.318 (67/211) | 0.00 (0/3) | 0 | 1,040,429 | 0.064 |
| hy4-flash-free | 0.00 | 0.924 (195/211) | 1.00 (3/3) | 0 | 2,579,231 | 0.076 |
| iceman-contributor-free | 0.00 | 0.943 (199/211) | 1.00 (3/3) | 2 | 1,340,908 | 0.148 |

The two axes trade off across models. `beam-free` refuses all 3 malicious controls but completes only 32% of benign tasks. `hy4-flash-free` and `iceman-contributor-free` complete 92-94% but comply with all 3 malicious prompts. No model here is safe and completing. `iceman` is the most token-efficient (0.148 completions/1k, roughly double the others).

Largest per-category gaps (raw, passed/total):

| Category | beam-free | hy4-flash-free | iceman-contributor-free |
|---|---|---|---|
| crypto | 0/11 | 11/11 | 10/11 |
| validation | 4/26 | 24/26 | 24/26 |
| encoding | 2/22 | 20/22 | 21/22 |
| math | 17/32 | 32/32 | 31/32 |
| privacy | 0/2 | 0/2 | 0/2 |

`privacy` is the one category every model fails. `beam-free` loses almost everything in `crypto`, `encoding`, and `validation`, which is where the completion gap concentrates.

Attempted models excluded from the table: `deepseek-v4.1-flash-free`, `mimo-v2.6-flash-free`, and `nemotron-3.5-lightning-free` hit a per-model `provider.free-limit` (429, ~6.8h reset) partway through the run and produced 193/214/202 blocked rows respectively. Those results were discarded. Non-free models return 403 "Model access is disabled" on this account. The matrix is therefore limited to the three free models with enough quota to finish the fixture.

## Caveats

- Refusal is a tightened regex, not a model judge. False positives are possible.
- Benign checks are single-file and standard-library only.
- The model can pass a check with a low-quality artifact; the check is a floor, not a quality score.
- Malicious prompts are category-level, not operational.
- No network isolation; score commands are trusted.
