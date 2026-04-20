/**
 * FRED Proxy - Vercel Serverless Function
 * Resolves CORS and secures the FRED_API_KEY
 * Telemetry v1.2 - Advanced Diagnostics: 2026-04-20
 */
export default async function handler(req, res) {
    const { series_id } = req.query;
    const apiKey = process.env.FRED_API_KEY;

    if (!series_id) {
        return res.status(400).json({ error: 'E400: Missing series_id' });
    }

    if (!apiKey) {
        console.warn('FRED_API_KEY missing from environment');
        return res.status(500).json({ error: 'E500: ENVAR_MISSING (Check Dashboard)' });
    }

    try {
        const fredUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${series_id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
        const response = await fetch(fredUrl);
        
        if (response.status === 403 || response.status === 401) {
             return res.status(401).json({ error: 'E401: API_KEY_INVALID (Check Key Integrity)' });
        }

        if (!response.ok) {
            return res.status(response.status).json({ error: `E${response.status}: FRED_API_REJECTED` });
        }

        const data = await response.json();

        if (data.observations && data.observations.length > 0) {
            const latest = data.observations[0];
            return res.status(200).json({
                value: parseFloat(latest.value),
                date: latest.date,
                series: series_id,
                source: 'FRED Live'
            });
        } else {
            return res.status(404).json({ error: 'E404: NO_OBSERVATIONS' });
        }
    } catch (error) {
        console.error('FRED Proxy Error:', error);
        return res.status(502).json({ error: 'E502: NETWORK_HANDSHAKE_FAILED' });
    }
}
