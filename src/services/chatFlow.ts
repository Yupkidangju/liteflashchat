import type { Dispatch, RefObject, SetStateAction } from 'react';
import { apiUrl } from '../api/client';
import type {
  AttachmentInfo,
  ChatMessage,
  ChatSession,
  GenerationSettings,
  InspectorSnapshot,
  ModelInfo,
  OpenAIContentPart,
  OpenAIMessagePayload,
  ProviderType,
  StreamProxyEvent,
  SummaryCompressionResponse,
  SuperPrompt
} from '../types';
import { estimateTextTokens, normalizeGenerationSettings } from '../utils/modelMetadata';
import { sanitizeInspectorRequest } from '../utils/inspector';

function buildAutomaticTitle(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '새로운 대화';
  return normalized.length > 32 ? `${normalized.slice(0, 32)}...` : normalized;
}

function toOpenAIMessagePayload(message: ChatMessage): OpenAIMessagePayload {
  if (message.attachments && message.attachments.length > 0) {
    const contentArray: OpenAIContentPart[] = [{ type: 'text', text: message.content }];
    message.attachments.forEach(attachment => {
      contentArray.push({
        type: 'image_url',
        image_url: { url: attachment.url }
      });
    });
    return { role: message.role, content: contentArray };
  }
  return { role: message.role, content: message.content };
}

function buildPayloadMessages(
  pastMessages: ChatMessage[],
  userMsg: ChatMessage,
  summary: string,
  summarizedIds: string[]
): OpenAIMessagePayload[] {
  const summarizedIdSet = new Set(summarizedIds);
  const payloadMessages: OpenAIMessagePayload[] = [];

  if (summary.trim()) {
    payloadMessages.push({
      role: 'system',
      content: `이전 대화 요약:\n${summary.trim()}`
    });
  }

  pastMessages
    .filter(message => !summarizedIdSet.has(message.id))
    .forEach(message => payloadMessages.push(toOpenAIMessagePayload(message)));

  payloadMessages.push(toOpenAIMessagePayload(userMsg));
  return payloadMessages;
}

function estimatePayloadTokens(messages: OpenAIMessagePayload[], systemPromptContent: string): number {
  const contentTokens = messages.reduce((sum, message) => {
    if (typeof message.content === 'string') {
      return sum + estimateTextTokens(message.content);
    }
    return sum + message.content.reduce((partSum, part) => {
      if (part.type === 'text') {
        return partSum + estimateTextTokens(part.text);
      }
      return partSum + 64;
    }, 0);
  }, 0);
  return contentTokens + estimateTextTokens(systemPromptContent);
}

function appendSupportedGenerationSettings(
  body: Record<string, unknown>,
  modelInfo: ModelInfo | undefined,
  settings: GenerationSettings
) {
  if (!modelInfo) return;
  if (modelInfo.maxOutputTokens > 0) {
    body.max_completion_tokens = modelInfo.maxOutputTokens;
  }
  if (modelInfo.supportsTemperature) {
    body.temperature = settings.temperature;
  }
  if (modelInfo.supportsTopP) {
    body.top_p = settings.topP;
  }
  if (modelInfo.supportsTopK) {
    body.top_k = settings.topK;
  }
  if (modelInfo.supportsRepetitionPenalty) {
    body.repetition_penalty = settings.repetitionPenalty;
  }
}

function updateAssistantMessage(
  setSessions: Dispatch<SetStateAction<ChatSession[]>>,
  sessionId: string,
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage
) {
  setSessions(prev => prev.map(session => {
    if (session.id !== sessionId) return session;
    return {
      ...session,
      messages: session.messages.map(message => (
        message.id === messageId ? updater(message) : message
      ))
    };
  }));
}

async function readStreamResponse(
  response: Response,
  setSessions: Dispatch<SetStateAction<ChatSession[]>>,
  sessionId: string,
  assistantMessageId: string
): Promise<string> {
  if (!response.body) {
    throw new Error('스트리밍 응답 본문이 없습니다.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  const processEventBlock = (block: string) => {
    const dataLines = block
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim());

    dataLines.forEach(dataLine => {
      if (!dataLine) return;
      const event = JSON.parse(dataLine) as StreamProxyEvent;
      if (event.type === 'delta' && event.content) {
        accumulated += event.content;
        updateAssistantMessage(setSessions, sessionId, assistantMessageId, message => ({
          ...message,
          content: accumulated,
          status: 'streaming'
        }));
      }
      if (event.type === 'error') {
        throw new Error(event.content || '스트리밍 응답 오류');
      }
    });
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const eventBlocks = buffer.split('\n\n');
    buffer = eventBlocks.pop() ?? '';
    eventBlocks.forEach(processEventBlock);
    if (done) break;
  }
  if (buffer.trim()) {
    processEventBlock(buffer);
  }
  return accumulated;
}

function recordInspectorSnapshot(
  setInspectorSnapshot: Dispatch<SetStateAction<InspectorSnapshot | null>>,
  snapshot: Omit<InspectorSnapshot, 'id' | 'timestamp'>
) {
  setInspectorSnapshot({
    ...snapshot,
    id: 'inspect_' + Date.now(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
}

export interface RunChatTurnOptions {
  inputText: string;
  attachments: AttachmentInfo[];
  isAiLoading: boolean;
  currentSessionId: string;
  activeProvider: ProviderType;
  selectedModel: string;
  defaultGenerationSettings: GenerationSettings;
  compressionRatio: number;
  sessions: ChatSession[];
  superPrompts: SuperPrompt[];
  models: ModelInfo[];
  setSessions: Dispatch<SetStateAction<ChatSession[]>>;
  setCurrentSessionId: Dispatch<SetStateAction<string>>;
  setInputText: Dispatch<SetStateAction<string>>;
  setAttachments: Dispatch<SetStateAction<AttachmentInfo[]>>;
  setIsAiLoading: Dispatch<SetStateAction<boolean>>;
  streamAbortRef: RefObject<AbortController | null>;
  setInspectorSnapshot: Dispatch<SetStateAction<InspectorSnapshot | null>>;
}

export async function runChatTurn(options: RunChatTurnOptions): Promise<void> {
  const {
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
  } = options;

  if (!inputText.trim() && attachments.length === 0) return;
  if (isAiLoading) return;

  let sessionId = currentSessionId;
  if (!sessionId) {
    const newSessionId = 'session_' + Date.now();
    const newSession: ChatSession = {
      id: newSessionId,
      title: '새로운 대화',
      isTitleAutoGenerated: true,
      messages: [],
      provider: activeProvider,
      model: selectedModel,
      generationSettings: normalizeGenerationSettings(defaultGenerationSettings),
      compressionRatio
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    sessionId = newSessionId;
  }

  const userMsg: ChatMessage = {
    id: 'msg_' + Date.now(),
    role: 'user',
    content: inputText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    attachments: attachments.length > 0 ? [...attachments] : undefined,
    status: 'complete'
  };

  setSessions(prev => prev.map(session => {
    if (session.id === sessionId) {
      const shouldSetAutomaticTitle = session.isTitleAutoGenerated && session.messages.length === 0;
      return {
        ...session,
        title: shouldSetAutomaticTitle ? buildAutomaticTitle(userMsg.content) : session.title,
        isTitleAutoGenerated: shouldSetAutomaticTitle ? true : session.isTitleAutoGenerated,
        messages: [...session.messages, userMsg],
        model: selectedModel,
        provider: activeProvider,
        generationSettings: normalizeGenerationSettings(session.generationSettings ?? defaultGenerationSettings),
        compressionRatio: session.compressionRatio ?? compressionRatio
      };
    }
    return session;
  }));

  setInputText('');
  setAttachments([]);
  setIsAiLoading(true);
  let assistantMessageId = '';
  let inspectorRequestBody: Record<string, unknown> | null = null;
  let inspectorUsedSummary = false;

  try {
    const currentSession = sessions.find(session => session.id === sessionId);
    const pastMessages = currentSession ? currentSession.messages : [];
    let contextSummary = currentSession?.contextSummary ?? '';
    let summarizedMessageIds = currentSession?.summarizedMessageIds ?? [];

    let systemPromptContent = '';
    if (currentSession?.activeSystemPromptName) {
      const matchingPrompt = superPrompts.find(prompt => prompt.name === currentSession.activeSystemPromptName);
      if (matchingPrompt) {
        systemPromptContent = matchingPrompt.content;
      }
    }

    let formattedMessages = buildPayloadMessages(pastMessages, userMsg, contextSummary, summarizedMessageIds);
    const selectedInfo = models.find(model => model.id === selectedModel);
    const sessionGenerationSettings = normalizeGenerationSettings(currentSession?.generationSettings ?? defaultGenerationSettings);
    const sessionCompressionRatio = currentSession?.compressionRatio ?? compressionRatio;
    const maxInputTokens = selectedInfo?.maxInputTokens || selectedInfo?.contextLength || 0;
    const compressionThreshold = Math.floor(maxInputTokens * sessionCompressionRatio);
    const estimatedTokens = estimatePayloadTokens(formattedMessages, systemPromptContent);

    if (maxInputTokens > 0 && estimatedTokens > compressionThreshold && pastMessages.length > 2) {
      const summarizedIdSet = new Set(summarizedMessageIds);
      const unsummarizedPastMessages = pastMessages.filter(message => !summarizedIdSet.has(message.id));
      const messagesToSummarize = unsummarizedPastMessages.slice(0, Math.max(0, unsummarizedPastMessages.length - 4));

      if (messagesToSummarize.length > 0) {
        const summaryResp = await fetch(apiUrl('/chat/summary'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: activeProvider,
            model: selectedModel,
            target_ratio: sessionCompressionRatio,
            messages: messagesToSummarize.map(message => ({
              id: message.id,
              role: message.role,
              content: message.content
            }))
          })
        });

        if (!summaryResp.ok) {
          const err = await summaryResp.text();
          alert(`컨텍스트 압축 실패: ${err}`);
          return;
        }

        const summaryData = await summaryResp.json() as SummaryCompressionResponse;
        contextSummary = summaryData.summary;
        summarizedMessageIds = Array.from(new Set([
          ...summarizedMessageIds,
          ...summaryData.summarized_message_ids
        ]));

        setSessions(prev => prev.map(session => {
          if (session.id === sessionId) {
            return {
              ...session,
              contextSummary,
              summarizedMessageIds
            };
          }
          return session;
        }));

        formattedMessages = buildPayloadMessages(pastMessages, userMsg, contextSummary, summarizedMessageIds);
      }
    }

    const requestBody: Record<string, unknown> = {
      provider: activeProvider,
      model: selectedModel,
      messages: formattedMessages satisfies OpenAIMessagePayload[],
      system_prompt: systemPromptContent
    };
    appendSupportedGenerationSettings(requestBody, selectedInfo, sessionGenerationSettings);
    inspectorRequestBody = requestBody;
    inspectorUsedSummary = Boolean(contextSummary.trim());

    assistantMessageId = 'msg_' + Date.now() + '_ai';
    const assistantMsg: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'streaming'
    };

    setSessions(prev => prev.map(session => {
      if (session.id === sessionId) {
        return { ...session, messages: [...session.messages, assistantMsg] };
      }
      return session;
    }));

    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    const chatResp = await fetch(apiUrl('/chat/stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: abortController.signal
    });

    recordInspectorSnapshot(setInspectorSnapshot, {
      provider: activeProvider,
      model: selectedModel,
      endpoint: '/api/chat/stream',
      streaming: true,
      sanitizedRequest: sanitizeInspectorRequest(requestBody),
      responseStatus: chatResp.status,
      usedContextSummary: inspectorUsedSummary
    });

    if (!chatResp.ok) {
      const err = await chatResp.text();
      updateAssistantMessage(setSessions, sessionId, assistantMessageId, message => ({
        ...message,
        status: 'error',
        errorMessage: err,
        content: message.content || '응답 생성 실패'
      }));
      recordInspectorSnapshot(setInspectorSnapshot, {
        provider: activeProvider,
        model: selectedModel,
        endpoint: '/api/chat/stream',
        streaming: true,
        sanitizedRequest: sanitizeInspectorRequest(requestBody),
        responseStatus: chatResp.status,
        responsePreview: err,
        errorMessage: err,
        usedContextSummary: inspectorUsedSummary
      });
      return;
    }

    const streamedText = await readStreamResponse(chatResp, setSessions, sessionId, assistantMessageId);
    updateAssistantMessage(setSessions, sessionId, assistantMessageId, message => ({
      ...message,
      content: streamedText || message.content || '응답이 비어 있습니다.',
      status: 'complete'
    }));
    recordInspectorSnapshot(setInspectorSnapshot, {
      provider: activeProvider,
      model: selectedModel,
      endpoint: '/api/chat/stream',
      streaming: true,
      sanitizedRequest: sanitizeInspectorRequest(requestBody),
      responseStatus: chatResp.status,
      responsePreview: streamedText,
      usedContextSummary: inspectorUsedSummary
    });
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    if (assistantMessageId) {
      updateAssistantMessage(setSessions, sessionId, assistantMessageId, message => ({
        ...message,
        status: isAbort ? 'cancelled' : 'error',
        errorMessage: isAbort ? undefined : String(error),
        content: message.content || (isAbort ? '요청이 중지되었습니다.' : '응답 생성 실패')
      }));
    }
    if (!isAbort && inspectorRequestBody) {
      recordInspectorSnapshot(setInspectorSnapshot, {
        provider: activeProvider,
        model: selectedModel,
        endpoint: '/api/chat/stream',
        streaming: true,
        sanitizedRequest: sanitizeInspectorRequest(inspectorRequestBody),
        errorMessage: String(error),
        responsePreview: String(error),
        usedContextSummary: inspectorUsedSummary
      });
    }
    if (!isAbort) {
      alert(`API 연결 실패: ${error}`);
    }
  } finally {
    streamAbortRef.current = null;
    setIsAiLoading(false);
  }
}
