import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Plus,
  Users,
  ChevronRight,
  Clock,
  Mail,
  Trash2,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useOrganizationMembers } from '../../../src/contexts/OrganizationMemberContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
import {
  OrganizationRole,
  ORGANIZATION_ROLES,
  getOrganizationRoleLabel,
} from '../../../src/types/models';
import { organizationService } from '../../../src/services';
import { useAlert } from '../../../src/contexts/AlertContext';
import { useI18n } from '../../../src/contexts/I18nContext';
import { Button, Chip, IconButton, SelectCard } from '../../../src/components/ui';


type TabType = 'members' | 'invitations';

const getRoleColor = (role: OrganizationRole, colors: any) => {
  switch (role) {
    case ORGANIZATION_ROLES.OWNER:
      return colors.warning;
    case ORGANIZATION_ROLES.ADMIN:
      return colors.primary;
    case ORGANIZATION_ROLES.MANAGER:
      return colors.success;
    default:
      return colors.gray500;
  }
};

export default function MembersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { selectedOrg, refreshOrganizations, setSpace } = useSpace();
  const {
    members,
    invitations,
    canInviteMembers,
    canManageMembers,
    refreshMembers,
  } = useOrganizationMembers();

  const [activeTab, setActiveTab] = useState<TabType>('members');
  const [refreshing, setRefreshing] = useState(false);
  const alerts = useAlert();

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshMembers();
    setRefreshing(false);
  };

  const handleMemberPress = (memberId: string) => {
    router.push({
      pathname: '/settings/organization/member-detail',
      params: { id: memberId },
    });
  };

  const handleInvite = () => {
    router.push('/settings/organization/invite-member');
  };

  const handleDeleteOrganization = () => {
    if (!selectedOrg) return;
    void alerts.showAlert({ title: t('organization.members.manage.deleteOrgTitle'), message: t('organization.members.manage.deleteOrgMessage', { name: selectedOrg.name }), buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            void alerts.showAlert({ title: t('organization.members.manage.confirmDeleteTitle'), message: t('organization.members.manage.confirmDeleteMessage'), buttons: [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('organization.members.manage.deletePermanently'),
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await organizationService.remove(selectedOrg.id);
                      await refreshOrganizations();
                      setSpace('talent');
                      router.replace('/(tabs)/settings');
                    } catch (error: any) {
                      await alerts.error(t('common.error'), error?.error || t('organization.members.manage.deleteOrgError'));
                    }
                  },
                },
              ] });
          },
        },
      ] });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel={t('common.back')}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('organization.members.manage.title')}</Text>
        {canInviteMembers ? (
          <IconButton
            onPress={handleInvite}
            icon={<Plus size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
            accessibilityLabel={t('organization.members.inviteMember')}
          />
        ) : (
          <View style={styles.backButton} />
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.gray100 }]}>
        <Chip
          label={t('organization.members.manage.membersTab', { count: members.length })}
          selected={activeTab === 'members'}
          onPress={() => setActiveTab('members')}
          leftIcon={
            <Users
              size={ICON.size.sm}
              color={activeTab === 'members' ? colors.primary : colors.gray500}
              strokeWidth={ICON.strokeWidth}
            />
          }
          style={[
            styles.tab,
            {
              borderWidth: 0,
              backgroundColor: activeTab === 'members' ? colors.surface : colors.gray100,
            },
          ]}
          textStyle={[
            styles.tabText,
            { color: activeTab === 'members' ? colors.primary : colors.gray500 },
          ]}
        />

        <Chip
          label={t('organization.members.manage.invitationsTab', { count: invitations.length })}
          selected={activeTab === 'invitations'}
          onPress={() => setActiveTab('invitations')}
          leftIcon={
            <Mail
              size={ICON.size.sm}
              color={activeTab === 'invitations' ? colors.primary : colors.gray500}
              strokeWidth={ICON.strokeWidth}
            />
          }
          style={[
            styles.tab,
            {
              borderWidth: 0,
              backgroundColor: activeTab === 'invitations' ? colors.surface : colors.gray100,
            },
          ]}
          textStyle={[
            styles.tabText,
            { color: activeTab === 'invitations' ? colors.primary : colors.gray500 },
          ]}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {activeTab === 'members' ? (
          <>
            {/* Members List */}
            <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
              {members.map((member, index) => {
                const isLast = index === members.length - 1;
                const roleColor = getRoleColor(member.role, colors);

                return (
                  <SelectCard
                    key={member.id}
                    style={[
                      styles.memberItem,
                      { borderBottomColor: colors.gray100 },
                      isLast && styles.memberItemLast,
                      { borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0 },
                    ]}
                    onPress={() => handleMemberPress(member.id)}
                    selected={false}
                    accessibilityLabel={t('organization.members.manage.openMemberA11y', { name: member.display_name })}
                  >
                    {/* Avatar */}
                    {member.avatar_url ? (
                      <Image source={{ uri: member.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: colors.gray200 }]}>
                        <Text style={[styles.avatarText, { color: colors.gray600 }]}>
                          {member.display_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    {/* Info */}
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {member.display_name}
                      </Text>
                      {member.title && (
                        <Text style={[styles.memberTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                          {member.title}
                        </Text>
                      )}
                      <View style={styles.memberMeta}>
                        <View style={[styles.roleBadge, { backgroundColor: withOpacity(roleColor, OPACITY[15]) }]}>
                          <Text style={[styles.roleText, { color: roleColor }]}>
                            {getOrganizationRoleLabel(member.role)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Arrow */}
                    {canManageMembers && member.role !== ORGANIZATION_ROLES.OWNER && (
                      <ChevronRight size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                    )}
                  </SelectCard>
                );
              })}
            </View>
          </>
        ) : (
          <>
            {/* Invitations List */}
            {invitations.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.gray100 }]}>
                  <Mail size={ICON.size.xl} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  {t('organization.members.manage.emptyInvitationsTitle')}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  {t('organization.members.manage.emptyInvitationsSubtitle')}
                </Text>
                {canInviteMembers && (
                  <Button
                    title={t('organization.members.inviteMember')}
                    onPress={handleInvite}
                    fullWidth
                    icon={<Plus size={ICON.size.sm} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
                    style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                    textStyle={[styles.emptyButtonText, { color: colors.textOnPrimary }]}
                  />
                )}
              </View>
            ) : (
              <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
                {invitations.map((invitation, index) => {
                  const isLast = index === invitations.length - 1;
                  const roleColor = getRoleColor(invitation.role, colors);

                  return (
                    <SelectCard
                      key={invitation.id}
                      style={[
                        styles.memberItem,
                        { borderBottomColor: colors.gray100 },
                        isLast && styles.memberItemLast,
                        { borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0 },
                      ]}
                      onPress={() => router.push({
                        pathname: '/settings/organization/invitation-detail',
                        params: { id: invitation.id },
                      })}
                      selected={false}
                      accessibilityLabel={t('organization.members.manage.openInvitationA11y', { email: invitation.email })}
                    >
                      {/* Avatar Placeholder */}
                      <View style={[styles.avatarPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                        <Mail size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                      </View>

                      {/* Info */}
                      <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {invitation.email}
                        </Text>
                        <View style={styles.memberMeta}>
                          <View style={[styles.roleBadge, { backgroundColor: withOpacity(roleColor, OPACITY[15]) }]}>
                            <Text style={[styles.roleText, { color: roleColor }]}>
                              {getOrganizationRoleLabel(invitation.role)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.invitationMeta}>
                          <Clock size={12} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                          <Text style={[styles.invitationDate, { color: colors.gray400 }]}>
                            {t('organization.members.manage.expiresOn', { date: formatDate(invitation.expires_at) })}
                          </Text>
                        </View>
                      </View>

                      {/* Arrow */}
                      <ChevronRight size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                    </SelectCard>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Delete Organization Button - Owner only */}
        {selectedOrg?.role === 'OWNER' && (
          <Button
            title={t('organization.members.manage.deleteOrgButton')}
            onPress={handleDeleteOrganization}
            variant="outline"
            fullWidth
            icon={<Trash2 size={ICON.size.sm} color={colors.error} strokeWidth={ICON.strokeWidth} />}
            style={[styles.deleteButton, { borderColor: colors.error }]}
            textStyle={[styles.deleteButtonText, { color: colors.error }]}
          />
        )}
      </ScrollView>
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

  addButton: {
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
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    padding: 4,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.md,
  },

  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },

  tabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl * 3,
  },

  // List
  list: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
  },

  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
    gap: SPACING.md,
  },

  memberItemLast: {
    borderBottomWidth: 0,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.md,
  },

  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  memberInfo: {
    flex: 1,
  },

  memberName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  memberTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },

  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER.radius.xs,
  },

  roleText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  invitationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },

  invitationDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },

  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: BORDER.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },

  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },

  emptySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.md * 1.5,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },

  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER.radius.sm,
  },

  emptyButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  deleteButton: {
    marginTop: SPACING.xxl,
  },

  deleteButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});
