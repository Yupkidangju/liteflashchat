import type { ProviderState, ProviderType } from '../types';

interface ChatHeaderProps {
  activeProvider: ProviderType;
  providers: ProviderState[];
  supportsVision: boolean;
  selectedModel: string;
  modelsCount: number;
  modelLoadError: string;
  openModelSearch: () => void;
  openSettings: (provider: ProviderState) => void;
  openFallbackSettings: () => void;
}

export function ChatHeader({
  activeProvider,
  providers,
  supportsVision,
  selectedModel,
  modelsCount,
  modelLoadError,
  openModelSearch,
  openSettings,
  openFallbackSettings
}: ChatHeaderProps) {
  return (
    <header className="chat-header">
      <div className="header-title-area">
        <h2 className="header-title">
          {activeProvider.toUpperCase()} 대화방
          <span className={`vision-tag ${supportsVision ? 'active' : 'inactive'}`}>
            {supportsVision ? 'VISION ENABLED' : 'TEXT ONLY'}
          </span>
        </h2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Model:</span>
        <button
          onClick={() => {
            if (modelsCount > 0) {
              openModelSearch();
            } else {
              alert(modelLoadError || '설정에서 프로바이더 연동을 먼저 완료해 주십시오.');
            }
          }}
          style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--color-glass-border)',
            color: 'var(--color-text-main)',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-smooth)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent-end)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-glass-border)')}
        >
          🔍 {selectedModel ? (selectedModel.split('/').pop() || selectedModel) : '모델을 선택하십시오'}
        </button>

        {modelLoadError && (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-warning-red)', maxWidth: '260px', lineHeight: 1.35 }}>
            {modelLoadError}
          </span>
        )}

        <button
          onClick={() => {
            const matched = providers.find(provider => provider.name === activeProvider);
            if (matched) {
              openSettings(matched);
            } else {
              openFallbackSettings();
            }
          }}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '1.25rem',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            transition: 'var(--transition-smooth)',
            padding: '4px 8px',
            borderRadius: '6px'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
          title="설정 및 Super Prompt 관리"
        >
          ⚙️
        </button>
      </div>
    </header>
  );
}
