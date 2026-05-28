// [v1.4.0] 애플리케이션 전역 상수 모음입니다.
// Phase 12 구조 정리에서 localStorage key, API base, 기본 생성값을 한 곳으로 모아
// UI 컴포넌트와 유틸 함수가 같은 계약을 공유하게 합니다.

import type { GenerationSettings, ProviderType } from './types';

export const API_BASE = 'http://localhost:8080/api';

export const LOCAL_PROVIDER_SET = new Set<ProviderType>(['lm_studio', 'local_llm']);

export const SESSION_STORAGE_KEY = 'litechat_sessions';
export const COMPRESSION_RATIO_STORAGE_KEY = 'litechat_context_compression_ratio';
export const MODEL_OVERRIDES_STORAGE_KEY = 'litechat_model_overrides';
export const PRESETS_STORAGE_KEY = 'litechat_presets';

export const DEFAULT_COMPRESSION_RATIO = 0.7;

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  repetitionPenalty: 1.1
};
