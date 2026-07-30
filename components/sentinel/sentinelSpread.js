/* Sentinel's browser-side executable spread specification.
 *
 * Every displayed spread surface must call this module. Keeping the quote,
 * driver readout and waterfall on the same calculation prevents explanatory
 * charts from drifting away from the value they describe.
 */
(function attachSentinelSpread(global) {
    const SENIORITY_MULTIPLIERS = { Secured: 0.85, Unsecured: 1.0, Subordinated: 1.5 };
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function computeSpread(input) {
        const sensitivity = input.type === 'IG' ? 0.35 : 1.0;
        const stress = Number.isFinite(input.stress) ? input.stress : 1.0;
        const anchor = Math.max(input.baseSpread, input.ratingIndexBps || 0);
        const cFactor = clamp(((input.vix || 15) - 25) / 25, 0, 0.8);
        const sectorBeta = (1 - cFactor) * input.sectorBeta + cFactor;
        const marketBeta = (1 - cFactor) * input.marketBeta + cFactor;
        const proxyVol = input.sectorVol * sectorBeta + input.residual;
        const mertonScalar = 1.5 + 1 / (1 + Math.exp(-0.4 * (proxyVol - 35)));
        const marketComponent = marketBeta * 50 * stress * sensitivity;
        const volatilityPremium = proxyVol * mertonScalar * stress * sensitivity;
        const baseDelta = Math.round(marketComponent + volatilityPremium);
        const baseTotalSpread = anchor + baseDelta;
        const applyInstrument = Boolean(input.instrumentMod);
        const subordinated = applyInstrument && input.seniority === 'Subordinated';
        const subMultiplier = subordinated ? 1.5 + baseTotalSpread / 200 : 1;
        const seniorityMultiplier = applyInstrument && !subordinated
            ? (SENIORITY_MULTIPLIERS[input.seniority] || 1) : 1;
        const tenureMultiplier = applyInstrument ? 1 + ((input.tenure || 10) - 10) * 0.03 : 1;
        const finalSpread = Math.round(baseTotalSpread * subMultiplier * seniorityMultiplier * tenureMultiplier);

        return {
            finalSpread, anchor, cFactor, sectorBeta, marketBeta, proxyVol,
            mertonScalar, marketComponent, volatilityPremium, baseDelta,
            baseTotalSpread, subMultiplier, seniorityMultiplier, tenureMultiplier,
            regime: proxyVol > 35 ? 'DISTRESS' : 'STABLE'
        };
    }

    // Residual is measured in annualized volatility percentage points because
    // it is added directly to proxyVol. It must never be converted to bps.
    function nextResidual(previousResidual, actualVolatility, proxyVolatility) {
        const previous = Number.isFinite(previousResidual) ? previousResidual : 0;
        const error = actualVolatility - proxyVolatility;
        return clamp(previous + error, -30, 30);
    }

    // A transparent, full-loss stress proxy. It intentionally does not claim
    // to be a calibrated CDS-implied probability of default.
    function defaultStressProxy(spreadBps, years = 10) {
        return 1 - Math.exp(-(Math.max(0, spreadBps) / 10000) * years);
    }

    global.SentinelSpread = { computeSpread, nextResidual, defaultStressProxy, SENIORITY_MULTIPLIERS };
}(window));
