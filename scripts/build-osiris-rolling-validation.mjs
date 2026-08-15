#!/usr/bin/env node
/**
 * Build the compact rolling OOS validation artifact used by model promotion.
 *
 * `data/osiris-candidate-backtests.json` is intentionally optional. It is
 * populated only by a real historical candidate runner. When absent, this
 * builder produces explicit unavailable evidence and the promotion policy
 * retains every validated incumbent model.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessPromotion, PROMOTION_POLICY } from './lib/osiris-promotion.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const quality = JSON.parse(readFileSync(join(root, 'data', 'osiris-quality.json'), 'utf8'));
const candidatePath = join(root, 'data', 'osiris-candidate-backtests.json');
const candidateInput = existsSync(candidatePath) ? JSON.parse(readFileSync(candidatePath, 'utf8')) : null;
const outPath = join(root, 'data', 'osiris-rolling-validation.json');

const byTicker = {};
for (const [ticker, baseline] of Object.entries(quality.byTicker || {})) {
    const candidateSet = candidateInput?.byTicker?.[ticker] || null;
    const candidates = {};
    for (const [candidateId, candidate] of Object.entries(candidateSet?.candidates || {})) {
        candidates[candidateId] = { ...candidate, promotion: assessPromotion({ baseline, candidate }) };
    }
    const promoted = Object.entries(candidates)
        .filter(([, row]) => row.promotion.promoted)
        .sort((a, b) => b[1].promotion.improvementPp - a[1].promotion.improvementPp || a[0].localeCompare(b[0]))[0];
    byTicker[ticker] = {
        baseline: {
            sampleSize: baseline.sampleSize,
            directionalAccuracy: baseline.directionalAccuracy,
            coverage90: baseline.coverage90
        },
        evidenceStatus: candidateSet ? 'candidate_scores_available' : 'candidate_evidence_unavailable',
        candidates,
        selection: promoted
            ? { status: 'rolling_validation_promoted', selectedModel: promoted[0], reason: 'candidate cleared every rolling gate and independent approval' }
            : { status: 'baseline_pending_rolling_validation', selectedModel: null, reason: candidateSet ? 'no candidate cleared all promotion gates' : 'candidate backtest artifact not yet published' }
    };
}

const output = {
    schemaVersion: 1,
    validationVersion: 'osiris-o2-rolling-validation-v1',
    generatedFrom: { qualityRunDate: quality.backtest?.runDate || null, candidateBacktestRunDate: candidateInput?.runDate || null },
    policy: PROMOTION_POLICY,
    byTicker
};
const serialized = JSON.stringify(output, null, 2) + '\n';
if (check) {
    const committed = existsSync(outPath) ? readFileSync(outPath, 'utf8').replace(/\r\n/g, '\n') : null;
    if (committed !== serialized) { console.error('data/osiris-rolling-validation.json is stale. Run node scripts/build-osiris-rolling-validation.mjs and commit the output.'); process.exit(1); }
    console.log('✓ data/osiris-rolling-validation.json is current');
} else { writeFileSync(outPath, serialized); console.log(`✓ Wrote data/osiris-rolling-validation.json (${Object.keys(byTicker).length} tickers)`); }
