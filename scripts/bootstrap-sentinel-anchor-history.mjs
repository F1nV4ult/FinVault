#!/usr/bin/env node
/** Creates the one-time approved-anchor baseline. Refuses to overwrite history. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'data', 'sentinel-anchor-history.json');
if (existsSync(outPath)) throw new Error('Anchor history already exists; append a reviewed refresh record instead of regenerating it.');
const require = createRequire(import.meta.url);
const { parseLiteral } = require('./lib/safe-literal');
const source = readFileSync(join(root, 'sentinel.v2.js'), 'utf8');
const match = source.match(/const COMPANIES = (\[[\s\S]*?\n\]);/);
if (!match) throw new Error('Could not locate Sentinel COMPANIES literal');
const entries = parseLiteral(match[1]).map(company => ({
    id: `baseline:${company.ticker}:${company.lastVerified}`,
    ticker: company.ticker,
    effectiveDate: company.lastVerified,
    rating: company.rating,
    baseSpreadBps: company.baseSpread,
    kind: 'baseline',
    evidenceRef: 'legacy-manual-record'
}));
writeFileSync(outPath, JSON.stringify({
    schemaVersion: 1,
    historyVersion: 'sentinel-anchor-history-v1',
    policy: { appendOnly: true, productionChangeRequiresHistory: true },
    entries
}, null, 2) + '\n');
console.log(`✓ Wrote Sentinel anchor history baseline (${entries.length} issuers)`);
