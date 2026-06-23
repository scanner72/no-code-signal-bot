-- TimescaleDB Initialization
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Candles (hypertable)
CREATE TABLE IF NOT EXISTS candles (
  time            TIMESTAMPTZ   NOT NULL,
  pair            VARCHAR(20)   NOT NULL,
  timeframe       VARCHAR(5)    NOT NULL,
  open            DECIMAL(20,8) NOT NULL,
  high            DECIMAL(20,8) NOT NULL,
  low             DECIMAL(20,8) NOT NULL,
  close           DECIMAL(20,8) NOT NULL,
  volume          DECIMAL(20,8) NOT NULL,
  mark_price      DECIMAL(20,8),
  funding_rate    DECIMAL(10,6),
  open_interest   DECIMAL(20,8),
  PRIMARY KEY (time, pair, timeframe)
);

SELECT create_hypertable('candles', 'time', if_not_exists => TRUE);
SELECT add_compression_policy('candles', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('candles', INTERVAL '6 months', if_not_exists => TRUE);

-- Strategies
CREATE TABLE IF NOT EXISTS strategies (
  id          SERIAL      PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  nodes       JSONB        NOT NULL,   -- React Flow graph
  ast         JSONB        NOT NULL,   -- Compiled AST
  pair        VARCHAR(20)  NOT NULL,
  timeframe   VARCHAR(5)   NOT NULL,
  is_active   BOOLEAN      DEFAULT false,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Signals
CREATE TABLE IF NOT EXISTS signals (
  id                    SERIAL      PRIMARY KEY,
  strategy_id           INT         NOT NULL REFERENCES strategies(id),
  pair                  VARCHAR(20) NOT NULL,
  signal_type           VARCHAR(10) NOT NULL CHECK (signal_type IN ('LONG','SHORT','NEUTRAL')),
  market                VARCHAR(10) DEFAULT 'futures',
  price                 DECIMAL(20,8),
  funding_rate_at_signal DECIMAL(10,6),
  indicator_values      JSONB,
  candle_time           TIMESTAMPTZ NOT NULL,
  triggered_at          TIMESTAMPTZ DEFAULT NOW(),
  telegram_sent         BOOLEAN     DEFAULT false,
  telegram_error        TEXT
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  id                  INT  PRIMARY KEY DEFAULT 1,
  telegram_chat_id    BIGINT,
  telegram_verified   BOOLEAN DEFAULT false,
  dedup_hours         INT     DEFAULT 4,
  CHECK (id = 1)
);

-- Initial settings row
INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;
