/**
 * SENTINEL - High-Scale Logic Engine (Re-engineered)
 * Sectored Batching | Focus Prioritization | Async Math Core
 */

const COMPANIES = [
    { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy', type: 'IG', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 125, marketBeta: 0.8, sectorBeta: 1.1, residual: 0, lastUpdated: 0 },
    { ticker: 'SHEL', name: 'Shell PLC', sector: 'Energy', type: 'IG', region: 'EU', country: 'UK', base_rate_type: 'GILT', baseSpread: 140, marketBeta: 0.9, sectorBeta: 1.2, residual: 0, lastUpdated: 0 },
    { ticker: 'CVX', name: 'Chevron Corp', sector: 'Energy', type: 'IG', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 130, marketBeta: 0.7, sectorBeta: 1.0, residual: 0, lastUpdated: 0 },
    { ticker: 'IBE.MC', name: 'Iberdrola', sector: 'Utilities', type: 'IG', region: 'EU', country: 'ES', base_rate_type: 'BUND', baseSpread: 110, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'EQNR', name: 'Equinor', sector: 'Energy', type: 'IG', region: 'EU', country: 'NO', base_rate_type: 'BUND', baseSpread: 155, marketBeta: 1.1, sectorBeta: 1.4, residual: 0, lastUpdated: 0 },
    { ticker: 'MPC', name: 'Marathon Petroleum', sector: 'Energy', type: 'HY', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 360, marketBeta: 1.3, sectorBeta: 1.6, residual: 0, lastUpdated: 0 },
    { ticker: 'LMT', name: 'Lockheed Martin', sector: 'Industrials', type: 'IG', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 145, marketBeta: 0.6, sectorBeta: 0.4, residual: 0, lastUpdated: 0 },
    { ticker: 'LDO.MI', name: 'Leonardo SpA', sector: 'Industrials', type: 'IG', region: 'EU', country: 'IT', base_rate_type: 'BUND', baseSpread: 185, marketBeta: 0.8, sectorBeta: 0.9, residual: 0, lastUpdated: 0 },
    { ticker: 'GD', name: 'General Dynamics', sector: 'Industrials', type: 'IG', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 135, marketBeta: 0.6, sectorBeta: 0.5, residual: 0, lastUpdated: 0 },
    { ticker: 'LHX', name: 'L3Harris Tech', sector: 'Industrials', type: 'IG', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 165, marketBeta: 0.8, sectorBeta: 0.6, residual: 0, lastUpdated: 0 },
    { ticker: 'NOC', name: 'Northrop Grumman', sector: 'Industrials', type: 'IG', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 140, marketBeta: 0.5, sectorBeta: 0.4, residual: 0, lastUpdated: 0 },
    { ticker: 'RTX', name: 'RTX Corp', sector: 'Industrials', type: 'IG', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 175, marketBeta: 0.9, sectorBeta: 0.7, residual: 0, lastUpdated: 0 },
    { ticker: 'RHM.DE', name: 'Rheinmetall AG', sector: 'Industrials', type: 'HY', region: 'EU', country: 'DE', base_rate_type: 'BUND', baseSpread: 380, marketBeta: 1.4, sectorBeta: 1.2, residual: 0, lastUpdated: 0 },
    { ticker: 'BA', name: 'Boeing Co', sector: 'Industrials', type: 'IG', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 210, marketBeta: 1.2, sectorBeta: 0.9, residual: 0, lastUpdated: 0 },
    { ticker: 'AIR.PA', name: 'Airbus SE', sector: 'Industrials', type: 'IG', region: 'EU', country: 'DE', base_rate_type: 'BUND', baseSpread: 150, marketBeta: 0.9, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'NGE.PA', name: 'Engie', sector: 'Utilities', type: 'IG', region: 'EU', country: 'IT', base_rate_type: 'BUND', baseSpread: 120, marketBeta: 0.6, sectorBeta: 0.9, residual: 0, lastUpdated: 0 },
    { ticker: 'ENEL.MI', name: 'Enel SpA', sector: 'Utilities', type: 'IG', region: 'EU', country: 'IT', base_rate_type: 'BUND', baseSpread: 135, marketBeta: 0.7, sectorBeta: 1.0, residual: 0, lastUpdated: 0 },
    { ticker: 'NEE', name: 'NextEra Energy', sector: 'Utilities', type: 'IG', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 115, marketBeta: 0.4, sectorBeta: 0.7, residual: 0, lastUpdated: 0 },
    { ticker: 'DUK', name: 'Duke Energy', sector: 'Utilities', type: 'IG', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 125, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0 }
];

// Configuration
const TREASURY_10Y = 4.25;
const BUND_10Y = 2.45;
const GILT_10Y = 4.15;
const BATCH_SIZE = 5;
const SLOW_REFRESH_MS = 60000;
const FAST_REFRESH_MS = 5000;

const SOVEREIGN_SPREADS = { 'US': 0, 'DE': 0, 'NO': 45, 'ES': 80, 'IT': 145, 'UK': 0 };
const SENIORITY_MULTIPLIERS = { 'Secured': 0.85, 'Unsecured': 1.0, 'Subordinated': 1.5 };

// FRED Configuration & Sovereign Registry
const FRED_SERIES = {
    UST: 'DGS10',
    BUND: 'IRLTLT01DEM156N',
    GILT: 'IRLTLT01GBM156N'
};

const SovereignRegistry = {
    UST: { value: 4.25, label: 'US Treasury (10Y)', date: 'FALLBACK' },
    BUND: { value: 2.45, label: 'German Bund (10Y)', date: 'FALLBACK' },
    GILT: { value: 4.15, label: 'UK Gilt (10Y)', date: 'FALLBACK' }
};

// Global State
let currentBetaScaling = 1.0;
let currentRateShock = 0; // in bps
let currentSovereignShock = 0; // in bps
let activeModalCompany = null;
let waterfallChart = null;
let selectedSeniority = 'Unsecured';
let selectedTenure = 10;
let currentSectorActive = 'Alpha'; 

/**
 * Helper: Identify Benchmark
 */
function getBenchmark(company) {
    if (company.base_rate_type === 'GILT') return 'Gilt';
    return company.base_rate_type === 'BUND' ? 'Bund' : 'UST';
}

/**
 * simulated Web Worker Math Core
 */
const CreditEngine = {
    async calculateCurrentSpread(company, isInstrumentMod = false) {
        return new Promise(resolve => {
            const sensitivity = company.type === 'IG' ? 0.15 : 1.2;
            const stressMultiplier = currentBetaScaling - 1.0;
            
            // Per requirement: Scale sum of market + sector beta
            const systematicBeta = (company.marketBeta + company.sectorBeta);
            const marketComp = company.marketBeta * 50 * stressMultiplier * sensitivity; 
            const sectorComp = company.sectorBeta * 30 * stressMultiplier * sensitivity;
            
            // Per requirement: Residual scales proportionally with systematic
            const residualComp = company.residual * stressMultiplier;
            
            // Tranche Sensitivity: 2.0x for Subordinated on the aggregated delta
            const isSubordinated = (isInstrumentMod && selectedSeniority === 'Subordinated');
            const subMultiplier = isSubordinated ? 2.0 : 1.0;

            const aggregatedDelta = Math.round((marketComp + sectorComp + residualComp) * subMultiplier);
            const totalSpread = Math.round(company.baseSpread + aggregatedDelta);
            
            const tenureMult = isInstrumentMod ? (1 + (selectedTenure - 10) * 0.03) : 1.0;
            const seniorityMult = (isInstrumentMod && !isSubordinated) ? SENIORITY_MULTIPLIERS[selectedSeniority] : 1.0;

            resolve(Math.round(totalSpread * seniorityMult * tenureMult));
        });
    },

    getBaseRate(company) {
        const anchor = SovereignRegistry[company.base_rate_type] || SovereignRegistry['UST'];
        return anchor.value + (currentRateShock / 100);
    },

    calculateYield(company, spreadBps) {
        const baseRate = this.getBaseRate(company);
        const sovSpread = (SOVEREIGN_SPREADS[company.country] || 0) + currentSovereignShock;
        return (baseRate + (sovSpread / 100) + (spreadBps / 100)).toFixed(2);
    }
};

/**
 * FRED API Live Sync
 */
async function fetchSovereignAnchors() {
    const indicator = document.getElementById('fred-indicator');
    console.log('Initiating FRED Live Sync...');
    
    let synchronizedCount = 0;
    let latestDate = null;
    let lastErr = null;

    for (const [type, seriesId] of Object.entries(FRED_SERIES)) {
        try {
            const response = await fetch(`/api/fred-proxy?series_id=${seriesId}`);
            if (!response.ok) {
                lastErr = response.status;
                throw new Error(`Proxy error: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.value && !isNaN(data.value)) {
                SovereignRegistry[type].value = data.value;
                SovereignRegistry[type].date = data.date;
                latestDate = data.date;
                synchronizedCount++;
                console.log(`Synced ${type}: ${data.value}% (v. ${data.date})`);
            }
        } catch (error) {
            console.warn(`FRED Sync failed for ${type}.`, error);
        }
    }

    if (synchronizedCount > 0) {
        COMPANIES.forEach(c => c.residual = 0);
        if (indicator) {
            indicator.innerText = `Sovereign Anchors: FRED Live (v. ${latestDate})`;
            indicator.classList.remove('text-gray-500');
            indicator.classList.add('text-neon-green');
        }
        triggerGlobalRefresh();
    } else {
        if (indicator) indicator.innerText = `Sovereign Anchors: System Fallback (Offline${lastErr ? ':' + lastErr : ''})`;
    }
}

/**
 * Initialization
 */
function init() {
    setupEventListeners();
    renderGrid(); // Render instantly with fallbacks
    startHighScaleEngine();
    
    // Poll FRED in background
    fetchSovereignAnchors(); 
    
    // Refresh every 24 hours
    setInterval(fetchSovereignAnchors, 24 * 60 * 60 * 1000);
}

function setupEventListeners() {
    // Credit Beta Slider
    document.getElementById('beta-slider').addEventListener('input', (e) => {
        currentBetaScaling = parseFloat(e.target.value);
        document.getElementById('beta-value').innerText = `${currentBetaScaling.toFixed(1)}x`;
        triggerGlobalRefresh();
    });

    // Global Rate Slider
    document.getElementById('rate-slider').addEventListener('input', (e) => {
        currentRateShock = parseInt(e.target.value);
        document.getElementById('rate-value').innerText = `+${currentRateShock} bps`;
        triggerGlobalRefresh();
    });

    // Black Swan Trigger
    document.getElementById('black-swan-btn').addEventListener('click', function() {
        const betaSlider = document.getElementById('beta-slider');
        const rateSlider = document.getElementById('rate-slider');
        
        currentBetaScaling = 2.5;
        currentRateShock = 100;
        currentSovereignShock = 50;

        betaSlider.value = 2.5;
        rateSlider.value = 100;
        
        document.getElementById('beta-value').innerText = "2.5x";
        document.getElementById('rate-value').innerText = "+100 bps";

        // Global UI Alert
        document.querySelector('header h1').classList.add('systemic-glitch');
        document.body.classList.add('contagion-alert');
        
        setTimeout(() => {
            document.querySelector('header h1').classList.remove('systemic-glitch');
            // Keep body alert active until reset (or just for a while)
        }, 3000);

        triggerGlobalRefresh();
    });

    document.getElementById('company-search').addEventListener('input', (e) => {
        renderGrid(e.target.value);
    });

    const tenureSlider = document.getElementById('tenure-slider');
    if (tenureSlider) {
        tenureSlider.addEventListener('input', (e) => {
            selectedTenure = parseInt(e.target.value);
            document.getElementById('tenure-val').innerText = selectedTenure + "Y";
            updateModal();
        });
    }
}

/**
 * Grid Rendering (Sectored)
 */
function renderGrid(filterText = '') {
    const alphaGrid = document.getElementById('sector-alpha-grid');
    const betaGrid = document.getElementById('sector-beta-grid');
    alphaGrid.innerHTML = '';
    betaGrid.innerHTML = '';

    const searchTerm = filterText.toLowerCase().trim();
    const filtered = COMPANIES.filter(c => c.name.toLowerCase().includes(searchTerm) || c.ticker.toLowerCase().includes(searchTerm));

    filtered.forEach(company => {
        const isAlpha = (company.sector === 'Energy' || company.sector === 'Utilities');
        const container = isAlpha ? alphaGrid : betaGrid;
        
        const card = createCard(company);
        container.appendChild(card);
        updateCardData(company.ticker);
    });
}

function createCard(company) {
    const card = document.createElement('div');
    card.className = 'bg-card-bg neon-border rounded-lg p-5 cursor-pointer flex flex-col transition-all group animate-in fade-in duration-300';
    card.id = `card-${company.ticker}`;
    card.setAttribute('onclick', `openModal('${company.ticker}')`);
    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div>
                <h3 class="font-black text-xl tracking-tight">${company.ticker}</h3>
                <p class="text-[10px] text-gray-500 uppercase tracking-widest">${company.name}</p>
            </div>
            <div class="text-right">
                <span class="text-[10px] bg-neon-green/10 text-neon-green px-2 py-0.5 rounded border border-neon-green/20 font-mono tracking-tighter">${company.type}</span>
                <p class="text-[10px] text-gray-600 mt-1 font-mono uppercase tracking-widest update-time">00:00:00</p>
                <div class="mt-1">
                    <span class="text-[8px] bg-amber-500/10 text-amber-500 px-1 rounded border border-amber-500/20 font-mono hidden benchmark-badge">--</span>
                </div>
            </div>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
                <span class="text-[9px] text-gray-500 uppercase font-bold tracking-widest block mb-1">Spread</span>
                <span class="text-lg font-mono text-neon-green glow-text spread-val">-- bps</span>
            </div>
            <div>
                <span class="text-[9px] text-gray-500 uppercase font-bold tracking-widest block mb-1">Risk Lvl</span>
                <span class="text-sm font-bold risk-val">--</span>
            </div>
        </div>
        
        <!-- Mini Risk Graph (Green Final Spread Bar) -->
        <div class="mb-6">
            <div class="flex justify-between items-center mb-1">
                <span class="text-[8px] text-gray-600 uppercase tracking-widest">Risk Exposure</span>
                <span class="text-[8px] text-neon-green font-mono percentage-val">0%</span>
            </div>
            <div class="h-1.5 w-full bg-gray-900/50 rounded-full overflow-hidden border border-white/5">
                <div class="h-full bg-gradient-to-r from-neon-green/40 to-neon-green shadow-[0_0_8px_#39FF14] transition-all duration-1000 ease-out risk-bar-fill" style="width: 0%"></div>
            </div>
        </div>

        <div class="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
            <span class="text-[9px] text-gray-600 uppercase font-mono tracking-widest">Yield Stack</span>
            <span class="text-[9px] text-gray-400 font-mono yield-val">--% Yield</span>
        </div>
    `;
    return card;
}

async function updateCardData(ticker) {
    const company = COMPANIES.find(c => c.ticker === ticker);
    const card = document.getElementById(`card-${ticker}`);
    if (!card) return;

    const spread = await CreditEngine.calculateCurrentSpread(company);
    const yieldVal = CreditEngine.calculateYield(company, spread);
    const delta = spread - company.baseSpread;

    const spreadVal = card.querySelector('.spread-val');
    const yieldEl = card.querySelector('.yield-val');
    const riskVal = card.querySelector('.risk-val');
    const updateTime = card.querySelector('.update-time');

    if (spreadVal) spreadVal.innerText = `${spread} bps`;
    if (yieldEl) yieldEl.innerText = `${yieldVal}% Yield`;
    if (riskVal) {
        riskVal.innerText = getRiskLevel(spread);
        riskVal.className = `text-sm font-bold risk-val ${getRiskColor(spread)}`;
    }
    if (updateTime) {
        updateTime.innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    }

    // Benchmark Badge
    const benchmarkBadge = card.querySelector('.benchmark-badge');
    if (benchmarkBadge) {
        if (delta !== 0) {
            benchmarkBadge.innerText = `+${delta} bps (v. ${getBenchmark(company)})`;
            benchmarkBadge.classList.remove('hidden');
        } else {
            benchmarkBadge.classList.add('hidden');
        }
    }

    // Validation Logic (Critical Risk)
    if (delta > 250) {
        card.classList.add('critical-risk');
    } else {
        card.classList.remove('critical-risk');
    }

    // Update Mini Risk Bar (Max scale 1000 bps)
    const riskPercentage = Math.min(Math.round((spread / 1000) * 100), 100);
    const barFill = card.querySelector('.risk-bar-fill');
    const percentDisp = card.querySelector('.percentage-val');
    
    if (barFill) barFill.style.width = `${riskPercentage}%`;
    if (percentDisp) percentDisp.innerText = `${riskPercentage}%`;
}

/**
 * High-Scale Engine (Dual-Frequency)
 */
function startHighScaleEngine() {
    // 1. Alternating Sector Batches (Every 5s)
    setInterval(cycleSectorBatch, FAST_REFRESH_MS);

    // 2. Focus Priority (Every 5s)
    setInterval(refreshFocus, FAST_REFRESH_MS);

    // 3. Background Throttling (Continuous background check)
    setInterval(throttleBackground, 1000); 
}

let sectorAlphaPointer = 0;
let sectorBetaPointer = 0;

async function cycleSectorBatch() {
    const activeProgress = document.getElementById(`${currentSectorActive.toLowerCase()}-progress`);
    const otherProgress = document.getElementById(`${currentSectorActive === 'Alpha' ? 'beta' : 'alpha'}-progress`);

    // UI Progress Bar Reset/Start
    if (activeProgress) {
        activeProgress.style.transition = 'none';
        activeProgress.style.width = '0%';
        setTimeout(() => {
            activeProgress.style.transition = 'width 5000ms linear';
            activeProgress.style.width = '100%';
        }, 50);
    }
    if (otherProgress) otherProgress.style.width = '0%';

    // Batch Update
    const sectorTags = currentSectorActive === 'Alpha' ? ['Energy', 'Utilities'] : ['Industrials'];
    const sectorFleet = COMPANIES.filter(c => sectorTags.includes(c.sector));
    
    // Rotate pointer to get next batch
    let pointer = currentSectorActive === 'Alpha' ? sectorAlphaPointer : sectorBetaPointer;
    const batch = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
        batch.push(sectorFleet[(pointer + i) % sectorFleet.length]);
    }

    // Apply Update
    for (const c of batch) {
        if (!c) continue;
        c.residual += (Math.random() * 4 - 2);
        await updateCardData(c.ticker);
        c.lastUpdated = Date.now();
        
        // Brief visual pulse on the card itself
        const card = document.getElementById(`card-${c.ticker}`);
        if (card) {
            card.classList.add('border-neon-green/40');
            setTimeout(() => card.classList.remove('border-neon-green/40'), 1000);
        }
    }

    // Update pointer for next time
    if (currentSectorActive === 'Alpha') sectorAlphaPointer = (sectorAlphaPointer + BATCH_SIZE) % sectorFleet.length;
    else sectorBetaPointer = (sectorBetaPointer + BATCH_SIZE) % sectorFleet.length;

    // Toggle sector
    currentSectorActive = currentSectorActive === 'Alpha' ? 'Beta' : 'Alpha';
    scanForContagion();
}

async function refreshFocus() {
    if (activeModalCompany) {
        activeModalCompany.residual += (Math.random() * 2 - 1);
        await updateCardData(activeModalCompany.ticker);
        updateModal();
        activeModalCompany.lastUpdated = Date.now();
    }
}

async function throttleBackground() {
    const now = Date.now();
    for (const c of COMPANIES) {
        try {
            // If ticker is not active modal and hasn't been updated in 60s
            if ((!activeModalCompany || activeModalCompany.ticker !== c.ticker) && (now - c.lastUpdated > SLOW_REFRESH_MS)) {
                await updateCardData(c.ticker);
                c.lastUpdated = now;
            }
        } catch (err) {
            console.error(`Sentinel Engine Handled localized error for ${c.ticker}:`, err);
            continue; // Ensure fleet update continues
        }
    }
}

function triggerGlobalRefresh() {
    COMPANIES.forEach(c => updateCardData(c.ticker));
    if (activeModalCompany) updateModal();
    scanForContagion();
}

/**
 * Risks & Modals (Standard logic retained/optimized)
 */
async function scanForContagion() {
    let active = false;
    for (const c of COMPANIES) {
        const actualBaseSpread = await CreditEngine.calculateCurrentSpread(c, false);
        if (actualBaseSpread * SENIORITY_MULTIPLIERS['Subordinated'] > 1000) active = true;
    }

    if (active) document.body.classList.add('contagion-alert');
    else document.body.classList.remove('contagion-alert');
}

function getRiskLevel(spread) {
    if (spread < 150) return 'NOMINAL';
    if (spread < 250) return 'CAUTION';
    if (spread < 400) return 'ELEVATED';
    return 'CRITICAL';
}

function getRiskColor(spread) {
    if (spread < 150) return 'text-neon-green';
    if (spread < 250) return 'text-yellow-400';
    if (spread < 400) return 'text-orange-500';
    return 'text-red-500 glow-text';
}

function openModal(ticker) {
    const company = COMPANIES.find(c => c.ticker === ticker);
    activeModalCompany = company;
    document.getElementById('modal-title').innerText = company.ticker + " | " + company.name;
    document.getElementById('modal-sector').innerText = company.sector + " // " + company.type;
    document.getElementById('focus-modal').classList.remove('hidden');
    document.getElementById('focus-modal').classList.add('flex');
    updateModal();
}

function closeModal() {
    document.getElementById('focus-modal').classList.add('hidden');
    document.getElementById('focus-modal').classList.remove('flex');
    activeModalCompany = null;
}

async function updateModal() {
    if (!activeModalCompany) return;
    const instrumentSpread = await CreditEngine.calculateCurrentSpread(activeModalCompany, true);
    const totalYield = CreditEngine.calculateYield(activeModalCompany, instrumentSpread);
    const delta = instrumentSpread - activeModalCompany.baseSpread;
    
    const benchmark = getBenchmark(activeModalCompany);
    document.getElementById('modal-benchmark-label').innerText = `Base ${benchmark} (10Y)`;
    document.getElementById('modal-benchmark-val').innerText = CreditEngine.getBaseRate(activeModalCompany).toFixed(2) + "%";
    document.getElementById('modal-spread').innerText = instrumentSpread + " bps";
    document.getElementById('modal-yield').innerText = totalYield + "%";
    
    // Requirement: Simulated [Benchmark] Spread Delta
    const deltaLabel = document.getElementById('modal-norm-diff');
    deltaLabel.innerText = (delta > 0 ? "+" : "") + delta + " bps";
    document.getElementById('modal-dominant-beta').innerText = `SIMULATED ${benchmark.toUpperCase()} SPREAD DELTA`;

    // Critical Risk Validation on Modal
    const modalContent = document.querySelector('#focus-modal > div');
    if (delta > 250) {
        modalContent.classList.add('critical-risk');
    } else {
        modalContent.classList.remove('critical-risk');
    }

    // Perspective logic
    let perspective = activeModalCompany.type === 'IG' 
        ? `Regression analysis for ${activeModalCompany.ticker} confirms yield volatility is primarily ${benchmark}-driven.`
        : `Credit-intensive profiling identifies ${activeModalCompany.ticker} as highly sensitive to Spread Widening.`;

    if (selectedSeniority === 'Subordinated') perspective += ` <br><span class="text-orange-400 font-bold">SUBORDINATION ALERT:</span> tranche risk increased per recovery expectations.`;
    if (selectedTenure > 15) perspective += ` <br><span class="text-neon-green font-bold">DURATION SENSITIVITY:</span>convexity risk significantly elevated at ${selectedTenure}Y.`;
    
    document.getElementById('modal-perspective').innerHTML = perspective;
    renderWaterfall(activeModalCompany);
}

// Waterfall rendering (retained/stable)
function renderWaterfall(company) {
    const ctx = document.getElementById('waterfall-chart').getContext('2d');
    const sensitivity = company.type === 'IG' ? 0.15 : 1.2;
    const stressFactor = currentBetaScaling - 1.0;
    const isSubordinated = selectedSeniority === 'Subordinated';
    const subMultiplier = isSubordinated ? 2.0 : 1.0;

    // Decompositions with 2x aggregated sensitivity for Subordinated
    const marketComp = Math.round(company.marketBeta * 50 * stressFactor * sensitivity * subMultiplier);
    const sectorComp = Math.round(company.sectorBeta * 30 * stressFactor * sensitivity * subMultiplier);
    const residual = Math.round(company.residual * stressFactor * subMultiplier);
    
    const seniorityMult = isSubordinated ? 1.0 : SENIORITY_MULTIPLIERS[selectedSeniority]; 
    const tenureFactor = (selectedTenure - 10) * 0.03;
    
    const sovSpread = (SOVEREIGN_SPREADS[company.country] || 0) + currentSovereignShock;
    const baseEnd = company.baseSpread;

    if (waterfallChart) waterfallChart.destroy();

    // Use labels consistent with CreditEngine math
    let labels = ['Base'];
    let dataPoints = [[0, baseEnd]];
    let currentTotal = baseEnd;

    if (sovSpread > 0) {
        labels.push('Sovereign Delta');
        dataPoints.push([currentTotal, currentTotal + sovSpread]);
        currentTotal += sovSpread;
    }

    labels.push('Market Beta', 'Sector Beta', 'Residual');
    dataPoints.push([currentTotal, currentTotal + marketComp]);
    currentTotal += marketComp;
    dataPoints.push([currentTotal, currentTotal + sectorComp]);
    currentTotal += sectorComp;
    dataPoints.push([currentTotal, currentTotal + residual]);
    currentTotal += residual;

    const preInstrumentTotal = currentTotal;
    const seniorityImpact = Math.round(preInstrumentTotal * (seniorityMult - 1));
    labels.push('Seniority Delta');
    dataPoints.push([currentTotal, currentTotal + seniorityImpact]);
    currentTotal += seniorityImpact;

    const tenureImpact = Math.round(preInstrumentTotal * seniorityMult * tenureFactor);
    labels.push('Duration Beta');
    dataPoints.push([currentTotal, currentTotal + tenureImpact]);
    currentTotal += tenureImpact;

    labels.push('Final Spread');
    dataPoints.push([0, currentTotal]);

    // Define colors relative to labels
    const colorMap = {
        'Base': 'rgba(255, 255, 255, 0.2)',
        'Sovereign Delta': 'rgba(255, 255, 255, 0.4)',
        'Market Beta': 'rgba(57, 255, 20, 0.6)',
        'Sector Beta': 'rgba(57, 255, 20, 0.4)',
        'Residual': 'rgba(255, 255, 255, 0.1)',
        'Seniority Delta': 'rgba(255, 100, 0, 0.6)',
        'Duration Beta': 'rgba(0, 150, 255, 0.6)',
        'Final Spread': 'rgba(57, 255, 20, 1)'
    };

    const backgroundColors = labels.map(l => colorMap[l]);

    waterfallChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Basis Points',
                data: dataPoints,
                backgroundColor: backgroundColors,
                borderColor: '#39FF14',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { family: 'JetBrains Mono', size: 10 } } },
                y: { grid: { display: false }, ticks: { color: 'white', font: { family: 'JetBrains Mono', weight: 'bold', size: 11 } } }
            }
        }
    });
}

function setSeniority(level) {
    selectedSeniority = level;
    document.querySelectorAll('.seniority-btn').forEach(btn => {
        btn.classList.remove('border-neon-green/50', 'bg-neon-green/10', 'text-neon-green');
        btn.classList.add('border-white/10');
    });
    const activeBtn = document.getElementById(`btn-${level}`);
    if (activeBtn) {
        activeBtn.classList.remove('border-white/10');
        activeBtn.classList.add('border-neon-green/50', 'bg-neon-green/10', 'text-neon-green');
    }
    updateModal();
}

// Start
init();
