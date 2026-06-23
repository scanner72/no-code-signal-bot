# 🛸 Cyber-Quant Signal Bot: AI Agent Development Guidelines & Rules

This document defines the architecture, coding standards, and strict system rules for Antigravity AI Agents working on the Cyber-Quant ecosystem. All code modifications, feature generation, and refactoring must comply with these specifications.

---

## 🧭 1. General Project Context
- **Project Name:** Cyber-Quant Signal Bot (formerly ALGO NEXUS)
- **Domain/Purpose:** No-Code/Low-Code visual trading strategy constructor (Strategy Builder), evolutionary optimization, backtesting, and institutional-grade fleet bot execution.
- **Key Modules:** `signal-bot` (main runtime), `sim-main` (Heym MCP core on port 4017), `kronos` (FastAPI for AI inference/Finviz scraping).

---

## 💻 2. Technical Stack & Coding Standards

### 🟢 Backend (Node.js + NestJS / TypeScript)
- **Framework:** NestJS (Structured Modules, Services, Controllers).
- **Database Layer:** PostgreSQL managed via TypeORM.
- **Asynchronous Execution:** 
  - All outbound exchange orders MUST use `ccxt-queue` (powered by Bull Queue + Redis) to maintain a strict rate limit of **5 requests/second** per strategy.
  - Bracket orders (OCO Stop-Loss / Take-Profit) are managed by `OcoManagerService` utilizing WebSockets with a 30-second REST polling fallback.
- **Strict Rule:** NEVER introduce blocking synchronous code. Use strict TypeScript types. Avoid using `any`.

### 🔵 Frontend (React 18 + TypeScript + Vite)
- **State Management:** Zustand (centralized storage).
- **Core Libraries:** ReactFlow 11 (Canvas & Nodes), Lightweight Charts (TradingView visual engine), TailwindCSS.
- **Localization:** 100% Bilingual (RU/EN) via `useLanguageStore`. All new node fields, property panels, and descriptions MUST be added with translation entries for both languages.
- **Chart Sync:** Bi-directional bridge (`useChartSyncStore`). Dragging lines on `MarketChart.tsx` must smoothly map coordinates to prices and write them back into ReactFlow nodes (`value`, `bValue`, `params.price`).

### 🐍 AI & Quantitative Layer (Python 3 + FastAPI)
- **Core Microservice:** `kronos` (FastAPI).
- **Features:** Random Forest / XGBoost model training (`MLController`, `ml.service.ts`), Finviz parsing and sentiment extraction, model inference for `ml_filter` nodes.
- **Asynchronous Code:** Use `asyncio` and `asyncpg` for database connection pools in Python scripts.

---

## 📊 3. Database & AST Strategy Schema Guidelines

### Abstract Syntax Tree (AST) Structure
Strategies built on the ReactFlow canvas are compiled into JSON AST. When updating or generating new node types (from the 22+ available library items), ensure the AST Compiler (`signals-engine.service.ts`) supports its layout:
- **Node Pipelines:** Data flows strictly from Sensors/Exchanges -> Indicators -> Logical Nodes (AND/OR/NOT, Comparison, Cross) -> Execution/Signal Nodes (`LONG`, `SHORT`, `Trade Action`).
- **Multi-Timeframe (MTF):** Container nodes must encapsulate nested graph rules inside a `condition` object serialized by the compiler.
- **Heym Validator (`heym_mcp`):** Real-time signal validator caching responses via Redis. If `mockBacktest` is true, mock deterministic positive responses during historical tests to save tokens.

---

## 🛡️ 4. Risk Management & Safety Constraints
- **Interceptors:** All trade signals must pass through `RiskManagerService` before hitting execution queues.
- **Safety Checks:** Check for Daily Loss Limits, Concurrency limits (`max_active_signals`), ATR/Pearson correlation penalties, and consecutive losing streak cooling timers.
- **Environment Safety:** NEVER hardcode API keys or secret tokens. Always utilize environment variables (`.env`). Agents are restricted from modifying `.env` files without explicit developer authorization.

---

## 🤖 5. Instructions for Antigravity Sandbox and Task Execution

### Environment Setup & Package Management
- Frontend uses Vite and npm. Always verify that production compilation passes (`npm run build` is clean).
- Multi-container architecture runs via `docker-compose` (`redis`, `db`, `backend`, `frontend`, `hermes`, `kronos`).

### Autonomic Self-Correction (Sandbox Loop)
1. Before declaring a task finished, execute testing routines in the sandbox container.
2. If tests fail (e.g., due to async timeouts, missing TypeORM indices, or missing database relations), inspect execution logs, modify the code within the sandbox, and retry until all pipelines return green.
3. Keep the code clean, modular, and perform micro-commits if working on large structural updates (such as shifting `pineParser.ts` logic).