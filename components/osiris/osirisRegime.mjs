/**
 * Transparent O4 market-regime classifier.
 *
 * It deliberately uses only inputs already available to Osiris: adjusted
 * closes and VIX. This makes the adjustment auditable and avoids presenting a
 * black-box score as a forecast. The returned multiplier affects volatility
 * only when the user selects the Auto-detected regime control.
 */

function realizedVolatility(history, lookback) {
    if (!Array.isArray(history) || history.length < lookback + 1) return null;
    const start = Math.max(1, history.length - lookback);
    const returns = [];
    for (let i = start; i < history.length; i++) {
        const previous = history[i - 1]?.adjClose;
        const current = history[i]?.adjClose;
        if (previous > 0 && current > 0) returns.push(Math.log(current / previous));
    }
    if (returns.length < Math.max(10, lookback / 2)) return null;
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, returns.length - 1);
    return Math.sqrt(variance * 252);
}

function drawdown(history, lookback = 63) {
    if (!Array.isArray(history) || history.length < 2) return null;
    const recent = history.slice(-lookback);
    let peak = -Infinity;
    let worst = 0;
    for (const point of recent) {
        const price = point?.adjClose;
        if (!(price > 0)) continue;
        peak = Math.max(peak, price);
        if (peak > 0) worst = Math.min(worst, price / peak - 1);
    }
    return Number.isFinite(worst) ? worst : null;
}

export function classifyOsirisRegime(history, macros = {}) {
    const shortVol = realizedVolatility(history, 21);
    const longVol = realizedVolatility(history, 126);
    const relativeVol = shortVol != null && longVol != null && longVol > 0 ? shortVol / longVol : null;
    const recentDrawdown = drawdown(history);
    const vix = typeof macros.VIX === 'number' ? macros.VIX : null;

    const stressed = (vix != null && vix >= 25) || (relativeVol != null && relativeVol >= 1.5) || (recentDrawdown != null && recentDrawdown <= -0.15);
    const elevated = !stressed && ((vix != null && vix >= 20) || (relativeVol != null && relativeVol >= 1.2) || (recentDrawdown != null && recentDrawdown <= -0.08));
    const calm = !stressed && !elevated && (vix != null && vix < 15) && (relativeVol != null && relativeVol < 0.85) && (recentDrawdown == null || recentDrawdown > -0.05);

    const state = stressed ? 'stressed' : elevated ? 'elevated' : calm ? 'calm' : 'normal';
    const multiplier = { calm: 0.85, normal: 1.0, elevated: 1.15, stressed: 1.35 }[state];
    const inputsAvailable = [shortVol, longVol, vix].filter(value => value != null).length;
    return {
        state,
        label: state.toUpperCase(),
        volatilityMultiplier: multiplier,
        confidence: inputsAvailable >= 3 ? 'moderate' : inputsAvailable >= 2 ? 'limited' : 'unavailable',
        diagnostics: { vix, shortVol, longVol, relativeVol, drawdown: recentDrawdown }
    };
}
