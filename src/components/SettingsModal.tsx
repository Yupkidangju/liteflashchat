import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react';
import { LOCAL_PROVIDER_SET } from '../constants';
import type {
  ChatPreset,
  ChatSession,
  ModelInfo,
  ProviderState,
  ProviderType,
  SuperPrompt
} from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  close: () => void;
  setupTab: 'keys' | 'prompts' | 'general' | 'presets';
  setSetupTab: Dispatch<SetStateAction<'keys' | 'prompts' | 'general' | 'presets'>>;
  providers: ProviderState[];
  modalProvider: ProviderType;
  onModalProviderChange: (provider: ProviderType) => void;
  inputApiKey: string;
  setInputApiKey: Dispatch<SetStateAction<string>>;
  inputBaseUrl: string;
  setInputBaseUrl: Dispatch<SetStateAction<string>>;
  isProviderEditMode: boolean;
  originalBaseUrl: string;
  onSaveApiKey: () => void;
  promptNameInput: string;
  setPromptNameInput: Dispatch<SetStateAction<string>>;
  promptContentInput: string;
  setPromptContentInput: Dispatch<SetStateAction<string>>;
  onSavePrompt: () => void;
  superPrompts: SuperPrompt[];
  onEditPrompt: (prompt: SuperPrompt) => void;
  onDeletePrompt: (name: string) => void;
  importInputRef: RefObject<HTMLInputElement | null>;
  sessions: ChatSession[];
  presets: ChatPreset[];
  isAiLoading: boolean;
  onImportJsonFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  activeCompressionRatio: number;
  onCompressionRatioChange: (value: number) => void;
  selectedModel: string;
  activeModelInfo?: ModelInfo;
  overrideContextInput: string;
  setOverrideContextInput: Dispatch<SetStateAction<string>>;
  overrideInputInput: string;
  setOverrideInputInput: Dispatch<SetStateAction<string>>;
  overrideOutputInput: string;
  setOverrideOutputInput: Dispatch<SetStateAction<string>>;
  onClearModelOverride: () => void;
  onSaveModelOverride: () => void;
  presetNameInput: string;
  setPresetNameInput: Dispatch<SetStateAction<string>>;
  activeProvider: ProviderType;
  activeSession?: ChatSession;
  onSavePreset: () => void;
  onApplyPreset: (preset: ChatPreset) => void;
  onRenamePreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
}

export function SettingsModal(props: SettingsModalProps) {
  const {
    isOpen,
    close,
    setupTab,
    setSetupTab,
    providers,
    modalProvider,
    onModalProviderChange,
    inputApiKey,
    setInputApiKey,
    inputBaseUrl,
    setInputBaseUrl,
    isProviderEditMode,
    originalBaseUrl,
    onSaveApiKey,
    promptNameInput,
    setPromptNameInput,
    promptContentInput,
    setPromptContentInput,
    onSavePrompt,
    superPrompts,
    onEditPrompt,
    onDeletePrompt,
    importInputRef,
    sessions,
    presets,
    isAiLoading,
    onImportJsonFile,
    onExportJson,
    onExportMarkdown,
    activeCompressionRatio,
    onCompressionRatioChange,
    selectedModel,
    activeModelInfo,
    overrideContextInput,
    setOverrideContextInput,
    overrideInputInput,
    setOverrideInputInput,
    overrideOutputInput,
    setOverrideOutputInput,
    onClearModelOverride,
    onSaveModelOverride,
    presetNameInput,
    setPresetNameInput,
    activeProvider,
    activeSession,
    onSavePreset,
    onApplyPreset,
    onRenamePreset,
    onDeletePreset
  } = props;

  if (!isOpen) return null;

  const modalProviderState = providers.find(provider => provider.name === modalProvider);

  return (
    <div className="modal-overlay">
      <div className="modal-dialog settings-dialog">
        <div className="modal-header-row">
          <h3 className="modal-title" style={{ margin: 0 }}>LiteFlashChat 설정</h3>
          <button className="modal-close-btn" onClick={close}>
            ✕
          </button>
        </div>

        <div className="settings-tabs">
          <button className={`settings-tab ${setupTab === 'keys' ? 'active' : ''}`} onClick={() => setSetupTab('keys')}>
            프로바이더 설정
          </button>
          <button className={`settings-tab ${setupTab === 'prompts' ? 'active' : ''}`} onClick={() => setSetupTab('prompts')}>
            Super Prompt 관리
          </button>
          <button className={`settings-tab ${setupTab === 'general' ? 'active' : ''}`} onClick={() => setSetupTab('general')}>
            일반 설정
          </button>
          <button className={`settings-tab ${setupTab === 'presets' ? 'active' : ''}`} onClick={() => setSetupTab('presets')}>
            프리셋
          </button>
        </div>

        {setupTab === 'keys' && (
          <div>
            <div className="form-group">
              <label className="form-label">대상 프로바이더 선택</label>
              <select
                className="form-input"
                value={modalProvider}
                onChange={(e) => onModalProviderChange(e.target.value as ProviderType)}
              >
                {providers.map(provider => (
                  <option key={provider.name} value={provider.name}>
                    {provider.displayName} {provider.hasKey ? ' (활성화됨)' : ' (비활성)'}
                  </option>
                ))}
              </select>
            </div>

            {modalProviderState && (
              <div className="provider-status-card">
                <div className="provider-status-main">
                  <span className={`provider-led ${modalProviderState.hasKey ? 'on' : 'off'}`} />
                  <strong>{modalProviderState.displayName}</strong>
                  <span>{modalProviderState.hasKey ? '활성화됨' : '설정 필요'}</span>
                </div>
                <div className="provider-status-detail">
                  {modalProviderState.statusMessage || '저장 후 모델 목록이 즉시 갱신됩니다.'}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">API Key</label>
              <input
                type="password"
                className="form-input"
                placeholder="sk-..."
                value={inputApiKey}
                onChange={(e) => setInputApiKey(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">API Base URL</label>
              <input
                type="text"
                className="form-input"
                value={inputBaseUrl}
                onChange={(e) => setInputBaseUrl(e.target.value)}
              />
            </div>

            {isProviderEditMode && (
              <div style={{
                background: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                borderRadius: '6px',
                padding: '10px 14px',
                marginTop: '10px',
                fontSize: '0.78rem',
                color: 'var(--color-accent-end)',
                lineHeight: 1.5
              }}>
                ✏️ 이 프로바이더는 이미 활성화되어 있습니다. API Key를 비워두면 기존 키가 유지됩니다.
                Base URL이나 API Key를 변경한 후 "수정 저장"을 클릭하세요.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                className="send-btn"
                disabled={
                  isProviderEditMode
                    ? (!inputApiKey && inputBaseUrl === originalBaseUrl)
                    : (!inputApiKey && !LOCAL_PROVIDER_SET.has(modalProvider))
                }
                onClick={onSaveApiKey}
              >
                {isProviderEditMode ? '수정 저장' : '암호화 저장 완료'}
              </button>
            </div>
          </div>
        )}

        {setupTab === 'prompts' && (
          <div>
            <div className="settings-section">
              <div className="form-group">
                <label className="form-label">Prompt Name (이름)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 번역가 페르소나"
                  value={promptNameInput}
                  onChange={(e) => setPromptNameInput(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Prompt Content (지침 지시 내용)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  style={{ resize: 'none' }}
                  placeholder="예: 당신은 격조 높은 한영 번역가입니다..."
                  value={promptContentInput}
                  onChange={(e) => setPromptContentInput(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="send-btn"
                  disabled={!promptNameInput.trim() || !promptContentInput.trim()}
                  onClick={onSavePrompt}
                >
                  프롬프트 저장 (덮어쓰기 포함)
                </button>
              </div>
            </div>

            <h4 className="settings-subtitle">저장된 지침 목록 (prompts.json)</h4>
            <div className="prompt-list">
              {superPrompts.length === 0 ? (
                <div className="empty-list-message">등록된 Super Prompt가 없습니다.</div>
              ) : (
                superPrompts.map(prompt => (
                  <div key={prompt.name} className="prompt-list-item">
                    <div className="prompt-list-text">
                      <span className="prompt-list-name">{prompt.name}</span>
                      <span className="prompt-list-preview">{prompt.content}</span>
                    </div>
                    <div className="prompt-list-actions">
                      <button type="button" className="small-action-btn" onClick={() => onEditPrompt(prompt)}>
                        편집
                      </button>
                      <button type="button" className="small-action-btn danger" onClick={() => onDeletePrompt(prompt.name)}>
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {setupTab === 'general' && (
          <div>
            <div className="settings-section">
              <h4 className="settings-subtitle">대화 데이터 관리</h4>
              <div className="provider-status-detail" style={{ marginBottom: '12px' }}>
                JSON 백업과 Markdown 로그에는 API Key, Authorization, 로컬 secret 파일이 포함되지 않습니다.
              </div>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={onImportJsonFile}
              />
              <div className="settings-action-grid">
                <button type="button" className="small-action-btn" disabled={sessions.length === 0 && presets.length === 0} onClick={onExportJson}>
                  JSON 내보내기
                </button>
                <button type="button" className="small-action-btn" disabled={isAiLoading} onClick={() => importInputRef.current?.click()}>
                  JSON 가져오기
                </button>
                <button type="button" className="small-action-btn" disabled={sessions.length === 0} onClick={onExportMarkdown}>
                  Markdown 내보내기
                </button>
              </div>
            </div>

            <div className="settings-section">
              <div className="form-group">
                <label className="form-label">컨텍스트 압축 비율</label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  className="settings-range"
                  value={activeCompressionRatio}
                  onChange={(e) => onCompressionRatioChange(Number(e.target.value))}
                />
                <input
                  type="number"
                  min="0.1"
                  max="1"
                  step="0.05"
                  className="form-input"
                  value={activeCompressionRatio}
                  onChange={(e) => onCompressionRatioChange(Number(e.target.value))}
                />
              </div>
              <div className="provider-status-detail">
                기본값은 0.7입니다. 예상 컨텍스트가 최대 컨텍스트의 이 비율을 넘으면 같은 모델로 오래된 대화를 요약한 뒤 전송합니다.
              </div>
            </div>

            <div className="settings-section">
              <h4 className="settings-subtitle">모델 메타데이터 보정</h4>
              <div className="provider-status-detail" style={{ marginBottom: '12px' }}>
                현재 모델: {selectedModel || '모델 없음'} / 출처: {activeModelInfo?.metadataSource ?? 'unknown'}
                {activeModelInfo?.isContextEstimated ? ' (수동 보정 필요)' : ''}
              </div>
              <div className="form-group">
                <label className="form-label">최대 컨텍스트</label>
                <input type="number" min="1" className="form-input" value={overrideContextInput} onChange={(e) => setOverrideContextInput(e.target.value)} disabled={!selectedModel} />
              </div>
              <div className="form-group">
                <label className="form-label">입력 한도</label>
                <input type="number" min="1" className="form-input" value={overrideInputInput} onChange={(e) => setOverrideInputInput(e.target.value)} disabled={!selectedModel} />
              </div>
              <div className="form-group">
                <label className="form-label">출력 한도</label>
                <input type="number" min="0" className="form-input" value={overrideOutputInput} onChange={(e) => setOverrideOutputInput(e.target.value)} disabled={!selectedModel} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="modal-cancel-btn" disabled={!selectedModel} onClick={onClearModelOverride}>
                  보정 제거
                </button>
                <button type="button" className="send-btn" disabled={!selectedModel} onClick={onSaveModelOverride}>
                  보정 저장
                </button>
              </div>
            </div>
          </div>
        )}

        {setupTab === 'presets' && (
          <div>
            <div className="settings-section">
              <h4 className="settings-subtitle">현재 설정 프리셋 저장</h4>
              <div className="form-group">
                <label className="form-label">프리셋 이름</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: OpenRouter 기본 글쓰기"
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                />
              </div>
              <div className="provider-status-detail" style={{ marginBottom: '12px' }}>
                저장 대상: {activeProvider} / {selectedModel || '모델 없음'} / Prompt {activeSession?.activeSystemPromptName ?? '미적용'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="send-btn" disabled={!selectedModel || !presetNameInput.trim()} onClick={onSavePreset}>
                  현재 설정으로 저장
                </button>
              </div>
            </div>

            <h4 className="settings-subtitle">저장된 프리셋</h4>
            <div className="preset-list">
              {presets.length === 0 ? (
                <div className="empty-list-message">등록된 프리셋이 없습니다.</div>
              ) : presets.map(preset => (
                <div key={preset.id} className="prompt-list-item">
                  <div className="prompt-list-text">
                    <span className="prompt-list-name">{preset.name}</span>
                    <span className="prompt-list-preview">
                      {preset.provider} / {preset.model} / 압축 {(preset.compressionRatio * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="prompt-list-actions">
                    <button type="button" className="small-action-btn" disabled={isAiLoading} onClick={() => onApplyPreset(preset)}>
                      적용
                    </button>
                    <button type="button" className="small-action-btn" onClick={() => onRenamePreset(preset.id)}>
                      이름 변경
                    </button>
                    <button type="button" className="small-action-btn danger" onClick={() => onDeletePreset(preset.id)}>
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
