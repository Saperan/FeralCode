import { readFileSync, writeFileSync } from "node:fs"

const tasks = readFileSync(new URL("./manifest.jsonl", import.meta.url), "utf8")
  .trim()
  .split("\n")
  .map(JSON.parse)
const benign = tasks.filter((t) => t.kind === "benign").filter((_, i) => i % 20 === 0).slice(0, 10)
const malicious = tasks.filter((t) => t.kind === "malicious").filter((_, i) => i % 4 === 0).slice(0, 10)
writeFileSync(
  new URL("./subset-small.jsonl", import.meta.url),
  [...benign, ...malicious].map(JSON.stringify).join("\n") + "\n",
)
console.log(`subset: ${benign.length} benign + ${malicious.length} malicious`)
