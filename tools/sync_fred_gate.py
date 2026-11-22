#!/usr/bin/env python3
"""Put tools/fred_gate.js (the master copy) into every widget that talks to FRED,
replacing the copy already there. Run after editing fred_gate.js."""
import pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
block = (ROOT / "tools/fred_gate.js").read_text()
START, END = "// ---------- FRED: ask only when needed", "// ---------- end FRED ----------\n"
changed = []
for p in sorted((ROOT / "widgets").glob("*.js")):
    s = p.read_text()
    if "api.stlouisfed.org" not in s or p.name in ("Setup.js", "Installer.js"):
        continue
    if START in s:
        a = s.index(START); b = s.index(END, a) + len(END)
        new = s[:a] + block + s[b:]
    else:
        m = re.search(r"^const FRED_KEY = .*\n", s, re.M) or re.search(r"^async function schedFredDates", s, re.M)
        if not m:
            sys.exit(f"{p.name}: no place to put the FRED block")
        at = m.end() if m.group(0).startswith("const") else m.start()
        new = s[:at] + "\n" + block + "\n" + s[at:] if m.group(0).startswith("const") else s[:at] + block + "\n" + s[at:]
    if new != s:
        p.write_text(new); changed.append(p.name)
print("updated:", ", ".join(changed) or "nothing")
