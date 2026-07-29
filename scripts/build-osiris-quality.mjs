#!/usr/bin/env node
/**
 * Compile the rolling Osiris backtest output into a small runtime quality
 * artifact. The browser needs provenance and confidence metadata, not the
 * multi-megabyte calibration tables in backtest-summary.json.
 *
 * Usage:
 *   node scripts/build-osiris-quality.mjs
 *   node scripts/build-osiris-quality.mjs --check
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const inputPath = join(root, 'data', 'backtest-summary.json');
const outputPath = join(root, 'data', 'osiris-quality.json');
const summary = JSON.parse(readFileSync(inputPath, 'utf8'));

function confidence(record) {
    const n = Number(record?.n || 0);
    const coverage = Number(record?.ci90_coverage);
    const directional = Number(record?.directional_accuracy_calibrated ?? record?.directional_accuracy);
    if (n >= 400 && coverage >= 0.87 && coverage <= 0.93 && directional >= 0.54) return 'high';
    if (n >= 250 && coverage >= 0.84 && coverage <= 0.96) return 'moderate';
    return 'limited';
}

function compactBins(bins) {
    return (Array.isArray(bins) ? bins : [])
        .filter(bin => Number.isFinite(bin?.predicted_prob) && Number.isFinite(bin?.actual_freq) && Number(bin?.n) > 0)
        .map(bin => ({ predicted: Number(bin.predicted_prob), observed: Number(bin.actual_freq), n: Number(bin.n) }));
}

const byTicker = {};
for (const [ticker, record] of Object.entries(summary.by_ticker || {})) {
    byTicker[ticker] = {
        sampleSize: Number(record.n || 0),
        directionalAccuracy: Number(record.directional_accuracy_calibrated ?? record.directional_accuracy),
        coverage90: Number(record.ci90_coverage),
        coverage50: Number(record.ci50_coverage),
        meanInterval90WidthPct: Number(record.mean_ci90_width_pct),
        confidence: confidence(record),
        // These empirical bins are retained for O2 calibration. They are not
        // applied to live probabilities until a rolling, horizon-specific
        // calibration fit is published (O2 promotion gate).
        empiricalProbabilityBins: compactBins(record.pAboveSpot_calibration),
        calibratedProbabilityBins: compactBins(record.pAboveSpot_calibration_platt)
    };
}

const overall = summary.overall || {};
const output = {
    schemaVersion: 1,
    modelVersion: 'osiris-o2-quality-v1',
    backtest: {
        runDate: summary.meta?.run_date || null,
        historyRange: summary.meta?.run_params?.history_range || null,
        warmupDays: summary.meta?.run_params?.warmup_days || null,
        paths: summary.meta?.run_params?.paths || null,
        tickerCount: Object.keys(byTicker).length,
        skippedTickers: summary.meta?.skipped_tickers || []
    },
    overall: {
        sampleSize: Number(overall.n || 0),
        directionalAccuracy: Number(overall.directional_accuracy_calibrated ?? overall.directional_accuracy),
        coverage90: Number(overall.ci90_coverage),
        coverage50: Number(overall.ci50_coverage),
        confidence: confidence(overall)
    },
    byTicker
};

const serialized = JSON.stringify(output, null, 2) + '\n';
if (check) {
    const committed = existsSync(outputPath) ? readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n') : null;
    if (committed !== serialized) {
        console.error('data/osiris-quality.json is stale. Run node scripts/build-osiris-quality.mjs and commit the output.');
        process.exit(1);
    }
    console.log('✓ data/osiris-quality.json is current');
} else {
    writeFileSync(outputPath, serialized);
    console.log(`✓ Wrote data/osiris-quality.json (${Object.keys(byTicker).length} tickers)`);
}
