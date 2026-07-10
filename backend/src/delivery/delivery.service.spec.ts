import { DeliveryService } from './delivery.service';

describe('DeliveryService routing', () => {
  const makeService = (strategy: any, policyAllowed = true) => {
    const queue = { add: jest.fn() };
    const strategyRepo = { findOneBy: jest.fn().mockResolvedValue(strategy) };
    const connections = { getDecrypted: jest.fn() };
    const policy = { canDeliver: jest.fn().mockResolvedValue({ allowed: policyAllowed, reason: 'limit' }) };
    const svc = new DeliveryService(queue as any, strategyRepo as any, connections as any, policy as any);
    return { svc, queue, policy };
  };

  const signal = { strategy_id: 1, pair: 'BTCUSDT', type: 'LONG', price: 1 };

  it('enqueues one job per connected delivery node', async () => {
    const strategy = {
      id: 1,
      name: 'S',
      nodes: [
        { id: 'a', type: 'telegram_output', data: { connectionId: 'c1', chatId: '@x' } },
        { id: 'b', type: 'discord_output', data: { connectionId: 'c2' } },
        { id: 'c', type: 'indicator', data: {} },
      ],
      edges: [
        { source: 'x', target: 'a' },
        { source: 'x', target: 'b' },
      ],
    };
    const { svc, queue } = makeService(strategy);
    await svc.onSignalCreated(signal);
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add.mock.calls[0][1].nodeType).toBe('telegram_output');
    expect(queue.add.mock.calls[1][1].connectionId).toBe('c2');
  });

  it('skips delivery nodes without an incoming edge', async () => {
    const strategy = {
      id: 1, name: 'S',
      nodes: [{ id: 'a', type: 'telegram_output', data: { connectionId: 'c1' } }],
      edges: [],
    };
    const { svc, queue } = makeService(strategy);
    await svc.onSignalCreated(signal);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('skips nodes without connectionId', async () => {
    const strategy = {
      id: 1, name: 'S',
      nodes: [{ id: 'a', type: 'webhook_output', data: {} }],
      edges: [{ source: 'x', target: 'a' }],
    };
    const { svc, queue } = makeService(strategy);
    await svc.onSignalCreated(signal);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('honors policy denial', async () => {
    const strategy = {
      id: 1, name: 'S',
      nodes: [{ id: 'a', type: 'telegram_output', data: { connectionId: 'c1' } }],
      edges: [{ source: 'x', target: 'a' }],
    };
    const { svc, queue } = makeService(strategy, false);
    await svc.onSignalCreated(signal);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('ignores signals without strategy_id', async () => {
    const { svc, queue } = makeService(null);
    await svc.onSignalCreated({ pair: 'X' });
    expect(queue.add).not.toHaveBeenCalled();
  });
});
