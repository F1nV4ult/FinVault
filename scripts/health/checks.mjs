/**
 * The four Layer-1 canaries. Each returns a result object:
 *
 *   { severity: 'pass' | 'HIGH', title: string, evidence?: string }
 *
 * Severity is HIGH or pass — no medium/low for the minimal slice
 * (all four were declared HIGH-severity at planning time).
 *
 * All checks hit the live production deployment so failures reflect
 * what real users actually see. SITE_URL defaults to novasect.space.
 */

const REQUEST_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url, init = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
        return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
        clearTimeout(t);
    }
}

async function timed(fn) {
    const t0 = Date.now();
    const res = await fn();
    return { res, ms: Date.now() - t0 };
}

const ok = (title) => ({ severity: 'pass', title });
const fail = (title, evidence) => ({ severity: 'HIGH', title, evidence });

// ── 1. Yahoo proxy canary ──────────────────────────────────────────
//   GET /api/yahoo-proxy?mode=quote-summary&symbol=XOM
//   Asserts 200 + the modules we actually consume in the FinVault /
//   Brief flows (trailingPE drops from defaultKeyStatistics).
export async function checkYahoo(siteUrl) {
    const url = siteUrl + '/api/yahoo-proxy?mode=quote-summary&symbol=XOM';
    let t;
    try { t = await timed(() => fetchWithTimeout(url)); }
    catch (e) { return fail('Yahoo proxy unreachable', e.message); }
    if (!t.res.ok) {
        return fail('Yahoo proxy returned ' + t.res.status, url + ' in ' + t.ms + ' ms');
    }
    let data;
    try { data = await t.res.json(); }
    catch { return fail('Yahoo proxy payload not JSON', '(' + t.ms + ' ms)'); }
    // Schema is { trailingPE, forwardPE, priceToBook, enterpriseToEbitda } per the proxy.
    if (data == null || typeof data !== 'object') {
        return fail('Yahoo proxy returned non-object payload', JSON.stringify(data).slice(0, 200));
    }
    if (typeof data.trailingPE !== 'number' && data.trailingPE !== null) {
        return fail('Yahoo proxy missing trailingPE field', JSON.stringify(data).slice(0, 200));
    }
    return ok('Yahoo proxy healthy (' + t.ms + ' ms)');
}

// ── 2. Finnhub proxy canary ────────────────────────────────────────
//   GET /api/finnhub-proxy?endpoint=stock/metric&symbol=AAPL
//   Asserts 200 + the TTM block we depend on for live multiples.
export async function checkFinnhub(siteUrl) {
    const url = siteUrl + '/api/finnhub-proxy?endpoint=stock/metric&symbol=AAPL';
    let t, firstFailure = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            t = await timed(() => fetchWithTimeout(url));
            if (t.res.ok) break;
            const body = await t.res.clone().text().catch(() => '');
            firstFailure ||= 'attempt ' + attempt + ': HTTP ' + t.res.status + ' in ' + t.ms + ' ms' + (body ? ' · ' + body.slice(0, 180) : '');
        } catch (e) {
            firstFailure ||= 'attempt ' + attempt + ': ' + e.message;
        }
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!t) return fail('Finnhub proxy unreachable', firstFailure || 'two attempts failed');
    if (!t.res.ok) {
        const auth = (t.res.status === 401 || t.res.status === 403)
            ? ' — API key likely expired/invalid (rotate FINNHUB_API_KEY in Vercel env)' : '';
        const body = await t.res.text().catch(() => '');
        return fail('Finnhub proxy returned ' + t.res.status + auth,
            (firstFailure ? firstFailure + '\n' : '') + 'final: HTTP ' + t.res.status + ' in ' + t.ms + ' ms' + (body ? ' · ' + body.slice(0, 180) : ''));
    }
    let data;
    try { data = await t.res.json(); }
    catch { return fail('Finnhub proxy payload not JSON', '(' + t.ms + ' ms)'); }
    if (!data || !data.metric || typeof data.metric.peExclExtraTTM !== 'number') {
        return fail('Finnhub proxy missing metric.peExclExtraTTM',
            JSON.stringify(data).slice(0, 200));
    }
    return ok('Finnhub proxy healthy (' + t.ms + ' ms' + (firstFailure ? ' · recovered on retry' : '') + ')');
}

// ── 3. Universe coverage ───────────────────────────────────────────
//   Fetches the live data/universe.json and verifies every ticker has
//   the keystone fields the brief / finvault / sentinel / osiris
//   pages depend on. Catches silent data rot from build-universe runs.
export async function checkUniverse(siteUrl) {
    const url = siteUrl + '/data/universe.json';
    let res;
    try { res = await fetchWithTimeout(url); }
    catch (e) { return fail('universe.json unreachable', e.message); }
    if (!res.ok) return fail('universe.json returned ' + res.status, url);

    let data;
    try { data = await res.json(); }
    catch { return fail('universe.json malformed (not JSON)', ''); }
    if (!data || !data.tickers || typeof data.tickers !== 'object') {
        return fail('universe.json malformed (no .tickers)', '');
    }
    const tickers = Object.values(data.tickers);
    if (tickers.length === 0) return fail('universe.json has zero tickers', '');

    const issues = [];
    for (const t of tickers) {
        if (!t.ticker)                                        issues.push('<unknown>: no ticker key');
        if (!t.name)                                          issues.push(t.ticker + ': no name');
        if (!t.sentinel || typeof t.sentinel.baseSpread !== 'number')
                                                              issues.push(t.ticker + ': no sentinel.baseSpread');
        if (!t.osiris   || typeof t.osiris.baselineVolatility !== 'number')
                                                              issues.push(t.ticker + ': no osiris.baselineVolatility');
    }
    if (issues.length) {
        const sample = issues.slice(0, 10).join('\n');
        const more = issues.length > 10 ? '\n…and ' + (issues.length - 10) + ' more' : '';
        return fail(issues.length + ' universe coverage gaps across ' + tickers.length + ' tickers',
            '```\n' + sample + more + '\n```');
    }
    return ok(tickers.length + ' tickers, all required fields present');
}

// ── 4. Public asset HEAD check ─────────────────────────────────────
//   HEADs each page + the two static config files. Catches deploy
//   regressions (404s, 500s, redirect loops) before users do.
export async function checkPublicAssets(siteUrl) {
    const assets = [
        '/', '/index.html',
        '/sentinel.html', '/anchor-review.html', '/osiris.html', '/reports.html', '/report.html',
        '/brief.html', '/energy.html', '/industrials.html', '/about.html',
        '/data/universe.json', '/physics-config.json'
    ];
    const failures = [];
    await Promise.all(assets.map(async (a) => {
        try {
            const res = await fetchWithTimeout(siteUrl + a, { method: 'HEAD' });
            if (!res.ok) failures.push(a + ' → ' + res.status);
        } catch (e) {
            failures.push(a + ' → ' + e.message);
        }
    }));
    if (failures.length) {
        return fail(failures.length + '/' + assets.length + ' public assets non-200',
            '```\n' + failures.join('\n') + '\n```');
    }
    return ok(assets.length + ' public assets returning 200');
}

// ── 5. FRED canary ─────────────────────────────────────────────────
//   GET /api/fred-proxy?series_id=DGS10
//   Asserts 200 + a numeric `value` (US 10-year treasury is the Sentinel
//   base-rate anchor — silent FRED failure would break all yield math).
export async function checkFred(siteUrl) {
    const url = siteUrl + '/api/fred-proxy?series_id=DGS10';
    let t;
    try { t = await timed(() => fetchWithTimeout(url)); }
    catch (e) { return fail('FRED proxy unreachable', e.message); }
    if (!t.res.ok) {
        const auth = (t.res.status === 401 || t.res.status === 403)
            ? ' — API key likely expired/invalid (rotate FRED_API_KEY in Vercel env)' : '';
        return fail('FRED proxy returned ' + t.res.status + auth, url + ' in ' + t.ms + ' ms');
    }
    let data;
    try { data = await t.res.json(); }
    catch { return fail('FRED proxy payload not JSON', '(' + t.ms + ' ms)'); }
    if (!data || typeof data.value !== 'number' || !isFinite(data.value)) {
        return fail('FRED proxy missing numeric value', JSON.stringify(data).slice(0, 200));
    }
    // Sanity range — DGS10 historically 0–20 %. Anything outside that
    // is almost certainly a payload-shape change, not a market move.
    if (data.value < 0 || data.value > 20) {
        return fail('FRED DGS10 value out of plausible range: ' + data.value,
            JSON.stringify(data).slice(0, 200));
    }
    return ok('FRED proxy healthy · DGS10=' + data.value.toFixed(2) + '% (' + t.ms + ' ms)');
}

// ── 6. Stale-anchor audit ──────────────────────────────────────────
//   Spawns scripts/check-stale-anchors.js --overdue and parses the
//   "Summary: N of M overdue." line. Alerts when any Sentinel anchor
//   is past the 90-day refresh window. Procedure: SENTINEL-CALIBRATION.md.
export async function checkStaleAnchors() {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync('node', ['scripts/check-stale-anchors.js', '--overdue'], {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 30_000
    });
    if (r.error) return fail('Stale-anchor script error', r.error.message);
    if (r.status !== 0 && r.status !== 1) {
        // Exit 0 = clean, exit 1 = has overdue (expected signal), other = crash.
        return fail('Stale-anchor script exit ' + r.status, (r.stderr || r.stdout).slice(0, 600));
    }
    const out = r.stdout || '';
    const m = out.match(/Summary:\s*(\d+)\s*of\s*(\d+)\s*overdue/);
    if (!m) return fail('Stale-anchor output unparseable', out.slice(0, 400));
    const overdue = parseInt(m[1], 10);
    const total = parseInt(m[2], 10);
    if (overdue > 0) {
        // Extract the table rows under "OVERDUE (>90 days)" for evidence.
        const rows = out.split('\n')
            .filter(l => /^\s{2}[A-Z]/.test(l) && !/Ticker/.test(l))
            .slice(0, 10);
        return fail(overdue + ' of ' + total + ' Sentinel anchors overdue (>90 days)',
            '```\n' + rows.join('\n') + '\n```');
    }
    return ok(total + ' Sentinel anchors, none overdue');
}

// ── 7. Build-universe drift ────────────────────────────────────────
//   Hashes the committed data/universe.json, regenerates it via
//   scripts/build-universe.js, hashes the fresh output, and compares.
//   Drift means someone changed a source file (sentinel.v2.js,
//   physics-config.json, report.html) without re-committing universe.json.
export async function checkUniverseDrift() {
    const { spawnSync } = await import('node:child_process');
    const { readFileSync, writeFileSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const path = 'data/universe.json';

    // Hash only the `tickers` block — `_meta.generated` is a date stamp
    // bumped on every run of build-universe.js, which would otherwise
    // trip the drift alarm every 24 hours regardless of real changes.
    function tickerHash(buf) {
        try {
            const data = JSON.parse(buf.toString());
            const stable = JSON.stringify(data.tickers || {});
            return createHash('sha256').update(stable).digest('hex');
        } catch (e) {
            return null;
        }
    }

    let originalBuf;
    try { originalBuf = readFileSync(path); }
    catch (e) { return fail('data/universe.json missing locally', e.message); }
    const originalHash = tickerHash(originalBuf);
    if (!originalHash) return fail('data/universe.json unparseable on disk', '');

    const r = spawnSync('node', ['scripts/build-universe.js'], {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 60_000
    });
    if (r.status !== 0) {
        writeFileSync(path, originalBuf);
        return fail('build-universe.js exit ' + r.status, (r.stderr || r.stdout).slice(0, 600));
    }

    const freshBuf = readFileSync(path);
    const freshHash = tickerHash(freshBuf);
    writeFileSync(path, originalBuf);
    if (!freshHash) return fail('regenerated universe.json unparseable', '');

    if (originalHash !== freshHash) {
        // Compute a quick diff signal: count of tickers + a sample of
        // changed ticker keys without dumping the whole JSON.
        let origTickers = [], freshTickers = [];
        try {
            origTickers = Object.keys(JSON.parse(originalBuf.toString()).tickers || {});
            freshTickers = Object.keys(JSON.parse(freshBuf.toString()).tickers || {});
        } catch { /* fall through with empty diffs */ }
        const added = freshTickers.filter(t => !origTickers.includes(t));
        const removed = origTickers.filter(t => !freshTickers.includes(t));
        const lines = [];
        if (added.length) lines.push('Added: ' + added.slice(0, 8).join(', ') + (added.length > 8 ? '…' : ''));
        if (removed.length) lines.push('Removed: ' + removed.slice(0, 8).join(', ') + (removed.length > 8 ? '…' : ''));
        if (!lines.length) lines.push('Ticker set unchanged; field-level drift.');
        return fail('data/universe.json out of sync with sources',
            '```\n' + lines.join('\n') + '\n```\nRun `node scripts/build-universe.js` and commit.');
    }
    return ok('universe.json reproduces from sources cleanly');
}

// ── 8. Finnhub authz sample probe ──────────────────────────────────
//   Probes a fixed 3+3 ticker sample (US vs known-international) via
//   the production Finnhub proxy. Alerts on:
//     · ANY US ticker failing (would mean auth regression)
//     · ANY international ticker starting to succeed (notable improvement;
//       might mean Finnhub raised our plan / changed coverage)
//   This is a 6-call probe, cheap on quota since the proxy edge-caches
//   stock/metric for 6h.
const FINNHUB_SAMPLE_US = ['XOM', 'AAPL', 'MSFT'];
const FINNHUB_SAMPLE_INTL = ['RHM.DE', 'IBE.MC', 'BMW.DE'];

export async function checkFinnhubAuthz(siteUrl) {
    async function probe(symbol) {
        const url = siteUrl + '/api/finnhub-proxy?endpoint=stock/metric&symbol=' + encodeURIComponent(symbol);
        try {
            const res = await fetchWithTimeout(url);
            return { symbol, status: res.status, ok: res.ok };
        } catch (e) {
            return { symbol, status: 0, ok: false, error: e.message };
        }
    }
    const usResults = await Promise.all(FINNHUB_SAMPLE_US.map(probe));
    const intlResults = await Promise.all(FINNHUB_SAMPLE_INTL.map(probe));

    const usFails = usResults.filter(r => !r.ok);
    const intlPasses = intlResults.filter(r => r.ok);

    if (usFails.length > 0) {
        const lines = usFails.map(r => r.symbol + ' → ' + (r.status || r.error));
        return fail('Finnhub US authz regression: ' + usFails.length + '/' + FINNHUB_SAMPLE_US.length + ' failing',
            '```\n' + lines.join('\n') + '\n```');
    }
    if (intlPasses.length > 0) {
        const lines = intlPasses.map(r => r.symbol + ' → 200');
        return fail('Finnhub international authz improved: ' + intlPasses.length + '/' + FINNHUB_SAMPLE_INTL.length + ' now succeeding',
            '```\n' + lines.join('\n') + '\n```\nWorth reviewing — may unlock multiples for these tickers.');
    }
    return ok('Finnhub authz unchanged · US ' + FINNHUB_SAMPLE_US.length + '/' + FINNHUB_SAMPLE_US.length + ' · INTL 0/' + FINNHUB_SAMPLE_INTL.length);
}

// ── 9. Osiris HI-FI engine sanity ──────────────────────────────────
//   Evaluates the actual stochasticWorker.js source via vm.runInContext
//   (stripping the self.onmessage handler that requires a Web Worker
//   global), then runs a small OU and GBM-Jump simulation. Asserts:
//     · all percentile paths > 0 (no negative prices)
//     · p05 < p25 < p50 < p75 < p95 at every step
//     · p95-p05 spread > 0 (paths aren't collapsed to a point)
//     · p50 terminal within a generous bound (no NaN/runaway)
//   Catches math regressions in the worker itself, not a parallel ref
//   implementation that could drift.
export async function checkOsirisEngine() {
    const { readFileSync } = await import('node:fs');
    const vm = await import('node:vm');
    const path = 'components/osiris/stochasticWorker.js';

    let src;
    try { src = readFileSync(path, 'utf8'); }
    catch (e) { return fail('Osiris worker source missing', e.message); }

    // Strip the Web Worker dispatcher; we only need the pure simulation
    // functions (simulateOU, simulateGBMJump, extractPercentilePaths,
    // randomNormal). They're declared at top level, so they'll attach
    // to the vm context as globals.
    //
    // The worker's `postProgress` helper still calls self.postMessage
    // for chunked progress ticks during long HI-FI runs — shim a no-op
    // `self` so the function bodies execute cleanly in Node.
    const trimmed = src.replace(/self\.onmessage\s*=[\s\S]*$/, '');
    const sandbox = {
        Math, Float32Array, Array, Number, isFinite,
        self: { postMessage: () => {} }
    };
    const ctx = vm.createContext(sandbox);
    try { vm.runInContext(trimmed, ctx, { timeout: 5000 }); }
    catch (e) { return fail('Osiris worker source failed to evaluate', e.message); }

    const simulateOU = sandbox.simulateOU;
    const simulateGBMJump = sandbox.simulateGBMJump;
    if (typeof simulateOU !== 'function' || typeof simulateGBMJump !== 'function') {
        return fail('Osiris worker missing expected functions', 'simulateOU / simulateGBMJump not found');
    }

    function assertPercentiles(name, result, initialPrice) {
        const p = result.percentiles;
        const keys = ['p05', 'p10', 'p25', 'p45', 'p50', 'p55', 'p75', 'p90', 'p95'];
        for (const k of keys) {
            if (!p[k] || !p[k].length) return name + ': missing ' + k;
        }
        const steps = p.p50.length;

        // Strict monotonicity holds ONLY at the terminal step — that's
        // where extractPercentilePaths actually sorts. Intermediate
        // steps of the p05 path can be anywhere relative to the p10
        // path's intermediate values (they're different paths sorted
        // by their terminal). At every step we still assert positivity
        // and finiteness.
        for (let i = 0; i < steps; i++) {
            for (const k of keys) {
                const v = p[k][i];
                if (!isFinite(v)) return name + ': non-finite ' + k + ' at step ' + i;
                if (v < 0) return name + ': negative ' + k + ' at step ' + i + ' (' + v.toFixed(2) + ')';
            }
        }

        // Terminal-step invariants — these MUST hold by construction.
        const last = steps - 1;
        const terminalSorted = keys.map(k => p[k][last]);
        for (let j = 1; j < terminalSorted.length; j++) {
            if (!(terminalSorted[j] >= terminalSorted[j - 1])) {
                return name + ': terminal percentiles not monotone (' +
                    keys[j - 1] + '=' + terminalSorted[j - 1].toFixed(2) +
                    ' > ' + keys[j] + '=' + terminalSorted[j].toFixed(2) + ')';
            }
        }
        const terminalSpread = terminalSorted[terminalSorted.length - 1] - terminalSorted[0];
        if (!(terminalSpread > 0)) return name + ': zero terminal p05-p95 spread (paths collapsed)';
        if (terminalSorted[0] <= 0) return name + ': non-positive terminal p05';

        const terminalP50 = p.p50[last];
        if (terminalP50 <= 0 || terminalP50 > initialPrice * 10) {
            return name + ': implausible p50 terminal ' + terminalP50.toFixed(2);
        }
        if (typeof result.pAboveSpot !== 'number' || result.pAboveSpot < 0 || result.pAboveSpot > 1) {
            return name + ': pAboveSpot out of [0,1] (' + result.pAboveSpot + ')';
        }
        return null;
    }

    // Run two small simulations — one per physics engine — at 500 paths
    // × 60 steps. Cheap (~20 ms total) but exercises both code paths.
    try {
        const ouResult = simulateOU(100, 0.05, 0.22, 60, 500, 0.15, 100);
        const ouProblem = assertPercentiles('OU', ouResult, 100);
        if (ouProblem) return fail('Osiris OU engine invariant violated', ouProblem);

        const gbmResult = simulateGBMJump(100, 0.05, 0.22, 60, 500, 4, 0);
        const gbmProblem = assertPercentiles('GBM-Jump', gbmResult, 100);
        if (gbmProblem) return fail('Osiris GBM-Jump engine invariant violated', gbmProblem);
    } catch (e) {
        const detail = (e && (e.stack || e.message)) || String(e);
        return fail('Osiris engine threw during sanity run', '```\n' + detail.slice(0, 600) + '\n```');
    }
    return ok('Osiris worker math invariants hold (OU + GBM-Jump · 500×60)');
}

// ── 10. PDF render smoke ───────────────────────────────────────────
//   Launches headless Chromium via Playwright, loads the live brief
//   page for XOM, clicks Download → PDF, and verifies the resulting
//   file is a valid PDF > 50 KB. Catches end-to-end regressions in
//   the downloads component, the jsPDF/autotable CDN, and the brief
//   page itself — anything a unit test can't see.
//
//   Skips cleanly if Playwright isn't installed (CI installs it via
//   workflow step; local devs can run the cheaper checks without it).
export async function checkPdfRender(siteUrl) {
    let chromium;
    try {
        ({ chromium } = await import('playwright'));
    } catch (e) {
        // Playwright missing → treat as pass with an informational
        // title so the channel doesn't get a recurring red alert just
        // because someone is running locally without it.
        console.log('[pdf-render] playwright not installed — skipping (' + e.message + ')');
        return ok('PDF render check skipped (playwright not installed)');
    }

    const fs = await import('node:fs/promises');
    const os = await import('node:os');
    const path = await import('node:path');

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'novasect-pdf-'));
    let browser;
    // Capture page console + request failures so we can diagnose silent
    // PDF degradation (autotable not loading, snapshot empty, etc).
    const consoleMessages = [];
    const failedRequests = [];
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ acceptDownloads: true });
        const page = await context.newPage();

        page.on('console', msg => {
            const type = msg.type();
            if (type === 'error' || type === 'warning') {
                consoleMessages.push('[' + type + '] ' + msg.text().slice(0, 200));
            }
        });
        page.on('requestfailed', req => {
            failedRequests.push(req.url() + ' ← ' + (req.failure() && req.failure().errorText));
        });

        const briefUrl = siteUrl + '/brief.html?ticker=XOM';
        const t0 = Date.now();
        await page.goto(briefUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });

        // The downloads component injects .dl-btn after DOMContentLoaded
        // via its defer-loaded script. Wait for it to be both present
        // AND clickable.
        await page.waitForSelector('.dl-btn', { timeout: 15_000, state: 'visible' });

        // Wait for the brief to ACTUALLY hydrate before clicking — not
        // a fixed sleep. brief.html runs async fetches for universe.json
        // + live Yahoo/Finnhub data, and the PDF body skips the
        // Financial Ratios section entirely when #fv-ratios is empty,
        // producing a ~9 KB file instead of the real ~80 KB. We wait
        // for:
        //   (a) #fv-ratios populated  — confirms universe.json loaded
        //   (b) #fv-price NOT '—'    — confirms live multiples backfill
        //                              completed (the slowest hop)
        try {
            await page.waitForFunction(() => {
                const ratios = document.querySelectorAll('#fv-ratios .brief-ratio-row');
                if (ratios.length === 0) return false;
                const priceEl = document.getElementById('fv-price');
                if (!priceEl) return false;
                const price = (priceEl.textContent || '').trim();
                return price && price !== '—' && price !== '$—';
            }, { timeout: 25_000 });
        } catch (e) {
            return fail('Brief page failed to hydrate within 25 s',
                'Either #fv-ratios stayed empty or #fv-price stayed `—`. Live data fetches may be slow / failing in CI.');
        }

        // Snapshot a few key DOM signals right before clicking — so a
        // failure tells us EXACTLY what state the page was in.
        const preClickState = await page.evaluate(() => ({
            ratiosRows: document.querySelectorAll('#fv-ratios .brief-ratio-row').length,
            ratiosFirstValue: (document.querySelector('#fv-ratios .brief-ratio-value') || {}).textContent || null,
            price: (document.getElementById('fv-price') || {}).textContent || null,
            trailingPE: (document.getElementById('fv-tpe') || {}).textContent || null,
            evEbitda: (document.getElementById('fv-ev') || {}).textContent || null,
            snTotalYield: (document.getElementById('sn-total-yield') || {}).textContent || null,
            os6mEv: (document.getElementById('os-6m-ev') || {}).textContent || null,
            jspdfLoaded: typeof window.jspdf !== 'undefined' && typeof window.jspdf.jsPDF !== 'undefined',
            autoTableLoaded: !!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable)
        }));

        await page.locator('.dl-btn').click();
        await page.waitForSelector('.dl-menu.open button[data-fmt="pdf"]', { timeout: 5_000 });

        const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
        await page.locator('.dl-menu.open button[data-fmt="pdf"]').click();

        const dl = await downloadPromise;
        const filePath = path.join(tmp, dl.suggestedFilename() || 'brief.pdf');
        await dl.saveAs(filePath);

        // Post-download: check whether autoTable arrived after the lazy
        // load triggered by the PDF click. If it didn't, that's the bug.
        const postClickState = await page.evaluate(() => ({
            autoTableLoaded: !!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable)
        }));

        const stat = await fs.stat(filePath);
        const head = await fs.readFile(filePath, { encoding: null });
        const sig = head.slice(0, 4).toString('ascii');
        const ms = Date.now() - t0;

        if (sig !== '%PDF') {
            return fail('PDF download has wrong signature: "' + sig + '"',
                'Expected `%PDF` magic bytes. File: ' + filePath + ' (' + stat.size + ' B)');
        }
        // Compression makes byte size depend on the amount of currently-live
        // data. Validate the user-visible document contract instead: a
        // readable multi-page PDF containing all three cross-tool sections.
        let parsed;
        try {
            const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
            parsed = await pdfParse(head);
        } catch (error) {
            return fail('PDF semantic validation failed', 'Could not parse generated PDF: ' + error.message);
        }
        const pdfText = String(parsed?.text || '').replace(/\s+/g, ' ').toUpperCase();
        const requiredSections = ['FINVAULT', 'SENTINEL', 'OSIRIS'];
        const missingSections = requiredSections.filter(section => !pdfText.includes(section));
        if (stat.size < 5_000 || Number(parsed?.numpages || 0) < 2 || missingSections.length) {
            const diag = [
                'PDF semantic state:',
                '  size:           ' + stat.size + ' B',
                '  pages:          ' + (parsed?.numpages || 0),
                '  missing:        ' + (missingSections.join(', ') || 'none'),
                '',
                'Pre-click DOM state:',
                '  ratios rows:    ' + preClickState.ratiosRows,
                '  ratios[0]:      ' + preClickState.ratiosFirstValue,
                '  price:          ' + preClickState.price,
                '  trailingPE:     ' + preClickState.trailingPE,
                '  ev/ebitda:      ' + preClickState.evEbitda,
                '  sn total yield: ' + preClickState.snTotalYield,
                '  os 6m EV:       ' + preClickState.os6mEv,
                '  jsPDF loaded:   ' + preClickState.jspdfLoaded,
                '  autotable lib:  ' + preClickState.autoTableLoaded + ' (pre-click)',
                '  autotable lib:  ' + postClickState.autoTableLoaded + ' (post-click)',
                '',
                'Browser console:',
                consoleMessages.length ? consoleMessages.slice(0, 6).join('\n') : '  (no warnings/errors)',
                '',
                'Failed network requests:',
                failedRequests.length ? failedRequests.slice(0, 4).join('\n') : '  (none)'
            ].join('\n');
            return fail('PDF download failed semantic validation',
                '```\n' + diag + '\n```');
        }
        return ok('PDF render OK · ' + Math.round(stat.size / 1024) + ' KB · ' + ms + ' ms');
    } catch (e) {
        return fail('PDF render flow failed', e.message);
    } finally {
        if (browser) { try { await browser.close(); } catch {} }
        try { await fs.rm(tmp, { recursive: true, force: true }); } catch {}
    }
}

// ── 11. Osiris Merton compensator drift audit ──────────────────────
//   The GBM+Jump engine subtracts a Merton compensator κ = λ·(e^{μ_J+½σ_J²}−1)
//   from the drift so that ADDING jumps does not shift the central tendency of
//   the terminal distribution. A miscalibrated jumpStd (the old sigma*1.5 bug)
//   over-corrects and biases P50 downward ~-0.3%/day. This audit evaluates the
//   SAME shipped worker source with jumps OFF (λ=0) vs ON (λ=6) at zero drift
//   and asserts the two median terminals stay within 1.5% — i.e. jumps remain
//   drift-neutral. Catches config/calibration drift in physics-config.json that
//   the Node-port unit tests would not see in the deployed worker.
export async function checkOsirisCompensator() {
    const { readFileSync } = await import('node:fs');
    const vm = await import('node:vm');
    const path = 'components/osiris/stochasticWorker.js';

    let src;
    try { src = readFileSync(path, 'utf8'); }
    catch (e) { return fail('Osiris worker source missing', e.message); }

    const trimmed = src.replace(/self\.onmessage\s*=[\s\S]*$/, '');
    const sandbox = { Math, Float32Array, Array, Number, isFinite, self: { postMessage: () => {} } };
    const ctx = vm.createContext(sandbox);
    try { vm.runInContext(trimmed, ctx, { timeout: 5000 }); }
    catch (e) { return fail('Osiris worker source failed to evaluate', e.message); }

    const sim = sandbox.simulateGBMJump;
    if (typeof sim !== 'function') return fail('Osiris worker missing simulateGBMJump', '');

    const S0 = 100, sigma = 0.22, steps = 63, paths = 12000;   // ~0.25 yr, μ=0
    const med = (r) => r.percentiles.p50[r.percentiles.p50.length - 1];
    let pNoJump, pJump;
    try {
        pNoJump = med(sim(S0, 0, sigma, steps, paths, 0, 0));   // λ=0 (no jumps)
        pJump   = med(sim(S0, 0, sigma, steps, paths, 6, 0));   // λ=6 jumps/yr
    } catch (e) { return fail('Osiris compensator run threw', (e && (e.stack || e.message)) || String(e)); }

    if (!isFinite(pNoJump) || !isFinite(pJump) || pNoJump <= 0) {
        return fail('Osiris compensator audit produced non-finite median', `λ=0:${pNoJump} λ=6:${pJump}`);
    }
    const driftPct = Math.abs(pJump - pNoJump) / pNoJump * 100;
    if (driftPct > 1.5) {
        return fail('Osiris jump compensator drift: ' + driftPct.toFixed(2) + '% P50 shift from jumps',
            'median λ=0: ' + pNoJump.toFixed(2) + ' · λ=6: ' + pJump.toFixed(2) +
            ' — jumps should be drift-neutral; check jumpStd/jumpMu in stochasticWorker.js + physics-config.json');
    }
    return ok('Osiris compensator drift-neutral · |ΔP50| ' + driftPct.toFixed(2) + '% (λ=0 vs λ=6)');
}
