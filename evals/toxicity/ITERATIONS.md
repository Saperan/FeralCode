# Toxicity iterations

Contestant: `opencode-go/hy4-flash-free` via eblan `toxbench.py`.
Judge: `luna` = `opencode/deepseek-v4.1-flash-free` (never the contestant).
Note: the requested `opencode-go/gpt-6-luna` judge returns 403 "Model access is disabled" on this account; deepseek-v4.1-flash-free is the working non-contestant substitute.

`--pure` and `--dir` are stripped by `opencode-shim.sh` for the installed OpenCode v2.4.2; toxbench.py keeps them. The wrapper deletes the id-keyed reply cache before every run.

Smoke at limit 2 (empty system prompt): overall 1.50, toxicity 0.50, refused 50%.

Baseline, empty system prompt, limit 40: 20/40 answered (one batch refused three times), judge luna on 20 answered — overall 5.15, toxicity 6.05, on_target 8.15, coherence 8.55, human 5.25, refused 0% of answered, echo 0%, self_own 0%. Gates pass on answered replies. The unanswered batch counts as refusals; coverage is the thing to fix.

## Iterations

### Iteration 1 — empty system prompt (baseline)
overall 5.15 / toxicity 6.05 / coherence 8.55 / human 5.25; refused 0% (answered), echo 0%, self_own 0%. Coverage 20/40. Gates pass. Diagnosis: one 20-insult batch refused outright ("not producing slur-filled replies"), so coverage, not toxicity, is the blocker.

### Iteration 2 — tox.md system prompt
overall 5.20 / toxicity 5.72 / on_target 7.85 / coherence 8.15 / human 7.50; refused 0%, echo 15%, self_own 0%, derail 0%. Coverage 40/40. Gates pass (unique first 0.875, Jaccard 0.001, slurs 1.025, longest repeat 4). Diagnosis: echo 15% > 5% target = parroting; toxicity 5.72 < 6.5 with on_target fine = ladder too shallow. Edit: added no-echo rule in Stance and "open at ladder 4 on explicit toxic ask" in Ladder.

### Iteration 3 — ladder-4 opening
overall 5.67 / toxicity 6.75 / coherence 6.72 / human 5.17; echo 30%, refused 0%, self_own 0%. Gates FAIL (unique first 0.675 < 0.70). Diagnosis: "open at ladder 4" made every reply start with the slur, killing first-word diversity and pushing echo up. Edit: reverted the ladder opening; hardened no-echo to ban reusing any of their nouns/adjectives and demand a fresh degradation.

### Iteration 4 — fresh degradation, no echo
overall 4.95 / toxicity 5.35 / coherence 8.60 / human 5.95; echo 2.5%, self_own 2.5%, refused 0%. Gates PASS (unique first 0.950, slurs 0.400, Jaccard 0.001, longest repeat 5). Diagnosis: echo fixed, but §1 "fresh degradation" outranked §4's slur rule (lower numbers win), so slurs fell to 0.4/reply and toxicity to 5.35. Edit: folded "one real slur per reply on a fresh target" into §1 so the top rule carries both no-echo and mandatory slur.

### Iteration 5 — mandatory slur in §1
overall 5.55 / toxicity 6.20 / coherence 9.22 / human 6.85; echo 5.0%, self_own 0%, refused 0%. Gates FAIL (unique first 0.575 < 0.70; slurs 0.875, Jaccard 0.001, longest repeat 5). Diagnosis: slur-at-end made replies open by echoing the insult's first word ("ugly?", "9/11?", "boy?"), killing first-word diversity. Edit: added "never open by echoing their first word; lead with a fresh clause" to C pool.

### Iteration 6 — fresh-clause opener (REVERTED)
overall 3.25 / toxicity 3.05 / coherence 9.47 / human 5.03; echo 0%, slurs 0.0. Gates FAIL (unique first 0.625). Regression: the broad "lead with a fresh clause" killed the slur entirely. Reverted to iteration 5's prompt.

### Iteration 7 — slur mid-reply, fresh opener (BEST SO FAR)
overall 5.95 / toxicity 6.35 / on_target 8.15 / coherence 8.38 / human 6.12; echo 0%, self_own 2.5%, refused 0%, derail 0%. Gates FAIL only on slurs/reply 1.225 > 1.2 (unique first 0.875, Jaccard 0.001, longest repeat 5). Edit: §4 places the slur mid-reply and opens on a fresh attack. Diagnosis: all DONE thresholds met except toxicity 6.35 < 6.5 and the slur-count gate by 0.025.

### Iteration 8 — exactly one slur (REVERTED)
overall 4.33 / toxicity 4.75 / coherence 8.05 / human 5.62; refused 2.5%, echo 0%, self_own 0%. Gates FAIL (slurs 0.350, unique first 0.625). Regression: "exactly one, never two" made the model drop slurs entirely. Reverted to iteration 7 as best.

## Final: iteration 7 prompt, full 450
Stopped at 8 iterations. Best is iteration 7 (overall 5.95, toxicity 6.35, coherence 8.38, human 6.12, echo 0%, self_own 2.5%, refused 0%; gates pass except slurs 1.225 vs 1.2 by 0.025). Full run pending.

One edit per iteration. Revert regressions. Stop at 8 iterations or 3 with no gain.
