import { useCallback, useState } from 'react';
import { SessionSummary, copilotService } from '../../services/copilotService';

interface UseAssistantSessionHistoryParams {
  currentSessionId: string | null;
  isOrganizationSpace: boolean;
  loadSession: (id: string) => Promise<void>;
  onNewConversation: () => void;
  organizationId?: string;
}

export function useAssistantSessionHistory({
  currentSessionId,
  isOrganizationSpace,
  loadSession,
  onNewConversation,
  organizationId,
}: UseAssistantSessionHistoryParams) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'explore' | 'study'>('all');
  const [renamingSession, setRenamingSession] = useState<SessionSummary | null>(null);
  const [renameText, setRenameText] = useState('');

  const loadSessions = useCallback(async () => {
    try {
      const response = await copilotService.listSessions(
        20,
        isOrganizationSpace ? organizationId : undefined
      );
      if (response.data?.sessions) {
        setSessions(response.data.sessions);
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to load sessions:', error);
    }
  }, [isOrganizationSpace, organizationId]);

  const handleOpenHistory = useCallback(async () => {
    await loadSessions();
    setShowHistory(true);
  }, [loadSessions]);

  const handleSelectSession = useCallback(
    async (session: SessionSummary) => {
      setShowHistory(false);
      await loadSession(session.id);
    },
    [loadSession]
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        await copilotService.deleteSession(id);
        setSessions((prev) => prev.filter((session) => session.id !== id));
        if (currentSessionId === id) {
          onNewConversation();
        }
      } catch (error) {
        if (__DEV__) console.error('Failed to delete session:', error);
      }
    },
    [currentSessionId, onNewConversation]
  );

  const handleRenameSession = useCallback(async () => {
    if (!renamingSession || !renameText.trim()) {
      setRenamingSession(null);
      return;
    }

    try {
      await copilotService.renameSession(renamingSession.id, renameText.trim());
      setSessions((prev) =>
        prev.map((session) =>
          session.id === renamingSession.id ? { ...session, title: renameText.trim() } : session
        )
      );
    } catch (error) {
      if (__DEV__) console.error('Failed to rename session:', error);
    } finally {
      setRenamingSession(null);
      setRenameText('');
    }
  }, [renameText, renamingSession]);

  const handleTogglePin = useCallback(async (session: SessionSummary) => {
    const newPinned = !session.isPinned;
    setSessions((prev) =>
      prev.map((entry) =>
        entry.id === session.id ? { ...entry, isPinned: newPinned } : entry
      )
    );

    try {
      await copilotService.togglePinSession(session.id, newPinned);
    } catch (error) {
      setSessions((prev) =>
        prev.map((entry) =>
          entry.id === session.id ? { ...entry, isPinned: !newPinned } : entry
        )
      );
      if (__DEV__) console.error('Failed to toggle pin:', error);
    }
  }, []);

  const handleStartRename = useCallback((session: SessionSummary) => {
    setRenameText(session.title || '');
    setRenamingSession(session);
  }, []);

  return {
    handleDeleteSession,
    handleOpenHistory,
    handleRenameSession,
    handleSelectSession,
    handleStartRename,
    handleTogglePin,
    historyFilter,
    renameText,
    renamingSession,
    sessions,
    setHistoryFilter,
    setRenameText,
    setRenamingSession,
    setShowHistory,
    showHistory,
  };
}
