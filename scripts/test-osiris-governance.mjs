import { readFileSync } from 'node:fs';
import { assessGovernance } from '../components/osiris/osirisGovernance.mjs';

let pass = 0, fail = 0;
const ok = (condition, message) => {
    if (condition) pass++;
    else { fail++; console.log('  ✕ ' + message); }
};
const governance = JSON.parse(readFileSync(new URL('../data/osiris-governance.json', import.meta.url), 'utf8'));
const rows = Object.entries(governance.byTicker || {});
const sample = governance.byTicker.AEP;

ok(governance.schemaVersion === 1 && governance.governanceVersion === 'osiris-o5-governance-v1', 'governance artifact has a versioned contract');
ok(rows.length === 83, 'governance artifact covers every Osiris ticker');
ok(rows.every(([, row]) => row.selection?.selectedModel && row.provenance?.validationAsOf), 'every ticker exposes model and validation provenance');
ok(rows.every(([, row]) => row.monitoring?.reviewAfterDays === 90 && row.monitoring?.staleAfterDays === 180), 'monitoring thresholds are explicit per ticker');
ok(assessGovernance(sample, new Date('2026-07-29T00:00:00Z')).state === 'current', 'recent validation is current');
ok(assessGovernance(sample, new Date('2026-09-01T00:00:00Z')).state === 'review_due', 'ageing validation becomes review due');
ok(assessGovernance(sample, new Date('2026-12-01T00:00:00Z')).state === 'stale', 'old validation becomes stale');
ok(assessGovernance(governance.byTicker.ERJ, new Date()).state === 'unavailable', 'a ticker without its own validation never inherits global freshness');
ok(assessGovernance({}, new Date()).state === 'unavailable', 'missing evidence is never treated as current');

console.log('\n' + (fail === 0 ? '✓ ALL PASS' : '✕ FAILURES') + ` — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
