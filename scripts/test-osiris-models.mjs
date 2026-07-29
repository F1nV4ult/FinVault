import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (condition, message) => {
    if (condition) pass++;
    else { fail++; console.log('  ✕ ' + message); }
};
const models = JSON.parse(readFileSync(new URL('../data/osiris-models.json', import.meta.url), 'utf8'));
const rows = Object.entries(models.byTicker || {});

ok(models.schemaVersion === 1, 'model registry has schema version 1');
ok(rows.length === 83, 'model registry covers every Osiris ticker');
ok(rows.every(([, row]) => row.selection?.selectedModel && row.selection?.status === 'baseline_pending_rolling_validation'), 'each ticker has an explicit baseline selection status');
ok(rows.every(([, row]) => Array.isArray(row.candidates) && row.candidates.length === 2), 'each ticker exposes OU and GBM-jump candidates');
ok(rows.every(([, row]) => row.candidates.filter(candidate => candidate.selected).length === 1), 'each ticker has exactly one active baseline model');
ok(rows.every(([, row]) => row.candidates.reduce((sum, candidate) => sum + candidate.weight, 0) === 1), 'candidate weights remain normalized');

console.log('\n' + (fail === 0 ? '✓ ALL PASS' : '✕ FAILURES') + ` — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
