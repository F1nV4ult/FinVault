/**
 * Project Osiris - Deterministic Oracle Synthesis Engine
 * Generates a componentized, scannable HTML readout from stochastic percentiles.
 * Designed for non-technical retail users with zero external dependencies.
 */

export class OsirisOracle {
    constructor(uiContainerElement) {
        this.container = uiContainerElement;
        this.isTyping = false;
    }

    /**
     * Primary synthesis entry point. Generates deterministic componentized readout.
     * @param {Object} params - { ticker, currentPrice, p50, p05, p95, physicsType, volatility, physicsParams, horizonDays }
     */
    async requestSynthesis(params) {
        this._clearContainer();
        this._showLoading();

        // Brief loading state for visual continuity
        await new Promise(resolve => setTimeout(resolve, 400));

        this._clearContainer();
        this._renderComponentizedReadout(params);
    }

    // ── Phase 2: Plain-English Translation Engine ──────────────────────────

    /**
     * Probability that the terminal price exceeds the current spot.
     *
     * Phase 1: prefer the empirical count from the 5000-path simulation when
     * provided (`pAboveSpot`). This is exactly correct regardless of the
     * underlying distribution (OU's truncated/bounded terminal, GBM+Jump's
     * heavy-tailed mixture, etc.).
     *
     * Fallback: the legacy Gaussian Φ(z) approximation from the P05/P50/P95
     * percentile spread. Kept defensively for backward compat — should not
     * be reached in normal operation.
     */
    _approximateWinProbability(params) {
        const { currentPrice, p50, p05, p95, pAboveSpot } = params;

        if (typeof pAboveSpot === 'number' && pAboveSpot >= 0 && pAboveSpot <= 1) {
            const prob = Math.round(pAboveSpot * 100);
            return Math.max(1, Math.min(99, prob));
        }

        // ── Legacy fallback (Gaussian approximation of a non-Gaussian output) ──
        const impliedSigma = (p95 - p05) / (2 * 1.645);
        if (impliedSigma <= 0) return 50;

        const z = (p50 - currentPrice) / impliedSigma;
        const cdf = this._normalCDF(z);
        const prob = Math.round(cdf * 100);
        return Math.max(1, Math.min(99, prob));
    }

    /**
     * Fast normal CDF approximation (Abramowitz & Stegun, formula 7.1.26).
     */
    _normalCDF(z) {
        const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
        const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
        const sign = z < 0 ? -1 : 1;
        const x = Math.abs(z) / Math.SQRT2;
        const t = 1.0 / (1.0 + p * x);
        const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return 0.5 * (1.0 + sign * erf);
    }

    /**
     * Formats a price float to $ string with 2 decimal places.
     */
    _fmtPrice(val) {
        return '$' + parseFloat(val).toFixed(2);
    }

    // ── Phase 1 & 3: Componentized DOM Injection ───────────────────────────

    _renderComponentizedReadout(params) {
        const { ticker, currentPrice, p50, p05, p95, physicsType, volatility, physicsParams, tickerMeta, regime, horizonDays } = params;

        const winProb = this._approximateWinProbability(params);
        const days = horizonDays || 252;
        const sigma = volatility || 0.22;

        // Physics-specific assumption bullet
        let physicsBullet = '';
        if (physicsType === 'Ornstein-Uhlenbeck') {
            const theta = physicsParams?.reversionSpeedTheta || 0.15;
            const ltm = (typeof physicsParams?.longTermMean === 'number')
                ? this._fmtPrice(physicsParams.longTermMean)
                : null;
            physicsBullet = ltm
                ? `Mean Reversion: Prices drift back toward the 1y mean of ${ltm} at speed θ = ${theta.toFixed(2)}.`
                : `Mean Reversion: Prices drift back toward a long-term level at speed θ = ${theta.toFixed(2)}.`;
        } else {
            const lambda = physicsParams?.jumpFrequencyLambda || 5;
            const jumpMu = physicsParams?.jumpMu;
            if (typeof jumpMu === 'number' && Math.abs(jumpMu) > 1e-6) {
                const sign = jumpMu > 0 ? '+' : '';
                physicsBullet = `Event Shocks: Lognormal jumps at λ = ${lambda}/yr, mean log-jump ${sign}${(jumpMu * 100).toFixed(2)}% — captures contract-flow asymmetry.`;
            } else {
                physicsBullet = `Event Shocks: Symmetric Poisson jumps at λ = ${lambda}/yr. Up and down jumps equally likely.`;
            }
        }

        // Ticker-profile bullet. Beta + dividendYield are live-derived in
        // osirisIngestion; creditRating is hand-filled in physics-config.json
        // with a ratingLastVerified date so staleness is visible to users.
        let tickerProfileBullet = '';
        if (tickerMeta && (tickerMeta.creditRating || tickerMeta.beta != null || tickerMeta.dividendYield != null)) {
            const rating = tickerMeta.creditRating || '—';
            const ratingDate = tickerMeta.ratingLastVerified ? ` (verified ${tickerMeta.ratingLastVerified})` : '';
            const betaStr = (typeof tickerMeta.beta === 'number') ? tickerMeta.beta.toFixed(2) : '—';
            const dyStr = (typeof tickerMeta.dividendYield === 'number') ? (tickerMeta.dividendYield * 100).toFixed(2) + '%' : '—';
            tickerProfileBullet = `Ticker Profile: Credit Rating ${rating}${ratingDate} · Beta ${betaStr} · Dividend Yield ${dyStr}.`;
        }

        const regimeBullet = regime
            ? `Market Regime: ${regime.label} (${regime.confidence} confidence) · volatility multiplier ${regime.volatilityMultiplier.toFixed(2)}×.`
            : '';

        const template = document.createElement('div');
        template.className = 'oracle-readout-grid';
        template.style.cssText = 'display:flex;flex-direction:column;gap:18px;font-family:monospace;';

        // ── ROW 1: HEADLINE ────────────────────────────────────────────
        const headline = document.createElement('div');
        headline.className = 'oracle-headline';
        headline.style.cssText = 'font-size:1.05em;line-height:1.6;color:var(--accent-green);opacity:0;transition:opacity 0.4s ease;';
        headline.innerHTML = `There is an <span style="font-weight:bold;font-size:1.2em;color:#fff;text-shadow:0 0 6px rgba(0,255,0,0.4);">${winProb}%</span> probability that <span style="font-weight:bold;color:#fff;">${ticker}</span> will trade above its current price of <span style="font-weight:bold;color:#fff;">${this._fmtPrice(currentPrice)}</span> by Day <span style="font-weight:bold;color:#fff;">${days}</span>.`;
        template.appendChild(headline);

        // ── ROW 2: TARGET CORRIDOR BADGES ──────────────────────────────
        const badgeRow = document.createElement('div');
        badgeRow.className = 'oracle-badge-row';
        badgeRow.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;';

        const badges = [
            { label: 'Upside Ceiling', sub: 'Top 5%', value: p95, color: '#0096ff' },
            { label: 'Expected Value', sub: 'Most Likely', value: p50, color: '#00ff00' },
            { label: 'Stress Floor', sub: 'Bottom 5%', value: p05, color: '#ff4444' }
        ];

        // Per-badge slug used by external readers (e.g. the downloads
        // module) to look up the right card via .oracle-badge--<slug>
        // instead of fragile positional indexing.
        const badgeSlugs = ['upside', 'expected', 'stress'];

        badges.forEach((badge, idx) => {
            const card = document.createElement('div');
            const slug = badgeSlugs[idx] || ('badge-' + idx);
            card.className = 'oracle-badge oracle-badge--' + slug;
            card.style.cssText = `
                background: rgba(0,0,0,0.6);
                border: 1px solid ${badge.color}33;
                padding: 14px 12px;
                text-align: center;
                opacity: 0;
                transition: opacity 0.4s ease;
                transition-delay: ${0.15 + idx * 0.12}s;
            `;

            const badgePctChange = ((badge.value / currentPrice) - 1) * 100;
            const badgeDir = badgePctChange >= 0 ? '▲' : '▼';
            const badgeDirColor = badgePctChange >= 0 ? '#00ff88' : '#ff4444';

            card.innerHTML = `
                <div class="oracle-badge-label" style="font-size:0.7em;color:${badge.color};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">${badge.label}</div>
                <div class="oracle-badge-sub" style="font-size:0.6em;color:rgba(255,255,255,0.4);margin-bottom:10px;">(${badge.sub})</div>
                <div class="oracle-badge-price" style="font-size:1.5em;font-weight:bold;color:#fff;text-shadow:0 0 8px ${badge.color}33;">${this._fmtPrice(badge.value)}</div>
                <div class="oracle-badge-pct" style="font-size:0.75em;color:${badgeDirColor};margin-top:6px;">${badgeDir} ${badgePctChange.toFixed(1)}%</div>
            `;
            badgeRow.appendChild(card);
        });
        template.appendChild(badgeRow);

        // ── ROW 3: MODEL ASSUMPTIONS ───────────────────────────────────
        const assumptions = document.createElement('div');
        assumptions.className = 'oracle-assumptions';
        assumptions.style.cssText = 'border-top:1px solid rgba(0,255,0,0.15);padding-top:14px;opacity:0;transition:opacity 0.4s ease;transition-delay:0.55s;';
        assumptions.innerHTML = `
            <div style="font-size:0.75em;color:var(--accent-green);letter-spacing:2px;margin-bottom:10px;text-transform:uppercase;">Model Assumptions</div>
            <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;">
                <li style="font-size:0.85em;color:rgba(0,255,0,0.7);line-height:1.5;">
                    <span style="color:var(--accent-green);margin-right:6px;">›</span>
                    Market Volatility: Assumes daily stock price swings remain consistent with historical baselines (Volatility: ${sigma.toFixed(2)}).
                </li>
                <li style="font-size:0.85em;color:rgba(0,255,0,0.7);line-height:1.5;">
                    <span style="color:var(--accent-green);margin-right:6px;">›</span>
                    ${physicsBullet}
                </li>
                ${tickerProfileBullet ? `<li style="font-size:0.85em;color:rgba(0,255,0,0.7);line-height:1.5;">
                    <span style="color:var(--accent-green);margin-right:6px;">›</span>
                    ${tickerProfileBullet}
                </li>` : ''}
                ${regimeBullet ? `<li style="font-size:0.85em;color:rgba(0,255,0,0.7);line-height:1.5;">
                    <span style="color:var(--accent-green);margin-right:6px;">›</span>
                    ${regimeBullet}
                </li>` : ''}
            </ul>
        `;
        template.appendChild(assumptions);

        // ── Inject & Animate ───────────────────────────────────────────
        this.container.appendChild(template);

        // Force reflow, then trigger CSS transitions sequentially
        requestAnimationFrame(() => {
            headline.style.opacity = '1';
            badgeRow.querySelectorAll('.oracle-badge').forEach(b => b.style.opacity = '1');
            assumptions.style.opacity = '1';
        });
    }

    // ── Utility Methods ────────────────────────────────────────────────────

    _clearContainer() {
        this.container.innerHTML = '';
        this.isTyping = false;
    }

    _showLoading() {
        this.container.innerHTML = `> COMPUTING DETERMINISTIC SYNTHESIS... <span class="blinking-cursor">_</span>`;
    }
}
