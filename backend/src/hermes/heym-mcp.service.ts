import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import axios, { AxiosInstance } from 'axios';
import { SettingsService } from '../settings/settings.service';

export interface HeymWorkflowResult {
  success: boolean;
  output: any;
  executionId?: string;
  error?: string;
}

export interface HeymMcpTool {
  id: string;
  name: string;
  description: string;
  workflowId: string;
}

export interface SignalValidationResult {
  decision: 'PASS' | 'BLOCK';
  confidence: number;
  reason: string;
  heymExecutionId?: string;
}

/**
 * HeymMcpService
 *
 * Integrates with the heym AI workflow platform.
 *
 * Config priority (highest → lowest):
 *   1. Database (Settings page → Integrations → heym)
 *   2. Environment variables (HEYM_API_URL, HEYM_API_KEY, HEYM_SIGNAL_VALIDATOR_ID)
 *
 * Hot-reloads when the user saves new config in Settings UI.
 */
@Injectable()
export class HeymMcpService implements OnModuleInit {
  private readonly logger = new Logger(HeymMcpService.name);
  private isAvailable = false;

  // Runtime config — updated from DB on init and on heym.config.updated event
  private heymBaseUrl: string;
  private heymApiKey: string;
  private client: AxiosInstance;

  constructor(private readonly settingsService: SettingsService) {}

  async onModuleInit() {
    await this.reloadConfig();
  }

  /** Listen for config changes saved via the Settings UI */
  @OnEvent('heym.config.updated')
  async onConfigUpdated() {
    this.logger.log('heym config updated — reloading...');
    await this.reloadConfig();
  }

  /**
   * Reload config from DB (falls back to env vars if DB values are empty).
   * Re-creates the axios client and re-pings heym.
   */
  private async reloadConfig(): Promise<void> {
    const dbUrl = await this.settingsService.get('heym_api_url');
    const dbKey = await this.settingsService.get('heym_api_key');

    this.heymBaseUrl =
      dbUrl?.trim() ||
      process.env.HEYM_API_URL ||
      'http://localhost:4017/api';

    this.heymApiKey =
      dbKey?.trim() ||
      process.env.HEYM_API_KEY ||
      '';

    this.client = axios.create({
      baseURL: this.heymBaseUrl,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.heymApiKey ? { 'X-MCP-Key': this.heymApiKey } : {}),
      },
    });

    if (!this.heymApiKey) {
      this.isAvailable = false;
      this.logger.warn(
        'heym API Key not configured. ' +
        'Go to Settings → Integrations → heym to set it up.',
      );
      return;
    }

    await this.ping();
  }

  /** Check heym availability */
  async ping(): Promise<boolean> {
    try {
      // heym doesn't expose /health, use /workflows as a probe
      await this.client.get('/workflows');
      this.isAvailable = true;
      this.logger.log(`✅ heym MCP connected at ${this.heymBaseUrl}`);
      return true;
    } catch (err: any) {
      this.isAvailable = false;
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        this.logger.warn(`⚠️ heym MCP: invalid API key (${status})`);
      } else {
        this.logger.warn(`⚠️ heym MCP not reachable at ${this.heymBaseUrl}: ${err.message}`);
      }
      return false;
    }
  }

  get available(): boolean {
    return this.isAvailable;
  }

  get mcpSseUrl(): string {
    return this.heymBaseUrl.replace(/\/api$/, '') + '/api/mcp/sse';
  }

  /**
   * List all MCP-enabled workflows from heym.
   */
  async listMcpTools(): Promise<HeymMcpTool[]> {
    if (!this.isAvailable) return [];
    try {
      const resp = await this.client.get('/mcp/tools');
      return resp.data?.tools || resp.data || [];
    } catch (err: any) {
      this.logger.warn(`Failed to list heym MCP tools: ${err.message}`);
      return [];
    }
  }

  /**
   * Run any heym workflow by its ID with given input data.
   */
  async callWorkflow(
    workflowId: string,
    inputData: Record<string, any>,
  ): Promise<HeymWorkflowResult> {
    if (!this.isAvailable) {
      return { success: false, output: null, error: 'heym not available' };
    }

    try {
      const resp = await this.client.post(`/workflows/${workflowId}/run`, {
        input: inputData,
      });

      const data = resp.data;
      return {
        success: true,
        output: data.output ?? data.result ?? data,
        executionId: data.executionId ?? data.id,
      };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message;
      this.logger.error(`heym workflow ${workflowId} failed: ${msg}`);
      return { success: false, output: null, error: msg };
    }
  }

  /**
   * Validate a trading signal via the "Signal Validator" workflow in heym.
   * Falls back gracefully to PASS if heym is unavailable or not configured.
   */
  async validateSignal(context: {
    pair: string;
    timeframe: string;
    price: number;
    rsi: number;
    volume: number;
    trend: string;
    signalType: string;
    additionalContext?: string;
  }): Promise<SignalValidationResult> {
    const fallback: SignalValidationResult = {
      decision: 'PASS',
      confidence: 1.0,
      reason: 'heym MCP unavailable — defaulting to PASS',
    };

    if (!this.isAvailable || !this.heymApiKey) {
      return fallback;
    }

    // Read workflowId from DB (fallback to env)
    const workflowId =
      (await this.settingsService.get('heym_signal_validator_id'))?.trim() ||
      process.env.HEYM_SIGNAL_VALIDATOR_ID ||
      '';

    if (!workflowId) {
      this.logger.debug('heym Signal Validator workflow ID not set — skipping validation');
      return fallback;
    }

    const inputText = this.buildSignalPrompt(context);

    try {
      const result = await this.callWorkflow(workflowId, { input: inputText });
      if (!result.success) return fallback;
      return this.parseValidationResult(result.output, result.executionId);
    } catch (err: any) {
      this.logger.warn(`heym signal validation error: ${err.message}`);
      return fallback;
    }
  }

  private buildSignalPrompt(context: {
    pair: string;
    timeframe: string;
    price: number;
    rsi: number;
    volume: number;
    trend: string;
    signalType: string;
    additionalContext?: string;
  }): string {
    return (
      `Trading signal validation request:\n` +
      `Symbol: ${context.pair}\n` +
      `Timeframe: ${context.timeframe}\n` +
      `Signal Type: ${context.signalType}\n` +
      `Current Price: ${context.price}\n` +
      `RSI (14): ${context.rsi.toFixed(2)}\n` +
      `Volume: ${context.volume.toFixed(2)}\n` +
      `Trend: ${context.trend}\n` +
      (context.additionalContext ? `\nAdditional context:\n${context.additionalContext}` : '') +
      `\n\nShould this ${context.signalType} signal be executed? ` +
      `Reply with JSON only: {"decision": "PASS" or "BLOCK", "confidence": 0.0-1.0, "reason": "brief explanation"}`
    );
  }

  private parseValidationResult(
    output: any,
    executionId?: string,
  ): SignalValidationResult {
    const fallback: SignalValidationResult = {
      decision: 'PASS',
      confidence: 0.8,
      reason: 'heym output parse error — defaulting to PASS',
      heymExecutionId: executionId,
    };

    try {
      let parsed: any;

      if (typeof output === 'object' && output !== null) {
        parsed = output;
      } else if (typeof output === 'string') {
        const jsonMatch = output.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        const rawJson = jsonMatch ? jsonMatch[1].trim() : output.trim();
        const braceMatch = rawJson.match(/\{[\s\S]*\}/);
        if (!braceMatch) {
          const upper = rawJson.toUpperCase();
          return {
            decision: upper.includes('BLOCK') ? 'BLOCK' : 'PASS',
            confidence: 0.7,
            reason: rawJson.substring(0, 300),
            heymExecutionId: executionId,
          };
        }
        parsed = JSON.parse(braceMatch[0]);
      } else {
        return fallback;
      }

      const decision = String(parsed?.decision || 'PASS').toUpperCase();
      const confidence =
        typeof parsed?.confidence === 'number'
          ? Math.min(1, Math.max(0, parsed.confidence))
          : 0.8;

      return {
        decision: decision === 'BLOCK' ? 'BLOCK' : 'PASS',
        confidence,
        reason: String(parsed?.reason || 'No reason provided').substring(0, 500),
        heymExecutionId: executionId,
      };
    } catch {
      return fallback;
    }
  }
}
