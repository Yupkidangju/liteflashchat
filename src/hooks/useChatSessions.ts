import { useEffect, useState } from 'react';
import { SESSION_STORAGE_KEY } from '../constants';
import type { ChatSession } from '../types';

export function useChatSessions(initialSessions: ChatSession[], initialSessionId: string) {
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
  const [currentSessionId, setCurrentSessionId] = useState<string>(initialSessionId);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [sessions]);

  return {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId
  };
}
