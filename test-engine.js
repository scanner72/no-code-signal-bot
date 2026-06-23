async function test() {
  console.log('Testing Exchange Data (Cross-Exchange Arbitrage)');
  const payload = {
    nodes: [
      { id: '1', type: 'exchange_data', data: { exchange: 'binance', pair: 'BTCUSDT', dataType: 'price_delta', compareExchange: 'bybit' } }
    ],
    edges: []
  };
  
  try {
    const res = await fetch('http://localhost:3000/api/engine/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: '1',
        graph: payload,
        context: { pair: 'BTCUSDT' }
      })
    });
    const data = await res.json();
    console.log('Exchange Data Result:', data);
  } catch (e) {
    console.error('Exchange Data Error:', e.message);
  }
}

test();
