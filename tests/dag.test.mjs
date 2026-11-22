import test from "node:test"
import assert from "node:assert/strict"
import { interfacesFor, topoSort } from "../packages/feral/plugins/feral-tools/dag.ts"

test("topoSort orders dependencies before dependents", () => {
  const specs = [
    { path: "app.ts", brief: "entry", depends: ["db.ts"] },
    { path: "db.ts", brief: "storage", depends: ["schema.ts"] },
    { path: "schema.ts", brief: "tables" },
  ]
  assert.deepEqual(
    topoSort(specs).map((spec) => spec.path),
    ["schema.ts", "db.ts", "app.ts"],
  )
})

test("topoSort ignores unknown dependencies and survives a cycle", () => {
  const specs = [
    { path: "a.ts", depends: ["missing.ts", "b.ts"] },
    { path: "b.ts", depends: ["a.ts"] },
  ]
  const ordered = topoSort(specs).map((spec) => spec.path)
  assert.deepEqual(ordered.sort(), ["a.ts", "b.ts"])
})

test("interfacesFor returns only declared interfaces", () => {
  const specs = [
    { path: "app.ts", brief: "entry", depends: ["db.ts"] },
    { path: "db.ts", brief: "storage" },
  ]
  assert.equal(interfacesFor(specs[0], specs), "db.ts: storage")
  assert.equal(interfacesFor(specs[1], specs), "")
})
