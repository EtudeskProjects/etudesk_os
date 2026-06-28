import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AtSign } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { SPACING, TYPOGRAPHY, ICON, LAYOUT, BORDER } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { SelectCard } from '../../src/components/ui';

WebBrowser.maybeCompleteAuthSession();

// All client IDs must be from the same Google Cloud project (179108590788)
const GOOGLE_WEB_CLIENT_ID = '179108590788-i7lpp0ef6ffj1uklf5tegfo453vg337e.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '179108590788-7oklrr2vai9g12alnn3b3o42i0q9s1qj.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '179108590788-3thuhbkilqqc6vd1oavle46cf22tt0li.apps.googleusercontent.com';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const alerts = useAlert();
  const { signInGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      if (id_token) {
        handleGoogleSignIn(id_token);
      }
    } else if (response?.type === 'error') {
      setGoogleLoading(false);
      void alerts.showAlert({
        title: t('common.error'),
        message: t('auth.login.googleError'),
        buttons: [{ text: 'OK' }],
      });
    } else if (response?.type === 'dismiss') {
      setGoogleLoading(false);
    }
  }, [response]);

  const handleGoogleSignIn = async (idToken: string) => {
    try {
      setGoogleLoading(true);
      const success = await signInGoogle(idToken);
      if (!success) {
        void alerts.showAlert({
          title: t('common.error'),
          message: t('auth.login.googleError'),
          buttons: [{ text: 'OK' }],
        });
      }
    } catch {
      void alerts.showAlert({
        title: t('common.error'),
        message: t('auth.login.googleError'),
        buttons: [{ text: 'OK' }],
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    promptAsync();
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

          {/* TODO: Google OAuth — réactiver quand les client IDs seront configurés en production */}

          <SelectCard
            style={[styles.authButton, styles.authButtonEmail, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={handleEmailLogin}
            selected={false}
            accessibilityLabel={t('common.continueWith') + ' Email'}
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
