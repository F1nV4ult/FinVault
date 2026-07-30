# Sentinel anchor refresh audit — 2026-07-30

## Result

`node scripts/check-stale-anchors.js` found 83 issuer anchors in the 60–90 day
review window, no anchors over 90 days old, and no stored base spreads outside
their current validation bands. The queue exists because the prior verification
pass was carried out in May, not because the daily FRED / Alpha Vantage macro
feeds are stale.

This audit deliberately does **not** change `lastVerified` by itself. A Sentinel
anchor is only current after its rating, comparable senior-unsecured spread, and
verification date have been reviewed together.

## Priority review queue

The initial order is high-yield / potential bucket-change issuers, followed by
weak BBB issuers. The table records what can be safely established from primary
public material; `baseSpread` remains pending where a current comparable-bond
trade has not yet been captured.

| Priority | Ticker | Stored bucket / spread | Rating evidence | Candidate outcome | Gate before production update |
| --- | --- | --- | --- | --- | --- |
| P0 | RHM.DE | HY / 380 bps | Rheinmetall creditor-relations page reports Moody's **Baa1**, positive, since 25-Mar-2025. | Change bucket to **BBB**; current `HY` is incorrect. | Capture current senior-unsecured EUR bond yield/spread; recalibrate 380 bps against the BBB band before setting `lastVerified`. |
| P0 | DAL | HY / 290 bps | Delta's Q1 2026 results state investment-grade ratings at all three major agencies. | Change bucket to at least **BBB**; `HY` is incorrect. | Capture a current senior-unsecured USD bond OAS/yield proxy, then confirm the conservative agency notch and update all anchor fields. |
| P0 | PCG | HY / 280 bps | PG&E's debt-investor page (data as of 31-Mar-2026) lists S&P BB+, Moody's Baa3 for the utility, and Fitch BBB-. | Retain **HY** under Sentinel's conservative cross-agency rule. | Refresh the parent-level comparable-bond spread; do not substitute the utility's secured debt spread. |
| P0 | RR.L | BBB / 190 bps | S&P affirmed BBB+ on Rolls-Royce Holdings / senior unsecured debt on 1-Jul-2026; Rolls-Royce reported Moody's A3 and Fitch A- in its April update. | Retain **BBB** (conservative S&P bucket). | Capture current GBP senior-unsecured bond spread before dating the review. |
| P1 | MPC | BBB / 170 bps | Current earnings disclosure is available, but this pass did not identify a current public ratings table. | No proposed change. | Verify agency rating and USD bond spread from the selected recurring source. |

### Primary evidence

- Rheinmetall: <https://ir.rheinmetall.com/investor-relations/creditor-relations/rating>
- Delta Q1 2026: <https://ir.delta.com/news/news-details/2026/Delta-Air-Lines-Announces-March-Quarter-2026-Financial-Results/default.aspx?pubDate=20260408>
- PG&E fixed income: <https://investor.pgecorp.com/investors/Fixed-Income/default.aspx>
- Rolls-Royce S&P action: <https://spratings.spglobal.com/ratings/en/regulatory/article/-/view/type/HTML/id/3588826>
- Rolls-Royce April 2026 update: <https://www.rolls-royce.com/~/media/Files/R/Rolls-Royce/documents/investors/rr-holdings-plc-agm-trading-update-2026.pdf>

## Recurring-source recommendation

### Ratings: issuer disclosures first, licensed feed for automation

Use an issuer/agency evidence feed for the audit trail and a licensed ratings
feed for systematic coverage. Agency ratings are not reliably available through
a free, redistribution-permitted API for this global universe.

1. Subscribe to issuer-investor-relations RSS feeds and SEC EDGAR submissions
   (US issuers). On a new 10-Q, 10-K, 6-K, earnings release, or ratings action,
   queue that issuer for review. Store the source URL, source date, agency,
   rating, outlook, and extraction confidence.
2. For machine-readable global coverage, license a ratings data product from a
   recognised provider (S&P Global Ratings, Moody's Ratings / Moody's Analytics,
   Fitch Solutions, LSEG, ICE Data Services, or Bloomberg). Confirm display and
   redistribution rights before storing or showing the data.
3. Resolve agency disagreement using Sentinel's existing conservative rule:
   use the lowest long-term issuer / senior-unsecured rating, never a secured
   subsidiary rating. A low-confidence or conflicting extraction creates a
   review item rather than overwriting the production anchor.

### Spread anchors: bond-level market data, not an equity-data proxy

For US issuers, FINRA TRACE is the preferred raw source. It publishes corporate
bond transaction data and offers a Query API, but production access, historical
data, and display use may require agreements or fees. Use a licensed TRACE feed
or an authorised vendor, map each issuer to an approved 5–10 year
senior-unsecured CUSIP, and calculate the stored proxy as `bond YTM - matched
Treasury yield`. FINRA references:

- <https://www.finra.org/filing-reporting/trace/data>
- <https://developer.finra.org/products/query-api>
- <https://www.finra.org/sites/default/files/2023-03/TRACE-CA-debt-web-api-Specs-v4.11.pdf>

For non-US issuers, use a licensed global evaluated-price / bond-yield provider
(for example LSEG, ICE, Bloomberg, or FactSet). There is no TRACE-equivalent
free global feed with sufficient coverage and rights for a customer-facing
product.

### Implementation shape

Run a daily server-side acquisition job and a quarterly verification job:

1. Fetch and cache rating/bond observations centrally; never make a browser
   visit responsible for source freshness.
2. Save immutable observations with `retrievedAt`, `sourceDate`, licence/source,
   instrument identifier, currency, maturity, seniority, and confidence.
3. Compute a candidate anchor only when the selected bond satisfies the
   maturity/seniority/liquidity rules. Require an approval gate for a rating
   bucket change or a material spread move.
4. Publish only approved snapshots to `data/sentinel-governance.json` and the
   issuer registry. Preserve the previous approved anchor on failed fetches.
5. Surface separate **source freshness**, **anchor verification age**, and
   **fallback state** in the UI so an upstream outage is never presented as a
   current quote.

This converts today's manual 60-day badge into an evidence-backed queue without
claiming that unverified or unlicensed market data is live.
