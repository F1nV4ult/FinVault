#!/usr/bin/env node
/**
 * Local production-parity preview for NovaSect.
 *
 * Static assets are served from the current working tree. Read-only API
 * requests are forwarded to the deployed Vercel functions, so the preview
 * exercises the same Yahoo/Finnhub/FRED integrations without requiring local
 * secrets or a Vercel development environment.
 *
 * Usage: npm run preview
 * Optional: PORT=4173 NOVASECT_API_ORIGIN=https://novasect.space npm run preview
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize, resolve, sep } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const apiOrigin = (process.env.NOVASECT_API_ORIGIN || 'https://novasect.space').replace(/\/$/, '');
const mime = {
    '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.pdf': 'application/pdf',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp'
};

function isInsideRoot(file) {
    return file === root || file.startsWith(root + sep);
}

async function proxyApi(request, response) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' });
        response.end('Local preview API proxy is read-only');
        return;
    }
    try {
        const upstream = await fetch(new URL(request.url, apiOrigin), {
            method: request.method,
            headers: { Accept: request.headers.accept || 'application/json' }
        });
        const headers = {};
        for (const name of ['cache-control', 'content-type']) {
            const value = upstream.headers.get(name);
            if (value) headers[name] = value;
        }
        response.writeHead(upstream.status, headers);
        if (request.method === 'HEAD') return response.end();
        response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
        response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: 'E502: PREVIEW_API_PROXY_FAILED' }));
        console.warn('[preview] API proxy failed:', error.message);
    }
}

const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return proxyApi(request, response);

    const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const target = resolve(root, '.' + normalize(pathname));
    if (!isInsideRoot(target)) {
        response.writeHead(403); response.end('Forbidden'); return;
    }
    try {
        const body = await readFile(target);
        response.writeHead(200, { 'content-type': mime[extname(target).toLowerCase()] || 'application/octet-stream' });
        response.end(body);
    } catch {
        response.writeHead(404); response.end('Not found');
    }
});

server.listen(port, '127.0.0.1', () => {
    console.log(`NovaSect preview: http://127.0.0.1:${port}`);
    console.log(`Read-only API proxy: ${apiOrigin}/api/*`);
});
