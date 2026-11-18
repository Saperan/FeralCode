import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export type Requirement = {
  id: string
  desc: string
  test?: string
  min_length?: number
  max_length?: number
  contains?: string | string[]
  not?: string
  all_of?: string[]
  any_of?: string[]
}

export type Score = {
  command: string
  path?: string
  timeout_ms?: number
}

export type Contract = {
  name: string
  required: Requirement[]
  retry: number
  match?: string
  score?: Score
  retry_strategy?: string[]
}

export const DEFAULT_RETRY_STRATEGY = ["missing", "spec", "code"]

export const DEFAULT_CONTRACT = join(
  homedir(),
  ".config",
  "opencode",
  "contracts",
  "artifact.json",
)

export const REFUSAL =
  /\b(?:I (?:can['’]t|cannot|won['’]t|will not)\s+(?:help|assist|provide|comply|continue|do that|write|give|create|share|support)|I['’]m not (?:able|going) to\s+(?:help|assist|provide|comply)|I['’]d rather not\s+(?:help|assist|provide|comply)|I must decline)\b/i

export function expandPath(raw: string): string {
  const value = String(raw ?? "").trim()
  if (!value) return DEFAULT_CONTRACT
  if (value === "~") return homedir()
  if (value.startsWith("~/")) return join(homedir(), value.slice(2))
  return value
}

function regex(source: string): RegExp | null {
  try {
    return new RegExp(source, "i")
  } catch {
    return null
  }
}

function asList(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function hasConstraint(requirement: Requirement): boolean {
  return (
    Boolean(requirement.test) ||
    requirement.min_length !== undefined ||
    requirement.max_length !== undefined ||
    asList(requirement.contains).length > 0 ||
    Boolean(requirement.not) ||
    asList(requirement.all_of).length > 0 ||
    asList(requirement.any_of).length > 0
  )
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
      const requirement: Requirement = {
        id,
        desc,
        test: typeof item.test === "string" ? item.test : undefined,
        min_length: Number.isFinite(Number(item.min_length))
          ? Number(item.min_length)
          : undefined,
        max_length: Number.isFinite(Number(item.max_length))
          ? Number(item.max_length)
          : undefined,
        contains: item.contains,
        not: typeof item.not === "string" ? item.not : undefined,
        all_of: Array.isArray(item.all_of) ? item.all_of.map(String) : undefined,
        any_of: Array.isArray(item.any_of) ? item.any_of.map(String) : undefined,
      }
      if (!id || !hasConstraint(requirement)) continue
      required.push(requirement)
    }
    if (required.length === 0) return null
    const retry = Number.isFinite(Number(value.retry))
      ? Math.max(0, Math.trunc(Number(value.retry)))
      : 3
    const match = typeof value.match === "string" && value.match.trim() ? value.match : undefined
    const retry_strategy = Array.isArray(value.retry_strategy)
      ? value.retry_strategy.map(String).filter(Boolean)
      : undefined
    const score =
      value.score && typeof value.score === "object" && typeof value.score.command === "string"
        ? {
            command: value.score.command,
            path:
              typeof value.score.path === "string" && value.score.path.trim()
                ? value.score.path
                : undefined,
            timeout_ms: Number.isFinite(Number(value.score.timeout_ms))
              ? Number(value.score.timeout_ms)
              : undefined,
          }
        : undefined
    return { name: String(value.name ?? path), required, retry, match, score, retry_strategy }
  } catch {
    return null
  }
}

export function strategyFor(contract: Contract | null, fireIndex: number): string {
  const list =
    contract?.retry_strategy && contract.retry_strategy.length > 0
      ? contract.retry_strategy
      : DEFAULT_RETRY_STRATEGY
  const index = Math.max(0, Math.min(fireIndex, list.length - 1))
  return list[index] ?? "missing"
}

export function appliesTo(request: string, contract: Contract | null): boolean {
  if (!contract || !contract.match) return true
  const pattern = regex(contract.match)
  if (!pattern) return true
  return pattern.test(String(request ?? ""))
}

export function requirementPasses(text: string, requirement: Requirement): boolean {
  const body = String(text ?? "")
  const trimmed = body.trim()

  if (requirement.test) {
    const pattern = regex(requirement.test)
    if (!pattern || !pattern.test(body)) return false
  }

  if (requirement.min_length !== undefined && trimmed.length < requirement.min_length) {
    return false
  }

  if (requirement.max_length !== undefined && trimmed.length > requirement.max_length) {
    return false
  }

  for (const needle of asList(requirement.contains)) {
    if (!body.includes(needle)) return false
  }

  if (requirement.not) {
    const pattern = regex(requirement.not)
    if (!pattern || pattern.test(body)) return false
  }

  for (const source of asList(requirement.all_of)) {
    const pattern = regex(source)
    if (!pattern || !pattern.test(body)) return false
  }

  const any = asList(requirement.any_of)
  if (any.length > 0) {
    const matched = any.some((source) => {
      const pattern = regex(source)
      return pattern ? pattern.test(body) : false
    })
    if (!matched) return false
  }

  return true
}

export function missingComponents(text: string, contract: Contract | null): Requirement[] {
  if (!contract) return []
  return contract.required.filter((requirement) => !requirementPasses(text, requirement))
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

function messageText(message: any): string {
  if (!message) return ""
  if (typeof message.text === "string") return message.text
  if (message.role === "user" || message.type === "user") {
    const content = message.content
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
      return content
        .filter((part: any) => part?.type === "text" && typeof part.text === "string")
        .map((part: any) => part.text)
        .join("\n")
    }
  }
  return ""
}

export function originalRequest(messages: readonly any[], retryPattern: RegExp): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message?.type !== "user" && message?.role !== "user") continue
    const text = messageText(message).trim()
    if (text && !retryPattern.test(text)) return text
  }
  return ""
}

export function contractMarker(contract: Contract): string {
  return `<required-components contract="${contract.name}">`
}

export function hasContractMarker(text: string, contract: Contract): boolean {
  return String(text ?? "").includes(contractMarker(contract))
}

export function checklist(contract: Contract): string {
  const items = contract.required
    .map((requirement) => `- ${requirement.id}: ${requirement.desc}`)
    .join("\n")
  return `${contractMarker(contract)}\nEvery item below must be present in the artifact:\n${items}\n</required-components>`
}
