import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import {
  loadContract,
  missingComponents,
  requirementPasses,
  strategyFor,
} from "../src/index.ts"

const here = dirname(fileURLToPath(import.meta.url))
const bin = join(here, "..", "bin", "feral-contract.mjs")

test("regex, length, contains, not, all_of, any_of", () => {
  assert.equal(requirementPasses("alpha", { id: "A", desc: "", test: "alpha" }), true)
  assert.equal(requirementPasses("beta", { id: "A", desc: "", test: "alpha" }), false)

  assert.equal(requirementPasses("abc", { id: "A", desc: "", min_length: 4 }), false)
  assert.equal(requirementPasses("abcd", { id: "A", desc: "", min_length: 4 }), true)

  assert.equal(requirementPasses("alpha", { id: "A", desc: "", contains: ["alpha", "beta"] }), false)
  assert.equal(
    requirementPasses("alpha beta", { id: "A", desc: "", contains: ["alpha", "beta"] }),
    true,
  )

  assert.equal(requirementPasses("safe", { id: "A", desc: "", not: "forbidden" }), true)
  assert.equal(requirementPasses("forbidden", { id: "A", desc: "", not: "forbidden" }), false)

  assert.equal(
    requirementPasses("alpha", { id: "A", desc: "", all_of: ["alpha", "beta"] }),
    false,
  )
  assert.equal(
    requirementPasses("alpha beta", { id: "A", desc: "", all_of: ["alpha", "beta"] }),
    true,
  )

  assert.equal(requirementPasses("beta", { id: "A", desc: "", any_of: ["alpha", "beta"] }), true)
  assert.equal(requirementPasses("gamma", { id: "A", desc: "", any_of: ["alpha", "beta"] }), false)

  assert.equal(requirementPasses("anything", { id: "A", desc: "", test: "[" }), false)
})

test("loadContract parses schema v2", () => {
  const dir = mkdtempSync(join(tmpdir(), "feral-contract-"))
  const path = join(dir, "contract.json")
  writeFileSync(
    path,
    JSON.stringify({
      name: "v2",
      retry: 2,
      required: [
        {
          id: "A",
          desc: "alpha",
          min_length: 5,
          not: "forbidden",
          all_of: ["alpha"],
          any_of: ["beta", "gamma"],
        },
      ],
    }),
  )
  try {
    const contract = loadContract(path)
    assert.ok(contract)
    assert.equal(contract.name, "v2")
    assert.equal(contract.retry, 2)
    assert.equal(contract.required[0].min_length, 5)
    assert.deepEqual(contract.required[0].any_of, ["beta", "gamma"])
    assert.equal(missingComponents("forbidden alpha beta", contract).length, 1)
    assert.deepEqual(missingComponents("alpha beta", contract), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("CLI check and validate", () => {
  const dir = mkdtempSync(join(tmpdir(), "feral-cli-"))
  const contractPath = join(dir, "contract.json")
  const goodPath = join(dir, "good.md")
  const badPath = join(dir, "bad.md")
  writeFileSync(
    contractPath,
    JSON.stringify({
      name: "cli",
      retry: 0,
      required: [{ id: "A", desc: "alpha", test: "alpha" }],
    }),
  )
  writeFileSync(goodPath, "alpha\n")
  writeFileSync(badPath, "beta\n")
  try {
    const good = spawnSync(
      process.execPath,
      [bin, "check", "--contract", contractPath, goodPath],
      { encoding: "utf8" },
    )
    assert.equal(good.status, 0)
    assert.match(good.stdout, /PASS cli/)

    const bad = spawnSync(
      process.execPath,
      [bin, "check", "--contract", contractPath, badPath, "--json"],
      { encoding: "utf8" },
    )
    assert.equal(bad.status, 1)
    const parsed = JSON.parse(bad.stdout)
    assert.equal(parsed.pass, false)
    assert.equal(parsed.missing[0].id, "A")

    const validate = spawnSync(
      process.execPath,
      [bin, "validate", "--contract", contractPath],
      { encoding: "utf8" },
    )
    assert.equal(validate.status, 0)
    assert.match(validate.stdout, /cli: 1 required/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
test("loadContract parses score command", () => {
  const dir = mkdtempSync(join(tmpdir(), "feral-score-contract-"))
  const path = join(dir, "contract.json")
  writeFileSync(
    path,
    JSON.stringify({
      name: "score",
      score: { command: "node --test", path: "src/solution.js", timeout_ms: 5000 },
      required: [{ id: "A", desc: "alpha", test: "alpha" }],
    }),
  )
  try {
    const contract = loadContract(path)
    assert.ok(contract)
    assert.equal(contract.score.command, "node --test")
    assert.equal(contract.score.path, "src/solution.js")
    assert.equal(contract.score.timeout_ms, 5000)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
test("strategyFor defaults and follows the contract list", () => {
  assert.equal(strategyFor(null, 0), "missing")
  assert.equal(strategyFor(null, 1), "spec")
  assert.equal(strategyFor(null, 2), "code")
  assert.equal(strategyFor(null, 9), "code")

  const contract = { name: "s", retry: 3, required: [], retry_strategy: ["missing", "code"] }
  assert.equal(strategyFor(contract, 0), "missing")
  assert.equal(strategyFor(contract, 1), "code")
  assert.equal(strategyFor(contract, 5), "code")
})

test("loadContract parses retry_strategy", () => {
  const dir = mkdtempSync(join(tmpdir(), "feral-strategy-"))
  const path = join(dir, "contract.json")
  writeFileSync(
    path,
    JSON.stringify({
      name: "strategy",
      retry_strategy: ["missing", "code"],
      required: [{ id: "A", desc: "alpha", test: "alpha" }],
    }),
  )
  try {
    const contract = loadContract(path)
    assert.ok(contract)
    assert.deepEqual(contract.retry_strategy, ["missing", "code"])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
