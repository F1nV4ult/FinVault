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

1. O2: rolling backtests and promoted calibration artifacts.
2. O3: per-ticker model selection and parameter fitting.
3. O4: regime, factor, and event-risk overlays.
4. O5: model governance, monitoring, and user-facing provenance.

Each later layer must preserve O1's seed, model-version, and data-as-of
contract so forecasts remain auditable and reproducible.
