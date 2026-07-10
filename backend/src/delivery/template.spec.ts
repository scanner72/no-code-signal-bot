import { buildContext, renderTemplate, DEFAULT_TEMPLATE } from './template';

describe('delivery template', () => {
  const signal = {
    pair: 'BTCUSDT',
    type: 'LONG',
    price: 100000,
    timeframe: '1h',
    metadata: { tp: 105000, sl: 98000 },
    created_at: '2026-07-10T12:00:00.000Z',
  };

  it('builds context from a signal', () => {
    const ctx = buildContext(signal, 'My Strategy');
    expect(ctx.pair).toBe('BTCUSDT');
    expect(ctx.signal).toBe('LONG');
    expect(ctx.price).toBe('100000');
    expect(ctx.strategy).toBe('My Strategy');
    expect(ctx.tp).toBe('105000');
    expect(ctx.sl).toBe('98000');
  });

  it('renders placeholders case-insensitively', () => {
    const ctx = buildContext(signal, 'S');
    expect(renderTemplate('{{PAIR}} {{Signal}} @ {{price}}', ctx)).toBe('BTCUSDT LONG @ 100000');
  });

  it('keeps unknown placeholders as-is', () => {
    const ctx = buildContext(signal, 'S');
    expect(renderTemplate('{{pair}} {{unknown}}', ctx)).toBe('BTCUSDT {{unknown}}');
  });

  it('handles missing tp/sl with a dash', () => {
    const ctx = buildContext({ ...signal, metadata: {} }, 'S');
    expect(ctx.tp).toBe('-');
    expect(ctx.sl).toBe('-');
  });

  it('default template renders without leftovers', () => {
    const ctx = buildContext(signal, 'S');
    const out = renderTemplate(DEFAULT_TEMPLATE, ctx);
    expect(out).not.toMatch(/\{\{/);
    expect(out).toContain('BTCUSDT');
  });
});
