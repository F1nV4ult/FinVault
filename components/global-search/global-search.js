/**
 * NovaSect Global Search — the command / aggregation bar.
 *
 * Loads on every NovaSect page via a single <script> tag. On DOMContentLoaded it
 * injects itself into the .nav-links cluster (left of the "Tools" dropdown) and
 * is the primary way users reach the Company Dossier (brief.html) and everything
 * that hangs off it.
 *
 * Beyond fuzzy ticker/company search it now provides:
 *   • Command-palette focus:  press  /  or  Cmd/Ctrl-K  from anywhere.
 *   • Launcher (empty query):  ★ Watchlist + Recents as zero-typing targets.
 *   • Aggregation chips:       per-row credit rating/tier + spread, drawn from
 *                              the static universe.json (zero network).
 *   • Inline ★:                add/remove watchlist without navigating.
 *   • Band deep-links:         FV / SEN / OSI jump to brief.html?ticker=X#band.
 *   • Scenario-aware routing:  carries an active scenario into the dossier.
 *   • Light live backfill:     ONLY the focused row, debounced + cached, via the
 *                              24h-edge-cached sec-proxy (Altman band). Bandwidth
 *                              policy: never per-keystroke, never per-row — the
 *                              proxy limits (sec 20/min) make that infeasible.
 *
 * Match priority: exact ticker > ticker prefix > name-word prefix > substring.
 * Depends on window.NSState (self-injected if absent). No other dependencies.
 */
(() => {
    if (window.__novasectGlobalSearchInit) return;
    window.__novasectGlobalSearchInit = true;

    const STYLE = `
.gs-wrap { position: relative; margin-right: 1rem; }
.gs-input-wrap {
    display: flex; align-items: center; gap: 0.4rem;
    background: rgba(0, 18, 0, 0.55);
    border: 1px solid rgba(57, 255, 20, 0.3);
    border-radius: 3px; padding: 0 10px; height: 32px; width: 240px;
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.gs-input-wrap:focus-within { border-color: rgba(57, 255, 20, 0.7); box-shadow: 0 0 8px rgba(57, 255, 20, 0.25); }
.gs-icon { color: rgba(57, 255, 20, 0.55); font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }
.gs-input {
    flex: 1; min-width: 0; background: transparent; border: none; outline: none;
    color: rgba(255, 255, 255, 0.92); font-family: 'JetBrains Mono', monospace;
    font-size: 0.78rem; letter-spacing: 0.5px;
}
.gs-input::placeholder { color: rgba(255, 255, 255, 0.35); letter-spacing: 1px; }
.gs-kbd {
    font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; color: rgba(57,255,20,0.5);
    border: 1px solid rgba(57,255,20,0.25); border-radius: 3px; padding: 1px 4px; white-space: nowrap;
}
.gs-panel {
    position: absolute; top: calc(100% + 6px); right: 0; width: 400px; max-height: 420px;
    overflow-y: auto; background: rgba(0, 12, 0, 0.97);
    border: 1px solid rgba(57, 255, 20, 0.35); border-radius: 3px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55), 0 0 18px rgba(57, 255, 20, 0.12);
    z-index: 9999; padding: 4px 0;
}
.gs-sec-label {
    font-family: 'JetBrains Mono', monospace; font-size: 0.58rem; letter-spacing: 1.5px;
    text-transform: uppercase; color: rgba(57,255,20,0.5); padding: 8px 12px 4px;
}
.gs-item {
    display: grid; grid-template-columns: 64px 1fr auto auto; gap: 8px; align-items: center;
    padding: 7px 10px 7px 12px; cursor: pointer; border-left: 2px solid transparent;
}
.gs-item:hover, .gs-item.active { background: rgba(57, 255, 20, 0.1); border-left-color: rgba(57, 255, 20, 1); }
.gs-main { display: contents; text-decoration: none; }
.gs-ticker { color: rgba(57, 255, 20, 1); font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; font-weight: 700; }
.gs-name { color: rgba(255,255,255,0.85); font-family: 'Montserrat', sans-serif; font-size: 0.76rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-chips { display: flex; align-items: center; gap: 5px; }
.gs-chip {
    font-family: 'JetBrains Mono', monospace; font-size: 0.58rem; letter-spacing: 0.5px;
    padding: 1px 5px; border-radius: 3px; white-space: nowrap; border: 1px solid currentColor;
}
.gs-chip.green { color: #39FF14; } .gs-chip.amber { color: #FFB000; }
.gs-chip.red { color: #FF4D4D; }  .gs-chip.neutral { color: #9AA5B1; }
.gs-spread { font-family: 'JetBrains Mono', monospace; font-size: 0.58rem; color: rgba(255,255,255,0.5); }
.gs-deeplinks { display: flex; gap: 4px; }
.gs-dl {
    font-family: 'JetBrains Mono', monospace; font-size: 0.55rem; color: rgba(57,255,20,0.55);
    text-decoration: none; border: 1px solid rgba(57,255,20,0.2); border-radius: 3px; padding: 1px 4px;
}
.gs-dl:hover { color: #39FF14; border-color: rgba(57,255,20,0.6); background: rgba(57,255,20,0.08); }
.gs-star {
    background: none; border: none; cursor: pointer; font-size: 0.85rem; line-height: 1;
    color: rgba(255,255,255,0.3); padding: 0 2px;
}
.gs-star.is-on { color: #FFB000; }
.gs-star:hover { color: #FFB000; }
.gs-empty { padding: 16px; text-align: center; color: rgba(57, 255, 20, 0.4); font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; }
.gs-wl { cursor: pointer; }   /* inherits .nav-link font/colour to match About us / Tools */
@media (max-width: 768px) {
    .nav-links { gap: 0.85rem; }
    .gs-wrap { margin-right: 0; flex: 0 1 auto; max-width: 190px; }
    .gs-input-wrap { width: 190px; height: 34px; }
    .gs-kbd { display: none; }
    .gs-panel { width: 340px; right: 0; max-height: 380px; }
    .gs-item { grid-template-columns: 60px 1fr auto; }
    .gs-deeplinks { display: none; }
}
@media (max-width: 380px) {
    .gs-wrap { max-width: 150px; } .gs-input-wrap { width: 150px; } .gs-panel { width: 290px; }
}
`;

    function rankMatch(item, q) {
        const t = item.ticker.toLowerCase();
        const n = (item.name || '').toLowerCase();
        if (t === q) return 100;
        if (t.startsWith(q)) return 80;
        const words = n.split(/[\s\-,&]+/).filter(Boolean);
        if (words.some(w => w.startsWith(q))) return 60;
        if (t.includes(q)) return 40;
        if (n.includes(q)) return 20;
        return -1;
    }

    // Precompute status chip from universe.json (zero network). Mirrors
    // ns-state-core.tierFromSentinel (kept inline; this is a classic script).
    function tierChip(sn) {
        if (!sn) return { label: '—', cls: 'neutral', spread: null };
        const rating = sn.rating || '—';
        const ig = sn.type === 'IG';
        const cls = !ig ? 'red' : /^(AAA|AA|A)$/i.test(rating) ? 'green' : 'amber';
        return { label: rating, cls, spread: (sn.baseSpread != null ? sn.baseSpread + 'bp' : null) };
    }

    let universeCache = null, universeMap = null;
    async function loadUniverse() {
        if (universeCache) return universeCache;
        try {
            const data = window.NSSnapshots
                ? await window.NSSnapshots.get('universe')
                : await fetch('data/universe.json').then(res => res.ok ? res.json() : null);
            if (!data) return [];
            universeMap = data.tickers || {};
            universeCache = Object.values(universeMap).map(t => ({
                ticker: t.ticker, name: t.name, sector: t.sector,
                sentinel: t.sentinel || null,
            }));
            return universeCache;
        } catch { return []; }
    }
    const byTicker = (sym) => (universeMap && universeMap[sym]) || null;

    // Ensure the shared state store exists (self-inject so we don't have to edit
    // every page's <head> in this increment; future phases add it explicitly).
    function ensureState() {
        if (window.NSState || document.getElementById('ns-state-script')) return;
        const s = document.createElement('script');
        s.id = 'ns-state-script';
        s.src = 'components/state/state.js';
        document.head.appendChild(s);
    }

    // Scenario Lab (drawer + SCENARIO-MODE banner + ⚡ nav) is needed on every
    // page so the banner shows wherever an active scenario applies. Self-inject
    // it here rather than adding a tag to all ~8 pages.
    function ensureScenario() {
        if (window.__nsScenarioInit || document.getElementById('ns-scenario-script')) return;
        const s = document.createElement('script');
        s.id = 'ns-scenario-script';
        s.src = 'components/scenario/scenario.js';
        s.defer = true;
        document.head.appendChild(s);
    }

    function injectStyles() {
        if (document.getElementById('gs-styles')) return;
        const s = document.createElement('style');
        s.id = 'gs-styles'; s.textContent = STYLE;
        document.head.appendChild(s);
    }

    function buildElement() {
        const wrap = document.createElement('div');
        wrap.className = 'gs-wrap';
        wrap.innerHTML = `
            <div class="gs-input-wrap">
                <span class="gs-icon" aria-hidden="true">⌕</span>
                <input class="gs-input" type="text" placeholder="Search ticker or company..." autocomplete="off" spellcheck="false" aria-label="Search companies" />
                <span class="gs-kbd" aria-hidden="true">/</span>
            </div>
            <div class="gs-panel" hidden></div>
        `;
        return wrap;
    }

    // Carry an active scenario into the dossier so a shared/clicked link opens shocked.
    function scenarioSuffix() {
        const s = window.NSState && window.NSState.getScenario && window.NSState.getScenario();
        if (!s) return '';
        const enc = window.NSState.encodeScenario(s);
        return enc ? '&scenario=' + encodeURIComponent(enc) : '';
    }
    function briefHref(ticker, band) {
        return 'brief.html?ticker=' + encodeURIComponent(ticker) + scenarioSuffix() + (band ? '#brief-' + band : '');
    }

    function mount() {
        const nav = document.querySelector('.nav-links');
        if (!nav) return;
        injectStyles();
        ensureState();
        ensureScenario();
        const wrap = buildElement();
        nav.insertBefore(wrap, nav.firstChild);

        // Watchlist nav item (★ + live count), site-wide. Sits just right of the
        // search. Count updates on NSState 'watchlist' events; we wait for the
        // (self-injected) state store to exist before wiring.
        const wlLink = document.createElement('a');
        wlLink.className = 'nav-link gs-wl';
        wlLink.href = 'watchlist.html';
        wlLink.title = 'Watchlist';
        nav.insertBefore(wlLink, wrap.nextSibling);
        const updateWl = () => {
            const n = (window.NSState && window.NSState.getWatchlist().length) || 0;
            wlLink.textContent = 'Watchlist' + (n ? ' (' + n + ')' : '');
        };
        (function wireWl() {
            if (!window.NSState) { setTimeout(wireWl, 150); return; }
            updateWl();
            window.NSState.on('watchlist', updateWl);
        })();

        const input = wrap.querySelector('.gs-input');
        const panel = wrap.querySelector('.gs-panel');
        let activeIdx = 0;
        let currentResults = [];      // array of ticker symbols, for keyboard nav
        let backfillTimer = null;

        const watched = (t) => !!(window.NSState && window.NSState.isWatched(t));

        function rowHtml(item, idx) {
            const c = tierChip(item.sentinel);
            const star = watched(item.ticker) ? '★' : '☆';
            return (
                '<div class="gs-item' + (idx === activeIdx ? ' active' : '') + '" data-ticker="' + item.ticker + '" data-idx="' + idx + '">' +
                  '<a class="gs-main" href="' + briefHref(item.ticker) + '" data-nav="1" style="display:contents">' +
                    '<span class="gs-ticker">' + item.ticker + '</span>' +
                    '<span class="gs-name">' + (item.name || '') + '</span>' +
                  '</a>' +
                  '<span class="gs-chips">' +
                    '<span class="gs-chip ' + c.cls + '" data-chip="tier">' + c.label + '</span>' +
                    (c.spread ? '<span class="gs-spread">' + c.spread + '</span>' : '') +
                  '</span>' +
                  '<span class="gs-deeplinks">' +
                    '<a class="gs-dl" href="' + briefHref(item.ticker, 'finvault') + '">FV</a>' +
                    '<a class="gs-dl" href="' + briefHref(item.ticker, 'sentinel') + '">SEN</a>' +
                    '<a class="gs-dl" href="' + briefHref(item.ticker, 'osiris') + '">OSI</a>' +
                    '<button class="gs-star ' + (watched(item.ticker) ? 'is-on' : '') + '" data-star="' + item.ticker + '" title="Toggle watchlist" aria-label="Toggle watchlist">' + star + '</button>' +
                  '</span>' +
                '</div>'
            );
        }

        function renderLauncher() {
            const NS = window.NSState;
            const wl = (NS && NS.getWatchlist()) || [];
            const rc = (NS && NS.getRecents()) || [];
            let html = '';
            if (wl.length) {
                html += '<div class="gs-sec-label">★ Watchlist</div>';
                html += wl.map(byTicker).filter(Boolean).map((it, i) => rowHtml(it, -1)).join('');
            }
            if (rc.length) {
                html += '<div class="gs-sec-label">Recent</div>';
                html += rc.map(byTicker).filter(Boolean).map((it, i) => rowHtml(it, -1)).join('');
            }
            if (!html) html = '<div class="gs-empty">Type a ticker or company name</div>';
            currentResults = []; activeIdx = 0;
            panel.hidden = false; panel.innerHTML = html;
        }

        function render(q) {
            if (!q) { renderLauncher(); return; }
            const ranked = universeCache
                .map(i => ({ item: i, r: rankMatch(i, q) }))
                .filter(x => x.r >= 0)
                .sort((a, b) => b.r - a.r || a.item.ticker.localeCompare(b.item.ticker))
                .slice(0, 12)
                .map(x => x.item);
            currentResults = ranked.map(i => i.ticker);
            activeIdx = 0;
            panel.hidden = false;
            panel.innerHTML = ranked.length
                ? ranked.map((r, idx) => rowHtml(r, idx)).join('')
                : '<div class="gs-empty">No matches</div>';
            scheduleBackfill();
        }

        function updateActive() {
            Array.from(panel.querySelectorAll('.gs-item')).forEach((el) => {
                el.classList.toggle('active', Number(el.dataset.idx) === activeIdx);
            });
            const a = panel.querySelector('.gs-item.active');
            if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
            scheduleBackfill();
        }

        // Bandwidth-safe enrichment: ONLY the focused row, debounced, cached.
        // One sec-proxy call (24h edge cache) yields the Altman band chip.
        function scheduleBackfill() {
            if (backfillTimer) clearTimeout(backfillTimer);
            const sym = currentResults[activeIdx];
            if (!sym) return;
            backfillTimer = setTimeout(() => backfillRow(sym), 350);
        }
        async function backfillRow(sym) {
            const item = byTicker(sym);
            const sector = item && item.sector;
            const cacheKey = 'ns.bf.' + sym;
            let band = null;
            try {
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) band = JSON.parse(cached).altmanBand || null;
            } catch { /* ignore */ }
            if (!band) {
                try {
                    const r = await fetch('/api/sec-proxy?ticker=' + encodeURIComponent(sym) + (sector ? '&sector=' + encodeURIComponent(sector) : ''));
                    if (r.ok) {
                        const j = await r.json();
                        band = j && j.scores && j.scores.altman && j.scores.altman.band;
                        if (band) { try { sessionStorage.setItem(cacheKey, JSON.stringify({ altmanBand: band })); } catch {} }
                    }
                } catch { /* offline / static preview / rate-limited → degrade silently */ }
            }
            if (!band) return;
            const row = panel.querySelector('.gs-item[data-ticker="' + sym + '"] .gs-chips');
            if (row && !row.querySelector('[data-chip="altman"]')) {
                const cls = /safe/i.test(band) ? 'green' : /grey/i.test(band) ? 'amber' : 'red';
                const chip = document.createElement('span');
                chip.className = 'gs-chip ' + cls; chip.dataset.chip = 'altman';
                chip.textContent = 'Z·' + band;
                row.appendChild(chip);
            }
        }

        function go(sym, band) {
            if (window.NSState) window.NSState.pushRecent(sym);
            window.location.href = briefHref(sym, band);
        }

        // Click: route on main/deep-links; toggle star without navigating.
        panel.addEventListener('click', (e) => {
            const star = e.target.closest('.gs-star');
            if (star) {
                e.preventDefault();
                const sym = star.dataset.star;
                const on = window.NSState && window.NSState.toggleWatchlist(sym);
                star.classList.toggle('is-on', !!on);
                star.textContent = on ? '★' : '☆';
                return;
            }
            const dl = e.target.closest('.gs-dl');
            if (dl) { if (window.NSState) { const it = e.target.closest('.gs-item'); if (it) window.NSState.pushRecent(it.dataset.ticker); } return; }
            const main = e.target.closest('.gs-main');
            if (main) { e.preventDefault(); const it = e.target.closest('.gs-item'); if (it) go(it.dataset.ticker); }
        });

        input.addEventListener('focus', async () => { await loadUniverse(); render(input.value.trim().toLowerCase()); });
        input.addEventListener('input', async () => { await loadUniverse(); render(input.value.trim().toLowerCase()); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); if (activeIdx < currentResults.length - 1) { activeIdx++; updateActive(); } }
            else if (e.key === 'ArrowUp') { e.preventDefault(); if (activeIdx > 0) { activeIdx--; updateActive(); } }
            else if (e.key === 'Enter') { if (currentResults[activeIdx]) { e.preventDefault(); go(currentResults[activeIdx]); } }
            else if (e.key === 'Escape') { panel.hidden = true; input.blur(); }
        });

        document.addEventListener('mousedown', (e) => { if (!wrap.contains(e.target)) panel.hidden = true; });

        // Command-palette focus: "/" or Cmd/Ctrl-K, when not already typing.
        document.addEventListener('keydown', (e) => {
            const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
            if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K'))) {
                e.preventDefault(); input.focus(); input.select();
            }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
})();
