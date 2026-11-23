// ---------- Fix panel: script side (shared) ----------
// The release schedule's Fix panel asks through window.__takeFix (Retry now, Copy
// report) and window.__takeOpen (Open the source). Each widget's full view sets
// FIX_RETRY to a function that refreshes everything and updates the page; while it
// runs, FIX_FORCE (and FRED_FORCE, where a widget asks FRED) skip "checked recently".
// tools/fix_kit_script.js is the master copy; tools/sync_fix_kit.py puts it in each widget.
let FIX_FORCE = false;
let FIX_RETRY = null;
// the publisher's page for a schedule row, by its name (FRED rows carry their own)
const FIX_PAGES = [
  [/^NY Fed household debt/, "https://www.newyorkfed.org/microeconomics/hhdc"],
  [/^Freddie Mac delinquency/, "https://www.freddiemac.com/investors/financials/monthly-volume-summaries"],
  [/^MBA forecast/, "https://www.mba.org/news-and-research/forecasts-and-commentary"],
  [/^MBA weekly/, "https://www.mba.org/news-and-research/newsroom"],
  [/^NY Fed housing survey/, "https://www.newyorkfed.org/microeconomics/sce/housing"],
  [/^NY Fed survey: job/, "https://www.newyorkfed.org/microeconomics/sce/labor"],
  [/^Pro forecasters/, "https://www.philadelphiafed.org/surveys-and-data/real-time-data-research/survey-of-professional-forecasters"],
  [/^Closings \(Zillow\)/, "https://www.zillow.com/research/data/"],
  [/^Treasury yields/, "https://www.federalreserve.gov/releases/h15/"],
  [/^Layoffs in the news/, "https://www.gdeltproject.org/"],
  [/^Optimal Blue/, "https://fred.stlouisfed.org/series/OBMMIC30YF"],
  [/^Freddie Mac 30-yr/, "https://fred.stlouisfed.org/series/MORTGAGE30US"],
  [/^MOVE index/, "https://finance.yahoo.com/quote/%5EMOVE/"],
  [/^For-sale starts/, "https://www.census.gov/construction/nrc/index.html"],
  [/^Stock prices|^Market caps/, "https://finance.yahoo.com/"],
  [/^Shares outstanding/, "https://www.sec.gov/edgar/search/"],
];
function fixPages(rows) {
  (rows || []).forEach((r) => {
    if (r.page) return;
    if (r.series) { r.page = "https://fred.stlouisfed.org/series/" + r.series; return; }
    const hit = FIX_PAGES.find((p) => p[0].test(r.name || ""));
    if (hit) r.page = hit[1];
  });
  return rows;
}
// one look at the page: answer a Fix request or an Open-the-source tap
async function fixPoll(wv) {
  let fx = null;
  try { fx = await wv.evaluateJavaScript("window.__takeFix ? window.__takeFix() : null"); } catch (e) {}
  if (fx) {
    let req = {};
    try { req = JSON.parse(fx); } catch (e) {}
    let res = { key: req.key, ok: true };
    if (req.action === "copy") { Pasteboard.copyString(String(req.text || "").replace("__FIX_NAME__", () => Script.name())); res.msg = "Copied. Paste it to Claude."; }
    else if (req.action === "retry") {
      if (!FIX_RETRY) res = { key: req.key, ok: false, msg: "Retry works once the page has finished its first load; try again in a moment." };
      else {
        FIX_FORCE = true;
        try { FRED_FORCE = true; } catch (e) {}
        try { await FIX_RETRY(); res.after = true; }
        catch (e) { res = { key: req.key, ok: false, msg: "Retry failed: " + String((e && e.message) || e).slice(0, 160) }; }
        finally { FIX_FORCE = false; try { FRED_FORCE = false; } catch (e) {} }
      }
    }
    try { await wv.evaluateJavaScript(`window.fixDone && window.fixDone(${JSON.stringify(res)});0`); } catch (e) {}
  }
  let u = null;
  try { u = await wv.evaluateJavaScript("window.__takeOpen ? window.__takeOpen() : null"); } catch (e) {}
  if (u) { try { await Safari.openInApp(u, false); } catch (e) { try { Safari.open(u); } catch (e2) {} } }
}
// ---------- end Fix panel (script) ----------
