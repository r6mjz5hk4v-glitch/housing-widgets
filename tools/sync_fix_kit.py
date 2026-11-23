#!/usr/bin/env python3
"""Put the Fix-panel kits (tools/fix_kit_script.js, tools/fix_kit_page.js) into the widgets
that have a release schedule, replacing the copies already there. Idempotent."""
import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
SK, PK = (ROOT / "tools/fix_kit_script.js").read_text(), (ROOT / "tools/fix_kit_page.js").read_text()
S0, S1 = "// ---------- Fix panel: script side (shared)", "// ---------- end Fix panel (script) ----------\n"
P0, P1 = "// ---------- Fix panel: page side", "// ---------- end Fix panel (page) ----------\n"
STD = ["BorrowerCreditWidget.js", "MarketRateWidget.js", "MortgageSpreadWidget.js", "NewConstructionWidget.js", "UnemploymentWidget.js"]
ALL = STD + ["BuilderStocksWidget.js"]
MORE = 'document.addEventListener("click", function (e) { var t = e.target && e.target.closest ? e.target.closest(".schedMore") : null; if (!t) return; schedAll = !schedAll; renderSched(window.__sched); });\n'
ROW_A = '''(st.late ? '<i class="schedWhy">' + schedEsc(schedWhy(r)) + "</i>" : "") + '</span><span class="schedLast">\''''
ROW_B = '''(st.late ? '<i class="schedWhy">' + schedEsc(schedWhy(r)) + "</i>" : "") + (st.late ? fixBtn(r) : "") + '</span><span class="schedLast">\''''
END_A = '''(st.sub ? "<i>" + st.sub + "</i>" : "") + "</span></div>";'''
END_B = '''(st.sub ? "<i>" + st.sub + "</i>" : "") + "</span></div>" + (st.late && FIXOPEN[r.name] ? fixPanel(r, st) : "");'''
HEAD_A = '''<span>latest · next update (your time)</span></div>' +\n'''
HEAD_B = '''<span>latest · next update (your time)</span></div>' + (FIXNOTE ? '<div class="fixMsg ok">' + schedEsc(FIXNOTE) + "</div>" : "") +\n'''
FRED_A = '''return { name: r.name, last: r.last || "", next: next ? next.toISOString() : null, approx: false, every: r.every || "" };'''
FRED_B = '''return { name: r.name, last: r.last || "", next: next ? next.toISOString() : null, approx: false, every: r.every || "", series: r.series };'''
POLL_A = "  while (isOpen()) {\n    await sleep(600);\n    if (!isOpen()) break;\n"
POLL_B = POLL_A + "    await fixPoll(wv);\n"

# Builder Stocks has its own simple schedule rows ({name, last, next, late}): an adapter
# gives the page kit what it expects, and its renderSched draws the Fix button and panel
BS_OLD = """function renderSched() {
  el("sched").innerHTML = (D.sched || []).map(function (r) {
    return '<div class="sr"><b>' + esc(r.name) + '</b><span>Latest: ' + esc(r.last) + " · Next: " + esc(r.next) + "</span>" + (r.late ? '<span class="late">' + esc(r.late) + "</span>" : "") + "</div>";
  }).join("");
}
"""
BS0 = "// ---------- Fix panel: Builder Stocks schedule adapter ----------\n"
BS_NEW = BS0 + """function schedEsc(t) { return esc(t).replace(/"/g, "&quot;"); }
function schedState(r) { return { late: !!r.late, main: r.late ? "Not coming through" : "On schedule", sub: "" }; }
function schedWhy(r) { return r.late || ""; }
function renderSched() {
  window.__sched = D.sched || [];
  el("sched").innerHTML = (FIXNOTE ? '<div class="fixMsg ok">' + schedEsc(FIXNOTE) + "</div>" : "") + window.__sched.map(function (r) {
    var st = schedState(r);
    return '<div class="sr"><b>' + esc(r.name) + '</b><span>Latest: ' + esc(r.last) + " · Next: " + esc(r.next) + "</span>" + (r.late ? '<span class="late">' + esc(r.late) + "</span>" + fixBtn(r) : "") + "</div>" + (r.late && FIXOPEN[r.name] ? fixPanel(r, st) : "");
  }).join("");
}
"""
def bs_page(s, f):
    if BS0 in s:
        a = s.index(BS0); b = s.index(P1, a) + len(P1)
        return s[:a] + BS_NEW + PK + s[b:]
    if s.count(BS_OLD) != 1: sys.exit(f"{f}: renderSched not as expected")
    return s.replace(BS_OLD, BS_NEW + PK)

def put(s, start, end, block, anchor, before=True):
    if start in s:
        a = s.index(start); b = s.index(end, a) + len(end)
        return s[:a] + block + s[b:]
    i = s.index(anchor)
    return s[:i] + block + s[i:] if before else s[:i + len(anchor)] + block + s[i + len(anchor):]

def once(s, a, b, name, f):
    if b in s: return s
    if s.count(a) != 1: sys.exit(f"{f}: expected one {name}, found {s.count(a)}")
    return s.replace(a, b)

for f in ALL:
    p = ROOT / "widgets" / f
    s = p.read_text()
    s = put(s, S0, S1, SK, "async function sharePoller(")
    a = s.index("async function sharePoller(")
    if POLL_B not in s[a:a + 600]:
        seg = s[a:a + 600]
        if POLL_A not in seg: sys.exit(f"{f}: sharePoller loop not as expected")
        s = s[:a] + seg.replace(POLL_A, POLL_B, 1) + s[a + 600:]
    if f in STD:
        s = put(s, P0, P1, PK, MORE, before=False)
        s = once(s, ROW_A, ROW_B, "schedule row", f)
        s = once(s, END_A, END_B, "schedule row end", f)
        s = once(s, HEAD_A, HEAD_B, "schedule head", f)
        s = once(s, FRED_A, FRED_B, "schedFredRow", f)
    else:
        s = bs_page(s, f)
    p.write_text(s)
print("synced:", ", ".join(ALL))
