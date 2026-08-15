# Sentinel Anchor Calibration Procedure

The Sentinel engine uses two manually-maintained values per company to anchor
its credit-spread math:

- **`rating`** — rating bucket (`AAA` / `AA` / `A` / `BBB` / `BB` / `B` / `HY`).
  Determines which ICE BofA index acts as the market-wide floor.
- **`baseSpread`** — company-specific OAS in bps. The model uses
  `max(baseSpread, ratingIndexBps)` so this value pins the floor for names that
  trade wider than their rating bucket average (e.g. fallen angels, idiosyncratic
  credits).

These are static between refreshes. This document defines how and when to
refresh them.

## Cadence

**Quarterly**, within ~30 days of each issuer's earnings release. Rolling
update — refresh each name when its quarterly earnings drop, not a single
bulk pass.

The `lastVerified` field on each company records the date both were last
re-checked together. Three staleness tiers, visible in the Sentinel Brief
footer and (when overdue) as a red dot on the card:

| Tier    | Age          | Treatment                                     |
| ------- | ------------ | --------------------------------------------- |
| Fresh   | < 60 days    | Green text; no action needed                  |
| Aging   | 60–90 days   | Amber text; refresh due before quarter ends   |
| Overdue | > 90 days    | Red text + red dot on card; refresh now       |

## What to refresh per company

Three fields, atomically:

1. `rating` — confirm the rating bucket against a primary source. If the
   bucket has changed (e.g. BBB → A), update this field. **A rating change
   matters more than a spread change** because it shifts which ICE BofA
   index the model uses as the floor.
2. `baseSpread` — current senior-unsecured OAS for the issuer, in bps.
3. `lastVerified` — set to today's date in `YYYY-MM-DD` format.

## Where to find each value

### Rating

Primary sources, in preference order:

1. **S&P Global** — issuer page on spglobal.com/ratings
2. **Moody's** — `moodys.com/credit-ratings`
3. **Fitch Ratings** — `fitchratings.com`
4. **The issuer's most recent 10-K / annual report** — long-term debt note
   typically discloses current ratings from each agency

When ratings disagree across agencies, **use the lowest (most conservative)**.

If the issuer is unrated (rare for the Sentinel universe), use the rating
bucket of the most comparable peer in the same sector.

### baseSpread

Two options, in preference order:

1. **FINRA TRACE** (free, public) — pull the most-traded senior unsecured
   bond from the issuer with at least 5 years to maturity. Compute:
   `OAS_proxy ≈ YTM(bond) − YTM(UST same maturity)`.
   This is a proxy — TRACE doesn't publish OAS directly — but is close
   enough for the model's purpose.
2. **The issuer's 10-K debt-disclosure note** — recent bond pricing or
   weighted-average cost of debt can serve as a fallback.

Record the source in the commit message so future audits can trace it.

## Validation bands

Out-of-band values trigger console warnings at page load (and a dedicated
section in the audit script). These bands are loose by design — they catch
transcription errors (1250 vs 125) without flagging every reasonable issuer-
specific variation:

| Rating | Min (bps) | Max (bps) |
| ------ | --------- | --------- |
| AAA    | 30        | 150       |
| AA     | 50        | 200       |
| A      | 70        | 250       |
| BBB    | 100       | 350       |
| BB     | 200       | 500       |
| B      | 350       | 700       |
| HY     | 200       | 700       |

Bands also live in code at [sentinel.v2.js:RATING_BANDS](sentinel.v2.js).
Keep this table and the code in sync.

## Audit script

```bash
node scripts/check-stale-anchors.js              # full report
node scripts/check-stale-anchors.js --overdue    # only overdue rows
node scripts/check-stale-anchors.js --out-of-band # only out-of-band rows
```

Run at the start of each quarter to get a triaged refresh list.

## Browser-local review queue

`anchor-review.html` is the operational companion to the audit script. It
sorts the same approved anchors by verification age and lets a reviewer keep a
**browser-local** note, acknowledgement, or material-candidate flag while
research is in progress. It does not write `sentinel.v2.js`, change a rating,
change a spread, or send review activity to NovaSect.

Use the queue to organise evidence collection, then make a production update
only after the atomic sign-off checklist below is complete. A local
acknowledgement is deliberately not evidence that an anchor is current.

## Machine-readable evidence ledger

`data/sentinel-anchor-evidence.json` is a **candidate-only** audit ledger. It
holds the rating agency and URL, the bond/spread instrument and URL, source
date, reviewer, and proposed rating/spread before a governed anchor change is
considered. The ledger is intentionally empty until evidence is collected; it
never overwrites an approved value in `sentinel.v2.js`.

Validate it with:

```bash
node scripts/validate-sentinel-anchor-evidence.mjs
```

The build exposes only an evidence-completeness state to the review queue. A
recorded candidate remains a candidate until the atomic sign-off checklist is
completed and the production anchor is deliberately changed in a separate
reviewed commit.

## Sign-off checklist (per company)

When updating an entry in `COMPANIES`:

- [ ] Rating confirmed from at least one of S&P / Moody's / Fitch
      (lowest used if conflict)
- [ ] If rating bucket changed, the `rating` field is also updated (not
      just `baseSpread`)
- [ ] `baseSpread` lies within its rating's validation band
- [ ] `lastVerified` set to today (`YYYY-MM-DD`)
- [ ] Source recorded in commit message (e.g. "XOM Q1 2026 — S&P AA-,
      TRACE OAS ~115 bps from 4.5% 2034 senior unsecured")
- [ ] Audit script run post-edit, no new warnings

## Priority for the first full pass

High → low. HY and weak-BBB names move most quarter-over-quarter and have
the largest impact on the brief when stale:

1. **HY names** — MPC, RHM.DE, PCG, DAL, RR.L
2. **Weak BBB / fallen-angel candidates** — BA, OXY, IBE.MC, LDO.MI, NGE.PA
3. **BBB core** — the remaining BBB list
4. **A / AA core** — relatively stable; can backfill last

## What this procedure does not cover

- **Sovereign anchors** (UST/Bund/Gilt 10Y, ICE BofA index OAS, VIX) — these
  refresh automatically every 24h via the FRED proxy. Manual intervention
  not required.
- **Sector volatility** (XLE/XLU/XLI) — refresh automatically every 24h via
  the Alpha Vantage proxy.
- **Per-company volatility residuals** — calibrated automatically every 2h
  via the Yahoo proxy spot-check loop.

The quarterly procedure is *only* for the credit fundamentals
(`rating`, `baseSpread`).
