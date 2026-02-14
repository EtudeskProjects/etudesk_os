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
  Send,
  MessageCircle,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity, COMPONENT } from '../../../../src/constants/theme';
import { PageLayout, EmptyState } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { communityService } from '../../../../src/services';
import { formatRelativeTime } from '../../../../src/utils/date';
import type { Community } from '../../../../src/types/models';
import type { MemberStatus, CommunityMember } from '../../../../src/services/communityService';
import { useAlert } from '../../../../src/contexts/AlertContext';

// Status configuration - colors are set dynamically in component using theme colors
const getStatusConfig = (colors: any): Record<MemberStatus, { color: string; icon: typeof Clock; bgColor: string; label: string }> => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: withOpacity(colors.warning, OPACITY[15]), label: 'En attente' },
  ACTIVE: { color: colors.success, icon: CheckCircle2, bgColor: withOpacity(colors.success, OPACITY[15]), label: 'Actif' },
  REJECTED: { color: colors.error, icon: XCircle, bgColor: withOpacity(colors.error, OPACITY[15]), label: 'Refusé' },
  SUSPENDED: { color: colors.gray500, icon: XCircle, bgColor: withOpacity(colors.gray500, OPACITY[15]), label: 'Suspendu' },
});

type FilterStatus = 'all' | MemberStatus;

export default function CommunityMembersScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('PENDING');
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
      setMembers(membersResponse.data?.data || []);
      setStatusCounts(membersResponse.data?.statusCounts || {});
    } catch (error) {
      console.error('Error loading data:', error);
      void alerts.alert('Erreur', 'Impossible de charger les membres.');
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

  const handleUpdateStatus = async (membershipId: string, newStatus: MemberStatus) => {
    try {
      await communityService.updateMembershipStatus(membershipId, newStatus);
      setMembers((prev) =>
        prev.map((m) => (m.id === membershipId ? { ...m, status: newStatus } : m))
      );
      handleRefresh();
    } catch (error: any) {
      void alerts.alert('Erreur', error.error || 'Impossible de mettre à jour le statut.');
    }
  };

  const handleDeleteMember = (membershipId: string, memberName: string) => {
    void alerts.showAlert({ title: 'Supprimer le membre', message: `Êtes-vous sûr de vouloir supprimer ${memberName} ? Cette action permettra au membre de postuler à nouveau.`, buttons: [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityService.deleteMember(membershipId);
              setMembers((prev) => prev.filter((m) => m.id !== membershipId));
              void alerts.alert('Succès', 'Membre supprimé.');
            } catch (error: any) {
              void alerts.alert('Erreur', error.error || 'Impossible de supprimer le membre.');
            }
          },
        },
      ] });
  };

  const filteredMembers = members.filter((m) => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  const getInitials = (name?: string): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const STATUS_CONFIG = getStatusConfig(colors);

  const renderMemberItem = ({ item }: { item: CommunityMember }) => {
    const statusConfig = STATUS_CONFIG[item.status as MemberStatus] || STATUS_CONFIG.PENDING;
    const StatusIcon = statusConfig.icon;
    const talent = item.talent;
    const memberName = talent?.first_name && talent?.last_name
      ? `${talent.first_name} ${talent.last_name}`
      : talent?.display_name || 'Membre';

    return (
      <TouchableOpacity
        style={[styles.memberCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
        onPress={() => router.push(`/gestion/communities/members/details/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          {talent?.avatar_url || talent?.profile_picture_url ? (
            <Image source={{ uri: talent.avatar_url || talent.profile_picture_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[20]) }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {getInitials(memberName)}
              </Text>
            </View>
          )}

          <View style={styles.memberInfo}>
            <Text style={[styles.memberName, { color: colors.textPrimary }]} numberOfLines={1}>
              {memberName}
            </Text>
            <Text style={[styles.memberRole, { color: colors.gray500 }]} numberOfLines={1}>
              {talent?.current_role || talent?.bio || 'Membre'}
            </Text>
          </View>

          <ChevronRight size={20} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
        </View>

        <View style={styles.cardFooter}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <StatusIcon size={COMPONENT.pill.iconSize} color={statusConfig.color} strokeWidth={COMPONENT.pill.iconStrokeWidth} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>

          <View style={styles.cardMeta}>
            {item.rating && (
              <View style={styles.ratingBadge}>
                <Star size={12} color={colors.warning} fill={colors.warning} />
                <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                  {item.rating}
                </Text>
              </View>
            )}

            {(item.unread_messages || 0) > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <MessageCircle size={10} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.unreadText, { color: colors.textOnPrimary }]}>{item.unread_messages}</Text>
              </View>
            )}

            <Text style={[styles.appliedDate, { color: colors.gray500 }]}>
              {formatRelativeTime(item.created_at!)}
            </Text>
          </View>
        </View>

        {item.status === 'PENDING' && (
          <View style={[styles.quickActions, { borderTopColor: colors.borderColor }]}>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: withOpacity(colors.success, OPACITY[15]) }]}
              onPress={() => handleUpdateStatus(item.id, 'ACTIVE')}
            >
              <CheckCircle2 size={14} color={colors.success} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.quickActionText, { color: colors.success }]}>Accepter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: withOpacity(colors.error, OPACITY[15]) }]}
              onPress={() => handleUpdateStatus(item.id, 'REJECTED')}
            >
              <XCircle size={14} color={colors.error} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.quickActionText, { color: colors.error }]}>Refuser</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const localStatusCounts = (() => {
    const counts: Record<string, number> = { all: members.length };
    members.forEach((m) => {
      counts[m.status] = (counts[m.status] || 0) + 1;
    });
    return counts;
  })();

  const filterChips = [
    { key: 'all' as FilterStatus, label: 'Tous', count: localStatusCounts.all || 0 },
    { key: 'PENDING' as FilterStatus, label: 'En attente', count: localStatusCounts['PENDING'] || 0 },
    { key: 'ACTIVE' as FilterStatus, label: 'Actifs', count: localStatusCounts['ACTIVE'] || 0 },
    { key: 'REJECTED' as FilterStatus, label: 'Refusés', count: localStatusCounts['REJECTED'] || 0 },
    { key: 'SUSPENDED' as FilterStatus, label: 'Suspendus', count: localStatusCounts['SUSPENDED'] || 0 },
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
      <TouchableOpacity
        onPress={() => router.push(`/gestion/communities/invitations/${communityId}` as any)}
        style={styles.headerActionButton}
      >
        <Send size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.push(`/settings/organization/edit-community/${communityId}` as any)}
        style={styles.headerActionButton}
      >
        <Edit size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
      </TouchableOpacity>
    </View>
  );

  const emptySubtitle = filter === 'all'
    ? 'Cette communauté n\'a pas encore de membres.'
    : 'Aucun membre avec ce statut.';

  return (
    <PageLayout
      title="Membres"
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
    gap: COMPONENT.pill.gap,
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderWidth: BORDER.width.thin,
    borderRadius: COMPONENT.pill.borderRadius,
  },
  filterChipText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
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
    marginBottom: SPACING.md,
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

  memberInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.sm,
  },

  memberName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  memberRole: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMPONENT.pill.gap,
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
  },

  statusText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },

  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
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

  unreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER.radius.full,
  },

  unreadText: {
    fontSize: TYPOGRAPHY.fontSize.xs - 1,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  appliedDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  quickActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: BORDER.width.thin,
    borderTopColor: 'transparent',
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
