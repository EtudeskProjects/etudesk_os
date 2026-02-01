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
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  SendHorizontal,
  Paperclip,
  Mic,
  Sparkles,
  Compass,
  BookOpen,
  Lightbulb,
  History,
  Plus,
  AlertCircle,
  X,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/contexts/I18nContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import { Header, FooterNav } from '../../../src/components/ui';
import {
  CopilotOutputRenderer,
  ThinkingIndicator,
  ToolExecutionTimeline,
  ToolExecution,
} from '../../../src/components/copilot';
import {
  copilotService,
  CopilotMode,
  COPILOT_MODES,
  CopilotMessage,
  SessionSummary,
  OUTPUT_TYPES,
} from '../../../src/services/copilotService';

type Mode = 'explore' | 'study';

const MODE_COLORS = {
  explore: { bg: '#F5F5F5', text: '#757575' },
  study: { bg: '#EDE7F6', text: '#7E57C2' },
};

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
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [activeToolExecutions, setActiveToolExecutions] = useState<ToolExecution[]>([]);

  const { colors } = useTheme();
  const { t } = useI18n();
  const { isOrganizationSpace } = useSpace();
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Build modes with translated labels
  const ALL_MODES = [
    { id: 'explore' as Mode, label: t('assistant.modes.explore'), icon: MODE_ICONS.explore },
    { id: 'study' as Mode, label: t('assistant.modes.study'), icon: MODE_ICONS.study },
  ];

  const MODES = isOrganizationSpace ? ALL_MODES.filter((m) => m.id !== 'study') : ALL_MODES;

  // Set initial mode from URL parameter
  useEffect(() => {
    if (mode && (mode === 'explore' || mode === 'study')) {
      if (mode === 'study' && isOrganizationSpace) {
        setActiveMode('explore');
      } else {
        setActiveMode(mode);
      }
    }
  }, [mode, isOrganizationSpace]);

  // Reset to explore mode if organization space is activated while in study mode
  useEffect(() => {
    if (isOrganizationSpace && activeMode === 'study') {
      setActiveMode('explore');
    }
  }, [isOrganizationSpace, activeMode]);

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
      setMessages(sessionMessages || []);
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

  // Send message
  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;

    const userContent = inputText.trim();
    setInputText('');
    setIsSending(true);
    setError(null);
    setActiveToolExecutions([]);

    // Add optimistic user message
    const tempUserMessage: CopilotMessage = {
      id: `temp-${Date.now()}`,
      sessionId: sessionId || '',
      role: 'user',
      content: userContent,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await copilotService.sendMessage(
        userContent,
        activeMode as CopilotMode,
        sessionId || undefined
      );

      if (response.error || !response.data?.data) {
        throw new Error(response.error || "Erreur lors de l'envoi du message");
      }

      const chatResponse = response.data.data;

      // Update session ID
      setSessionId(chatResponse.sessionId);

      // Extract tool executions from response if available
      if (chatResponse.message.toolCalls && chatResponse.message.toolCalls.length > 0) {
        const toolExecutions: ToolExecution[] = chatResponse.message.toolCalls.map(
          (tc: any, index: number) => ({
            id: tc.id || `tool-${index}`,
            name: tc.name || tc.function?.name || 'unknown',
            status: 'success' as const,
            result: tc.result ? JSON.stringify(tc.result).slice(0, 100) : undefined,
            duration: tc.duration,
          })
        );
        setActiveToolExecutions(toolExecutions);
      }

      // Replace temp message and add assistant response
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => !m.id.startsWith('temp-'));
        const realUserMessage: CopilotMessage = {
          ...tempUserMessage,
          id: `user-${Date.now()}`,
          sessionId: chatResponse.sessionId,
        };
        return [...withoutTemp, realUserMessage, chatResponse.message];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
    } finally {
      setIsSending(false);
      // Clear tool executions after a delay
      setTimeout(() => setActiveToolExecutions([]), 2000);
    }
  };

  // Handle mode toggle
  const handleToggleMode = () => {
    const currentIndex = MODES.findIndex((m) => m.id === activeMode);
    const nextIndex = (currentIndex + 1) % MODES.length;
    const newMode = MODES[nextIndex].id;

    // If mode changes, start a new session
    if (newMode !== activeMode) {
      setActiveMode(newMode);
      setSessionId(null);
      setMessages([]);
    }
  };

  // Start new conversation
  const handleNewConversation = () => {
    setSessionId(null);
    setMessages([]);
    setError(null);
  };

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
  const userName = user?.talents?.[0]?.display_name?.split(' ')[0] || 'toi';

  const renderEmptyState = () => (
    <ScrollView
      style={styles.emptyStateScroll}
      contentContainerStyle={styles.emptyState}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.assistantIcon, { backgroundColor: colors.surface }]}>
        <Sparkles size={ICON.size.xl * 1.5} color={colors.primary} strokeWidth={ICON.strokeWidth} />
      </View>

      <Text style={[styles.greeting, { color: colors.textSecondary }]}>{t('assistant.greeting')}</Text>
      <Text style={[styles.userName, { color: colors.primary }]}>{userName} ?</Text>

      {/* Quick prompts */}
      <View style={styles.quickPromptsContainer}>
        {activeMode === 'explore' ? (
          <>
            <TouchableOpacity
              style={[styles.quickPrompt, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setInputText(t('assistant.prompts.explore.opportunities'))}
            >
              <Text style={[styles.quickPromptText, { color: colors.text }]}>
                {t('assistant.prompts.explore.opportunities')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickPrompt, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setInputText(t('assistant.prompts.explore.communities'))}
            >
              <Text style={[styles.quickPromptText, { color: colors.text }]}>
                {t('assistant.prompts.explore.communities')}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.quickPrompt, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setInputText('Je veux apprendre React Native')}
            >
              <Text style={[styles.quickPromptText, { color: colors.text }]}>
                Je veux apprendre React Native
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickPrompt, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setInputText('Évalue mon niveau en JavaScript')}
            >
              <Text style={[styles.quickPromptText, { color: colors.text }]}>
                Évalue mon niveau en JavaScript
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );

  const renderMessages = () => (
    <ScrollView
      ref={scrollViewRef}
      style={styles.messagesContainer}
      contentContainerStyle={styles.messagesContent}
      showsVerticalScrollIndicator={false}
    >
      {messages.map((message) => (
        <View key={message.id} style={styles.messageWrapper}>
          {/* Message bubble */}
          <View
            style={[
              styles.messageBubble,
              message.role === 'user'
                ? [styles.userMessage, { backgroundColor: colors.primary }]
                : [styles.assistantMessage, { backgroundColor: colors.surface, borderColor: colors.border }],
            ]}
          >
            <Text
              style={[
                styles.messageText,
                { color: message.role === 'user' ? colors.textOnPrimary : colors.text },
              ]}
            >
              {message.content}
            </Text>
          </View>

          {/* Output renderer for assistant messages with structured data */}
          {message.role === 'assistant' && message.outputType && message.outputData && (
            <CopilotOutputRenderer
              outputType={message.outputType}
              outputData={message.outputData}
            />
          )}
        </View>
      ))}

      {/* Sending indicator with thinking animation */}
      {isSending && (
        <View style={styles.thinkingContainer}>
          <ThinkingIndicator
            message={activeMode === 'study' ? 'Préparation du contenu' : 'Recherche en cours'}
          />
          {activeToolExecutions.length > 0 && (
            <ToolExecutionTimeline tools={activeToolExecutions} showDetails />
          )}
        </View>
      )}
    </ScrollView>
  );

  const renderHistoryPanel = () => (
    <View style={[styles.historyPanel, { backgroundColor: colors.background }]}>
      <View style={[styles.historyHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.historyTitle, { color: colors.text }]}>Historique</Text>
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
                { borderBottomColor: colors.border },
                session.id === sessionId && { backgroundColor: colors.primary + '10' },
              ]}
              onPress={() => handleSelectSession(session)}
            >
              <View style={styles.historyItemContent}>
                <View
                  style={[
                    styles.historyModeBadge,
                    { backgroundColor: MODE_COLORS[session.mode as Mode]?.bg || colors.surface },
                  ]}
                >
                  {session.mode === 'explore' ? (
                    <Compass size={14} color={MODE_COLORS.explore.text} />
                  ) : (
                    <BookOpen size={14} color={MODE_COLORS.study.text} />
                  )}
                </View>
                <View style={styles.historyItemText}>
                  <Text style={[styles.historyItemTitle, { color: colors.text }]} numberOfLines={1}>
                    {session.title || 'Nouvelle conversation'}
                  </Text>
                  <Text style={[styles.historyItemMeta, { color: colors.textSecondary }]}>
                    {session.messageCount} messages
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.historyItemDelete}
                onPress={() => handleDeleteSession(session.id)}
              >
                <X size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
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
              <View style={[styles.errorBanner, { backgroundColor: colors.error + '15' }]}>
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
                <ThinkingIndicator message="Chargement de la conversation" />
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
                {/* Row 1: TextInput + Mic + Send */}
                <View style={styles.inputRow}>
                  <TextInput
                    ref={inputRef}
                    style={[styles.input, { color: colors.textPrimary }]}
                    placeholder={t('assistant.inputPlaceholder')}
                    placeholderTextColor={colors.gray500}
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                    maxLength={500}
                    editable={!isSending}
                  />

                  <TouchableOpacity style={styles.inputAction} activeOpacity={0.8}>
                    <Mic size={ICON.size.md} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      { backgroundColor: colors.primary },
                      (!inputText.trim() || isSending) && { backgroundColor: colors.gray200 },
                    ]}
                    onPress={handleSend}
                    disabled={!inputText.trim() || isSending}
                    activeOpacity={0.8}
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color={colors.gray400} />
                    ) : (
                      <SendHorizontal
                        size={ICON.size.md}
                        color={inputText.trim() ? colors.textOnPrimary : colors.gray400}
                        strokeWidth={ICON.strokeWidth}
                      />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Row 2: Actions */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.inputAction} activeOpacity={0.8}>
                    <Paperclip size={ICON.size.md} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.inputAction} activeOpacity={0.8}>
                    <Lightbulb size={ICON.size.md} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeToggle, { backgroundColor: MODE_COLORS[activeMode].bg }]}
                    onPress={handleToggleMode}
                    activeOpacity={0.8}
                  >
                    <ModeIcon
                      size={ICON.size.sm}
                      color={MODE_COLORS[activeMode].text}
                      strokeWidth={ICON.strokeWidth}
                    />
                    <Text style={[styles.modeToggleText, { color: MODE_COLORS[activeMode].text }]}>
                      {currentMode?.label}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* History Panel (overlay) */}
            {showHistory && renderHistoryPanel()}
          </View>
        </TouchableWithoutFeedback>
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
    ...TYPOGRAPHY.caption,
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
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },

  assistantIcon: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    borderRadius: BORDER.radius.lg,
  },

  greeting: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },

  userName: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
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
    ...TYPOGRAPHY.body,
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

  messageBubble: {
    maxWidth: '85%',
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
  },

  userMessage: {
    alignSelf: 'flex-end',
  },

  assistantMessage: {
    alignSelf: 'flex-start',
    borderWidth: 1,
  },

  messageText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.normal,
  },

  typingText: {
    ...TYPOGRAPHY.caption,
    marginLeft: SPACING.sm,
  },

  thinkingContainer: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    gap: SPACING.sm,
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
    ...TYPOGRAPHY.h3,
  },

  historyList: {
    flex: 1,
  },

  historyEmpty: {
    ...TYPOGRAPHY.body,
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
    ...TYPOGRAPHY.body,
    fontWeight: '500',
  },

  historyItemMeta: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },

  historyItemDelete: {
    padding: SPACING.sm,
  },
});
