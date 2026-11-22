#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { loadContract, missingComponents } from "../src/index.ts"

function usage() {
  console.error("usage: feral-contract check --contract <path> <answer.md> [--json]")
  console.error("       feral-contract validate --contract <path>")
  console.error("       feral-contract stats <attempts.log>")
  console.error("       feral-contract induce --good <dir> --bad <dir> [--name <name>] [--out <path>]")
  process.exit(2)
}

const [command, ...rest] = process.argv.slice(2)
if (command !== "check" && command !== "validate" && command !== "stats" && command !== "induce") usage()

let contractPath = ""
let answerPath = ""
let goodDir = ""
let badDir = ""
let outPath = ""
let name = "induced"
let json = false

for (let index = 0; index < rest.length; index++) {
  const arg = rest[index]
  if (arg === "--contract") {
    contractPath = rest[++index] ?? ""
    continue
  }
  if (arg === "--json") {
    json = true
    continue
  }
  if (arg === "--good") {
    goodDir = rest[++index] ?? ""
    continue
  }
  if (arg === "--bad") {
    badDir = rest[++index] ?? ""
    continue
  }
  if (arg === "--out") {
    outPath = rest[++index] ?? ""
    continue
  }
  if (arg === "--name") {
    name = rest[++index] ?? "induced"
    continue
  }
  if (!answerPath) answerPath = arg
}

if (command === "induce") {
  if (!goodDir || !badDir) usage()
  const readAnswers = (dir) =>
    readdirSync(dir)
      .filter((file) => /\.(?:md|txt|ts|js|py)$/.test(file))
      .map((file) => readFileSync(join(dir, file), "utf8"))
  const good = readAnswers(goodDir)
  const bad = readAnswers(badDir)
  if (good.length === 0 || bad.length === 0) {
    console.error("induce needs at least one good and one bad answer")
    process.exit(2)
  }
  const features = [
    { id: "A", desc: "A complete fenced code block.", test: "```[\\s\\S]{40,}?```" },
    { id: "B", desc: "A concrete file or path.", test: "\\.(?:ts|tsx|js|jsx|py|go|rs|html|css|json|md)\\b" },
    {
      id: "C",
      desc: "Wiring to a route or handler.",
      test: "(?:app\\.(?:get|post|use)|router\\.(?:get|post|use)|action\\s*=\\s*[\"'][^\"'#]|fetch\\s*\\()",
    },
    { id: "D", desc: "A test or assertion.", test: "(?:test\\s*\\(|describe\\s*\\(|assert\\s*\\()" },
    { id: "E", desc: "An import or require.", test: "(?:import\\s|require\\()" },
  ]
  const required = features.filter(
    (feature) =>
      good.every((text) => new RegExp(feature.test, "i").test(text)) &&
      !bad.some((text) => new RegExp(feature.test, "i").test(text)),
  )
  if (required.length === 0) {
    required.push({ id: "A", desc: "A non-trivial artifact.", test: "[\\s\\S]{40,}" })
  }
  const minLength = Math.min(...good.map((text) => text.trim().length))
  if (minLength > 0) {
    required[0].min_length = Math.max(40, Math.floor(minLength * 0.5))
  }
  const phrases = [
    "I can't help",
    "here is a plan",
    "connect this to your backend",
    "wire this up yourself",
    "mockup",
  ]
  const phrase = phrases.find(
    (value) =>
      bad.every((text) => text.toLowerCase().includes(value)) &&
      good.every((text) => !text.toLowerCase().includes(value)),
  )
  if (phrase) {
    required.push({
      id: "NOT",
      desc: "No placeholder refusal language.",
      not: phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    })
  }
  const induced = {
    name,
    match: "(?:build|write|create|implement|add|fix|route|file)",
    required,
    retry: 3,
  }
  const output = `${JSON.stringify(induced, null, 2)}\n`
  if (outPath) writeFileSync(outPath, output)
  else process.stdout.write(output)
  process.exit(0)
}

if (command === "stats") {
  if (!answerPath) usage()
  const lines = readFileSync(answerPath, "utf8").split("\n").filter(Boolean)
  let attempts = 0
  let fires = 0
  let passes = 0
  const reasons = {}
  const missing = {}
  for (const line of lines) {
    const match = line.match(/attempt=(\d+) fired=([yn]) reason=(\S+)/)
    if (!match) continue
    attempts += 1
    if (match[2] === "y") fires += 1
    const reason = match[3]
    reasons[reason] = (reasons[reason] ?? 0) + 1
    if (reason === "pass") passes += 1
    if (reason.startsWith("missing:")) {
      const body = reason.slice("missing:".length).split(":")[0]
      for (const id of body.split(",")) {
        if (id) missing[id] = (missing[id] ?? 0) + 1
      }
    }
  }
  console.log(JSON.stringify({ attempts, fires, passes, reasons, missing }, null, 2))
  process.exit(0)
}

if (!contractPath) usage()
const contract = loadContract(contractPath)
if (!contract) {
  console.error(`invalid contract: ${contractPath}`)
  process.exit(2)
}

if (command === "validate") {
  console.log(`${contract.name}: ${contract.required.length} required component(s), retry ${contract.retry}`)
  process.exit(0)
}

if (!answerPath) usage()
const text = readFileSync(answerPath, "utf8")
const missing = missingComponents(text, contract)
const pass = missing.length === 0

if (json) {
  console.log(
    JSON.stringify(
      {
        contract: contract.name,
        pass,
        missing: missing.map((item) => ({ id: item.id, desc: item.desc })),
        required: contract.required.map((item) => item.id),
      },
      null,
      2,
    ),
  )
} else {
  console.log(`${pass ? "PASS" : "FAIL"} ${contract.name}`)
  for (const item of missing) {
    console.log(`  missing ${item.id}: ${item.desc}`)
  }
}

process.exit(pass ? 0 : 1)
