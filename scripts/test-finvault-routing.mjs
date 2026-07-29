/** Phase 1 guardrails for canonical FinVault routing and availability states. */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (condition, message) => {
  if (condition) pass++;
  else { fail++; console.log('  ✕ ' + message); }
};
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');

const universe = JSON.parse(read('../data/universe.json'));
const entries = Object.values(universe.tickers || {});
const report = read('../report.html');
const osiris = read('../components/osiris/osiris.js');
const brief = read('../brief.html');
const reports = read('../reports.html');
const screener = JSON.parse(read('../data/screener.json'));
const previewServer = read('./serve-preview.mjs');

ok(entries.length === 83, 'registry contains the covered issuer set');
ok(entries.every(entry => entry.capabilities?.finvault?.overview), 'every covered issuer has a FinVault overview');
ok(entries.filter(entry => entry.capabilities?.finvault?.report).length === 9, 'full-report availability remains explicit');
ok(entries.every(entry => entry.finvault?.reportUrl === 'report.html?ticker=' + encodeURIComponent(entry.ticker)), 'registry emits only canonical ticker routes');
ok(report.includes('if (tickerParam) {') && report.includes('company = e.finvault.slug'), 'FinVault resolves canonical ticker routes before legacy slugs');
ok(report.includes('LIVE FINVAULT OVERVIEW') && report.includes('FULL RESEARCH REPORT'), 'FinVault distinguishes overview and full-report states');
ok(osiris.includes("report.html?ticker=' + encodeURIComponent(tickerSymbol)") && osiris.includes('VIEW FINVAULT OVERVIEW'), 'Osiris uses ticker routes and availability-aware labels');
ok(brief.includes('Open FinVault overview →') && brief.includes('Open full FinVault report →'), 'Brief uses availability-aware FinVault labels');
ok(reports.includes('normalizeCardRoutes') && reports.includes("report.html?ticker=' + encodeURIComponent(entry.ticker)"), 'reports cards normalize to canonical ticker routes');
ok(screener.rows.some(row => row.ticker === 'SHEL' && typeof row.operatingMargin === 'number' && typeof row.roe === 'number'), 'Shell cached screener fundamentals are present');
ok(report.includes("fetch('data/screener.json')") && report.includes('loadScreenerFallback'), 'FinVault loads cached screener fundamentals as a fallback');
ok(report.includes("'Debt to Equity': fmtCachedMultiple(entry.debtToEquity)") && report.includes("'Return on equity': fmtCachedPercent(entry.roe)"), 'cached fundamentals map into visible Financial Ratios fields');
ok(previewServer.includes("request.method !== 'GET' && request.method !== 'HEAD'") && previewServer.includes("url.pathname.startsWith('/api/')"), 'local preview proxies only read-only API requests');

console.log('\n' + (fail === 0 ? '✓ ALL PASS' : '✕ FAILURES') + ` — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
