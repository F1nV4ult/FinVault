#!/usr/bin/env node
/**
 * Adds a review-only evidence candidate. It never changes Sentinel anchors.
 * Use --dry-run first; omit it only after source review.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
if (args.includes('--help')) {
    console.log('Usage: node scripts/add-sentinel-anchor-candidate.mjs --ticker XOM --rating AA --spread 125 --agency "S&P Global" --rating-url https://… --instrument "XOM 2034 senior unsecured" --spread-url https://… --source-date YYYY-MM-DD --reviewer initials [--dry-run] [--replace]');
    process.exit(0);
}
const ticker = String(value('--ticker') || '').toUpperCase();
const rating = String(value('--rating') || '').toUpperCase();
const baseSpreadBps = Number(value('--spread'));
const sourceDate = value('--source-date');
const reviewedAt = new Date().toISOString().slice(0, 10);
const reviewer = value('--reviewer');
const ratingUrl = value('--rating-url');
const spreadUrl = value('--spread-url');
const agency = value('--agency');
const instrument = value('--instrument');
const dryRun = args.includes('--dry-run');
const replace = args.includes('--replace');
const isDate = input => /^\d{4}-\d{2}-\d{2}$/.test(input || '') && !Number.isNaN(Date.parse(input));
const isUrl = input => { try { return ['https:', 'http:'].includes(new URL(input).protocol); } catch { return false; } };
const require = createRequire(import.meta.url);
const { parseLiteral } = require('./lib/safe-literal');
const sentinel = readFileSync(join(root, 'sentinel.v2.js'), 'utf8');
const companyMatch = sentinel.match(/const COMPANIES = (\[[\s\S]*?\n\]);/);
const bandMatch = sentinel.match(/const RATING_BANDS = (\{[\s\S]*?\n\});/);
if (!companyMatch || !bandMatch) throw new Error('Could not load Sentinel issuer or rating-band data');
const companies = parseLiteral(companyMatch[1]);
const bands = parseLiteral(bandMatch[1]);
const errors = [];
if (!companies.some(company => company.ticker === ticker)) errors.push('ticker is not in the Sentinel universe');
if (!bands[rating]) errors.push('rating is not a Sentinel rating bucket');
if (!Number.isFinite(baseSpreadBps) || baseSpreadBps <= 0) errors.push('spread must be a positive number of bps');
if (bands[rating] && (baseSpreadBps < bands[rating].min || baseSpreadBps > bands[rating].max)) errors.push(`spread must fall within the ${rating} validation band (${bands[rating].min}-${bands[rating].max} bps)`);
if (!isDate(sourceDate) || sourceDate > reviewedAt) errors.push('source-date must be an ISO date no later than today');
if (!String(reviewer || '').trim()) errors.push('reviewer is required');
if (!String(agency || '').trim() || !isUrl(ratingUrl)) errors.push('agency and an http(s) rating-url are required');
if (!String(instrument || '').trim() || !isUrl(spreadUrl)) errors.push('instrument and an http(s) spread-url are required');
if (errors.length) { console.error('Candidate not created:\n- ' + errors.join('\n- ')); process.exit(1); }
const record = {
    id: `candidate:${ticker}:${sourceDate}`,
    status: 'candidate',
    sourceDate,
    reviewedAt,
    reviewer: String(reviewer).trim(),
    ratingEvidence: { agency: String(agency).trim(), url: ratingUrl },
    spreadEvidence: { instrument: String(instrument).trim(), url: spreadUrl },
    candidate: { rating, baseSpreadBps }
};
const ledgerPath = join(root, 'data', 'sentinel-anchor-evidence.json');
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
if (ledger.byTicker?.[ticker] && !replace) { console.error(`Candidate already exists for ${ticker}; inspect it or use --replace after review.`); process.exit(1); }
if (dryRun) { console.log(JSON.stringify({ dryRun: true, ticker, record }, null, 2)); process.exit(0); }
ledger.byTicker = { ...(ledger.byTicker || {}), [ticker]: record };
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
console.log(`✓ Recorded review-only candidate ${record.id}. Run npm run sentinel:governance; this did not change an approved anchor.`);
