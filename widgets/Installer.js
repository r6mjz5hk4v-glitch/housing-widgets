// Variables used by Scriptable.
// These must be at the top and may not be edited.
// icon-color: deep-gray; icon-glyph: cloud-download-alt;

// Installer for the Housing Widgets
// Installs every widget in one go, and updates them (and itself) whenever
// you run it again. Run it, then run Setup once.
//
// How updates work: it downloads the list of widgets from GitHub, compares
// each with the copy on this phone, and writes only what changed. If you
// already have a widget under a different name, it finds it by its title
// line and updates it in place, so your home-screen widgets keep working.
// Before replacing an older copy that had a key typed into it, it moves
// that key into the phone's keychain first.

const REPO = "r6mjz5hk4v-glitch/housing-widgets"; // GitHub user/repo
const BRANCH = "main";
const RAW = "https://raw.githubusercontent.com/" + REPO + "/" + BRANCH + "/";

// Scripts live in iCloud Drive/Scriptable when iCloud is on, else on the phone
function scriptFm() {
  try {
    const ic = FileManager.iCloud();
    if (module.filename.startsWith(ic.documentsDirectory())) return ic;
  } catch (e) {}
  return FileManager.local();
}
const fm = scriptFm();
const dir = fm.documentsDirectory();

async function say(title, msg) { const a = new Alert(); a.title = title; a.message = msg || ""; a.addAction("OK"); await a.present(); }
async function readLocal(p) {
  try {
    if (fm.isFileStoredIniCloud && fm.isFileStoredIniCloud(p) && !fm.isFileDownloaded(p)) await fm.downloadFileFromiCloud(p);
    return fm.readString(p) || "";
  } catch (e) { return ""; }
}
async function fetchText(url) {
  const r = new Request(url + "?t=" + Date.now()); // skip stale caches
  r.timeoutInterval = 30;
  const t = await r.loadString();
  if (!r.response || r.response.statusCode !== 200) throw new Error((r.response && r.response.statusCode) + " for " + url);
  return t;
}
function kcHas(k) { try { return Keychain.contains(k) && !!Keychain.get(k); } catch (e) { return false; } }

// keys typed into older copies go to the keychain before the copy is replaced
function rescueKeys(src, saved) {
  const f = src.match(/const FRED_KEY = "([0-9a-f]{32})"/);
  if (f && !kcHas("fred_api_key")) { Keychain.set("fred_api_key", f[1]); saved.add("FRED key"); }
  const c = src.match(/const SEC_CONTACT = "([^"]*@[^"]*)"/);
  if (c && !kcHas("sec_contact")) { Keychain.set("sec_contact", c[1]); saved.add("SEC name and email"); }
}

// ---- what's on GitHub vs what's here ----
if (REPO.startsWith("OWNER/")) { await say("Installer isn't pointed at a repo yet", "Edit the REPO line at the top of this script."); return; }
let man;
try { man = JSON.parse(await fetchText(RAW + "manifest.json")); }
catch (e) { await say("Couldn't reach GitHub", String(e.message || e)); return; }

const locals = fm.listContents(dir).filter((n) => n.endsWith(".js"));
const localText = {};
for (const n of locals) localText[n] = null; // read on demand

async function textOf(n) { if (localText[n] == null) localText[n] = await readLocal(fm.joinPath(dir, n)); return localText[n]; }

// Which widget each local script is, by the title line near its top (names
// don't count: yours may differ, and a same-named script could be anything)
const owner = {};
for (const n of locals) {
  const top = (await textOf(n)).slice(0, 3000);
  const it = man.files.find((f) => f.sig && top.includes(f.sig));
  if (it) owner[n] = it.file;
}
// a name for a new script that doesn't collide with one already here
// (iPhone file names ignore upper/lower case)
const taken = new Set(locals.map((n) => n.toLowerCase()));
function freeName(name) {
  let n = name + ".js", i = 2;
  while (taken.has(n.toLowerCase())) n = name + " " + i++ + ".js";
  taken.add(n.toLowerCase());
  return n;
}

const plan = [];
for (const item of man.files) {
  const t = locals.filter((n) => owner[n] === item.file);
  plan.push({ item, targets: t.length ? t : [freeName(item.name)], isNew: !t.length });
}
const self = module.filename.split("/").pop();
try { Keychain.set("hw_installer", self.replace(/\.js$/, "")); } catch (e) {} // the widgets' Run Installer button opens this script by name

// ---- ask ----
const nNew = plan.filter((p) => p.isNew).length;
const a = new Alert();
a.title = "Housing Widgets";
a.message = man.files.length + " scripts on GitHub" + (man.updated ? " (updated " + man.updated + ")" : "") + ". "
  + (nNew === man.files.length ? "None installed yet." : nNew + " not on this phone yet; the rest get checked for updates.");
a.addAction("Install / update all");
a.addAction("Pick one…");
a.addCancelAction("Cancel");
const choice = await a.present();
if (choice < 0) return;
let todo = plan;
if (choice === 1) {
  const s = new Alert();
  s.title = "Which one?";
  plan.forEach((p) => s.addAction(p.item.title + (p.isNew ? "  (new)" : "")));
  s.addCancelAction("Cancel");
  const i = await s.presentSheet();
  if (i < 0) return;
  todo = [plan[i]];
}

// ---- download (a few at a time) and write ----
const results = { added: [], updated: [], same: [], failed: [] };
const saved = new Set();
let selfUpdated = false;
let k = 0;
async function worker() {
  while (k < todo.length) {
    const p = todo[k++];
    let src;
    try { src = await fetchText(RAW + "widgets/" + p.item.file); }
    catch (e) { results.failed.push(p.item.title + ": " + (e.message || e)); continue; }
    for (const n of p.targets) {
      const path = fm.joinPath(dir, n);
      const cur = p.isNew ? "" : await textOf(n);
      if (cur === src) { results.same.push(p.item.title); continue; }
      if (cur) rescueKeys(cur, saved);
      fm.writeString(path, src);
      if (n === self) selfUpdated = true;
      const nm = n.replace(/\.js$/, "");
      (p.isNew ? results.added : results.updated).push(p.item.title + (nm.toLowerCase() === p.item.name.toLowerCase() ? "" : p.isNew ? " (saved as \"" + nm + "\")" : " (your \"" + nm + "\")"));
    }
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);

const uniq = (xs) => [...new Set(xs)];
let msg = "";
if (results.added.length) msg += "Added: " + uniq(results.added).join(", ") + "\n\n";
if (results.updated.length) msg += "Updated: " + uniq(results.updated).join(", ") + "\n\n";
if (results.same.length) msg += "Already current: " + uniq(results.same).length + "\n\n";
if (saved.size) msg += "Moved your " + [...saved].join(" and ") + " from an old copy into the keychain.\n\n";
if (results.failed.length) msg += "Couldn't download: " + results.failed.join("; ") + "\n\n";
if (selfUpdated) msg += "The installer updated itself too.\n\n";

const needSetup = !kcHas("fred_api_key");
const done = new Alert();
done.title = results.failed.length ? "Done, with problems" : "Done ✓";
done.message = msg.trim() + (needSetup ? "\n\nNext: run Setup to add your free FRED key." : "");
if (needSetup) done.addAction("Run Setup now");
done.addCancelAction("Close");
if ((await done.present()) === 0 && needSetup) {
  const setup = plan.find((p) => p.item.file === "Setup.js");
  const name = setup ? setup.targets[0].replace(/\.js$/, "") : "Setup";
  Safari.open("scriptable:///run/" + encodeURIComponent(name));
}
Script.complete();
