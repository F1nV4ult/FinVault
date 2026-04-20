 * FRED Proxy - Vercel Serverless Function
 * Resolves CORS and secures the FRED_API_KEY
 * Telemetry v1.1 - Activated: 2026-04-20
 */
export default async function handler(req, res) {
    const { series_id } = req.query;
    const apiKey = process.env.FRED_API_KEY;

    if (!series_id) {
        return res.status(400).json({ error: 'Missing series_id' });
    }

    if (!apiKey) {
        console.warn('FRED_API_KEY missing - returning fallback flag');
        return res.status(500).json({ error: 'Infrastructure misconfiguration: API key missing' });
    }

    try {
        const fredUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${series_id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
        const response = await fetch(fredUrl);
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
            return res.status(404).json({ error: 'No observations found' });
        }
    } catch (error) {
        console.error('FRED Proxy Error:', error);
        return res.status(502).json({ error: 'Failed to communicate with FRED API' });
    }
}
