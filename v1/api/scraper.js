import axios from 'axios';
import * as cheerio from 'cheerio';

const AMAZON_SELECTORS = {
  title: ['#productTitle', '.qa-title-text'],
  price: [
    '.a-price-whole',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#corePrice_feature_div .a-price-whole',
    '.a-offscreen'
  ],
  image: ['#landingImage', '#imgBlkFront', '#main-image', '#imgTagWrapperId img'],
  brand: ['#bylineInfo', '#brand', '#bylineInfo_feature_div', 'a#bylineInfo'],
  reviews: [
    '[data-hook="reviewText"]',
    '[data-hook="reviewTextContainer"]',
    '[data-hook="review-body"] span',
    '[data-hook="review-body"]',
    '.review-text-content span',
    '.review-text'
  ]
};

/**
 * Validates whether the URL is a supported Amazon product URL.
 * @param {string} urlStr
 * @returns {{ isValid: boolean, platform: string | null }}
 */
export function validateUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();
    if (hostname.includes('amazon.')) {
      return { isValid: true, platform: 'amazon' };
    }
    return { isValid: false, platform: null };
  } catch {
    return { isValid: false, platform: null };
  }
}

/**
 * Fetches HTML from a URL, routing through ScraperAPI if key is available.
 * @param {string} url
 * @param {boolean} renderJs - Whether to use ScraperAPI's JS rendering (headless Chromium).
 * @returns {Promise<string>}
 */
async function fetchHtml(url, renderJs = false) {
  const scraperApiKey = process.env.SCRAPER_API_KEY;

  if (scraperApiKey) {
    const params = new URLSearchParams({
      api_key: scraperApiKey,
      url,
      render: renderJs ? 'true' : 'false',
      country_code: 'in'
    });
    const proxyUrl = `https://api.scraperapi.com?${params.toString()}`;
    console.log(`[Scraper] Fetching via ScraperAPI (render=${renderJs}): ${url}`);
    // JS rendering spins up headless Chromium — allow 70s; non-rendered requests are fast at 20s
    const timeout = renderJs ? 70000 : 20000;
    const response = await axios.get(proxyUrl, { timeout });
    return response.data;
  }

  // Direct fetch fallback (no proxy key)
  console.log(`[Scraper] Fetching directly: ${url}`);
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Upgrade-Insecure-Requests': '1'
  };
  const response = await axios.get(url, { headers, timeout: 10000 });
  return response.data;
}

/**
 * Scrapes product info and customer reviews from an Amazon product URL.
 * @param {string} url
 * @returns {Promise<{ productInfo: object, reviews: string[] }>}
 */
export async function scrapeProduct(url) {
  const { isValid, platform } = validateUrl(url);
  if (!isValid) {
    throw new Error('Only Amazon product links are supported. Please paste a valid amazon.in or amazon.com URL.');
  }

  // Step 1: Fetch the product page (non-rendered is sufficient for product info)
  const html = await fetchHtml(url, false);
  const $ = cheerio.load(html);

  // --- Extract product metadata ---
  let title = '';
  for (const s of AMAZON_SELECTORS.title) {
    const text = $(s).first().text().trim();
    if (text) { title = text; break; }
  }

  let price = '';
  for (const s of AMAZON_SELECTORS.price) {
    const text = $(s).first().text().trim();
    if (text) { price = text; break; }
  }

  let image = '';
  for (const s of AMAZON_SELECTORS.image) {
    const el = $(s).first();
    if (!el.length) continue;
    image = el.attr('src') || el.attr('data-old-hires') || '';
    if (!image) {
      const dynamic = el.attr('data-a-dynamic-image');
      if (dynamic) {
        try { image = Object.keys(JSON.parse(dynamic))[0]; } catch { /* skip */ }
      }
    }
    if (image && image.startsWith('http')) break;
  }

  let brand = '';
  for (const s of AMAZON_SELECTORS.brand) {
    const text = $(s).first().text()
      .replace(/Visit the\s+/i, '')
      .replace(/\s+Store/i, '')
      .replace(/Brand:\s+/i, '')
      .trim();
    if (text) { brand = text; break; }
  }

  // --- Check for bot wall on the non-rendered page ---
  const pageText = $('body').text().toLowerCase();
  const isBlocked = pageText.includes('robot check') || pageText.includes('captcha') || pageText.includes('automated access');
  if (isBlocked && !title) {
    const hasKey = !!process.env.SCRAPER_API_KEY;
    throw new Error(
      hasKey
        ? 'Amazon blocked this request. Please try a different product URL or try again in a moment.'
        : 'Amazon blocked this request. Configure a SCRAPER_API_KEY in the backend .env to enable reliable crawling.'
    );
  }

  if (!title) {
    throw new Error('Could not extract product details. Please ensure the link is a valid Amazon product page.');
  }

  // --- Step 2: Extract reviews from the JS-rendered product page ---
  const reviews = [];
  const hasASIN = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);

  if (hasASIN) {
    try {
      console.log(`[Scraper] Fetching JS-rendered page for inline reviews...`);
      const renderedHtml = await fetchHtml(url, true);
      const $r = cheerio.load(renderedHtml);

      $r(AMAZON_SELECTORS.reviews.join(',')).each((_, el) => {
        const text = $r(el).text().trim();
        const isBoilerplate = /return|refund|warranty|delivery|policy|terms/i.test(text) && text.length < 100;
        const isAccessibility = /brief content visible|double tap to read|full content visible/i.test(text);
        if (text.length > 25 && !reviews.includes(text) && !isBoilerplate && !isAccessibility) {
          reviews.push(text);
        }
      });
      console.log(`[Scraper] Extracted ${reviews.length} reviews from JS-rendered page`);
    } catch (err) {
      console.warn(`[Scraper] JS render failed, proceeding without reviews: ${err.message}`);
    }
  }

  // Fallback: parse reviews from non-rendered HTML (may be empty on Amazon)
  if (reviews.length === 0) {
    $(AMAZON_SELECTORS.reviews.join(',')).each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 25 && !reviews.includes(text)) {
        reviews.push(text);
      }
    });
    console.log(`[Scraper] Fallback extracted ${reviews.length} reviews from static HTML`);
  }

  return {
    productInfo: {
      title,
      price: price || 'Price not displayed',
      image: image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
      brand: brand || title.split(' ')[0],
      platform: 'Amazon'
    },
    reviews: reviews.slice(0, 15)
  };
}
