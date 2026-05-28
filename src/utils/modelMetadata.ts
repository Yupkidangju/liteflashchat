// [v1.4.0] 모델 메타데이터와 생성 설정 보정 유틸리티입니다.
// React 렌더링과 분리하여 Phase 12 리팩터링 중 모델 한도 계산 계약을 안정화합니다.

import type { GenerationSettings, ModelInfo, ModelMetadataOverride, ProviderType } from '../types';
import { DEFAULT_GENERATION_SETTINGS } from '../constants';

export type ModelOverrideMap = Record<string, ModelMetadataOverride>;

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizeGenerationSettings(settings?: Partial<GenerationSettings>): GenerationSettings {
  return {
    temperature: clampNumber(settings?.temperature ?? DEFAULT_GENERATION_SETTINGS.temperature, 0, 2),
    topP: clampNumber(settings?.topP ?? DEFAULT_GENERATION_SETTINGS.topP, 0, 1),
    topK: Math.max(0, Math.round(settings?.topK ?? DEFAULT_GENERATION_SETTINGS.topK)),
    repetitionPenalty: clampNumber(settings?.repetitionPenalty ?? DEFAULT_GENERATION_SETTINGS.repetitionPenalty, 0, 2)
  };
}

export function modelOverrideKey(provider: ProviderType, modelId: string): string {
  return `${provider}::${modelId}`;
}

export function normalizeModelOverride(raw: Partial<ModelMetadataOverride>): ModelMetadataOverride {
  const contextLength = Math.max(0, Math.round(raw.contextLength ?? 0));
  const maxOutputTokens = Math.max(0, Math.round(raw.maxOutputTokens ?? 0));
  let maxInputTokens = Math.max(0, Math.round(raw.maxInputTokens ?? 0));
  if (maxInputTokens === 0 && contextLength > 0) {
    maxInputTokens = maxOutputTokens > 0 && maxOutputTokens < contextLength
      ? contextLength - maxOutputTokens
      : contextLength;
  }
  return { contextLength, maxInputTokens, maxOutputTokens };
}

export function applyModelOverrides(provider: ProviderType, sourceModels: ModelInfo[], overrides: ModelOverrideMap): ModelInfo[] {
  return sourceModels.map(model => {
    const override = overrides[modelOverrideKey(provider, model.id)];
    if (!override) return model;
    const normalized = normalizeModelOverride(override);
    return {
      ...model,
      contextLength: normalized.contextLength,
      maxInputTokens: normalized.maxInputTokens,
      maxOutputTokens: normalized.maxOutputTokens,
      metadataSource: 'manual',
      isContextEstimated: false
    };
  });
}

export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
