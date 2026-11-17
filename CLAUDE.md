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
2. Syntax-check the file and test it under a Scriptable mock where possible.
3. Rebuild `manifest.json`: one entry per script with `name`, `file`, `title`, `about`, `needs`, `sig` (the title line) and `hash`. The hash is FNV-1a (32-bit, hex) over the file's UTF-16 code units, from the title line to the end, with CRLF turned into LF and trailing whitespace trimmed. Widgets compare it with their own code to show the yellow "Update ready" glow, so a wrong hash means false alarms on every phone.
4. Commit and push to `main`. Then tell the user to run Installer.
