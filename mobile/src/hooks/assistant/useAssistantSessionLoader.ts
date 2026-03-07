import { useCallback } from 'react';
import { CopilotMessage, MessageSegment, copilotService } from '../../services/copilotService';

type Mode = 'explore' | 'study';

interface AttachmentInfo {
  name: string;
  type: string;
  size?: number;
  uri?: string;
}

export interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  segments: MessageSegment[];
  attachments?: AttachmentInfo[];
  senderName?: string;
  isStreaming?: boolean;
  error?: string;
  lastUserMessage?: string;
  voiceNoteUrl?: string;
}

interface UseAssistantSessionLoaderParams {
  isOrganizationSpace: boolean;
  onError: (message: string) => void;
  onMessagesLoaded: (messages: StreamingMessage[]) => void;
  onModeLoaded: (mode: Mode) => void;
  organizationId?: string;
  scrollToBottom: (animated?: boolean) => void;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  t: (key: string) => string;
}

export function useAssistantSessionLoader({
  isOrganizationSpace,
  onError,
  onMessagesLoaded,
  onModeLoaded,
  organizationId,
  scrollToBottom,
  setIsLoading,
  setSessionId,
  t,
}: UseAssistantSessionLoaderParams) {
  const mapSessionMessages = useCallback((sessionMessages: CopilotMessage[]): StreamingMessage[] => {
    return (sessionMessages || [])
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => {
        let segments: MessageSegment[] = [];

        if (message.role === 'assistant') {
          if (message.outputData && Array.isArray(message.outputData) && message.outputData.length > 0) {
            segments = message.outputData.map((segment) => {
              if (segment.type === 'tool' && segment.tool?.status === 'running') {
                return { ...segment, tool: { ...segment.tool, status: 'success' as const } };
              }
              return segment;
            });
          } else {
            if (message.toolCalls && Array.isArray(message.toolCalls)) {
              for (const toolCall of message.toolCalls) {
                segments.push({
                  type: 'tool',
                  tool: {
                    callId: toolCall.id || `${toolCall.name}-legacy`,
                    name: toolCall.name,
                    duration: (toolCall as any).duration,
                    status: 'success',
                    summary: undefined,
                  },
                });
              }
            }
            if (message.content) {
              segments.push({ type: 'text', content: message.content });
            }
          }
        }

        const rawAttachments = message.attachments as any;
        const isObjectPayload = rawAttachments && !Array.isArray(rawAttachments);
        const voiceNoteUrl = isObjectPayload ? rawAttachments.voiceNoteUrl : undefined;
        const fileAttachments =
          isObjectPayload && Array.isArray(rawAttachments.files)
            ? rawAttachments.files
            : Array.isArray(rawAttachments)
              ? rawAttachments
              : [];

        return {
          id: message.id,
          role: message.role as 'user' | 'assistant',
          content: message.content,
          segments,
          senderName: message.senderName,
          voiceNoteUrl,
          attachments:
            fileAttachments.length > 0
              ? fileAttachments.map((attachment: any) => ({
                  name: attachment.name,
                  type: attachment.type,
                  size: attachment.size,
                }))
              : undefined,
        };
      });
  }, []);

  const loadSession = useCallback(
    async (id: string) => {
      setIsLoading(true);
      onError('');

      try {
        const response = await copilotService.getSession(
          id,
          isOrganizationSpace ? organizationId : undefined
        );
        if (response.error || !response.data) {
          throw new Error(response.error || t('screens.assistant.sessionNotFound'));
        }

        const { session, messages } = response.data;
        const sessionMode =
          session.mode === 'explore' || session.mode === 'study'
            ? (session.mode as Mode)
            : 'explore';
        const converted = mapSessionMessages(messages);

        setSessionId(session.id);
        onModeLoaded(isOrganizationSpace && sessionMode === 'study' ? 'explore' : sessionMode);
        onMessagesLoaded(converted);

        if (converted.length > 0) {
          scrollToBottom(false);
        }
      } catch (error) {
        onError(error instanceof Error ? error.message : t('screens.assistant.unknownError'));
      } finally {
        setIsLoading(false);
      }
    },
    [isOrganizationSpace, mapSessionMessages, onError, onMessagesLoaded, onModeLoaded, organizationId, scrollToBottom, setIsLoading, setSessionId, t]
  );

  return {
    loadSession,
  };
}
