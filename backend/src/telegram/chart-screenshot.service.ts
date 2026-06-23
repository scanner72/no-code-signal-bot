import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer-core';

export interface ChartParams {
  candles: any[];
  signalType: string;
  signalPrice: number;
  pair: string;
  timeframe: string;
  rsiValues?: number[];
  tp: number;
  sl: number;
  strategyName?: string;
  time: Date;
}

const CHART_HTML = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; width: 800px; }
  #header { padding: 10px 16px 6px; display: flex; align-items: center; gap: 8px; border-bottom: 0.5px solid #f0ede8; }
  .pair { font-size: 15px; font-weight: 700; color: #1a1a1a; }
  .tf   { font-size: 10px; color: #aaa; padding: 2px 6px; background: #f5f5f4; border-radius: 4px; }
  .badge-LONG  { font-size: 11px; font-weight: 700; color: #27500A; background: #EAF3DE; padding: 2px 9px; border-radius: 4px; }
  .badge-SHORT { font-size: 11px; font-weight: 700; color: #791F1F; background: #FCEBEB; padding: 2px 9px; border-radius: 4px; }
  .entry-price { font-size: 15px; font-weight: 600; color: #1a1a1a; margin-left: auto; }
  #levels { padding: 5px 16px; display: flex; gap: 20px; border-bottom: 0.5px solid #f0ede8; background: #fafaf9; }
  .lvl { font-size: 10px; color: #999; }
  .lvl b { font-weight: 600; }
  .lvl-tp b { color: #3B6D11; }
  .lvl-sl b { color: #A32D2D; }
  .lvl-rsi b { color: #534AB7; }
  #chart     { width: 800px; height: 300px; }
  #rsi-wrap  { border-top: 0.5px solid #f0ede8; }
  #rsi-chart { width: 800px; height: 110px; }
  #footer { padding: 5px 16px; border-top: 0.5px solid #f0ede8; font-size: 9px; color: #aaa; display: flex; justify-content: space-between; background: #fafaf9; }
</style>
</head><body>
  <div id="header">
    <span class="pair" id="pair-el"></span>
    <span class="tf" id="tf-el"></span>
    <span id="badge-el"></span>
    <span class="entry-price" id="price-el"></span>
  </div>
  <div id="levels">
    <div class="lvl lvl-tp">TP <b id="tp-el">—</b></div>
    <div class="lvl lvl-sl">SL <b id="sl-el">—</b></div>
    <div class="lvl lvl-rsi">RSI(14) <b id="rsi-el">—</b></div>
  </div>
  <div id="chart"></div>
  <div id="rsi-wrap"><div id="rsi-chart"></div></div>
  <div id="footer">
    <span id="strat-el"></span>
    <span id="time-el"></span>
  </div>

<script>
window.renderChart = function(d) {
  const fmt = n => parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (a, b) => (((a - b) / b) * 100).toFixed(2);

  document.getElementById('pair-el').textContent  = d.pair;
  document.getElementById('tf-el').textContent    = d.timeframe;
  document.getElementById('price-el').textContent = '$' + fmt(d.signalPrice);
  document.getElementById('strat-el').textContent = d.strategyName || 'Signal Bot';
  document.getElementById('time-el').textContent  = new Date(d.time).toLocaleString('ru-RU');

  const badge = document.getElementById('badge-el');
  badge.textContent  = d.signalType;
  badge.className    = 'badge-' + d.signalType;

  const sign = d.signalType === 'LONG' ? '+' : '';
  document.getElementById('tp-el').textContent = '$' + fmt(d.tp) + ' (' + sign + pct(d.tp, d.signalPrice) + '%)';
  document.getElementById('sl-el').textContent = '$' + fmt(d.sl) + ' (' + pct(d.sl, d.signalPrice) + '%)';

  // Sort candles chronologically
  const candles = [...d.candles].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const toTs = c => Math.floor(new Date(c.time).getTime() / 1000);

  // ── Main chart ──
  const chart = LightweightCharts.createChart(document.getElementById('chart'), {
    width: 800, height: 300,
    layout: { background: { color: '#fff' }, textColor: '#666', fontSize: 10 },
    grid: { vertLines: { color: '#f5f5f4' }, horzLines: { color: '#f5f5f4' } },
    timeScale: { borderColor: '#e0ddd6', timeVisible: true },
    rightPriceScale: { borderColor: '#e0ddd6' },
    crosshair: { mode: 0 },
  });

  const cs = chart.addCandlestickSeries({
    upColor: '#3B6D11', downColor: '#A32D2D',
    borderVisible: false, wickUpColor: '#3B6D11', wickDownColor: '#A32D2D',
  });
  cs.setData(candles.map(c => ({
    time: toTs(c),
    open: parseFloat(c.open), high: parseFloat(c.high),
    low: parseFloat(c.low),   close: parseFloat(c.close),
  })));

  // Signal marker on last candle
  const lastTs = toTs(candles[candles.length - 1]);
  cs.setMarkers([{
    time: lastTs,
    position: d.signalType === 'LONG' ? 'belowBar' : 'aboveBar',
    color: d.signalType === 'LONG' ? '#3B6D11' : '#A32D2D',
    shape: d.signalType === 'LONG' ? 'arrowUp' : 'arrowDown',
    size: 2,
    text: d.signalType,
  }]);

  // TP / SL dashed lines
  const lineOpts = (color) => ({ color, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  const lineData = (val) => candles.map(c => ({ time: toTs(c), value: val }));
  chart.addLineSeries({ ...lineOpts('#3B6D11') }).setData(lineData(d.tp));
  chart.addLineSeries({ ...lineOpts('#A32D2D') }).setData(lineData(d.sl));

  chart.timeScale().fitContent();

  // ── RSI chart ──
  const rsiEl = document.getElementById('rsi-wrap');
  if (!d.rsiValues || d.rsiValues.length === 0) {
    rsiEl.style.display = 'none';
    return;
  }

  const lastRsi = d.rsiValues[d.rsiValues.length - 1];
  document.getElementById('rsi-el').textContent = lastRsi.toFixed(1);

  const offset = candles.length - d.rsiValues.length;
  const rsiData = d.rsiValues.map((v, i) => ({ time: toTs(candles[offset + i]), value: v }));

  const rc = LightweightCharts.createChart(document.getElementById('rsi-chart'), {
    width: 800, height: 110,
    layout: { background: { color: '#fff' }, textColor: '#888', fontSize: 9 },
    grid: { vertLines: { color: '#f5f5f4' }, horzLines: { color: '#f5f5f4' } },
    timeScale: { visible: false },
    rightPriceScale: { borderColor: '#e0ddd6', scaleMargins: { top: 0.1, bottom: 0.1 } },
    crosshair: { mode: 0 },
  });

  rc.addLineSeries({ color: '#534AB7', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true }).setData(rsiData);
  const lvl = (val, color) => rc.addLineSeries({ color, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }).setData(rsiData.map(r => ({ time: r.time, value: val })));
  lvl(70, '#A32D2D');
  lvl(30, '#3B6D11');

  rc.timeScale().fitContent();
};
</script>
</body></html>`;

@Injectable()
export class ChartScreenshotService implements OnModuleDestroy {
  private readonly logger = new Logger(ChartScreenshotService.name);
  private browser: puppeteer.Browser | null = null;

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
        headless: true,
      });
    }
    return this.browser;
  }

  async generate(params: ChartParams): Promise<Buffer | null> {
    let page: puppeteer.Page | null = null;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      await page.setViewport({ width: 800, height: 480 });
      await page.setContent(CHART_HTML, { waitUntil: 'domcontentloaded' });

      // Inject lightweight-charts from local node_modules (no CDN)
      const lwcPath = require.resolve(
        'lightweight-charts/dist/lightweight-charts.standalone.production.js',
      );
      await page.addScriptTag({ path: lwcPath });

      await page.evaluate((data) => (window as any).renderChart(data), params as any);

      // Short wait for chart rendering to complete
      await new Promise(r => setTimeout(r, 400));

      const height = params.rsiValues?.length ? 480 : 360;
      await page.setViewport({ width: 800, height });

      return (await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 800, height } })) as Buffer;
    } catch (err) {
      this.logger.error(`Chart screenshot failed: ${err.message}`);
      // Reset browser on failure so next call gets a fresh one
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
      return null;
    } finally {
      await page?.close().catch(() => {});
    }
  }
}
