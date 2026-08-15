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
    function sourceLink(url, label) { return /^https?:\/\//i.test(String(url || '')) ? `<a class="ar-link" target="_blank" rel="noreferrer" href="${esc(url)}">${label} ↗</a>` : 'Unavailable'; }
    function material(row) { return Boolean(state.local[row.ticker]?.material); }
    function hasCandidate(row) { return row.provenance?.evidenceStatus === 'candidate_recorded'; }
    function enrich(governance, universe) {
        return Object.entries(governance.byTicker || {}).map(([ticker, row]) => ({ ticker, ...row, name: universe?.tickers?.[ticker]?.name || ticker, sector: universe?.tickers?.[ticker]?.sector || '—' }))
            .sort((a,b) => ({stale:0,due:1,fresh:2}[status(a)] - ({stale:0,due:1,fresh:2}[status(b)])) || b.anchor.baseSpreadBps - a.anchor.baseSpreadBps || a.ticker.localeCompare(b.ticker));
    }
    function filtered() { return state.rows.filter(row => state.filter === 'all' || (state.filter === 'done' ? state.local[row.ticker]?.done : state.filter === 'material' ? material(row) : state.filter === 'candidate' ? hasCandidate(row) : status(row) === state.filter)); }
    function csv(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
    function exportReviewPacket() {
        const header = ['ticker','issuer','sector','approved_rating','approved_base_spread_bps','last_verified','verification_age_days','review_status','evidence_status','evidence_source_date','candidate_rating','candidate_base_spread_bps','rating_source_url','spread_source_url','local_acknowledged','material_candidate','local_note'];
        const lines = filtered().map(row => {
            const local = state.local[row.ticker] || {}, evidence = row.provenance?.evidence || {};
            return [row.ticker,row.name,row.sector,row.anchor.rating,row.anchor.baseSpreadBps,row.anchor.lastVerified,age(row.anchor.lastVerified),status(row),row.provenance?.evidenceStatus,evidence.sourceDate,evidence.candidateRating,evidence.candidateBaseSpreadBps,evidence.ratingSource,evidence.spreadSource,Boolean(local.done),Boolean(local.material),local.note].map(csv).join(',');
        });
        const blob = new Blob([[header.join(','), ...lines].join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `sentinel-anchor-review-${state.filter}-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 0);
    }
    function downloadCandidateTemplate(row) {
        const template = {
            schemaVersion: 1,
            intent: 'sentinel_anchor_candidate',
            ticker: row.ticker,
            candidate: { rating: row.anchor.rating, baseSpreadBps: row.anchor.baseSpreadBps },
            sourceDate: null,
            reviewer: null,
            ratingEvidence: { agency: null, url: null },
            spreadEvidence: { instrument: null, url: null },
            context: { approvedRating: row.anchor.rating, approvedBaseSpreadBps: row.anchor.baseSpreadBps, lastVerified: row.anchor.lastVerified }
        };
        const blob = new Blob([JSON.stringify(template, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `sentinel-anchor-candidate-${row.ticker}-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 0);
    }
    function renderSummary() {
        const count = kind => state.rows.filter(row => kind === 'done' ? state.local[row.ticker]?.done : kind === 'candidate' ? hasCandidate(row) : status(row) === kind).length;
        $('ar-summary').innerHTML = [['stale','OVERDUE'],['due','REVIEW DUE'],['candidate','CANDIDATES'],['fresh','CURRENT'],['done','LOCAL ACKS']].map(([kind,label]) => `<div class="ar-stat"><b>${count(kind)}</b><span>${label}</span></div>`).join('');
    }
    function render() {
        renderSummary(); const rows = filtered();
        $('ar-list').innerHTML = rows.length ? rows.map(row => {
            const tier = status(row), local = state.local[row.ticker] || {}, checked = local.done ? 'Locally acknowledged' : tier === 'stale' ? 'Overdue' : tier === 'due' ? 'Review due' : 'Current';
            const source = row.provenance?.anchorSource || 'manual review';
            const evidence = row.provenance?.evidence;
            const evidenceText = evidence ? `Candidate recorded · ${evidence.sourceDate || 'date pending'}` : 'Formal evidence pending';
            const historyText = row.provenance?.history ? `${row.provenance.history.kind} · ${row.provenance.history.effectiveDate}` : 'History missing';
            const delta = evidence ? evidence.candidateBaseSpreadBps - row.anchor.baseSpreadBps : null;
            const candidateDetail = evidence ? `${evidence.candidateRating} · ${evidence.candidateBaseSpreadBps} bps (${delta >= 0 ? '+' : ''}${delta} bps)` : '—';
            const candidateLinks = evidence ? `<br><span class="ar-label">Sources</span>${sourceLink(evidence.ratingSource, 'Rating')} · ${sourceLink(evidence.spreadSource, 'Spread')}` : '';
            return `<article class="ar-row"><div><div class="ar-ticker">${esc(row.ticker)}</div><div class="ar-name">${esc(row.name)}</div><div class="ar-meta">${esc(row.sector)} · ${esc(source)}</div></div><div class="ar-meta"><span class="ar-label">Anchor</span>${esc(row.anchor.rating)} · ${esc(row.anchor.baseSpreadBps)} bps</div><div class="ar-meta"><span class="ar-label">Verified</span>${esc(row.anchor.lastVerified || 'Unknown')} · ${age(row.anchor.lastVerified)}d<br><span class="ar-badge ${local.done ? 'done' : tier}">${checked}</span>${local.material ? '<br><span class="ar-badge stale">MATERIAL CANDIDATE</span>' : ''}<br><span class="ar-label">Evidence</span>${esc(evidenceText)}${evidence ? `<br><span class="ar-label">Proposed</span>${esc(candidateDetail)}${candidateLinks}` : ''}<br><span class="ar-label">History</span>${esc(historyText)}</div><div><textarea class="ar-note" data-note="${esc(row.ticker)}" placeholder="Local review note / source reference">${esc(local.note || '')}</textarea><div class="ar-actions"><button class="ar-btn" data-toggle="${esc(row.ticker)}">${local.done ? 'Reopen' : 'Acknowledge locally'}</button><button class="ar-btn" data-material="${esc(row.ticker)}">${local.material ? 'Clear material' : 'Flag material'}</button><button class="ar-btn" data-template="${esc(row.ticker)}">Candidate template</button><a class="ar-link" href="brief.html?ticker=${encodeURIComponent(row.ticker)}">Open dossier →</a></div></div></article>`;
        }).join('') : '<div class="ar-empty">No issuers match this queue filter.</div>';
    }
    function bind() {
        $('ar-controls').addEventListener('click', event => { const button = event.target.closest('[data-filter]'); if (!button) return; state.filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(node => node.classList.toggle('active', node === button)); render(); });
        $('ar-export').addEventListener('click', exportReviewPacket);
        $('ar-list').addEventListener('input', event => { const ticker = event.target.dataset.note; if (!ticker) return; state.local[ticker] = { ...(state.local[ticker] || {}), note: event.target.value }; saveLocal(); });
        $('ar-list').addEventListener('click', event => { const button = event.target.closest('[data-toggle]'); if (!button) return; const ticker = button.dataset.toggle; state.local[ticker] = { ...(state.local[ticker] || {}), done: !state.local[ticker]?.done, acknowledgedAt: new Date().toISOString() }; saveLocal(); render(); });
        $('ar-list').addEventListener('click', event => { const button = event.target.closest('[data-material]'); if (!button) return; const ticker = button.dataset.material; state.local[ticker] = { ...(state.local[ticker] || {}), material: !state.local[ticker]?.material }; saveLocal(); render(); });
        $('ar-list').addEventListener('click', event => { const button = event.target.closest('[data-template]'); if (!button) return; const row = state.rows.find(item => item.ticker === button.dataset.template); if (row) downloadCandidateTemplate(row); });
    }
    async function init() {
        try { const [governance, universe] = await Promise.all([window.NSSnapshots ? window.NSSnapshots.get('sentinelGovernance') : fetch('data/sentinel-governance.json').then(r => r.json()), window.NSSnapshots ? window.NSSnapshots.get('universe') : fetch('data/universe.json').then(r => r.json())]); state.rows = enrich(governance, universe); render(); bind(); }
        catch { $('ar-list').innerHTML = '<div class="ar-empty">Governance data is unavailable. No production anchors were changed.</div>'; }
    }
    init();
})();
