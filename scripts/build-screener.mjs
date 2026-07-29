#!/usr/bin/env node
/**
 * build-screener.mjs — offline builder for data/screener.json.
 *
 * For each US filer in data/universe.json it fetches SEC XBRL companyfacts,
 * builds the 5-year history (shared xbrl-history lib) and computes a
 * deterministic analytics snapshot (no ML, no price feed): margins, ROE/ROA,
 * ROIC, leverage, interest coverage, FCF margin, revenue growth, and the
 * interest-coverage-implied credit tier. Foreign filers get rating/sector only.
 *
 * Output feeds the FinVault cross-company screener on reports.html. Refreshed by
 * .github/workflows/screener.yml.  Run:  node scripts/build-screener.mjs [--limit N]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildSeries, historyData } from './lib/xbrl-history.mjs';

const SEC_UA = 'NovaSect novasect.space@proton.me';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i > -1 ? Number(process.argv[i + 1]) : Infinity; })();

const sleep = ms => new Promise(r => setTimeout(r, ms));
const last = a => { for (let i = (a || []).length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; };
const round = (v, d = 4) => (v == null || isNaN(v)) ? null : Number(v.toFixed(d));

async function getCikMap() {
  const r = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': SEC_UA, accept: 'application/json' } });
  if (!r.ok) throw new Error('company_tickers ' + r.status);
  const data = await r.json();
  const map = new Map();
  for (const row of Object.values(data)) if (row?.ticker && row?.cik_str != null) map.set(String(row.ticker).toUpperCase(), row.cik_str);
  return map;
}

// Deterministic analytics snapshot from the latest fiscal year (mirrors the
// report.html Tier 2 panel; no price → no valuation multiples here).
function analytics(history) {
  const s = history.summary, RA = history.ratios, c = history.cagr || {};
  const ni = last(s.netIncome), rev = last(s.revenue), ta = last(s.totalAssets), eq = last(s.equity),
        oi = last(s.operatingIncome), td = last(s.totalDebt), cash = last(s.cash), fcf = last(s.freeCashFlow);
  const TAX = 0.21;
  const invCap = (td != null || eq != null) ? ((td || 0) + (eq || 0) - (cash || 0)) : null;
  const roic = (oi != null && invCap && invCap > 0) ? (oi * (1 - TAX)) / invCap : null;
  const dupRoe = (ni != null && rev && ta && eq) ? (ni / rev) * (rev / ta) * (ta / eq) : null;
  const icv = last(RA.interestCoverage);
  const tier = icv == null ? null : (icv >= 12 ? 'AAA/AA' : icv >= 8 ? 'A' : icv >= 5 ? 'BBB' : icv >= 2.5 ? 'BB' : icv >= 1.5 ? 'B' : 'CCC');
  return {
    revenue: round(rev, 0),
    revGrowth: round(typeof c.revenue === 'number' ? c.revenue : null),
    netMargin: round(last(RA.netMargin)),
    operatingMargin: round(last(RA.operatingMargin)),
    roe: round(last(RA.roe) ?? dupRoe),
    roa: round(last(RA.roa)),
    roic: round(roic),
    debtToEquity: round(last(RA.debtToEquity)),
    netLeverage: round(last(RA.netLeverage)),
    interestCoverage: round(icv, 2),
    fcfMargin: round((fcf != null && rev) ? fcf / rev : null),
    impliedCredit: tier,
  };
}

// ── Yahoo fundamentals for NON-US filers (SEC EDGAR XBRL is US-only) ───────────
// The fundamentals-timeseries endpoint returns annual figures without a crumb.
// All screener columns are unit-less (margins / ratios / CAGR), so mixing
// reporting currencies across companies is fine — no FX conversion needed.
const YF_UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', accept: 'application/json' };
const YF_TYPES = ['annualTotalRevenue', 'annualNetIncome', 'annualOperatingIncome', 'annualEBIT',
  'annualInterestExpense', 'annualTotalDebt', 'annualCashAndCashEquivalents', 'annualStockholdersEquity',
  'annualTotalAssets', 'annualFreeCashFlow', 'annualEBITDA'];

// Exponential backoff + jitter; retries on 429 / 5xx / network errors.
async function fetchRetry(url, opts, tries = 4, baseDelay = 600) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      return r;
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) await sleep(baseDelay * 2 ** i + Math.floor(Math.random() * 300));
    }
  }
  throw lastErr;
}

async function yahooFundamentals(ticker) {
  const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(ticker)}` +
    `?type=${YF_TYPES.join(',')}&period1=1500000000&period2=1900000000`;
  const r = await fetchRetry(url, { headers: YF_UA });
  if (!r.ok) throw new Error('timeseries ' + r.status);
  const res = (await r.json())?.timeseries?.result || [];
  const S = {};
  for (const t of YF_TYPES) {
    const e = res.find(x => x.meta?.type?.[0] === t);
    S[t] = (e && e[t] ? e[t] : []).filter(Boolean).map(d => ({ v: d.reportedValue?.raw ?? null, date: d.asOfDate }));
  }
  return S;
}

// Mirror analytics() using Yahoo's latest fiscal year; interest coverage from EBIT.
function yahooAnalytics(S) {
  const lastV = t => { const a = S[t] || []; for (let i = a.length - 1; i >= 0; i--) if (a[i].v != null) return a[i].v; return null; };
  const rev = lastV('annualTotalRevenue'), ni = lastV('annualNetIncome'), oi = lastV('annualOperatingIncome'),
        ebit = lastV('annualEBIT'), intexp = lastV('annualInterestExpense'), td = lastV('annualTotalDebt'),
        cash = lastV('annualCashAndCashEquivalents'), eq = lastV('annualStockholdersEquity'),
        ta = lastV('annualTotalAssets'), fcf = lastV('annualFreeCashFlow'), ebitda = lastV('annualEBITDA');
  const TAX = 0.21;
  const invCap = (td != null || eq != null) ? ((td || 0) + (eq || 0) - (cash || 0)) : null;
  const roic = (ebit != null && invCap && invCap > 0) ? (ebit * (1 - TAX)) / invCap : null;
  const icv = (ebit != null && intexp) ? ebit / Math.abs(intexp) : null;
  const tier = icv == null ? null : (icv >= 12 ? 'AAA/AA' : icv >= 8 ? 'A' : icv >= 5 ? 'BBB' : icv >= 2.5 ? 'BB' : icv >= 1.5 ? 'B' : 'CCC');
  const rs = (S.annualTotalRevenue || []).filter(x => x.v != null);
  let revCagr = null;
  if (rs.length >= 2 && rs[0].v > 0 && rs[rs.length - 1].v > 0) revCagr = (rs[rs.length - 1].v / rs[0].v) ** (1 / (rs.length - 1)) - 1;
  let latestFY = null;
  for (let i = (S.annualTotalRevenue || []).length - 1; i >= 0; i--) { const d = S.annualTotalRevenue[i]; if (d.v != null && d.date) { latestFY = Number(String(d.date).slice(0, 4)); break; } }
  return {
    revenue: round(rev, 0),
    revGrowth: round(revCagr),
    netMargin: round(rev ? ni / rev : null),
    operatingMargin: round(rev ? oi / rev : null),
    roe: round(eq ? ni / eq : null),
    roa: round(ta ? ni / ta : null),
    roic: round(roic),
    debtToEquity: round(eq ? td / eq : null),
    netLeverage: round(ebitda ? (td - (cash || 0)) / ebitda : null),
    interestCoverage: round(icv, 2),
    fcfMargin: round(rev ? fcf / rev : null),
    impliedCredit: tier,
    latestFY,
  };
}

async function main() {
  const universe = JSON.parse(readFileSync(join(ROOT, 'data', 'universe.json'), 'utf8')).tickers;
  let entries = Object.values(universe);
  if (LIMIT !== Infinity) entries = entries.slice(0, LIMIT);
  const cik = await getCikMap();
  const rows = [];
  let ok = 0, yahoo = 0, foreign = 0, fail = 0;

  for (const e of entries) {
    const base = {
      ticker: e.ticker, name: e.name, sector: e.sector, region: e.region,
      rating: e.sentinel?.rating ?? null, slug: e.finvault?.slug ?? null,
      reportUrl: e.finvault?.reportUrl ?? null, pdfReady: !!e.finvault?.pdfReady,
    };
    // Non-US: SEC XBRL has no data, so fetch fundamentals from Yahoo (retry/backoff).
    // On failure fall back to the previous rating-only behaviour.
    if (e.region !== 'US') {
      try {
        const a = yahooAnalytics(await yahooFundamentals(e.ticker));
        if (a.netMargin == null && a.roe == null && a.interestCoverage == null) throw new Error('no usable fields');
        rows.push({ ...base, ...a, source: 'yahoo' }); yahoo++;
        console.log(`  ${e.ticker}: [Yahoo] ROE ${a.roe != null ? (a.roe * 100).toFixed(1) + '%' : 'n/a'} · IntCov ${a.interestCoverage ?? 'n/a'} · credit ${a.impliedCredit || 'n/a'}`);
      } catch (err) {
        rows.push({ ...base, foreign: true }); foreign++;
        console.warn(`  ${e.ticker}: [Yahoo] ${err.message} → rating-only`);
      }
      await sleep(300); // gentle pacing for Yahoo
      continue;
    }
    const cikNum = cik.get(String(e.ticker).toUpperCase());
    if (cikNum == null) { rows.push({ ...base }); fail++; console.warn(`  ${e.ticker}: no CIK`); continue; }
    try {
      await sleep(160); // SEC fair-access
      const c = String(cikNum).padStart(10, '0');
      const r = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${c}.json`, { headers: { 'User-Agent': SEC_UA, accept: 'application/json' } });
      if (!r.ok) { rows.push({ ...base }); fail++; console.warn(`  ${e.ticker}: companyfacts ${r.status}`); continue; }
      const facts = await r.json();
      const h = historyData(buildSeries(facts.facts));
      if (!h) { rows.push({ ...base }); fail++; console.warn(`  ${e.ticker}: <2y history`); continue; }
      const row = { ...base, ...analytics(h), latestFY: h.years?.[h.years.length - 1] ?? null, source: 'sec' };
      rows.push(row); ok++;
      console.log(`  ${e.ticker}: ROE ${row.roe != null ? (row.roe * 100).toFixed(1) + '%' : 'n/a'} · ROIC ${row.roic != null ? (row.roic * 100).toFixed(1) + '%' : 'n/a'} · credit ${row.impliedCredit || 'n/a'}`);
    } catch (err) { rows.push({ ...base }); fail++; console.warn(`  ${e.ticker}: ${err.message}`); }
  }

  const out = { generated: new Date().toISOString().slice(0, 10), source: 'SEC EDGAR XBRL + Yahoo Finance', count: rows.length, ok, yahoo, foreign, fail, rows };
  writeFileSync(join(ROOT, 'data', 'screener.json'), JSON.stringify(out, null, 1));
  console.log(`\nscreener.json written: ${rows.length} rows (${ok} US SEC-XBRL, ${yahoo} non-US Yahoo, ${foreign} rating-only, ${fail} no-data)`);
}

main().catch(e => { console.error('build-screener failed:', e); process.exit(1); });
