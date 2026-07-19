import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AtSign, MessageCircle } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, LAYOUT, BORDER } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import { SelectCard } from '../../src/components/ui';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  const handleEmailLogin = () => {
    router.push('/auth/email-login');
  };
  const handleWhatsAppLogin = () => router.push('/auth/whatsapp-login');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Image
            source={require('../../assets/etudesk_logo_black.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('auth.login.title')}
          </Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            {t('auth.login.subtitle')}
          </Text>
        </View>

        <View style={styles.buttonsContainer}>
          <Text style={[styles.label, { color: colors.gray500 }]}>
            {t('auth.login.continueWith')}
          </Text>

          <SelectCard
            style={[styles.authButton, styles.authButtonEmail, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={handleEmailLogin}
            selected={false}
            accessibilityLabel={t('common.continueWith') + ' Email'}
          >
            <AtSign
              size={ICON.size.md}
              color={colors.textOnPrimary}
              strokeWidth={ICON.strokeWidth}
            />
            <Text style={[styles.authButtonText, { color: colors.textOnPrimary }]}>
              {t('auth.login.continueWith')} Email
            </Text>
          </SelectCard>
          <SelectCard
            style={[styles.authButton, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
            onPress={handleWhatsAppLogin}
            selected={false}
            accessibilityLabel={t('common.continueWith') + ' WhatsApp'}
          >
            <MessageCircle size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.authButtonText, { color: colors.textPrimary }]}>{t('common.continueWith')} WhatsApp</Text>
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
    justifyContent: 'space-between',
  },

  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: height * 0.04,
  },

  logo: {
    width: Math.min(width * 0.48, 190),
    height: 44,
    marginBottom: SPACING.lg,
  },

  title: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },

  tagline: {
    maxWidth: 300,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.snug,
    textAlign: 'center',
  },

  buttonsContainer: {
    gap: SPACING.md,
    paddingBottom: SPACING.xl,
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
    gap: SPACING.sm,
    minHeight: LAYOUT.buttonHeightLg,
    paddingHorizontal: SPACING.lg,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
  },

  authButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  authButtonEmail: {
    // Dynamic colors applied inline
  },

  footer: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
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
