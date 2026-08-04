/** Regression checks for the P4 shared static-snapshot contract. */
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (condition, message) => { if (condition) pass++; else { fail++; console.log('  x ' + message); } };

const snapshots = read('../components/snapshots/snapshots.js');
const osiris = read('../components/osiris/osiris.js');
const sentinel = read('../sentinel.v2.js');
const scenario = read('../scenario.html');
const state = read('../components/state/state.js');
const build = read('./build.js');

ok(snapshots.includes('sessionStorage') && snapshots.includes('inflight') && snapshots.includes('ttlMs'), 'snapshot registry deduplicates requests and retains bounded session snapshots');
ok(snapshots.includes('universe:') && snapshots.includes('sentinelGovernance:') && snapshots.includes('osirisGovernance:'), 'snapshot manifest covers cross-tool registry and governance artifacts');
ok(build.includes("components/snapshots/snapshots.js"), 'snapshot client is minified with release assets');
ok(scenario.includes("NSSnapshots.get('universe')"), 'Scenario Lab consumes the shared universe snapshot');
ok(osiris.includes("NSSnapshots.get('universe')") && osiris.includes("NSSnapshots.get('physicsConfig')"), 'Osiris consumes shared universe and configuration snapshots');
ok(sentinel.includes("NSSnapshots.get('sentinelGovernance')"), 'Sentinel consumes shared governance snapshots');
ok(osiris.includes('activeScenario()') && osiris.includes('scenarioVolMult') && osiris.includes('JSON.stringify(scenario || {})'), 'Osiris maps scenario inputs into simulation volatility and reproducible seed');
ok(sentinel.includes('scenario.sectorVolPct') && sentinel.includes('scenario.sovereignBps') && sentinel.includes("NSState.on('scenario'"), 'Sentinel maps scenario volatility, yield, and refresh state');
ok(state.includes("sc: 'ns.scenario'") && state.includes('LS.removeItem(K.sc)'), 'scenario state persists across same-tab navigation and clears on baseline');

console.log('\n' + (fail ? 'x FAILURES' : '✓ ALL PASS') + ` — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
