import Groq from 'groq-sdk';

/**
 * Invokes the Groq API to analyze the scraped reviews and product info.
 * @param {object} productInfo 
 * @param {string[]} reviews 
 * @returns {Promise<object>}
 */
export async function analyzeProduct(productInfo, reviews) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in backend environment variables.');
  }

  const groq = new Groq({ apiKey });

  const hasReviews = reviews && reviews.length > 0;
  const reviewsContext = hasReviews
    ? reviews.map((r, i) => `Review ${i + 1}: "${r}"`).join('\n\n')
    : 'No customer reviews were extracted for this product.';

  const systemPrompt = `You are TruthBuy, an elite e-commerce data analyst and product auditor. 
Your job is to analyze the product details and customer reviews provided by the user, run a trust audit, and return a clean JSON analysis.

You MUST analyze:
1. **Product Trust Score (0-100)**: Calculate a score reflecting product reliability. Sentiment (60%), fake review flags (25%), and review consistency (15%). 
   - If there are no reviews, the Trust Score should reflect this high risk and be lower, with a note in the flags.
2. **Buy/Maybe/Avoid Rating**: 
   - "Buy" (Trust Score 80+)
   - "Maybe" (Trust Score 50-79)
   - "Avoid" (Trust Score 0-49)
3. **Sentiment Distribution**: Breakdown percentage of positive, neutral, and negative sentiment in the reviews (must sum up to exactly 100%).
4. **Fake Review Audit**: Scan reviews for artificial indicators:
   - Repetition of identical/similar phrases.
   - Excessive promotional, unnatural, or overly-branded language.
   - Extremely skewed rating distributions (e.g., all 5 stars with generic text).
   - Review patterns that feel automated.
   - Assess the "risk" level as "Low", "Medium", or "High", and list specific flags.
5. **Pros & Cons**: Extract the top 3-4 specific pros and cons from the text. Be concise, do not use generic bullets.
6. **Who Should Buy / Who Should Avoid**: Specific single-sentence customer profiles.
7. **Best Alternatives**: Suggest exactly 3 actual, real alternative products in the same category. For each alternative, provide:
   - Exact Title (e.g., "Sony WH-1000XM5")
   - Current typical Price (e.g., "₹29,990" or "$348")
   - Estimated Star Rating (1.0 to 5.0)
   - Estimated Trust Score (0 to 100)
   - Key Difference (e.g., "Active Noise Cancellation is slightly better but price is higher").

Return ONLY a valid JSON object matching the following structure:
{
  "trustScore": 85,
  "rating": "Buy",
  "sentiment": {
    "positive": 75,
    "neutral": 15,
    "negative": 10
  },
  "fakeReviewMetrics": {
    "risk": "Low",
    "flags": ["Minimal phrase repetition", "Natural user-written tone"]
  },
  "analysis": {
    "pros": [
      "Exceptional battery life exceeding 30 hours",
      "Very comfortable plush earcups for long sessions"
    ],
    "cons": [
      "No IP rating for sweat/water resistance",
      "Companion application requires full permissions"
    ],
    "whoShouldBuy": "Audiophiles who travel frequently and require active noise cancellation with long battery life.",
    "whoShouldAvoid": "Fitness users needing sweatproof earbuds or shoppers on a strict budget."
  },
  "alternatives": [
    {
      "title": "Sony WH-1000XM4",
      "price": "₹19,990",
      "rating": 4.6,
      "trustScore": 90,
      "keyDifference": "Older model with similar ANC, folds more compactly, and is considerably cheaper."
    },
    {
      "title": "Bose QuietComfort Ultra",
      "price": "₹32,900",
      "rating": 4.5,
      "trustScore": 84,
      "keyDifference": "Offers superior comfort and spatial audio, but with slightly worse battery life."
    },
    {
      "title": "Sennheiser Accentum",
      "price": "₹11,990",
      "rating": 4.2,
      "trustScore": 78,
      "keyDifference": "Outstanding sound quality at half the price, but build quality feels more plasticky."
    }
  ]
}

Ensure the output is pure JSON. Do not include markdown code block markers (\`\`\`json) or extra text.`;

  const userPrompt = `Product Details:
Title: ${productInfo.title}
Brand: ${productInfo.brand}
Price: ${productInfo.price}
Platform: ${productInfo.platform}

Reviews Scraped:
${reviewsContext}`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1500
    });

    const responseText = chatCompletion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error('Received empty response from Groq API.');
    }

    const data = JSON.parse(responseText);
    
    // Ensure numbers and valid structure
    data.trustScore = Math.min(100, Math.max(0, Number(data.trustScore) || 50));
    
    // Ensure sentiment adds up to 100%
    if (data.sentiment) {
      const pos = Number(data.sentiment.positive) || 0;
      const neu = Number(data.sentiment.neutral) || 0;
      const neg = Number(data.sentiment.negative) || 0;
      const total = pos + neu + neg;
      if (total > 0 && Math.abs(total - 100) > 1) {
        data.sentiment.positive = Math.round((pos / total) * 100);
        data.sentiment.neutral = Math.round((neu / total) * 100);
        data.sentiment.negative = 100 - data.sentiment.positive - data.sentiment.neutral;
      }
    }
    
    return data;
  } catch (error) {
    console.error('[Groq Analyzer] Error calling Groq API:', error);
    throw new Error(`AI Review analysis failed: ${error.message}`);
  }
}
