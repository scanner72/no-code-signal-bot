import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MLModel } from './ml-model.entity';
import { CandlesService } from '../candles/candles.service';
import { IndicatorsService } from '../indicators/indicators.service';
import { SignalsEngineService } from '../signals/signals-engine.service';
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
    private candlesService: CandlesService,
    private indicators: IndicatorsService,
    @Inject(forwardRef(() => SignalsEngineService))
    private engine: SignalsEngineService,
  ) {}

  async createModel(data: any) {
    const model = this.modelRepo.create(data);
    return this.modelRepo.save(model);
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
      limit + 60,
    );
    const reversed = [...candles].reverse();

    // Fixed feature set: RSI(14), EMA20, EMA50, MACD_hist, BollingerBand_%B, Volume_ratio, Price_change_1, Price_change_3
    const featureNames = [
      'rsi_14',
      'ema20_diff',
      'ema50_diff',
      'macd_hist',
      'bb_pct',
      'vol_ratio',
      'price_chg_1',
      'price_chg_3',
      'price_chg_5',
      'atr_pct',
    ];

    const X: number[][] = [];
    const y: number[] = [];
    const lookahead = 12; // predict 12 candles ahead

    const closes = reversed.map(c => parseFloat(c.close.toString()));
    const highs = reversed.map(c => parseFloat(c.high.toString()));
    const lows = reversed.map(c => parseFloat(c.low.toString()));
    const volumes = reversed.map(c => parseFloat(c.volume.toString()));

    // Pre-compute full arrays
    const rsi14 = this.indicators.calculateRSI(closes, 14);
    const ema20 = this.indicators.calculateEMA(closes, 20);
    const ema50 = this.indicators.calculateEMA(closes, 50);
    const macd = this.indicators.calculateMACD(closes, 12, 26, 9);
    const bb = this.indicators.calculateBollingerBands(closes, 20, 2);
    const atr = this.indicators.calculateATR(highs, lows, closes, 14);

    const minIdx = 60; // need enough history for indicators
    const maxIdx = reversed.length - lookahead - 1;

    for (let i = minIdx; i < maxIdx; i++) {
      const price = closes[i];
      if (!price || price === 0) continue;

      const rsiVal = rsi14[i] ?? 50;
      const ema20Val = ema20[i] ?? price;
      const ema50Val = ema50[i] ?? price;
      const macdVal = macd[i]?.histogram ?? 0;
      const bbVal = bb[i];
      const bbPct = bbVal
        ? bbVal.upper !== bbVal.lower
          ? (price - bbVal.lower) / (bbVal.upper - bbVal.lower)
          : 0.5
        : 0.5;

      const volAvg =
        volumes.slice(Math.max(0, i - 20), i).reduce((s, v) => s + v, 0) / 20 || 1;
      const volRatio = volumes[i] / volAvg;

      const priceChg1 = i >= 1 ? (price - closes[i - 1]) / closes[i - 1] : 0;
      const priceChg3 = i >= 3 ? (price - closes[i - 3]) / closes[i - 3] : 0;
      const priceChg5 = i >= 5 ? (price - closes[i - 5]) / closes[i - 5] : 0;
      const atrPct = atr[i] ? atr[i] / price : 0;

      const features = [
        rsiVal / 100, // normalize 0..1
        (ema20Val - price) / price,
        (ema50Val - price) / price,
        macdVal / price,
        bbPct,
        Math.min(volRatio, 10) / 10, // cap at 10x
        priceChg1,
        priceChg3,
        priceChg5,
        atrPct,
      ];

      // Target: did price go up in next lookahead candles?
      const futurePrice = closes[i + lookahead];
      if (!futurePrice) continue;
      const target = futurePrice > price ? 1 : 0;

      X.push(features);
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

      let correct = 0;
      for (let i = 0; i < testX.length; i++) {
        const prob = this.predictWithModel(trained, testX[i]);
        if ((prob >= 0.5 ? 1 : 0) === testY[i]) correct++;
      }
      const testAccuracy = testX.length > 0 ? correct / testX.length : 0;

      this.trainedModels.set(modelId, trained);

      model.features = featureNames;
      model.weights = { ...trained, trainSamples: trainX.length, testSamples: testX.length };
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
  async predict(modelId: number, candles: any[]): Promise<number> {
    // Load from memory cache first
    let trained = this.trainedModels.get(modelId);

    if (!trained) {
      const model = await this.modelRepo.findOne({ where: { id: modelId } });
      if (!model || model.status !== 'READY' || !model.weights) return 0.5;

      trained = model.weights as TrainedModel;
      this.trainedModels.set(modelId, trained);
    }

    try {
      const closes = candles.map(c => parseFloat(c.close.toString())).reverse();
      const highs = candles.map(c => parseFloat(c.high.toString())).reverse();
      const lows = candles.map(c => parseFloat(c.low.toString())).reverse();
      const volumes = candles.map(c => parseFloat(c.volume.toString())).reverse();

      const n = closes.length;
      if (n < 60) return 0.5;

      const price = closes[n - 1];
      const rsi14 = this.indicators.calculateRSI(closes, 14);
      const ema20 = this.indicators.calculateEMA(closes, 20);
      const ema50 = this.indicators.calculateEMA(closes, 50);
      const macd = this.indicators.calculateMACD(closes, 12, 26, 9);
      const bb = this.indicators.calculateBollingerBands(closes, 20, 2);
      const atr = this.indicators.calculateATR(highs, lows, closes, 14);

      const rsiVal = rsi14[n - 1] ?? 50;
      const ema20Val = ema20[n - 1] ?? price;
      const ema50Val = ema50[n - 1] ?? price;
      const macdHist = macd[n - 1]?.histogram ?? 0;
      const bbVal = bb[n - 1];
      const bbPct = bbVal && bbVal.upper !== bbVal.lower
        ? (price - bbVal.lower) / (bbVal.upper - bbVal.lower)
        : 0.5;
      const volAvg = volumes.slice(-20).reduce((s, v) => s + v, 0) / 20 || 1;
      const volRatio = volumes[n - 1] / volAvg;
      const priceChg1 = n >= 2 ? (price - closes[n - 2]) / closes[n - 2] : 0;
      const priceChg3 = n >= 4 ? (price - closes[n - 4]) / closes[n - 4] : 0;
      const priceChg5 = n >= 6 ? (price - closes[n - 6]) / closes[n - 6] : 0;
      const atrPct = atr[n - 1] ? atr[n - 1] / price : 0;

      const features = [
        rsiVal / 100,
        (ema20Val - price) / price,
        (ema50Val - price) / price,
        macdHist / price,
        bbPct,
        Math.min(volRatio, 10) / 10,
        priceChg1,
        priceChg3,
        priceChg5,
        atrPct,
      ];

      return this.predictWithModel(trained, features);
    } catch (e) {
      this.logger.error(`Prediction failed for model #${modelId}: ${e.message}`);
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
}
