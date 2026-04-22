const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://novasect.space';

// 1. Define Fixed Pages
const fixedPages = [
    { url: '/index.html', freq: 'daily' },
    { url: '/about.html', freq: 'weekly' },
    { url: '/sentinel.html', freq: 'daily' },
    { url: '/reports.html', freq: 'weekly' },
    { url: '/energy.html', freq: 'weekly' },
    { url: '/industrials.html', freq: 'weekly' },
];

// 2. Extract COMPANIES from sentinel.v2.js
const sentinelJsPath = path.join(__dirname, 'sentinel.v2.js');
let companies = [];

try {
    const sentinelCode = fs.readFileSync(sentinelJsPath, 'utf8');
    // Extract the array literal using a regex
    const match = sentinelCode.match(/const COMPANIES = (\[[\s\S]*?\]);/);
    if (match) {
        // Safely evaluate the array literal
        companies = new Function(`return ${match[1]}`)();
    } else {
        console.warn('Could not find COMPANIES array in sentinel.v2.js');
    }
} catch (error) {
    console.error('Error reading sentinel.v2.js:', error.message);
}

// 3. Generate XML Content
let sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

// Add fixed pages
fixedPages.forEach(page => {
    sitemapContent += `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <changefreq>${page.freq}</changefreq>
  </url>\n`;
});

// Add dynamic company pages based on the format: /report.html?company=companyname
companies.forEach(company => {
    // Format company name to match existing URLs (e.g., "Exxon Mobil" -> "exxonmobil")
    const formattedName = company.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    sitemapContent += `  <url>
    <loc>${BASE_URL}/report.html?company=${formattedName}</loc>
    <changefreq>weekly</changefreq>
  </url>\n`;
});

sitemapContent += `</urlset>\n`;

// 4. Write to sitemap.xml
const sitemapPath = path.join(__dirname, 'sitemap.xml');
try {
    fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
    console.log(`Successfully generated sitemap.xml with ${fixedPages.length + companies.length} entries.`);
} catch (error) {
    console.error('Error writing sitemap.xml:', error.message);
}
