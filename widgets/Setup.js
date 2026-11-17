// Variables used by Scriptable.
// These must be at the top and may not be edited.
// icon-color: gray; icon-glyph: cog;

// Setup for the Housing Widgets
// Run once after installing (and any time you want to change a setting).
// Everything is saved in this phone's keychain, which every Scriptable
// script on the phone can read. Nothing is sent anywhere except a one-time
// check of your FRED key with the St. Louis Fed.
//
//   FRED API key        needed by most widgets (free, takes 2 minutes)
//   Name and email      the SEC asks for these on its data requests
//                       (builder filings in Chartbook and Builder Stocks)
//   ElevenLabs key      optional: natural-voice "Listen" in Chartbook and
//                       Builder Stocks (without it, the iPhone voice reads)
//   Voice name          the ElevenLabs voice to use (default Bert)
//   Home metro          the metro the map and metro widgets open on
//   Highlighted builder the builder that stands out in Builder Stocks

const K = {
  fred: "fred_api_key",
  sec: "sec_contact",
  eleven: "elevenlabs_api_key",
  voice: "voice_name",
  metro: "home_metro",
  builder: "highlight_builder",
};
const DEFAULTS = { voice: "Bert", metro: "Austin, TX", builder: "DHI" };
const BUILDERS = ["DHI", "LEN", "PHM", "NVR", "TOL", "TMHC", "MTH", "KBH", "DFH", "CCS", "MHO", "TPH", "GRBK", "LGIH", "BZH", "HOV"];
const FRED_LINK = "https://fredaccount.stlouisfed.org/apikeys";
const ELEVEN_LINK = "https://elevenlabs.io/app/settings/api-keys";

function get(k) { try { return Keychain.contains(k) ? Keychain.get(k) || "" : ""; } catch (e) { return ""; } }
function put(k, v) { if (v) Keychain.set(k, v); else if (Keychain.contains(k)) Keychain.remove(k); }
function ends(v) { return v ? "ends in " + v.slice(-4) : ""; }
const isFred = (v) => /^[0-9a-f]{32}$/.test(v);

async function say(title, msg) { const a = new Alert(); a.title = title; a.message = msg || ""; a.addAction("OK"); await a.present(); }

// ---- carry settings over from older copies of the widgets on this phone ----
// Older versions had the FRED key and SEC contact typed into the script.
async function scanOld() {
  const out = { fred: "", sec: "" };
  const dirs = [];
  try { dirs.push(FileManager.iCloud()); } catch (e) {}
  dirs.push(FileManager.local());
  for (const fm of dirs) {
    let dir, names;
    try { dir = fm.documentsDirectory(); names = fm.listContents(dir); } catch (e) { continue; }
    for (const n of names) {
      if (!n.endsWith(".js") || n === "Setup.js") continue;
      const p = fm.joinPath(dir, n);
      try {
        if (fm.isFileStoredIniCloud && fm.isFileStoredIniCloud(p) && !fm.isFileDownloaded(p)) await fm.downloadFileFromiCloud(p);
        const s = fm.readString(p) || "";
        const f = s.match(/const FRED_KEY = "([0-9a-f]{32})"/);
        if (f && !out.fred) out.fred = f[1];
        const c = s.match(/const SEC_CONTACT = "([^"]*@[^"]*)"/);
        if (c && !out.sec) out.sec = c[1];
      } catch (e) {}
    }
  }
  return out;
}

async function checkFred(key) {
  try {
    const r = new Request("https://api.stlouisfed.org/fred/series?series_id=DGS10&file_type=json&api_key=" + key);
    r.timeoutInterval = 15;
    const j = await r.loadJSON();
    if (j && j.seriess) return "";
    return (j && j.error_message) || "FRED didn't accept that key.";
  } catch (e) {
    return "couldn't reach FRED to check it (saved anyway)";
  }
}

// ---- each setting ----
async function editFred() {
  const cur = get(K.fred);
  let clip = "";
  try { clip = (Pasteboard.pasteString() || "").trim().toLowerCase(); } catch (e) {}
  const a = new Alert();
  a.title = "FRED API key";
  a.message = "Free from the St. Louis Fed. Make an account (or sign in), then API Keys → Request API Key. Copy the 32-character key, come back, and paste it here."
    + (cur ? "\n\nSaved now: " + ends(cur) : "");
  a.addTextField("32 letters and numbers", isFred(clip) ? clip : cur);
  a.addAction("Save");
  a.addAction("Get a free key (opens Safari)");
  a.addCancelAction("Cancel");
  const i = await a.present();
  if (i === 1) { Safari.open(FRED_LINK); return; }
  if (i !== 0) return;
  const v = a.textFieldValue(0).trim().toLowerCase();
  if (!isFred(v)) { await say("That doesn't look like a FRED key", "A FRED key is 32 characters, letters a–f and numbers only. Nothing was saved."); return; }
  put(K.fred, v);
  const bad = await checkFred(v);
  await say(bad ? "Saved, with a note" : "FRED key saved ✓", bad || "Checked with FRED: it works.");
}

async function editSec() {
  const cur = get(K.sec);
  const parts = cur.split(" ");
  const email = parts.find((p) => p.includes("@")) || "";
  const name = parts.filter((p) => !p.includes("@")).join(" ");
  const a = new Alert();
  a.title = "Your name and email";
  a.message = "The SEC asks everyone who pulls its filings data to identify themselves. These go only to sec.gov, inside each request.";
  a.addTextField("Name", name);
  a.addTextField("Email", email);
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if ((await a.present()) !== 0) return;
  const n = a.textFieldValue(0).trim(), e = a.textFieldValue(1).trim();
  if (!n || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { await say("Need both", "A name and a working email address. Nothing was saved."); return; }
  put(K.sec, n + " " + e);
}

async function editEleven() {
  const cur = get(K.eleven);
  const a = new Alert();
  a.title = "ElevenLabs key (optional)";
  a.message = cur
    ? "Saved ✓ (" + ends(cur) + "). It's in this phone's keychain, so you never need to remember it. If you need it on another phone, copy it here."
    : "Lets Chartbook and Builder Stocks read aloud in a natural voice. Without it, the iPhone voice reads instead. Get a key at elevenlabs.io → Settings → API Keys.";
  if (cur) { a.addAction("Copy key to clipboard"); a.addAction("Replace with a new key"); a.addDestructiveAction("Remove"); }
  else { a.addAction("Paste a key"); a.addAction("Get a key (opens Safari)"); }
  a.addCancelAction("Cancel");
  const i = await a.present();
  if (cur && i === 0) { Pasteboard.copyString(cur); await say("Copied", "Your ElevenLabs key is on the clipboard."); return; }
  if (cur && i === 2) { put(K.eleven, ""); return; }
  if (!cur && i === 1) { Safari.open(ELEVEN_LINK); return; }
  if (i < 0) return;
  const b = new Alert();
  b.title = "ElevenLabs key";
  let clip = "";
  try { clip = (Pasteboard.pasteString() || "").trim(); } catch (e) {}
  b.addTextField("sk_…", /^sk_[A-Za-z0-9]{20,}$/.test(clip) ? clip : "");
  b.addAction("Save");
  b.addCancelAction("Cancel");
  if ((await b.present()) !== 0) return;
  const v = b.textFieldValue(0).trim();
  if (v.length < 20) { await say("Too short", "That doesn't look like an ElevenLabs key. Nothing was saved."); return; }
  put(K.eleven, v);
}

async function editText(key, title, msg, ph) {
  const a = new Alert();
  a.title = title;
  a.message = msg;
  a.addTextField(ph, get(key) || DEFAULTS[Object.keys(K).find((x) => K[x] === key)] || "");
  a.addAction("Save");
  a.addAction("Use the default");
  a.addCancelAction("Cancel");
  const i = await a.present();
  if (i === 1) { put(key, ""); return null; }
  if (i !== 0) return null;
  return a.textFieldValue(0).trim();
}

async function editMetro() {
  const v = await editText(K.metro, "Home metro", "City, then the two-letter state, the way the metro is named: \"Austin, TX\", \"Dallas, TX\", \"Atlanta, GA\". Used by Affordability Gap, Payment Change, Migration and Redfin Migration. Default Austin, TX.", "City, ST");
  if (v == null) return;
  if (!/^[^,]+,\s*[A-Za-z]{2}$/.test(v)) { await say("City, ST please", "Like \"Austin, TX\". Nothing was saved."); return; }
  const [c, st] = v.split(",");
  let city = c.trim();
  if (city === city.toLowerCase()) city = city.replace(/(^|[\s.-])([a-z])/g, (m, a, b) => a + b.toUpperCase()); // "san antonio" -> "San Antonio"
  put(K.metro, city + ", " + st.trim().toUpperCase());
}

async function editBuilder() {
  const a = new Alert();
  a.title = "Highlighted builder";
  a.message = "The builder that stands out on the Builder Stocks widget.";
  BUILDERS.forEach((b) => a.addAction(b + (b === (get(K.builder) || DEFAULTS.builder) ? "  ✓" : "")));
  a.addCancelAction("Cancel");
  const i = await a.presentSheet();
  if (i >= 0) put(K.builder, BUILDERS[i] === DEFAULTS.builder ? "" : BUILDERS[i]);
}

async function editVoice() {
  const v = await editText(K.voice, "ElevenLabs voice", "The name of a voice in your ElevenLabs account (My Voices or the library). The widgets use the first voice whose name starts with this. Default Bert.", "Voice name");
  if (v) put(K.voice, v);
}

// ---- menu ----
const old = await scanOld();
const carried = [];
if (!get(K.fred) && old.fred) { put(K.fred, old.fred); carried.push("FRED key"); }
if (!get(K.sec) && old.sec) { put(K.sec, old.sec); carried.push("name and email for the SEC"); }
if (carried.length) await say("Carried over ✓", "Found your " + carried.join(" and ") + " in older copies of the widgets on this phone and saved them to the keychain.");

for (;;) {
  const fred = get(K.fred), sec = get(K.sec), el = get(K.eleven);
  const a = new Alert();
  a.title = "Housing Widgets setup";
  a.message = !fred ? "Start with the FRED key: most widgets need it." : (!sec ? "Recommended: your name and email, for builder filings from the SEC." : "All set. Tap anything to change it.");
  a.addAction("FRED key: " + (fred ? "saved ✓ " + ends(fred) : "needed"));
  a.addAction("Name and email (SEC): " + (sec ? "saved ✓" : "recommended"));
  a.addAction("ElevenLabs key: " + (el ? "saved ✓ " + ends(el) : "optional, not set"));
  a.addAction("Voice: " + (get(K.voice) || DEFAULTS.voice));
  a.addAction("Home metro: " + (get(K.metro) || DEFAULTS.metro));
  a.addAction("Highlighted builder: " + (get(K.builder) || DEFAULTS.builder));
  a.addCancelAction("Done");
  const i = await a.presentSheet();
  if (i < 0) break;
  await [editFred, editSec, editEleven, editVoice, editMetro, editBuilder][i]();
}
Script.complete();
