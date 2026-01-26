/**
 * Invitations Screen
 * Shows pending organization AND community invitations for the current user
 * Uses tabs to switch between the two types
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Building2,
  Check,
  X,
  Clock,
  Users,
  Mail,
  Lock,
  Globe,
  CreditCard,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { invitationService, ReceivedInvitation } from '../../src/services/invitationService';
import { 
  communityInvitationService, 
  CommunityInvitation 
} from '../../src/services/communityInvitationService';
import { ORGANIZATION_ROLE_LABELS, VISIBILITY_LABELS } from '../../src/types/models';
import { getFullImageUrl } from '../../src/utils/image';

type TabType = 'organizations' | 'communities';

export default function InvitationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<TabType>('communities');
  
  // Organization invitations
  const [orgInvitations, setOrgInvitations] = useState<ReceivedInvitation[]>([]);
  const [orgLoading, setOrgLoading] = useState(true);
  
  // Community invitations
  const [communityInvitations, setCommunityInvitations] = useState<CommunityInvitation[]>([]);
  const [communityLoading, setCommunityLoading] = useState(true);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchOrgInvitations = useCallback(async () => {
    try {
      const response = await invitationService.getReceivedInvitations();
      if (response.data) {
        setOrgInvitations(response.data);
      }
    } catch (error) {
      console.error('Error fetching org invitations:', error);
    } finally {
      setOrgLoading(false);
    }
  }, []);

  const fetchCommunityInvitations = useCallback(async () => {
    try {
      const response = await communityInvitationService.getMyInvitations({ status: 'PENDING' });
      if (response.data?.data) {
        setCommunityInvitations(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching community invitations:', error);
    } finally {
      setCommunityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgInvitations();
    fetchCommunityInvitations();
  }, [fetchOrgInvitations, fetchCommunityInvitations]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    Promise.all([fetchOrgInvitations(), fetchCommunityInvitations()])
      .finally(() => setIsRefreshing(false));
  };

  // Organization invitation handlers
  const handleAcceptOrg = async (invitation: ReceivedInvitation) => {
    setProcessingId(invitation.id);
    try {
      const response = await invitationService.acceptInvitation(invitation.id);
      if (response.success) {
        Alert.alert(
          'Invitation acceptée',
          `Vous êtes maintenant membre de ${invitation.organization_name}`,
          [{ text: 'OK' }]
        );
        setOrgInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'accepter l\'invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineOrg = async (invitation: ReceivedInvitation) => {
    Alert.alert(
      'Refuser l\'invitation',
      `Voulez-vous vraiment refuser l'invitation de ${invitation.organization_name}?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(invitation.id);
            try {
              await invitationService.declineInvitation(invitation.id);
              setOrgInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de refuser l\'invitation');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  // Community invitation handlers
  const handleAcceptCommunity = async (invitation: CommunityInvitation) => {
    setProcessingId(invitation.id);
    try {
      const response = await communityInvitationService.acceptInvitation(invitation.id);
      if (response.data?.requires_payment) {
        // Redirect to payment flow
        Alert.alert(
          'Abonnement requis',
          `Cette communauté nécessite un abonnement de ${response.data.monthly_price} ${response.data.currency}/mois.`,
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Continuer',
              onPress: () => {
                router.push(`/details/community/join/${response.data?.community_id}` as any);
              },
            },
          ]
        );
      } else if (response.data?.success) {
        Alert.alert(
          'Bienvenue !',
          response.data.message || `Vous avez rejoint la communauté !`,
          [
            {
              text: 'Voir la communauté',
              onPress: () => router.push(`/details/community/${response.data?.community_id}` as any),
            },
            { text: 'OK' },
          ]
        );
        setCommunityInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'accepter l\'invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineCommunity = async (invitation: CommunityInvitation) => {
    Alert.alert(
      'Refuser l\'invitation',
      `Voulez-vous vraiment refuser l'invitation à rejoindre "${invitation.community_name}"?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(invitation.id);
            try {
              await communityInvitationService.declineInvitation(invitation.id);
              setCommunityInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de refuser l\'invitation');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getExpiresIn = (dateString: string) => {
    const expires = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Expirée';
    if (diffDays === 1) return 'Expire demain';
    return `Expire dans ${diffDays} jours`;
  };

  const isLoading = activeTab === 'organizations' ? orgLoading : communityLoading;
  const invitations = activeTab === 'organizations' ? orgInvitations : communityInvitations;
  const totalPending = orgInvitations.length + communityInvitations.length;

  const renderOrgInvitationCard = (invitation: ReceivedInvitation) => {
    const isProcessing = processingId === invitation.id;
    const roleLabel = ORGANIZATION_ROLE_LABELS[invitation.role] || invitation.role;

    return (
      <View
        key={invitation.id}
        style={[styles.invitationCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      >
        {/* Organization Info */}
        <View style={styles.cardHeader}>
          {invitation.organization_logo ? (
            <Image
              source={{ uri: getFullImageUrl(invitation.organization_logo) || '' }}
              style={styles.cardLogo}
            />
          ) : (
            <View style={[styles.cardLogoPlaceholder, { backgroundColor: colors.primary + '15' }]}>
              <Building2 size={24} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.textPrimary }]}>
              {invitation.organization_name}
            </Text>
            {invitation.organization_type && (
              <Text style={[styles.cardSubtext, { color: colors.textSecondary }]}>
                {invitation.organization_type}
              </Text>
            )}
          </View>
          <View style={[styles.typeBadge, { backgroundColor: colors.info + '15' }]}>
            <Building2 size={12} color={colors.info} />
            <Text style={[styles.typeBadgeText, { color: colors.info }]}>Organisation</Text>
          </View>
        </View>

        {/* Details */}
        <View style={[styles.detailsSection, { borderTopColor: colors.borderColor }]}>
          <View style={styles.detailRow}>
            <Users size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.detailText, { color: colors.textPrimary }]}>
              Rôle: <Text style={{ fontWeight: '600' }}>{roleLabel}</Text>
            </Text>
          </View>

          {invitation.invited_by_name && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                Invité par {invitation.invited_by_name}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Clock size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {getExpiresIn(invitation.expires_at)}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.declineButton, { borderColor: colors.error }]}
            onPress={() => handleDeclineOrg(invitation)}
            disabled={isProcessing}
          >
            <X size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.declineText, { color: colors.error }]}>Refuser</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: colors.primary }]}
            onPress={() => handleAcceptOrg(invitation)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Check size={18} color={COLORS.white} strokeWidth={ICON.strokeWidth} />
                <Text style={styles.acceptText}>Accepter</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCommunityInvitationCard = (invitation: CommunityInvitation) => {
    const isProcessing = processingId === invitation.id;
    const isPrivate = invitation.access_type === 'PRIVATE' || invitation.access_type === 'MEMBERSHIP';
    const visibilityLabel = VISIBILITY_LABELS[invitation.access_type as keyof typeof VISIBILITY_LABELS] || invitation.access_type;

    return (
      <View
        key={invitation.id}
        style={[styles.invitationCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      >
        {/* Community Info */}
        <View style={styles.cardHeader}>
          {invitation.cover_image_url ? (
            <Image
              source={{ uri: getFullImageUrl(invitation.cover_image_url) || '' }}
              style={styles.cardLogo}
            />
          ) : (
            <View style={[styles.cardLogoPlaceholder, { backgroundColor: colors.primary + '15' }]}>
              <Users size={24} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.textPrimary }]}>
              {invitation.community_name}
            </Text>
            {invitation.organization?.name && (
              <Text style={[styles.cardSubtext, { color: colors.textSecondary }]}>
                par {invitation.organization.name}
              </Text>
            )}
          </View>
          <View style={[styles.typeBadge, { backgroundColor: colors.success + '15' }]}>
            <Users size={12} color={colors.success} />
            <Text style={[styles.typeBadgeText, { color: colors.success }]}>Communauté</Text>
          </View>
        </View>

        {/* Description */}
        {invitation.community_description && (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {invitation.community_description}
          </Text>
        )}

        {/* Custom message from inviter */}
        {invitation.message && (
          <View style={[styles.messageBox, { backgroundColor: colors.gray100 }]}>
            <Text style={[styles.messageLabel, { color: colors.textSecondary }]}>
              Message de {invitation.invited_by_name}:
            </Text>
            <Text style={[styles.messageText, { color: colors.textPrimary }]}>
              "{invitation.message}"
            </Text>
          </View>
        )}

        {/* Details */}
        <View style={[styles.detailsSection, { borderTopColor: colors.borderColor }]}>
          <View style={styles.detailsRow}>
            <View style={styles.detailRow}>
              {isPrivate ? (
                <Lock size={14} color={colors.warning} strokeWidth={ICON.strokeWidth} />
              ) : (
                <Globe size={14} color={colors.success} strokeWidth={ICON.strokeWidth} />
              )}
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {visibilityLabel}
              </Text>
            </View>

            {invitation.members_count !== undefined && (
              <View style={styles.detailRow}>
                <Users size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {invitation.members_count} membres
                </Text>
              </View>
            )}

            {invitation.is_paid && (
              <View style={styles.detailRow}>
                <CreditCard size={14} color={colors.warning} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.detailText, { color: colors.warning }]}>
                  {invitation.monthly_price} {invitation.currency}/mois
                </Text>
              </View>
            )}
          </View>

          <View style={styles.detailRow}>
            <Clock size={14} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {getExpiresIn(invitation.expires_at)}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.declineButton, { borderColor: colors.error }]}
            onPress={() => handleDeclineCommunity(invitation)}
            disabled={isProcessing}
          >
            <X size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.declineText, { color: colors.error }]}>Refuser</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: colors.primary }]}
            onPress={() => handleAcceptCommunity(invitation)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Check size={18} color={COLORS.white} strokeWidth={ICON.strokeWidth} />
                <Text style={styles.acceptText}>
                  {invitation.is_paid ? 'Rejoindre (payant)' : 'Accepter'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Invitations</Text>
        <View style={styles.backButton} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.borderColor }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'communities' && styles.tabActive]}
          onPress={() => setActiveTab('communities')}
        >
          <Users size={18} color={activeTab === 'communities' ? colors.primary : colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'communities' ? colors.primary : colors.textSecondary }
          ]}>
            Communautés
          </Text>
          {communityInvitations.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{communityInvitations.length}</Text>
            </View>
          )}
          {activeTab === 'communities' && (
            <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'organizations' && styles.tabActive]}
          onPress={() => setActiveTab('organizations')}
        >
          <Building2 size={18} color={activeTab === 'organizations' ? colors.primary : colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'organizations' ? colors.primary : colors.textSecondary }
          ]}>
            Organisations
          </Text>
          {orgInvitations.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{orgInvitations.length}</Text>
            </View>
          )}
          {activeTab === 'organizations' && (
            <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : invitations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Mail size={48} color={colors.gray300} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Aucune invitation
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {activeTab === 'communities' 
              ? 'Vous n\'avez pas d\'invitation à rejoindre une communauté'
              : 'Vous n\'avez pas d\'invitation à rejoindre une organisation'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          <Text style={[styles.sectionInfo, { color: colors.textSecondary }]}>
            {invitations.length} invitation{invitations.length > 1 ? 's' : ''} en attente
          </Text>

          {activeTab === 'organizations'
            ? orgInvitations.map(renderOrgInvitationCard)
            : communityInvitations.map(renderCommunityInvitationCard)
          }
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: BORDER.width.thin,
    marginHorizontal: SPACING.lg,
  },

  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    position: 'relative',
  },

  tabActive: {},

  tabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },

  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },

  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.lg,
  },

  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },

  sectionInfo: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.md,
  },

  invitationCard: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },

  cardLogo: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.sm,
  },

  cardLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardInfo: {
    flex: 1,
  },

  cardName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  cardSubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BORDER.radius.xs,
  },

  typeBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  description: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },

  messageBox: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },

  messageLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: 4,
  },

  messageText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontStyle: 'italic',
  },

  detailsSection: {
    padding: SPACING.md,
    borderTopWidth: BORDER.width.thin,
    gap: SPACING.sm,
  },

  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  detailText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  actions: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.md,
  },

  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
  },

  declineText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },

  acceptText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.white,
  },
});
