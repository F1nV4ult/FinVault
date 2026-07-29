#!/usr/bin/env node
/**
 * Build the versioned O3 model registry consumed by the Osiris browser client.
 *
 * This first registry preserves the validated O1/O2 cohort model for every
 * ticker exactly. It deliberately exposes both candidate families, selection
 * status, and parameter slots so the rolling O3 fitter can later publish
 * empirically selected weights without a client-contract migration.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const config = JSON.parse(readFileSync(join(root, 'physics-config.json'), 'utf8'));
const quality = JSON.parse(readFileSync(join(root, 'data', 'osiris-quality.json'), 'utf8'));
const outPath = join(root, 'data', 'osiris-models.json');

function candidate(id, selected, parameters) {
    return { id, weight: selected ? 1 : 0, selected, parameters };
}

const byTicker = {};
for (const [cohortName, cohort] of Object.entries(config.cohorts || {})) {
    for (const ticker of cohort.tickers || []) {
        const isOU = cohort.physics === 'Ornstein-Uhlenbeck';
        const primary = isOU ? 'ou_garch' : 'gbm_jump_garch';
        const qualityRow = quality.byTicker?.[ticker.symbol] || null;
        byTicker[ticker.symbol] = {
            cohort: cohortName,
            selection: {
                status: 'baseline_pending_rolling_validation',
                selectedModel: primary,
                backtestRunDate: quality.backtest?.runDate || null,
                confidence: qualityRow?.confidence || 'limited'
            },
            candidates: [
                candidate('ou_garch', isOU, {
                    reversionSpeedTheta: ticker.reversionSpeedTheta ?? null,
                    baselineVolatility: ticker.baselineVolatility ?? null,
                    garchAlpha: ticker.garchAlpha ?? 0.10,
                    garchBeta: ticker.garchBeta ?? 0.85
                }),
                candidate('gbm_jump_garch', !isOU, {
                    jumpFrequencyLambda: ticker.jumpFrequencyLambda ?? null,
                    jumpMu: ticker.jumpMu ?? 0,
                    baselineVolatility: ticker.baselineVolatility ?? null,
                    garchAlpha: ticker.garchAlpha ?? 0.10,
                    garchBeta: ticker.garchBeta ?? 0.85
                })
            ]
        };
    }
}

const output = {
    schemaVersion: 1,
    modelVersion: 'osiris-o3-registry-v1',
    sourceConfigVersion: config.version,
    qualityRunDate: quality.backtest?.runDate || null,
    byTicker
};
const serialized = JSON.stringify(output, null, 2) + '\n';
if (check) {
    const committed = existsSync(outPath) ? readFileSync(outPath, 'utf8').replace(/\r\n/g, '\n') : null;
    if (committed !== serialized) {
        console.error('data/osiris-models.json is stale. Run node scripts/build-osiris-models.mjs and commit the output.');
        process.exit(1);
    }
    console.log('✓ data/osiris-models.json is current');
} else {
    writeFileSync(outPath, serialized);
    console.log(`✓ Wrote data/osiris-models.json (${Object.keys(byTicker).length} tickers)`);
}
