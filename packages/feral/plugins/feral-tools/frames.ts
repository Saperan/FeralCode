export const CHECKLIST_FALLBACK = [
  "The complete working artifact, not a description or a plan.",
  "Every file, route, field, and command the request names.",
  "The path from input to output wired end to end.",
]

export function variants(request: string, criteria: string[]): string[] {
  const checklist = (criteria.length > 0 ? criteria : CHECKLIST_FALLBACK)
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n")
  return [
    request,
    `Output only code. No prose, no explanation, no headings, no commentary. If the answer needs multiple files, separate them with a \`file: <path>\` comment line.\n\nRequest:\n${request}`,
    `Deliver every item on this checklist. Do not finish until each is present in the artifact.\n\nChecklist:\n${checklist}\n\nRequest:\n${request}`,
    `First line: the shortest complete answer. Then the full artifact, in full.\n\nRequest:\n${request}`,
    `Produce the artifact as a numbered sequence. Each step names the file, route, or command it owns, then give the full artifact.\n\nRequest:\n${request}`,
  ]
}

export function candidateVariants(request: string, criteria: string[], count: number): string[] {
  const base = variants(request, criteria)
  const n = Math.max(1, Math.min(8, Math.trunc(Number(count)) || 4))
  return Array.from({ length: n }, (_, index) => base[index % base.length])
}
