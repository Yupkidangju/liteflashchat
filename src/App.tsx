// [v1.4.0] App은 화면 조립과 최상위 상태 연결만 담당하며, 세부 UI와 실행 서비스는 하위 모듈로 분리합니다.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  ProviderType,
  ProviderState,
  ModelInfo,
  ChatSession,
  AttachmentInfo,
  SuperPrompt,
  GenerationSettings,
  ModelMetadataOverride,
  ChatPreset
} from './types';
import { LOCAL_PROVIDER_SET } from './constants';
import {
  applyModelOverrides,
  clampNumber,
  estimateTextTokens,
  modelOverrideKey,
  normalizeGenerationSettings,
  normalizeModelOverride,
  type ModelOverrideMap
} from './utils/modelMetadata';
import {
  readStoredCompressionRatio,
  readStoredModelOverrides,
  readStoredPresets,
  readStoredSessions
} from './utils/storage';
import {
  deletePrompt as deletePromptRequest,
  getModels,
  getPrompts,
  getProviders,
  savePrompt as savePromptRequest,
  saveProviderConfig
} from './api/client';
import { ChatHeader } from './components/ChatHeader';
import { InputPanel } from './components/InputPanel';
import { MessageList } from './components/MessageList';
import { ModelSearchModal } from './components/ModelSearchModal';
import { ParamsPanel } from './components/ParamsPanel';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { renderMessageContent } from './components/renderMessageContent';
import { useChatSessions } from './hooks/useChatSessions';
import { useCompressionRatio } from './hooks/useCompressionRatio';
import { useInspector } from './hooks/useInspector';
import { useModelOverrides } from './hooks/useModelOverrides';
import { usePresets } from './hooks/usePresets';
import { runChatTurn } from './services/chatFlow';
import { exportJsonBundle, exportMarkdownLog, importJsonFile } from './services/dataPortability';
import { defaultBaseUrlForProvider, formatModelError } from './utils/providerDisplay';

const BOOTSTRAP_SESSIONS = readStoredSessions();
const BOOTSTRAP_SESSION = BOOTSTRAP_SESSIONS[0];

export default function App() {
  // --- 1. React 상태(State) 통합 관리 ---
  const [providers, setProviders] = useState<ProviderState[]>([]);
  const [activeProvider, setActiveProvider] = useState<ProviderType>(BOOTSTRAP_SESSION?.provider ?? 'openrouter');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(BOOTSTRAP_SESSION?.model ?? '');
  const [modelLoadError, setModelLoadError] = useState<string>('');
  
  // 세션 관리
  const { sessions, setSessions, currentSessionId, setCurrentSessionId } = useChatSessions(
    BOOTSTRAP_SESSIONS,
    BOOTSTRAP_SESSION?.id ?? ''
  );
  const [defaultGenerationSettings, setDefaultGenerationSettings] = useState<GenerationSettings>(
    normalizeGenerationSettings(BOOTSTRAP_SESSION?.generationSettings)
  );
  const { compressionRatio, setCompressionRatio } = useCompressionRatio(readStoredCompressionRatio());
  const { modelOverrides, setModelOverrides } = useModelOverrides(readStoredModelOverrides());
  const { presets, setPresets, presetNameInput, setPresetNameInput } = usePresets(readStoredPresets());
  const [chatSearchQuery, setChatSearchQuery] = useState<string>('');
  const { inspectorSnapshot, setInspectorSnapshot, copyInspector } = useInspector();
  const [overrideContextInput, setOverrideContextInput] = useState<string>('');
  const [overrideInputInput, setOverrideInputInput] = useState<string>('');
  const [overrideOutputInput, setOverrideOutputInput] = useState<string>('');
  const [editingSessionId, setEditingSessionId] = useState<string>('');
  const [editingTitle, setEditingTitle] = useState<string>('');

  // ⚙️ 통합 설정 레이어 모달 제어
  const [isSetupOpen, setIsSetupOpen] = useState<boolean>(false);
  const [setupTab, setSetupTab] = useState<'keys' | 'prompts' | 'general' | 'presets'>('keys');

  // API Key 등록 서브 폼 상태
  const [modalProvider, setModalProvider] = useState<ProviderType>('openrouter');
  const [inputApiKey, setInputApiKey] = useState<string>('');
  const [inputBaseUrl, setInputBaseUrl] = useState<string>('');

  // [v1.2.1] 프로바이더 수정 모드 추적 상태
  // isProviderEditMode: 이미 API Key가 등록된 프로바이더를 편집 중인지 여부
  // originalBaseUrl: 수정 모드 진입 시 기존 저장된 Base URL (변경 감지용)
  const [isProviderEditMode, setIsProviderEditMode] = useState<boolean>(false);
  const [originalBaseUrl, setOriginalBaseUrl] = useState<string>('');

  // Super Prompt 목록 및 CRUD 입력 상태
  const [superPrompts, setSuperPrompts] = useState<SuperPrompt[]>([]);
  const [promptSelection, setPromptSelection] = useState<string>(BOOTSTRAP_SESSION?.activeSystemPromptName ?? '');
  const [promptNameInput, setPromptNameInput] = useState<string>('');
  const [promptContentInput, setPromptContentInput] = useState<string>('');

  // 🔍 모델 탐색기 모달 상태
  const [isModelSearcherOpen, setIsModelSearcherOpen] = useState<boolean>(false);
  const [modelSearchQuery, setModelSearchQuery] = useState<string>('');

  // 대화 및 파일 첨부 상태
  const [inputText, setInputText] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const activeSession = sessions.find(s => s.id === currentSessionId);

  // --- 3. Go 백엔드 비동기 통신 레이어 (REST API) ---

  // 프로바이더 목록 연동 상태 조회
  const fetchProviders = useCallback(async (): Promise<ProviderState[]> => {
    try {
      const data = await getProviders();
      setProviders(data);
      return data;
    } catch (e) {
      console.error('프로바이더 로드 실패:', e);
    }
    return [];
  }, []);

  // 모델 목록 동적 조회
  const fetchModels = useCallback(async (provider: ProviderType, overrideMap: ModelOverrideMap = modelOverrides) => {
    try {
      const data = await getModels(provider);
      const hydratedModels = applyModelOverrides(provider, data, overrideMap);
      setModels(hydratedModels);
      setModelLoadError('');
      if (hydratedModels.length > 0) {
        const currentSession = sessions.find(s => s.id === currentSessionId);
        if (currentSession && currentSession.provider === provider && hydratedModels.some(m => m.id === currentSession.model)) {
          setSelectedModel(currentSession.model);
        } else {
          setSelectedModel(hydratedModels[0].id);
        }
      } else {
        setSelectedModel('');
      }
    } catch (e) {
      console.error('모델 로드 예외:', e);
      setModels([]);
      setSelectedModel('');
      const status = typeof e === 'object' && e !== null && 'status' in e && typeof e.status === 'number'
        ? e.status
        : 0;
      setModelLoadError(status ? formatModelError(status, String((e as Error).message)) : `모델 목록 서버 연결 실패: ${e}`);
    }
  }, [currentSessionId, modelOverrides, sessions]);

  // Super Prompt 목록 인출
  const fetchPrompts = useCallback(async () => {
    try {
      const data = await getPrompts();
      setSuperPrompts(data);
    } catch (e) {
      console.error('프롬프트 로딩 실패:', e);
    }
  }, []);

  // --- 2. 생명주기 및 동기화 ---
  useEffect(() => {
    void fetchProviders();
    void fetchPrompts();
  }, [fetchProviders, fetchPrompts]);

  // 현재 선택된 대화방의 Super Prompt 장착 상태를 사이드바 선택 박스에 반영합니다.
  useEffect(() => {
    setPromptSelection(activeSession?.activeSystemPromptName ?? '');
  }, [activeSession?.activeSystemPromptName]);

  // 대화방 변경 및 수발신 시 스크롤 제어
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, isAiLoading]);

  useEffect(() => {
    const modelInfo = models.find(m => m.id === selectedModel);
    setOverrideContextInput(modelInfo?.contextLength ? String(modelInfo.contextLength) : '');
    setOverrideInputInput(modelInfo?.maxInputTokens ? String(modelInfo.maxInputTokens) : '');
    setOverrideOutputInput(modelInfo?.maxOutputTokens ? String(modelInfo.maxOutputTokens) : '');
  }, [models, selectedModel]);

  // 활성 프로바이더 변경 시 원격 모델 목록 인출
  useEffect(() => {
    const prov = providers.find(p => p.name === activeProvider);
    if (prov && prov.hasKey) {
      void fetchModels(activeProvider);
    } else {
      setModels([]);
      setSelectedModel('');
      setModelLoadError(prov?.statusMessage ?? '');
    }
  }, [activeProvider, fetchModels, providers]);

  // [v1.2.1] API Key 등록/수정 요청 전송
  // 수정 모드에서 API Key가 비어있으면 기존 키를 유지하기 위해 'keep_existing' 플래그를 전송합니다.
  // Base URL만 변경하는 경우에도 저장이 정상적으로 수행됩니다.
  const handleSaveApiKey = async () => {
    // 신규 등록 시: API Key 필수 / 수정 모드 시: Key 또는 URL 중 하나라도 변경되면 허용
    if (!isProviderEditMode && !inputApiKey && !LOCAL_PROVIDER_SET.has(modalProvider)) return;
    if (isProviderEditMode && !inputApiKey && inputBaseUrl === originalBaseUrl) return;

    try {
      const requestBody: Record<string, string> = {
        provider: modalProvider,
        base_url: inputBaseUrl
      };

      if (inputApiKey) {
        // 새 API Key가 입력된 경우: 새 키로 교체
        requestBody.api_key = inputApiKey;
      } else {
        // 수정 모드에서 API Key 미입력: 기존 암호화 키 유지 플래그
        requestBody.api_key = '__KEEP_EXISTING__';
      }

      await saveProviderConfig(requestBody);
      const savedProviderName = modalProvider;
      const wasEditMode = isProviderEditMode;
      const updatedProviders = await fetchProviders();
      const savedProvider = updatedProviders.find(p => p.name === savedProviderName);

      setInputApiKey('');
      if (savedProvider) {
        setActiveProvider(savedProvider.name);
        setModalProvider(savedProvider.name);
        setInputBaseUrl(savedProvider.baseUrl);
        setOriginalBaseUrl(savedProvider.baseUrl);
        setIsProviderEditMode(savedProvider.hasKey);
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            return { ...s, provider: savedProvider.name };
          }
          return s;
        }));

        if (savedProvider.hasKey) {
          await fetchModels(savedProvider.name);
        } else {
          setModels([]);
          setSelectedModel('');
          setModelLoadError(savedProvider.statusMessage);
        }
      } else {
        setIsProviderEditMode(false);
        setOriginalBaseUrl('');
      }
      alert(wasEditMode ? '프로바이더 설정이 성공적으로 수정 반영되었습니다.' : 'API 연동 정보가 안전하게 암호화 보존되었습니다.');
    } catch (e) {
      alert(`저장 에러: ${e}`);
    }
  };

  // Super Prompt 저장 및 덮어쓰기 편집 요청
  const handleSavePrompt = async () => {
    if (!promptNameInput.trim() || !promptContentInput.trim()) return;
    try {
      await savePromptRequest({
        name: promptNameInput.trim(),
        content: promptContentInput.trim()
      });
      setPromptNameInput('');
      setPromptContentInput('');
      alert('Super Prompt가 로컬 prompts.json에 완벽히 보존되었습니다.');
      await fetchPrompts();
    } catch (e) {
      alert(`프롬프트 저장 실패: ${e}`);
    }
  };

  // Super Prompt 영구 삭제
  const handleDeletePrompt = async (name: string) => {
    if (!confirm(`"${name}" 프롬프트를 영구 삭제하시겠습니까?`)) return;
    try {
      await deletePromptRequest(name);
      alert('성공적으로 삭제되었습니다.');
      await fetchPrompts();
      setSessions(prev => prev.map(s => {
        if (s.activeSystemPromptName === name) {
          return { ...s, activeSystemPromptName: undefined };
        }
        return s;
      }));
    } catch (e) {
      alert(`삭제 오류: ${e}`);
    }
  };

  // --- 4. 대화방 및 파일 첨부 비즈니스 로직 ---

  const handleUpdateGenerationSetting = (key: keyof GenerationSettings, value: number) => {
    const normalizedValue = key === 'topK'
      ? Math.max(0, Math.round(value))
      : value;

    if (currentSessionId) {
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            generationSettings: normalizeGenerationSettings({
              ...s.generationSettings,
              [key]: normalizedValue
            })
          };
        }
        return s;
      }));
    } else {
      setDefaultGenerationSettings(prev => normalizeGenerationSettings({
        ...prev,
        [key]: normalizedValue
      }));
    }
  };

  const handleCompressionRatioChange = (value: number) => {
    const nextRatio = clampNumber(value, 0.1, 1);
    setCompressionRatio(nextRatio);
    if (currentSessionId) {
      setSessions(prev => prev.map(s => (
        s.id === currentSessionId ? { ...s, compressionRatio: nextRatio } : s
      )));
    }
  };

  const handleSaveModelOverride = () => {
    if (!selectedModel) return;
    const normalized = normalizeModelOverride({
      contextLength: Number(overrideContextInput),
      maxInputTokens: Number(overrideInputInput),
      maxOutputTokens: Number(overrideOutputInput)
    });
    if (normalized.contextLength <= 0 || normalized.maxInputTokens <= 0) {
      alert('최대 컨텍스트와 입력 한도는 1 이상이어야 합니다.');
      return;
    }
    setModelOverrides(prev => {
      const next = {
        ...prev,
        [modelOverrideKey(activeProvider, selectedModel)]: normalized
      };
      setModels(currentModels => applyModelOverrides(activeProvider, currentModels, next));
      return next;
    });
  };

  const handleClearModelOverride = () => {
    if (!selectedModel) return;
    setModelOverrides(prev => {
      const next = { ...prev };
      delete next[modelOverrideKey(activeProvider, selectedModel)];
      void fetchModels(activeProvider, next);
      return next;
    });
  };

  const handleStartRenameSession = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleCommitRenameSession = (id: string) => {
    const title = editingTitle.trim();
    if (title) {
      setSessions(prev => prev.map(s => (
        s.id === id ? { ...s, title, isTitleAutoGenerated: false } : s
      )));
    }
    setEditingSessionId('');
    setEditingTitle('');
  };

  const handleCancelRenameSession = () => {
    setEditingSessionId('');
    setEditingTitle('');
  };

  const handleCreateNewChat = () => {
    const newSession: ChatSession = {
      id: 'session_' + Date.now(),
      title: '새로운 대화 ' + (sessions.length + 1),
      isTitleAutoGenerated: true,
      messages: [],
      provider: activeProvider,
      model: selectedModel,
      generationSettings: normalizeGenerationSettings(defaultGenerationSettings),
      compressionRatio
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    const session = sessions.find(s => s.id === id);
    if (session) {
      setActiveProvider(session.provider);
      setSelectedModel(session.model);
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (editingSessionId === id) {
      handleCancelRenameSession();
    }
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId('');
    }
  };

  // 이미지 파일 로컬 인코딩 (Base64)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 파일 크기는 최대 5MB까지만 허용됩니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAttachments([{
          name: file.name,
          type: file.type,
          size: file.size,
          url: event.target.result as string
        }]);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCancelAttachment = () => {
    setAttachments([]);
  };

  // Super Prompt 편집 폼 적재 루틴
  const handleEditPrompt = (prompt: SuperPrompt) => {
    setPromptNameInput(prompt.name);
    setPromptContentInput(prompt.content);
  };

  // Super Prompt 장착 루틴은 사이드바에서만 수행하여 설정 CRUD와 대화방 적용 책임을 분리합니다.
  const handleApplyPromptByName = (name: string) => {
    if (!currentSessionId || !name) return;
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, activeSystemPromptName: name };
      }
      return s;
    }));
    setPromptSelection(name);
  };

  // 대화방에 지정된 Super Prompt 해제
  const handleUnloadPrompt = () => {
    if (!currentSessionId) return;
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, activeSystemPromptName: undefined };
      }
      return s;
    }));
    setPromptSelection('');
  };

  // API 챗 메인 프록시 발송
  const handleSendMessage = () => {
    void runChatTurn({
      inputText,
      attachments,
      isAiLoading,
      currentSessionId,
      activeProvider,
      selectedModel,
      defaultGenerationSettings,
      compressionRatio,
      sessions,
      superPrompts,
      models,
      setSessions,
      setCurrentSessionId,
      setInputText,
      setAttachments,
      setIsAiLoading,
      streamAbortRef,
      setInspectorSnapshot
    });
  };

  const handleCancelStream = () => {
    streamAbortRef.current?.abort();
    const sessionId = currentSessionId;
    if (!sessionId) return;
    setSessions(prev => prev.map(session => {
      if (session.id !== sessionId) return session;
      return {
        ...session,
        messages: session.messages.map(message => (
          message.status === 'streaming'
            ? { ...message, status: 'cancelled' as const }
            : message
        ))
      };
    }));
    setIsAiLoading(false);
  };

  const handleExportJson = () => {
    exportJsonBundle(sessions, modelOverrides, presets);
  };

  const handleExportMarkdown = () => {
    exportMarkdownLog(activeSession, sessions);
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    importJsonFile({
      event: e,
      isAiLoading,
      sessions,
      presets,
      compressionRatio,
      currentSessionId,
      setSessions,
      setModelOverrides,
      setPresets,
      setCurrentSessionId
    });
  };

  const handleSavePreset = () => {
    if (!selectedModel || !presetNameInput.trim()) return;
    const override = modelOverrides[modelOverrideKey(activeProvider, selectedModel)];
    const now = new Date().toISOString();
    const preset: ChatPreset = {
      id: 'preset_' + crypto.randomUUID(),
      name: presetNameInput.trim(),
      provider: activeProvider,
      model: selectedModel,
      activeSystemPromptName: activeSession?.activeSystemPromptName,
      generationSettings: activeGenerationSettings,
      compressionRatio: activeCompressionRatio,
      modelOverride: override,
      createdAt: now,
      updatedAt: now
    };
    setPresets(prev => [preset, ...prev]);
    setPresetNameInput('');
  };

  const handleApplyPreset = (preset: ChatPreset) => {
    if (isAiLoading) return;
    const providerState = providers.find(provider => provider.name === preset.provider);
    if (!providerState?.hasKey) {
      alert('프리셋의 프로바이더가 아직 설정되지 않았습니다.');
      return;
    }
    const hasLoadedModel = preset.provider !== activeProvider || models.length === 0 || models.some(model => model.id === preset.model);
    if (!hasLoadedModel) {
      alert('현재 모델 목록에서 프리셋 모델을 찾을 수 없습니다.');
      return;
    }

    const nextSettings = normalizeGenerationSettings(preset.generationSettings);
    const nextCompressionRatio = clampNumber(preset.compressionRatio, 0.1, 1);
    setActiveProvider(preset.provider);
    setSelectedModel(preset.model);
    setPromptSelection(preset.activeSystemPromptName ?? '');
    setDefaultGenerationSettings(nextSettings);
    setCompressionRatio(nextCompressionRatio);
    if (preset.modelOverride) {
      setModelOverrides(prev => ({
        ...prev,
        [modelOverrideKey(preset.provider, preset.model)]: preset.modelOverride as ModelMetadataOverride
      }));
    }

    if (currentSessionId) {
      setSessions(prev => prev.map(session => (
        session.id === currentSessionId
          ? {
              ...session,
              provider: preset.provider,
              model: preset.model,
              activeSystemPromptName: preset.activeSystemPromptName,
              generationSettings: nextSettings,
              compressionRatio: nextCompressionRatio
            }
          : session
      )));
    }
  };

  const handleRenamePreset = (presetId: string) => {
    const target = presets.find(preset => preset.id === presetId);
    if (!target) return;
    const nextName = prompt('새 프리셋 이름을 입력하십시오.', target.name);
    if (!nextName?.trim()) return;
    setPresets(prev => prev.map(preset => (
      preset.id === presetId
        ? { ...preset, name: nextName.trim(), updatedAt: new Date().toISOString() }
        : preset
    )));
  };

  const handleDeletePreset = (presetId: string) => {
    if (!confirm('이 프리셋을 삭제하시겠습니까?')) return;
    setPresets(prev => prev.filter(preset => preset.id !== presetId));
  };

  // [v1.2.1] 모달 프로바이더 변경 시 수정 모드 감지 및 Base URL 동기화
  // 이미 키가 등록된 프로바이더로 전환하면 자동으로 수정 모드로 진입합니다.
  const handleModalProviderChange = (pType: ProviderType) => {
    setModalProvider(pType);
    setInputApiKey('');
    const matched = providers.find(p => p.name === pType);
    if (matched) {
      setInputBaseUrl(matched.baseUrl);
      setOriginalBaseUrl(matched.baseUrl);
      setIsProviderEditMode(matched.hasKey);
    } else {
      setIsProviderEditMode(false);
      setOriginalBaseUrl('');
      setInputBaseUrl(defaultBaseUrlForProvider(pType));
    }
  };

  // [v1.2.1] 이미 연동 여부와 관계없이 설정창 모달을 열고 해당 프로바이더의 기 저장 설정 URL을 적재하는 ⚙️ 트리거 핸들러
  // 기존에 키가 등록된 프로바이더면 수정 모드(isProviderEditMode=true)로 진입하여
  // API Key 없이도 Base URL 변경만으로 저장이 가능하게 합니다.
  const handleOpenSettings = (provider: ProviderState) => {
    setModalProvider(provider.name);
    
    // 백엔드로부터 가져온 최신 프로바이더 상태의 Base URL을 즉시 입력창에 바인딩
    setInputBaseUrl(provider.baseUrl);
    setOriginalBaseUrl(provider.baseUrl);
    setInputApiKey('');
    
    // 이미 API Key가 등록되어 있으면 수정 모드 활성화
    setIsProviderEditMode(provider.hasKey);
    
    setSetupTab('keys');
    setIsSetupOpen(true);
  };

  // 🔍 모델 모달 선택 확정 핸들러
  const handleSelectModelConfirm = (modelId: string) => {
    setSelectedModel(modelId);
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, model: modelId };
      }
      return s;
    }));
    setIsModelSearcherOpen(false);
    setModelSearchQuery('');
  };

  const activeModelInfo = models.find(m => m.id === selectedModel);
  const supportsVision = activeModelInfo ? activeModelInfo.supportsVision : false;
  const activeGenerationSettings = normalizeGenerationSettings(activeSession?.generationSettings ?? defaultGenerationSettings);
  const activeCompressionRatio = activeSession?.compressionRatio ?? compressionRatio;
  const activeContextLength = activeModelInfo?.contextLength ?? 0;
  const activeInputLimit = activeModelInfo?.maxInputTokens ?? 0;
  const activeSummaryTokens = activeSession?.contextSummary ? estimateTextTokens(activeSession.contextSummary) : 0;
  const activeMessagesTokens = activeSession?.messages.reduce((sum, message) => sum + estimateTextTokens(message.content) + (message.attachments?.length ?? 0) * 64, 0) ?? 0;
  const draftInputTokens = estimateTextTokens(inputText) + attachments.length * 64;
  const estimatedContextTokens = activeSummaryTokens + activeMessagesTokens + draftInputTokens;
  const contextUsageRatio = activeInputLimit > 0 ? estimatedContextTokens / activeInputLimit : 0;
  const contextStatusClass = contextUsageRatio >= 0.9 ? 'danger' : contextUsageRatio >= activeCompressionRatio ? 'warning' : 'normal';

  // 실시간 모델 필터링 검색
  const filteredModels = models.filter(m => {
    const query = modelSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return m.id.toLowerCase().includes(query) || m.name.toLowerCase().includes(query);
  });

  const filteredSessions = sessions.filter(session => {
    const query = chatSearchQuery.toLowerCase().trim();
    if (!query) return true;
    const searchable = [
      session.title,
      session.provider,
      session.model,
      session.activeSystemPromptName ?? '',
      ...session.messages.map(message => message.content)
    ].join('\n').toLowerCase();
    return searchable.includes(query);
  });

  const hasStreamingMessage = Boolean(activeSession?.messages.some(message => message.status === 'streaming'));

  return (
    <div className="app-container">
      <Sidebar
        activeProvider={activeProvider}
        providers={providers}
        filteredSessions={filteredSessions}
        currentSessionId={currentSessionId}
        chatSearchQuery={chatSearchQuery}
        setChatSearchQuery={setChatSearchQuery}
        editingSessionId={editingSessionId}
        editingTitle={editingTitle}
        setEditingTitle={setEditingTitle}
        activeSession={activeSession}
        promptSelection={promptSelection}
        setPromptSelection={setPromptSelection}
        superPrompts={superPrompts}
        onCreateNewChat={handleCreateNewChat}
        onSelectSession={handleSelectSession}
        onStartRenameSession={handleStartRenameSession}
        onCommitRenameSession={handleCommitRenameSession}
        onCancelRenameSession={handleCancelRenameSession}
        onDeleteSession={handleDeleteSession}
        onApplyPromptByName={handleApplyPromptByName}
        onUnloadPrompt={handleUnloadPrompt}
        openPromptSettings={() => {
          setSetupTab('prompts');
          setIsSetupOpen(true);
        }}
      />

      <main className="chat-area">
        <ChatHeader
          activeProvider={activeProvider}
          providers={providers}
          supportsVision={supportsVision}
          selectedModel={selectedModel}
          modelsCount={models.length}
          modelLoadError={modelLoadError}
          openModelSearch={() => setIsModelSearcherOpen(true)}
          openSettings={handleOpenSettings}
          openFallbackSettings={() => setIsSetupOpen(true)}
        />
        <MessageList
          activeSession={activeSession}
          isAiLoading={isAiLoading}
          hasStreamingMessage={hasStreamingMessage}
          chatBottomRef={chatBottomRef}
          renderMessageContent={renderMessageContent}
        />
        <InputPanel
          attachments={attachments}
          fileInputRef={fileInputRef}
          supportsVision={supportsVision}
          contextStatusClass={contextStatusClass}
          estimatedContextTokens={estimatedContextTokens}
          activeInputLimit={activeInputLimit}
          activeCompressionRatio={activeCompressionRatio}
          activeModelInfo={activeModelInfo}
          inputText={inputText}
          setInputText={setInputText}
          modelsCount={models.length}
          isAiLoading={isAiLoading}
          onFileChange={handleFileChange}
          onCancelAttachment={handleCancelAttachment}
          onSendMessage={handleSendMessage}
          onCancelStream={handleCancelStream}
        />
      </main>

      <ParamsPanel
        activeModelInfo={activeModelInfo}
        activeGenerationSettings={activeGenerationSettings}
        activeContextLength={activeContextLength}
        activeInputLimit={activeInputLimit}
        inspectorSnapshot={inspectorSnapshot}
        onUpdateGenerationSetting={handleUpdateGenerationSetting}
        onCopyInspector={(mode) => void copyInspector(mode)}
      />

      <SettingsModal
        isOpen={isSetupOpen}
        close={() => setIsSetupOpen(false)}
        setupTab={setupTab}
        setSetupTab={setSetupTab}
        providers={providers}
        modalProvider={modalProvider}
        onModalProviderChange={handleModalProviderChange}
        inputApiKey={inputApiKey}
        setInputApiKey={setInputApiKey}
        inputBaseUrl={inputBaseUrl}
        setInputBaseUrl={setInputBaseUrl}
        isProviderEditMode={isProviderEditMode}
        originalBaseUrl={originalBaseUrl}
        onSaveApiKey={handleSaveApiKey}
        promptNameInput={promptNameInput}
        setPromptNameInput={setPromptNameInput}
        promptContentInput={promptContentInput}
        setPromptContentInput={setPromptContentInput}
        onSavePrompt={handleSavePrompt}
        superPrompts={superPrompts}
        onEditPrompt={handleEditPrompt}
        onDeletePrompt={handleDeletePrompt}
        importInputRef={importInputRef}
        sessions={sessions}
        presets={presets}
        isAiLoading={isAiLoading}
        onImportJsonFile={handleImportJsonFile}
        onExportJson={handleExportJson}
        onExportMarkdown={handleExportMarkdown}
        activeCompressionRatio={activeCompressionRatio}
        onCompressionRatioChange={handleCompressionRatioChange}
        selectedModel={selectedModel}
        activeModelInfo={activeModelInfo}
        overrideContextInput={overrideContextInput}
        setOverrideContextInput={setOverrideContextInput}
        overrideInputInput={overrideInputInput}
        setOverrideInputInput={setOverrideInputInput}
        overrideOutputInput={overrideOutputInput}
        setOverrideOutputInput={setOverrideOutputInput}
        onClearModelOverride={handleClearModelOverride}
        onSaveModelOverride={handleSaveModelOverride}
        presetNameInput={presetNameInput}
        setPresetNameInput={setPresetNameInput}
        activeProvider={activeProvider}
        activeSession={activeSession}
        onSavePreset={handleSavePreset}
        onApplyPreset={handleApplyPreset}
        onRenamePreset={handleRenamePreset}
        onDeletePreset={handleDeletePreset}
      />

      <ModelSearchModal
        isOpen={isModelSearcherOpen}
        filteredModels={filteredModels}
        selectedModel={selectedModel}
        modelSearchQuery={modelSearchQuery}
        setModelSearchQuery={setModelSearchQuery}
        close={() => {
          setIsModelSearcherOpen(false);
          setModelSearchQuery('');
        }}
        onSelectModelConfirm={handleSelectModelConfirm}
      />
    </div>
  );
}
