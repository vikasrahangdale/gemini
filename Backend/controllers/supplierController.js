// controllers/supplierController.js
const axios = require('axios');
require('dotenv').config();

const SERPER_API = {
  url: 'https://google.serper.dev/search',
  key: process.env.SERPER_API_KEY
};

class SupplierSearch {
  constructor() {
    this.supplierKeywords = ['supplier', 'manufacturer', 'factory', 'exporter', 'wholesaler'];
    this.b2bDomains = [
      'alibaba.com', 'indiamart.com', 'tradeindia.com',
      'made-in-china.com', 'exportersindia.com'
    ];
  }

  detectIntent(query) {
    const lowerQuery = query.toLowerCase();
    return this.supplierKeywords.some(keyword => lowerQuery.includes(keyword))
      ? 'supplier_search'
      : 'normal_query';
  }

  async searchSuppliers(query, country = '') {
    try {
      const searchQuery = this.buildSearchQuery(query, country);
      const results = await this.useSerperAPI(searchQuery);
      return results || [];
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  buildSearchQuery(query, country = '') {
    let baseQuery = query;
    const siteFilters = this.b2bDomains.map(site => `site:${site}`).join(' OR ');
    baseQuery += ` (${siteFilters})`;
    if (country) baseQuery += ` ${country}`;
    return baseQuery;
  }

  async useSerperAPI(query) {
    try {
      const response = await axios.post(
        SERPER_API.url,
        { q: query, gl: 'in', hl: 'en', num: 20 },
        {
          headers: {
            'X-API-KEY': SERPER_API.key,
            'Content-Type': 'application/json'
          }
        }
      );
      return this.parseResults(response.data);
    } catch (error) {
      console.error('Serper API error:', error.message);
      throw new Error('Search service temporarily unavailable');
    }
  }

 parseResults(data) {
  if (!data.organic) return [];

  return data.organic.map((item, index) => ({
    id: index + 1,
    title: item.title,
    link: item.link,
    snippet: item.snippet,
    displayLink: item.displayLink || this.extractDomain(item.link),
    isB2B: this.isB2BSite(item.displayLink || this.extractDomain(item.link))
  }));
}

isB2BSite(domain) {
  if (!domain || typeof domain !== 'string') return false;
  return this.b2bDomains.some(b2bDomain => domain.includes(b2bDomain));
}


  async cleanAndStructureResults(rawResults, originalQuery) {
    const structuredResults = [];
    for (const item of rawResults) {
      if (item.isB2B) {
        const supplier = this.extractSupplierInfo(item, originalQuery);
        if (supplier) structuredResults.push(supplier);
      }
    }
    return structuredResults;
  }

  extractSupplierInfo(searchResult, originalQuery) {
    const domain = this.extractDomain(searchResult.link);
    const country = this.extractCountry(searchResult.snippet || searchResult.title);
    const matchScore = this.calculateMatchScore(
      originalQuery,
      `${searchResult.title} ${searchResult.snippet}`
    );

    return {
      name: this.extractCompanyName(searchResult.title),
      country,
      matchScore,
      website: searchResult.link,
      domain,
      productRange: this.extractProductRange(searchResult.snippet),
      description: searchResult.snippet,
      confidence: this.getConfidenceLevel(matchScore)
    };
  }

  calculateMatchScore(query, text) {
    const queryWords = query.toLowerCase().split(/\s+/);
    const textWords = text.toLowerCase().split(/\s+/);
    let matches = 0;
    queryWords.forEach(word => {
      if (textWords.some(tWord => tWord.includes(word))) matches++;
    });
    return Math.round((matches / queryWords.length) * 100);
  }

  getConfidenceLevel(score) {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  extractCountry(text) {
    const countries = {
      india: '🇮🇳 India',
      china: '🇨🇳 China',
      usa: '🇺🇸 USA',
      vietnam: '🇻🇳 Vietnam',
      germany: '🇩🇪 Germany',
      uk: '🇬🇧 UK'
    };
    const lower = text.toLowerCase();
    for (const [key, flag] of Object.entries(countries)) {
      if (lower.includes(key)) return flag;
    }
    return '🌍 Global';
  }

  extractCompanyName(title) {
    return title
      .replace(/-.*$/, '')
      .replace(/\|.*$/, '')
      .replace(/\.com.*$/i, '')
      .trim();
  }

  extractProductRange(snippet) {
    const products = ['chair', 'table', 'furniture', 'wooden', 'metal', 'plastic'];
    const found = products.filter(p => snippet.toLowerCase().includes(p));
    return found.length ? found.join(', ') : 'Various products';
  }
}

const supplierSearch = new SupplierSearch();

// Controller methods
exports.searchSuppliers = async (req, res) => {
  const { query, country = '' } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    const intent = supplierSearch.detectIntent(query);

    if (intent !== 'supplier_search') {
      return res.json({
        intent,
        message:
          'For supplier search, include keywords like supplier, manufacturer, factory, exporter',
        results: []
      });
    }

    const rawResults = await supplierSearch.searchSuppliers(query, country);
    const structuredResults = await supplierSearch.cleanAndStructureResults(rawResults, query);

    res.json({
      intent,
      originalQuery: query,
      resultsCount: structuredResults.length,
      results: structuredResults
    });
  } catch (error) {
    console.error('Supplier search error:', error);
    res.status(500).json({
      error: 'Search service temporarily unavailable',
      message: 'Please try again after some time'
    });
  }
};
