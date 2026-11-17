# Housing Widgets

iPhone home-screen widgets for mortgage and housing data: rates and spreads, new homes and builders, existing homes, affordability, migration, the consumer, and a calendar of industry reports. Each one is a small widget; tap it for a full-screen view with charts and a **Share as PDF** button.

They run in [Scriptable](https://apps.apple.com/us/app/scriptable/id1405459188), a free iPhone app. All data comes from public sources. Nothing to pay for.

## Install (about 5 minutes)

1. **Get Scriptable** from the App Store and open it once.
2. **Copy the installer.** On your iPhone, open
   [Installer.js](https://raw.githubusercontent.com/r6mjz5hk4v-glitch/housing-widgets/main/widgets/Installer.js),
   press and hold on the text → **Select All** → **Copy**.
3. **Paste it into Scriptable.** Tap **+** (top right), paste, tap the title at the top and name it `Installer`, then tap **Done**.
4. **Run it.** Tap the Installer script → **Install / update all**. Every widget appears in Scriptable.
5. **Run Setup** (the installer offers to start it). It walks you through:
   - **FRED API key** (needed by most widgets). Free from the St. Louis Fed: [fredaccount.stlouisfed.org/apikeys](https://fredaccount.stlouisfed.org/apikeys). Make an account, tap **Request API Key**, copy it, paste it into Setup.
   - **Your name and email** (recommended). The SEC asks for these when Chartbook and Builder Stocks pull builder filings. They go only to sec.gov.
   - Optional: an **ElevenLabs** key for natural-voice "Listen", your **home metro**, and which **builder** to highlight.
6. **Add a widget.** Press and hold the home screen → **+** → search **Scriptable** → pick the **small** size → **Add Widget**. Then press and hold the new widget → **Edit Widget** → **Script** → choose one. Set **When Interacting** to **Run Script** so tapping opens the full view.

Repeat step 6 for each widget you want.

## Updating

Run **Installer** again. It only rewrites what changed, updates itself, and keeps your settings.

You don't have to keep checking: once a day each widget looks for a newer version on GitHub. When there is one, the widget gets a thin yellow glow around its edge, and its full view shows an **Update ready** card with a **Run Installer** button.

## The widgets

| Widget | What it shows | Needs |
|---|---|---|
| **Mortgage Spread** | 30-year mortgage rate vs the 10-year Treasury, with a term-premium breakdown | FRED key |
| **Rates** | Weighted average 30-year note rate across loan products (Optimal Blue) | FRED key |
| **ARM Indicator** | 10Y minus 5Y Treasury slope: when an ARM pencils | FRED key |
| **SOFR 30 Avg** | 30-day average SOFR (NY Fed) | FRED key |
| **Lock In** | Outstanding mortgages by note-rate bucket | FRED key |
| **New Homes** | Single-family starts by purpose, last 12 months vs prior | FRED key |
| **Builder Inputs** | How much of new-home price growth building costs explain | FRED key |
| **Builder Stocks** | Heatmap of the 10 largest builder stocks, plus earnings-call replays | — |
| **Existing** | Existing-home sales, prices and inventory (NAR) | FRED key |
| **Balance of Power** | Redfin's count of active buyers vs sellers | — |
| **Affordability Gap** | Income needed for the median home vs median income, by metro (Atlanta Fed) | — |
| **Payment Change** | Monthly payment vs N years ago: price vs rate | FRED key |
| **Migration** | Net migration by metro (Census) | — |
| **Redfin Migration** | Where house hunters want to move (Redfin) | — |
| **Borrower Credit** | Household debt and delinquency (NY Fed) | — |
| **Personal Savings** | Personal saving rate (BEA) | FRED key |
| **Sentiment** | University of Michigan sentiment | FRED key |
| **Unemployment** | Unemployment rate (BLS) | FRED key |
| **Chartbook** | Release calendar of industry PDFs (Ginnie, Urban, ICE, Fannie, MBA, HUD, Fed, builder 10-Qs) with Listen | — |

## Your keys and settings

Nothing secret is in these files. Your FRED key, name and email, ElevenLabs key and preferences are saved in your phone's keychain by Setup, where only Scriptable can read them. Run Setup any time to change them, or to copy your ElevenLabs key to another phone.

## Good to know

- Data is pulled from FRED (St. Louis Fed), Census, BLS, BEA, the SEC, the New York and Atlanta Fed, MBA, Fannie Mae, Ginnie Mae, Urban Institute, NAR, Realtor.com, Redfin and Yahoo Finance. Each widget's full view names its sources and release dates.
- Yahoo Finance (Builder Stocks) isn't an official data feed and can change without notice.
- This is a personal project for information only. It isn't investment, lending or financial advice.
