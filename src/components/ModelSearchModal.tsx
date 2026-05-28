import type { Dispatch, SetStateAction } from 'react';
import type { ModelInfo } from '../types';

interface ModelSearchModalProps {
  isOpen: boolean;
  filteredModels: ModelInfo[];
  selectedModel: string;
  modelSearchQuery: string;
  setModelSearchQuery: Dispatch<SetStateAction<string>>;
  close: () => void;
  onSelectModelConfirm: (modelId: string) => void;
}

export function ModelSearchModal({
  isOpen,
  filteredModels,
  selectedModel,
  modelSearchQuery,
  setModelSearchQuery,
  close,
  onSelectModelConfirm
}: ModelSearchModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-dialog" style={{ width: '560px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexShrink: 0 }}>
          <h3 className="modal-title" style={{ margin: 0 }}>🔍 AI 모델 선택 및 실시간 검색</h3>
          <button
            onClick={close}
            style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.1rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div className="form-group" style={{ marginBottom: '16px', flexShrink: 0 }}>
          <input
            type="text"
            className="form-input"
            placeholder="모델 ID 또는 이름 키워드 입력..."
            value={modelSearchQuery}
            onChange={(e) => setModelSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingRight: '4px',
            marginBottom: '16px'
          }}
        >
          {filteredModels.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px' }}>
              입력하신 키워드와 일치하는 모델이 없습니다.
            </div>
          ) : (
            filteredModels.map(model => (
              <div
                key={model.id}
                onDoubleClick={() => onSelectModelConfirm(model.id)}
                onClick={() => onSelectModelConfirm(model.id)}
                style={{
                  padding: '12px 16px',
                  background: selectedModel === model.id ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid',
                  borderColor: selectedModel === model.id ? 'var(--color-accent-end)' : 'var(--color-glass-border)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => {
                  if (selectedModel !== model.id) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedModel !== model.id) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                    e.currentTarget.style.borderColor = 'var(--color-glass-border)';
                  }
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    {model.name || model.id.split('/').pop()}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    ID: {model.id} | Context: {model.contextLength > 0 ? model.contextLength.toLocaleString() : '알 수 없음'} Tokens
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    className={`vision-tag ${model.supportsVision ? 'active' : 'inactive'}`}
                    style={{ border: 'none', padding: '2px 6px', fontSize: '0.6rem' }}
                  >
                    {model.supportsVision ? 'VISION' : 'TEXT'}
                  </span>
                  {selectedModel === model.id && (
                    <span style={{ color: 'var(--color-accent-end)', fontSize: '0.9rem' }}>✓</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0, borderTop: '1px solid var(--color-glass-border)', paddingTop: '14px' }}>
          <button className="modal-cancel-btn" onClick={close}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
