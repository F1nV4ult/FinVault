/**
 * Project Osiris - Stochastic Worker
 * Handles Monte Carlo simulations off the main thread.
 * Zero external dependencies.
 *
 * Phase 1 math corrections:
 *   - dt = 1/252 (calendar-time scaling, decoupled from horizon length)
 *   - Merton jump compensator on GBM (removes systematic upward P50 bias)
 *   - Empirical pAboveSpot computed from the 5000 terminals directly
 *     (replaces a non-normal Φ(z) approximation in the Oracle)
 *
 * Phase B (HI-FI mode):
 *   - Optional antithetic variates — pair each Brownian path with its
 *     sign-flipped twin to halve Monte Carlo variance at zero compute
 *     overhead. Only the Gaussian diffusion shocks are paired; jumps
 *     stay independent so we don't destroy the Poisson distribution.
 *   - Chunked progress messages so the UI can render a progress bar
 *     during long high-path runs (50K / 100K / 250K).
 */

// Progress chunk: emit ~10 ticks across the whole run regardless of N.
const PROGRESS_TICKS = 10;

// Deterministic PRNG for reproducible forecast runs. Mulberry32 is fast,
// compact, and sufficient for a browser-side Monte Carlo visualisation. The
// seed is supplied by the orchestrator from ticker/data/scenario inputs.
function createSeededRandom(seed) {
    let state = (Number(seed) >>> 0) || 0x6D2B79F5;
    return function seededRandom() {
        state |= 0;
        state = (state + 0x6D2B79F5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Box-Muller standard-normal sample.
function randomNormal(random) {
    let u = 0, v = 0;
    while (u === 0) u = random();
    while (v === 0) v = random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function postProgress(p, paths, chunkSize) {
    if (chunkSize <= 0) return;
    if (p > 0 && (p % chunkSize) === 0) {
        self.postMessage({ progress: p / paths });
    }
}

// In-place order statistic. Repeated selection is substantially cheaper than
// a full sort for each horizon because Osiris needs nine quantiles, not every
// ranked path. It mutates `values`, which is intentional: callers refill the
// scratch buffer for every time step.
function quickSelect(values, target) {
    let left = 0;
    let right = values.length - 1;
    while (left < right) {
        const pivot = values[(left + right) >> 1];
        let i = left;
        let j = right;
        while (i <= j) {
            while (values[i] < pivot) i++;
            while (values[j] > pivot) j--;
            if (i <= j) {
                const tmp = values[i];
                values[i] = values[j];
                values[j] = tmp;
                i++;
                j--;
            }
        }
        if (target <= j) right = j;
        else if (target >= i) left = i;
        else return values[target];
    }
    return values[left];
}

function extractPercentilePaths(pathsMatrix, steps, paths, initialPrice) {
    const quantiles = [0.05, 0.10, 0.25, 0.45, 0.50, 0.55, 0.75, 0.90, 0.95];
    const percentileNames = ['p05', 'p10', 'p25', 'p45', 'p50', 'p55', 'p75', 'p90', 'p95'];
    const percentilePaths = Object.fromEntries(percentileNames.map(name => [name, new Float32Array(steps)]));
    let countAbove = 0;

    // A percentile cone is a cross-sectional distribution at *each* horizon,
    // not the path belonging to a terminal percentile. The previous approach
    // selected nine complete paths after sorting their terminal prices, which
    // could make intermediate bands cross or misrepresent uncertainty.
    const valuesAtStep = new Float32Array(paths);
    for (let t = 0; t < steps; t++) {
        for (let p = 0; p < paths; p++) valuesAtStep[p] = pathsMatrix[p * steps + t];
        for (let q = 0; q < quantiles.length; q++) {
            percentilePaths[percentileNames[q]][t] = quickSelect(valuesAtStep, Math.floor((paths - 1) * quantiles[q]));
        }
    }

    for (let p = 0; p < paths; p++) {
        const terminal = pathsMatrix[p * steps + (steps - 1)];
        if (terminal > initialPrice) countAbove++;
    }

    return {
        percentiles: percentilePaths,
        pAboveSpot: countAbove / paths
    };
}

// Engine A: Ornstein-Uhlenbeck + GARCH(1,1) volatility
//
// dS = θ(μ − S)dt + σ_t·S·dW  where σ²_t evolves via GARCH(1,1).
// GARCH(1,1): varT_{t+1} = ω + α·z²_t·varT_t + β·varT_t
//   ω = varT0·(1 − α − β), anchoring the long-run variance to the input sigma.
//   Default parameters α=0.10, β=0.85 are typical for equity daily returns.
//   For steps=2 (1-day backtest) GARCH has no effect since only the initial
//   variance is consumed. The benefit appears for multi-day UI simulations.
function simulateOU(initialPrice, drift, sigma, steps, paths, theta, longTermMean, antithetic, intradaySteps, garchAlpha, garchBeta, random = Math.random) {
    const dt = 1 / (252 * (intradaySteps || 1));
    const reversionTarget = (typeof longTermMean === 'number' && longTermMean > 0)
        ? longTermMean
        : initialPrice * Math.exp(drift);
    const pathsMatrix = new Float32Array(paths * steps);
    const isZeroVol = (sigma <= 1e-8);
    const chunkSize = Math.max(1, Math.floor(paths / PROGRESS_TICKS));

    const ga = garchAlpha ?? 0.10;
    const gb = garchBeta  ?? 0.85;
    const varT0 = sigma * sigma * dt;
    const omega  = varT0 * (1.0 - ga - gb);

    if (antithetic && !isZeroVol) {
        const pairs = paths >> 1;
        for (let pp = 0; pp < pairs; pp++) {
            const idx1 = (pp * 2) * steps;
            const idx2 = (pp * 2 + 1) * steps;
            let S1 = initialPrice, S2 = initialPrice;
            let varT = varT0;
            pathsMatrix[idx1] = S1;
            pathsMatrix[idx2] = S2;
            for (let i = 1; i < steps; i++) {
                const z = randomNormal(random);
                const sqrtVar = Math.sqrt(varT);
                // Twins share varT because z² is sign-symmetric.
                S1 += theta * (reversionTarget - S1) * dt + sqrtVar * S1 *  z;
                S2 += theta * (reversionTarget - S2) * dt + sqrtVar * S2 * -z;
                pathsMatrix[idx1 + i] = Math.max(0, S1);
                pathsMatrix[idx2 + i] = Math.max(0, S2);
                varT = Math.max(omega + (ga * z * z + gb) * varT, 1e-10);
            }
            postProgress(pp * 2, paths, chunkSize);
        }
        if (paths & 1) {
            const lastIdx = (paths - 1) * steps;
            let S = initialPrice, varT = varT0;
            pathsMatrix[lastIdx] = S;
            for (let i = 1; i < steps; i++) {
                const z = randomNormal(random);
                S += theta * (reversionTarget - S) * dt + Math.sqrt(varT) * S * z;
                pathsMatrix[lastIdx + i] = Math.max(0, S);
                varT = Math.max(omega + (ga * z * z + gb) * varT, 1e-10);
            }
        }
    } else {
        for (let p = 0; p < paths; p++) {
            let S = initialPrice, varT = varT0;
            pathsMatrix[p * steps] = S;
            for (let i = 1; i < steps; i++) {
                if (isZeroVol) {
                    S += theta * (reversionTarget - S) * dt;
                } else {
                    const z = randomNormal(random);
                    S += theta * (reversionTarget - S) * dt + Math.sqrt(varT) * S * z;
                    varT = Math.max(omega + (ga * z * z + gb) * varT, 1e-10);
                }
                pathsMatrix[p * steps + i] = Math.max(0, S);
            }
            postProgress(p, paths, chunkSize);
        }
    }
    return extractPercentilePaths(pathsMatrix, steps, paths, initialPrice);
}

// Engine B: GBM + Merton Jump Diffusion + GARCH(1,1) volatility
//
// Log-return per step: Δlog(S) = (μ−compensator)·dt − ½·varT + √varT·z + jump
// GARCH(1,1): varT_{t+1} = ω + α·z²_t·varT_t + β·varT_t
//   Ito correction is time-varying (−½·varT) so expected price path is unchanged.
//   With antithetic paths, both twins share varT because z² is sign-symmetric.
function simulateGBMJump(initialPrice, mu, sigma, steps, paths, lambda, jumpMu, antithetic, intradaySteps, garchAlpha, garchBeta, random = Math.random) {
    const dt = 1 / (252 * (intradaySteps || 1));
    const pathsMatrix = new Float32Array(paths * steps);
    const isZeroVol = (sigma <= 1e-8);
    const chunkSize = Math.max(1, Math.floor(paths / PROGRESS_TICKS));

    // Jump size: fixed at 0.07 (7% std) — see simulate.mjs for calibration note.
    const jumpMean = (typeof jumpMu === 'number') ? jumpMu : 0;
    const jumpStd  = isZeroVol ? 0 : 0.07;
    const compensator = isZeroVol
        ? 0
        : lambda * (Math.exp(jumpMean + 0.5 * jumpStd * jumpStd) - 1);
    // Constant drift component; Ito correction is now time-varying via varT.
    const driftDt = (mu - compensator) * dt;

    const ga = garchAlpha ?? 0.10;
    const gb = garchBeta  ?? 0.85;
    const varT0 = sigma * sigma * dt;
    const omega  = varT0 * (1.0 - ga - gb);

    if (antithetic && !isZeroVol) {
        // Gaussian shocks paired; jumps independent (preserves Poisson structure).
        const pairs = paths >> 1;
        for (let pp = 0; pp < pairs; pp++) {
            const idx1 = (pp * 2) * steps;
            const idx2 = (pp * 2 + 1) * steps;
            let S1 = initialPrice, S2 = initialPrice;
            let varT = varT0;
            pathsMatrix[idx1] = S1;
            pathsMatrix[idx2] = S2;
            for (let i = 1; i < steps; i++) {
                let jf1 = 1, jf2 = 1;
                if (random() < lambda * dt) jf1 = Math.exp(randomNormal(random) * jumpStd + jumpMean);
                if (random() < lambda * dt) jf2 = Math.exp(randomNormal(random) * jumpStd + jumpMean);
                const z = randomNormal(random);
                const halfVar = 0.5 * varT;
                const sqrtVar = Math.sqrt(varT);
                S1 = S1 * Math.exp(driftDt - halfVar + sqrtVar *  z) * jf1;
                S2 = S2 * Math.exp(driftDt - halfVar + sqrtVar * -z) * jf2;
                pathsMatrix[idx1 + i] = Math.max(0, S1);
                pathsMatrix[idx2 + i] = Math.max(0, S2);
                varT = Math.max(omega + (ga * z * z + gb) * varT, 1e-10);
            }
            postProgress(pp * 2, paths, chunkSize);
        }
        if (paths & 1) {
            const lastIdx = (paths - 1) * steps;
            let S = initialPrice, varT = varT0;
            pathsMatrix[lastIdx] = S;
            for (let i = 1; i < steps; i++) {
                let jf = 1;
                if (random() < lambda * dt) jf = Math.exp(randomNormal(random) * jumpStd + jumpMean);
                const z = randomNormal(random);
                S = S * Math.exp(driftDt - 0.5 * varT + Math.sqrt(varT) * z) * jf;
                pathsMatrix[lastIdx + i] = Math.max(0, S);
                varT = Math.max(omega + (ga * z * z + gb) * varT, 1e-10);
            }
        }
    } else {
        for (let p = 0; p < paths; p++) {
            let S = initialPrice, varT = varT0;
            pathsMatrix[p * steps] = S;
            for (let i = 1; i < steps; i++) {
                if (isZeroVol) {
                    S = S * Math.exp(driftDt);
                } else {
                    let jf = 1;
                    if (random() < lambda * dt) jf = Math.exp(randomNormal(random) * jumpStd + jumpMean);
                    const z = randomNormal(random);
                    S = S * Math.exp(driftDt - 0.5 * varT + Math.sqrt(varT) * z) * jf;
                    varT = Math.max(omega + (ga * z * z + gb) * varT, 1e-10);
                }
                pathsMatrix[p * steps + i] = Math.max(0, S);
            }
            postProgress(p, paths, chunkSize);
        }
    }
    return extractPercentilePaths(pathsMatrix, steps, paths, initialPrice);
}

self.onmessage = function(e) {
    const { initialPrice, drift, volatility, steps, paths, physicsType, physicsParams, antithetic, intradaySteps, seed } = e.data;
    const random = Number.isFinite(seed) ? createSeededRandom(seed) : Math.random;

    let result;
    const intradayStepsResolved = Math.max(1, intradaySteps || 1);

    // GARCH(1,1) parameters — configurable per cohort via physicsParams,
    // defaulting to empirically typical equity values (α=0.10, β=0.85).
    const garchAlpha = physicsParams?.garchAlpha ?? 0.10;
    const garchBeta  = physicsParams?.garchBeta  ?? 0.85;

    try {
        if (physicsType === 'Ornstein-Uhlenbeck') {
            const theta = physicsParams?.reversionSpeedTheta || 0.15;
            const longTermMean = (typeof physicsParams?.longTermMean === 'number')
                ? physicsParams.longTermMean
                : null;
            result = simulateOU(initialPrice, drift, volatility, steps, paths, theta, longTermMean, !!antithetic, intradayStepsResolved, garchAlpha, garchBeta, random);
        } else if (physicsType === 'Geometric Brownian Motion + Jump Diffusion') {
            const lambda = physicsParams?.jumpFrequencyLambda || 4;
            const jumpMu = (typeof physicsParams?.jumpMu === 'number') ? physicsParams.jumpMu : 0;
            result = simulateGBMJump(initialPrice, drift, volatility, steps, paths, lambda, jumpMu, !!antithetic, intradayStepsResolved, garchAlpha, garchBeta, random);
        } else {
            self.postMessage({ error: 'Unknown physicsType: ' + physicsType });
            return;
        }

        self.postMessage({
            percentiles: result.percentiles,
            pAboveSpot: result.pAboveSpot,
            seed: Number.isFinite(seed) ? seed : null
        });
    } catch (err) {
        self.postMessage({ error: err.message });
    }
};
