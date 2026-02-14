import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Inbox,
  Star,
  Edit,
  Users,
  UserX,
  UserPlus,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../../src/constants/theme';
import { PageLayout, EmptyState } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { communityService, CommunityMember, MemberStatus } from '../../../../src/services';
import { formatRelativeTime } from '../../../../src/utils/date';
import { getFullImageUrl } from '../../../../src/utils/image';
import type { Community } from '../../../../src/types/models';
import { useAlert } from '../../../../src/contexts/AlertContext';

// Status configuration - colors will be resolved dynamically using theme
const STATUS_CONFIG: Record<MemberStatus, { colorKey: 'warning' | 'success' | 'error' | 'gray500'; icon: typeof Clock; label: string }> = {
  PENDING: { colorKey: 'warning', icon: Clock, label: 'En attente' },
  ACTIVE: { colorKey: 'success', icon: CheckCircle2, label: 'Actif' },
  REJECTED: { colorKey: 'error', icon: XCircle, label: 'Refusé' },
  SUSPENDED: { colorKey: 'gray500', icon: UserX, label: 'Suspendu' },
};

type FilterStatus = 'all' | MemberStatus;

export default function CommunityMembersScreen() {
  const { id: communityId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const alerts = useAlert();

  useEffect(() => {
    loadData();
  }, [communityId]);

  const loadData = async () => {
    if (!communityId) return;

    setIsLoading(true);
    try {
      const [communityResponse, membersResponse] = await Promise.all([
        communityService.getById(communityId),
        communityService.getCommunityMembers(communityId),
      ]);

      setCommunity(communityResponse.data);
      // Backend returns { data: members[], count, statusCounts }
      setMembers(membersResponse.data?.data || []);
      setStatusCounts(membersResponse.data?.statusCounts || {});
    } catch (error: any) {
      console.error('Error loading data:', error);
      void alerts.alert('Erreur', error?.error || 'Impossible de charger les membres.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!communityId) return;

    setIsRefreshing(true);
    try {
      const response = await communityService.getCommunityMembers(communityId);
      setMembers(response.data?.data || []);
      setStatusCounts(response.data?.statusCounts || {});
    } catch (error) {
      console.error('Error refreshing members:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [communityId]);

  const handleUpdateStatus = async (membershipId: string, newStatus: MemberStatus, rejectionReason?: string) => {
    try {
      await communityService.updateMembershipStatus(membershipId, newStatus, rejectionReason);
      setMembers((prev) =>
        prev.map((m) => (m.id === membershipId ? { ...m, status: newStatus } : m))
      );
      // Update counts
      handleRefresh();
    } catch (error: any) {
      void alerts.alert('Erreur', error.error || 'Impossible de mettre à jour le statut.');
    }
  };

  const handleAccept = (membershipId: string) => {
    void alerts.showAlert({ title: 'Accepter la demande', message: 'Voulez-vous accepter cette demande d\'adhésion ?', buttons: [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          onPress: () => handleUpdateStatus(membershipId, 'ACTIVE'),
        },
      ] });
  };

  const handleReject = (membershipId: string) => {
    void (async () => {
      const reason = await alerts.prompt(
        'Refuser la demande',
        'Indiquez une raison (optionnel) :',
        { placeholder: 'Raison (optionnel)', confirmText: 'Refuser', cancelText: 'Annuler' }
      );
      if (reason === null) return;
      await handleUpdateStatus(membershipId, 'REJECTED', reason || undefined);
    })();
  };

  const handleDelete = (member: CommunityMember) => {
    void alerts.showAlert({ title: 'Supprimer le membre', message: `Êtes-vous sûr de vouloir supprimer ${member.talent?.display_name || 'ce membre'} ? Cette action permettra à la personne de postuler à nouveau.`, buttons: [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityService.deleteMember(member.id);
              setMembers((prev) => prev.filter((m) => m.id !== member.id));
              handleRefresh();
            } catch (error: any) {
              void alerts.alert('Erreur', error.error || 'Impossible de supprimer le membre.');
            }
          },
        },
      ] });
  };

  const handleEdit = () => {
    if (!communityId) return;
    router.push(`/settings/organization/edit-community/${communityId}` as any);
  };

  const handleInvite = () => {
    if (!communityId) return;
    router.push(`/settings/organization/community-members/invitations/${communityId}` as any);
  };

  const filteredMembers = members.filter((m) => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  const getLocalStatusCounts = () => {
    const counts: Record<string, number> = { all: members.length };
    members.forEach((m) => {
      counts[m.status] = (counts[m.status] || 0) + 1;
    });
    return counts;
  };

  const localStatusCounts = getLocalStatusCounts();

  const getInitials = (name?: string): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderMemberItem = ({ item }: { item: CommunityMember }) => {
    const talent = item.talent;

    return (
      <TouchableOpacity
        style={[styles.memberCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
        onPress={() => router.push(`/settings/organization/community-members/details/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          {/* Avatar */}
          {talent?.avatar_url || talent?.profile_picture_url ? (
            <Image
              source={{ uri: getFullImageUrl(talent.avatar_url || talent.profile_picture_url) || '' }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[20]) }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {getInitials(talent?.display_name || `${talent?.first_name} ${talent?.last_name}`)}
              </Text>
            </View>
          )}

          {/* Info */}
          <View style={styles.talentInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.talentName, { color: colors.textPrimary }]} numberOfLines={1}>
                {talent?.display_name || `${talent?.first_name} ${talent?.last_name}` || 'Membre'}
              </Text>
              {item.rating && (
                <View style={styles.ratingBadge}>
                  <Star size={12} color={colors.warning} fill={colors.warning} />
                  <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                    {item.rating}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.talentTitle, { color: colors.gray500 }]} numberOfLines={1}>
              {talent?.current_role || talent?.bio || talent?.email || ''}
            </Text>
            {(item.created_at || item.joined_at) && (
              <Text style={[styles.appliedDate, { color: colors.gray400 }]}>
                {formatRelativeTime(item.created_at || item.joined_at!)}
              </Text>
            )}
          </View>

          <ChevronRight size={20} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
        </View>

        {/* Quick actions for pending */}
        {item.status === 'PENDING' && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: withOpacity(colors.success, OPACITY[15]) }]}
              onPress={() => handleAccept(item.id)}
            >
              <CheckCircle2 size={14} color={colors.success} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.quickActionText, { color: colors.success }]}>Accepter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: withOpacity(colors.error, OPACITY[15]) }]}
              onPress={() => handleReject(item.id)}
            >
              <XCircle size={14} color={colors.error} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.quickActionText, { color: colors.error }]}>Refuser</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const emptySubtitle = filter === 'all'
    ? 'Cette communauté n\'a pas encore de membres.'
    : filter === 'PENDING'
      ? 'Aucune demande en attente.'
      : 'Aucun membre avec ce statut.';

  const filterChips = [
    { key: 'all' as FilterStatus, label: 'Tous', count: localStatusCounts.all || 0 },
    { key: 'PENDING' as FilterStatus, label: 'En attente', count: localStatusCounts['PENDING'] || 0 },
    { key: 'ACTIVE' as FilterStatus, label: 'Actifs', count: localStatusCounts['ACTIVE'] || 0 },
    { key: 'REJECTED' as FilterStatus, label: 'Refusés', count: localStatusCounts['REJECTED'] || 0 },
  ];

  const headerContent = (
    <View style={[styles.filtersContainer, { borderBottomColor: colors.gray200 }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContent}
      >
        {filterChips.map((chip) => {
          const isActive = filter === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.filterChip,
                { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setFilter(chip.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.gray700 },
                  isActive && { color: colors.textOnPrimary },
                ]}
              >
                {chip.label} ({chip.count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const rightAction = (
    <View style={styles.headerActions}>
      <TouchableOpacity onPress={handleInvite} style={styles.headerActionButton}>
        <UserPlus size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
      </TouchableOpacity>
      <TouchableOpacity onPress={handleEdit} style={styles.headerActionButton}>
        <Edit size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
      </TouchableOpacity>
    </View>
  );

  return (
    <PageLayout
      title="Gestion des adhésions"
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isLoading={isLoading}
      headerContent={headerContent}
      rightAction={rightAction}
    >
      {filteredMembers.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filter === 'all' ? 'Aucun membre' : 'Aucun résultat'}
          subtitle={emptySubtitle}
        />
      ) : (
        filteredMembers.map((item) => (
          <View key={item.id} style={styles.cardWrapper}>
            {renderMemberItem({ item })}
          </View>
        ))
      )}
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  filtersContainer: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.width.thin,
  },
  filtersContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.full,
  },
  filterChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrapper: {
    marginBottom: SPACING.md,
  },

  memberCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },

  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  talentInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.sm,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  talentName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    flexShrink: 1,
  },

  talentTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  ratingText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  appliedDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  quickActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },

  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },

  quickActionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

});
