"""
Kronos AI Microservice — Signal Bot Constructor
Auto-selects the best model based on available hardware (GPU VRAM / CPU RAM).
"""

import os
import time
import logging
import asyncio
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
except ImportError:
    RandomForestClassifier = None
    GradientBoostingClassifier = None

from model import Kronos, KronosTokenizer, KronosPredictor

# ─── Logger ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("kronos")

# ─── Model Registry ──────────────────────────────────────────────────────────
MODELS = {
    "kronos-base": {
        "model_id": "NeoQuasar/Kronos-base",
        "tokenizer_id": "NeoQuasar/Kronos-Tokenizer-base",
        "params": "102.3M",
        "context": 512,
        "vram_mb": 450,      # approximate FP32 model size in VRAM
        "ram_mb": 600,       # approximate RAM needed for CPU inference
        "quality": 3,        # quality rank (higher = better)
    },
    "kronos-small": {
        "model_id": "NeoQuasar/Kronos-small",
        "tokenizer_id": "NeoQuasar/Kronos-Tokenizer-base",
        "params": "24.7M",
        "context": 512,
        "vram_mb": 150,
        "ram_mb": 250,
        "quality": 2,
    },
    "kronos-mini": {
        "model_id": "NeoQuasar/Kronos-mini",
        "tokenizer_id": "NeoQuasar/Kronos-Tokenizer-2k",
        "params": "4.1M",
        "context": 2048,
        "vram_mb": 30,
        "ram_mb": 80,
        "quality": 1,
    },
}

# ─── Hardware Detection ──────────────────────────────────────────────────────

def detect_hardware() -> dict:
    """Detect available compute hardware."""
    info = {
        "gpu_available": False,
        "gpu_name": None,
        "gpu_vram_mb": 0,
        "gpu_vram_free_mb": 0,
        "cpu_ram_mb": 0,
        "mps_available": False,
    }

    # GPU (CUDA)
    if torch.cuda.is_available():
        info["gpu_available"] = True
        info["gpu_name"] = torch.cuda.get_device_name(0)
        vram_total = torch.cuda.get_device_properties(0).total_memory / (1024 ** 2)
        vram_free = (torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_allocated(0)) / (1024 ** 2)
        info["gpu_vram_mb"] = int(vram_total)
        info["gpu_vram_free_mb"] = int(vram_free)

    # Apple Silicon (MPS)
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        info["mps_available"] = True

    # CPU RAM
    try:
        import psutil
        info["cpu_ram_mb"] = int(psutil.virtual_memory().total / (1024 ** 2))
    except ImportError:
        # Fallback: read from /proc/meminfo (Linux) or use default
        try:
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal"):
                        info["cpu_ram_mb"] = int(line.split()[1]) // 1024
                        break
        except Exception:
            info["cpu_ram_mb"] = 8192  # conservative default

    return info


def auto_select_model(hardware: dict, forced_model: str | None = None) -> tuple[str, str]:
    """
    Select the best model for the available hardware.
    Returns (model_key, device_string).
    
    Strategy:
      1. If GPU available → pick the largest model that fits in VRAM
      2. If MPS available → pick the largest model that fits in RAM
      3. CPU fallback → pick the largest model that fits in RAM with safety margin
    """
    if forced_model and forced_model in MODELS:
        device = "cpu"
        if hardware["gpu_available"]:
            device = "cuda:0"
        elif hardware["mps_available"]:
            device = "mps"
        logger.info(f"Using forced model: {forced_model} on {device}")
        return forced_model, device

    # Sort models by quality (best first)
    candidates = sorted(MODELS.items(), key=lambda x: x[1]["quality"], reverse=True)

    # GPU path
    if hardware["gpu_available"]:
        pytorch_overhead_mb = 800  # PyTorch CUDA runtime overhead
        available = hardware["gpu_vram_mb"] - pytorch_overhead_mb
        for key, spec in candidates:
            if spec["vram_mb"] <= available:
                logger.info(
                    f"Auto-selected: {key} ({spec['params']}) on cuda:0 "
                    f"[VRAM: {spec['vram_mb']}MB needed, {available}MB available]"
                )
                return key, "cuda:0"

    # MPS path (Apple Silicon)
    if hardware["mps_available"]:
        for key, spec in candidates:
            if spec["ram_mb"] * 2 <= hardware["cpu_ram_mb"]:
                logger.info(f"Auto-selected: {key} ({spec['params']}) on mps")
                return key, "mps"

    # CPU path
    safety_margin = 2.5  # Need 2.5x model size available in RAM
    for key, spec in candidates:
        if spec["ram_mb"] * safety_margin <= hardware["cpu_ram_mb"]:
            logger.info(
                f"Auto-selected: {key} ({spec['params']}) on cpu "
                f"[RAM: {spec['ram_mb']}MB needed, {hardware['cpu_ram_mb']}MB total]"
            )
            return key, "cpu"

    # Absolute fallback
    logger.warning("Low resources — falling back to kronos-mini on cpu")
    return "kronos-mini", "cpu"


# ─── Global State ─────────────────────────────────────────────────────────────

predictor: KronosPredictor | None = None
model_info: dict = {}
hw_info: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    global predictor, model_info, hw_info

    logger.info("=" * 60)
    logger.info("Kronos AI Microservice starting...")
    logger.info("=" * 60)

    # 1. Detect hardware
    hw_info = detect_hardware()
    logger.info(f"Hardware: GPU={'✅ ' + hw_info['gpu_name'] + ' (' + str(hw_info['gpu_vram_mb']) + ' MB)' if hw_info['gpu_available'] else '❌ not found'}")
    logger.info(f"Hardware: RAM={hw_info['cpu_ram_mb']} MB, MPS={'✅' if hw_info['mps_available'] else '❌'}")

    # 2. Auto-select model
    forced = os.environ.get("KRONOS_MODEL")  # Override via env
    model_key, device = auto_select_model(hw_info, forced)
    spec = MODELS[model_key]

    # 3. Load from HuggingFace
    logger.info(f"Loading tokenizer: {spec['tokenizer_id']}...")
    tokenizer = KronosTokenizer.from_pretrained(spec["tokenizer_id"])

    logger.info(f"Loading model: {spec['model_id']}...")
    model = Kronos.from_pretrained(spec["model_id"])

    logger.info(f"Initializing predictor on {device}...")
    predictor = KronosPredictor(model, tokenizer, device=device, max_context=spec["context"])

    model_info = {
        "model": model_key,
        "model_id": spec["model_id"],
        "params": spec["params"],
        "context_length": spec["context"],
        "device": device,
        "gpu_name": hw_info.get("gpu_name"),
        "gpu_vram_mb": hw_info.get("gpu_vram_mb", 0),
        "cpu_ram_mb": hw_info.get("cpu_ram_mb", 0),
    }

    # 4. Warmup inference
    logger.info("Running warmup inference...")
    try:
        dummy = pd.DataFrame({
            "open": np.random.randn(50).cumsum() + 100,
            "high": np.random.randn(50).cumsum() + 101,
            "low": np.random.randn(50).cumsum() + 99,
            "close": np.random.randn(50).cumsum() + 100,
        })
        dummy_ts = pd.Series(pd.date_range("2025-01-01", periods=50, freq="1h"))
        dummy_y = pd.Series(pd.date_range("2025-01-03 02:00", periods=5, freq="1h"))
        predictor.predict(dummy, dummy_ts, dummy_y, pred_len=5, sample_count=1, verbose=False)
        logger.info("Warmup complete ✅")
    except Exception as e:
        logger.warning(f"Warmup failed (non-critical): {e}")

    logger.info("=" * 60)
    logger.info(f"✅ Kronos ready: {model_key} ({spec['params']}) on {device}")
    logger.info("=" * 60)

    yield  # App runs here

    logger.info("Kronos shutting down...")


# ─── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI(title="Kronos AI Microservice", version="1.0.0", lifespan=lifespan)


# ─── Schemas ──────────────────────────────────────────────────────────────────

class Candle(BaseModel):
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0
    timestamp: str | None = None

class PredictRequest(BaseModel):
    candles: list[Candle] = Field(..., min_length=50, description="Historical OHLCV candles (min 50)")
    pred_len: int = Field(default=24, ge=1, le=120, description="Number of candles to predict")
    temperature: float = Field(default=0.8, ge=0.1, le=2.0)
    top_p: float = Field(default=0.9, ge=0.1, le=1.0)
    sample_count: int = Field(default=3, ge=1, le=10, description="Monte Carlo samples to average")

class PredictedCandle(BaseModel):
    open: float
    high: float
    low: float
    close: float
    volume: float

class PredictResponse(BaseModel):
    predictions: list[PredictedCandle]
    direction: str  # "UP" or "DOWN"
    predicted_change_pct: float
    last_close: float
    predicted_close: float
    inference_time_ms: int
    model: str
    device: str

class TrainRequest(BaseModel):
    X: list[list[float]] = Field(..., description="Feature matrix")
    y: list[int] = Field(..., description="Target labels")
    feature_names: list[str] = Field(..., description="Feature names")
    model_type: str = Field(default="random_forest", description="random_forest or gradient_boosting")
    n_estimators: int = Field(default=50, ge=1, le=500)
    max_depth: int = Field(default=6, ge=1, le=20)
    min_samples_split: int = Field(default=5, ge=2, le=50)

class TrainResponse(BaseModel):
    status: str
    accuracy: float
    feature_importance: dict[str, float]
    weights: dict


def serialize_sklearn_tree_classifier(tree, node_idx=0):
    if tree.feature[node_idx] == -2:
        val = tree.value[node_idx][0]
        prob = float(val[1] / val.sum()) if val.sum() > 0 else 0.5
        return {"isLeaf": True, "value": prob}
    return {
        "isLeaf": False,
        "featureIndex": int(tree.feature[node_idx]),
        "threshold": float(tree.threshold[node_idx]),
        "left": serialize_sklearn_tree_classifier(tree, tree.children_left[node_idx]),
        "right": serialize_sklearn_tree_classifier(tree, tree.children_right[node_idx]),
        "value": float(tree.value[node_idx][0][1] / tree.value[node_idx][0].sum()) if tree.value[node_idx][0].sum() > 0 else 0.5
    }


def serialize_sklearn_tree_regressor(tree, node_idx=0):
    if tree.feature[node_idx] == -2:
        val = float(tree.value[node_idx][0][0])
        return {"isLeaf": True, "value": val}
    return {
        "isLeaf": False,
        "featureIndex": int(tree.feature[node_idx]),
        "threshold": float(tree.threshold[node_idx]),
        "left": serialize_sklearn_tree_regressor(tree, tree.children_left[node_idx]),
        "right": serialize_sklearn_tree_regressor(tree, tree.children_right[node_idx]),
        "value": float(tree.value[node_idx][0][0])
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/train-model", response_model=TrainResponse)
async def train_model(req: TrainRequest):
    if RandomForestClassifier is None or GradientBoostingClassifier is None:
        raise HTTPException(500, "scikit-learn is not installed in Kronos container")

    if not req.X or not req.y:
        raise HTTPException(400, "Empty dataset provided")

    X_arr = np.array(req.X)
    y_arr = np.array(req.y)

    if req.model_type == "random_forest":
        clf = RandomForestClassifier(
            n_estimators=req.n_estimators,
            max_depth=req.max_depth,
            min_samples_split=req.min_samples_split,
            random_state=42
        )
        clf.fit(X_arr, y_arr)
        
        # Calculate train accuracy
        preds = clf.predict(X_arr)
        accuracy = float((preds == y_arr).mean())

        # Serialize trees
        trees = []
        for est in clf.estimators_:
            trees.append(serialize_sklearn_tree_classifier(est.tree_))

        # Feature importances
        importance = {}
        for name, imp in zip(req.feature_names, clf.feature_importances_):
            importance[name] = float(imp)

        weights = {
            "trees": trees,
            "featureNames": req.feature_names,
            "accuracy": accuracy,
            "featureImportance": importance
        }

    elif req.model_type == "gradient_boosting":
        clf = GradientBoostingClassifier(
            n_estimators=req.n_estimators,
            max_depth=req.max_depth,
            min_samples_split=req.min_samples_split,
            random_state=42
        )
        clf.fit(X_arr, y_arr)

        # Calculate train accuracy
        preds = clf.predict(X_arr)
        accuracy = float((preds == y_arr).mean())

        # Serialize trees (GB uses Regressors internally)
        trees = []
        for est in clf.estimators_:
            # est is a 1-element list for binary classification
            trees.append(serialize_sklearn_tree_regressor(est[0].tree_))

        # Calculate initValue
        p = sum(req.y) / len(req.y) if len(req.y) > 0 else 0.5
        init_value = float(np.log((p + 1e-7) / (1 - p + 1e-7)))

        # Feature importances
        importance = {}
        for name, imp in zip(req.feature_names, clf.feature_importances_):
            importance[name] = float(imp)

        weights = {
            "trees": trees,
            "initValue": init_value,
            "learningRate": 0.1,
            "featureNames": req.feature_names,
            "accuracy": accuracy,
            "featureImportance": importance,
            "type": "gradient_boosting"
        }
    else:
        raise HTTPException(400, f"Unsupported model type: {req.model_type}")

    return TrainResponse(
        status="success",
        accuracy=accuracy,
        feature_importance=importance,
        weights=weights
    )

@app.get("/health")
async def health():
    return {
        "status": "ok" if predictor else "loading",
        "model": model_info.get("model", "none"),
        "device": model_info.get("device", "unknown"),
    }


@app.get("/model-info")
async def get_model_info():
    return {
        "status": "loaded" if predictor else "not_loaded",
        **model_info,
        "hardware": hw_info,
        "available_models": {k: {"params": v["params"], "quality": v["quality"]} for k, v in MODELS.items()},
    }


@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    if predictor is None:
        raise HTTPException(503, "Model not loaded yet")

    t0 = time.time()

    # Build DataFrame
    df = pd.DataFrame([c.model_dump() for c in req.candles])

    # Generate timestamps if not provided
    if "timestamp" in df.columns and df["timestamp"].notna().all():
        timestamps = pd.to_datetime(df["timestamp"])
    else:
        timestamps = pd.Series(pd.date_range("2025-01-01", periods=len(df), freq="1h"))

    # Prepare future timestamps
    last_ts = timestamps.iloc[-1]
    freq = timestamps.iloc[-1] - timestamps.iloc[-2] if len(timestamps) > 1 else pd.Timedelta(hours=1)
    y_timestamps = pd.Series(pd.date_range(start=last_ts + freq, periods=req.pred_len, freq=freq))

    # Required columns
    x_df = df[["open", "high", "low", "close"]].copy()
    if "volume" in df.columns:
        x_df["volume"] = df["volume"]

    # Run inference in thread pool (blocking PyTorch call)
    loop = asyncio.get_event_loop()
    pred_df = await loop.run_in_executor(None, lambda: predictor.predict(
        df=x_df,
        x_timestamp=timestamps,
        y_timestamp=y_timestamps,
        pred_len=req.pred_len,
        T=req.temperature,
        top_p=req.top_p,
        sample_count=req.sample_count,
        verbose=False,
    ))

    inference_ms = int((time.time() - t0) * 1000)

    # Build response
    predictions = []
    for _, row in pred_df.iterrows():
        predictions.append(PredictedCandle(
            open=round(float(row["open"]), 6),
            high=round(float(row["high"]), 6),
            low=round(float(row["low"]), 6),
            close=round(float(row["close"]), 6),
            volume=round(float(row.get("volume", 0)), 2),
        ))

    last_close = float(req.candles[-1].close)
    predicted_close = predictions[-1].close
    change_pct = round(((predicted_close - last_close) / last_close) * 100, 4)
    direction = "UP" if predicted_close > last_close else "DOWN"

    logger.info(
        f"Predict: {len(req.candles)} candles → {req.pred_len} predictions | "
        f"{direction} {change_pct:+.2f}% | {inference_ms}ms"
    )

    return PredictResponse(
        predictions=predictions,
        direction=direction,
        predicted_change_pct=change_pct,
        last_close=last_close,
        predicted_close=predicted_close,
        inference_time_ms=inference_ms,
        model=model_info["model"],
        device=model_info["device"],
    )


# ─── Finviz Endpoints ──────────────────────────────────────────────────────────

@app.get("/finviz/screener")
def get_finviz_screener(
    signal: str = "top_gainers",
    short_float: str | None = None,
    sma_200: str | None = None,
    inst_own: str | None = None
):
    """
    Get filtered stock table from Finviz Screener with support for stacked filters.
    Signal presets: top_gainers, top_losers, new_high, new_low, most_volatile, most_active, overbought, oversold.
    """
    try:
        from finvizfinance.screener.overview import Overview
        foverview = Overview()
        
        # Build custom stacked filters if provided
        filters = {}
        if short_float:
            filters["Short Float"] = short_float
        if sma_200:
            filters["200-Day Simple Moving Average"] = sma_200
        if inst_own:
            filters["Institutional Ownership"] = inst_own

        if filters:
            foverview.set_filter(filters_dict=filters)
        else:
            sig_map = {
                "top_gainers": "Top Gainers",
                "top_losers": "Top Losers",
                "new_high": "New High",
                "new_low": "New Low",
                "most_volatile": "Most Volatile",
                "most_active": "Most Active",
                "overbought": "Overbought",
                "oversold": "Oversold"
            }
            mapped_sig = sig_map.get(signal, "Top Gainers")
            foverview.set_filter(signal=mapped_sig)

        df = foverview.screener_view()
        
        # Limit to top 40 records to avoid huge payloads
        records = df.head(40).to_dict(orient="records")
        # Standardize keys (remove spaces, lowercase)
        standardized = []
        for r in records:
            std_r = {str(k).lower().replace(" ", "_").replace("/", "_"): v for k, v in r.items()}
            standardized.append(std_r)
        return {"status": "success", "data": standardized}
    except Exception as e:
        logger.warning(f"Finviz Screener fetch failed: {e}. Returning mock fallback data.")
        fallbacks = {
            "top_gainers": [
                {"ticker": "NVDA", "company": "NVIDIA Corp", "sector": "Technology", "price": 925.30, "change": "+6.42%", "volume": "42,105,300"},
                {"ticker": "AAPL", "company": "Apple Inc", "sector": "Technology", "price": 182.10, "change": "+2.15%", "volume": "35,240,100"},
                {"ticker": "TSLA", "company": "Tesla Inc", "sector": "Consumer Cyclical", "price": 178.50, "change": "+4.88%", "volume": "58,120,300"},
                {"ticker": "AMZN", "company": "Amazon.com Inc", "sector": "Consumer Cyclical", "price": 185.40, "change": "+3.24%", "volume": "28,410,500"},
                {"ticker": "MSFT", "company": "Microsoft Corp", "sector": "Technology", "price": 421.90, "change": "+1.85%", "volume": "22,145,200"}
            ],
            "top_losers": [
                {"ticker": "INTC", "company": "Intel Corp", "sector": "Technology", "price": 31.40, "change": "-8.25%", "volume": "24,105,300"},
                {"ticker": "NFLX", "company": "Netflix Inc", "sector": "Communication Services", "price": 610.20, "change": "-4.12%", "volume": "12,104,300"},
                {"ticker": "AMD", "company": "Advanced Micro Devices", "sector": "Technology", "price": 160.40, "change": "-3.80%", "volume": "38,520,100"}
            ],
            "new_high": [
                {"ticker": "NVDA", "company": "NVIDIA Corp", "sector": "Technology", "price": 925.30, "change": "+6.42%", "volume": "42,105,300"},
                {"ticker": "LLY", "company": "Eli Lilly & Co", "sector": "Healthcare", "price": 780.10, "change": "+2.40%", "volume": "4,120,500"}
            ],
            "most_active": [
                {"ticker": "TSLA", "company": "Tesla Inc", "sector": "Consumer Cyclical", "price": 178.50, "change": "+4.88%", "volume": "58,120,300"},
                {"ticker": "NVDA", "company": "NVIDIA Corp", "sector": "Technology", "price": 925.30, "change": "+6.42%", "volume": "42,105,300"}
            ]
        }
        fallback_data = fallbacks.get(signal, fallbacks["top_gainers"])
        return {"status": "fallback", "data": fallback_data}


@app.get("/finviz/insider")
def get_finviz_insider(option: str = "latest"):
    """
    Get latest or top insider transactions from Finviz.
    """
    try:
        from finvizfinance.insider import Insider
        finsider = Insider(option=option)
        df = finsider.get_insider()
        records = df.head(40).to_dict(orient="records")
        standardized = []
        for r in records:
            std_r = {str(k).lower().replace(" ", "_").replace("/", "_"): v for k, v in r.items()}
            standardized.append(std_r)
        return {"status": "success", "data": standardized}
    except Exception as e:
        logger.warning(f"Finviz Insider fetch failed: {e}. Returning mock fallback data.")
        return {
            "status": "fallback",
            "data": [
                {"ticker": "MSFT", "owner": "Nadella Satya", "relationship": "CEO", "date": "2026-05-21", "transaction": "Option Exercise", "cost": "420.50", "shares": "15,000", "value_($)": "6,307,500"},
                {"ticker": "AMZN", "owner": "Bezos Jeffrey P", "relationship": "Chairman", "date": "2026-05-20", "transaction": "Sale", "cost": "184.20", "shares": "100,000", "value_($)": "18,420,000"},
                {"ticker": "PLTR", "owner": "Karp Alexander C.", "relationship": "CEO", "date": "2026-05-19", "transaction": "Buy", "cost": "21.40", "shares": "50,000", "value_($)": "1,070,000"},
                {"ticker": "COIN", "owner": "Armstrong Brian", "relationship": "CEO", "date": "2026-05-18", "transaction": "Buy", "cost": "204.50", "shares": "10,000", "value_($)": "2,045,000"},
                {"ticker": "TSLA", "owner": "Musk Elon", "relationship": "CEO", "date": "2026-05-17", "transaction": "Buy", "cost": "172.10", "shares": "150,000", "value_($)": "25,815,000"}
            ]
        }


@app.get("/finviz/news/{ticker}")
def get_finviz_news(ticker: str):
    """
    Get ticker-specific news headlines.
    """
    try:
        from finvizfinance.quote import finvizfinance as TickerQuote
        stock = TickerQuote(ticker)
        news_df = stock.ticker_news()
        records = news_df.head(20).to_dict(orient="records")
        return {"status": "success", "data": records}
    except Exception as e:
        logger.warning(f"Finviz News fetch failed for {ticker}: {e}. Returning mock fallback news.")
        return {
            "status": "fallback",
            "data": [
                {"date": "2026-05-22 09:30", "title": f"NVIDIA Announces Next-Generation Blackwell Ultra Architecture", "link": "#"},
                {"date": "2026-05-21 16:15", "title": f"Why shares of {ticker} are surging today alongside tech index", "link": "#"},
                {"date": "2026-05-20 12:00", "title": f"Analysts upgrade {ticker} following strong institutional volume demand", "link": "#"},
                {"date": "2026-05-19 10:45", "title": f"Executive insider buying signals major confidence in {ticker} future", "link": "#"}
            ]
        }

