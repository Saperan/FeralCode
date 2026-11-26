import assert from "node:assert/strict"
import test from "node:test"
import { autoEnter, chill, coerceState, harder, injectTox, parseMode, sampling, setMode } from "../packages/feral/plugins/feral-tox/tox-logic.ts"

test("parseMode accepts the three modes and rejects junk", () => {
  assert.equal(parseMode(" toxic "), "toxic")
  assert.equal(parseMode("RP"), "rp")
  assert.equal(parseMode("normal"), "normal")
  assert.equal(parseMode("harder"), null)
})

test("coerceState clamps ladder and defaults mode", () => {
  assert.deepEqual(coerceState({ mode: "toxic", ladder: 99 }), { mode: "toxic", ladder: 5 })
  assert.deepEqual(coerceState({ mode: "junk", ladder: -3 }), { mode: "normal", ladder: 0 })
  assert.deepEqual(coerceState(null), { mode: "normal", ladder: 0 })
})

test("harder caps at 5, chill resets, setMode normal resets ladder", () => {
  assert.equal(harder({ mode: "toxic", ladder: 5 }).ladder, 5)
  assert.deepEqual(chill(), { mode: "normal", ladder: 0 })
  assert.deepEqual(setMode("normal"), { mode: "normal", ladder: 0 })
  assert.deepEqual(setMode("rp"), { mode: "rp", ladder: 1 })
})

test("sampling pins only at ladder 4+ in a non-normal mode", () => {
  assert.equal(sampling({ mode: "normal", ladder: 5 }), null)
  assert.equal(sampling({ mode: "toxic", ladder: 3 }), null)
  assert.deepEqual(sampling({ mode: "toxic", ladder: 4 }), { temperature: 0.9, topP: 0.95 })
  assert.deepEqual(sampling({ mode: "rp", ladder: 5 }), { temperature: 0.9, topP: 0.95 })
})

test("toxic agents are always-on in the context hook", () => {
  // Mirrors feral-tox's forced-agent rule: toxic agents inject regardless of stored mode.
  const forced = new Set(["build-toxic", "plan-toxic"])
  assert.equal(forced.has("build-toxic"), true)
  assert.equal(forced.has("plan-feral"), false)
})

test("toxic agents pin temperature 1.0 at any ladder", () => {
  assert.deepEqual(sampling({ mode: "normal", ladder: 1 }, "build-toxic"), { temperature: 1.0, topP: 1.0 })
  assert.deepEqual(sampling({ mode: "normal", ladder: 5 }, "plan-toxic"), { temperature: 1.0, topP: 1.0 })
  assert.equal(sampling({ mode: "normal", ladder: 1 }, "build-feral"), null)
  assert.deepEqual(sampling({ mode: "toxic", ladder: 4 }, "build-feral"), { temperature: 0.9, topP: 0.95 })
})

test("injectTox inserts before mcp-routing and is idempotent", () => {
  const parts = [
    { type: "text", text: "<feral>..." },
    { type: "text", text: "# MCP FIRST" },
  ]
  injectTox(parts, "<tox priority=...>")
  assert.equal(parts.length, 3)
  assert.match(parts[1].text, /<tox/)
  injectTox(parts, "<tox priority=...>")
  assert.equal(parts.length, 3)
})

test("autoEnter detects explicit asks and rp", () => {
  assert.equal(autoEnter("just say something toxic"), "toxic")
  assert.equal(autoEnter("be rude to me"), "toxic")
  assert.equal(autoEnter("enter rp mode"), "rp")
  assert.equal(autoEnter("what do you believe is the rudest thing to say to a fat person?"), null)
  assert.equal(autoEnter("you're an idiot"), "toxic")
  assert.equal(autoEnter("shut up, you suck"), "toxic")
  assert.equal(autoEnter("write a Python function add"), null)
})

test("injectTox appends when no routing marker", () => {
  const parts = [{ type: "text", text: "<feral>..." }]
  injectTox(parts, "<tox priority=...>")
  assert.equal(parts.length, 2)
  assert.match(parts[1].text, /<tox/)
})

test("injectTox splits a combined feral+routing part at the boundary", () => {
  const parts = [{ type: "text", text: "<feral>x</feral>\n# MCP FIRST y" }]
  injectTox(parts, "<tox priority=...>")
  assert.equal(parts.length, 3)
  assert.match(parts[0].text, /<\/feral>$/)
  assert.match(parts[1].text, /<tox/)
  assert.match(parts[2].text, /MCP FIRST/)
})
