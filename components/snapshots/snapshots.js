/** NovaSect shared static-artifact snapshot registry — window.NSSnapshots. */
(() => {
    if (window.NSSnapshots) return;
    const MANIFEST = {
        universe: { url: '/data/universe.json', ttlMs: 6 * 60 * 60 * 1000 },
        screener: { url: '/data/screener.json', ttlMs: 6 * 60 * 60 * 1000 },
        sentinelGovernance: { url: '/data/sentinel-governance.json', ttlMs: 6 * 60 * 60 * 1000 },
        osirisQuality: { url: '/data/osiris-quality.json', ttlMs: 6 * 60 * 60 * 1000 },
        osirisModels: { url: '/data/osiris-models.json', ttlMs: 6 * 60 * 60 * 1000 },
        osirisGovernance: { url: '/data/osiris-governance.json', ttlMs: 6 * 60 * 60 * 1000 },
        physicsConfig: { url: '/physics-config.json', ttlMs: 6 * 60 * 60 * 1000 },
    };
    const memory = new Map(), inflight = new Map();
    const cacheKey = name => 'ns.snapshot.' + name;
    const read = name => { try { const v = JSON.parse(sessionStorage.getItem(cacheKey(name)) || 'null'); return v && v.data ? v : null; } catch (_) { return null; } };
    const write = (name, value) => { try { sessionStorage.setItem(cacheKey(name), JSON.stringify(value)); } catch (_) {} };
    function source(name) { if (!MANIFEST[name]) throw new Error('Unknown NovaSect snapshot: ' + name); return MANIFEST[name]; }
    async function get(name, { force = false } = {}) {
        const item = source(name), cached = memory.get(name) || read(name);
        if (!force && cached && Date.now() - cached.fetchedAt < item.ttlMs) { memory.set(name, cached); return cached.data; }
        if (!force && inflight.has(name)) return inflight.get(name);
        const request = (async () => {
            try {
                const response = await fetch(item.url, { headers: { accept: 'application/json' } });
                if (!response.ok) throw new Error(response.status + ' ' + item.url);
                const record = { fetchedAt: Date.now(), data: await response.json() };
                memory.set(name, record); write(name, record); return record.data;
            } catch (error) { if (cached && cached.data) return cached.data; throw error; }
            finally { inflight.delete(name); }
        })();
        inflight.set(name, request); return request;
    }
    const preload = names => Promise.all((names || []).map(name => get(name).catch(() => null)));
    const getStatus = name => { const item = source(name), record = memory.get(name) || read(name); if (!record) return { state: 'missing', ageMs: null }; const ageMs = Date.now() - record.fetchedAt; return { state: ageMs < item.ttlMs ? 'fresh' : 'stale', ageMs, fetchedAt: record.fetchedAt }; };
    window.NSSnapshots = { get, preload, getStatus, manifest: MANIFEST };
})();
