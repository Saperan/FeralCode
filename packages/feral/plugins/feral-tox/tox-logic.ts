export type Mode = "normal" | "toxic" | "rp"
export type State = { mode: Mode; ladder: number }

export const DEFAULT: State = { mode: "normal", ladder: 0 }

export function parseMode(value: string): Mode | null {
  const v = value.trim().toLowerCase()
  return v === "normal" || v === "toxic" || v === "rp" ? v : null
}

export function coerceState(value: unknown): State {
  const obj = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const mode = parseMode(String(obj.mode ?? "")) ?? "normal"
  const ladder = Math.max(0, Math.min(5, Math.trunc(Number(obj.ladder ?? 0)) || 0))
  return { mode, ladder }
}

export function harder(state: State): State {
  return { ...state, ladder: Math.min(5, state.ladder + 1) }
}

export function chill(): State {
  return { ...DEFAULT }
}

export function setMode(mode: Mode): State {
  return { mode, ladder: mode === "normal" ? 0 : Math.max(1, DEFAULT.ladder) }
}

/** Insert the tox prompt between feral.md and mcp-routing.md in a system part chain. */
export function injectTox(parts: Array<{ type: string; text?: string }>, toxText: string): void {
  if (parts.some((part) => part.text?.includes("<tox priority="))) return
  const part = { type: "text", text: toxText }
  for (let i = 0; i < parts.length; i++) {
    const text = parts[i].text ?? ""
    const end = text.indexOf("</feral>")
    const mcp = text.indexOf("# MCP FIRST")
    if (end >= 0 && mcp > end) {
      const before = text.slice(0, end + "</feral>".length)
      const after = text.slice(end + "</feral>".length)
      parts.splice(i, 1, { type: "text", text: before }, part, { type: "text", text: after })
      return
    }
  }
  const idx = parts.findIndex((part) => part.text?.includes("MCP FIRST") || part.text?.includes("mcp-routing"))
  if (idx >= 0) parts.splice(idx, 0, part)
  else parts.push(part)
}

/** Toxic mode at ladder 4+ pins sampling to 0.9 / 0.95. */
export function sampling(state: State): { temperature: number; topP: number } | null {
  if (state.mode !== "normal" && state.ladder >= 4) return { temperature: 0.9, topP: 0.95 }
  return null
}

const EXPLICIT = /\b(be toxic|say something toxic|talk toxic|go toxic|toxic mode|insult me|roast me|be rude|be nasty|be vile|dish it out|hit back|fire back|rp mode|roleplay mode|act like a jerk)\b/i
const RP = /\b(rp mode|roleplay mode|roleplay as|act like a jerk)\b/i
const INSULTED = /\b(you(?:'re| are) (?:an? )?(?:idiot|moron|stupid|dumb|ugly|fat|useless|worthless|pathetic|loser|jerk|asshole)|shut up|go to hell|fuck you|you suck)\b/i

/** Enter toxic (or rp) on an explicit ask or a direct insult; never auto-clear an existing mode. */
export function autoEnter(text: string): Mode | null {
  if (!EXPLICIT.test(text) && !INSULTED.test(text)) return null
  return RP.test(text) ? "rp" : "toxic"
}
