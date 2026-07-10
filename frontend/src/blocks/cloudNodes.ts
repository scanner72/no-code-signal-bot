// Composition point for optional cloud builder nodes.
// The open-source core ships with empty objects; a downstream distribution
// can register extra block configs, edge colors and sink node types here.
import type { BlockConfig } from './registry';

export const cloudRegistry: Record<string, BlockConfig> = {};

export const cloudEdgeColors: Record<string, string> = {};

export const cloudSinkTypes: string[] = [];
