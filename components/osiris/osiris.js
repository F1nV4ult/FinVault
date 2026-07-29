import { osirisIngestion } from './osirisIngestion.js';
import { OsirisCloudCanvas } from './osirisCloudCanvas.js';
import { OsirisOracle } from './osirisOracle.js';

// ── Device classification & path budgets ───────────────────────────────
// Detected once at orchestrator init and held in `this.deviceClass`.
//   mobile     — coarse pointer, narrow viewport, or low-memory device.
//                No HI-FI toggle. Capped at the mobile budget.
//   desktop_lo — anything desktop-class but not high-end. HI-FI up to 100K.
//   desktop_hi — ≥ 8 GB device memory and ≥ 8 logical cores. HI-FI up to 250K.
const DEVICE_DEFAULT_PATHS = { mobile: 10000, desktop_lo: 25000, desktop_hi: 25000 };
const DEVICE_HIFI_CAP =      { mobile: 0,     desktop_lo: 100000, desktop_hi: 250000 };

function detectDeviceClass() {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const narrow = typeof matchMedia === 'function' && matchMedia('(max-width: 768px)').matches;
    const mem = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 4;
    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    if (coarse || narrow || mem <= 2) return 'mobile';
    if (mem >= 8 && cores >= 8) return 'desktop_hi';
    return 'desktop_lo';
}

// Ticker → FinVault report slug. Default: lowercase + dots→dashes.
// Overrides for companies whose report URLs use the full name instead.
const FINVAULT_SLUG_OVERRIDES = {
    'XOM': 'exxonmobil', 'CVX': 'chevron', 'IBE.MC': 'iberdrola',
    'LMT': 'lockheedmartin', 'NOC': 'northropgrumman', 'GD': 'generaldynamics',
    'LHX': 'l3harris', 'RHM.DE': 'rheinmetall', 'ERJ': 'erj'
};
function tickerToFinvaultSlug(ticker) {
    return FINVAULT_SLUG_OVERRIDES[ticker] || ticker.toLowerCase().replace(/\./g, '-');
}

class OsirisOrchestrator {
    constructor() {
        this.activeWorker = null;
        this.physicsConfig = null;
        this.universe = null;
        this.canvas = null;
        this.oracle = null;
        this.deviceClass = detectDeviceClass();
        this._backtestSummary = null;
        // HI-FI session state — resets every page load. Not persisted.
        this.hifi = { enabled: false, paths: 50000 };

        this.init();
    }

    async init() {
        // Initialize DOM Elements
        const canvasEl = document.getElementById('osiris-canvas');
        const oracleEl = document.getElementById('oracle-readout');

        if (!canvasEl || !oracleEl) {
            console.error('[OSIRIS] Required DOM elements missing.');
            return;
        }

        this.canvas = new OsirisCloudCanvas(canvasEl);
        this.oracle = new OsirisOracle(oracleEl);

        // Directive 1: ResizeObserver
        const resizeObserver = new ResizeObserver(() => {
            if (this.canvas) {
                this.canvas.resize(); // This will also redraw the cached percentiles automatically
            }
        });
        resizeObserver.observe(canvasEl);

        // Load configuration
        try {
            const configRes = await fetch('/physics-config.json');
            this.physicsConfig = await configRes.json();
            // Override the baked-in defaultPaths with a device-class budget
            // so mobile users don't blow memory and high-end desktops can
            // use a sensible non-HI-FI default. HI-FI overrides this again
            // at run-time when toggled on.
            this.physicsConfig.defaultPaths = DEVICE_DEFAULT_PATHS[this.deviceClass]
                || this.physicsConfig.defaultPaths;
            console.log('[OSIRIS] Physics configuration loaded',
                this.physicsConfig.version,
                '· device class:', this.deviceClass,
                '· base paths:', this.physicsConfig.defaultPaths);

            const tickerSelect = document.getElementById('osiris-ticker-select');
            if (tickerSelect) {
                await this.populateTickerSelectFromUniverse(tickerSelect);
                this.syncUIState(tickerSelect.value);
            }
        } catch (e) {
            console.error('[OSIRIS] Failed to load physics-config.json', e);
        }

        // Bind HI-FI controls (no-op on mobile — the controls are hidden
        // there via the device-class attribute on <body> set just below).
        this.bindHifiControls();
        // Tag <body> with the device class so CSS can hide/show controls
        // without per-element JS toggling. The HI-FI controls in
        // osiris.html use `body[data-device='mobile'] .osiris-hifi { display:none }`.
        document.body.setAttribute('data-device', this.deviceClass);

        // Cache Macro Hubs on Initialization
        await osirisIngestion.getMacroHubs();

        // Bind UI Controls
        const triggerBtn = document.getElementById('osiris-trigger-btn');
        const tickerSelect = document.getElementById('osiris-ticker-select');
        const sliderVol = document.getElementById('slider-volatility');
        const valVol = document.getElementById('val-volatility');
        const sliderPhysics = document.getElementById('slider-physics-param');
        const valPhysics = document.getElementById('val-physics-param');
        const sliderHorizon = document.getElementById('slider-horizon');
        const valHorizon = document.getElementById('val-horizon');

        const timePills = document.querySelectorAll('.time-pill');
        const customDaysInput = document.getElementById('osiris-custom-days');
        // volatilityRegime / operationalShock are read directly inside
        // runSimulation via getElementById — no need to bind locally.

        sliderVol.addEventListener('input', (e) => valVol.innerText = e.target.value);
        sliderPhysics.addEventListener('input', (e) => valPhysics.innerText = e.target.value);
        sliderHorizon.addEventListener('input', (e) => valHorizon.innerText = e.target.value);

        // Controls only set state; the simulation fires exclusively on the
        // INITIATE SIMULATION button click. Previously six different controls
        // auto-triggered simulations on change — surprising UX, especially
        // for the time-horizon pills which fire mid-deliberation.

        let syncDebounceTimer = null;
        tickerSelect.addEventListener('change', (e) => {
            if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
            syncDebounceTimer = setTimeout(() => {
                this.syncUIState(e.target.value);
            }, 150);
        });

        // Time horizon controls
        timePills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                timePills.forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                const days = e.target.getAttribute('data-value');
                customDaysInput.value = days;
                sliderHorizon.value = days;
                valHorizon.innerText = days;
            });
        });

        customDaysInput.addEventListener('input', (e) => {
            timePills.forEach(p => p.classList.remove('active'));
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) {
                sliderHorizon.value = val;
                valHorizon.innerText = val;
            }
        });

        // Regime / shock / raw slider overrides — state only.
        // (No simulation auto-trigger; user must click the button.)

        if (triggerBtn) {
            triggerBtn.addEventListener('click', () => {
                this.runSimulation(tickerSelect.value);
            });
        }

        // Deep-link support: ?ticker=X pre-selects that ticker before
        // the combobox initialises. Used by FinVault report pages'
        // "Open in Osiris" button. User still clicks INITIATE
        // SIMULATION when ready — no auto-run.
        const urlParams = new URLSearchParams(window.location.search);
        const requestedTicker = urlParams.get('ticker');
        if (requestedTicker && tickerSelect) {
            const match = Array.from(tickerSelect.options).find(o => o.value === requestedTicker);
            if (match) {
                tickerSelect.value = requestedTicker;
                this.syncUIState(requestedTicker);
            }
        }

        // Wrap the (now hidden) <select> in a searchable combobox.
        this.initCombobox();
    }

    /**
     * The canonical universe owns the cross-tool ticker list. Keep the static
     * select only as a no-network fallback; it is replaced before the visible
     * combobox is initialised whenever the registry is available.
     */
    async populateTickerSelectFromUniverse(select) {
        try {
            const response = await fetch('/data/universe.json');
            if (!response.ok) throw new Error('registry ' + response.status);
            const universe = await response.json();
            const entries = Object.values(universe.tickers || {})
                .filter(entry => entry && entry.capabilities && entry.capabilities.osiris && entry.osiris)
                .sort((a, b) => a.name.localeCompare(b.name));
            if (!entries.length) throw new Error('registry has no Osiris issuers');

            const groups = {
                energy_and_utilities: {
                    label: 'ENERGY & UTILITIES // OU MEAN-REVERSION',
                    entries: []
                },
                industrials_and_defense: {
                    label: 'INDUSTRIALS & DEFENSE // GBM + POISSON JUMPS',
                    entries: []
                }
            };
            for (const entry of entries) {
                const group = groups[entry.osiris.cohort];
                if (group) group.entries.push(entry);
            }

            const selected = select.value;
            select.replaceChildren();
            for (const group of Object.values(groups)) {
                if (!group.entries.length) continue;
                const optgroup = document.createElement('optgroup');
                optgroup.label = group.label;
                for (const entry of group.entries) {
                    const option = document.createElement('option');
                    option.value = entry.ticker;
                    option.textContent = `${entry.ticker} - ${entry.name}`;
                    optgroup.appendChild(option);
                }
                select.appendChild(optgroup);
            }
            if (Array.from(select.options).some(option => option.value === selected)) {
                select.value = selected;
            }
            this.universe = universe;
        } catch (error) {
            console.warn('[OSIRIS] Canonical universe unavailable; using static ticker fallback.', error);
        }
    }

    /**
     * Searchable ticker combobox. Items are sourced from the hidden
     * <select>'s options; selection writes back to the <select>.value and
     * dispatches a 'change' event so the existing syncUIState handler fires
     * automatically — no change to the simulation pipeline.
     *
     * Match priority: exact ticker > ticker prefix > name-word prefix >
     * ticker substring > name substring.
     */
    initCombobox() {
        const combobox = document.getElementById('osiris-ticker-combobox');
        const input = document.getElementById('osiris-combobox-input');
        const panel = document.getElementById('osiris-combobox-panel');
        const list = document.getElementById('osiris-combobox-list');
        const chips = combobox ? combobox.querySelectorAll('.osiris-chip') : [];
        const hiddenSelect = document.getElementById('osiris-ticker-select');
        if (!combobox || !input || !panel || !list || !hiddenSelect) return;

        const cohortMap = {
            'ENERGY & UTILITIES // OU MEAN-REVERSION':
                { key: 'energy_and_utilities', display: 'Energy/Util' },
            'INDUSTRIALS & DEFENSE // GBM + POISSON JUMPS':
                { key: 'industrials_and_defense', display: 'Industrials' }
        };

        const items = [];
        Array.from(hiddenSelect.querySelectorAll('optgroup')).forEach(group => {
            const meta = cohortMap[group.label] || { key: 'unknown', display: group.label };
            Array.from(group.querySelectorAll('option')).forEach(opt => {
                const text = opt.textContent.trim();
                const sep = text.indexOf(' - ');
                items.push({
                    symbol: opt.value,
                    ticker: sep > -1 ? text.slice(0, sep).trim() : opt.value,
                    name: sep > -1 ? text.slice(sep + 3).trim() : '',
                    cohort: meta.key,
                    cohortDisplay: meta.display
                });
            });
        });

        let activeCohort = 'all';
        let activeIndex = 0;
        let currentResults = [];
        let justSelected = false;

        const escapeHtml = (s) => s.replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

        function rankMatch(item, q) {
            const t = item.ticker.toLowerCase();
            const n = item.name.toLowerCase();
            if (t === q) return 100;
            if (t.startsWith(q)) return 80;
            const words = n.split(/[\s\-,&]+/).filter(Boolean);
            if (words.some(w => w.startsWith(q))) return 60;
            if (t.includes(q)) return 40;
            if (n.includes(q)) return 20;
            return -1;
        }

        function compute() {
            const raw = input.value.trim();
            const display = hiddenSelect.value
                ? items.find(i => i.symbol === hiddenSelect.value)
                : null;
            // Treat the input as a fresh query unless it matches the current
            // selection display verbatim (which means the user hasn't typed yet).
            const isCurrentDisplay = display && raw === `${display.ticker} - ${display.name}`;
            const q = isCurrentDisplay ? '' : raw.toLowerCase();

            let pool = activeCohort === 'all'
                ? items
                : items.filter(i => i.cohort === activeCohort);

            if (!q) {
                currentResults = pool.slice().sort((a, b) => a.ticker.localeCompare(b.ticker));
            } else {
                currentResults = pool
                    .map(i => ({ item: i, r: rankMatch(i, q) }))
                    .filter(x => x.r >= 0)
                    .sort((a, b) => b.r - a.r || a.item.ticker.localeCompare(b.item.ticker))
                    .map(x => x.item);
            }
            activeIndex = 0;
            render();
        }

        function render() {
            list.innerHTML = '';
            if (currentResults.length === 0) {
                const empty = document.createElement('li');
                empty.className = 'osiris-combobox-empty';
                empty.textContent = 'No tickers match';
                list.appendChild(empty);
                return;
            }
            currentResults.forEach((item, idx) => {
                const li = document.createElement('li');
                li.className = 'osiris-combobox-item' + (idx === activeIndex ? ' is-active' : '');
                li.setAttribute('role', 'option');
                li.setAttribute('data-symbol', item.symbol);
                li.innerHTML = `
                    <span class="osiris-combobox-item-ticker">${escapeHtml(item.ticker)}</span>
                    <span class="osiris-combobox-item-name">${escapeHtml(item.name)}</span>
                    <span class="osiris-combobox-item-cohort">${escapeHtml(item.cohortDisplay)}</span>
                `;
                li.addEventListener('mouseenter', () => {
                    activeIndex = idx;
                    updateActiveStyling();
                });
                // mousedown (not click) so we beat the input's blur handler
                li.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectItem(item);
                });
                list.appendChild(li);
            });
        }

        function updateActiveStyling() {
            Array.from(list.children).forEach((el, idx) => {
                if (el.classList) el.classList.toggle('is-active', idx === activeIndex);
            });
            const active = list.children[activeIndex];
            if (active && active.scrollIntoView) {
                active.scrollIntoView({ block: 'nearest' });
            }
        }

        function openPanel() {
            panel.hidden = false;
            combobox.classList.add('is-open');
            input.setAttribute('aria-expanded', 'true');
            compute();
        }

        function closePanel(restore = true) {
            panel.hidden = true;
            combobox.classList.remove('is-open');
            input.setAttribute('aria-expanded', 'false');
            if (restore && !justSelected && hiddenSelect.value) {
                const cur = items.find(i => i.symbol === hiddenSelect.value);
                if (cur) input.value = `${cur.ticker} - ${cur.name}`;
            }
            justSelected = false;
        }

        function selectItem(item) {
            justSelected = true;
            input.value = `${item.ticker} - ${item.name}`;
            if (hiddenSelect.value !== item.symbol) {
                hiddenSelect.value = item.symbol;
                hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            closePanel(false);
            input.blur();
        }

        // Prefill with current selection (or first option if none).
        const initial = hiddenSelect.value
            ? items.find(i => i.symbol === hiddenSelect.value)
            : items[0];
        if (initial) {
            input.value = `${initial.ticker} - ${initial.name}`;
            if (!hiddenSelect.value) hiddenSelect.value = initial.symbol;
        }

        input.addEventListener('focus', () => { openPanel(); input.select(); });
        input.addEventListener('click', openPanel);
        input.addEventListener('input', compute);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (panel.hidden) { openPanel(); return; }
                if (activeIndex < currentResults.length - 1) {
                    activeIndex++;
                    updateActiveStyling();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (activeIndex > 0) {
                    activeIndex--;
                    updateActiveStyling();
                }
            } else if (e.key === 'Enter') {
                if (!panel.hidden && currentResults[activeIndex]) {
                    e.preventDefault();
                    selectItem(currentResults[activeIndex]);
                }
            } else if (e.key === 'Escape') {
                closePanel();
                input.blur();
            }
        });

        chips.forEach(chip => {
            chip.addEventListener('mousedown', (e) => {
                // mousedown prevents input blur on chip click
                e.preventDefault();
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                activeCohort = chip.getAttribute('data-cohort');
                compute();
                input.focus();
            });
        });

        document.addEventListener('mousedown', (e) => {
            if (!combobox.contains(e.target) && !panel.hidden) closePanel();
        });
    }

    syncUIState(tickerSymbol) {
        if (!this.physicsConfig) return;

        let physicsType = 'Ornstein-Uhlenbeck';
        let physicsParams = null;
        let currentCohort = null;

        for (const cohortName in this.physicsConfig.cohorts) {
            const cohort = this.physicsConfig.cohorts[cohortName];
            const tickerData = cohort.tickers.find(t => t.symbol === tickerSymbol);
            if (tickerData) {
                physicsType = cohort.physics;
                physicsParams = tickerData;
                currentCohort = cohortName;
                break;
            }
        }

        if (!physicsParams) return;

        const sliderPhysics = document.getElementById('slider-physics-param');
        const valPhysics = document.getElementById('val-physics-param');
        const labelPhysics = document.getElementById('label-physics-param');
        const metadataReadout = document.getElementById('osiris-metadata-readout');
        const operationalShock = document.getElementById('osiris-operational-shock');

        if (physicsType === 'Ornstein-Uhlenbeck') {
            sliderPhysics.min = 0.01;
            sliderPhysics.max = 1.00;
            sliderPhysics.step = 0.01;
            sliderPhysics.value = physicsParams.reversionSpeedTheta;
            labelPhysics.innerText = 'REVERSION SPEED (θ)';

            metadataReadout.dataset.baseText = 'TETHERED HUB: BRENT CRUDE BASIS';
            metadataReadout.innerText = metadataReadout.dataset.baseText;
            if (operationalShock) {
                operationalShock.innerHTML = `
                    <option value="1.0">Standard Regulatory Gravity</option>
                    <option value="1.5">Tight Commodity Bounds</option>
                    <option value="0.5">Structural Decoupling</option>
                `;
            }
        } else {
            sliderPhysics.min = 1;
            sliderPhysics.max = 20;
            sliderPhysics.step = 1;
            sliderPhysics.value = physicsParams.jumpFrequencyLambda;
            labelPhysics.innerText = 'JUMP FREQUENCY (λ)';
            metadataReadout.dataset.baseText = 'TETHERED HUB: US10Y TREASURY BASIS';
            metadataReadout.innerText = metadataReadout.dataset.baseText;
            
            if (operationalShock) {
                operationalShock.innerHTML = `
                    <option value="1.0">Standard Procurement Cycle</option>
                    <option value="2.0">Aggressive Contract Wins</option>
                    <option value="0.0">Stagnant Backlog</option>
                `;
            }
        }
        valPhysics.innerText = sliderPhysics.value;

        // Cross-link: update "View in FinVault" anchor whenever ticker changes.
        const finvaultLink = document.getElementById('osiris-finvault-link');
        if (finvaultLink) {
            finvaultLink.href = 'report.html?company=' + tickerToFinvaultSlug(tickerSymbol) + '&from=osiris.html';
            finvaultLink.style.display = '';
        }

        // Backtest badge: load per-ticker metrics.
        this.updateBacktestBadge(tickerSymbol);
    }

    async updateBacktestBadge(ticker) {
        const badge = document.getElementById('osiris-backtest-badge');
        if (!badge) return;
        if (!this._backtestSummary) {
            try {
                const res = await fetch('/data/backtest-summary.json');
                this._backtestSummary = res.ok ? await res.json() : null;
            } catch (_) { this._backtestSummary = null; }
        }
        const data = this._backtestSummary?.by_ticker?.[ticker];
        if (!data) { badge.style.display = 'none'; return; }
        const dirEl  = document.getElementById('bt-dir');
        const ci90El = document.getElementById('bt-ci90');
        const nEl    = document.getElementById('bt-n');
        if (dirEl)  {
            const pct = data.directional_accuracy * 100;
            dirEl.textContent = pct.toFixed(1) + '%';
            dirEl.className = 'osiris-backtest-val' + (pct < 48 ? ' warn' : '');
        }
        if (ci90El) {
            const pct = data.ci90_coverage * 100;
            ci90El.textContent = pct.toFixed(1) + '%';
            ci90El.className = 'osiris-backtest-val' + (pct < 85 ? ' warn' : '');
        }
        if (nEl) nEl.textContent = data.n + ' days';
        badge.style.display = '';
    }

    async runSimulation(tickerSymbol) {
        if (!this.physicsConfig) return;

        // Directive 2: Singleton Worker Termination
        if (this.activeWorker) {
            console.log('[OSIRIS] Terminating stale background worker.');
            this.activeWorker.terminate();
            this.activeWorker = null;
        }

        // Determine Cohort & Physics
        let physicsType = 'Ornstein-Uhlenbeck';
        for (const cohortName in this.physicsConfig.cohorts) {
            const cohort = this.physicsConfig.cohorts[cohortName];
            if (cohort.tickers.find(t => t.symbol === tickerSymbol)) {
                physicsType = cohort.physics;
                break;
            }
        }

        // Baseline parameters — now ticker-specific
        let baseline_sigma = 0.22; // Fallback default
        let baseline_physics_param = 0.15;
        let baseline_jumpMu = 0; // Phase 4: positive for industrials, 0 otherwise
        let tickerMeta = {};

        // Extract base from JSON if available (to allow slider to be independent base)
        const cohort = this.physicsConfig.cohorts[Object.keys(this.physicsConfig.cohorts).find(c => this.physicsConfig.cohorts[c].tickers.some(t => t.symbol === tickerSymbol))];
        if (cohort) {
            const tData = cohort.tickers.find(t => t.symbol === tickerSymbol);
            if (tData) {
                baseline_physics_param = physicsType === 'Ornstein-Uhlenbeck' ? tData.reversionSpeedTheta : tData.jumpFrequencyLambda;
                if (tData.baselineVolatility) {
                    baseline_sigma = tData.baselineVolatility;
                }
                if (typeof tData.jumpMu === 'number') {
                    baseline_jumpMu = tData.jumpMu;
                }
                // creditRating + ratingLastVerified are still hand-filled in the
                // config (no clean free feed). beta + dividendYield are derived
                // live from Yahoo data in osirisIngestion (populated below).
                tickerMeta = {
                    creditRating: tData.creditRating ?? null,
                    ratingLastVerified: tData.ratingLastVerified ?? null,
                    beta: null,
                    dividendYield: null
                };
            }
        }

        const advancedDetails = document.querySelector('.advanced-greeks');
        const isAdvancedOpen = advancedDetails && advancedDetails.open;

        let final_sigma, final_physics_param, final_steps, final_jumpMu;

        if (isAdvancedOpen) {
            // Use raw slider values directly if advanced section is open.
            // Advanced users get exact slider control — no intraday-σ swap
            // and no sub-daily dt; that's a "let me be precise" mode.
            final_sigma = parseFloat(document.getElementById('slider-volatility').value);
            final_physics_param = parseFloat(document.getElementById('slider-physics-param').value);
            final_steps = parseInt(document.getElementById('slider-horizon').value, 10);
            // Advanced mode has no jumpMu slider; use ticker baseline unscaled.
            final_jumpMu = baseline_jumpMu;
        } else {
            // Phase 3: Mathematical Multiplier Reconciliation
            const volRegRegime = document.getElementById('osiris-volatility-regime');
            const opShock = document.getElementById('osiris-operational-shock');
            const customDays = document.getElementById('osiris-custom-days');

            const volRegimeMult = volRegRegime ? parseFloat(volRegRegime.value) : 1.0;
            const opShockMult = opShock ? parseFloat(opShock.value) : 1.0;

            final_sigma = baseline_sigma * volRegimeMult;
            final_physics_param = baseline_physics_param * opShockMult;
            final_steps = customDays ? parseInt(customDays.value, 10) : 252;
            // Phase 4: operational-shock multiplier scales BOTH λ and jumpMu.
            // "Aggressive Contract Wins" (2.0×) doubles frequency AND magnitude
            // of positive jumps; "Stagnant Backlog" (0.0×) zeroes both.
            final_jumpMu = baseline_jumpMu * opShockMult;
            
            // Sync sliders visually
            document.getElementById('slider-volatility').value = final_sigma;
            document.getElementById('val-volatility').innerText = final_sigma.toFixed(2);
            document.getElementById('slider-physics-param').value = final_physics_param;
            document.getElementById('val-physics-param').innerText = final_physics_param.toFixed(2);
            document.getElementById('slider-horizon').value = final_steps;
            document.getElementById('val-horizon').innerText = final_steps;
        }

        let physicsParams = {};
        if (physicsType === 'Ornstein-Uhlenbeck') {
            physicsParams = { reversionSpeedTheta: final_physics_param };
            // longTermMean is attached below once tickerMeta metrics are loaded.
        } else {
            physicsParams = {
                jumpFrequencyLambda: final_physics_param,
                jumpMu: final_jumpMu
            };
        }

        // Fetch Data
        this.oracle._clearContainer();
        this.oracle.container.innerHTML = `> ACQUIRING HISTORICAL DATA FOR ${tickerSymbol}... <span class="blinking-cursor">_</span>`;
        
        try {
            const history = await osirisIngestion.getHistoricalData(tickerSymbol);
            const macros = await osirisIngestion.getMacroHubs();

            // Pull live beta + dividend yield + long-term mean from the same
            // cached record that backed getHistoricalData (no extra network
            // call). Merges with the hand-filled creditRating on tickerMeta.
            let liveLongTermMean = null;
            try {
                const liveMetrics = await osirisIngestion.getTickerMetrics(tickerSymbol);
                if (liveMetrics) {
                    tickerMeta.beta = liveMetrics.beta;
                    tickerMeta.dividendYield = liveMetrics.dividendYield;
                    tickerMeta.longTermMeanPrice = liveMetrics.longTermMeanPrice;
                    liveLongTermMean = liveMetrics.longTermMeanPrice;
                }
            } catch (metricsErr) {
                console.warn('[OSIRIS] Live metrics computation failed; tickerMeta beta/yield will show as "—"', metricsErr);
            }

            // OU uses a calibrated 1y arithmetic mean as the reversion target.
            // Falls back to the old initialPrice*exp(drift) formula in the
            // worker if longTermMean is unavailable.
            if (physicsType === 'Ornstein-Uhlenbeck' && typeof liveLongTermMean === 'number') {
                physicsParams.longTermMean = liveLongTermMean;
            }

            // ── Phase C/D: short-horizon σ swap + sub-daily dt ───────────
            // Per-horizon dispatch — daily steps unless horizon is short
            // enough that intraday resolution adds value:
            //   final_steps  intradaySteps  resolution
            //   = 1          78             5-min  (1-Day mode, Phase D)
            //   2-7          2              half-day (1-Week mode, Phase C)
            //   >= 8         1              daily (unchanged)
            // Advanced mode excluded (user-controlled σ via slider).
            let intradaySteps = 1;
            let volSource = 'DAILY-RV';
            let catalystApplied = false;

            if (!isAdvancedOpen && final_steps <= 7) {
                const intradaySigma = await osirisIngestion.getIntradayVolatility(tickerSymbol);
                if (typeof intradaySigma === 'number' && intradaySigma > 0) {
                    const volRegRegime = document.getElementById('osiris-volatility-regime');
                    const volRegimeMult = volRegRegime ? parseFloat(volRegRegime.value) : 1.0;
                    final_sigma = intradaySigma * volRegimeMult;
                    intradaySteps = final_steps === 1 ? 78 : 2; // 5-min for 1-Day, half-day for 1-Week
                    volSource = 'INTRADAY-RV';
                    document.getElementById('val-volatility').innerText = final_sigma.toFixed(2);
                    console.log(`[OSIRIS] Using intraday σ (${(intradaySigma * 100).toFixed(2)}% ann) for ${tickerSymbol} · ${final_steps}d horizon · ${intradaySteps} steps/day`);
                } else {
                    console.log(`[OSIRIS] Intraday σ unavailable for ${tickerSymbol}; using daily σ`);
                }
            }

            // ── Phase D: earnings catalyst overlay ───────────────────────
            // If the next earnings date falls within the simulation horizon,
            // multiply σ by EARNINGS_VOL_MULTIPLIER. Reflects the historical
            // ~2-3× intraday vol spike on earnings days. Only applies on
            // short horizons (≤ 21 trading days ≈ 30 calendar days) — over
            // longer horizons the event-day contribution averages out.
            const EARNINGS_VOL_MULTIPLIER = 2.5;
            if (!isAdvancedOpen && final_steps <= 21) {
                try {
                    const earningsDate = await osirisIngestion.getNextEarningsDate(tickerSymbol);
                    if (earningsDate) {
                        const today = new Date();
                        const target = new Date(earningsDate + 'T00:00:00Z');
                        const horizonEnd = new Date(today.getTime() + (final_steps * 1.4) * 86400 * 1000); // 1.4 calendar days per trading day
                        if (target >= today && target <= horizonEnd) {
                            final_sigma = final_sigma * EARNINGS_VOL_MULTIPLIER;
                            catalystApplied = true;
                            document.getElementById('val-volatility').innerText = final_sigma.toFixed(2);
                            console.log(`[OSIRIS] Earnings catalyst active for ${tickerSymbol} · earnings ${earningsDate} within horizon · σ × ${EARNINGS_VOL_MULTIPLIER}`);
                        }
                    }
                } catch (e) {
                    console.warn('[OSIRIS] Earnings catalyst lookup failed:', e.message);
                }
            }

            // Surface data-source status (LIVE / CACHED / FALLBACK) next to the basis label
            const metadataReadout = document.getElementById('osiris-metadata-readout');
            if (metadataReadout) {
                const baseText = metadataReadout.dataset.baseText || metadataReadout.innerText;
                const info = osirisIngestion.getLastFetchInfo();
                const histTag = (info.history.source || 'unknown').toUpperCase();
                const macroTag = (info.macro.source || 'unknown').toUpperCase();
                const catalystTag = catalystApplied ? ' · CATALYST: EARNINGS×' + EARNINGS_VOL_MULTIPLIER : '';
                metadataReadout.innerText = `${baseText}  ·  DATA[HIST: ${histTag} ${info.history.date || '—'} · MACRO: ${macroTag} ${info.macro.date || '—'} · VOL: ${volSource}${catalystTag}]`;
            }

            const initialPrice = history.length > 0 ? history[history.length - 1].adjClose : 100.0;

            // Drift = risk-free rate − dividend yield (Phase 3 #8). Live US10Y
            // from FRED, live dividend yield from osirisIngestion. Falls back
            // to the hardcoded 4.5% only if both macro fetch and metrics fail.
            const baseDrift = (typeof macros.US10Y === 'number') ? macros.US10Y : 0.045;
            const dyAdj = (typeof tickerMeta.dividendYield === 'number') ? tickerMeta.dividendYield : 0;
            const drift = baseDrift - dyAdj;
            const volatility = final_sigma;

            // Instantiate New Worker (minified classic worker — see scripts/build.js)
            this.activeWorker = new Worker('/components/osiris/stochasticWorker.min.js');

            // Resolve path budget: HI-FI selection wins when enabled, else
            // the device-class baseline that was applied in init().
            const runPaths = this.hifi.enabled
                ? Math.min(this.hifi.paths, DEVICE_HIFI_CAP[this.deviceClass] || 0)
                : this.physicsConfig.defaultPaths;
            const useAntithetic = this.hifi.enabled;

            const hifiTag = this.hifi.enabled ? ' [HI-FI · antithetic]' : '';
            this.oracle.container.innerHTML = `> ALLOCATING ${runPaths.toLocaleString()} PATHS${hifiTag} TO COMPUTE SANDBOX... <span class="blinking-cursor">_</span>`;
            this.showHifiProgress(0);

            // Stall watchdog: terminate and surface a retryable fault if the
            // worker goes silent (no progress tick or result) for too long, so a
            // hung simulation can never leave the UI on an indefinite spinner.
            // Re-armed on every message, so a legitimately long HI-FI run that is
            // still streaming progress is never killed.
            let _osirisWatchdog = null;
            const STALL_MS = 45000;
            const clearWatchdog = () => { if (_osirisWatchdog) { clearTimeout(_osirisWatchdog); _osirisWatchdog = null; } };
            const armWatchdog = () => {
                clearWatchdog();
                _osirisWatchdog = setTimeout(() => {
                    console.error('[OSIRIS] Worker stalled (no message in ' + (STALL_MS / 1000) + 's) — terminating.');
                    if (this.activeWorker) { this.activeWorker.terminate(); this.activeWorker = null; }
                    this.hideHifiProgress();
                    this.oracle.container.innerHTML = `<span style="color: red;">> SYSTEM FAULT: SIMULATION TIMED OUT — please retry.</span>`;
                }, STALL_MS);
            };
            armWatchdog();

            this.activeWorker.onmessage = (e) => {
                if (e.data.error) {
                    clearWatchdog();
                    console.error('[OSIRIS] Worker Error:', e.data.error);
                    this.oracle.container.innerHTML = `<span style="color: red;">> SYSTEM FAULT: WORKER EXCEPTION.</span>`;
                    this.hideHifiProgress();
                    return;
                }

                // Worker streams {progress: 0..1} ticks during long HI-FI
                // runs. They're delivered before the final result message.
                if (typeof e.data.progress === 'number') {
                    armWatchdog();
                    this.showHifiProgress(e.data.progress);
                    return;
                }

                clearWatchdog();
                this.hideHifiProgress();
                const percentiles = e.data.percentiles;

                // Render Cloud
                this.canvas.renderCloud({
                    percentiles: percentiles,
                    initialPrice: initialPrice,
                    physicsType: physicsType,
                    physicsParams: physicsParams,
                    drift: drift,
                    longTermMean: physicsParams.longTermMean ?? null
                });

                // Run Oracle Synthesis
                const lastIdx = percentiles.p50.length - 1;
                this.oracle.requestSynthesis({
                    ticker: tickerSymbol,
                    currentPrice: initialPrice,
                    p50: percentiles.p50[lastIdx],
                    p05: percentiles.p05[lastIdx],
                    p95: percentiles.p95[lastIdx],
                    pAboveSpot: e.data.pAboveSpot,
                    physicsType: physicsType,
                    volatility: volatility,
                    physicsParams: physicsParams,
                    tickerMeta: tickerMeta,
                    horizonDays: final_steps
                });

                // Cleanup worker after successful completion
                this.activeWorker.terminate();
                this.activeWorker = null;
            };

            // Worker script-level errors (load failure, uncaught throw) also clear
            // the watchdog and surface a fault rather than hanging the UI.
            this.activeWorker.onerror = (err) => {
                clearWatchdog();
                console.error('[OSIRIS] Worker onerror:', err && err.message);
                if (this.activeWorker) { this.activeWorker.terminate(); this.activeWorker = null; }
                this.hideHifiProgress();
                this.oracle.container.innerHTML = `<span style="color: red;">> SYSTEM FAULT: WORKER EXCEPTION.</span>`;
            };

            // Total path length = horizon (in days) × steps-per-day. When
            // intradaySteps > 1 we get a finer-grained percentile cone for
            // short horizons (e.g. 5-day × 2 = 10-step path for 1-Week sims).
            // intradaySteps defaults to 1 in the worker, so passing it
            // explicitly here is for clarity; existing default-1 callers
            // still work unchanged.
            this.activeWorker.postMessage({
                initialPrice: initialPrice,
                drift: drift,
                volatility: volatility,
                steps: final_steps * intradaySteps,
                paths: runPaths,
                physicsType: physicsType,
                physicsParams: physicsParams,
                antithetic: useAntithetic,
                intradaySteps: intradaySteps
            });

        } catch (error) {
            console.error('[OSIRIS] Simulation Initialization Error:', error);
            this.oracle.container.innerHTML = `<span style="color: red;">> SYSTEM FAULT: DATA ACQUISITION FAILED.</span>`;
        }
    }

    // ── HI-FI controls ─────────────────────────────────────────────────
    // Session-only state (this.hifi). Persistence intentionally omitted —
    // user toggles fresh each visit so a casual click doesn't lock them
    // into long-running 250K-path simulations on every reload.
    bindHifiControls() {
        const toggle = document.getElementById('osiris-hifi-toggle');
        const pillRow = document.getElementById('osiris-hifi-pills');
        const pills = document.querySelectorAll('.hifi-pill');
        if (!toggle || !pillRow) return; // controls absent (older HTML)

        // Hide any pill whose value exceeds the device's cap. Mobile
        // hides the whole control via CSS data-device selector, but if
        // the markup ever appears, this still keeps it safe.
        const cap = DEVICE_HIFI_CAP[this.deviceClass] || 0;
        pills.forEach(pill => {
            const v = parseInt(pill.getAttribute('data-paths'), 10);
            if (v > cap) pill.style.display = 'none';
        });

        // Default selection: first available pill ≤ cap.
        const visiblePills = Array.from(pills).filter(p => p.style.display !== 'none');
        if (visiblePills.length) {
            visiblePills[0].classList.add('active');
            this.hifi.paths = parseInt(visiblePills[0].getAttribute('data-paths'), 10);
        }

        toggle.addEventListener('click', () => {
            this.hifi.enabled = !this.hifi.enabled;
            toggle.classList.toggle('active', this.hifi.enabled);
            toggle.setAttribute('aria-pressed', String(this.hifi.enabled));
            pillRow.style.display = this.hifi.enabled ? '' : 'none';
        });

        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                pills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.hifi.paths = parseInt(pill.getAttribute('data-paths'), 10);
            });
        });
    }

    showHifiProgress(frac) {
        const bar = document.getElementById('osiris-hifi-progress');
        if (!bar) return;
        const fill = bar.querySelector('.osiris-hifi-progress-fill');
        if (!fill) return;
        bar.style.display = 'block';
        fill.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
    }
    hideHifiProgress() {
        const bar = document.getElementById('osiris-hifi-progress');
        if (!bar) return;
        bar.style.display = 'none';
        const fill = bar.querySelector('.osiris-hifi-progress-fill');
        if (fill) fill.style.width = '0%';
    }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
    new OsirisOrchestrator();
});
