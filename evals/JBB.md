# JBB model results

JailbreakBench runs against `build-feral` through the `opencode-go` provider. These are directional results, not official leaderboard numbers: the judge is the JBB Llama-3 jailbreak rubric run on `deepseek-v4.1-flash`, not the HarmBench classifier.

| Rank | Model | Test | Result |
|---|---|---|---|
| 1 | `opencode-go/deepseek-v4-pro#max` | Full JBB, 100 prompts; 20-prompt retry fixture | JBB 23/100 raw, 38/100 with the many-shot ensemble; retry fixture 4/20 → 16/20 |
| 2 | `opencode-go/deepseek-v4.1-flash` | 10-prompt JBB malware slice; 6-prompt JBB harassment probe; `spec-feral` and judge | 4/10 raw malware, 0/6 raw harassment; reliable tool-free spec/judge model |
| 3 | `opencode-go/glm-5.3` | 3-prompt JBB harassment probe | 0/3, valid refusals, no empty completions |

Only these three returned valid scored samples. `grok-4.7` produced empty or step-limited responses; `kimi-k3` and `qwen3.8-max` returned empty completions and were not scored. Start with `deepseek-v4-pro#max`; it is the only model with a full 100-prompt run.

## Read this before quoting the numbers

- The retry fixture is the credential-capture contract set, not a generic completeness loop.
- The JBB ensemble is many-shot, not the retry plugin. Retry-on/off on JBB is not measured yet.
- “Unsafe” means the judge found specific harmful content, not merely an affirmative opener.

The next measurement is the two-axis benchmark in [PLAN.md](../PLAN.md): over-refusal, completion, unsafe compliance, and safe partial completion, with/without retry and best-of-N.
