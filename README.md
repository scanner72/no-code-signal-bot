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

Build a full trading pipeline — from data in to order out — visually, with **34 node types**:

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
- **🔌 Extras** — PineScript v5 importer (paste TradingView code → get a node graph),
  TradingView-style charts, bilingual UI (EN/RU).

## 🚀 Quick Start

> **Requirements:** [Docker Desktop](https://www.docker.com/products/docker-desktop/).
> For the full AI stack you'll also want an NVIDIA GPU (Kronos) and [Ollama](https://ollama.com)
> on the host (Hermes / Local Deep Research). The core platform runs without them.

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

> 💡 Start with **paper trading** and the built-in strategy templates — no API keys needed
> to explore the builder and backtester.

## 🏗 Architecture

```
React + ReactFlow canvas  ─►  NestJS API (CCXT, signals engine, backtest, optimizer)
                                  │
                                  ├─ PostgreSQL  (strategies, signals, candles)
                                  ├─ Redis + Bull (cache, queues, pub/sub)
                                  ├─ Kronos        — time-series forecasting (GPU)
                                  ├─ Hermes        — LLM risk filter (Ollama)
                                  └─ LDR + SearXNG — fundamental deep research
```

- **Frontend:** React 18, TypeScript, Vite, Zustand, ReactFlow 11, Lightweight Charts, Tailwind.
- **Backend:** NestJS, TypeORM, PostgreSQL, Redis + Bull, CCXT — 26 modules
  (signals engine, backtest, optimizer, orders, paper-trading, risk, fleet, codegen, …).
- **AI:** Kronos (time-series), Hermes/Nous Hermes (LLM), Local Deep Research, sentiment & ML filters.

## 🗺 Roadmap

- [ ] Dynamic Top-50 relative-volume scanner (adaptive to market regime)
- [ ] AST logic validation (catch impossible conditions like `RSI > 70 AND RSI < 30`)
- [ ] Sandbox that test-runs generated Python bots before download
- [ ] Hosted cloud version (one-click, no setup)

## 🙏 Acknowledgements

This project integrates third-party open-source components:

- **[Kronos](https://huggingface.co/NeoQuasar)** by NeoQuasar — time-series forecasting
  model. Architecture code is included with attribution (see [`kronos/NOTICE.md`](kronos/NOTICE.md));
  weights are downloaded at runtime from Hugging Face.
- **[Hermes Agent](https://github.com/NousResearch/hermes-agent)** by Nous Research (MIT) —
  powers the optional Hermes LLM risk-filter node. **Not bundled.** To enable it, clone it
  into `./hermes-agent` and uncomment the `hermes` service in `docker-compose.yml`.
- **[Local Deep Research](https://github.com/LearningCircuit/local-deep-research)** and
  **SearXNG** — used (as external Docker images) for the fundamental-research node.

## 📄 License

**Source-available, non-commercial.** You may self-host and use this software for personal,
non-commercial purposes. **Commercial use** — reselling, offering it as a paid service, or
selling bots built on this code — requires a separate commercial license.

See [`LICENSE`](LICENSE) for the full terms. For commercial licensing, contact the author.

---

<div align="center">
<sub>Built for traders who think in systems. ⚡ Not financial advice — trade responsibly.</sub>
</div>
