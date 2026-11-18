import test from "node:test"
import assert from "node:assert/strict"
import { safePath } from "../plugins/feral-tools/paths.ts"

test("safePath contains traversal", () => {
  assert.equal(safePath("../../etc/passwd", 1), "etc/passwd")
  assert.equal(safePath("/etc/passwd", 2), "etc/passwd")
  assert.equal(safePath("src/../../../root", 3), "src/root")
})

test("safePath rejects repository internals and dotenv", () => {
  assert.equal(safePath(".git/config", 4), "parts/part-4.txt")
  assert.equal(safePath("nested/.git/hooks/pre-commit", 5), "parts/part-5.txt")
  assert.equal(safePath(".env", 6), "parts/part-6.txt")
  assert.equal(safePath("app/.env.local", 7), "parts/part-7.txt")
})

test("safePath keeps normal project paths", () => {
  assert.equal(safePath("src/app.ts", 8), "src/app.ts")
  assert.equal(safePath("docs/readme.md", 9), "docs/readme.md")
})
