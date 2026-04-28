/**
 * SENTINEL - High-Scale Logic Engine (Re-engineered)
 * Sectored Batching | Focus Prioritization | Async Math Core
 */

const COMPANIES = [
    { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy', type: 'IG', rating: 'AA', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 125, marketBeta: 0.8, sectorBeta: 1.1, residual: 0, lastUpdated: 0 },
    { ticker: 'SHEL', name: 'Shell PLC', sector: 'Energy', type: 'IG', rating: 'A', region: 'EU', country: 'UK', base_rate_type: 'GILT', baseSpread: 140, marketBeta: 0.9, sectorBeta: 1.2, residual: 0, lastUpdated: 0 },
    { ticker: 'CVX', name: 'Chevron Corp', sector: 'Energy', type: 'IG', rating: 'AA', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 130, marketBeta: 0.7, sectorBeta: 1.0, residual: 0, lastUpdated: 0 },
    { ticker: 'IBE.MC', name: 'Iberdrola', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EU', country: 'ES', base_rate_type: 'BUND', baseSpread: 110, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'EQNR', name: 'Equinor', sector: 'Energy', type: 'IG', rating: 'AA', region: 'EU', country: 'NO', base_rate_type: 'BUND', baseSpread: 155, marketBeta: 1.1, sectorBeta: 1.4, residual: 0, lastUpdated: 0 },
    { ticker: 'MPC', name: 'Marathon Petroleum', sector: 'Energy', type: 'HY', rating: 'HY', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 360, marketBeta: 1.3, sectorBeta: 1.6, residual: 0, lastUpdated: 0 },
    { ticker: 'LMT', name: 'Lockheed Martin', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 145, marketBeta: 0.6, sectorBeta: 0.4, residual: 0, lastUpdated: 0 },
    { ticker: 'LDO.MI', name: 'Leonardo SpA', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'EU', country: 'IT', base_rate_type: 'BUND', baseSpread: 185, marketBeta: 0.8, sectorBeta: 0.9, residual: 0, lastUpdated: 0 },
    { ticker: 'GD', name: 'General Dynamics', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 135, marketBeta: 0.6, sectorBeta: 0.5, residual: 0, lastUpdated: 0 },
    { ticker: 'LHX', name: 'L3Harris Tech', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 165, marketBeta: 0.8, sectorBeta: 0.6, residual: 0, lastUpdated: 0 },
    { ticker: 'NOC', name: 'Northrop Grumman', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 140, marketBeta: 0.5, sectorBeta: 0.4, residual: 0, lastUpdated: 0 },
    { ticker: 'RTX', name: 'RTX Corp', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 175, marketBeta: 0.9, sectorBeta: 0.7, residual: 0, lastUpdated: 0 },
    { ticker: 'RHM.DE', name: 'Rheinmetall AG', sector: 'Industrials', type: 'HY', rating: 'HY', region: 'EU', country: 'DE', base_rate_type: 'BUND', baseSpread: 380, marketBeta: 1.4, sectorBeta: 1.2, residual: 0, lastUpdated: 0 },
    { ticker: 'BA', name: 'Boeing Co', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 210, marketBeta: 1.2, sectorBeta: 0.9, residual: 0, lastUpdated: 0 },
    { ticker: 'AIR.PA', name: 'Airbus SE', sector: 'Industrials', type: 'IG', rating: 'A', region: 'EU', country: 'DE', base_rate_type: 'BUND', baseSpread: 150, marketBeta: 0.9, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'NGE.PA', name: 'Engie', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EU', country: 'IT', base_rate_type: 'BUND', baseSpread: 120, marketBeta: 0.6, sectorBeta: 0.9, residual: 0, lastUpdated: 0 },
    { ticker: 'ENEL.MI', name: 'Enel SpA', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EU', country: 'IT', base_rate_type: 'BUND', baseSpread: 135, marketBeta: 0.7, sectorBeta: 1.0, residual: 0, lastUpdated: 0 },
    { ticker: 'NEE', name: 'NextEra Energy', sector: 'Utilities', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 115, marketBeta: 0.4, sectorBeta: 0.7, residual: 0, lastUpdated: 0 },
    { ticker: 'DUK', name: 'Duke Energy', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 125, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'BP', name: 'BP PLC', sector: 'Energy', type: 'IG', rating: 'A', region: 'EU', country: 'UK', base_rate_type: 'GILT', baseSpread: 145, marketBeta: 0.9, sectorBeta: 1.1, residual: 0, lastUpdated: 0 },
    { ticker: 'TTE', name: 'TotalEnergies', sector: 'Energy', type: 'IG', rating: 'A', region: 'EU', country: 'FR', base_rate_type: 'BUND', baseSpread: 135, marketBeta: 0.8, sectorBeta: 1.0, residual: 0, lastUpdated: 0 },
    { ticker: 'COP', name: 'ConocoPhillips', sector: 'Energy', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 130, marketBeta: 0.9, sectorBeta: 1.0, residual: 0, lastUpdated: 0 },
    { ticker: 'EOG', name: 'EOG Resources', sector: 'Energy', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 120, marketBeta: 1.1, sectorBeta: 1.2, residual: 0, lastUpdated: 0 },
    { ticker: 'SLB', name: 'Schlumberger', sector: 'Energy', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 140, marketBeta: 1.2, sectorBeta: 1.3, residual: 0, lastUpdated: 0 },
    { ticker: 'HAL', name: 'Halliburton', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 160, marketBeta: 1.3, sectorBeta: 1.4, residual: 0, lastUpdated: 0 },
    { ticker: 'BKR', name: 'Baker Hughes', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 150, marketBeta: 1.1, sectorBeta: 1.2, residual: 0, lastUpdated: 0 },
    { ticker: 'VLO', name: 'Valero Energy', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 170, marketBeta: 1.0, sectorBeta: 1.1, residual: 0, lastUpdated: 0 },
    { ticker: 'PSX', name: 'Phillips 66', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 165, marketBeta: 1.0, sectorBeta: 1.1, residual: 0, lastUpdated: 0 },
    { ticker: 'OXY', name: 'Occidental', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 190, marketBeta: 1.4, sectorBeta: 1.5, residual: 0, lastUpdated: 0 },
    { ticker: 'WMB', name: 'Williams Cos', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 155, marketBeta: 0.8, sectorBeta: 0.9, residual: 0, lastUpdated: 0 },
    { ticker: 'KMI', name: 'Kinder Morgan', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 145, marketBeta: 0.7, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'SO', name: 'Southern Co', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 130, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'D', name: 'Dominion Energy', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 140, marketBeta: 0.6, sectorBeta: 0.9, residual: 0, lastUpdated: 0 },
    { ticker: 'AEP', name: 'American Electric', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 135, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'EXC', name: 'Exelon Corp', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 125, marketBeta: 0.6, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'SRE', name: 'Sempra Energy', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 130, marketBeta: 0.6, sectorBeta: 0.7, residual: 0, lastUpdated: 0 },
    { ticker: 'XEL', name: 'Xcel Energy', sector: 'Utilities', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 115, marketBeta: 0.5, sectorBeta: 0.7, residual: 0, lastUpdated: 0 },
    { ticker: 'PCG', name: 'PG&E Corp', sector: 'Utilities', type: 'HY', rating: 'HY', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 310, marketBeta: 0.9, sectorBeta: 1.2, residual: 0, lastUpdated: 0 },
    { ticker: 'PEG', name: 'Public Service', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 125, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'WEC', name: 'WEC Energy', sector: 'Utilities', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 110, marketBeta: 0.4, sectorBeta: 0.6, residual: 0, lastUpdated: 0 },
    { ticker: 'AWK', name: 'American Water', sector: 'Utilities', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 105, marketBeta: 0.4, sectorBeta: 0.5, residual: 0, lastUpdated: 0 },
    { ticker: 'ENI.MI', name: 'Eni SpA', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'EU', country: 'IT', base_rate_type: 'BUND', baseSpread: 160, marketBeta: 0.9, sectorBeta: 1.1, residual: 0, lastUpdated: 0 },
    { ticker: 'EDF.PA', name: 'EDF', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EU', country: 'FR', base_rate_type: 'BUND', baseSpread: 150, marketBeta: 0.7, sectorBeta: 1.0, residual: 0, lastUpdated: 0 },
    { ticker: 'SSE.L', name: 'SSE PLC', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EU', country: 'UK', base_rate_type: 'GILT', baseSpread: 140, marketBeta: 0.6, sectorBeta: 0.9, residual: 0, lastUpdated: 0 },
    { ticker: 'NG.L', name: 'National Grid', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EU', country: 'UK', base_rate_type: 'GILT', baseSpread: 130, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'GE', name: 'GE Aerospace', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 120, marketBeta: 1.1, sectorBeta: 0.9, residual: 0, lastUpdated: 0 },
    { ticker: 'HON', name: 'Honeywell', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 110, marketBeta: 0.9, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'UPS', name: 'United Parcel', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 135, marketBeta: 0.8, sectorBeta: 0.9, residual: 0, lastUpdated: 0 },
    { ticker: 'UNP', name: 'Union Pacific', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 125, marketBeta: 0.8, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'CAT', name: 'Caterpillar', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 140, marketBeta: 1.1, sectorBeta: 1.0, residual: 0, lastUpdated: 0 },
    { ticker: 'DE', name: 'Deere & Co', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 130, marketBeta: 1.0, sectorBeta: 0.9, residual: 0, lastUpdated: 0 },
    { ticker: 'LUV', name: 'Southwest Air', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 180, marketBeta: 1.2, sectorBeta: 1.3, residual: 0, lastUpdated: 0 },
    { ticker: 'DAL', name: 'Delta Air Lines', sector: 'Industrials', type: 'HY', rating: 'HY', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 320, marketBeta: 1.4, sectorBeta: 1.5, residual: 0, lastUpdated: 0 },
    { ticker: 'MMM', name: '3M Company', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 150, marketBeta: 0.9, sectorBeta: 0.9, residual: 0, lastUpdated: 0 },
    { ticker: 'EMR', name: 'Emerson Electric', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 115, marketBeta: 0.8, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'ETN', name: 'Eaton Corp', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 120, marketBeta: 0.9, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'SAF.PA', name: 'Safran SA', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'EU', country: 'FR', base_rate_type: 'BUND', baseSpread: 140, marketBeta: 1.0, sectorBeta: 0.9, residual: 0, lastUpdated: 0 },
    { ticker: 'RR.L', name: 'Rolls-Royce', sector: 'Industrials', type: 'HY', rating: 'HY', region: 'EU', country: 'UK', base_rate_type: 'GILT', baseSpread: 380, marketBeta: 1.5, sectorBeta: 1.4, residual: 0, lastUpdated: 0 },
    { ticker: 'VOW3.DE', name: 'Volkswagen', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'EU', country: 'DE', base_rate_type: 'BUND', baseSpread: 170, marketBeta: 1.2, sectorBeta: 1.1, residual: 0, lastUpdated: 0 },
    { ticker: 'SIE.DE', name: 'Siemens AG', sector: 'Industrials', type: 'IG', rating: 'A', region: 'EU', country: 'DE', base_rate_type: 'BUND', baseSpread: 115, marketBeta: 0.9, sectorBeta: 0.8, residual: 0, lastUpdated: 0 },
    { ticker: 'DTE.DE', name: 'Deutsche Post', sector: 'Industrials', type: 'IG', rating: 'A', region: 'EU', country: 'DE', base_rate_type: 'BUND', baseSpread: 125, marketBeta: 0.8, sectorBeta: 0.9, residual: 0, lastUpdated: 0 }
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
    GILT: 'IRLTLT01GBM156N',
    AAA: 'BAMLC0A1CAAA',
    AA: 'BAMLC0A2CAA',
    A: 'BAMLC0A3CA',
    BBB: 'BAMLC0A4CBBB',
    HY: 'BAMLH0A0HYM2'
};

const SovereignRegistry = {
    UST: { value: 4.25, label: 'US Treasury (10Y)', date: 'FALLBACK' },
    BUND: { value: 2.45, label: 'German Bund (10Y)', date: 'FALLBACK' },
    GILT: { value: 4.15, label: 'UK Gilt (10Y)', date: 'FALLBACK' },
    AAA: { value: 0.50, label: 'ICE BofA AAA US Corporate Index', date: 'FALLBACK' },
    AA: { value: 0.65, label: 'ICE BofA AA US Corporate Index', date: 'FALLBACK' },
    A: { value: 0.85, label: 'ICE BofA A US Corporate Index', date: 'FALLBACK' },
    BBB: { value: 1.25, label: 'ICE BofA BBB US Corporate Index', date: 'FALLBACK' },
    HY: { value: 3.50, label: 'ICE BofA US High Yield Index', date: 'FALLBACK' }
};

// Alpha Vantage Configuration & Sector Volatility Registry
const ALPHA_SERIES = {
    Energy: 'XLE',
    Utilities: 'XLU',
    Industrials: 'XLI'
};

const SectorRegistry = {
    Energy: { volatility: 25.0, label: 'Energy Sector ETF (XLE)', date: 'FALLBACK' },
    Utilities: { volatility: 18.0, label: 'Utilities Sector ETF (XLU)', date: 'FALLBACK' },
    Industrials: { volatility: 22.0, label: 'Industrials Sector ETF (XLI)', date: 'FALLBACK' }
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
            const stressMultiplier = currentBetaScaling;
            
            // Per requirement: Scale sum of market + sector beta
            const systematicBeta = (company.marketBeta + company.sectorBeta);
            const marketComp = company.marketBeta * 50 * stressMultiplier * sensitivity; 
            
            // Volatility Premium (Derived from Hub-and-Spoke Sector ETF)
            const sectorVol = SectorRegistry[company.sector] && SectorRegistry[company.sector].volatility !== 'FALLBACK' 
                ? SectorRegistry[company.sector].volatility 
                : 20.0; // Fallback 20% vol
            const companyVol = sectorVol * company.sectorBeta;
            // 1% Volatility = ~1.5 bps spread premium (simplified structural model proxy)
            const volatilityPremium = companyVol * 1.5 * stressMultiplier * sensitivity;
            
            // Per requirement: Residual scales proportionally with systematic
            const residualComp = company.residual * stressMultiplier;
            
            // Tranche Sensitivity: 2.0x for Subordinated on the aggregated delta
            const isSubordinated = (isInstrumentMod && selectedSeniority === 'Subordinated');
            const subMultiplier = isSubordinated ? 2.0 : 1.0;

            const aggregatedDelta = Math.round((marketComp + volatilityPremium + residualComp) * subMultiplier);
            
            // FETCH LIVE MACRO CORPORATE SPREAD INSTEAD OF HARDCODED baseSpread
            const liveMacroSpread = (SovereignRegistry[company.rating] && SovereignRegistry[company.rating].value !== 'FALLBACK')
                ? Math.round(SovereignRegistry[company.rating].value * 100) 
                : company.baseSpread;

            const totalSpread = Math.round(liveMacroSpread + aggregatedDelta);
            
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
            const data = await response.json();
            if (!response.ok) {
                lastErr = data.error || response.status;
                throw new Error(`Proxy error: ${lastErr}`);
            }
            
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
 * Alpha Vantage Live Sync (Sector Volatility Hub)
 */
async function fetchSectorVolatility() {
    console.log('Initiating Alpha Vantage Sector Volatility Sync...');
    let synchronizedCount = 0;

    for (const [sector, symbol] of Object.entries(ALPHA_SERIES)) {
        try {
            const response = await fetch(`/api/yahoo-proxy?symbol=${symbol}`);
            const data = await response.json();
            
            if (response.ok && data.volatility) {
                SectorRegistry[sector].volatility = data.volatility;
                SectorRegistry[sector].date = data.latestDate;
                synchronizedCount++;
                console.log(`Synced ${sector} (${symbol}) Volatility: ${data.volatility}% (v. ${data.latestDate})`);
            } else {
                console.warn(`Alpha Vantage Sync failed for ${sector}:`, data.error || 'Unknown Error');
            }
        } catch (error) {
            console.warn(`Alpha Proxy network error for ${sector}.`, error);
        }
    }

    if (synchronizedCount > 0) {
        triggerGlobalRefresh();
    }
}

/**
 * Auto-Calibration Engine (Spot Checks)
 * Queries individual tickers to find true volatility, compares against the Proxy (Hub-and-Spoke),
 * and calibrates the residual parameter.
 */
async function runAutoCalibration() {
    console.log('Initiating Auto-Calibration Engine...');
    // Select 3 random companies for spot check to preserve API limits
    const sampleSize = 3;
    const shuffled = [...COMPANIES].sort(() => 0.5 - Math.random());
    const targetCompanies = shuffled.slice(0, sampleSize);

    for (const company of targetCompanies) {
        try {
            const response = await fetch(`/api/yahoo-proxy?symbol=${company.ticker}`);
            const data = await response.json();
            
            if (response.ok && data.volatility) {
                const actualVol = data.volatility;
                
                // Calculate proxy volatility
                const sectorVol = SectorRegistry[company.sector] && SectorRegistry[company.sector].volatility !== 'FALLBACK' 
                    ? SectorRegistry[company.sector].volatility 
                    : 20.0;
                const proxyVol = sectorVol * company.sectorBeta;
                
                // Error Margin (Volatility %)
                const volError = actualVol - proxyVol;
                
                // Convert Volatility Error to Basis Points (1% vol = ~1.5 bps)
                const bpsError = volError * 1.5;
                
                // Auto-correct the company's calibrationError (this offsets the proxy error)
                company.calibrationError = Math.round(bpsError);
                
                console.log(`[Auto-Calibrate] ${company.ticker}: Actual Vol=${actualVol}%, Proxy Vol=${proxyVol.toFixed(2)}%. Error injected: ${company.calibrationError} bps`);
            }
        } catch (error) {
            console.warn(`Auto-Calibration failed for ${company.ticker}.`, error);
        }
    }
}

/**
 * Initialization
 */
function init() {
    setupEventListeners();
    renderGrid(); // Render instantly with fallbacks
    startHighScaleEngine();
    
    // Poll FRED & Alpha Vantage in background
    fetchSovereignAnchors();
    fetchSectorVolatility(); 
    
    // Auto-Calibrate on a delay to avoid rate-limiting spike on load
    setTimeout(runAutoCalibration, 10000);
    
    // Refresh macro data every 24 hours
    setInterval(() => {
        fetchSovereignAnchors();
        fetchSectorVolatility();
    }, 24 * 60 * 60 * 1000);
    
    // Auto-Calibrate every 2 hours
    setInterval(runAutoCalibration, 2 * 60 * 60 * 1000);
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
            <span class="text-xs text-neon-green uppercase font-mono tracking-widest font-bold glow-text">Yield Stack</span>
            <span class="text-lg text-white font-mono font-bold yield-val glow-text">--%</span>
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
    if (yieldEl) yieldEl.innerText = `${yieldVal}%`;
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
        c.residual = (c.calibrationError || 0) + (Math.random() * 3 - 1.5);
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
        activeModalCompany.residual = (activeModalCompany.calibrationError || 0) + (Math.random() * 3 - 1.5);
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

    // Critical Risk Validation on Modal
    const modalContent = document.querySelector('#focus-modal > div');
    if (delta > 250) {
        modalContent.classList.add('critical-risk');
    } else {
        modalContent.classList.remove('critical-risk');
    }
    renderWaterfall(activeModalCompany);
}

// Waterfall rendering (retained/stable)
function renderWaterfall(company) {
    const ctx = document.getElementById('waterfall-chart').getContext('2d');
    const sensitivity = company.type === 'IG' ? 0.15 : 1.2;
    const stressFactor = currentBetaScaling;
    const isSubordinated = selectedSeniority === 'Subordinated';
    const subMultiplier = isSubordinated ? 2.0 : 1.0;

    // Decompositions with 2x aggregated sensitivity for Subordinated
    const marketComp = Math.round(company.marketBeta * 50 * stressFactor * sensitivity * subMultiplier);
    
    const sectorVol = SectorRegistry[company.sector] && SectorRegistry[company.sector].volatility !== 'FALLBACK' 
        ? SectorRegistry[company.sector].volatility 
        : 20.0;
    const volatilityPremium = Math.round((sectorVol * company.sectorBeta * 1.5) * stressFactor * sensitivity * subMultiplier);
    
    const residual = Math.round(company.residual * stressFactor * subMultiplier);
    
    const seniorityMult = isSubordinated ? 1.0 : SENIORITY_MULTIPLIERS[selectedSeniority]; 
    const tenureFactor = (selectedTenure - 10) * 0.03;
    
    const sovSpread = (SOVEREIGN_SPREADS[company.country] || 0) + currentSovereignShock;
    const baseEnd = (SovereignRegistry[company.rating] && SovereignRegistry[company.rating].value !== 'FALLBACK')
        ? Math.round(SovereignRegistry[company.rating].value * 100) 
        : company.baseSpread;

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

    labels.push('Market Beta', 'Volatility Premium', 'Calibrated Residual');
    dataPoints.push([currentTotal, currentTotal + marketComp]);
    currentTotal += marketComp;
    dataPoints.push([currentTotal, currentTotal + volatilityPremium]);
    currentTotal += volatilityPremium;
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
