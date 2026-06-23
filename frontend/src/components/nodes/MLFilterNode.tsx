import React, { memo, useEffect, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { nodeWrap, nodeHead, nodeBody, nodeParam, nodeParamVal, PORT } from './nodeStyles';

interface MLModel {
  id: number;
  name: string;
  accuracy?: number;
  status?: string;
}

// Shared model cache across all instances (avoids repeated fetches)
let _modelsCache: MLModel[] | null = null;
let _modelsFetching = false;
const _modelsSubs: Set<() => void> = new Set();

async function fetchModelsOnce(): Promise<MLModel[]> {
  if (_modelsCache) return _modelsCache;
  if (_modelsFetching) {
    return new Promise(resolve => {
      const unsub = () => { _modelsSubs.delete(unsub); resolve(_modelsCache || []); };
      _modelsSubs.add(unsub);
    });
  }
  _modelsFetching = true;
  try {
    const res = await fetch('/api/ml');
    if (res.ok) {
      _modelsCache = await res.json();
    }
  } catch {
    _modelsCache = [];
  }
  _modelsFetching = false;
  _modelsSubs.forEach(fn => fn());
  _modelsSubs.clear();
  return _modelsCache || [];
}

// Exported so NodeInlineParams can use it too
export let globalMLModels: MLModel[] = [];
export function useMLModels() {
  const [models, setModels] = useState<MLModel[]>(_modelsCache || []);

  useEffect(() => {
    if (_modelsCache) { setModels(_modelsCache); return; }
    fetchModelsOnce().then(m => { globalMLModels = m; setModels(m); });
  }, []);

  return models;
}

export const MLFilterNode = memo(({ data, selected, id }: any) => {
  const models = useMLModels();

  // Find current model metadata
  const currentModel = models.find(m => m.id === data.modelId || m.id === Number(data.modelId));
  const modelName    = currentModel?.name || data.modelName || 'Not Selected';
  const modelReady   = currentModel?.status === 'READY' || !!currentModel;
  const accuracy     = currentModel?.accuracy;

  return (
    <div style={{
      ...nodeWrap(selected),
      border: selected ? '2px solid #8b5cf6' : '1px solid rgba(139, 92, 246, 0.3)',
      boxShadow: selected ? '0 0 20px rgba(139, 92, 246, 0.2)' : 'none',
      width: '210px',
    }}>
      {/* Header */}
      <div style={{ ...nodeHead, background: 'linear-gradient(90deg, #8b5cf6, #d946ef)', borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', color: '#fff', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '8px' }}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          ML Predictor
        </div>
      </div>

      {/* Body */}
      <div style={nodeBody}>
        <>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {models.length === 0 ? 'Loading models…' : 'Model Status'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: data.modelId ? (modelReady ? '#10b981' : '#f59e0b') : 'rgba(255,255,255,0.2)',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {modelName}
              </span>
            </div>
            {data.modelId && (
              <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                {accuracy !== undefined && (
                  <span>Acc: <b style={{ color: '#8b5cf6' }}>{(accuracy * 100).toFixed(1)}%</b></span>
                )}
                <span>Min: <b>{Math.round((data.minScore || 0.7) * 100)}%</b></span>
              </div>
            )}
            {!data.modelId && (
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
                {models.length > 0 ? `${models.length} models available` : 'Train a model first'}
              </div>
            )}
          </>
        
      </div>

      <Handle type="target" position={Position.Left}  style={PORT('#8b5cf6')} />
      <Handle type="source" position={Position.Right} style={PORT('#8b5cf6')} />
    </div>
  );
});
