export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  details?: any;
}

class ParseLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  log(level: LogLevel, message: string, details?: any) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      details,
    };
    this.logs.push(entry);

    // Keep size bounded
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Always log to browser console
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    const prefix = `[${level.toUpperCase()}]`;
    if (consoleMethod === 'error') {
      console.error(prefix, message, details);
    } else if (consoleMethod === 'warn') {
      console.warn(prefix, message, details);
    } else {
      console.log(prefix, message, details);
    }
  }

  info(message: string, details?: any) {
    this.log('info', message, details);
  }

  debug(message: string, details?: any) {
    this.log('debug', message, details);
  }

  warn(message: string, details?: any) {
    this.log('warn', message, details);
  }

  error(message: string, details?: any) {
    this.log('error', message, details);
  }

  success(message: string, details?: any) {
    this.log('success', message, details);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }

  getLogsSince(timestamp: number): LogEntry[] {
    return this.logs.filter(l => l.timestamp >= timestamp);
  }

  export(): string {
    return this.logs
      .map(l => `[${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] ${l.message}${l.details ? ' ' + JSON.stringify(l.details) : ''}`)
      .join('\n');
  }

  downloadAsFile(): void {
    const content = this.export();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `pine-import-${timestamp}.log`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const allErrors = this.logs.filter(l => l.level === 'error' || l.level === 'warn').map(l => l.message);
    const content = this.export();

    // Check for v6-specific issues
    if (content.includes('arrays')) {
      recommendations.push('❌ Найдены array.new() → удалите или переработайте на переменные');
    }
    if (content.includes('maps')) {
      recommendations.push('❌ Найдены map.new() → замените на простые переменные или структуры');
    }
    if (content.includes('for loops') || content.includes('while loops')) {
      recommendations.push('❌ Найдены циклы (for/while) → распакуйте логику в отдельные условия');
    }
    if (content.includes('drawing objects')) {
      recommendations.push('❌ Найдены drawing objects (line, label, box, table) → удалите, они не влияют на сигналы');
    }
    if (content.includes('custom types') || content.includes('methods') || content.includes('library imports')) {
      recommendations.push('❌ Найдена OOP логика (type/method/import) → этот парсер поддерживает только процедурный код');
    }
    if (content.includes('v6') && content.includes('Fallback')) {
      recommendations.push('💡 Это Pine Script v6 в fallback режиме → может быть несовместим с парсером');
    }
    if (content.includes('No indicators recognized')) {
      recommendations.push('💡 Парсер не распознал индикаторы → скрипт помещён в Custom Code node для ручной обработки');
    }

    // Check quality
    const qualityLog = this.logs.find(l => l.level === 'success' && l.message.includes('Parse complete'));
    if (qualityLog?.details?.quality === 'fallback') {
      recommendations.push('⚠️ Режим fallback активирован → попробуйте отредактировать Pine Script');
      recommendations.push('✅ Альтернатива: создайте стратегию вручную в Strategy Builder');
    } else if (qualityLog?.details?.quality === 'partial') {
      recommendations.push('⚠️ Распарсено частично (< 90%) → проверьте логи на наличие пропущенных функций');
    } else if (qualityLog?.details?.quality === 'full') {
      recommendations.push('✅ Парсинг успешен! Стратегия готова к использованию');
    }

    return recommendations;
  }
}

export const parseLogger = new ParseLogger();
