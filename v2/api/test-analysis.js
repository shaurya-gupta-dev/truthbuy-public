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
    console.log('AI Shopping Advice:', analysis.analysis.shoppingAdvice);
    console.log('Representative Quotes:', JSON.stringify(analysis.representativeReviews, null, 2));
    console.log('Alternatives Suggested:', analysis.alternatives.map(a => a.title).join(', '));
    console.log('==================================================');

    // Simulate a chat interaction to test RAG chat logic
    console.log('\n[Step 3] Verifying RAG Chat Pipeline...');
    const testQuestion = 'How is the battery life of this product?';
    console.log(`Sending question: "${testQuestion}"`);
    
    try {
      const chatResponse = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productTitle: scrapedData.productInfo.title,
          reviews: scrapedData.reviews,
          question: testQuestion,
          messages: []
        })
      });
      
      if (chatResponse.ok) {
        const chatData = await chatResponse.json();
        console.log('Chat Response:', chatData.answer);
      } else {
        throw new Error(`Server returned status ${chatResponse.status}`);
      }
    } catch (err) {
      console.warn(`RAG Chat fetch failed (${err.message}). Testing locally direct...`);
      // Invoke local RAG completion directly if server not running
      const GroqSdk = (await import('groq-sdk')).default;
      const groq = new GroqSdk({ apiKey: process.env.GROQ_API_KEY });
      
      const reviewsContext = scrapedData.reviews.length > 0
        ? scrapedData.reviews.map((r, i) => `[Review ${i + 1}]: "${r}"`).join('\n')
        : 'No reviews';

      const systemPrompt = `You are TruthBuy Chat, an elite AI product shopping assistant.
Answer the user's question about the product "${scrapedData.productInfo.title}" based STRICTLY on the reviews provided.
Keep it short (2-3 sentences).

Reviews:
${reviewsContext}`;

      const comp = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: testQuestion }
        ],
        model: 'llama-3.3-70b-versatile',
        max_tokens: 200
      });
      console.log('Direct local RAG output:', comp.choices[0].message.content.trim());
    }
    console.log('Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    process.exit(1);
  }
}

runTest();
