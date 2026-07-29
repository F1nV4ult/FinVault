import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (condition, message) => {
    if (condition) pass++;
    else { fail++; console.log('  ✕ ' + message); }
};

const quality = JSON.parse(readFileSync(new URL('../data/osiris-quality.json', import.meta.url), 'utf8'));
const osiris = readFileSync(new URL('../components/osiris/osiris.js', import.meta.url), 'utf8');
const rows = Object.entries(quality.byTicker || {});

ok(quality.schemaVersion === 1, 'quality artifact has schema version 1');
ok(quality.backtest?.runDate, 'quality artifact records its backtest date');
ok(rows.length === quality.backtest?.tickerCount && rows.length >= 80, 'quality artifact covers the backtested ticker universe');
ok(rows.every(([, row]) => Number.isFinite(row.sampleSize) && row.sampleSize > 0), 'every quality row has a sample size');
ok(rows.every(([, row]) => Number.isFinite(row.coverage90) && row.coverage90 >= 0 && row.coverage90 <= 1), 'every quality row has valid 90% coverage');
ok(rows.every(([, row]) => ['high', 'moderate', 'limited'].includes(row.confidence)), 'every quality row has a confidence tier');
ok(quality.byTicker?.ERJ === undefined && quality.backtest.skippedTickers.some(row => row.ticker === 'ERJ'), 'skipped tickers remain explicit rather than silently assigned quality');
ok(osiris.includes("fetch('/data/osiris-quality.json')") && osiris.includes('data.directionalAccuracy'), 'Osiris consumes the compact quality artifact');

console.log('\n' + (fail === 0 ? '✓ ALL PASS' : '✕ FAILURES') + ` — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
