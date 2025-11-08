// controllers/supplierController.js
const axios = require("axios");
const cheerio = require("cheerio");
require("dotenv").config();
const scrapeWebsite = require("../utils/webScraper");  // ✅ FIXED IMPORT
const puppeteerScrape = require('../utils/puppeteerScraper');

const SERPER_API = {
  url: "https://google.serper.dev/search",
  key: process.env.SERPER_API_KEY,
};

class SupplierSearch {
  constructor() {
    this.b2bDomains = [
      "alibaba.com",
      "indiamart.com",
      "tradeindia.com",
      "made-in-china.com",
      "exportersindia.com",
      "globalsources.com"
    ];

    this.supplierTypes = [
      "supplier",
      "manufacturer",
      "factory",
      "exporter",
      "wholesaler",
      "distributor",
      "trader"
    ];
  }

  async searchSuppliers(query, country = "", supplierType = "") {
    const searchQuery = this.buildSearchQuery(query, country, supplierType);
    const results = await this.useSerperAPI(searchQuery);
    return results;
  }

  buildSearchQuery(query, country = "", supplierType = "") {
    let finalQuery = `${query}`;

    const siteFilters = this.b2bDomains.map((s) => `site:${s}`).join(" OR ");
    finalQuery += ` (${siteFilters})`;

    if (supplierType && this.supplierTypes.includes(supplierType.toLowerCase())) {
      finalQuery += ` "${supplierType}"`;
    }

    if (country) finalQuery += ` "${country}"`;

    return finalQuery;
  }

  async useSerperAPI(query) {
    try {
      const response = await axios.post(
        SERPER_API.url,
        { q: query, gl: "in", hl: "en", num: 20 },
        {
          headers: {
            "X-API-KEY": SERPER_API.key,
            "Content-Type": "application/json",
          },
        }
      );

      return this.parseResults(response.data);
    } catch (error) {
      console.error("❌ SERPER API ERROR:", error.response?.data || error.message);
      throw new Error("Serper API failed. Check API key.");
    }
  }

  parseResults(data) {
    if (!data.organic) return [];

    return data.organic.map((item, index) => ({
      id: index + 1,
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      domain: this.extractDomain(item.link),
      isB2B: this.b2bDomains.some((d) => item.link.includes(d)),
    }));
  }

  async extractSupplierDetails(item) {
    const scraped = await scrapeWebsite(item.link);    // ✅ using webScraper.js

    const country = this.extractCountry(item.snippet || item.title);

    return {
      name: this.extractCompanyName(item.title),
      website: item.link,
      email: scraped.email,           // ✅ now using real scraped email
      availability: scraped.availability,
      country,
      domain: item.domain,
      description: item.snippet,
    };
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  }

  extractCountry(text) {
    const countries = {
      india: "🇮🇳 India",
      china: "🇨🇳 China",
      usa: "🇺🇸 USA",
      vietnam: "🇻🇳 Vietnam",
      germany: "🇩🇪 Germany",
      uk: "🇬🇧 UK",
    };
    const lower = text.toLowerCase();

    for (const [key, value] of Object.entries(countries)) {
      if (lower.includes(key)) return value;
    }
    return "🌍 Global";
  }

  extractCompanyName(title) {
    return title
      .replace(/-.*$/, "")
      .replace(/\|.*$/, "")
      .replace(/\.com.*$/i, "")
      .trim();
  }
}

const supplierSearch = new SupplierSearch();

exports.searchSuppliers = async (req, res) => {
  const { query, country = "", supplierType = "" } = req.body;

  if (!query) return res.status(400).json({ error: "Query is required" });

  try {
    const rawResults = await supplierSearch.searchSuppliers(query, country, supplierType);

    const finalResults = [];
    for (const result of rawResults) {
      if (!result.isB2B) continue;
      const fullData = await supplierSearch.extractSupplierDetails(result);
      finalResults.push(fullData);
    }

    res.json({
      originalQuery: query,
      filters: { supplierType, country },
      resultsCount: finalResults.length,
      results: finalResults,
    });
  } catch (error) {
    console.error("🔥 FINAL ERROR:", error.message);
    res.status(500).json({ error: "Something went wrong." });
  }
};
