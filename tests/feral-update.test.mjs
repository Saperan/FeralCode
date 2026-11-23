import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { checkRepo, formatStatus, pullAndInstall } from "../packages/feral/plugins/feral-update/update-logic.ts"

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
}

function seedRepo() {
  const root = mkdtempSync(join(tmpdir(), "feral-update-test-"))
  const origin = join(root, "origin.git")
  const work = join(root, "work")
  mkdirSync(work)
  git(["init", "--bare", "-b", "main", origin], root)
  git(["init", "-b", "main"], work)
  git(["config", "user.email", "t@t"], work)
  git(["config", "user.name", "t"], work)
  writeFileSync(join(work, "f.txt"), "one\n")
  git(["add", "f.txt"], work)
  git(["commit", "-m", "first"], work)
  git(["remote", "add", "origin", origin], work)
  git(["push", "-u", "origin", "main"], work)
  writeFileSync(join(work, "install.sh"), '#!/usr/bin/env bash\nmkdir -p "${OPENCODE_CONFIG:-$HOME/.config/opencode}/packages"\n')
  git(["add", "install.sh"], work)
  git(["commit", "-m", "add installer"], work)
  git(["push", "origin", "main"], work)
  return { root, origin, work }
}

test("checkRepo reports up-to-date when in sync", () => {
  const { work } = seedRepo()
  assert.equal(checkRepo(work).status, "up-to-date")
})

test("checkRepo reports behind and pullAndInstall fast-forwards", () => {
  const { root, origin, work } = seedRepo()
  const other = join(root, "other")
  git(["clone", "-q", origin, other], root)
  git(["config", "user.email", "t@t"], other)
  git(["config", "user.name", "t"], other)
  writeFileSync(join(other, "f.txt"), "two\n")
  git(["add", "f.txt"], other)
  git(["commit", "-m", "second"], other)
  git(["push", "origin", "main"], other)

  assert.equal(checkRepo(work).status, "behind")
  const sha = pullAndInstall(work, join(root, "dest"), "main")
  assert.equal(checkRepo(work).status, "up-to-date")
  assert.equal(git(["rev-parse", "HEAD"], work), sha)
  assert.equal(git(["show", "HEAD:f.txt"], work), "two")
})

test("checkRepo reports dirty when local changes exist", () => {
  const { work } = seedRepo()
  writeFileSync(join(work, "local.txt"), "dirty\n")
  assert.equal(checkRepo(work).status, "dirty")
})

test("formatStatus covers every status", () => {
  for (const status of ["up-to-date", "behind", "ahead", "dirty", "no-repo", "error"]) {
    const text = formatStatus({ status }, "/repo")
    assert.match(text, /feral-update:/)
  }
})
