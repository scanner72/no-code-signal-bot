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
| `/builder` | `StrategyBuilder.tsx` | Build | Визуальный конструктор стратегий (канвас) |
| `/strategies` | `Strategies.tsx` | Build | Мои стратегии, импорт/экспорт |
| `/backtest` | `Backtest.tsx` | Test | Бэктестер + оптимизатор |
| `/backtest/job/:jobId` | `BacktestJob.tsx` | Test | Статус/результаты конкретного бэктеста |
| `/paper` | `PaperTrading.tsx` | Test | Paper Trading: открытые/закрытые сделки, P&L |
| `/fleet` | `Fleet.tsx` | Deploy | Ферма ботов, Panic Stop |
| `/signals` | `SignalHistory.tsx` | Deploy | Журнал сигналов (WebSocket, фильтры) |
| `/dashboard` | `Dashboard.tsx` | Analyze | Контроль-центр: хелс, сигналы, быстрые ссылки |
| `/cross` | `CrossExchange.tsx` | Analyze | Кросс-биржевые спреды (Binance vs Kraken/Deribit) |
| `/ml` | `MLTrainer.tsx` | Analyze | ML Trainer (RF / GBM / LogReg) |
| `/docs` | `Documentation.tsx` | Utilities | Документация (локальная навигация) |
| `/settings` | `Settings.tsx` | Utilities | Настройки интеграций |
| `/*` | — | — | Fallback → `/dashboard` |

---

## 🧭 Sidebar навигация (Layout.tsx)

```
[Logo + 🟢 Health dot]

[+ Новая стратегия]  ← CTA, открывает NewStrategyModal
                       (С нуля / Из шаблона / Из PineScript)

── BUILD ──
  Конструктор         /builder
  Мои стратегии       /strategies

── TEST ──
  Бэктест             /backtest
  Paper Trading       /paper

── DEPLOY ──
  Ферма ботов         /fleet
  Журнал сигналов     /signals

── ANALYZE ──
  Dashboard           /dashboard
  Кросс-Биржа         /cross
  ML Trainer          /ml

── (bottom) ──
  Документация        /docs
  Настройки           /settings
```

---

## 🔔 Header (Layout.tsx)

| Элемент | Действие |
|---------|----------|
| Breadcrumbs | Навигационный путь (Home > Strategies > BTC Scalper > Canvas) |
| Hamburger (mobile) | Тоглит sidebar |
| ⌘K | Открывает Command Palette |
| Language toggle | RU ↔ EN |
| Theme toggle | Dark ↔ Light |
| 🔔 Notification Bell | Открывает Notification Center (dropdown) |

---

## ⌨️ Keyboard Shortcuts

### Глобальные
| Комбинация | Действие |
|---|---|
| `Ctrl+K` / `⌘K` | Command Palette |
| `Ctrl+Shift+N` | Новая стратегия |
| `?` | Справка по горячим клавишам |

### Builder
| Комбинация | Действие |
|---|---|
| `Ctrl+S` | Сохранить стратегию |
| `Ctrl+L` | Auto Layout |
| `Ctrl+C` | Копировать ноды |
| `Ctrl+V` | Вставить ноды |
| `Ctrl+G` | Группировать ноды |
| `Del` | Удалить ноду |

---

## 📦 Модалки и попапы

### Глобальные (Layout)
| Модалка | Триггер | Описание |
|---------|---------|----------|
| Command Palette | `Ctrl+K` или кнопка ⌘K в header | Быстрая навигация и действия |
| New Strategy | `Ctrl+Shift+N` или CTA в sidebar | 3 варианта: С нуля / Из шаблона / Из PineScript |
| Shortcuts Help | `?` | Справка по горячим клавишам |
| Notification Center | 🔔 в header | Список уведомлений |
| Help Drawer | кнопка "Help" внизу справа | Контекстная справка по текущей странице |
| Onboarding Wizard | Автоматически при первом визите | Пошаговый гид |
| Health Popup | клик на Health dot | Статус сервисов |

### Из StrategyBuilder (`/builder`)
| Модалка | Триггер | Описание |
|---------|---------|----------|
| Generate Bot | кнопка "Создать бота" (primary) | Генерация Python-бота, скачивание ZIP |
| Backtest Runner | кнопка ▶ | Запуск бэктеста с параметрами |
| Genetic Optimizer | кнопка ⚡ | Генетическая оптимизация параметров |
| Version History | меню ⋯ | История версий стратегии |
| Settings | меню ⋯ | Настройки запуска |

### Builder Toolbar
```
[← Back] [Pair/TF] [Canvas | TA]  ...  [▶ Backtest] [🐛 Debug] [⚡ Optimize] [📐 Layout] [⋯] | [📦 Создать бота] [💾 Save] [Activate]
```

### Из Strategies (`/strategies`)
| Модалка | Триггер | Описание |
|---------|---------|----------|
| Delete Confirm | 🗑 иконка | Подтверждение удаления стратегии |
| Codegen | кнопка "Bot" | Генерация бота |
| Backtest | кнопка запуска теста | Бэктест → `/backtest/job/:id` |

---

## 🚀 User Flow (типичный путь)

```
Login / Signup
    │
    ▼
[+ Новая стратегия]
    ├─ С нуля ──────────┐
    ├─ Из шаблона ──────┤
    └─ Из PineScript ───┘
                        │
                        ▼
              Builder (канвас)
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
          Backtest   Optimize   Generate Bot
              │                    │
              ▼                    ▼
        Paper Trading         Fleet (деплой)
              │                    │
              └────────┬───────────┘
                       ▼
               Signal History
                       │
                       ▼
                   Dashboard
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
