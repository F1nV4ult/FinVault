/**
 * SENTINEL - High-Scale Logic Engine (Re-engineered)
 * Sectored Batching | Focus Prioritization | Async Math Core
 */

// Phase 2 (defense-in-depth): escape any registry/data string before it goes
// into innerHTML, so a future externally-sourced value can't inject markup.
function escHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const COMPANIES = [
    // netLeverage = Net Debt / EBITDA (TTM); interestCoverage = EBITDA / Interest Expense (TTM). Source: 2024 annual reports.
    { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy', type: 'IG', rating: 'AA', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 125, marketBeta: 0.8, sectorBeta: 1.1, residual: 0, lastUpdated: 0, lastVerified: '2026-05-17', netLeverage: 0.3, interestCoverage: 22.5 },
    { ticker: 'SHEL', name: 'Shell PLC', sector: 'Energy', type: 'IG', rating: 'A', region: 'EU', country: 'UK', base_rate_type: 'GILT', baseSpread: 120, marketBeta: 0.9, sectorBeta: 1.2, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.4, interestCoverage: 12.0 },
    { ticker: 'CVX', name: 'Chevron Corp', sector: 'Energy', type: 'IG', rating: 'AA', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 130, marketBeta: 0.7, sectorBeta: 1.0, residual: 0, lastUpdated: 0, lastVerified: '2026-05-17', netLeverage: 0.3, interestCoverage: 10.0 },
    { ticker: 'IBE.MC', name: 'Iberdrola', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EU', country: 'ES', base_rate_type: 'BUND', baseSpread: 110, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-17', netLeverage: 2.7, interestCoverage: 4.0 },
    { ticker: 'EQNR', name: 'Equinor', sector: 'Energy', type: 'IG', rating: 'AA', region: 'EU', country: 'NO', base_rate_type: 'BUND', baseSpread: 140, marketBeta: 1.1, sectorBeta: 1.4, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.3, interestCoverage: 18.0 },
    { ticker: 'MPC', name: 'Marathon Petroleum', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 170, marketBeta: 1.3, sectorBeta: 1.6, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.9, interestCoverage: 7.0 },
    { ticker: 'LMT', name: 'Lockheed Martin', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 145, marketBeta: 0.6, sectorBeta: 0.4, residual: 0, lastUpdated: 0, lastVerified: '2026-05-17', netLeverage: 2.0, interestCoverage: 11.5 },
    { ticker: 'LDO.MI', name: 'Leonardo SpA', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'EU', country: 'IT', base_rate_type: 'BUND', baseSpread: 175, marketBeta: 0.8, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.4, interestCoverage: 10.0 },
    { ticker: 'GD', name: 'General Dynamics', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 135, marketBeta: 0.6, sectorBeta: 0.5, residual: 0, lastUpdated: 0, lastVerified: '2026-05-17', netLeverage: 1.4, interestCoverage: 9.0 },
    { ticker: 'LHX', name: 'L3Harris Tech', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 165, marketBeta: 0.8, sectorBeta: 0.6, residual: 0, lastUpdated: 0, lastVerified: '2026-05-17', netLeverage: 3.4, interestCoverage: 3.0 },
    { ticker: 'NOC', name: 'Northrop Grumman', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 140, marketBeta: 0.5, sectorBeta: 0.4, residual: 0, lastUpdated: 0, lastVerified: '2026-05-17', netLeverage: 1.8, interestCoverage: 7.0 },
    { ticker: 'RTX', name: 'RTX Corp', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 175, marketBeta: 0.9, sectorBeta: 0.7, residual: 0, lastUpdated: 0, lastVerified: '2026-05-17', netLeverage: 2.8, interestCoverage: 5.0 },
    { ticker: 'RHM.DE', name: 'Rheinmetall AG', sector: 'Industrials', type: 'HY', rating: 'HY', region: 'EU', country: 'DE', base_rate_type: 'BUND', baseSpread: 380, marketBeta: 1.4, sectorBeta: 1.2, residual: 0, lastUpdated: 0, lastVerified: '2026-05-17', netLeverage: 2.0, interestCoverage: 7.5 },
    { ticker: 'BA', name: 'Boeing Co', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 260, marketBeta: 1.2, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 18.0, interestCoverage: 0.9 },
    { ticker: 'AIR.PA', name: 'Airbus SE', sector: 'Industrials', type: 'IG', rating: 'A', region: 'EU', country: 'DE', base_rate_type: 'BUND', baseSpread: 135, marketBeta: 0.9, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.2, interestCoverage: 15.0 },
    { ticker: 'ENGI.PA', name: 'Engie', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EU', country: 'IT', base_rate_type: 'BUND', baseSpread: 115, marketBeta: 0.6, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 2.2, interestCoverage: 5.5 },
    { ticker: 'ENEL.MI', name: 'Enel SpA', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EU', country: 'IT', base_rate_type: 'BUND', baseSpread: 130, marketBeta: 0.7, sectorBeta: 1.0, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 2.5, interestCoverage: 5.0 },
    { ticker: 'NEE', name: 'NextEra Energy', sector: 'Utilities', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 110, marketBeta: 0.4, sectorBeta: 0.7, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 7.0, interestCoverage: 3.0 },
    { ticker: 'DUK', name: 'Duke Energy', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 120, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 6.5, interestCoverage: 2.8 },
    { ticker: 'BP', name: 'BP PLC', sector: 'Energy', type: 'IG', rating: 'A', region: 'EU', country: 'UK', base_rate_type: 'GILT', baseSpread: 145, marketBeta: 0.9, sectorBeta: 1.1, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 1.2, interestCoverage: 8.0 },
    { ticker: 'TTE', name: 'TotalEnergies', sector: 'Energy', type: 'IG', rating: 'A', region: 'EU', country: 'FR', base_rate_type: 'BUND', baseSpread: 115, marketBeta: 0.8, sectorBeta: 1.0, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.3, interestCoverage: 18.0 },
    { ticker: 'COP', name: 'ConocoPhillips', sector: 'Energy', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 115, marketBeta: 0.9, sectorBeta: 1.0, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.2, interestCoverage: 28.0 },
    { ticker: 'EOG', name: 'EOG Resources', sector: 'Energy', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 105, marketBeta: 1.1, sectorBeta: 1.2, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.1, interestCoverage: 35.0 },
    { ticker: 'SLB', name: 'SLB', sector: 'Energy', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 130, marketBeta: 1.2, sectorBeta: 1.3, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 1.2, interestCoverage: 9.0 },
    { ticker: 'HAL', name: 'Halliburton', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 155, marketBeta: 1.3, sectorBeta: 1.4, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 1.5, interestCoverage: 8.0 },
    { ticker: 'BKR', name: 'Baker Hughes', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 140, marketBeta: 1.1, sectorBeta: 1.2, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.8, interestCoverage: 10.0 },
    { ticker: 'VLO', name: 'Valero Energy', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 160, marketBeta: 1.0, sectorBeta: 1.1, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.5, interestCoverage: 12.0 },
    { ticker: 'PSX', name: 'Phillips 66', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 155, marketBeta: 1.0, sectorBeta: 1.1, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.9, interestCoverage: 7.0 },
    { ticker: 'OXY', name: 'Occidental', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 200, marketBeta: 1.4, sectorBeta: 1.5, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 2.8, interestCoverage: 4.5 },
    { ticker: 'WMB', name: 'Williams Cos', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 145, marketBeta: 0.8, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 3.8, interestCoverage: 4.5 },
    { ticker: 'KMI', name: 'Kinder Morgan', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 135, marketBeta: 0.7, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 4.2, interestCoverage: 4.0 },
    { ticker: 'SO', name: 'Southern Co', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 125, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 6.0, interestCoverage: 3.0 },
    { ticker: 'D', name: 'Dominion Energy', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 135, marketBeta: 0.6, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 5.5, interestCoverage: 3.5 },
    { ticker: 'AEP', name: 'American Electric', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 130, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 6.0, interestCoverage: 3.2 },
    { ticker: 'EXC', name: 'Exelon Corp', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 120, marketBeta: 0.6, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 4.5, interestCoverage: 4.0 },
    { ticker: 'SRE', name: 'Sempra Energy', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 125, marketBeta: 0.6, sectorBeta: 0.7, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 6.0, interestCoverage: 3.2 },
    { ticker: 'XEL', name: 'Xcel Energy', sector: 'Utilities', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 110, marketBeta: 0.5, sectorBeta: 0.7, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 5.5, interestCoverage: 3.5 },
    { ticker: 'PCG', name: 'PG&E Corp', sector: 'Utilities', type: 'HY', rating: 'HY', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 280, marketBeta: 0.9, sectorBeta: 1.2, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 5.0, interestCoverage: 3.0 },
    { ticker: 'PEG', name: 'Public Service', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 120, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 4.0, interestCoverage: 4.5 },
    { ticker: 'WEC', name: 'WEC Energy', sector: 'Utilities', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 105, marketBeta: 0.4, sectorBeta: 0.6, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 5.0, interestCoverage: 4.0 },
    { ticker: 'AWK', name: 'American Water', sector: 'Utilities', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 100, marketBeta: 0.4, sectorBeta: 0.5, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 7.5, interestCoverage: 3.5 },
    { ticker: 'ENI.MI', name: 'Eni SpA', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'EU', country: 'IT', base_rate_type: 'BUND', baseSpread: 150, marketBeta: 0.9, sectorBeta: 1.1, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.3, interestCoverage: 15.0 },
    { ticker: 'NTGY.MC', name: 'Naturgy', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EU', country: 'ES', base_rate_type: 'BUND', baseSpread: 145, marketBeta: 0.7, sectorBeta: 1.0, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 2.5, interestCoverage: 5.5 },
    { ticker: 'SSE.L', name: 'SSE PLC', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EU', country: 'UK', base_rate_type: 'GILT', baseSpread: 135, marketBeta: 0.6, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 7.5, interestCoverage: 3.0 },
    { ticker: 'NG.L', name: 'National Grid', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EU', country: 'UK', base_rate_type: 'GILT', baseSpread: 125, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 8.5, interestCoverage: 3.0 },
    { ticker: 'GE', name: 'GE Aerospace', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 110, marketBeta: 1.1, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.5, interestCoverage: 12.0 },
    { ticker: 'HON', name: 'Honeywell', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 105, marketBeta: 0.9, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 1.8, interestCoverage: 10.0 },
    { ticker: 'UPS', name: 'United Parcel', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 125, marketBeta: 0.8, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 2.5, interestCoverage: 8.0 },
    { ticker: 'UNP', name: 'Union Pacific', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 115, marketBeta: 0.8, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 2.8, interestCoverage: 7.5 },
    { ticker: 'CAT', name: 'Caterpillar', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 125, marketBeta: 1.1, sectorBeta: 1.0, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 1.5, interestCoverage: 15.0 },
    { ticker: 'DE', name: 'Deere & Co', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 120, marketBeta: 1.0, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 3.5, interestCoverage: 5.5 },
    { ticker: 'LUV', name: 'Southwest Air', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 175, marketBeta: 1.2, sectorBeta: 1.3, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 2.5, interestCoverage: 5.0 },
    { ticker: 'DAL', name: 'Delta Air Lines', sector: 'Industrials', type: 'HY', rating: 'HY', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 290, marketBeta: 1.4, sectorBeta: 1.5, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 3.5, interestCoverage: 4.5 },
    { ticker: 'MMM', name: '3M Company', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 145, marketBeta: 0.9, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 2.5, interestCoverage: 7.0 },
    { ticker: 'EMR', name: 'Emerson Electric', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 110, marketBeta: 0.8, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 1.5, interestCoverage: 9.0 },
    { ticker: 'ETN', name: 'Eaton Corp', sector: 'Industrials', type: 'IG', rating: 'A', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 110, marketBeta: 0.9, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 1.3, interestCoverage: 12.0 },
    { ticker: 'SAF.PA', name: 'Safran SA', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'EU', country: 'FR', base_rate_type: 'BUND', baseSpread: 130, marketBeta: 1.0, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.4, interestCoverage: 14.0 },
    { ticker: 'RR.L', name: 'Rolls-Royce', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'EU', country: 'UK', base_rate_type: 'GILT', baseSpread: 190, marketBeta: 1.5, sectorBeta: 1.4, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 1.0, interestCoverage: 5.0 },
    { ticker: 'VOW3.DE', name: 'Volkswagen', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'EU', country: 'DE', base_rate_type: 'BUND', baseSpread: 165, marketBeta: 1.2, sectorBeta: 1.1, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 4.0, interestCoverage: 4.5 },
    { ticker: 'SIE.DE', name: 'Siemens AG', sector: 'Industrials', type: 'IG', rating: 'A', region: 'EU', country: 'DE', base_rate_type: 'BUND', baseSpread: 90, marketBeta: 0.9, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.8, interestCoverage: 12.0 },
    { ticker: 'DHL.DE', name: 'DHL Group', sector: 'Industrials', type: 'IG', rating: 'A', region: 'EU', country: 'DE', base_rate_type: 'BUND', baseSpread: 100, marketBeta: 0.8, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 1.5, interestCoverage: 8.0 },
    // === v1.6 Global Diversification (Energy) — added 2026-05 ===
    // State-owned EM (PBR, 2222.SR), EM growth (RELIANCE.NS), DM mid-caps
    // (REP.MC, DVN, FANG), APAC LNG pure-play (WDS.AX).
    { ticker: 'PBR', name: 'Petrobras', sector: 'Energy', type: 'HY', rating: 'HY', region: 'EM', country: 'BR', base_rate_type: 'UST', baseSpread: 215, marketBeta: 1.4, sectorBeta: 1.5, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 1.6, interestCoverage: 8.5 },
    { ticker: '2222.SR', name: 'Saudi Aramco', sector: 'Energy', type: 'IG', rating: 'A', region: 'ME', country: 'SA', base_rate_type: 'UST', baseSpread: 95, marketBeta: 0.6, sectorBeta: 1.0, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.2, interestCoverage: 45.0 },
    { ticker: 'RELIANCE.NS', name: 'Reliance Industries', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'EM', country: 'IN', base_rate_type: 'UST', baseSpread: 145, marketBeta: 1.1, sectorBeta: 1.0, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 1.8, interestCoverage: 6.0 },
    { ticker: 'WDS.AX', name: 'Woodside Energy', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'APAC', country: 'AU', base_rate_type: 'UST', baseSpread: 135, marketBeta: 1.1, sectorBeta: 1.2, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 1.5, interestCoverage: 8.0 },
    { ticker: 'REP.MC', name: 'Repsol', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'EU', country: 'ES', base_rate_type: 'BUND', baseSpread: 145, marketBeta: 1.0, sectorBeta: 1.1, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.5, interestCoverage: 12.0 },
    { ticker: 'DVN', name: 'Devon Energy', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 165, marketBeta: 1.3, sectorBeta: 1.4, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.5, interestCoverage: 15.0 },
    { ticker: 'FANG', name: 'Diamondback Energy', sector: 'Energy', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 175, marketBeta: 1.3, sectorBeta: 1.4, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 1.0, interestCoverage: 10.0 },
    // === v1.6 Global Diversification (Utilities) — added 2026-05 ===
    // Post-Fukushima turnaround (9501.T), EM generator (NTPC.NS),
    // APAC mid-cap (ORG.AX), EU energy-transition (EOAN.DE, RWE.DE),
    // US climate-exposed (ETR).
    { ticker: '9501.T', name: 'Tokyo Electric Power', sector: 'Utilities', type: 'HY', rating: 'HY', region: 'APAC', country: 'JP', base_rate_type: 'UST', baseSpread: 270, marketBeta: 1.0, sectorBeta: 1.3, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 9.0, interestCoverage: 2.5 },
    { ticker: 'NTPC.NS', name: 'NTPC', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EM', country: 'IN', base_rate_type: 'UST', baseSpread: 115, marketBeta: 0.9, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 4.5, interestCoverage: 3.5 },
    { ticker: 'ORG.AX', name: 'Origin Energy', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'APAC', country: 'AU', base_rate_type: 'UST', baseSpread: 140, marketBeta: 0.8, sectorBeta: 1.0, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 2.0, interestCoverage: 5.0 },
    { ticker: 'EOAN.DE', name: 'E.ON', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EU', country: 'DE', base_rate_type: 'BUND', baseSpread: 125, marketBeta: 0.6, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 3.5, interestCoverage: 4.5 },
    { ticker: 'RWE.DE', name: 'RWE', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'EU', country: 'DE', base_rate_type: 'BUND', baseSpread: 135, marketBeta: 0.7, sectorBeta: 1.0, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 1.5, interestCoverage: 7.0 },
    { ticker: 'ETR', name: 'Entergy', sector: 'Utilities', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 130, marketBeta: 0.5, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 5.5, interestCoverage: 3.5 },
    // === v1.6 Global Diversification (Industrials) — added 2026-05 ===
    // UK / FR defense (BA.L, HO.PA), APAC heavy industry (7011.T, 6301.T),
    // EM growth (LT.NS, ERJ), Nordic industrial (ATCO-A.ST, VOLV-B.ST),
    // US aerospace growth (HWM).
    { ticker: 'BA.L', name: 'BAE Systems', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'EU', country: 'UK', base_rate_type: 'GILT', baseSpread: 145, marketBeta: 0.7, sectorBeta: 0.7, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.8, interestCoverage: 12.0 },
    { ticker: 'HO.PA', name: 'Thales', sector: 'Industrials', type: 'IG', rating: 'A', region: 'EU', country: 'FR', base_rate_type: 'BUND', baseSpread: 120, marketBeta: 0.8, sectorBeta: 0.8, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.5, interestCoverage: 14.0 },
    { ticker: '7011.T', name: 'Mitsubishi Heavy', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'APAC', country: 'JP', base_rate_type: 'UST', baseSpread: 150, marketBeta: 0.9, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 2.0, interestCoverage: 6.0 },
    { ticker: '6301.T', name: 'Komatsu', sector: 'Industrials', type: 'IG', rating: 'A', region: 'APAC', country: 'JP', base_rate_type: 'UST', baseSpread: 120, marketBeta: 1.0, sectorBeta: 1.0, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.5, interestCoverage: 15.0 },
    { ticker: 'LT.NS', name: 'Larsen & Toubro', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'EM', country: 'IN', base_rate_type: 'UST', baseSpread: 125, marketBeta: 1.1, sectorBeta: 1.0, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.5, interestCoverage: 12.0 },
    { ticker: 'ERJ', name: 'Embraer', sector: 'Industrials', type: 'HY', rating: 'HY', region: 'EM', country: 'BR', base_rate_type: 'UST', baseSpread: 240, marketBeta: 1.2, sectorBeta: 1.3, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 2.0, interestCoverage: 5.0 },
    { ticker: 'ATCO-A.ST', name: 'Atlas Copco', sector: 'Industrials', type: 'IG', rating: 'A', region: 'EU', country: 'SE', base_rate_type: 'BUND', baseSpread: 100, marketBeta: 0.9, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.5, interestCoverage: 18.0 },
    { ticker: 'VOLV-B.ST', name: 'Volvo Group', sector: 'Industrials', type: 'IG', rating: 'A', region: 'EU', country: 'SE', base_rate_type: 'BUND', baseSpread: 115, marketBeta: 1.1, sectorBeta: 1.0, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 0.5, interestCoverage: 15.0 },
    { ticker: 'HWM', name: 'Howmet Aerospace', sector: 'Industrials', type: 'IG', rating: 'BBB', region: 'US', country: 'US', base_rate_type: 'UST', baseSpread: 145, marketBeta: 1.0, sectorBeta: 0.9, residual: 0, lastUpdated: 0, lastVerified: '2026-05-27', netLeverage: 2.5, interestCoverage: 6.0 }
];

// Configuration
const TREASURY_10Y = 4.25;
const BUND_10Y = 2.45;
const GILT_10Y = 4.15;
const BATCH_SIZE = 5;
const SLOW_REFRESH_MS = 60000;
const FAST_REFRESH_MS = 5000;

const SOVEREIGN_SPREADS = { 'US': 0, 'DE': 0, 'FR': 0, 'NO': 45, 'ES': 80, 'IT': 145, 'UK': 0, 'SE': 0, 'AU': 0, 'JP': 0, 'SA': 100, 'BR': 250, 'IN': 250 };
const SENIORITY_MULTIPLIERS = { 'Secured': 0.85, 'Unsecured': 1.0, 'Subordinated': 1.5 };

// Per-rating baseSpread sanity bands (bps). Loose enough to admit
// reasonable issuer-specific variation, tight enough to catch transcription
// errors (e.g. 1250 instead of 125). Out-of-band entries log a console
// warning at load time. See SENTINEL-CALIBRATION.md for the procedure.
const RATING_BANDS = {
    AAA: { min: 30,  max: 150 },
    AA:  { min: 50,  max: 200 },
    A:   { min: 70,  max: 250 },
    BBB: { min: 100, max: 350 },
    BB:  { min: 200, max: 500 },
    B:   { min: 350, max: 700 },
    HY:  { min: 200, max: 700 }
};

// Staleness tiers for the quarterly verification cadence.
const VERIF_FRESH_DAYS = 60;   // green: just refreshed, within current quarter
const VERIF_AGING_DAYS = 90;   // amber: refresh due before quarter ends
                               // red: anything beyond 90 days (overdue)

// FRED Configuration & Sovereign Registry
const FRED_SERIES = {
    UST: 'DGS10',
    BUND: 'IRLTLT01DEM156N',
    GILT: 'IRLTLT01GBM156N',
    AAA: 'BAMLC0A1CAAA',
    AA: 'BAMLC0A2CAA',
    A: 'BAMLC0A3CA',
    BBB: 'BAMLC0A4CBBB',
    HY: 'BAMLH0A0HYM2',
    VIX: 'VIXCLS'
};

const SovereignRegistry = {
    UST: { value: 4.25, label: 'US Treasury (10Y)', date: 'FALLBACK' },
    BUND: { value: 2.45, label: 'German Bund (10Y)', date: 'FALLBACK' },
    GILT: { value: 4.15, label: 'UK Gilt (10Y)', date: 'FALLBACK' },
    AAA: { value: 0.50, label: 'ICE BofA AAA US Corporate Index', date: 'FALLBACK' },
    AA: { value: 0.65, label: 'ICE BofA AA US Corporate Index', date: 'FALLBACK' },
    A: { value: 0.85, label: 'ICE BofA A US Corporate Index', date: 'FALLBACK' },
    BBB: { value: 1.25, label: 'ICE BofA BBB US Corporate Index', date: 'FALLBACK' },
    HY: { value: 3.50, label: 'ICE BofA US High Yield Index', date: 'FALLBACK' },
    VIX: { value: 15.0, label: 'CBOE Volatility Index', date: 'FALLBACK' }
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
let waterfallSignature = null;
let selectedSeniority = 'Unsecured';
let selectedTenure = 10;
let currentSectorActive = 'Alpha';
let activeFilters = { sector: 'all', risk: 'all' };
let activeSort = 'default';
let sentinelGovernance = null;

// Staleness tracking — macro feeds refresh every 24h; expose age so the user
// knows whether the values they're looking at are minutes old or nearly stale.
let lastFredSync = null;
let lastAlphaSync = null;
const MACRO_REFRESH_MS = 24 * 60 * 60 * 1000;

function formatAge(ts) {
    if (!ts) return 'never';
    const ms = Date.now() - ts;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h === 0) return `${m}m ago`;
    return `${h}h ${m}m ago`;
}

function formatCountdown(ts) {
    if (!ts) return '--';
    const remaining = MACRO_REFRESH_MS - (Date.now() - ts);
    if (remaining <= 0) return 'due now';
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    return `${h}h ${m}m`;
}

function updateStalenessIndicators() {
    const fredEl = document.getElementById('fred-indicator');
    const alphaEl = document.getElementById('alpha-indicator');
    if (fredEl && lastFredSync) {
        const d = SovereignRegistry.UST && SovereignRegistry.UST.date !== 'FALLBACK' ? SovereignRegistry.UST.date : '--';
        fredEl.innerText = `Sovereign Anchors: FRED Live (v. ${d}) · synced ${formatAge(lastFredSync)} · refresh in ${formatCountdown(lastFredSync)}`;
    }
    if (alphaEl && lastAlphaSync) {
        const d = SectorRegistry.Energy && SectorRegistry.Energy.date !== 'FALLBACK' ? SectorRegistry.Energy.date : '--';
        alphaEl.innerText = `Sector Alpha: AlphaVantage Live (v. ${d}) · synced ${formatAge(lastAlphaSync)} · refresh in ${formatCountdown(lastAlphaSync)}`;
    }
}

/**
 * Helper: Identify Benchmark
 */
function getBenchmark(company) {
    if (company.base_rate_type === 'GILT') return 'Gilt';
    return company.base_rate_type === 'BUND' ? 'Bund' : 'UST';
}

function governanceStatus(record) {
    const verified = Date.parse(record?.anchor?.lastVerified || '');
    if (!Number.isFinite(verified)) return { label: 'UNAVAILABLE', className: 'text-red-400' };
    const days = Math.max(0, Math.floor((Date.now() - verified) / 86400000));
    if (days > record.monitoring.staleAfterDays) return { label: `STALE · ${days}D`, className: 'text-red-400' };
    if (days > record.monitoring.reviewAfterDays) return { label: `REVIEW DUE · ${days}D`, className: 'text-amber-400' };
    return { label: `CURRENT · ${days}D`, className: 'text-neon-green' };
}

async function loadSentinelGovernance() {
    try {
        sentinelGovernance = window.NSSnapshots
            ? await window.NSSnapshots.get('sentinelGovernance')
            : await fetch('/data/sentinel-governance.json').then(response => response.ok ? response.json() : null);
    } catch (_) { sentinelGovernance = null; }
    COMPANIES.forEach(company => updateAnchorGovernance(company.ticker));
}

function updateAnchorGovernance(ticker) {
    const el = document.querySelector(`#card-${CSS.escape(ticker)} .anchor-governance`);
    if (!el) return;
    const record = sentinelGovernance?.byTicker?.[ticker];
    const state = governanceStatus(record);
    el.textContent = `ANCHOR ${state.label}`;
    el.className = `anchor-governance text-[8px] font-mono uppercase tracking-widest ${state.className}`;
}

function getSpreadInput(company, isInstrumentMod = false) {
    const rating = SovereignRegistry[company.rating];
    const sector = SectorRegistry[company.sector];
    const scenario = (window.NSState && window.NSState.getScenario && window.NSState.getScenario()) || {};
    const sectorVol = sector?.date !== 'FALLBACK' ? sector.volatility : 20.0;
    const liveVix = SovereignRegistry.VIX?.date !== 'FALLBACK' ? SovereignRegistry.VIX.value : 15.0;
    return {
        type: company.type,
        baseSpread: company.baseSpread,
        ratingIndexBps: rating?.date !== 'FALLBACK' ? Math.round(rating.value * 100) : null,
        sectorBeta: company.sectorBeta,
        marketBeta: company.marketBeta,
        residual: Number.isFinite(company.residual) ? company.residual : 0,
        sectorVol: sectorVol * (1 + (Number(scenario.sectorVolPct) || 0) / 100),
        vix: Number(scenario.vix) > 0 ? Number(scenario.vix) : liveVix,
        stress: currentBetaScaling,
        seniority: selectedSeniority,
        tenure: selectedTenure,
        instrumentMod: isInstrumentMod
    };
}

/**
 * simulated Web Worker Math Core
 */
const CreditEngine = {
    async calculateCurrentSpread(company, isInstrumentMod = false) {
        return new Promise(resolve => {
            // The quote, driver breakdown and waterfall now share the same
            // executable specification. Do not recreate this arithmetic here.
            const shared = window.SentinelSpread.computeSpread(getSpreadInput(company, isInstrumentMod));
            company._lastProxyVol = parseFloat(shared.proxyVol.toFixed(2));
            company._lastMertonPhase = shared.regime;
            company._lastBaseSpread = shared.baseTotalSpread;
            resolve(shared.finalSpread);
            return;

            // Recalibrated: IG/HY differential ~2.86x (was 8x). More aligned
            // with empirical credit-beta dispersion between IG and HY.
            const sensitivity = company.type === 'IG' ? 0.35 : 1.0;
            const stressMultiplier = currentBetaScaling;
            
            // Leg 1: Macro Anchor — use ICE BofA rating-index OAS as a market-wide
            // FLOOR, not a replacement for the company-specific baseSpread. The
            // index reflects bucket-average OAS (e.g. BBB index ~125 bps), so it
            // can pull static baseSpreads up during bucket repricing but must not
            // crush idiosyncratic spreads (e.g. RHM.DE @ 380 bps). Previous bug:
            // the `value !== 'FALLBACK'` check was always true (value is numeric,
            // 'FALLBACK' lives on `date`), so baseSpread was silently overwritten.
            const ratingIdx = SovereignRegistry[company.rating];
            const ratingIndexBps = (ratingIdx && ratingIdx.date !== 'FALLBACK')
                ? Math.round(ratingIdx.value * 100)
                : 0;
            const liveMacroSpread = Math.max(company.baseSpread, ratingIndexBps);
            
            // Leg A: Proxy Volatility with VIX Beta-Shift
            const vix = SovereignRegistry.VIX && SovereignRegistry.VIX.value !== 'FALLBACK' ? SovereignRegistry.VIX.value : 15.0;
            const cFactor = Math.min(0.8, Math.max(0, (vix - 25) / 25));
            const effectiveSectorBeta = (1 - cFactor) * company.sectorBeta + (cFactor * 1.0);
            const effectiveMarketBeta = (1 - cFactor) * company.marketBeta + (cFactor * 1.0);

            const sectorVol = SectorRegistry[company.sector] && SectorRegistry[company.sector].volatility !== 'FALLBACK' 
                ? SectorRegistry[company.sector].volatility 
                : 20.0;
            
            // Formula: proxyVol_i = (sigma_ETF * beta_eff) + Residual
            const proxyVol = (sectorVol * effectiveSectorBeta) + company.residual;
            
            // Leg B: Merton Convexity Adjustment — smooth sigmoid centered at
            // vol=35 (was a binary 1.5/2.5 jump). Range: 1.5 (low vol) → 2.5
            // (high vol), continuous and differentiable.
            const mertonScalar = 1.5 + 1.0 / (1 + Math.exp(-0.4 * (proxyVol - 35)));
            const volatilityPremium = proxyVol * mertonScalar * stressMultiplier * sensitivity;

            const marketComp = effectiveMarketBeta * 50 * stressMultiplier * sensitivity; 
            
            const baseDelta = Math.round(marketComp + volatilityPremium);
            const baseTotalSpread = liveMacroSpread + baseDelta;

            // Leg C: Seniority Elasticity
            const isSubordinated = (isInstrumentMod && selectedSeniority === 'Subordinated');
            const subMultiplier = isSubordinated ? (1.5 + (baseTotalSpread / 200)) : 1.0;
            const seniorityMult = (isInstrumentMod && !isSubordinated) ? SENIORITY_MULTIPLIERS[selectedSeniority] : 1.0;
            
            const tenureMult = isInstrumentMod ? (1 + (selectedTenure - 10) * 0.03) : 1.0;

            const finalSpread = Math.round(baseTotalSpread * subMultiplier * seniorityMult * tenureMult);
            
            // Attach merton proxyVol to company for later UI read access
            company._lastProxyVol = parseFloat(proxyVol.toFixed(2));
            company._lastMertonPhase = proxyVol > 35 ? 'DISTRESS' : 'STABLE';
            company._lastBaseSpread = baseTotalSpread;

            resolve(finalSpread);
        });
    },

    getBaseRate(company) {
        const anchor = SovereignRegistry[company.base_rate_type] || SovereignRegistry['UST'];
        const scenario = (window.NSState && window.NSState.getScenario && window.NSState.getScenario()) || {};
        return anchor.value + (currentRateShock / 100) + ((Number(scenario.rateBps) || 0) / 100);
    },

    calculateYield(company, spreadBps) {
        const baseRate = this.getBaseRate(company);
        const scenario = (window.NSState && window.NSState.getScenario && window.NSState.getScenario()) || {};
        const sovSpread = (SOVEREIGN_SPREADS[company.country] || 0) + currentSovereignShock + (company.sovereignSpread || 0) + (Number(scenario.sovereignBps) || 0);
        return (baseRate + (sovSpread / 100) + (spreadBps / 100)).toFixed(2);
    }
};

/**
 * Spread driver decomposition — splits the instrument spread into its
 * macro / market / vol / residual / seniority / tenure contributions so the
 * Sentinel Brief can show what is actually moving each name. Mirrors the
 * exact math in CreditEngine.calculateCurrentSpread so the parts reconcile
 * to the displayed spread.
 */
function getSpreadDrivers(company, isInstrumentMod = true) {
    const sharedInput = getSpreadInput(company, isInstrumentMod);
    const shared = window.SentinelSpread.computeSpread(sharedInput);
    const sharedSensitivity = company.type === 'IG' ? 0.35 : 1.0;
    const sharedResidual = Math.round(company.residual * shared.mertonScalar * sharedInput.stress * sharedSensitivity);
    const sharedMarket = Math.round(shared.marketComponent);
    const sharedVolatility = shared.baseDelta - sharedMarket - sharedResidual;
    const sharedSeniority = Math.round(shared.baseTotalSpread * (shared.subMultiplier * shared.seniorityMultiplier - 1));
    const sharedAfterSeniority = shared.baseTotalSpread * shared.subMultiplier * shared.seniorityMultiplier;
    const sharedTenure = Math.round(sharedAfterSeniority * (shared.tenureMultiplier - 1));
    const sharedTotal = shared.finalSpread;
    const sharedPct = (bps) => sharedTotal > 0 ? Math.round((bps / sharedTotal) * 100) : 0;
    return {
        anchor: shared.anchor, anchorPct: sharedPct(shared.anchor),
        market: sharedMarket, marketPct: sharedPct(sharedMarket),
        volPure: sharedVolatility, volPurePct: sharedPct(sharedVolatility),
        residual: sharedResidual, residualPct: sharedPct(sharedResidual),
        seniority: sharedSeniority, seniorityPct: sharedPct(sharedSeniority),
        tenure: sharedTenure, tenurePct: sharedPct(sharedTenure),
        total: sharedTotal, proxyVol: shared.proxyVol, mertonScalar: shared.mertonScalar,
        ratingIndexBps: sharedInput.ratingIndexBps,
        regime: shared.regime === 'DISTRESS' ? 'CONVEX' : 'LINEAR'
    };

    const sensitivity = company.type === 'IG' ? 0.35 : 1.0;
    const stress = currentBetaScaling;

    const vix = (SovereignRegistry.VIX && SovereignRegistry.VIX.date !== 'FALLBACK')
        ? SovereignRegistry.VIX.value : 15.0;
    const cFactor = Math.min(0.8, Math.max(0, (vix - 25) / 25));
    const effSectorBeta = (1 - cFactor) * company.sectorBeta + cFactor;
    const effMarketBeta = (1 - cFactor) * company.marketBeta + cFactor;

    const sectorVol = (SectorRegistry[company.sector] && SectorRegistry[company.sector].date !== 'FALLBACK')
        ? SectorRegistry[company.sector].volatility : 20.0;

    const proxyVol = (sectorVol * effSectorBeta) + company.residual;
    const mertonScalar = 1.5 + 1.0 / (1 + Math.exp(-0.4 * (proxyVol - 35)));

    const ratingIdx = SovereignRegistry[company.rating];
    const ratingDateOk = ratingIdx && ratingIdx.date !== 'FALLBACK';
    const ratingIndexBps = ratingDateOk ? Math.round(ratingIdx.value * 100) : null;
    const anchor = Math.max(company.baseSpread, ratingIndexBps || 0);

    // Volatility leg splits cleanly because proxyVol = sectorVol*effBeta + residual.
    const volPureBps = Math.round(sectorVol * effSectorBeta * mertonScalar * stress * sensitivity);
    const residualBps = Math.round(company.residual * mertonScalar * stress * sensitivity);
    const marketBps = Math.round(effMarketBeta * 50 * stress * sensitivity);

    const baseTotal = anchor + marketBps + volPureBps + residualBps;

    // Instrument modifiers (seniority + tenure compound multiplicatively).
    const isSubordinated = (isInstrumentMod && selectedSeniority === 'Subordinated');
    const subMult = isSubordinated ? (1.5 + (baseTotal / 200)) : 1.0;
    const senMult = (isInstrumentMod && !isSubordinated) ? SENIORITY_MULTIPLIERS[selectedSeniority] : 1.0;
    const tenureMult = isInstrumentMod ? (1 + (selectedTenure - 10) * 0.03) : 1.0;

    const seniorityBps = Math.round(baseTotal * (subMult * senMult - 1));
    const afterSeniority = baseTotal * subMult * senMult;
    const tenureBps = Math.round(afterSeniority * (tenureMult - 1));

    const total = baseTotal + seniorityBps + tenureBps;
    const pct = (bps) => total > 0 ? Math.round((bps / total) * 100) : 0;

    return {
        anchor, anchorPct: pct(anchor),
        market: marketBps, marketPct: pct(marketBps),
        volPure: volPureBps, volPurePct: pct(volPureBps),
        residual: residualBps, residualPct: pct(residualBps),
        seniority: seniorityBps, seniorityPct: pct(seniorityBps),
        tenure: tenureBps, tenurePct: pct(tenureBps),
        total,
        proxyVol, mertonScalar,
        ratingIndexBps,
        regime: proxyVol > 35 ? 'CONVEX' : 'LINEAR'
    };
}

function getPeerRank(company) {
    const peers = COMPANIES.filter(c => c.sector === company.sector && c.type === company.type);
    const sorted = [...peers].sort((a, b) =>
        (a._lastBaseSpread || a.baseSpread) - (b._lastBaseSpread || b.baseSpread)
    );
    const rank = sorted.findIndex(c => c.ticker === company.ticker) + 1;
    return { rank, total: peers.length };
}

const SPREAD_HISTORY_MAX = 5; // minutes of rolling history
function snapshotSpreadHistory() {
    COMPANIES.forEach(c => {
        const cur = c._lastBaseSpread || c.baseSpread;
        c._spreadHistory = c._spreadHistory || [];
        c._spreadHistory.push(cur);
        if (c._spreadHistory.length > SPREAD_HISTORY_MAX) c._spreadHistory.shift();
    });
}

function getTrend(company) {
    const hist = company._spreadHistory || [];
    const cur = company._lastBaseSpread || company.baseSpread;
    if (hist.length < 2) return { direction: 'building', delta: 0, minutes: hist.length };
    const oldest = hist[0];
    const delta = cur - oldest;
    const minutes = hist.length;
    if (Math.abs(delta) < 5) return { direction: 'stable', delta, minutes };
    return { direction: delta > 0 ? 'widening' : 'tightening', delta, minutes };
}

/**
 * Anchor verification — quarterly cadence. lastVerified is the date the
 * rating bucket AND baseSpread were last manually re-checked against a
 * primary source (see SENTINEL-CALIBRATION.md).
 */
function daysSince(dateStr) {
    if (!dateStr) return Infinity;
    const ms = new Date(dateStr).getTime();
    if (isNaN(ms)) return Infinity;
    return Math.floor((Date.now() - ms) / 86400000);
}

function getVerificationStatus(company) {
    const days = daysSince(company.lastVerified);
    if (days < VERIF_FRESH_DAYS) return { tier: 'fresh', days, color: 'text-neon-green', label: `${days}d ago` };
    if (days < VERIF_AGING_DAYS) return { tier: 'aging', days, color: 'text-amber-400', label: `${days}d ago — refresh due` };
    return { tier: 'stale', days, color: 'text-red-400', label: `${days}d ago — OVERDUE` };
}

/**
 * Load-time validation — flags transcription errors (out-of-band baseSpread)
 * and missing rating buckets. Runs once at init; results land in the console
 * so a developer notices stale or fat-fingered values without crashing the UI.
 */
function validateAnchors() {
    const issues = [];
    COMPANIES.forEach(c => {
        const band = RATING_BANDS[c.rating];
        if (!band) {
            issues.push(`${c.ticker} (${c.rating}): no validation band for rating bucket`);
            return;
        }
        if (c.baseSpread < band.min || c.baseSpread > band.max) {
            issues.push(`${c.ticker} (${c.rating}): baseSpread ${c.baseSpread} bps outside [${band.min}, ${band.max}]`);
        }
    });
    if (issues.length === 0) {
        console.log(`[Sentinel] ${COMPANIES.length} baseSpreads validated within rating bands.`);
    } else {
        console.warn(`[Sentinel] ${issues.length} anchor validation issue(s):`);
        issues.forEach(i => console.warn('  · ' + i));
    }
}

/**
 * FRED API Live Sync
 */
async function fetchSovereignAnchors() {
    const indicator = document.getElementById('fred-indicator');
    console.log('Initiating FRED Live Sync...');
    
    let synchronizedCount = 0;
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
                synchronizedCount++;
                console.log(`Synced ${type}: ${data.value}% (v. ${data.date})`);
            }
        } catch (error) {
            console.warn(`FRED Sync failed for ${type}.`, error);
        }
    }

    if (synchronizedCount > 0) {
        COMPANIES.forEach(c => c.residual = 0);
        lastFredSync = Date.now();
        if (indicator) {
            indicator.classList.remove('text-gray-500');
            indicator.classList.add('text-neon-green');
        }
        updateStalenessIndicators();
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
            const response = await fetch(`/api/alpha-proxy?symbol=${symbol}`);
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

    const indicator = document.getElementById('alpha-indicator');
    if (synchronizedCount > 0) {
        lastAlphaSync = Date.now();
        if (indicator) {
            indicator.classList.remove('text-gray-500');
            indicator.classList.add('text-neon-green');
        }
        updateStalenessIndicators();
        triggerGlobalRefresh();
    } else {
        if (indicator) indicator.innerText = `Sector Alpha: AlphaVantage Fallback (Offline)`;
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

    let calibSuccess = false;
    for (const company of targetCompanies) {
        try {
            const response = await fetch(`/api/yahoo-proxy?symbol=${company.ticker}`);
            const data = await response.json();
            
            if (response.ok && data.volatility) {
                calibSuccess = true;
                const actualVol = data.volatility;
                const canonicalCalibration = window.SentinelSpread.computeSpread(getSpreadInput(company));
                const proxyVol = canonicalCalibration.proxyVol;
                
                // Calculate proxy volatility
                const vix = SovereignRegistry.VIX && SovereignRegistry.VIX.value !== 'FALLBACK' ? SovereignRegistry.VIX.value : 15.0;
                const cFactor = Math.min(0.8, Math.max(0, (vix - 25) / 25));
                const effectiveSectorBeta = (1 - cFactor) * company.sectorBeta + (cFactor * 1.0);

                const sectorVol = SectorRegistry[company.sector] && SectorRegistry[company.sector].volatility !== 'FALLBACK' 
                    ? SectorRegistry[company.sector].volatility 
                    : 20.0;
                
                const legacyProxyVol = (sectorVol * effectiveSectorBeta) + company.residual;
                
                // Error Margin (Volatility %)
                const volError = actualVol - proxyVol;
                
                // residual is consumed by proxyVol, so it remains in annualized
                // volatility percentage points. Converting it to bps here would
                // mix units and distort every later spread calculation.
                
                // Auto-Calibration Priority & Trigger
                company._lastCalibrated = new Date().toLocaleTimeString();
                
                if (Math.abs(data.dailyPriceChangePct || 0) > 3.5) {
                    company._marketPulse = company._lastMertonPhase === 'DISTRESS' ? 'CONVEX TRIGGER' : 'VOL SPIKE';
                } else {
                    company._marketPulse = 'STABLE';
                }
                
                // Lerp Smoothing Logic (5 seconds = 50 frames of 100ms)
                const targetResidual = window.SentinelSpread.nextResidual(company.residual, actualVol, proxyVol);
                const startResidual = company.residual;
                const diff = targetResidual - startResidual;
                const steps = 50;
                let currentStep = 0;
                
                const lerpInterval = setInterval(() => {
                    currentStep++;
                    company.residual = startResidual + (diff * (currentStep / steps));
                    triggerGlobalRefresh();
                    if (currentStep >= steps) clearInterval(lerpInterval);
                }, 100);
                
                console.log(`[Auto-Calibrate] ${company.ticker}: Actual Vol=${actualVol}%, Proxy Vol=${proxyVol.toFixed(2)}%. Target residual=${targetResidual.toFixed(2)} vol pts. Pulse: ${company._marketPulse}`);
            }
        } catch (error) {
            console.warn(`Auto-Calibration failed for ${company.ticker}.`, error);
        }
    }

    const indicator = document.getElementById('yahoo-indicator');
    if (calibSuccess) {
        if (indicator) {
            indicator.innerText = `Calibration: YFinance Live (v. ${new Date().toISOString().split('T')[0]})`;
            indicator.classList.remove('text-gray-500');
            indicator.classList.add('text-neon-green');
        }
    } else {
        if (indicator) indicator.innerText = `Calibration: YFinance Fallback (Offline)`;
    }
}

// --- Live Fundamentals (Finnhub stock/metric) ---
// Tickers with exchange suffixes (e.g. .MC, .MI, .DE, .PA, .L) are EU-listed;
// Finnhub free tier does not cover them so we skip rather than waste a call.
let _fundamentalsStagger = 0;

async function loadFundamentals(company) {
    if (company._fundamentalsLoaded) return;
    if (company.netLeverage !== null && company.interestCoverage !== null) return;
    if (company.ticker.includes('.')) return;
    company._fundamentalsLoaded = true;
    const myDelay = (_fundamentalsStagger++) * 2200;
    if (myDelay > 0) await new Promise(r => setTimeout(r, myDelay));
    try {
        const r = await fetch(`/api/finnhub-proxy?endpoint=stock%2Fmetric&symbol=${encodeURIComponent(company.ticker)}&metric=all`);
        if (!r.ok) return;
        const data = await r.json();
        const m = data?.metric;
        if (!m) return;
        if (company.interestCoverage === null) {
            const ic = m['netInterestCoverageAnnual'] ?? m['interestCoverageAnnual'];
            if (typeof ic === 'number' && isFinite(ic)) company.interestCoverage = ic;
        }
        if (company.netLeverage === null) {
            const nd = m['netDebtAnnual'], eb = m['ebitdaAnnual'];
            if (typeof nd === 'number' && typeof eb === 'number' && eb > 0) {
                company.netLeverage = nd / eb;
            }
        }
        const card = document.getElementById(`card-${company.ticker}`);
        if (!card) return;
        const nlEl = card.querySelector('.net-leverage-val');
        const icEl = card.querySelector('.int-coverage-val');
        if (nlEl) nlEl.textContent = company.netLeverage !== null ? company.netLeverage.toFixed(1) + 'x' : '—';
        if (icEl) icEl.textContent = company.interestCoverage !== null ? company.interestCoverage.toFixed(1) + 'x' : '—';
    } catch (_) {}
}

// --- 30-Day G-Spread History (Vercel KV) ---

function tryPostDailySpread(_company, _spread) {
    // Phase 1 (security): the browser is now READ-ONLY for spread history.
    // Writes are server-only and require Authorization: Bearer SNAPSHOT_WRITE_SECRET
    // (see api/sentinel-history.js). A client POST would now be rejected with 401,
    // so we no longer attempt it. Daily snapshots are repopulated server-side.
    return;
}

function buildSparklineSvg(history) {
    if (!history || history.length < 2) return '';
    const values = history.map(p => p.spread);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const W = 100, H = 16;
    const pts = values.map((v, i) => {
        const x = (i / (values.length - 1)) * W;
        const y = H - ((v - min) / range) * H;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const colour = values[values.length - 1] > values[0] ? '#FFD700' : '#39FF14';
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:16px;display:block"><polyline points="${pts}" fill="none" stroke="${colour}" stroke-width="1.5" stroke-opacity="0.75" stroke-linejoin="round"/></svg>`;
}

async function loadSparkline(company) {
    if (company._sparklineLoaded) return;
    company._sparklineLoaded = true;
    try {
        const r = await fetch(`/api/sentinel-history?ticker=${encodeURIComponent(company.ticker)}`);
        if (!r.ok) return;
        const history = await r.json();
        if (!Array.isArray(history) || history.length < 2) return;
        const card = document.getElementById(`card-${company.ticker}`);
        if (!card) return;
        const svgEl = card.querySelector('.sparkline-svg');
        const labelEl = card.querySelector('.sparkline-label');
        if (svgEl) svgEl.innerHTML = buildSparklineSvg(history);
        if (labelEl) {
            const delta = history[history.length - 1].spread - history[0].spread;
            labelEl.textContent = (delta >= 0 ? '+' : '') + delta + ' bps';
            labelEl.style.color = delta > 0 ? '#FFD700' : '#39FF14';
        }
    } catch (_) {}
}

/**
 * Initialization
 */
function init() {
    validateAnchors();
    setupEventListeners();
    renderGrid(); // Render instantly with fallbacks
    loadSentinelGovernance();
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

    // Refresh staleness indicators every minute so the "synced Xh Ym ago"
    // text counts up live without waiting for the next data sync.
    setInterval(updateStalenessIndicators, 60 * 1000);

    // Spread-history snapshots feed the Sentinel Brief's Trend row.
    // First snapshot at ~6s gives the batch loop one full pass to populate
    // _lastBaseSpread on every card before we start sampling.
    setTimeout(snapshotSpreadHistory, 6000);
    setInterval(snapshotSpreadHistory, 60 * 1000);

    // Scenario Lab is a separate, explicit stress layer. Refresh only after
    // its controls settle, so slider input never recreates charts or floods
    // the client with recalculation work.
    if (window.NSState) {
        let scenarioRefreshTimer = null;
        window.NSState.on('scenario', () => {
            clearTimeout(scenarioRefreshTimer);
            scenarioRefreshTimer = setTimeout(triggerGlobalRefresh, 180);
        });
    }

    // Deep-link support: ?ticker=X opens that company's modal on load.
    // Used by FinVault report pages' "Open in Sentinel" button.
    const urlParams = new URLSearchParams(window.location.search);
    const requestedTicker = urlParams.get('ticker');
    if (requestedTicker) {
        const company = COMPANIES.find(c => c.ticker === requestedTicker);
        if (company) {
            // Wait briefly so the card grid finishes rendering before
            // we open the modal (openModal pulls live values off cards).
            setTimeout(() => openModal(requestedTicker), 250);
        }
    }
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
    const alphaSection = alphaGrid.parentElement;
    const betaSection = betaGrid.parentElement;
    
    alphaGrid.innerHTML = '';
    betaGrid.innerHTML = '';

    const searchTerm = filterText.toLowerCase().trim();
    
    // Filtering logic
    let filtered = COMPANIES.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm) || c.ticker.toLowerCase().includes(searchTerm);
        const matchesSector = activeFilters.sector === 'all' || c.sector === activeFilters.sector;
        const currentRisk = c._lastRisk || getRiskLevel(c.baseSpread);
        const matchesRisk = activeFilters.risk === 'all' || currentRisk === activeFilters.risk;
        return matchesSearch && matchesSector && matchesRisk;
    });

    // Sorting logic
    if (activeSort === 'yield-asc') {
        filtered.sort((a, b) => (a._lastYield || 0) - (b._lastYield || 0));
    } else if (activeSort === 'yield-desc') {
        filtered.sort((a, b) => (b._lastYield || 0) - (a._lastYield || 0));
    }

    filtered.forEach(company => {
        const isAlpha = (company.sector === 'Energy' || company.sector === 'Utilities');
        const container = isAlpha ? alphaGrid : betaGrid;
        
        const card = createCard(company);
        container.appendChild(card);
        updateCardData(company.ticker);
    });

    // Toggle visibility of empty sections
    if (alphaSection) alphaSection.style.display = alphaGrid.children.length > 0 ? 'block' : 'none';
    if (betaSection) betaSection.style.display = betaGrid.children.length > 0 ? 'block' : 'none';
}

function createCard(company) {
    const card = document.createElement('div');
    card.className = 'bg-card-bg neon-border rounded-lg p-5 cursor-pointer flex flex-col transition-all group animate-in fade-in duration-300 relative';
    card.id = `card-${company.ticker}`;
    card.setAttribute('onclick', `openModal('${company.ticker}')`);
    // Umami custom event — track Sentinel company opens (the core in-page action).
    card.setAttribute('data-umami-event', 'sentinel-open');
    card.setAttribute('data-umami-event-ticker', company.ticker);
    card.innerHTML = `
        <span class="stale-dot hidden absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" title="Anchor refresh overdue — see SENTINEL-CALIBRATION.md"></span>
        <div class="flex justify-between items-start mb-4">
            <div>
                <h3 class="font-black text-xl tracking-tight">${escHtml(company.ticker)}</h3>
                <p class="text-[10px] text-gray-500 uppercase tracking-widest">${escHtml(company.name)}</p>
            </div>
            <div class="text-right">
                <span class="text-[10px] bg-neon-green/10 text-neon-green px-2 py-0.5 rounded border border-neon-green/20 font-mono tracking-tighter">${escHtml(company.type)}</span>
                <p class="text-[10px] text-gray-600 mt-1 font-mono uppercase tracking-widest update-time">00:00:00</p>
                <div class="mt-1">
                    <span class="text-[8px] bg-amber-500/10 text-amber-500 px-1 rounded border border-amber-500/20 font-mono hidden benchmark-badge">--</span>
                </div>
                <div class="anchor-governance text-[8px] font-mono uppercase tracking-widest text-gray-600 mt-1">ANCHOR CHECKING</div>
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
        
        <!-- Fundamental Metrics Row -->
        <div class="grid grid-cols-3 gap-2 mb-4 border-t border-white/5 pt-3">
            <div>
                <span class="text-[8px] text-gray-600 uppercase tracking-widest block mb-0.5">Net Lev.</span>
                <span class="text-xs font-mono text-gray-400 net-leverage-val">—</span>
            </div>
            <div>
                <span class="text-[8px] text-gray-600 uppercase tracking-widest block mb-0.5">Int. Cover.</span>
                <span class="text-xs font-mono text-gray-400 int-coverage-val">—</span>
            </div>
            <div>
                <span class="text-[8px] text-gray-600 uppercase tracking-widest block mb-0.5" title="Spread-implied full-loss stress proxy; not a calibrated default probability">10Y Stress</span>
                <span class="text-xs font-mono text-gray-400 pod-val">—</span>
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

        <!-- 30-Day G-Spread Sparkline -->
        <div class="mb-4">
            <div class="flex justify-between items-center mb-1">
                <span class="text-[8px] text-gray-600 uppercase tracking-widest">30D Trend</span>
                <span class="text-[8px] font-mono text-gray-600 sparkline-label">—</span>
            </div>
            <div class="sparkline-svg" style="height:16px;"></div>
        </div>

        <div class="mt-auto pt-4 border-t border-white/5 flex flex-col gap-2">
            <div class="flex justify-between items-center">
                <span class="text-xs text-neon-green uppercase font-mono tracking-widest font-bold glow-text">Yield Stack</span>
                <span class="text-lg text-white font-mono font-bold yield-val glow-text">--%</span>
            </div>
            <div class="flex justify-between items-center mt-2 border-t border-white/5 pt-2">
                <span class="text-[9px] text-gray-500 uppercase tracking-widest">Calibrated: <span class="text-gray-300 font-mono last-calibrated">--</span></span>
                <span class="text-[9px] px-1.5 py-0.5 rounded border font-mono tracking-tighter market-pulse-badge uppercase bg-gray-500/10 text-gray-500 border-gray-500/30">
                    STABLE
                </span>
            </div>
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

    if (spreadVal) {
        const arrow = delta > 2 ? ' <span class="text-amber-500/60 text-[10px]">▲</span>'
                    : delta < -2 ? ' <span class="text-neon-green/50 text-[10px]">▼</span>'
                    : '';
        spreadVal.innerHTML = `${spread} bps${arrow}`;
    }
    if (yieldEl) yieldEl.innerText = `${yieldVal}%`;
    if (riskVal) {
        riskVal.innerText = getRiskLevel(spread);
        riskVal.className = `text-sm font-bold risk-val ${getRiskColor(spread)}`;
    }
    if (updateTime) {
        updateTime.innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    }

    company._lastYield = parseFloat(yieldVal);
    company._lastRisk = getRiskLevel(spread);
    company._lastSpread = spread;

    tryPostDailySpread(company, spread);
    loadSparkline(company);
    loadFundamentals(company);

    const lastCalibrated = card.querySelector('.last-calibrated');
    const marketPulse = card.querySelector('.market-pulse-badge');
    
    if (lastCalibrated) {
        lastCalibrated.innerText = company._lastCalibrated || '--';
    }
    
    if (marketPulse) {
        const pulseStatus = company._marketPulse || 'STABLE';
        marketPulse.innerText = pulseStatus;
        if (pulseStatus === 'CONVEX TRIGGER') {
            marketPulse.className = 'text-[9px] px-1.5 py-0.5 rounded border font-mono tracking-tighter market-pulse-badge uppercase bg-red-500/10 text-red-500 border-red-500/30 crt-text';
        } else if (pulseStatus === 'VOL SPIKE') {
            marketPulse.className = 'text-[9px] px-1.5 py-0.5 rounded border font-mono tracking-tighter market-pulse-badge uppercase bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
        } else {
            marketPulse.className = 'text-[9px] px-1.5 py-0.5 rounded border font-mono tracking-tighter market-pulse-badge uppercase bg-gray-500/10 text-gray-500 border-gray-500/30';
        }
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

    // Anchor-staleness dot — visible only when verification is overdue.
    const staleDot = card.querySelector('.stale-dot');
    if (staleDot) {
        const verif = getVerificationStatus(company);
        if (verif.tier === 'stale') staleDot.classList.remove('hidden');
        else staleDot.classList.add('hidden');
    }
    updateAnchorGovernance(company.ticker);

    // Feature 1 — Static fundamentals
    const nlEl = card.querySelector('.net-leverage-val');
    const icEl = card.querySelector('.int-coverage-val');
    if (nlEl) nlEl.textContent = company.netLeverage !== null ? company.netLeverage.toFixed(1) + 'x' : '—';
    if (icEl) icEl.textContent = company.interestCoverage !== null ? company.interestCoverage.toFixed(1) + 'x' : '—';

    // Feature 2 — Probability of Default (10Y, risk-neutral hazard rate)
    const pod = window.SentinelSpread.defaultStressProxy(spread) * 100;
    const podEl = card.querySelector('.pod-val');
    if (podEl) podEl.textContent = pod.toFixed(1) + '%';

    // Feature 4 — Refresh heatmap if visible
    const heatmapContainer = document.getElementById('heatmap-container');
    if (heatmapContainer && !heatmapContainer.classList.contains('hidden')) {
        buildHeatmap();
    }
}

/**
 * High-Scale Engine (Dual-Frequency)
 */
function startHighScaleEngine() {
    // 1. Alternating Sector Batches (Every 5s)
    setInterval(cycleSectorBatch, FAST_REFRESH_MS);

    // A focused issuer is refreshed only when its scenario/data changes. A
    // five-second synthetic update made the quote and waterfall visibly jump.

    // 2. Background sweep. Do not scan the fleet sixty times between eligible
    // one-minute refreshes.
    setInterval(throttleBackground, SLOW_REFRESH_MS);
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
        // Do not invent price movement between data refreshes. Calibration and
        // macro synchronisation own residual changes; this cadence only keeps
        // the bounded DOM work evenly distributed across the card grid.
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
        // Same bounded OU jitter as cycleSectorBatch — prevents the focused
        // company's residual from drifting unboundedly while the modal is open.
        activeModalCompany.residual = activeModalCompany.residual * 0.95 + (Math.random() * 1.0 - 0.5);
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

// RAF-coalesced: rapid slider drags fire `input` events at ~60Hz, each of which
// previously triggered a full 62-card recompute. Now multiple calls within the
// same frame collapse to one refresh.
let _refreshPending = false;
function triggerGlobalRefresh() {
    if (_refreshPending) return;
    _refreshPending = true;
    requestAnimationFrame(() => {
        _refreshPending = false;
        COMPANIES.forEach(c => updateCardData(c.ticker));
        if (activeModalCompany) updateModal();
        scanForContagion();
    });
}

/**
 * Risks & Modals (Standard logic retained/optimized)
 */
function scanForContagion() {
    const active = COMPANIES.some(c => {
        const spread = window.SentinelSpread.computeSpread(getSpreadInput(c, false)).finalSpread;
        return spread * SENIORITY_MULTIPLIERS.Subordinated > 1000;
    });

    if (active) document.body.classList.add('contagion-alert');
    else document.body.classList.remove('contagion-alert');
}

// Rebased thresholds: 400 bps is normal BBB-/BB+ territory, not "critical".
// Real distress begins around 800-1000 bps. New ranges align with market practice.
function getRiskLevel(spread) {
    if (spread < 200) return 'NOMINAL';
    if (spread < 400) return 'CAUTION';
    if (spread < 800) return 'ELEVATED';
    return 'CRITICAL';
}

function getRiskColor(spread) {
    if (spread < 200) return 'text-neon-green';
    if (spread < 400) return 'text-yellow-400';
    if (spread < 800) return 'text-orange-500';
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
    waterfallSignature = null;
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

    // Feature 5 — Static fundamentals in modal
    const modalNl = document.getElementById('modal-net-leverage');
    const modalIc = document.getElementById('modal-int-coverage');
    if (modalNl) modalNl.textContent = activeModalCompany.netLeverage !== null ? activeModalCompany.netLeverage.toFixed(1) + 'x' : '—';
    if (modalIc) modalIc.textContent = activeModalCompany.interestCoverage !== null ? activeModalCompany.interestCoverage.toFixed(1) + 'x' : '—';

    // Critical Risk Validation on Modal
    const modalContent = document.querySelector('#focus-modal > div');
    if (delta > 250) {
        modalContent.classList.add('critical-risk');
    } else {
        modalContent.classList.remove('critical-risk');
    }
    
    // Sentinel Brief — structured layout
    const briefEl = document.getElementById('sentinel-brief');
    if (briefEl) {
        const briefData = buildSentinelBrief(activeModalCompany, instrumentSpread);
        briefEl.innerHTML = renderSentinelBrief(briefData);
    }

    renderWaterfall(activeModalCompany);
}

/**
 * Sentinel Brief — structured layout (headline + spread/yield/peer rows +
 * driver bars + trend/regime/watch). Builds a data object, then a renderer
 * turns it into HTML. Keeps presentation separable from the underlying math.
 */
function buildSentinelBrief(company, instrumentSpread) {
    const drivers = getSpreadDrivers(company, true);
    const peer = getPeerRank(company);
    const trend = getTrend(company);
    const isDistress = drivers.proxyVol > 35;

    const benchmark = getBenchmark(company);
    const benchmarkPct = CreditEngine.getBaseRate(company);
    const yieldStr = CreditEngine.calculateYield(company, instrumentSpread);
    const yieldPct = parseFloat(yieldStr);
    const spreadVsBench = Math.round((yieldPct - benchmarkPct) * 100);

    const ratingIndexBps = drivers.ratingIndexBps;
    const issuerPremium = ratingIndexBps !== null ? instrumentSpread - ratingIndexBps : null;

    // Headline — state-dependent, plain-English first
    let headline;
    if (isDistress) {
        const mult = ratingIndexBps && ratingIndexBps > 0
            ? `${(instrumentSpread / ratingIndexBps).toFixed(1)}× the ${company.rating} index average`
            : `well above benchmark`;
        headline = `Vol-driven distress — losses now compound rather than scale linearly. Spread ${mult}.`;
    } else if (Math.abs(trend.delta) > 50 && trend.minutes >= 2) {
        const verb = trend.direction === 'widening' ? 'Widening' : 'Tightening';
        const sign = trend.delta > 0 ? '+' : '';
        headline = `${verb} rapidly — ${sign}${trend.delta} bps over last ${trend.minutes} min.`;
    } else if (peer.total >= 4 && peer.rank / peer.total > 0.75) {
        headline = `Wider than ${peer.total - peer.rank} of ${peer.total - 1} ${company.sector} ${company.type} peers — elevated relative pricing.`;
    } else if (ratingIndexBps !== null) {
        headline = `Pricing in line with ${company.rating} benchmark — no idiosyncratic stress.`;
    } else {
        headline = `Awaiting FRED rating-index sync — brief running on static anchors.`;
    }

    // Watch — forward-looking, conditional
    let watch;
    if (isDistress) {
        watch = `Spread > 1000 bps would trigger systemic contagion banner.`;
    } else if (drivers.proxyVol > 28) {
        const vix = (SovereignRegistry.VIX && SovereignRegistry.VIX.date !== 'FALLBACK') ? SovereignRegistry.VIX.value : 15.0;
        watch = `VIX > 30 (currently ${vix.toFixed(1)}) would push this name into convex regime.`;
    } else {
        const sectorThreshold = company.sectorBeta > 0 ? Math.round(35 / company.sectorBeta) : 35;
        watch = `Stable regime — would require sector vol > ${sectorThreshold}% to enter distress.`;
    }

    return {
        headline,
        isDistress,
        spread: instrumentSpread,
        baseSpread: drivers.total - drivers.seniority - drivers.tenure,
        ratingIndexBps,
        ratingLabel: company.rating,
        issuerPremium,
        yieldPct,
        benchmark,
        benchmarkPct,
        spreadVsBench,
        peer,
        peerLabel: `${company.sector} ${company.type}`,
        drivers,
        trend,
        watch,
        lastCalibrated: company._lastCalibrated || null,
        verification: getVerificationStatus(company),
        verifiedOn: company.lastVerified || null
    };
}

function driverBar(label, pct) {
    const cells = 22;
    const filled = Math.max(0, Math.min(cells, Math.round((pct / 100) * cells)));
    const bar = '▓'.repeat(filled) + '░'.repeat(cells - filled);
    return `
        <div class="flex items-center gap-3 text-[10px] leading-tight">
            <span class="text-neon-green/70 font-mono whitespace-nowrap">${bar}</span>
            <span class="text-gray-400 flex-1">${label}</span>
            <span class="text-white font-bold w-10 text-right">${pct}%</span>
        </div>`;
}

function ordinalSuffix(n) {
    const v = n % 100;
    if (v >= 11 && v <= 13) return n + 'th';
    switch (n % 10) {
        case 1: return n + 'st';
        case 2: return n + 'nd';
        case 3: return n + 'rd';
        default: return n + 'th';
    }
}

function renderSentinelBrief(d) {
    const stateClasses = d.isDistress
        ? 'text-red-400 border-red-500/30 bg-red-500/10'
        : 'text-neon-green border-neon-green/30 bg-neon-green/10';
    const stateIcon = d.isDistress ? '⚠' : '●';
    const stateLabel = d.isDistress ? 'ELEVATED' : 'STABLE';

    const indexRow = (d.ratingIndexBps !== null)
        ? `vs ${d.ratingLabel} index ${d.ratingIndexBps} bps · ${d.issuerPremium >= 0 ? '+' : ''}${d.issuerPremium} bps issuer`
        : `vs ${d.ratingLabel} index (awaiting FRED sync)`;

    let peerSuffix;
    if (d.peer.total === 1) peerSuffix = 'sole name in bucket';
    else if (d.peer.rank === 1) peerSuffix = `tightest in ${d.peerLabel}`;
    else if (d.peer.rank === d.peer.total) peerSuffix = `widest in ${d.peerLabel}`;
    else peerSuffix = `${ordinalSuffix(d.peer.rank)}-tightest in ${d.peerLabel}`;

    let trendText, trendColor;
    if (d.trend.direction === 'building') {
        trendText = 'Building history…';
        trendColor = 'text-gray-500';
    } else if (d.trend.direction === 'stable') {
        trendText = `Stable — ±${Math.abs(d.trend.delta)} bps over last ${d.trend.minutes} min`;
        trendColor = 'text-gray-400';
    } else {
        const arrow = d.trend.direction === 'widening' ? '↑' : '↓';
        const verb = d.trend.direction === 'widening' ? 'Widening' : 'Tightening';
        const sign = d.trend.delta > 0 ? '+' : '';
        trendText = `${verb} ${arrow} ${sign}${d.trend.delta} bps over last ${d.trend.minutes} min`;
        trendColor = d.trend.direction === 'widening' ? 'text-amber-400' : 'text-neon-green';
    }

    const regimeRow = d.isDistress ? `
        <div class="flex justify-between gap-3 text-[10px]">
            <span class="text-gray-500 uppercase tracking-widest shrink-0">Regime</span>
            <span class="text-amber-400 text-right">Convex — vol > 35% threshold; further shocks drive disproportionate widening</span>
        </div>` : '';

    // Only show instrument-mod drivers when non-zero (default seniority + 10Y tenure = 0)
    const seniorityBar = Math.abs(d.drivers.seniority) > 2 ? driverBar('Seniority delta', d.drivers.seniorityPct) : '';
    const tenureBar = Math.abs(d.drivers.tenure) > 2 ? driverBar('Duration delta', d.drivers.tenurePct) : '';

    return `
        <div class="space-y-3">
            <div class="flex items-center gap-2">
                <span class="${stateClasses} px-1.5 py-0.5 rounded border text-[9px] tracking-widest uppercase font-bold">${stateIcon} ${stateLabel}</span>
            </div>
            <p class="text-neon-green leading-snug">${d.headline}</p>

            <div class="space-y-1 pt-2 border-t border-white/5">
                <div class="grid grid-cols-[80px_70px_1fr] gap-2 text-[10px] items-baseline">
                    <span class="text-gray-500 uppercase tracking-widest">Spread</span>
                    <span class="text-white font-bold">${d.spread} bps</span>
                    <span class="text-gray-500">${indexRow}</span>
                </div>
                <div class="grid grid-cols-[80px_70px_1fr] gap-2 text-[10px] items-baseline">
                    <span class="text-gray-500 uppercase tracking-widest">Yield</span>
                    <span class="text-white font-bold">${d.yieldPct.toFixed(2)}%</span>
                    <span class="text-gray-500">vs ${d.benchmark} 10Y ${d.benchmarkPct.toFixed(2)}% · +${d.spreadVsBench} bps</span>
                </div>
                <div class="grid grid-cols-[80px_70px_1fr] gap-2 text-[10px] items-baseline">
                    <span class="text-gray-500 uppercase tracking-widest">Peer Rank</span>
                    <span class="text-white font-bold">${d.peer.rank} / ${d.peer.total}</span>
                    <span class="text-gray-500">${peerSuffix}</span>
                </div>
            </div>

            <div class="pt-2 border-t border-white/5 space-y-1">
                <div class="text-[9px] text-gray-500 uppercase tracking-widest mb-1.5">Drivers</div>
                ${driverBar('Anchor (rating floor)', d.drivers.anchorPct)}
                ${driverBar('Market beta', d.drivers.marketPct)}
                ${driverBar('Volatility premium', d.drivers.volPurePct)}
                ${driverBar('Calibrated residual', d.drivers.residualPct)}
                ${seniorityBar}
                ${tenureBar}
            </div>

            <div class="space-y-1 pt-2 border-t border-white/5">
                <div class="flex justify-between gap-3 text-[10px]">
                    <span class="text-gray-500 uppercase tracking-widest shrink-0">Trend</span>
                    <span class="${trendColor} text-right">${trendText}</span>
                </div>
                ${regimeRow}
                <div class="flex justify-between gap-3 text-[10px]">
                    <span class="text-gray-500 uppercase tracking-widest shrink-0">Watch</span>
                    <span class="text-gray-400 text-right">${d.watch}</span>
                </div>
            </div>

            <div class="pt-2 border-t border-white/5 text-[9px] text-gray-600 tracking-widest uppercase space-y-0.5">
                <div>Last calibrated ${d.lastCalibrated || '—'} <span class="text-gray-700 normal-case tracking-normal">· auto vol-residual sync</span></div>
                <div>Rating + anchor verified <span class="${d.verification.color}">${d.verification.label}</span> <span class="text-gray-700 normal-case tracking-normal">· quarterly cadence</span></div>
            </div>
        </div>`;
}

// Waterfall rendering (retained/stable)
function renderWaterfall(company) {
    const canvas = document.getElementById('waterfall-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const shared = window.SentinelSpread.computeSpread(getSpreadInput(company, true));
    const sharedMarket = Math.round(shared.marketComponent);
    const sharedVolatility = shared.baseDelta - sharedMarket;
    const sharedSeniority = Math.round(shared.baseTotalSpread * (shared.subMultiplier * shared.seniorityMultiplier - 1));
    const sharedAfterSeniority = shared.baseTotalSpread * shared.subMultiplier * shared.seniorityMultiplier;
    const sharedTenure = Math.round(sharedAfterSeniority * (shared.tenureMultiplier - 1));
    const sharedLabels = ['Anchor', 'Market Beta', 'Volatility Premium', 'Seniority Delta', 'Duration Delta', 'Final Spread'];
    const sharedPoints = [];
    let sharedRunning = 0;
    for (const [label, value] of [
        ['Anchor', shared.anchor],
        ['Market Beta', sharedMarket],
        ['Volatility Premium', sharedVolatility],
        ['Seniority Delta', sharedSeniority],
        ['Duration Delta', sharedTenure]
    ]) {
        sharedPoints.push([sharedRunning, sharedRunning + value]);
        sharedRunning += value;
    }
    // Use the exact quoted result for the final bar so the explanation never
    // implies a different spread through intermediate rounding.
    sharedPoints.push([0, shared.finalSpread]);
    // Keep the expensive Chart.js canvas stable unless a visible scenario or
    // market driver changes. Residuals only change through calibration, not the
    // five-second card cadence, so a calibrated issuer remains accurately shown.
    const signature = JSON.stringify({
        ticker: company.ticker,
        betaScaling: currentBetaScaling,
        seniority: selectedSeniority,
        tenure: selectedTenure,
        ratingAnchor: SovereignRegistry[company.rating]?.value,
        sectorVolatility: SectorRegistry[company.sector]?.volatility,
        vix: SovereignRegistry.VIX?.value,
        residual: company.residual
    });
    if (waterfallChart && waterfallSignature === signature) return;

    const chartData = {
        labels: sharedLabels,
        datasets: [{
            label: 'Basis Points', data: sharedPoints,
            backgroundColor: ['rgba(255,255,255,0.2)', 'rgba(57,255,20,0.6)', 'rgba(57,255,20,0.4)', 'rgba(255,100,0,0.6)', 'rgba(0,150,255,0.6)', 'rgba(57,255,20,1)'],
            borderColor: '#39FF14', borderWidth: 1
        }]
    };
    if (waterfallChart) {
        waterfallChart.data = chartData;
        waterfallChart.update('none');
        waterfallSignature = signature;
        return;
    }

    waterfallChart = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'JetBrains Mono', size: 10 } } },
                y: { grid: { display: false }, ticks: { color: 'white', font: { family: 'JetBrains Mono', weight: 'bold', size: 11 } } }
            }
        }
    });
    waterfallSignature = signature;
    return;

    // Keep in sync with CreditEngine.calculateCurrentSpread.
    const sensitivity = company.type === 'IG' ? 0.35 : 1.0;
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

/**
 * Filter & Sort Logic
 */
window.setFilter = function(type, value) {
    activeFilters[type] = value;
    
    // Update UI state
    document.querySelectorAll('.filter-option').forEach(btn => {
        if (btn.getAttribute('data-filter-type') === type) {
            if (btn.getAttribute('data-filter-val') === value) {
                btn.classList.add('active', 'border-neon-green/50', 'text-neon-green');
                btn.classList.remove('text-gray-400', 'border-white/5');
            } else {
                btn.classList.remove('active', 'border-neon-green/50', 'text-neon-green');
                btn.classList.add('text-gray-400', 'border-white/5');
            }
        }
    });

    renderGrid(document.getElementById('company-search').value);
    updateFilterDisplay();
};

window.setSort = function(type) {
    activeSort = type;
    
    // Update UI state
    document.querySelectorAll('.sort-option').forEach(btn => {
        if (btn.id === `sort-${type}`) {
            btn.classList.add('active', 'text-neon-green');
            btn.classList.remove('text-gray-400');
        } else {
            btn.classList.remove('active', 'text-neon-green');
            btn.classList.add('text-gray-400');
        }
    });

    renderGrid(document.getElementById('company-search').value);
    updateFilterDisplay();
};

function updateFilterDisplay() {
    const display = document.getElementById('current-filter-display');
    if (!display) return;

    let parts = [];
    if (activeFilters.sector !== 'all') parts.push(activeFilters.sector);
    if (activeFilters.risk !== 'all') parts.push(activeFilters.risk);
    if (activeSort !== 'default') {
        parts.push(activeSort === 'yield-asc' ? 'Yield ↑' : 'Yield ↓');
    }

    display.innerText = parts.length > 0 ? parts.join(' | ') : 'Filter / Sort';
}

// Feature 4 — Sector Spread Heatmap
function toggleHeatmap() {
    const container = document.getElementById('heatmap-container');
    const label = document.getElementById('heatmap-toggle-label');
    if (!container || !label) return;
    const hidden = container.classList.toggle('hidden');
    label.textContent = hidden ? '▶ EXPAND' : '▼ COLLAPSE';
    if (!hidden) buildHeatmap();
}

function buildHeatmap() {
    const grid = document.getElementById('heatmap-grid');
    if (!grid) return;

    // Sort all companies by their live spread descending (fall back to baseSpread if not yet calculated)
    const sorted = [...COMPANIES].sort((a, b) => {
        const sa = a._lastSpread ?? a.baseSpread;
        const sb = b._lastSpread ?? b.baseSpread;
        return sb - sa;
    });

    grid.innerHTML = sorted.map(c => {
        const spread = c._lastSpread ?? c.baseSpread;
        const risk = getRiskLevel(spread);
        const bgColor = risk === 'NOMINAL'  ? 'rgba(57,255,20,0.12)'
                      : risk === 'CAUTION'  ? 'rgba(250,204,21,0.12)'
                      : risk === 'ELEVATED' ? 'rgba(249,115,22,0.12)'
                      :                       'rgba(239,68,68,0.15)';
        const borderColor = risk === 'NOMINAL'  ? 'rgba(57,255,20,0.3)'
                          : risk === 'CAUTION'  ? 'rgba(250,204,21,0.3)'
                          : risk === 'ELEVATED' ? 'rgba(249,115,22,0.3)'
                          :                       'rgba(239,68,68,0.4)';
        const textColor = risk === 'NOMINAL'  ? '#39FF14'
                        : risk === 'CAUTION'  ? '#facc15'
                        : risk === 'ELEVATED' ? '#f97316'
                        :                       '#ef4444';
        return `<div onclick="openModal('${c.ticker}')" style="background:${bgColor}; border:1px solid ${borderColor}; border-radius:4px; padding:5px 8px; cursor:pointer; min-width:70px; transition:all 0.15s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
            <div style="font-family:'JetBrains Mono',monospace; font-size:9px; color:rgba(255,255,255,0.8); font-weight:700; letter-spacing:0.5px;">${c.ticker}</div>
            <div style="font-family:'JetBrains Mono',monospace; font-size:10px; color:${textColor}; font-weight:700; margin-top:2px;">${spread} bps</div>
        </div>`;
    }).join('');
}
