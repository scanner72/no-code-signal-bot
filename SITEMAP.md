# 🗺 Signal Bot — Карта навигации

## Маршруты (React Router)

### 🔓 Public (без авторизации)

| Route | Компонент | Описание |
|-------|-----------|----------|
| `/login` | `Login.tsx` | Вход (email + пароль) → `/dashboard` |
| `/signup` | `Signup.tsx` | Регистрация → `/login` |

### 🔒 Protected (требуется сессия)

| Route | Компонент | Группа | Описание |
|-------|-----------|--------|----------|
| `/` | — | — | Редирект → `/dashboard` |
| `/dashboard` | `Dashboard.tsx` | Trading Hub | Контроль-центр: хелс, сигналы, быстрые ссылки |
| `/cross` | `CrossExchange.tsx` | Trading Hub | Кросс-биржевые спреды (Binance vs Kraken/Deribit) |
| `/paper` | `PaperTrading.tsx` | Trading Hub | Paper Trading: открытые/закрытые сделки, P&L |
| `/signals` | `SignalHistory.tsx` | Trading Hub | Журнал сигналов (WebSocket, фильтры) |
| `/builder` | `StrategyBuilder.tsx` | Strategy Studio | Визуальный конструктор стратегий (канвас) |
| `/strategies` | `Strategies.tsx` | Strategy Studio | Список стратегий, импорт/экспорт |
| `/backtest` | `Backtest.tsx` | Strategy Studio | Бэктестер + оптимизатор |
| `/backtest/job/:jobId` | `BacktestJob.tsx` | Strategy Studio | Статус/результаты конкретного бэктеста |
| `/ml` | `MLTrainer.tsx` | Intelligence Lab | ML Trainer (RF / GBM / LogReg) |
| `/fleet` | `Fleet.tsx` | Fleet Management | Ферма ботов, Panic Stop |
| `/docs` | `Documentation.tsx` | Utilities | Документация (локальная навигация) |
| `/settings` | `Settings.tsx` | Utilities | Настройки интеграций |
| `/*` | — | — | Fallback → `/dashboard` |

---

## 🧭 Sidebar навигация (Layout.tsx)

### Trading Hub
- **Control Center** → `/dashboard`
- **Кросс-Биржа (Спреды)** → `/cross`
- **Paper Trading** → `/paper`
- **Журнал сигналов** → `/signals`

### Strategy Studio
- **Конструктор (Канвас)** → `/builder`
- **Шаблоны стратегий** → `/strategies`
- **Бэктест** → `/backtest`

### Intelligence Lab
- **ML Trainer (AI)** → `/ml`

### Fleet Management
- **Ферма ботов** → `/fleet`

### System
- **Обучение (Гид)** → открывает OnboardingWizard (модалка)
- **Документация** → `/docs`
- **Настройки API** → `/settings`

---

## 🔔 Header (Layout.tsx)

| Элемент | Действие |
|---------|----------|
| Hamburger (mobile) | Тоглит sidebar |
| Language toggle | RU ↔ EN |
| Theme toggle | Dark ↔ Light |
| 🔔 Notification Bell | Открывает Notification Center (dropdown) |
| 🟢 Health badge | Открывает Health popup |

---

## 📦 Модалки и попапы

### Из StrategyBuilder (`/builder`)
| Модалка | Триггер | Описание |
|---------|---------|----------|
| Codegen | кнопка "Bot Code" | Генерация Python-бота, предпросмотр, скачивание ZIP |
| Backtest Runner | кнопка "▶ Run Backtest" | Запуск бэктеста с параметрами |
| Genetic Optimizer | кнопка "⚡ Optimize" | Генетическая оптимизация параметров |
| Strategy Templates | кнопка "Templates" | Выбор шаблона стратегии |
| Save / Version | кнопка "Save" | Сохранение стратегии |

### Из Strategies (`/strategies`)
| Модалка | Триггер | Описание |
|---------|---------|----------|
| Delete Confirm | 🗑 иконка | Подтверждение удаления стратегии |
| Codegen | кнопка "Bot" | Генерация бота для выбранной стратегии |
| Backtest | кнопка запуска теста | Бэктест с переходом в `/backtest/job/:id` |
| Templates | кнопка загрузки | Загрузка шаблона |

### Глобальные (Layout)
| Модалка | Триггер | Описание |
|---------|---------|----------|
| Notification Center | 🔔 в header | Список уведомлений, "Прочитать все", "Очистить" |
| Help Drawer | кнопка "?" внизу справа | Контекстная справка по текущей странице |
| Onboarding Wizard | "Обучение" в sidebar | Пошаговый гид по приложению |
| Health Popup | клик на Health badge | Статус сервисов (backend, Kronos, Redis и т.д.) |

---

## 🚀 User Flow (типичный путь)

```
Login/Signup
    │
    ▼
Dashboard ──────────────────────────────────────────┐
    │                                                │
    ▼                                                ▼
Builder (создать стратегию)              Strategies (выбрать готовую)
    │                                        │
    ├─ Templates (загрузить шаблон)           ├─ Edit → Builder
    │                                        ├─ Codegen → ZIP бота
    ▼                                        │
Backtest (проверить)                         ▼
    │                                   Backtest
    ▼
Optimize (⚡ генетический)
    │
    ▼
Codegen (📦 Python-бот)
    │
    ▼
Fleet (🚀 деплой и мониторинг)
    │
    ▼
Paper Trading (📊 forward-тест)
    │
    ▼
Signal History (📋 журнал)
```

---

## ⚙️ Settings — секции

| Секция | Содержимое |
|--------|------------|
| General | Инфо о настройке бирж в нодах |
| Telegram | Bot Token, Chat ID, тест, отключение |
| Discord | Webhook URL, тест |
| Deduplication | Интервал тишины (1–24 ч) |
| Risk Controls | BTC/ETH drop threshold, daily loss, max signals, cooldown |
| Integrations | Hermes AI (4 провайдера: Hermes/Ollama/OpenAI/FreeLLMAPI), heym MCP |
| AI Prompts | Пресеты промптов (scalping/swing/hodl/custom) |
| Logs | Журнал событий |

---

## 🔐 Авторизация

- Все роуты кроме `/login` и `/signup` обёрнуты в `PrivateRoutes`
- `useSession()` → нет сессии → редирект на `/login`
- Ролевого разграничения нет — все пользователи видят все страницы
- Risk-контроли применяются на уровне API (не UI)

---

## 🔄 Real-time (WebSocket / Socket.IO)

| Страница | Событие | Описание |
|----------|---------|----------|
| Dashboard | `useSignalsWs` | Live-лента сигналов |
| Signal History | `useSignalsWs` | Новые сигналы в реальном времени |
| Backtest Job | `BACKTEST_PROGRESS` | Прогресс и результаты бэктеста |
| Paper Trading | polling (10s) | Обновление открытых позиций |
| Cross-Exchange | polling (10s) | Обновление спредов |
| Fleet | polling (5s) | Статус ботов |
