import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Animated,
  Easing,
  AppState,
} from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import {
  Compass,
  BookOpen,
  History,
  Plus,
  AlertCircle,
  X,
} from 'lucide-react-native';
import { useAudioRecorder } from '../../../src/hooks/useAudioRecorder';
import { useAudioPlayerHook } from '../../../src/hooks/useAudioPlayer';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/contexts/I18nContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import { Header, FooterNav, IconButton } from '../../../src/components/ui';
import { AssistantEmptyState } from '../../../src/components/assistant/AssistantEmptyState';
import { AssistantHistoryPanel } from '../../../src/components/assistant/AssistantHistoryPanel';
import { AssistantMessagesList } from '../../../src/components/assistant/AssistantMessagesList';
import { AssistantComposer } from '../../../src/components/assistant/AssistantComposer';
import { ThinkingIndicator } from '../../../src/components/copilot';
import { useAlert } from '../../../src/contexts/AlertContext';
import {
  StreamingMessage,
  useAssistantSessionLoader,
} from '../../../src/hooks/assistant/useAssistantSessionLoader';
import { useAssistantSessionHistory } from '../../../src/hooks/assistant/useAssistantSessionHistory';
import { useAssistantStreaming } from '../../../src/hooks/assistant/useAssistantStreaming';

type Mode = 'explore' | 'study';

const MODE_ICONS = {
  explore: Compass,
  study: BookOpen,
};

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
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [pendingVoiceNote, setPendingVoiceNote] = useState<{ uri: string; duration: number } | null>(null);
  const [floatingSuggestions, setFloatingSuggestions] = useState<string[]>([]);
  const [hideFloatingSuggestions, setHideFloatingSuggestions] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Audio recording hook
  const audioRecorder = useAudioRecorder();

  // Audio player for voice note preview
  const voicePreviewPlayer = useAudioPlayerHook(pendingVoiceNote?.uri ?? null);

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
  const modeColors = {
    explore: { bg: withOpacity(colors.primary, OPACITY[10]), text: colors.primary },
    study: { bg: withOpacity(colors.success, OPACITY[10]), text: colors.success },
  };
  const { t, locale } = useI18n();
  const { isOrganizationSpace, selectedOrg } = useSpace();
  const { user } = useAuth();
  const inputRef = useRef<any>(null);
  const messagesListRef = useRef<FlatList<StreamingMessage>>(null);
  const alerts = useAlert();
  const scrollToBottom = useCallback((animated: boolean = true) => {
    setTimeout(() => {
      messagesListRef.current?.scrollToEnd({ animated });
    }, 100);
  }, []);
  const firstName = user?.firstName || user?.displayName?.split(' ')[0] || 'toi';

  const { loadSession } = useAssistantSessionLoader({
    isOrganizationSpace,
    onError: (message) => setError(message || null),
    onMessagesLoaded: setMessages,
    onModeLoaded: setActiveMode,
    organizationId: selectedOrg?.id,
    scrollToBottom,
    setIsLoading,
    setSessionId,
    t,
  });

  const {
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
  } = useAssistantStreaming({
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
    selectedOrgId: selectedOrg?.id,
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
  });

  const handleNewConversation = useCallback(() => {
    resetForNewConversation();
  }, [resetForNewConversation]);

  const {
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
  } = useAssistantSessionHistory({
    currentSessionId: sessionId,
    isOrganizationSpace,
    loadSession,
    onNewConversation: handleNewConversation,
    organizationId: selectedOrg?.id,
  });

  // Track AppState for foreground reload
  const appStateRef = useRef(AppState.currentState);
  const isSendingRef = useRef(false);
  const shouldResumeSessionRef = useRef(false);

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

      if (nextAppState.match(/inactive|background/) && isSendingRef.current && sessionId) {
        shouldResumeSessionRef.current = true;
      }

      appStateRef.current = nextAppState;

      if (wasBackground && nextAppState === 'active' && shouldResumeSessionRef.current && sessionId) {
        // The stream may have completed server-side while the app was backgrounded.
        // Always reload the persisted session when coming back.
        shouldResumeSessionRef.current = false;
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setIsSending(false);
        setError(null);
        deactivateKeepAwake('copilot-stream');
        loadSession(sessionId);
      }
    });
    return () => subscription.remove();
  }, [abortControllerRef, loadSession, sessionId]);

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
  }, [abortControllerRef, activeMode, isOrganizationSpace, setSessionId, setShowHistory]);

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
  }, [abortControllerRef, isOrganizationSpace, selectedOrg?.id, setSessionId, setShowHistory]);

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
  }, [abortControllerRef, focusInput, prompt, setSessionId]);

  // Load session if sessionId is provided
  useEffect(() => {
    if (initialSessionId) {
      void loadSession(initialSessionId);
    }
  }, [initialSessionId, loadSession]);

  const currentMode = MODES.find((m) => m.id === activeMode);
  const ModeIcon = currentMode?.icon || Compass;
  const latestAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  const renderMessages = () => (
    <AssistantMessagesList
      buildFollowUps={buildFollowUps}
      colors={colors}
      formatAssistantError={formatAssistantError}
      formatTimestamp={formatTimestamp}
      handleQuizAnswer={(answer) => handleQuizAnswer(answer, sessionId)}
      handleRetry={(messageId) => handleRetry(messageId, sessionId)}
      handleSelectFollowUp={focusWithSuggestion}
      handleUserMessageLongPress={handleUserMessageLongPress}
      onSkillPress={appendSuggestion}
      hasClearNextStep={hasClearNextStep}
      isOrganizationSpace={isOrganizationSpace}
      isSending={isSending}
      latestAssistantId={latestAssistantId}
      messages={messages}
      messagesListRef={messagesListRef}
      sessionId={sessionId}
      styles={styles}
      t={t}
    />
  );

  useEffect(() => {
    if (pendingPromptRef.current && !sessionId && messages.length === 0 && !isSending) {
      const text = pendingPromptRef.current;
      pendingPromptRef.current = null;
      setInputText('');
      setTimeout(() => startStream(text, [], undefined, undefined, sessionId), 100);
    }
  }, [isSending, messages, sessionId, startStream]);

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
              {messages.length === 0 ? (
                <AssistantEmptyState
                  activeMode={activeMode}
                  colors={colors}
                  firstName={firstName}
                  isOrganizationSpace={isOrganizationSpace}
                  organizationName={selectedOrg?.name}
                  styles={styles}
                  t={t}
                />
              ) : renderMessages()}
            </View>
          )}

          <AssistantComposer
            activeMode={activeMode}
            attachments={attachments}
            audioRecorder={audioRecorder}
            colors={colors}
            currentModeLabel={currentMode?.label || ''}
            floatingSuggestions={floatingSuggestions}
            formatDuration={formatDuration}
            handleMicPress={handleMicPress}
            handlePickFile={handlePickFile}
            handleSend={() => handleSend(sessionId)}
            handleStop={handleStop}
            inputRef={inputRef}
            inputText={inputText}
            isSending={isSending}
            isTranscribing={isTranscribing}
            modeColors={modeColors}
            modeIcon={<ModeIcon size={ICON.size.sm} color={modeColors[activeMode].text} strokeWidth={ICON.strokeWidth} />}
            modesCount={MODES.length}
            onChangeText={setInputText}
            onRemoveAttachment={removeAttachment}
            onSelectSuggestion={focusWithSuggestion}
            onToggleMode={() => {
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
            pendingVoiceNote={pendingVoiceNote}
            recordingPulse={recordingPulse}
            removePendingVoiceNote={clearPendingVoiceNote}
            shouldShowFloatingSuggestions={shouldShowFloatingSuggestions}
            styles={styles}
            t={t}
            voicePreviewPlayer={voicePreviewPlayer}
          />

          {/* History Panel (overlay) */}
          {showHistory && (
            <AssistantHistoryPanel
              colors={colors}
              handleDeleteSession={handleDeleteSession}
              handleRenameSession={handleRenameSession}
              handleSelectSession={handleSelectSession}
              handleStartRename={handleStartRename}
              handleTogglePin={handleTogglePin}
              historyFilter={historyFilter}
              isOrganizationSpace={isOrganizationSpace}
              modeColors={modeColors}
              renameText={renameText}
              renamingSession={renamingSession}
              sessionId={sessionId}
              sessions={sessions}
              setHistoryFilter={setHistoryFilter}
              setRenameText={setRenameText}
              setRenamingSession={setRenamingSession}
              setShowHistory={setShowHistory}
              styles={styles}
              t={t}
            />
          )}
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
    fontSize: 12,
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
    width: 36,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  historyModeRail: {
    position: 'absolute',
    left: 0,
    width: 3,
    height: 24,
    borderRadius: 2,
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
    backgroundColor: 'rgba(9, 9, 11, 0.5)',
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
  voiceNotePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER.radius.sm,
    borderWidth: 1,
    marginBottom: 2,
    gap: SPACING.sm,
  },
  voiceNotePlayBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceNoteProgressWrap: {
    flex: 1,
  },
  voiceNoteProgressBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  voiceNoteProgressBar: {
    height: '100%',
    borderRadius: 2,
  },
  voiceNoteDuration: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    minWidth: 30,
    textAlign: 'center',
  },
  voiceNoteRemoveBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 12,
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
