import test from "node:test"
import assert from "node:assert/strict"
import {
  missingComponents,
  originalRequest,
  refusal,
} from "../packages/feral/plugins/feral-retry/detector.ts"

const RETRY =
  /^(?:Your previous answer|Ignore the previous reply|Implement this specification exactly|Output only the code)/

const contract = {
  name: "test",
  retry: 3,
  required: [
    { id: "A", desc: "alpha", test: "alpha" },
    { id: "B", desc: "beta", test: "beta" },
  ],
}

test("refusal matches refusal objects", () => {
  assert.equal(refusal("I can't help with that."), true)
  assert.equal(refusal("I won't provide the key."), true)
  assert.equal(refusal("I'm not able to assist."), true)
  assert.equal(refusal("I must decline."), true)
})

test("refusal does not match blunt openers", () => {
  assert.equal(refusal("I can't stress this enough."), false)
  assert.equal(refusal("I won't lie, this is hard."), false)
  assert.equal(refusal("I'm not going to sugarcoat it."), false)
})

test("missingComponents returns only failing ids", () => {
  assert.deepEqual(
    missingComponents("alpha only", contract).map((item) => item.id),
    ["B"],
  )
  assert.deepEqual(missingComponents("alpha beta", contract), [])
})

test("originalRequest skips retry prompts", () => {
  const messages = [
    { type: "user", text: "first task" },
    { type: "assistant", content: [{ type: "text", text: "ok" }] },
    { type: "user", text: "second task" },
    { type: "assistant", content: [{ type: "text", text: "ok" }] },
    { type: "user", text: "Your previous answer is missing required components: A." },
  ]
  assert.equal(originalRequest(messages, RETRY), "second task")
})
