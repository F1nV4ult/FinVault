# NovaSect

**A free, transparent equity-research platform.** Three tools, one philosophy: explainable models
over live public data — no black boxes in the browser.

🌐 **Live:** [novasect.space](https://novasect.space)

## 📖 Documentation

> **[docs/HANDBOOK.md](docs/HANDBOOK.md)** — the full platform handbook & quant reference:
> every engine, the exact formulas behind each number, the data flow, the security posture,
> assumptions, and a curated reading list. **Start here.**

The formal spec is auto-generated at `NovaSect_Technical_Reference.docx`
(via `scripts/generate-tech-doc.mjs`).

**Engineering log:** change history in [`CHANGELOG.md`](CHANGELOG.md); the *why* behind
architectural decisions in [`docs/adr/`](docs/adr/). Each push to `main` posts a summary to the
Discord `#updates-and-implementation` channel (`scripts/changelog.mjs` + the push-report workflow).

## The three tools

| Tool | What it does |
|---|---|
| **Sentinel** | Synthetic credit-spread engine — `max(baseSpread, rating-index OAS)` + a volatility/Merton-sigmoid premium + market, seniority and tenor legs → implied yield and a 10Y stress proxy. Live macro inputs refresh independently; issuer anchors are governed and manually reviewed. |
| **Osiris** | Seeded, reproducible Monte Carlo — OU + GARCH (energy/utilities) or GBM/Merton-jump + GARCH (industrials/defense) → a percentile cone, terminal P05/P25/P50/P75/P95 table and empirical probability above spot. |
| **FinVault** | **Equity research** — canonical issuer registry, SEC-XBRL/10-K deep-dives, source-aware browser fallbacks, live multiples/fundamentals, 5-year analysis and forensic health screens. |

## Stack

Vanilla JS (ES modules) · Chart.js + Canvas · TradingView embeds · Vercel (static + serverless
proxies) · Sentry + Umami. Client is bundled/minified with esbuild.

```
*.html                     ← pages
sentinel.v2.js, components/osiris/, components/…   ← clients (→ *.min.* served)
api/                       ← serverless proxies (hide keys, edge cache)
scripts/                   ← offline build/report/CI tooling (not served)
data/, physics-config.json ← static data fetched at runtime
```

## Development

```bash
npm run build          # esbuild: minify/bundle the client → commit the .min outputs
npm run generate-report -- <TICKER>   # offline FinVault report pipeline (needs SEC + Claude key)
npm run sitemap        # regenerate sitemap.xml
```
> The deployed `.min.*` files are committed and authoritative — Vercel runs a no-op build, so
> **re-run `npm run build` and commit the outputs after any client-source edit.**

## Notes

Secrets live in Vercel / GitHub Actions env (never in the repo). Source, build tooling, maps and
docs are kept off the public site via `.vercelignore`.

---

*NovaSect is an analytical and educational platform. All models are transparent approximations over
third-party public data and are **not investment advice**.*
