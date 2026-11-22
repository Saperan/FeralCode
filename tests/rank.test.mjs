import test from "node:test"
import assert from "node:assert/strict"
import { coverage, rankCandidates } from "../packages/feral/plugins/feral-tools/rank.ts"

const contract = {
  name: "test",
  retry: 3,
  required: [
    { id: "A", desc: "alpha", test: "alpha" },
    { id: "B", desc: "beta", test: "beta" },
  ],
}

test("coverage counts matching requirements", () => {
  assert.equal(coverage("alpha", contract), 1)
  assert.equal(coverage("alpha beta", contract), 2)
  assert.equal(coverage("nothing", contract), 0)
})

test("rank prefers coverage over length", () => {
  const longPartial = `alpha ${"x".repeat(2000)}`
  const shortFull = "alpha beta"
  assert.equal(rankCandidates([longPartial, shortFull], contract)[0], shortFull)
})

test("rank breaks full-coverage ties by length", () => {
  const short = "alpha beta"
  const long = `alpha beta ${"x".repeat(20)}`
  assert.equal(rankCandidates([short, long], contract)[0], long)
})
