/** Health-check contract for Finnhub outage and authorization classification. */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { checkFinnhubAuthz } from './health/checks.mjs';

let passed = 0;
function ok(condition, message) {
    if (condition) { passed++; return; }
    console.error('  ✕ ' + message);
    process.exitCode = 1;
}

const proxySource = readFileSync(new URL('../api/finnhub-proxy.js', import.meta.url), 'utf8');
ok(proxySource.includes('const UPSTREAM_TIMEOUT_MS = 6_000'), 'Finnhub upstream timeout keeps the retry budget bounded');
ok(proxySource.includes('const TRANSIENT_RETRY_DELAY_MS = 350'), 'Finnhub retry delay is explicit and bounded');

const server = createServer((req, res) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'E502: UPSTREAM_TIMEOUT', retryable: true }));
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
    const { port } = server.address();
    const result = await checkFinnhubAuthz('http://127.0.0.1:' + port);
    ok(result.severity === 'pass', 'upstream outage defers authz classification to the availability canary');
    ok(/deferred/i.test(result.title), 'deferred authz result explains why it is not an auth regression');
} finally {
    await new Promise(resolve => server.close(resolve));
}

if (!process.exitCode) console.log('✓ Finnhub health contracts — ' + passed + ' passed');
