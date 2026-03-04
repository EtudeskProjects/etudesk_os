import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  Animated,
  Easing,
  AppState,
  Alert,
  TextInput,
  Modal,
  SectionList,
} from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import {
  SendHorizontal,
  Paperclip,
  Mic,
  MicOff,
  Compass,
  BookOpen,
  History,
  Plus,
  AlertCircle,
  X,
  Trash2,
  Square,
  RefreshCw,
  Pin,
  PinOff,
  Pencil,
  List,
} from 'lucide-react-native';
import { useAudioRecorder } from '../../../src/hooks/useAudioRecorder';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
	import { useI18n } from '../../../src/contexts/I18nContext';
	import { useSpace } from '../../../src/contexts/SpaceContext';
	import { useAuth } from '../../../src/contexts/AuthContext';
	import { Button, Header, FooterNav, IconButton, Input, SelectCard } from '../../../src/components/ui';
	import { ShimmerPlaceholder } from '../../../src/components/ui/ShimmerPlaceholder';
import {
  MarkdownRenderer,
  CopyButton,
  FeedbackButtons,
  ThinkingIndicator,
  ToolBlock,
  PulsingOrb,
  VoiceNotePlayer,
} from '../../../src/components/copilot';
import {
  copilotService,
  CopilotMessage,
  SessionSummary,
  MessageSegment,
} from '../../../src/services/copilotService';
import { formatRelativeTime } from '../../../src/utils/date';
import { useAlert } from '../../../src/contexts/AlertContext';

type Mode = 'explore' | 'study';

const MODE_ICONS = {
  explore: Compass,
  study: BookOpen,
};

interface AttachmentInfo {
  name: string;
  type: string;
  size?: number;
  uri?: string;
}

interface StreamingMessage {
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
  const [historyFilter, setHistoryFilter] = useState<'all' | 'explore' | 'study'>('all');
  const [renamingSession, setRenamingSession] = useState<SessionSummary | null>(null);
  const [renameText, setRenameText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [floatingSuggestions, setFloatingSuggestions] = useState<string[]>([]);
  const [hideFloatingSuggestions, setHideFloatingSuggestions] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const replaceLastExchangeRef = useRef<boolean>(false);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
  const MAX_ATTACHMENTS = 3;

  // Audio recording hook
  const audioRecorder = useAudioRecorder();

  // Pulse animation for recording dot
  const recordingPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (audioRecorder.state.isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingPulse, {
            toValue: 0.3,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(recordingPulse, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      recordingPulse.setValue(1);
    }
  }, [audioRecorder.state.isRecording, recordingPulse]);

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const modeColors = {
    explore: { bg: withOpacity(colors.primary, OPACITY[10]), text: colors.primary },
    study: { bg: withOpacity(colors.success, OPACITY[10]), text: colors.success },
  };
  const { t, locale } = useI18n();
  const { isOrganizationSpace, selectedOrg } = useSpace();
  const { user } = useAuth();
  const inputRef = useRef<any>(null);
  const messagesListRef = useRef<FlatList<StreamingMessage>>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const alerts = useAlert();

  // Track AppState for foreground reload
  const appStateRef = useRef(AppState.currentState);
  const isSendingRef = useRef(false);

  // Keep isSendingRef in sync with isSending state
  useEffect(() => {
    isSendingRef.current = isSending;
  }, [isSending]);

  // Keep-awake: prevent screen sleep while streaming
  useEffect(() => {
    if (isSending) {
      activateKeepAwakeAsync('copilot-stream').catch(() => {});
    } else {
      deactivateKeepAwake('copilot-stream');
    }
  }, [isSending]);

  // Track keyboard visibility to hide footer when keyboard is open
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Session reload on foreground: if the app was backgrounded during streaming,
  // reload the session messages when it comes back
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);
      appStateRef.current = nextAppState;

      if (wasBackground && nextAppState === 'active' && isSendingRef.current && sessionId) {
        // Stream was likely interrupted — abort, reload session, clean up
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setIsSending(false);
        deactivateKeepAwake('copilot-stream');
        loadSession(sessionId);
      }
    });
    return () => subscription.remove();
  }, [sessionId]);

  // Build modes with translated labels
  const ALL_MODES = [
    { id: 'explore' as Mode, label: t('assistant.modes.explore'), icon: MODE_ICONS.explore },
    { id: 'study' as Mode, label: t('assistant.modes.study'), icon: MODE_ICONS.study },
  ];
  const MODES = isOrganizationSpace ? ALL_MODES.filter(m => m.id === 'explore') : ALL_MODES;

  // Set initial mode from URL parameter
  useEffect(() => {
    if (mode === 'explore' || mode === 'study') {
      if (isOrganizationSpace && mode === 'study') {
        setActiveMode('explore');
        return;
      }
      setActiveMode(mode);
    }
  }, [mode, isOrganizationSpace]);

  // Switching between talent/org space must also switch the assistant "agent scope":
  // - Org space: force EXPLORE + org agent
  // - Talent space: restore last talent mode (EXPLORE/STUDY)
  // Always reset session state to avoid cross-space session reuse.
  const lastTalentModeRef = useRef<Mode>('explore');
  const lastIsOrgRef = useRef<boolean>(false);
  useEffect(() => {
    const wasOrg = lastIsOrgRef.current;
    const nowOrg = isOrganizationSpace;
    if (wasOrg === nowOrg) return;
    lastIsOrgRef.current = nowOrg;

    if (!wasOrg && nowOrg) {
      // Save talent mode before entering org space
      lastTalentModeRef.current = activeMode;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsSending(false);
    setShowHistory(false);
    setError(null);
    setSessionId(null);
    setMessages([]);
    setActiveMode(nowOrg ? 'explore' : lastTalentModeRef.current);
  }, [isOrganizationSpace, activeMode]);

  // When switching between organizations while staying in organization space,
  // reset the assistant state so we don't reuse a session from another org.
  const lastOrgIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!isOrganizationSpace) {
      lastOrgIdRef.current = undefined;
      return;
    }

    const nextOrgId = selectedOrg?.id;
    const prevOrgId = lastOrgIdRef.current;
    const changed = prevOrgId !== undefined && prevOrgId !== nextOrgId;

    lastOrgIdRef.current = nextOrgId;
    if (!changed) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsSending(false);
    setShowHistory(false);
    setError(null);
    setSessionId(null);
    setMessages([]);
    setActiveMode('explore');
  }, [isOrganizationSpace, selectedOrg?.id]);

  // Handle prompt and focus from URL parameters
  // When navigating from action buttons (Se former, Auto-diagnostic, Cohorte),
  // reset session to a fresh state
  const pendingPromptRef = useRef<string | null>(null);

  useEffect(() => {
    if (prompt || focusInput === 'true') {
      // Reset to a fresh session
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setSessionId(null);
      setMessages([]);
      setError(null);
      setIsSending(false);
      if (prompt) {
        setInputText(prompt);
        pendingPromptRef.current = prompt;
      } else {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [prompt, focusInput]);

  // Auto-send pending prompt once state has settled (session reset + mode set)
  useEffect(() => {
    if (pendingPromptRef.current && !sessionId && messages.length === 0 && !isSending) {
      const text = pendingPromptRef.current;
      pendingPromptRef.current = null;
      setInputText('');
      setTimeout(() => startStream(text), 100);
    }
  }, [sessionId, messages, isSending]);

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
        messagesListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

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

  const loadFloatingSuggestions = useCallback((forceShow: boolean = false) => {
    const next = getFallbackSuggestions(activeMode, isOrganizationSpace);
    setFloatingSuggestions(next);
    if (forceShow) setHideFloatingSuggestions(false);
  }, [activeMode, getFallbackSuggestions, isOrganizationSpace]);

  useEffect(() => {
    loadFloatingSuggestions(true);
  }, [loadFloatingSuggestions]);

  // Load session
  const loadSession = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await copilotService.getSession(id, isOrganizationSpace ? selectedOrg?.id : undefined);
      if (response.error || !response.data) {
        throw new Error(response.error || t('screens.assistant.sessionNotFound'));
      }

      const { session, messages: sessionMessages } = response.data;
      setSessionId(session.id);
      const sessionMode = (session.mode === 'explore' || session.mode === 'study') ? (session.mode as Mode) : 'explore';
      setActiveMode(isOrganizationSpace && sessionMode === 'study' ? 'explore' : sessionMode);

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

          // Extract voiceNoteUrl and file attachments from persisted attachments JSON
          // Format: { voiceNoteUrl, voiceNoteMimeType, files?: [...] } or [...files] (legacy)
          const raw = m.attachments as any;
          const isObj = raw && !Array.isArray(raw);
          const voiceNoteUrl = isObj ? raw.voiceNoteUrl : undefined;
          const fileAttachments = isObj && Array.isArray(raw.files)
            ? raw.files
            : (Array.isArray(raw) ? raw : []);

          return {
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            segments,
            senderName: m.senderName,
            voiceNoteUrl,
            attachments: fileAttachments.length > 0
              ? fileAttachments.map((a: any) => ({ name: a.name, type: a.type, size: a.size }))
              : undefined,
          };
        });
      setMessages(converted);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('screens.assistant.unknownError'));
    } finally {
      setIsLoading(false);
    }
  };

  // Load sessions list
  const loadSessions = async () => {
    try {
      const response = await copilotService.listSessions(20, isOrganizationSpace ? selectedOrg?.id : undefined);
      if (response.data?.sessions) {
        setSessions(response.data.sessions);
      }
    } catch (err) {
      if (__DEV__) console.error('Failed to load sessions:', err);
    }
  };

  // Core streaming function — used by handleSend, handleQuizAnswer, and handleRetry
  const handlePickFile = async () => {
    try {
      const remaining = MAX_ATTACHMENTS - attachments.length;
      if (remaining <= 0) {
        void alerts.alert(t('screens.assistant.limitReached'), t('screens.assistant.maxAttachments', { max: MAX_ATTACHMENTS }));
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
            void alerts.alert(t('screens.assistant.fileTooLarge'), t('screens.assistant.fileTooLargeMessage', { name: file.name }));
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
    } catch (error) {
      if (__DEV__) console.error('Error picking file:', error);
      void alerts.alert(t('common.error'), t('screens.assistant.fileSelectError'));
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const startStream = useCallback(async (userContent: string, attachmentFiles: any[] = [], voiceNoteUrl?: string, voiceNoteMimeType?: string) => {
    setIsSending(true);
    setError(null);
    setHideFloatingSuggestions(true);

    // Capture and reset replaceLastExchange flag (one-shot)
    const shouldReplace = replaceLastExchangeRef.current;
    replaceLastExchangeRef.current = false;

    const effectiveMode: Mode = isOrganizationSpace ? 'explore' : activeMode;
    const organizationId = isOrganizationSpace ? selectedOrg?.id : undefined;

    const userMsg: StreamingMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userContent,
      segments: [],
      senderName: isOrganizationSpace ? (firstName || undefined) : undefined,
      attachments: attachmentFiles.length > 0
        ? attachmentFiles.map((a: any) => ({ name: a.name, type: a.type, size: a.size, uri: a.uri }))
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

    try {
      let attachmentIds: string[] = [];

      // 1. Upload attachments if present
      if (attachmentFiles.length > 0) {
        const uploadRes = await copilotService.uploadAttachments(
          attachmentFiles.map((a) => ({ uri: a.uri, type: a.type, name: a.name }))
        );

        if (!uploadRes.success || !uploadRes.data?.documents) {
          throw new Error(uploadRes.error || t('screens.assistant.uploadError'));
        }

        attachmentIds = uploadRes.data.documents.map((doc: any) => doc.id);
      }

      abortControllerRef.current = copilotService.sendMessageStream(
        userContent,
        effectiveMode,
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
            loadFloatingSuggestions(false);
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
          onContentCorrected: (correctedContent) => {
            // Update text without collapsing/reordering text/tool interleaving.
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                const textIndexes: number[] = [];
                const textContents: string[] = [];
                m.segments.forEach((s, i) => {
                  if (s.type === 'text') {
                    textIndexes.push(i);
                    textContents.push(s.content || '');
                  }
                });

                if (textIndexes.length === 0) {
                  return { ...m, content: correctedContent };
                }

                if (textIndexes.length === 1) {
                  const idx = textIndexes[0];
                  const nextSegments = [...m.segments];
                  nextSegments[idx] = { ...nextSegments[idx], type: 'text', content: correctedContent };
                  return { ...m, content: correctedContent, segments: nextSegments };
                }

                // Keep original boundaries between text segments to preserve tool placement.
                const boundaries: number[] = [];
                let acc = 0;
                for (let i = 0; i < textContents.length - 1; i++) {
                  acc += textContents[i].length;
                  boundaries.push(acc);
                }

                const nextSegments = [...m.segments];
                let cursor = 0;
                for (let i = 0; i < textIndexes.length; i++) {
                  const segIdx = textIndexes[i];
                  const end = i < boundaries.length
                    ? Math.min(correctedContent.length, boundaries[i])
                    : correctedContent.length;
                  const chunk = correctedContent.slice(cursor, end);
                  nextSegments[segIdx] = { ...nextSegments[segIdx], type: 'text', content: chunk };
                  cursor = end;
                }

                return {
                  ...m,
                  content: correctedContent,
                  segments: nextSegments,
                };
              })
            );
          },
          onAudioReady: (audioUrl, duration) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                    ...m,
                    segments: [
                      ...m.segments,
                      { type: 'audio' as const, audioUrl, audioDuration: duration, autoPlay: true },
                    ],
                  }
                  : m
              )
            );
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
        organizationId,
        attachmentIds.length > 0 ? attachmentIds : undefined,
        shouldReplace || undefined,
        voiceNoteUrl,
        voiceNoteMimeType
      );
    } catch (err: any) {
      setIsSending(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, isStreaming: false, error: err.message || t('screens.assistant.sendError') }
            : m
        )
      );
    }
  }, [activeMode, sessionId, isOrganizationSpace, selectedOrg?.id, loadFloatingSuggestions]);

  // Audio recording handlers
  const handleMicPress = useCallback(async () => {
    if (audioRecorder.state.isRecording) {
      // Stop recording and send as voice note
      const audioUri = await audioRecorder.stopRecording();
      if (audioUri) {
        setIsTranscribing(true);
        try {
          // Upload voice note to server
          const uploadResult = await copilotService.sendVoiceNote(audioUri, 'audio/m4a');
          if (uploadResult.success && uploadResult.data?.voiceNoteUrl) {
            // Send as voice note — the backend will analyze it with Gemini
            startStreamWithVoiceNote(uploadResult.data.voiceNoteUrl, uploadResult.data.mimeType);
          } else {
            void alerts.alert(t('common.error'), uploadResult.error || t('screens.assistant.voiceNoteError'));
          }
        } catch (err: any) {
          void alerts.alert(t('common.error'), err.message || t('screens.assistant.sendErrorShort'));
        } finally {
          setIsTranscribing(false);
        }
      }
    } else {
      // Start recording
      await audioRecorder.startRecording();
    }
  }, [audioRecorder]);

  // Send a voice note as a message (upload + stream with audio analysis)
  const startStreamWithVoiceNote = useCallback((voiceNoteUrl: string, mimeType: string) => {
    startStream(`\ud83c\udfa4 ${t('screens.assistant.voiceNote')}`, [], voiceNoteUrl, mimeType);
  }, [startStream]);

  // Auto-stop recording when reaching max duration
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
    const text = inputText.trim().replace(/\n{2,}/g, '\n').replace(/^\n+|\n+$/g, '');
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
      void alerts.showAlert({ title: t('screens.assistant.message'), message: undefined, buttons: [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('screens.assistant.copy'),
            onPress: () => Clipboard.setStringAsync(content),
          },
          {
            text: t('screens.assistant.editResend'),
            onPress: () => {
              // Remove this user message and its following assistant response from local state
              const msgIndex = messages.findIndex((m) => m.id === messageId);
              if (msgIndex === -1) return;
              setMessages((prev) => prev.slice(0, msgIndex));
              setInputText(content);
              // Flag so next send will tell backend to replace the last exchange
              replaceLastExchangeRef.current = true;
              setTimeout(() => inputRef.current?.focus(), 100);
            },
          },
        ] });
    } else {
      void alerts.showAlert({ title: t('screens.assistant.message'), message: undefined, buttons: [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('screens.assistant.copy'),
            onPress: () => Clipboard.setStringAsync(content),
          },
        ] });
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
      if (__DEV__) console.error('Failed to delete session:', err);
    }
  };

  // Rename session
  const handleRenameSession = async () => {
    if (!renamingSession || !renameText.trim()) {
      setRenamingSession(null);
      return;
    }
    try {
      await copilotService.renameSession(renamingSession.id, renameText.trim());
      setSessions((prev) =>
        prev.map((s) => s.id === renamingSession.id ? { ...s, title: renameText.trim() } : s)
      );
    } catch (err) {
      if (__DEV__) console.error('Failed to rename session:', err);
    } finally {
      setRenamingSession(null);
      setRenameText('');
    }
  };

  // Pin/unpin session
  const handleTogglePin = async (session: SessionSummary) => {
    const newPinned = !session.isPinned;
    // Optimistic update
    setSessions((prev) =>
      prev.map((s) => s.id === session.id ? { ...s, isPinned: newPinned } : s)
    );
    try {
      await copilotService.togglePinSession(session.id, newPinned);
    } catch (err) {
      // Revert on error
      setSessions((prev) =>
        prev.map((s) => s.id === session.id ? { ...s, isPinned: !newPinned } : s)
      );
      if (__DEV__) console.error('Failed to toggle pin:', err);
    }
  };

  // Open rename modal
  const handleStartRename = (session: SessionSummary) => {
    setRenameText(session.title || '');
    setRenamingSession(session);
  };

  const currentMode = MODES.find((m) => m.id === activeMode);
  const ModeIcon = currentMode?.icon || Compass;
  const firstName = user?.firstName || user?.displayName?.split(' ')[0] || 'toi';
  const latestAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

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

    // If assistant already rendered a confirmation flow, next action is explicit.
    if (raw.includes('```confirmation')) return true;

    // Remove fenced code blocks to avoid false positives from JSON/chart syntax.
    const text = raw
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (!text) return false;

    // Focus on ending where next-step cues usually appear.
    const tail = text.slice(Math.max(0, text.length - 320));

    // Direct invitation to continue.
    const ctaPatterns = [
      /souhaitez-vous/,
      /veux-tu/,
      /veut-tu/,
      /voulez-vous/,
      /on commence/,
      /prochaine étape/,
      /confirmez/,
      /cliquez/,
      /choisissez/,
      /dites-moi si/,
      /je peux (te|vous) aider/,
      /would you like/,
      /do you want/,
      /shall we/,
      /next step/,
      /confirm/,
      /click/,
      /choose/,
      /let me know if/,
      /i can help/,
    ];
    if (ctaPatterns.some((p) => p.test(tail))) return true;

    // Explicit question near the end => step is likely clear.
    if (/[?]\s*$/.test(tail) || /[?]\s*["\u201C\u201D]?\s*$/.test(tail)) return true;

    // Clear action plan already provided (e.g., numbered "next steps").
    const hasStepList =
      /(prochaines? étapes?|plan d'action|plan d'\s*action|next steps?|action plan|roadmap)/.test(text) &&
      /(?:^|\s)1[\).\-\s]/.test(text) &&
      /(?:^|\s)2[\).\-\s]/.test(text);
    if (hasStepList) return true;

    return false;
  }, []);

  const shouldShowFloatingSuggestions =
    floatingSuggestions.length > 0 &&
    !hideFloatingSuggestions &&
    !isSending &&
    !audioRecorder.state.isRecording &&
    !isTranscribing &&
    !messages.some((m) => m.role === 'assistant') &&
    inputText.trim().length === 0;

  // Human-readable relative timestamp from message ID (which embeds Date.now())
  const formatTimestamp = (messageId: string): string => {
    const match = messageId.match(/(\d{13})/);
    if (!match) return '';
    const ts = parseInt(match[1], 10);
    const diff = Date.now() - ts;
    if (diff < 60_000) return t('screens.gestion.justNow');
    if (diff < 3_600_000) return `Il y a ${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return `Il y a ${Math.floor(diff / 3_600_000)}h`;
    const d = new Date(ts);
    return d.toLocaleDateString(locale || undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const formatAssistantError = (err: string): string => {
    const msg = (err || '').toString().trim();
    const lower = msg.toLowerCase();

    // Avoid leaking internal tool/schema/server errors in the UI.
    const isInternal =
      lower.includes('invalid schema') ||
      (lower.includes('schema') && lower.includes('function')) ||
      lower.includes('zod') ||
      lower.includes('openai') ||
      lower.includes('bad request') ||
      lower.startsWith('400 ');

    if (isInternal) {
      return t('screens.assistant.tempIssue');
    }

    // Trim very long errors that would break the layout.
    if (msg.length > 180) return `${msg.slice(0, 177)}...`;
    return msg;
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
          <Text style={{ color: colors.primary, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: TYPOGRAPHY.fontWeight.bold }}>{selectedOrg?.name || t('myReservations.detail.organizationFallback')}</Text> {t('screens.assistant.orgGreeting')}
        </Text>
      ) : activeMode === 'study' ? (
        <Text style={[styles.greeting, { color: colors.textPrimary }]}>
          {t('screens.assistant.studyGreeting', { name: firstName })}
        </Text>
      ) : (
        <Text style={[styles.greeting, { color: colors.textPrimary }]}>
          {t('screens.assistant.exploreGreeting', { name: firstName })}
        </Text>
      )}
    </ScrollView>
  );

  const renderMessages = () => (
    <FlatList
      ref={messagesListRef}
      style={styles.messagesContainer}
      contentContainerStyle={styles.messagesContent}
      data={messages}
      keyExtractor={(m) => m.id}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      initialNumToRender={12}
      windowSize={11}
      removeClippedSubviews={Platform.OS === 'android'}
      renderItem={({ item: message, index: msgIdx }) => (
        <View style={styles.messageWrapper}>
          {message.role === 'user' ? (
            /* User message: bubble style (right-aligned), long-press for actions */
            <View style={styles.userMessageContainer}>
              {message.senderName && isOrganizationSpace ? (
                <Text style={[styles.senderLabel, { color: colors.textSecondary }]}>
                  {message.senderName}
                </Text>
              ) : null}
              <Pressable
                style={({ pressed }) => [
                  styles.userMessage,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.9 },
                ]}
                onLongPress={() => handleUserMessageLongPress(message.id, message.content)}
                delayLongPress={400}
              >
                {message.voiceNoteUrl ? (
                  <VoiceNotePlayer url={message.voiceNoteUrl} />
                ) : message.content ? (
                  <Text style={[styles.userMessageText, { color: colors.textOnPrimary }]}>
                    {message.content}
                  </Text>
                ) : null}
                {message.attachments && message.attachments.length > 0 && (
                  <View style={[styles.userAttachments, message.content ? { marginTop: 6 } : undefined]}>
                    {message.attachments.map((att, i) => {
                      const isImage = att.type?.startsWith('image/') && att.uri;
                      return isImage ? (
                        <Image key={i} source={{ uri: att.uri }} style={[styles.userMsgThumb, { borderColor: withOpacity(colors.textOnPrimary, OPACITY[30]) }]} />
                      ) : (
                        <View key={i} style={[styles.userAttachmentChip, { backgroundColor: withOpacity(colors.textOnPrimary, OPACITY[20]) }]}>
                          <Paperclip size={10} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                          <Text style={[styles.userAttachmentText, { color: colors.textOnPrimary }]} numberOfLines={1}>
                            {att.name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Pressable>
            </View>
          ) : (
            /* Assistant message: transparent, full-width */
            <View style={styles.assistantMessage}>
              {/* Always pin tool blocks on top, in execution order */}
              {message.segments.length > 0 ? (
                <>
                  {message.segments.map((seg, idx) => {
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
                    if (seg.type === 'audio' && seg.audioUrl) {
                      const { AudioBlock } = require('../../../src/components/copilot/blocks/AudioBlock');
                      return <AudioBlock key={`seg-${idx}`} url={seg.audioUrl} duration={seg.audioDuration} autoPlay={!!(seg as any).autoPlay} />;
                    }
                    return null;
                  })}
                </>
              ) : message.isStreaming ? (
                <ThinkingIndicator />
              ) : message.error ? null : null}

              {/* Error state with retry */}
	              {message.error && (
	                <View style={[styles.messageError, { backgroundColor: withOpacity(colors.error, OPACITY[5]) }]}>
	                  <AlertCircle size={14} color={colors.error} />
	                  <Text style={[styles.messageErrorText, { color: colors.error }]}>
	                    {formatAssistantError(message.error)}
	                  </Text>
	                  {message.lastUserMessage && (
	                    <Button
	                      title={t('screens.assistant.retry')}
	                      onPress={() => handleRetry(message.id)}
	                      variant="outline"
	                      size="sm"
	                      icon={<RefreshCw size={12} color={colors.error} />}
	                      style={[styles.retryButton, { borderColor: colors.error }]}
	                      textStyle={[styles.retryText, { color: colors.error }]}
	                    />
	                  )}
	                </View>
	              )}

              {/* Streaming cursor */}
              {message.isStreaming && message.content && (
                <View style={styles.streamingCursor}>
                  <View style={[styles.cursorDot, { backgroundColor: colors.primary }]} />
                </View>
              )}

              {/* Footer: timestamp + feedback + copy — at the bottom */}
              {message.content && !message.isStreaming && !message.error && (
                <View style={styles.messageFooter}>
                  <Text style={[styles.messageTimestamp, { color: colors.textDisabled }]}>
                    {formatTimestamp(message.id)}
                  </Text>
                  <View style={styles.messageActions}>
                    <FeedbackButtons messageId={message.id} />
                    <CopyButton content={message.content} />
                  </View>
                </View>
              )}

              {/* Clickable follow-ups to steer next turn */}
              {message.content &&
                !message.isStreaming &&
                !message.error &&
                message.id === latestAssistantId &&
                !hasClearNextStep(message.content) && (
                <View style={styles.followUpsWrap}>
                  {buildFollowUps(message.content).slice(0, 3).map((followUp, idx) => (
                    <Pressable
                      key={`${message.id}-followup-${idx}`}
                      onPress={() => {
                        setInputText(followUp);
                        setHideFloatingSuggestions(true);
                        setTimeout(() => inputRef.current?.focus(), 80);
                      }}
                      style={({ pressed }) => [
                        styles.followUpChip,
                        { borderColor: colors.borderColor, backgroundColor: withOpacity(colors.primary, OPACITY[5]) },
                        pressed && { backgroundColor: withOpacity(colors.primary, OPACITY[12]) },
                      ]}
                    >
                      <Text style={[styles.followUpText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {followUp}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    />
  );

	  const renderHistoryPanel = () => {
      // Filter sessions by mode
      const filteredSessions = historyFilter === 'all'
        ? sessions
        : sessions.filter((s) => s.mode === historyFilter);

      // Separate pinned and unpinned
      const pinnedSessions = filteredSessions.filter((s) => s.isPinned);
      const unpinnedSessions = filteredSessions.filter((s) => !s.isPinned);

      // Build section data
      const sections: { title: string; data: SessionSummary[] }[] = [];
      if (pinnedSessions.length > 0) {
        sections.push({ title: t('screens.assistant.pinnedSessions'), data: pinnedSessions });
      }
      sections.push({ title: '', data: unpinnedSessions });

      const filterTabs = [
        { key: 'all', label: t('screens.assistant.filterAll') },
        { key: 'explore', label: t('screens.assistant.filterDiscover') },
        ...(!isOrganizationSpace ? [{ key: 'study', label: t('screens.assistant.filterStudy') }] : []),
      ];

      const renderSessionItem = (session: SessionSummary) => {
        const sessionMode = (session.mode as Mode) || 'explore';
        const SessionModeIcon = MODE_ICONS[sessionMode] || Compass;

        return (
          <SelectCard
            style={[
              styles.historyItem,
              { borderBottomColor: colors.borderColor },
              session.id === sessionId && { backgroundColor: withOpacity(colors.primary, OPACITY[10]) },
              { borderWidth: 0, borderColor: 'transparent', borderRadius: 0 },
            ]}
            onPress={() => handleSelectSession(session)}
            onLongPress={() => handleStartRename(session)}
            selected={false}
            accessibilityLabel={session.title || t('screens.assistant.untitledSession')}
          >
            <View style={styles.historyItemContent}>
              <View
                style={[
                  styles.historyModeBadge,
                  { backgroundColor: modeColors[sessionMode]?.bg || colors.surface },
                ]}
              >
                <SessionModeIcon size={14} color={modeColors[sessionMode]?.text || colors.textSecondary} />
              </View>
              <View style={styles.historyItemText}>
                <View style={styles.historyItemTitleRow}>
                  <Text style={[styles.historyItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {session.title || t('screens.assistant.untitledSession')}
                  </Text>
                  {session.isPinned && (
                    <Pin size={12} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                  )}
                </View>
                <Text style={[styles.historyItemMeta, { color: colors.textSecondary }]}>
                  {session.messageCount} {t('gestion.memberDetails.tabMessages').toLowerCase()} · {formatRelativeTime(session.lastMessageAt || session.createdAt)}
                  {session.createdByName ? ` · ${session.createdByName}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.historyItemActions}>
              <IconButton
                onPress={() => handleTogglePin(session)}
                icon={session.isPinned
                  ? <PinOff size={14} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                  : <Pin size={14} color={colors.textDisabled} strokeWidth={ICON.strokeWidth} />
                }
                accessibilityLabel={session.isPinned ? t('screens.assistant.unpinConversation') : t('screens.assistant.pinConversation')}
                size="sm"
                variant="ghost"
              />
              <IconButton
                onPress={() => handleStartRename(session)}
                icon={<Pencil size={14} color={colors.textDisabled} strokeWidth={ICON.strokeWidth} />}
                accessibilityLabel={t('screens.assistant.renameConversation')}
                size="sm"
                variant="ghost"
              />
              <IconButton
                onPress={() => handleDeleteSession(session.id)}
                icon={<Trash2 size={14} color={colors.textDisabled} strokeWidth={ICON.strokeWidth} />}
                accessibilityLabel={t('screens.assistant.deleteConversation')}
                size="sm"
                variant="ghost"
              />
            </View>
          </SelectCard>
        );
      };

      return (
        <View style={[styles.historyPanel, { backgroundColor: colors.background }]}>
          <View style={[styles.historyHeader, { borderBottomColor: colors.borderColor }]}>
            <Text style={[styles.historyTitle, { color: colors.textPrimary }]}>{t('screens.assistant.sessionArchives')}</Text>
            <IconButton
              onPress={() => setShowHistory(false)}
              icon={<X size={20} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
              accessibilityLabel={t('screens.explore.close')}
              size="sm"
              variant="ghost"
            />
          </View>

          {/* Mode filter tabs */}
          <View style={[styles.historyFilterRow, { borderBottomColor: colors.borderColor }]}>
            {filterTabs.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setHistoryFilter(tab.key as 'all' | 'explore' | 'study')}
                style={[
                  styles.historyFilterTab,
                  historyFilter === tab.key && { backgroundColor: colors.primary },
                ]}
              >
                <Text style={[
                  styles.historyFilterTabText,
                  { color: historyFilter === tab.key ? colors.textOnPrimary : colors.textSecondary },
                ]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <SectionList
            style={styles.historyList}
            sections={sections}
            keyExtractor={(s) => s.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) =>
              section.title ? (
                <View style={[styles.historySectionHeader, { borderBottomColor: colors.borderColor }]}>
                  <Pin size={12} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.historySectionTitle, { color: colors.primary }]}>
                    {section.title}
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <Text style={[styles.historyEmpty, { color: colors.textSecondary }]}>
                {t('screens.assistant.noConversation')}
              </Text>
            }
            renderItem={({ item }) => renderSessionItem(item)}
          />

          {/* Rename Modal */}
          <Modal
            visible={!!renamingSession}
            transparent
            animationType="fade"
            onRequestClose={() => setRenamingSession(null)}
          >
            <Pressable
              style={styles.renameModalOverlay}
              onPress={() => setRenamingSession(null)}
            >
              <Pressable
                style={[styles.renameModalContent, { backgroundColor: colors.background }]}
                onPress={() => {}}
              >
                <Text style={[styles.renameModalTitle, { color: colors.textPrimary }]}>
                  {t('screens.assistant.renameSessionTitle')}
                </Text>
                <TextInput
                  style={[styles.renameInput, { color: colors.textPrimary, borderColor: colors.borderColor, backgroundColor: colors.surface }]}
                  value={renameText}
                  onChangeText={setRenameText}
                  placeholder={t('screens.assistant.renameSessionPlaceholder')}
                  placeholderTextColor={colors.textDisabled}
                  autoFocus
                  maxLength={100}
                  onSubmitEditing={handleRenameSession}
                  returnKeyType="done"
                />
                <View style={styles.renameModalActions}>
                  <Button
                    title={t('common.cancel')}
                    onPress={() => setRenamingSession(null)}
                    variant="secondary"
                    size="sm"
                  />
                  <Button
                    title={t('common.save')}
                    onPress={handleRenameSession}
                    variant="primary"
                    size="sm"
                    disabled={!renameText.trim()}
                  />
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      );
    };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={keyboardVisible ? ['top'] : ['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior="padding"
      >
        <View style={styles.keyboardView}>
          {/* Header */}
          <Header
            title={t('assistant.title')}
            rightContent={
              <View style={styles.headerActions}>
                <IconButton
                  onPress={handleOpenHistory}
                  icon={<History size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
                  accessibilityLabel={t('screens.assistant.history')}
                  style={styles.headerButton}
                />
                <IconButton
                  onPress={handleNewConversation}
                  icon={<Plus size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
                  accessibilityLabel={t('screens.assistant.newConversation')}
                  style={styles.headerButton}
                />
              </View>
            }
          />

          {/* Error banner */}
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: withOpacity(colors.error, OPACITY[15]) }]}>
              <AlertCircle size={16} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              <IconButton
                onPress={() => setError(null)}
                icon={<X size={16} color={colors.error} />}
                accessibilityLabel={t('screens.assistant.closeError')}
                size="sm"
                variant="ghost"
              />
            </View>
          )}

          {/* Loading state */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ThinkingIndicator />
            </View>
          ) : (
            <View style={styles.content}>
              {messages.length === 0 ? renderEmptyState() : renderMessages()}
            </View>
          )}

          {/* Input Area */}
          <View style={styles.inputArea}>
            {shouldShowFloatingSuggestions && (
              <View style={styles.floatingSuggestionsWrap}>
                {floatingSuggestions.slice(0, 3).map((suggestion, idx) => (
                  <Pressable
                    key={`floating-suggestion-${idx}`}
                    onPress={() => {
                      setInputText(suggestion);
                      setHideFloatingSuggestions(true);
                      setTimeout(() => inputRef.current?.focus(), 80);
                    }}
                    style={({ pressed }) => [
                      styles.floatingSuggestionChip,
                      { borderColor: colors.borderColor, backgroundColor: withOpacity(colors.background, OPACITY[90]) },
                      pressed && { backgroundColor: withOpacity(colors.primary, OPACITY[8]), borderColor: withOpacity(colors.primary, OPACITY[30]) },
                    ]}
                  >
                    <Text style={[styles.floatingSuggestionText, { color: colors.textPrimary }]} numberOfLines={1}>
                      {suggestion}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View
              style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
            >
              {/* Recording Overlay */}
              {(audioRecorder.state.isRecording || audioRecorder.state.isPreparing || isTranscribing) && (
                <View style={[styles.recordingOverlay, { backgroundColor: withOpacity(colors.error, OPACITY[10]) }]}>
                  <View style={styles.recordingContent}>
                    {isTranscribing ? (
                      <>
                        <ShimmerPlaceholder width={28} height={28} borderRadius={14} />
                        <ShimmerPlaceholder width={140} height={14} />
                      </>
                    ) : audioRecorder.state.isPreparing ? (
                      <>
                        <View style={[styles.recordingDot, { backgroundColor: colors.warning }]} />
                        <Text style={[styles.recordingText, { color: colors.textPrimary }]}>
                          {t('screens.assistant.preparing')}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Animated.View style={[styles.recordingDot, { backgroundColor: colors.error, opacity: recordingPulse, transform: [{ scale: recordingPulse.interpolate({ inputRange: [0.3, 1], outputRange: [0.8, 1.2] }) }] }]} />
                        <Text style={[styles.recordingText, { color: colors.textPrimary }]}>
                          {formatDuration(audioRecorder.state.duration)} / 3:00
                        </Text>
                        <View style={[styles.recordingProgress, { backgroundColor: withOpacity(colors.black, OPACITY[10]) }]}>
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
	                  {attachments.map((file, index) => {
                      const isImage = file.type?.startsWith('image/');
                      return isImage ? (
                        <View key={index} style={styles.attachmentThumbWrap}>
                          <Image source={{ uri: file.uri }} style={[styles.attachmentThumb, { borderColor: colors.borderColor }]} />
                          <Pressable
                            onPress={() => removeAttachment(index)}
                            style={[styles.attachmentThumbRemove, { backgroundColor: colors.primary }]}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <X size={8} color={colors.textOnPrimary} strokeWidth={3} />
                          </Pressable>
                        </View>
                      ) : (
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
	                      <IconButton
	                        onPress={() => removeAttachment(index)}
	                        icon={<X size={10} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
	                        accessibilityLabel={t('screens.assistant.removeAttachment')}
	                        size="sm"
	                        variant="ghost"
	                        style={[styles.removeAttachmentButton, { backgroundColor: colors.primary }]}
	                      />
	                    </View>
                      );
	                  })}
	                </ScrollView>
	              )}

              {/* TextInput */}
              <View style={styles.inputRow}>
                <Input
                  ref={inputRef}
                  placeholder={audioRecorder.state.isRecording ? t('screens.assistant.recording') : t('assistant.inputPlaceholder')}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={2000}
                  editable={!isSending && !audioRecorder.state.isRecording && !isTranscribing}
                  containerStyle={{ flex: 1 }}
                  inputContainerStyle={{ backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0, height: undefined, minHeight: 32, maxHeight: 100, paddingVertical: 0 }}
                  inputStyle={{ color: colors.textPrimary, paddingHorizontal: 0, paddingVertical: 4, fontSize: TYPOGRAPHY.fontSize.md, minHeight: 32, maxHeight: 100 }}
                />
              </View>

              {/* Actions row: Attach + Mode | Mic + Send */}
              <View style={styles.actionsRow}>
                <IconButton
                  onPress={handlePickFile}
                  disabled={isSending || audioRecorder.state.isRecording || isTranscribing}
                  icon={
                    <Plus
                      size={ICON.size.md}
                      color={(isSending || audioRecorder.state.isRecording || isTranscribing) ? colors.gray300 : colors.gray500}
                      strokeWidth={ICON.strokeWidth}
                    />
                  }
                  accessibilityLabel={t('screens.assistant.addAttachment')}
                  size="sm"
                  variant="ghost"
                  style={styles.inputAction}
                />

	                <Button
	                  title={currentMode?.label || ''}
	                  onPress={() => {
	                    const nextMode = activeMode === 'explore' ? 'study' : 'explore';
	                    abortControllerRef.current?.abort();
	                    abortControllerRef.current = null;
	                    setIsSending(false);
	                    setError(null);
	                    setSessionId(null);
	                    setMessages([]);
	                    setInputText('');
	                    setActiveMode(nextMode);
	                  }}
	                  disabled={MODES.length === 1}
	                  variant="secondary"
	                  size="sm"
	                  icon={<ModeIcon size={ICON.size.sm} color={modeColors[activeMode].text} strokeWidth={ICON.strokeWidth} />}
	                  style={[styles.modeToggle, { backgroundColor: modeColors[activeMode].bg }]}
	                  textStyle={[styles.modeToggleText, { color: modeColors[activeMode].text }]}
	                />

                <View style={{ flex: 1 }} />

	                <IconButton
	                  onPress={handleMicPress}
	                  disabled={isSending || audioRecorder.state.isPreparing || isTranscribing}
	                  icon={
	                    audioRecorder.state.isRecording ? (
	                      <MicOff size={ICON.size.md} color={colors.error} strokeWidth={ICON.strokeWidth} />
	                    ) : (
	                      <Mic
	                        size={ICON.size.md}
	                        color={isSending || isTranscribing ? colors.gray300 : colors.gray500}
	                        strokeWidth={ICON.strokeWidth}
	                      />
	                    )
	                  }
	                  accessibilityLabel={audioRecorder.state.isRecording ? t('screens.assistant.stopRecording') : t('screens.assistant.startRecording')}
	                  size="sm"
	                  variant="ghost"
	                  style={[
	                    styles.inputAction,
	                    audioRecorder.state.isRecording && styles.micButtonRecording,
	                    audioRecorder.state.isRecording && { backgroundColor: withOpacity(colors.error, OPACITY[20]) },
	                  ]}
	                />

	                <IconButton
	                  onPress={isSending ? handleStop : handleSend}
	                  disabled={!isSending && ((!inputText.trim() && attachments.length === 0) || audioRecorder.state.isRecording)}
	                  icon={
	                    isSending ? (
	                      <Square size={ICON.size.sm} color={colors.textOnPrimary} fill={colors.textOnPrimary} strokeWidth={0} />
	                    ) : (
	                      <SendHorizontal
	                        size={ICON.size.md}
	                        color={(inputText.trim() || attachments.length > 0) && !audioRecorder.state.isRecording ? colors.textOnPrimary : colors.gray400}
	                        strokeWidth={ICON.strokeWidth}
	                      />
	                    )
	                  }
	                  accessibilityLabel={isSending ? t('screens.assistant.stopGeneration') : t('screens.assistant.send')}
	                  size="sm"
	                  variant="ghost"
	                  style={[
	                    styles.sendButton,
	                    isSending
	                      ? { backgroundColor: colors.textPrimary }
	                      : { backgroundColor: colors.primary },
	                    !isSending && ((!inputText.trim() && attachments.length === 0) || audioRecorder.state.isRecording) && { backgroundColor: colors.gray200 },
	                  ]}
	                />
	              </View>
	            </View>
	          </View>

          {/* History Panel (overlay) */}
          {showHistory && renderHistoryPanel()}
        </View>
      </KeyboardAvoidingView>
      {!keyboardVisible && <FooterNav activeTab="assistant" />}
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

  senderLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: 2,
    marginRight: SPACING.xs,
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
  messageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
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
  followUpsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  followUpChip: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.full,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    maxWidth: '100%',
  },
  followUpText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
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
    paddingTop: 2,
    paddingBottom: 4,
  },
  floatingSuggestionsWrap: {
    marginBottom: SPACING.xs,
    gap: SPACING.xs,
  },
  floatingSuggestionChip: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.full,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
  },
  floatingSuggestionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  inputContainer: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    gap: 0,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingTop: 2,
  },

  inputAction: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    minHeight: 32,
    maxHeight: 100,
    paddingVertical: 4,
  },

  sendButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },

  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    height: 28,
    paddingVertical: 0,
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

  historyItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  historyItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  historyFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: 1,
  },

  historyFilterTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER.radius.full,
  },

  historyFilterTabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },

  historySectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  renameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },

  renameModalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BORDER.radius.lg,
    padding: SPACING.xl,
    gap: SPACING.md,
  },

  renameModalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },

  renameInput: {
    borderWidth: 1,
    borderRadius: BORDER.radius.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },

  renameModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
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
  attachmentThumbWrap: {
    position: 'relative',
  },
  attachmentThumb: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.sm,
    borderWidth: 1,
  },
  attachmentThumbRemove: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMsgThumb: {
    width: 56,
    height: 56,
    borderRadius: BORDER.radius.sm,
    borderWidth: 1,
  },
});
