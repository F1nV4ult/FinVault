/**
 * Runtime-free validation for data/universe.json.
 *
 * The registry is consumed by every cross-tool surface, so this deliberately
 * checks the small public contract instead of relying on each UI to infer
 * availability from optional, tool-specific fields.
 */
function validateUniverse(universe) {
    const errors = [];
    const tickers = universe && universe.tickers;
    if (!universe || !universe._meta || universe._meta.schemaVersion !== 1) {
        errors.push('missing or unsupported _meta.schemaVersion');
    }
    if (!tickers || typeof tickers !== 'object' || Array.isArray(tickers)) {
        errors.push('tickers must be an object keyed by canonical Yahoo ticker');
        return errors;
    }

    for (const [key, entry] of Object.entries(tickers)) {
        const label = `ticker ${key}`;
        if (!entry || entry.ticker !== key) errors.push(`${label}: key must match entry.ticker`);
        if (!entry || typeof entry.name !== 'string' || !entry.name.trim()) errors.push(`${label}: missing name`);
        if (!entry || typeof entry.sector !== 'string' || !entry.sector.trim()) errors.push(`${label}: missing sector`);
        if (!entry || !entry.exchanges || entry.exchanges.yahoo !== key) errors.push(`${label}: exchanges.yahoo must match key`);
        if (!entry || !entry.sentinel) errors.push(`${label}: Sentinel metadata is required`);
        if (!entry || !entry.osiris) errors.push(`${label}: Osiris metadata is required`);

        const capabilities = entry && entry.capabilities;
        if (!capabilities || typeof capabilities.sentinel !== 'boolean' || typeof capabilities.osiris !== 'boolean') {
            errors.push(`${label}: missing Sentinel/Osiris capability flags`);
        }
        if (!capabilities || !capabilities.finvault ||
            typeof capabilities.finvault.report !== 'boolean' ||
            typeof capabilities.finvault.overview !== 'boolean') {
            errors.push(`${label}: missing FinVault capability flags`);
        }
        if (!capabilities || !capabilities.downloads ||
            typeof capabilities.downloads.sentinel !== 'boolean' ||
            typeof capabilities.downloads.osiris !== 'boolean') {
            errors.push(`${label}: missing download capability flags`);
        }

        if (entry && entry.finvault) {
            if (typeof entry.finvault.slug !== 'string' || !entry.finvault.slug) errors.push(`${label}: invalid FinVault slug`);
            if (typeof entry.finvault.pdfReady !== 'boolean') errors.push(`${label}: finvault.pdfReady must be boolean`);
            if (!capabilities || capabilities.finvault.report !== entry.finvault.pdfReady) {
                errors.push(`${label}: report capability must equal finvault.pdfReady`);
            }
        } else if (capabilities && capabilities.finvault.overview) {
            errors.push(`${label}: FinVault overview capability requires FinVault metadata`);
        }
    }
    return errors;
}

module.exports = { validateUniverse };
