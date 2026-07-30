/**
 * Unit tests for scripts/lib/sentinel-spread.mjs (the executable spec of the
 * Sentinel credit-spread formula) PLUS a source-parity check that the browser
 * engine sentinel.v2.js still encodes the same constants/formulas — so the pure
 * module and the production code cannot silently drift.
 *
 *   node scripts/test-sentinel-spread.mjs
 *
 * Expected values are hand-computed in the comments so the assertions are an
 * independent check of the math, not a tautology.
 */
import { readFileSync } from 'node:fs';
import {
  computeSpread, impliedYield, probabilityOfDefault,
  vixCFactor, mertonScalar, sensitivityFor, nextResidual,
} from './lib/sentinel-spread.mjs';

let pass = 0, fail = 0;
const ok   = (c, m) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } };
const near = (a, b, eps = 0.01) => a != null && Math.abs(a - b) <= eps;

// ── Building blocks ───────────────────────────────────────────────────────────
ok(sensitivityFor('IG') === 0.35 && sensitivityFor('HY') === 1.0, 'IG/HY sensitivity 0.35 / 1.0');
ok(vixCFactor(15) === 0 && vixCFactor(50) === 0.8 && near(vixCFactor(35), 0.4), 'VIX cFactor: 0 calm, capped 0.8, 0.4 mid');
ok(near(mertonScalar(35), 2.0), 'Merton scalar = 2.0 exactly at proxyVol 35');
ok(mertonScalar(0) > 1.5 && mertonScalar(0) < 1.6 && mertonScalar(100) > 2.49, 'Merton scalar bounded 1.5→2.5');

// ── Case A: calm market, HY, unsecured 10y ────────────────────────────────────
// sensitivity=1.0; anchor=max(300,125)=300; c=0; effSectorβ=1.2; proxyVol=20*1.2+5=29
// ms=1.5+1/(1+e^2.4)=1.58317; volPrem=29*1.58317=45.912; mktComp=1.0*50=50
// baseDelta=round(95.912)=96; baseTotal=396; mods=1 → finalSpread=396; STABLE
{
  const r = computeSpread({ type: 'HY', baseSpread: 300, ratingIndexBps: 125,
    sectorBeta: 1.2, marketBeta: 1.0, residual: 5, sectorVol: 20, vix: 15 });
  ok(r.macroAnchor === 300, 'A: anchor floors at baseSpread (300 > index 125)');
  ok(near(r.proxyVol, 29), 'A: proxyVol = 29');
  ok(near(r.mertonScalar, 1.58317, 0.001), 'A: mertonScalar ≈ 1.5832');
  ok(r.finalSpread === 396, 'A: finalSpread = 396 (got ' + r.finalSpread + ')');
  ok(r.regime === 'STABLE', 'A: regime STABLE (proxyVol 29 < 35)');
}

// ── Case B: stressed VIX, IG, subordinated 20y, stress 1.2 ─────────────────────
// sensitivity=0.35; anchor=max(100,150)=150; c=0.8; effSectorβ=1.0 effMktβ=1.02
// proxyVol=30*1.0+10=40; ms=1.5+1/(1+e^-2)=2.38080
// volPrem=40*2.38080*1.2*0.35=39.997; mktComp=1.02*50*1.2*0.35=21.42
// baseDelta=round(61.417)=61; baseTotal=211; subMult=1.5+211/200=2.555; tenure=1.3
// finalSpread=round(211*2.555*1.3)=701; DISTRESS
{
  const r = computeSpread({ type: 'IG', baseSpread: 100, ratingIndexBps: 150,
    sectorBeta: 1.0, marketBeta: 1.1, residual: 10, sectorVol: 30, vix: 50,
    stress: 1.2, seniority: 'Subordinated', tenure: 20 });
  ok(r.macroAnchor === 150, 'B: anchor lifts to rating index (150 > base 100)');
  ok(near(r.cFactor, 0.8), 'B: cFactor capped at 0.8 (VIX 50)');
  ok(near(r.proxyVol, 40), 'B: proxyVol = 40');
  ok(near(r.mertonScalar, 2.38080, 0.001), 'B: mertonScalar ≈ 2.3808');
  ok(near(r.subMult, 2.555, 0.001), 'B: subordinated multiplier 1.5 + baseTotal/200');
  ok(r.finalSpread === 701, 'B: finalSpread = 701 (got ' + r.finalSpread + ')');
  ok(r.regime === 'DISTRESS', 'B: regime DISTRESS (proxyVol 40 > 35)');
}

// ── Seniority/tenure monotonicity ─────────────────────────────────────────────
{
  const base = { type: 'IG', baseSpread: 200, sectorBeta: 1, marketBeta: 1, residual: 5, sectorVol: 20, vix: 20 };
  const secured = computeSpread({ ...base, seniority: 'Secured' }).finalSpread;
  const unsec   = computeSpread({ ...base, seniority: 'Unsecured' }).finalSpread;
  ok(secured < unsec, 'secured spread < unsecured (0.85 multiplier)');
  const short = computeSpread({ ...base, tenure: 5 }).finalSpread;
  const long  = computeSpread({ ...base, tenure: 30 }).finalSpread;
  ok(short < unsec && unsec < long, 'tenure slope: 5y < 10y < 30y');
}

// ── Yield & PoD ───────────────────────────────────────────────────────────────
ok(near(impliedYield(4.5, 396, 0), 8.46), 'impliedYield = baseRate + spread/100');
ok(near(probabilityOfDefault(396), 0.3270, 0.001), 'PoD(396bps,10y) ≈ 0.327');
ok(probabilityOfDefault(0) === 0, 'PoD(0) = 0');
ok(near(nextResidual(2, 30, 25), 7), 'calibration residual remains in volatility points');
ok(nextResidual(29, 80, 20) === 30 && nextResidual(-29, 0, 20) === -30, 'calibration residual is bounded');

// ── Source-parity: the browser engine still encodes the same formula ──────────
// Parse sentinel.v2.js in place (same technique as check-stale-anchors.js) and
// assert the load-bearing constants/formulas match this module. If someone edits
// the browser math, this fails — prompting them to update the spec + tests too.
{
  const src = readFileSync(new URL('../sentinel.v2.js', import.meta.url), 'utf8');
  const has = (needle, label) => ok(src.includes(needle), 'parity: ' + label + ' matches sentinel.v2.js');
  has('1.5 + 1.0 / (1 + Math.exp(-0.4 * (proxyVol - 35)))', 'Merton sigmoid');
  has('Math.min(0.8, Math.max(0, (vix - 25) / 25))', 'VIX cFactor');
  has('* 50 * stressMultiplier * sensitivity', 'market base 50bps leg');
  has("company.type === 'IG' ? 0.35 : 1.0", 'IG/HY sensitivity');
  has('(selectedTenure - 10) * 0.03', 'tenure slope');
  has("{ 'Secured': 0.85, 'Unsecured': 1.0, 'Subordinated': 1.5 }", 'seniority multipliers');
}

console.log('\n' + (fail === 0 ? '✓ ALL PASS' : '✗ FAILURES') + ` — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
