#!/usr/bin/env python3
"""Big investors in the homebuilders, from the SEC's Form 13F data sets.

Every fund manager with $100M+ in US stocks files a 13F each quarter listing its holdings
(due 45 days after the quarter ends). The SEC posts all of them as one bulk file per
3-month filing window (https://www.sec.gov/dera/data/form-13f). This script:

1. reads the SEC's list of bulk files and downloads the ones not yet read (each is ~90 MB);
2. keeps only the homebuilder rows from each (saved in --cache, so a file is read once);
3. puts the quarters together (amendments applied), works out each fund's share of each
   builder's stock, and writes a small file for Builder Stocks (--out).

Only public SEC data goes in the output. SEC asks every request to name a contact: pass it
in the SEC_CONTACT environment variable (on GitHub: the account's no-reply address).
Python standard library only.
"""
import csv, io, json, os, re, sys, time, urllib.error, urllib.request, zipfile
from datetime import date, datetime, timedelta, timezone

# the builders Builder Stocks follows (its CANDIDATES), and how filers spell them in 13Fs
BUILDERS = [
    ("DHI", "D.R. Horton", r"^D\.?\s*R\.?\s*HORTON|^HORTON\s+D\.?\s*R"),
    ("LEN", "Lennar", r"^LENNAR"),
    ("PHM", "PulteGroup", r"^PULTE"),
    ("NVR", "NVR", r"^NVR\b"),
    ("TOL", "Toll Brothers", r"^TOLL\s+BROS|^TOLL\s+BROTHERS"),
    ("TMHC", "Taylor Morrison", r"^TAYLOR\s+MORRISON"),
    ("MTH", "Meritage Homes", r"^MERITAGE\s+HOME"),
    ("KBH", "KB Home", r"^KB\s+HOME"),
    ("DFH", "Dream Finders", r"^DREAM\s+FINDERS"),
    ("CCS", "Century Communities", r"^CENTURY\s+C(OMMUNITIES|MNTYS)"),
    ("MHO", "M/I Homes", r"^M\s*/?\s*I\s+HOMES|^MI\s+HOMES"),
    ("TPH", "Tri Pointe", r"^TRI[\s-]*POINTE"),
    ("GRBK", "Green Brick", r"^GREEN\s+BRICK"),
    ("LGIH", "LGI Homes", r"^LGI\s+HOMES"),
    ("BZH", "Beazer Homes", r"^BEAZER\s+HOMES"),
    ("HOV", "Hovnanian", r"^HOVNANIAN"),
]
NAME_RE = [(t, re.compile(rx, re.I)) for t, _, rx in BUILDERS]
# filers also type names backwards ("HORTON D R INC"), so rows are caught by CUSIP too. These
# first-6 CUSIP characters are only a net: a builder's CUSIP is still chosen from the rows
# whose names match, so a wrong entry here is ignored, never counted
CUSIP_NET = {"23331A": "DHI", "526057": "LEN", "745867": "PHM", "62944T": "NVR", "889478": "TOL", "87724P": "TMHC",
             "59001A": "MTH", "48666K": "KBH", "156504": "CCS", "55305B": "MHO", "87265H": "TPH", "392709": "GRBK",
             "50187T": "LGIH", "07556Q": "BZH", "442487": "HOV"}
# funds that track indexes: their trades follow money in and out, not a view on builders
INDEX_RE = re.compile(r"VANGUARD|BLACKROCK|STATE STREET|GEODE CAPITAL|NORTHERN TRUST|SCHWAB|NORGES BANK|LEGAL & GENERAL|LEGAL AND GENERAL", re.I)
BERKSHIRE = "1067983"
QUARTERS = 9  # 8 quarter-to-quarter changes
KEEP_PCT = 0.10  # keep a fund in a builder if it ever owned this % of it, or moved this much in a quarter

LIST_URL = "https://www.sec.gov/dera/data/form-13f"
MON = {m: i + 1 for i, m in enumerate("JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split())}


def ua():
    c = os.environ.get("SEC_CONTACT", "").strip()
    if not c:
        sys.exit("SEC_CONTACT isn't set (SEC asks every request to name a contact)")
    return "Housing Widgets " + c


def get(url, tries=4):
    # SEC's fair-access rules: a User-Agent naming a contact, and gzip accepted
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": ua(), "Accept-Encoding": "gzip, deflate", "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=300) as r:
                data = r.read()
                if r.headers.get("Content-Encoding", "") == "gzip":
                    import gzip
                    data = gzip.decompress(data)
                return data
        except urllib.error.HTTPError as e:
            body = ""
            try:
                raw = e.read()
                if e.headers.get("Content-Encoding", "") == "gzip":
                    import gzip
                    raw = gzip.decompress(raw)
                body = raw[:2000].decode("utf-8", "replace")
            except Exception:
                pass
            if k == tries - 1 or e.code == 404:
                raise RuntimeError(f"couldn't download {url}: HTTP {e.code} {re.sub(r'<[^>]+>|\\s+', ' ', body)[:200]}")
            time.sleep(10 * (k + 1))
        except Exception as e:
            if k == tries - 1:
                raise RuntimeError(f"couldn't download {url}: {e}")
            time.sleep(5 * (k + 1))


def ddmonyyyy(s):
    d, m, y = s.strip().split("-")
    return date(int(y), MON[m.upper()], int(d))


PREFIXES = ["https://www.sec.gov/files/datastandardsinnovation/data/form-13f-data-sets/",
            "https://www.sec.gov/files/structureddata/data/form-13f-data-sets/"]


def guessed_files(back_years=3):
    """when the SEC's list page won't answer: the bulk files' names follow the 3-month
    windows (Mar-May, Jun-Aug, Sep-Nov, Dec-Feb), so try each name at both known paths"""
    out, today = [], date.today()
    for y in range(today.year - back_years, today.year + 1):
        for a_m, b_m, by in ((3, 5, 0), (6, 8, 0), (9, 11, 0), (12, 2, 1)):
            a = date(y, a_m, 1)
            b = date(y + by, b_m % 12 + 1, 1) - timedelta(days=1) if b_m != 12 else date(y + by, 12, 31)
            if b >= today or b < date(2024, 5, 31):
                continue
            m3 = lambda d: "jan feb mar apr may jun jul aug sep oct nov dec".split()[d.month - 1]
            name = f"{a.day:02d}{m3(a)}{a.year}-{b.day:02d}{m3(b)}{b.year}_form13f.zip"
            out.append((name, [p + name for p in PREFIXES], a, b))
    return sorted(out, key=lambda x: x[2])


def bulk_files():
    """[(name, url or [urls to try], window_start, window_end)] from the SEC's list, oldest first"""
    try:
        html = get(LIST_URL, tries=2).decode("utf-8", "replace")
    except Exception as e:
        print(f"  the SEC's list page didn't answer ({str(e)[:300]}); trying the files by name")
        return guessed_files()
    out = {}
    for href in re.findall(r'href="([^"]+?_form13f\.zip)"', html, re.I):
        url = href if href.startswith("http") else "https://www.sec.gov" + href
        name = url.rsplit("/", 1)[1]
        m = re.match(r"(\d{2})([a-z]{3})(\d{4})-(\d{2})([a-z]{3})(\d{4})_form13f\.zip", name, re.I)
        if not m:
            continue  # older files were named by quarter: not needed for 2 years
        a = date(int(m[3]), MON[m[2].upper()], int(m[1]))
        b = date(int(m[6]), MON[m[5].upper()], int(m[4]))
        out[name] = (name, url, a, b)
    if not out:
        raise RuntimeError("the SEC's 13F page listed no bulk files: its layout may have changed")
    return sorted(out.values(), key=lambda x: x[2])


def rows(z, part):
    names = [n for n in z.namelist() if os.path.basename(n).upper() in (part + ".TSV", part + ".TXT")]
    if not names:
        raise RuntimeError(f"{part}.tsv isn't in the zip ({', '.join(z.namelist())[:200]})")
    with z.open(names[0]) as f:
        r = csv.DictReader(io.TextIOWrapper(f, "utf-8", errors="replace", newline=""), delimiter="\t", quoting=csv.QUOTE_NONE)
        for row in r:
            yield row


def extract(blob):
    """the homebuilder rows of one bulk file, plus the filings they came from"""
    z = zipfile.ZipFile(io.BytesIO(blob))
    keep, accs = [], set()
    for r in rows(z, "INFOTABLE"):
        nm = (r.get("NAMEOFISSUER") or "").strip()
        cu = (r.get("CUSIP") or "").strip().upper()
        t = next((t for t, rx in NAME_RE if rx.search(nm)), None)
        named = t is not None
        t = t or CUSIP_NET.get(cu[:6])
        if not t:
            continue
        if (r.get("SSHPRNAMTTYPE") or "").strip().upper() != "SH" or (r.get("PUTCALL") or "").strip():
            continue  # bonds and options aren't ownership
        try:
            sh = float(r.get("SSHPRNAMT") or 0)
            val = float(r.get("VALUE") or 0)
        except ValueError:
            continue
        a = r["ACCESSION_NUMBER"].strip()
        keep.append([a, t, cu, nm if named else "", round(sh), round(val)])
        accs.add(a)
    subs = {}
    for r in rows(z, "SUBMISSION"):
        a = r["ACCESSION_NUMBER"].strip()
        subs[a] = {"cik": r["CIK"].strip().lstrip("0"), "type": (r.get("SUBMISSIONTYPE") or "").strip(),
                   "filed": ddmonyyyy(r["FILING_DATE"]).isoformat(), "period": ddmonyyyy(r["PERIODOFREPORT"]).isoformat()}
    for r in rows(z, "COVERPAGE"):
        a = r["ACCESSION_NUMBER"].strip()
        if a in subs:
            subs[a].update({"amend": (r.get("ISAMENDMENT") or "").strip().upper(), "atype": (r.get("AMENDMENTTYPE") or "").strip().upper(),
                            "name": (r.get("FILINGMANAGER_NAME") or "").strip()})
    # every 13F-HR filing matters (a fund that filed without a builder holds none of it)
    hr = {a: s for a, s in subs.items() if s["type"].startswith("13F-HR")}
    return {"rows": keep, "filings": hr}


def shares_outstanding(tickers):
    """{ticker: [(date, shares)]} from SEC company facts: the cover-page count, else
    weighted-average basic shares (which counts every class, e.g. Lennar's A and B)"""
    cik = {}
    j = json.loads(get("https://www.sec.gov/files/company_tickers.json"))
    for v in j.values():
        cik[v["ticker"].upper()] = str(v["cik_str"]).zfill(10)
    out = {}
    for t in tickers:
        pts = []
        if t not in cik:
            out[t] = pts
            continue
        try:
            f = json.loads(get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik[t]}.json"))
        except Exception as e:
            print(f"  {t}: no company facts ({e})")
            out[t] = pts
            continue
        facts = f.get("facts", {})
        for ns, tag in (("dei", "EntityCommonStockSharesOutstanding"), ("us-gaap", "WeightedAverageNumberOfSharesOutstandingBasic")):
            for unit in (facts.get(ns, {}).get(tag, {}).get("units", {}) or {}).values():
                for p in unit:
                    if p.get("val") and p.get("end"):
                        pts.append((p["end"], float(p["val"]), tag[:3]))
            if len([p for p in pts if p[2] == "Ent"]) >= 6:
                break
        out[t] = sorted(set(pts))
        time.sleep(0.15)  # SEC: at most 10 requests a second
    return out


def shares_at(pts, period):
    """shares outstanding nearest the quarter end (within 4 months)"""
    p = date.fromisoformat(period)
    best = None
    for d, v, kind in pts:
        gap = abs((date.fromisoformat(d) - p).days)
        if gap <= 120 and (best is None or gap < best[0] or (gap == best[0] and kind == "Ent")):
            best = (gap, v)
    return best[1] if best else None


def quarter_ends(last, n):
    """the n quarter ends up to and including the last one on or before `last`, oldest first"""
    y, m = last.year, (last.month - 1) // 3 * 3 + 3
    out = []
    while len(out) < n:
        end = date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1)
        if end <= last:
            out.append(end.isoformat())
        m -= 3
        if m <= 0:
            m += 12
            y -= 1
    return out[::-1]


# ---------- weekly top-up from EDGAR ----------
# The bulk file only comes out after each 3-month window closes, so once a week (and every
# day until a catch-up is finished) the job also reads the 13F filings filed on EDGAR since
# the newest bulk file ended: one request per filing (its full .txt), at SEC's pace.
TOPUP_BUDGET_S = 40 * 60
FIELD = lambda tag: re.compile(r"<(?:\w+:)?" + tag + r">\s*([^<]*?)\s*</", re.I)
F_NAME, F_CUSIP, F_VALUE, F_SH, F_TYPE, F_PC = (FIELD(t) for t in ("nameOfIssuer", "cusip", "value", "sshPrnamt", "sshPrnamtType", "putCall"))
INFO = re.compile(r"<(?:\w+:)?infoTable>(.*?)</(?:\w+:)?infoTable>", re.I | re.S)
IDX = re.compile(r"^(13F-HR(?:/A)?)\s+(.*?)\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(edgar/\S+\.txt)\s*$")


def parse_filing(txt):
    """one EDGAR 13F submission (.txt): the filing's facts and its builder rows"""
    hd = lambda rx: (re.search(rx, txt) or [None, ""])[1].strip()
    per, filed = hd(r"CONFORMED PERIOD OF REPORT:\s*(\d{8})"), hd(r"FILED AS OF DATE:\s*(\d{8})")
    if not per:
        return None, []
    iso = lambda d: f"{d[:4]}-{d[4:6]}-{d[6:]}"
    amend = "Y" if re.search(r"<(?:\w+:)?isAmendment>\s*true", txt, re.I) else "N"
    f = {"type": hd(r"CONFORMED SUBMISSION TYPE:\s*(\S+)"), "filed": iso(filed), "period": iso(per), "amend": amend,
         "atype": hd(r"<(?:\w+:)?amendmentType>\s*([^<]*)").upper(), "name": hd(r"COMPANY CONFORMED NAME:\s*(.+)")}
    rows = []
    for blk in INFO.findall(txt):
        g = lambda rx: (rx.search(blk) or [None, ""])[1].strip()
        nm, cu = g(F_NAME), g(F_CUSIP).upper()
        t = next((t for t, rx in NAME_RE if rx.search(nm)), None)
        named = t is not None
        t = t or CUSIP_NET.get(cu[:6])
        if not t or g(F_TYPE).upper() != "SH" or g(F_PC):
            continue
        try:
            sh, val = float(g(F_SH).replace(",", "")), float(g(F_VALUE).replace(",", ""))
        except ValueError:
            continue
        rows.append([t, cu, nm if named else "", round(sh), round(val)])
    return f, rows


def topup(cache, after, force=False):
    cp = os.path.join(cache, "edgar-topup.json")
    st = json.load(open(cp)) if os.path.exists(cp) else {}
    if st.get("after") != after.isoformat():
        st = {"after": after.isoformat(), "rows": [], "filings": {}, "done": [], "caughtUp": False}
    if not (force or date.today().weekday() == 0 or not st.get("caughtUp")):
        print(f"EDGAR top-up: next on Monday ({len(st['filings'])} filings since {after} so far)")
        return st
    done = set(st["done"])
    qs, d = [], after + timedelta(days=1)
    while d <= date.today():
        k = (d.year, (d.month - 1) // 3 + 1)
        if k not in qs:
            qs.append(k)
        d = date(d.year + (d.month == 12), d.month % 12 + 1, 1)
    todo = []
    for y, q in qs:
        try:
            idx = get(f"https://www.sec.gov/Archives/edgar/full-index/{y}/QTR{q}/form.idx").decode("latin-1")
        except RuntimeError as e:
            if "HTTP 404" in str(e) or "HTTP 403" in str(e):
                continue  # a quarter not started yet
            raise
        for line in idx.splitlines():
            m = IDX.match(line)
            if m and m[4] > after.isoformat():
                acc = m[5].rsplit("/", 1)[1][:-4]
                if acc not in done:
                    todo.append((m[4], acc, m[3], m[5]))
    todo.sort()
    t0, n = time.time(), 0
    for filed, acc, cik, path in todo:
        if time.time() - t0 > TOPUP_BUDGET_S:
            break
        try:
            txt = get("https://www.sec.gov/Archives/" + path).decode("utf-8", "replace")
        except RuntimeError as e:
            print(f"  {acc}: {str(e)[:120]}")
            continue
        f, rows = parse_filing(txt)
        if f:
            f["cik"] = cik
            st["filings"][acc] = f
            st["rows"].extend([[acc] + r for r in rows])
        st["done"].append(acc)
        n += 1
        time.sleep(0.11)  # SEC: at most 10 requests a second
    st["caughtUp"] = n == len(todo)
    st["through"] = date.today().isoformat()
    json.dump(st, open(cp, "w"), separators=(",", ":"))
    print(f"EDGAR top-up: read {n} of {len(todo)} new 13F filings since {after} ({time.time() - t0:.0f}s){'' if st['caughtUp'] else ' · the rest next run'}")
    return st


def probe():
    """when nothing downloads: what sec.gov answers this machine, with our contact and without"""
    out = []
    for url in ("https://www.sec.gov/files/company_tickers.json", "https://data.sec.gov/submissions/CIK0001067983.json",
                "https://www.sec.gov/Archives/edgar/full-index/2026/QTR3/form.idx", "https://www.sec.gov/dera/data/form-13f"):
        for label, agent in (("contact", ua()), ("plain", "Mozilla/5.0 (compatible; HousingWidgets/1.0)")):
            try:
                req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": agent, "Accept-Encoding": "gzip, deflate"})
                with urllib.request.urlopen(req, timeout=30) as r:
                    out.append(f"  {r.status} {label:7} {url}")
            except urllib.error.HTTPError as e:
                out.append(f"  {e.code} {label:7} {url}")
            except Exception as e:
                out.append(f"  ERR {label:7} {url}: {str(e)[:80]}")
            time.sleep(0.5)
    try:
        ip = urllib.request.urlopen("https://api.ipify.org", timeout=10).read().decode()
        out.append(f"  (this machine's address: {ip})")
    except Exception:
        pass
    return "\n".join(out)


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", required=True, help="folder for the per-file extracts")
    ap.add_argument("--out", required=True)
    ap.add_argument("--max-new", type=int, default=12, help="bulk files to download this run, at most")
    ap.add_argument("--topup", action="store_true", help="read EDGAR's newest filings today, whatever the day")
    a = ap.parse_args()
    os.makedirs(a.cache, exist_ok=True)

    files = bulk_files()
    latest_end = files[-1][3]
    # the newest quarter whose 45-day filing deadline falls inside the newest file's window
    last_q = max(date.fromisoformat(q) for q in quarter_ends(latest_end, 4) if date.fromisoformat(q) + timedelta(days=45) <= latest_end)
    periods = quarter_ends(last_q, QUARTERS)
    first = date.fromisoformat(periods[0])
    need = [f for f in files if f[3] > first]  # windows that can hold filings for those quarters
    print(f"newest bulk file: {files[-1][0]} · quarters {periods[0]} to {periods[-1]} · {len(need)} files needed")

    sets, new = [], 0
    for name, url, ws, we in need:
        cp = os.path.join(a.cache, name.replace(".zip", ".json"))
        if os.path.exists(cp):
            sets.append(json.load(open(cp)))
            continue
        if new >= a.max_new:
            print(f"  {name}: left for the next run")
            continue
        t0 = time.time()
        blob = None
        for u in (url if isinstance(url, list) else [url]):
            try:
                blob = get(u, tries=2)
                break
            except Exception as e:
                if "HTTP 404" not in str(e) and "HTTP 403" not in str(e):
                    raise
                print(f"  {u}: {str(e)[:160]}")
        if blob is None:
            print(f"  {name}: not posted (or not reachable) yet")
            continue
        x = extract(blob)
        x["file"] = name
        x["window"] = [ws.isoformat(), we.isoformat()]
        json.dump(x, open(cp, "w"), separators=(",", ":"))
        sets.append(x)
        new += 1
        print(f"  {name}: {len(blob) / 1e6:.0f} MB, {len(x['rows'])} builder rows, {len(x['filings'])} filings ({time.time() - t0:.0f}s)")
        time.sleep(1)

    if not sets:
        raise RuntimeError("no SEC bulk file could be read. What sec.gov answers from here:\n" + probe())
    newest = max(sets, key=lambda x: x["window"][1])
    bulk_end = date.fromisoformat(newest["window"][1])
    last_q = max(date.fromisoformat(q) for q in quarter_ends(bulk_end, 4) if date.fromisoformat(q) + timedelta(days=45) <= bulk_end)

    # all filings, and the builder rows by filing
    filings, byacc = {}, {}
    for x in sets:
        filings.update(x["filings"])
        for r in x["rows"]:
            byacc.setdefault(r[0], []).append(r)
    # filings since the newest bulk file, from EDGAR (left out once a bulk file has them)
    tp = topup(a.cache, bulk_end, force=a.topup)
    tp_new = {acc: f for acc, f in tp["filings"].items() if acc not in filings}
    filings.update(tp_new)
    for r in tp["rows"]:
        if r[0] in tp_new:
            byacc.setdefault(r[0], []).append(r)
    # a newer quarter appears once EDGAR has filings for it
    newer = [date.fromisoformat(f["period"]) for f in tp_new.values() if f["type"].startswith("13F-HR") and date.fromisoformat(f["period"]) > last_q]
    partial = None
    if newer:
        nq = max(set(newer), key=newer.count)  # the quarter most of them report
        if len([d for d in newer if d == nq]) >= 50:
            last_q, partial = nq, nq.isoformat()
    periods = quarter_ends(last_q, QUARTERS)

    # which CUSIPs are each builder's stock: by dollar value (names are typed by each filer)
    cus = {}
    for rs in byacc.values():
        for _, t, c, nm, sh, val in rs:
            if nm:  # only rows whose name matched choose the CUSIP
                cus.setdefault(t, {}).setdefault(c[:6], 0)
                cus[t][c[:6]] += val
    issuer = {t: max(v.items(), key=lambda kv: kv[1])[0] for t, v in cus.items() if v}

    # each fund's holdings per quarter: the newest original filing, then amendments
    # (a restatement replaces it; "new holdings" adds what was kept confidential)
    held, names, accof = {}, {}, {}
    perset = set(periods)
    by_fp = {}
    for acc, f in filings.items():
        if f["period"] in perset:
            by_fp.setdefault((f["cik"], f["period"]), []).append((f["filed"], acc, f))
    for (cik, per), lst in by_fp.items():
        lst.sort()
        cur, last_acc = None, None
        for filed, acc, f in lst:
            pos = {}
            for _, t0, c, nm, sh, val in byacc.get(acc, []):
                t = next((k for k, v in issuer.items() if v == c[:6]), None)  # by CUSIP, whatever the name says
                if not t:
                    continue
                p = pos.setdefault(t, [0, 0])
                p[0] += sh
                p[1] += val
            amend = f.get("amend") in ("Y", "TRUE", "1") or f["type"].endswith("/A")
            if not amend or cur is None or "RESTATE" in f.get("atype", ""):
                cur = pos
            else:
                for t, p in pos.items():
                    q = cur.setdefault(t, [0, 0])
                    q[0] += p[0]
                    q[1] += p[1]
            last_acc = acc
            if f.get("name"):
                names[cik] = f["name"]
        held[(cik, per)] = cur or {}
        accof[(cik, per)] = last_acc

    filers = [len({cik for cik, per in held if per == p}) for p in periods]
    tickers = [t for t, _, _ in BUILDERS]
    so = shares_outstanding(tickers)
    shares = {t: [shares_at(so.get(t, []), p) for p in periods] for t in tickers}

    # a row per fund and builder that ever mattered (the widget applies the real thresholds)
    funds = sorted({cik for cik, _ in held})
    pos_out, keep_ciks = [], set()
    totals = {t: [0] * len(periods) for t in tickers}
    holders = {t: [0] * len(periods) for t in tickers}
    for cik in funds:
        for t in tickers:
            sh, val, acc = [], [], []
            for i, p in enumerate(periods):
                h = held.get((cik, p))
                if h is None:
                    sh.append(None); val.append(None); acc.append(None)
                    continue
                v = h.get(t, [0, 0])
                sh.append(v[0]); val.append(v[1]); acc.append(accof[(cik, p)])
                if v[0] > 0:
                    totals[t][i] += v[0]
                    holders[t][i] += 1
            if not any(sh):
                continue
            pct = [(s / shares[t][i] * 100) if (s is not None and shares[t][i]) else None for i, s in enumerate(sh)]
            big = max([x for x in pct if x is not None] or [0])
            moves = [abs(pct[i] - pct[i - 1]) for i in range(1, len(pct)) if pct[i] is not None and pct[i - 1] is not None]
            if cik != BERKSHIRE and big < KEEP_PCT and max(moves or [0]) < KEEP_PCT:
                continue
            keep_ciks.add(cik)
            pos_out.append({"cik": cik, "t": t, "sh": sh, "usd": [None if v is None else round(v / 1e6, 2) for v in val], "acc": acc})

    out = {
        "v": 1,
        "built": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "SEC Form 13F data sets, https://www.sec.gov/dera/data/form-13f",
        "files": [x["file"] for x in sets],
        "newestFile": {"name": newest["file"], "window": newest["window"]},
        "edgar": {"after": tp.get("after"), "through": tp.get("through"), "filings": len(tp_new), "caughtUp": tp.get("caughtUp", False)},
        "partial": partial,  # the newest quarter, while funds are still filing it (from EDGAR)
        "filers": filers,  # funds that filed, per quarter
        "periods": periods,
        "builders": {t: {"name": n, "cusip6": issuer.get(t), "shares": shares[t], "inst": totals[t], "holders": holders[t]} for t, n, _ in BUILDERS},
        "funds": {c: {"name": names.get(c, c), "index": bool(INDEX_RE.search(names.get(c, "")))} for c in sorted(keep_ciks)},
        "pos": pos_out,
        "thresholds": {"keptIfEverPct": KEEP_PCT},
    }
    tmp = a.out + ".tmp"
    json.dump(out, open(tmp, "w"), separators=(",", ":"))
    os.replace(tmp, a.out)
    print(f"wrote {a.out}: {len(keep_ciks)} funds, {len(pos_out)} fund-builder rows, {os.path.getsize(a.out) / 1e3:.0f} KB")
    for t in tickers:
        b = out["builders"][t]
        print(f"  {t}: CUSIP {b['cusip6']} · shares {b['shares'][-1]} · {b['holders'][-1]} holders, {b['inst'][-1]:,} shares in 13Fs")


if __name__ == "__main__":
    main()
