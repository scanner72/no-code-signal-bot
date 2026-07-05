import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MLModel } from './ml-model.entity';
import { VirtualTrade } from '../paper-trading/virtual-trade.entity';
import { CandlesService } from '../candles/candles.service';
import { IndicatorsService } from '../indicators/indicators.service';
import { SignalsEngineService } from '../signals/signals-engine.service';
import { AstEvaluatorService } from '../signals/ast-evaluator.service';
import { KronosService } from '../kronos/kronos.service';
import { forwardRef, Inject } from '@nestjs/common';
import { trainRandomForest, predictForest, RFTrainResult } from './random-forest';
import { trainGradientBoosting, predictGradientBoosting, GBTrainResult } from './gradient-boosting';
import { trainLogisticRegression, predictLogisticRegression, LRTrainResult } from './logistic-regression';

type TrainedModel = RFTrainResult | GBTrainResult | LRTrainResult;

@Injectable()
export class MLService {
  private readonly logger = new Logger(MLService.name);
  private trainedModels = new Map<number, TrainedModel>();

  constructor(
    @InjectRepository(MLModel)
    private modelRepo: Repository<MLModel>,
    @InjectRepository(VirtualTrade)
    private virtualTradeRepo: Repository<VirtualTrade>,
    private candlesService: CandlesService,
    private indicators: IndicatorsService,
    private astEvaluator: AstEvaluatorService,
    @Inject(forwardRef(() => SignalsEngineService))
    private engine: SignalsEngineService,
    private kronosService: KronosService,
  ) {}

  async createModel(data: any) {
    const model = this.modelRepo.create({
      ...data,
      version: data.version || 1,
      parentId: data.parentId || null,
      isActive: data.isActive || false,
      abVariant: data.abVariant || 'NONE',
    });
    return this.modelRepo.save(model);
  }

  async createModelVersion(modelId: number) {
    const parent = await this.modelRepo.findOne({ where: { id: modelId }, relations: ['strategy'] });
    if (!parent) throw new Error('Parent model not found');

    const nextVersion = parent.version + 1;
    const child = this.modelRepo.create({
      name: `${parent.name} (v${nextVersion})`,
      strategy: parent.strategy,
      targetPair: parent.targetPair,
      targetTimeframe: parent.targetTimeframe,
      features: parent.features,
      modelType: parent.modelType,
      status: 'DRAFT',
      version: nextVersion,
      parentId: parent.id,
      isActive: false,
      abVariant: 'NONE',
    });

    return this.modelRepo.save(child);
  }

  async getStrategyModelsConfig(strategyId: number) {
    const models = await this.modelRepo.find({ 
      where: { strategy: { id: strategyId } },
      order: { version: 'DESC' }
    });
    const modelA = models.find(m => m.abVariant === 'A');
    const modelB = models.find(m => m.abVariant === 'B');
    const activeModel = models.find(m => m.isActive);

    return {
      models,
      abEnabled: !!(modelA && modelB),
      modelA,
      modelB,
      activeModel,
    };
  }

  async setAbTestConfig(strategyId: number, config: { activeModelId?: number, abEnabled: boolean, modelIdA?: number, modelIdB?: number }) {
    const models = await this.modelRepo.find({ where: { strategy: { id: strategyId } } });
    
    for (const model of models) {
      if (config.abEnabled) {
        if (model.id === config.modelIdA) {
          model.abVariant = 'A';
          model.isActive = false;
        } else if (model.id === config.modelIdB) {
          model.abVariant = 'B';
          model.isActive = false;
        } else {
          model.abVariant = 'NONE';
          model.isActive = false;
        }
      } else {
        model.abVariant = 'NONE';
        if (model.id === config.activeModelId) {
          model.isActive = true;
        } else {
          model.isActive = false;
        }
      }
      await this.modelRepo.save(model);
    }

    return this.getStrategyModelsConfig(strategyId);
  }

  async getAll() {
    return this.modelRepo.find({ relations: ['strategy'], order: { createdAt: 'DESC' } });
  }

  async deleteModel(id: number) {
    this.trainedModels.delete(id);
    return this.modelRepo.delete(id);
  }

  private predictWithModel(model: TrainedModel, features: number[]): number {
    if ('type' in model) {
      if (model.type === 'gradient_boosting') return predictGradientBoosting(model as GBTrainResult, features);
      if (model.type === 'logistic_regression') return predictLogisticRegression(model as LRTrainResult, features);
    }
    if ('trees' in model) return predictForest((model as RFTrainResult).trees, features);
    return 0.5;
  }

  private nodeToAst(node: any): any {
    const nodeType = node.type || 'unknown';
    const data = node.data || {};

    switch (nodeType) {
      case 'indicator':
        return {
          type: 'indicator',
          name: data.name,
          params: data.params || {},
          timeframe: data.timeframe,
          property: data.property,
        };
      case 'input':
        return {
          type: 'input',
          source: data.source || 'markPrice',
          params: data.params || {},
          timeframe: data.timeframe,
        };
      case 'fvg':
        return {
          type: 'fvg',
          timeframe: data.timeframe,
          params: {
            lookback: data.lookback || 50,
            minSize: data.minSize || 0,
          },
        };
      case 'order_block':
        return {
          type: 'order_block',
          timeframe: data.timeframe,
          params: {
            lookback: data.lookback || 100,
            obType: data.obType || 'BULLISH',
          },
        };
      case 'market_structure':
        return {
          type: 'market_structure',
          timeframe: data.timeframe,
          params: {
            lookback: data.lookback || 150,
          },
        };
      case 'liquidity_sweep':
        return {
          type: 'liquidity_sweep',
          timeframe: data.timeframe,
          params: {
            lookback: data.lookback || 100,
            sweepType: data.sweepType || 'ANY',
          },
        };
      case 'order_flow':
        return {
          type: 'order_flow',
          metric: data.metric || 'delta',
          period: data.period || '1h',
        };
      case 'pump_dump':
        return {
          type: 'pump_dump',
          timeframe: data.timeframe,
          params: {
            priceThreshold: data.priceThreshold || 5,
            volMultiplier: data.volMultiplier || 2,
            lookback: data.lookback || 3,
          },
        };
      case 'time_filter':
        return {
          type: 'time_filter',
          params: {
            from: data.from || '00:00',
            to: data.to || '23:59',
          },
        };
      default:
        return {
          type: nodeType,
          params: data,
        };
    }
  }

  private getAlignedValue(indicatorSeries: number[], i: number, length: number, defaultValue = 0): number {
    const diff = length - indicatorSeries.length;
    if (i < diff) return indicatorSeries[0] ?? defaultValue;
    return indicatorSeries[i - diff] ?? defaultValue;
  }

  /**
   * Build feature vectors from candle history.
   * Returns { X: number[][], y: number[], featureNames: string[] }
   */
  private async buildDataset(
    modelId: number,
    limit = 500,
  ): Promise<{ X: number[][]; y: number[]; featureNames: string[] }> {
    const model = await this.modelRepo.findOne({
      where: { id: modelId },
      relations: ['strategy'],
    });
    if (!model) throw new Error('Model not found');

    const candles = await this.candlesService.getLatestCandles(
      model.targetPair,
      model.targetTimeframe,
      limit + 150, // Increase offset to allow indicators like EMA200/SMA100 to warm up
    );
    
    // We reverse the candles to chronological order (time ascending) for calculation
    // because that's what technicalindicators expects.
    const reversed = [...candles].reverse();
    const L = reversed.length;

    const featureNodes: { name: string; ast: any; isIndicator: boolean }[] = [];
    const strategy = model.strategy;

    if (strategy && Array.isArray(model.features) && model.features.length > 0) {
      for (const featName of model.features) {
        const node = (strategy.nodes || []).find(
          (n: any) => n.id === featName || n.data?.name === featName || n.type === featName
        );
        if (node) {
          featureNodes.push({
            name: featName,
            ast: this.nodeToAst(node),
            isIndicator: ['indicator', 'input'].includes(node.type),
          });
        }
      }
    }

    // Fallback if no strategy features are defined
    if (featureNodes.length === 0) {
      this.logger.warn(`No strategy features found for model #${modelId}, falling back to static features`);
      const fallbackNodes = [
        { type: 'indicator', data: { name: 'RSI', params: { period: 14 } } },
        { type: 'indicator', data: { name: 'EMA', params: { period: 20 } } },
        { type: 'indicator', data: { name: 'EMA', params: { period: 50 } } },
        { type: 'indicator', data: { name: 'MACD', params: { fast: 12, slow: 26, signal: 9 }, property: 'histogram' } },
        { type: 'indicator', data: { name: 'BollingerBands', params: { period: 20, stdDev: 2 } } }, // BB %B calculated below
        { type: 'indicator', data: { name: 'ATR', params: { period: 14 } } }
      ];
      
      fallbackNodes.forEach((n, idx) => {
        featureNodes.push({
          name: n.data.name + '_' + idx,
          ast: this.nodeToAst(n),
          isIndicator: true
        });
      });
    }

    const featureNames = featureNodes.map(f => f.name);

    // Pre-calculate full series for pure indicators to avoid O(N^2) time complexity
    const precomputedSeries = new Map<string, number[]>();
    const context = {
      pair: model.targetPair,
      timeframe: model.targetTimeframe,
      cache: new Map<string, any[]>(),
      isBacktest: true
    };
    context.cache.set(model.targetTimeframe, candles); // evaluateNode expects newest-first candles

    for (const feat of featureNodes) {
      if (feat.isIndicator) {
        try {
          // evaluateNode takes newest-first candles and internally handles reversing for indicators
          const series = await this.astEvaluator.evaluateNode(feat.ast, candles, true, context);
          precomputedSeries.set(feat.name, Array.isArray(series) ? series : [series]);
        } catch (err) {
          this.logger.error(`Failed to precompute series for feature ${feat.name}: ${err.message}`);
          precomputedSeries.set(feat.name, []);
        }
      }
    }

    const X: number[][] = [];
    const y: number[] = [];
    const lookahead = 12; // predict 12 candles ahead
    const minIdx = 80; // warm up period
    const maxIdx = L - lookahead - 1;

    for (let i = minIdx; i < maxIdx; i++) {
      const price = parseFloat(reversed[i].close.toString());
      if (!price || price === 0) continue;

      const vector: number[] = [];
      
      for (const feat of featureNodes) {
        let val = 0;
        if (feat.isIndicator) {
          const series = precomputedSeries.get(feat.name) || [];
          val = this.getAlignedValue(series, i, L, 0);
        } else {
          // Non-indicator node: slice candles to represent history up to candle i (newest-first)
          try {
            const slice = candles.slice(L - 1 - i);
            const res = await this.astEvaluator.evaluateNode(feat.ast, slice, false, context);
            val = typeof res === 'boolean' ? (res ? 1 : 0) : (Number(res) || 0);
          } catch (err) {
            val = 0;
          }
        }

        // Normalize features
        if (feat.ast.type === 'indicator' && feat.ast.name === 'RSI') {
          val = val / 100;
        } else if (feat.ast.type === 'indicator' && ['EMA', 'SMA'].includes(feat.ast.name)) {
          val = (val - price) / price;
        } else if (feat.ast.type === 'indicator' && feat.ast.name === 'BollingerBands') {
          // If it's Bollinger Bands, map middle/upper/lower to a %B value
          const bbSeries = precomputedSeries.get(feat.name) || [];
          const rawBB = this.indicators.calculateBollingerBands(reversed.map(c => parseFloat(c.close.toString())), 20, 2);
          const bbVal = rawBB[i - (L - rawBB.length)];
          val = bbVal && bbVal.upper !== bbVal.lower
            ? (price - bbVal.lower) / (bbVal.upper - bbVal.lower)
            : 0.5;
        }

        vector.push(val);
      }

      const futurePrice = parseFloat(reversed[i + lookahead]?.close?.toString());
      if (isNaN(futurePrice)) continue;
      const target = futurePrice > price ? 1 : 0;

      X.push(vector);
      y.push(target);
    }

    this.logger.log(
      `Built dataset: ${X.length} samples, ${featureNames.length} features for model #${modelId}`,
    );

    return { X, y, featureNames };
  }

  /**
   * Train a Random Forest model on historical candle data.
   * Stores trained model in memory + serializes weights to DB.
   */
  async trainModel(modelId: number): Promise<MLModel> {
    const model = await this.modelRepo.findOne({ where: { id: modelId } });
    if (!model) throw new Error('Model not found');

    model.status = 'TRAINING';
    await this.modelRepo.save(model);

    try {
      const { X, y, featureNames } = await this.buildDataset(modelId, 1000);

      if (X.length < 50) {
        throw new Error(`Not enough data for training: ${X.length} samples (need ≥ 50)`);
      }

      // Train-test split (80/20)
      const splitIdx = Math.floor(X.length * 0.8);
      const trainX = X.slice(0, splitIdx);
      const trainY = y.slice(0, splitIdx);
      const testX = X.slice(splitIdx);
      const testY = y.slice(splitIdx);

      const modelType = model.modelType || 'random_forest';
      this.logger.log(`Training ${modelType}: ${trainX.length} train / ${testX.length} test samples`);

      let trained: TrainedModel;
      let usedKronos = false;

      if (this.kronosService.isAvailable() && ['random_forest', 'gradient_boosting'].includes(modelType)) {
        try {
          this.logger.log(`Delegating model training to Kronos FastAPI microservice...`);
          const kronosRes = await this.kronosService.trainModel(
            trainX,
            trainY,
            featureNames,
            modelType,
            { nEstimators: 100, maxDepth: modelType === 'gradient_boosting' ? 4 : 8 }
          );
          if (kronosRes && kronosRes.status === 'success' && kronosRes.weights) {
            trained = kronosRes.weights;
            usedKronos = true;
            this.logger.log(`Model successfully trained by Kronos. Accuracy: ${kronosRes.accuracy}`);
          }
        } catch (kronosErr) {
          this.logger.warn(`Kronos training failed, falling back to local JS training: ${kronosErr.message}`);
        }
      }

      if (!usedKronos) {
        switch (modelType) {
          case 'gradient_boosting':
            trained = trainGradientBoosting(trainX, trainY, featureNames, { nTrees: 100, maxDepth: 4, learningRate: 0.1 });
            break;
          case 'logistic_regression':
            trained = trainLogisticRegression(trainX, trainY, featureNames, { iterations: 1000, lr: 0.01, lambda: 0.01 });
            break;
          default:
            trained = trainRandomForest(trainX, trainY, featureNames, { nTrees: 100, maxDepth: 8, minSamples: 5 });
        }
      }

      let correct = 0;
      for (let i = 0; i < testX.length; i++) {
        const prob = this.predictWithModel(trained, testX[i]);
        if ((prob >= 0.5 ? 1 : 0) === testY[i]) correct++;
      }
      const testAccuracy = testX.length > 0 ? correct / testX.length : 0;

      // Baseline: точность «всегда предсказывать мажоритарный класс» на тесте.
      // Если accuracy модели не выше baseline — реального эджа нет, число обманчиво.
      const posCount = testY.filter((v) => v === 1).length;
      const baselineAccuracy = testY.length ? Math.max(posCount, testY.length - posCount) / testY.length : 0;

      this.trainedModels.set(modelId, trained);

      model.features = featureNames;
      model.weights = {
        ...trained,
        trainSamples: trainX.length,
        testSamples: testX.length,
        baselineAccuracy: parseFloat(baselineAccuracy.toFixed(4)),
        positiveRate: parseFloat((testY.length ? posCount / testY.length : 0).toFixed(4)),
      };
      model.accuracy = parseFloat(testAccuracy.toFixed(4));
      model.status = 'READY';
      await this.modelRepo.save(model);

      this.logger.log(
        `Model #${modelId} [${modelType}] trained: accuracy=${(testAccuracy * 100).toFixed(1)}%, ` +
          `top_feature=${Object.entries(trained.featureImportance).sort((a, b) => b[1] - a[1])[0]?.[0]}`,
      );

      return model;
    } catch (e) {
      model.status = 'FAILED';
      await this.modelRepo.save(model);
      this.logger.error(`Training failed for model #${modelId}: ${e.message}`);
      throw e;
    }
  }

  /**
   * Predict signal probability using trained Random Forest.
   * Returns [0..1] where >0.5 = bullish signal.
   */
  /**
   * Predict signal probability using trained Random Forest.
   * Returns [0..1] where >0.5 = bullish signal.
   */
  async predict(modelId: number, candles: any[], context?: any): Promise<number> {
    // Load from memory cache first
    let trained = this.trainedModels.get(modelId);
    let modelFeatures: string[] = [];
    let strategy: any = null;

    const model = await this.modelRepo.findOne({ where: { id: modelId }, relations: ['strategy'] });
    if (model) {
      modelFeatures = model.features || [];
      strategy = model.strategy;
      if (!trained && model.status === 'READY' && model.weights) {
        trained = model.weights as TrainedModel;
        this.trainedModels.set(modelId, trained);
      }
    }

    // A/B testing logic
    let targetModelId = modelId;
    let abVariantSelected = 'NONE';
    if (strategy) {
      const config = await this.getStrategyModelsConfig(strategy.id);
      if (config.abEnabled) {
        // Deterministic split 50/50 based on timestamp of the latest candle (or current time if empty)
        const hashInput = candles[0]?.time ? Number(candles[0].time) : Date.now();
        const isVariantA = hashInput % 2 === 0;
        const selectedModel = isVariantA ? config.modelA : config.modelB;
        if (selectedModel) {
          targetModelId = selectedModel.id;
          abVariantSelected = isVariantA ? 'A' : 'B';
          
          // Ensure model weights/instance are loaded
          trained = this.trainedModels.get(targetModelId);
          if (!trained && selectedModel.status === 'READY' && selectedModel.weights) {
            trained = selectedModel.weights as TrainedModel;
            this.trainedModels.set(targetModelId, trained);
          }
          modelFeatures = selectedModel.features || [];
        }
      } else if (config.activeModel) {
        // Fallback to active model override if no A/B testing is running
        targetModelId = config.activeModel.id;
        trained = this.trainedModels.get(targetModelId);
        if (!trained && config.activeModel.status === 'READY' && config.activeModel.weights) {
          trained = config.activeModel.weights as TrainedModel;
          this.trainedModels.set(targetModelId, trained);
        }
        modelFeatures = config.activeModel.features || [];
      }
    }

    // Store A/B info in context metadata if context is provided
    if (context) {
      if (!context.metadata) context.metadata = {};
      context.metadata.abVariant = abVariantSelected;
      context.metadata.modelUsedId = targetModelId;
    }

    if (!trained) return 0.5;

    try {
      const price = parseFloat(candles[0].close.toString());
      const vector: number[] = [];

      const featureNodes: { name: string; ast: any; isIndicator: boolean }[] = [];

      if (strategy && Array.isArray(modelFeatures) && modelFeatures.length > 0) {
        for (const featName of modelFeatures) {
          const node = (strategy.nodes || []).find(
            (n: any) => n.id === featName || n.data?.name === featName || n.type === featName
          );
          if (node) {
            featureNodes.push({
              name: featName,
              ast: this.nodeToAst(node),
              isIndicator: ['indicator', 'input'].includes(node.type),
            });
          }
        }
      }

      // Fallback if no strategy features are defined (must match buildDataset fallback)
      if (featureNodes.length === 0) {
        const fallbackNodes = [
          { type: 'indicator', data: { name: 'RSI', params: { period: 14 } } },
          { type: 'indicator', data: { name: 'EMA', params: { period: 20 } } },
          { type: 'indicator', data: { name: 'EMA', params: { period: 50 } } },
          { type: 'indicator', data: { name: 'MACD', params: { fast: 12, slow: 26, signal: 9 }, property: 'histogram' } },
          { type: 'indicator', data: { name: 'BollingerBands', params: { period: 20, stdDev: 2 } } },
          { type: 'indicator', data: { name: 'ATR', params: { period: 14 } } }
        ];
        
        fallbackNodes.forEach((n, idx) => {
          featureNodes.push({
            name: n.data.name + '_' + idx,
            ast: this.nodeToAst(n),
            isIndicator: true
          });
        });
      }

      const evalContext = {
        pair: strategy?.pair || 'BTCUSDT',
        timeframe: strategy?.timeframe || '1h',
        cache: new Map<string, any[]>(),
      };
      evalContext.cache.set(evalContext.timeframe, candles);

      for (const feat of featureNodes) {
        let val = 0;
        try {
          const res = await this.astEvaluator.evaluateNode(feat.ast, candles, false, evalContext);
          val = typeof res === 'boolean' ? (res ? 1 : 0) : (Number(res) || 0);
        } catch (err) {
          val = 0;
        }

        // Normalize features
        if (feat.ast.type === 'indicator' && feat.ast.name === 'RSI') {
          val = val / 100;
        } else if (feat.ast.type === 'indicator' && ['EMA', 'SMA'].includes(feat.ast.name)) {
          val = (val - price) / price;
        } else if (feat.ast.type === 'indicator' && feat.ast.name === 'BollingerBands') {
          // If it's Bollinger Bands, map middle/upper/lower to a %B value
          const rawBB = this.indicators.calculateBollingerBands(
            [...candles].reverse().map(c => parseFloat(c.close.toString())),
            20,
            2
          );
          const bbVal = rawBB[rawBB.length - 1];
          val = bbVal && bbVal.upper !== bbVal.lower
            ? (price - bbVal.lower) / (bbVal.upper - bbVal.lower)
            : 0.5;
        }

        vector.push(val);
      }

      return this.predictWithModel(trained, vector);
    } catch (e) {
      this.logger.error(`Prediction failed for target model #${targetModelId}: ${e.message}`);
      return 0.5;
    }
  }

  /** Get feature importance for a trained model */
  async getFeatureImportance(modelId: number): Promise<Record<string, number>> {
    const model = await this.modelRepo.findOne({ where: { id: modelId } });
    if (!model?.weights?.featureImportance) return {};
    return model.weights.featureImportance;
  }

  /** Backtest model against historical data */
  async backtestModel(modelId: number): Promise<{
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    samples: number;
    confusionMatrix: { tp: number; tn: number; fp: number; fn: number };
  }> {
    const { X, y } = await this.buildDataset(modelId, 800);
    const trained = this.trainedModels.get(modelId);
    if (!trained) throw new Error('Model not trained or not in memory');

    let tp = 0, tn = 0, fp = 0, fn = 0;
    for (let i = 0; i < X.length; i++) {
      const prob = this.predictWithModel(trained, X[i]);
      const pred = prob >= 0.5 ? 1 : 0;
      if (pred === 1 && y[i] === 1) tp++;
      else if (pred === 0 && y[i] === 0) tn++;
      else if (pred === 1 && y[i] === 0) fp++;
      else fn++;
    }

    const accuracy = (tp + tn) / (X.length || 1);
    const precision = tp / (tp + fp || 1);
    const recall = tp / (tp + fn || 1);
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

    return {
      accuracy: parseFloat(accuracy.toFixed(4)),
      precision: parseFloat(precision.toFixed(4)),
      recall: parseFloat(recall.toFixed(4)),
      f1: parseFloat(f1.toFixed(4)),
      samples: X.length,
      confusionMatrix: { tp, tn, fp, fn },
    };
  }

  async getAbTestStats(strategyId: number) {
    const closedTrades = await this.virtualTradeRepo.find({
      where: { strategy_id: strategyId, status: 'CLOSED' as any }
    });

    const calculateStatsForVariant = (variant: string) => {
      const variantTrades = closedTrades.filter(t => t.ab_variant === variant);
      if (variantTrades.length === 0) {
        return {
          totalTrades: 0,
          wins: 0,
          winRate: 0,
          totalPnl: 0,
          avgPnl: 0,
          profitFactor: 0,
        };
      }

      const wins = variantTrades.filter(t => Number(t.pnl_percent) > 0).length;
      const totalPnl = variantTrades.reduce((sum, t) => sum + Number(t.pnl_percent), 0);
      const grossProfit = variantTrades.filter(t => Number(t.pnl_percent) > 0).reduce((sum, t) => sum + Number(t.pnl_percent), 0);
      const grossLoss = Math.abs(variantTrades.filter(t => Number(t.pnl_percent) < 0).reduce((sum, t) => sum + Number(t.pnl_percent), 0));

      return {
        totalTrades: variantTrades.length,
        wins,
        winRate: parseFloat(((wins / variantTrades.length) * 100).toFixed(2)),
        totalPnl: parseFloat(totalPnl.toFixed(2)),
        avgPnl: parseFloat((totalPnl / variantTrades.length).toFixed(2)),
        profitFactor: grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : parseFloat(grossProfit.toFixed(2)),
      };
    };

    return {
      strategyId,
      variantA: calculateStatsForVariant('A'),
      variantB: calculateStatsForVariant('B'),
      totalClosedTrades: closedTrades.length,
    };
  }
}
