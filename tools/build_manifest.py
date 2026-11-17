#!/usr/bin/env python3
"""Rebuild manifest.json from widgets/ and tools/notes.json.

Keeps each entry's name, title, about, needs and sig from the current manifest,
recomputes each file's fingerprint (hash) and attaches its newest 3 update notes.
Run from the repo root:  python3 tools/build_manifest.py

hash: FNV-1a 32-bit (hex) over the file's UTF-16 code units, from the title line
(sig) to the end, CRLF turned into LF, trailing whitespace trimmed. Widgets
compute the same thing on the phone to decide whether to show "Update ready".
"""
import datetime, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
man_path = os.path.join(ROOT, "manifest.json")
notes_path = os.path.join(ROOT, "tools", "notes.json")

def fingerprint(text, sig):
    t = text.replace("\r\n", "\n")
    if sig not in t:
        sys.exit(f"title line not found: {sig!r}")
    b = t[t.index(sig):].rstrip().encode("utf-16-le")
    h = 0x811C9DC5
    for i in range(0, len(b), 2):
        h = ((h ^ (b[i] | (b[i + 1] << 8))) * 16777619) & 0xFFFFFFFF
    return format(h, "x")

man = json.load(open(man_path))
notes = json.load(open(notes_path)) if os.path.exists(notes_path) else {}
for f in man["files"]:
    text = open(os.path.join(ROOT, "widgets", f["file"]), encoding="utf-8").read()
    f["hash"] = fingerprint(text, f["sig"])
    f["notes"] = sorted(notes.get(f["file"], []), key=lambda n: n["d"], reverse=True)[:3]
man["updated"] = datetime.date.today().strftime("%b %-d, %Y")
json.dump(man, open(man_path, "w"), indent=1, ensure_ascii=False)
print(f"{len(man['files'])} entries written")
