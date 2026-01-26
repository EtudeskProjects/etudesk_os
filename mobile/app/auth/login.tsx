import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, MessageCircle, AtSign } from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, LAYOUT, BORDER } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  const showComingSoonAlert = (provider: string) => {
    Alert.alert(
      'Bientôt disponible',
      `La connexion via ${provider} sera disponible prochainement. En attendant, utilisez la connexion par email.`,
      [{ text: 'OK' }]
    );
  };

  const handleGoogleLogin = () => {
    showComingSoonAlert('Google');
  };

  const handleAppleLogin = () => {
    showComingSoonAlert('Apple');
  };

  const handleWhatsAppLogin = () => {
    showComingSoonAlert('WhatsApp');
  };

  const handleEmailLogin = () => {
    router.push('/auth/email-login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/etudesk_logo_blue.png')}
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

          <TouchableOpacity
            style={[styles.authButton, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
            onPress={handleGoogleLogin}
            activeOpacity={0.8}
          >
            <Mail
              size={ICON.size.lg}
              color={colors.textPrimary}
              strokeWidth={ICON.strokeWidth}
            />
            <Text style={[styles.authButtonText, { color: colors.textPrimary }]}>Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.authButton, styles.authButtonApple]}
            onPress={handleAppleLogin}
            activeOpacity={0.8}
          >
            <View style={styles.appleIcon}>
              <Text style={styles.appleIconText}>A</Text>
            </View>
            <Text style={[styles.authButtonText, styles.authButtonTextApple]}>Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.authButton, styles.authButtonWhatsApp]}
            onPress={handleWhatsAppLogin}
            activeOpacity={0.8}
          >
            <MessageCircle
              size={ICON.size.lg}
              color={COLORS.white}
              strokeWidth={ICON.strokeWidth}
            />
            <Text style={[styles.authButtonText, styles.authButtonTextWhatsApp]}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.authButton, styles.authButtonEmail, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={handleEmailLogin}
            activeOpacity={0.8}
          >
            <AtSign
              size={ICON.size.lg}
              color={COLORS.white}
              strokeWidth={ICON.strokeWidth}
            />
            <Text style={[styles.authButtonText, styles.authButtonTextEmail]}>Email</Text>
          </TouchableOpacity>
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

  authButtonApple: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.black,
  },

  authButtonWhatsApp: {
    backgroundColor: '#25D366',
    borderColor: '#25D366',
  },

  authButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  authButtonTextApple: {
    color: COLORS.white,
  },

  authButtonTextWhatsApp: {
    color: COLORS.white,
  },

  authButtonEmail: {
    // Dynamic colors applied inline
  },

  authButtonTextEmail: {
    color: COLORS.white,
  },

  appleIcon: {
    width: ICON.size.lg,
    height: ICON.size.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  appleIconText: {
    fontSize: ICON.size.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
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
