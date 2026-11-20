// A stand-in for the Scriptable app, enough to run a widget script in Node:
// - widget mode: draws the small face (the drawing is recorded, not rendered) and
//   checks what Script.setWidget receives;
// - app mode: every WebView is a real Chromium page (Playwright), so the full view's
//   own code runs as it would on the phone, and hidden helper pages (pdf.js, SheetJS)
//   really parse the files.
// Network: "offline" (made-up FRED, everything else fails, so widgets must cope) or
// "live" (real requests; FRED still made up unless a key is given).
const fs = require("fs");
const path = require("path");
const fred = require("./fred-fake");

const LIBS = {
  // served from node_modules when OFFLINE_LIBS=1 (this machine can't reach the CDNs)
  "jspdf.umd.min.js": "jspdf/dist/jspdf.umd.min.js",
  "html2canvas.min.js": "html2canvas/dist/html2canvas.min.js",
  "xlsx.full.min.js": "xlsx/dist/xlsx.full.min.js",
  "pdf.min.js": "pdfjs-dist/build/pdf.min.js",
  "pdf.worker.min.js": "pdfjs-dist/build/pdf.worker.min.js",
};

function makeEnv(opts) {
  const { mode, net, browser, keychain, presentMs = 6000, log = () => {} } = opts;
  const rec = { httpErrors: [], setWidget: null, widgetUrl: null, faceTexts: [], pages: [], pageErrors: [], alerts: [], requests: [], fetchErrors: [], presented: 0 };
  const any = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => "" : p === "then" ? undefined : p === "length" ? 0 : any), apply: () => any, construct: () => any });

  // ---- files: an in-memory documents folder ----
  const files = {};
  const fm = {
    documentsDirectory: () => "/d", temporaryDirectory: () => "/t", libraryDirectory: () => "/l", cacheDirectory: () => "/c",
    joinPath: (a, b) => a.replace(/\/$/, "") + "/" + b, fileExists: (p) => p in files, isDirectory: () => false, createDirectory: () => {},
    readString: (p) => (p in files ? String(files[p]) : null), writeString: (p, s) => { files[p] = s; },
    write: (p, d) => { files[p] = d; }, read: (p) => (p in files ? files[p] : null), remove: (p) => { delete files[p]; },
    move: (a, b) => { files[b] = files[a]; delete files[a]; }, copy: (a, b) => { files[b] = files[a]; },
    listContents: (dir) => Object.keys(files).filter((p) => p.startsWith(dir + "/")).map((p) => p.slice(dir.length + 1)),
    isFileStoredIniCloud: () => false, isFileDownloaded: () => true, downloadFileFromiCloud: async () => {},
    modificationDate: () => new Date(), creationDate: () => new Date(), fileSize: () => 0, readImage: () => null, fileName: (p) => p.split("/").pop(),
  };

  // ---- Data (what Request.load returns) ----
  const mkData = (buf) => ({ toBase64String: () => buf.toString("base64"), toRawString: () => buf.toString("utf8"), getBytes: () => Array.from(buf), _buf: buf });
  const Data = { fromBase64String: (b) => mkData(Buffer.from(b, "base64")), fromString: (s) => mkData(Buffer.from(String(s), "utf8")), fromFile: () => null, fromPNG: () => mkData(Buffer.alloc(0)), fromJPEG: () => mkData(Buffer.alloc(0)) };

  // ---- Request ----
  class Request {
    constructor(u) { this.url = u; this.headers = {}; this.method = "GET"; this.body = null; this.timeoutInterval = 60; this.response = { statusCode: 0, headers: {} }; }
    async _get() {
      const u = String(this.url);
      rec.requests.push(u);
      if (/api\.stlouisfed\.org/.test(u) && !opts.fredKey) { this.response = { statusCode: 200, headers: {} }; return Buffer.from(JSON.stringify(fred.answer(u))); }
      if (net !== "live") { rec.fetchErrors.push({ url: u, err: "offline" }); throw new Error("The Internet connection appears to be offline."); }
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), Math.min(60, this.timeoutInterval || 60) * 1000);
      try {
        const r = await fetch(u, { method: this.method, headers: this.headers, body: this.body == null ? undefined : (this.body._buf || this.body), redirect: "follow", signal: ctl.signal });
        const buf = Buffer.from(await r.arrayBuffer());
        this.response = { statusCode: r.status, headers: Object.fromEntries(r.headers.entries()), url: r.url };
        if (r.status >= 400) rec.httpErrors.push({ url: u, status: r.status });
        return buf;
      } catch (e) {
        rec.fetchErrors.push({ url: u, err: String(e.cause && e.cause.code || e.message) });
        throw new Error(e.name === "AbortError" ? "The request timed out." : "Could not connect to the server.");
      } finally { clearTimeout(t); }
    }
    async load() { return mkData(await this._get()); }
    async loadString() { return (await this._get()).toString("utf8"); }
    async loadJSON() { return JSON.parse((await this._get()).toString("utf8")); }
    async loadImage() { await this._get(); return { size: { width: 1, height: 1 } }; }
    addParameterToMultipart() {} addFileDataToMultipart() {}
  }

  // ---- WebView: a real Chromium page ----
  async function newPage() {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => { window.ontouchstart = null; });
    if (process.env.OFFLINE_LIBS) {
      await page.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com/, (route) => {
        const name = route.request().url().split("/").pop().split("?")[0];
        const local = LIBS[name] && path.join(__dirname, "node_modules", LIBS[name]);
        if (local && fs.existsSync(local)) return route.fulfill({ path: local, contentType: "application/javascript" });
        return route.abort();
      });
    }
    return page;
  }
  class WebView {
    constructor() { this._ready = newPage(); this.shouldAllowRequest = null; }
    async loadHTML(html) {
      const page = await this._ready;
      this.html = html;
      this.isMain = /printPdf|__takeShare/.test(html) && !rec.pages.some((p) => p.isMain);
      const errs = [];
      page.on("pageerror", (e) => { errs.push(String(e.message || e)); if (this.isMain) rec.pageErrors.push(String(e.message || e)); });
      this.errs = errs;
      if (this.isMain) rec.pages.push({ isMain: true, html, page, wv: this });
      await page.setContent(html, { waitUntil: "load", timeout: 30000 }).catch((e) => log("loadHTML: " + e.message));
    }
    async loadURL(u) { const page = await this._ready; await page.goto(u).catch(() => {}); }
    async loadFile() {}
    async waitForLoad() { const page = await this._ready; await page.waitForLoadState("load").catch(() => {}); }
    async evaluateJavaScript(js, useCallback) {
      const page = await this._ready;
      const run = useCallback
        ? page.evaluate((code) => new Promise((res, rej) => { window.completion = res; try { (0, eval)(code); } catch (e) { rej(e); } }), js)
        : page.evaluate((code) => { const v = (0, eval)(code); return v === undefined ? null : v; }, js);
      return await run;
    }
    async getHTML() { const page = await this._ready; return page.content(); }
    async present() {
      rec.presented++;
      // the person looks for a while, then closes it
      await new Promise((r) => setTimeout(r, presentMs));
    }
  }

  // ---- drawing: recorded ----
  class DrawContext {
    constructor() { this.size = { width: 170, height: 170 }; this.respectScreenScale = false; this.opaque = false; }
    drawTextInRect(t) { rec.faceTexts.push(String(t)); }
    drawText(t) { rec.faceTexts.push(String(t)); }
    getImage() { return { size: this.size, _face: true }; }
  }
  const dcNoop = ["setFillColor", "setStrokeColor", "setLineWidth", "fillRect", "fillEllipse", "strokeRect", "strokeEllipse", "addPath", "fillPath", "strokePath", "setFont", "setTextColor", "setTextAlignedLeft", "setTextAlignedCenter", "setTextAlignedRight", "drawImageInRect", "drawImageAtPoint"];
  dcNoop.forEach((m) => { DrawContext.prototype[m] = function () {}; });
  class Path { constructor() {} move() {} addLine() {} addLines() {} addRect() {} addRoundedRect() {} addEllipse() {} addQuadCurve() {} addCurve() {} closeSubpath() {} }

  // ---- ListWidget: records what the home screen would get ----
  class ListWidget {
    constructor() { this.texts = []; }
    addText(t) { this.texts.push(String(t)); return new Proxy({}, { get: () => any, set: () => true }); }
    addStack() { const s = new ListWidget(); this.texts.push(s); return s; }
    addSpacer() { return any; } addImage() { return new Proxy({}, { get: () => any, set: () => true }); } addDate() { return new Proxy({}, { get: () => any, set: () => true }); }
    setPadding() {} useDefaultPadding() {}
    async presentSmall() { rec.setWidget = this; } async presentMedium() { rec.setWidget = this; } async presentLarge() { rec.setWidget = this; }
    centerAlignContent() {} topAlignContent() {} bottomAlignContent() {} layoutHorizontally() {} layoutVertically() {}
  }

  const RUN_URL = "scriptable:///run/" + encodeURIComponent(opts.name || "Widget");
  class Alert {
    constructor() { this.actions = []; this.title = ""; this.message = ""; }
    addAction(a) { this.actions.push(a); } addDestructiveAction(a) { this.actions.push(a); } addCancelAction() {}
    addTextField() {} addSecureTextField() {} textFieldValue() { return ""; }
    async present() { rec.alerts.push(`${this.title}: ${this.message}`.slice(0, 300)); return -1; }
    async presentAlert() { return this.present(); } async presentSheet() { return this.present(); }
  }
  const keys = keychain || {};
  const G = {
    config: { runsInWidget: mode === "widget", runsInApp: mode !== "widget", runsInActionExtension: false, runsWithSiri: false, runsInNotification: false, widgetFamily: mode === "widget" ? "small" : null },
    args: { widgetParameter: null, queryParameters: {}, plainTexts: [], urls: [], fileURLs: [], images: [] },
    module: { filename: "/s/" + (opts.name || "Widget") + ".js", exports: {} },
    Keychain: { contains: (k) => k in keys, get: (k) => { if (!(k in keys)) throw new Error("no " + k); return keys[k]; }, set: (k, v) => { keys[k] = v; }, remove: (k) => { delete keys[k]; } },
    FileManager: { local: () => fm, iCloud: () => fm },
    Request, Data, WebView, DrawContext, Path, ListWidget, Alert,
    Color: class { constructor(h, a) { this.hex = h; this.alpha = a == null ? 1 : a; } static dynamic(a) { return a; } static white() { return new this("#FFFFFF"); } static black() { return new this("#000000"); } static clear() { return new this("#000000", 0); } static gray() { return new this("#808080"); } static red() { return new this("#FF0000"); } static orange() { return new this("#FF9500"); } static yellow() { return new this("#FFCC00"); } static green() { return new this("#34C759"); } static blue() { return new this("#007AFF"); } },
    Font: new Proxy({}, { get: () => () => ({}) }),
    Size: class { constructor(w, h) { this.width = w; this.height = h; } },
    Rect: class { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h, minX: x, minY: y, maxX: x + w, maxY: y + h }); } },
    Point: class { constructor(x, y) { this.x = x; this.y = y; } },
    LinearGradient: class { constructor() { this.colors = []; this.locations = []; } },
    // offline, timers run fast to keep the gate quick; live, they keep real time (a widget's
    // own "took too long" limit must not fire early)
    Timer: { schedule: (ms, rep, f) => { const t = (rep ? setInterval : setTimeout)(f, net === "live" ? ms : Math.min(ms, 200)); return { invalidate() { clearTimeout(t); clearInterval(t); } }; } },
    Script: { complete() {}, setWidget(w) { rec.setWidget = w; }, name: () => opts.name || "Widget", setShortcutOutput() {} },
    URLScheme: { forRunningScript: () => RUN_URL, forOpeningScript: () => RUN_URL.replace("/run/", "/open/") },
    Safari: { open() {}, openInApp: async () => {} },
    QuickLook: { present: async () => {} }, ShareSheet: { present: async () => [] }, DocumentPicker: { open: async () => [], export: async () => [], exportString: async () => [] },
    Pasteboard: { copy() {}, copyString() {}, paste: () => null, pasteString: () => null },
    Speech: { speak: async () => {} }, Notification: class { schedule() {} static async removePending() {} static async allPending() { return []; } },
    Device: { locale: () => "en_US", language: () => "en", isUsingDarkAppearance: () => true, screenScale: () => 3, screenSize: () => ({ width: 390, height: 844 }), model: () => "iPhone", systemVersion: () => "18.0" },
    SFSymbol: { named: (n) => ({ name: n, image: { size: { width: 20, height: 20 } }, applyFont() {}, applyLightWeight() {}, applyRegularWeight() {}, applyMediumWeight() {}, applySemiboldWeight() {}, applyBoldWeight() {}, applyHeavyWeight() {}, applyBlackWeight() {}, applyThinWeight() {}, applyUltraLightWeight() {} }) },
    Location: { current: async () => { throw new Error("no location"); } }, Image: { fromData: () => ({ size: { width: 1, height: 1 } }), fromFile: () => null },
    UITable: any, UITableRow: any, UITableCell: any, CallbackURL: any, Message: any, Mail: any, Calendar: any, CalendarEvent: any, Reminder: any, Contact: any, Photos: any, Dictation: any, Uuid: { string: () => "00000000-0000-0000-0000-000000000000" },
    importModule: () => { throw new Error("importModule isn't available in tests"); },
    console: { log: (...a) => log(a.join(" ")), warn: (...a) => log(a.join(" ")), error: (...a) => log(a.join(" ")) },
  };
  return { G, rec, files };
}

async function runScript(src, env, killMs) {
  const names = Object.keys(env.G);
  const fn = new Function(...names, "return (async () => {" + src + "\n})();");
  let timer;
  const kill = new Promise((r) => { timer = setTimeout(() => r({ status: "timeout" }), killMs); });
  const run = fn(...names.map((n) => env.G[n])).then(() => ({ status: "ok" }), (e) => ({ status: "threw", err: String((e && e.stack) || e) }));
  const out = await Promise.race([run, kill]);
  clearTimeout(timer);
  return out;
}

module.exports = { makeEnv, runScript };
