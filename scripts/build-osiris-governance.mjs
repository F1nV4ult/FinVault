#!/usr/bin/env node
/** Build the O5 governance and provenance artifact consumed by Osiris. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const quality = JSON.parse(readFileSync(join(root, 'data', 'osiris-quality.json'), 'utf8'));
const models = JSON.parse(readFileSync(join(root, 'data', 'osiris-models.json'), 'utf8'));
const outPath = join(root, 'data', 'osiris-governance.json');
const monitoring = { reviewAfterDays: 90, staleAfterDays: 180 };

const byTicker = {};
for (const [ticker, model] of Object.entries(models.byTicker || {})) {
    const qualityRow = quality.byTicker?.[ticker] || null;
    byTicker[ticker] = {
        selection: {
            selectedModel: model.selection?.selectedModel || null,
            status: model.selection?.status || 'unavailable',
            confidence: model.selection?.confidence || qualityRow?.confidence || 'limited'
        },
        validation: qualityRow ? {
            sampleSize: qualityRow.sampleSize,
            directionalAccuracy: qualityRow.directionalAccuracy,
            coverage90: qualityRow.coverage90
        } : null,
        provenance: {
            validationAsOf: quality.backtest?.runDate || null,
            qualityModelVersion: quality.modelVersion || null,
            registryModelVersion: models.modelVersion || null,
            rollingValidationVersion: model.selection?.rollingValidationVersion || null,
            regimeVersion: 'osiris-o4-regime-v1'
        },
        monitoring
    };
}

const output = {
    schemaVersion: 1,
    governanceVersion: 'osiris-o5-governance-v1',
    policy: {
        promotion: {
            minimumOutOfSampleDays: 252,
            minimumDirectionalAccuracyImprovementPct: 5,
            coverage90Range: [0.85, 0.95],
            requiredStatus: 'rolling_validation_promoted'
        },
        monitoring
    },
    sources: {
        qualityModelVersion: quality.modelVersion || null,
        registryModelVersion: models.modelVersion || null,
        validationAsOf: quality.backtest?.runDate || null
    },
    byTicker
};
const serialized = JSON.stringify(output, null, 2) + '\n';
if (check) {
    const committed = existsSync(outPath) ? readFileSync(outPath, 'utf8').replace(/\r\n/g, '\n') : null;
    if (committed !== serialized) {
        console.error('data/osiris-governance.json is stale. Run node scripts/build-osiris-governance.mjs and commit the output.');
        process.exit(1);
    }
    console.log('✓ data/osiris-governance.json is current');
} else {
    writeFileSync(outPath, serialized);
    console.log(`✓ Wrote data/osiris-governance.json (${Object.keys(byTicker).length} tickers)`);
}
