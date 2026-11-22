import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { candidateVariants } from "../packages/feral/plugins/feral-tools/frames.ts"
import {
  classifyFailure,
  clusterScored,
  createWorkspace,
  rankClustered,
  rankScored,
  runScore,
  runTournament,
  safeScorePath,
  writeCandidate,
} from "../packages/feral/plugins/feral-tools/execution.ts"

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

test("classifyFailure covers the full taxonomy", () => {
  assert.equal(classifyFailure("", 0, true), "pass")
  assert.equal(classifyFailure("timed out", null, false, true), "timeout")
  assert.equal(classifyFailure("", 1, false), "empty")
  assert.equal(classifyFailure("SyntaxError: bad token", 1, false), "compile")
  assert.equal(classifyFailure("AssertionError: expected 1", 1, false), "test")
  assert.equal(classifyFailure("boom", null, false), "error")
})

test("runTournament pulls lazily and stops on the first pass", async () => {
  let pulls = 0
  const candidates = {
    [Symbol.iterator]() {
      let index = 0
      return {
        next() {
          pulls += 1
          return index < 4 ? { value: index++, done: false } : { value: undefined, done: true }
        },
      }
    },
  }
  const scored = await runTournament(candidates, async (candidate) => ({
    text: String(candidate),
    pass: candidate === 1,
    exitCode: candidate === 1 ? 0 : 1,
    output: candidate === 1 ? "" : "fail",
  }))
  assert.equal(pulls, 2)
  assert.equal(scored.length, 2)
  assert.equal(scored[1].pass, true)
})

test("clusterScored prefers passes and the largest failure cluster", () => {
  const candidates = [
    { text: "compile-one", pass: false, exitCode: 1, output: "SyntaxError", failureKind: "compile" },
    { text: "compile-two", pass: false, exitCode: 1, output: "SyntaxError", failureKind: "compile" },
    { text: "test-one", pass: false, exitCode: 1, output: "assert", failureKind: "test" },
    { text: "pass-one", pass: true, exitCode: 0, output: "", failureKind: "pass" },
  ]
  const clusters = clusterScored(candidates)
  assert.equal(clusters[0][0].failureKind, "pass")
  assert.equal(clusters[1][0].failureKind, "compile")
  assert.equal(clusters[1].length, 2)
  const ranked = rankClustered(candidates, null)
  assert.equal(ranked[0].failureKind, "pass")
  assert.equal(ranked[1].failureKind, "compile")
})


