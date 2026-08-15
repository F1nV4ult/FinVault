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
const evidenceLedger = JSON.parse(readFileSync(join(root, 'data', 'sentinel-anchor-evidence.json'), 'utf8'));
const history = JSON.parse(readFileSync(join(root, 'data', 'sentinel-anchor-history.json'), 'utf8'));
if (evidenceLedger.schemaVersion !== 1 || evidenceLedger.ledgerVersion !== 'sentinel-anchor-evidence-v1') throw new Error('Unsupported Sentinel anchor-evidence ledger contract');
if (history.schemaVersion !== 1 || history.historyVersion !== 'sentinel-anchor-history-v1') throw new Error('Unsupported Sentinel anchor-history contract');
const match = source.match(/const COMPANIES = (\[[\s\S]*?\n\]);/);
if (!match) throw new Error('Could not locate Sentinel COMPANIES literal');
const companies = parseLiteral(match[1]);
const outPath = join(root, 'data', 'sentinel-governance.json');
const monitoring = { reviewAfterDays: 60, staleAfterDays: 90 };
const byTicker = Object.fromEntries(companies.map(company => {
    const evidence = evidenceLedger.byTicker?.[company.ticker] || null;
    const latestHistory = (history.entries || []).filter(entry => entry.ticker === company.ticker).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.id.localeCompare(b.id)).at(-1) || null;
    if (evidence && evidence.status !== 'candidate') throw new Error(`Evidence for ${company.ticker} must be a candidate record`);
    return [company.ticker, {
        anchor: { rating: company.rating, baseSpreadBps: company.baseSpread, lastVerified: company.lastVerified || null },
        monitoring,
        provenance: {
            anchorSource: 'manual_primary_source_review',
            spreadEngineVersion: 'sentinel-p0-shared-v1',
            evidenceStatus: evidence ? 'candidate_recorded' : 'formal_evidence_pending',
            evidence: evidence ? { sourceDate: evidence.sourceDate, ratingSource: evidence.ratingEvidence?.url || null, spreadSource: evidence.spreadEvidence?.url || null, candidateRating: evidence.candidate?.rating || null, candidateBaseSpreadBps: evidence.candidate?.baseSpreadBps ?? null } : null,
            history: latestHistory ? { id: latestHistory.id, effectiveDate: latestHistory.effectiveDate, kind: latestHistory.kind } : null
        }
    }];
}));
const output = {
    schemaVersion: 2,
    governanceVersion: 'sentinel-p2-evidence-v1',
    policy: { monitoring, anchorReview: 'rating and base spread must be refreshed atomically' },
    sources: { companyRegistry: 'sentinel.v2.js', evidenceLedger: 'data/sentinel-anchor-evidence.json', anchorHistory: 'data/sentinel-anchor-history.json', spreadEngineVersion: 'sentinel-p0-shared-v1' },
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
