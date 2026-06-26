<div align="center">

[🇬🇧 English](README.md) · **🇷🇺 Русский**: [README.ru.md](README.ru.md)

# 🛸 Cyber-Quant Signal Bot

### Visual no-code builder for crypto trading strategies, backtesting & automated bots

Design algorithmic trading strategies by connecting blocks on an infinite canvas —
indicators, Smart Money Concepts, order-flow, AI risk filters, and real execution —
then backtest, optimize, and deploy them as standalone bots.

[Features](#-features) · [Quick Start](#-quick-start) · [Architecture](#-architecture) · [Roadmap](#-roadmap) · [License](#-license)

</div>

---

> ⚠️ **Disclaimer — not financial advice.** This software can place real orders on live
> exchanges. Trading crypto derivatives carries substantial risk of loss. Use **paper
> trading** first, never risk money you can't afford to lose, and review every strategy
> before going live. The authors accept no liability for financial losses.

---

## ✨ Features

Build a full trading pipeline — from data in to order out — visually, with **45+ node types**:

- **📥 Data & exchanges** — multi-exchange via CCXT (Binance, Bybit, OKX, MEXC, Kraken…),
  OHLCV + order-book streams, volume/volatility scanners, Polymarket whale tracking, Finviz (US stocks).
- **📈 Technical analysis** — RSI, MACD, Bollinger, ATR, SMA/EMA, Stochastic, automatic
  divergence detection, multi-timeframe (MTF) filtering, math-expression nodes.
- **🏛 Smart Money Concepts** — Fair Value Gaps, Order Blocks, BOS/CHoCH, Liquidity Sweeps,
  Daily Bias & Killzones.
- **📊 Order flow** — Volume Delta / CVD, order-book wall distance, Deribit Put/Call ratio.
- **🧠 AI layer** — Kronos time-series forecasting, an LLM risk filter (Hermes) that returns
  PASS/BLOCK with a confidence score, Local Deep Research for fundamental risk, and
  sentiment/ML filters.
- **💸 Execution & risk** — Market/Limit orders, TWAP/VWAP, server-side OCO bracket orders,
  ATR-adaptive grid bots, Risk Guard (drawdown/exposure control), paper trading.
- **🔬 Test & optimize** — full backtester, genetic parameter optimizer, visual execution-trail debugger.
- **🚀 Deploy** — compile any strategy to a standalone Python + FastAPI bot in a Docker
  container; manage a fleet of bots with a Panic Stop.
- **🔌 Extras** — PineScript v3–v6 importer (paste TradingView code → get a node graph,
  with quality report and coverage feedback), TradingView-style charts, bilingual UI (EN/RU),
  URL-based navigation (React Router), searchable node palette (140+ blocks).

## 🚀 Quick Start

> **Requirements:** [Docker Desktop](https://www.docker.com/products/docker-desktop/).
> For the full AI stack you'll also want an NVIDIA GPU (Kronos) or an OpenAI-compatible LLM
> API (LM Studio, DeepSeek, etc.) for Hermes. The core platform runs without them.

```bash
git clone <your-repo-url> signal-bot
cd signal-bot
cp .env.example .env        # add your exchange / Telegram keys (optional to start)
docker compose up -d
```

Then open:

| Service          | URL                          |
|------------------|------------------------------|
| Web app          | http://localhost             |
| Backend API      | http://localhost:3000/api    |
| Kronos AI        | http://localhost:8070        |
| FreeLLMAPI       | http://localhost:3456        |

> 💡 Start with **paper trading** and the built-in strategy templates — no API keys needed
> to explore the builder and backtester.

## 🏗 Architecture

```
React + ReactFlow canvas  ─►  NestJS API (CCXT, signals engine, backtest, optimizer)
                                  │
                                  ├─ PostgreSQL  (strategies, signals, candles)
                                  ├─ Redis + Bull (cache, queues, pub/sub)
                                  ├─ Kronos        — time-series forecasting (GPU)
                                  ├─ Hermes        — LLM risk filter (OpenAI-compatible)
                                  ├─ FreeLLMAPI    — free-tier LLM aggregator (optional)
                                  └─ LDR + SearXNG — fundamental deep research
```

- **Frontend:** React 18, TypeScript, Vite, Zustand, React Router v7, ReactFlow 11,
  Lightweight Charts, CSS design tokens, ARIA accessibility.
- **Backend:** NestJS, TypeORM, PostgreSQL, Redis + Bull, CCXT — 26 modules
  (signals engine, backtest, optimizer, orders, paper-trading, risk, fleet, codegen, …).
- **AI:** Kronos (time-series forecasting), Hermes (LLM risk filter — supports OpenAI-compatible
  APIs: LM Studio, DeepSeek, Ollama), Local Deep Research, sentiment & ML filters.

## 🗺 Roadmap

- [x] AST logic validation (Z3 SMT solver catches impossible conditions like `RSI > 70 AND RSI < 30`)
- [x] PineScript v3–v6 importer with quality report and pine_block fallback nodes
- [x] React Router navigation (shareable URLs, browser back/forward)
- [x] Searchable node palette with category filtering (140+ blocks)
- [x] ARIA accessibility & keyboard navigation
- [x] Dynamic Top-50 relative-volume scanner (adaptive to market regime)
- [x] Sandbox that test-runs generated Python bots before download
- [ ] Strategy marketplace — share strategies, earn rating, get subscription discounts
- [ ] Hosted cloud version (one-click, no setup)

## 🙏 Acknowledgements

This project integrates third-party open-source components and services:

### AI & Research
- **[Kronos](https://huggingface.co/NeoQuasar)** by NeoQuasar — time-series forecasting
  model. Architecture code is included with attribution (see [`kronos/NOTICE.md`](kronos/NOTICE.md));
  weights are downloaded at runtime from Hugging Face.
- **Hermes AI risk filter** — built-in LLM-based risk filter node. Supports any
  OpenAI-compatible API (LM Studio, DeepSeek, Ollama, etc.) via environment variables.
  Configure `HERMES_PROVIDER`, `HERMES_API_URL`, `HERMES_MODEL` in `.env`.
- **[FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi)** — free-tier LLM aggregator
  proxy. Combines 16+ providers (Gemini, Groq, Mistral, etc.) behind one OpenAI-compatible
  endpoint. Included as an optional Docker service (port 3456).
- **[Local Deep Research](https://github.com/LearningCircuit/local-deep-research)** —
  AI-powered fundamental research agent. Used as an external Docker image for the LDR node.
- **[SearXNG](https://github.com/searxng/searxng)** — privacy-first metasearch engine.
  Powers web search inside LDR research pipelines.

### Exchange & Market Data
- **[CCXT](https://github.com/ccxt/ccxt)** — unified crypto exchange API library.
  Connects to 100+ exchanges (Binance, Bybit, OKX, MEXC, Kraken, etc.) for market data
  and order execution.
- **[Polymarket](https://polymarket.com)** — prediction market. Used for whale-tracking
  and event-driven signals via the Polymarket node.
- **[Finviz](https://finviz.com)** — US stock screener. Powers the Finviz scanner node
  for equities data and news enrichment.
- **[Deribit](https://www.deribit.com)** — crypto derivatives exchange. Used for
  Put/Call ratio data in order-flow nodes.

### Frontend
- **[React Flow](https://reactflow.dev)** — node-based canvas library for the visual
  strategy builder.
- **[Lightweight Charts](https://github.com/nickolay-grechkin/lightweight-charts)** by TradingView —
  financial charting library for TradingView-style price charts.

### Infrastructure
- **[PostgreSQL](https://www.postgresql.org)** — primary database for strategies, signals,
  candles, and user data.
- **[Redis](https://redis.io)** + **[Bull](https://github.com/OptimalBits/bull)** — caching,
  message queues, and pub/sub for real-time updates and backtest job processing.

## 📄 License

**Source-available, non-commercial.** You may self-host and use this software for personal,
non-commercial purposes. **Commercial use** — reselling, offering it as a paid service, or
selling bots built on this code — requires a separate commercial license.

See [`LICENSE`](LICENSE) for the full terms. For commercial licensing, contact the author.

---

<div align="center">
<sub>Built for traders who think in systems. ⚡ Not financial advice — trade responsibly.</sub>
</div>
