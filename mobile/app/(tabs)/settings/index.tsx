import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
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
  ExternalLink,
  Mail,
} from 'lucide-react-native';
import { kycService } from '../../../src/services/kycService';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/contexts/I18nContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import { Button, Header, FooterNav, SelectCard } from '../../../src/components/ui';
import { RemoteImage } from '../../../src/components/ui/RemoteImage';
import { getFullImageUrl } from '../../../src/utils/image';
import { useAlert } from '../../../src/contexts/AlertContext';

export default function AccountScreen() {
  const router = useRouter();
  const [kycStatus, setKycStatus] = useState<string>('NONE');
  const isKYCVerified = kycStatus === 'VERIFIED';
  const { colors } = useTheme();

  const { t, language } = useI18n();
  const { currentSpace, selectedOrgId, selectedOrg, userOrganizations, setSpace } = useSpace();
  const { signOut, user } = useAuth();
  const alerts = useAlert();

  const fetchKYCStatus = async () => {
    try {
      const response = await kycService.getStatus();
      const status = response.data?.status || 'NONE';
      setKycStatus(status);
    } catch (error) {
      // Silently fail
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchKYCStatus();
    }, [])
  );

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
    void alerts.showAlert({ title: t('settings.logout'), message: t('settings.logoutConfirm'), buttons: [
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
      ] });
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

    void alerts.showAlert({ title: deleteTitle, message: deleteMessage, buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            void alerts.showAlert({ title: confirmTitle, message: confirmMessage, buttons: [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: confirmDelete,
                  style: 'destructive',
                  onPress: () => {
                    void alerts.alert(
                      'Fonctionnalité en cours',
                      'La suppression de compte nécessite une confirmation par email. Cette fonctionnalité sera disponible prochainement.'
                    );
                  },
                },
              ] });
          },
        },
      ] });
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
      id: 'credits-billing',
      label: 'Crédits & facturation',
      icon: Wallet,
      description: 'Recharger, suivre le solde et vérifier les paiements',
      onPress: () => router.push('/settings/credits' as any),
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
      id: 'privacy',
      label: language === 'fr' ? 'Politique de confidentialité' : 'Privacy Policy',
      icon: Scale,
      description: language === 'fr' ? 'Consulter notre politique de confidentialité' : 'View our privacy policy',
      onPress: () => Linking.openURL('https://etudesk.com/privacy'),
      external: true,
    },
    {
      id: 'legal-notice',
      label: language === 'fr' ? 'Mentions légales' : 'Legal Notice',
      icon: Scale,
      description: language === 'fr' ? 'Consulter nos mentions légales' : 'View our legal notice',
      onPress: () => Linking.openURL('https://etudesk.com/mentions-legales'),
      external: true,
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
        <SelectCard
          style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
          onPress={handleProfilePress}
          selected={false}
          accessibilityLabel={currentSpace === 'talent' ? 'Ouvrir mon profil' : 'Ouvrir le profil organisation'}
        >
          {currentSpace === 'talent' ? (
            <>
              {getFullImageUrl(user?.avatarUrl) ? (
                <RemoteImage uri={user?.avatarUrl} style={styles.avatarImage} />
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
                <RemoteImage uri={selectedOrg.logoUrl} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarContainer, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                  <Building2 size={ICON.size.lg} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.textPrimary }]}>{selectedOrg?.name}</Text>
                <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{selectedOrg?.type} • {selectedOrg?.role === 'ADMIN' ? 'Admin' : 'Membre'}</Text>
              </View>
            </>
          )}
          <ChevronRight
            size={ICON.size.md}
            color={colors.gray400}
            strokeWidth={ICON.strokeWidth}
          />
        </SelectCard>

        {/* Space Switcher - Compact */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Espace actif</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.spaceChipsContainer}
          >
            {/* Talent Chip */}
            <SelectCard
              style={[
                styles.spaceChip,
                { backgroundColor: colors.surface, borderColor: colors.borderColor },
                currentSpace === 'talent' && { borderColor: colors.primary, backgroundColor: withOpacity(colors.primary, OPACITY[10]) },
              ]}
              onPress={() => handleSelectSpace('talent')}
              selected={false}
              accessibilityLabel="Basculer sur l’espace talent"
            >
              {getFullImageUrl(user?.avatarUrl) ? (
                <RemoteImage uri={user?.avatarUrl} style={styles.spaceChipImage} />
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
            </SelectCard>

            {/* Organization Chips */}
            {userOrganizations.map((org) => {
              const isActive = currentSpace === 'organization' && selectedOrgId === org.id;
              return (
                <SelectCard
                  key={org.id}
                  style={[
                    styles.spaceChip,
                    { backgroundColor: colors.surface, borderColor: colors.borderColor },
                    isActive && { borderColor: colors.primary, backgroundColor: withOpacity(colors.primary, OPACITY[10]) },
                  ]}
                  onPress={() => handleSelectSpace('organization', org.id)}
                  selected={false}
                  accessibilityLabel={`Basculer sur l’espace organisation ${org.name}`}
                >
                  {org.logoUrl ? (
                    <RemoteImage uri={org.logoUrl} style={styles.spaceChipImage} />
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
                </SelectCard>
              );
            })}

            {/* Create Organization Chip */}
            <SelectCard
              style={[
                styles.spaceChip,
                { backgroundColor: colors.surface, borderColor: colors.gray300, borderStyle: 'dashed' },
              ]}
              onPress={() => {
                const ADMIN_EMAILS = ['admin@etudesk.com']; // Sync with backend
                const isAdmin = user?.email && (ADMIN_EMAILS.includes(user.email.toLowerCase()) || user.email.endsWith('@etudesk.com'));

                if (!isKYCVerified && !isAdmin) {
                  const alertTitle = kycStatus === 'PENDING' ? 'Vérification en cours' : 'Vérification requise';
                  const alertMessage = kycStatus === 'PENDING'
                    ? 'Votre vérificaton d\'identité est en cours de traitement. Vous pourrez créer une organisation dès qu\'elle sera validée.'
                    : 'Vous devez vérifier votre identité (KYC) avant de créer une organisation.';

                  void alerts.showAlert({ title: alertTitle, message: alertMessage, buttons: [
                      { text: 'Annuler', style: 'cancel' },
                      {
                        text: kycStatus === 'PENDING' ? 'Voir le statut' : 'Vérifier mon identité',
                        onPress: () => router.push('/settings/kyc')
                      },
                    ] });
                  return;
                }
                router.push('/settings/create-organization');
              }}
              selected={false}
              accessibilityLabel="Créer une organisation"
            >
              <View style={[styles.spaceChipIcon, { backgroundColor: colors.gray200 }]}>
                <Plus size={14} color={colors.gray600} strokeWidth={2} />
              </View>
              <Text style={[styles.spaceChipText, { color: colors.gray600 }]}>
                Créer une organisation
              </Text>
            </SelectCard>
          </ScrollView>
        </View>

        {/* Menu Items */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Paramètres</Text>

          <View style={[styles.menuList, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
            {MENU_ITEMS.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <SelectCard
                  key={item.id}
                  style={[
                    styles.menuItem,
                    { borderBottomColor: colors.gray100 },
                    index === MENU_ITEMS.length - 1 && styles.menuItemLast,
                    { borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0 },
                  ]}
                  onPress={item.onPress}
                  selected={false}
                  accessibilityLabel={item.label}
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
                  {item.external ? (
                    <ExternalLink
                      size={ICON.size.md}
                      color={colors.gray400}
                      strokeWidth={ICON.strokeWidth}
                    />
                  ) : (
                    <ChevronRight
                      size={ICON.size.md}
                      color={colors.gray400}
                      strokeWidth={ICON.strokeWidth}
                    />
                  )}
                </SelectCard>
              );
            })}
          </View>
        </View>

        {/* Danger Zone */}
        <View style={[styles.section, styles.accountSection]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Compte</Text>

          <Button
            title="Se déconnecter"
            onPress={handleLogout}
            variant="outline"
            fullWidth
            icon={<LogOut size={ICON.size.md} color={colors.error} strokeWidth={ICON.strokeWidth} />}
            style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
            textStyle={[styles.logoutText, { color: colors.error }]}
          />

          <Button
            title="Supprimer mon compte"
            onPress={handleDeleteAccount}
            variant="outline"
            fullWidth
            icon={<Trash2 size={ICON.size.md} color={colors.error} strokeWidth={ICON.strokeWidth} />}
            style={[styles.deleteButton, { borderColor: colors.error, backgroundColor: 'transparent' }]}
            textStyle={[styles.deleteText, { color: colors.error }]}
          />
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

  accountSection: {
    paddingHorizontal: SPACING.lg,
  },

  // Logout
  logoutButton: {
  },

  logoutText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  deleteButton: {
    marginTop: SPACING.sm,
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
