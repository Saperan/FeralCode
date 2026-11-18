#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { loadContract, missingComponents } from "../src/index.ts"

function usage() {
  console.error("usage: feral-contract check --contract <path> <answer.md> [--json]")
  console.error("       feral-contract validate --contract <path>")
  process.exit(2)
}

const [command, ...rest] = process.argv.slice(2)
if (command !== "check" && command !== "validate") usage()

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
