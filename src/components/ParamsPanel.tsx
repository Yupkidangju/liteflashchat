import type { GenerationSettings, InspectorSnapshot, ModelInfo } from '../types';

interface ParamsPanelProps {
  activeModelInfo?: ModelInfo;
  activeGenerationSettings: GenerationSettings;
  activeContextLength: number;
  activeInputLimit: number;
  inspectorSnapshot: InspectorSnapshot | null;
  onUpdateGenerationSetting: (key: keyof GenerationSettings, value: number) => void;
  onCopyInspector: (mode: 'request' | 'response' | 'all') => void;
}

const PARAM_CONTROLS = [
  { key: 'temperature' as const, label: 'Temp', min: 0, max: 2, step: 0.05 },
  { key: 'topP' as const, label: 'Top P', min: 0, max: 1, step: 0.05 },
  { key: 'topK' as const, label: 'Top K', min: 0, max: 200, step: 1 },
  { key: 'repetitionPenalty' as const, label: 'RP', min: 0, max: 2, step: 0.05 }
];

function isControlEnabled(modelInfo: ModelInfo | undefined, key: keyof GenerationSettings): boolean {
  if (!modelInfo) return false;
  switch (key) {
    case 'temperature': return modelInfo.supportsTemperature;
    case 'topP': return modelInfo.supportsTopP;
    case 'topK': return modelInfo.supportsTopK;
    case 'repetitionPenalty': return modelInfo.supportsRepetitionPenalty;
  }
}

export function ParamsPanel({
  activeModelInfo,
  activeGenerationSettings,
  activeContextLength,
  activeInputLimit,
  inspectorSnapshot,
  onUpdateGenerationSetting,
  onCopyInspector
}: ParamsPanelProps) {
  return (
    <aside className="params-panel">
      <div className="params-panel-header">
        <span>Model Params</span>
        <small>{activeModelInfo?.name || activeModelInfo?.id || '모델 없음'}</small>
      </div>

      {PARAM_CONTROLS.map(control => {
        const enabled = isControlEnabled(activeModelInfo, control.key);
        const value = activeGenerationSettings[control.key];
        return (
          <div key={control.key} className={`param-control ${enabled ? '' : 'disabled'}`}>
            <div className="param-control-row">
              <label>{control.label}</label>
              <input
                type="number"
                min={control.min}
                max={control.max}
                step={control.step}
                value={value}
                disabled={!enabled}
                onChange={(e) => onUpdateGenerationSetting(control.key, Number(e.target.value))}
              />
            </div>
            <input
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={value}
              disabled={!enabled}
              onChange={(e) => onUpdateGenerationSetting(control.key, Number(e.target.value))}
            />
            {!enabled && (
              <span className="param-disabled-reason">모델 메타데이터에서 지원 확인 불가</span>
            )}
          </div>
        );
      })}

      <div className="params-model-meta">
        <div>Context: {activeContextLength > 0 ? activeContextLength.toLocaleString() : '알 수 없음'}</div>
        <div>Input: {activeInputLimit > 0 ? activeInputLimit.toLocaleString() : '알 수 없음'}</div>
        <div>Output: {activeModelInfo?.maxOutputTokens ? activeModelInfo.maxOutputTokens.toLocaleString() : '알 수 없음'}</div>
        <div>Source: {activeModelInfo?.metadataSource ?? 'unknown'}</div>
        {activeModelInfo?.isContextEstimated && <div>수동 보정 필요</div>}
      </div>

      <div className="inspector-panel">
        <div className="inspector-header">
          <span>Inspector</span>
          <small>{inspectorSnapshot?.timestamp ?? '대기 중'}</small>
        </div>
        {!inspectorSnapshot ? (
          <div className="inspector-empty">아직 기록된 요청이 없습니다.</div>
        ) : (
          <>
            <div className="inspector-meta">
              <div>{inspectorSnapshot.endpoint}</div>
              <div>{inspectorSnapshot.provider} · {inspectorSnapshot.model || '모델 없음'}</div>
              <div>Status: {inspectorSnapshot.responseStatus ?? 'n/a'} · Stream: {inspectorSnapshot.streaming ? 'on' : 'off'}</div>
              <div>Summary: {inspectorSnapshot.usedContextSummary ? 'used' : 'unused'}</div>
            </div>
            <pre className="inspector-json">
              {JSON.stringify(inspectorSnapshot.sanitizedRequest, null, 2)}
            </pre>
            {(inspectorSnapshot.responsePreview || inspectorSnapshot.errorMessage) && (
              <pre className="inspector-json">
                {inspectorSnapshot.errorMessage || inspectorSnapshot.responsePreview}
              </pre>
            )}
            <div className="inspector-actions">
              <button type="button" className="small-action-btn" onClick={() => onCopyInspector('request')}>요청</button>
              <button type="button" className="small-action-btn" onClick={() => onCopyInspector('response')}>응답</button>
              <button type="button" className="small-action-btn" onClick={() => onCopyInspector('all')}>전체</button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
