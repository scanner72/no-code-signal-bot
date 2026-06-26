/**
 * Logistic Regression Classifier
 * Pure TypeScript — batch gradient descent with L2 regularization.
 * Fast, interpretable, good baseline for feature importance analysis.
 */

function sigmoid(x: number): number {
  if (x > 20) return 1;
  if (x < -20) return 0;
  return 1 / (1 + Math.exp(-x));
}

export interface LRTrainResult {
  weights: number[];
  bias: number;
  featureMeans: number[];
  featureStds: number[];
  featureNames: string[];
  accuracy: number;
  featureImportance: Record<string, number>;
  type: 'logistic_regression';
}

export function trainLogisticRegression(
  X: number[][],
  y: number[],
  featureNames: string[],
  options: { iterations?: number; lr?: number; lambda?: number } = {},
): LRTrainResult {
  const iterations = options.iterations ?? 1000;
  const lr = options.lr ?? 0.01;
  const lambda = options.lambda ?? 0.01;
  const n = X.length;
  const nFeatures = X[0]?.length || 0;

  const means = new Array(nFeatures).fill(0);
  const stds = new Array(nFeatures).fill(1);

  for (let f = 0; f < nFeatures; f++) {
    const vals = X.map(x => x[f]);
    means[f] = vals.reduce((s, v) => s + v, 0) / n;
    const variance = vals.reduce((s, v) => s + (v - means[f]) ** 2, 0) / n;
    stds[f] = Math.sqrt(variance) || 1;
  }

  const Xn = X.map(x => x.map((v, f) => (v - means[f]) / stds[f]));

  const w = new Array(nFeatures).fill(0);
  let b = 0;

  for (let iter = 0; iter < iterations; iter++) {
    const gradW = new Array(nFeatures).fill(0);
    let gradB = 0;

    for (let i = 0; i < n; i++) {
      const z = Xn[i].reduce((s, v, f) => s + v * w[f], 0) + b;
      const pred = sigmoid(z);
      const err = pred - y[i];

      for (let f = 0; f < nFeatures; f++) {
        gradW[f] += err * Xn[i][f];
      }
      gradB += err;
    }

    for (let f = 0; f < nFeatures; f++) {
      w[f] -= lr * (gradW[f] / n + lambda * w[f]);
    }
    b -= lr * (gradB / n);
  }

  let correct = 0;
  for (let i = 0; i < n; i++) {
    const z = Xn[i].reduce((s, v, f) => s + v * w[f], 0) + b;
    const pred = sigmoid(z) >= 0.5 ? 1 : 0;
    if (pred === y[i]) correct++;
  }

  const importance: Record<string, number> = {};
  const absWeights = w.map(Math.abs);
  const totalWeight = absWeights.reduce((s, v) => s + v, 0) || 1;
  featureNames.forEach((name, i) => {
    importance[name] = absWeights[i] / totalWeight;
  });

  return {
    weights: w,
    bias: b,
    featureMeans: means,
    featureStds: stds,
    featureNames,
    accuracy: n > 0 ? correct / n : 0,
    featureImportance: importance,
    type: 'logistic_regression',
  };
}

export function predictLogisticRegression(model: LRTrainResult, x: number[]): number {
  const xn = x.map((v, f) => (v - model.featureMeans[f]) / (model.featureStds[f] || 1));
  const z = xn.reduce((s, v, f) => s + v * model.weights[f], 0) + model.bias;
  return sigmoid(z);
}
