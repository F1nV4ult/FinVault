#!/usr/bin/env node
/** Read-only comparison of a candidate with the currently approved anchor. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ticker = process.argv.includes('--ticker') ? String(process.argv[process.argv.indexOf('--ticker') + 1] || '').toUpperCase() : null;
const json = process.argv.includes('--format') && process.argv[process.argv.indexOf('--format') + 1] === 'json';
const require = createRequire(import.meta.url);
const { parseLiteral } = require('./lib/safe-literal');
const evidence = JSON.parse(readFileSync(join(root, 'data', 'sentinel-anchor-evidence.json'), 'utf8'));
const source = readFileSync(join(root, 'sentinel.v2.js'), 'utf8');
const match = source.match(/const COMPANIES = (\[[\s\S]*?\n\]);/);
if (!match) throw new Error('Could not locate Sentinel COMPANIES literal');
const companies = new Map(parseLiteral(match[1]).map(company => [company.ticker, company]));
const records = Object.entries(evidence.byTicker || {}).filter(([key]) => !ticker || key === ticker);
if (ticker && !companies.has(ticker)) throw new Error(`${ticker} is not in the Sentinel universe`);
if (!records.length) { console.log(json ? JSON.stringify({ schemaVersion: 1, kind: 'sentinel_anchor_promotion_preview', plans: [] }, null, 2) : ticker ? `No candidate evidence is recorded for ${ticker}.` : 'No candidate evidence is recorded.'); process.exit(0); }
const plans = [];
for (const [key, record] of records) {
    const current = companies.get(key);
    const spreadDeltaBps = record.candidate.baseSpreadBps - current.baseSpread;
    plans.push({ ticker: key, evidenceRef: record.id, approved: { rating: current.rating, baseSpreadBps: current.baseSpread, lastVerified: current.lastVerified }, candidate: record.candidate, spreadDeltaBps, requiredSteps: ['Review rating and spread source URLs', `Append refresh history with evidenceRef ${record.id}`, 'Update rating, baseSpread, and lastVerified atomically', 'Run npm run sentinel:governance'] });
    if (json) continue;
    console.log(`${key} · ${record.id}`);
    console.log(`  Approved: ${current.rating} · ${current.baseSpread} bps · verified ${current.lastVerified}`);
    console.log(`  Candidate: ${record.candidate.rating} · ${record.candidate.baseSpreadBps} bps · source ${record.sourceDate}`);
    console.log(`  Change: rating ${current.rating === record.candidate.rating ? 'unchanged' : `${current.rating} → ${record.candidate.rating}`}; spread ${record.candidate.baseSpreadBps - current.baseSpread >= 0 ? '+' : ''}${record.candidate.baseSpreadBps - current.baseSpread} bps`);
    console.log(`  Required before promotion: review source URLs, append refresh history with evidenceRef ${record.id}, then update anchor + lastVerified atomically.`);
}
if (json) console.log(JSON.stringify({ schemaVersion: 1, kind: 'sentinel_anchor_promotion_preview', plans }, null, 2));
