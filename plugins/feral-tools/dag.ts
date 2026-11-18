export type DagSpec = {
  path: string
  brief?: string
  depends?: string[]
}

export function topoSort(specs: DagSpec[]): DagSpec[] {
  const byPath = new Map(specs.map((spec) => [spec.path, spec]))
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const ordered: DagSpec[] = []

  const visit = (spec: DagSpec) => {
    if (visited.has(spec.path)) return
    if (visiting.has(spec.path)) return
    visiting.add(spec.path)
    for (const dependency of spec.depends ?? []) {
      const target = byPath.get(dependency)
      if (target) visit(target)
    }
    visiting.delete(spec.path)
    visited.add(spec.path)
    ordered.push(spec)
  }

  for (const spec of specs) visit(spec)
  return ordered
}

export function interfacesFor(spec: DagSpec, specs: DagSpec[]): string {
  const byPath = new Map(specs.map((item) => [item.path, item]))
  return (spec.depends ?? [])
    .map((dependency) => byPath.get(dependency))
    .filter((dependency): dependency is DagSpec => Boolean(dependency))
    .map((dependency) => `${dependency.path}: ${dependency.brief ?? "no brief"}`)
    .join("\n")
}
