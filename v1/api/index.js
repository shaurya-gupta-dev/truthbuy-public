import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { scrapeProduct, validateUrl } from './scraper.js';
import { analyzeProduct } from './analyzer.js';

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
  
  const { isValid } = validateUrl(url);
  if (!isValid) {
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
