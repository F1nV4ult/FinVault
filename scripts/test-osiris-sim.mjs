/**
 * Unit tests for the Osiris stochastic worker math (components/osiris/
 * stochasticWorker.js — the actual shipped code).
 *
 *   node scripts/test-osiris-sim.mjs
 *
 * The worker is a classic Web Worker (self.onmessage), not an ES module, so we
 * load it the same way the health-check (scripts/health/checks.mjs) does: read
 * the source, strip the dispatcher, and evaluate it in a vm sandbox to expose
 * the top-level simulateOU / simulateGBMJump. This keeps the test in-repo (the
 * Node port lives outside the deployable tree) and tests the real engine.
 *
 * Mixes deterministic checks (zero-vol paths are exact) with statistical
 * property checks at high path counts and generous tolerances, so the suite is
 * robust to the unseeded RNG.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
const ok   = (c, m) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } };
const near = (a, b, eps) => a != null && Math.abs(a - b) <= eps;

// ── Load the shipped worker into a sandbox ────────────────────────────────────
const src = readFileSync(new URL('../components/osiris/stochasticWorker.js', import.meta.url), 'utf8');
const trimmed = src.replace(/self\.onmessage\s*=[\s\S]*$/, '');   // drop the Web Worker dispatcher
const sandbox = { Math, Float32Array, Array, Number, isFinite, self: { postMessage: () => {} } };
const ctx = vm.createContext(sandbox);
vm.runInContext(trimmed, ctx, { timeout: 5000 });
const simulateOU = sandbox.simulateOU;
const simulateGBMJump = sandbox.simulateGBMJump;
const extractPercentilePaths = sandbox.extractPercentilePaths;
const createSeededRandom = sandbox.createSeededRandom;
ok(typeof simulateOU === 'function' && typeof simulateGBMJump === 'function', 'worker exposes simulateOU / simulateGBMJump');
ok(typeof extractPercentilePaths === 'function' && typeof createSeededRandom === 'function', 'worker exposes cone extraction and seeded RNG');

// Worker signatures:
//   simulateOU(S0, drift, sigma, steps, paths, theta, longTermMean, antithetic, intradaySteps, garchAlpha, garchBeta)
//   simulateGBMJump(S0, mu, sigma, steps, paths, lambda, jumpMu, antithetic, intradaySteps, garchAlpha, garchBeta)
const STEPS = 253;                     // 252 increments ≈ 1 trading year (dt = 1/252)
const term  = (res, p) => res.percentiles[p][res.percentiles[p].length - 1];
const PCTS  = ['p05', 'p10', 'p25', 'p45', 'p50', 'p55', 'p75', 'p90', 'p95'];

function monotonic(res) {
  for (let i = 1; i < PCTS.length; i++) if (term(res, PCTS[i]) < term(res, PCTS[i - 1]) - 1e-4) return false;
  return true;
}
function allFinite(res) {
  return PCTS.every(p => { const a = res.percentiles[p]; return a.every(v => Number.isFinite(v)); });
}

// The cone must use the cross-sectional percentile at each time step, rather
// than returning the path whose terminal value happens to be a percentile.
{
  const matrix = new Float32Array([
    100,  10, 300,
    100, 100, 200,
    100, 200, 100
  ]);
  const cone = extractPercentilePaths(matrix, 3, 3, 100).percentiles;
  ok(cone.p50[1] === 100 && cone.p50[2] === 200, 'cone median is cross-sectional at every horizon');
}

// Fixed seeds make model comparisons and backtests reproducible.
{
  const args = [100, 0.05, 0.20, 63, 512, 4, 0.01, true, 1, 0.10, 0.85];
  const a = simulateGBMJump(...args, createSeededRandom(42));
  const b = simulateGBMJump(...args, createSeededRandom(42));
  ok(term(a, 'p50') === term(b, 'p50') && a.pAboveSpot === b.pAboveSpot, 'seeded GBM runs are reproducible');
}

// ── Percentile ordering & basic invariants (GBM+jump) ─────────────────────────
{
  const r = simulateGBMJump(100, 0.05, 0.20, STEPS, 20000, 4, 0, false);
  ok(monotonic(r), 'GBM: terminal percentiles are monotonically ordered p05…p95');
  ok(r.pAboveSpot >= 0 && r.pAboveSpot <= 1, 'GBM: pAboveSpot ∈ [0,1]');
  ok(allFinite(r), 'GBM: no NaN/Inf in any percentile path');
}

// ── Zero-vol determinism: terminal = S0·e^(μ·T), all percentiles equal ─────────
{
  const r = simulateGBMJump(100, 0.10, 0, STEPS, 64, 4, 0, false);
  ok(near(term(r, 'p05'), 110.517, 0.3) && near(term(r, 'p95'), 110.517, 0.3), 'GBM zero-vol: terminal ≈ 110.52');
  ok(near(term(r, 'p05'), term(r, 'p95'), 0.05), 'GBM zero-vol: all paths identical (p05 == p95)');
}
{
  const r = simulateOU(100, 0, 0, STEPS, 64, 2, 120, false);   // sigma=0 → deterministic reversion
  ok(near(term(r, 'p05'), term(r, 'p95'), 0.2), 'OU zero-vol: all paths identical');
  ok(term(r, 'p50') > 110 && term(r, 'p50') < 122, 'OU zero-vol: reverts toward longTermMean 120');
}

// ── GBM drift direction: median & pAboveSpot move with μ ───────────────────────
{
  const up = simulateGBMJump(100, 0.30, 0.15, STEPS, 20000, 4, 0, false);
  const dn = simulateGBMJump(100, -0.30, 0.15, STEPS, 20000, 4, 0, false);
  ok(term(up, 'p50') > 100, 'GBM strong +drift: median terminal > spot');
  ok(up.pAboveSpot > 0.5, 'GBM strong +drift: pAboveSpot > 0.5');
  ok(term(dn, 'p50') < 100, 'GBM strong −drift: median terminal < spot');
  ok(dn.pAboveSpot < 0.5, 'GBM strong −drift: pAboveSpot < 0.5');
}

// ── OU mean reversion both directions (drift=0 so the worker's reversion drives it) ──
{
  const upTo120 = simulateOU(100, 0, 0.15, STEPS, 20000, 2, 120, false);   // → ~117.3
  ok(term(upTo120, 'p50') > 108 && term(upTo120, 'p50') < 124, 'OU: reverts up toward 120 (median ~117)');
  const dnTo80 = simulateOU(100, 0, 0.15, STEPS, 20000, 2, 80, false);     // → ~82.7
  ok(term(dnTo80, 'p50') < 92 && term(dnTo80, 'p50') > 74, 'OU: reverts down toward 80 (median ~83)');
}

// ── Antithetic mode still valid; GARCH stays stable ───────────────────────────
{
  const a = simulateGBMJump(100, 0.05, 0.25, STEPS, 20000, 4, 0, true);
  ok(monotonic(a) && allFinite(a) && a.pAboveSpot >= 0 && a.pAboveSpot <= 1, 'antithetic GBM: valid, finite, ordered');
  // high vol + persistent GARCH (intradaySteps=1 explicit, then α=0.12, β=0.86)
  const g = simulateGBMJump(100, 0.05, 0.60, STEPS, 8000, 6, 0, false, 1, 0.12, 0.86);
  ok(allFinite(g), 'high-vol persistent GARCH: no NaN/Inf blow-up');
}

console.log('\n' + (fail === 0 ? '✓ ALL PASS' : '✗ FAILURES') + ` — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
