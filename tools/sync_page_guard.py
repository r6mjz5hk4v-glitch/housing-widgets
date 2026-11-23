#!/usr/bin/env python3
"""Puts tools/page_guard.js (the black-screen guard) into every widget with a full view.
Idempotent: run it again after editing the master copy."""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, "widgets")
BLOCK = open(os.path.join(ROOT, "tools", "page_guard.js")).read()
B0 = "// ---------- Black-screen guard"
B1 = "// ---------- end black-screen guard ----------\n"
OLD_ARGS = "function updArgs(html, base) { return base === undefined ? [updPage(html)] : [updPage(html), base]; }\n"
HOOK = "  const sharing = sharePoller(wv, () => open);\n"
GUARD = "  updWatch(wv, () => open); // redraw the page if iOS drops it\n"
# the background work (FRED checks, downloads) waits until the page has had its first draw
DELAY = "  await new Promise((r) => Timer.schedule(2500, false, r)); // let the page draw before the background work starts\n"
REPORTS = "  const closed = wv.present(true).then(() => {\n    open = false;\n  });\n"
done = []
for f in sorted(os.listdir(W)):
    if not f.endswith(".js") or f in ("Installer.js", "Setup.js"): continue
    p = os.path.join(W, f); s = open(p).read()
    if "function updWV" not in s: continue
    if B0 in s:
        a = s.index(B0); b = s.index(B1, a) + len(B1); s = s[:a] + BLOCK + s[b:]
    else:
        if s.count(OLD_ARGS) != 1: sys.exit(f"{f}: updArgs not as expected")
        s = s.replace(OLD_ARGS, BLOCK)
    if GUARD not in s:
        if s.count(HOOK) == 1: s = s.replace(HOOK, HOOK + GUARD)
        elif f == "ReportsWidget.js" and s.count(REPORTS) == 1: s = s.replace(REPORTS, REPORTS + GUARD)
        else: sys.exit(f"{f}: no place to start the guard")
    if DELAY not in s: s = s.replace(GUARD, GUARD + DELAY)
    open(p, "w").write(s); done.append(f)
print("synced:", ", ".join(done))
