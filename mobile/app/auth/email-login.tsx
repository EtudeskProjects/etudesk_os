import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
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

export default function EmailLoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

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
      Alert.alert(
        t('common.error'),
        t('auth.emailLogin.sendError'),
        [{ text: t('common.retry'), onPress: handleSendOTP }, { text: t('common.cancel') }]
      );
    }
  }, [form, t]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.surface }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
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

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('auth.emailLogin.emailLabel')}
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: colors.surface, borderColor: form.getError('email') ? colors.error : colors.borderColor },
                ]}
              >
                <AtSign size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder={t('auth.login.emailPlaceholder')}
                  placeholderTextColor={colors.gray400}
                  value={form.getValue('email')}
                  onChangeText={(text) => form.setValue('email', text)}
                  onBlur={() => form.setTouched('email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  autoFocus={true}
                  editable={!form.state.isSubmitting}
                />
              </View>
              {form.getError('email') ? (
                <Text style={[styles.errorText, { color: colors.error }]}>{form.getError('email')}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                (!form.getValue('email').trim() || form.state.isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSendOTP}
              activeOpacity={0.8}
              disabled={!form.getValue('email').trim() || form.state.isSubmitting}
            >
              {form.state.isSubmitting ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <>
                  <Text style={[styles.submitButtonText, { color: colors.textOnPrimary }]}>{t('auth.emailLogin.sendCode')}</Text>
                  <ArrowRight size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                </>
              )}
            </TouchableOpacity>

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

  backButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
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

  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.sm,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: LAYOUT.buttonHeight,
    paddingHorizontal: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    gap: SPACING.sm,
  },

  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  errorText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
  },

  footer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: LAYOUT.buttonHeight,
    borderRadius: BORDER.radius.sm,
    gap: SPACING.sm,
  },

  submitButtonDisabled: {
    opacity: 0.6,
  },

  submitButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  infoText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: TYPOGRAPHY.fontSize.xs * 1.5,
  },
});
