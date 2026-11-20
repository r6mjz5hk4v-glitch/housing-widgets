// A made-up FRED: every series id gets a stable, plausible-looking random walk from 2000
// to yesterday, in its usual frequency. Enough for widgets to draw; the numbers mean nothing.
function seed(id) { let h = 2166136261; for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
function freqOf(id, q) {
  if (q) return q;
  if (/^(DGS|DTB|SOFR|T10Y|T5Y|DFF|DPRIME|BAML|DCOIL|DHHN|OBMMI|RIFSP|EFFR|IORB|VIX|SP500|DEX|DFII|THREEF|RRP|RPON)/.test(id)) return "d";
  if (/^(MORTGAGE|WM|ICSA|IC4W|CCSA|GASREG|WALCL|WRESBAL)/.test(id)) return "w";
  if (/(GDP|^ECI|^MDSP|^TDSP|^DRSFR|^DRCC|^Q[A-Z]|^RHORUSQ|^RRVRUSQ|^HCAI|^NCBDBIQ|^BOGZ|Q$)/.test(id)) return "q";
  if (/^(PCECTPI|FEDTARMD|UNRATEMD|GDPC1MD)/.test(id)) return "a";
  return "m";
}
function fredObs(id, start, f) {
  let x = seed(id), v = 2 + (x % 400) / 50, out = [];
  const rnd = () => { x = Math.imul(x ^ (x >>> 15), 2246822507) >>> 0; return (x % 10000) / 10000 - 0.5; };
  const big = /INDEX|CPI|PCEPI|HPI|CSUSHPI|USSTHPI|MSPUS|ASPUS|PAYEMS|HOUST|PERMIT|HSN1F|EXHOSLUS|TTLCONS|TOTALSA|RSAFS|DSPIC|PSAVE|INDPRO|^CE|^CU|IR$|PPI|WPU|AHE|^CES/.test(id);
  if (big) v = 100 + (x % 200);
  const d0 = new Date((start && start > "1960" ? start : "2000-01-01") + "T00:00:00Z"), end = new Date(Date.now() - 864e5);
  const step = { d: 1, w: 7 }[f];
  for (let d = new Date(d0); d <= end; ) {
    const wd = d.getUTCDay();
    if (!(f === "d" && (wd === 0 || wd === 6))) { v = Math.max(0.05, v * (1 + rnd() * (big ? 0.004 : 0.03)) + (big ? v * 0.0025 : 0)); out.push({ date: d.toISOString().slice(0, 10), value: v.toFixed(big ? 1 : 2), realtime_start: new Date().toISOString().slice(0, 10), realtime_end: "9999-12-31" }); }
    if (step) d.setUTCDate(d.getUTCDate() + step);
    else if (f === "q") d.setUTCMonth(d.getUTCMonth() + 3);
    else if (f === "a") d.setUTCFullYear(d.getUTCFullYear() + 1);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}
function fred(url) {
  const u = new URL(url), id = u.searchParams.get("series_id") || "", P = u.pathname;
  if (P.endsWith("/series/observations")) {
    let obs = fredObs(id, u.searchParams.get("observation_start"), freqOf(id, u.searchParams.get("frequency")));
    if (u.searchParams.get("sort_order") === "desc") obs = obs.reverse();
    const lim = +u.searchParams.get("limit"); if (lim) obs = obs.slice(0, lim);
    return { observations: obs, count: obs.length };
  }
  if (P.endsWith("/series/release")) return { releases: [{ id: 10, name: "Release" }] };
  if (P.endsWith("/release/dates")) { const ds = []; for (let m = 0; m < 30; m++) { const d = new Date(Date.UTC(2025, m, 14)); ds.push({ release_id: 10, date: d.toISOString().slice(0, 10) }); } return { release_dates: u.searchParams.get("sort_order") === "desc" ? ds.reverse() : ds }; }
  if (P.endsWith("/series/vintagedates")) return { vintage_dates: [new Date().toISOString().slice(0, 10)] };
  if (P.endsWith("/series")) return { seriess: [{ id, title: id, units: "Percent", frequency: "Monthly", last_updated: "2026-11-14 07:44:01-06", observation_end: "2026-10-01" }] };
  return { error_message: "unknown" };
}

module.exports = { answer: fred };
