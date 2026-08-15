/* Sentinel anchor-review queue. Browser-local acknowledgements; never writes anchors. */
(() => {
    const KEY = 'ns.sentinel.anchor-review.v1';
    const DAY = 86400000;
    const state = { filter: 'all', rows: [], local: readLocal() };
    const $ = id => document.getElementById(id);
    function readLocal() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
    function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(state.local)); } catch {} }
    function age(date) { const time = Date.parse(date || ''); return Number.isFinite(time) ? Math.max(0, Math.floor((Date.now() - time) / DAY)) : Infinity; }
    function status(row) { const days = age(row.anchor.lastVerified); if (days >= row.monitoring.staleAfterDays) return 'stale'; if (days >= row.monitoring.reviewAfterDays) return 'due'; return 'fresh'; }
    function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]); }
    function material(row) { return Boolean(state.local[row.ticker]?.material); }
    function enrich(governance, universe) {
        return Object.entries(governance.byTicker || {}).map(([ticker, row]) => ({ ticker, ...row, name: universe?.tickers?.[ticker]?.name || ticker, sector: universe?.tickers?.[ticker]?.sector || '—' }))
            .sort((a,b) => ({stale:0,due:1,fresh:2}[status(a)] - ({stale:0,due:1,fresh:2}[status(b)])) || b.anchor.baseSpreadBps - a.anchor.baseSpreadBps || a.ticker.localeCompare(b.ticker));
    }
    function filtered() { return state.rows.filter(row => state.filter === 'all' || (state.filter === 'done' ? state.local[row.ticker]?.done : state.filter === 'material' ? material(row) : status(row) === state.filter)); }
    function renderSummary() {
        const count = kind => state.rows.filter(row => kind === 'done' ? state.local[row.ticker]?.done : status(row) === kind).length;
        $('ar-summary').innerHTML = [['stale','OVERDUE'],['due','REVIEW DUE'],['fresh','CURRENT'],['done','LOCAL ACKS']].map(([kind,label]) => `<div class="ar-stat"><b>${count(kind)}</b><span>${label}</span></div>`).join('');
    }
    function render() {
        renderSummary(); const rows = filtered();
        $('ar-list').innerHTML = rows.length ? rows.map(row => {
            const tier = status(row), local = state.local[row.ticker] || {}, checked = local.done ? 'Locally acknowledged' : tier === 'stale' ? 'Overdue' : tier === 'due' ? 'Review due' : 'Current';
            const source = row.provenance?.anchorSource || 'manual review';
            return `<article class="ar-row"><div><div class="ar-ticker">${esc(row.ticker)}</div><div class="ar-name">${esc(row.name)}</div><div class="ar-meta">${esc(row.sector)} · ${esc(source)}</div></div><div class="ar-meta"><span class="ar-label">Anchor</span>${esc(row.anchor.rating)} · ${esc(row.anchor.baseSpreadBps)} bps</div><div class="ar-meta"><span class="ar-label">Verified</span>${esc(row.anchor.lastVerified || 'Unknown')} · ${age(row.anchor.lastVerified)}d<br><span class="ar-badge ${local.done ? 'done' : tier}">${checked}</span>${local.material ? '<br><span class="ar-badge stale">MATERIAL CANDIDATE</span>' : ''}</div><div><textarea class="ar-note" data-note="${esc(row.ticker)}" placeholder="Local review note / source reference">${esc(local.note || '')}</textarea><div class="ar-actions"><button class="ar-btn" data-toggle="${esc(row.ticker)}">${local.done ? 'Reopen' : 'Acknowledge locally'}</button><button class="ar-btn" data-material="${esc(row.ticker)}">${local.material ? 'Clear material' : 'Flag material'}</button><a class="ar-link" href="brief.html?ticker=${encodeURIComponent(row.ticker)}">Open dossier →</a></div></div></article>`;
        }).join('') : '<div class="ar-empty">No issuers match this queue filter.</div>';
    }
    function bind() {
        $('ar-controls').addEventListener('click', event => { const button = event.target.closest('[data-filter]'); if (!button) return; state.filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(node => node.classList.toggle('active', node === button)); render(); });
        $('ar-list').addEventListener('input', event => { const ticker = event.target.dataset.note; if (!ticker) return; state.local[ticker] = { ...(state.local[ticker] || {}), note: event.target.value }; saveLocal(); });
        $('ar-list').addEventListener('click', event => { const button = event.target.closest('[data-toggle]'); if (!button) return; const ticker = button.dataset.toggle; state.local[ticker] = { ...(state.local[ticker] || {}), done: !state.local[ticker]?.done, acknowledgedAt: new Date().toISOString() }; saveLocal(); render(); });
        $('ar-list').addEventListener('click', event => { const button = event.target.closest('[data-material]'); if (!button) return; const ticker = button.dataset.material; state.local[ticker] = { ...(state.local[ticker] || {}), material: !state.local[ticker]?.material }; saveLocal(); render(); });
    }
    async function init() {
        try { const [governance, universe] = await Promise.all([window.NSSnapshots ? window.NSSnapshots.get('sentinelGovernance') : fetch('data/sentinel-governance.json').then(r => r.json()), window.NSSnapshots ? window.NSSnapshots.get('universe') : fetch('data/universe.json').then(r => r.json())]); state.rows = enrich(governance, universe); render(); bind(); }
        catch { $('ar-list').innerHTML = '<div class="ar-empty">Governance data is unavailable. No production anchors were changed.</div>'; }
    }
    init();
})();
