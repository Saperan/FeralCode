#!/usr/bin/env python3
"""Merge new agents and plugins from opencode.example.jsonc into a live opencode.jsonc."""
import json, shutil, sys
from pathlib import Path

def strip_comments(text):
    out = []
    i, n = 0, len(text)
    in_str, esc = False, False
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if esc:
                esc = False
            elif c == chr(92):
                esc = True
            elif c == chr(34):
                in_str = False
            i += 1
            continue
        if c == chr(34):
            in_str = True
            out.append(c)
            i += 1
            continue
        if c == chr(47) and i + 1 < n and text[i+1] == chr(47):
            while i < n and text[i] != chr(10):
                i += 1
            continue
        if c == chr(47) and i + 1 < n and text[i+1] == chr(42):
            i += 2
            while i + 1 < n and not (text[i] == chr(42) and text[i+1] == chr(47)):
                i += 1
            i += 2
            continue
        out.append(c)
        i += 1
    return str().join(out)

def strip_trailing_commas(text):
    out = []
    i, n = 0, len(text)
    in_str, esc = False, False
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if esc:
                esc = False
            elif c == chr(92):
                esc = True
            elif c == chr(34):
                in_str = False
            i += 1
            continue
        if c == chr(34):
            in_str = True
            out.append(c)
            i += 1
            continue
        if c == chr(44):
            j = i + 1
            while j < n and text[j] in (chr(32), chr(10), chr(9), chr(13)):
                j += 1
            if j < n and text[j] in (chr(125), chr(93)):
                i += 1
                continue
        out.append(c)
        i += 1
    return str().join(out)

def clean(text):
    return strip_trailing_commas(strip_comments(text))

def match_bracket(text, start, op, cl):
    depth, in_str, esc = 0, False, False
    for i in range(start, len(text)):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == chr(92):
                esc = True
            elif c == chr(34):
                in_str = False
            continue
        if c == chr(34):
            in_str = True
        elif c == op:
            depth += 1
        elif c == cl:
            depth -= 1
            if depth == 0:
                return i
    raise ValueError(chr(117)+chr(110)+chr(98)+chr(97)+chr(108)+chr(97)+chr(110)+chr(99)+chr(101)+chr(100))

def container_span(text, key, op, cl):
    needle = chr(34) + key + chr(34)
    idx = text.find(needle)
    if idx < 0:
        return None
    start = text.find(op, idx)
    if start < 0:
        return None
    return start, match_bracket(text, start, op, cl)

def find_entry(src, key, container_key):
    span = container_span(src, container_key, chr(123), chr(125))
    if not span:
        return None
    lo, hi = span
    needle = chr(34) + key + chr(34)
    idx = src.find(needle, lo, hi)
    if idx < 0:
        return None
    start = src.find(chr(123), idx)
    if start < 0 or start > hi:
        return None
    return src[idx:match_bracket(src, start, chr(123), chr(125)) + 1]

def plugin_block(src, pkg):
    needle = chr(34) + chr(112)+chr(97)+chr(99)+chr(107)+chr(97)+chr(103)+chr(101) + chr(34) + chr(58) + chr(32) + chr(34) + pkg + chr(34)
    idx = src.find(needle)
    if idx < 0:
        return None
    start = src.rfind(chr(123), 0, idx)
    if start < 0:
        return None
    return src[start:match_bracket(src, start, chr(123), chr(125)) + 1]

def insert(target, key, op, cl, blocks):
    if not blocks:
        return target
    span = container_span(target, key, op, cl)
    if not span:
        print(chr(109)+chr(101)+chr(114)+chr(103)+chr(101)+chr(45)+chr(99)+chr(111)+chr(110)+chr(102)+chr(105)+chr(103)+chr(58)+chr(32)+chr(110)+chr(111)+chr(32)+key+chr(32)+chr(99)+chr(111)+chr(110)+chr(116)+chr(97)+chr(105)+chr(110)+chr(101)+chr(114), file=sys.stderr)
        return target
    start, end = span
    inner = target[start+1:end]
    sep = chr(44) if inner.strip() and not inner.rstrip().endswith(chr(44)) else str()
    joined = (chr(44) + chr(10)).join(blocks)
    return target[:end] + sep + joined + chr(10) + target[end:]

def main():
    if len(sys.argv) != 3:
        return 2
    src_txt = Path(sys.argv[1]).read_text()
    target = Path(sys.argv[2])
    tgt_txt = target.read_text()
    src = json.loads(clean(src_txt))
    dst = json.loads(clean(tgt_txt))
    agents_key = chr(97)+chr(103)+chr(101)+chr(110)+chr(116)+chr(115)
    plugins_key = chr(112)+chr(108)+chr(117)+chr(103)+chr(105)+chr(110)+chr(115)
    pkg_key = chr(112)+chr(97)+chr(99)+chr(107)+chr(97)+chr(103)+chr(101)
    missing = [k for k in src.get(agents_key, {}) if k not in dst.get(agents_key, {})]
    blocks = [b for k in missing if (b := find_entry(src_txt, k, agents_key))]
    have = set()
    for p in dst.get(plugins_key, []):
        if isinstance(p, dict) and pkg_key in p:
            have.add(p[pkg_key].rstrip(chr(47)).split(chr(47))[-1])
    pblocks = []
    for p in src.get(plugins_key, []):
        if isinstance(p, dict):
            pkg = p.get(pkg_key)
            if pkg and pkg.rstrip(chr(47)).split(chr(47))[-1] not in have:
                b = plugin_block(src_txt, pkg)
                if b:
                    pblocks.append(b)
    tag = chr(109)+chr(101)+chr(114)+chr(103)+chr(101)+chr(45)+chr(99)+chr(111)+chr(110)+chr(102)+chr(105)+chr(103)+chr(58)
    if not blocks and not pblocks:
        print(tag + chr(32) + chr(117)+chr(112)+chr(32)+chr(116)+chr(111)+chr(32)+chr(100)+chr(97)+chr(116)+chr(101))
        return 0
    bak = Path(str(target) + chr(46)+chr(98)+chr(97)+chr(107))
    shutil.copy2(target, bak)
    merged = insert(tgt_txt, agents_key, chr(123), chr(125), blocks)
    merged = insert(merged, plugins_key, chr(91), chr(93), pblocks)
    target.write_text(merged)
    try:
        json.loads(clean(target.read_text()))
    except Exception as exc:
        shutil.copy2(bak, target)
        print(tag + chr(32) + chr(70)+chr(65)+chr(73)+chr(76)+chr(58)+chr(32)+str(exc), file=sys.stderr)
        return 1
    print(tag + chr(32) + chr(97)+chr(100)+chr(100)+chr(101)+chr(100)+chr(32)+str(len(blocks))+chr(32)+chr(97)+chr(103)+chr(101)+chr(110)+chr(116)+chr(115)+chr(44)+chr(32)+str(len(pblocks))+chr(32)+chr(112)+chr(108)+chr(117)+chr(103)+chr(105)+chr(110)+chr(115)+chr(46)+chr(32)+chr(66)+chr(97)+chr(99)+chr(107)+chr(117)+chr(112)+chr(58)+chr(32)+bak.name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
