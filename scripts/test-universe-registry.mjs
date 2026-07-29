/** Validates the canonical cross-tool issuer registry. */
import { readFileSync } from 'node:fs';
import schema from './lib/universe-schema.js';

const { validateUniverse } = schema;
let pass = 0, fail = 0;
const ok = (condition, message) => {
  if (condition) pass++;
  else { fail++; console.log('  ✕ ' + message); }
};

const universe = JSON.parse(readFileSync(new URL('../data/universe.json', import.meta.url), 'utf8'));
const entries = Object.values(universe.tickers || {});
const errors = validateUniverse(universe);

ok(errors.length === 0, errors.join('; '));
ok(universe._meta?.schemaVersion === 1, 'registry declares schema version 1');
ok(entries.length === universe._meta?.count, 'metadata count matches the registry');
ok(entries.length > 0, 'registry contains issuers');
ok(entries.every(entry => entry.capabilities.sentinel && entry.capabilities.osiris), 'every issuer is enabled for Sentinel and Osiris');
ok(entries.every(entry => entry.capabilities.finvault.overview), 'every issuer has a FinVault overview contract');
ok(entries.every(entry => entry.capabilities.finvault.report === entry.finvault.pdfReady), 'report capability mirrors report readiness');
ok(entries.every(entry => entry.finvault.reportUrl === 'report.html?ticker=' + encodeURIComponent(entry.ticker)), 'every FinVault route uses the canonical ticker');
ok(entries.some(entry => entry.ticker === 'ERJ'), 'canonical Embraer symbol is ERJ');
ok(!entries.some(entry => entry.ticker === 'EMBR3.SA'), 'legacy Embraer symbol is absent from the registry');

const sourceFiles = [
  '../sentinel.v2.js',
  '../osiris.html',
  '../report.html',
  '../reports.html',
  '../components/osiris/osiris.js',
  '../physics-config.json',
];
const sourceText = sourceFiles.map(file => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
ok(!sourceText.includes('EMBR3.SA') && !sourceText.includes('embj3-sa'), 'active cross-tool sources contain no legacy Embraer symbol');

console.log('\n' + (fail === 0 ? '✓ ALL PASS' : '✕ FAILURES') + ` — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
