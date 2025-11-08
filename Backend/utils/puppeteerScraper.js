// utils/puppeteerScraper.js
const puppeteer = require('puppeteer');

async function puppeteerScrape(url, opts = {}) {
  const {
    headless = true,         // set false for debugging (shows browser)
    timeout = 30000,         // navigation timeout
    waitForNetworkIdle = 2500, // ms to wait for network idle after actions
    clickContact = true      // whether to attempt clicking contact buttons
  } = opts;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // set a common user-agent to avoid easy bot detection
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) SupplierScraperBot');

    // increase default timeout
    await page.setDefaultNavigationTimeout(timeout);

    // navigate
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // wait some time for JS to render initial content
    await page.waitForTimeout(1000);

    // remove overlays/popups that block clicks (best-effort)
    await page.evaluate(() => {
      const overlays = document.querySelectorAll('[class*="overlay"], [class*="modal"], [id*="popup"]');
      overlays.forEach(o => o.parentNode && o.parentNode.removeChild(o));
    });

    // Try to click "Contact", "Contact Supplier", "View Profile" etc.
    if (clickContact) {
      const clickLabels = [
        'contact', 'contact supplier', 'contact now', 'contact us',
        'view profile', 'view contact', 'show contact', 'show details'
      ];

      for (const label of clickLabels) {
        const escaped = label.toLowerCase();
        // find anchors/buttons containing the text
        const el = await page.$x(`//a[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), "${escaped}")] | //button[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), "${escaped}")]`);
        if (el && el.length) {
          try {
            await el[0].click();
            await page.waitForTimeout(waitForNetworkIdle);
            break;
          } catch (e) { /* ignore click failures */ }
        }
      }
    }

    // Wait for network idle small window so dynamic content settles
    await page.waitForTimeout(waitForNetworkIdle);

    // Scroll to bottom to lazy-load content
    await autoScroll(page);

    // Extract candidate emails from the rendered DOM and attributes
    const result = await page.evaluate(() => {
      function findEmailsInText(str) {
        if (!str) return [];
        return Array.from(new Set((str.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g) || [])));
      }

      const emails = [];

      // 1) mailto anchors
      document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
        const m = a.getAttribute('href').replace('mailto:', '').split('?')[0].trim();
        if (m) emails.push(m);
      });

      // 2) data-* attributes, meta tags, visible text
      document.querySelectorAll('*').forEach(el => {
        // attributes
        for (let i = 0; i < el.attributes.length; i++) {
          const val = el.attributes[i].value;
          findEmailsInText(val).forEach(e => emails.push(e));
        }
      });

      // 3) page text
      findEmailsInText(document.body.innerText).forEach(e => emails.push(e));

      // Filter common false positives (like script file names)
      const filtered = emails.filter(e => {
        const lower = e.toLowerCase();
        if (lower.includes('.js') || lower.includes('.css') || lower.includes('bundle') || lower.includes('swiper')) return false;
        if (lower.startsWith('http://') || lower.startsWith('https://')) return false;
        // require common TLDs
        const allowed = ['.com', '.cn', '.in', '.net', '.org', '.co', '.co.in', '.biz', '.cc', '.uk', '.us'];
        if (!allowed.some(t => lower.endsWith(t))) return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
      });

      return Array.from(new Set(filtered)); // unique
    });

    // If none found, try inspect network responses (some sites return contact via XHR)
    let networkEmails = [];
    if (!result.length) {
      const responses = [];
      page.on('response', resp => {
        try {
          const url = resp.url();
          const ct = resp.headers()['content-type'] || '';
          // consider JSON/text XHRs
          if (ct.includes('application/json') || ct.includes('text')) {
            responses.push({ url, resp });
          }
        } catch (e) {}
      });

      // small wait to let network events fire
      await page.waitForTimeout(1000);

      // try fetch common contact endpoints by reading page scripts (best-effort)
      // Note: reading actual response bodies requires listening earlier; above handler collects only urls
      // so we do a targeted fetch for likely endpoints — omitted for simplicity due to variation across sites
      // You may add custom network inspection per target site.
    }

    const emails = result.length ? result : networkEmails;
    await browser.close();
    return { emails, pageUrl: page.url() };
  } catch (err) {
    if (browser) await browser.close();
    return { emails: [], error: err.message };
  }
}

// helper to auto-scroll lazy pages
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;
        if (total > document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 250);
    });
  });
}

module.exports = puppeteerScrape;
