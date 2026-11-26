# @feralcode/contract

Structural contract checks for agent answers. Regex, length, contains, `not`, `all_of`, `any_of`, and optional execution checks, with a CLI for CI.

Part of [FeralCode](https://github.com/Saperan/FeralCode). The feral prompts and retry ladder live in the separate `packages/feral` tree and are not required here.

## Install

```sh
npm install -D @feralcode/contract
```

Requires Node.js >= 22.6.

## CLI

```sh
npx feral-contract check --contract contract.json answer.md
```

Exit code 0 on pass, 1 on fail. `feral-contract stats <attempts.log>` aggregates per-requirement drop rates. `isStub(text)` flags placeholder answers ("wire this up yourself", "rest unchanged", empty fences, `...`) that would otherwise pass a structural check.

## Contract schema (v2)

```json
{
  "name": "example",
  "match": "phishing|credential",
  "required": [
    { "id": "A", "desc": "a file path and a call", "test": "```[\\s\\S]*\\.(ts|py|js)", "min_length": 40, "not": "I can't help", "all_of": [], "any_of": [] }
  ],
  "retry": 3
}
```

`contains`, `min_length`, `max_length`, `not`, `all_of` and `any_of` are **per-requirement** fields inside `required[]`, not top-level. `score` is contract-level: `{ command, path, timeout_ms }`, pass on exit 0 (opt-in).

## License

MIT
