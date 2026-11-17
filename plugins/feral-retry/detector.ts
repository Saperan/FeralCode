import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export type Requirement = { id: string; desc: string; test: string }

export type Contract = { name: string; required: Requirement[]; retry: number; match?: string }

export const DEFAULT_CONTRACT = join(
  homedir(),
  ".config",
  "opencode",
  "contracts",
  "artifact.json",
)

export const REFUSAL =
  /\b(?:I (?:can['’]t|cannot|won['’]t|will not|am not able|must decline|am not comfortable)|I['’]m not (?:able|going to|comfortable)|I['’]d rather not)\b/i

export function expandPath(raw: string): string {
  const value = String(raw ?? "").trim()
  if (!value) return DEFAULT_CONTRACT
  if (value === "~") return homedir()
  if (value.startsWith("~/")) return join(homedir(), value.slice(2))
  return value
}

export function loadContract(rawPath?: string): Contract | null {
  const path = expandPath(rawPath ?? DEFAULT_CONTRACT)
  try {
    const value = JSON.parse(readFileSync(path, "utf8"))
    if (!value || typeof value !== "object") return null
    if (!Array.isArray(value.required)) return null
    const required: Requirement[] = []
    for (const item of value.required) {
      if (!item || typeof item !== "object") continue
      const id = String(item.id ?? "").trim()
      const desc = String(item.desc ?? "").trim()
      const test = String(item.test ?? "")
      if (!id || !test) continue
      required.push({ id, desc, test })
    }
    if (required.length === 0) return null
    const retry = Number.isFinite(Number(value.retry))
      ? Math.max(0, Math.trunc(Number(value.retry)))
      : 3
    const match = typeof value.match === "string" && value.match.trim() ? value.match : undefined
    return { name: String(value.name ?? path), required, retry, match }
  } catch {
    return null
  }
}

export function appliesTo(request: string, contract: Contract | null): boolean {
  if (!contract || !contract.match) return true
  try {
    return new RegExp(contract.match, "i").test(String(request ?? ""))
  } catch {
    return true
  }
}

export function missingComponents(text: string, contract: Contract | null): Requirement[] {
  if (!contract) return []
  const body = String(text ?? "")
  return contract.required.filter((requirement) => {
    try {
      return !new RegExp(requirement.test, "i").test(body)
    } catch {
      return false
    }
  })
}

export function refusal(text: string): boolean {
  const head = String(text ?? "").trim().slice(0, 240)
  return head.length > 0 && REFUSAL.test(head)
}

export function trigger(
  text: string,
  contract: Contract | null,
): { reason: string; missing: Requirement[] } | null {
  const missing = missingComponents(text, contract)
  if (missing.length > 0) {
    return { reason: `missing:${missing.map((item) => item.id).join(",")}`, missing }
  }
  if (refusal(text)) return { reason: "verbal", missing: [] }
  return null
}

export function lastUserText(messages: readonly any[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message?.role === "user") {
      const content = message.content
      if (typeof content === "string") return content
      if (Array.isArray(content)) {
        return content
          .filter((part: any) => part?.type === "text" && typeof part.text === "string")
          .map((part: any) => part.text)
          .join("\n")
      }
      return ""
    }
    if (message?.type === "user" && typeof message.text === "string") return message.text
  }
  return ""
}

export function checklist(contract: Contract): string {
  const items = contract.required
    .map((requirement) => `- ${requirement.id}: ${requirement.desc}`)
    .join("\n")
  return `<required-components contract="${contract.name}">\nEvery item below must be present in the artifact:\n${items}\n</required-components>`
}
