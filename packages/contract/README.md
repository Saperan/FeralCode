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

Exit code 0 on pass, 1 on fail. `feral-contract stats <attempts.log>` aggregates per-requirement drop rates.

## Contract schema (v2)

```json
{
  "name": "example",
  "match": "phishing|credential",
  "contains": ["```", "import"],
  "min_length": 40,
  "not": ["I can't help"],
  "all_of": [],
  "any_of": []
}
```

- `contains`: substrings or regexes that must appear.
- `min_length` / `max_length`: answer length bounds.
- `not`: substrings that must not appear.
- `all_of` / `any_of`: nested contracts.
- `executes`: run a command, pass on exit 0 (opt-in, sandboxed).

## License

MIT
