import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Building2,
  MessageCircle,
  Trash2,
  MapPin,
  LogOut,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { Button, FooterNav, IconButton, LoadingShimmer, SelectCard } from '../../../src/components/ui';
import { ChatMessage, ChatInput } from '../../../src/components/chat';
import { useAuth } from '../../../src/contexts/AuthContext';
import { communityService, communityMembershipMessageService } from '../../../src/services';
import { formatRelativeTime } from '../../../src/utils/date';
import { formatNumberNoTrailingZeros } from '../../../src/utils/number';
import type { Community } from '../../../src/types/models';
import type { MemberStatus } from '../../../src/services/communityService';
import type { MembershipMessage } from '../../../src/services/communityMembershipMessageService';
import { useAlert } from '../../../src/contexts/AlertContext';

// Status configuration - returns config based on theme colors
const getStatusConfig = (colors: any): Record<MemberStatus, { color: string; icon: typeof Clock; bgColor: string; label: string }> => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: withOpacity(colors.warning, OPACITY[15]), label: 'En attente' },
  ACTIVE: { color: colors.success, icon: CheckCircle2, bgColor: withOpacity(colors.success, OPACITY[15]), label: 'Active' },
  REJECTED: { color: colors.error, icon: XCircle, bgColor: withOpacity(colors.error, OPACITY[15]), label: 'Refusée' },
  SUSPENDED: { color: colors.gray500, icon: XCircle, bgColor: withOpacity(colors.gray500, OPACITY[15]), label: 'Suspendu' },
});

interface MembershipWithDetails {
  id: string;
  community_id?: string;
  talent_id?: string;
  role: 'ADMIN' | 'MEMBER';
  status: MemberStatus;
  joined_at?: string;
  created_at?: string;
  updated_at?: string;
  answers?: Array<{ question: string; answer: string }>;
  rejection_reason?: string;
  community?: Community;
}

type Tab = 'details' | 'messages';

export default function MyCommunityDetailsScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [membership, setMembership] = useState<MembershipWithDetails | null>(null);
  const [messages, setMessages] = useState<MembershipMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(tab === 'messages' ? 'messages' : 'details');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const alerts = useAlert();

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
    loadMembership();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'messages' && membership) {
      loadMessages();
    }
  }, [activeTab, membership]);

  const loadMembership = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      // Get all memberships and find the one with this ID
      const response = await communityService.getMyMemberships();
      const found = response.data?.memberships?.find((m: any) => m.id === id);

      if (found) {
        setMembership(found);
      } else {
        void alerts.alert('Erreur', 'Adhésion non trouvée.');
        router.back();
      }
    } catch (error) {
      void alerts.alert('Erreur', 'Impossible de charger les détails de l\'adhésion.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!membership) return;

    setIsLoadingMessages(true);
    try {
      const response = await communityMembershipMessageService.getMessages(membership.id);
      setMessages(response.data || []);
      try {
        await communityMembershipMessageService.markAllAsRead(membership.id);
      } catch (_) {
        // ignore (e.g. endpoint not available)
      }
    } catch (error: any) {
      if (error?.status !== 404) {
        if (__DEV__) console.error('Error loading messages:', error);
      }
      setMessages([]);
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
    if (!membership) return;

    setIsSending(true);
    try {
      const response = await communityMembershipMessageService.sendMessage(membership.id, {
        content: data.content,
        attachments: data.attachments?.map(a => ({
          name: a.name,
          url: a.uri,
          type: a.type,
          size: a.size,
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
      void alerts.alert('Erreur', error.error || 'Impossible d\'envoyer le message.');
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  const handleLeaveCommunity = () => {
    if (!membership?.community) return;

    void alerts.showAlert({ title: 'Quitter la communauté', message: `Êtes-vous sûr de vouloir quitter "${membership.community.name}" ?`, buttons: [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityService.leave(membership.community_id!);
              void alerts.showAlert({ title: 'Succès', message: 'Vous avez quitté la communauté.', buttons: [
                { text: 'OK', onPress: () => router.back() },
              ] });
            } catch (error: any) {
              void alerts.alert('Erreur', error.error || 'Impossible de quitter la communauté.');
            }
          },
        },
      ] });
  };

  const renderTab = (tab: Tab, label: string, icon: typeof Users) => {
    const isActive = activeTab === tab;
    const Icon = icon;

    return (
      <SelectCard
        style={[
          styles.tab,
          { borderBottomColor: isActive ? colors.primary : 'transparent' },
          { borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0 },
        ]}
        onPress={() => setActiveTab(tab)}
        selected={false}
        accessibilityLabel={label}
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
      </SelectCard>
    );
  };

  const renderDetailsTab = () => {
    if (!membership) return null;

    const STATUS_CONFIG = getStatusConfig(colors);
    const statusConfig = STATUS_CONFIG[membership.status as MemberStatus] || STATUS_CONFIG.PENDING;
    const StatusIcon = statusConfig.icon;
    const community = membership.community;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: statusConfig.bgColor }]}>
          <StatusIcon size={24} color={statusConfig.color} strokeWidth={ICON.strokeWidth} />
          <View style={styles.statusInfo}>
            <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
            <Text style={[styles.statusDate, { color: colors.gray600 }]}>
              {membership.status === 'ACTIVE' && membership.joined_at
                ? `Membre depuis ${formatRelativeTime(membership.joined_at)}`
                : `Demande envoyée ${formatRelativeTime(membership.created_at!)}`}
            </Text>
          </View>
        </View>

        {/* Community Info */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Communauté</Text>
          <Text style={[styles.communityTitle, { color: colors.textPrimary }]}>
            {community?.name}
          </Text>

          {community?.description && (
            <Text style={[styles.communityDescription, { color: colors.textSecondary }]}>
              {community.description}
            </Text>
          )}

          <View style={styles.communityDetails}>
            {community?.type && (
              <View style={styles.detailRow}>
                <Building2 size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {community.type}
                </Text>
              </View>
            )}

            {(community?.city || community?.country) && (
              <View style={styles.detailRow}>
                <MapPin size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {[community.city, community.country].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}

            {community?.members_count !== undefined && (
              <View style={styles.detailRow}>
                <Users size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {formatNumberNoTrailingZeros(community.members_count, 0)} membres
                </Text>
              </View>
            )}
          </View>

          <Button
            title="Voir la communauté"
            onPress={() => router.push(`/details/community/${community?.id}`)}
            variant="outline"
            fullWidth
            style={[styles.viewCommunityButton, { borderColor: colors.primary, backgroundColor: 'transparent' }]}
            textStyle={[styles.viewCommunityText, { color: colors.primary }]}
          />
        </View>

        {/* Rejection reason if rejected */}
        {membership.status === 'REJECTED' && membership.rejection_reason && (
          <View style={[styles.section, { backgroundColor: withOpacity(colors.error, OPACITY[10]), borderColor: withOpacity(colors.error, OPACITY[30]) }]}>
            <Text style={[styles.sectionTitle, { color: colors.error }]}>Raison du refus</Text>
            <Text style={[styles.rejectionReason, { color: colors.textPrimary }]}>
              {membership.rejection_reason}
            </Text>
          </View>
        )}

        {/* Your Answers */}
        {membership.answers && Array.isArray(membership.answers) && membership.answers.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Vos réponses</Text>
            {membership.answers.map((answer: any, index: number) => (
              <View key={index} style={styles.answerItem}>
                <Text style={[styles.answerQuestion, { color: colors.gray500 }]}>
                  {answer.question}
                </Text>
                <Text style={[styles.answerText, { color: colors.textPrimary }]}>
                  {answer.answer}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        {membership.status === 'ACTIVE' && (
          <Button
            title="Quitter la communauté"
            onPress={handleLeaveCommunity}
            variant="ghost"
            fullWidth
            icon={<LogOut size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />}
            style={styles.leaveButton}
            textStyle={[styles.leaveText, { color: colors.error }]}
          />
        )}

        {membership.status === 'PENDING' && (
          <Button
            title="Annuler ma demande"
            onPress={handleLeaveCommunity}
            variant="ghost"
            fullWidth
            icon={<Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />}
            style={styles.leaveButton}
            textStyle={[styles.leaveText, { color: colors.error }]}
          />
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  };

  const renderMessagesTab = () => {
    if (isLoadingMessages) {
      return (
        <View style={styles.loadingMessages}>
          <LoadingShimmer variant="fullPage" />
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
        <LoadingShimmer variant="fullPage" />
      </SafeAreaView>
    );
  }

  if (!membership) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
          Adhésion non trouvée
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel="Retour"
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {membership.community?.name || 'Communauté'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: colors.gray200 }]}>
        {renderTab('details', 'Détails', Users)}
        {renderTab('messages', 'Messages', MessageCircle)}
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

  communityTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },

  communityDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },

  communityDetails: {
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

  viewCommunityButton: {
    padding: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
  },

  viewCommunityText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  rejectionReason: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
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

  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.md,
  },

  leaveText: {
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

  waitingMessage: {
    padding: SPACING.md,
    borderTopWidth: BORDER.width.thin,
    alignItems: 'center',
  },

  waitingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
