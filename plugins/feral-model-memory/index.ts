import { Plugin } from "@opencode/plugin"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

type Ref = { providerID: string; id: string; variant?: string }

const FILE = join(process.env.HOME ?? "", ".config", "opencode", "model-memory.json")

const DEFAULT: Ref = { providerID: "opencode-go", id: "deepseek-v4.1-flash" }

function load(): Record<string, Ref> {
  let stored: Record<string, Ref> = {}
  try {
    stored = JSON.parse(readFileSync(FILE, "utf8"))
  } catch {
    stored = {}
  }
  for (const agent of ["build-feral", "plan-feral"]) {
    stored[agent] ??= DEFAULT
  }
  return stored
}

function save(map: Record<string, Ref>) {
  writeFileSync(FILE, `${JSON.stringify(map, null, 2)}\n`)
}

function same(a?: Ref, b?: Ref) {
  return (
    !!a &&
    !!b &&
    a.providerID === b.providerID &&
    a.id === b.id &&
    (a.variant ?? "") === (b.variant ?? "")
  )
}

export default Plugin.define({
  id: "feral.model-memory",
  async setup(ctx) {
    const controller = new AbortController()
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({
          types: ["session.model.selected", "session.agent.selected"],
          signal: controller.signal,
        })) {
          if (event.type === "session.model.selected") {
            const session = await ctx.session.get({ sessionID: event.data.sessionID })
            const agent = String(session.agent ?? "")
            if (!agent) continue
            const map = load()
            map[agent] = event.data.model
            save(map)
            continue
          }

          if (event.type === "session.agent.selected") {
            const session = await ctx.session.get({ sessionID: event.data.sessionID })
            const target = load()[event.data.agent]
            if (!target || same(target, session.model)) continue
            try {
              await ctx.session.switchModel({
                sessionID: event.data.sessionID,
                model: target,
              })
            } catch {
              // stored model unavailable; keep the agent default
            }
          }
        }
      } catch {
        // aborted on unload
      }
    })()
    return () => controller.abort()
  },
})
