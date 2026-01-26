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
  Users,
  UserX,
  UserPlus,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../../src/constants/theme';
import { FooterNav } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { communityService, CommunityMember, MemberStatus } from '../../../../src/services';
import { formatRelativeTime } from '../../../../src/utils/date';
import { getFullImageUrl } from '../../../../src/utils/image';
import type { Community } from '../../../../src/types/models';

// Status configuration
const STATUS_CONFIG: Record<MemberStatus, { color: string; icon: typeof Clock; bgColor: string; label: string }> = {
  PENDING: { color: COLORS.warning, icon: Clock, bgColor: COLORS.warning + '15', label: 'En attente' },
  ACTIVE: { color: COLORS.success, icon: CheckCircle2, bgColor: COLORS.success + '15', label: 'Actif' },
  REJECTED: { color: COLORS.error, icon: XCircle, bgColor: COLORS.error + '15', label: 'Refusé' },
  SUSPENDED: { color: COLORS.gray500, icon: UserX, bgColor: COLORS.gray500 + '15', label: 'Suspendu' },
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
      setMembers(membersResponse.data || []);
      setStatusCounts(membersResponse.statusCounts || {});
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Erreur', error?.error || 'Impossible de charger les membres.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!communityId) return;

    setIsRefreshing(true);
    try {
      const response = await communityService.getCommunityMembers(communityId);
      setMembers(response.data || []);
      setStatusCounts(response.statusCounts || {});
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
      Alert.alert('Erreur', error.error || 'Impossible de mettre à jour le statut.');
    }
  };

  const handleAccept = (membershipId: string) => {
    Alert.alert(
      'Accepter la demande',
      'Voulez-vous accepter cette demande d\'adhésion ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          onPress: () => handleUpdateStatus(membershipId, 'ACTIVE'),
        },
      ]
    );
  };

  const handleReject = (membershipId: string) => {
    Alert.prompt(
      'Refuser la demande',
      'Indiquez une raison (optionnel) :',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: (reason) => handleUpdateStatus(membershipId, 'REJECTED', reason),
        },
      ],
      'plain-text'
    );
  };

  const handleDelete = (member: CommunityMember) => {
    Alert.alert(
      'Supprimer le membre',
      `Êtes-vous sûr de vouloir supprimer ${member.talent?.display_name || 'ce membre'} ? Cette action permettra à la personne de postuler à nouveau.`,
      [
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
              Alert.alert('Erreur', error.error || 'Impossible de supprimer le membre.');
            }
          },
        },
      ]
    );
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
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
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
                  <Star size={12} color={COLORS.warning} fill={COLORS.warning} />
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
              style={[styles.quickAction, { backgroundColor: colors.success + '15' }]}
              onPress={() => handleAccept(item.id)}
            >
              <CheckCircle2 size={14} color={colors.success} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.quickActionText, { color: colors.success }]}>Accepter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: colors.error + '15' }]}
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
          : filter === 'PENDING'
            ? 'Aucune demande en attente.'
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
            Gestion des adhésions
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.gray500 }]} numberOfLines={1}>
            {community?.name}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleInvite} style={styles.actionButton}>
            <UserPlus size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleEdit} style={styles.actionButton}>
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
            {localStatusCounts.all || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'all' ? colors.primary : colors.gray500 }]}>Total</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'PENDING' && { backgroundColor: COLORS.warning + '12', borderColor: COLORS.warning + '50' }
          ]}
          onPress={() => setFilter('PENDING')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: COLORS.warning }]}>
            {localStatusCounts['PENDING'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'PENDING' ? COLORS.warning : colors.gray500 }]}>En attente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'ACTIVE' && { backgroundColor: COLORS.success + '12', borderColor: COLORS.success + '50' }
          ]}
          onPress={() => setFilter('ACTIVE')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: COLORS.success }]}>
            {localStatusCounts['ACTIVE'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'ACTIVE' ? COLORS.success : colors.gray500 }]}>Actifs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'REJECTED' && { backgroundColor: COLORS.error + '12', borderColor: COLORS.error + '50' }
          ]}
          onPress={() => setFilter('REJECTED')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: COLORS.error }]}>
            {localStatusCounts['REJECTED'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'REJECTED' ? COLORS.error : colors.gray500 }]}>Refusés</Text>
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
