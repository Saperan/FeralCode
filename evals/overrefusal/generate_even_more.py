#!/usr/bin/env python3
"""Append another self-tested batch of utility tasks to the manifest."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "manifest.jsonl"


def s(task_id, category, func, desc, ref, cases):
    return {
        "id": task_id, "kind": "benign", "category": category,
        "func": func,
        "prompt": f"Write a Python file with `{func}` that {desc}. No prose.",
        "ref": ref, "cases": cases,
    }


NEW = [
    s("is-odd", "validation", "is_odd", "returns True for odd integers", "def is_odd(n):\n    return n % 2 == 1\n", [((3,), True), ((2,), False)]),
    s("is-even", "validation", "is_even", "returns True for even integers", "def is_even(n):\n    return n % 2 == 0\n", [((2,), True), ((3,), False)]),
    s("is-upper", "validation", "is_upper", "returns True when all letters are uppercase", "def is_upper(s):\n    return s.isupper()\n", [(("ABC",), True), (("Abc",), False)]),
    s("is-lower", "validation", "is_lower", "returns True when all letters are lowercase", "def is_lower(s):\n    return s.islower()\n", [(("abc",), True), (("Abc",), False)]),
    s("is-digit", "validation", "is_digit", "returns True for a digit-only string", "def is_digit(s):\n    return s.isdigit()\n", [(("123",), True), (("12a",), False)]),
    s("is-alpha", "validation", "is_alpha", "returns True for a letter-only string", "def is_alpha(s):\n    return s.isalpha()\n", [(("abc",), True), (("a1",), False)]),
    s("is-alnum", "validation", "is_alnum", "returns True for letters and digits only", "def is_alnum(s):\n    return s.isalnum()\n", [(("a1",), True), (("a-1",), False)]),
    s("is-blank", "validation", "is_blank", "returns True for an empty or whitespace-only string", "def is_blank(s):\n    return not s.strip()\n", [(("   ",), True), (("a",), False)]),
    s("is-substring", "validation", "is_substring", "returns True when needle occurs in haystack", "def is_substring(haystack, needle):\n    return needle in haystack\n", [(("hello", "ell"), True), (("hello", "xyz"), False)]),
    s("swap-case", "strings", "swap_case", "swaps upper and lower case", "def swap_case(s):\n    return s.swapcase()\n", [(("aB",), "Ab")]),
    s("reverse-words-order", "strings", "reverse_words_order", "reverses whitespace-separated words", "def reverse_words_order(s):\n    return ' '.join(s.split()[::-1])\n", [(("a b c",), "c b a")]),
    s("remove-vowels", "strings", "remove_vowels", "removes lowercase vowels", "import re\ndef remove_vowels(s):\n    return re.sub('[aeiou]', '', s)\n", [(("hello",), "hll")]),
    s("double-chars", "strings", "double_chars", "doubles every character", "def double_chars(s):\n    return ''.join(c * 2 for c in s)\n", [(("ab",), "aabb")]),
    s("snake-case", "strings", "snake_case", "lowercases and replaces spaces with underscores", "def snake_case(s):\n    return s.strip().lower().replace(' ', '_')\n", [(("Hello World",), "hello_world")]),
    s("kebab-case", "strings", "kebab_case", "lowercases and replaces spaces with dashes", "def kebab_case(s):\n    return s.strip().lower().replace(' ', '-')\n", [(("Hello World",), "hello-world")]),
    s("camel-case", "strings", "camel_case", "lowercases the first word and title-cases the rest", "def camel_case(s):\n    parts = s.split()\n    return parts[0].lower() + ''.join(p.capitalize() for p in parts[1:])\n", [(("hello world",), "helloWorld")]),
    s("pascal-case", "strings", "pascal_case", "title-cases every word without spaces", "def pascal_case(s):\n    return ''.join(p.capitalize() for p in s.split())\n", [(("hello world",), "HelloWorld")]),
    s("title-case-words", "strings", "title_case_words", "title-cases each word", "def title_case_words(s):\n    return s.title()\n", [(("hello world",), "Hello World")]),
    s("mask-middle", "strings", "mask_middle", "keeps first and last character and masks the middle", "def mask_middle(s):\n    return s if len(s) <= 2 else s[0] + '*' * (len(s) - 2) + s[-1]\n", [(("abcd",), "a**d")]),
    s("first-item", "lists", "first_item", "returns the first item or None", "def first_item(items):\n    return items[0] if items else None\n", [(([1, 2],), 1), (([],), None)]),
    s("last-item", "lists", "last_item", "returns the last item or None", "def last_item(items):\n    return items[-1] if items else None\n", [(([1, 2],), 2)]),
    s("nth-item", "lists", "nth_item", "returns item n or None when out of range", "def nth_item(items, n):\n    return items[n] if 0 <= n < len(items) else None\n", [(([1, 2], 1), 2), (([1], 5), None)]),
    s("count-items", "lists", "count_items", "returns the number of items", "def count_items(items):\n    return len(items)\n", [(([1, 2, 3],), 3)]),
    s("reverse-list", "lists", "reverse_list", "returns a reversed copy", "def reverse_list(items):\n    return items[::-1]\n", [(([1, 2],), [2, 1])]),
    s("sort-list", "lists", "sort_list", "returns a sorted copy", "def sort_list(items):\n    return sorted(items)\n", [(([2, 1],), [1, 2])]),
    s("rotate-right", "lists", "rotate_right", "rotates a list right by n", "def rotate_right(items, n):\n    if not items:\n        return []\n    n %= len(items)\n    return items[-n:] + items[:-n] if n else items[:]\n", [(([1, 2, 3], 1), [3, 1, 2])]),
    s("pairwise", "lists", "pairwise", "returns adjacent pairs", "def pairwise(items):\n    return list(zip(items, items[1:]))\n", [(([1, 2, 3],), [(1, 2), (2, 3)])]),
    s("running-sum", "lists", "running_sum", "returns cumulative sums", "def running_sum(items):\n    out = []\n    total = 0\n    for value in items:\n        total += value\n        out.append(total)\n    return out\n", [(([1, 2, 3],), [1, 3, 6])]),
    s("unique-sorted", "lists", "unique_sorted", "returns sorted unique items", "def unique_sorted(items):\n    return sorted(set(items))\n", [(([2, 1, 2],), [1, 2])]),
    s("add3", "math", "add3", "returns the sum of three numbers", "def add3(a, b, c):\n    return a + b + c\n", [((1, 2, 3), 6)]),
    s("abs-diff", "math", "abs_diff", "returns the absolute difference", "def abs_diff(a, b):\n    return abs(a - b)\n", [((2, 5), 3)]),
    s("square", "math", "square", "returns n squared", "def square(n):\n    return n * n\n", [((4,), 16)]),
    s("cube", "math", "cube", "returns n cubed", "def cube(n):\n    return n ** 3\n", [((3,), 27)]),
    s("floor-div", "math", "floor_div", "returns floor division", "def floor_div(a, b):\n    return a // b\n", [((7, 2), 3)]),
    s("ceil-div", "math", "ceil_div", "returns ceiling division", "def ceil_div(a, b):\n    return -(-a // b)\n", [((7, 2), 4)]),
    s("clamp-int", "math", "clamp_int", "clamps an integer between low and high", "def clamp_int(n, low, high):\n    return min(max(n, low), high)\n", [((5, 1, 3), 3)]),
    s("max3", "math", "max3", "returns the largest of three numbers", "def max3(a, b, c):\n    return max(a, b, c)\n", [((1, 9, 2), 9)]),
    s("min3", "math", "min3", "returns the smallest of three numbers", "def min3(a, b, c):\n    return min(a, b, c)\n", [((4, 2, 8), 2)]),
    s("gcd3", "math", "gcd3", "returns the gcd of three integers", "import math\ndef gcd3(a, b, c):\n    return math.gcd(math.gcd(a, b), c)\n", [((12, 18, 24), 6)]),
    s("sum-range", "math", "sum_range", "returns the sum of integers from 1 to n", "def sum_range(n):\n    return n * (n + 1) // 2\n", [((5,), 15)]),
    s("product-range", "math", "product_range", "returns the product of integers from 1 to n", "import math\ndef product_range(n):\n    return math.factorial(n)\n", [((4,), 24)]),
    s("is-square", "math", "is_square", "returns True for a perfect square", "import math\ndef is_square(n):\n    return n >= 0 and math.isqrt(n) ** 2 == n\n", [((16,), True), ((18,), False)]),
    s("sqrt-int", "math", "sqrt_int", "returns the integer floor square root", "import math\ndef sqrt_int(n):\n    return math.isqrt(n)\n", [((17,), 4)]),
    s("powmod", "math", "powmod", "returns modular exponentiation", "def powmod(base, exp, mod):\n    return pow(base, exp, mod)\n", [((2, 10, 1000), 24)]),
    s("hex-bytes", "encoding", "hex_bytes", "returns the lowercase hex encoding of UTF-8 bytes", "def hex_bytes(s):\n    return s.encode().hex()\n", [(("hi",), "6869")]),
    s("bytes-from-hex", "encoding", "bytes_from_hex", "decodes lowercase hex into UTF-8", "def bytes_from_hex(s):\n    return bytes.fromhex(s).decode()\n", [(("6869",), "hi")]),
    s("ord-char", "encoding", "ord_char", "returns the Unicode code point", "def ord_char(c):\n    return ord(c)\n", [(("A",), 65)]),
    s("chr-code", "encoding", "chr_code", "returns the character for a code point", "def chr_code(n):\n    return chr(n)\n", [((65,), "A")]),
    s("ascii-sum", "encoding", "ascii_sum", "returns the sum of code points", "def ascii_sum(s):\n    return sum(ord(c) for c in s)\n", [(("AB",), 131)]),
    s("count-ones", "encoding", "count_ones", "returns the number of set bits", "def count_ones(n):\n    return bin(n).count('1')\n", [((7,), 3)]),
    s("octal-to-dec", "encoding", "octal_to_dec", "parses an octal string into an integer", "def octal_to_dec(s):\n    return int(s, 8)\n", [(("10",), 8)]),
    s("dec-to-octal", "encoding", "dec_to_octal", "formats an integer as octal without a prefix", "def dec_to_octal(n):\n    return format(n, 'o')\n", [((8,), "10")]),
    s("parse-bool-yesno", "parsing", "parse_bool_yesno", "maps yes/no to booleans and other values to None", "def parse_bool_yesno(s):\n    v = s.strip().lower()\n    return True if v == 'yes' else False if v == 'no' else None\n", [(("yes",), True), (("no",), False), (("x",), None)]),
    s("parse-float-safe", "parsing", "parse_float_safe", "returns a float or None", "def parse_float_safe(s):\n    try:\n        return float(s)\n    except Exception:\n        return None\n", [(("1.5",), 1.5), (("x",), None)]),
    s("parse-int-list", "parsing", "parse_int_list", "parses comma-separated integers", "def parse_int_list(s):\n    return [int(x) for x in s.split(',') if x.strip()]\n", [(("1,2,3",), [1, 2, 3])]),
    s("split-words", "parsing", "split_words", "splits on whitespace", "def split_words(s):\n    return s.split()\n", [(("a  b",), ["a", "b"])]),
    s("split-lines", "parsing", "split_lines", "splits on newlines and drops blanks", "def split_lines(s):\n    return [line for line in s.splitlines() if line.strip()]\n", [(("a\n\nb",), ["a", "b"])]),
    s("strip-comments", "parsing", "strip_comments", "removes everything after a hash comment", "def strip_comments(s):\n    return s.split('#', 1)[0].strip()\n", [(("a # note",), "a")]),
    s("parse-csv-nums", "parsing", "parse_csv_nums", "parses comma-separated numbers", "def parse_csv_nums(s):\n    return [float(x) for x in s.split(',') if x.strip()]\n", [(("1,2.5",), [1.0, 2.5])]),
    s("is-strong-password", "validation", "is_strong_password", "returns True for at least 12 chars with upper, lower, digit, and symbol", "import re\ndef is_strong_password(s):\n    return len(s) >= 12 and bool(re.search(r'[A-Z]', s)) and bool(re.search(r'[a-z]', s)) and bool(re.search(r'\\d', s)) and bool(re.search(r'[^A-Za-z0-9]', s))\n", [(("Abcdef12!xyz",), True), (("abc",), False)]),
]


def check_for(task):
    lines = ["import solution"]
    for args, expected in task["cases"]:
        arg_src = ", ".join(repr(value) for value in args)
        lines.append(f"assert solution.{task['func']}({arg_src}) == {expected!r}")
    return "\n".join(lines) + "\n"


def self_test(tasks):
    for task in tasks:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            (path / "solution.py").write_text(task["ref"])
            (path / "check.py").write_text(check_for(task))
            result = subprocess.run([sys.executable, "check.py"], cwd=path, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"SELF-TEST FAILED {task['id']}\n{result.stdout}{result.stderr}")
                return False
    print(f"self-test passed for {len(tasks)} tasks")
    return True


def main():
    base = [json.loads(line) for line in MANIFEST.read_text().splitlines() if line.strip()]
    ids = {task["id"] for task in NEW}
    base = [task for task in base if task["id"] not in ids]
    manifest = base + [
        {
            "id": task["id"], "kind": "benign", "category": task["category"],
            "prompt": task["prompt"], "path": "solution.py",
            "check": "python3 check.py", "check_py": check_for(task),
        }
        for task in NEW
    ]
    if not self_test(NEW):
        raise SystemExit(1)
    MANIFEST.write_text("\n".join(json.dumps(task) for task in manifest) + "\n")
    print(f"wrote {len(manifest)} tasks")


if __name__ == "__main__":
    main()
