import { findPaperNodesForSignal } from './paper-node-finder';

describe('findPaperNodesForSignal', () => {
  const nodes = [
    { id: 'rsi1', type: 'indicator', data: {} },
    { id: 'sig1', type: 'signal', data: { signalType: 'LONG' } },
    { id: 'sig2', type: 'signal', data: { signalType: 'SHORT' } },
    { id: 'paper1', type: 'paper_trading_output', data: { label: 'A' } },
    { id: 'paper2', type: 'paper_trading_output', data: { label: 'B' } },
    { id: 'paper3', type: 'paper_trading_output', data: { label: 'C' } },
    { id: 'tg1', type: 'trade_action', data: { action: 'telegram' } },
  ];
  const edges = [
    { source: 'rsi1', target: 'sig1' },
    { source: 'sig1', target: 'paper1' },
    { source: 'sig1', target: 'paper2' },
    { source: 'sig1', target: 'tg1' },
    { source: 'sig2', target: 'paper3' },
  ];

  it('находит все paper-ноды после LONG-сигнала', () => {
    expect(findPaperNodesForSignal(nodes, edges, 'LONG').sort()).toEqual(['paper1', 'paper2']);
  });

  it('находит paper-ноды только нужного signalType', () => {
    expect(findPaperNodesForSignal(nodes, edges, 'SHORT')).toEqual(['paper3']);
  });

  it('пустой результат, если paper-нод нет', () => {
    expect(findPaperNodesForSignal(nodes, [{ source: 'rsi1', target: 'sig1' }], 'LONG')).toEqual([]);
  });

  it('не падает на пустых входах', () => {
    expect(findPaperNodesForSignal([], [], 'LONG')).toEqual([]);
  });

  it('signalType по умолчанию LONG, transit через промежуточные ноды', () => {
    const n = [
      { id: 's', type: 'signal', data: {} }, // нет signalType → LONG
      { id: 'mid', type: 'trade_action', data: {} },
      { id: 'p', type: 'paper_trading_output', data: {} },
    ];
    const e = [
      { source: 's', target: 'mid' },
      { source: 'mid', target: 'p' },
    ];
    expect(findPaperNodesForSignal(n, e, 'LONG')).toEqual(['p']);
  });
});
