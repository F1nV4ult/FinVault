# Osiris Forecast Architecture

## O1 — reproducible probability cone

Osiris uses a browser Web Worker for Monte Carlo simulation. The worker accepts
a stable seed produced from the ticker, latest market-data date, scenario,
horizon, and model version. Identical inputs therefore produce identical
forecast paths, making regression tests and model comparisons meaningful.

The worker stores simulated prices as a path matrix, then calculates every
displayed percentile across all paths at each time step. The P05/P50/P95 lines
are consequently a probability cone, not selected paths sorted by terminal
price. Terminal `pAboveSpot` remains an empirical count across all paths.

The inference panel also reports terminal P05, P25, P50, P75, and P95 in a
table with price and change versus spot. It makes the distribution inspectable
when a statistically correct percentile cone looks visually smooth: jumps are
idiosyncratic path events, not movements expected to occur on the same day in
every simulated path.

## Planned layers

## O2 — forecast-quality artifact

`scripts/build-osiris-quality.mjs` compiles the detailed backtest output into
`data/osiris-quality.json`. The compact artifact records per-ticker sample
size, directional accuracy, interval coverage, confidence tier, calibration
bins, and skipped symbols. It is deliberately descriptive in this first O2
increment: calibration is not applied to a live forecast until a rolling,
horizon-specific fit satisfies its promotion gate.

The Osiris interface fetches this compact artifact for its historical-backtest
badge, including an explicit quality tier. It no longer needs to load the full
raw backtest summary during interactive use.

## Remaining layers

## O3 — model registry contract

`scripts/build-osiris-models.mjs` compiles the physics configuration and O2
quality artifact into `data/osiris-models.json`. Every ticker exposes both
`ou_garch` and `gbm_jump_garch` candidates with normalized weights, an active
baseline selection, version provenance, and a confidence diagnostic. The O3
registry currently preserves the validated incumbent model exactly; its status
explicitly says `baseline_pending_rolling_validation` until candidate scores
are available.

## Remaining layers

1. O2: rolling backtests and promoted calibration artifacts.
2. O3: rolling candidate fitting and model-weight promotion.
3. O4: transparent auto-regime classifier (implemented), followed by factor and empirical event-risk overlays.
4. O5: model governance, monitoring, and user-facing provenance (implemented).

Macro fallback values are never treated as live regime evidence. When VIX is
unavailable, the classifier retains a neutral multiplier unless the ticker's
own realized-volatility or drawdown evidence warrants a change, and it lowers
the reported confidence.

Each later layer must preserve O1's seed, model-version, and data-as-of
contract so forecasts remain auditable and reproducible.

## Shared Scenario Lab and snapshot contract

Scenario Lab is browser-local (not account-backed) and follows users across the NovaSect tools.
For Osiris, a VIX override and sector-volatility shock map into a bounded
simulation-volatility multiplier; a rate shock adjusts annual drift; and the
commodity/FX input shifts the OU reversion target for energy/utilities or the
industrial jump-mean overlay. The normalized scenario is included in the seed,
so a shocked forecast is reproducible and cannot be mistaken for the baseline.

Static cross-tool artifacts now flow through `window.NSSnapshots`: the issuer
registry, screener, governance, model-quality, and physics snapshots are
deduplicated in memory and retained for six hours in session storage. Live
market/API responses remain under their existing proxy-specific TTLs and are
not absorbed by this client cache.

## O5 — governance, monitoring, and provenance

`scripts/build-osiris-governance.mjs` compiles the O2 validation results and
O3 registry into `data/osiris-governance.json`. Each ticker records its active
model, validation as-of date, quality and registry versions, O4 regime version,
and explicit review (90-day) and stale (180-day) thresholds. The browser
assesses freshness at render time, so a historic validation can never continue
to appear current merely because its artifact was once valid.

The artifact also codifies the promotion gate: at least 252 out-of-sample
days, a 5% directional-accuracy improvement, 90% interval coverage within
85–95%, and an explicit `rolling_validation_promoted` status. Until those
requirements are met, the baseline remains visibly marked as pending
validation; no candidate is silently promoted.
