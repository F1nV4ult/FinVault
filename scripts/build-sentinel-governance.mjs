#!/usr/bin/env node
/** Compile issuer-anchor governance into a small, browser-consumable artifact. */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { parseLiteral } = require('./lib/safe-literal');
const check = process.argv.includes('--check');
const source = readFileSync(join(root, 'sentinel.v2.js'), 'utf8');
const match = source.match(/const COMPANIES = (\[[\s\S]*?\n\]);/);
if (!match) throw new Error('Could not locate Sentinel COMPANIES literal');
const companies = parseLiteral(match[1]);
const outPath = join(root, 'data', 'sentinel-governance.json');
const monitoring = { reviewAfterDays: 60, staleAfterDays: 90 };
const byTicker = Object.fromEntries(companies.map(company => [company.ticker, {
    anchor: { rating: company.rating, baseSpreadBps: company.baseSpread, lastVerified: company.lastVerified || null },
    monitoring,
    provenance: { anchorSource: 'manual_primary_source_review', spreadEngineVersion: 'sentinel-p0-shared-v1' }
}]));
const output = {
    schemaVersion: 1,
    governanceVersion: 'sentinel-p1-governance-v1',
    policy: { monitoring, anchorReview: 'rating and base spread must be refreshed atomically' },
    sources: { companyRegistry: 'sentinel.v2.js', spreadEngineVersion: 'sentinel-p0-shared-v1' },
    byTicker
};
const serialized = JSON.stringify(output, null, 2) + '\n';
if (check) {
    const committed = existsSync(outPath) ? readFileSync(outPath, 'utf8').replace(/\r\n/g, '\n') : null;
    if (committed !== serialized) {
        console.error('data/sentinel-governance.json is stale. Run node scripts/build-sentinel-governance.mjs and commit the output.');
        process.exit(1);
    }
    console.log('✓ data/sentinel-governance.json is current');
} else {
    writeFileSync(outPath, serialized);
    console.log(`✓ Wrote data/sentinel-governance.json (${companies.length} issuers)`);
}
