import { Plugin } from "@opencode/plugin"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { lastUserText } from "../../../contract/src/index.ts"
import {
  DEFAULT,
  autoEnter,
  chill,
  coerceState,
  harder,
  injectTox,
  TOXIC_AGENTS,
  parseMode,
  setMode,
  type State,
} from "./tox-logic.ts"

const FILE = join(process.env.HOME ?? "", ".config", "opencode", "tox-state.json")
const TOX = new URL("../../prompts/tox.md", import.meta.url)

function load(): State {
  try {
    return coerceState(JSON.parse(readFileSync(FILE, "utf8")))
  } catch {
    return { ...DEFAULT }
  }
}

function save(state: State): void {
  writeFileSync(FILE, `${JSON.stringify(state, null, 2)}\n`)
}

function toxText(): string {
  try {
    return readFileSync(TOX, "utf8")
  } catch {
    return ""
  }
}

export default Plugin.define({
  id: "feral.tox",
  async setup(ctx) {
    let state = load()
    const prompt = toxText()

    await ctx.command.transform((editor) => {
      editor.add({
        name: "feral-tox",
        description: "Set toxicity mode: normal, toxic, or rp",
        execute: async ({ sessionID, prompt }: any) => {
          const mode = parseMode(String(prompt?.text ?? ""))
          if (!mode) return
          state = setMode(mode)
          save(state)
          await ctx.session.synthetic({
            sessionID,
            text: `feral-tox: ${state.mode}, ladder ${state.ladder}.`,
            description: "feral-tox",
            resume: true,
          })
        },
      })

      editor.add({
        name: "feral-harder",
        description: "Climb the toxicity ladder one step (max 5)",
        execute: async ({ sessionID }: any) => {
          state = harder(state)
          save(state)
          await ctx.session.synthetic({
            sessionID,
            text: `feral-tox: ladder ${state.ladder} (${state.mode}).`,
            description: "feral-harder",
            resume: true,
          })
        },
      })

      editor.add({
        name: "feral-chill",
        description: "Reset toxicity to normal mode, ladder 0",
        execute: async ({ sessionID }: any) => {
          state = chill()
          save(state)
          await ctx.session.synthetic({
            sessionID,
            text: "feral-tox: normal, ladder 0.",
            description: "feral-chill",
            resume: true,
          })
        },
      })
    })

    await ctx.session.hook("context", (event) => {
      const agent = String(event.agent ?? "")
      const forced = TOXIC_AGENTS.has(agent)
      if (agent !== "build-feral" && !forced) return
      if (state.mode === "normal" && !forced) {
        const entered = autoEnter(lastUserText(event.messages as any[]))
        if (entered) {
          state = setMode(entered)
          save(state)
        }
      }
      if (state.mode === "normal" && !forced) return
      if (!prompt) return
      injectTox(event.system as any, prompt)
    })
  },
})
