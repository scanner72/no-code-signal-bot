// Message template rendering for delivery nodes. Placeholders are
// case-insensitive and match the legacy trade_action format:
// {{pair}} {{signal}} {{price}} {{strategy}} {{tp}} {{sl}} {{timeframe}} {{time}}

export interface TemplateContext {
  pair: string;
  signal: string;
  price: string;
  strategy: string;
  tp: string;
  sl: string;
  timeframe: string;
  time: string;
}

export function buildContext(signal: any, strategyName: string): TemplateContext {
  return {
    pair: signal.pair ?? '',
    signal: signal.type ?? '',
    price: signal.price != null ? String(signal.price) : '',
    strategy: strategyName,
    tp: signal.metadata?.tp != null ? String(signal.metadata.tp) : '-',
    sl: signal.metadata?.sl != null ? String(signal.metadata.sl) : '-',
    timeframe: signal.timeframe ?? '',
    time: new Date(signal.created_at ?? Date.now()).toISOString(),
  };
}

export function renderTemplate(template: string, ctx: TemplateContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = (ctx as any)[key.toLowerCase()];
    return value !== undefined ? String(value) : match;
  });
}

export const DEFAULT_TEMPLATE =
  '🚨 {{signal}} {{pair}} @ {{price}}\nСтратегия: {{strategy}}\nTP: {{tp}} | SL: {{sl}} | TF: {{timeframe}}';
