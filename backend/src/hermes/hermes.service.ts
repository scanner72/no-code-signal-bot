import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RedisService } from '../redis/redis.service';
import { SettingsService } from '../settings/settings.service';
import { LdrService } from '../ldr/ldr.service';
import axios from 'axios';
import * as crypto from 'crypto';

export type HermesProvider = 'hermes' | 'ollama' | 'openai';

interface HermesNodeParams {
  mode: 'filter' | 'score';
  promptTemplate: string;
  threshold?: number;
  cacheMinutes: number;
  model: string;
}

interface HermesDecision {
  decision: 'PASS' | 'BLOCK';
  confidence: number;
  reason: string;
}

/** Runtime config loaded from DB (with env-var fallback). Hot-reloads on settings change. */
interface HermesRuntimeConfig {
  provider: HermesProvider;
  apiUrl: string;
  model: string;
  apiKey: string;
}

@Injectable()
export class HermesService {
  private readonly logger = new Logger(HermesService.name);
  private cfg: HermesRuntimeConfig;

  constructor(
    private readonly redisService: RedisService,
    private readonly settingsService: SettingsService,
    private readonly ldrService: LdrService,
  ) {}

  async onModuleInit() {
    await this.reloadConfig();
  }

  @OnEvent('hermes.config.updated')
  async onConfigUpdated() {
    this.logger.log('Hermes config updated — reloading...');
    await this.reloadConfig();
  }

  private async reloadConfig(): Promise<void> {
    const provider = ((await this.settingsService.get('hermes_provider')) ||
      process.env.HERMES_PROVIDER ||
      'hermes') as HermesProvider;

    const apiUrl =
      (await this.settingsService.get('hermes_api_url'))?.trim() ||
      process.env.HERMES_API_URL ||
      'http://hermes:7700';

    const model =
      (await this.settingsService.get('hermes_model'))?.trim() ||
      process.env.HERMES_MODEL ||
      'nous-hermes-3';

    const apiKey =
      (await this.settingsService.get('hermes_api_key'))?.trim() ||
      process.env.HERMES_API_KEY ||
      '';

    this.cfg = { provider, apiUrl, model, apiKey };
    this.logger.log(
      `Hermes config loaded: provider=${provider} url=${apiUrl} model=${model}`,
    );
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * 🧠 THREE-LAYER AI SYNERGY: filter + LDR knowledge research.
   *
   * This is the full cognitive pipeline:
   *   1. LDR (Knowledge Layer) fetches real-world macro data about the pair.
   *   2. Hermes (Cognitive Layer) receives both market context + LDR findings and decides.
   *
   * Used when `enableLdrResearch: true` is set on a Hermes node.
   */
  async filterWithResearch(
    context: any,
    nodeParams: HermesNodeParams,
    ldrQuery?: string,
    ldrMode: 'quick' | 'detailed' = 'quick',
  ): Promise<HermesDecision> {
    // 1. Knowledge Layer: Fetch LDR research
    const query = ldrQuery ||
      `Analyze recent news, regulatory risks, and market sentiment for ${context.pair || 'BTC'} cryptocurrency. Are there any hacks, exploits, legal issues or negative catalysts?`;

    const research = await this.ldrService.research(
      query,
      context.pair || 'BTCUSDT',
      ldrMode,
      nodeParams.cacheMinutes,
    );

    this.logger.log(
      `LDR research for ${context.pair}: sentiment=${research.sentiment} risk=${research.riskLevel} (cached=${research.cached})`,
    );

    // 2. If LDR detects critical risk — immediately BLOCK without LLM call
    if (research.riskLevel === 'critical') {
      return {
        decision: 'BLOCK',
        confidence: 0.97,
        reason: `LDR detected CRITICAL risk: ${research.summary.substring(0, 200)}`,
      };
    }

    // 3. Enrich context with LDR findings for Hermes LLM prompt
    const enrichedContext = {
      ...context,
      ldr_summary: research.summary,
      ldr_sentiment: research.sentiment,
      ldr_sentiment_score: research.sentimentScore,
      ldr_risk_level: research.riskLevel,
      ldr_key_findings: research.keyFindings.join('; '),
    };

    // 4. Cognitive Layer: Hermes LLM makes final decision with enriched context
    return this.filter(enrichedContext, nodeParams);
  }

  async filter(context: any, nodeParams: HermesNodeParams): Promise<HermesDecision> {
    let template = nodeParams.promptTemplate;
    try {
      const globalTemplate = await this.settingsService.get('hermes_custom_prompt_template');
      if (globalTemplate && globalTemplate.trim()) {
        template = globalTemplate;
      }
    } catch (e) {
      this.logger.warn(`Failed to load global prompt template: ${e.message}`);
    }

    const cacheKey = `hermes:v3:${context.pair || 'unknown'}:${context.timeframe || 'unknown'}:${this.hash(context)}:${this.hash(template)}`;

    if (nodeParams.cacheMinutes > 0) {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Hermes cache hit for ${context.pair}`);
        return JSON.parse(cached);
      }
    }

    const prompt = this.buildPrompt(template, context);
    const effectiveModel = nodeParams.model || this.cfg.model;

    try {
      this.logger.debug(
        `Hermes [${this.cfg.provider}] calling ${this.cfg.apiUrl} model=${effectiveModel} prompt=${prompt.substring(0, 80)}...`,
      );

      const rawOutput = await this.callProvider(prompt, effectiveModel);
      const decision = this.parseDecision(rawOutput);

      this.logger.log(
        `Hermes decision: ${decision.decision} (confidence=${decision.confidence.toFixed(2)}) for ${context.pair}`,
      );

      if (nodeParams.cacheMinutes > 0) {
        await this.redisService.set(
          cacheKey,
          JSON.stringify(decision),
          nodeParams.cacheMinutes * 60,
        );
      }

      return decision;
    } catch (error) {
      const msg = error?.response?.data?.detail || error?.response?.data?.error?.message || error.message;
      this.logger.error(`Hermes Agent error: ${msg}`);
      return { decision: 'PASS', confidence: 1.0, reason: `Hermes unavailable: ${msg}` };
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.callProvider('Reply with exactly: OK', this.cfg.model);
      return true;
    } catch {
      return false;
    }
  }

  get currentConfig(): Readonly<HermesRuntimeConfig> {
    return this.cfg;
  }

  // ─── Provider adapters ───────────────────────────────────────────────────

  /**
   * Calls the configured LLM provider and returns the raw text output.
   * Each provider has a different request/response shape.
   */
  private async callProvider(prompt: string, model: string): Promise<any> {
    const { provider, apiUrl, apiKey } = this.cfg;

    switch (provider) {
      case 'hermes':
        return this.callHermesAgent(prompt, apiUrl);

      case 'ollama':
        return this.callOllama(prompt, model, apiUrl);

      case 'openai':
        return this.callOpenAI(prompt, model, apiUrl, apiKey);

      default:
        return this.callHermesAgent(prompt, apiUrl);
    }
  }

  /** Custom Hermes Agent (existing service) — POST /run */
  private async callHermesAgent(prompt: string, apiUrl: string): Promise<any> {
    const response = await axios.post(
      `${apiUrl}/run`,
      {
        task: prompt,
        tools: [],
        structured_output: {
          decision: 'PASS or BLOCK',
          confidence: 'number between 0 and 1',
          reason: 'brief explanation',
        },
      },
      { timeout: 60_000, headers: { 'Content-Type': 'application/json' } },
    );
    return response.data;
  }

  /** Ollama — POST /api/generate (completion style, simpler) */
  private async callOllama(prompt: string, model: string, apiUrl: string): Promise<any> {
    const fullPrompt =
      `${prompt}\n\nRespond with ONLY a JSON object: {"decision":"PASS" or "BLOCK","confidence":0.0-1.0,"reason":"brief explanation"}`;

    const response = await axios.post(
      `${apiUrl}/api/generate`,
      { model, prompt: fullPrompt, stream: false },
      { timeout: 120_000, headers: { 'Content-Type': 'application/json' } },
    );
    // Ollama /api/generate returns { response: "..." }
    return response.data?.response ?? response.data;
  }

  /** OpenAI-compatible — POST /v1/chat/completions (OpenAI, Groq, Together, LM Studio…) */
  private async callOpenAI(
    prompt: string,
    model: string,
    apiUrl: string,
    apiKey: string,
  ): Promise<any> {
    const base = apiUrl.replace(/\/v1\/?$/, '');
    const response = await axios.post(
      `${base}/v1/chat/completions`,
      {
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a trading signal validator. Always respond with a JSON object only: ' +
              '{"decision":"PASS" or "BLOCK","confidence":0.0-1.0,"reason":"brief explanation"}',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 256,
      },
      {
        timeout: 60_000,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      },
    );
    // OpenAI response: choices[0].message.content
    return response.data?.choices?.[0]?.message?.content ?? response.data;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private hash(data: any): string {
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  private buildPrompt(template: string, context: any): string {
    let prompt = template;
    for (const [key, value] of Object.entries(context)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return prompt;
  }

  /**
   * Robust response parser: handles string, object, markdown code blocks.
   * Always returns a valid HermesDecision, never throws.
   */
  private parseDecision(responseData: any): HermesDecision {
    try {
      let content = responseData;

      if (typeof content === 'string') {
        const jsonBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonBlockMatch) {
          content = JSON.parse(jsonBlockMatch[1].trim());
        } else {
          const trimmed = content.trim();
          if (trimmed.startsWith('{')) {
            content = JSON.parse(trimmed);
          } else {
            const jsonInText = trimmed.match(/\{[\s\S]*\}/);
            if (jsonInText) {
              content = JSON.parse(jsonInText[0]);
            } else {
              const upperText = trimmed.toUpperCase();
              return {
                decision: upperText.includes('BLOCK') ? 'BLOCK' : 'PASS',
                confidence: 0.7,
                reason: trimmed.substring(0, 200),
              };
            }
          }
        }
      }

      const decision = String(content?.decision || 'PASS').toUpperCase() as 'PASS' | 'BLOCK';
      const confidence =
        typeof content?.confidence === 'number'
          ? Math.min(1, Math.max(0, content.confidence))
          : 0.8;

      return {
        decision: decision === 'BLOCK' ? 'BLOCK' : 'PASS',
        confidence,
        reason: String(content?.reason || 'No reason provided').substring(0, 500),
      };
    } catch (e) {
      this.logger.warn(`Failed to parse Hermes response: ${e.message}`);
      return { decision: 'PASS', confidence: 1.0, reason: 'Parse error — default PASS' };
    }
  }
}
