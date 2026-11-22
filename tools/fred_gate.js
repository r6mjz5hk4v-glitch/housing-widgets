// ---------- FRED: ask only when needed (shared by every FRED widget) ----------
// All widgets share one FRED key and FRED allows 120 requests a minute, so:
// - every answer is saved in one cache all widgets share (Documents/fred-cache);
// - a series is asked again only after its next scheduled release (FRED's own release
//   calendar, re-read weekly); if the new number isn't in yet, at most every 3 hours;
//   daily and month-to-date series at most hourly; anything at least weekly;
// - a shared log keeps everyone under 90 requests a minute; on "429 Too Many Requests"
//   the app waits and tries again, the home-screen widget keeps the saved answer;
// - FRED_FORCE (the Fix panel's Retry now) skips the cache.
// tools/fred_gate.js is the master copy; tools/sync_fred_gate.py puts it in each widget.
let FRED_FORCE = false;
const FRED_DIR = "fred-cache";
function fredFm() { const fm = FileManager.local(), d = fm.joinPath(fm.documentsDirectory(), FRED_DIR); try { if (!fm.fileExists(d)) fm.createDirectory(d, true); } catch (e) {} return { fm, d }; }
function fredRead(name) { try { const { fm, d } = fredFm(), p = fm.joinPath(d, name); return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null; } catch (e) { return null; } }
function fredWrite(name, o) { try { const { fm, d } = fredFm(); fm.writeString(fm.joinPath(d, name), JSON.stringify(o)); } catch (e) {} }
function fredKeyOf(url) {
  const q = url.replace(/[?&]api_key=[^&]*/, "").replace("https://api.stlouisfed.org/fred/", "");
  let h = 2166136261;
  for (let i = 0; i < q.length; i++) { h ^= q.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return (q.match(/series_id=([A-Za-z0-9_]+)/) || q.match(/release_id=(\d+)/) || ["", "x"])[1] + "-" + h.toString(16) + ".json";
}
// Central time, as "YYYY-MM-DD" and the hour
function fredCT(ms) {
  const t = new Date(ms), p = {};
  try { new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(t).forEach((x) => { p[x.type] = x.value; }); }
  catch (e) { const u = new Date(ms - 6 * 3600e3); return { day: u.toISOString().slice(0, 10), hour: u.getUTCHours() }; }
  return { day: `${p.year}-${p.month}-${p.day}`, hour: +p.hour % 24 };
}
// keep under FRED's limit: a request log all widgets share
async function fredSlot() {
  const maxWait = config.runsInWidget ? 3000 : 90000, t0 = Date.now();
  for (;;) {
    const now = Date.now(), log = (fredRead("log.json") || []).filter((t) => now - t < 60000);
    if (log.length < 90 || now - t0 > maxWait) { log.push(now); fredWrite("log.json", log); return; }
    await new Promise((r) => Timer.schedule(Math.min(60000 - (now - log[0]) + 100, 3000), false, r));
  }
}
async function fredFetch(url, secs) {
  for (let attempt = 0; ; attempt++) {
    await fredSlot();
    const r = new Request(url);
    r.timeoutInterval = secs || 20;
    let j = null, failed = null;
    try { j = await r.loadJSON(); } catch (e) { failed = e; }
    const code = (r.response && r.response.statusCode) || 0;
    if (code === 429) {
      if (!config.runsInWidget && attempt < 2) { await new Promise((res) => Timer.schedule(attempt ? 30000 : 15000, false, res)); continue; }
      const e = new Error("api.stlouisfed.org answered HTTP 429: too many requests this minute (all your widgets share one FRED key); try again in a minute");
      e.code = 429; throw e;
    }
    if (failed) throw new Error(`couldn't reach api.stlouisfed.org (${String((failed && failed.message) || failed).slice(0, 60)})`);
    if (code >= 400 && !(j && j.error_message)) throw new Error(`api.stlouisfed.org answered HTTP ${code}`);
    return { j, ok: code < 400 && j && !j.error_message };
  }
}
// a series' release dates (past and scheduled), from FRED's calendar: which release a
// series belongs to is asked once; each release's dates are re-read weekly (series share them)
async function fredReleaseDays(sid, key) {
  const base = `https://api.stlouisfed.org/fred`;
  try {
    let idr = fredRead(`relid-${sid}.json`);
    if (!idr || (idr.id == null && Date.now() - idr.at > 30 * 864e5)) {
      const rel = (await fredFetch(`${base}/series/release?series_id=${sid}&api_key=${key}&file_type=json`)).j;
      idr = { at: Date.now(), id: (rel && rel.releases && rel.releases[0] && rel.releases[0].id) || null };
      fredWrite(`relid-${sid}.json`, idr);
    }
    if (idr.id == null) return null;
    const rk = `reldates-${idr.id}.json`, kept = fredRead(rk);
    if (kept && Date.now() - kept.at < 7 * 864e5) return kept.days;
    try {
      const r = (await fredFetch(`${base}/release/dates?release_id=${idr.id}&api_key=${key}&file_type=json&include_release_dates_with_no_data=true&sort_order=desc&limit=40`)).j;
      const days = ((r && r.release_dates) || []).map((x) => x.date).sort();
      fredWrite(rk, { at: Date.now(), days });
      return days;
    } catch (e) { return kept ? kept.days : null; }
  } catch (e) { return null; }
}
// does this cached answer need asking again?
async function fredDue(url, c) {
  const now = Date.now(), age = now - c.at;
  if (age > 7 * 864e5) return true; // weekly: revisions, missed releases
  if (!/\/series\/observations\?/.test(url)) return age > (/\/release\/dates\?/.test(url) ? 7 * 864e5 : 864e5); // calendars and the like
  const obs = (c.j && c.j.observations) || [], n = obs.length;
  const gap = n > 1 ? (Date.parse(obs[n - 1].date) - Date.parse(obs[n - 2].date)) / 864e5 : 30;
  if (gap < 6 || /[?&]frequency=/.test(url)) return age > 3600e3; // daily, or month-to-date averages
  const sid = (url.match(/series_id=([A-Za-z0-9_]+)/) || [])[1];
  const days = sid ? await fredReleaseDays(sid, (url.match(/api_key=([^&]+)/) || [])[1]) : null;
  if (!days || !days.length) return age > 6 * 3600e3; // no calendar: every 6 hours
  const ct = fredCT(now), fetched = fredCT(c.at);
  // the latest release day that has started (from 7am Central)
  const past = days.filter((d) => d < ct.day || (d === ct.day && ct.hour >= 7));
  const last = past[past.length - 1];
  if (!last) return false;
  if (fetched.day < last || (fetched.day === last && fetched.hour < 7)) return true; // first look after a release
  // released but the new number wasn't there: look again every 3 hours for 5 days
  const daysSince = (Date.parse(ct.day) - Date.parse(last)) / 864e5;
  return (c.changed || 0) < Date.parse(last + "T12:00:00Z") && daysSince <= 5 && age > 3 * 3600e3;
}
// the one way widgets ask FRED: returns FRED's JSON (with error_message when FRED says no)
async function fredJSON(url, secs) {
  const k = fredKeyOf(url), c = fredRead(k);
  if (c && !FRED_FORCE && !(await fredDue(url, c))) return c.j;
  let got;
  try { got = await fredFetch(url, secs); }
  catch (e) { if (c && e.code === 429 && config.runsInWidget) return c.j; throw e; }
  if (got.ok) {
    const lastOf = (j) => { const o = (j && j.observations) || []; return o.length ? o[o.length - 1].date + "=" + o[o.length - 1].value + "#" + o.length : JSON.stringify(j).length; };
    const changed = !c || lastOf(c.j) !== lastOf(got.j) ? Date.now() : c.changed || c.at;
    fredWrite(k, { at: Date.now(), changed, j: got.j });
  }
  return got.j;
}
// ---------- end FRED ----------
