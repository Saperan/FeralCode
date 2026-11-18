import { missingComponents, type Contract } from "../feral-retry/detector.ts"

export function coverage(text: string, contract: Contract | null): number {
  if (!contract) return 0
  return contract.required.length - missingComponents(text, contract).length
}

export function rankCandidates(texts: string[], contract: Contract | null): string[] {
  return [...texts].sort((a, b) => {
    const byCoverage = coverage(b, contract) - coverage(a, contract)
    return byCoverage !== 0 ? byCoverage : b.trim().length - a.trim().length
  })
}
