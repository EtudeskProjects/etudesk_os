/**
 * Copilot Service
 * Handles all copilot-related API calls
 */

import { api, ApiResponse } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';
import i18n from '../i18n';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export const COPILOT_MODES = {
  EXPLORE: 'explore',
  STUDY: 'study',
} as const;

export type CopilotMode = (typeof COPILOT_MODES)[keyof typeof COPILOT_MODES];



// ═══════════════════════════════════════════════════════════════
// SEGMENT TYPES (mirrors backend MessageSegment)
// ═══════════════════════════════════════════════════════════════

export interface ToolSegmentData {
  callId: string;
  name: string;
  args?: Record<string, unknown>;
  result?: unknown;
  summary?: string;
  duration?: number;
  status: 'running' | 'success' | 'error';
  error?: string;
}

export interface MessageSegment {
  type: 'text' | 'tool';
  content?: string;
  tool?: ToolSegmentData;
}

// Message types
export interface CopilotMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  toolResults?: Array<{ toolCallId: string; result: unknown }>;
  outputData?: MessageSegment[];
  attachments?: any[];
  createdAt: string;
}

// Session types
export interface SessionContext {
  focusEntities?: Array<{
    type: string;
    id: string;
    name?: string;
  }>;
  preferences?: {
    sectors?: string[];
    locations?: string[];
    skills?: string[];
    remotePreference?: boolean;
  };
}

export interface CopilotSession {
  id: string;
  talentId: string;
  mode: CopilotMode;
  title?: string;
  context: SessionContext;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  title?: string;
  mode: CopilotMode;
  lastMessageAt?: string;
  createdAt: string;
  messageCount: number;
}

// API Response types
export interface ChatResponse {
  sessionId: string;
  message: CopilotMessage;
  context?: SessionContext;
}

// ═══════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════

class CopilotService {
  async sendMessage(
    message: string,
    mode?: CopilotMode,
    sessionId?: string,
    attachmentIds?: string[]
  ): Promise<ApiResponse<{ data: ChatResponse }>> {
    return api.post('/api/copilot/chat', {
      message,
      mode,
      sessionId,
      attachmentIds,
    });
  }

  /**
   * List user's copilot sessions
   */
  async listSessions(limit: number = 20): Promise<ApiResponse<{ sessions: SessionSummary[] }>> {
    return api.get('/api/copilot/sessions', { limit });
  }

  /**
   * Create a new session
   */
  async createSession(mode: CopilotMode): Promise<ApiResponse<CopilotSession>> {
    return api.post('/api/copilot/sessions', { mode });
  }

  /**
   * Get session details with messages
   */
  async getSession(
    sessionId: string
  ): Promise<ApiResponse<{ session: CopilotSession; messages: CopilotMessage[] }>> {
    return api.get(`/api/copilot/sessions/${sessionId}`);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<ApiResponse<{ message: string }>> {
    return api.delete(`/api/copilot/sessions/${sessionId}`);
  }

  /**
   * Get session messages
   */
  async getSessionMessages(
    sessionId: string,
    limit: number = 50
  ): Promise<ApiResponse<{ messages: CopilotMessage[] }>> {
    return api.get(`/api/copilot/sessions/${sessionId}/messages`, { limit });
  }


  // ═══════════════════════════════════════════════════════════════
  // SSE STREAMING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Send a message with SSE streaming
   * Returns an AbortController to cancel the stream
   */
  sendMessageStream(
    message: string,
    mode: CopilotMode,
    sessionId: string | undefined,
    callbacks: {
      onTextDelta: (delta: string) => void;
      onToolStart: (tool: { callId: string; name: string; args?: Record<string, unknown> }) => void;
      onToolEnd: (tool: { callId: string; name: string; summary?: string; result?: unknown; duration?: number; status: 'success' | 'error'; error?: string }) => void;
      onDone: (sessionId: string) => void;
      onError: (error: string) => void;
      onLimitReached?: (reason: string, message: string) => void;
    },
    organizationId?: string,
    attachmentIds?: string[]
  ): AbortController {
    const controller = new AbortController();

    (async () => {
      try {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        const url = `${API_CONFIG.BASE_URL}/api/copilot/chat`;

        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Content-Type', 'application/json');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Accept', 'text/event-stream');

        let seenBytes = 0;
        let lineBuffer = ''; // Buffer for incomplete lines across chunks

        xhr.onprogress = () => {
          if (!xhr.responseText) return;

          const newChunk = xhr.responseText.substring(seenBytes);
          seenBytes = xhr.responseText.length;

          // Prepend any buffered partial line from previous chunk
          const data = lineBuffer + newChunk;
          const lines = data.split('\n');

          // Last element may be incomplete (no trailing \n) — buffer it
          lineBuffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith('data: ')) continue;

            try {
              const event = JSON.parse(line.slice(6));

              switch (event.type) {
                case 'text_delta':
                  callbacks.onTextDelta(event.delta);
                  break;
                case 'tool_start':
                  callbacks.onToolStart({
                    callId: event.tool.callId,
                    name: event.tool.name,
                    args: event.tool.args,
                  });
                  break;
                case 'tool_end':
                  callbacks.onToolEnd({
                    callId: event.tool.callId,
                    name: event.tool.name,
                    summary: event.tool.summary,
                    result: event.tool.result,
                    duration: event.tool.duration,
                    status: event.tool.status || 'success',
                    error: event.tool.error,
                  });
                  break;
                case 'done':
                  callbacks.onDone(event.sessionId);
                  break;
                case 'error':
                  callbacks.onError(event.error);
                  break;
                case 'limit_reached':
                  callbacks.onLimitReached?.(event.reason, event.message);
                  break;
              }
            } catch {
              // Malformed JSON — skip this event
            }
          }
        };

        xhr.onerror = () => {
          callbacks.onError(i18n.t('copilotService.connectionError'));
        };

        xhr.onload = () => {
          if (xhr.status >= 400) {
            try {
              const errorData = JSON.parse(xhr.responseText);
              callbacks.onError(errorData.error || i18n.t('copilotService.httpError', { status: xhr.status }));
            } catch {
              callbacks.onError(i18n.t('copilotService.httpError', { status: xhr.status }));
            }
          }
        };

        // Wire abort signal
        controller.signal.addEventListener('abort', () => {
          xhr.abort();
        });

        xhr.send(JSON.stringify({ message, mode, sessionId, organizationId, attachmentIds }));

      } catch (error: any) {
        if (error.name !== 'AbortError') {
          callbacks.onError(error.message || i18n.t('copilotService.connectionError'));
        }
      }
    })();

    return controller;
  }

  /**
   * Get AI-powered intent suggestions
   * @param mode - Copilot mode (explore or study)
   * @param sessionId - Optional session ID for context-aware suggestions
   * @returns Suggestions with rate limit info
   */
  async getSuggestions(
    mode: CopilotMode,
    sessionId?: string
  ): Promise<{
    suggestions: string[];
    refreshesRemaining: number;
    nextRefreshAt?: string;
  }> {
    try {
      const params: Record<string, string> = { mode };
      if (sessionId) params.sessionId = sessionId;

      const response = await api.get('/api/copilot/suggestions', params);
      const data = response.data as any;

      return {
        suggestions: data?.suggestions || [],
        refreshesRemaining: data?.refreshesRemaining ?? 3,
        nextRefreshAt: data?.nextRefreshAt,
      };
    } catch {
      return {
        suggestions: [],
        refreshesRemaining: 3,
      };
    }
  }

  /**
   * Transcribe audio using Whisper API
   * @param audioUri - Local file URI of the audio recording
   * @param mimeType - MIME type of the audio file (e.g., 'audio/m4a', 'audio/webm')
   * @returns Transcribed text
   */
  async transcribeAudio(audioUri: string, mimeType: string = 'audio/m4a'): Promise<ApiResponse<{ text: string }>> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

      // Get file extension from MIME type
      const extensionMap: Record<string, string> = {
        'audio/m4a': 'm4a',
        'audio/x-m4a': 'm4a',
        'audio/mp4': 'm4a',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/webm': 'webm',
      };
      const extension = extensionMap[mimeType] || 'm4a';

      // Create FormData with the audio file
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: mimeType,
        name: `recording.${extension}`,
      } as any);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/copilot/transcribe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type - let fetch handle it for FormData
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || i18n.t('copilotService.transcriptionError'),
          data: { text: '' },
        };
      }

      return {
        success: true,
        data: { text: data.data?.text || '' },
      };
    } catch (error: any) {
      console.error('Transcription error:', error);
      return {
        success: false,
        error: error.message || i18n.t('copilotService.audioTranscriptionError'),
        data: { text: '' },
      };
    }
  }

  /**
   * Confirm a copilot action (apply, join, book, etc.)
   */
  async confirmAction(
    action: string,
    entityId: string,
    sessionId?: string,
    data?: Record<string, any>
  ): Promise<ApiResponse<{ message: string; [key: string]: any }>> {
    return api.post('/api/copilot/confirm', { action, entityId, sessionId, data });
  }

  /**
   * Upload attachments for copilot chat
   * @param files - Array of files to upload
   * @returns Array of document objects
   */
  async uploadAttachments(files: { uri: string; type: string; name: string }[]): Promise<ApiResponse<{ documents: any[] }>> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const formData = new FormData();

      files.forEach((file) => {
        formData.append('file', {
          uri: file.uri,
          type: file.type,
          name: file.name,
        } as any);
      });

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/copilot/attachments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || i18n.t('copilotService.uploadError'),
          data: { documents: [] },
        };
      }

      return {
        success: true,
        data: { documents: data.data?.documents || [] },
      };
    } catch (error: any) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error.message || i18n.t('copilotService.uploadError'),
        data: { documents: [] },
      };
    }
  }
}

export const copilotService = new CopilotService();
export default copilotService;
