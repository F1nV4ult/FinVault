/**
 * O5 runtime governance monitor.
 *
 * The compiled governance record is immutable at build time. Freshness is
 * assessed in the browser so a previously-valid validation run cannot silently
 * appear current indefinitely.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(date, now) {
    const timestamp = Date.parse(date || '');
    if (!Number.isFinite(timestamp)) return null;
    return Math.max(0, Math.floor((now.getTime() - timestamp) / DAY_MS));
}

export function assessGovernance(record, now = new Date()) {
    if (!record?.validation || !record?.provenance?.validationAsOf || !record?.selection?.selectedModel) {
        return { state: 'unavailable', label: 'UNAVAILABLE', ageDays: null, message: 'Governance evidence unavailable.' };
    }

    const ageDays = daysSince(record.provenance.validationAsOf, now);
    const reviewAfterDays = Number(record.monitoring?.reviewAfterDays ?? 90);
    const staleAfterDays = Number(record.monitoring?.staleAfterDays ?? 180);
    let state = 'current';
    if (ageDays == null || ageDays > staleAfterDays) state = 'stale';
    else if (ageDays > reviewAfterDays) state = 'review_due';

    const label = { current: 'CURRENT', review_due: 'REVIEW DUE', stale: 'STALE' }[state];
    const model = String(record.selection.selectedModel).replaceAll('_', ' ').toUpperCase();
    const pending = record.selection.status === 'baseline_pending_rolling_validation';
    const message = state === 'current'
        ? `${model} · validation ${ageDays}d old${pending ? ' · promotion pending' : ''}`
        : `${model} · validation ${ageDays == null ? 'date unknown' : `${ageDays}d old`} · ${label.toLowerCase()}`;
    return { state, label, ageDays, message, pendingPromotion: pending };
}
