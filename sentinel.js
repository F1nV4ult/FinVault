/**
 * SENTINEL - Beta-Analysis & Credit Monitor Logic
 */

const COMPANIES = [
    { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy', type: 'IG', region: 'US', country: 'US', baseSpread: 125, yield: 3.2, marketBeta: 0.8, sectorBeta: 1.1, residual: 0 },
    { ticker: 'SHEL', name: 'Shell PLC', sector: 'Energy', type: 'IG', region: 'EU', country: 'UK', baseSpread: 140, yield: 3.5, marketBeta: 0.9, sectorBeta: 1.2, residual: 0 },
    { ticker: 'CVX', name: 'Chevron Corp', sector: 'Energy', type: 'IG', region: 'US', country: 'US', baseSpread: 130, yield: 3.8, marketBeta: 0.7, sectorBeta: 1.0, residual: 0 },
    { ticker: 'IBE.MC', name: 'Iberdrola', sector: 'Utilities', type: 'IG', region: 'EU', country: 'ES', baseSpread: 110, yield: 2.9, marketBeta: 0.5, sectorBeta: 0.8, residual: 0 },
    { ticker: 'EQNR', name: 'Equinor', sector: 'Energy', type: 'IG', region: 'EU', country: 'NO', baseSpread: 155, yield: 4.1, marketBeta: 1.1, sectorBeta: 1.4, residual: 0 },
    { ticker: 'MPC', name: 'Marathon Petroleum', sector: 'Energy', type: 'HY', region: 'US', country: 'US', baseSpread: 360, yield: 5.2, marketBeta: 1.3, sectorBeta: 1.6, residual: 0 },
    { ticker: 'LMT', name: 'Lockheed Martin', sector: 'Industrials', type: 'IG', region: 'US', country: 'US', baseSpread: 145, yield: 2.4, marketBeta: 0.6, sectorBeta: 0.4, residual: 0 },
    { ticker: 'LDO.MI', name: 'Leonardo SpA', sector: 'Industrials', type: 'IG', region: 'EU', country: 'IT', baseSpread: 185, yield: 3.4, marketBeta: 0.8, sectorBeta: 0.9, residual: 0 },
    { ticker: 'GD', name: 'General Dynamics', sector: 'Industrials', type: 'IG', region: 'US', country: 'US', baseSpread: 135, yield: 2.2, marketBeta: 0.6, sectorBeta: 0.5, residual: 0 },
    { ticker: 'LHX', name: 'L3Harris Tech', sector: 'Industrials', type: 'IG', region: 'US', country: 'US', baseSpread: 165, yield: 2.8, marketBeta: 0.8, sectorBeta: 0.6, residual: 0 },
    { ticker: 'NOC', name: 'Northrop Grumman', sector: 'Industrials', type: 'IG', region: 'US', country: 'US', baseSpread: 140, yield: 2.1, marketBeta: 0.5, sectorBeta: 0.4, residual: 0 },
    { ticker: 'RTX', name: 'RTX Corp', sector: 'Industrials', type: 'IG', region: 'US', country: 'US', baseSpread: 175, yield: 3.1, marketBeta: 0.9, sectorBeta: 0.7, residual: 0 },
    { ticker: 'RHM.DE', name: 'Rheinmetall AG', sector: 'Industrials', type: 'HY', region: 'EU', country: 'DE', baseSpread: 380, yield: 4.5, marketBeta: 1.4, sectorBeta: 1.2, residual: 0 }
];

const TREASURY_10Y = 4.25;
const BUND_10Y = 2.45;
const GILT_10Y = 4.15;

const SOVEREIGN_SPREADS = {
    'US': 0,
    'DE': 0,
    'NO': 45,
    'ES': 80,
    'IT': 145,
    'UK': 0
};

const SENIORITY_MULTIPLIERS = {
    'Secured': 0.85,
    'Unsecured': 1.0,
    'Subordinated': 1.5
};

let currentBetaScaling = 1.0;
let historyData = {}; // Stores historical spreads for sparklines
let activeModalCompany = null;
let waterfallChart = null;

let selectedSeniority = 'Unsecured';
let selectedTenure = 10;
let isContagionActive = false;

// Initialize history
COMPANIES.forEach(c => {
    historyData[c.ticker] = Array.from({length: 12}, () => c.baseSpread + (Math.random() * 20 - 10));
});

function init() {
    renderGrid();
    setupEventListeners();
    startPolling();
}

function setupEventListeners() {
    const slider = document.getElementById('beta-slider');
    const betaValueDisp = document.getElementById('beta-value');
    const shockBtn = document.getElementById('shock-btn');

    slider.addEventListener('input', (e) => {
        currentBetaScaling = parseFloat(e.target.value);
        betaValueDisp.innerText = currentBetaScaling.toFixed(1);
        updateAllCards();
        if (activeModalCompany) updateModal();
    });

    shockBtn.addEventListener('click', () => {
        slider.value = 2.5;
        currentBetaScaling = 2.5;
        betaValueDisp.innerText = "2.5";
        updateAllCards();
        if (activeModalCompany) updateModal();
    });

    const searchInput = document.getElementById('company-search');
    searchInput.addEventListener('input', (e) => {
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

function setSeniority(level) {
    selectedSeniority = level;
    document.querySelectorAll('.seniority-btn').forEach(btn => {
        btn.classList.remove('border-neon-green/50', 'bg-neon-green/10', 'text-neon-green');
        btn.classList.add('border-white/10');
    });
    const activeBtn = document.getElementById(`btn-${level}`);
    activeBtn.classList.remove('border-white/10');
    activeBtn.classList.add('border-neon-green/50', 'bg-neon-green/10', 'text-neon-green');
    updateModal();
}

function calculateCurrentSpread(company, isInstrumentMod = false) {
    const sensitivity = company.type === 'IG' ? 0.15 : 1.2;
    const stressFactor = currentBetaScaling - 1.0;
    
    // Normalization logic vs Instrument Logic
    const seniorityMult = isInstrumentMod ? SENIORITY_MULTIPLIERS[selectedSeniority] : 1.0;
    const tenureMult = isInstrumentMod ? (1 + (selectedTenure - 10) * 0.03) : 1.0;

    const marketComponent = company.marketBeta * 50 * stressFactor * sensitivity; 
    const sectorComponent = company.sectorBeta * 30 * stressFactor * sensitivity;
    
    let totalSpread = Math.round(company.baseSpread + marketComponent + sectorComponent + company.residual);
    
    return Math.round(totalSpread * seniorityMult * tenureMult);
}

function getBaseRate(company) {
    if (company.country === 'UK') return GILT_10Y;
    return company.region === 'EU' ? BUND_10Y : TREASURY_10Y;
}

function calculateYield(company, spreadBps) {
    const baseRate = getBaseRate(company);
    const sovSpread = SOVEREIGN_SPREADS[company.country] || 0;
    return (baseRate + (sovSpread / 100) + (spreadBps / 100)).toFixed(2);
}

function scanForContagion() {
    let active = false;
    COMPANIES.forEach(c => {
        // Calculate spread for Subordinated version of all companies to check triggers
        const subSpread = calculateCurrentSpread(c, true); 
        // Force mock subordinated context for the scanner
        const mockSubMultiplier = SENIORITY_MULTIPLIERS['Subordinated'];
        const actualBaseSpread = calculateCurrentSpread(c, false);
        if (actualBaseSpread * mockSubMultiplier > 1000) active = true;
    });

    isContagionActive = active;
    const dashboard = document.getElementById('dashboard-grid');
    if (active) {
        document.body.classList.add('contagion-alert');
    } else {
        document.body.classList.remove('contagion-alert');
    }
}

function renderGrid(filterText = '') {
    const grid = document.getElementById('dashboard-grid');
    grid.innerHTML = '';
    
    scanForContagion();

    const searchTerm = filterText.toLowerCase().trim();
    const filteredCompanies = COMPANIES.filter(c => 
        c.name.toLowerCase().includes(searchTerm) || 
        c.ticker.toLowerCase().includes(searchTerm)
    );

    if (filteredCompanies.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-20 flex flex-col items-center justify-center opacity-50 border border-dashed border-gray-800 rounded-xl">
                <div class="text-neon-green font-mono mb-2 text-lg">> NO SEARCH RESULTS FOUND</div>
                <div class="text-[10px] text-gray-600 uppercase tracking-widest">Attempt alternate ticker or company name</div>
            </div>
        `;
        return;
    }

    filteredCompanies.forEach((company, index) => {
        const currentSpread = calculateCurrentSpread(company);
        const card = document.createElement('div');
        card.className = 'bg-card-bg neon-border rounded-lg p-5 cursor-pointer flex flex-col transition-all group animate-in fade-in slide-in-from-bottom-2 duration-300';
        card.id = `card-${company.ticker}`;
        card.setAttribute('onclick', `openModal('${company.ticker}')`);
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="font-black text-xl tracking-tight">${company.ticker}</h3>
                    <p class="text-[10px] text-gray-500 uppercase tracking-widest">${company.name}</p>
                </div>
                <div class="text-right">
                    <span class="text-[10px] bg-neon-green/10 text-neon-green px-2 py-0.5 rounded border border-neon-green/20 font-mono tracking-tighter">
                        ${company.type}
                    </span>
                    <p class="text-[10px] text-gray-600 mt-1 font-mono uppercase tracking-widest">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <span class="text-[9px] text-gray-500 uppercase font-bold tracking-widest block mb-1">Spread</span>
                    <span class="text-lg font-mono text-neon-green glow-text" id="spread-${company.ticker}">${currentSpread} bps</span>
                </div>
                <div>
                    <span class="text-[9px] text-gray-500 uppercase font-bold tracking-widest block mb-1">Risk Lvl</span>
                    <span class="text-sm font-bold ${getRiskColor(currentSpread)}" id="risk-${company.ticker}">${getRiskLevel(currentSpread)}</span>
                </div>
            </div>

            <div class="mt-auto pt-4 border-t border-gray-900">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-[9px] text-gray-600 uppercase font-mono tracking-widest">Sentinel G-Spread / Yield Stack</span>
                    <span class="text-[9px] text-gray-400 font-mono" id="yield-${company.ticker}">${calculateYield(company, currentSpread)}% Yield</span>
                </div>
                <div class="h-12 w-full">
                    <canvas id="sparkline-${company.ticker}"></canvas>
                </div>
            </div>
        `;
        grid.appendChild(card);
        setTimeout(() => initSparkline(company.ticker), 0);
    });
}

function updateAllCards() {
    COMPANIES.forEach(company => {
        const spreadDisp = document.getElementById(`spread-${company.ticker}`);
        const riskDisp = document.getElementById(`risk-${company.ticker}`);
        const yieldDisp = document.getElementById(`yield-${company.ticker}`);
        const currentSpread = calculateCurrentSpread(company);
        
        if (spreadDisp) spreadDisp.innerText = `${currentSpread} bps`;
        if (riskDisp) {
            riskDisp.innerText = getRiskLevel(currentSpread);
            riskDisp.className = `text-sm font-bold ${getRiskColor(currentSpread)}`;
        }
        if (yieldDisp) {
            yieldDisp.innerText = `${calculateYield(company, currentSpread)}% Yield`;
        }
    });
}

function initSparkline(ticker) {
    const ctx = document.getElementById(`sparkline-${ticker}`).getContext('2d');
    const company = COMPANIES.find(c => c.ticker === ticker);
    const baseRate = getBaseRate(company);
    
    const yieldHistory = historyData[ticker].map(s => baseRate + s / 100);
    const treasuryHistory = Array(12).fill(baseRate);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(12).fill(''),
            datasets: [
                {
                    data: yieldHistory,
                    borderColor: '#39FF14',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.4
                },
                {
                    data: treasuryHistory,
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderWidth: 1,
                    borderDash: [2, 4],
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } },
            responsive: true,
            maintainAspectRatio: false
        }
    });
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

// Polling Simulator (Round-Robin)
let pollIndex = 0;
function startPolling() {
    setInterval(() => {
        const company = COMPANIES[pollIndex];
        const card = document.getElementById(`card-${company.ticker}`);
        if (card) {
            // Visual feedback of update
            card.classList.add('border-white/50');
            setTimeout(() => card.classList.remove('border-white/50'), 1000);
            
            // Update timestamp
            const timeDisp = card.querySelector('p.text-gray-600');
            if (timeDisp) {
                timeDisp.innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
            }

            // Random flux
            company.residual += (Math.random() * 4 - 2);
            updateAllCards();
        }
        pollIndex = (pollIndex + 1) % COMPANIES.length;
    }, 3000);
}

// Modal Logic
function openModal(ticker) {
    const company = COMPANIES.find(c => c.ticker === ticker);
    activeModalCompany = company;
    
    document.getElementById('modal-title').innerText = company.ticker + " | " + company.name;
    document.getElementById('modal-sector').innerText = company.sector + " // " + company.type;
    
    document.getElementById('focus-modal').classList.remove('hidden');
    document.getElementById('focus-modal').classList.add('flex');
    
    updateModal();
    renderWaterfall(company);
}

function closeModal() {
    document.getElementById('focus-modal').classList.add('hidden');
    document.getElementById('focus-modal').classList.remove('flex');
    activeModalCompany = null;
}

function updateModal() {
    if (!activeModalCompany) return;
    const instrumentSpread = calculateCurrentSpread(activeModalCompany, true);
    const normalizedSpread = calculateCurrentSpread(activeModalCompany, false);
    const totalYield = calculateYield(activeModalCompany, instrumentSpread);
    
    let benchmarkName = 'Base Treasury (10Y)';
    if (activeModalCompany.country === 'UK') benchmarkName = 'Base Gilt (10Y)';
    else if (activeModalCompany.region === 'EU') benchmarkName = 'Base Bund (10Y)';
    document.getElementById('modal-benchmark-label').innerText = benchmarkName;
    document.getElementById('modal-benchmark-val').innerText = getBaseRate(activeModalCompany).toFixed(2) + "%";
    
    document.getElementById('modal-spread').innerText = instrumentSpread + " bps";
    document.getElementById('modal-yield').innerText = totalYield + "%";
    
    const normDiff = instrumentSpread - normalizedSpread;
    document.getElementById('modal-norm-diff').innerText = (normDiff > 0 ? "+" : "") + normDiff + " bps";
    
    const dominance = activeModalCompany.type === 'IG' ? 'TREASURY' : 'CREDIT SPREAD';
    document.getElementById('modal-dominant-beta').innerText = dominance;

    // Dynamic Analyst Perspective
    let perspective = activeModalCompany.type === 'IG' 
        ? `Regression analysis confirms that for IG firms like ${activeModalCompany.ticker}, yield volatility is primarily dictated by the **Treasury Base**.`
        : `Credit-intensive profiling identifies ${activeModalCompany.ticker} as highly sensitive to **Spread Widening**.`;

    if (selectedSeniority === 'Subordinated') {
        perspective += ` <br><span class="text-orange-400 font-bold">STRUCTURAL SUBORDINATION ALERT:</span> Recovery expectations are significantly impaired in this tranche, justifying the ${SENIORITY_MULTIPLIERS['Subordinated']}x risk multiplier.`;
    }

    if (selectedTenure < 3) {
        perspective += ` <br><span class="text-yellow-400 font-bold">LIQUIDITY OVERLAY:</span> Short-dated tenure shifts risk focus to immediate rollover and cash-flow liquidity.`;
    } else if (selectedTenure > 15) {
        perspective += ` <br><span class="text-neon-green font-bold">DURATION SENSITIVITY:</span> Back-ended maturity introduces significant interest rate beta (convexity risk).`;
    }
    
    document.getElementById('modal-perspective').innerHTML = perspective;

    if (waterfallChart) {
        renderWaterfall(activeModalCompany);
    }
}

function renderWaterfall(company) {
    const ctx = document.getElementById('waterfall-chart').getContext('2d');
    
    const sensitivity = company.type === 'IG' ? 0.15 : 1.2;
    const stressFactor = currentBetaScaling - 1.0;
    
    // Core decomposition
    const marketComp = Math.round(company.marketBeta * 50 * stressFactor * sensitivity);
    const sectorComp = Math.round(company.sectorBeta * 30 * stressFactor * sensitivity);
    const residual = Math.round(company.residual);
    
    // Dual Layer Logic
    const seniorityMult = SENIORITY_MULTIPLIERS[selectedSeniority];
    const tenureFactor = (selectedTenure - 10) * 0.03;
    
    const normalizedTotal = company.baseSpread + marketComp + sectorComp + residual;
    
    // Attribution Bars
    const baseEnd = company.baseSpread;
    const marketEnd = baseEnd + marketComp;
    const sectorEnd = marketEnd + sectorComp;
    const residualEnd = sectorEnd + residual;
    
    // Layer 2 Additions
    const seniorityImpact = Math.round(normalizedTotal * (seniorityMult - 1));
    const seniorityEnd = residualEnd + seniorityImpact;
    
    const tenureImpact = Math.round(normalizedTotal * seniorityMult * tenureFactor);
    const finalEnd = seniorityEnd + tenureImpact;

    // EU Sovereign Delta
    const sovSpread = SOVEREIGN_SPREADS[company.country] || 0;

    if (waterfallChart) waterfallChart.destroy();

    const labels = ['Base', 'Market Beta', 'Sector Beta', 'Residual', 'Seniority Delta', 'Duration Beta', 'Final Spread'];
    const dataPoints = [
        [0, baseEnd],
        [baseEnd, marketEnd],
        [marketEnd, sectorEnd],
        [sectorEnd, residualEnd],
        [residualEnd, seniorityEnd],
        [seniorityEnd, finalEnd],
        [0, finalEnd]
    ];

    // If EU and has sov spread, add it as a shadow/overlay or a separate bar?
    // Let's add it as one more bar if company.country isn't US/DE
    if (sovSpread > 0) {
        labels.splice(1, 0, 'Sovereign Delta');
        const sovEnd = baseEnd + sovSpread;
        // Shift everything else
        dataPoints[0] = [0, baseEnd];
        dataPoints.splice(1, 0, [baseEnd, sovEnd]);
        // Re-calculate the stack starting from sovEnd
        const mStart = sovEnd;
        const mEnd = mStart + marketComp;
        const sEnd = mEnd + sectorComp;
        const rEnd = sEnd + residual;
        const snEnd = rEnd + seniorityImpact;
        const fEnd = snEnd + tenureImpact;

        dataPoints[2] = [mStart, mEnd];
        dataPoints[3] = [mEnd, sEnd];
        dataPoints[4] = [sEnd, rEnd];
        dataPoints[5] = [rEnd, snEnd];
        dataPoints[6] = [snEnd, fEnd];
        dataPoints[7] = [0, fEnd];
    }

    waterfallChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Basis Points',
                data: dataPoints,
                backgroundColor: [
                    'rgba(255, 255, 255, 0.2)',
                    'rgba(255, 255, 255, 0.4)', // Sovereign
                    'rgba(57, 255, 20, 0.6)',
                    'rgba(57, 255, 20, 0.4)',
                    'rgba(255, 255, 255, 0.1)',
                    'rgba(255, 100, 0, 0.6)', // Seniority
                    'rgba(0, 150, 255, 0.6)', // Duration
                    'rgba(57, 255, 20, 1)'     // Final
                ],
                borderColor: '#39FF14',
                borderWidth: 1
            }]
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { 
                        color: 'rgba(255, 255, 255, 0.5)', 
                        font: { 
                            family: 'JetBrains Mono',
                            size: window.innerWidth < 640 ? 8 : 10
                        },
                        maxTicksLimit: window.innerWidth < 640 ? 5 : 8
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { 
                        color: 'white', 
                        font: { 
                            family: 'JetBrains Mono', 
                            weight: 'bold',
                            size: window.innerWidth < 640 ? 9 : 11
                        } 
                    }
                }
            }
        }
    });
}

// Start
init();
