import { useState, useEffect, useRef } from 'react';
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
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
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/contexts/I18nContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { Header, FooterNav } from '../../../src/components/ui';

type Mode = 'explore' | 'study';

const MODE_COLORS = {
  explore: { bg: '#F5F5F5', text: '#757575' },    // Gris clair
  study: { bg: '#EDE7F6', text: '#7E57C2' },      // Violet
};

// Mode icons mapping (labels come from i18n)
const MODE_ICONS = {
  explore: Compass,
  study: BookOpen,
};

interface Message {
  id: number;
  type: 'user' | 'assistant';
  content: string;
}

export default function AssistantScreen() {
  const { mode, prompt, focusInput } = useLocalSearchParams<{ mode?: string; prompt?: string; focusInput?: string }>();
  const [activeMode, setActiveMode] = useState<Mode>('explore');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const { colors } = useTheme();
  const { t } = useI18n();
  const { isOrganizationSpace } = useSpace();
  const inputRef = useRef<TextInput>(null);

  // Build modes with translated labels - filter out 'study' mode for organizations
  const ALL_MODES = [
    { id: 'explore' as Mode, label: t('assistant.modes.explore'), icon: MODE_ICONS.explore },
    { id: 'study' as Mode, label: t('assistant.modes.study'), icon: MODE_ICONS.study },
  ];

  const MODES = isOrganizationSpace
    ? ALL_MODES.filter(m => m.id !== 'study')
    : ALL_MODES;

  // Set initial mode from URL parameter (prevent study mode for organizations)
  useEffect(() => {
    if (mode && (mode === 'explore' || mode === 'study')) {
      // Organizations cannot access study mode
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
    // Focus the input when prompt is passed or focusInput is true
    if (prompt || focusInput === 'true') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [prompt, focusInput]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      type: 'user',
      content: inputText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');

    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: Date.now() + 1,
        type: 'assistant',
        content: 'Je suis en train d\'analyser ta demande. Cette fonctionnalite sera bientot disponible.',
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 1000);
  };

  const handleToggleMode = () => {
    const currentIndex = MODES.findIndex((m) => m.id === activeMode);
    const nextIndex = (currentIndex + 1) % MODES.length;
    setActiveMode(MODES[nextIndex].id);
  };

  const currentMode = MODES.find((m) => m.id === activeMode);
  const ModeIcon = currentMode?.icon || Compass;

  const renderEmptyState = () => (
    <ScrollView
      style={styles.emptyStateScroll}
      contentContainerStyle={styles.emptyState}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.assistantIcon, { backgroundColor: colors.surface }]}>
        <Sparkles
          size={ICON.size.xl * 1.5}
          color={colors.primary}
          strokeWidth={ICON.strokeWidth}
        />
      </View>

      <Text style={[styles.greeting, { color: colors.textSecondary }]}>{t('assistant.greeting')}</Text>
      <Text style={[styles.userName, { color: colors.primary }]}>Lamine ?</Text>
    </ScrollView>
  );

  const renderMessages = () => (
    <ScrollView
      style={styles.messagesContainer}
      contentContainerStyle={styles.messagesContent}
      showsVerticalScrollIndicator={false}
    >
      {messages.map((message) => (
        <View
          key={message.id}
          style={[
            styles.messageBubble,
            message.type === 'user'
              ? [styles.userMessage, { backgroundColor: colors.primary }]
              : [styles.assistantMessage, { backgroundColor: colors.gray100 }],
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: message.type === 'user' ? colors.textOnPrimary : colors.textPrimary },
            ]}
          >
            {message.content}
          </Text>
        </View>
      ))}
    </ScrollView>
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
                  <TouchableOpacity style={styles.headerButton} activeOpacity={0.8}>
                    <History
                      size={ICON.size.md}
                      color={colors.textSecondary}
                      strokeWidth={ICON.strokeWidth}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.headerButton} activeOpacity={0.8}>
                    <Plus
                      size={ICON.size.md}
                      color={colors.textSecondary}
                      strokeWidth={ICON.strokeWidth}
                    />
                  </TouchableOpacity>
                </View>
              }
            />

            {/* Content */}
            <View style={styles.content}>
              {messages.length === 0 ? renderEmptyState() : renderMessages()}
            </View>

            {/* Input Area */}
            <View style={styles.inputArea}>
              <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
                {/* Ligne 1: TextInput + Mic + Send */}
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
                  />

                  <TouchableOpacity style={styles.inputAction} activeOpacity={0.8}>
                    <Mic
                      size={ICON.size.md}
                      color={colors.gray500}
                      strokeWidth={ICON.strokeWidth}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      { backgroundColor: colors.primary },
                      !inputText.trim() && { backgroundColor: colors.gray200 },
                    ]}
                    onPress={handleSend}
                    disabled={!inputText.trim()}
                    activeOpacity={0.8}
                  >
                    <SendHorizontal
                      size={ICON.size.md}
                      color={inputText.trim() ? colors.textOnPrimary : colors.gray400}
                      strokeWidth={ICON.strokeWidth}
                    />
                  </TouchableOpacity>
                </View>

                {/* Ligne 2: Actions */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.inputAction} activeOpacity={0.8}>
                    <Paperclip
                      size={ICON.size.md}
                      color={colors.gray500}
                      strokeWidth={ICON.strokeWidth}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.inputAction} activeOpacity={0.8}>
                    <Lightbulb
                      size={ICON.size.md}
                      color={colors.gray500}
                      strokeWidth={ICON.strokeWidth}
                    />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  headerLogo: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

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

  // Messages
  messagesContainer: {
    flex: 1,
  },

  messagesContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },

  messageBubble: {
    maxWidth: '85%',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: BORDER.radius.md,
  },

  userMessage: {
    alignSelf: 'flex-end',
  },

  assistantMessage: {
    alignSelf: 'flex-start',
  },

  messageText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.normal,
  },

  userMessageText: {},

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
});
