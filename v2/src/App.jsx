import React, { useState, useEffect, useRef } from 'react';

// ─── ImageGallery Component ───────────────────────────────────────────────────
function ImageGallery({ sellerImages = [], buyerImages = [] }) {
  const [tab, setTab] = useState('seller');
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  const images = tab === 'seller' ? sellerImages : buyerImages;
  const total = images.length;
  const hasBoth = sellerImages.length > 0 && buyerImages.length > 0;

  const startTimer = () => {
    clearInterval(timerRef.current);
    if (total > 1) {
      timerRef.current = setInterval(() => {
        setIndex(i => (i + 1) % total);
      }, 3500);
    }
  };

  // Start / restart slideshow when tab or total changes
  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [tab, total]);

  // Reset slide index when tab switches
  useEffect(() => { setIndex(0); }, [tab]);

  const prev = () => {
    setIndex(i => (i - 1 + total) % total);
    startTimer(); // restart timer so pause happens after manual nav
  };

  const next = () => {
    setIndex(i => (i + 1) % total);
    startTimer();
  };

  const switchTab = (t) => { setTab(t); };

  if (total === 0 && sellerImages.length === 0 && buyerImages.length === 0) return null;
  if (images.length === 0) return null;

  return (
    <section className="image-gallery-section">
      {hasBoth && (
        <div className="gallery-toggle-bar">
          <button
            className={`gallery-tab-btn ${tab === 'seller' ? 'active' : ''}`}
            onClick={() => switchTab('seller')}
          >
            📦 Seller Images
          </button>
          <button
            className={`gallery-tab-btn ${tab === 'buyer' ? 'active' : ''}`}
            onClick={() => switchTab('buyer')}
          >
            📸 Buyer Photos
          </button>
        </div>
      )}
      {!hasBoth && sellerImages.length > 0 && (
        <p className="gallery-solo-label">📦 Seller Images</p>
      )}
      {!hasBoth && buyerImages.length > 0 && (
        <p className="gallery-solo-label">📸 Buyer Photos</p>
      )}

      <div className="gallery-main-frame">
        <img
          key={`${tab}-${index}`}
          src={images[index]}
          alt={`${tab === 'seller' ? 'Seller' : 'Buyer'} image ${index + 1}`}
          className="gallery-main-img"
        />
        {total > 1 && (
          <>
            <button className="gallery-arrow gallery-arrow-left" onClick={prev} aria-label="Previous">&#8249;</button>
            <button className="gallery-arrow gallery-arrow-right" onClick={next} aria-label="Next">&#8250;</button>
            <div className="gallery-counter">{index + 1} / {total}</div>
          </>
        )}
      </div>
    </section>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = '/api/analyze';

const LOADING_STEPS = [
  'Validating product URL...',
  'Bypassing e-commerce bot shields...',
  'Scraping page elements...',
  'Extracting customer reviews...',
  'Connecting to Groq Llama AI...',
  'Running sentiment analysis...',
  'Auditing fake review patterns...',
  'Calculating trust score metrics...',
  'Generating recommendations...'
];

export default function App() {
  const [url, setUrl] = useState('');
  const [url2, setUrl2] = useState('');
  const [mode, setMode] = useState('single'); // 'single' or 'compare'
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [error, setError] = useState(null);

  // Chat states
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Dedicated chat history ref — tracks conversation context reliably.
  // Using a ref (not state) so it updates synchronously without React async batching issues.
  const chatHistoryRef = React.useRef([]);

  // History states
  const [historyList, setHistoryList] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Active comparison view tab
  const [activeCompareTab, setActiveCompareTab] = useState('verdict'); // 'verdict', 'p1', 'p2'

  // (gallery state removed — ImageGallery component manages its own state)

  // Load history on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('truthbuy_history');
      if (saved) {
        setHistoryList(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }, []);

  // Initialize chat when a new result is loaded
  useEffect(() => {
    if (result && !compareResult) {
      const score = result.trustScore;
      const rating = result.rating;
      setMessages([
        { sender: 'system', text: `Hey! I've done a full audit on this product — Trust Score is ${score}% and I'd rate it as "${rating}". Ask me anything: whether it's worth buying for your use case, how it compares, what customers actually said, or anything else on your mind!` }
      ]);
      // Reset conversation history for the new product
      chatHistoryRef.current = [];
    }
  }, [result, compareResult]);

  // Initialize comparison chat when a new matchup is loaded
  useEffect(() => {
    if (compareResult) {
      const p1Title = compareResult.product1.productInfo.title.substring(0, 36) + '...';
      const p2Title = compareResult.product2.productInfo.title.substring(0, 36) + '...';
      setMessages([
        { 
          sender: 'system', 
          text: `Hey! I've done a side-by-side audit of both products:\n\n1️⃣ P1: ${p1Title} (Score: ${compareResult.product1.trustScore}%)\n2️⃣ P2: ${p2Title} (Score: ${compareResult.product2.trustScore}%)\n\nAsk me anything! I can help you compare their pros/cons, specs, review complaints, or decide which one fits your needs best.` 
        }
      ]);
      // Reset conversation history for the new comparison
      chatHistoryRef.current = [];
    }
  }, [compareResult]);

  // Cycle through loading steps during analysis
  useEffect(() => {
    let interval;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const saveToHistory = (newAudit) => {
    setHistoryList(prev => {
      const filtered = prev.filter(item => item.url !== newAudit.url);
      const updated = [newAudit, ...filtered].slice(0, 15);
      localStorage.setItem('truthbuy_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setCompareResult(null);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze product. Please try again.');
      }

      setResult(data);
      // gallery state reset handled inside ImageGallery component

      // Save to cache
      saveToHistory({
        url,
        title: data.productInfo.title,
        price: data.productInfo.price,
        platform: data.productInfo.platform,
        image: data.productInfo.image,
        trustScore: data.trustScore,
        rating: data.rating,
        timestamp: Date.now(),
        result: data
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async (e) => {
    e.preventDefault();
    if (!url.trim() || !url2.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setCompareResult(null);

    const compareEndpoint = API_URL.replace('/analyze', '/compare');

    try {
      const response = await fetch(compareEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url1: url, url2: url2 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to compare products. Please check both links.');
      }

      setCompareResult(data);
      setActiveCompareTab('verdict');
      // gallery state reset handled inside ImageGallery component

      // Save both products to history individually
      saveToHistory({
        url,
        title: data.product1.productInfo.title,
        price: data.product1.productInfo.price,
        platform: data.product1.productInfo.platform,
        image: data.product1.productInfo.image,
        trustScore: data.product1.trustScore,
        rating: data.product1.rating,
        timestamp: Date.now(),
        result: data.product1
      });
      saveToHistory({
        url: url2,
        title: data.product2.productInfo.title,
        price: data.product2.productInfo.price,
        platform: data.product2.productInfo.platform,
        image: data.product2.productInfo.image,
        trustScore: data.product2.trustScore,
        rating: data.product2.rating,
        timestamp: Date.now(),
        result: data.product2
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    if (!result && !compareResult) return;

    const questionText = chatInput.trim();
    const userMsg = { sender: 'user', text: questionText };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    const historySnapshot = [...chatHistoryRef.current];
    const chatEndpoint = API_URL.replace('/analyze', '/chat');

    try {
      const payload = compareResult
        ? {
            isCompare: true,
            product1: compareResult.product1,
            product2: compareResult.product2,
            comparisonVerdict: compareResult.comparisonVerdict,
            question: questionText,
            chatHistory: historySnapshot,
          }
        : {
            productTitle: result.productInfo.title,
            brand: result.productInfo.brand,
            price: result.productInfo.price,
            platform: result.productInfo.platform,
            trustScore: result.trustScore,
            rating: result.rating,
            sentiment: result.sentiment,
            pros: result.analysis?.pros,
            cons: result.analysis?.cons,
            riskFlags: result.fakeReviewMetrics?.flags,
            buyingAdvice: result.buyingAdvice,
            alternatives: result.alternatives,
            representativeQuotes: result.representativeQuotes,
            reviews: result.reviews || [],
            question: questionText,
            chatHistory: historySnapshot,
          };

      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Chat failed.');
      }

      const assistantAnswer = data.answer;
      setMessages(prev => [...prev, { sender: 'assistant', text: assistantAnswer }]);

      chatHistoryRef.current = [
        ...historySnapshot,
        { role: 'user', content: questionText },
        { role: 'assistant', content: assistantAnswer },
      ];
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'assistant', text: `Sorry, I couldn't process your question: ${err.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDownloadCard = () => {
    if (!result) return;

    // Build Canvas share card
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    // Draw background
    ctx.fillStyle = '#F6F3EC'; // Cream
    ctx.fillRect(0, 0, 600, 400);

    // Draw border
    ctx.strokeStyle = '#B3986E'; // Gold border
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 590, 390);

    // Brand header
    ctx.fillStyle = '#2C2724';
    ctx.font = 'bold 24px Playfair Display, Georgia, serif';
    ctx.fillText('TruthBuy Review Audit', 40, 50);

    // Score Circle
    const scoreColor = result.trustScore >= 80 ? '#5B7B67' : (result.trustScore >= 50 ? '#D09954' : '#C26356');
    ctx.strokeStyle = '#EBE6DC';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(480, 160, 70, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.strokeStyle = scoreColor;
    ctx.beginPath();
    ctx.arc(480, 160, 70, -0.5 * Math.PI, (2 * (result.trustScore / 100) - 0.5) * Math.PI);
    ctx.stroke();

    // Score Text
    ctx.fillStyle = scoreColor;
    ctx.font = 'bold 44px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${result.trustScore}%`, 480, 175);

    // Recommendation Label
    ctx.fillStyle = '#2C2724';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText(`Recommendation: ${result.rating}`, 480, 270);

    // Product Metadata
    ctx.textAlign = 'left';
    ctx.fillStyle = '#746C66';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText(result.productInfo.brand.toUpperCase(), 40, 110);

    ctx.fillStyle = '#2C2724';
    ctx.font = 'bold 18px Inter, sans-serif';
    // Wrap product title to fit
    const titleText = result.productInfo.title;
    const words = titleText.split(' ');
    let line = '';
    let y = 140;
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      if (metrics.width > 340 && n > 0) {
        ctx.fillText(line, 40, y);
        line = words[n] + ' ';
        y += 24;
      } else {
        line = testLine;
      }
      if (y > 170) break; // truncate if too long
    }
    ctx.fillText(line, 40, y);

    // Pros
    ctx.fillStyle = '#5B7B67';
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('Key Strengths:', 40, 235);

    ctx.fillStyle = '#2C2724';
    ctx.font = '14px Inter, sans-serif';
    let py = 265;
    (result.analysis.pros || []).slice(0, 3).forEach(pro => {
      ctx.fillText(`✔ ${pro.substring(0, 42)}`, 40, py);
      py += 24;
    });

    // Brand URL
    ctx.fillStyle = '#746C66';
    ctx.font = 'italic 12px Inter, sans-serif';
    ctx.fillText('Audited at truthbuy.vercel.app', 40, 360);

    // Download trigger
    const link = document.createElement('a');
    link.download = `truthbuy-audit-${result.productInfo.title.substring(0, 15).replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--success)';
    if (score >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getRatingBadgeClass = (rating) => {
    if (rating === 'Buy') return 'badge-buy';
    if (rating === 'Maybe') return 'badge-maybe';
    return 'badge-avoid';
  };

  const clearHistory = () => {
    localStorage.removeItem('truthbuy_history');
    setHistoryList([]);
  };

  const loadHistoryItem = (item) => {
    setResult(item.result);
    setCompareResult(null);
    setUrl(item.url);
    setIsHistoryOpen(false);
  };

  // SVG Gauge calculations
  const radius = 50;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  const renderFullDetails = (prod) => {
    if (!prod) return null;
    return (
      <div className="product-full-details-wrapper">
        {/* Product Summary */}
        <section className="product-summary-card">
          <div className="product-visual">
            <img src={prod.productInfo.image} alt={prod.productInfo.title} className="product-thumb" />
          </div>
          <div className="product-details">
            <span className="brand-name">{prod.productInfo.brand}</span>
            <h2 className="product-title">{prod.productInfo.title}</h2>
            <div className="product-meta-row">
              <span className="price-tag">{prod.productInfo.price}</span>
              <span className={`recommend-badge ${getRatingBadgeClass(prod.rating)}`}>
                {prod.rating}
              </span>
            </div>
          </div>
        </section>

        {/* Image Gallery */}
        <ImageGallery
          sellerImages={prod.productInfo.sellerImages || []}
          buyerImages={prod.productInfo.buyerImages || []}
        />

        {/* Trust Score & Sentiment */}
        <section className="dashboard-grid">
          {/* Circular Gauge */}
          <div className="metric-card trust-gauge-card">
            <h3 className="card-heading">Trust Score</h3>
            <div className="gauge-wrapper">
              <svg height={radius * 2} width={radius * 2} className="svg-gauge">
                <circle stroke="#EBE6DC" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
                <circle stroke={getScoreColor(prod.trustScore)} fill="transparent" strokeWidth={stroke} strokeDasharray={circumference + ' ' + circumference} style={{ strokeDashoffset: circumference - (prod.trustScore / 100) * circumference }} strokeLinecap="round" r={normalizedRadius} cx={radius} cy={radius} />
              </svg>
              <div className="gauge-label" style={{ color: getScoreColor(prod.trustScore) }}>
                <span className="score-num">{prod.trustScore}</span>
                <span className="score-percent">%</span>
              </div>
            </div>
            <p className="gauge-status">
              This product is rated <strong style={{ color: getScoreColor(prod.trustScore) }}>{prod.rating}</strong>
            </p>
          </div>

          {/* Sentiment Split */}
          <div className="metric-card sentiment-card">
            <h3 className="card-heading">Review Sentiment</h3>
            <div className="sentiment-bar">
              <div className="bar-segment pos-seg" style={{ width: `${prod.sentiment.positive}%` }} title={`Positive: ${prod.sentiment.positive}%`}></div>
              <div className="bar-segment neu-seg" style={{ width: `${prod.sentiment.neutral}%` }} title={`Neutral: ${prod.sentiment.neutral}%`}></div>
              <div className="bar-segment neg-seg" style={{ width: `${prod.sentiment.negative}%` }} title={`Negative: ${prod.sentiment.negative}%`}></div>
            </div>
            <div className="sentiment-legend">
              <div className="legend-item"><span className="dot pos-dot"></span><span className="legend-label">Positive ({prod.sentiment.positive}%)</span></div>
              <div className="legend-item"><span className="dot neu-dot"></span><span className="legend-label">Neutral ({prod.sentiment.neutral}%)</span></div>
              <div className="legend-item"><span className="dot neg-dot"></span><span className="legend-label">Negative ({prod.sentiment.negative}%)</span></div>
            </div>
          </div>
        </section>

        {/* AI shopping verdict advice */}
        {prod.analysis.shoppingAdvice && (
          <section className="metric-card ai-verdict-card">
            <h3 className="card-heading text-primary">TruthBuy Verdict</h3>
            <p className="verdict-body">{prod.analysis.shoppingAdvice}</p>
          </section>
        )}

        {/* Fake Review Flags */}
        <section className="metric-card fake-audit-card">
          <h3 className="card-heading">Fake Review Risk</h3>
          <div className="audit-header">
            <span className={`risk-pill risk-${prod.fakeReviewMetrics.risk.toLowerCase()}`}>
              {prod.fakeReviewMetrics.risk} Risk
            </span>
            <p className="audit-subtitle">Identified patterns in writing structure and spikes.</p>
          </div>
          <ul className="audit-flags-list">
            {prod.fakeReviewMetrics.flags.map((flag, idx) => (
              <li key={idx} className="audit-flag-item">
                <span className="flag-bullet">✦</span> {flag}
              </li>
            ))}
          </ul>
        </section>

        {/* Pros and Cons */}
        <section className="pro-con-section">
          <div className="metric-card pro-card">
            <h3 className="card-heading text-success">Pros</h3>
            <ul className="pro-con-list">
              {prod.analysis.pros.map((pro, idx) => (
                <li key={idx} className="pro-item">✔ {pro}</li>
              ))}
            </ul>
          </div>
          <div className="metric-card con-card">
            <h3 className="card-heading text-danger">Cons</h3>
            <ul className="pro-con-list">
              {prod.analysis.cons.map((con, idx) => (
                <li key={idx} className="con-item">✖ {con}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Word on the Street (Representative reviews) */}
        {prod.representativeReviews && (
          <section className="metric-card representative-quotes-card">
            <h3 className="card-heading">Word on the Street</h3>
            <p className="quotes-subtitle">Real customer statements representing the general consensus.</p>
            <div className="quotes-stack">
              <div className="quote-item quote-pos">
                <div className="quote-badge badge-buy">Positive</div>
                <p className="quote-text">"{prod.representativeReviews.positive}"</p>
              </div>
              <div className="quote-item quote-neu">
                <div className="quote-badge badge-maybe">Neutral</div>
                <p className="quote-text">"{prod.representativeReviews.neutral}"</p>
              </div>
              <div className="quote-item quote-neg">
                <div className="quote-badge badge-avoid">Negative</div>
                <p className="quote-text">"{prod.representativeReviews.negative}"</p>
              </div>
            </div>
          </section>
        )}

        {/* Buying Advice */}
        <section className="metric-card advice-card">
          <h3 className="card-heading">AI Shopping Advice</h3>
          <div className="advice-block">
            <div className="advice-sub-block">
              <span className="advice-badge badge-buy">Who Should Buy</span>
              <p className="advice-text">{prod.analysis.whoShouldBuy}</p>
            </div>
            <div className="advice-sub-block mt-4">
              <span className="advice-badge badge-avoid">Who Should Avoid</span>
              <p className="advice-text">{prod.analysis.whoShouldAvoid}</p>
            </div>
          </div>
        </section>

        {/* Best Alternatives */}
        <section className="metric-card alternatives-section">
          <h3 className="card-heading">Best Alternatives</h3>
          <div className="alternatives-carousel">
            {prod.alternatives.map((alt, idx) => (
              <div key={idx} className="alt-card">
                <div className="alt-header">
                  <span className="alt-title">{alt.title}</span>
                  <span className="alt-price">{alt.price}</span>
                </div>
                <div className="alt-meta">
                  <span className="alt-stat">⭐ {alt.rating}</span>
                  <span className="alt-stat font-bold" style={{ color: getScoreColor(alt.trustScore) }}>
                    {alt.trustScore}% Trust
                  </span>
                </div>
                <p className="alt-diff">{alt.keyDifference}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* Search & Compare Input Screen */}
      {!loading && !result && !compareResult && (
        <div className="screen fade-in">
          <header className="landing-header">
            <div className="header-top-row">
              <div className="logo-badge">TB</div>
              <button className="btn-history-modal-trigger" onClick={() => setIsHistoryOpen(true)}>
                🕒 History ({historyList.length})
              </button>
            </div>
            <h1 className="brand-title">TruthBuy</h1>
            <p className="brand-subtitle">Paste Amazon product links to audit actual review integrity instantly.</p>

            <div className="mode-toggle-container">
              <button 
                className={`mode-toggle-btn ${mode === 'single' ? 'active' : ''}`}
                onClick={() => { setMode('single'); setError(null); }}
              >
                Single Audit
              </button>
              <button 
                className={`mode-toggle-btn ${mode === 'compare' ? 'active' : ''}`}
                onClick={() => { setMode('compare'); setError(null); }}
              >
                Compare Products
              </button>
            </div>
          </header>

          <main className="search-box-container">
            {mode === 'single' ? (
              <form onSubmit={handleAnalyze} className="search-form">
                <div className="input-group">
                  <input
                    type="url"
                    placeholder="Paste an Amazon product link..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    className="url-input"
                  />
                  <label className="url-label">Product Link</label>
                </div>

                {error && (
                  <div className="error-card">
                    <div className="error-icon">⚠️</div>
                    <div className="error-text">{error}</div>
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={!url.trim()}>
                  Analyze Product
                </button>
              </form>
            ) : (
              <form onSubmit={handleCompare} className="search-form">
                <div className="input-group">
                  <input
                    type="url"
                    placeholder="Paste first Amazon link..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    className="url-input"
                  />
                  <label className="url-label">First Product Link</label>
                </div>

                <div className="input-group">
                  <input
                    type="url"
                    placeholder="Paste second Amazon link..."
                    value={url2}
                    onChange={(e) => setUrl2(e.target.value)}
                    required
                    className="url-input"
                  />
                  <label className="url-label">Second Product Link</label>
                </div>

                {error && (
                  <div className="error-card">
                    <div className="error-icon">⚠️</div>
                    <div className="error-text">{error}</div>
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={!url.trim() || !url2.trim()}>
                  Compare Products
                </button>
              </form>
            )}

            <div className="features-highlight">
              <div className="feature-item">
                <span className="feature-icon">🛡️</span>
                <span className="feature-text">AI Review Audit</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🤖</span>
                <span className="feature-text">Fake Detection</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">💬</span>
                <span className="feature-text">RAG Review Chat</span>
              </div>
            </div>
            
            <footer className="footer-supported">
              ✦ Support for Amazon listings (Flipkart support coming soon)
            </footer>
          </main>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="screen loading-screen fade-in">
          <div className="loader-box">
            <div className="spinner-ring">
              <div className="spinner-dot"></div>
            </div>
            <h3 className="loading-title">Analyzing Review Integrity</h3>
            <p className="loading-step-text">{LOADING_STEPS[loadingStep]}</p>
          </div>
        </div>
      )}

      {/* Result Dashboard State */}
      {!loading && result && !compareResult && (
        <div className="screen result-screen fade-in">
          {/* Dashboard Header */}
          <header className="dashboard-header">
            <button className="btn-back" onClick={() => { setResult(null); setUrl(''); }}>
              ← Search
            </button>
            <div className="header-meta">
              <button className="btn-share-report" onClick={handleDownloadCard}>
                📥 Share Report
              </button>
              <span className="platform-pill">{result.productInfo.platform}</span>
            </div>
          </header>

          {renderFullDetails(result)}

          {/* Sticky Expandable Chat Trigger */}
          <button 
            className="chat-toggle-sticky-btn" 
            onClick={() => setIsChatOpen(true)}
          >
            💬 Chat with Reviews
          </button>
        </div>
      )}

      {isChatOpen && (result || compareResult) && (
        <div className="chat-modal-overlay fade-in">
          <div className="chat-modal-box">
            <header className="chat-modal-header">
              <div className="chat-header-title">
                <span className="chat-logo-icon">💬</span>
                <div>
                  <h4>{compareResult ? 'TruthBuy Matchup Assistant' : 'TruthBuy Review Assistant'}</h4>
                  <span className="chat-product-sub">
                    {compareResult 
                      ? `Comparing: ${compareResult.product1.productInfo.brand} vs ${compareResult.product2.productInfo.brand}` 
                      : result.productInfo.title.substring(0, 36) + '...'}
                  </span>
                </div>
              </div>
              <button className="chat-close-btn" onClick={() => setIsChatOpen(false)}>×</button>
            </header>

            <main className="chat-messages-container">
              {messages.map((m, idx) => (
                <div key={idx} className={`message-bubble-wrapper ${m.sender}`}>
                  <div className="message-bubble">
                    <p>{m.text}</p>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="message-bubble-wrapper assistant">
                  <div className="message-bubble typing">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                </div>
              )}
            </main>

            <footer className="chat-modal-footer">
              <form onSubmit={handleSendMessage} className="chat-form-input">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about battery, quality, mic..."
                  required
                />
                <button type="submit" disabled={isChatLoading || !chatInput.trim()}>Send</button>
              </form>
            </footer>
          </div>
        </div>
      )}

      {/* Compare Dashboard State */}
      {!loading && compareResult && (
        <div className="screen result-screen compare-screen fade-in">
          {/* Back to search */}
          <header className="dashboard-header">
            <button className="btn-back" onClick={() => { setCompareResult(null); setUrl(''); setUrl2(''); }}>
              ← Search
            </button>
            <div className="header-meta">
              <span className="platform-pill">Product Matchup</span>
            </div>
          </header>

          {/* Tab selector for Mobile aspect ratio */}
          <div className="compare-tab-bar">
            <button 
              className={`compare-tab-btn ${activeCompareTab === 'verdict' ? 'active' : ''}`}
              onClick={() => setActiveCompareTab('verdict')}
            >
              Verdict
            </button>
            <button 
              className={`compare-tab-btn ${activeCompareTab === 'p1' ? 'active' : ''}`}
              onClick={() => {
                setActiveCompareTab('p1');
                setResult(compareResult.product1);
              }}
            >
              Product 1
            </button>
            <button 
              className={`compare-tab-btn ${activeCompareTab === 'p2' ? 'active' : ''}`}
              onClick={() => {
                setActiveCompareTab('p2');
                setResult(compareResult.product2);
              }}
            >
              Product 2
            </button>
          </div>

          {/* Verdict Tab View */}
          {activeCompareTab === 'verdict' && (
            <div className="compare-verdict-view fade-in">
              {/* Matchup Summary cards */}
              <div className="matchup-row">
                <div className="matchup-product-card">
                  <img src={compareResult.product1.productInfo.image} alt={compareResult.product1.productInfo.title} />
                  <h4 className="matchup-p-title">{compareResult.product1.productInfo.title.substring(0, 36)}...</h4>
                  <div className="matchup-p-price">{compareResult.product1.productInfo.price}</div>
                  
                  <div className="matchup-score-block">
                    <span 
                      className="matchup-score-badge" 
                      style={{ backgroundColor: getScoreColor(compareResult.product1.trustScore) }}
                    >
                      {compareResult.product1.trustScore}%
                    </span>
                    <span className="matchup-rating-text">{compareResult.product1.rating}</span>
                  </div>
                </div>

                <div className="matchup-vs">VS</div>

                <div className="matchup-product-card">
                  <img src={compareResult.product2.productInfo.image} alt={compareResult.product2.productInfo.title} />
                  <h4 className="matchup-p-title">{compareResult.product2.productInfo.title.substring(0, 36)}...</h4>
                  <div className="matchup-p-price">{compareResult.product2.productInfo.price}</div>
                  
                  <div className="matchup-score-block">
                    <span 
                      className="matchup-score-badge" 
                      style={{ backgroundColor: getScoreColor(compareResult.product2.trustScore) }}
                    >
                      {compareResult.product2.trustScore}%
                    </span>
                    <span className="matchup-rating-text">{compareResult.product2.rating}</span>
                  </div>
                </div>
              </div>

              {/* Comparison AI Verdict block */}
              <div className="metric-card ai-compare-verdict-card mt-6">
                <h3 className="card-heading text-primary">AI Matchup Verdict</h3>
                <p className="verdict-body">{compareResult.comparisonVerdict}</p>
              </div>

              {/* Quick side-by-side spec comparison table */}
              <div className="metric-card compare-specs-card mt-4">
                <h3 className="card-heading">Head-to-Head Comparison</h3>
                <table className="compare-specs-table">
                  <thead>
                    <tr>
                      <th>Factor</th>
                      <th>Product 1</th>
                      <th>Product 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Trust Score</td>
                      <td style={{ color: getScoreColor(compareResult.product1.trustScore), fontWeight: 'bold' }}>
                        {compareResult.product1.trustScore}%
                      </td>
                      <td style={{ color: getScoreColor(compareResult.product2.trustScore), fontWeight: 'bold' }}>
                        {compareResult.product2.trustScore}%
                      </td>
                    </tr>
                    <tr>
                      <td>Verdict</td>
                      <td>{compareResult.product1.rating}</td>
                      <td>{compareResult.product2.rating}</td>
                    </tr>
                    <tr>
                      <td>Price</td>
                      <td>{compareResult.product1.productInfo.price}</td>
                      <td>{compareResult.product2.productInfo.price}</td>
                    </tr>
                    <tr>
                      <td>Fake Review Risk</td>
                      <td>{compareResult.product1.fakeReviewMetrics.risk}</td>
                      <td>{compareResult.product2.fakeReviewMetrics.risk}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Product 1 View */}
          {activeCompareTab === 'p1' && (
            <div className="compare-subproduct-view fade-in">
              {renderFullDetails(compareResult.product1)}
            </div>
          )}

          {/* Sub-Product 2 View */}
          {activeCompareTab === 'p2' && (
            <div className="compare-subproduct-view fade-in">
              {renderFullDetails(compareResult.product2)}
            </div>
          )}
          {/* Sticky Expandable Chat Trigger inside Compare Dashboard - Verdict tab only */}
          {activeCompareTab === 'verdict' && (
            <button 
              className="chat-toggle-sticky-btn" 
              onClick={() => setIsChatOpen(true)}
            >
              💬 Chat with Matchup AI
            </button>
          )}
        </div>
      )}


      {/* Local History Modal Drawer popup */}
      {isHistoryOpen && (
        <div className="history-modal-overlay fade-in">
          <div className="history-modal-box">
            <header className="history-modal-header">
              <h3 className="history-title">🕒 Audit History</h3>
              <button className="history-close-btn" onClick={() => setIsHistoryOpen(false)}>×</button>
            </header>

            <main className="history-items-container">
              {historyList.length === 0 ? (
                <div className="history-empty-state">
                  <span className="empty-icon">📁</span>
                  <p>Your search history is empty. Analyze some product links to cache them here!</p>
                </div>
              ) : (
                <div className="history-list-stack">
                  {historyList.map((item, idx) => (
                    <div key={idx} className="history-list-item" onClick={() => loadHistoryItem(item)}>
                      <img src={item.image} alt={item.title} className="history-item-thumb" />
                      <div className="history-item-details">
                        <span className="history-item-platform">{item.platform}</span>
                        <h4 className="history-item-title">{item.title}</h4>
                        <div className="history-item-meta">
                          <span className="history-item-price">{item.price}</span>
                          <span 
                            className="history-item-score"
                            style={{ color: getScoreColor(item.trustScore) }}
                          >
                            Score: {item.trustScore}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </main>

            {historyList.length > 0 && (
              <footer className="history-modal-footer">
                <button className="btn-clear-history" onClick={clearHistory}>
                  🗑️ Clear All History
                </button>
              </footer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
