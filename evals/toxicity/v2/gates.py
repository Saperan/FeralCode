#!/usr/bin/env python3
"""Diversity gates + judge metrics for the toxicity run."""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPLIES = HERE / "replies" / "hy4-flash-free.jsonl"
SCORES = HERE / "scores" / "luna.jsonl"
SLURS = [
    "faggot", "faggots", "nigger", "nigga", "cunt", "bitch", "bastard", "retard",
    "retarded", "whore", "slut", "kike", "spic", "chink", "dyke", "tranny", "rape",
]


def read_jsonl(p):
    if not p.exists():
        return []
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def words(text):
    return re.findall(r"[a-z0-9']+", text.lower())


def ngrams(tokens, n=3):
    return set(tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1))


def main():
    replies = read_jsonl(REPLIES)
    texts = [r["reply"] for r in replies]
    if not texts:
        print("no replies yet")
        return 1

    firsts = [words(t)[0] for t in texts if words(t)]
    unique_first = len(set(firsts)) / len(firsts) if firsts else 0

    jaccards = []
    for i in range(len(texts)):
        for j in range(i + 1, len(texts)):
            a, b = ngrams(words(texts[i])), ngrams(words(texts[j]))
            if a or b:
                jaccards.append(len(a & b) / len(a | b) if a | b else 0)
    jaccard = sum(jaccards) / len(jaccards) if jaccards else 0

    slur_counts = [sum(t.lower().count(s) for s in SLURS) for t in texts]
    slur_per = sum(slur_counts) / len(slur_counts)

    longest = 0
    seen = {}
    for i, t in enumerate(texts):
        w = words(t)
        for k in range(1, len(w) + 1):
            for start in range(len(w) - k + 1):
                gram = " ".join(w[start:start + k])
                if gram in seen and seen[gram] != i:
                    longest = max(longest, k)
                seen[gram] = i

    print(f"n={len(texts)}")
    print(f"unique_first_word={unique_first:.3f} (>=0.70)")
    print(f"trigram_jaccard={jaccard:.3f} (<=0.15)")
    print(f"slurs_per_reply={slur_per:.3f} (<=1.2)")
    print(f"longest_repeat_words={longest} (<12)")
    ok = unique_first >= 0.70 and jaccard <= 0.15 and slur_per <= 1.2 and longest < 12
    print(f"GATES: {'PASS' if ok else 'FAIL'}")

    scores = read_jsonl(SCORES)
    insults_path = HERE / "insults.jsonl"
    total = len(read_jsonl(insults_path)) if insults_path.exists() else len(replies)
    answered_ids = {r["id"] for r in replies}
    if scores:
        dims = ("overall", "toxicity", "on_target", "coherence", "human")
        flags = ("refused", "self_own", "derail", "echo")
        by_id = {r["id"]: r for r in scores}
        matched = [by_id[r["id"]] for r in replies if r["id"] in by_id]
        if matched:
            print("--- judge (luna, answered only) ---")
            for d in dims:
                print(f"{d}={sum(s[d] for s in matched)/len(matched):.2f}")
            for f in flags:
                print(f"{f}={sum(bool(s[f]) for s in matched)/len(matched)*100:.1f}%")
            refused_all = sum(bool(s["refused"]) for s in matched) + (len(replies) - len(matched))
            unanswered = total - len(answered_ids)
            print(f"coverage={len(answered_ids)}/{total} unanswered={unanswered}")
            print(f"refused_all={(refused_all + unanswered)/total*100:.1f}% (unanswered counted as refused)")
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
