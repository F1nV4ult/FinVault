#!/usr/bin/env node
/**
 * Build data/universe.json from the three current sources of truth:
 *   - sentinel.v2.js     (COMPANIES array — credit-math metadata)
 *   - physics-config.json (Osiris physics params)
 *   - report.html         (FinVault skeletonReports + companyData)
 *
 * Emits one entry per ticker keyed by the canonical Yahoo symbol, with
 * the bare cross-tool fields (name, sector, region, country, exchanges,
 * finvaultSlug, pdfReady) plus pointers into each tool's per-ticker data.
 *
 * Idempotent — re-run after any source change. The output file is the
 * authoritative reference for cross-tool features (global ticker search,
 * deep links, per-company synthesis page). Tool-specific data still
 * lives in its native source for now; migration to read-from-universe
 * is a follow-on refactor.
 */
const fs = require('fs');
const path = require('path');
const { parseLiteral } = require('./lib/safe-literal');
const { validateUniverse } = require('./lib/universe-schema');

const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');

// ─── Hand-mapped slugs for the 9 fully-built reports ───────────────────
// These use descriptive slugs (chevron, exxonmobil, …) not ticker-derived
// ones, so we map them explicitly to bridge ticker ↔ FinVault URL.
const KNOWN_REPORTS = {
    'XOM':    { slug: 'exxonmobil',       tv: 'NYSE:XOM',  industry: 'Integrated Oil & Gas',                        pdfReady: true },
    'CVX':    { slug: 'chevron',          tv: 'NYSE:CVX',  industry: 'Integrated Oil & Gas',                        pdfReady: true },
    'IBE.MC': { slug: 'iberdrola',        tv: 'BME:IBE',   industry: 'Integrated Utilities & Renewable Energy',    pdfReady: true },
    'LMT':    { slug: 'lockheedmartin',   tv: 'NYSE:LMT',  industry: 'Aerospace & Defense',                         pdfReady: true },
    'NOC':    { slug: 'northropgrumman',  tv: 'NYSE:NOC',  industry: 'Aerospace & Defense',                         pdfReady: true },
    'GD':     { slug: 'generaldynamics',  tv: 'NYSE:GD',   industry: 'Aerospace & Defense',                         pdfReady: true },
    'LHX':    { slug: 'l3harris',         tv: 'NYSE:LHX',  industry: 'Aerospace & Defense',                         pdfReady: true },
    'RTX':    { slug: 'rtx',              tv: 'NYSE:RTX',  industry: 'Aerospace & Defense',                         pdfReady: true },
    'RHM.DE': { slug: 'rheinmetall',      tv: 'XETR:RHM',  industry: 'Aerospace & Defense',                         pdfReady: true }
};

// ─── 1. Sentinel COMPANIES (canonical ticker list) ─────────────────────
const sentinelSrc = fs.readFileSync(path.join(ROOT, 'sentinel.v2.js'), 'utf8');
const compMatch = sentinelSrc.match(/const COMPANIES = (\[[\s\S]*?\n\]);/);
if (!compMatch) throw new Error('Could not find COMPANIES literal in sentinel.v2.js');
const COMPANIES = parseLiteral(compMatch[1]);

// ─── 2. Osiris physics params ──────────────────────────────────────────
const physicsConfig = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'physics-config.json'), 'utf8')
);
const osirisByTicker = {};
for (const cohortName of Object.keys(physicsConfig.cohorts)) {
    const cohort = physicsConfig.cohorts[cohortName];
    for (const t of cohort.tickers) {
        osirisByTicker[t.symbol] = {
            cohort: cohortName,
            physics: cohort.physics,
            reversionSpeedTheta: t.reversionSpeedTheta || null,
            jumpFrequencyLambda: t.jumpFrequencyLambda || null,
            jumpMu: t.jumpMu || null,
            baselineVolatility: t.baselineVolatility,
            creditRating: t.creditRating,
            ratingLastVerified: t.ratingLastVerified
        };
    }
}

// ─── 3. FinVault skeletonReports (74 entries, ticker-derived slugs) ────
const reportSrc = fs.readFileSync(path.join(ROOT, 'report.html'), 'utf8');
const skelMatch = reportSrc.match(/const skeletonReports = (\[[\s\S]*?\]);/);
if (!skelMatch) throw new Error('Could not find skeletonReports in report.html');
const skeletonRows = parseLiteral(skelMatch[1]);

// Extract the 9 fully-built companyData entries so the brief page can
// render the ratios table for those names. Brace-balanced parse keeps
// the nested literal intact.
function extractObjectLiteral(src, startMarker) {
    const idx = src.indexOf(startMarker);
    if (idx === -1) return null;
    const start = src.indexOf('{', idx);
    let depth = 0;
    for (let i = start; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) return src.slice(start, i + 1);
        }
    }
    return null;
}
const cdLiteral = extractObjectLiteral(reportSrc, 'const companyData = ');
const companyDataLookup = cdLiteral ? parseLiteral(cdLiteral) : {};
// Each row: [slug, name, tvTicker, industry, yahooOverride]
const finvaultByYahoo = {};
for (const [slug, name, tvTicker, industry, yahooOverride] of skeletonRows) {
    const bare = tvTicker.split(':')[1];
    const yahoo = yahooOverride || bare;
    finvaultByYahoo[yahoo] = { slug, tvTicker, industry, pdfReady: false };
}

// ─── Merge per Sentinel ticker ─────────────────────────────────────────
const universe = {};
const missing = { finvault: [], osiris: [] };

for (const c of COMPANIES) {
    const ticker = c.ticker;

    // Locate the FinVault entry: KNOWN_REPORTS first, then skeletons.
    let finvault = null;
    if (KNOWN_REPORTS[ticker]) {
        const k = KNOWN_REPORTS[ticker];
        finvault = { slug: k.slug, tvTicker: k.tv, industry: k.industry, pdfReady: k.pdfReady };
    } else if (finvaultByYahoo[ticker]) {
        finvault = finvaultByYahoo[ticker];
    } else {
        missing.finvault.push(ticker);
    }

    const osiris = osirisByTicker[ticker] || null;
    if (!osiris) missing.osiris.push(ticker);

    universe[ticker] = {
        ticker,
        name: c.name,
        sector: c.sector,
        region: c.region,
        country: c.country,
        exchanges: {
            yahoo: ticker,
            tradingView: finvault ? finvault.tvTicker : null
        },
        finvault: finvault ? {
            slug: finvault.slug,
            industry: finvault.industry,
            pdfReady: finvault.pdfReady,
            reportUrl: 'report.html?company=' + finvault.slug,
            stats: (companyDataLookup[finvault.slug] && Array.isArray(companyDataLookup[finvault.slug].stats))
                ? companyDataLookup[finvault.slug].stats
                : null,
            // Hand-curated 10-K fundamentals — drives the precision
            // EV/EBITDA + P/B math on both report.html's Multiples
            // panel and the brief page (first tier in the cascade).
            // Present only for the 9 fully-built reports.
            fundamentals: (companyDataLookup[finvault.slug] && companyDataLookup[finvault.slug].fundamentals)
                ? companyDataLookup[finvault.slug].fundamentals
                : null
        } : null,
        // Public contract for every cross-tool surface. UI code must consume
        // these flags rather than infer availability from optional fields.
        capabilities: {
            finvault: {
                report: Boolean(finvault && finvault.pdfReady),
                overview: Boolean(finvault)
            },
            sentinel: true,
            osiris: Boolean(osiris),
            downloads: {
                sentinel: true,
                osiris: Boolean(osiris)
            }
        },
        sentinel: {
            type: c.type,
            rating: c.rating,
            baseSpread: c.baseSpread,
            marketBeta: c.marketBeta,
            sectorBeta: c.sectorBeta,
            baseRateType: c.base_rate_type,
            lastVerified: c.lastVerified || null
        },
        osiris: osiris
    };
}

const sentinelTickers = new Set(COMPANIES.map(c => c.ticker));
const extraOsiris = Object.keys(osirisByTicker).filter(ticker => !sentinelTickers.has(ticker));
if (extraOsiris.length) {
    throw new Error('Osiris tickers absent from Sentinel canonical registry: ' + extraOsiris.join(', '));
}
if (missing.finvault.length || missing.osiris.length) {
    throw new Error(
        'Incomplete canonical registry:' +
        (missing.finvault.length ? ' FinVault missing ' + missing.finvault.join(', ') : '') +
        (missing.osiris.length ? ' Osiris missing ' + missing.osiris.join(', ') : '')
    );
}

// ─── Write output ──────────────────────────────────────────────────────
const outDir = path.join(ROOT, 'data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'universe.json');

const header = {
    _meta: {
        schemaVersion: 1,
        generated: new Date().toISOString().slice(0, 10),
        generator: 'scripts/build-universe.js',
        count: Object.keys(universe).length,
        sources: ['sentinel.v2.js', 'physics-config.json', 'report.html']
    }
};

const output = { ...header, tickers: universe };
const errors = validateUniverse(output);
if (errors.length) throw new Error('Universe schema validation failed:\n- ' + errors.join('\n- '));

const serialized = JSON.stringify(output, null, 2) + '\n';
if (CHECK) {
    const committed = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8').replace(/\r\n/g, '\n') : null;
    if (committed !== serialized) {
        throw new Error('data/universe.json is stale. Run `node scripts/build-universe.js` and commit the output.');
    }
} else {
    fs.writeFileSync(outPath, serialized);
}

console.log('✓ Wrote ' + path.relative(ROOT, outPath));
console.log('  Tickers: ' + Object.keys(universe).length);
if (missing.finvault.length) {
    console.log('  ⚠ No FinVault entry for: ' + missing.finvault.join(', '));
}
if (missing.osiris.length) {
    console.log('  ⚠ No Osiris entry for: ' + missing.osiris.join(', '));
}
