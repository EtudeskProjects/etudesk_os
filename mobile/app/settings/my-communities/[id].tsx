import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
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
  Trash2,
  MapPin,
  LogOut,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { FooterNav } from '../../../src/components/ui';
import { useAuth } from '../../../src/contexts/AuthContext';
import { communityService } from '../../../src/services';
import { formatRelativeTime } from '../../../src/utils/date';
import type { Community } from '../../../src/types/models';
import type { MemberStatus } from '../../../src/services/communityService';

// Status configuration - returns config based on theme colors
const getStatusConfig = (colors: any): Record<MemberStatus, { color: string; icon: typeof Clock; bgColor: string; label: string }> => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: colors.warning + '15', label: 'En attente' },
  ACTIVE: { color: colors.success, icon: CheckCircle2, bgColor: colors.success + '15', label: 'Membre actif' },
  REJECTED: { color: colors.error, icon: XCircle, bgColor: colors.error + '15', label: 'Refusée' },
  SUSPENDED: { color: colors.gray500, icon: XCircle, bgColor: colors.gray500 + '15', label: 'Suspendu' },
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

export default function MyCommunityDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [membership, setMembership] = useState<MembershipWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMembership();
  }, [id]);

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
        Alert.alert('Erreur', 'Adhésion non trouvée.');
        router.back();
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les détails de l\'adhésion.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveCommunity = () => {
    if (!membership?.community) return;

    Alert.alert(
      'Quitter la communauté',
      `Êtes-vous sûr de vouloir quitter "${membership.community.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityService.leave(membership.community_id);
              Alert.alert('Succès', 'Vous avez quitté la communauté.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error: any) {
              Alert.alert('Erreur', error.error || 'Impossible de quitter la communauté.');
            }
          },
        },
      ]
    );
  };

  const renderDetails = () => {
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
                : `Demande envoyée ${formatRelativeTime(membership.created_at)}`}
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
                  {community.members_count} membres
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.viewCommunityButton, { borderColor: colors.primary }]}
            onPress={() => router.push(`/details/community/${community?.id}`)}
          >
            <Text style={[styles.viewCommunityText, { color: colors.primary }]}>
              Voir la communauté
            </Text>
          </TouchableOpacity>
        </View>

        {/* Rejection reason if rejected */}
        {membership.status === 'REJECTED' && membership.rejection_reason && (
          <View style={[styles.section, { backgroundColor: colors.error + '10', borderColor: colors.error + '30' }]}>
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
          <TouchableOpacity
            style={[styles.leaveButton, { borderColor: colors.error }]}
            onPress={handleLeaveCommunity}
          >
            <LogOut size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.leaveText, { color: colors.error }]}>
              Quitter la communauté
            </Text>
          </TouchableOpacity>
        )}

        {membership.status === 'PENDING' && (
          <TouchableOpacity
            style={[styles.leaveButton, { borderColor: colors.error }]}
            onPress={handleLeaveCommunity}
          >
            <Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.leaveText, { color: colors.error }]}>
              Annuler ma demande
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {membership.community?.name || 'Communauté'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {renderDetails()}

      <FooterNav activeTab="settings" />
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
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
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
