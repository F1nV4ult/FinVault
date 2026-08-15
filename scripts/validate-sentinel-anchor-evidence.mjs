#!/usr/bin/env node
/** Validates review-only Sentinel evidence; it never changes approved anchors. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { parseLiteral } = require('./lib/safe-literal');
const ledger = JSON.parse(readFileSync(join(root, 'data', 'sentinel-anchor-evidence.json'), 'utf8'));
const source = readFileSync(join(root, 'sentinel.v2.js'), 'utf8');
const match = source.match(/const COMPANIES = (\[[\s\S]*?\n\]);/);
if (!match) throw new Error('Could not locate Sentinel COMPANIES literal');
const known = new Set(parseLiteral(match[1]).map(company => company.ticker));
const errors = [];
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value));
const isUrl = value => { try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; } };
const today = new Date().toISOString().slice(0, 10);
const candidateMaxAgeDays = Number(ledger.policy?.candidateMaxAgeDays);
const ageInDays = date => Math.floor((Date.parse(today) - Date.parse(date)) / 86400000);

if (ledger.schemaVersion !== 1 || ledger.ledgerVersion !== 'sentinel-anchor-evidence-v1') errors.push('Ledger contract is unsupported');
if (!Number.isInteger(candidateMaxAgeDays) || candidateMaxAgeDays < 1 || candidateMaxAgeDays > 90) errors.push('candidateMaxAgeDays must be an integer between 1 and 90');
for (const [ticker, record] of Object.entries(ledger.byTicker || {})) {
    if (!known.has(ticker)) errors.push(`${ticker}: issuer is not in the Sentinel universe`);
    if (!/^candidate:[A-Z0-9.^-]+:\d{4}-\d{2}-\d{2}$/.test(record?.id || '')) errors.push(`${ticker}: id must be candidate:TICKER:YYYY-MM-DD`);
    if (record?.status !== 'candidate') errors.push(`${ticker}: status must be candidate`);
    if (!isDate(record?.sourceDate) || !isDate(record?.reviewedAt)) errors.push(`${ticker}: sourceDate and reviewedAt must be ISO dates`);
    else {
        if (record.sourceDate > today || record.reviewedAt > today) errors.push(`${ticker}: sourceDate and reviewedAt cannot be in the future`);
        if (record.reviewedAt < record.sourceDate) errors.push(`${ticker}: reviewedAt cannot precede sourceDate`);
        if (Number.isInteger(candidateMaxAgeDays) && ageInDays(record.sourceDate) > candidateMaxAgeDays) errors.push(`${ticker}: candidate evidence is older than ${candidateMaxAgeDays} days and must be refreshed`);
    }
    if (!String(record?.reviewer || '').trim()) errors.push(`${ticker}: reviewer is required`);
    if (!isUrl(record?.ratingEvidence?.url) || !String(record?.ratingEvidence?.agency || '').trim()) errors.push(`${ticker}: rating evidence requires agency and URL`);
    if (!isUrl(record?.spreadEvidence?.url) || !String(record?.spreadEvidence?.instrument || '').trim()) errors.push(`${ticker}: spread evidence requires instrument and URL`);
    if (!String(record?.candidate?.rating || '').trim() || !Number.isFinite(record?.candidate?.baseSpreadBps)) errors.push(`${ticker}: candidate rating and numeric base spread are required`);
}
if (errors.length) {
    console.error(`Sentinel evidence validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}
console.log(`✓ Sentinel anchor evidence ledger valid (${Object.keys(ledger.byTicker || {}).length} candidate records)`);
