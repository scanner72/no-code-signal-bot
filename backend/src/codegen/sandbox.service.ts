import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);

  async testGeneratedBot(botDir: string): Promise<{ success: boolean; output: string; error?: string }> {
    const testScriptPath = path.join(botDir, 'sandbox_test.py');
    
    // Create a robust test script that mocks the environment
    const testScript = `
import asyncio
import sys
import os
from unittest.mock import MagicMock

# Mock candles data
mock_candles = []
for i in range(100):
    mock_candles.append({
        "time": "2023-01-01T00:00:00Z",
        "open": 100.0 + i,
        "high": 110.0 + i,
        "low": 90.0 + i,
        "close": 105.0 + i,
        "volume": 1000.0,
        "quoteVolume": 100000.0,
        "priceChangePercent": 1.5,
        "funding_rate": 0.0001,
        "open_interest": 500000.0
    })

# Mock tickers data
mock_tickers = {
    "BTCUSDT": {
        "symbol": "BTCUSDT",
        "lastPrice": "60000",
        "quoteVolume": "1000000000",
        "priceChangePercent": "2.5"
    }
}

async def run_test():
    try:
        # Import the generated strategy
        sys.path.append(os.getcwd())
        from strategy import evaluate_strategy
        
        # Mock Binance client
        client = MagicMock()
        
        # Call evaluate_strategy
        result = await evaluate_strategy(
            candles=mock_candles,
            tickers=mock_tickers,
            symbol="BTCUSDT",
            client=client
        )
        
        print(f"SANDBOX_SUCCESS: result={result}")
        return True
    except Exception as e:
        import traceback
        print(f"SANDBOX_CRASH: {e}")
        print(traceback.format_exc())
        return False

if __name__ == "__main__":
    success = asyncio.run(run_test())
    sys.exit(0 if success else 1)
`;

    fs.writeFileSync(testScriptPath, testScript);

    try {
      // We run with -c to set the current directory to botDir
      const { stdout, stderr } = await execAsync(`python sandbox_test.py`, {
        cwd: botDir,
        timeout: 10000, // 10s timeout
      });

      if (stdout.includes('SANDBOX_SUCCESS')) {
        return { success: true, output: stdout };
      } else {
        return { success: false, output: stdout, error: stderr || 'Unknown error' };
      }
    } catch (e) {
      return {
        success: false,
        output: e.stdout || '',
        error: e.stderr || e.message,
      };
    } finally {
      // Clean up the test script
      if (fs.existsSync(testScriptPath)) {
        // fs.unlinkSync(testScriptPath);
      }
    }
  }
}
