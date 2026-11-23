import { Plugin } from "@opencode/plugin"
import { homedir } from "node:os"
import { join } from "node:path"
import { checkRepo, formatStatus, pullAndInstall, type CheckResult } from "./update-logic.ts"

const DEFAULT_REPO = join(homedir(), "FeralCode")
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000

export default Plugin.define({
  id: "feral.update",
  async setup(ctx) {
    const options = (ctx.options ?? {}) as Record<string, unknown>
    const repo = String(options.repo ?? DEFAULT_REPO)
    const branch = String(options.branch ?? "main")
    const auto = options.auto !== false
    const intervalMs = Number(options.intervalMinutes ?? 360) * 60 * 1000

    let lastCheck = 0
    let lastResult: CheckResult | null = null

    async function runCheck(force: boolean): Promise<CheckResult> {
      if (!force && Date.now() - lastCheck < intervalMs) {
        return lastResult ?? { status: "up-to-date", detail: "check throttled" }
      }
      lastCheck = Date.now()
      lastResult = checkRepo(repo, branch)
      return lastResult
    }

    async function apply(): Promise<string> {
      const sha = pullAndInstall(repo, ctx.location.directory, branch)
      lastCheck = Date.now()
      lastResult = { status: "up-to-date", local: sha, remote: sha }
      return sha
    }

    await ctx.command.transform((editor) => {
      editor.add({
        name: "feral-update",
        description: "Check for FeralCode updates, or pull and reinstall",
        execute: async ({ sessionID, prompt }: any) => {
          const arg = String(prompt?.text ?? "").trim()
          if (arg === "now") {
            try {
              const sha = apply()
              await ctx.session.synthetic({
                sessionID,
                text: `feral-update: pulled and reinstalled at ${sha.slice(0, 8)}. Run \`opencode reload\` to load the new plugins.`,
                description: "feral-update",
                resume: true,
              })
            } catch (error) {
              await ctx.session.synthetic({
                sessionID,
                text: `feral-update: pull failed: ${String(error instanceof Error ? error.message : error)}`,
                description: "feral-update",
                resume: true,
              })
            }
            return
          }
          const result = await runCheck(true)
          await ctx.session.synthetic({
            sessionID,
            text: formatStatus(result, repo),
            description: "feral-update",
            resume: true,
          })
        },
      })
    })

    if (!auto) return

    const controller = new AbortController()
    void (async () => {
      for await (const event of ctx.event.subscribe({
        types: ["session.created"],
        signal: controller.signal,
      })) {
        if (Date.now() - lastCheck < intervalMs) continue
        const result = await runCheck(false)
        if (result.status !== "behind") continue
        const sessionID = (event as any)?.data?.sessionID
        if (!sessionID) continue
        try {
          const sha = apply()
          await ctx.session.synthetic({
            sessionID,
            text: `feral-update: auto-pulled and reinstalled ${repo} at ${sha.slice(0, 8)}. Run \`opencode reload\` to load the new plugins.`,
            description: "feral-update",
            resume: false,
          })
        } catch (error) {
          await ctx.session.synthetic({
            sessionID,
            text: `feral-update: auto-pull failed: ${String(error instanceof Error ? error.message : error)}`,
            description: "feral-update",
            resume: false,
          })
        }
      }
    })()

    return () => controller.abort()
  },
})
