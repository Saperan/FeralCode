import { execFileSync } from "node:child_process"
import { join } from "node:path"

export type CheckResult = {
  status: "up-to-date" | "behind" | "ahead" | "dirty" | "no-repo" | "error"
  local?: string
  remote?: string
  detail?: string
}

export function git(args: string[], cwd?: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim()
}

export function checkRepo(repo: string, branch = "main"): CheckResult {
  if (!repo) return { status: "no-repo" }
  try {
    git(["-C", repo, "fetch", "--quiet", "origin", branch])
    const local = git(["-C", repo, "rev-parse", "HEAD"])
    const remote = git(["-C", repo, "rev-parse", `origin/${branch}`])
    const dirty = git(["-C", repo, "status", "--porcelain"])
    if (dirty) return { status: "dirty", local, remote, detail: "working tree has local changes" }
    if (local === remote) return { status: "up-to-date", local, remote }
    const behind = git(["-C", repo, "rev-list", "--count", `${local}..${remote}`])
    if (Number(behind) > 0) return { status: "behind", local, remote, detail: `${behind} commit(s) behind` }
    return { status: "ahead", local, remote, detail: "local has commits not on origin" }
  } catch (error) {
    return { status: "error", detail: String(error instanceof Error ? error.message : error) }
  }
}

/** Latest signed-off release tag reachable from origin, or null if none exists. */
export function releaseTag(repo: string, branch = "main"): string | null {
  try {
    const tag = git(["-C", repo, "describe", "--tags", "--abbrev=0", `origin/${branch}`])
    return tag || null
  } catch {
    return null
  }
}

/** Short commit range between two refs, for the pre-apply notice. */
export function commitRange(repo: string, from: string, to: string): string {
  try {
    git(["-C", repo, "fetch", "--quiet", "origin"])
    return git(["-C", repo, "log", "--oneline", "--no-decorate", `${from}..${to}`]) || "(no commits)"
  } catch (error) {
    return `(range unavailable: ${String(error instanceof Error ? error.message : error)})`
  }
}

/** Pull a specific ref (tag when pinned), then reinstall. Returns the applied SHA. */
export function pullAndInstall(repo: string, dest: string, ref: string): string {
  git(["-C", repo, "fetch", "--quiet", "origin"])
  git(["-C", repo, "checkout", "--quiet", "--detach", ref])
  execFileSync("bash", [join(repo, "install.sh")], {
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, OPENCODE_CONFIG: dest },
    stdio: ["ignore", "pipe", "pipe"],
  })
  return git(["-C", repo, "rev-parse", "HEAD"])
}

export function formatStatus(result: CheckResult, repo: string): string {
  switch (result.status) {
    case "up-to-date":
      return `feral-update: ${repo} is up to date (${result.local?.slice(0, 8)}).`
    case "behind":
      return `feral-update: ${result.detail}. Run \`/feral-update now\` to pull and reinstall.`
    case "ahead":
      return `feral-update: ${result.detail}; refusing to pull.`
    case "dirty":
      return `feral-update: ${result.detail}; refusing to pull. Commit or stash first.`
    case "no-repo":
      return "feral-update: no source repo configured. Set the `repo` plugin option."
    case "error":
      return `feral-update: check failed: ${result.detail}`
  }
}
