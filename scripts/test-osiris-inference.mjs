import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (condition, message) => {
    if (condition) pass++;
    else { fail++; console.log('  ✕ ' + message); }
};

const osiris = readFileSync(new URL('../components/osiris/osiris.js', import.meta.url), 'utf8');
const oracle = readFileSync(new URL('../components/osiris/osirisOracle.js', import.meta.url), 'utf8');

ok(osiris.includes('p25: percentiles.p25[lastIdx]') && osiris.includes('p75: percentiles.p75[lastIdx]'), 'simulation passes interquartile percentiles into inference');
ok(oracle.includes('oracle-terminal-distribution') && oracle.includes('Terminal Distribution'), 'inference renders a terminal-distribution table');
ok(['P05', 'P25', 'P50', 'P75', 'P95'].every(label => oracle.includes(`label: '${label}'`)), 'table exposes all five requested percentile levels');
ok(oracle.includes('vs Spot') && oracle.includes('Upper quartile') && oracle.includes('Stress tail'), 'table labels price changes and scenario interpretation');

console.log('\n' + (fail === 0 ? '✓ ALL PASS' : '✕ FAILURES') + ` — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
