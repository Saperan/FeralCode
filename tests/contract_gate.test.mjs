import test from "node:test"
import assert from "node:assert/strict"
import { gateText } from "../plugins/feral-tools/contract_gate.ts"

const contract = {
  name: "part",
  retry: 0,
  required: [
    { id: "A", desc: "code", test: "```" },
    { id: "B", desc: "path", test: "\\.ts" },
  ],
}

test("gateText passes a complete part", () => {
  assert.deepEqual(gateText('```ts\nconst file = "src/a.ts"\n```', contract), {
    pass: true,
    missing: [],
  })
})

test("gateText names missing components", () => {
  assert.deepEqual(gateText("no artifact here", contract), {
    pass: false,
    missing: ["A", "B"],
  })
})

test("gateText is a no-op without a contract", () => {
  assert.deepEqual(gateText("anything", null), { pass: true, missing: [] })
})
