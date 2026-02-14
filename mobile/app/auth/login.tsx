import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AtSign } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, LAYOUT, BORDER, BRAND_COLORS, LIGHT_COLORS } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { SelectCard } from '../../src/components/ui';


const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const alerts = useAlert();

  const showComingSoonAlert = (provider: string) => {
    void alerts.showAlert({ title: 'Bientôt disponible', message: `La connexion via ${provider} sera disponible prochainement. En attendant, utilisez la connexion par email.`, buttons: [{ text: 'OK' }] });
  };

  const handleGoogleLogin = () => {
    showComingSoonAlert('Google');
  };

  const handleWhatsAppLogin = () => {
    router.push('/auth/whatsapp-login');
  };

  const handleEmailLogin = () => {
    router.push('/auth/email-login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/etudesk_logo_black.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            {t('auth.login.subtitle')}
          </Text>
        </View>

        <View style={styles.buttonsContainer}>
          <Text style={[styles.label, { color: colors.gray500 }]}>
            {t('auth.login.continueWith')}
          </Text>

          <SelectCard
            style={[styles.authButton, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
            onPress={handleGoogleLogin}
            selected={false}
            accessibilityLabel="Continuer avec Google"
          >
            <Image
              source={require('../../assets/google_icon.png')}
              style={styles.socialIcon}
            />
            <Text style={[styles.authButtonText, { color: colors.textPrimary }]}>Google</Text>
          </SelectCard>

          <SelectCard
            style={[styles.authButton, styles.authButtonWhatsApp]}
            onPress={handleWhatsAppLogin}
            selected={false}
            accessibilityLabel="Continuer avec WhatsApp"
          >
            <Image
              source={require('../../assets/whatsapp_icon.png')}
              style={styles.socialIcon}
            />
            {/* WhatsApp button always has white bg, so text must always be dark */}
            <Text style={[styles.authButtonText, { color: LIGHT_COLORS.black }]}>WhatsApp</Text>
          </SelectCard>

          <SelectCard
            style={[styles.authButton, styles.authButtonEmail, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={handleEmailLogin}
            selected={false}
            accessibilityLabel="Continuer avec Email"
          >
            <AtSign
              size={ICON.size.lg}
              color={colors.textOnPrimary}
              strokeWidth={ICON.strokeWidth}
            />
            <Text style={[styles.authButtonText, { color: colors.textOnPrimary }]}>Email</Text>
          </SelectCard>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.gray500 }]}>
            {t('auth.login.termsPrefix')}{' '}
            <Text style={[styles.footerLink, { color: colors.primary }]}>{t('legal.terms')}</Text>
            {' '}{t('common.and')}{' '}
            <Text style={[styles.footerLink, { color: colors.primary }]}>{t('legal.privacy')}</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },

  header: {
    paddingTop: height * 0.12,
    paddingBottom: SPACING.xxxl,
    alignItems: 'center',
  },

  logo: {
    width: width * 0.5,
    height: 50,
    marginBottom: SPACING.sm,
  },

  tagline: {
    fontSize: TYPOGRAPHY.fontSize.lg,
  },

  buttonsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },

  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    height: LAYOUT.buttonHeight,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
  },

  authButtonWhatsApp: {
    // WhatsApp brand colors
    backgroundColor: LIGHT_COLORS.white,
    borderColor: BRAND_COLORS.whatsapp,
  },

  socialIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },

  authButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  authButtonEmail: {
    // Dynamic colors applied inline
  },

  footer: {
    paddingVertical: SPACING.lg,
  },

  footerText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.xs * TYPOGRAPHY.lineHeight.relaxed,
  },

  footerLink: {
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});
