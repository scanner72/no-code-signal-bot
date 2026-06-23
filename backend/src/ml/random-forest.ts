/**
 * Lightweight Random Forest Classifier
 * Pure TypeScript implementation — no native deps needed.
 * Supports: train(X, y), predict(X) → probability [0..1]
 */

interface TreeNode {
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  isLeaf?: boolean;
  value?: number; // fraction of class=1 samples
}

function gini(labels: number[]): number {
  if (labels.length === 0) return 0;
  const ones = labels.filter(l => l === 1).length;
  const p = ones / labels.length;
  return 1 - p * p - (1 - p) * (1 - p);
}

function splitData(
  X: number[][],
  y: number[],
  featureIdx: number,
  threshold: number,
): { leftX: number[][]; leftY: number[]; rightX: number[][]; rightY: number[] } {
  const leftX: number[][] = [], leftY: number[] = [];
  const rightX: number[][] = [], rightY: number[] = [];
  for (let i = 0; i < X.length; i++) {
    if (X[i][featureIdx] <= threshold) {
      leftX.push(X[i]); leftY.push(y[i]);
    } else {
      rightX.push(X[i]); rightY.push(y[i]);
    }
  }
  return { leftX, leftY, rightX, rightY };
}

function bestSplit(
  X: number[][],
  y: number[],
  featureIndices: number[],
): { featureIndex: number; threshold: number; gain: number } | null {
  let bestGain = -Infinity;
  let bestFeature = -1;
  let bestThreshold = 0;
  const parentGini = gini(y);

  for (const fi of featureIndices) {
    const values = X.map(x => x[fi]).sort((a, b) => a - b);
    const unique = [...new Set(values)];
    for (let i = 0; i < unique.length - 1; i++) {
      const threshold = (unique[i] + unique[i + 1]) / 2;
      const { leftY, rightY } = splitData(X, y, fi, threshold);
      if (leftY.length === 0 || rightY.length === 0) continue;
      const weightedGini =
        (leftY.length / y.length) * gini(leftY) +
        (rightY.length / y.length) * gini(rightY);
      const gain = parentGini - weightedGini;
      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = fi;
        bestThreshold = threshold;
      }
    }
  }

  if (bestFeature === -1) return null;
  return { featureIndex: bestFeature, threshold: bestThreshold, gain: bestGain };
}

function buildTree(
  X: number[][],
  y: number[],
  depth: number,
  maxDepth: number,
  minSamples: number,
  maxFeatures: number,
): TreeNode {
  const ones = y.filter(v => v === 1).length;
  const value = y.length > 0 ? ones / y.length : 0.5;

  if (depth >= maxDepth || y.length < minSamples || gini(y) === 0) {
    return { isLeaf: true, value };
  }

  // Random feature subset (sqrt of total features)
  const numFeatures = X[0]?.length || 0;
  const count = Math.max(1, Math.min(maxFeatures, Math.floor(Math.sqrt(numFeatures))));
  const allIndices = Array.from({ length: numFeatures }, (_, i) => i);
  const featureIndices: number[] = [];
  const shuffled = allIndices.sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) featureIndices.push(shuffled[i]);

  const split = bestSplit(X, y, featureIndices);
  if (!split || split.gain <= 0) return { isLeaf: true, value };

  const { leftX, leftY, rightX, rightY } = splitData(X, y, split.featureIndex, split.threshold);

  return {
    featureIndex: split.featureIndex,
    threshold: split.threshold,
    left: buildTree(leftX, leftY, depth + 1, maxDepth, minSamples, maxFeatures),
    right: buildTree(rightX, rightY, depth + 1, maxDepth, minSamples, maxFeatures),
    isLeaf: false,
    value,
  };
}

function predictTree(node: TreeNode, x: number[]): number {
  if (node.isLeaf || node.featureIndex === undefined) return node.value ?? 0.5;
  if (x[node.featureIndex] <= node.threshold!) {
    return predictTree(node.left!, x);
  }
  return predictTree(node.right!, x);
}

function bootstrapSample(X: number[][], y: number[]): { X: number[][]; y: number[] } {
  const n = X.length;
  const sampledX: number[][] = [];
  const sampledY: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * n);
    sampledX.push(X[idx]);
    sampledY.push(y[idx]);
  }
  return { X: sampledX, y: sampledY };
}

export interface RFTrainResult {
  trees: TreeNode[];
  featureNames: string[];
  accuracy: number;
  featureImportance: Record<string, number>;
}

export function trainRandomForest(
  X: number[][],
  y: number[],
  featureNames: string[],
  options: {
    nTrees?: number;
    maxDepth?: number;
    minSamples?: number;
  } = {},
): RFTrainResult {
  const nTrees = options.nTrees ?? 50;
  const maxDepth = options.maxDepth ?? 6;
  const minSamples = options.minSamples ?? 5;
  const maxFeatures = featureNames.length;

  const trees: TreeNode[] = [];
  for (let i = 0; i < nTrees; i++) {
    const { X: bX, y: bY } = bootstrapSample(X, y);
    trees.push(buildTree(bX, bY, 0, maxDepth, minSamples, maxFeatures));
  }

  // OOB-style accuracy on train set
  let correct = 0;
  for (let i = 0; i < X.length; i++) {
    const prob = predictForest(trees, X[i]);
    const pred = prob >= 0.5 ? 1 : 0;
    if (pred === y[i]) correct++;
  }
  const accuracy = X.length > 0 ? correct / X.length : 0;

  // Feature importance (mean decrease in gini approximation via split frequency)
  const importance: Record<string, number> = {};
  featureNames.forEach(f => importance[f] = 0);
  function countSplits(node: TreeNode) {
    if (node.isLeaf || node.featureIndex === undefined) return;
    const name = featureNames[node.featureIndex];
    if (name) importance[name] = (importance[name] || 0) + 1;
    if (node.left) countSplits(node.left);
    if (node.right) countSplits(node.right);
  }
  trees.forEach(t => countSplits(t));
  const totalSplits = Object.values(importance).reduce((s, v) => s + v, 0) || 1;
  Object.keys(importance).forEach(k => importance[k] = importance[k] / totalSplits);

  return { trees, featureNames, accuracy, featureImportance: importance };
}

export function predictForest(trees: TreeNode[], x: number[]): number {
  if (trees.length === 0) return 0.5;
  const sum = trees.reduce((s, t) => s + predictTree(t, x), 0);
  return sum / trees.length;
}
