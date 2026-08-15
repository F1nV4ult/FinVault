/**
 * Finnhub Proxy - Vercel Serverless Function
 * Wraps https://finnhub.io/api/v1/{endpoint} with edge caching and an
 * endpoint whitelist (prevents accidental abuse of paid-tier endpoints
 * by anyone hitting our proxy).
 *
 * Usage:
 *   GET /api/finnhub-proxy?endpoint=company-news&symbol=XOM&from=2026-04-01&to=2026-05-01
 *   GET /api/finnhub-proxy?endpoint=stock/recommendation&symbol=XOM
 *   GET /api/finnhub-proxy?endpoint=stock/price-target&symbol=XOM
 *   GET /api/finnhub-proxy?endpoint=company-profile2&symbol=XOM
 *
 * Env var:  FINNHUB_API_KEY  (falls back to FINNHUB if that's the name used)
 */

// Whitelist of free-tier endpoints. Extend cautiously — Finnhub's premium
// endpoints will 403 anyway but we'd prefer to fail fast at the proxy.
const ALLOWED_ENDPOINTS = new Set([
    'company-news',
    'company-profile2',
    'stock/recommendation',
    'stock/price-target',
    'stock/earnings',
    'stock/insider-transactions',
    'stock/financials-reported',
    'stock/metric',                 // flat fundamentals (revenue, margins, etc.)
    'stock/dividend'                // historical dividend payments
]);

// Cache TTL (seconds) per endpoint. News refreshes faster than profile data.
const CACHE_TTL = {
    'company-news':                1800,   // 30 min — relatively fresh
    'company-profile2':           86400,   // 24h   — rarely changes
    'stock/recommendation':       21600,   // 6h    — analyst recs trickle in
    'stock/price-target':         21600,   // 6h
    'stock/earnings':             21600,   // 6h
    'stock/insider-transactions':  3600,   // 1h    — Form 4 filings
    'stock/financials-reported':  86400,   // 24h   — quarterly reports
    'stock/metric':               21600,   // 6h    — TTM metrics, slow movers
    'stock/dividend':             86400    // 24h   — dividends change quarterly at most
};

// Distributed rate limiter (Upstash when configured, else in-memory).
import { isRateLimited, getClientIp } from './_ratelimit.js';

// Tickers, ETFs, and indices (e.g. ^GSPC, BRK.B, RELIANCE.NS).
const SYMBOL_RE = /^[A-Za-z0-9.\-\^]{1,20}$/;
// YYYY-MM-DD dates for from/to params.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_TRANSIENT_ATTEMPTS = 2;

function isTransientStatus(status) {
    return status === 408 || status === 425 || status === 502 || status === 503 || status === 504;
}

async function fetchFinnhub(url) {
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_TRANSIENT_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!isTransientStatus(response.status) || attempt === MAX_TRANSIENT_ATTEMPTS) {
                return { response, attempts: attempt };
            }
            lastError = new Error('upstream HTTP ' + response.status);
        } catch (error) {
            lastError = error;
            if (attempt === MAX_TRANSIENT_ATTEMPTS) throw error;
        } finally {
            clearTimeout(timer);
        }
        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
    }
    throw lastError || new Error('upstream request failed');
}

// Look up the Finnhub key from any of several common naming conventions.
// Vercel env vars are case-sensitive on Linux, so we cover both casings
// and a final substring scan as a safety net.
function resolveFinnhubKey() {
    const candidates = ['FINNHUB_API_KEY', 'FINNHUB', 'finnhub', 'finnhub_api_key', 'Finnhub'];
    for (const name of candidates) {
        if (process.env[name]) return process.env[name];
    }
    for (const name of Object.keys(process.env)) {
        if (name.toLowerCase().includes('finnhub') && process.env[name]) {
            return process.env[name];
        }
    }
    return null;
}

export default async function handler(req, res) {
    const { endpoint, ...params } = req.query;
    const apiKey = resolveFinnhubKey();

    if (!endpoint) {
        return res.status(400).json({ error: 'E400: Missing endpoint' });
    }
    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
        return res.status(400).json({ error: 'E400: ENDPOINT_NOT_ALLOWED' });
    }

    // Validate forwarded query params before proxying.
    if (params.symbol !== undefined && !SYMBOL_RE.test(params.symbol)) {
        return res.status(400).json({ error: 'E400: INVALID_SYMBOL_FORMAT' });
    }
    if (params.from !== undefined && !DATE_RE.test(params.from)) {
        return res.status(400).json({ error: 'E400: INVALID_DATE_FORMAT (from)' });
    }
    if (params.to !== undefined && !DATE_RE.test(params.to)) {
        return res.status(400).json({ error: 'E400: INVALID_DATE_FORMAT (to)' });
    }
    // Reject any param value that exceeds a safe length.
    for (const [k, v] of Object.entries(params)) {
        if (typeof v === 'string' && v.length > 50) {
            return res.status(400).json({ error: `E400: PARAM_TOO_LONG (${k})` });
        }
    }

    const ip = getClientIp(req);
    if (await isRateLimited(ip, 'finnhub', 30, 60)) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ error: 'E429: RATE_LIMIT_EXCEEDED' });
    }

    if (!apiKey) {
        console.warn('FINNHUB_API_KEY missing from environment');
        return res.status(500).json({ error: 'E500: ENVAR_MISSING (Check Dashboard)' });
    }

    const upstream = new URL(`https://finnhub.io/api/v1/${endpoint}`);
    upstream.searchParams.set('token', apiKey);
    for (const [k, v] of Object.entries(params)) {
        if (typeof v === 'string' && v.length > 0) {
            upstream.searchParams.set(k, v);
        }
    }

    try {
        const { response, attempts } = await fetchFinnhub(upstream.toString());

        if (response.status === 401 || response.status === 403) {
            return res.status(401).json({ error: 'E401: API_KEY_INVALID_OR_RESTRICTED' });
        }
        if (response.status === 429) {
            return res.status(429).json({ error: 'E429: RATE_LIMIT' });
        }
        if (!response.ok) {
            return res.status(response.status).json({ error: `E${response.status}: FINNHUB_REJECTED` });
        }

        const data = await response.json();
        const ttl = CACHE_TTL[endpoint] || 3600;

        res.setHeader('Cache-Control', `s-maxage=${ttl}, stale-while-revalidate=${ttl}`);
        res.setHeader('X-NovaSect-Source', 'finnhub-live');
        res.setHeader('X-NovaSect-Upstream-Attempts', String(attempts));
        return res.status(200).json(data);
    } catch (error) {
        console.error('Finnhub Proxy Error:', error);
        const timedOut = error?.name === 'AbortError';
        return res.status(502).json({
            error: timedOut ? 'E502: UPSTREAM_TIMEOUT' : 'E502: NETWORK_HANDSHAKE_FAILED',
            retryable: true
        });
    }
}
