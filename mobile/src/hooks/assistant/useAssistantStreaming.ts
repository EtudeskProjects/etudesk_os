import { useCallback, useEffect, useRef } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { MessageSegment, copilotService } from '../../services/copilotService';
import type { StreamingMessage } from './useAssistantSessionLoader';

type Mode = 'explore' | 'study';

interface UseAssistantStreamingParams {
  activeMode: Mode;
  attachments: any[];
  alerts: any;
  audioRecorder: any;
  error: string | null;
  firstName: string;
  floatingSuggestions: string[];
  hideFloatingSuggestions: boolean;
  inputRef: React.RefObject<any>;
  inputText: string;
  isOrganizationSpace: boolean;
  isSending: boolean;
  isTranscribing: boolean;
  locale?: string;
  messages: StreamingMessage[];
  pendingVoiceNote: { uri: string; duration: number } | null;
  scrollToBottom: (animated?: boolean) => void;
  selectedOrgId?: string;
  setAttachments: React.Dispatch<React.SetStateAction<any[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setFloatingSuggestions: React.Dispatch<React.SetStateAction<string[]>>;
  setHideFloatingSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  setIsSending: React.Dispatch<React.SetStateAction<boolean>>;
  setIsTranscribing: React.Dispatch<React.SetStateAction<boolean>>;
  setMessages: React.Dispatch<React.SetStateAction<StreamingMessage[]>>;
  setPendingVoiceNote: React.Dispatch<React.SetStateAction<{ uri: string; duration: number } | null>>;
  setSessionId: (sessionId: string | null) => void;
  t: (key: string, params?: Record<string, any>) => string;
  voicePreviewPlayer: any;
}

export function useAssistantStreaming({
  activeMode,
  attachments,
  alerts,
  audioRecorder,
  error,
  firstName,
  floatingSuggestions,
  hideFloatingSuggestions,
  inputRef,
  inputText,
  isOrganizationSpace,
  isSending,
  isTranscribing,
  locale,
  messages,
  pendingVoiceNote,
  scrollToBottom,
  selectedOrgId,
  setAttachments,
  setError,
  setFloatingSuggestions,
  setHideFloatingSuggestions,
  setInputText,
  setIsSending,
  setIsTranscribing,
  setMessages,
  setPendingVoiceNote,
  setSessionId,
  t,
  voicePreviewPlayer,
}: UseAssistantStreamingParams) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const replaceLastExchangeRef = useRef(false);

  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const MAX_ATTACHMENTS = 3;

  const getFallbackSuggestions = useCallback((currentMode: Mode, orgSpace: boolean): string[] => {
    if (orgSpace) {
      return [
        t('screens.assistant.orgSuggestion1'),
        t('screens.assistant.orgSuggestion2'),
        t('screens.assistant.orgSuggestion3'),
      ];
    }
    if (currentMode === 'study') {
      return [
        t('screens.assistant.studySuggestion1'),
        t('screens.assistant.studySuggestion2'),
        t('screens.assistant.studySuggestion3'),
      ];
    }
    return [
      t('screens.assistant.exploreSuggestion1'),
      t('screens.assistant.exploreSuggestion2'),
      t('screens.assistant.exploreSuggestion3'),
    ];
  }, [t]);

  const loadFloatingSuggestions = useCallback((forceShow = false) => {
    setFloatingSuggestions(getFallbackSuggestions(activeMode, isOrganizationSpace));
    if (forceShow) setHideFloatingSuggestions(false);
  }, [activeMode, getFallbackSuggestions, isOrganizationSpace, setFloatingSuggestions, setHideFloatingSuggestions]);

  useEffect(() => {
    loadFloatingSuggestions(true);
  }, [loadFloatingSuggestions]);

  const handlePickFile = useCallback(async () => {
    try {
      const remaining = MAX_ATTACHMENTS - attachments.length;
      if (remaining <= 0) {
        void alerts.alert(
          t('screens.assistant.limitReached'),
          t('screens.assistant.maxAttachments', { max: MAX_ATTACHMENTS })
        );
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selected = result.assets.slice(0, remaining);
        const validFiles: { name: string; uri: string; type: string; size?: number }[] = [];

        for (const file of selected) {
          if (file.size && file.size > MAX_FILE_SIZE) {
            void alerts.alert(
              t('screens.assistant.fileTooLarge'),
              t('screens.assistant.fileTooLargeMessage', { name: file.name })
            );
            continue;
          }
          validFiles.push({
            name: file.name,
            uri: file.uri,
            type: file.mimeType || 'application/octet-stream',
            size: file.size,
          });
        }

        if (validFiles.length > 0) {
          setAttachments((prev) => [...prev, ...validFiles]);
        }
      }
    } catch (pickError) {
      if (__DEV__) console.error('Error picking file:', pickError);
      void alerts.alert(t('common.error'), t('screens.assistant.fileSelectError'));
    }
  }, [MAX_FILE_SIZE, alerts, attachments.length, setAttachments, t]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }, [setAttachments]);

  const startStream = useCallback(async (
    userContent: string,
    attachmentFiles: any[] = [],
    voiceNoteUrl?: string,
    voiceNoteMimeType?: string,
    sessionId?: string | null
  ) => {
    setIsSending(true);
    setError(null);
    setHideFloatingSuggestions(true);

    const shouldReplace = replaceLastExchangeRef.current;
    replaceLastExchangeRef.current = false;

    const effectiveMode: Mode = isOrganizationSpace ? 'explore' : activeMode;
    const organizationId = isOrganizationSpace ? selectedOrgId : undefined;

    const userMsg: StreamingMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userContent,
      segments: [],
      senderName: isOrganizationSpace ? (firstName || undefined) : undefined,
      attachments:
        attachmentFiles.length > 0
          ? attachmentFiles.map((attachment: any) => ({
              name: attachment.name,
              type: attachment.type,
              size: attachment.size,
              uri: attachment.uri,
            }))
          : undefined,
      voiceNoteUrl,
    };

    const assistantMsgId = `assistant-${Date.now() + 1}`;
    const assistantMsg: StreamingMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      segments: [],
      isStreaming: true,
      lastUserMessage: userContent,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    scrollToBottom();

    try {
      let attachmentIds: string[] = [];

      if (attachmentFiles.length > 0) {
        const uploadRes = await copilotService.uploadAttachments(
          attachmentFiles.map((attachment) => ({
            uri: attachment.uri,
            type: attachment.type,
            name: attachment.name,
          }))
        );

        if (!uploadRes.success || !uploadRes.data?.documents) {
          throw new Error(uploadRes.error || t('screens.assistant.uploadError'));
        }

        attachmentIds = uploadRes.data.documents.map((document: any) => document.id);
      }

      abortControllerRef.current = copilotService.sendMessageStream(
        userContent,
        effectiveMode,
        sessionId || undefined,
        {
          onTextDelta: (delta) => {
            setMessages((prev) =>
              prev.map((message) => {
                if (message.id !== assistantMsgId) return message;
                const nextSegments = [...message.segments];
                const lastSegment = nextSegments[nextSegments.length - 1];
                if (lastSegment && lastSegment.type === 'text') {
                  nextSegments[nextSegments.length - 1] = {
                    ...lastSegment,
                    content: (lastSegment.content || '') + delta,
                  };
                } else {
                  nextSegments.push({ type: 'text', content: delta });
                }
                return {
                  ...message,
                  content: message.content + delta,
                  segments: nextSegments,
                };
              })
            );
          },
          onToolStart: (tool) => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMsgId
                  ? {
                      ...message,
                      segments: [
                        ...message.segments,
                        {
                          type: 'tool' as const,
                          tool: {
                            callId: tool.callId,
                            name: tool.name,
                            args: tool.args,
                            status: 'running' as const,
                          },
                        },
                      ],
                    }
                  : message
              )
            );
          },
          onToolEnd: (tool) => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMsgId
                  ? {
                      ...message,
                      segments: message.segments.map((segment) =>
                        segment.type === 'tool' && segment.tool?.callId === tool.callId
                          ? {
                              ...segment,
                              tool: {
                                ...segment.tool!,
                                summary: tool.summary,
                                result: tool.result,
                                duration: tool.duration,
                                status: tool.status,
                                error: tool.error,
                              },
                            }
                          : segment
                      ),
                    }
                  : message
              )
            );
          },
          onDone: (newSessionId) => {
            setSessionId(newSessionId);
            setIsSending(false);
            loadFloatingSuggestions(false);
            setMessages((prev) =>
              prev.map((message) => {
                if (message.id !== assistantMsgId) return message;
                return {
                  ...message,
                  isStreaming: false,
                  segments: message.segments.map((segment) =>
                    segment.type === 'tool' && segment.tool?.status === 'running'
                      ? { ...segment, tool: { ...segment.tool, status: 'success' as const } }
                      : segment
                  ),
                };
              })
            );
            abortControllerRef.current = null;
          },
          onError: (errorMessage) => {
            setIsSending(false);
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMsgId
                  ? { ...message, isStreaming: false, error: errorMessage }
                  : message
              )
            );
            abortControllerRef.current = null;
          },
          onContentCorrected: (correctedContent) => {
            setMessages((prev) =>
              prev.map((message) => {
                if (message.id !== assistantMsgId) return message;
                const textIndexes: number[] = [];
                const textContents: string[] = [];
                message.segments.forEach((segment, index) => {
                  if (segment.type === 'text') {
                    textIndexes.push(index);
                    textContents.push(segment.content || '');
                  }
                });

                if (textIndexes.length === 0) {
                  return { ...message, content: correctedContent };
                }

                if (textIndexes.length === 1) {
                  const segmentIndex = textIndexes[0];
                  const nextSegments = [...message.segments];
                  nextSegments[segmentIndex] = {
                    ...nextSegments[segmentIndex],
                    type: 'text',
                    content: correctedContent,
                  };
                  return {
                    ...message,
                    content: correctedContent,
                    segments: nextSegments,
                  };
                }

                const boundaries: number[] = [];
                let cursor = 0;
                for (let index = 0; index < textContents.length - 1; index += 1) {
                  cursor += textContents[index].length;
                  boundaries.push(cursor);
                }

                const nextSegments = [...message.segments];
                let chunkCursor = 0;
                for (let index = 0; index < textIndexes.length; index += 1) {
                  const segmentIndex = textIndexes[index];
                  const end =
                    index < boundaries.length
                      ? Math.min(correctedContent.length, boundaries[index])
                      : correctedContent.length;
                  nextSegments[segmentIndex] = {
                    ...nextSegments[segmentIndex],
                    type: 'text',
                    content: correctedContent.slice(chunkCursor, end),
                  };
                  chunkCursor = end;
                }

                return {
                  ...message,
                  content: correctedContent,
                  segments: nextSegments,
                };
              })
            );
          },
          onAudioReady: (audioUrl, duration) => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMsgId
                  ? {
                      ...message,
                      segments: [
                        ...message.segments,
                        {
                          type: 'audio' as const,
                          audioUrl,
                          audioDuration: duration,
                          autoPlay: true,
                        } as MessageSegment,
                      ],
                    }
                  : message
              )
            );
          },
          onLimitReached: (_reason, message) => {
            setMessages((prev) =>
              prev.map((entry) =>
                entry.id === assistantMsgId
                  ? {
                      ...entry,
                      segments: [
                        ...entry.segments,
                        { type: 'text' as const, content: `\n\n> ${message}` },
                      ],
                      content: entry.content + `\n\n> ${message}`,
                    }
                  : entry
              )
            );
          },
        },
        organizationId,
        attachmentIds.length > 0 ? attachmentIds : undefined,
        shouldReplace || undefined,
        voiceNoteUrl,
        voiceNoteMimeType
      );
    } catch (streamError: any) {
      setIsSending(false);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantMsgId
            ? {
                ...message,
                isStreaming: false,
                error: streamError.message || t('screens.assistant.sendError'),
              }
            : message
        )
      );
    }
  }, [activeMode, firstName, isOrganizationSpace, loadFloatingSuggestions, scrollToBottom, selectedOrgId, setError, setHideFloatingSuggestions, setIsSending, setMessages, setSessionId, t]);

  const handleMicPress = useCallback(async () => {
    if (audioRecorder.state.isRecording) {
      const duration = audioRecorder.state.duration;
      const audioUri = await audioRecorder.stopRecording();
      if (audioUri) {
        setPendingVoiceNote({ uri: audioUri, duration });
      }
      return;
    }
    await audioRecorder.startRecording();
  }, [audioRecorder, setPendingVoiceNote]);

  const clearPendingVoiceNote = useCallback(() => {
    voicePreviewPlayer.stop();
    setPendingVoiceNote(null);
  }, [setPendingVoiceNote, voicePreviewPlayer]);

  useEffect(() => {
    if (audioRecorder.remainingTime === 0 && audioRecorder.state.isRecording) {
      void handleMicPress();
    }
  }, [audioRecorder.remainingTime, audioRecorder.state.isRecording, handleMicPress]);

  const handleSend = useCallback(async (sessionId?: string | null) => {
    const hasText = inputText.trim().length > 0;
    const hasAttachments = attachments.length > 0;
    const hasVoiceNote = !!pendingVoiceNote;
    if ((!hasText && !hasAttachments && !hasVoiceNote) || isSending) return;

    const text = inputText.trim().replace(/\n{2,}/g, '\n').replace(/^\n+|\n+$/g, '');
    const currentAttachments = [...attachments];
    const voiceNote = pendingVoiceNote;

    setInputText('');
    setAttachments([]);
    voicePreviewPlayer.stop();
    setPendingVoiceNote(null);

    if (voiceNote) {
      setIsTranscribing(true);
      try {
        const uploadResult = await copilotService.sendVoiceNote(voiceNote.uri, 'audio/m4a');
        if (uploadResult.success && uploadResult.data?.voiceNoteUrl) {
          const messageText = text || `🎤 ${t('screens.assistant.voiceNote')}`;
          await startStream(
            messageText,
            currentAttachments,
            uploadResult.data.voiceNoteUrl,
            uploadResult.data.mimeType,
            sessionId
          );
        } else {
          void alerts.alert(
            t('common.error'),
            uploadResult.error || t('screens.assistant.voiceNoteError')
          );
        }
      } catch (sendError: any) {
        void alerts.alert(
          t('common.error'),
          sendError.message || t('screens.assistant.sendErrorShort')
        );
      } finally {
        setIsTranscribing(false);
      }
      return;
    }

    await startStream(text, currentAttachments, undefined, undefined, sessionId);
  }, [alerts, attachments, inputText, isSending, pendingVoiceNote, setAttachments, setInputText, setIsTranscribing, setPendingVoiceNote, startStream, t, voicePreviewPlayer]);

  const handleQuizAnswer = useCallback((answer: string, sessionId?: string | null) => {
    if (isSending) return;
    void startStream(answer, [], undefined, undefined, sessionId);
  }, [isSending, startStream]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsSending(false);
    setMessages((prev) =>
      prev.map((message) =>
        message.isStreaming
          ? {
              ...message,
              isStreaming: false,
              segments: message.segments.map((segment) =>
                segment.type === 'tool' && segment.tool?.status === 'running'
                  ? { ...segment, tool: { ...segment.tool, status: 'success' as const } }
                  : segment
              ),
            }
          : message
      )
    );
  }, [setIsSending, setMessages]);

  const handleRetry = useCallback((messageId: string, sessionId?: string | null) => {
    const message = messages.find((entry) => entry.id === messageId);
    if (!message?.lastUserMessage) return;
    const retryText = message.lastUserMessage;
    setMessages((prev) => prev.filter((entry) => entry.id !== messageId));
    void startStream(retryText, [], undefined, undefined, sessionId);
  }, [messages, setMessages, startStream]);

  const handleUserMessageLongPress = useCallback((messageId: string, content: string) => {
    if (isSending) return;

    const userMessages = messages.filter((message) => message.role === 'user');
    const isLastUserMessage =
      userMessages.length > 0 && userMessages[userMessages.length - 1].id === messageId;

    const baseButtons: any[] = [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('screens.assistant.copy'), onPress: () => Clipboard.setStringAsync(content) },
    ];

    if (isLastUserMessage) {
      baseButtons.push({
        text: t('screens.assistant.editResend'),
        onPress: () => {
          const messageIndex = messages.findIndex((message) => message.id === messageId);
          if (messageIndex === -1) return;
          setMessages((prev) => prev.slice(0, messageIndex));
          setInputText(content);
          replaceLastExchangeRef.current = true;
          setTimeout(() => inputRef.current?.focus(), 100);
        },
      });
    }

    void alerts.showAlert({
      title: t('screens.assistant.message'),
      message: undefined,
      buttons: baseButtons,
    });
  }, [alerts, inputRef, isSending, messages, setInputText, setMessages, t]);

  const buildFollowUps = useCallback((assistantText: string): string[] => {
    const text = (assistantText || '').toLowerCase();
    if (text.includes('```confirmation')) {
      return [
        t('screens.assistant.followUp.adjustDraft'),
        t('screens.assistant.followUp.makeConcise'),
        t('screens.assistant.followUp.validateNext'),
      ];
    }
    if (text.includes('```entity:document')) {
      return [
        t('screens.assistant.followUp.execSummary'),
        t('screens.assistant.followUp.actionPlan'),
        t('screens.assistant.followUp.addRisks'),
      ];
    }
    if (isOrganizationSpace) {
      return [
        t('screens.assistant.followUp.orgPrioritize'),
        t('screens.assistant.followUp.orgNextStep'),
        t('screens.assistant.followUp.orgRefine'),
      ];
    }
    if (activeMode === 'study') {
      return [
        t('screens.assistant.followUp.studyQuiz'),
        t('screens.assistant.followUp.studyExercise'),
        t('screens.assistant.followUp.studySimplify'),
      ];
    }
    return [
      t('screens.assistant.followUp.nextStep'),
      t('screens.assistant.followUp.threeOptions'),
      t('screens.assistant.followUp.prepareMessage'),
    ];
  }, [activeMode, isOrganizationSpace, t]);

  const hasClearNextStep = useCallback((assistantText: string): boolean => {
    const raw = (assistantText || '').trim();
    if (!raw) return false;
    if (raw.includes('```confirmation')) return true;

    const text = raw
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (!text) return false;

    const tail = text.slice(Math.max(0, text.length - 320));
    const ctaPatterns = [
      /souhaitez-vous/, /veux-tu/, /veut-tu/, /voulez-vous/, /on commence/,
      /prochaine étape/, /confirmez/, /cliquez/, /choisissez/, /dites-moi si/,
      /je peux (te|vous) aider/, /would you like/, /do you want/, /shall we/,
      /next step/, /confirm/, /click/, /choose/, /let me know if/, /i can help/,
    ];
    if (ctaPatterns.some((pattern) => pattern.test(tail))) return true;
    if (/[?]\s*$/.test(tail) || /[?]\s*["\u201C\u201D]?\s*$/.test(tail)) return true;

    return (
      /(prochaines? étapes?|plan d'action|plan d'\s*action|next steps?|action plan|roadmap)/.test(text) &&
      /(?:^|\s)1[\).\-\s]/.test(text) &&
      /(?:^|\s)2[\).\-\s]/.test(text)
    );
  }, []);

  const shouldShowFloatingSuggestions =
    floatingSuggestions.length > 0 &&
    !hideFloatingSuggestions &&
    !isSending &&
    !audioRecorder.state.isRecording &&
    !isTranscribing &&
    !messages.some((message) => message.role === 'assistant') &&
    inputText.trim().length === 0;

  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const formatTimestamp = useCallback((messageId: string): string => {
    const match = messageId.match(/(\d{13})/);
    if (!match) return '';
    const timestamp = parseInt(match[1], 10);
    const diff = Date.now() - timestamp;
    if (diff < 60_000) return t('screens.gestion.justNow');
    if (diff < 3_600_000) return t('common.time.minutes', { count: Math.floor(diff / 60_000) });
    if (diff < 86_400_000) return t('common.time.hours', { count: Math.floor(diff / 3_600_000) });
    return new Date(timestamp).toLocaleDateString(locale || undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [locale, t]);

  const formatAssistantError = useCallback((value: string): string => {
    const message = (value || '').toString().trim();
    const lower = message.toLowerCase();

    const isInternal =
      lower.includes('invalid schema') ||
      (lower.includes('schema') && lower.includes('function')) ||
      lower.includes('zod') ||
      lower.includes('openai') ||
      lower.includes('bad request') ||
      lower.startsWith('400 ');

    if (isInternal) return t('screens.assistant.tempIssue');
    if (message.length > 180) return `${message.slice(0, 177)}...`;
    return message;
  }, [t]);

  const resetForNewConversation = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSessionId(null);
    setMessages([]);
    setError(null);
    setIsSending(false);
    voicePreviewPlayer.stop();
    setPendingVoiceNote(null);
  }, [setError, setIsSending, setMessages, setPendingVoiceNote, setSessionId, voicePreviewPlayer]);

  const focusWithSuggestion = useCallback((value: string) => {
    setInputText(value);
    setHideFloatingSuggestions(true);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [inputRef, setHideFloatingSuggestions, setInputText]);

  // Append text to the input WITHOUT submitting (e.g. tapping a skill card).
  const appendSuggestion = useCallback((value: string) => {
    const piece = (value || '').trim();
    if (!piece) return;
    setInputText((prev) => (prev && !prev.endsWith(' ') ? `${prev} ${piece}` : `${prev}${piece}`));
    setHideFloatingSuggestions(true);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [inputRef, setHideFloatingSuggestions, setInputText]);

  return {
    abortControllerRef,
    appendSuggestion,
    buildFollowUps,
    clearPendingVoiceNote,
    focusWithSuggestion,
    formatAssistantError,
    formatDuration,
    formatTimestamp,
    handleMicPress,
    handlePickFile,
    handleQuizAnswer,
    handleRetry,
    handleSend,
    handleStop,
    handleUserMessageLongPress,
    hasClearNextStep,
    removeAttachment,
    resetForNewConversation,
    shouldShowFloatingSuggestions,
    startStream,
  };
}
