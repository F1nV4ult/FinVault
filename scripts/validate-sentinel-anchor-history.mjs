#!/usr/bin/env node
/**
 * Confirms current approved anchors are represented in append-only history.
 * Refresh entries must reference a validated candidate-evidence record.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { parseLiteral } = require('./lib/safe-literal');
const history = JSON.parse(readFileSync(join(root, 'data', 'sentinel-anchor-history.json'), 'utf8'));
const evidence = JSON.parse(readFileSync(join(root, 'data', 'sentinel-anchor-evidence.json'), 'utf8'));
const source = readFileSync(join(root, 'sentinel.v2.js'), 'utf8');
const match = source.match(/const COMPANIES = (\[[\s\S]*?\n\]);/);
if (!match) throw new Error('Could not locate Sentinel COMPANIES literal');
const companies = parseLiteral(match[1]);
const errors = [];
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value));

if (history.schemaVersion !== 1 || history.historyVersion !== 'sentinel-anchor-history-v1') errors.push('History contract is unsupported');
const ids = new Set();
const byTicker = new Map();
for (const entry of history.entries || []) {
    if (!entry?.id || ids.has(entry.id)) errors.push(`Duplicate or missing history id: ${entry?.id || '(missing)'}`);
    ids.add(entry?.id);
    if (!isDate(entry?.effectiveDate) || !Number.isFinite(entry?.baseSpreadBps) || !entry?.rating) errors.push(`${entry?.ticker || '(unknown)'}: history record is incomplete`);
    const rows = byTicker.get(entry?.ticker) || []; rows.push(entry); byTicker.set(entry?.ticker, rows);
    if (entry?.kind === 'baseline' && entry.evidenceRef !== 'legacy-manual-record') errors.push(`${entry.ticker}: baseline must use legacy-manual-record`);
    if (entry?.kind && entry.kind !== 'baseline' && entry.kind !== 'refresh') errors.push(`${entry.ticker}: unsupported history kind`);
    if (entry?.kind === 'refresh') {
        const candidate = Object.values(evidence.byTicker || {}).find(record => record?.id === entry.evidenceRef);
        if (!candidate) errors.push(`${entry.ticker}: refresh history lacks a candidate evidence record`);
        else if (candidate.candidate?.rating !== entry.rating || candidate.candidate?.baseSpreadBps !== entry.baseSpreadBps) errors.push(`${entry.ticker}: history does not match candidate evidence values`);
    }
}
for (const company of companies) {
    const rows = (byTicker.get(company.ticker) || []).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.id.localeCompare(b.id));
    const latest = rows.at(-1);
    if (!latest) errors.push(`${company.ticker}: approved anchor has no history record`);
    else if (latest.rating !== company.rating || latest.baseSpreadBps !== company.baseSpread || latest.effectiveDate !== company.lastVerified) errors.push(`${company.ticker}: approved anchor differs from latest history record`);
}
if (errors.length) {
    console.error(`Sentinel anchor history validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}
console.log(`✓ Sentinel anchor history valid (${history.entries.length} records for ${companies.length} issuers)`);
