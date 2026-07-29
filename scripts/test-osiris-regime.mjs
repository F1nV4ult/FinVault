import { classifyOsirisRegime } from '../components/osiris/osirisRegime.mjs';

let pass = 0, fail = 0;
const ok = (condition, message) => {
    if (condition) pass++;
    else { fail++; console.log('  ✕ ' + message); }
};
const history = values => values.map((adjClose, index) => ({ adjClose, date: `2026-01-${String(index + 1).padStart(2, '0')}` }));
const calmSeries = history(Array.from({ length: 130 }, (_, index) => index < 109
    ? 100 + Math.sin(index * 0.7) * 2
    : 100 + (index - 109) * 0.05));
const stressedSeries = history(Array.from({ length: 130 }, (_, index) => index < 100 ? 100 + index * 0.1 : 110 - (index - 100) * 0.8));

const calm = classifyOsirisRegime(calmSeries, { VIX: 12 });
const stressed = classifyOsirisRegime(stressedSeries, { VIX: 28 });
const sparse = classifyOsirisRegime(history([100, 101, 99]), {});
const drawdownStress = classifyOsirisRegime(stressedSeries, { VIX: 16 });

ok(calm.state === 'calm' && calm.volatilityMultiplier === 0.85, 'calm VIX and compressed volatility select calm multiplier');
ok(stressed.state === 'stressed' && stressed.volatilityMultiplier === 1.35, 'high VIX / drawdown select stressed multiplier');
ok(drawdownStress.state === 'stressed', 'deep drawdown selects stressed regime even without high VIX');
ok(sparse.confidence === 'unavailable' && sparse.volatilityMultiplier === 1, 'sparse history degrades to neutral normal multiplier');
ok(['calm', 'normal', 'elevated', 'stressed'].includes(calm.state), 'classifier emits a known state');

console.log('\n' + (fail === 0 ? '✓ ALL PASS' : '✕ FAILURES') + ` — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
