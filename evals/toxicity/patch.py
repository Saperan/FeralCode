#!/usr/bin/env python3
"""Idempotently patch the vendored eblan toxbench.py for our contestant and judge."""
from pathlib import Path

HERE = Path(__file__).resolve().parent
TARGET = HERE / "vendor" / "benchmark" / "toxbench.py"

CONTESTANT = '    "hy4-flash-free": ("opencode", "opencode-go/hy4-flash-free"),\n'
JUDGE = '    "luna": ("opencode", "opencode/deepseek-v4.1-flash-free"),\n'

OLD_BRANCH = '''        elif runner == "opencode":
            cmd = [exe, "run", "--pure", "-m", model, "--dir", tmp, prompt]
            stdin = None
'''
NEW_BRANCH = '''        elif runner == "opencode":
            # Prepend $TOX_SYSTEM to the batch. Keep --pure so no agent prompts leak in.
            system = os.environ.get("TOX_SYSTEM", "")
            batch = f"{system}\\n\\n{prompt}" if system else prompt
            cmd = [exe, "run", "--pure", "-m", model, "--dir", tmp, batch]
            stdin = None
'''


def main() -> int:
    text = TARGET.read_text(encoding="utf-8")
    changed = False

    if OLD_BRANCH in text:
        text = text.replace(OLD_BRANCH, NEW_BRANCH)
        changed = True

    marker = "CONTESTANTS = {\n"
    if marker in text and '"hy4-flash-free"' not in text.split("JUDGES =", 1)[0]:
        text = text.replace(marker, marker + CONTESTANT, 1)
        changed = True

    jmarker = "JUDGES = {"
    if jmarker in text and '"luna"' not in text.split("ANSWER_BATCH", 1)[0]:
        idx = text.index(jmarker) + len(jmarker)
        text = text[:idx] + "\n" + JUDGE.rstrip("\n") + " " + text[idx:].lstrip()
        changed = True

    if changed:
        TARGET.write_text(text, encoding="utf-8")
    print("patched" if changed else "already patched")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
