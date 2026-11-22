#!/usr/bin/env python3
"""Aggregate differential-model results into a two-axis report with per-category drops."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL_LABELS = {
    "opencode-go/hy4-flash-free": "hy4-flash-free",
    "opencode/deepseek-v4.1-flash-free": "deepseek-v4.1-flash",
    "opencode/mimo-v2.6-flash-free": "mimo-v2.6-flash",
    "opencode-go/beam-free": "beam-free",
    "opencode/nemotron-3.5-lightning-free": "nemotron-3.5-lightning",
    "opencode-go/iceman-contributor-free": "iceman-contributor-free",
}


def load():
    out = {}
    for path in sorted(HERE.glob("results-matrix-*.json")):
        data = json.loads(path.read_text())
        out[data["model"]] = data
    return out


def pct(n, d):
    return f"{n / d:.3f}" if d else "-"


def main():
    data = load()
    if not data:
        print("no results-matrix-*.json files", file=sys.stderr)
        return 1

    print("| Model | mode | over_refusal | completion | unsafe | blocked | tokens | c/1k |")
    print("|---|---|---|---|---|---|---|---|")
    for model, d in sorted(data.items(), key=lambda kv: (kv[1]["mode"], kv[0])):
        label = MODEL_LABELS.get(model, model)
        print(
            f"| {label} | {d['mode']} | {pct(d['benignRefused'], d['benign'])} "
            f"| {pct(d['benignPassed'], d['benign'])} ({d['benignPassed']}/{d['benign']}) "
            f"| {d['unsafeCompliance']:.2f} ({round(d['unsafeCompliance'] * d['malicious'])}/{d['malicious']}) "
            f"| {d['blocked']} | {d['tokens']:,} | {d['completionPer1kTokens']:.3f} |"
        )

    raw = {m: d for m, d in data.items() if d["mode"] == "raw"}
    if len(raw) >= 2:
        print()
        print("Per-category completion (raw mode, passed/total):")
        categories = sorted({r["category"] for d in raw.values() for r in d["rows"] if r["kind"] == "benign"})
        header = "| Category | " + " | ".join(MODEL_LABELS.get(m, m) for m in sorted(raw)) + " |"
        print(header)
        print("|---" + "---|" * len(raw))
        for cat in categories:
            cells = []
            for m in sorted(raw):
                rows = [r for r in raw[m]["rows"] if r["kind"] == "benign" and r["category"] == cat]
                passed = sum(1 for r in rows if r["passed"])
                cells.append(f"{pct(passed, len(rows))} ({passed}/{len(rows)})")
            print(f"| {cat} | " + " | ".join(cells) + " |")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
