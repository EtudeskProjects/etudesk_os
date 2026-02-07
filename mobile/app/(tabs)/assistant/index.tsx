import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  SendHorizontal,
  Paperclip,
  Mic,
  MicOff,
  Compass,
  BookOpen,
  Lightbulb,
  History,
  Plus,
  AlertCircle,
  X,
  Trash2,
  Square,
  RefreshCw,
  Pencil,
  Copy,
  Loader2,
} from 'lucide-react-native';
import { useAudioRecorder } from '../../../src/hooks/useAudioRecorder';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/contexts/I18nContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import { Header, FooterNav } from '../../../src/components/ui';
import {
  MarkdownRenderer,
  CopyButton,
  ThinkingIndicator,
  ToolBlock,
  PulsingOrb,
  SuggestionsTooltip,
} from '../../../src/components/copilot';
import {
  copilotService,
  CopilotMode,
  COPILOT_MODES,
  CopilotMessage,
  SessionSummary,
  MessageSegment,
} from '../../../src/services/copilotService';
import { formatRelativeTime } from '../../../src/utils/date';

type Mode = 'explore' | 'study';

const MODE_ICONS = {
  explore: Compass,
  study: BookOpen,
};

interface AttachmentInfo {
  name: string;
  type: string;
  size?: number;
}

interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  segments: MessageSegment[];
  attachments?: AttachmentInfo[];
  isStreaming?: boolean;
  error?: string;
  lastUserMessage?: string;
}

export default function AssistantScreen() {
  const { mode, prompt, focusInput, sessionId: initialSessionId } = useLocalSearchParams<{
    mode?: string;
    prompt?: string;
    focusInput?: string;
    sessionId?: string;
  }>();

  const [activeMode, setActiveMode] = useState<Mode>('explore');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  // Audio recording hook
  const audioRecorder = useAudioRecorder();

  const { colors } = useTheme();
  const modeColors = {
    explore: { bg: colors.surface, text: colors.textSecondary },
    study: { bg: withOpacity(colors.success, OPACITY[10]), text: colors.success },
  };
  const { t } = useI18n();
  const { isOrganizationSpace, selectedOrg } = useSpace();
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Build modes with translated labels
  const ALL_MODES = [
    { id: 'explore' as Mode, label: t('assistant.modes.explore'), icon: MODE_ICONS.explore },
    { id: 'study' as Mode, label: t('assistant.modes.study'), icon: MODE_ICONS.study },
  ];
  const MODES = isOrganizationSpace ? ALL_MODES.filter(m => m.id === 'explore') : ALL_MODES;

  // Set initial mode from URL parameter
  useEffect(() => {
    if (mode === 'explore' || mode === 'study') {
      setActiveMode(mode);
    }
  }, [mode]);

  // Reset to explore mode if organization space is activated
  useEffect(() => {
    if (isOrganizationSpace) {
      setActiveMode('explore');
    }
  }, [isOrganizationSpace]);

  // Handle prompt and focus from URL parameters
  useEffect(() => {
    if (prompt) {
      setInputText(prompt);
    }
    if (prompt || focusInput === 'true') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [prompt, focusInput]);

  // Load session if sessionId is provided
  useEffect(() => {
    if (initialSessionId) {
      loadSession(initialSessionId);
    }
  }, [initialSessionId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Load session
  const loadSession = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await copilotService.getSession(id);
      if (response.error || !response.data) {
        throw new Error(response.error || 'Session non trouvée');
      }

      const { session, messages: sessionMessages } = response.data;
      setSessionId(session.id);
      setActiveMode(session.mode as Mode);

      // Convert to StreamingMessage format with segments
      const converted: StreamingMessage[] = (sessionMessages || [])
        .filter((m: CopilotMessage) => m.role === 'user' || m.role === 'assistant')
        .map((m: CopilotMessage) => {
          let segments: MessageSegment[] = [];

          if (m.role === 'assistant') {
            if (m.outputData && Array.isArray(m.outputData) && m.outputData.length > 0) {
              // New format: use persisted segments, finalize any running tools as success
              segments = m.outputData.map((seg: MessageSegment) => {
                if (seg.type === 'tool' && seg.tool?.status === 'running') {
                  return { ...seg, tool: { ...seg.tool, status: 'success' as const } };
                }
                return seg;
              });
            } else {
              // Backward compat: reconstruct from tool_calls + content
              if (m.toolCalls && Array.isArray(m.toolCalls)) {
                for (const tc of m.toolCalls) {
                  segments.push({
                    type: 'tool',
                    tool: {
                      callId: tc.id || `${tc.name}-legacy`,
                      name: tc.name,
                      duration: (tc as any).duration,
                      status: 'success',
                      summary: undefined,
                    },
                  });
                }
              }
              if (m.content) {
                segments.push({ type: 'text', content: m.content });
              }
            }
          }

          return {
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            segments,
            attachments: m.attachments && Array.isArray(m.attachments) && m.attachments.length > 0
              ? m.attachments.map((a: any) => ({ name: a.name, type: a.type, size: a.size }))
              : undefined,
          };
        });
      setMessages(converted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  };

  // Load sessions list
  const loadSessions = async () => {
    try {
      const response = await copilotService.listSessions(20);
      if (response.data?.sessions) {
        setSessions(response.data.sessions);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  // Core streaming function — used by handleSend, handleQuizAnswer, and handleRetry
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        // Check file size
        if (file.size && file.size > MAX_FILE_SIZE) {
          Alert.alert('Fichier trop volumineux', 'La taille maximale est de 20 Mo.');
          return;
        }

        // Check max attachments
        if (attachments.length >= 3) {
          Alert.alert('Limite atteinte', 'Vous pouvez ajouter jusqu\'à 3 pièces jointes.');
          return;
        }

        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            uri: file.uri,
            type: file.mimeType || 'application/octet-stream',
            size: file.size,
          },
        ]);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner le fichier.');
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const startStream = useCallback(async (userContent: string, attachmentFiles: any[] = []) => {
    setIsSending(true);
    setError(null);

    const userMsg: StreamingMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userContent,
      segments: [],
      attachments: attachmentFiles.length > 0
        ? attachmentFiles.map((a: any) => ({ name: a.name, type: a.type, size: a.size }))
        : undefined,
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

    try {
      let attachmentIds: string[] = [];

      // 1. Upload attachments if present
      if (attachmentFiles.length > 0) {
        const uploadRes = await copilotService.uploadAttachments(
          attachmentFiles.map((a) => ({ uri: a.uri, type: a.type, name: a.name }))
        );

        if (!uploadRes.success || !uploadRes.data?.documents) {
          throw new Error(uploadRes.error || "Erreur lors de l'upload des pièces jointes");
        }

        attachmentIds = uploadRes.data.documents.map((doc: any) => doc.id);
      }

      abortControllerRef.current = copilotService.sendMessageStream(
        userContent,
        activeMode,
        sessionId || undefined,
        {
          onTextDelta: (delta) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                const newSegments = [...m.segments];
                const lastSeg = newSegments[newSegments.length - 1];
                if (lastSeg && lastSeg.type === 'text') {
                  newSegments[newSegments.length - 1] = {
                    ...lastSeg,
                    content: (lastSeg.content || '') + delta,
                  };
                } else {
                  newSegments.push({ type: 'text', content: delta });
                }
                return { ...m, content: m.content + delta, segments: newSegments };
              })
            );
          },
          onToolStart: (tool) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                    ...m,
                    segments: [
                      ...m.segments,
                      { type: 'tool' as const, tool: { callId: tool.callId, name: tool.name, args: tool.args, status: 'running' as const } },
                    ],
                  }
                  : m
              )
            );
          },
          onToolEnd: (tool) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                    ...m,
                    segments: m.segments.map((seg) =>
                      seg.type === 'tool' && seg.tool?.callId === tool.callId
                        ? { ...seg, tool: { ...seg.tool!, summary: tool.summary, result: tool.result, duration: tool.duration, status: tool.status, error: tool.error } }
                        : seg
                    ),
                  }
                  : m
              )
            );
          },
          onDone: (newSessionId) => {
            setSessionId(newSessionId);
            setIsSending(false);
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                // Finalize any tools still in 'running' state
                const finalSegments = m.segments.map((seg) =>
                  seg.type === 'tool' && seg.tool?.status === 'running'
                    ? { ...seg, tool: { ...seg.tool, status: 'success' as const } }
                    : seg
                );
                return { ...m, isStreaming: false, segments: finalSegments };
              })
            );
            abortControllerRef.current = null;
          },
          onError: (errorMsg) => {
            setIsSending(false);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, isStreaming: false, error: errorMsg }
                  : m
              )
            );
            abortControllerRef.current = null;
          },
          onLimitReached: (_reason, message) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                    ...m,
                    segments: [...m.segments, { type: 'text' as const, content: `\n\n> ${message}` }],
                    content: m.content + `\n\n> ${message}`,
                  }
                  : m
              )
            );
          },
        },
        undefined, // organizationId
        attachmentIds.length > 0 ? attachmentIds : undefined
      );
    } catch (err: any) {
      setIsSending(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, isStreaming: false, error: err.message || "Erreur lors de l'envoi" }
            : m
        )
      );
    }
  }, [activeMode, sessionId]);

  // Audio recording handlers
  const handleMicPress = useCallback(async () => {
    if (audioRecorder.state.isRecording) {
      // Stop recording and transcribe
      const audioUri = await audioRecorder.stopRecording();
      if (audioUri) {
        setIsTranscribing(true);
        try {
          const result = await copilotService.transcribeAudio(audioUri, 'audio/m4a');
          if (result.success && result.data?.text) {
            // Append transcribed text to input (or replace if empty)
            setInputText(prev => prev.trim() ? `${prev} ${result.data!.text}` : result.data!.text);
            inputRef.current?.focus();
          } else {
            Alert.alert('Erreur', result.error || 'Impossible de transcrire l\'audio');
          }
        } catch (err: any) {
          Alert.alert('Erreur', err.message || 'Erreur de transcription');
        } finally {
          setIsTranscribing(false);
        }
      }
    } else {
      // Start recording
      await audioRecorder.startRecording();
    }
  }, [audioRecorder]);

  const handleCancelRecording = useCallback(async () => {
    await audioRecorder.cancelRecording();
  }, [audioRecorder]);

  // Auto-stop recording when reaching 30 seconds
  useEffect(() => {
    if (audioRecorder.remainingTime === 0 && audioRecorder.state.isRecording) {
      handleMicPress(); // This will stop and transcribe
    }
  }, [audioRecorder.remainingTime, audioRecorder.state.isRecording, handleMicPress]);

  // Format recording duration as mm:ss
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Send message from input
  const handleSend = () => {
    if ((!inputText.trim() && attachments.length === 0) || isSending) return;
    const text = inputText.trim();
    const currentAttachments = [...attachments];
    setInputText('');
    setAttachments([]);
    startStream(text, currentAttachments);
  };

  // Auto-submit quiz answer (tapping an option sends it as a message)
  const handleQuizAnswer = useCallback((answer: string) => {
    if (isSending) return;
    startStream(answer);
  }, [isSending, startStream]);

  // Stop the current stream
  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsSending(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.isStreaming
          ? { ...m, isStreaming: false, segments: m.segments.map((seg) => seg.type === 'tool' && seg.tool?.status === 'running' ? { ...seg, tool: { ...seg.tool, status: 'success' as const } } : seg) }
          : m
      )
    );
  }, []);

  // Start new conversation
  const handleNewConversation = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSessionId(null);
    setMessages([]);
    setError(null);
    setIsSending(false);
  };

  // Retry a failed message
  const handleRetry = useCallback((messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.lastUserMessage) return;
    const retryText = msg.lastUserMessage;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    startStream(retryText);
  }, [messages, startStream]);

  // Long-press on user message: copy (all), edit+resend (last only)
  const handleUserMessageLongPress = useCallback((messageId: string, content: string) => {
    if (isSending) return;

    // Find all user messages to determine if this is the last one
    const userMessages = messages.filter((m) => m.role === 'user');
    const isLastUserMessage = userMessages.length > 0 && userMessages[userMessages.length - 1].id === messageId;

    if (isLastUserMessage) {
      Alert.alert(
        'Message',
        undefined,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Copier',
            onPress: () => Clipboard.setStringAsync(content),
          },
          {
            text: 'Modifier et renvoyer',
            onPress: () => {
              // Remove this user message and its following assistant response
              const msgIndex = messages.findIndex((m) => m.id === messageId);
              if (msgIndex === -1) return;
              setMessages((prev) => prev.slice(0, msgIndex));
              setInputText(content);
              setTimeout(() => inputRef.current?.focus(), 100);
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Message',
        undefined,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Copier',
            onPress: () => Clipboard.setStringAsync(content),
          },
        ]
      );
    }
  }, [messages, isSending]);

  // Open history panel
  const handleOpenHistory = async () => {
    await loadSessions();
    setShowHistory(true);
  };

  // Select session from history
  const handleSelectSession = (session: SessionSummary) => {
    setShowHistory(false);
    loadSession(session.id);
  };

  // Delete session
  const handleDeleteSession = async (id: string) => {
    try {
      await copilotService.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (sessionId === id) {
        handleNewConversation();
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const currentMode = MODES.find((m) => m.id === activeMode);
  const ModeIcon = currentMode?.icon || Compass;
  const firstName = user?.firstName || user?.displayName?.split(' ')[0] || 'toi';

  // Human-readable relative timestamp from message ID (which embeds Date.now())
  const formatTimestamp = (messageId: string): string => {
    const match = messageId.match(/(\d{13})/);
    if (!match) return '';
    const ts = parseInt(match[1], 10);
    const diff = Date.now() - ts;
    if (diff < 60_000) return "À l'instant";
    if (diff < 3_600_000) return `Il y a ${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return `Il y a ${Math.floor(diff / 3_600_000)}h`;
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const renderEmptyState = () => (
    <ScrollView
      style={styles.emptyStateScroll}
      contentContainerStyle={styles.emptyState}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.orbContainer}>
        <PulsingOrb size={100} />
      </View>
      {isOrganizationSpace ? (
        <Text style={[styles.greeting, { color: colors.textPrimary }]}>
          <Text style={{ color: colors.primary, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: TYPOGRAPHY.fontWeight.bold }}>{selectedOrg?.name || 'Organisation'}</Text> — recrutement, talents, communautés ou espaces : que souhaitez-vous piloter ?
        </Text>
      ) : (
        <Text style={[styles.greeting, { color: colors.textPrimary }]}>
          Bienvenue <Text style={{ color: colors.primary, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: TYPOGRAPHY.fontWeight.bold }}>{firstName}</Text>. Comment puis-je éclairer votre chemin aujourd'hui ?
        </Text>
      )}
    </ScrollView>
  );

  const renderMessages = () => (
    <ScrollView
      ref={scrollViewRef}
      style={styles.messagesContainer}
      contentContainerStyle={styles.messagesContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {messages.map((message, msgIdx) => (
        <View key={message.id} style={styles.messageWrapper}>
          {message.role === 'user' ? (
            /* User message: bubble style (right-aligned), long-press for actions */
            <View style={styles.userMessageContainer}>
              <TouchableOpacity
                style={[styles.userMessage, { backgroundColor: colors.primary }]}
                onLongPress={() => handleUserMessageLongPress(message.id, message.content)}
                activeOpacity={0.8}
                delayLongPress={400}
              >
                {message.content ? (
                  <Text style={[styles.userMessageText, { color: colors.textOnPrimary }]}>
                    {message.content}
                  </Text>
                ) : null}
                {message.attachments && message.attachments.length > 0 && (
                  <View style={[styles.userAttachments, message.content ? { marginTop: 6 } : undefined]}>
                    {message.attachments.map((att, i) => (
                      <View key={i} style={[styles.userAttachmentChip, { backgroundColor: withOpacity(colors.textOnPrimary, OPACITY[20]) }]}>
                        <Paperclip size={10} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                        <Text style={[styles.userAttachmentText, { color: colors.textOnPrimary }]} numberOfLines={1}>
                          {att.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* Assistant message: transparent, full-width */
            <View style={styles.assistantMessage}>
              {/* Inline segments: ordered text/tool blocks */}
              {message.segments.length > 0 ? (
                message.segments.map((seg, idx) => {
                  if (seg.type === 'tool' && seg.tool) {
                    return <ToolBlock key={`seg-${idx}`} tool={seg.tool} />;
                  }
                  if (seg.type === 'text' && seg.content) {
                    const isLastMessage = msgIdx === messages.length - 1 && !message.isStreaming && !isSending;
                    return (
                      <MarkdownRenderer
                        key={`seg-${idx}`}
                        content={seg.content}
                        onQuizAnswer={isLastMessage ? handleQuizAnswer : undefined}
                        sessionId={sessionId || undefined}
                        interactiveConfirmation={!message.isStreaming}
                      />
                    );
                  }
                  return null;
                })
              ) : message.isStreaming ? (
                <ThinkingIndicator />
              ) : message.error ? null : null}

              {/* Error state with retry */}
              {message.error && (
                <View style={[styles.messageError, { backgroundColor: withOpacity(colors.error, OPACITY[5]) }]}>
                  <AlertCircle size={14} color={colors.error} />
                  <Text style={[styles.messageErrorText, { color: colors.error }]}>
                    {message.error}
                  </Text>
                  {message.lastUserMessage && (
                    <TouchableOpacity
                      style={[styles.retryButton, { borderColor: colors.error }]}
                      onPress={() => handleRetry(message.id)}
                      activeOpacity={0.7}
                    >
                      <RefreshCw size={12} color={colors.error} />
                      <Text style={[styles.retryText, { color: colors.error }]}>Réessayer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Streaming cursor */}
              {message.isStreaming && message.content && (
                <View style={styles.streamingCursor}>
                  <View style={[styles.cursorDot, { backgroundColor: colors.primary }]} />
                </View>
              )}

              {/* Footer: copy button + generation timestamp — at the bottom */}
              {message.content && !message.isStreaming && !message.error && (
                <View style={styles.messageFooter}>
                  <Text style={[styles.messageTimestamp, { color: colors.textDisabled }]}>
                    {formatTimestamp(message.id)}
                  </Text>
                  <CopyButton content={message.content} />
                </View>
              )}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );

  const renderHistoryPanel = () => (
    <View style={[styles.historyPanel, { backgroundColor: colors.background }]}>
      <View style={[styles.historyHeader, { borderBottomColor: colors.borderColor }]}>
        <Text style={[styles.historyTitle, { color: colors.textPrimary }]}>Archives des sessions</Text>
        <TouchableOpacity onPress={() => setShowHistory(false)}>
          <X size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.historyList}>
        {sessions.length === 0 ? (
          <Text style={[styles.historyEmpty, { color: colors.textSecondary }]}>
            Aucune conversation
          </Text>
        ) : (
          sessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              style={[
                styles.historyItem,
                { borderBottomColor: colors.borderColor },
                session.id === sessionId && { backgroundColor: withOpacity(colors.primary, OPACITY[10]) },
              ]}
              onPress={() => handleSelectSession(session)}
            >
              <View style={styles.historyItemContent}>
                {(() => {
                  const sessionMode = (session.mode as Mode) || 'explore';
                  const SessionModeIcon = MODE_ICONS[sessionMode] || Compass;
                  return (
                    <View
                      style={[
                        styles.historyModeBadge,
                        { backgroundColor: modeColors[sessionMode]?.bg || colors.surface },
                      ]}
                    >
                      <SessionModeIcon size={14} color={modeColors[sessionMode]?.text || colors.textSecondary} />
                    </View>
                  );
                })()}
                <View style={styles.historyItemText}>
                  <Text style={[styles.historyItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {session.title || 'Session sans titre'}
                  </Text>
                  <Text style={[styles.historyItemMeta, { color: colors.textSecondary }]}>
                    {session.messageCount} messages · {formatRelativeTime(session.lastMessageAt || session.createdAt)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.historyItemDelete}
                onPress={() => handleDeleteSession(session.id)}
              >
                <Trash2 size={16} color={colors.textDisabled} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.keyboardView}>
          {/* Header */}
          <Header
            title={t('assistant.title')}
            rightContent={
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.headerButton}
                  activeOpacity={0.8}
                  onPress={handleOpenHistory}
                >
                  <History size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerButton}
                  activeOpacity={0.8}
                  onPress={handleNewConversation}
                >
                  <Plus size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                </TouchableOpacity>
              </View>
            }
          />

          {/* Error banner */}
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: withOpacity(colors.error, OPACITY[15]) }]}>
              <AlertCircle size={16} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <X size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}

          {/* Loading state */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ThinkingIndicator label="Chargement..." />
            </View>
          ) : (
            <View style={styles.content}>
              {messages.length === 0 ? renderEmptyState() : renderMessages()}
            </View>
          )}

          {/* Input Area */}
          <View style={styles.inputArea}>
            <View
              style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
            >
              {/* Recording Overlay */}
              {(audioRecorder.state.isRecording || audioRecorder.state.isPreparing || isTranscribing) && (
                <View style={[styles.recordingOverlay, { backgroundColor: withOpacity(colors.error, OPACITY[10]) }]}>
                  <View style={styles.recordingContent}>
                    {isTranscribing ? (
                      <>
                        <View style={[styles.transcribingIcon, { backgroundColor: colors.primary }]}>
                          <Loader2 size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                        </View>
                        <Text style={[styles.recordingText, { color: colors.textPrimary }]}>
                          Transcription en cours...
                        </Text>
                      </>
                    ) : audioRecorder.state.isPreparing ? (
                      <>
                        <View style={[styles.recordingDot, { backgroundColor: colors.warning }]} />
                        <Text style={[styles.recordingText, { color: colors.textPrimary }]}>
                          Préparation...
                        </Text>
                      </>
                    ) : (
                      <>
                        <View style={[styles.recordingDot, { backgroundColor: colors.error }]} />
                        <Text style={[styles.recordingText, { color: colors.textPrimary }]}>
                          {formatDuration(audioRecorder.state.duration)} / 0:30
                        </Text>
                        <View style={styles.recordingProgress}>
                          <View
                            style={[
                              styles.recordingProgressBar,
                              { backgroundColor: colors.error, width: `${audioRecorder.progress * 100}%` }
                            ]}
                          />
                        </View>
                      </>
                    )}
                  </View>
                  {/* Stop/cancel actions handled by the MicOff button in the input row */}
                </View>
              )}

              {/* Attachment Preview */}
              {attachments.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.attachmentPreviewContainer}
                >
                  {attachments.map((file, index) => (
                    <View
                      key={index}
                      style={[styles.attachmentPreview, { backgroundColor: withOpacity(colors.primary, OPACITY[10]), borderColor: colors.primary }]}
                    >
                      <View style={styles.attachmentPreviewContent}>
                        <Text
                          style={[styles.attachmentPreviewText, { color: colors.primary }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {file.name}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.removeAttachmentButton, { backgroundColor: colors.primary }]}
                        onPress={() => removeAttachment(index)}
                      >
                        <X size={10} color={colors.textOnPrimary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Row 1: TextInput + Mic + Send */}
              <View style={styles.inputRow}>
                <TextInput
                  ref={inputRef}
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder={audioRecorder.state.isRecording ? 'Enregistrement en cours...' : t('assistant.inputPlaceholder')}
                  placeholderTextColor={colors.gray500}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={500}
                  editable={!isSending && !audioRecorder.state.isRecording && !isTranscribing}
                />

                <TouchableOpacity
                  style={[
                    styles.inputAction,
                    audioRecorder.state.isRecording && styles.micButtonRecording,
                    audioRecorder.state.isRecording && { backgroundColor: withOpacity(colors.error, OPACITY[20]) },
                  ]}
                  onPress={handleMicPress}
                  disabled={isSending || audioRecorder.state.isPreparing || isTranscribing}
                  activeOpacity={0.8}
                >
                  {audioRecorder.state.isRecording ? (
                    <MicOff size={ICON.size.md} color={colors.error} strokeWidth={ICON.strokeWidth} />
                  ) : (
                    <Mic
                      size={ICON.size.md}
                      color={isSending || isTranscribing ? colors.gray300 : colors.gray500}
                      strokeWidth={ICON.strokeWidth}
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    isSending
                      ? { backgroundColor: colors.textPrimary }
                      : { backgroundColor: colors.primary },
                    !isSending && ((!inputText.trim() && attachments.length === 0) || audioRecorder.state.isRecording) && { backgroundColor: colors.gray200 },
                  ]}
                  onPress={isSending ? handleStop : handleSend}
                  disabled={!isSending && ((!inputText.trim() && attachments.length === 0) || audioRecorder.state.isRecording)}
                  activeOpacity={0.8}
                >
                  {isSending ? (
                    <Square size={ICON.size.sm} color={colors.textOnPrimary} fill={colors.textOnPrimary} strokeWidth={0} />
                  ) : (
                    <SendHorizontal
                      size={ICON.size.md}
                      color={(inputText.trim() || attachments.length > 0) && !audioRecorder.state.isRecording ? colors.textOnPrimary : colors.gray400}
                      strokeWidth={ICON.strokeWidth}
                    />
                  )}
                </TouchableOpacity>
              </View>

              {/* Row 2: Actions */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.inputAction}
                  activeOpacity={0.8}
                  onPress={handlePickFile}
                  disabled={isSending || audioRecorder.state.isRecording || isTranscribing}
                >
                  <Plus
                    size={ICON.size.md}
                    color={(isSending || audioRecorder.state.isRecording || isTranscribing) ? colors.gray300 : colors.gray500}
                    strokeWidth={ICON.strokeWidth}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.inputAction}
                  activeOpacity={0.8}
                  onPress={() => setIsSuggestionsVisible(true)}
                >
                  <Lightbulb size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeToggle, { backgroundColor: modeColors[activeMode].bg }]}
                  onPress={
                    MODES.length > 1
                      ? () => setActiveMode(activeMode === 'explore' ? 'study' : 'explore')
                      : undefined
                  }
                  activeOpacity={MODES.length > 1 ? 0.8 : 1}
                  disabled={MODES.length === 1}
                >
                  <ModeIcon
                    size={ICON.size.sm}
                    color={modeColors[activeMode].text}
                    strokeWidth={ICON.strokeWidth}
                  />
                  <Text style={[styles.modeToggleText, { color: modeColors[activeMode].text }]}>
                    {currentMode?.label}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <SuggestionsTooltip
            visible={isSuggestionsVisible}
            onClose={() => setIsSuggestionsVisible(false)}
            onSelectSuggestion={(suggestion) => {
              setInputText(suggestion);
              setIsSuggestionsVisible(false);
            }}
            mode={activeMode}
            sessionId={sessionId}
          />

          {/* History Panel (overlay) */}
          {showHistory && renderHistoryPanel()}
        </View>
      </KeyboardAvoidingView>
      <FooterNav activeTab="assistant" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  keyboardView: {
    flex: 1,
  },

  // Header
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    borderRadius: BORDER.radius.sm,
    gap: SPACING.sm,
  },
  errorText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Content
  content: {
    flex: 1,
  },

  // Empty State
  emptyStateScroll: {
    flex: 1,
  },

  emptyState: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  orbContainer: {
    marginBottom: SPACING.xl,
  },

  greeting: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.xl * 1.4,
  },

  quickPromptsContainer: {
    marginTop: SPACING.xl,
    width: '100%',
    gap: SPACING.sm,
  },

  quickPrompt: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: 1,
  },

  quickPromptText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },

  // Messages
  messagesContainer: {
    flex: 1,
  },

  messagesContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },

  messageWrapper: {
    marginBottom: SPACING.md,
  },

  // User message: bubble, right-aligned
  userMessageContainer: {
    alignItems: 'flex-end',
  },

  userMessage: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
  },

  userMessageText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.normal,
  },

  userAttachments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },

  userAttachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    maxWidth: '100%',
  },

  userAttachmentText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    flexShrink: 1,
  },

  // Assistant message: transparent, full-width
  assistantMessage: {
    width: '100%',
  },

  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  messageTimestamp: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },

  streamingCursor: {
    flexDirection: 'row',
    marginTop: 2,
  },

  cursorDot: {
    width: 6,
    height: 16,
    borderRadius: 1,
    opacity: 0.7,
  },

  messageError: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: BORDER.radius.sm,
    marginTop: SPACING.xs,
  },
  messageErrorText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER.radius.xs,
  },
  retryText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  // Input Area
  inputArea: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },

  inputContainer: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  inputAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    minHeight: 44,
    maxHeight: 100,
    paddingVertical: SPACING.sm,
  },

  sendButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },

  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },

  modeToggleText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // History Panel
  historyPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },

  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
  },

  historyTitle: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },

  historyList: {
    flex: 1,
  },

  historyEmpty: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    padding: SPACING.xl,
  },

  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
  },

  historyItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },

  historyModeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  historyItemText: {
    flex: 1,
  },

  historyItemTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  historyItemMeta: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },

  historyItemDelete: {
    padding: SPACING.sm,
  },

  // Audio Recording UI
  recordingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.xs,
  },

  recordingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  transcribingIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  recordingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  recordingProgress: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },

  recordingProgressBar: {
    height: '100%',
    borderRadius: 2,
  },

  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  recordingActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  recordingStopButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  micButtonRecording: {
    borderRadius: BORDER.radius.sm,
  },
  attachmentPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACING.sm,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: BORDER.radius.sm,
    borderWidth: 1,
    gap: SPACING.xs,
    maxWidth: 160,
  },
  attachmentPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  attachmentPreviewText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  removeAttachmentButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
