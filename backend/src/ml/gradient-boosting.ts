/**
 * Gradient Boosting Classifier
 * Pure TypeScript — sequential shallow trees correcting residuals.
 * More accurate than Random Forest on structured tabular data.
 */

interface GBTreeNode {
  featureIndex?: number;
  threshold?: number;
  left?: GBTreeNode;
  right?: GBTreeNode;
  isLeaf?: boolean;
  value?: number;
}

function sigmoid(x: number): number {
  if (x > 20) return 1;
  if (x < -20) return 0;
  return 1 / (1 + Math.exp(-x));
}

function splitData(X: number[][], y: number[], fi: number, threshold: number) {
  const leftX: number[][] = [], leftY: number[] = [];
  const rightX: number[][] = [], rightY: number[] = [];
  for (let i = 0; i < X.length; i++) {
    if (X[i][fi] <= threshold) { leftX.push(X[i]); leftY.push(y[i]); }
    else { rightX.push(X[i]); rightY.push(y[i]); }
  }
  return { leftX, leftY, rightX, rightY };
}

function meanSquaredError(y: number[]): number {
  if (y.length === 0) return 0;
  const mean = y.reduce((s, v) => s + v, 0) / y.length;
  return y.reduce((s, v) => s + (v - mean) ** 2, 0) / y.length;
}

function buildRegressionTree(X: number[][], y: number[], depth: number, maxDepth: number): GBTreeNode {
  const mean = y.length > 0 ? y.reduce((s, v) => s + v, 0) / y.length : 0;

  if (depth >= maxDepth || y.length < 5) {
    return { isLeaf: true, value: mean };
  }

  let bestGain = -Infinity, bestFi = -1, bestTh = 0;
  const parentMSE = meanSquaredError(y);
  const nFeatures = X[0]?.length || 0;

  for (let fi = 0; fi < nFeatures; fi++) {
    const vals = [...new Set(X.map(x => x[fi]))].sort((a, b) => a - b);
    const step = Math.max(1, Math.floor(vals.length / 20));
    for (let i = 0; i < vals.length - 1; i += step) {
      const th = (vals[i] + vals[i + 1]) / 2;
      const { leftY, rightY } = splitData(X, y, fi, th);
      if (leftY.length < 2 || rightY.length < 2) continue;
      const weighted = (leftY.length * meanSquaredError(leftY) + rightY.length * meanSquaredError(rightY)) / y.length;
      const gain = parentMSE - weighted;
      if (gain > bestGain) { bestGain = gain; bestFi = fi; bestTh = th; }
    }
  }

  if (bestFi === -1 || bestGain <= 0) return { isLeaf: true, value: mean };

  const { leftX, leftY, rightX, rightY } = splitData(X, y, bestFi, bestTh);
  return {
    featureIndex: bestFi,
    threshold: bestTh,
    left: buildRegressionTree(leftX, leftY, depth + 1, maxDepth),
    right: buildRegressionTree(rightX, rightY, depth + 1, maxDepth),
    isLeaf: false,
    value: mean,
  };
}

function predictNode(node: GBTreeNode, x: number[]): number {
  if (node.isLeaf || node.featureIndex === undefined) return node.value ?? 0;
  return x[node.featureIndex] <= node.threshold!
    ? predictNode(node.left!, x)
    : predictNode(node.right!, x);
}

export interface GBTrainResult {
  trees: GBTreeNode[];
  initValue: number;
  learningRate: number;
  featureNames: string[];
  accuracy: number;
  featureImportance: Record<string, number>;
  type: 'gradient_boosting';
}

export function trainGradientBoosting(
  X: number[][],
  y: number[],
  featureNames: string[],
  options: { nTrees?: number; maxDepth?: number; learningRate?: number; subsample?: number } = {},
): GBTrainResult {
  const nTrees = options.nTrees ?? 100;
  const maxDepth = options.maxDepth ?? 4;
  const lr = options.learningRate ?? 0.1;
  const subsample = options.subsample ?? 0.8;
  const n = X.length;

  const p = y.filter(v => v === 1).length / (n || 1);
  const initValue = Math.log((p + 1e-7) / (1 - p + 1e-7));
  const F = new Array(n).fill(initValue);
  const trees: GBTreeNode[] = [];

  for (let t = 0; t < nTrees; t++) {
    const residuals = y.map((yi, i) => yi - sigmoid(F[i]));

    const sampleSize = Math.floor(n * subsample);
    const indices: number[] = [];
    for (let i = 0; i < sampleSize; i++) indices.push(Math.floor(Math.random() * n));

    const sX = indices.map(i => X[i]);
    const sR = indices.map(i => residuals[i]);

    const tree = buildRegressionTree(sX, sR, 0, maxDepth);
    trees.push(tree);

    for (let i = 0; i < n; i++) {
      F[i] += lr * predictNode(tree, X[i]);
    }
  }

  let correct = 0;
  for (let i = 0; i < n; i++) {
    const pred = sigmoid(F[i]) >= 0.5 ? 1 : 0;
    if (pred === y[i]) correct++;
  }

  const importance: Record<string, number> = {};
  featureNames.forEach(f => importance[f] = 0);
  function countSplits(node: GBTreeNode) {
    if (node.isLeaf || node.featureIndex === undefined) return;
    const name = featureNames[node.featureIndex];
    if (name) importance[name] = (importance[name] || 0) + 1;
    if (node.left) countSplits(node.left);
    if (node.right) countSplits(node.right);
  }
  trees.forEach(t => countSplits(t));
  const total = Object.values(importance).reduce((s, v) => s + v, 0) || 1;
  Object.keys(importance).forEach(k => importance[k] = importance[k] / total);

  return {
    trees, initValue, learningRate: lr, featureNames,
    accuracy: n > 0 ? correct / n : 0,
    featureImportance: importance,
    type: 'gradient_boosting',
  };
}

export function predictGradientBoosting(model: GBTrainResult, x: number[]): number {
  let F = model.initValue;
  for (const tree of model.trees) {
    F += model.learningRate * predictNode(tree, x);
  }
  return sigmoid(F);
}
