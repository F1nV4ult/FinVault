import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { computeSpread, nextResidual } from './lib/sentinel-spread.mjs';

let pass = 0, fail = 0;
const ok = (condition, message) => {
    if (condition) pass++;
    else { fail++; console.log('  ✕ ' + message); }
};
const source = readFileSync(new URL('../components/sentinel/sentinelSpread.js', import.meta.url), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const shared = context.window.SentinelSpread;
const input = { type: 'IG', baseSpread: 120, ratingIndexBps: 130, sectorBeta: 1.1, marketBeta: 0.8, residual: 2, sectorVol: 24, vix: 31, stress: 1.1, seniority: 'Subordinated', tenure: 15, instrumentMod: true };
const expected = computeSpread(input);
const actual = shared.computeSpread(input);

ok(typeof shared?.computeSpread === 'function' && typeof shared?.nextResidual === 'function' && typeof shared?.defaultStressProxy === 'function', 'browser shared engine exposes quote, calibration, and risk-proxy helpers');
ok(actual.finalSpread === expected.finalSpread && actual.baseTotalSpread === expected.baseTotalSpread, 'browser shared quote matches executable specification');
ok(actual.proxyVol === expected.proxyVol && actual.regime === expected.regime, 'browser shared diagnostics match executable specification');
ok(shared.nextResidual(2, 30, 25) === nextResidual(2, 30, 25), 'browser calibration keeps residual in volatility points');
ok(Math.abs(shared.defaultStressProxy(396) - 0.3270) < 0.001, 'browser risk proxy has the documented full-loss calculation');

console.log('\n' + (fail === 0 ? '✓ ALL PASS' : '✕ FAILURES') + ` — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
