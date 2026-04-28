/**
 * Alpha Vantage Proxy - Vercel Serverless Function
 * Fetches ETF/Stock daily data and calculates 30-day annualized realized volatility.
 */
export default async function handler(req, res) {
    const { symbol } = req.query;
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY || 'HUDHHNQD7RIB97FS';

    if (!symbol) {
        return res.status(400).json({ error: 'E400: Missing symbol' });
    }

    try {
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${apiKey}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            return res.status(response.status).json({ error: `E${response.status}: ALPHA_API_REJECTED` });
        }

        const data = await response.json();

        if (data['Note']) {
             return res.status(429).json({ error: 'E429: API_RATE_LIMIT_EXCEEDED' });
        }

        if (data['Information']) {
            console.warn('Alpha Vantage API key restriction/rate-limit encountered. Using fallback mock data.');
            const mockVol = { 'XLE': 25.5, 'XLU': 18.2, 'XLI': 22.1 };
            return res.status(200).json({
                symbol: symbol,
                volatility: mockVol[symbol] || 20.0,
                latestDate: new Date().toISOString().split('T')[0],
                source: 'Alpha Vantage (Demo Mock)'
            });
        }

        if (!data['Time Series (Daily)']) {
            return res.status(404).json({ error: 'E404: NO_DATA_FOUND', raw: data });
        }

        const timeSeries = data['Time Series (Daily)'];
        const dates = Object.keys(timeSeries).sort((a, b) => new Date(b) - new Date(a));
        
        // Need up to 30 days for 30-Day Realized Volatility
        const daysToUse = Math.min(31, dates.length);
        if (daysToUse < 2) {
             return res.status(400).json({ error: 'E400: INSUFFICIENT_DATA' });
        }

        // Extract closing prices
        const closes = [];
        for (let i = 0; i < daysToUse; i++) {
            closes.push(parseFloat(timeSeries[dates[i]]['4. close']));
        }

        // Calculate daily returns: ln(P_t / P_{t-1})
        const returns = [];
        for (let i = 0; i < closes.length - 1; i++) {
            returns.push(Math.log(closes[i] / closes[i+1]));
        }

        // Standard Deviation of Returns
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (returns.length - 1);
        const stdDev = Math.sqrt(variance);

        // Annualized Realized Volatility (assuming 252 trading days)
        const annualizedVol = stdDev * Math.sqrt(252);

        // Convert to percentage (e.g. 15.5 for 15.5%)
        const volatilityPercentage = parseFloat((annualizedVol * 100).toFixed(2));

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json({
            symbol: symbol,
            volatility: volatilityPercentage,
            latestDate: dates[0],
            source: 'Alpha Vantage Live'
        });

    } catch (error) {
        console.error('Alpha Proxy Error:', error);
        return res.status(502).json({ error: 'E502: NETWORK_HANDSHAKE_FAILED' });
    }
}
