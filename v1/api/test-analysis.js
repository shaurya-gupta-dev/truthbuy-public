import dotenv from 'dotenv';
import { scrapeProduct } from './scraper.js';
import { analyzeProduct } from './analyzer.js';

dotenv.config();

// Default testing URL (iPhone 15 on Amazon India)
const TEST_URL = process.argv[2] || 'https://www.amazon.in/Apple-iPhone-15-128-GB/dp/B0CHX1W1Y1';

async function runTest() {
  console.log('==================================================');
  console.log(`Starting TruthBuy Backend Verification`);
  console.log(`Target URL: ${TEST_URL}`);
  console.log('==================================================');

  if (!process.env.GROQ_API_KEY) {
    console.error('ERROR: GROQ_API_KEY is not defined in .env file!');
    process.exit(1);
  }

  try {
    console.log('\n[Step 1] Initializing Scraping...');
    const scrapedData = await scrapeProduct(TEST_URL);
    console.log('Scraped Product Info:', JSON.stringify(scrapedData.productInfo, null, 2));
    console.log(`Scraped Reviews Count: ${scrapedData.reviews.length}`);
    if (scrapedData.reviews.length > 0) {
      console.log('First Scraped Review Snippet:', scrapedData.reviews[0].substring(0, 100) + '...');
    }

    console.log('\n[Step 2] Sending Reviews to Groq for Analysis...');
    const analysis = await analyzeProduct(scrapedData.productInfo, scrapedData.reviews);
    
    console.log('\n================ ANALYSIS RESULTS ================');
    console.log('Trust Score:', analysis.trustScore);
    console.log('Recommendation Rating:', analysis.rating);
    console.log('Sentiment Distribution:', JSON.stringify(analysis.sentiment, null, 2));
    console.log('Fake Review Risk metrics:', JSON.stringify(analysis.fakeReviewMetrics, null, 2));
    console.log('Pros:', analysis.analysis.pros);
    console.log('Cons:', analysis.analysis.cons);
    console.log('Who should buy:', analysis.analysis.whoShouldBuy);
    console.log('Who should avoid:', analysis.analysis.whoShouldAvoid);
    console.log('Alternatives Suggested:', analysis.alternatives.map(a => a.title).join(', '));
    console.log('==================================================');
    console.log('Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    process.exit(1);
  }
}

runTest();
