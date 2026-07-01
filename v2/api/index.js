import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { scrapeProduct, validateUrl } from './scraper.js';
import { analyzeProduct, compareProducts } from './analyzer.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Main analysis route
app.post('/api/analyze', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'Product URL is required.' });
  }

  const check = validateUrl(url);
  if (!check.isValid) {
    if (check.platform === 'flipkart') {
      return res.status(400).json({ 
        error: 'Flipkart support is temporarily disabled. TruthBuy V2 currently supports Amazon. Flipkart support is coming soon in V3!' 
      });
    }
    return res.status(400).json({ 
      error: 'Only Amazon product links are supported. Please paste a valid amazon.in or amazon.com product URL.' 
    });
  }
  
  try {
    console.log(`[API] Starting live scrape for: ${url}`);
    const scrapedData = await scrapeProduct(url);
    
    console.log(`[API] Sending ${scrapedData.reviews.length} reviews to Groq for analysis...`);
    const analysisData = await analyzeProduct(scrapedData.productInfo, scrapedData.reviews);
    
    // Combine results
    const responseData = {
      productInfo: scrapedData.productInfo,
      ...analysisData
    };
    
    console.log(`[API] Analysis completed successfully for: ${scrapedData.productInfo.title}`);
    res.json(responseData);
  } catch (error) {
    console.error(`[API] Analysis failed:`, error.message);
    res.status(500).json({ 
      error: error.message || 'An error occurred during product analysis.' 
    });
  }
});

// Compare two products endpoint
app.post('/api/compare', async (req, res) => {
  const { url1, url2 } = req.body;
  
  if (!url1 || !url2) {
    return res.status(400).json({ error: 'Both product URLs are required.' });
  }

  const check1 = validateUrl(url1);
  const check2 = validateUrl(url2);

  if (!check1.isValid || !check2.isValid) {
    if (check1.platform === 'flipkart' || check2.platform === 'flipkart') {
      return res.status(400).json({ 
        error: 'Flipkart support is temporarily disabled. TruthBuy V2 currently supports Amazon comparison matchups. Flipkart support is coming soon in V3!' 
      });
    }
    return res.status(400).json({ 
      error: 'Only Amazon product links are supported in this version. Please verify both URLs.' 
    });
  }

  try {
    console.log(`[API Compare] Concurrently scraping and analyzing both products...`);
    
    // Concurrently scrape and analyze both
    const [p1Scrape, p2Scrape] = await Promise.all([
      scrapeProduct(url1),
      scrapeProduct(url2)
    ]);

    const [p1Analysis, p2Analysis] = await Promise.all([
      analyzeProduct(p1Scrape.productInfo, p1Scrape.reviews),
      analyzeProduct(p2Scrape.productInfo, p2Scrape.reviews)
    ]);

    const p1Result = { 
      productInfo: p1Scrape.productInfo, 
      ...p1Analysis,
      reviews: p1Scrape.reviews
    };
    
    const p2Result = { 
      productInfo: p2Scrape.productInfo, 
      ...p2Analysis,
      reviews: p2Scrape.reviews
    };

    console.log(`[API Compare] Generating comparison AI verdict...`);
    const verdict = await compareProducts(p1Result, p2Result);

    console.log(`[API Compare] Comparison completed successfully.`);
    res.json({
      product1: p1Result,
      product2: p2Result,
      comparisonVerdict: verdict
    });
  } catch (error) {
    console.error(`[API Compare] Comparison failed:`, error.message);
    res.status(500).json({ 
      error: error.message || 'An error occurred during product comparison.' 
    });
  }
});

// Chat with reviews RAG endpoint
app.post('/api/chat', async (req, res) => {
  const { 
    productTitle, brand, price, platform,
    trustScore, rating, sentiment,
    pros, cons, riskFlags, buyingAdvice, alternatives,
    representativeQuotes, reviews,
    question, chatHistory,
    // Comparison parameters
    isCompare,
    product1,
    product2,
    comparisonVerdict
  } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured in backend environment variables.' });
  }

  if (isCompare) {
    if (!product1 || !product2 || !question) {
      return res.status(400).json({ error: 'Both products and question are required for comparison chat.' });
    }
  } else {
    if (!productTitle || !question) {
      return res.status(400).json({ error: 'Product title and question are required.' });
    }
  }

  try {
    const GroqSdk = (await import('groq-sdk')).default;
    const groq = new GroqSdk({ apiKey });

    let systemPrompt = '';

    if (isCompare) {
      // Comparison Shopping Advisor Prompt
      const compareContext = `
COMPARED PRODUCTS:
Product 1 (P1): ${product1.productInfo.title}
Brand: ${product1.productInfo.brand || 'Unknown'} | Price: ${product1.productInfo.price || 'Unknown'}
- Trust Score: ${product1.trustScore}% | Overall Rating: ${product1.rating}
- Pros: ${(product1.analysis?.pros || []).join(', ')}
- Cons: ${(product1.analysis?.cons || []).join(', ')}
- Buying Advice: ${product1.buyingAdvice || 'N/A'}

Product 2 (P2): ${product2.productInfo.title}
Brand: ${product2.productInfo.brand || 'Unknown'} | Price: ${product2.productInfo.price || 'Unknown'}
- Trust Score: ${product2.trustScore}% | Overall Rating: ${product2.rating}
- Pros: ${(product2.analysis?.pros || []).join(', ')}
- Cons: ${(product2.analysis?.cons || []).join(', ')}
- Buying Advice: ${product2.buyingAdvice || 'N/A'}

AI MATCHUP VERDICT SUMMARY:
${comparisonVerdict}

P1 REVIEWS SNIPPETS:
${(product1.reviews || []).slice(0, 5).map((r, i) => `[P1 Rev ${i+1}]: "${r}"`).join('\n')}

P2 REVIEWS SNIPPETS:
${(product2.reviews || []).slice(0, 5).map((r, i) => `[P2 Rev ${i+1}]: "${r}"`).join('\n')}`;

      systemPrompt = `You are TruthBuy Comparison Assistant — a sharp, friendly, and knowledgeable personal shopping advisor helping users choose between two products.

You have been given a side-by-side matchup audit details of two products (P1 and P2) along with representative reviews for both. Use all of this as your primary source of truth.

HOW TO ANSWER:
1. Objectively compare P1 and P2 based on their trust scores, ratings, pros/cons, and customer reviews.
2. If the user asks which is better for a specific use case (e.g., durability, comfort, budget, gaming), give a direct, reasoned recommendation.
3. If they ask about specs or features not covered in the data, reason from your own knowledge about these product categories and brands, but note clearly it's from general specifications (e.g., "P1 generally has a reputation for...").
4. Sound like a knowledgeable friend helping someone shop, not a generic robot. Keep it friendly, clear, and engaging.
5. Keep your answers concise: 2-5 sentences max, unless a detailed comparison is requested.
6. Give a confident, direct recommendation if asked to pick one.

MATCHUP CONTEXT:
${compareContext}`;
    } else {
      // Single Product Advisor Prompt
      const productContext = `
PRODUCT: ${productTitle}
Brand: ${brand || 'Unknown'} | Price: ${price || 'Unknown'} | Platform: ${platform || 'Amazon'}

AI AUDIT RESULTS:
- Trust Score: ${trustScore ?? 'N/A'}%
- Overall Rating: ${rating || 'N/A'}
- Sentiment: ${sentiment ? `${sentiment.positive}% positive, ${sentiment.neutral}% neutral, ${sentiment.negative}% negative` : 'N/A'}

PROS (from reviews):
${(pros || []).map(p => `• ${p}`).join('\n') || 'None extracted'}

CONS (from reviews):
${(cons || []).map(c => `• ${c}`).join('\n') || 'None extracted'}

RISK FLAGS:
${(riskFlags || []).map(f => `⚠ ${f}`).join('\n') || 'No major red flags detected'}

BUYING ADVICE: ${buyingAdvice || 'N/A'}

ALTERNATIVES: ${(alternatives || []).join(', ') || 'None suggested'}

REPRESENTATIVE CUSTOMER QUOTES:
${(representativeQuotes || []).map((q, i) => `[${i+1}] "${q}"`).join('\n') || 'None available'}

RAW CUSTOMER REVIEWS:
${(reviews || []).length > 0 
  ? reviews.map((r, i) => `[Review ${i+1}]: "${r}"`).join('\n')
  : 'No customer reviews available.'}`;

      systemPrompt = `You are TruthBuy Assistant — a sharp, friendly, and knowledgeable personal shopping advisor. You help users make confident buying decisions.

You have been given a complete product audit including AI analysis results, customer reviews, pros/cons, risk flags, sentiment data, and buying advice. Use all of this as your primary source of truth.

HOW TO ANSWER:
1. Use the product audit data and reviews as your PRIMARY context — cite them naturally when relevant ("customers noted...", "the audit flagged...", "2 reviewers mentioned...")
2. If the reviews or audit don't cover the question, use your own knowledge about this product category, brand, or general buying advice — briefly note it's from general knowledge (e.g. "From what I know about this brand...")
3. NEVER say "I don't know" or "no information found" — always give a helpful, reasoned answer
4. Sound like a real friend helping someone shop, not a corporate bot reading bullet points
5. Be direct and confident — give actual recommendations when asked
6. Keep it concise: 2-5 sentences max unless a detailed breakdown is genuinely needed
7. Be honest — if something is a red flag, say so clearly but kindly

PRODUCT CONTEXT:
${productContext}`;
    }

    const conversationHistory = Array.isArray(chatHistory) ? chatHistory : [];

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: question }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.55,
      max_tokens: 600
    });

    const answer = chatCompletion.choices[0]?.message?.content?.trim() || 'No response generated.';
    res.json({ answer });
  } catch (error) {
    console.error(`[API Chat] Chat failed:`, error.message);
    res.status(500).json({ error: 'AI Chat assistant encountered an error processing your question.' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', time: new Date() });
});

// Start listening if run locally
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`[Server] Express server running locally on http://localhost:${PORT}`);
  });
}

export default app;
