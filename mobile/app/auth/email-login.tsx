import { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, AtSign, ArrowRight } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, LAYOUT, BORDER, OPACITY, withOpacity } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import { useForm, validators } from '../../src/hooks/useForm';
import { otpService } from '../../src/services/otpService';
import { Button, IconButton, Input } from '../../src/components/ui';
import { useAlert } from '../../src/contexts/AlertContext';

export default function EmailLoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const scrollViewRef = useRef<ScrollView>(null);
  const emailContainerY = useRef(0);
  const alerts = useAlert();

  const form = useForm({
    fields: {
      email: {
        initialValue: '',
        required: true,
        requiredMessage: t('errors.required'),
        validate: (value: string) => {
          if (!value) return null;
          return validators.email(value) ? t('errors.invalidEmail') : null;
        },
      },
    },
    onSubmit: async (values) => {
      await otpService.sendOTP(values.email);
      router.push({
        pathname: '/auth/verify-otp',
        params: { email: values.email },
      });
    },
  });

  const handleSendOTP = useCallback(async () => {
    try {
      await form.handleSubmit();
    } catch (err) {
      await alerts.showAlert({
        type: 'error',
        title: t('common.error'),
        message: t('auth.emailLogin.sendError'),
        buttons: [
          { text: t('common.retry'), onPress: handleSendOTP },
          { text: t('common.cancel'), style: 'cancel' },
        ],
      });
    }
  }, [alerts, form, t]);

  const handleEmailFocus = useCallback(() => {
    if (Platform.OS !== 'android') return;
    setTimeout(() => {
      const y = Math.max(0, emailContainerY.current - 80);
      scrollViewRef.current?.scrollTo({ y, animated: true });
    }, 120);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <IconButton
            onPress={() => router.back()}
            icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
            accessibilityLabel={t('common.back')}
            variant="filled"
          />
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={[styles.iconContainer, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
              <AtSign size={ICON.size.xxl} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            </View>

            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('auth.emailLogin.title')}
            </Text>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('auth.emailLogin.subtitle')}
            </Text>

            <View
              style={styles.inputContainer}
              onLayout={(e) => {
                emailContainerY.current = e.nativeEvent.layout.y;
              }}
            >
              <Input
                label={t('auth.emailLogin.emailLabel')}
                placeholder={t('auth.login.emailPlaceholder')}
                value={form.getValue('email')}
                onChangeText={(text) => form.setValue('email', text)}
                onBlur={() => form.setTouched('email')}
                onFocus={handleEmailFocus}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                autoFocus={true}
                editable={!form.state.isSubmitting}
                leftIcon={<AtSign size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />}
                error={form.getError('email') || undefined}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <Button
              title={t('auth.emailLogin.sendCode')}
              onPress={handleSendOTP}
              loading={form.state.isSubmitting}
              disabled={!form.getValue('email').trim() || form.state.isSubmitting}
              icon={<ArrowRight size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
              iconPosition="right"
              size="lg"
              fullWidth
              style={styles.submitButton}
            />

            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {t('auth.emailLogin.infoText')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  keyboardView: {
    flex: 1,
  },

  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: SPACING.xxl,
  },

  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    paddingBottom: SPACING.xl,
  },

  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: BORDER.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },

  title: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },

  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.md * 1.5,
    marginBottom: SPACING.xl,
  },

  inputContainer: {
    marginTop: SPACING.lg,
  },

  footer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  submitButton: {
    marginTop: SPACING.md,
  },

  infoText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: TYPOGRAPHY.fontSize.xs * 1.5,
  },
});
