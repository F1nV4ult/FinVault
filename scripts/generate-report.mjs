/**
 * generate-report.mjs
 *
 * FinVault automated report generation pipeline.
 *
 * Filing type routing:
 *   10-K  — US companies: SEC EDGAR 10-K text + US-GAAP XBRL (default)
 *   20-F  — US-listed foreign issuers: SEC EDGAR 20-F text + IFRS XBRL
 *   PDF   — Non-SEC filers: direct PDF download from company IR page + Claude extraction
 *
 * Usage:
 *   node scripts/generate-report.mjs <TICKER>
 *   node scripts/generate-report.mjs RTX --model=claude-opus-4-7
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 * Template:  scripts/report-template.md  (loaded automatically)
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType,
} from 'docx';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { pickSeries, buildHistoryMarkdown } from './lib/xbrl-history.mjs';

const _require = createRequire(import.meta.url);

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dir   = dirname(fileURLToPath(import.meta.url));
const STAGING = join(__dir, 'reports-staging');
const TEMPLATE = join(__dir, 'report-template.md');

// ─── Config ───────────────────────────────────────────────────────────────────

const EDGAR_UA       = 'NovaSect novasect.space@proton.me';
const RATE_MS        = 150;
const BASE_WWW       = 'https://www.sec.gov';
const BASE_DATA      = 'https://data.sec.gov';
const DEFAULT_MODEL  = 'claude-sonnet-4-6';
const MAX_ITEM_CHARS = 35_000;

// ─── Docx Colour Palette ──────────────────────────────────────────────────────

const COL = {
  navy:   '1F3864',
  green:  '0B5345',
  white:  'FFFFFF',
  lgray:  'F2F3F4',
  dgray:  '4A4A4A',
  accent: '196F3D',
};

// ─── Company Registry ─────────────────────────────────────────────────────────
//
// filingType:
//   '10-K'  (default) — US company, SEC EDGAR 10-K + US-GAAP XBRL
//   '20-F'            — US-listed foreign issuer, SEC EDGAR 20-F + IFRS XBRL
//   'PDF'             — Non-SEC filer, direct IR PDF + Claude extraction
//
// pdfUrl (PDF companies only):
//   Set to the direct download link for the latest consolidated annual report PDF.
//   Update this URL each year after the company publishes its new report.
//   The IR page where the PDF can be found is noted in the comment beside each entry.

const REGISTRY = {
  XOM:  { name: 'ExxonMobil Corporation',              exchange: 'NYSE',   sector: 'energy',      industry: 'Integrated Oil & Gas',              peers: ['CVX', 'COP', 'BP', 'SHEL', 'TTE'] },
  CVX:  { name: 'Chevron Corporation',                  exchange: 'NYSE',   sector: 'energy',      industry: 'Integrated Oil & Gas',              peers: ['XOM', 'COP', 'BP', 'SHEL', 'TTE'] },
  COP:  { name: 'ConocoPhillips',                       exchange: 'NYSE',   sector: 'energy',      industry: 'Exploration & Production',          peers: ['EOG', 'DVN', 'HES', 'APA', 'MRO'] },
  EOG:  { name: 'EOG Resources',                        exchange: 'NYSE',   sector: 'energy',      industry: 'Exploration & Production',          peers: ['COP', 'DVN', 'FANG', 'PXD', 'MRO'] },
  OXY:  { name: 'Occidental Petroleum Corporation',     exchange: 'NYSE',   sector: 'energy',      industry: 'Exploration & Production',          peers: ['COP', 'DVN', 'APA', 'MRO', 'CLR'] },
  WMB:  { name: 'Williams Companies',                   exchange: 'NYSE',   sector: 'energy',      industry: 'Midstream Gas',                     peers: ['KMI', 'ET', 'OKE', 'EPD', 'MPLX'] },
  KMI:  { name: 'Kinder Morgan',                        exchange: 'NYSE',   sector: 'energy',      industry: 'Midstream Gas',                     peers: ['WMB', 'ET', 'OKE', 'EPD', 'TRGP'] },
  MPC:  { name: 'Marathon Petroleum Corporation',       exchange: 'NYSE',   sector: 'energy',      industry: 'Refining & Marketing',              peers: ['VLO', 'PSX', 'PBF', 'HFC', 'DKL'] },
  VLO:  { name: 'Valero Energy Corporation',            exchange: 'NYSE',   sector: 'energy',      industry: 'Refining & Marketing',              peers: ['MPC', 'PSX', 'PBF', 'DKL', 'HFC'] },
  PSX:  { name: 'Phillips 66',                          exchange: 'NYSE',   sector: 'energy',      industry: 'Refining & Midstream',              peers: ['MPC', 'VLO', 'PBF', 'DINO', 'HFC'] },
  SLB:  { name: 'SLB (Schlumberger)',                   exchange: 'NYSE',   sector: 'energy',      industry: 'Oilfield Services',                 peers: ['HAL', 'BKR', 'NOV', 'NEX', 'WTTR'] },
  HAL:  { name: 'Halliburton Company',                  exchange: 'NYSE',   sector: 'energy',      industry: 'Oilfield Services',                 peers: ['SLB', 'BKR', 'NOV', 'NEX', 'NINE'] },
  BKR:  { name: 'Baker Hughes Company',                 exchange: 'NASDAQ', sector: 'energy',      industry: 'Oilfield Services & Equipment',     peers: ['SLB', 'HAL', 'NOV', 'FTI', 'DNOW'] },
  NEE:  { name: 'NextEra Energy',                       exchange: 'NYSE',   sector: 'utilities',   industry: 'Electric Utilities',                peers: ['DUK', 'SO', 'AEP', 'EXC', 'SRE'] },
  DUK:  { name: 'Duke Energy Corporation',              exchange: 'NYSE',   sector: 'utilities',   industry: 'Electric Utilities',                peers: ['NEE', 'SO', 'AEP', 'EXC', 'SRE'] },
  SO:   { name: 'Southern Company',                     exchange: 'NYSE',   sector: 'utilities',   industry: 'Electric Utilities',                peers: ['NEE', 'DUK', 'AEP', 'EXC', 'WEC'] },
  D:    { name: 'Dominion Energy',                      exchange: 'NYSE',   sector: 'utilities',   industry: 'Electric Utilities',                peers: ['NEE', 'DUK', 'SO', 'AEP', 'EXC'] },
  AEP:  { name: 'American Electric Power',              exchange: 'NASDAQ', sector: 'utilities',   industry: 'Electric Utilities',                peers: ['NEE', 'DUK', 'SO', 'EXC', 'XEL'] },
  EXC:  { name: 'Exelon Corporation',                   exchange: 'NASDAQ', sector: 'utilities',   industry: 'Electric Utilities',                peers: ['NEE', 'DUK', 'SO', 'AEP', 'PEG'] },
  SRE:  { name: 'Sempra',                               exchange: 'NYSE',   sector: 'utilities',   industry: 'Multi-Utilities',                   peers: ['D', 'DUK', 'AEP', 'SO', 'PEG'] },
  XEL:  { name: 'Xcel Energy',                          exchange: 'NASDAQ', sector: 'utilities',   industry: 'Electric Utilities',                peers: ['AEP', 'NEE', 'WEC', 'EVRG', 'PNW'] },
  PCG:  { name: 'PG&E Corporation',                     exchange: 'NYSE',   sector: 'utilities',   industry: 'Electric Utilities',                peers: ['EIX', 'NEE', 'DUK', 'SO', 'AEP'] },
  PEG:  { name: 'Public Service Enterprise Group',      exchange: 'NYSE',   sector: 'utilities',   industry: 'Electric Utilities',                peers: ['EXC', 'NEE', 'DUK', 'SO', 'EIX'] },
  WEC:  { name: 'WEC Energy Group',                     exchange: 'NYSE',   sector: 'utilities',   industry: 'Electric Utilities',                peers: ['XEL', 'AEP', 'SO', 'DUK', 'EVRG'] },
  AWK:  { name: 'American Water Works',                 exchange: 'NYSE',   sector: 'utilities',   industry: 'Water Utilities',                   peers: ['WTRG', 'MSEX', 'CWT', 'SJW', 'YORW'] },
  LMT:  { name: 'Lockheed Martin Corporation',          exchange: 'NYSE',   sector: 'defence',     industry: 'Aerospace & Defence',               peers: ['RTX', 'NOC', 'GD', 'BA', 'LHX'] },
  GD:   { name: 'General Dynamics Corporation',         exchange: 'NYSE',   sector: 'defence',     industry: 'Aerospace & Defence',               peers: ['LMT', 'RTX', 'NOC', 'LHX', 'HII'] },
  LHX:  { name: 'L3Harris Technologies',                exchange: 'NYSE',   sector: 'defence',     industry: 'Aerospace & Defence',               peers: ['RTX', 'LMT', 'NOC', 'GD', 'LDOS'] },
  NOC:  { name: 'Northrop Grumman Corporation',         exchange: 'NYSE',   sector: 'defence',     industry: 'Aerospace & Defence',               peers: ['LMT', 'RTX', 'GD', 'LHX', 'HII'] },
  RTX:  { name: 'RTX Corporation',                      exchange: 'NYSE',   sector: 'defence',     industry: 'Aerospace & Defence',               peers: ['LMT', 'GD', 'NOC', 'LHX', 'BA'] },
  GE:   { name: 'GE Aerospace',                         exchange: 'NYSE',   sector: 'industrials', industry: 'Aerospace & Defence',               peers: ['RTX', 'HON', 'SAF.PA', 'MTU.DE', 'BA'] },
  HON:  { name: 'Honeywell International',              exchange: 'NASDAQ', sector: 'industrials', industry: 'Diversified Industrials',            peers: ['GE', 'MMM', 'EMR', 'ROK', 'ITW'] },
  MMM:  { name: '3M Company',                           exchange: 'NYSE',   sector: 'industrials', industry: 'Diversified Industrials',            peers: ['HON', 'EMR', 'ITW', 'DOV', 'IR'] },
  UPS:  { name: 'United Parcel Service',                exchange: 'NYSE',   sector: 'industrials', industry: 'Air Freight & Logistics',            peers: ['FDX', 'XPO', 'CHRW', 'EXPD', 'GXO'] },
  UNP:  { name: 'Union Pacific Corporation',            exchange: 'NYSE',   sector: 'industrials', industry: 'Rail Transportation',                peers: ['CSX', 'NSC', 'CP', 'CNI', 'BNSF'] },
  LUV:  { name: 'Southwest Airlines',                   exchange: 'NYSE',   sector: 'industrials', industry: 'Airlines',                           peers: ['DAL', 'UAL', 'AAL', 'JBLU', 'ALGT'] },
  DAL:  { name: 'Delta Air Lines',                      exchange: 'NYSE',   sector: 'industrials', industry: 'Airlines',                           peers: ['LUV', 'UAL', 'AAL', 'JBLU', 'ALK'] },
  CAT:  { name: 'Caterpillar Inc.',                     exchange: 'NYSE',   sector: 'industrials', industry: 'Heavy Equipment & Machinery',        peers: ['DE', 'CNH', 'VOLV-B.ST', 'KOMATSU', 'AGCO'] },
  DE:   { name: 'Deere & Company',                      exchange: 'NYSE',   sector: 'industrials', industry: 'Agricultural & Construction Equip',  peers: ['CAT', 'CNH', 'AGCO', 'CLAAS', 'KUBOTA'] },
  BA:   { name: 'Boeing Company',                       exchange: 'NYSE',   sector: 'industrials', industry: 'Aerospace Manufacturing',            peers: ['RTX', 'GD', 'LMT', 'NOC', 'AIR.PA'] },

  // ── 20-F filers: US-listed foreign issuers (SEC EDGAR, IFRS XBRL) ────────────
  SHEL: { name: 'Shell PLC',          exchange: 'NYSE',  sector: 'energy',      industry: 'Integrated Oil & Gas',    filingType: '20-F', peers: ['XOM', 'CVX', 'BP', 'TTE', 'EQNR'] },
  TTE:  { name: 'TotalEnergies SE',   exchange: 'NYSE',  sector: 'energy',      industry: 'Integrated Oil & Gas',    filingType: '20-F', peers: ['XOM', 'CVX', 'BP', 'SHEL', 'EQNR'] },
  BP:   { name: 'BP p.l.c.',          exchange: 'NYSE',  sector: 'energy',      industry: 'Integrated Oil & Gas',    filingType: '20-F', peers: ['XOM', 'CVX', 'SHEL', 'TTE', 'EQNR'] },
  EQNR: { name: 'Equinor ASA',        exchange: 'NYSE',  sector: 'energy',      industry: 'Exploration & Production',filingType: '20-F', peers: ['XOM', 'CVX', 'BP', 'SHEL', 'TTE'] },

  // ── PDF filers: non-SEC companies (direct IR PDF download) ───────────────────
  // pdfUrl: set to the direct PDF link for the current year's consolidated annual report.
  // Update this URL each year after the company publishes its new report.
  // IR pages are listed in comments to help locate the new PDF annually.
  'IBE.MC':  { name: 'Iberdrola S.A.',    exchange: 'BME',  sector: 'utilities',   industry: 'Electric Utilities',      filingType: 'PDF', reportCurrency: 'EUR',
    pdfUrl: null, // IR: https://www.iberdrola.com/investors/financial-information/annual-report
    peers: ['ENEL.MI', 'ENGI.PA', 'NEE', 'DUK', 'EDP.LS'] },

  'ENEL.MI': { name: 'Enel SpA',          exchange: 'MIL',  sector: 'utilities',   industry: 'Electric Utilities',      filingType: 'PDF', reportCurrency: 'EUR',
    pdfUrl: null, // IR: https://www.enel.com/investors/sustainability/sustainability-reports
    peers: ['IBE.MC', 'ENGI.PA', 'NEE', 'DUK', 'EDP.LS'] },

  'ENGI.PA': { name: 'Engie S.A.',         exchange: 'EPA',  sector: 'utilities',   industry: 'Multi-Utilities',         filingType: 'PDF', reportCurrency: 'EUR',
    pdfUrl: null, // IR: https://www.engie.com/investors/financial-results-publications
    peers: ['IBE.MC', 'ENEL.MI', 'DUK', 'NEE', 'SRE'] },

  'AIR.PA':  { name: 'Airbus SE',          exchange: 'EPA',  sector: 'industrials', industry: 'Aerospace Manufacturing', filingType: 'PDF', reportCurrency: 'EUR',
    pdfUrl: null, // IR: https://www.airbus.com/en/investor-relations/publications-and-events/annual-reports
    peers: ['BA', 'RTX', 'GE', 'LMT', 'RHM.DE'] },

  'LDO.MI':  { name: 'Leonardo SpA',       exchange: 'MIL',  sector: 'defence',     industry: 'Aerospace & Defence',     filingType: 'PDF', reportCurrency: 'EUR',
    pdfUrl: null, // IR: https://www.leonardocompany.com/en/investors/financial-reports
    peers: ['RTX', 'LMT', 'NOC', 'AIR.PA', 'RHM.DE'] },

  'RHM.DE':  { name: 'Rheinmetall AG',     exchange: 'XETR', sector: 'defence',     industry: 'Aerospace & Defence',     filingType: 'PDF', reportCurrency: 'EUR',
    pdfUrl: null, // IR: https://www.rheinmetall.com/en/company/press/publications/annual-reports
    peers: ['LMT', 'NOC', 'LDO.MI', 'AIR.PA', 'BA'] },

  'DHL.DE':  { name: 'DHL Group',          exchange: 'XETR', sector: 'industrials', industry: 'Air Freight & Logistics', filingType: 'PDF', reportCurrency: 'EUR',
    pdfUrl: null, // IR: https://www.dhl.com/global-en/home/investors/reporting.html
    peers: ['UPS', 'FDX', 'XPO', 'GXO', 'CHRW'] },

  'EMBR3.SA':{ name: 'Embraer S.A.',       exchange: 'B3',   sector: 'industrials', industry: 'Aerospace Manufacturing', filingType: 'PDF', reportCurrency: 'BRL',
    pdfUrl: null, // IR: https://ri.embraer.com.br/en/reports-and-presentations
    peers: ['BA', 'RTX', 'GE', 'AIR.PA', 'LMT'] },

  'BA.L':    { name: 'BAE Systems plc',    exchange: 'LSE',  sector: 'defence',     industry: 'Aerospace & Defence',     filingType: 'PDF', reportCurrency: 'GBP',
    pdfUrl: 'https://annualreport.baesystems.com/dam/jcr:f57706a5-0a28-441a-8829-0e0c213436c1/BAE-Systems-Annual-Report-2024.2025-04-29-16-28-37.pdf',
    // IR: https://investors.baesystems.com/reports-and-presentations/annual-reports/2024
    peers: ['LMT', 'RTX', 'NOC', 'RHM.DE', 'LDO.MI'] },
};

// ─── XBRL Concept Lists ───────────────────────────────────────────────────────

const CONCEPTS = {
  revenue:            ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet', 'RegulatedAndUnregulatedOperatingRevenue', 'ElectricUtilityRevenue', 'OilAndGasRevenue'],
  operatingIncome:    ['OperatingIncomeLoss'],
  da:                 ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'Depreciation'],
  interestExpense:    ['InterestExpense', 'InterestAndDebtExpense'],
  netIncome:          ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
  epsDiluted:         ['EarningsPerShareDiluted', 'EarningsPerShareBasic'],
  longTermDebt:       ['LongTermDebt', 'LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligations'],
  shortTermDebt:      ['ShortTermBorrowings', 'DebtCurrent', 'LongTermDebtCurrent'],
  cash:               ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsAndShortTermInvestments'],
  sharesOut:          ['CommonStockSharesOutstanding', 'EntityCommonStockSharesOutstanding'],
  equity:             ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  totalAssets:        ['Assets'],
  totalLiabilities:   ['Liabilities'],
  currentAssets:      ['AssetsCurrent'],
  currentLiabilities: ['LiabilitiesCurrent'],
  inventory:          ['InventoryNet', 'Inventories'],
  ocf:                ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capex:              ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsForCapitalImprovements'],
  dividendsPaid:      ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock', 'PaymentsOfOrdinaryDividends'],
};

// IFRS taxonomy concepts for 20-F filers (ifrs-full namespace on SEC EDGAR)
const IFRS_CONCEPTS = {
  revenue:            ['Revenue', 'RevenueFromContractsWithCustomers', 'RevenueFromRenderingOfServices', 'RevenueFromSaleOfGoods'],
  operatingIncome:    ['ProfitLossFromOperatingActivities', 'OperatingProfit', 'ProfitLossBeforeFinancingCostsAndIncomeTax'],
  da:                 ['DepreciationAmortisationAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss', 'DepreciationAndAmortisationExpense', 'DepreciationDepletionAndAmortisationExpense'],
  interestExpense:    ['FinanceCosts', 'InterestExpenseOnBorrowings', 'FinanceExpenses', 'BorrowingCosts'],
  netIncome:          ['ProfitLoss', 'ProfitLossAttributableToOwnersOfParent', 'ProfitLossFromContinuingOperations'],
  epsDiluted:         ['DilutedEarningsLossPerShare', 'BasicEarningsLossPerShare'],
  longTermDebt:       ['NoncurrentPortionOfLongtermBorrowings', 'NoncurrentBorrowings', 'LongtermBorrowings'],
  shortTermDebt:      ['CurrentPortionOfLongtermBorrowings', 'CurrentBorrowings', 'ShorttermBorrowings'],
  cash:               ['CashAndCashEquivalents', 'CashAndCashEquivalentsAndBankOverdrafts'],
  sharesOut:          ['NumberOfSharesOutstanding', 'NumberOfSharesIssuedAndFullyPaid'],
  equity:             ['Equity', 'EquityAttributableToOwnersOfParent'],
  totalAssets:        ['Assets'],
  totalLiabilities:   ['Liabilities'],
  currentAssets:      ['CurrentAssets'],
  currentLiabilities: ['CurrentLiabilities'],
  inventory:          ['Inventories', 'Inventory'],
  ocf:                ['CashFlowsFromUsedInOperatingActivities', 'NetCashFlowsFromOperatingActivities'],
  capex:              ['PurchaseOfPropertyPlantAndEquipment', 'AcquisitionOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities', 'PaymentsForPropertyPlantAndEquipment'],
  dividendsPaid:      ['DividendsPaid', 'DividendsPaidToEquityHoldersOfParentEntity', 'DividendsPaidClassifiedAsFinancingActivities'],
};

// ─── Fetch Helpers ────────────────────────────────────────────────────────────

const sleep   = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': EDGAR_UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': EDGAR_UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function extractItem(text, startPat, endPat) {
  const sRx = new RegExp(startPat, 'gi');
  const hits = [];
  let m;
  while ((m = sRx.exec(text)) !== null) hits.push(m.index);
  if (!hits.length) return null;
  const start = hits[hits.length - 1]; // last hit = actual section, not TOC
  const eRx = new RegExp(endPat, 'gi');
  eRx.lastIndex = start + 200;
  const eMatch = eRx.exec(text);
  const end = eMatch ? eMatch.index : Math.min(start + MAX_ITEM_CHARS, text.length);
  const out = text.slice(start, end).trim();
  return out.length > 200 ? out.slice(0, MAX_ITEM_CHARS) : null;
}

// ─── EDGAR Lookups ────────────────────────────────────────────────────────────

let _cikMap = null;
async function getCIK(ticker) {
  if (!_cikMap) {
    const data = await fetchJSON(`${BASE_WWW}/files/company_tickers.json`);
    await sleep(RATE_MS);
    _cikMap = {};
    for (const e of Object.values(data)) _cikMap[e.ticker.toUpperCase()] = String(e.cik_str).padStart(10, '0');
  }
  const cik = _cikMap[ticker.toUpperCase()];
  if (!cik) throw new Error(`CIK not found for ${ticker}`);
  return cik;
}

// Unified filing lookup — handles both 10-K and 20-F
async function getLatestFiling(cik, filingType = '10-K') {
  const data = await fetchJSON(`${BASE_DATA}/submissions/CIK${cik}.json`);
  await sleep(RATE_MS);
  const { form, accessionNumber, primaryDocument, filingDate, reportDate } = data.filings.recent;
  const targets = filingType === '20-F' ? ['20-F', '20-F/A'] : ['10-K', '10-K/A'];
  for (let i = 0; i < form.length; i++) {
    if (targets.includes(form[i])) {
      return {
        accession:      accessionNumber[i],
        accessionClean: accessionNumber[i].replace(/-/g, ''),
        primaryDoc:     primaryDocument[i],
        filingDate:     filingDate[i],
        reportDate:     reportDate[i],
        formType:       form[i],
      };
    }
  }
  throw new Error(`No ${filingType} found for CIK ${cik}`);
}

// Validates that the CIK belongs to the consolidated parent entity, not a subsidiary.
// The ticker-based CIK lookup already selects the listed parent, but this adds a name
// cross-check as a safety net against edge cases (dual-listed holding structures, etc.).
async function validateParentEntity(cik, expectedName) {
  const data = await fetchJSON(`${BASE_DATA}/submissions/CIK${cik}.json`);
  await sleep(RATE_MS);
  const filedName = (data.name || '').toLowerCase();
  const words = expectedName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  const matched = words.filter(w => filedName.includes(w));
  if (matched.length === 0) {
    throw new Error(
      `Entity mismatch: SEC registered name "${data.name}" shares no keywords with expected "${expectedName}". ` +
      `This may be a subsidiary filing. Verify the CIK at https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`
    );
  }
  console.log(`  [validate] SEC entity: "${data.name}" — matched "${expectedName}" on [${matched.join(', ')}]`);
  return data.name;
}

async function extract10KItems(cik, filing) {
  const url = `${BASE_WWW}/Archives/edgar/data/${parseInt(cik)}/${filing.accessionClean}/${filing.primaryDoc}`;
  console.log(`  [10-K] ${url}`);
  let html;
  try {
    html = await fetchText(url);
    await sleep(RATE_MS);
  } catch (e) {
    console.warn(`  [10-K] Download failed: ${e.message}`);
    return { item1: null, item1a: null, item7: null };
  }
  const text = stripHtml(html);
  const item1  = extractItem(text, 'ITEM\\s+1\\.\\s+BUSINESS',    'ITEM\\s+1A\\.');
  const item1a = extractItem(text, 'ITEM\\s+1A\\.\\s+RISK',       'ITEM\\s+(?:1B|2)\\.');
  const item7  = extractItem(text, 'ITEM\\s+7\\.\\s+MANAGEMENT',  'ITEM\\s+(?:7A|8)\\.');
  const kc = (v) => v ? `${(v.length / 1000).toFixed(0)}k chars` : 'NOT FOUND';
  console.log(`  [10-K] Item 1: ${kc(item1)} | Item 1A: ${kc(item1a)} | Item 7: ${kc(item7)}`);
  return { item1, item1a, item7 };
}

// Extract narrative sections from a 20-F filing.
// Item mapping vs 10-K: Item 4 = Business, Item 3D = Risk Factors, Item 5 = MD&A
async function extract20FItems(cik, filing) {
  const url = `${BASE_WWW}/Archives/edgar/data/${parseInt(cik)}/${filing.accessionClean}/${filing.primaryDoc}`;
  console.log(`  [20-F] ${url}`);
  let html;
  try {
    html = await fetchText(url);
    await sleep(RATE_MS);
  } catch (e) {
    console.warn(`  [20-F] Download failed: ${e.message}`);
    return { item1: null, item1a: null, item7: null };
  }
  const text = stripHtml(html);
  // Item 4: Information on the Company (≈ 10-K Item 1)
  const item1  = extractItem(text,
    'ITEM\\s+4[A-Z]?\\.?\\s+(?:INFORMATION\\s+ON\\s+THE\\s+COMPANY|THE\\s+COMPANY|BUSINESS)',
    'ITEM\\s+(?:4[A-Z]|5)[\\.\\s]');
  // Item 3: Key Information / Risk Factors (≈ 10-K Item 1A)
  const item1a = extractItem(text,
    'ITEM\\s+3[A-Z]?\\.?\\s+(?:KEY\\s+INFORMATION|RISK\\s+FACTORS)',
    'ITEM\\s+(?:3[B-Z]|4)[\\.\\s]');
  // Item 5: Operating and Financial Review (≈ 10-K Item 7)
  const item7  = extractItem(text,
    'ITEM\\s+5[A-Z]?\\.?\\s+(?:OPERATING\\s+AND\\s+FINANCIAL|DIRECTORS|FINANCIAL\\s+REVIEW|MANAGEMENT)',
    'ITEM\\s+(?:5[A-Z]|6)[\\.\\s]');
  const kc = (v) => v ? `${(v.length / 1000).toFixed(0)}k chars` : 'NOT FOUND';
  console.log(`  [20-F] Item 4 (Business): ${kc(item1)} | Item 3 (Risk): ${kc(item1a)} | Item 5 (MD&A): ${kc(item7)}`);
  return { item1, item1a, item7 };
}

// ─── XBRL 2-Year ──────────────────────────────────────────────────────────────

// ns: namespace to search — null defaults to ['us-gaap','dei'] for 10-K,
//     'ifrs-full' for 20-F filers
// Fetch up to 5 fiscal years per concept (merging synonym tags by year via the
// shared xbrl-history module). buildTables() still reads indices [0]/[1] for the
// existing 2-year comparison; buildHistoryMarkdown() consumes the full series.
async function fetchXBRL2(cik, filingType = '10-K') {
  const data = await fetchJSON(`${BASE_DATA}/api/xbrl/companyfacts/CIK${cik}.json`);
  await sleep(RATE_MS);
  const facts = data.facts ?? {};
  const concepts = filingType === '20-F' ? IFRS_CONCEPTS : CONCEPTS;
  const ns       = filingType === '20-F' ? 'ifrs-full'   : null;
  const out = {};
  for (const [k, list] of Object.entries(concepts)) out[k] = pickSeries(facts, list, ns, 5);
  return out;
}

// ─── Financial Tables ─────────────────────────────────────────────────────────

const gv = (arr, i) => arr?.[i]?.value ?? null;
const gd = (arr, i) => arr?.[i]?.end   ?? null;

function normShares(v) { return (v != null && v < 5_000_000) ? v * 1000 : v; }

function fmtM(n) {
  if (n == null || isNaN(n)) return 'N/A';
  const sign = n < 0 ? '-' : '';
  const abs  = Math.abs(n);
  return sign + '$' + Math.round(abs / 1e6).toLocaleString('en-US') + 'M';
}

function fmtChg(a, b) {
  if (a == null || b == null || b === 0) return 'N/A';
  const p = ((a - b) / Math.abs(b)) * 100;
  return (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
}

function fmtX(n, dp = 2) {
  if (n == null || isNaN(n) || !isFinite(n)) return 'N/A';
  return n.toFixed(dp) + 'x';
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return 'N/A';
  return (n * 100).toFixed(1) + '%';
}

function fyLabel(end) { return end ? `FY ${end.slice(0, 4)}` : 'FY ?'; }

function buildTables(x) {
  const c = k => gv(x[k], 0);
  const p = k => gv(x[k], 1);

  const fy0 = fyLabel(gd(x.revenue, 0));
  const fy1 = fyLabel(gd(x.revenue, 1));

  const rev0 = c('revenue'),         rev1 = p('revenue');
  const oi0  = c('operatingIncome'), oi1  = p('operatingIncome');
  const da0  = c('da'),              da1  = p('da');
  const ie0  = c('interestExpense'), ie1  = p('interestExpense');
  const ni0  = c('netIncome'),       ni1  = p('netIncome');
  const eps0 = c('epsDiluted'),      eps1 = p('epsDiluted');
  const ltd0 = c('longTermDebt'),    ltd1 = p('longTermDebt');
  const std0 = c('shortTermDebt'),   std1 = p('shortTermDebt');
  const csh0 = c('cash'),            csh1 = p('cash');
  const eq0  = c('equity'),          eq1  = p('equity');
  const ta0  = c('totalAssets'),     ta1  = p('totalAssets');
  const tl0  = c('totalLiabilities'),tl1  = p('totalLiabilities');
  const ca0  = c('currentAssets'),   ca1  = p('currentAssets');
  const cl0  = c('currentLiabilities'), cl1 = p('currentLiabilities');
  const inv0 = c('inventory'),       inv1 = p('inventory');
  const ocf0 = c('ocf'),             ocf1 = p('ocf');
  const cpx0 = c('capex'),           cpx1 = p('capex');
  const div0 = c('dividendsPaid'),   div1 = p('dividendsPaid');
  const sh0  = normShares(c('sharesOut'));

  const ebitda0 = oi0 != null && da0 != null ? oi0 + da0 : null;
  const ebitda1 = oi1 != null && da1 != null ? oi1 + da1 : null;
  const td0 = (ltd0 ?? 0) + (std0 ?? 0);
  const td1 = (ltd1 ?? 0) + (std1 ?? 0);
  const nd0 = td0 - (csh0 ?? 0);
  const nd1 = td1 - (csh1 ?? 0);
  const fcf0 = ocf0 != null && cpx0 != null ? ocf0 - Math.abs(cpx0) : null;
  const fcf1 = ocf1 != null && cpx1 != null ? ocf1 - Math.abs(cpx1) : null;

  const cr0 = ca0 && cl0 ? ca0 / cl0 : null;
  const cr1 = ca1 && cl1 ? ca1 / cl1 : null;
  const qr0 = ca0 && cl0 ? (inv0 != null ? ca0 - inv0 : ca0) / cl0 : null;
  const qr1 = ca1 && cl1 ? (inv1 != null ? ca1 - inv1 : ca1) / cl1 : null;
  const or0 = ocf0 && cl0 ? ocf0 / cl0 : null;
  const or1 = ocf1 && cl1 ? ocf1 / cl1 : null;
  const de0 = td0 && eq0  ? td0 / Math.abs(eq0) : null;
  const de1 = td1 && eq1  ? td1 / Math.abs(eq1) : null;
  const ne0 = nd0 != null && eq0 ? nd0 / Math.abs(eq0) : null;
  const ne1 = nd1 != null && eq1 ? nd1 / Math.abs(eq1) : null;
  const da0_ = td0 && ta0 ? td0 / ta0 : null;
  const da1_ = td1 && ta1 ? td1 / ta1 : null;
  const ic0 = ebitda0 && ie0 && ie0 > 0 ? ebitda0 / ie0 : null;
  const ic1 = ebitda1 && ie1 && ie1 > 0 ? ebitda1 / ie1 : null;
  const om0 = oi0 && rev0 ? oi0 / rev0 : null;
  const om1 = oi1 && rev1 ? oi1 / rev1 : null;
  const nm0 = ni0 && rev0 ? ni0 / rev0 : null;
  const nm1 = ni1 && rev1 ? ni1 / rev1 : null;
  const ra0 = ni0 && ta0  ? ni0 / ta0  : null;
  const ra1 = ni1 && ta1  ? ni1 / ta1  : null;
  const re0 = ni0 && eq0  ? ni0 / Math.abs(eq0) : null;
  const re1 = ni1 && eq1  ? ni1 / Math.abs(eq1) : null;

  const L = [];
  const row = (...c) => L.push('| ' + c.join(' | ') + ' |');
  const sep = n  => L.push('|' + Array(n).fill('---|').join(''));

  L.push('### Income Statement Summary', '');
  row(`Line Item`, fy0, fy1, 'Change'); sep(4);
  row('Total Revenue',    fmtM(rev0),    fmtM(rev1),    fmtChg(rev0, rev1));
  row('Operating Income', fmtM(oi0),     fmtM(oi1),     fmtChg(oi0, oi1));
  row('EBITDA',           fmtM(ebitda0), fmtM(ebitda1), fmtChg(ebitda0, ebitda1));
  row('Interest Expense', fmtM(ie0),     fmtM(ie1),     fmtChg(ie0, ie1));
  row('Net Income',       fmtM(ni0),     fmtM(ni1),     fmtChg(ni0, ni1));
  row('EPS (Diluted)',    eps0 != null ? `$${eps0.toFixed(2)}` : 'N/A',
                          eps1 != null ? `$${eps1.toFixed(2)}` : 'N/A', fmtChg(eps0, eps1));
  L.push('');

  L.push('### Balance Sheet Summary', '');
  row(`Line Item`, fy0, fy1, 'Change'); sep(4);
  row('Total Debt',         fmtM(td0),  fmtM(td1),  fmtChg(td0, td1));
  row('Cash & Equivalents', fmtM(csh0), fmtM(csh1), fmtChg(csh0, csh1));
  row('Net Debt',           fmtM(nd0),  fmtM(nd1),  fmtChg(nd0, nd1));
  row('Total Equity',       fmtM(eq0),  fmtM(eq1),  fmtChg(eq0, eq1));
  row('Total Assets',       fmtM(ta0),  fmtM(ta1),  fmtChg(ta0, ta1));
  L.push('');

  L.push('### Cash Flow Summary', '');
  row(`Line Item`, fy0, fy1, 'Change'); sep(4);
  row('Operating Cash Flow', fmtM(ocf0), fmtM(ocf1), fmtChg(ocf0, ocf1));
  row('Capital Expenditure', cpx0 != null ? fmtM(-Math.abs(cpx0)) : 'N/A',
                             cpx1 != null ? fmtM(-Math.abs(cpx1)) : 'N/A', fmtChg(cpx0, cpx1));
  row('Free Cash Flow',      fmtM(fcf0), fmtM(fcf1), fmtChg(fcf0, fcf1));
  row('Dividends Paid',      div0 != null ? fmtM(-Math.abs(div0)) : 'N/A',
                             div1 != null ? fmtM(-Math.abs(div1)) : 'N/A', fmtChg(div0, div1));
  L.push('');

  L.push('### Liquidity Ratios', '');
  row('Ratio', fy0, fy1); sep(3);
  row('Current Ratio',           fmtX(cr0), fmtX(cr1));
  row('Quick Ratio (Acid Test)', fmtX(qr0), fmtX(qr1));
  row('OCF Ratio',               fmtX(or0), fmtX(or1));
  L.push('');

  L.push('### Solvency Ratios', '');
  row('Ratio', fy0, fy1); sep(3);
  row('Total Debt / Equity',               fmtX(de0),  fmtX(de1));
  row('Net Debt / Equity',                 fmtX(ne0),  fmtX(ne1));
  row('Debt / Total Assets',               fmtX(da0_), fmtX(da1_));
  row('Interest Coverage (EBITDA/Interest)',fmtX(ic0),  fmtX(ic1));
  L.push('');

  L.push('### Profitability Ratios', '');
  row('Ratio', fy0, fy1); sep(3);
  row('Operating Margin',       fmtPct(om0), fmtPct(om1));
  row('Net Profit Margin',      fmtPct(nm0), fmtPct(nm1));
  row('Return on Assets (ROA)', fmtPct(ra0), fmtPct(ra1));
  row('Return on Equity (ROE)', fmtPct(re0), fmtPct(re1));
  L.push('');

  // Raw values block — for Claude to use when computing appendix examples
  L.push('### Reference Values for Appendix Calculations (JSON)', '');
  L.push('```json');
  L.push(JSON.stringify({
    fy0, fy1,
    currentAssets:      { fy0: ca0, fy1: ca1 },
    currentLiabilities: { fy0: cl0, fy1: cl1 },
    inventory:          { fy0: inv0, fy1: inv1 },
    totalAssets:        { fy0: ta0, fy1: ta1 },
    equity:             { fy0: eq0, fy1: eq1 },
    sharesOutstanding:  sh0,
    ebitda:             { fy0: ebitda0, fy1: ebitda1 },
    interestExpense:    { fy0: ie0, fy1: ie1 },
    netLeverage_fy0:    ebitda0 ? fmtX(nd0 / ebitda0) : 'N/A',
    totalLiabilities:   { fy0: tl0, fy1: tl1 },
  }, null, 2));
  L.push('```', '');

  return { markdown: L.join('\n'), fy0, fy1 };
}

// ─── Docx Builder ────────────────────────────────────────────────────────────

// Parse inline markdown: **bold**, *italic*, `code`
function parseInline(text, baseSizePt = 11) {
  const sz = baseSizePt * 2; // half-points
  const runs = [];
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: 'Calibri', size: sz }));
    } else if (part.startsWith('*') && part.endsWith('*')) {
      runs.push(new TextRun({ text: part.slice(1, -1), italics: true, font: 'Calibri', size: sz }));
    } else if (part.startsWith('`') && part.endsWith('`')) {
      runs.push(new TextRun({ text: part.slice(1, -1), font: 'Courier New', size: Math.round(sz * 0.9), color: '2C3E50' }));
    } else {
      runs.push(new TextRun({ text: part, font: 'Calibri', size: sz }));
    }
  }
  return runs.length ? runs : [new TextRun({ text: '', font: 'Calibri', size: sz })];
}

function docH1(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 48, font: 'Calibri', color: COL.navy })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 240 },
  });
}

function docH2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 28, font: 'Calibri', color: COL.navy })],
    spacing: { before: 400, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COL.navy, space: 4 } },
  });
}

function docH3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, font: 'Calibri', color: COL.green })],
    spacing: { before: 280, after: 80 },
  });
}

function docH4(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, font: 'Calibri', color: COL.accent })],
    spacing: { before: 200, after: 60 },
  });
}

function docPara(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  // "Analyst's Inference:" and "Key Inferences:" get a subtle left indent to distinguish them
  const isInference = /^(\*\*)?Analyst's Inference:|(\*\*)?Key Inferences:/i.test(trimmed);
  return new Paragraph({
    children: parseInline(trimmed, 11),
    spacing: { before: 80, after: 80, line: 276, lineRule: 'auto' },
    alignment: AlignmentType.JUSTIFIED,
    indent: isInference ? { left: 360 } : undefined,
  });
}

function docMeta(text) {
  return new Paragraph({
    children: parseInline(text, 10),
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
  });
}

function docTable(tableLines) {
  const dataLines = tableLines.filter(l => !/^\|[\s\-|:]+\|?\s*$/.test(l.trim()));
  if (dataLines.length < 2) return null;

  const parseRow = (line) =>
    line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim());

  const headerCells = parseRow(dataLines[0]);
  const bodyLines   = dataLines.slice(1);

  const headerRow = new TableRow({
    tableHeader: true,
    children: headerCells.map(cell =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: cell, bold: true, color: COL.white, font: 'Calibri', size: 18 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
        })],
        shading: { fill: COL.navy, type: ShadingType.CLEAR, color: 'auto' },
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
      })
    ),
  });

  const bodyRows = bodyLines.map((line, idx) => {
    const cells = parseRow(line);
    const shade = idx % 2 === 1 ? { fill: COL.lgray, type: ShadingType.CLEAR, color: 'auto' } : undefined;
    return new TableRow({
      children: cells.map((cell, ci) =>
        new TableCell({
          children: [new Paragraph({
            children: parseInline(cell, 10),
            alignment: ci === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
            spacing: { before: 50, after: 50 },
          })],
          shading: shade,
          margins: { top: 50, bottom: 50, left: 100, right: 100 },
        })
      ),
    });
  });

  return new Table({
    rows: [headerRow, ...bodyRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:     { style: BorderStyle.SINGLE, size: 4, color: COL.navy },
      bottom:  { style: BorderStyle.SINGLE, size: 4, color: COL.navy },
      left:    { style: BorderStyle.SINGLE, size: 4, color: COL.navy },
      right:   { style: BorderStyle.SINGLE, size: 4, color: COL.navy },
      insideH: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideV: { style: BorderStyle.SINGLE, size: 1, color: 'D5D8DC' },
    },
  });
}

function markdownToDocx(md, company, ticker, reportDate) {
  const lines    = md.split('\n');
  const children = [];

  // Cover header
  children.push(new Paragraph({ text: '', spacing: { before: 0, after: 240 } }));
  children.push(docMeta(`FinVault  |  ${company.industry}  |  ${company.exchange}: ${ticker}`));
  children.push(docMeta(`Report Date: ${new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long' })}  |  Fiscal Year Covered: ${reportDate}`));
  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.DOUBLE, size: 4, color: COL.navy, space: 6 } },
    spacing: { before: 160, after: 320 },
    text: '',
  }));

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('# ')) {
      children.push(docH1(line.slice(2).trim()));
    } else if (line.startsWith('## ')) {
      children.push(docH2(line.slice(3).trim()));
    } else if (line.startsWith('### ')) {
      children.push(docH3(line.slice(4).trim()));
    } else if (line.startsWith('#### ')) {
      children.push(docH4(line.slice(5).trim()));
    } else if (line.trim().startsWith('|')) {
      // Collect all table lines
      const tblLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tblLines.push(lines[i]);
        i++;
      }
      const tbl = docTable(tblLines);
      if (tbl) {
        children.push(tbl);
        children.push(new Paragraph({ text: '', spacing: { before: 120, after: 0 } }));
      }
      continue; // i already advanced
    } else if (line.startsWith('```')) {
      // Skip code blocks (reference data only)
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) i++;
    } else if (/^---+$/.test(line.trim())) {
      children.push(new Paragraph({
        text: '',
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC', space: 4 } },
        spacing: { before: 160, after: 160 },
      }));
    } else if (!line.trim()) {
      // skip blank lines — paragraph spacing handles visual gaps
    } else {
      const p = docPara(line);
      if (p) children.push(p);
    }

    i++;
  }

  // Disclaimer footer
  children.push(new Paragraph({ text: '', spacing: { before: 480, after: 0 } }));
  children.push(new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC', space: 4 } },
    children: [new TextRun({
      text: 'DISCLAIMER: This report is produced by FinVault for informational and educational purposes only. It does not constitute financial, investment, tax, or legal advice. All numerical data sourced from SEC EDGAR XBRL filings. Narrative analysis generated with AI assistance and reviewed by a qualified analyst prior to publication. NovaSect / FinVault holds no positions in any covered company and receives no compensation from covered entities.',
      font: 'Calibri', size: 16, color: '7F8C8D', italics: true,
    })],
    spacing: { before: 120, after: 0 },
  }));

  return new Document({
    creator: 'FinVault',
    title: `${company.name} (${ticker}) — Financial Statement Analysis`,
    description: 'FinVault Equity Research Report',
    sections: [{
      properties: {
        page: { margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 } },
      },
      children,
    }],
  });
}

// ─── PDF Pipeline ────────────────────────────────────────────────────────────

async function fetchPdfBuffer(url) {
  console.log(`  [PDF] Fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FinVault/1.0; +https://novasect.space)',
      'Accept': 'application/pdf,*/*',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`PDF fetch failed: HTTP ${res.status} — ${url}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('pdf') && !url.toLowerCase().includes('.pdf')) {
    console.warn(`  [PDF] Warning: content-type "${ct}" — verify this URL returns a PDF`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function parsePdfText(buffer) {
  // pdf-parse is CJS — use createRequire for ESM compatibility
  const pdfParse = _require('pdf-parse');
  const result = await pdfParse(buffer, { max: 0 }); // max: 0 = all pages
  console.log(`  [PDF] Parsed ${result.numpages} pages, ${Math.round(result.text.length / 1000)}k chars`);
  return result.text;
}

// Uses Claude to extract structured financials + narrative from raw PDF text.
// Returns { xbrl, narrative, currency } where xbrl matches the shape fetchXBRL2 produces.
async function extractFinancialsFromPDF(pdfText, company, ticker, model) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const client = new Anthropic({ apiKey });

  // Focus on the financial statements section — first 120k chars covers most annual reports
  const text = pdfText.length > 120_000 ? pdfText.slice(0, 120_000) : pdfText;

  const system = `You are a financial data extraction specialist. Your task is to extract structured financial data from an annual report and return it as valid JSON. Rules:
1. Extract CONSOLIDATED (group-level) figures only. Never extract parent-company-only or subsidiary-only statements. If you cannot find consolidated statements, set "isConsolidated": false.
2. Return monetary values exactly as they appear in the document (do not convert currencies or change scale).
3. Return fiscal year end dates as YYYY-MM-DD strings.
4. Return exactly two years of data where available — current year first, prior year second.
5. If a line item cannot be found, return an empty array [].
6. Your entire response must be valid JSON with no surrounding text.`;

  const user = `Extract financial data for ${company.name} (${ticker}) from this annual report text. The report currency is ${company.reportCurrency || 'unknown'}.

Return this exact JSON structure:
{
  "isConsolidated": true,
  "reportCurrency": "EUR",
  "denomination": "millions",
  "financials": {
    "revenue":            [{"value": 0, "end": "YYYY-MM-DD"}],
    "operatingIncome":    [],
    "da":                 [],
    "interestExpense":    [],
    "netIncome":          [],
    "epsDiluted":         [],
    "longTermDebt":       [],
    "shortTermDebt":      [],
    "cash":               [],
    "sharesOut":          [],
    "equity":             [],
    "totalAssets":        [],
    "totalLiabilities":   [],
    "currentAssets":      [],
    "currentLiabilities": [],
    "inventory":          [],
    "ocf":                [],
    "capex":              [],
    "dividendsPaid":      []
  },
  "narrative": {
    "businessDescription": "",
    "riskFactors": "",
    "mdaText": ""
  }
}

Notes:
- denomination: "millions", "billions", or "thousands" — whichever matches the report's stated scale
- For netIncome: use profit attributable to equity holders of the parent (not including minorities) if stated separately; otherwise total group profit
- For operatingIncome: use operating profit / EBIT
- For da: use depreciation & amortisation / D&A charge
- For interestExpense: use finance costs or interest expense (absolute positive value)
- For capex: absolute positive value of capital expenditure outflows
- For dividendsPaid: absolute positive value of dividends paid to shareholders
- For sharesOut: weighted average diluted shares if available, otherwise shares outstanding — in millions
- For epsDiluted: literal per-share value as shown (e.g. 4.67), NOT scaled
- narrative fields: extract verbatim from the report, max 8000 chars each; empty string if not found
- isConsolidated: true only if statements are clearly labelled as consolidated / group accounts

Annual report text:
${text}`;

  console.log(`  [PDF→Claude] Extracting financials (${Math.round(text.length / 1000)}k chars)...`);
  const msg = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const raw = msg.content[0].text.trim();
  let parsed;
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`PDF extraction: Claude returned non-JSON response. Raw (first 300 chars): ${raw.slice(0, 300)}`);
  }

  if (!parsed.isConsolidated) {
    throw new Error(
      `PDF extraction: Document for ${ticker} does not appear to contain consolidated group financials. ` +
      `Verify the pdfUrl points to the full Group Annual Report, not a parent-company-only or subsidiary filing.`
    );
  }

  // Normalise monetary values to raw base units (same as XBRL pipeline)
  // epsDiluted is already per-share; sharesOut is in millions → convert to raw count
  const denom = (parsed.denomination || 'millions').toLowerCase();
  const toRaw = denom === 'billions' ? 1e9 : denom === 'thousands' ? 1e3 : 1e6;
  const PER_SHARE = new Set(['epsDiluted']);
  const SHARE_COUNT = new Set(['sharesOut']); // Claude returns in millions

  const xbrl = {};
  for (const [k, arr] of Object.entries(parsed.financials || {})) {
    xbrl[k] = (arr || [])
      .filter(e => e != null && e.value != null && e.end)
      .map(e => {
        let v = e.value;
        if (PER_SHARE.has(k))   v = v;            // already per-share, no scaling
        else if (SHARE_COUNT.has(k)) v = v * 1e6; // millions → raw count
        else                    v = v * toRaw;    // monetary: scale to raw base unit
        return { value: v, end: e.end };
      });
  }

  console.log(`  [PDF→Claude] Extraction complete. Currency: ${parsed.reportCurrency}, Denomination: ${denom}`);
  return { xbrl, narrative: parsed.narrative || {}, currency: parsed.reportCurrency || company.reportCurrency };
}

// ─── Claude API ───────────────────────────────────────────────────────────────

async function callClaude(systemPrompt, userMessage, model) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set.\nSet it with: $env:ANTHROPIC_API_KEY = "sk-ant-..."');

  const client = new Anthropic({ apiKey });
  console.log(`  [Claude] Model: ${model} — generating...`);

  const msg = await client.messages.create({
    model,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  if (msg.stop_reason === 'max_tokens') {
    console.warn('  [Claude] WARNING: Output truncated at max_tokens. Use --model=claude-opus-4-7 for longer output.');
  }
  return msg.content[0].text;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args     = process.argv.slice(2);
  const ticker   = args.find(a => !a.startsWith('--'))?.toUpperCase();
  const modelArg = args.find(a => a.startsWith('--model='))?.split('=')[1];
  const model    = modelArg ?? DEFAULT_MODEL;

  if (!ticker) {
    console.error([
      '',
      'Usage:   node scripts/generate-report.mjs <TICKER> [--model=<id>]',
      'Example: node scripts/generate-report.mjs XOM',
      '         node scripts/generate-report.mjs RTX --model=claude-opus-4-7',
      '',
      `Supported: ${Object.keys(REGISTRY).join(', ')}`,
      '',
      'Requires: ANTHROPIC_API_KEY environment variable',
    ].join('\n'));
    process.exit(1);
  }

  const company = REGISTRY[ticker];
  if (!company) {
    console.error(`Unknown ticker "${ticker}". Add it to REGISTRY in generate-report.mjs.`);
    process.exit(1);
  }

  if (!existsSync(STAGING)) mkdirSync(STAGING, { recursive: true });

  const filingType = company.filingType || '10-K';
  const currency   = company.reportCurrency || 'USD';

  console.log(`\n${'─'.repeat(62)}`);
  console.log(` FinVault Report Generator`);
  console.log(` Company : ${company.name} (${ticker})`);
  console.log(` Sector  : ${company.sector.toUpperCase()}`);
  console.log(` Source  : ${filingType}${filingType === 'PDF' ? ` (${currency})` : ''}`);
  console.log(` Model   : ${model}`);
  console.log(`${'─'.repeat(62)}\n`);

  // ── Route by filing type ────────────────────────────────────────────────────

  let items, xbrlData, fy0, fy1, filingDate, reportDate, dataSourceNote;

  if (filingType === '10-K' || filingType === '20-F') {

    // ── EDGAR path (10-K or 20-F) ───────────────────────────────────────────
    process.stdout.write(`[1/5] CIK lookup ... `);
    const cik = await getCIK(ticker);
    console.log(`CIK ${cik}`);

    if (filingType === '20-F') {
      process.stdout.write(`[1b/5] Validating parent entity ... `);
      await validateParentEntity(cik, company.name);
    }

    process.stdout.write(`[2/5] Latest ${filingType} ... `);
    const filing = await getLatestFiling(cik, filingType);
    filingDate = filing.filingDate;
    reportDate = filing.reportDate;
    console.log(`filed ${filingDate} (period end ${reportDate})`);

    console.log(`[3/5] Extracting ${filingType} sections...`);
    items = filingType === '20-F'
      ? await extract20FItems(cik, filing)
      : await extract10KItems(cik, filing);

    process.stdout.write(`[4/5] XBRL 5-year financials (${filingType === '20-F' ? 'IFRS' : 'US-GAAP'}) ... `);
    xbrlData = await fetchXBRL2(cik, filingType);
    const built = buildTables(xbrlData);
    fy0 = built.fy0; fy1 = built.fy1;
    console.log(`${fy0} vs ${fy1}`);

    dataSourceNote = filingType === '20-F'
      ? `SEC EDGAR 20-F filing (IFRS, ${currency}). Filed ${filingDate}, period ending ${reportDate}.`
      : `SEC EDGAR 10-K filing (US-GAAP). Filed ${filingDate}, period ending ${reportDate}.`;

    // reuse built tables markdown
    var tables = built.markdown + '\n\n' + buildHistoryMarkdown(xbrlData);

  } else if (filingType === 'PDF') {

    // ── PDF path ─────────────────────────────────────────────────────────────
    if (!company.pdfUrl) {
      throw new Error(
        `pdfUrl is not set for ${ticker}.\n` +
        `Open generate-report.mjs, find the ${ticker} entry in REGISTRY, and set pdfUrl to the\n` +
        `direct download link for the consolidated annual report PDF.\n` +
        `IR page reference is noted in the comment beside the registry entry.`
      );
    }

    console.log(`[1/4] Downloading PDF...`);
    const pdfBuffer = await fetchPdfBuffer(company.pdfUrl);

    console.log(`[2/4] Parsing PDF text...`);
    const pdfText = await parsePdfText(pdfBuffer);

    console.log(`[3/4] Extracting financials via Claude...`);
    const extracted = await extractFinancialsFromPDF(pdfText, company, ticker, model);
    xbrlData = extracted.xbrl;
    items    = {
      item1:  extracted.narrative?.businessDescription || null,
      item1a: extracted.narrative?.riskFactors         || null,
      item7:  extracted.narrative?.mdaText             || null,
    };

    const built = buildTables(xbrlData);
    fy0 = built.fy0; fy1 = built.fy1;
    var tables = built.markdown + '\n\n' + buildHistoryMarkdown(xbrlData);
    filingDate  = 'N/A (PDF source)';
    reportDate  = fy0;
    dataSourceNote = `Annual Report PDF sourced from company IR page (${currency}, consolidated group accounts). Figures extracted via Claude — verify against published report before publishing.`;
    console.log(`[3/4] Done — ${fy0} vs ${fy1}`);

  } else {
    throw new Error(`Unknown filingType "${filingType}" for ${ticker}`);
  }

  // ── Build prompt & call Claude ──────────────────────────────────────────────
  const sysPrompt  = readFileSync(TEMPLATE, 'utf8');
  const sectorNote = 'INCLUDE Section 9 (Valuation — Multiples) and Section 10 (Appendix — Ratio Formulae) in all reports.';
  const step       = filingType === 'PDF' ? '4/4' : '5/5';

  const filingLabel = filingType === '10-K' ? '10-K' : filingType === '20-F' ? '20-F' : 'Annual Report (PDF)';
  const dataLabel   = filingType === 'PDF'
    ? 'EXTRACTED FROM ANNUAL REPORT PDF — verify figures before publishing'
    : `SEC EDGAR XBRL — use these exact figures`;

  const userMsg = [
    '## COMPANY CONTEXT',
    `- **Company Name:** ${company.name}`,
    `- **Ticker:** ${ticker}`,
    `- **Exchange:** ${company.exchange}`,
    `- **Sector:** ${company.sector.toUpperCase()}`,
    `- **Industry:** ${company.industry}`,
    `- **Fiscal Year:** ${fy0} (${filingLabel} filed ${filingDate}, period ending ${reportDate})`,
    `- **Prior Year:** ${fy1}`,
    `- **Peer Set:** ${company.peers.join(', ')}`,
    `- **Report Currency:** ${currency}`,
    `- **Data Source:** ${dataSourceNote}`,
    '',
    `## FINANCIAL DATA (${dataLabel})`,
    '',
    tables,
    '',
    `## ${filingType === 'PDF' ? 'ANNUAL REPORT' : filingLabel} EXCERPTS`,
    '',
    items.item1
      ? `### Business Overview\n\n${items.item1}`
      : '### Business Overview\n\n[Not extracted — use company knowledge and peer context]',
    '',
    items.item1a
      ? `### Risk Factors\n\n${items.item1a}`
      : '### Risk Factors\n\n[Not extracted — use sector-appropriate risk factors]',
    '',
    items.item7
      ? `### Operating & Financial Review (MD&A)\n\n${items.item7}`
      : '### Operating & Financial Review (MD&A)\n\n[Not extracted — derive from financial data above]',
    '',
    '## GENERATION TASK',
    `Generate the **complete** FinVault Financial Statement Analysis Report for ${company.name} (${ticker}).`,
    '',
    `**Critical requirements:**`,
    `- Every section must contain BOTH a table (where applicable) AND substantial written analysis. Do not produce tables without the accompanying "Analyst's Inference:" paragraph.`,
    `- The Executive Summary must be a minimum of 600 words of continuous prose — no bullet points, no tables.`,
    `- Each segment in Section 5 must have a dedicated narrative paragraph in addition to the table.`,
    `- Section 6 (Cash Flow Analysis) must have three written paragraphs — one per cash flow category.`,
    `- Section 7 (Sector-Specific Analysis) must contain written inference paragraphs, not just a data table.`,
    `- Section 8 (Risks) must have a complete explanation column — not one-line entries.`,
    `- Sector is **${company.sector.toUpperCase()}**. ${sectorNote}`,
    `- All monetary figures are denominated in ${currency}. Use the correct currency symbol throughout.`,
    `- Fiscal year labels: current = ${fy0}, prior = ${fy1}.`,
  ].join('\n');

  console.log(`[${step}] Generating report with Claude...`);
  const draft = await callClaude(sysPrompt, userMsg, model);

  // ── Save output ─────────────────────────────────────────────────────────────
  const date     = new Date().toISOString().slice(0, 10);
  const baseName = `${ticker.replace(/[^A-Za-z0-9]/g, '_')}-${date}`;
  const docxPath = join(STAGING, `${baseName}.docx`);
  const mdPath   = join(STAGING, `${baseName}.md`);

  const doc    = markdownToDocx(draft, company, ticker, fy0);
  const buffer = await Packer.toBuffer(doc);
  writeFileSync(docxPath, buffer);
  writeFileSync(mdPath, draft, 'utf8');

  const words = draft.split(/\s+/).length;
  console.log(`\n${'─'.repeat(62)}`);
  console.log(` Draft saved  : ${docxPath}`);
  console.log(` Backup (md)  : ${mdPath}`);
  console.log(` Word count   : ~${words.toLocaleString()}`);
  if (filingType === 'PDF') {
    console.log(`\n [!] PDF source: verify all extracted figures against the published report before publishing.`);
  }
  console.log(`\n Next step    : open the .docx, review narrative, publish.`);
  console.log(`${'─'.repeat(62)}\n`);
}

main().catch(err => {
  console.error(`\nFatal: ${err.message}`);
  process.exit(1);
});
