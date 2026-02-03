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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  User,
  Users,
  Building2,
  Plus,
  ChevronRight,
  Shield,
  HelpCircle,
  LogOut,
  Wallet,
  Trash2,
  Settings,
  Scale,
  Mail,
} from 'lucide-react-native';
import { kycService } from '../../../src/services/kycService';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/contexts/I18nContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import { Header, FooterNav } from '../../../src/components/ui';

export default function AccountScreen() {
  const router = useRouter();
  const [isKYCVerified, setIsKYCVerified] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    const fetchKYCStatus = async () => {
      try {
        const response = await kycService.getStatus();
        if (response.data?.status === 'VERIFIED') {
          setIsKYCVerified(true);
        }
      } catch (error) {
        // Silently fail
      }
    };
    fetchKYCStatus();
  }, []);
  const { t, language } = useI18n();
  const { currentSpace, selectedOrgId, selectedOrg, userOrganizations, setSpace } = useSpace();
  const { signOut, user } = useAuth();

  const handleSelectSpace = (type: 'talent' | 'organization', orgId?: string) => {
    setSpace(type, orgId);
  };

  // Get user display name from session
  const getUserDisplayName = (): string => {
    if (!user) return '';
    // Try different fields that might contain the display name
    const name = user.displayName ||
      (user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : null) ||
      user.email?.split('@')[0] ||
      '';
    return name;
  };

  // Get user initials for avatar
  const getUserInitials = (): string => {
    const displayName = getUserDisplayName();
    if (!displayName) return '?';

    const parts = displayName.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  };

  const handleProfilePress = () => {
    if (currentSpace === 'talent') {
      router.push('/settings/edit-profile');
    } else {
      router.push('/settings/edit-organization');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings.logout'),
      t('settings.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.logout'),
          style: 'destructive',
          onPress: async () => {
            // Reset space to default
            setSpace('talent');
            // Sign out (clears tokens and redirects to login)
            await signOut();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    const deleteTitle = language === 'fr' ? 'Supprimer mon compte' : 'Delete my account';
    const deleteMessage = language === 'fr'
      ? 'Cette action est irréversible. Toutes tes données seront supprimées définitivement.'
      : 'This action is irreversible. All your data will be permanently deleted.';
    const confirmTitle = language === 'fr' ? 'Confirmation' : 'Confirmation';
    const confirmMessage = language === 'fr'
      ? 'Es-tu vraiment sûr de vouloir supprimer ton compte ?'
      : 'Are you really sure you want to delete your account?';
    const confirmDelete = language === 'fr' ? 'Confirmer la suppression' : 'Confirm deletion';

    Alert.alert(
      deleteTitle,
      deleteMessage,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              confirmTitle,
              confirmMessage,
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: confirmDelete,
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert(
                      'Fonctionnalité en cours',
                      'La suppression de compte nécessite une confirmation par email. Cette fonctionnalité sera disponible prochainement.'
                    );
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const isOrganizationSpace = currentSpace === 'organization';

  const MENU_ITEMS = [
    // Organization-specific: Team management
    ...(isOrganizationSpace ? [{
      id: 'team',
      label: t('settings.menu.team'),
      icon: Users,
      description: t('settings.menu.teamDesc'),
      onPress: () => router.push('/settings/organization/members'),
    }] : []),
    {
      id: 'invitations',
      label: 'Mes invitations',
      icon: Mail,
      description: 'Gérer vos invitations reçues',
      onPress: () => router.push('/settings/invitations'),
    },
    {
      id: 'kyc',
      label: t('settings.menu.kyc'),
      icon: Shield,
      description: t('settings.menu.kycDesc'),
      badge: isKYCVerified ? (language === 'fr' ? 'Vérifié' : 'Verified') : null,
      badgeColor: colors.success,
      onPress: () => router.push('/settings/kyc'),
    },
    {
      id: 'payment',
      label: t('settings.menu.payment'),
      icon: Wallet,
      description: t('settings.menu.paymentDesc'),
      onPress: () => router.push('/settings/payment-methods'),
    },
    {
      id: 'preferences',
      label: t('settings.menu.preferences'),
      icon: Settings,
      description: t('settings.menu.preferencesDesc'),
      onPress: () => router.push('/settings/preferences'),
    },
    {
      id: 'help',
      label: t('settings.menu.help'),
      icon: HelpCircle,
      description: t('settings.menu.helpDesc'),
      onPress: () => router.push('/settings/help'),
    },
    {
      id: 'legal',
      label: t('settings.menu.legal'),
      icon: Scale,
      description: t('settings.menu.legalDesc'),
      onPress: () => router.push('/settings/legal'),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <Header
        title={t('settings.title')}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card - Dynamic based on active space */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
          onPress={handleProfilePress}
          activeOpacity={0.8}
        >
          {currentSpace === 'talent' ? (
            <>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.avatarText, { color: colors.textOnPrimary }]}>{getUserInitials()}</Text>
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.textPrimary }]}>{getUserDisplayName()}</Text>
                <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email || ''}</Text>
              </View>
            </>
          ) : (
            <>
              {selectedOrg?.logoUrl ? (
                <Image source={{ uri: selectedOrg.logoUrl }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarContainer, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                  <Building2 size={ICON.size.lg} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.textPrimary }]}>{selectedOrg?.name}</Text>
                <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{selectedOrg?.type} • {selectedOrg?.role === 'admin' ? 'Admin' : 'Membre'}</Text>
              </View>
            </>
          )}
          <ChevronRight
            size={ICON.size.md}
            color={colors.gray400}
            strokeWidth={ICON.strokeWidth}
          />
        </TouchableOpacity>

        {/* Space Switcher - Compact */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Espace actif</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.spaceChipsContainer}
          >
            {/* Talent Chip */}
            <TouchableOpacity
              style={[
                styles.spaceChip,
                { backgroundColor: colors.surface, borderColor: colors.borderColor },
                currentSpace === 'talent' && { borderColor: colors.primary, backgroundColor: withOpacity(colors.primary, OPACITY[10]) },
              ]}
              onPress={() => handleSelectSpace('talent')}
              activeOpacity={0.8}
            >
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.spaceChipImage} />
              ) : (
                <View style={[
                  styles.spaceChipIcon,
                  { backgroundColor: currentSpace === 'talent' ? colors.primary : colors.gray400 }
                ]}>
                  <User size={14} color={colors.textOnPrimary} strokeWidth={2} />
                </View>
              )}
              <Text style={[
                styles.spaceChipText,
                { color: currentSpace === 'talent' ? colors.primary : colors.textPrimary }
              ]}>
                Talent
              </Text>
            </TouchableOpacity>

            {/* Organization Chips */}
            {userOrganizations.map((org) => {
              const isActive = currentSpace === 'organization' && selectedOrgId === org.id;
              return (
                <TouchableOpacity
                  key={org.id}
                  style={[
                    styles.spaceChip,
                    { backgroundColor: colors.surface, borderColor: colors.borderColor },
                    isActive && { borderColor: colors.primary, backgroundColor: withOpacity(colors.primary, OPACITY[10]) },
                  ]}
                  onPress={() => handleSelectSpace('organization', org.id)}
                  activeOpacity={0.8}
                >
                  {org.logoUrl ? (
                    <Image source={{ uri: org.logoUrl }} style={styles.spaceChipImage} />
                  ) : (
                    <View style={[
                      styles.spaceChipIcon,
                      { backgroundColor: isActive ? colors.primary : colors.gray400 }
                    ]}>
                      <Building2 size={14} color={colors.textOnPrimary} strokeWidth={2} />
                    </View>
                  )}
                  <Text style={[
                    styles.spaceChipText,
                    { color: isActive ? colors.primary : colors.textPrimary }
                  ]} numberOfLines={1}>
                    {org.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Create Organization Chip */}
            <TouchableOpacity
              style={[
                styles.spaceChip,
                { backgroundColor: colors.surface, borderColor: colors.gray300, borderStyle: 'dashed' },
              ]}
              onPress={() => {
                if (!isKYCVerified) {
                  Alert.alert(
                    'Vérification requise',
                    'Vous devez vérifier votre identité (KYC) avant de créer une organisation.',
                    [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Vérifier mon identité', onPress: () => router.push('/settings/kyc') },
                    ]
                  );
                  return;
                }
                router.push('/settings/create-organization');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.spaceChipIcon, { backgroundColor: colors.gray200 }]}>
                <Plus size={14} color={colors.gray600} strokeWidth={2} />
              </View>
              <Text style={[styles.spaceChipText, { color: colors.gray600 }]}>
                Créer une organisation
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Menu Items */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Paramètres</Text>

          <View style={[styles.menuList, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
            {MENU_ITEMS.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.menuItem,
                    { borderBottomColor: colors.gray100 },
                    index === MENU_ITEMS.length - 1 && styles.menuItemLast,
                  ]}
                  onPress={item.onPress}
                  activeOpacity={0.8}
                >
                  <View style={[styles.menuItemIcon, { backgroundColor: colors.gray100 }]}>
                    <IconComponent
                      size={ICON.size.md}
                      color={colors.textSecondary}
                      strokeWidth={ICON.strokeWidth}
                    />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={[styles.menuItemLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                    <Text style={[styles.menuItemDescription, { color: colors.textSecondary }]}>{item.description}</Text>
                  </View>
                  {item.badge && (
                    <View style={[styles.badge, { backgroundColor: withOpacity(item.badgeColor, OPACITY[20]) }]}>
                      <Text style={[styles.badgeText, { color: item.badgeColor }]}>{item.badge}</Text>
                    </View>
                  )}
                  <ChevronRight
                    size={ICON.size.md}
                    color={colors.gray400}
                    strokeWidth={ICON.strokeWidth}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Compte</Text>

          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <LogOut
              size={ICON.size.md}
              color={colors.error}
              strokeWidth={ICON.strokeWidth}
            />
            <Text style={[styles.logoutText, { color: colors.error }]}>Se déconnecter</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteButton, { borderColor: colors.error }]}
            onPress={handleDeleteAccount}
            activeOpacity={0.8}
          >
            <Trash2
              size={ICON.size.md}
              color={colors.error}
              strokeWidth={ICON.strokeWidth}
            />
            <Text style={[styles.deleteText, { color: colors.error }]}>Supprimer mon compte</Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <Text style={[styles.version, { color: colors.textDisabled }]}>Etudesk v1.0.0</Text>
      </ScrollView>
      <FooterNav activeTab="settings" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: SPACING.xxl,
  },

  // Header
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  headerLogo: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.lg,
  },

  avatarContainer: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.md,
  },

  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: BORDER.radius.md,
    resizeMode: 'cover',
  },

  avatarText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  profileInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },

  profileName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  profileEmail: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },

  // Section
  section: {
    marginBottom: SPACING.lg,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },

  // Space Switcher - Compact Chips
  spaceChipsContainer: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },

  spaceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.full,
    gap: SPACING.xs,
  },

  spaceChipIcon: {
    width: 24,
    height: 24,
    borderRadius: BORDER.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  spaceChipImage: {
    width: 24,
    height: 24,
    borderRadius: BORDER.radius.full,
    resizeMode: 'cover',
  },

  spaceChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    maxWidth: 120,
  },

  // Menu List
  menuList: {
    marginHorizontal: SPACING.lg,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },

  menuItemLast: {
    borderBottomWidth: 0,
  },

  menuItemIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },

  menuItemContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },

  menuItemLabel: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  menuItemDescription: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },

  badge: {
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
    marginRight: SPACING.sm,
  },

  badgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
  },

  logoutText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    backgroundColor: 'transparent',
  },

  deleteText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Version
  version: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
});
