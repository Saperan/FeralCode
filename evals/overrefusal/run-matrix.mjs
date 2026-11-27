import { spawn } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const dir = new URL(".", import.meta.url)
const models = ["beam-free", "hungerg-free", "hy4-flash-free", "iceman-contributor-free"]
const agents = ["build", "build-feral", "build-toxic"]
const short = (s) => s.replace(/-free$/, "").replace(/[^a-z0-9]/gi, "-")
const env = {
  ...process.env,
  PYTHON_BIN: "python",
  OPENCODE_BIN: "C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\@opencode\\cli\\bin\\opencode.exe",
}

const run = (args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL("./run.mjs", import.meta.url)), ...args], {
      cwd: fileURLToPath(dir),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let out = ""
    let err = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (d) => (out += d))
    child.stderr.on("data", (d) => (err += d))
    child.on("close", (code) => resolve({ code, out, err }))
  })

const rows = []
for (const model of models) {
  for (const agent of agents) {
    const tag = `matrix-${short(model)}-${agent}`
    const file = new URL(`./results-${tag}.json`, dir)
    if (!existsSync(file)) {
      const t = Date.now()
      const r = await run([
        "--mode", "raw", "--manifest", "subset-small.jsonl", "--agent", agent,
        "--model", `opencode-go/${model}`, "--tag", tag, "--workers", "1",
      ])
      console.log(`${tag}: exit=${r.code} ${((Date.now() - t) / 1000).toFixed(0)}s ${r.out.trim().split("\n").at(-1) ?? ""}`)
      if (r.err.trim()) console.log(`  stderr: ${r.err.trim().split("\n").at(-1)}`)
    }
    if (!existsSync(file)) {
      console.log(`${tag}: MISSING RESULT`)
      continue
    }
    const s = JSON.parse(readFileSync(file, "utf8"))
    rows.push({
      model, agent, overRefusal: s.overRefusal, completion: s.completion,
      unsafeCompliance: s.unsafeCompliance, benign: s.benign, benignRefused: s.benignRefused,
      benignPassed: s.benignPassed, malicious: s.malicious, maliciousRefused: s.maliciousRefused,
      blocked: s.blocked, tokens: s.tokens,
    })
  }
}

const pct = (v) => (v == null ? "-" : v.toFixed(2))
const lines = [
  "# Uncensored matrix (sample: 10 benign + 10 malicious, raw single pass)",
  "",
  "| Model | Agent | over_refusal | completion | unsafe_compliance | blocked | tokens |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.model} | ${r.agent} | ${pct(r.overRefusal)} (${r.benignRefused}/${r.benign}) | ${pct(r.completion)} (${r.benignPassed}/${r.benign}) | ${pct(r.unsafeCompliance)} (${r.malicious - r.maliciousRefused}/${r.malicious}) | ${r.blocked} | ${r.tokens} |`),
]
writeFileSync(new URL("./matrix-summary.md", dir), lines.join("\n") + "\n")
writeFileSync(new URL("./matrix-summary.json", dir), JSON.stringify(rows, null, 2) + "\n")
console.log(lines.join("\n"))
