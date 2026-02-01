/**
 * CopilotContext - Centralized copilot state management
 * Handles copilot sessions, messages, and mode switching
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  copilotService,
  CopilotMode,
  COPILOT_MODES,
  CopilotMessage,
  CopilotSession,
  SessionSummary,
  ChatResponse,
  CopilotOutputData,
  OutputType,
} from '../services/copilotService';
import { logger } from '../services/logService';

const LOG_SOURCE = 'Copilot';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface CopilotState {
  mode: CopilotMode;
  sessionId: string | null;
  messages: CopilotMessage[];
  sessions: SessionSummary[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
}

interface CopilotContextType extends CopilotState {
  // Actions
  setMode: (mode: CopilotMode) => void;
  sendMessage: (message: string) => Promise<CopilotMessage | null>;
  loadSession: (sessionId: string) => Promise<void>;
  startNewSession: () => void;
  loadSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearError: () => void;
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════

const CopilotContext = createContext<CopilotContextType | null>(null);

// ═══════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════

interface CopilotProviderProps {
  children: ReactNode;
}

export function CopilotProvider({ children }: CopilotProviderProps) {
  const [state, setState] = useState<CopilotState>({
    mode: COPILOT_MODES.EXPLORE,
    sessionId: null,
    messages: [],
    sessions: [],
    isLoading: false,
    isSending: false,
    error: null,
  });

  // ─────────────────────────────────────────────────────────────
  // SET MODE
  // ─────────────────────────────────────────────────────────────
  const setMode = useCallback((mode: CopilotMode) => {
    setState((prev) => {
      // If mode changes, start a new session
      if (prev.mode !== mode) {
        return {
          ...prev,
          mode,
          sessionId: null,
          messages: [],
        };
      }
      return { ...prev, mode };
    });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (message: string): Promise<CopilotMessage | null> => {
      setState((prev) => ({ ...prev, isSending: true, error: null }));

      try {
        // Add optimistic user message
        const userMessage: CopilotMessage = {
          id: `temp-${Date.now()}`,
          sessionId: state.sessionId || '',
          role: 'user',
          content: message,
          createdAt: new Date().toISOString(),
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, userMessage],
        }));

        // Send to API
        const response = await copilotService.sendMessage(message, state.mode, state.sessionId || undefined);

        if (response.error || !response.data?.data) {
          throw new Error(response.error || 'Erreur lors de l\'envoi du message');
        }

        const chatResponse = response.data.data as ChatResponse;
        const assistantMessage = chatResponse.message;

        // Update state with real messages
        setState((prev) => {
          // Replace temp user message and add assistant response
          const messagesWithoutTemp = prev.messages.filter((m) => !m.id.startsWith('temp-'));

          // Add real user message (from session)
          const realUserMessage: CopilotMessage = {
            ...userMessage,
            id: `user-${Date.now()}`,
            sessionId: chatResponse.sessionId,
          };

          return {
            ...prev,
            sessionId: chatResponse.sessionId,
            messages: [...messagesWithoutTemp, realUserMessage, assistantMessage],
            isSending: false,
          };
        });

        logger.debug(LOG_SOURCE, 'Message sent successfully', {
          sessionId: chatResponse.sessionId,
          outputType: assistantMessage.outputType,
        });

        return assistantMessage;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        logger.error(LOG_SOURCE, 'Failed to send message', error);

        setState((prev) => ({
          ...prev,
          isSending: false,
          error: errorMessage,
          // Remove optimistic message on error
          messages: prev.messages.filter((m) => !m.id.startsWith('temp-')),
        }));

        return null;
      }
    },
    [state.mode, state.sessionId]
  );

  // ─────────────────────────────────────────────────────────────
  // LOAD SESSION
  // ─────────────────────────────────────────────────────────────
  const loadSession = useCallback(async (sessionId: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await copilotService.getSession(sessionId);

      if (response.error || !response.data) {
        throw new Error(response.error || 'Session non trouvée');
      }

      const { session, messages } = response.data;

      setState((prev) => ({
        ...prev,
        sessionId: session.id,
        mode: session.mode,
        messages: messages || [],
        isLoading: false,
      }));

      logger.debug(LOG_SOURCE, 'Session loaded', { sessionId, messageCount: messages?.length });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      logger.error(LOG_SOURCE, 'Failed to load session', error);

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // START NEW SESSION
  // ─────────────────────────────────────────────────────────────
  const startNewSession = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sessionId: null,
      messages: [],
      error: null,
    }));
  }, []);

  // ─────────────────────────────────────────────────────────────
  // LOAD SESSIONS LIST
  // ─────────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await copilotService.listSessions(20);

      if (response.error || !response.data) {
        throw new Error(response.error || 'Erreur lors du chargement des sessions');
      }

      setState((prev) => ({
        ...prev,
        sessions: response.data!.sessions || [],
        isLoading: false,
      }));
    } catch (error) {
      logger.error(LOG_SOURCE, 'Failed to load sessions', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // DELETE SESSION
  // ─────────────────────────────────────────────────────────────
  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await copilotService.deleteSession(sessionId);

        setState((prev) => ({
          ...prev,
          sessions: prev.sessions.filter((s) => s.id !== sessionId),
          // If current session was deleted, clear it
          ...(prev.sessionId === sessionId
            ? { sessionId: null, messages: [] }
            : {}),
        }));

        logger.debug(LOG_SOURCE, 'Session deleted', { sessionId });
      } catch (error) {
        logger.error(LOG_SOURCE, 'Failed to delete session', error);
      }
    },
    []
  );

  // ─────────────────────────────────────────────────────────────
  // CLEAR ERROR
  // ─────────────────────────────────────────────────────────────
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // ─────────────────────────────────────────────────────────────
  // CONTEXT VALUE
  // ─────────────────────────────────────────────────────────────
  const contextValue: CopilotContextType = {
    ...state,
    setMode,
    sendMessage,
    loadSession,
    startNewSession,
    loadSessions,
    deleteSession,
    clearError,
  };

  return (
    <CopilotContext.Provider value={contextValue}>
      {children}
    </CopilotContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function useCopilot(): CopilotContextType {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error('useCopilot must be used within a CopilotProvider');
  }
  return context;
}

// Re-export types for convenience
export { COPILOT_MODES, type CopilotMode, type CopilotMessage, type CopilotOutputData, type OutputType };
