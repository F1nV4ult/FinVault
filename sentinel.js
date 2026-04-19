/**
 * SENTINEL - Beta-Analysis & Credit Monitor Logic
 */

const COMPANIES = [
    { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy', type: 'IG', baseSpread: 125, yield: 3.2, marketBeta: 0.8, sectorBeta: 1.1, residual: 15 },
    { ticker: 'SHEL', name: 'Shell PLC', sector: 'Energy', type: 'IG', baseSpread: 140, yield: 3.5, marketBeta: 0.9, sectorBeta: 1.2, residual: 20 },
    { ticker: 'CVX', name: 'Chevron Corp', sector: 'Energy', type: 'IG', baseSpread: 130, yield: 3.8, marketBeta: 0.7, sectorBeta: 1.0, residual: 10 },
    { ticker: 'IBE.MC', name: 'Iberdrola', sector: 'Utilities', type: 'IG', baseSpread: 110, yield: 2.9, marketBeta: 0.5, sectorBeta: 0.8, residual: 12 },
    { ticker: 'EQNR', name: 'Equinor', sector: 'Energy', type: 'IG', baseSpread: 155, yield: 4.1, marketBeta: 1.1, sectorBeta: 1.4, residual: 25 },
    { ticker: 'MPC', name: 'Marathon Petroleum', sector: 'Energy', type: 'HY', baseSpread: 360, yield: 5.2, marketBeta: 1.3, sectorBeta: 1.6, residual: 45 },
    { ticker: 'LMT', name: 'Lockheed Martin', sector: 'Industrials', type: 'IG', baseSpread: 145, yield: 2.4, marketBeta: 0.6, sectorBeta: 0.4, residual: 18 },
    { ticker: 'GD', name: 'General Dynamics', sector: 'Industrials', type: 'IG', baseSpread: 135, yield: 2.2, marketBeta: 0.6, sectorBeta: 0.5, residual: 15 },
    { ticker: 'LHX', name: 'L3Harris Tech', sector: 'Industrials', type: 'IG', baseSpread: 165, yield: 2.8, marketBeta: 0.8, sectorBeta: 0.6, residual: 22 },
    { ticker: 'NOC', name: 'Northrop Grumman', sector: 'Industrials', type: 'IG', baseSpread: 140, yield: 2.1, marketBeta: 0.5, sectorBeta: 0.4, residual: 14 },
    { ticker: 'RTX', name: 'RTX Corp', sector: 'Industrials', type: 'IG', baseSpread: 175, yield: 3.1, marketBeta: 0.9, sectorBeta: 0.7, residual: 35 },
    { ticker: 'RHM.DE', name: 'Rheinmetall AG', sector: 'Industrials', type: 'HY', baseSpread: 380, yield: 4.5, marketBeta: 1.4, sectorBeta: 1.2, residual: 60 }
];

const TREASURY_10Y = 4.25;

let currentBetaScaling = 1.0;
let historyData = {}; // Stores historical spreads for sparklines
let activeModalCompany = null;
let waterfallChart = null;

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
}

function calculateCurrentSpread(company) {
    // Revised Logic:
    // IG: Low sensitivity, Treasury-dominated.
    // HY: High sensitivity, Credit-dominated.
    
    const sensitivity = company.type === 'IG' ? 0.15 : 1.2;
    
    const marketComponent = company.marketBeta * 50 * currentBetaScaling * sensitivity; 
    const sectorComponent = company.sectorBeta * 30 * currentBetaScaling * sensitivity;
    
    return Math.round(company.baseSpread + marketComponent + sectorComponent + company.residual);
}

function calculateYield(spreadBps) {
    return (TREASURY_10Y + (spreadBps / 100)).toFixed(2);
}

function renderGrid(filterText = '') {
    const grid = document.getElementById('dashboard-grid');
    grid.innerHTML = '';

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
                    <span class="text-[9px] text-gray-600 uppercase font-mono tracking-widest">Beta Sensitivity</span>
                    <span class="text-[9px] text-gray-400 font-mono" id="yield-${company.ticker}">${calculateYield(currentSpread)}% Yield</span>
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
            yieldDisp.innerText = `${calculateYield(currentSpread)}% Yield`;
        }
    });
}

function initSparkline(ticker) {
    const ctx = document.getElementById(`sparkline-${ticker}`).getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(12).fill(''),
            datasets: [{
                data: historyData[ticker],
                borderColor: '#39FF14',
                borderWidth: 1.5,
                pointRadius: 0,
                fill: true,
                backgroundColor: 'rgba(57, 255, 20, 0.05)',
                tension: 0.4
            }]
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
    const currentSpread = calculateCurrentSpread(activeModalCompany);
    const totalYield = calculateYield(currentSpread);
    
    document.getElementById('modal-spread').innerText = activeModalCompany.baseSpread + " bps";
    document.getElementById('modal-sim-spread').innerText = currentSpread + " bps";
    document.getElementById('modal-yield').innerText = totalYield + "%";
    
    const dominance = activeModalCompany.type === 'IG' ? 'TREASURY' : 'CREDIT SPREAD';
    document.getElementById('modal-dominant-beta').innerText = dominance;

    // Dynamic Analyst Perspective
    const perspective = activeModalCompany.type === 'IG' 
        ? `Regression analysis confirms that for IG firms like ${activeModalCompany.ticker}, yield volatility is primarily dictated by the **Treasury Base**. Credit spread remains ultra-stable at ${activeModalCompany.baseSpread}bps, functioning as a fixed-income anchor.`
        : `Credit-intensive profiling identifies ${activeModalCompany.ticker} as highly sensitive to **Spread Widening**. The "Sentinel Beta" of ${activeModalCompany.marketBeta}x outweighs risk-free rate moves, making the Credit Spread the dominant driver of total yield volatility.`;
    
    document.getElementById('modal-perspective').innerHTML = perspective;

    if (waterfallChart) {
        renderWaterfall(activeModalCompany);
    }
}

function renderWaterfall(company) {
    const ctx = document.getElementById('waterfall-chart').getContext('2d');
    
    const marketComp = Math.round(company.marketBeta * 50 * currentBetaScaling);
    const sectorComp = Math.round(company.sectorBeta * 30 * currentBetaScaling);
    const residual = Math.round(company.residual);
    const total = company.baseSpread + marketComp + sectorComp + residual;

    if (waterfallChart) waterfallChart.destroy();

    waterfallChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Base', 'Market Beta', 'Sector Beta', 'Residual', 'Current Spread'],
            datasets: [{
                label: 'Basis Points',
                data: [
                    company.baseSpread,
                    marketComp,
                    sectorComp,
                    residual,
                    total
                ],
                backgroundColor: [
                    'rgba(255, 255, 255, 0.2)',
                    'rgba(57, 255, 20, 0.6)',
                    'rgba(57, 255, 20, 0.4)',
                    'rgba(255, 255, 255, 0.1)',
                    'rgba(57, 255, 20, 1)'
                ],
                borderColor: '#39FF14',
                borderWidth: 1
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
