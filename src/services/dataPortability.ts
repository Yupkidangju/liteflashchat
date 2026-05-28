import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { ChatExportBundle, ChatPreset, ChatSession } from '../types';
import { buildMarkdownExport, downloadTextFile, makeTimestampForFile } from '../utils/export';
import { isChatExportBundle } from '../utils/inspector';
import { clampNumber, normalizeGenerationSettings, type ModelOverrideMap } from '../utils/modelMetadata';
import { normalizeSession } from '../utils/storage';

export interface ImportJsonOptions {
  event: ChangeEvent<HTMLInputElement>;
  isAiLoading: boolean;
  sessions: ChatSession[];
  presets: ChatPreset[];
  compressionRatio: number;
  currentSessionId: string;
  setSessions: Dispatch<SetStateAction<ChatSession[]>>;
  setModelOverrides: Dispatch<SetStateAction<ModelOverrideMap>>;
  setPresets: Dispatch<SetStateAction<ChatPreset[]>>;
  setCurrentSessionId: Dispatch<SetStateAction<string>>;
}

export function exportJsonBundle(
  sessions: ChatSession[],
  modelOverrides: ModelOverrideMap,
  presets: ChatPreset[]
) {
  const bundle: ChatExportBundle = {
    schemaVersion: 'liteflashchat.v1.4.0',
    exportedAt: new Date().toISOString(),
    sessions,
    modelOverrides,
    presets
  };
  downloadTextFile(
    `liteflashchat-backup-${makeTimestampForFile()}.json`,
    JSON.stringify(bundle, null, 2),
    'application/json;charset=utf-8'
  );
}

export function exportMarkdownLog(activeSession: ChatSession | undefined, sessions: ChatSession[]) {
  const exportTargets = activeSession ? [activeSession] : sessions;
  downloadTextFile(
    `liteflashchat-chat-${makeTimestampForFile()}.md`,
    buildMarkdownExport(exportTargets),
    'text/markdown;charset=utf-8'
  );
}

export function importJsonFile({
  event,
  isAiLoading,
  sessions,
  presets,
  compressionRatio,
  currentSessionId,
  setSessions,
  setModelOverrides,
  setPresets,
  setCurrentSessionId
}: ImportJsonOptions) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (isAiLoading) {
    alert('스트리밍 중에는 JSON 가져오기를 실행할 수 없습니다.');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!isChatExportBundle(parsed)) {
        throw new Error('지원하지 않는 LiteFlashChat 백업 스키마입니다.');
      }

      const now = Date.now();
      const existingSessionIds = new Set(sessions.map(session => session.id));
      const importedSessions = parsed.sessions.map((session, index) => {
        const normalized = normalizeSession(session, compressionRatio);
        if (!existingSessionIds.has(normalized.id)) {
          existingSessionIds.add(normalized.id);
          return normalized;
        }
        return {
          ...normalized,
          id: `session_${now}_${index}`
        };
      });

      const existingPresetIds = new Set(presets.map(preset => preset.id));
      const importedPresets = parsed.presets.map((preset, index) => {
        const nextPreset: ChatPreset = {
          ...preset,
          id: existingPresetIds.has(preset.id) ? `preset_${now}_${index}` : preset.id,
          generationSettings: normalizeGenerationSettings(preset.generationSettings),
          compressionRatio: clampNumber(preset.compressionRatio, 0.1, 1)
        };
        existingPresetIds.add(nextPreset.id);
        return nextPreset;
      });

      setSessions(prev => [...importedSessions, ...prev]);
      setModelOverrides(prev => ({ ...prev, ...parsed.modelOverrides }));
      setPresets(prev => [...importedPresets, ...prev]);
      if (!currentSessionId && importedSessions.length > 0) {
        setCurrentSessionId(importedSessions[0].id);
      }
      alert(`JSON 가져오기 완료: 대화 ${importedSessions.length}개, 프리셋 ${importedPresets.length}개, 모델 보정 ${Object.keys(parsed.modelOverrides).length}개 병합`);
    } catch (error) {
      alert(`JSON 가져오기 실패: ${error}`);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file, 'utf-8');
}
