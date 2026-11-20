// The nightly check: every widget opened in the app against the real internet (FRED is
// still made up: no key is stored on GitHub), starting from an empty phone, so each
// widget's own reading code downloads and parses today's real files. Then:
// - a crash, a full-view error, a failed Share as PDF, or a "couldn't load" message
//   is a broken widget;
// - an error a widget saved for one of its sources (fields like err, errors, ...Errors)
//   is a broken source;
// - a site that wouldn't answer GitHub's servers at all is "couldn't check", not broken.
// Writes out/nightly.json (the GitHub issues are made from it) and out/summary.md.
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { scripts } = require("./static");

const OUT = path.join(__dirname, "out");
const SKIP = new Set(["Setup.js", "Installer.js"]);
const PARALLEL = +(process.env.PARALLEL || 4);

function runOne(file) {
  const out = path.join(OUT, `${file.replace(/\.js$/, "")}-live.json`);
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(__dirname, "run-widget.js"), file, "app", out], { env: { ...process.env, NET: "live" }, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d; });
    p.on("exit", () => {
      try { resolve(JSON.parse(fs.readFileSync(out, "utf8"))); }
      catch (e) { resolve({ file, mode: "app", status: "harness-error", err: err.slice(-500) || "no result" }); }
    });
  });
}
async function pool(jobs, n) {
  const res = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const k = i++; res[k] = await jobs[k](); } }));
  return res;
}

// errors a widget saved for its sources
const ERR_KEY = /^(err|error|errors|lastError|[a-zA-Z]+Err|[a-zA-Z]+Error|[a-zA-Z]+Errors)$/;
const BAD_WORDS = /fail|couldn'?t|could not|error|not found|HTTP \d|refused|blocked|timed out|offline|missing|no (?:data|table|timeline)/i;
function savedErrors(store) {
  const out = [];
  const walk = (v, p, depth) => {
    if (depth > 6 || v == null) return;
    if (Array.isArray(v)) { v.slice(0, 50).forEach((x, i) => walk(x, `${p}[${i}]`, depth + 1)); return; }
    if (typeof v !== "object") return;
    for (const [k, x] of Object.entries(v)) {
      const here = p ? `${p}.${k}` : k;
      const isErr = ERR_KEY.test(k) || (/Note$/.test(k) && typeof x === "string" && BAD_WORDS.test(x));
      if (isErr && x) {
        const list = Array.isArray(x) ? x.filter((y) => typeof y === "string" && y) : typeof x === "string" ? [x] : [];
        list.forEach((m) => out.push({ where: here, msg: m.slice(0, 400) }));
        continue;
      }
      walk(x, here, depth + 1);
    }
  };
  walk(store, "", 0);
  return out;
}

// does an error message talk about this site? ("Fannie Mae's forecast" ~ www.fanniemae.com)
const HOST_WORDS = { "newyorkfed.org": /new york fed|ny fed/i, "philadelphiafed.org": /philadelphia|philly/i, "sca.isr.umich.edu": /michigan/i, "zillowstatic.com": /zillow/i, "federalreserve.gov": /federal reserve|the fed\b|fomc/i, "frbsf.org": /san francisco/i, "gdeltproject.org": /gdelt/i, "hud.gov": /\bhud\b|fha/i, "census.gov": /census/i, "redfin": /redfin/i, "finance.yahoo.com": /yahoo|stock|price/i, "sec.gov": /\bsec\b|filing/i, "mba.org": /\bmba\b/i };
function aboutHost(msg, h) {
  const flat = msg.toLowerCase().replace(/[^a-z]/g, "");
  const name = h.split(".").slice(-2, -1)[0] || h;
  if (name.length > 3 && flat.includes(name)) return true;
  return Object.entries(HOST_WORDS).some(([k, re]) => h.includes(k) && re.test(msg));
}
const host = (u) => { try { return new URL(u).host; } catch (e) { return u; } };
const NOT_A_SOURCE = /raw\.githubusercontent\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.g/;

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  const files = scripts().filter((f) => !SKIP.has(f) && (!only || only.includes(f)));
  const t0 = Date.now();
  const results = await pool(files.map((f) => () => runOne(f)), PARALLEL);

  const problems = []; // { key, widget, title, detail }
  const unreachable = {}; // host -> widgets
  for (const r of results) {
    const w = r.file.replace(/Widget\.js$|\.js$/, "");
    const add = (key, title, detail) => problems.push({ key: `${w}:${key}`, widget: w, title, detail });
    // sites that never answered at all (DNS, refused, reset, timeout): couldn't check
    const dead = {};
    for (const e of r.fetchErrors || []) if (!NOT_A_SOURCE.test(e.url)) (dead[host(e.url)] = dead[host(e.url)] || []).push(e.err);
    for (const h of Object.keys(dead)) (unreachable[h] = unreachable[h] || new Set()).add(w);
    const blocked = Object.keys(dead).length > 0;
    if (r.status === "harness-error") { add("harness", `${w}: the nightly check itself broke`, r.err); continue; }
    if (r.status === "threw") add("crash", `${w} crashed`, String(r.err).split("\n").slice(0, 3).join("\n"));
    (r.pageErrors || []).forEach((e, i) => add(`page${i}`, `${w}: error in the full view`, e));
    if (r.pdf && !r.pdf.ok) add("pdf", `${w}: Share as PDF failed`, r.pdf.err);
    if (!r.presented) {
      const said = (r.alerts || [])[0] || "no message";
      // if its sites wouldn't answer, that's "couldn't check"; otherwise it's broken
      if (!blocked) add("load", `${w}: couldn't load its data`, said);
    }
    for (const e of savedErrors(r.store)) {
      // an error that's only "couldn't reach <site>" for a site that never answered: couldn't check
      if (blocked && (/couldn'?t (?:reach|connect)|could not connect|offline|timed out/i.test(e.msg) || Object.keys(dead).some((h) => aboutHost(e.msg, h)))) continue;
      add(`saved:${e.where.replace(/\[\d+\]/g, "")}`, `${w}: ${e.msg.split(":")[0].slice(0, 70)}`, `${e.msg}\n\n(saved as \`${e.where}\`)`);
    }
  }
  // one problem per key
  const seen = new Set();
  const uniq = problems.filter((p) => (seen.has(p.key) ? false : (seen.add(p.key), true)));

  const lines = [];
  const nUn = Object.keys(unreachable).length;
  lines.push(`## Nightly source check: ${uniq.length ? `${uniq.length} problem(s)` : "no problems found"}${nUn ? `; ${nUn} site(s) couldn't be checked` : ""}`);
  lines.push(`${results.length} widgets opened against the live internet in ${Math.round((Date.now() - t0) / 60000)} min (FRED made up; no key on GitHub).`);
  uniq.forEach((p) => lines.push(`- ✗ **${p.title}**: ${p.detail.split("\n")[0].slice(0, 200)}`));
  const un = Object.entries(unreachable);
  if (un.length) {
    lines.push(`\n### Couldn't check (these sites didn't answer GitHub's servers)`);
    un.forEach(([h, ws]) => lines.push(`- ${h} (${[...ws].join(", ")})`));
  }
  lines.push(`\n### Widgets`);
  for (const r of results) lines.push(`- ${r.file}: ${r.status}${r.presented ? " · full view opened" : " · no full view"}${r.pdf ? (r.pdf.ok ? ` · PDF ${r.pdf.pages} slides` : " · PDF failed") : ""} · ${r.requests || 0} requests, ${Math.round((r.ms || 0) / 1000)}s`);
  fs.writeFileSync(path.join(OUT, "summary.md"), lines.join("\n") + "\n");
  fs.writeFileSync(path.join(OUT, "nightly.json"), JSON.stringify({ at: new Date().toISOString(), problems: uniq, unreachable: Object.fromEntries(un.map(([h, ws]) => [h, [...ws]])), widgets: results.map((r) => r.file) }, null, 1));
  console.log(lines.join("\n"));
  process.exit(0);
})();
