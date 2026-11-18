#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { loadContract, missingComponents } from "../src/index.ts"

function usage() {
  console.error("usage: feral-contract check --contract <path> <answer.md> [--json]")
  console.error("       feral-contract validate --contract <path>")
  console.error("       feral-contract stats <attempts.log>")
  process.exit(2)
}

const [command, ...rest] = process.argv.slice(2)
if (command !== "check" && command !== "validate" && command !== "stats") usage()

let contractPath = ""
let answerPath = ""
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
  if (!answerPath) answerPath = arg
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
