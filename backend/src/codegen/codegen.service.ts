import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';
import { Strategy } from '../strategies/strategy.entity';
import { AstCompilerService } from '../strategies/ast-compiler.service';
import { AstToPythonRenderer } from './ast-to-python.renderer';
import { StrategyValidatorService } from './strategy-validator.service';
import { SandboxService } from './sandbox.service';

export interface CodegenConfig {
  botName: string;
  tradingPairs: string[];
  timeframe: string;
  checkIntervalSeconds: number;
}

export interface CodegenResult {
  botId: string;
  botName: string;
  strategyName: string;
  zipPath: string;
  previewCode: string;
  files: string[];
}

@Injectable()
export class CodegenService {
  private readonly logger = new Logger(CodegenService.name);
  private readonly TEMPLATES_DIR = path.join(__dirname, 'templates');
  private readonly OUTPUT_DIR = path.join(process.cwd(), 'generated-bots');

  constructor(
    @InjectRepository(Strategy)
    private readonly strategyRepo: Repository<Strategy>,
    private readonly astCompiler: AstCompilerService,
    private readonly pythonRenderer: AstToPythonRenderer,
    private readonly validator: StrategyValidatorService,
    private readonly sandbox: SandboxService,
  ) {
    // Ensure output directory exists
    fs.mkdirSync(this.OUTPUT_DIR, { recursive: true });
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async generateBot(strategyId: number, config: CodegenConfig): Promise<CodegenResult> {
    // 1. Load strategy
    const strategy = await this.strategyRepo.findOneBy({ id: strategyId });
    if (!strategy) throw new NotFoundException(`Strategy ${strategyId} not found`);

    const nodes = strategy.nodes ?? [];
    const edges = strategy.edges ?? [];

    if (!nodes.length) {
      throw new BadRequestException('Strategy has no nodes — build the strategy first');
    }

    // 2a. Validate strategy graph
    const validation = this.validator.validate(nodes, edges);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Strategy validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // 2. Compile AST
    let ast: any;
    try {
      ast = strategy.ast ?? this.astCompiler.compile(nodes, edges);
    } catch (e) {
      throw new BadRequestException(`AST compilation failed: ${e.message}`);
    }

    // 3. Render Python strategy code
    const strategyCode = this.pythonRenderer.render(ast);

    // 4. Create output folder
    const botId   = `${this.slug(config.botName)}-${Date.now()}`;
    const botDir  = path.join(this.OUTPUT_DIR, botId);
    fs.mkdirSync(botDir, { recursive: true });

    const generatedAt = new Date().toISOString();

    // 5. Write all files
    this.writeFile(botDir, 'strategy.py', this.renderStrategyFile(strategyCode, strategy.name, ast?.signalType ?? 'LONG', config.timeframe, generatedAt));
    this.copyTemplate(botDir, 'bot.py',           this.patchBotPy(generatedAt, strategy.name, config.botName));
    this.copyTemplate(botDir, 'indicators.py');
    this.copyTemplate(botDir, 'requirements.txt');
    this.copyTemplate(botDir, 'Dockerfile');
    this.copyTemplate(botDir, 'docker-compose.yml');
    this.copyTemplate(botDir, 'dashboard.py');
    this.copyTemplate(botDir, 'start.py');
    this.writeEnvExample(botDir, config, nodes, edges);
    this.writeReadme(botDir, config, strategy.name, botId);

    // 5a. Sandbox Test
    this.logger.log(`Running sandbox test for ${botId}...`);
    const testResult = await this.sandbox.testGeneratedBot(botDir);
    if (!testResult.success) {
      this.logger.error(`Sandbox test failed for ${botId}: ${testResult.error}`);
      throw new BadRequestException({
        message: 'Generated Python code failed sandbox validation. Please check your strategy logic.',
        details: testResult.error,
        output: testResult.output,
      });
    }
    this.logger.log(`Sandbox test passed for ${botId}`);

    // 6. Pack into ZIP
    const zipPath = path.join(this.OUTPUT_DIR, `${botId}.zip`);
    await this.packZip(botDir, zipPath);

    this.logger.log(`Bot generated: ${botId} → ${zipPath}`);

    return {
      botId,
      botName:      config.botName,
      strategyName: strategy.name,
      zipPath,
      previewCode:  strategyCode,
      files: ['bot.py', 'strategy.py', 'indicators.py', 'requirements.txt', 'Dockerfile', 'docker-compose.yml', '.env.example', 'README.md'],
    };
  }

  /** Returns the path to a generated zip file */
  getZipPath(botId: string): string {
    const zipPath = path.join(this.OUTPUT_DIR, `${botId}.zip`);
    if (!fs.existsSync(zipPath)) throw new NotFoundException(`Bot ${botId} not found`);
    return zipPath;
  }

  /** Returns preview of strategy.py code without creating the bot */
  async previewStrategy(strategyId: number): Promise<string> {
    const strategy = await this.strategyRepo.findOneBy({ id: strategyId });
    if (!strategy) throw new NotFoundException(`Strategy ${strategyId} not found`);

    if (!strategy.nodes?.length) return '# No nodes in strategy yet';

    try {
      const ast = strategy.ast ?? this.astCompiler.compile(strategy.nodes, strategy.edges ?? []);
      return this.pythonRenderer.render(ast);
    } catch (e) {
      return `# Error rendering strategy: ${e.message}`;
    }
  }

  /** Validates strategy and returns detailed report */
  async validateStrategy(strategyId: number) {
    const strategy = await this.strategyRepo.findOneBy({ id: strategyId });
    if (!strategy) throw new NotFoundException(`Strategy ${strategyId} not found`);
    return this.validator.validate(strategy.nodes ?? [], strategy.edges ?? []);
  }

  // ─── File Writers ───────────────────────────────────────────────────────────

  private renderStrategyFile(
    strategyBody: string,
    strategyName: string,
    signalType: string,
    timeframe: string,
    generatedAt: string,
  ): string {
    const tpl = fs.readFileSync(path.join(this.TEMPLATES_DIR, 'strategy.py.tpl'), 'utf8');
    return tpl
      .replace(/{{STRATEGY_NAME}}/g, strategyName)
      .replace(/{{SIGNAL_TYPE}}/g,   signalType)
      .replace(/{{TIMEFRAME}}/g,     timeframe)
      .replace(/{{GENERATED_AT}}/g,  generatedAt)
      .replace('{{STRATEGY_BODY}}',  strategyBody);
  }

  private patchBotPy(generatedAt: string, strategyName: string, botName?: string): string {
    let content = fs.readFileSync(path.join(this.TEMPLATES_DIR, 'bot.py'), 'utf8');
    content = content.replace(/{{GENERATED_AT}}/g, generatedAt);
    content = content.replace(/{{STRATEGY_NAME}}/g, strategyName);
    content = content.replace(/{{BOT_NAME}}/g, botName || 'Signal Bot');
    return content;
  }

  private writeEnvExample(botDir: string, config: CodegenConfig, nodes: any[] = [], edges: any[] = []): void {
    let tpl = fs.readFileSync(path.join(this.TEMPLATES_DIR, '.env.example'), 'utf8');
    tpl = tpl
      .replace('TRADING_PAIRS=BTCUSDT,ETHUSDT,SOLUSDT', `TRADING_PAIRS=${config.tradingPairs.join(',')}`)
      .replace('TIMEFRAME=15m',   `TIMEFRAME=${config.timeframe}`)
      .replace('CHECK_INTERVAL=30', `CHECK_INTERVAL=${config.checkIntervalSeconds}`)
      .replace('BOT_NAME=My Signal Bot', `BOT_NAME=${config.botName}`);

    // Delivery nodes: routes and templates travel with the bot, secrets never
    // do — the user fills in their own credentials.
    const connected = (id: string) => edges.some((e: any) => e.target === id);
    const deliveryLines: string[] = [];
    for (const n of nodes) {
      if (!connected(n.id)) continue;
      const d = n.data || {};
      if (n.type === 'telegram_output') {
        deliveryLines.push(`# Telegram delivery node — insert YOUR bot token above (TELEGRAM_BOT_TOKEN)`);
        if (d.chatId) deliveryLines.push(`TELEGRAM_CHAT_ID=${d.chatId}`);
        if (d.template) deliveryLines.push(`TELEGRAM_TEMPLATE="${String(d.template).replace(/\n/g, '\\n')}"`);
      } else if (n.type === 'discord_output') {
        deliveryLines.push(`# Discord delivery node — insert YOUR webhook URL`, `DISCORD_WEBHOOK_URL=`);
        if (d.template) deliveryLines.push(`DISCORD_TEMPLATE="${String(d.template).replace(/\n/g, '\\n')}"`);
      } else if (n.type === 'webhook_output') {
        deliveryLines.push(`# Generic webhook delivery node — insert YOUR endpoint`, `WEBHOOK_URL=`);
        if (d.signPayload) deliveryLines.push(`WEBHOOK_HMAC_SECRET=`);
        if (d.template) deliveryLines.push(`WEBHOOK_PAYLOAD_TEMPLATE='${String(d.template).replace(/\n/g, '\\n')}'`);
      }
    }
    if (deliveryLines.length) {
      tpl += `\n# ── Signal delivery (exported from canvas delivery nodes) ──\n${deliveryLines.join('\n')}\n`;
    }
    this.writeFile(botDir, '.env.example', tpl);
  }

  private writeReadme(botDir: string, config: CodegenConfig, strategyName: string, botId: string): void {
    const readme = [
      `# ${config.botName}`,
      ``,
      `> Auto-generated by **Signal Bot Constructor**`,
      `> Strategy: **${strategyName}**`,
      `> Generated: ${new Date().toLocaleString()}`,
      ``,
      `## 🚀 Quick Start`,
      ``,
      `\`\`\`bash`,
      `# 1. Configure credentials`,
      `cp .env.example .env`,
      `nano .env   # fill in TELEGRAM_BOT_TOKEN, CHAT_ID, BINANCE keys`,
      ``,
      `# 2. Start the bot`,
      `docker-compose up -d`,
      ``,
      `# 3. View logs`,
      `docker-compose logs -f bot`,
      `\`\`\``,
      ``,
      `## ⚙️ Configuration`,
      ``,
      `| Variable | Default | Description |`,
      `|----------|---------|-------------|`,
      `| \`TELEGRAM_BOT_TOKEN\` | — | From @BotFather |`,
      `| \`TELEGRAM_CHAT_ID\`   | — | Your chat/channel ID |`,
      `| \`BINANCE_API_KEY\`    | — | Binance read-only API key |`,
      `| \`TRADING_PAIRS\`      | \`${config.tradingPairs.join(',')}\` | Comma-separated pairs |`,
      `| \`TIMEFRAME\`          | \`${config.timeframe}\` | Candle interval |`,
      `| \`CHECK_INTERVAL\`     | \`${config.checkIntervalSeconds}\` | Scan interval (seconds) |`,
      ``,
      `## 📁 Files`,
      ``,
      `| File | Description |`,
      `|------|-------------|`,
      `| \`bot.py\`        | Main entry point (static, do not edit) |`,
      `| \`strategy.py\`   | ⭐ Generated strategy logic |`,
      `| \`indicators.py\` | Technical indicator calculations |`,
      `| \`Dockerfile\`    | Container definition |`,
      `| \`docker-compose.yml\` | Multi-container setup |`,
      ``,
      `---`,
      `*Bot ID: ${botId}*`,
    ].join('\n');

    this.writeFile(botDir, 'README.md', readme);
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  private copyTemplate(botDir: string, filename: string, overrideContent?: string): void {
    const content = overrideContent ?? fs.readFileSync(path.join(this.TEMPLATES_DIR, filename), 'utf8');
    this.writeFile(botDir, filename, content);
  }

  private writeFile(dir: string, filename: string, content: string): void {
    fs.writeFileSync(path.join(dir, filename), content, 'utf8');
  }

  private slug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bot';
  }

  private packZip(sourceDir: string, zipPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false); // false = no parent dir in zip
      archive.finalize();
    });
  }
}
