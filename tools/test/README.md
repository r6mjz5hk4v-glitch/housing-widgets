# Tests

Run by GitHub before anything reaches `main` (the gate) and every night against the live internet.

- `static.js`: parses, page-code rules, secret scan, manifest fingerprints, notes.json.
- `scriptable.js`: a stand-in for the Scriptable app. WebViews are real Chromium pages (Playwright), so full views, Share as PDF and hidden pdf.js / SheetJS pages run for real.
- `fred-fake.js`: a made-up FRED (no key needed).
- `run-widget.js`: one script, one mode (`widget` or `app`), one result file.
- `run-all.js`: the gate. Exit 1 on any ✗.
- `nightly.js`: every widget against the live internet; writes `out/nightly.json` for the issues.

Locally: `npm ci`, then `OFFLINE_LIBS=1 NODE_PATH=$(npm root -g) node run-all.js` (Playwright must be installed; `OFFLINE_LIBS` serves jsPDF and friends from node_modules when the CDNs are blocked).
