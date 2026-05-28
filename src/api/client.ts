// [v1.4.0] Go 백엔드 API 클라이언트 경계입니다.
// Phase 12에서 fetch 세부사항을 React UI 렌더링과 분리합니다.

import type {
  ModelInfo,
  ProviderState,
  ProviderType,
  SuperPrompt
} from '../types';
import { API_BASE } from '../constants';

export async function getProviders(): Promise<ProviderState[]> {
  const resp = await fetch(`${API_BASE}/providers`);
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
  return await resp.json() as ProviderState[];
}

export async function getModels(provider: ProviderType): Promise<ModelInfo[]> {
  const resp = await fetch(`${API_BASE}/models?provider=${provider}`);
  if (!resp.ok) {
    const text = await resp.text();
    throw Object.assign(new Error(text), { status: resp.status });
  }
  return await resp.json() as ModelInfo[];
}

export async function getPrompts(): Promise<SuperPrompt[]> {
  const resp = await fetch(`${API_BASE}/prompts`);
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
  return await resp.json() as SuperPrompt[];
}

export async function saveProviderConfig(body: Record<string, string>): Promise<void> {
  const resp = await fetch(`${API_BASE}/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
}

export async function savePrompt(prompt: SuperPrompt): Promise<void> {
  const resp = await fetch(`${API_BASE}/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prompt)
  });
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
}

export async function deletePrompt(name: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/prompts?name=${encodeURIComponent(name)}`, {
    method: 'DELETE'
  });
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
