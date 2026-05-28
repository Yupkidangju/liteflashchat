import type { ProviderType } from '../types';

export function defaultBaseUrlForProvider(provider: ProviderType): string {
  switch (provider) {
    case 'openrouter': return 'https://openrouter.ai/api/v1';
    case 'opencode_zen': return 'https://opencode.ai/zen/v1';
    case 'opencode_go': return 'https://opencode.ai/zen/go/v1';
    case 'lm_studio': return 'http://localhost:1234/v1';
    case 'local_llm': return 'http://localhost:8000/v1';
  }
}

export function formatModelError(status: number, text: string): string {
  if (text.includes('복호화')) {
    return '저장된 API Key를 복호화할 수 없습니다. 설정에서 API Key를 다시 등록해 주십시오.';
  }
  if (text.includes('등록되지 않았습니다')) {
    return 'API Key 또는 로컬 프로바이더 Base URL 설정이 필요합니다.';
  }
  if (status === 502) {
    return `모델 목록을 불러오지 못했습니다. Base URL과 로컬 서버 실행 상태를 확인하십시오. (${text.trim()})`;
  }
  return text.trim() || '모델 목록을 불러오지 못했습니다.';
}
