import type { ReactNode, RefObject } from 'react';
import type { ChatSession } from '../types';

interface MessageListProps {
  activeSession?: ChatSession;
  isAiLoading: boolean;
  hasStreamingMessage: boolean;
  chatBottomRef: RefObject<HTMLDivElement | null>;
  renderMessageContent: (text: string) => ReactNode;
}

export function MessageList({
  activeSession,
  isAiLoading,
  hasStreamingMessage,
  chatBottomRef,
  renderMessageContent
}: MessageListProps) {
  return (
    <section className="message-list-viewport">
      {!activeSession || activeSession.messages.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>⚡</div>
          <div style={{ fontWeight: 600 }}>LiteFlashChat에 오신 것을 환영합니다!</div>
          <div style={{ fontSize: '0.8rem', marginTop: '6px' }}>⚙️ 설정에서 프로바이더를 연동하고, 좌측 Super Prompt에서 대화방 지침을 장착하십시오.</div>
        </div>
      ) : (
        activeSession.messages.map(message => (
          <div key={message.id} className={`message-wrapper ${message.role}`}>
            <div className="message-bubble">
              {message.attachments && message.attachments.map((attachment, index) => (
                <div key={index} style={{ marginBottom: '8px' }}>
                  <img src={attachment.url} alt={attachment.name} className="attachment-img" />
                </div>
              ))}
              {message.content ? (
                <div>{renderMessageContent(message.content)}</div>
              ) : message.status === 'streaming' ? (
                <div className="pulse-loader inline">
                  <div className="pulse-dot" />
                  <div className="pulse-dot" />
                  <div className="pulse-dot" />
                </div>
              ) : (
                <div className="empty-message-text">내용 없음</div>
              )}
              {message.status && message.status !== 'complete' && (
                <span className={`message-status ${message.status}`}>
                  {message.status === 'streaming' && '응답 생성 중'}
                  {message.status === 'cancelled' && '중지됨'}
                  {message.status === 'error' && (message.errorMessage ? `오류: ${message.errorMessage}` : '오류')}
                </span>
              )}
              <span className="message-time">{message.timestamp}</span>
            </div>
          </div>
        ))
      )}

      {isAiLoading && !hasStreamingMessage && (
        <div className="message-wrapper assistant">
          <div className="message-bubble">
            <div className="pulse-loader">
              <div className="pulse-dot" />
              <div className="pulse-dot" />
              <div className="pulse-dot" />
            </div>
          </div>
        </div>
      )}
      <div ref={chatBottomRef} />
    </section>
  );
}
