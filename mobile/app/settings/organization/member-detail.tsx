import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Crown,
  Shield,
  Users,
  User,
  Mail,
  Calendar,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useOrganizationMembers } from '../../../src/contexts/OrganizationMemberContext';
import {
  OrganizationMember,
  OrganizationRole,
  OrganizationPermission,
  ORGANIZATION_ROLES,
  ORGANIZATION_ROLE_LABELS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  DEFAULT_ROLE_PERMISSIONS,
} from '../../../src/types/models';

const getRoleIcon = (role: OrganizationRole) => {
  switch (role) {
    case ORGANIZATION_ROLES.OWNER:
      return Crown;
    case ORGANIZATION_ROLES.ADMIN:
      return Shield;
    case ORGANIZATION_ROLES.MANAGER:
      return Users;
    default:
      return User;
  }
};

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

export default function MemberDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const {
    members,
    currentUserMember,
    canManageMembers: canEditRoles,
    canManageMembers: canRemoveMembers,
    updateMemberRole: _updateMemberRole,
    removeMember,
  } = useOrganizationMembers();
  const updateMemberRole = (id: string, role: OrganizationRole, _permissions?: OrganizationPermission[]) => _updateMemberRole(id, role);

  const member = members.find(m => m.id === id);
  const [selectedRole, setSelectedRole] = useState<OrganizationRole>(member?.role || ORGANIZATION_ROLES.MEMBER);
  const [permissions, setPermissions] = useState<OrganizationPermission[]>(member?.permissions || []);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isOwner = member?.role === ORGANIZATION_ROLES.OWNER;
  const canEdit = canEditRoles && !isOwner;

  useEffect(() => {
    if (member) {
      setSelectedRole(member.role);
      setPermissions(member.permissions || []);
    }
  }, [member]);

  useEffect(() => {
    if (member) {
      const roleChanged = selectedRole !== member.role;
      const permissionsChanged = JSON.stringify([...permissions].sort()) !== JSON.stringify([...(member.permissions || [])].sort());
      setHasChanges(roleChanged || permissionsChanged);
    }
  }, [selectedRole, permissions, member]);

  if (!member) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Membre</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Membre non trouvé</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleRoleChange = (role: OrganizationRole) => {
    setSelectedRole(role);
    setPermissions(DEFAULT_ROLE_PERMISSIONS[role]);
  };

  const togglePermission = (permission: OrganizationPermission) => {
    setPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupKey)
        ? prev.filter(g => g !== groupKey)
        : [...prev, groupKey]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateMemberRole(member.id, selectedRole, permissions);
      router.back();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour les permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = () => {
    Alert.alert(
      'Retirer le membre',
      `Voulez-vous vraiment retirer ${member.display_name} de l'organisation ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            await removeMember(member.id);
            router.back();
          },
        },
      ]
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const RoleIcon = getRoleIcon(member.role);
  const roleColor = getRoleColor(member.role, colors);

  const availableRoles = Object.values(ORGANIZATION_ROLES).filter(r => r !== ORGANIZATION_ROLES.OWNER);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Détails</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
          {member.avatar_url ? (
            <Image source={{ uri: member.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.gray200 }]}>
              <Text style={[styles.avatarText, { color: colors.gray600 }]}>
                {member.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={[styles.memberName, { color: colors.textPrimary }]}>{member.display_name}</Text>
          {member.title && (
            <Text style={[styles.memberTitle, { color: colors.textSecondary }]}>{member.title}</Text>
          )}
          <View style={[styles.roleBadge, { backgroundColor: withOpacity(roleColor, OPACITY[15]) }]}>
            <RoleIcon size={14} color={roleColor} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.roleText, { color: roleColor }]}>
              {ORGANIZATION_ROLE_LABELS[member.role]}
            </Text>
          </View>

          {/* Contact Info */}
          <View style={styles.contactInfo}>
            <View style={styles.contactItem}>
              <Mail size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.contactText, { color: colors.textSecondary }]}>{member.email}</Text>
            </View>
            <View style={styles.contactItem}>
              <Calendar size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.contactText, { color: colors.textSecondary }]}>
                Membre depuis {formatDate(member.joined_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* Role Selection */}
        {canEdit && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Rôle</Text>
            <View style={[styles.roleList, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
              {availableRoles.map((role, index) => {
                const isLast = index === availableRoles.length - 1;
                const RIcon = getRoleIcon(role);
                const rColor = getRoleColor(role, colors);
                const isSelected = selectedRole === role;

                return (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleOption,
                      { borderBottomColor: colors.gray100 },
                      isLast && styles.roleOptionLast,
                    ]}
                    onPress={() => handleRoleChange(role)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.roleOptionIcon, { backgroundColor: withOpacity(rColor, OPACITY[15]) }]}>
                      <RIcon size={ICON.size.sm} color={rColor} strokeWidth={ICON.strokeWidth} />
                    </View>
                    <View style={styles.roleOptionInfo}>
                      <Text style={[styles.roleOptionTitle, { color: colors.textPrimary }]}>
                        {ORGANIZATION_ROLE_LABELS[role]}
                      </Text>
                      <Text style={[styles.roleOptionDescription, { color: colors.textSecondary }]}>
                        {role === ORGANIZATION_ROLES.ADMIN
                          ? 'Accès complet sauf suppression'
                          : role === ORGANIZATION_ROLES.MANAGER
                            ? 'Gestion des contenus'
                            : 'Accès en lecture seule'}
                      </Text>
                    </View>
                    <View style={[
                      styles.radioButton,
                      { borderColor: isSelected ? colors.primary : colors.gray300 },
                      isSelected && { backgroundColor: colors.primary },
                    ]}>
                      {isSelected && <Check size={14} color={colors.textOnPrimary} strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Permissions */}
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Permissions</Text>
            <View style={[styles.permissionsList, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
              {Object.entries(PERMISSION_GROUPS).map(([key, group], groupIndex) => {
                const isExpanded = expandedGroups.includes(key);
                const isLastGroup = groupIndex === Object.entries(PERMISSION_GROUPS).length - 1;
                const groupPermissions = group.permissions as OrganizationPermission[];
                const activeCount = groupPermissions.filter(p => permissions.includes(p)).length;

                return (
                  <View key={key}>
                    <TouchableOpacity
                      style={[
                        styles.permissionGroupHeader,
                        { borderBottomColor: colors.gray100 },
                        isLastGroup && !isExpanded && styles.permissionGroupHeaderLast,
                      ]}
                      onPress={() => toggleGroup(key)}
                      activeOpacity={0.7}
                    >
                      <View>
                        <Text style={[styles.permissionGroupTitle, { color: colors.textPrimary }]}>
                          {group.label}
                        </Text>
                        <Text style={[styles.permissionGroupCount, { color: colors.textSecondary }]}>
                          {activeCount}/{groupPermissions.length} activées
                        </Text>
                      </View>
                      {isExpanded ? (
                        <ChevronUp size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                      ) : (
                        <ChevronDown size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                      )}
                    </TouchableOpacity>

                    {isExpanded && groupPermissions.map((permission, permIndex) => {
                      const isLastPerm = permIndex === groupPermissions.length - 1;
                      const isEnabled = permissions.includes(permission);

                      return (
                        <TouchableOpacity
                          key={permission}
                          style={[
                            styles.permissionItem,
                            { borderBottomColor: colors.gray100 },
                            isLastPerm && isLastGroup && styles.permissionItemLast,
                          ]}
                          onPress={() => togglePermission(permission)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.permissionLabel, { color: colors.textPrimary }]}>
                            {PERMISSION_LABELS[permission]}
                          </Text>
                          <View style={[
                            styles.checkbox,
                            { borderColor: isEnabled ? colors.primary : colors.gray300 },
                            isEnabled && { backgroundColor: colors.primary },
                          ]}>
                            {isEnabled && <Check size={12} color={colors.textOnPrimary} strokeWidth={3} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Remove Member Button */}
        {canRemoveMembers && !isOwner && (
          <TouchableOpacity
            style={[styles.removeButton, { borderColor: colors.error }]}
            onPress={handleRemove}
          >
            <Trash2 size={ICON.size.md} color={colors.error} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.removeButtonText, { color: colors.error }]}>
              Retirer de l'organisation
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Save Button */}
      {canEdit && hasChanges && (
        <View style={[styles.footer, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={[styles.saveButtonText, { color: colors.textOnPrimary }]}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Text>
          </TouchableOpacity>
        </View>
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

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  // Profile Card
  profileCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
  },

  avatar: {
    width: 80,
    height: 80,
    borderRadius: BORDER.radius.lg,
    marginBottom: SPACING.md,
  },

  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: BORDER.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },

  avatarText: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  memberName: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
  },

  memberTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.full,
    marginTop: SPACING.md,
  },

  roleText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  contactInfo: {
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },

  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  contactText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Section
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },

  // Role List
  roleList: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
  },

  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
    gap: SPACING.md,
  },

  roleOptionLast: {
    borderBottomWidth: 0,
  },

  roleOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  roleOptionInfo: {
    flex: 1,
  },

  roleOptionTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  roleOptionDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Permissions
  permissionsList: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
  },

  permissionGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },

  permissionGroupHeaderLast: {
    borderBottomWidth: 0,
  },

  permissionGroupTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  permissionGroupCount: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    paddingLeft: SPACING.xl,
    borderBottomWidth: BORDER.width.thin,
  },

  permissionItemLast: {
    borderBottomWidth: 0,
  },

  permissionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: BORDER.radius.xs,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Remove Button
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    marginTop: SPACING.xl,
  },

  removeButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Footer
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },

  saveButton: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
  },

  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },
});
