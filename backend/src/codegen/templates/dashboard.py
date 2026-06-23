import os
from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dashboard")

app = FastAPI(title="Signal Bot Dashboard")

ENV_PATH = ".env"

def read_env():
    if not os.path.exists(ENV_PATH):
        # Create empty if not exists
        with open(ENV_PATH, "w") as f:
            f.write("BOT_NAME=Signal Bot\n")
        return {"BOT_NAME": "Signal Bot"}
    
    config = {}
    with open(ENV_PATH, "r") as f:
        for line in f:
            line = line.strip()
            if line and "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                config[k.strip()] = v.strip()
    return config

def write_env(config):
    # Preserve existing file if possible, or just overwrite
    # For simplicity in generated bots, we overwrite
    with open(ENV_PATH, "w") as f:
        for k, v in config.items():
            f.write(f"{k}={v}\n")

@app.get("/", response_class=HTMLResponse)
async def index(request: Request, saved: bool = False):
    config = read_env()
    
    status_msg = ""
    if saved:
        status_msg = '<div class="alert">Настройки сохранены! Перезапустите контейнер для применения изменений.</div>'

    html = f"""
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Настройка Bot - Signal Constructor</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
            :root {{
                --bg: #0f172a;
                --card: #1e293b;
                --text: #f1f5f9;
                --accent: #6366f1;
                --border: #334155;
                --success: #10b981;
            }}
            body {{
                font-family: 'Inter', sans-serif;
                background: var(--bg);
                color: var(--text);
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
            }}
            .container {{
                width: 90%;
                max-width: 480px;
                background: var(--card);
                padding: 40px;
                border-radius: 24px;
                box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                border: 1px solid var(--border);
            }}
            .header {{ text-align: center; margin-bottom: 32px; }}
            .header h1 {{ font-size: 28px; margin: 0; color: #fff; font-weight: 800; }}
            .header p {{ color: #94a3b8; font-size: 14px; margin-top: 8px; }}
            
            .alert {{
                background: rgba(16, 185, 129, 0.1);
                color: var(--success);
                padding: 12px;
                border-radius: 12px;
                border: 1px solid var(--success);
                font-size: 14px;
                margin-bottom: 24px;
                text-align: center;
            }}

            .field {{ margin-bottom: 20px; }}
            label {{
                display: block;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 8px;
                color: #64748b;
            }}
            input {{
                width: 100%;
                padding: 14px;
                background: #0f172a;
                border: 1px solid var(--border);
                border-radius: 12px;
                color: #fff;
                font-size: 14px;
                outline: none;
                transition: 0.2s;
                box-sizing: border-box;
            }}
            input:focus {{ border-color: var(--accent); box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2); }}
            
            .btn-save {{
                width: 100%;
                padding: 16px;
                background: var(--accent);
                color: #fff;
                border: none;
                border-radius: 14px;
                font-size: 16px;
                font-weight: 700;
                cursor: pointer;
                transition: 0.3s;
                margin-top: 10px;
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            }}
            .btn-save:hover {{ background: #4f46e5; transform: translateY(-2px); }}
            
            .footer {{
                text-align: center;
                margin-top: 32px;
                font-size: 12px;
                color: #475569;
            }}
            .footer a {{ color: var(--accent); text-decoration: none; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Настройка Бота</h1>
                <p>Заполните данные для подключения к бирже и Telegram</p>
            </div>
            
            {status_msg}
            
            <form action="/save" method="post">
                <div class="field">
                    <label>Binance API Key</label>
                    <input type="text" name="BINANCE_API_KEY" value="{config.get('BINANCE_API_KEY', '')}" placeholder="Ключ (только чтение)">
                </div>
                
                <div class="field">
                    <label>Binance API Secret</label>
                    <input type="password" name="BINANCE_SECRET" value="{config.get('BINANCE_SECRET', '')}" placeholder="Секретный ключ">
                </div>
                
                <hr style="border: 0; border-top: 1px solid var(--border); margin: 24px 0;">
                
                <div class="field">
                    <label>Режим сканирования</label>
                    <select name="SCAN_MODE" style="width: 100%; padding: 14px; background: #0f172a; border: 1px solid var(--border); border-radius: 12px; color: #fff; font-size: 14px; outline: none;">
                        <option value="FIXED" {'selected' if config.get('SCAN_MODE') == 'FIXED' else ''}>Фиксированный список пар</option>
                        <option value="GLOBAL" {'selected' if config.get('SCAN_MODE') == 'GLOBAL' else ''}>Глобальный сканер рынка</option>
                    </select>
                </div>

                <div class="field">
                    <label>Мин. объем 24ч (USDT) для Global</label>
                    <input type="number" name="GLOBAL_MIN_VOLUME" value="{config.get('GLOBAL_MIN_VOLUME', '50000000')}" placeholder="Напр: 50000000">
                </div>

                <div class="field">
                    <label>Telegram Bot Token</label>
                    <input type="text" name="TELEGRAM_BOT_TOKEN" value="{config.get('TELEGRAM_BOT_TOKEN', '')}" placeholder="5412... от @BotFather">
                </div>
                
                <div class="field">
                    <label>Telegram Chat ID</label>
                    <input type="text" name="TELEGRAM_CHAT_ID" value="{config.get('TELEGRAM_CHAT_ID', '')}" placeholder="ID чата или канала">
                </div>
                
                <button type="submit" class="btn-save">Сохранить настройки</button>
            </form>
            
            <div class="footer">
                Сгенерировано в <a href="#">Signal Bot Constructor</a>
            </div>
        </div>
    </body>
    </html>
    """
    return html

@app.post("/save")
async def save(
    BINANCE_API_KEY: str = Form(...),
    BINANCE_SECRET: str = Form(...),
    TELEGRAM_BOT_TOKEN: str = Form(...),
    TELEGRAM_CHAT_ID: str = Form(...),
    SCAN_MODE: str = Form(...),
    GLOBAL_MIN_VOLUME: str = Form(...)
):
    config = read_env()
    config["BINANCE_API_KEY"] = BINANCE_API_KEY
    config["BINANCE_SECRET"] = BINANCE_SECRET
    config["TELEGRAM_BOT_TOKEN"] = TELEGRAM_BOT_TOKEN
    config["TELEGRAM_CHAT_ID"] = TELEGRAM_CHAT_ID
    config["SCAN_MODE"] = SCAN_MODE
    config["GLOBAL_MIN_VOLUME"] = GLOBAL_MIN_VOLUME
    
    # Keep some defaults if missing
    if "TRADING_PAIRS" not in config: config["TRADING_PAIRS"] = "BTCUSDT"
    if "TIMEFRAME" not in config: config["TIMEFRAME"] = "1h"
    if "CHECK_INTERVAL" not in config: config["CHECK_INTERVAL"] = "60"
    
    write_env(config)
    logger.info("Settings updated via Web UI")
    
    return RedirectResponse(url="/?saved=True", status_code=303)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
