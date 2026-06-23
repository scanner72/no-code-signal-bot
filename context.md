# Context: Signal Bot Project

## Current Status (2026-05-23)

### 1. Backend Strategy Engine (Institutional Grade)
*   **AST Compiler**: Full support for SMC (FVG, OB, BOS/CHoCH, Liquidity Sweeps), Quant-metrics (CVD, Delta), as well as `hermes`, `heym_mcp`, `polymarket_scanner`, and `orderbook` nodes.
*   **AI & Cognitive Layer**: Seamless integration with Nous Hermes (`HermesService`) and Heym MCP (`HeymMcpService`). Real-time signal validation with caching via Redis. During stock trading, Finviz news headlines are scraped and fed directly into the Hermes prompt context to allow news-sentiment-aware PASS/BLOCK decisions.
*   **Reliability**: CCXT + WebSockets hybrid architecture with automated gap-sync and CCXT-queue rate limiting (5 req/sec).

### 2. Visual Strategy Builder (100% Bilingual)
*   **Node Library (22+ types)**: Indicators, SMC, Order Flow (CVD/Delta/Orderbook), Sentiment, ML Filter, Hermes Agent, Kronos Forecast, Polymarket Scanner, User Level.
*   **Inline Editing & Translations**: Full Russian and English localization using `useLanguageStore` across all node parameters, sidebar panels, and forms.
*   **PineScript Importer (v2)**: Advanced parser converts Pine Script indicators, MACD, BB, Stochastic, volume conditions, AND/OR logic, and signals (LONG/SHORT) into React Flow nodes.
*   **Contextual Documentation**: Integrated bilingual help files accessible directly from node property drawers using `originalType` routing.

### 3. Quantitative & Risk Layers (Institutional Quality)
*   **ML Model Trainer**: Full frontend (`MLTrainer.tsx`) and backend (`MLController`) support for building, training, backtesting, and exploring feature importances of Random Forest predictive models.
*   **Cross-Exchange Arbitrage**: A live delta monitor (`CrossExchange.tsx`) and AST evaluation mode (`price_delta`) that tracks price spread discrepancies between Binance, Bybit, OKX, MEXC, and Kraken.
*   **Portfolio Risk Manager**: Active checks on global settings (`RiskManagerService`) to manage daily drawdown limits, position sizer scaling based on ATR/Pearson correlation penalties, and consecutive losing streak cooldown timers.
*   **Execution Trail Debugger**: Audit logging of node states with live neon color highlight overlays on the Strategy Builder canvas.

### 4. Fleet & Automation
*   **Codegen Service**: Exports React Flow strategy canvas graphs directly into standalone Docker-compatible Python-bots (FastAPI + docker-compose).
*   **Fleet Management**: Control panel to track status of bots and execute a global "Panic Stop".

---

## Key Files
| File | Purpose |
|---|---|
| `frontend/src/pages/MLTrainer.tsx` | Front-end machine learning model trainer |
| `frontend/src/pages/CrossExchange.tsx` | Front-end cross-exchange spread and arbitrage monitor |
| `frontend/src/components/nodes/FinvizScannerNode.tsx` | Finviz scanner node visual component |
| `backend/src/risk/risk-manager.service.ts` | Global portfolio risk management checks |
| `backend/src/ml/ml.service.ts` | Machine learning model training and evaluation |
| `backend/src/signals/signals-engine.service.ts` | Real-time signal execution engine and node evaluator |
| `kronos/app.py` | FastAPI Python server for model inference and Finviz scraping |

---

## Next Refinements
1.  **Macro-Economic Sentiment Layer**: Integrating broader economic calendars (e.g. CPI/FOMC releases) into the AI filter context.
2.  **Order Execution Optimization**: Adding TWAP/VWAP algorithms for real-world paper and live trading executions.
3.  **Prompt Customization**: Exposing customized prompt templates (e.g., "Aggressive Scalper", "Safe Trend Follower") in the Hermes Agent node configuration.
