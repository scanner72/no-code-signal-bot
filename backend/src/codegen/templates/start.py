import subprocess
import time
import sys
import os

def start_dashboard():
    return subprocess.Popen([sys.executable, "dashboard.py"])

def start_bot():
    return subprocess.Popen([sys.executable, "-u", "bot.py"])

def main():
    print("🚀 Starting Signal Bot Ecosystem...")
    
    # Start dashboard
    dashboard_proc = start_dashboard()
    print("🖥️  Web UI available at http://localhost:8080")
    
    # Start bot
    bot_proc = start_bot()
    
    try:
        while True:
            # Check if processes are alive
            if dashboard_proc.poll() is not None:
                print("⚠️  Dashboard stopped. Restarting...")
                dashboard_proc = start_dashboard()
            
            if bot_proc.poll() is not None:
                # If bot stopped, check if it's due to missing config
                # We restart it anyway, maybe user just updated .env via web ui
                print("⚠️  Bot stopped or crashed. Restarting in 5s...")
                time.sleep(5)
                bot_proc = start_bot()
            
            time.sleep(10)
    except KeyboardInterrupt:
        print("🛑 Stopping everything...")
        dashboard_proc.terminate()
        bot_proc.terminate()

if __name__ == "__main__":
    main()
