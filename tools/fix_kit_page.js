// ---------- Fix panel: page side (shared by the widgets with the standard release schedule) ----------
// Late rows get "Fix ›": details, Retry now, Open the source, Copy report for Claude.
// Page code: no backticks, no dollar-brace, no backslashes. Master copy: tools/fix_kit_page.js.
var FIXOPEN = {}, FIXMSG = {}, FIXBUSY = {}, FIXNOTE = "";
(function () {
  var css = document.createElement("style");
  css.textContent = ".fixBtn{display:inline-block;margin-top:5px;font:inherit;font-size:11.5px;font-weight:600;color:#FF9F0A;background:rgba(255,159,10,0.14);border:none;border-radius:8px;padding:4px 10px}" +
    ".fixPanel{margin:2px 0 8px;padding:9px 10px;border-radius:10px;background:#1C1C1E;border:1px solid #3A3A3C;font-size:11.5px;color:#C7C7CC;line-height:1.4}" +
    ".fixPanel b{color:#E5E5EA;font-weight:600}.fixPanel .err{color:#FF9F0A;word-break:break-word}" +
    ".fixActs{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.fixActs button{flex:1 1 auto;font:inherit;font-size:12px;font-weight:600;color:#E5E5EA;background:#2C2C2E;border:none;border-radius:9px;padding:8px;min-height:34px}" +
    ".fixActs button.primary{color:#1C1C1E;background:#FF9F0A}.fixActs button:disabled{opacity:0.5}" +
    ".fixMsg{margin-top:7px;color:#98989F;font-size:11.5px}.fixMsg.ok{color:#30D158}.fixMsg.bad{color:#FF9F0A}";
  document.head.appendChild(css);
})();
function fixCT(t) {
  if (!t) return "never";
  try { return new Date(t).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " CT"; }
  catch (e) { return String(t); }
}
function fixHost(u) { var m = String(u || "").match(/^https?:..([^/]+)/); return m ? m[1] : ""; }
function fixText(h) { var d = document.createElement("div"); d.innerHTML = h || ""; return d.textContent; }
function fixRow(k) { return (window.__sched || []).filter(function (r) { return r.name === k; })[0]; }
function fixBtn(r) { return '<button class="fixBtn" data-fix="' + schedEsc(r.name) + '">' + (FIXOPEN[r.name] ? "Close ‹" : "Fix ›") + "</button>"; }
function fixPanel(r, st) {
  var m = FIXMSG[r.name], busy = FIXBUSY[r.name];
  return '<div class="fixPanel">' +
    "<div><b>Status:</b> " + schedEsc(fixText(st.main)) + (st.sub ? ", " + schedEsc(fixText(st.sub)) : "") + "</div>" +
    "<div><b>Last checked:</b> " + schedEsc(fixCT(r.checked)) + "</div>" +
    (r.err ? '<div><b>Error:</b> <span class="err">' + schedEsc(r.err) + "</span></div>" : "<div><b>Error:</b> none; the source answered, but the new release isn't in it yet.</div>") +
    (r.page ? "<div><b>Source:</b> " + schedEsc(fixHost(r.page)) + "</div>" : "") +
    '<div class="fixActs"><button class="primary" data-fixkey="' + schedEsc(r.name) + '" data-fixact="retry"' + (busy ? " disabled" : "") + ">" + (busy ? "Refreshing…" : "Retry now") + "</button>" +
    (r.page ? '<button data-fixkey="' + schedEsc(r.name) + '" data-fixact="open">Open the source</button>' : "") +
    '<button data-fixkey="' + schedEsc(r.name) + '" data-fixact="copy">Copy report for Claude</button></div>' +
    (m ? '<div class="fixMsg ' + (m.ok ? "ok" : "bad") + '">' + schedEsc(m.msg) + "</div>" : "") + "</div>";
}
function fixReport(r, st) {
  var NL = String.fromCharCode(10);
  var when = function (t) { if (!t || isNaN(Date.parse(t))) return t || "?"; return r.approx ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : fixCT(t); };
  return ["Housing Widgets · " + (document.title || "__FIX_NAME__") + ": source not coming through",
    "Source: " + r.name + (r.every ? " (" + r.every + ")" : ""),
    "Status: " + fixText(st.main) + (st.sub ? ", " + fixText(st.sub) : ""),
    "Latest data shown: " + r.last,
    "Due: " + when(r.next) + (r.to && r.to !== r.next ? " to " + when(r.to) : ""),
    "Last checked: " + fixCT(r.checked),
    "Error: " + (r.err || "none (source answered; release not in it yet)"),
    "Why shown: " + schedWhy(r),
    "Source page: " + (r.page || "none listed"),
    "Report made: " + fixCT(Date.now())].join(NL);
}
document.addEventListener("click", function (e) {
  var t = e.target && e.target.closest ? e.target.closest("[data-fix],[data-fixact]") : null;
  if (!t) return;
  var k = t.getAttribute("data-fix");
  if (k != null) { FIXOPEN[k] = !FIXOPEN[k]; renderSched(window.__sched); return; }
  var key = t.getAttribute("data-fixkey"), act = t.getAttribute("data-fixact"), r = fixRow(key);
  if (!r) return;
  if (act === "open") { if (r.page) window.__openUrl = r.page; return; }
  if (act === "retry") { FIXBUSY[key] = true; FIXMSG[key] = null; FIXNOTE = ""; window.__fixReq = { key: key, action: "retry" }; }
  if (act === "copy") window.__fixReq = { key: key, action: "copy", text: fixReport(r, schedState(r)) };
  renderSched(window.__sched);
});
window.__takeFix = function () { var q = window.__fixReq; window.__fixReq = null; return q ? JSON.stringify(q) : null; };
window.__takeOpen = function () { var u = window.__openUrl; window.__openUrl = null; return u || null; };
window.fixDone = function (res) {
  if (!res || res.key == null) return;
  FIXBUSY[res.key] = false;
  var r = fixRow(res.key), st = r ? schedState(r) : null;
  if (res.after) res = { key: res.key, ok: !(st && st.late), msg: !r ? "Refreshed." : st.late ? "Still late after refreshing. " + schedWhy(r) : "Up to date now: latest " + r.last + "." };
  FIXMSG[res.key] = res;
  if (r && st && st.late) FIXOPEN[res.key] = true;
  else { FIXOPEN[res.key] = false; FIXNOTE = (r ? r.name + ": " : "") + res.msg; }
  renderSched(window.__sched);
};
// ---------- end Fix panel (page) ----------
