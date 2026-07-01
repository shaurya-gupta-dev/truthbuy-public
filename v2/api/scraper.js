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

const FLIPKART_SELECTORS = {
  title: ['h1', '.VU-ZEz', '.B_NuCI', '.yd21e3'],
  price: ['.Nx9Btz', '._30jeq3', '.yKfJKb .Nx9Btz', 'div.Nx9Btz'],
  image: ['img.DByoEF', 'img._396cs4', 'img.CXW8mj', 'img.x3lhj7', '._2r_T1I'],
  brand: ['.G6XhZE', '.mX15tA', 'a.brand', 'span.brand'],
  reviews: [
    '.ZmyHe8',
    '._2-N1ha',
    '.t-y3xo',
    'div.t-y3xo',
    'div.ZmyHe8 span',
    'div.RmwVHL',
    '.RmwVHL'
  ]
};

/**
 * Validates whether the URL is a supported e-commerce URL.
 * @param {string} urlStr
 * @returns {{ isValid: boolean, platform: string | null }}
 */
export function validateUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();
    
    if (hostname.includes('amazon.')) {
      return { isValid: true, platform: 'amazon' };
    } else if (hostname.includes('flipkart.')) {
      // Mark as invalid for V2 but return platform to show upgrade notice
      return { isValid: false, platform: 'flipkart' };
    }
    
    return { isValid: false, platform: null };
  } catch {
    return { isValid: false, platform: null };
  }
}

/**
 * Fetches HTML from a URL, routing through ZenRows or ScraperAPI if keys are available.
 * @param {string} url
 * @param {boolean} renderJs - Whether to use JS rendering (headless browser).
 * @param {string} platform - The target platform ('amazon' or 'flipkart').
 * @returns {Promise<string>}
 */
async function fetchHtml(url, renderJs = false, platform = 'amazon') {
  const scraperApiKey = process.env.SCRAPER_API_KEY;
  const zenrowsApiKey = process.env.ZENROWS_API_KEY;

  // Use ZenRows as primary for Flipkart, and as fallback for Amazon if ScraperAPI is missing
  if ((platform === 'flipkart' && zenrowsApiKey) || (platform === 'amazon' && !scraperApiKey && zenrowsApiKey)) {
    const params = new URLSearchParams({
      apikey: zenrowsApiKey,
      url,
      js_render: renderJs ? 'true' : 'false',
      premium_proxy: renderJs ? 'true' : 'false',
      proxy_country: 'in'
    });
    const proxyUrl = `https://api.zenrows.com/v1/?${params.toString()}`;
    console.log(`[Scraper] Fetching via ZenRows (renderJs=${renderJs}, platform=${platform}): ${url}`);
    const timeout = renderJs ? 80000 : 25000;
    const response = await axios.get(proxyUrl, { timeout });
    return response.data;
  }

  // Use ScraperAPI for Amazon (or Flipkart as fallback if ZenRows is missing)
  if (scraperApiKey) {
    const params = new URLSearchParams({
      api_key: scraperApiKey,
      url,
      render: renderJs ? 'true' : 'false',
      country_code: 'in'
    });
    const proxyUrl = `https://api.scraperapi.com?${params.toString()}`;
    console.log(`[Scraper] Fetching via ScraperAPI (render=${renderJs}, platform=${platform}): ${url}`);
    const timeout = renderJs ? 80000 : 25000;
    const response = await axios.get(proxyUrl, { timeout });
    return response.data;
  }

  // Direct fetch fallback (no proxy keys configured)
  console.log(`[Scraper] Fetching directly: ${url}`);
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Upgrade-Insecure-Requests': '1'
  };
  const response = await axios.get(url, { headers, timeout: 15000 });
  return response.data;
}

/**
 * Scrapes product details, seller gallery, buyer review photos, and customer reviews.
 * @param {string} url
 * @returns {Promise<{ productInfo: object, reviews: string[] }>}
 */
export async function scrapeProduct(url) {
  const { isValid, platform } = validateUrl(url);
  if (!isValid) {
    if (platform === 'flipkart') {
      throw new Error('Flipkart support is temporarily disabled. TruthBuy V2 currently supports Amazon.');
    }
    throw new Error('Unsupported e-commerce platform. Only Amazon product links are supported.');
  }

  // Determine proxy keys availability
  const hasScraperAPI = !!process.env.SCRAPER_API_KEY;
  const hasZenRows = !!process.env.ZENROWS_API_KEY;

  if (platform === 'flipkart' && !hasZenRows && !hasScraperAPI) {
    throw new Error('Flipkart scraping requires ZENROWS_API_KEY or SCRAPER_API_KEY to bypass bot detection.');
  }

  console.log(`[Scraper] Starting scraper for platform: ${platform}`);

  // Step 1: Fetch the main page HTML
  // Flipkart requires JS rendering or premium proxy to load reviews and content properly in one go.
  const mainHtml = await fetchHtml(url, platform === 'flipkart', platform);
  const $ = cheerio.load(mainHtml);

  const selectors = platform === 'amazon' ? AMAZON_SELECTORS : FLIPKART_SELECTORS;

  // --- Extract Title ---
  let title = '';
  for (const s of selectors.title) {
    const text = $(s).first().text().trim();
    if (text) { title = text; break; }
  }

  // --- Extract Price ---
  let price = '';
  for (const s of selectors.price) {
    const text = $(s).first().text().trim();
    if (text) { price = text; break; }
  }

  // --- Extract Brand ---
  let brand = '';
  for (const s of selectors.brand) {
    const text = $(s).first().text()
      .replace(/Visit the\s+/i, '')
      .replace(/\s+Store/i, '')
      .replace(/Brand:\s+/i, '')
      .trim();
    if (text) { brand = text; break; }
  }

  // --- Check for Captcha / Bot wall ---
  const pageText = $('body').text().toLowerCase();
  const isBlocked = pageText.includes('robot check') || pageText.includes('captcha') || pageText.includes('automated access') || pageText.includes('something went wrong');
  if (isBlocked && !title) {
    throw new Error(
      `Access blocked by ${platform.toUpperCase()} security shields. Please verify your proxy API keys or try again.`
    );
  }

  if (!title) {
    throw new Error(`Failed to extract product details from ${platform.toUpperCase()}. Make sure the URL is a valid product page.`);
  }

  // --- Extract Seller Image Gallery ---
  const sellerImages = [];
  if (platform === 'amazon') {
    $('#altImages img, li.a-spacing-small-micro img, li.imageThumbnail img').each((_, el) => {
      let src = $(el).attr('src');
      if (src) {
        src = src.replace(/\._[A-Z0-9,_-]+\./i, '.');
        if (src.startsWith('http') && !src.includes('play-button') && !sellerImages.includes(src)) {
          sellerImages.push(src);
        }
      }
    });
  } else {
    // Flipkart alt images
    // Usually found in thumbnails with img tags inside gallery containers
    $('img.q6DClP, .LQLgPn img, ._3dqZ7f img').each((_, el) => {
      let src = $(el).attr('src');
      if (src) {
        // Flipkart thumbnail urls look like .../image/128/128/... replace with larger resolution (e.g. 832/832)
        src = src.replace(/\/image\/[0-9]+\/[0-9]+\//, '/image/832/832/');
        if (src.startsWith('http') && !sellerImages.includes(src)) {
          sellerImages.push(src);
        }
      }
    });
  }

  // If no alt images found, default to main page image
  if (sellerImages.length === 0) {
    let mainImg = '';
    for (const s of selectors.image) {
      const el = $(s).first();
      if (!el.length) continue;
      mainImg = el.attr('src') || el.attr('data-old-hires') || '';
      if (!mainImg) {
        const dynamic = el.attr('data-a-dynamic-image');
        if (dynamic) {
          try { mainImg = Object.keys(JSON.parse(dynamic))[0]; } catch { /* skip */ }
        }
      }
      if (mainImg && mainImg.startsWith('http')) {
        sellerImages.push(mainImg);
        break;
      }
    }
  }

  // --- Extract Buyer Review Images ---
  const buyerImages = [];
  if (platform === 'amazon') {
    // Handled in JS rendered section next, but let's grab from main html too if present
    $('img[src*="community-reviews"], img[class*="media-thumbnail-image"], [data-hook="review-image-tile"] img, [class*="review-image-container"] img').each((_, el) => {
      let src = $(el).attr('src');
      if (src) {
        src = src.split('?')[0].replace(/\._[A-Z0-9,_-]+\./i, '.');
        if (src.startsWith('http') && !buyerImages.includes(src)) {
          buyerImages.push(src);
        }
      }
    });
  } else {
    // Flipkart customer review images
    // Usually inside RmwVHL review thumbnails
    $('.RmwVHL img, ._1A1gfv img, img._396cs4').each((_, el) => {
      let src = $(el).attr('src');
      if (src && (src.includes('flipkart.com/blob') || src.includes('community-reviews') || src.includes('user-reviews'))) {
        src = src.replace(/\/image\/[0-9]+\/[0-9]+\//, '/image/832/832/');
        if (src.startsWith('http') && !buyerImages.includes(src)) {
          buyerImages.push(src);
        }
      }
    });
  }

  // --- Extract Customer Reviews text ---
  const reviews = [];

  if (platform === 'amazon') {
    // Amazon reviews require fetching a JS-rendered version of the product page
    const hasASIN = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
    if (hasASIN) {
      try {
        console.log(`[Scraper] Fetching JS-rendered Amazon page for customer reviews and review photos...`);
        const renderedHtml = await fetchHtml(url, true, 'amazon');
        const $r = cheerio.load(renderedHtml);

        // Extract reviews text
        $r(selectors.reviews.join(',')).each((_, el) => {
          const text = $r(el).text().trim();
          const isBoilerplate = /return|refund|warranty|delivery|policy|terms/i.test(text) && text.length < 100;
          const isAccessibility = /brief content visible|double tap to read|full content visible/i.test(text);
          if (text.length > 25 && !reviews.includes(text) && !isBoilerplate && !isAccessibility) {
            reviews.push(text);
          }
        });

        // Extract buyer images from JS-rendered page
        $r('img[src*="community-reviews"], img[class*="media-thumbnail-image"], [data-hook="review-image-tile"] img, [class*="review-image-container"] img').each((_, el) => {
          let src = $r(el).attr('src');
          if (src) {
            src = src.split('?')[0].replace(/\._[A-Z0-9,_-]+\./i, '.');
            if (src.startsWith('http') && !buyerImages.includes(src)) {
              buyerImages.push(src);
            }
          }
        });

        console.log(`[Scraper] Extracted ${reviews.length} reviews and ${buyerImages.length} buyer photos from Amazon rendered page`);
      } catch (err) {
        console.warn(`[Scraper] Amazon JS review render failed, falling back to static HTML: ${err.message}`);
      }
    }
  } else {
    // Flipkart reviews from the already JS-rendered main page
    $(selectors.reviews.join(',')).each((_, el) => {
      const text = $(el).text().trim();
      const isBoilerplate = /certified buyer|read more|helpful|report abuse/i.test(text) && text.length < 65;
      if (text.length > 25 && !reviews.includes(text) && !isBoilerplate) {
        reviews.push(text);
      }
    });
    console.log(`[Scraper] Extracted ${reviews.length} reviews from Flipkart rendered page`);

    // If still no reviews, fetch Flipkart's dedicated reviews page
    if (reviews.length === 0) {
      try {
        const reviewsPageUrl = url.includes('?') 
          ? url.split('?')[0] + '/reviews' 
          : url + '/reviews';
        console.log(`[Scraper] Fetching Flipkart reviews page: ${reviewsPageUrl}`);
        const reviewsHtml = await fetchHtml(reviewsPageUrl, true, 'flipkart');
        const $reviews = cheerio.load(reviewsHtml);

        $reviews(selectors.reviews.join(',')).each((_, el) => {
          const text = $reviews(el).text().trim();
          const isBoilerplate = /certified buyer|read more|helpful|report abuse/i.test(text) && text.length < 65;
          if (text.length > 25 && !reviews.includes(text) && !isBoilerplate) {
            reviews.push(text);
          }
        });

        // Check for review images on reviews sub-page
        $reviews('.RmwVHL img, ._1A1gfv img, img._396cs4').each((_, el) => {
          let src = $reviews(el).attr('src');
          if (src) {
            src = src.replace(/\/image\/[0-9]+\/[0-9]+\//, '/image/832/832/');
            if (src.startsWith('http') && !buyerImages.includes(src)) {
              buyerImages.push(src);
            }
          }
        });

        console.log(`[Scraper] Extracted ${reviews.length} reviews and ${buyerImages.length} buyer photos from Flipkart reviews sub-page`);
      } catch (err) {
        console.warn(`[Scraper] Flipkart reviews sub-page fetch failed: ${err.message}`);
      }
    }
  }

  // Final fallback — parse static reviews if empty
  if (reviews.length === 0) {
    $(selectors.reviews.join(',')).each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 25 && !reviews.includes(text)) {
        reviews.push(text);
      }
    });
    console.log(`[Scraper] Fallback extracted ${reviews.length} reviews`);
  }

  // Clean and prepare final product details
  const finalImage = sellerImages[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';
  const finalPrice = price || 'Price not displayed';
  const finalBrand = brand || title.split(' ')[0];

  return {
    productInfo: {
      title,
      price: finalPrice,
      image: finalImage,
      brand: finalBrand,
      platform: platform.charAt(0).toUpperCase() + platform.slice(1),
      sellerImages: sellerImages.slice(0, 5),
      buyerImages: buyerImages.slice(0, 5)
    },
    reviews: reviews.slice(0, 18) // Feed up to 18 reviews into Groq for richer context
  };
}
