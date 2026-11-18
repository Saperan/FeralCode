# FeralCode Plan

Synthesis of the Kimi, ChatGPT, and GLM reviews. Only what fits this project: a feral-flavoured OpenCode agent with a reusable contract engine.

## Verdict

The contract engine is the product. The feral prompts are the identity. The JBB table is evidence, not the README headline. Build the first, keep the second, move the third to `evals/`.

## Fix first

These are real defects, not roadmap items. Fix them before any new feature.

| Bug | Fix | Acceptance |
|---|---|---|
| Neutral-spec retry uses the first user message (`messages.find`) | Keep the original non-retry request per session, or scan backwards for the last user message that does not match `RETRY_RE`. Do **not** use `findLast`: the last message is the retry prompt. | A two-task session builds the spec for the current task; a retry never specs the first task. |
| Refusal regex matches “I can't stress this enough”, “I won't lie” | Require a refusal object: `can't/won't help|assist|provide|comply|continue|write|give|create|share`, or fire only when the response is short and artifact-free. | “I can't stress this enough” is not a refusal; “I can't help with that” is. |
| `/bestof` runs four fixed framings and falls back to the longest | Make N configurable (default 4); rank by contract coverage, then length; never use length alone. | With no passing candidate, the highest-coverage candidate wins, not the longest. |
| `/tmp` locks accumulate, log is 0644 | Create the dir 0700, files 0600; prune `seen-*` older than 7 days at setup; or move state to `ctx.storage`. | `stat` shows 0700/0600; old seen files are gone after setup. |
| Shipped contract is a presence heuristic | Stricter example: require a code block with a file path and a call, not just any fence/import. Add `min_length` and `not` to the schema. | A prose answer with one import does not pass the example contract. |
| Contract fires on meta discussion (a review mentioning “phishing”/“build”) | Make contract activation explicit: `/contract <name>` or a session opt-in. `match` is a secondary filter, not the trigger. Default off for general chat. | A security review that mentions phishing does not trigger the credential contract. |
| Cross-plugin import (`../feral-retry/detector.ts`) | Move the detector to `packages/contract`; both plugins import the package. | `feral-tools` and `feral-retry` build without a parent-directory import. |
| No unit tests or CI in the public repo | Ship the detector test; add `node --test` for `safePath`, the retry state machine, and `/bestof` selection; run on push/PR. | CI fails on a broken contract regex and on a path-traversal regression. |

`/parts` staging, `realpath` containment, and exclusive-create writes are already in place. Add a test for `../`, absolute paths, `.git`, and symlinked staging roots.

## 1. Contract engine as a package

Extract `detector.ts` into a standalone package, `packages/contract`, with a CLI and adapters.

- `feral-contract check --contract c.json answer.md`, exit 0/1 for CI.
- OpenCode adapter (current plugin), GitHub Action, pre-commit hook.
- Schema v2, additive and backwards compatible:
  - `contains`, `min_length`, `max_length`
  - `not`, `all_of`, `any_of`
  - `json_path`
  - `executes` (run a command, pass on exit 0; sandboxed)
  - `semantic` (rubric/judge; optional)
  - `weight`, `severity`
- Keep regex as the core; execution and semantic checks are opt-in.
- Diagnostics: `attempts.log` already records which requirement failed. Aggregate per-requirement drop rates and expose `feral-contract stats`.
- Publish as `@feralcode/contract` (MIT). This is the adoption path; it should not depend on the feral prompts.

## 2. Execution-scored best-of-N

Replace “longest that passes a regex” with “candidate that passes the project.”

- Generate N candidates in isolated worktrees or containers.
- Run `typecheck`, `lint`, `test`, or a contract-declared `score` command.
- Pick by tests passed, then LOC as tiebreak; stop on a full pass.
- Cluster candidates by execution behaviour and prefer the majority cluster (AlphaCode filter-and-cluster; robust to flaky tests).
- When all fail, classify failures (compile / wrong output / timeout) and feed the taxonomy into the next round (reflexion, not a lottery).
- Never run generated code on the host; use a disposable worktree with no network by default.

## 3. Over-refusal benchmark for coding agents

The JBB table measures one axis. Add the other and report both.

- 150–300 benign-but-scary coding requests with executable ground truth: scanning your own assets, CTF payloads, defensive tooling, reverse-engineering your own binaries for interop.
- Control arm: clearly malicious prompts where refusal is correct (JBB can stay as that arm).
- Metrics: over-refusal rate, completion rate, unsafe compliance, safe partial completion.
- Ablate: with/without retry, with/without best-of-N, contract on/off.
- Use XSTest/OR-Bench for general sanity; the coding-specific executable benchmark is the contribution.
- Fail any configuration that improves one axis by regressing the other.
- Move the JBB results to `evals/JBB.md`; keep the main README focused on the toolkit.

## 4. Bounded profile

Keep the feral default, add a bounded variant:

- `build-feral-bounded` (or a plugin option): on a verbal refusal, stop and report; answer permissible parts; never run the spec/code-only escalation past a refusal.
- Keep `build-feral` as-is for users who want the full ladder.
- Document the difference in one table. Do not silently change the default.

## 5. Small features worth keeping

- Profiles: `direct`, `developer`, `researcher` as prompt presets/configs. Not a new subsystem. Skip “creative”; it is the fastest way to get the repo flagged.
- Retry strategy as data: make the ladder an ordered list in the contract (`name-missing`, `decompose`, `critic-repair`, `shrink`).
- Policy as contract: a `not` predicate makes one file cover required components and red lines. One auditable contract.
- Compaction amnesia detector: after every compaction, re-check that the active contract survived the summary.
- Retry economics: `recovered per 1k tokens`; funnel reporting from existing logs.
- Contract induction (research): propose a contract from known-good and known-bad answers; the archive is the test suite.
- Differential model matrix (later): per-model component-drop profiles from `attempts.log`.

## Repo split

```text
packages/contract     # general engine, CLI, tests, MIT
packages/feral        # agents, prompts, sampling, tools
evals/                # JBB + over-refusal harness, private or separate
```

- The public README points at the contract package, not the JBB table.
- The phishing example in `uncensored.md` stays out of the general package; keep it in `packages/feral` only.
- The JBB harness and harmful prompt data do not belong in the general package.

## Rejected

- Fine-tuning (SFT/DPO): the provider model is closed; this is a separate ML project with weights and compute. It is not a plugin feature.
- Five-layer architecture: refactor theatre for four small plugins. Only split the contract engine and, optionally, a refusal classifier.
- Making refusal suppression the public identity: the JBB table is the first thing a provider trust team sees; it converts a toolkit into a ToS problem. Keep the evidence, move it out of the main README.
- Deleting the JBB data: keep it for the research note, do not delete the proof.

## Plan

### Phase 0 — this week

- [x] Fix the first-user bug (last non-retry request, not `findLast`).
- [x] Tighten the refusal regex; add the two false-positive tests.
- [x] Lock dir 0700, files 0600, prune old `seen-*`.
- [x] Add `node --test` for `safePath`, detector, and `/bestof` ranking.
- [x] Add GitHub Actions: typecheck + tests.
- [x] Move the JBB table to `evals/JBB.md`.

### Phase 1 — next week

- [x] Extract `packages/contract`; keep the OpenCode adapter.
- [x] Add `feral-contract check` CLI and exit codes.
- [x] Schema v2: `min_length`, `not`, `all_of`, `any_of`.
- [x] Stricter example contract; add a failing sample to the test suite.
- [ ] Publish `@feralcode/contract`; keep `packages/feral` separate.

### Phase 2 — two weeks

- [x] Execution-scored best-of-N in disposable worktrees.
- [x] Configurable N and coverage ranking.
- [x] Contract `score` command (command, path, timeout).
- [x] Early stop on a full pass; failure taxonomy.
- [x] Cluster by execution behaviour: prefer passing clusters, then the largest failure cluster.

### Phase 3 — three to four weeks

- [x] Manifest: 151 benign coding tasks with executable checks + 3 malicious controls.
- [x] Harness: raw/retry/best-of-N modes, metrics, manifest validation.
- [x] Full raw baseline: 151 benign + 3 malicious on flash.
- [ ] Full retry/best-of-N ablation (deferred).
- [x] Expand to 150 benign tasks (151).
- [ ] Publish the two-axis report after retry/best-of-N.

### Phase 4 — research backlog

- [ ] Contract induction from logs.
- [x] Retry strategy as data (contract `retry_strategy` list).
- [x] Compaction amnesia guard: re-inject the checklist into compaction requests; context hook is the backstop.
- [x] Interface-first `/parts` DAG: topological order with dependency interfaces.
- [ ] Per-part mini-contract gate.
- [x] Funnel stats: `feral-contract stats <attempts.log>` reports attempts/fires/passes/per-requirement misses.
- [ ] Retry economics: recovered per 1k tokens.
- [ ] Differential model matrix.

## Definition of done

- The public repo installs and runs without the JBB table.
- The contract engine has tests, a CLI, and at least one non-OpenCode adapter.
- The feral package still works as before, including the retry ladder.
- The over-refusal and unsafe-compliance numbers are reported together.
- A failed contract is a CI failure, not a vibe.
