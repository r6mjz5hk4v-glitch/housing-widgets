# Housing Widgets: rules for Claude

Scriptable (iOS) widgets for mortgage and housing data. This repo is the master copy: phones get changes only by running Installer, which downloads from here.

## Before writing code
- Ask clarifying questions first, with tappable choices where possible.
- Then get an explicit **Go** on a go/no-go prompt that describes the change. Anything other than a clear "Go" (a question, "I like it", a tweak) is not a Go: answer it and ask again.
- Label confidence on factual claims. No speculation presented as fact.

## Secrets and personal settings
- Never put keys, emails, names or other secrets in any file here. The repo is public.
- Read them from the phone's keychain with the `setting(key, fallback)` helper at the top of each widget. Setup.js saves them:
  - `fred_api_key`, `sec_contact` (name and email for SEC requests), `elevenlabs_api_key`
  - `voice_name`, `home_metro` ("City, ST"), `highlight_builder`
- A widget that needs a missing key says "Run the Setup script…" instead of failing silently.
- Before every push, scan for anything that looks like a key or an email address.

## Widget conventions
- Small widget (170×170 face), dark UI. Tapping opens a full-screen WebView with **Share as PDF**.
- Full-screen views start with a release schedule: each source's latest data and when the next update is due. Overdue sources are shown in orange with how late, when the update was due, and why it isn't in yet.
- Share as PDF: 16:9 slides with at most 2 charts per slide and a dark source banner with a gold rule. Each headline answers the slide's question (computed from the data), not a list of numbers.
- Times are shown in Central time.
- Page JS lives inside template literals: no backticks, no `${`, no backslashes in page code.

## Shipping a change
1. Edit the widget in `widgets/`. Keep its title comment line (the first comment after the header) unchanged: Installer uses it to find the user's copy, whatever the user has named it.
2. Test it: `cd tools/test && npm ci && OFFLINE_LIBS=1 NODE_PATH=$(npm root -g) node run-all.js` (OFFLINE_LIBS only where the CDNs are blocked). It runs the static checks and every script as a widget and in the app (made-up FRED, other sources offline). Fix every ✗; ⚠ warnings don't block. `ONLY=SomeWidget.js` narrows it.
3. Add a dated, plain-English note for each changed script to `tools/notes.json` (one or two sentences on what the user will notice; newest 3 are shown). People read these in the "Update ready" panel before deciding to install or skip.
4. Rebuild the manifest: `python3 tools/build_manifest.py`. It keeps each entry's `name`, `title`, `about`, `needs` and `sig` (the title line), and recomputes `hash` and `notes`. The hash is FNV-1a (32-bit, hex) over the UTF-16 code units from the title line to the end, CRLF turned into LF, trailing whitespace trimmed. Widgets compare it with their own code to show the yellow glow, so never hand-edit it.
5. Commit and push to `staging`, never to `main`: `git push origin HEAD:staging`. GitHub (`.github/workflows/gate.yml`) runs the same tests and, only if they pass, moves `main` (where Installer looks) to that commit. A failure opens a "Gate:" issue and main stays put.
6. Before telling the user to run Installer, confirm the gate passed: `https://api.github.com/repos/r6mjz5hk4v-glitch/housing-widgets/actions/runs?branch=staging&per_page=1` shows `conclusion: success` for your commit (allow ~5 minutes, plus up to 5 more for GitHub's file cache).

## Nightly check
`.github/workflows/nightly.yml` runs `tools/test/nightly.js` at 08:00 UTC: every widget opened against the live internet (FRED made up; no key on GitHub). Each broken source gets a "Nightly:" issue that closes itself when the source recovers; sites that won't answer GitHub are listed in one "couldn't be checked" issue. When fixing a reader, the run's artifact has the real files' results and screenshots.
