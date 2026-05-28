import type { ChangeEvent, RefObject } from 'react';
import type { AttachmentInfo, ModelInfo } from '../types';

interface InputPanelProps {
  attachments: AttachmentInfo[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  supportsVision: boolean;
  contextStatusClass: string;
  estimatedContextTokens: number;
  activeInputLimit: number;
  activeCompressionRatio: number;
  activeModelInfo?: ModelInfo;
  inputText: string;
  setInputText: (value: string) => void;
  modelsCount: number;
  isAiLoading: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onCancelAttachment: () => void;
  onSendMessage: () => void;
  onCancelStream: () => void;
}

export function InputPanel({
  attachments,
  fileInputRef,
  supportsVision,
  contextStatusClass,
  estimatedContextTokens,
  activeInputLimit,
  activeCompressionRatio,
  activeModelInfo,
  inputText,
  setInputText,
  modelsCount,
  isAiLoading,
  onFileChange,
  onCancelAttachment,
  onSendMessage,
  onCancelStream
}: InputPanelProps) {
  return (
    <footer className="input-panel">
      {attachments.length > 0 && (
        <div className="preview-strip">
          {attachments.map((attachment, index) => (
            <div key={index} className="preview-item">
              <img src={attachment.url} alt={attachment.name} className="preview-img" />
              <button className="preview-cancel-btn" onClick={onCancelAttachment}>
                X
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={`context-meter ${contextStatusClass}`}>
        <span>
          예상 입력 컨텍스트: {estimatedContextTokens.toLocaleString()} / {activeInputLimit > 0 ? activeInputLimit.toLocaleString() : '알 수 없음'} tokens
        </span>
        <span>
          압축 기준 {(activeCompressionRatio * 100).toFixed(0)}%
          {activeModelInfo?.maxOutputTokens ? ` · 출력 한도 ${activeModelInfo.maxOutputTokens.toLocaleString()}` : ' · 출력 한도 알 수 없음'}
        </span>
      </div>

      <div className="input-box-wrapper">
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={onFileChange}
        />
        <button
          className="upload-icon-btn"
          disabled={!supportsVision}
          onClick={() => fileInputRef.current?.click()}
        >
          🖼️
        </button>

        <textarea
          className="chat-input"
          rows={1}
          placeholder={
            modelsCount === 0
              ? '⚙️ 설정을 클릭해 API 연동을 성공시켜 주십시오.'
              : '메시지를 입력하세요...'
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={modelsCount === 0 || isAiLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSendMessage();
            }
          }}
        />

        <button
          className="send-btn"
          disabled={!isAiLoading && ((!inputText.trim() && attachments.length === 0) || modelsCount === 0)}
          onClick={isAiLoading ? onCancelStream : onSendMessage}
        >
          {isAiLoading ? '중지' : '전송'}
        </button>
      </div>
    </footer>
  );
}
