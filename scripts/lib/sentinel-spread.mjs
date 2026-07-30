/**
 * sentinel-spread.mjs — pure, unit-testable implementation of the Sentinel
 * synthetic credit-spread formula.
 *
 * This is the executable specification of the math in `sentinel.v2.js`
 * (CreditEngine.calculateCurrentSpread + getSpreadDrivers). The browser file
 * remains the production engine; this module mirrors its formula leg-for-leg so
 * it can be exercised headlessly. `test-sentinel-spread.mjs` additionally
 * asserts that the constants/formulas in the browser source still match this
 * module (a source-parity check, the same parse-in-place technique
 * `check-stale-anchors.js` uses) so the two cannot silently drift.
 *
 * Every input is explicit here (the browser reads them from SovereignRegistry /
 * SectorRegistry / UI globals):
 *   type            'IG' | 'HY'
 *   baseSpread       issuer idiosyncratic spread (bps)
 *   ratingIndexBps   rating-bucket OAS floor (bps) or null
 *   sectorBeta, marketBeta, residual
 *   sectorVol        sector-ETF annualised vol (%)
 *   vix              spot VIX
 *   stress           global beta-scaling multiplier (currentBetaScaling), default 1
 *   seniority        'Secured' | 'Unsecured' | 'Subordinated'
 *   tenure           years (reference 10)
 *   instrumentMod    apply seniority/tenure modifiers (default true)
 */

export const SENIORITY_MULTIPLIERS = { Secured: 0.85, Unsecured: 1.0, Subordinated: 1.5 };
export const SENSITIVITY   = { IG: 0.35, HY: 1.0 };
export const MERTON_CENTER = 35;    // proxyVol at which the convexity sigmoid = 2.0
export const MERTON_SLOPE  = 0.4;
export const MARKET_BASE_BPS = 50;
export const VIX_FLOOR = 25, VIX_SPAN = 25, CFACTOR_CAP = 0.8;
export const TENURE_REF = 10, TENURE_SLOPE = 0.03;

export function sensitivityFor(type) { return type === 'IG' ? SENSITIVITY.IG : SENSITIVITY.HY; }

/** VIX beta-shift blend factor, clamped to [0, 0.8]. */
export function vixCFactor(vix) {
  return Math.min(CFACTOR_CAP, Math.max(0, (vix - VIX_FLOOR) / VIX_SPAN));
}

/** Merton convexity scalar — smooth logistic from 1.5 (low vol) to 2.5 (high vol). */
export function mertonScalar(proxyVol) {
  return 1.5 + 1.0 / (1 + Math.exp(-MERTON_SLOPE * (proxyVol - MERTON_CENTER)));
}

/** Residual is stored in annualized volatility percentage points. */
export function nextResidual(previousResidual, actualVolatility, proxyVolatility) {
  const previous = Number.isFinite(previousResidual) ? previousResidual : 0;
  return Math.min(30, Math.max(-30, previous + actualVolatility - proxyVolatility));
}

/**
 * Full instrument spread (bps) plus its decomposition. Mirrors
 * CreditEngine.calculateCurrentSpread leg-for-leg.
 */
export function computeSpread(input) {
  const {
    type, baseSpread, ratingIndexBps = null,
    sectorBeta, marketBeta, residual,
    sectorVol, vix, stress = 1.0,
    seniority = 'Unsecured', tenure = 10,
    instrumentMod = true,
  } = input;

  const sensitivity = sensitivityFor(type);
  const macroAnchor = Math.max(baseSpread, ratingIndexBps || 0);

  const c = vixCFactor(vix);
  const effSectorBeta = (1 - c) * sectorBeta + c * 1.0;
  const effMarketBeta = (1 - c) * marketBeta + c * 1.0;

  const proxyVol = sectorVol * effSectorBeta + residual;
  const ms = mertonScalar(proxyVol);
  const volatilityPremium = proxyVol * ms * stress * sensitivity;
  const marketComponent = effMarketBeta * MARKET_BASE_BPS * stress * sensitivity;

  const baseDelta = Math.round(marketComponent + volatilityPremium);
  const baseTotalSpread = macroAnchor + baseDelta;

  const isSub = instrumentMod && seniority === 'Subordinated';
  const subMult = isSub ? (1.5 + baseTotalSpread / 200) : 1.0;
  const senMult = (instrumentMod && !isSub) ? SENIORITY_MULTIPLIERS[seniority] : 1.0;
  const tenureMult = instrumentMod ? (1 + (tenure - TENURE_REF) * TENURE_SLOPE) : 1.0;

  const finalSpread = Math.round(baseTotalSpread * subMult * senMult * tenureMult);

  return {
    finalSpread, macroAnchor, proxyVol, mertonScalar: ms,
    volatilityPremium, marketComponent, baseDelta, baseTotalSpread,
    effSectorBeta, effMarketBeta, cFactor: c, sensitivity,
    subMult, senMult, tenureMult,
    regime: proxyVol > MERTON_CENTER ? 'DISTRESS' : 'STABLE',
  };
}

/** Implied all-in yield (%). spread & sovereignSpread in bps; baseRate in %. */
export function impliedYield(baseRate, spreadBps, sovereignSpreadBps = 0) {
  return baseRate + sovereignSpreadBps / 100 + spreadBps / 100;
}

/** Reduced-form probability of default over a flat hazard. spread in bps. */
export function probabilityOfDefault(spreadBps, years = 10) {
  return 1 - Math.exp(-(spreadBps / 10000) * years);
}
