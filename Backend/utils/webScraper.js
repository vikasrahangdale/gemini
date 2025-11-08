const axios = require("axios");
const cheerio = require("cheerio");

async function scrapeWebsite(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (SupplierFinderBot)"
      },
      timeout: 12000,
    });

    const $ = cheerio.load(response.data);
    let email = null;

    // ✅ STEP 0: Allowed valid TLDs only
    const validTLDs = [".com", ".cn", ".in", ".net", ".org", ".co", ".co.in", ".biz", ".cc", ".uk", ".us"];

    // ✅ Remove scripts/styles (so swiper@bundle.min JS text won't be searched)
    $("script, style, noscript").remove();

    const textContent = $("body").text();

    // ✅ STEP 1: Strict real email matching (with TLD validation)
    const matches = textContent.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g);

    if (matches && matches.length > 0) {
      email = matches.find(e => validateRealEmail(e, validTLDs));
    }

    // ✅ STEP 2: Try mailto link
    if (!email) {
      const mailHref = $('a[href^="mailto:"]').attr("href");
      if (mailHref && validateRealEmail(mailHref.replace("mailto:", ""), validTLDs)) {
        email = mailHref.replace("mailto:", "").trim();
      }
    }

    // ✅ STEP 3: Try obfuscated emails e.g. sales[at]gmail[dot]com
    if (!email) {
      const obfuscated = textContent.match(
        /([a-zA-Z0-9._%+-]+)\s?(?:@|\[at\])\s?([a-zA-Z0-9.-]+)\s?(?:\.|\[dot\])\s?([A-Za-z]{2,})/i
      );
      if (obfuscated) {
        email = `${obfuscated[1]}@${obfuscated[2]}.${obfuscated[3]}`;
      }
    }

    // ✅ STEP 4: Deep scrape (contact / profile page if exists)
    if (!email) {
      const deepLink = findProfileOrContactPage($, url);
      if (deepLink) {
        email = await scrapeDeepPage(deepLink, validTLDs);
      }
    }

    const availability =
      textContent.match(/(available|in stock|ready|manufacture|production)/i)?.[0] ||
      "Not Clear";

    return { email: email || "Not Found", availability };

  } catch (error) {
    console.log("❌ Scraper Error:", error.message);
    return { email: "Not Found", availability: "Unknown" };
  }
}

// ✅ Helper to clean + validate real email
function validateRealEmail(email, validTLDs) {
  if (!email) return false;

  const clean = email.toLowerCase().trim();

  // ❌ Reject JS/CSS or files masquerading as email
  if (
    clean.includes(".js") ||
    clean.includes(".css") ||
    clean.includes("bundle") ||
    clean.includes("min")
  ) {
    return false;
  }

  // ❌ Reject URLs (TikTok, etc.)
  if (clean.startsWith("http://") || clean.startsWith("https://")) return false;

  // ✅ Must match valid email syntax
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clean)) return false;

  // ✅ Must end with allowed TLD
  return validTLDs.some(tld => clean.endsWith(tld));
}

// ✅ Deep scraping
async function scrapeDeepPage(url, validTLDs) {
  try {
    const { data } = await axios.get(url);
    const match = data.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);

    return match && validateRealEmail(match[0], validTLDs) ? match[0] : null;
  } catch {
    return null;
  }
}

// ✅ Contact/Profile page finder
function findProfileOrContactPage($, baseUrl) {
  let link = null;
  $("a").each((_, el) => {
    const txt = $(el).text().toLowerCase();
    if (txt.includes("contact") || txt.includes("profile") || txt.includes("about")) {
      link = $(el).attr("href");
    }
  });

  if (link && !link.startsWith("http")) {
    link = new URL(link, baseUrl).href;
  }
  return link;
}

module.exports = scrapeWebsite;
