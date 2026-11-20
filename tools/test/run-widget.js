// Runs one script once, in one mode, and writes what happened as JSON.
// node run-widget.js <Script.js> <widget|app> <out.json>   (env NET=offline|live)
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { makeEnv, runScript } = require("./scriptable");

const [file, mode, outFile] = process.argv.slice(2);
const ROOT = path.resolve(__dirname, "../..");
const name = file.replace(/\.js$/, "");
const NET = process.env.NET || "offline";

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch();
  const logs = [];
  const env = makeEnv({
    mode, net: NET, browser, name,
    presentMs: +(process.env.PRESENT_MS || (NET === "live" ? 90000 : 8000)),
    keychain: { fred_api_key: "0".repeat(32), sec_contact: "Housing Widgets test test@example.com", home_metro: "Austin, TX" },
    log: (s) => logs.push(String(s).slice(0, 300)),
  });
  const src = fs.readFileSync(path.join(ROOT, "widgets", file), "utf8");
  const res = await runScript(src, env, +(process.env.KILL_MS || (NET === "live" ? 240000 : 60000)));
  const rec = env.rec;
  const out = {
    file, mode, net: NET, status: res.status, err: res.err || null, ms: Date.now() - t0,
    setWidget: !!rec.setWidget, widgetUrl: rec.setWidget ? rec.setWidget.url || null : null,
    face: rec.setWidget ? (rec.setWidget.backgroundImage && rec.setWidget.backgroundImage._face ? "drawn" : "text") : null,
    faceTexts: rec.faceTexts.slice(0, 40), widgetTexts: rec.setWidget ? (rec.setWidget.texts || []).filter((x) => typeof x === "string").slice(0, 10) : [],
    presented: rec.presented, mainPage: rec.pages.length > 0, pageErrors: rec.pageErrors.slice(0, 10), alerts: rec.alerts.slice(0, 10),
    requests: rec.requests.length, fetchErrors: rec.fetchErrors.slice(0, 50), logs: logs.slice(-20), pdf: null, store: null,
  };
  // the full view: does Share as PDF still build?
  const main = rec.pages.find((p) => p.isMain);
  if (main) {
    const page = main.page;
    try {
      const has = await page.evaluate(() => typeof window.printPdf === "function");
      if (has) {
        const jspdf = process.env.OFFLINE_LIBS ? { path: path.join(__dirname, "node_modules/jspdf/dist/jspdf.umd.min.js") } : { url: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" };
        await page.addScriptTag(jspdf);
        out.pdf = await page.evaluate(() => {
          try { const d = window.printPdf(window.jspdf.jsPDF, null); return { ok: true, pages: d.getNumberOfPages(), bytes: d.output("arraybuffer").byteLength }; }
          catch (e) { return { ok: false, err: String(e && e.message || e) }; }
        });
      }
      const dir = path.join(path.dirname(outFile), "shots");
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `${name}-${mode}.png`), fullPage: false });
    } catch (e) { out.pdf = { ok: false, err: "couldn't run Share as PDF: " + String(e.message || e) }; }
    out.pageErrors = rec.pageErrors.slice(0, 10);
  }
  // what the script saved (for the nightly run: which sources came back)
  const stores = Object.entries(env.files).filter(([p, v]) => p.startsWith("/d/") && /\.json$/.test(p) && typeof v === "string");
  out.store = Object.fromEntries(stores.map(([p, v]) => { try { return [p.slice(3), JSON.parse(v)]; } catch (e) { return [p.slice(3), null]; } }));
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  await browser.close().catch(() => {});
  process.exit(0);
})().catch((e) => { fs.writeFileSync(outFile, JSON.stringify({ file, mode, status: "harness-error", err: String(e.stack || e) })); process.exit(0); });
