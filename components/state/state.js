/**
 * NovaSect shared client state — window.NSState.
 *
 * A tiny, dependency-free store for cross-page state that needs no accounts:
 *   • watchlist  (localStorage: ns.watchlist)
 *   • recents    (localStorage: ns.recents)
 *   • seen       (localStorage: ns.seen — per-ticker snapshot for change dots)
 *   • scenario   (in-memory; hydrated from ?scenario=<base64> on load)
 *
 * Mirrors the pure logic in scripts/lib/ns-state-core.mjs (which is unit-tested);
 * kept inline here because this is a classic <script>, not an ES module. Loaded
 * site-wide (or self-injected by global-search) so any page/component can read it.
 */
(() => {
    if (window.NSState) return;

    const LS = (() => { try { return window.localStorage; } catch { return null; } })();
    const read = (k, d) => { try { const v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch { return d; } };
    const write = (k, v) => { try { LS.setItem(k, JSON.stringify(v)); } catch { /* private mode / quota */ } };

    const K = { wl: 'ns.watchlist', rc: 'ns.recents', seen: 'ns.seen', sc: 'ns.scenario' };
    const RECENT_MAX = 6;

    const listeners = {};
    const emit = (evt, payload) => (listeners[evt] || []).forEach(fn => { try { fn(payload); } catch { /* listener fault is non-fatal */ } });

    // Hydrate scenario from the URL (so a shared "?scenario=" link opens shocked).
    let scenario = null;
    try {
        const p = new URLSearchParams(location.search).get('scenario');
        if (p) { const s = JSON.parse(atob(p)); if (s && Object.values(s).some(v => v)) scenario = s; }
        else { const s = read(K.sc, null); if (s && typeof s === 'object' && Object.values(s).some(v => v)) scenario = s; }
    } catch { /* malformed scenario param → baseline */ }

    const NSState = {
        // ── watchlist ──────────────────────────────────────────────────────
        getWatchlist: () => read(K.wl, []),
        isWatched: (t) => read(K.wl, []).includes(t),
        toggleWatchlist(t) {
            const arr = read(K.wl, []);
            const i = arr.indexOf(t);
            if (i >= 0) arr.splice(i, 1); else arr.push(t);
            write(K.wl, arr);
            emit('watchlist', arr.slice());
            return arr.includes(t);
        },

        // ── recents ────────────────────────────────────────────────────────
        pushRecent(t) {
            const arr = read(K.rc, []).filter(x => x !== t);
            arr.unshift(t);
            write(K.rc, arr.slice(0, RECENT_MAX));
        },
        getRecents: (n = RECENT_MAX) => read(K.rc, []).slice(0, n),

        // ── scenario ───────────────────────────────────────────────────────
        getScenario: () => scenario,
        setScenario(s) {
            scenario = (s && typeof s === 'object' && Object.values(s).some(v => v)) ? s : null;
            if (scenario) write(K.sc, scenario); else { try { LS.removeItem(K.sc); } catch {} }
            emit('scenario', scenario);
        },
        encodeScenario(s) { try { return btoa(JSON.stringify(s)); } catch { return ''; } },
        decodeScenario(b) { try { const v = JSON.parse(atob(b)); return (v && typeof v === 'object') ? v : null; } catch { return null; } },

        // ── change-detection snapshots ─────────────────────────────────────
        getSeen: (t) => (read(K.seen, {})[t] || null),
        setSeen(t, snap) { const m = read(K.seen, {}); m[t] = snap; write(K.seen, m); },

        // ── pub/sub ────────────────────────────────────────────────────────
        on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
        off(evt, fn) { listeners[evt] = (listeners[evt] || []).filter(f => f !== fn); },
    };

    window.NSState = NSState;
})();
