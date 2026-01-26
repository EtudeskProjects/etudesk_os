import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Mail,
  Crown,
  Shield,
  Users,
  User,
  Clock,
  RefreshCw,
  X,
  UserPlus,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useOrganizationMembers } from '../../../src/contexts/OrganizationMemberContext';
import {
  OrganizationRole,
  ORGANIZATION_ROLES,
  ORGANIZATION_ROLE_LABELS,
  PERMISSION_LABELS,
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

export default function InvitationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { invitations, cancelInvitation, resendInvitation } = useOrganizationMembers();

  const invitation = invitations.find(i => i.id === id);
  const [isResending, setIsResending] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  if (!invitation) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Invitation</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Invitation non trouvée</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = new Date(invitation.expires_at) < new Date();
  const daysRemaining = Math.ceil((new Date(invitation.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const handleResend = async () => {
    setIsResending(true);
    try {
      await resendInvitation(invitation.id);
      Alert.alert('Succès', 'L\'invitation a été renvoyée avec une nouvelle date d\'expiration');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de renvoyer l\'invitation');
    } finally {
      setIsResending(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Annuler l\'invitation',
      `Voulez-vous vraiment annuler l'invitation envoyée à ${invitation.email} ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              await cancelInvitation(invitation.id);
              router.back();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible d\'annuler l\'invitation');
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  const RoleIcon = getRoleIcon(invitation.role);
  const roleColor = getRoleColor(invitation.role, colors);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Invitation</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Invitation Card */}
        <View style={[styles.invitationCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
            <UserPlus size={ICON.size.xl} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          </View>

          <Text style={[styles.email, { color: colors.textPrimary }]}>{invitation.email}</Text>

          <View style={[styles.roleBadge, { backgroundColor: roleColor + '15' }]}>
            <RoleIcon size={14} color={roleColor} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.roleText, { color: roleColor }]}>
              {ORGANIZATION_ROLE_LABELS[invitation.role]}
            </Text>
          </View>

          {/* Status */}
          <View style={[
            styles.statusBadge,
            { backgroundColor: isExpired ? colors.error + '15' : colors.warning + '15' },
          ]}>
            <Clock size={14} color={isExpired ? colors.error : colors.warning} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, { color: isExpired ? colors.error : colors.warning }]}>
              {isExpired
                ? 'Expirée'
                : daysRemaining > 1
                ? `Expire dans ${daysRemaining} jours`
                : daysRemaining === 1
                ? 'Expire demain'
                : 'Expire aujourd\'hui'}
            </Text>
          </View>

          {/* Meta Info */}
          <View style={styles.metaInfo}>
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Envoyée le</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                {formatDate(invitation.created_at)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Expire le</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                {formatDate(invitation.expires_at)}
              </Text>
            </View>
            {invitation.invited_by_name && (
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Invité par</Text>
                <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                  {invitation.invited_by_name}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Permissions */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Permissions accordées</Text>
        <View style={[styles.permissionsList, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
          {invitation.permissions.map((permission, index) => {
            const isLast = index === invitation.permissions.length - 1;

            return (
              <View
                key={permission}
                style={[
                  styles.permissionItem,
                  { borderBottomColor: colors.gray100 },
                  isLast && styles.permissionItemLast,
                ]}
              >
                <Text style={[styles.permissionLabel, { color: colors.textPrimary }]}>
                  {PERMISSION_LABELS[permission]}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleResend}
            disabled={isResending}
          >
            <RefreshCw size={ICON.size.md} color={COLORS.white} strokeWidth={ICON.strokeWidth} />
            <Text style={styles.actionButtonText}>
              {isResending ? 'Envoi...' : 'Renvoyer l\'invitation'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton, { borderColor: colors.error }]}
            onPress={handleCancel}
            disabled={isCancelling}
          >
            <X size={ICON.size.md} color={colors.error} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.actionButtonText, styles.cancelButtonText, { color: colors.error }]}>
              {isCancelling ? 'Annulation...' : 'Annuler l\'invitation'}
            </Text>
          </TouchableOpacity>
        </View>
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

  // Invitation Card
  invitationCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
  },

  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },

  email: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
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

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.full,
    marginTop: SPACING.sm,
  },

  statusText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  metaInfo: {
    marginTop: SPACING.lg,
    width: '100%',
    gap: SPACING.sm,
  },

  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  metaLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  metaValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Section
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },

  // Permissions
  permissionsList: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
  },

  permissionItem: {
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },

  permissionItemLast: {
    borderBottomWidth: 0,
  },

  permissionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Actions
  actions: {
    gap: SPACING.md,
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
  },

  actionButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.white,
  },

  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: BORDER.width.thin,
  },

  cancelButtonText: {
    color: undefined, // Will be set dynamically
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
