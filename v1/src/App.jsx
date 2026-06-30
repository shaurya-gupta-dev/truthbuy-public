import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.DEV ? 'http://localhost:5000/api/analyze' : '/api/analyze';

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
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

  // SVG Gauge calculations
  const radius = 50;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  return (
    <div className="app-container">
      {/* Search Input State */}
      {!loading && !result && (
        <div className="screen fade-in">
          <header className="landing-header">
            <div className="logo-badge">TB</div>
            <h1 className="brand-title">TruthBuy</h1>
            <p className="brand-subtitle">Shop with absolute trust. paste a link and we reveal the real rating.</p>
          </header>

          <main className="search-box-container">
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

            <div className="features-highlight">
              <div className="feature-item">
                <span className="feature-icon">🛡️</span>
                <span className="feature-text">AI Review Audit</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🤖</span>
                <span className="feature-text">Fake Review Detection</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">⭐</span>
                <span className="feature-text">Real Trust Score</span>
              </div>
            </div>
            
            <footer className="footer-supported">
              ✦ Supports all Amazon marketplaces · Flipkart coming soon
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
      {!loading && result && (
        <div className="screen result-screen fade-in">
          {/* Dashboard Header */}
          <header className="dashboard-header">
            <button className="btn-back" onClick={() => { setResult(null); setUrl(''); }}>
              ← Search
            </button>
            <div className="header-meta">
              <span className="platform-pill">{result.productInfo.platform}</span>
            </div>
          </header>

          {/* Product Summary */}
          <section className="product-summary-card">
            <div className="product-visual">
              <img src={result.productInfo.image} alt={result.productInfo.title} className="product-thumb" />
            </div>
            <div className="product-details">
              <span className="brand-name">{result.productInfo.brand}</span>
              <h2 className="product-title">{result.productInfo.title}</h2>
              <div className="product-meta-row">
                <span className="price-tag">{result.productInfo.price}</span>
                <span className={`recommend-badge ${getRatingBadgeClass(result.rating)}`}>
                  {result.rating}
                </span>
              </div>
            </div>
          </section>

          {/* Trust Score & Sentiment */}
          <section className="dashboard-grid">
            {/* Circular Gauge */}
            <div className="metric-card trust-gauge-card">
              <h3 className="card-heading">Trust Score</h3>
              <div className="gauge-wrapper">
                <svg height={radius * 2} width={radius * 2} className="svg-gauge">
                  <circle
                    stroke="#EBE6DC"
                    fill="transparent"
                    strokeWidth={stroke}
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                  />
                  <circle
                    stroke={getScoreColor(result.trustScore)}
                    fill="transparent"
                    strokeWidth={stroke}
                    strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset: circumference - (result.trustScore / 100) * circumference }}
                    strokeLinecap="round"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                  />
                </svg>
                <div className="gauge-label" style={{ color: getScoreColor(result.trustScore) }}>
                  <span className="score-num">{result.trustScore}</span>
                  <span className="score-percent">%</span>
                </div>
              </div>
              <p className="gauge-status">
                This product is rated <strong style={{ color: getScoreColor(result.trustScore) }}>{result.rating}</strong>
              </p>
            </div>

            {/* Sentiment Split */}
            <div className="metric-card sentiment-card">
              <h3 className="card-heading">Review Sentiment</h3>
              <div className="sentiment-bar">
                <div 
                  className="bar-segment pos-seg" 
                  style={{ width: `${result.sentiment.positive}%` }}
                  title={`Positive: ${result.sentiment.positive}%`}
                ></div>
                <div 
                  className="bar-segment neu-seg" 
                  style={{ width: `${result.sentiment.neutral}%` }}
                  title={`Neutral: ${result.sentiment.neutral}%`}
                ></div>
                <div 
                  className="bar-segment neg-seg" 
                  style={{ width: `${result.sentiment.negative}%` }}
                  title={`Negative: ${result.sentiment.negative}%`}
                ></div>
              </div>
              <div className="sentiment-legend">
                <div className="legend-item">
                  <span className="dot pos-dot"></span>
                  <span className="legend-label">Positive ({result.sentiment.positive}%)</span>
                </div>
                <div className="legend-item">
                  <span className="dot neu-dot"></span>
                  <span className="legend-label">Neutral ({result.sentiment.neutral}%)</span>
                </div>
                <div className="legend-item">
                  <span className="dot neg-dot"></span>
                  <span className="legend-label">Negative ({result.sentiment.negative}%)</span>
                </div>
              </div>
            </div>
          </section>

          {/* Fake Review Flags */}
          <section className="metric-card fake-audit-card">
            <h3 className="card-heading">Fake Review Risk</h3>
            <div className="audit-header">
              <span className={`risk-pill risk-${result.fakeReviewMetrics.risk.toLowerCase()}`}>
                {result.fakeReviewMetrics.risk} Risk
              </span>
              <p className="audit-subtitle">Identified patterns in writing structure and spikes.</p>
            </div>
            <ul className="audit-flags-list">
              {result.fakeReviewMetrics.flags.map((flag, idx) => (
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
                {result.analysis.pros.map((pro, idx) => (
                  <li key={idx} className="pro-item">✔ {pro}</li>
                ))}
              </ul>
            </div>
            <div className="metric-card con-card">
              <h3 className="card-heading text-danger">Cons</h3>
              <ul className="pro-con-list">
                {result.analysis.cons.map((con, idx) => (
                  <li key={idx} className="con-item">✖ {con}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* Buying Advice */}
          <section className="metric-card advice-card">
            <h3 className="card-heading">AI Shopping Advice</h3>
            <div className="advice-block">
              <div className="advice-sub-block">
                <span className="advice-badge badge-buy">Who Should Buy</span>
                <p className="advice-text">{result.analysis.whoShouldBuy}</p>
              </div>
              <div className="advice-sub-block mt-4">
                <span className="advice-badge badge-avoid">Who Should Avoid</span>
                <p className="advice-text">{result.analysis.whoShouldAvoid}</p>
              </div>
            </div>
          </section>

          {/* Best Alternatives */}
          <section className="metric-card alternatives-section">
            <h3 className="card-heading">Best Alternatives</h3>
            <div className="alternatives-carousel">
              {result.alternatives.map((alt, idx) => (
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
      )}
    </div>
  );
}
