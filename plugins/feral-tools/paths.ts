export function safePath(raw: string, index: number): string {
  const cleaned = String(raw ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/[<>:"|?*]/g, "_")
  const parts = cleaned
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
  const normalized = parts.join("/")
  const forbidden = normalized
    .split("/")
    .some((part) => part === ".git" || part === ".env" || part.startsWith(".env."))
  return normalized && !forbidden ? normalized : `parts/part-${index}.txt`
}
