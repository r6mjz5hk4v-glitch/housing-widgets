// The gate: everything that must pass before a change reaches main (where Installer looks).
// 1) static checks (static.js); 2) every script run as a home-screen widget and in the app,
// on a made-up FRED with every other source offline, so each widget must cope with missing data.
// Writes out/summary.md (used as the GitHub issue text) and exits 1 on any failure.
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { runStatic, scripts } = require("./static");

const OUT = path.join(__dirname, "out");
const NOT_WIDGETS = new Set(["Setup.js", "Installer.js"]); // menus, not widgets
const PARALLEL = +(process.env.PARALLEL || 4);

function runOne(file, mode) {
  const out = path.join(OUT, `${file.replace(/\.js$/, "")}-${mode}.json`);
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(__dirname, "run-widget.js"), file, mode, out], { env: { ...process.env, NET: "offline" }, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d; });
    p.on("exit", () => {
      try { resolve(JSON.parse(fs.readFileSync(out, "utf8"))); }
      catch (e) { resolve({ file, mode, status: "harness-error", err: err.slice(-500) || "no result" }); }
    });
  });
}

async function pool(jobs, n) {
  const res = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const k = i++; res[k] = await jobs[k](); } }));
  return res;
}

// failures block the move to main; warnings are reported but don't
function judge(r) {
  const f = [], w = [];
  const widget = !NOT_WIDGETS.has(r.file);
  // other sources are offline here, so some widgets have no data: that's expected
  const missingData = (r.fetchErrors || []).some((e) => !/raw\.githubusercontent\.com/.test(e.url));
  if (r.status === "harness-error") return { f: [`the test itself broke: ${r.err}`], w };
  if (r.status === "threw") f.push(`crashed: ${String(r.err).split("\n")[0]}`);
  if (r.status === "timeout") f.push(`still running after ${Math.round((r.ms || 0) / 1000)}s (it should finish soon after the view closes)`);
  if (r.mode === "widget" && widget) {
    if (!r.setWidget) f.push("never handed iOS a widget (Script.setWidget not called)");
    else if (!r.widgetUrl) (r.face === "drawn" ? f : w).push(`tapping the ${r.face === "drawn" ? "widget" : "\"" + (r.widgetTexts || []).slice(-1)[0] + "\" face"} won't run the script (w.url isn't set)`);
  }
  if (r.mode === "app" && widget) {
    if (!r.presented) (missingData && (r.alerts || []).length ? w : f).push(`no full view${(r.alerts || []).length ? ": said \"" + r.alerts[0].split("\n")[0] + "\"" : ""}`);
    (r.pageErrors || []).forEach((e) => f.push(`full view error: ${e}`));
    if (r.pdf && !r.pdf.ok) (missingData ? w : f).push(`Share as PDF failed${missingData ? " with its sources offline" : ""}: ${r.pdf.err}`);
  }
  return { f, w };
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const lines = [];
  const say = (s) => { console.log(s); lines.push(s); };
  let bad = 0;

  const st = runStatic();
  say(`## Static checks: ${st.length ? `${st.length} problem(s)` : "passed"}`);
  st.forEach((x) => say(`- ✗ **${x.check}** · \`${x.file}\`: ${x.msg}`));
  bad += st.length;

  const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  const files = scripts().filter((f) => !only || only.includes(f));
  const jobs = [];
  for (const f of files) for (const m of NOT_WIDGETS.has(f) ? ["app"] : ["widget", "app"]) jobs.push(() => runOne(f, m));
  const t0 = Date.now();
  const results = await pool(jobs, PARALLEL);
  say(`\n## Running each script (${results.length} runs, ${Math.round((Date.now() - t0) / 1000)}s; FRED made up, other sources offline)`);
  let warn = 0;
  for (const r of results) {
    const { f, w } = judge(r);
    bad += f.length; warn += w.length;
    const tag = `${r.file} (${r.mode === "widget" ? "home-screen widget" : "app"})`;
    f.forEach((x) => say(`- ✗ \`${tag}\`: ${x}`));
    w.forEach((x) => say(`- ⚠ \`${tag}\`: ${x}`));
    if (!f.length && !w.length) say(`- ✓ \`${tag}\`${r.pdf ? ` · PDF ${r.pdf.pages} slides` : ""}${r.mode === "widget" ? ` · face ${r.face || "?"}` : ""}`);
  }
  if (warn) say(`\n${warn} warning(s) (⚠): worth fixing, but they don't block.`);
  say(`\n**${bad ? `${bad} problem(s): not moved to main` : "All checks passed"}**`);
  fs.writeFileSync(path.join(OUT, "summary.md"), lines.join("\n") + "\n");
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
  process.exit(bad ? 1 : 0);
})();
