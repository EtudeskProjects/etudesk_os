import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Briefcase,
  Building2,
  MessageCircle,
  Trash2,
  FileText,
  MapPin,
  TrendingUp,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity, MATCH_COLORS } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { FooterNav } from '../../../src/components/ui';
import { ChatMessage, ChatInput } from '../../../src/components/chat';
import { useAuth } from '../../../src/contexts/AuthContext';
import { applicationService, applicationMessageService } from '../../../src/services';
import { formatRelativeTime } from '../../../src/utils/date';
import type { Application, ApplicationMessage, ApplicationStatus } from '../../../src/types/models';
import { APPLICATION_STATUS_LABELS, LOCATION_TYPE_LABELS } from '../../../src/types/models';

// Status configuration - Simplified to 4 statuses
// Colors will be resolved dynamically using theme colors
const getStatusConfig = (colors: any): Record<string, { color: string; icon: typeof Clock; bgColor: string }> => ({
  SUBMITTED: { color: colors.warning, icon: Clock, bgColor: withOpacity(colors.warning, OPACITY[15]) },
  IN_REVIEW: { color: colors.info, icon: Eye, bgColor: withOpacity(colors.info, OPACITY[15]) },
  ACCEPTED: { color: colors.success, icon: CheckCircle2, bgColor: withOpacity(colors.success, OPACITY[15]) },
  REJECTED: { color: colors.error, icon: XCircle, bgColor: withOpacity(colors.error, OPACITY[15]) },
});

// Match category config - Uses Luxe Africain design system colors
const MATCH_CATEGORY_CONFIG = {
  excellent: { label: 'Excellent match', color: MATCH_COLORS.excellent.color, bgColor: MATCH_COLORS.excellent.bgColor },
  good: { label: 'Bon match', color: MATCH_COLORS.good.color, bgColor: MATCH_COLORS.good.bgColor },
  average: { label: 'Match moyen', color: MATCH_COLORS.average.color, bgColor: MATCH_COLORS.average.bgColor },
  low: { label: 'Match faible', color: MATCH_COLORS.low.color, bgColor: MATCH_COLORS.low.bgColor },
};

type Tab = 'details' | 'messages';

export default function ApplicationDetailsScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [application, setApplication] = useState<Application | null>(null);
  const [messages, setMessages] = useState<ApplicationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(tab === 'messages' ? 'messages' : 'details');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Handle keyboard events for proper input positioning
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    loadApplication();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'messages' && application) {
      loadMessages();
    }
  }, [activeTab, application]);

  const loadApplication = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const response = await applicationService.getApplication(id);
      setApplication(response.data);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les détails de la candidature.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!application) return;

    setIsLoadingMessages(true);
    try {
      const response = await applicationMessageService.getMessages(application.id);
      setMessages(response.data || []);

      // Mark all as read
      await applicationMessageService.markAllAsRead(application.id);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async (data: {
    content: string;
    attachments?: { name: string; uri: string; type: string; size?: number }[];
    proposedDatetime?: string;
    datetimeType?: string;
  }) => {
    if (!application) return;

    setIsSending(true);
    try {
      const response = await applicationMessageService.sendMessage(application.id, {
        content: data.content,
        attachments: data.attachments?.map(a => ({
          name: a.name,
          url: a.uri, // In production, upload first and use returned URL
          type: a.type,
          size: a.size || 0,
        })),
        proposed_datetime: data.proposedDatetime,
        datetime_type: data.datetimeType as any,
      });

      setMessages((prev) => [...prev, response.data]);

      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Impossible d\'envoyer le message.');
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  const handleWithdraw = () => {
    Alert.alert(
      'Retirer ma candidature',
      'Êtes-vous sûr de vouloir retirer votre candidature ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await applicationService.withdraw(application!.id);
              Alert.alert('Candidature retirée', 'Votre candidature a été retirée avec succès.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error: any) {
              Alert.alert('Erreur', error.error || 'Impossible de retirer la candidature.');
            }
          },
        },
      ]
    );
  };

  const renderTab = (tab: Tab, label: string, icon: typeof Briefcase) => {
    const isActive = activeTab === tab;
    const Icon = icon;

    return (
      <TouchableOpacity
        style={[
          styles.tab,
          { borderBottomColor: isActive ? colors.primary : 'transparent' },
        ]}
        onPress={() => setActiveTab(tab)}
      >
        <Icon
          size={18}
          color={isActive ? colors.primary : colors.gray500}
          strokeWidth={ICON.strokeWidth}
        />
        <Text
          style={[
            styles.tabText,
            { color: isActive ? colors.primary : colors.gray500 },
            isActive && { fontWeight: TYPOGRAPHY.fontWeight.semibold },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderDetailsTab = () => {
    if (!application) return null;

    const statusConfig = getStatusConfig(colors)[application.status] || getStatusConfig(colors)['SUBMITTED'];
    const StatusIcon = statusConfig.icon;
    const opportunity = application.opportunity;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: statusConfig.bgColor }]}>
          <StatusIcon size={24} color={statusConfig.color} strokeWidth={ICON.strokeWidth} />
          <View style={styles.statusInfo}>
            <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
              {APPLICATION_STATUS_LABELS[application.status]}
            </Text>
            <Text style={[styles.statusDate, { color: colors.gray600 }]}>
              Postulé {formatRelativeTime(application.applied_at)}
            </Text>
          </View>
          {(application as any).matchCategory && MATCH_CATEGORY_CONFIG[(application as any).matchCategory as keyof typeof MATCH_CATEGORY_CONFIG] && (
            <View style={[styles.matchBadge, { backgroundColor: MATCH_CATEGORY_CONFIG[(application as any).matchCategory as keyof typeof MATCH_CATEGORY_CONFIG].bgColor }]}>
              <TrendingUp size={12} color={MATCH_CATEGORY_CONFIG[(application as any).matchCategory as keyof typeof MATCH_CATEGORY_CONFIG].color} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.matchBadgeText, { color: MATCH_CATEGORY_CONFIG[(application as any).matchCategory as keyof typeof MATCH_CATEGORY_CONFIG].color }]}>
                {MATCH_CATEGORY_CONFIG[(application as any).matchCategory as keyof typeof MATCH_CATEGORY_CONFIG].label}
              </Text>
            </View>
          )}
        </View>

        {/* Opportunity Info */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Opportunité</Text>
          <Text style={[styles.opportunityTitle, { color: colors.textPrimary }]}>
            {opportunity?.title}
          </Text>

          <View style={styles.opportunityDetails}>
            <View style={styles.detailRow}>
              <Building2 size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {opportunity?.organization?.name}
              </Text>
            </View>

            {opportunity?.location_type && (
              <View style={styles.detailRow}>
                <MapPin size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {LOCATION_TYPE_LABELS[opportunity.location_type]}
                  {opportunity.locations?.[0]?.city && ` - ${opportunity.locations[0].city}`}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.viewOpportunityButton, { borderColor: colors.primary }]}
            onPress={() => router.push(`/details/opportunity/${opportunity?.id}`)}
          >
            <Text style={[styles.viewOpportunityText, { color: colors.primary }]}>
              Voir l'opportunité
            </Text>
          </TouchableOpacity>
        </View>

        {/* Your Answers */}
        {application.answers && application.answers.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Vos réponses</Text>
            {application.answers.map((answer, index) => {
              const question = opportunity?.application_questions?.find((q) => q.id === answer.question_id);
              return (
                <View key={answer.question_id} style={styles.answerItem}>
                  <Text style={[styles.answerQuestion, { color: colors.gray500 }]}>
                    {question?.question || `Question ${index + 1}`}
                  </Text>
                  <Text style={[styles.answerText, { color: colors.textPrimary }]}>
                    {answer.answer}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* CV */}
        {application.resume_url && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>CV soumis</Text>
            <View style={styles.cvRow}>
              <FileText size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.cvText, { color: colors.textPrimary }]}>
                CV téléchargé
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        {application.status === 'SUBMITTED' && (
          <TouchableOpacity
            style={[styles.withdrawButton, { borderColor: colors.error }]}
            onPress={handleWithdraw}
          >
            <Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.withdrawText, { color: colors.error }]}>
              Retirer ma candidature
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  };

  const renderMessagesTab = () => {
    if (isLoadingMessages) {
      return (
        <View style={styles.loadingMessages}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    const canSendMessage = messages.length > 0;

    return (
      <View style={styles.messagesContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesList}
          contentContainerStyle={[
            styles.messagesContent,
            { paddingBottom: keyboardHeight > 0 ? SPACING.md : SPACING.lg },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (keyboardHeight > 0) {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }
          }}
        >
          {messages.length === 0 ? (
            <View style={styles.noMessages}>
              <MessageCircle size={48} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.noMessagesTitle, { color: colors.textPrimary }]}>
                Pas encore de messages
              </Text>
              <Text style={[styles.noMessagesText, { color: colors.gray500 }]}>
                L'organisation vous contactera si elle souhaite échanger avec vous.
              </Text>
            </View>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                content={message.content}
                isMe={message.sender_type === 'TALENT'}
                senderName={message.sender_type === 'ORGANIZATION' ? (message.sender_name || 'Organisation') : undefined}
                createdAt={message.created_at}
                proposedDatetime={message.proposed_datetime}
                attachments={message.attachments}
              />
            ))
          )}
        </ScrollView>

        {/* Message Input or Waiting Message */}
        {canSendMessage ? (
          <ChatInput
            onSend={handleSendMessage}
            isSending={isSending}
            placeholder="Écrivez votre message..."
            showDatetimeOption={true}
          />
        ) : (
          <View style={[styles.waitingMessage, { backgroundColor: colors.gray50, borderTopColor: colors.gray200 }]}>
            <Text style={[styles.waitingText, { color: colors.gray500 }]}>
              L'organisation doit vous contacter en premier
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
          Candidature non trouvée
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {application.opportunity?.title || 'Candidature'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: colors.gray200 }]}>
        {renderTab('details', 'Détails', Briefcase)}
        {renderTab('messages', 'Messages', MessageCircle)}
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {activeTab === 'details' ? renderDetailsTab() : renderMessagesTab()}
      </KeyboardAvoidingView>

      <FooterNav activeTab="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },

  errorText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
  },

  headerSpacer: {
    width: 40,
  },

  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: BORDER.width.thin,
  },

  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderBottomWidth: 2,
  },

  tabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  keyboardAvoidingView: {
    flex: 1,
  },

  tabContent: {
    flex: 1,
    padding: SPACING.lg,
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.md,
  },

  statusInfo: {
    flex: 1,
  },

  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BORDER.radius.full,
  },

  matchBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  statusLabel: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  statusDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  section: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    marginBottom: SPACING.md,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },

  opportunityTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.md,
  },

  opportunityDetails: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  detailText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  viewOpportunityButton: {
    padding: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
  },

  viewOpportunityText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  answerItem: {
    marginBottom: SPACING.md,
  },

  answerQuestion: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: 4,
  },

  answerText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  cvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  cvText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    marginTop: SPACING.md,
  },

  withdrawText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  bottomSpacer: {
    height: SPACING.xl,
  },

  // Messages
  messagesContainer: {
    flex: 1,
  },

  loadingMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  messagesList: {
    flex: 1,
  },

  messagesContent: {
    padding: SPACING.lg,
    flexGrow: 1,
  },

  noMessages: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    minHeight: 300,
  },

  noMessagesTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },

  noMessagesText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
  },

  // Waiting message when org hasn't contacted yet
  waitingMessage: {
    padding: SPACING.md,
    borderTopWidth: BORDER.width.thin,
    alignItems: 'center',
  },

  waitingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
