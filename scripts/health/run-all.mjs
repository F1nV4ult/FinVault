#!/usr/bin/env node
/**
 * Layer-1 health check orchestrator. Runs all canaries serially and
 * routes results through the Discord notifier (with dedup + recovery
 * posts). Failed checks are reported to Discord ONLY — the script exits 0
 * so the GitHub Actions run stays green and GitHub sends no workflow-failure
 * email. Discord is the single source of truth for health state; only a
 * genuine script/infra crash (which throws) fails the job.
 *
 * Invocation:
 *   DISCORD_WEBHOOK_URL=... SITE_URL=https://novasect.space node scripts/health/run-all.mjs
 *
 * Without DISCORD_WEBHOOK_URL the script runs in dry-run mode — it
 * still hits all endpoints and logs to stdout, but skips the Discord
 * POST. Useful for local testing.
 */
import { postDigest } from './notify.mjs';
import {
    checkYahoo, checkFinnhub, checkUniverse, checkPublicAssets,
    checkFred, checkStaleAnchors, checkSentinelGovernanceArtifacts, checkUniverseDrift, checkFinnhubAuthz,
    checkOsirisEngine, checkOsirisCompensator, checkPdfRender
} from './checks.mjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SITE_URL = (process.env.SITE_URL || 'https://novasect.space').replace(/\/$/, '');
const SMOKE_TEST = process.env.SMOKE_TEST === 'true';

// ── Smoke-test path ──────────────────────────────────────────────────
// Triggered from the Actions UI via the workflow_dispatch input. Posts
// a single explicit test embed and exits — does NOT touch dedup state,
// does NOT run real checks. Used to verify the webhook is alive after
// a channel/secret change without having to break a real check.
if (SMOKE_TEST) {
    const webhook = process.env.DISCORD_WEBHOOK_URL;
    console.log('[health] smoke-test mode · ' + new Date().toISOString());
    if (!webhook) {
        console.error('[health] DISCORD_WEBHOOK_URL not set — cannot smoke-test');
        process.exit(1);
    }
    try {
        const res = await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'NovaSect Health',
                embeds: [{
                    title: 'Smoke test',
                    description: 'Webhook is wired up. This is a one-off test post triggered from GitHub Actions — no real check failed.',
                    color: 0x5DADE2,
                    fields: [
                        { name: 'Check',    value: '`smoke-test`',     inline: true },
                        { name: 'Severity', value: 'INFO',             inline: true },
                        { name: 'Source',   value: 'workflow_dispatch', inline: true }
                    ],
                    footer: { text: 'novasect-health · ' + new Date().toISOString() }
                }]
            })
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            console.error('[health] smoke-test POST failed:', res.status, text.slice(0, 200));
            process.exit(1);
        }
        console.log('[health] smoke-test posted · HTTP ' + res.status);
        process.exit(0);
    } catch (e) {
        console.error('[health] smoke-test threw:', e.message);
        process.exit(1);
    }
}

// Each check is tagged by cadence group:
//   'liveness'  — availability / engine / render checks; time-sensitive, run a
//                 few times a day so an outage is caught quickly.
//   'freshness' — data staleness / drift; these only change after the daily EOD
//                 refresh, so they run once a day (just after it).
// Order from cheapest → heaviest (engine, PDF render last).
const ALL_CHECKS = [
    { name: 'yahoo-canary',      group: 'liveness',  fn: () => checkYahoo(SITE_URL) },
    { name: 'finnhub-canary',    group: 'liveness',  fn: () => checkFinnhub(SITE_URL) },
    { name: 'fred-canary',       group: 'liveness',  fn: () => checkFred(SITE_URL) },
    { name: 'universe-coverage', group: 'liveness',  fn: () => checkUniverse(SITE_URL) },
    { name: 'public-assets',     group: 'liveness',  fn: () => checkPublicAssets(SITE_URL) },
    { name: 'finnhub-authz',     group: 'liveness',  fn: () => checkFinnhubAuthz(SITE_URL) },
    { name: 'sentinel-governance', group: 'freshness', fn: () => checkSentinelGovernanceArtifacts(SITE_URL) },
    { name: 'stale-anchors',     group: 'freshness', fn: () => checkStaleAnchors() },
    { name: 'universe-drift',    group: 'freshness', fn: () => checkUniverseDrift() },
    { name: 'osiris-engine',     group: 'liveness',  fn: () => checkOsirisEngine() },
    { name: 'osiris-compensator',group: 'liveness',  fn: () => checkOsirisCompensator() },
    { name: 'pdf-render',        group: 'liveness',  fn: () => checkPdfRender(SITE_URL) }
];

// HEALTH_SET picks the cadence group to run: 'all' (default) | 'liveness' | 'freshness'.
const HEALTH_SET = (process.env.HEALTH_SET || 'all').toLowerCase();
const CHECKS = HEALTH_SET === 'all' ? ALL_CHECKS : ALL_CHECKS.filter(c => c.group === HEALTH_SET);

console.log('[health] starting · site=' + SITE_URL + ' · ' + new Date().toISOString());

const results = [];
for (const { name, fn } of CHECKS) {
    let result;
    try {
        result = await fn();
    } catch (e) {
        result = { severity: 'HIGH', title: 'Check threw uncaught error', evidence: e.stack || e.message };
    }
    console.log('  [' + name + '] ' + result.severity + ' · ' + result.title);
    results.push({ check: name, ...result });
}

// ── Post policy: heartbeat (always) vs alert-on-change ──────────────────────
// ALWAYS_POST=true  → post the digest every run (the once-a-day heartbeat).
// ALWAYS_POST=false → post ONLY when an executed check FLIPPED state since the
//                     previous run (a new failure or a recovery); silent if the
//                     state is unchanged. This kills the "10 green messages a
//                     day" noise while still surfacing genuine changes promptly.
// State is a small JSON map (check → 'pass'|'fail') persisted in the cached
// .health dir, so it survives between scheduled runs.
const ALWAYS_POST = (process.env.ALWAYS_POST || 'true').toLowerCase() === 'true';
const STATE_DIR   = process.env.HEALTH_STATE_DIR || '.health';
const STATE_FILE  = join(STATE_DIR, 'alert-state.json');

let prevState = {};
try { if (existsSync(STATE_FILE)) prevState = JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch {}

const statusOf = r => (r.severity === 'pass' ? 'pass' : 'fail');
const newly = [], recovered = [];
for (const r of results) {
    const now = statusOf(r), was = prevState[r.check];
    if (now === 'fail' && was !== 'fail') newly.push(r.check);
    if (now === 'pass' && was === 'fail') recovered.push(r.check);
}
const changed   = newly.length > 0 || recovered.length > 0;
const anyFailed = results.some(r => r.severity !== 'pass');

if (ALWAYS_POST) {
    await postDigest(results, SITE_URL, { setLabel: HEALTH_SET, reason: 'heartbeat' });
} else if (changed) {
    await postDigest(results, SITE_URL, { setLabel: HEALTH_SET, reason: 'change', newly, recovered });
} else {
    console.log('[health] no state change in "' + HEALTH_SET + '" set — staying silent');
}

// Persist the new state for the checks we actually ran.
try {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    for (const r of results) prevState[r.check] = statusOf(r);
    writeFileSync(STATE_FILE, JSON.stringify(prevState, null, 2));
} catch (e) { console.warn('[health] could not persist alert state:', e.message); }

console.log('[health] done · set=' + HEALTH_SET + ' · status=' + (anyFailed ? 'fail' : 'ok')
    + ' · changed=' + changed + ' · posted=' + (ALWAYS_POST || changed));
// Exit 0 even when checks fail: failures are surfaced in Discord; keeping the
// Actions run green stops GitHub emailing a workflow-failure notice every run.
// A real crash (uncaught error / failed POST) still propagates and fails the job.
process.exit(0);
