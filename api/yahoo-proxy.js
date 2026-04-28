/**
 * Yahoo Finance Proxy - Vercel Serverless Function
 * Fetches stock daily data (1 month) to calculate 30-day annualized realized volatility.
 * Used exclusively for spot-checking company tickers to preserve Alpha Vantage limits.
 */
export default async function handler(req, res) {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'E400: Missing symbol' });
    }

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        if (!response.ok) {
            return res.status(response.status).json({ error: `E${response.status}: YAHOO_API_REJECTED` });
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result || !result.indicators?.quote?.[0]?.close) {
            return res.status(404).json({ error: 'E404: NO_DATA_FOUND' });
        }

        const closes = result.indicators.quote[0].close;
        const timestamps = result.timestamp;

        // Filter out any null closes
        const validCloses = closes.filter(c => c !== null);
        
        if (validCloses.length < 2) {
             return res.status(400).json({ error: 'E400: INSUFFICIENT_DATA' });
        }

        // We want daily returns: ln(P_t / P_{t-1})
        // Yahoo returns chronological array (oldest to newest)
        const returns = [];
        for (let i = 1; i < validCloses.length; i++) {
            returns.push(Math.log(validCloses[i] / validCloses[i-1]));
        }

        // Standard Deviation of Returns
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (returns.length - 1);
        const stdDev = Math.sqrt(variance);

        // Annualized Realized Volatility (assuming 252 trading days)
        const annualizedVol = stdDev * Math.sqrt(252);

        // Convert to percentage
        const volatilityPercentage = parseFloat((annualizedVol * 100).toFixed(2));
        
        // Daily Price Change %
        const lastClose = validCloses[validCloses.length - 1];
        const prevClose = validCloses[validCloses.length - 2];
        const dailyPriceChangePct = parseFloat((((lastClose - prevClose) / prevClose) * 100).toFixed(2));

        // Latest Date
        const latestDate = new Date(timestamps[timestamps.length - 1] * 1000).toISOString().split('T')[0];

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json({
            symbol: symbol,
            volatility: volatilityPercentage,
            dailyPriceChangePct: dailyPriceChangePct,
            latestDate: latestDate,
            source: 'Yahoo Finance Live'
        });

    } catch (error) {
        console.error('Yahoo Proxy Error:', error);
        return res.status(502).json({ error: 'E502: NETWORK_HANDSHAKE_FAILED' });
    }
}
