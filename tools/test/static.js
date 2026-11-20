// Static checks on every script in widgets/: the rules in CLAUDE.md that a machine can check.
// Returns a list of { check, file, msg } failures; run-all.js prints them.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const WIDGETS = path.join(ROOT, "widgets");

function scripts() {
  return fs.readdirSync(WIDGETS).filter((f) => f.endsWith(".js")).sort();
}

// 1. Parses the way Scriptable runs it (the whole file is the body of an async function)
function syntax(file, src) {
  try { new Function("return (async () => {" + src + "\n})"); return null; }
  catch (e) { return `doesn't parse: ${e.message}`; }
}

// 2. Full-view pages live in template literals: no ${ and no backslashes in page code,
//    except \uXXXX escapes (they turn into the same character either way)
function pageRules(file, src) {
  const out = [];
  const re = /`(<!DOCTYPE html>|<!doctype html>|<html)/g;
  let m;
  while ((m = re.exec(src))) {
    const start = m.index + 1, end = src.indexOf("`", start);
    if (end < 0) { out.push("a page template never closes"); break; }
    const page = src.slice(start, end);
    re.lastIndex = end + 1;
    if (page.length < 5000 || page.indexOf("<script") < 0) continue; // small helper pages are filled in on purpose
    const line = (i) => src.slice(0, start + i).split("\n").length;
    let k = page.indexOf("${");
    if (k >= 0) out.push(`"\${" in the page code (line ${line(k)})`);
    for (let i = 0; i < page.length; i++) {
      if (page[i] !== "\\") continue;
      if (/^u[0-9a-fA-F]{4}$/.test(page.slice(i + 1, i + 6))) { i += 5; continue; }
      out.push(`backslash in the page code (line ${line(i)}): ${JSON.stringify(page.slice(Math.max(0, i - 20), i + 12))}`);
      break;
    }
  }
  return out;
}

// 3. No secrets: keys, emails (the repo is public)
const SECRET_PATTERNS = [
  [/\b[0-9a-f]{32}\b/, "looks like a FRED key (32 hex characters)"],
  [/\bsk_[A-Za-z0-9]{20,}/, "looks like an ElevenLabs key"],
  [/\b(?:ghp|gho|github_pat)_[A-Za-z0-9_]{20,}/, "looks like a GitHub token"],
  [/\bAKIA[0-9A-Z]{16}\b/, "looks like an AWS key"],
  [/[A-Za-z0-9._%+-]+@(?!example\.com\b|anthropic\.com\b)[A-Za-z0-9-]+\.[A-Za-z0-9.-]*[A-Za-z]{2,}/, "looks like an email address"],
];
const SECRET_OK = [/0{32}/, /noreply@/, /@media\b/, /@font-face\b/, /@keyframes\b/, /@import\b/, /@supports\b/, /@page\b/, /@[0-9]+\.[0-9]+/, /@main\b/];
function secrets(file, text) {
  const out = [];
  text.split("\n").forEach((ln, i) => {
    for (const [re, what] of SECRET_PATTERNS) {
      const m = ln.match(re);
      if (!m) continue;
      if (SECRET_OK.some((ok) => ok.test(m[0]))) continue;
      out.push(`line ${i + 1}: ${what} (${m[0].slice(0, 6)}…)`);
    }
  });
  return out;
}
function trackedTextFiles() {
  try {
    return execFileSync("git", ["ls-files"], { cwd: ROOT }).toString().split("\n").filter((f) => f && !/\.(png|jpg|jpeg|gif|pdf|woff2?|ttf)$/i.test(f) && !/package-lock\.json$/.test(f));
  } catch (e) { return []; }
}

// 4. The manifest matches the code (fingerprints are what make the yellow glow appear)
function manifest() {
  const out = [];
  const file = path.join(ROOT, "manifest.json");
  const before = fs.readFileSync(file, "utf8");
  try {
    execFileSync("python3", [path.join(ROOT, "tools/build_manifest.py")], { cwd: ROOT, stdio: "pipe" });
  } catch (e) { return [`build_manifest.py failed: ${String(e.stderr || e.message).trim().split("\n").pop()}`]; }
  const after = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, before); // leave the tree as it was
  // the "updated" stamp is just the day it was built (and GitHub's clock is UTC): ignore it
  const strip = (t) => { const j = JSON.parse(t); delete j.updated; return JSON.stringify(j); };
  if (strip(after) !== strip(before)) {
    const a = JSON.parse(before), b = JSON.parse(after);
    const stale = b.files.filter((f) => { const o = a.files.find((x) => x.file === f.file); return !o || o.hash !== f.hash || JSON.stringify(o.notes) !== JSON.stringify(f.notes); }).map((f) => f.file);
    out.push(`manifest.json is out of date for ${stale.join(", ") || "some entries"}: run python3 tools/build_manifest.py`);
  }
  const m = JSON.parse(before);
  for (const f of m.files) {
    const p = path.join(WIDGETS, f.file);
    if (!fs.existsSync(p)) { out.push(`manifest lists ${f.file}, which isn't in widgets/`); continue; }
    if (f.sig && fs.readFileSync(p, "utf8").indexOf(f.sig) < 0) out.push(`${f.file}: its title line (${f.sig}) is missing, so Installer can't find the user's copy`);
  }
  for (const f of scripts()) if (!m.files.some((x) => x.file === f)) out.push(`${f} isn't in manifest.json`);
  return out;
}

// 5. notes.json reads
function notes() {
  try {
    const n = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/notes.json"), "utf8"));
    const bad = [];
    for (const [f, list] of Object.entries(n)) {
      if (!Array.isArray(list)) { bad.push(`${f}: not a list`); continue; }
      list.forEach((x, i) => { if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(x.d) || !x.t) bad.push(`${f} note ${i + 1}: needs a date (d) and text (t)`); });
    }
    return bad;
  } catch (e) { return [`tools/notes.json doesn't parse: ${e.message}`]; }
}

function runStatic() {
  const fails = [];
  for (const f of scripts()) {
    const src = fs.readFileSync(path.join(WIDGETS, f), "utf8");
    const s = syntax(f, src);
    if (s) fails.push({ check: "syntax", file: f, msg: s });
    for (const m of pageRules(f, src)) fails.push({ check: "page code", file: f, msg: m });
  }
  for (const f of trackedTextFiles()) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const m of secrets(f, fs.readFileSync(p, "utf8"))) fails.push({ check: "secrets", file: f, msg: m });
  }
  for (const m of manifest()) fails.push({ check: "manifest", file: "manifest.json", msg: m });
  for (const m of notes()) fails.push({ check: "notes", file: "tools/notes.json", msg: m });
  return fails;
}

module.exports = { runStatic, scripts, WIDGETS, ROOT };
if (require.main === module) {
  const f = runStatic();
  f.forEach((x) => console.log(`✗ [${x.check}] ${x.file}: ${x.msg}`));
  console.log(f.length ? `${f.length} problem(s)` : "static checks passed");
  process.exit(f.length ? 1 : 0);
}
