# NovaSect — Platform Handbook & Quant Reference

> A complete, plain-English map of everything inside NovaSect: the three analytical tools
> (Sentinel, Osiris, FinVault), the financial theory behind each formula, the data flow, the
> serverless proxy layer, the simplifying assumptions, and a curated reading list.
>
> Read this top-to-bottom once and you'll be able to (a) explain any number the platform
> produces, (b) write much sharper prompts for extending it, and (c) judge which directions are
> worth taking the project. It is the companion to the auto-generated
> `NovaSect_Technical_Reference.docx` (produced by `scripts/generate-tech-doc.mjs`) — this file is
> the engineering+theory narrative; the docx is the formal spec.

---

## 0. The one idea behind NovaSect

NovaSect is a **free, static-hosted equity-research platform** made of three tools that share one
philosophy: **transparent, explainable models over live public data — no black boxes in the
browser.** Heavy compute runs client-side (so it's auditable) or in pre-generated reports; the
only thing hidden server-side is **API keys**, behind thin Vercel serverless proxies.

| | **Sentinel** | **Osiris** | **FinVault** |
|---|---|---|---|
| Question | What credit spread / default risk does this issuer carry *right now*? | What's the probability distribution of this stock's price over the next N days? | How financially healthy is this company, over 1 and 5 years? |
| Method | Synthetic credit-spread engine (macro + volatility + market legs) | Monte-Carlo stochastic simulation (OU / GBM-jump physics) | SEC-XBRL + 10-K analysis → pre-generated deep-dive report + live panels |
| Compute | Client-side, scenario-driven; cards refresh in small batches | Client-side, in a Web Worker, on demand | Offline pipeline (Claude-assisted) + live client panels |
| Freshness | FRED + Alpha Vantage via proxy | Yahoo + FRED via proxy | SEC EDGAR (pre-built) + Finnhub/Yahoo (live) |

**Shared infrastructure:** a Vercel static site + a handful of serverless API proxies that hide
keys and add edge caching, plus a GitHub-Actions layer for health checks and analytics.

---

## 1. Architecture at a glance

```
(repo root = the deployed static site; outputDirectory ".")
  index.html, about.html, sentinel.html, osiris.html,
  reports.html, report.html, brief.html, energy.html,
  industrials.html, consumer-staples.html, privacy.html, 404.html

  sentinel.v2.js → sentinel.v2.min.js      ← Sentinel engine (client, minified+served)
  script.js, osiris-bg.js, sentinel-promo.js  → *.min.js   (shared UI / background)
  style.css → style.min.css
  physics-config.json                      ← Osiris per-ticker physics params (served, fetched)
  data/universe.json, data/backtest-summary.json  ← cross-tool data (served, fetched)

  components/
    osiris/   osiris.js, osirisIngestion.js, osirisCloudCanvas.js, osirisOracle.js,
              stochasticWorker.js   → bundled to *.min.js (served); raw excluded
    global-search/, mobile-nav/, downloads/   ← small UI utilities

  api/                                     ← Vercel serverless functions (executed, NOT served)
    yahoo-proxy.js     ← Yahoo Finance (history, quote-summary, earnings, news, financials)
    finnhub-proxy.js   ← Finnhub (whitelisted endpoints)
    fred-proxy.js      ← FRED macro series
    alpha-proxy.js     ← Alpha Vantage sector-ETF volatility
    sentinel-history.js← Vercel KV (Upstash) 30-day spread history (server-write only)
    sec-proxy.js       ← SEC EDGAR companyfacts → compact 5Y history (FinVault)
    _ratelimit.js, _xbrl-history.js   ← shared server-only helpers (underscore = not routed)

  scripts/            ← OFFLINE build/CI tooling (excluded from deploy)
    build.js          ← esbuild minify/bundle of the client
    generate-report.mjs   ← FinVault 8-step report pipeline (SEC + Claude → .docx)
    generate-tech-doc.mjs ← regenerates NovaSect_Technical_Reference.docx
    build-universe.js, check-stale-anchors.js, generate-sitemap.js
    lib/safe-literal.js, lib/xbrl-history.mjs
    health/checks.mjs, run-all.mjs, notify.mjs   ← Discord health canaries
    report/eod-umami.mjs   ← daily Umami → Discord analytics digest

  .github/workflows/  health-checks.yml, eod-report.yml
  vercel.json   ← framework null, no-op buildCommand, security headers + CSP
  .vercelignore ← keeps source/build/docs off the public surface
```

**Stack:** vanilla JS (ES modules + classic scripts), Chart.js + custom Canvas for viz,
TradingView embeds, Tailwind (Play CDN), Sentry + Umami. Hosted on Vercel (static + serverless).
The client is **minified/bundled** via `npm run build` (esbuild); the `.min.*` outputs are
committed and authoritative (Vercel runs a no-op build).

---

## 2. Sentinel — the credit-spread engine

**The mechanic:** for ~83 covered issuers (the `COMPANIES` array in `sentinel.v2.js`), Sentinel
computes a *synthetic credit spread* (in basis points over a sovereign rate) every ~5 s from live
macro data. It is not a market quote — it's a transparent model of what the spread *should* be,
which surfaces credit stress that equity prices alone don't show.

Each issuer carries hand-calibrated anchors: `baseSpread` (bps under neutral macro), `marketBeta`,
`sectorBeta`, `residual` (auto-calibrated), `rating` (IG/HY band), `country`, `base_rate_type`
(UST/BUND/GILT), `netLeverage`, `interestCoverage`, `lastVerified`.

**The spread is assembled from three legs**, scaled by a `sensitivity` factor (0.35 for IG, 1.0
for HY — HY reacts far more to volatility):

**Leg 1 — Macro anchor** (floors the spread at the rating cohort's market level):
```
macroAnchor = max(baseSpread, ratingIndexBps)        // ratingIndexBps = live ICE BofA OAS for the rating
```

**VIX beta-shift** (regime switch — when fear is high, idiosyncratic factors compress and
everything correlates toward the market):
```
cFactor             = min(0.8, max(0, (VIX − 25) / 25))
effectiveSectorBeta = (1 − cFactor)·sectorBeta + cFactor·1.0
effectiveMarketBeta = (1 − cFactor)·marketBeta + cFactor·1.0   // at VIX=50, all betas → 1.0
```

**Leg 2 — Volatility premium** (the convex core; a sigmoid captures credit risk accelerating as
volatility rises):
```
proxyVol      = sectorVol·effectiveSectorBeta + residual
mertonScalar  = 1.5 + 1.0 / (1 + exp(−0.4·(proxyVol − 35)))    // ranges 1.5 (low vol) → 2.5 (high vol)
volatilityPremium = proxyVol · mertonScalar · stressMultiplier · sensitivity
```

**Leg 3 — Market component** + **seniority/tenure** (instrument-specific):
```
marketComponent    = effectiveMarketBeta · 50 · stressMultiplier · sensitivity
seniorityMultiplier= Secured 0.85 | Unsecured 1.00 | Subordinated 1.5 + baseTotal/200
tenureMultiplier   = 1 + (selectedTenure − 10)·0.03
```

**Final assembly:**
```
liveSpread   = (macroAnchor + volatilityPremium + marketComponent) · seniorityMultiplier · tenureMultiplier
impliedYield = sovereignRate + liveSpread / 100        // sovereignRate = base rate + country premium
PoD          = 1 − exp(−spread/10000 · 10)             // 10-yr horizon, implicit LGD = 100%
```
*PoD caveat:* overstates default probability for IG names (LGD=100% is conservative) — it's a
**relative** signal, not an absolute valuation.

The interface labels this metric **10Y Stress**, not PoD: it is a full-loss,
spread-implied stress proxy and must not be interpreted as a calibrated market-default probability.

**Spread-driver decomposition** (`getSpreadDrivers`) splits the live spread into six labelled
components (Anchor, Market, Volatility-Pure, Residual, Seniority, Tenure) in bps and % of total —
so every number is attributable.

**P0 calculation integrity:** `components/sentinel/sentinelSpread.js` is the shared browser
specification used by the displayed quote, driver breakdown, calibration loop, and waterfall.
Residuals are annualized-volatility percentage points because they enter `proxyVol` directly;
they are bounded to -30 through +30 points and are not converted to basis points.

**Auto-calibration loop** (every ~2 h, 3 random issuers): fetch 30-day realized vol from Yahoo,
compare to the model's proxy vol, convert the error to bps (`volError% × 1.5 bps`), and nudge
`company.residual += volError`, lerped over ~5 s to avoid UI jumps. Sets a "Market Pulse" state
(STABLE / VOL SPIKE / CONVEX TRIGGER).

**Reference tables:** rating bands (AAA 30–150 … HY 200–700 bps), sovereign premiums (US/DE/UK 0,
IT 145, BR/IN 250 …), risk levels (NOMINAL <200, CAUTION 200–400, ELEVATED 400–800, CRITICAL
>800), verification age (Fresh <60d, Aging 60–90d, Stale >90d).

**History sparklines:** `api/sentinel-history.js` stores a 30-day spread snapshot per ticker in
Vercel KV (Upstash). **Writes are server-only** (require `SNAPSHOT_WRITE_SECRET`); the browser is
read-only.

**Anchor review queue:** `anchor-review.html` turns the same versioned governance artifact into a
sorted, browser-local work queue. It surfaces verification age, approved rating/base-spread anchors,
and a direct issuer-dossier link; review notes, acknowledgements and material-candidate flags remain
in local storage and cannot alter production anchors. A production change still requires atomic
rating + comparable-bond spread + `lastVerified` approval under `SENTINEL-CALIBRATION.md`.

**Evidence ledger:** `data/sentinel-anchor-evidence.json` is the candidate-only audit record for
rating and bond/spread sources, their dates, reviewer, and proposed values. Validation rejects an
unknown issuer, missing agency/instrument/URL, incomplete candidate, or unsupported contract. It
does not modify the approved anchor; the governance artifact exposes only whether formal evidence
is pending or a candidate has been recorded.

**Review-packet export:** the queue can download its currently visible rows as a local CSV for
review hand-off. It contains approved anchors, verification age, evidence state/source links, and
optional browser-local flags or notes. It never uploads the packet or promotes an anchor.

**Approved-anchor history:** `data/sentinel-anchor-history.json` records the approved state of every
issuer. Governance validation compares the latest history entry to `sentinel.v2.js`, so an anchor
edit must be accompanied by a matching history entry. New refresh entries must reference the
validated candidate-evidence ID; the initial entries are explicitly labelled legacy manual records.

**Controlled candidate workflow:** `add-sentinel-anchor-candidate.mjs` validates a proposed
rating/spread, primary-source URLs, source date, and reviewer before it can enter the candidate-only
ledger. Its dry-run mode supports review without a file change; the promotion-plan command is
read-only and explains the required history + atomic-anchor update. Neither script can update a
production anchor.

The Sentinel queue can also download a per-issuer candidate-evidence JSON template. The reviewer
completes it offline and passes it to the candidate CLI in `--file` mode, first with `--dry-run`.
This keeps collection, validation, and eventual Git review separate from the live website.

Recorded candidates are separately filterable in the Sentinel queue. The row shows the proposed
rating/spread delta and reviewer-supplied rating/spread source links for inspection; no queue action
can promote the candidate.

Candidate sources expire after 30 days and require a review date on or after the source date. The
promotion-plan script can emit a machine-readable, read-only preview for review tooling. The normal
test command and scheduled freshness health check now include the full Sentinel evidence/history
governance gate, so a broken link between those artifacts is caught before release or in production.

---

## 3. Osiris — the Monte-Carlo simulation engine

**The mechanic:** for each covered ticker, Osiris runs thousands of stochastic price paths and
reports a **probability distribution** of outcomes (percentile bands + "probability of finishing
above today"), not a single point target. All simulation runs client-side in a Web Worker
(`stochasticWorker.min.js`).

**Forecast reproducibility:** the worker receives a stable seed derived from
ticker, latest market-data date, scenario, horizon, and model version. The
same inputs reproduce the same cone. Each displayed percentile is calculated
cross-sectionally across all simulated paths at every time step; it is not a
single path selected from terminal outcomes. See
`docs/OSIRIS-FORECAST-ARCHITECTURE.md` for the staged modernization roadmap.

**Inference readout:** the terminal panel shows P05, P25, P50, P75, and P95
as a compact table with terminal price and change versus spot. This complements
the cone: random jump events are distributed across paths and dates, so a
cross-sectional percentile curve should not be interpreted as one jumpy sample
trajectory.

**Forecast quality contract:** `data/osiris-quality.json` is a compact,
versioned derivative of the detailed backtest output. It gives each ticker a
sample size, interval-coverage diagnostics, directional-accuracy diagnostic,
confidence tier, calibration bins, and explicit skipped-symbol status. It does
not yet alter a live probability: only a rolling, horizon-specific calibration
fit may do that after validation.

**Model registry contract:** `data/osiris-models.json` contains the two
candidate families (`ou_garch`, `gbm_jump_garch`), normalized weights, selected
baseline, parameter slots, and quality provenance for every covered ticker.
The initial registry intentionally reproduces the validated incumbent model;
only rolling out-of-sample evidence may promote a new model or blend.

**Auto regime:** when the Osiris volatility control is set to Auto-detected,
the O4 classifier uses VIX, 21-day versus 126-day realized volatility, and
63-day drawdown to select a transparent volatility multiplier. The interface
shows the detected state, multiplier, and confidence; manual regime choices
continue to override it. A fallback macro payload is not treated as a live VIX
observation, so auto mode degrades conservatively when macro data is missing.

**Governance and provenance:** `data/osiris-governance.json` records the
selected model, validation date, source versions, and O4 regime version for
each issuer. Osiris marks validation for review after 90 days and stale after
180 days at display time. Model promotion is blocked until rolling
out-of-sample evidence meets the published sample, accuracy, coverage, and
explicit-approval gate; baseline models remain labelled as pending until then.

**Physics by sector cohort** (`physics-config.json`, schema `v1.8-consumer-staples`):

| Cohort | Model | Why |
|---|---|---|
| Energy & Utilities | Ornstein-Uhlenbeck (mean-reverting) | commodity-cycle / regulated dynamics |
| Industrials & Defense | GBM + Jump Diffusion (Merton) | trend-following + discrete contract/shock events |

Per-ticker params (`reversionSpeedTheta`, `jumpFrequencyLambda`, `jumpMu`, `baselineVolatility`,
`creditRating`) are static; **beta, dividend yield, and the OU long-term mean are computed live**
at simulation time by `osirisIngestion.js`.

**Ingestion (`osirisIngestion.js`)** — cached in IndexedDB (24 h) + session memo:
```
β  = cov(stockLogReturns, SPYLogReturns) / var(SPYLogReturns)   // OLS vs SPY, ≥30 shared days
dividendYield      = Σ(TTM dividends) / currentPrice
longTermMeanPrice  = mean(adjClose over 1y)                      // OU reversion target
σ_annual           = stdDev(dailyLogReturns) · √252
drift              = US10Y(FRED) − dividendYield
```
For horizons ≤ 7 days it switches to **intraday realized vol** (5-min bars, per-day variance incl.
overnight gap: `RV = Σ(log(bar_t/bar_{t−1}))² + (log(open/prevClose))²`, annualised over the last
20 days). Earnings within the horizon (≤21 d) multiply that step's vol by 2.5×.

**Stochastic engines (`stochasticWorker.js`):**
```
Box-Muller:   Z = √(−2·ln(u))·cos(2π·v)
Antithetic:   path 2i+1 uses −Z of path 2i (variance reduction; jumps drawn independently)

OU (Energy/Utilities):
   S_{t+1} = S_t + θ(μ − S_t)·dt + σ·S_t·Z·√dt        // proportional σ·S keeps prices > 0

GBM + Jump (Industrials/Defense), Merton (1976), Itô-corrected + jump compensator:
   compensator = λ·(exp(jumpMu + 0.5·σ_J²) − 1)        // σ_J = 0.07 fixed (calibrated constant)
   logJump     = N(jumpMu, σ_J²)  if U(0,1) < λ·dt  else 0
   S_{t+1}     = S_t·exp((drift − compensator)·dt + σ·√dt·Z + logJump)
```
> Implementation note: the live worker layers a **GARCH(1,1)** time-varying-variance term on top
> of these forms (the formal docx shows the constant-σ teaching version). `jumpStd` is a fixed
> `0.07` constant (v1.7 calibration fix — an earlier `σ × 1.5` introduced a downward bias).

**Device path caps:** Mobile 10k · Desktop-Low 25k (HI-FI 50k) · Desktop-High 25k (HI-FI up to
250k) — chosen from pointer type, viewport, RAM and cores.

**Oracle (`osirisOracle.js`)** — turns the path cloud into a headline:
```
Primary:  winProbability = count(S_T > S_0) / totalPaths        // exact empirical
Fallback (Gaussian, Abramowitz-Stegun 7.1.26):
   impliedSigma = (p95 − p05) / (2 · 1.645)
   probability  = Φ((p50 − S_0) / impliedSigma)  clamped [1%, 99%]
```
Percentiles p05/p10/p25/p45–p55/p50/p75/p90/p95 + `pAboveSpot` are extracted from sorted terminal
values. **Rendering** (`osirisCloudCanvas.js`) is a DPI-scaled Canvas: heatmap bands (OU) or
green/red gain-loss zones with jump arrows (GBM-jump), temporal/spatial anchor lines, hover
scrubber.

---

## 4. FinVault — the equity-research layer

**The mechanic:** pre-generated deep-dive reports per company (10-K narrative + financial tables),
plus **live panels** in `report.html` (multiples, fundamentals, analyst estimates, 5-year trends).

**Offline report pipeline (`scripts/generate-report.mjs`, 8 steps):**
1. **CIK resolution** — map ticker → SEC Central Index Key via `company_tickers.json`.
2. **10-K retrieval** — latest annual filing from EDGAR submissions (10-K, or 20-F for foreign).
3. **Text extraction** — Item 1 (Business), 1A (Risk Factors), 7 (MD&A), capped 35k chars each.
4. **XBRL** (`fetchXBRL2` → SEC `companyfacts`) — ~20 GAAP concepts, each resolved against a
   fallback synonym chain (e.g. `Revenues → RevenueFromContractWithCustomer… → SalesRevenueNet`).
   Now keeps **5 fiscal years** per concept (was 2).
5. **Ratio computation** — see below.
6. **Markdown tables** — Income/Balance/Cash-Flow + Liquidity/Solvency/Profitability, **plus the
   Five-Year Financial Summary / Ratios / Growth-&-Trend block** (`scripts/lib/xbrl-history.mjs`).
7. **Claude API** — forensic-accounting system prompt + the tables + 10-K extracts → Markdown report.
8. **DOCX** — Markdown → `.docx`, stamped with company/ticker/date.

**Ratios (computed from XBRL, per year):**
```
EBITDA           = OperatingIncome + D&A
Net Debt         = (LongTermDebt + ShortTermDebt) − Cash
Current Ratio    = CurrentAssets / CurrentLiabilities
Quick Ratio      = (CurrentAssets − Inventory) / CurrentLiabilities
Debt/Equity      = TotalDebt / Equity
Net Leverage     = NetDebt / EBITDA
Interest Coverage= EBITDA / InterestExpense
Operating Margin = OperatingIncome / Revenue
Net Margin       = NetIncome / Revenue
ROA / ROE        = NetIncome / TotalAssets  ·  NetIncome / Equity
```

**Five-year horizontal analysis** (`xbrl-history.mjs`): `pickSeries()` merges synonym tags **by
fiscal year** (robust to tag drift) → 5 annual values per concept; `historyData()` derives the
ratio matrix + CAGRs (revenue / net income / EPS / FCF / dividend / book value) +
margin/leverage trend arrows. CAGR shows "n/m" on a sign change.

**Live in the browser (`report.html`):** TradingView chart; **Multiples** + **Fundamentals**
(Finnhub `stock/metric`); **Forward estimates** (Finnhub `recommendation` + `price-target`);
**Five-Year Trends** panel — Revenue/Net-Income bars + Margins/ROE lines + CAGR chips, fed by:
- `api/sec-proxy.js` for **US filers** — resolves ticker→CIK, fetches `companyfacts`, runs
  `_xbrl-history.js` server-side, returns a compact (~KB) `{years, summary, ratios, cagr}` payload.
- `api/yahoo-proxy.js?mode=financials` **fallback for non-US filers** — Yahoo annual
  income/balance/cash-flow statement history (~4 yrs) mapped into the same shape (operating margin
  often absent for foreign filers; revenue/net-margin/CAGRs populate).

**Static data layer (`data/universe.json`)** — one entry per covered company merging Sentinel +
Osiris + FinVault metadata (built offline by `build-universe.js`).

---

## 5. The serverless proxy layer (data flow)

All external calls route through Vercel functions to **hide API keys** and add **edge caching**.
No keys ever reach the browser; the proxies are same-origin so no CORS is needed.

| Proxy | Upstream | Used by | Cache TTL |
|---|---|---|---|
| `yahoo-proxy` | Yahoo (cookie+crumb auth) | Sentinel calibration, Osiris ingestion, FinVault | history 24 h, quote-summary 6 h, earnings 12 h, news 30 m, financials 24 h |
| `finnhub-proxy` | Finnhub (endpoint whitelist) | FinVault panels, news | 30 m – 24 h per endpoint |
| `fred-proxy` | FRED | rates (DGS10), VIX, OAS indices | 6–24 h |
| `alpha-proxy` | Alpha Vantage | Sentinel sector-ETF vol (XLE/XLU/XLI) | 12 h; **`degraded:true`** flag on fallback (never presents mock as live) |
| `sec-proxy` | SEC EDGAR | FinVault 5-yr (US) | 24 h |
| `sentinel-history` | Vercel KV / Upstash | Sentinel sparklines | read-only public; **writes require `SNAPSHOT_WRITE_SECRET`** |

### Shared scenarios and scalable static snapshots

Scenario Lab persists its active macro shock in browser-local storage. It
drives Sentinel spread/yield inputs and Osiris simulation inputs; a scenario is
always marked by the site-wide banner. It is not sent to NovaSect or tied to an
account. `components/snapshots/snapshots.min.js`
is the common cache for static artifacts such as `universe.json` and governance
outputs. It deduplicates concurrent reads and has a six-hour session TTL. It
does not cache live quote or proxy data, whose independent freshness rules stay
in force.

**Shared `_ratelimit.js`:** distributed fixed-window limiter via Upstash Redis when configured,
in-memory fallback otherwise; client IP from the platform-set `x-forwarded-for`.

**GitHub Actions layer:**
- `health-checks.yml` (every ~2 h) → `scripts/health/run-all.mjs` → posts failures to Discord.
- `eod-report.yml` (daily ~22:00 Berlin) → `scripts/report/eod-umami.mjs` → pulls last-7-day Umami
  metrics (views, visitors, bounce, top pages/referrers, tracked click events) and posts a digest
  to Discord (`DISCORD_REPORT_WEBHOOK_URL` → falls back to `DISCORD_WEBHOOK_URL`).

---

## 6. Security & safety posture

- **Keys server-side only** (FRED/Finnhub/Alpha/Groq/Anthropic/Umami/`SNAPSHOT_WRITE_SECRET`/
  Upstash) — never in client or repo.
- **Headers** (`vercel.json`): HSTS-preload, `X-Frame-Options: SAMEORIGIN`, `nosniff`,
  Referrer-Policy, Permissions-Policy, and a **Content-Security-Policy (report-only)** allow-listing
  the exact CDNs (Tailwind needs `unsafe-eval`; cdnjs/jsdelivr; Umami/Sentry; TradingView).
- **Subresource Integrity (SRI)** on pinned CDN scripts (Three.js, PDF.js, Chart.js).
- **`sentinel-history` writes are server-gated** (closed the old anonymous-write hole).
- **Input validation** (regex/allow-lists) + **per-IP rate limiting** on every proxy.
- **Source-exposure hardening:** `.vercelignore` keeps `scripts/`, raw sources, source maps, the
  `.docx`, and `*.md` (incl. this handbook) off the public surface; the client is minified/bundled.

---

## 7. Assumptions, simplifications & known limitations

**Sentinel** — synthetic, not market spreads; 10Y Stress/PoD overstates IG default risk (LGD=100%);
anchors are hand-calibrated and decay (verification badge). Macro data can refresh automatically,
but issuer ratings and anchor spreads remain governed manual inputs subject to the published
60-day review / 90-day stale policy; `ratingIndexBps`/`sectorVol` depend on Alpha/FRED availability
(fallbacks exist). Auto-calibration only spot-checks 3 names per cycle.

**Osiris** — constant per-ticker physics params; OU mean is a 1-yr arithmetic average; jump params
are static; foreign filers and thin-data names degrade; correlation across names is not modelled
(single-name only). Drift = riskfree − dividend yield (no equity-risk-premium term).

**FinVault** — XBRL tag coverage varies (some filers omit `OperatingIncomeLoss` etc. → "N/A");
foreign 20-F / PDF-only names lack SEC `companyfacts` (5-yr panel falls back to Yahoo's ~4 yrs or
hides); the deep-dive narrative is Claude-generated (reviewed before publish); multiples over time
are not point-in-time-perfect. Reports are pre-generated, so fundamentals are as fresh as the last
run.

**General** — rate limits are soft (per warm instance unless Upstash is set); `x-forwarded-for` is
trusted as the platform sets it; Yahoo's cookie/crumb scraping is unofficial and can break.

These are scope lines, not bugs — each is a clean place to add depth.

---

## 8. Reference reading (curated)

### 8.1 Credit & fixed income (Sentinel)
- ⭐ **Frank Fabozzi — "Bond Markets, Analysis, and Strategies"** — the standard on spreads, yields, credit.
- **"The Handbook of Fixed Income Securities"** (Fabozzi, ed.) — deep reference incl. OAS.
- **Merton (1974) "On the Pricing of Corporate Debt"** — the structural default model behind the convexity intuition.
- **Moody's/S&P/Fitch ratings methodologies**; **ICE BofA OAS indices** (FRED `BAMLC*`); **markets.newyorkfed.org** for rates.

### 8.2 Stochastic processes & derivatives (Osiris)
- ⭐ **John Hull — "Options, Futures, and Other Derivatives"** — GBM, Itô, Monte-Carlo, jumps; maps onto the worker.
- **Paul Glasserman — "Monte Carlo Methods in Financial Engineering"** — variance reduction (antithetics), path simulation.
- **Merton (1976) "Option Pricing when Underlying Returns are Discontinuous"** — the jump-diffusion source.
- **Ornstein-Uhlenbeck / mean-reversion** notes (commodity modelling); **GARCH** (Bollerslev 1986) for the vol term.

### 8.3 Financial-statement & equity analysis (FinVault)
- ⭐ **"Financial Statement Analysis" — Subramanyam** (or **White, Sondhi & Fried**) — ratios, quality of earnings.
- **Aswath Damodaran** (damodaran.com) — valuation, multiples, cost of capital (free + definitive).
- **SEC EDGAR full-text search + the XBRL `companyfacts`/`companyconcept` APIs** — the primary data.
- **"Financial Shenanigans" — Howard Schilit** — forensic-accounting red flags (sharpens the report prompt).

### 8.4 Platform / engineering
- **Vercel docs** — serverless functions, `vercel.json`, `.vercelignore`, edge caching, cron.
- **MDN: Web Workers, Canvas, IndexedDB, CSP, Subresource Integrity.**
- **esbuild docs** — bundling/minification.
- **Umami API docs** (umami.is/docs) — the analytics digest source.

---

## 9. How to give NovaSect better prompts (using this document)

Naming the parts makes prompts precise:
- **Reference the engine/leg:** *"In `sentinel.v2.js`, add a liquidity leg to the spread that
  widens when the bid-ask proxy rises, and surface it in `getSpreadDrivers`."*
- **Reference the physics:** *"In `stochasticWorker.js`, add a stochastic-volatility (Heston) path
  option for the Industrials cohort, behind a config flag in `physics-config.json`."*
- **Reference the data source:** *"Extend `sec-proxy.js` to also return shares-outstanding history
  so FinVault can show buyback/dilution over 5 years."*
- **Keep the invariants:** *"…client-side, explainable, no key in the browser, and add it behind the
  existing proxy + rate-limit pattern."* After any client edit: **run `npm run build` and commit
  the `.min` outputs** (Vercel does a no-op build).

### Natural next directions (impact-for-effort)
1. **FinVault risk scorecard** — Altman-Z / Piotroski-F / Beneish-M from the 5-yr XBRL + cross-link
   Sentinel credit risk and Osiris forward risk (the planned "Phase 2/3").
2. **FinVault 5-year event timeline** — SEC 8-K item codes + dividends/splits/earnings surprises.
3. **Sentinel multi-name correlation** and a portfolio credit view.
4. **Osiris**: Heston/stochastic-vol, multi-asset correlated paths, scenario overlays.
5. **Server-side spread snapshot writer** (cron) to repopulate Sentinel history authoritatively.

---

*NovaSect is an analytical and educational platform. All models are transparent approximations over
third-party public data and are not investment advice. Benchmark anchors and thresholds are
illustrative and should be refreshed from current sources.*
