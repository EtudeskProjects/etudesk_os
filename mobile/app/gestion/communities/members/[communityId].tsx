import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Inbox,
  Star,
  Edit,
  Trash2,
  MessageCircle,
  Send,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../../src/constants/theme';
import { FooterNav } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { communityService } from '../../../../src/services';
import { formatRelativeTime } from '../../../../src/utils/date';
import type { Community } from '../../../../src/types/models';
import type { MemberStatus, CommunityMember } from '../../../../src/services/communityService';

// Status configuration - colors are set dynamically in component using theme colors
const getStatusConfig = (colors: any): Record<MemberStatus, { color: string; icon: typeof Clock; bgColor: string; label: string }> => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: colors.warning + '15', label: 'En attente' },
  ACTIVE: { color: colors.success, icon: CheckCircle2, bgColor: colors.success + '15', label: 'Actif' },
  REJECTED: { color: colors.error, icon: XCircle, bgColor: colors.error + '15', label: 'Refusé' },
  SUSPENDED: { color: colors.gray500, icon: XCircle, bgColor: colors.gray500 + '15', label: 'Suspendu' },
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
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

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
      Alert.alert('Erreur', 'Impossible de charger les membres.');
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
      // Update counts
      handleRefresh();
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Impossible de mettre à jour le statut.');
    }
  };

  const handleDeleteMember = (membershipId: string, memberName: string) => {
    Alert.alert(
      'Supprimer le membre',
      `Êtes-vous sûr de vouloir supprimer ${memberName} ? Cette action permettra au membre de postuler à nouveau.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityService.deleteMember(membershipId);
              setMembers((prev) => prev.filter((m) => m.id !== membershipId));
              Alert.alert('Succès', 'Membre supprimé.');
            } catch (error: any) {
              Alert.alert('Erreur', error.error || 'Impossible de supprimer le membre.');
            }
          },
        },
      ]
    );
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
          {/* Avatar */}
          {talent?.avatar_url || talent?.profile_picture_url ? (
            <Image source={{ uri: talent.avatar_url || talent.profile_picture_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {getInitials(memberName)}
              </Text>
            </View>
          )}

          {/* Info */}
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
            <StatusIcon size={14} color={statusConfig.color} strokeWidth={ICON.strokeWidth} />
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
                <Text style={styles.unreadText}>{item.unread_messages}</Text>
              </View>
            )}

            <Text style={[styles.appliedDate, { color: colors.gray500 }]}>
              {formatRelativeTime(item.created_at)}
            </Text>
          </View>
        </View>

        {/* Quick actions for pending */}
        {item.status === 'PENDING' && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: colors.success + '15' }]}
              onPress={() => handleUpdateStatus(item.id, 'ACTIVE')}
            >
              <CheckCircle2 size={14} color={colors.success} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.quickActionText, { color: colors.success }]}>Accepter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: colors.error + '15' }]}
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

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.gray100 }]}>
        <Inbox size={48} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        {filter === 'all' ? 'Aucun membre' : 'Aucun résultat'}
      </Text>
      <Text style={[styles.emptyDescription, { color: colors.gray500 }]}>
        {filter === 'all'
          ? 'Cette communauté n\'a pas encore de membres.'
          : 'Aucun membre avec ce statut.'}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
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
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            Membres
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.gray500 }]} numberOfLines={1}>
            {community?.name}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push(`/gestion/communities/invitations/${communityId}` as any)}
            style={[styles.actionButton, { backgroundColor: colors.primary + '15', marginRight: SPACING.xs }]}
          >
            <Send size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(`/settings/organization/edit-community/${communityId}` as any)}
            style={styles.actionButton}
          >
            <Edit size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'all' && { backgroundColor: colors.primary + '12', borderColor: colors.primary + '50' }
          ]}
          onPress={() => setFilter('all')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: filter === 'all' ? colors.primary : colors.textPrimary }]}>
            {members.length}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'all' ? colors.primary : colors.gray500 }]}>Total</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'PENDING' && { backgroundColor: colors.warning + '12', borderColor: colors.warning + '50' }
          ]}
          onPress={() => setFilter('PENDING')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: colors.warning }]}>
            {statusCounts['PENDING'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'PENDING' ? colors.warning : colors.gray500 }]}>En attente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'ACTIVE' && { backgroundColor: colors.success + '12', borderColor: colors.success + '50' }
          ]}
          onPress={() => setFilter('ACTIVE')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: colors.success }]}>
            {statusCounts['ACTIVE'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'ACTIVE' ? colors.success : colors.gray500 }]}>Actifs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'REJECTED' && { backgroundColor: colors.error + '12', borderColor: colors.error + '50' }
          ]}
          onPress={() => setFilter('REJECTED')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: colors.error }]}>
            {statusCounts['REJECTED'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'REJECTED' ? colors.error : colors.gray500 }]}>Refusés</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <FlatList
        data={filteredMembers}
        renderItem={renderMemberItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <FooterNav activeTab="gestion" />
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerContent: {
    flex: 1,
    marginHorizontal: SPACING.sm,
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  actionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statsContainer: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
  },

  statValue: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  listContent: {
    padding: SPACING.lg,
    flexGrow: 1,
  },

  separator: {
    height: SPACING.md,
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
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.full,
  },

  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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
    color: '#FFFFFF',
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
    borderTopColor: '#E5E7EB',
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

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    minHeight: 300,
  },

  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },

  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },

  emptyDescription: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
  },
});
