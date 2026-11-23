// ---------- Black-screen guard (shared by every widget with a full view) ----------
// iOS runs each web page in its own process and sometimes kills it (low memory, a cold
// launch from a widget tap): the view keeps its Close button but goes black, and nothing
// tells the script. So while the full view is open, check that the page is alive; if it
// isn't, draw it again (twice at most) and say so in a small gray note (kept out of PDFs).
// tools/page_guard.js is the master copy; tools/sync_page_guard.py puts it in each widget.
let UPD_LAST = null; // the main full view's latest loadHTML arguments
function updArgs(html, base) {
  const a = base === undefined ? [updPage(html)] : [updPage(html), base];
  if (typeof html === "string" && (html.indexOf("__takeShare") >= 0 || html.indexOf("<title>Reports</title>") >= 0)) UPD_LAST = a;
  return a;
}
async function updWatch(wv, isOpen) {
  const nap = (ms) => new Promise((r) => Timer.schedule(ms, false, r));
  let redraws = 0, slow = 0, wait = 3000;
  while (isOpen()) {
    await nap(wait);
    wait = 10000;
    if (!isOpen() || !UPD_LAST) continue;
    // alive: answers, and has drawn something. A page busy for a while (building a PDF)
    // doesn't answer at once: only two slow checks in a row count as dead
    let st = "dead";
    try {
      const r = await Promise.race([wv.evaluateJavaScript("(document.body && document.body.innerText.length > 20) ? 1 : 0"), nap(15000).then(() => "slow")]);
      st = r === "slow" ? "slow" : r === 1 ? "ok" : "dead";
    } catch (e) {}
    if (st === "ok") { slow = 0; continue; }
    if (st === "slow" && ++slow < 2) continue;
    if (!isOpen()) break;
    slow = 0;
    if (redraws >= 2) {
      try { await wv.loadHTML('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:28px 20px;background:#000;color:#FF9F0A;font:16px -apple-system,sans-serif;line-height:1.45"><b>The page keeps going black.</b><br><br>iOS dropped it three times, which usually means the phone is short on memory. Close this, close a few other apps, and open the widget again.</body></html>'); } catch (e) {}
      break;
    }
    redraws++;
    try { await wv.loadHTML(...UPD_LAST); } catch (e) {}
    const note = "iOS dropped this page; redrawn" + (redraws > 1 ? " (" + redraws + "×)" : "");
    try {
      await wv.evaluateJavaScript(`(function () { var b = document.body; if (!b) return 0; var d = document.createElement("div"); d.className = "hint"; d.id = "hwRedrawn"; d.textContent = ${JSON.stringify(note)}; d.style.cssText = "color:#8E8E93;font-size:11.5px;margin:4px 0 6px"; var t = document.querySelector("h1,.ticker,.title"); if (t && t.parentNode) t.parentNode.insertBefore(d, t.nextSibling); else b.insertBefore(d, b.firstChild); return 1; })()`);
    } catch (e) {}
  }
}
// ---------- end black-screen guard ----------
