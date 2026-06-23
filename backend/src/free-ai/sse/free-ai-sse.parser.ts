import { Injectable, Logger } from '@nestjs/common';

export interface NormalizedChunk {
  thinking: string;
  answer: string;
  done: boolean;
}

export interface DeepSeekState {
  thinking: string;
  answer: string;
  currentPath: string;
}

/**
 * FreeAiSseParser
 * Normalizes SSE streams from Qwen and DeepSeek into a unified format.
 * Qwen: reasoning_content / phase="think"
 * DeepSeek: JSON-Patch stateful streams or delta format
 */
@Injectable()
export class FreeAiSseParser {
  private readonly logger = new Logger(FreeAiSseParser.name);

  parseQwenChunk(rawLine: string): NormalizedChunk | null {
    if (!rawLine.startsWith('data:')) return null;
    const data = rawLine.slice(5).trim();
    if (data === '[DONE]') return { thinking: '', answer: '', done: true };
    try {
      const parsed = JSON.parse(data);
      const delta = parsed?.choices?.[0]?.delta;
      if (!delta) return null;
      const phase: string = delta.phase || '';
      const content: string = delta.content || delta.reasoning_content || '';
      if (phase === 'think' || delta.reasoning_content) {
        return { thinking: content, answer: '', done: false };
      }
      return { thinking: '', answer: content, done: false };
    } catch { return null; }
  }

  parseDeepSeekChunk(rawLine: string, state: DeepSeekState): NormalizedChunk | null {
    if (!rawLine.startsWith('data:')) return null;
    const data = rawLine.slice(5).trim();
    if (data === '[DONE]') return { thinking: state.thinking, answer: state.answer, done: true };
    try {
      const parsed = JSON.parse(data);
      const delta = parsed?.choices?.[0]?.delta;
      if (delta) {
        if (delta.reasoning_content) { state.thinking += delta.reasoning_content; }
        if (delta.content) { state.answer += delta.content; }
        return { thinking: state.thinking, answer: state.answer, done: false };
      }

      if (parsed.p !== undefined) {
        state.currentPath = parsed.p;
      }

      if (parsed.v !== undefined) {
        const v = typeof parsed.v === 'string' ? parsed.v : '';
        const op = parsed.o;
        const isReasoning = state.currentPath.includes('thinking_content');
        const isContent = state.currentPath.includes('response/content') || (state.currentPath === 'response/content');

        if (isReasoning) {
          if (op === 'SET' || op === 'REPLACE') {
            state.thinking = v;
          } else {
            state.thinking += v;
          }
        } else if (isContent) {
          if (op === 'SET' || op === 'REPLACE') {
            state.answer = v;
          } else {
            state.answer += v;
          }
        }
      }

      if (parsed.p === 'response/status' && parsed.v === 'FINISHED') {
        return { thinking: state.thinking, answer: state.answer, done: true };
      }

      return { thinking: state.thinking, answer: state.answer, done: false };
    } catch { return null; }
  }

  createDeepSeekState(): DeepSeekState { return { thinking: '', answer: '', currentPath: '' }; }

  accumulateQwenStream(lines: string[]): NormalizedChunk {
    let thinking = ''; let answer = '';
    for (const line of lines) {
      const chunk = this.parseQwenChunk(line);
      if (!chunk) continue;
      thinking += chunk.thinking; answer += chunk.answer;
      if (chunk.done) break;
    }
    return { thinking, answer, done: true };
  }

  accumulateDeepSeekStream(lines: string[]): NormalizedChunk {
    const state = this.createDeepSeekState();
    for (const line of lines) {
      const chunk = this.parseDeepSeekChunk(line, state);
      if (chunk?.done) break;
    }
    return { thinking: state.thinking, answer: state.answer, done: true };
  }
}
