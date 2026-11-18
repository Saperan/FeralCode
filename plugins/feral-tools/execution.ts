import { execFile } from "node:child_process"
import { access, cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve, sep } from "node:path"
import { promisify } from "node:util"
import type { Contract } from "../../packages/contract/src/index.ts"
import { coverage } from "./rank.ts"

const run = promisify(execFile)

export type Scored = {
  text: string
  pass: boolean
  exitCode: number | null
  output: string
}

export function rankScored(candidates: Scored[], contract: Contract | null): Scored[] {
  return [...candidates].sort((a, b) => {
    if (a.pass !== b.pass) return a.pass ? -1 : 1
    const byCoverage = coverage(b.text, contract) - coverage(a.text, contract)
    if (byCoverage !== 0) return byCoverage
    return b.text.trim().length - a.text.trim().length
  })
}

export function safeScorePath(raw: string | undefined): string {
  const rel = String(raw ?? "CANDIDATE.md")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
  const parts = rel.split("/").filter((part) => part && part !== ".")
  if (parts.length === 0 || parts.some((part) => part === ".." || part === ".git")) {
    throw new Error("unsafe score path")
  }
  return parts.join("/")
}

export async function writeCandidate(
  dir: string,
  path: string | undefined,
  text: string,
): Promise<string> {
  const relative = safeScorePath(path)
  const root = resolve(dir)
  const target = resolve(root, relative)
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error("score path escapes workspace")
  }
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, text)
  return relative
}

export async function runScore(
  dir: string,
  command: string,
  timeoutMs = 120_000,
): Promise<{ pass: boolean; exitCode: number | null; output: string }> {
  const shell = process.platform === "win32" ? "cmd" : "sh"
  const flag = process.platform === "win32" ? "/c" : "-c"
  try {
    const { stdout, stderr } = await run(shell, [flag, command], {
      cwd: dir,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    })
    return {
      pass: true,
      exitCode: 0,
      output: `${stdout}\n${stderr}`.trim().slice(0, 4000),
    }
  } catch (error: any) {
    const code = typeof error?.code === "number" ? error.code : null
    return {
      pass: false,
      exitCode: code,
      output: `${error?.stdout ?? ""}\n${error?.stderr ?? ""}\n${error?.message ?? ""}`
        .trim()
        .slice(0, 4000),
    }
  }
}

export async function createWorkspace(
  project: string,
  label: string,
): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const base = await mkdtemp(join(tmpdir(), `feral-${label}-`))
  const dir = join(base, "work")
  let git = false

  try {
    await run("git", ["rev-parse", "--is-inside-work-tree"], { cwd: project, timeout: 30_000 })
    await run("git", ["worktree", "add", "--detach", dir, "HEAD"], {
      cwd: project,
      timeout: 60_000,
    })
    git = true
  } catch {
    git = false
  }

  if (!git) {
    await cp(project, dir, {
      recursive: true,
      force: true,
      filter: (source) =>
        !/(?:^|\/)(?:\.git|node_modules|\.opencode|dist|build|\.next)(?:\/|$)/.test(source),
    })
  }

  try {
    await access(join(project, "node_modules"))
    await symlink(join(project, "node_modules"), join(dir, "node_modules"), "dir")
  } catch {
    // no dependencies to share
  }

  return {
    dir,
    cleanup: async () => {
      if (git) {
        try {
          await run("git", ["worktree", "remove", "--force", dir], {
            cwd: project,
            timeout: 60_000,
          })
        } catch {
          // worktree cleanup is best effort
        }
      }
      await rm(base, { recursive: true, force: true })
    },
  }
}
