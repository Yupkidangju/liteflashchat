import type { Dispatch, SetStateAction } from 'react';
import type { ChatSession, ProviderState, ProviderType, SuperPrompt } from '../types';

interface SidebarProps {
  activeProvider: ProviderType;
  providers: ProviderState[];
  filteredSessions: ChatSession[];
  currentSessionId: string;
  chatSearchQuery: string;
  setChatSearchQuery: Dispatch<SetStateAction<string>>;
  editingSessionId: string;
  editingTitle: string;
  setEditingTitle: Dispatch<SetStateAction<string>>;
  activeSession?: ChatSession;
  promptSelection: string;
  setPromptSelection: Dispatch<SetStateAction<string>>;
  superPrompts: SuperPrompt[];
  onCreateNewChat: () => void;
  onSelectSession: (id: string) => void;
  onStartRenameSession: (e: React.MouseEvent, session: ChatSession) => void;
  onCommitRenameSession: (id: string) => void;
  onCancelRenameSession: () => void;
  onDeleteSession: (e: React.MouseEvent, id: string) => void;
  onApplyPromptByName: (name: string) => void;
  onUnloadPrompt: () => void;
  openPromptSettings: () => void;
}

export function Sidebar({
  activeProvider,
  providers,
  filteredSessions,
  currentSessionId,
  chatSearchQuery,
  setChatSearchQuery,
  editingSessionId,
  editingTitle,
  setEditingTitle,
  activeSession,
  promptSelection,
  setPromptSelection,
  superPrompts,
  onCreateNewChat,
  onSelectSession,
  onStartRenameSession,
  onCommitRenameSession,
  onCancelRenameSession,
  onDeleteSession,
  onApplyPromptByName,
  onUnloadPrompt,
  openPromptSettings
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="logo-section">
        <span className="logo-text">LiteFlashChat</span>
      </div>

      <button className="new-chat-btn" onClick={onCreateNewChat}>
        <span>+ New Chat</span>
      </button>

      <h3 className="section-title">Chat History</h3>
      <input
        type="search"
        className="chat-search-input"
        placeholder="대화 검색..."
        value={chatSearchQuery}
        onChange={(e) => setChatSearchQuery(e.target.value)}
      />
      {chatSearchQuery.trim() && (
        <div className="chat-search-meta">검색 결과 {filteredSessions.length}개</div>
      )}
      <ul className="chat-history-list">
        {filteredSessions.length === 0 ? (
          <li className="chat-history-empty">검색 결과가 없습니다.</li>
        ) : filteredSessions.map(session => (
          <li
            key={session.id}
            className={`chat-history-item ${session.id === currentSessionId ? 'active' : ''}`}
            onClick={() => onSelectSession(session.id)}
          >
            {editingSessionId === session.id ? (
              <input
                className="chat-title-edit-input"
                value={editingTitle}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={() => onCommitRenameSession(session.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onCommitRenameSession(session.id);
                  }
                  if (e.key === 'Escape') {
                    onCancelRenameSession();
                  }
                }}
              />
            ) : (
              <span
                className="chat-title-text"
                onDoubleClick={(e) => onStartRenameSession(e, session)}
              >
                {session.title}
              </span>
            )}
            <button
              onClick={(e) => onStartRenameSession(e, session)}
              className="chat-rename-btn"
              title="대화 제목 편집"
            >
              편집
            </button>
            <button
              onClick={(e) => onDeleteSession(e, session.id)}
              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              삭제
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar-prompt-panel">
        <div className="sidebar-prompt-header">
          <span>Super Prompt</span>
          <button type="button" className="sidebar-link-btn" onClick={openPromptSettings}>
            관리
          </button>
        </div>
        <div className="sidebar-prompt-current">
          현재: <strong>{activeSession?.activeSystemPromptName ?? '미적용'}</strong>
        </div>
        <select
          className="sidebar-prompt-select"
          value={promptSelection}
          disabled={!currentSessionId || superPrompts.length === 0}
          onChange={(e) => setPromptSelection(e.target.value)}
        >
          <option value="">선택 안 함</option>
          {superPrompts.map(prompt => (
            <option key={prompt.name} value={prompt.name}>{prompt.name}</option>
          ))}
        </select>
        <div className="sidebar-prompt-actions">
          <button
            type="button"
            className="sidebar-action-btn"
            disabled={!currentSessionId || !promptSelection || activeSession?.activeSystemPromptName === promptSelection}
            onClick={() => onApplyPromptByName(promptSelection)}
          >
            적용
          </button>
          <button
            type="button"
            className="sidebar-action-btn danger"
            disabled={!currentSessionId || !activeSession?.activeSystemPromptName}
            onClick={onUnloadPrompt}
          >
            해제
          </button>
        </div>
        {!currentSessionId && (
          <div className="sidebar-prompt-hint">대화방 생성 후 장착할 수 있습니다.</div>
        )}
      </div>

      <div className="sidebar-footer">
        <div>Provider: {providers.find(provider => provider.name === activeProvider)?.displayName ?? activeProvider}</div>
        <div style={{ marginTop: '4px' }}>Port: 8080 (Local)</div>
      </div>
    </aside>
  );
}
