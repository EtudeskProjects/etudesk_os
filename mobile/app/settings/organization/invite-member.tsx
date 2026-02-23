import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Mail,
  Crown,
  Shield,
  Users,
  Eye,
  Send,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useOrganizationMembers } from '../../../src/contexts/OrganizationMemberContext';
import { Button, IconButton, Input, RadioRow } from '../../../src/components/ui';
import { ScrollToInputContext } from '../../../src/contexts/ScrollToInputContext';
import {
  OrganizationRole,
  ORGANIZATION_ROLES,
  getOrganizationRoleLabel,
  getOrganizationRoleDescription,
} from '../../../src/types/models';
import { useAlert } from '../../../src/contexts/AlertContext';
import { useI18n } from '../../../src/contexts/I18nContext';

const getRoleIcon = (role: OrganizationRole) => {
  switch (role) {
    case ORGANIZATION_ROLES.OWNER:
      return Crown;
    case ORGANIZATION_ROLES.ADMIN:
      return Shield;
    case ORGANIZATION_ROLES.MANAGER:
      return Users;
    case ORGANIZATION_ROLES.OBSERVER:
      return Eye;
    default:
      return Eye;
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

export default function InviteMemberScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { inviteMember } = useOrganizationMembers();

  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<OrganizationRole>(ORGANIZATION_ROLES.OBSERVER);
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSend = async () => {
    if (!isValidEmail(email)) {
      void alerts.alert(t('common.error'), t('organization.members.inviteScreen.invalidEmail'));
      return;
    }

    setIsSending(true);
    try {
      await inviteMember(email, selectedRole);
      void alerts.showAlert({
        title: t('organization.members.inviteScreen.sentTitle'),
        message: t('organization.members.inviteScreen.sentMessage', { email }),
        buttons: [{ text: 'OK', onPress: () => router.back() }],
      });
    } catch (error: any) {
      void alerts.alert(t('common.error'), error?.message || t('organization.members.inviteScreen.sendError'));
    } finally {
      setIsSending(false);
    }
  };

  const scrollToInput = useCallback((targetNodeHandle: number, extraOffset = 96) => {
    const sv = scrollViewRef.current;
    if (!sv) return;
    const delay = Platform.OS === 'android' ? 120 : 0;
    setTimeout(() => {
      sv.scrollResponderScrollNativeHandleToKeyboard(targetNodeHandle, extraOffset, true);
    }, delay);
  }, []);
  const alerts = useAlert();

  // Available roles for invitation (exclude OWNER)
  const availableRoles: OrganizationRole[] = [
    ORGANIZATION_ROLES.ADMIN,
    ORGANIZATION_ROLES.MANAGER,
    ORGANIZATION_ROLES.OBSERVER,
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel={t('common.back')}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('organization.members.inviteScreen.title')}</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollToInputContext.Provider value={scrollToInput}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            {/* Email Input */}
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('organization.members.email')}</Text>
            <Input
              placeholder={t('organization.members.inviteScreen.emailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              inputContainerStyle={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
              inputStyle={[styles.input, { color: colors.textPrimary, paddingHorizontal: 0 }]}
              leftIcon={<Mail size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />}
            />

          {/* Role Selection */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('organization.members.role')}</Text>
          <View style={[styles.roleList, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
            {availableRoles.map((role, index) => {
              const isLast = index === availableRoles.length - 1;
              const RIcon = getRoleIcon(role);
              const rColor = getRoleColor(role, colors);
              const isSelected = selectedRole === role;

              return (
                <RadioRow
                  key={role}
                  title={getOrganizationRoleLabel(role)}
                  description={getOrganizationRoleDescription(role)}
                  selected={isSelected}
                  onPress={() => setSelectedRole(role)}
                  icon={<RIcon size={ICON.size.sm} color={rColor} strokeWidth={ICON.strokeWidth} />}
                  style={[
                    styles.roleOption,
                    { borderBottomColor: colors.gray100 },
                    isLast && styles.roleOptionLast,
                  ]}
                  iconContainerStyle={[styles.roleOptionIcon, { backgroundColor: withOpacity(rColor, OPACITY[15]) }]}
                  titleStyle={styles.roleOptionTitle}
                  descriptionStyle={styles.roleOptionDescription}
                  radioStyle={styles.radioButton}
                />
              );
            })}
          </View>
          </ScrollView>

          {/* Send Button */}
          <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: Math.max(SPACING.lg, insets.bottom + SPACING.md) }]}>
            <Button
              title={isSending ? t('common.sending') : t('organization.members.inviteScreen.sendButton')}
              onPress={handleSend}
              disabled={!isValidEmail(email) || isSending}
              fullWidth
              icon={<Send size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
              style={[
                styles.sendButton,
                { backgroundColor: isValidEmail(email) ? colors.primary : colors.gray300 },
              ]}
              textStyle={[styles.sendButtonText, { color: colors.textOnPrimary }]}
            />
          </View>
        </ScrollToInputContext.Provider>
      </KeyboardAvoidingView>
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

  keyboardView: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    gap: SPACING.md,
  },

  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.md,
    padding: 0,
  },

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

  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },

  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
  },

  sendButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
