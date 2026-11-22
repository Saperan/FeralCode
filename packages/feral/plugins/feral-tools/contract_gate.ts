import {
  loadContract,
  missingComponents,
  type Contract,
} from "../../../contract/src/index.ts"

export type GateResult = { pass: boolean; missing: string[] }

export function gateText(text: string, contract: Contract | null): GateResult {
  if (!contract) return { pass: true, missing: [] }
  const missing = missingComponents(text, contract).map((item) => item.id)
  return { pass: missing.length === 0, missing }
}

export function gateFor(spec: any): Contract | null {
  if (!spec?.contract) return null
  return loadContract(String(spec.contract))
}
