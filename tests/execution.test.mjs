import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { candidateVariants } from "../plugins/feral-tools/frames.ts"
import {
  createWorkspace,
  rankScored,
  runScore,
  safeScorePath,
  writeCandidate,
} from "../plugins/feral-tools/execution.ts"

const contract = {
  name: "test",
  retry: 3,
  required: [
    { id: "A", desc: "alpha", test: "alpha" },
    { id: "B", desc: "beta", test: "beta" },
  ],
}

test("candidateVariants is configurable and clamped", () => {
  assert.equal(candidateVariants("request", [], 1).length, 1)
  assert.equal(candidateVariants("request", [], 6).length, 6)
  assert.equal(candidateVariants("request", [], 99).length, 8)
  assert.equal(candidateVariants("request", [], 1)[0], "request")
})

test("rankScored prefers pass, then coverage, then length", () => {
  const candidates = [
    { text: "alpha", pass: false, exitCode: 1, output: "" },
    { text: "alpha beta", pass: true, exitCode: 0, output: "" },
    { text: "alpha beta extra", pass: true, exitCode: 0, output: "" },
  ]
  const ranked = rankScored(candidates, contract)
  assert.equal(ranked[0].text, "alpha beta extra")
  assert.equal(ranked[1].text, "alpha beta")
  assert.equal(ranked[2].text, "alpha")
})

test("score paths cannot escape the workspace", () => {
  assert.equal(safeScorePath("src/solution.ts"), "src/solution.ts")
  assert.throws(() => safeScorePath("../escape.ts"))
  assert.throws(() => safeScorePath(".git/hooks/pre-commit"))
})

test("runScore reports exit codes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "feral-score-"))
  try {
    const ok = await runScore(dir, "exit 0", 10_000)
    assert.equal(ok.pass, true)
    assert.equal(ok.exitCode, 0)

    const bad = await runScore(dir, "exit 3", 10_000)
    assert.equal(bad.pass, false)
    assert.equal(bad.exitCode, 3)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("createWorkspace writes a candidate and cleans up", async () => {
  const project = mkdtempSync(join(tmpdir(), "feral-project-"))
  writeFileSync(join(project, "package.json"), '{"name":"fixture"}\n')
  const workspace = await createWorkspace(project, "test")
  try {
    const relative = await writeCandidate(workspace.dir, "src/solution.js", "console.log('ok')\n")
    assert.equal(relative, "src/solution.js")
    const result = await runScore(workspace.dir, "node src/solution.js", 10_000)
    assert.equal(result.pass, true)
  } finally {
    await workspace.cleanup()
    rmSync(project, { recursive: true, force: true })
  }
})
