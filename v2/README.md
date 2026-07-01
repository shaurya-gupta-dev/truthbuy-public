# TruthBuy 🛡️

**Shop smarter. Cut through fake reviews. Know the truth before you buy.**

TruthBuy is an AI-powered product trust analyzer. Paste any Amazon product link and get an instant, real analysis — trust score, sentiment breakdown, fake review detection, pros & cons, and smarter alternatives. No fluff, no paid placements. Just truth.

---

## What it does

- **🛡️ AI Review Audit** — Groq Llama AI reads and interprets customer reviews
- **🤖 Fake Review Detection** — Identifies suspicious patterns, repeated phrases, and paid review signals
- **⭐ Trust Score (0–100)** — A single number that tells you whether to Buy, Consider, or Avoid
- **📊 Sentiment Analysis** — Positive / Neutral / Negative breakdown with visual indicators
- **✅ Pros & Cons** — Extracted directly from real buyer experiences
- **🔄 Smart Alternatives** — 3 comparable products when the analyzed one underperforms

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 |
| Backend | Node.js + Express (Vercel serverless) |
| Scraping | ScraperAPI (JS rendering) + Cheerio |
| AI Engine | Groq API (Llama 3.3 70B) |
| Deployment | Vercel |

---

## Getting Started

### 1. Clone & install
```bash
git clone https://github.com/your-username/truthbuy.git
cd truthbuy
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` and add your keys:
- **GROQ_API_KEY** — Get free at [console.groq.com](https://console.groq.com)
- **SCRAPER_API_KEY** — Get free (5,000 req/month) at [scraperapi.com](https://www.scraperapi.com)

### 3. Run locally
```bash
npm run dev:all
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

---

## Deploy to Vercel

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add environment variables (`GROQ_API_KEY`, `SCRAPER_API_KEY`) in Vercel's project settings
4. Deploy — it's ready

---

## Supported Platforms

| Platform | Status |
|---|---|
| Amazon.in | ✅ Live |
| Amazon.com | ✅ Live |
| Flipkart | 🔜 Coming in V2 |

---

## Roadmap

- **V1 (current)** — Amazon analysis, trust scoring, fake review detection
- **V2** — Flipkart support, user history, comparison mode, browser extension

---

*Built with ❤️ — No mock data. No fake scores. Just truth.*
