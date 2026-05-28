// [v1.4.0] Inspector 보안 마스킹 및 export bundle 검증 유틸리티입니다.
// API Key, Authorization, secret 계열 값이 디버깅 UI로 새지 않도록 중앙화합니다.

import type { ChatExportBundle } from '../types';

export function sanitizeInspectorRequest(body: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  Object.entries(body).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('key') || lowerKey.includes('authorization') || lowerKey.includes('secret')) {
      sanitized[key] = '[redacted]';
    } else if (key === 'system_prompt') {
      sanitized[key] = value ? '[system prompt omitted]' : '';
    } else {
      sanitized[key] = value;
    }
  });
  return sanitized;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isChatExportBundle(value: unknown): value is ChatExportBundle {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 'liteflashchat.v1.4.0'
    && Array.isArray(value.sessions)
    && isRecord(value.modelOverrides)
    && Array.isArray(value.presets);
}
