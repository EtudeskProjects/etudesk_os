import { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MessageCircle, ArrowRight } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, LAYOUT, BORDER, OPACITY, withOpacity } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import { useForm } from '../../src/hooks/useForm';
import { otpService } from '../../src/services/otpService';
import { useAlert } from '../../src/contexts/AlertContext';

function isPhoneInvalid(value: string): boolean {
  const cleaned = value.replace(/[^\d+]/g, '');
  return !/^\+?\d{8,15}$/.test(cleaned);
}

export default function WhatsAppLoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const scrollViewRef = useRef<ScrollView>(null);

  const form = useForm({
    fields: {
      phone: {
        initialValue: '',
        required: true,
        requiredMessage: t('errors.required'),
        validate: (value: string) => {
          if (!value) return null;
          return isPhoneInvalid(value) ? t('errors.invalidPhone') : null;
        },
      },
    },
    onSubmit: async (values) => {
      const phone = values.phone.trim();
      await otpService.sendWhatsAppOTP(phone);
      router.push({
        pathname: '/auth/verify-otp',
        params: { phone, channel: 'whatsapp' },
      });
    },
  });

  const handleSendOTP = useCallback(async () => {
    try {
      await form.handleSubmit();
    } catch {
      void alerts.showAlert({ title: t('common.error'), message: t('auth.whatsappLogin.sendError'), buttons: [{ text: t('common.retry'), onPress: handleSendOTP }, { text: t('common.cancel') }] });
    }
  }, [form, t]);

  const handlePhoneFocus = useCallback(() => {
    if (Platform.OS !== 'android') return;
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 220, animated: true });
    }, 120);
  }, []);
  const alerts = useAlert();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
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
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={[styles.iconContainer, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
              <MessageCircle size={ICON.size.xxl} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            </View>

            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('auth.whatsappLogin.title')}
            </Text>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('auth.whatsappLogin.subtitle')}
            </Text>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('auth.whatsappLogin.phoneLabel')}
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: colors.surface, borderColor: form.getError('phone') ? colors.error : colors.borderColor },
                ]}
              >
                <MessageCircle size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="+2250700000000"
                  placeholderTextColor={colors.gray400}
                  value={form.getValue('phone')}
                  onChangeText={(text) => form.setValue('phone', text)}
                  onBlur={() => form.setTouched('phone')}
                  onFocus={handlePhoneFocus}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus={true}
                  editable={!form.state.isSubmitting}
                />
              </View>
              {form.getError('phone') ? (
                <Text style={[styles.errorText, { color: colors.error }]}>{form.getError('phone')}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                (!form.getValue('phone').trim() || form.state.isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSendOTP}
              activeOpacity={0.8}
              disabled={!form.getValue('phone').trim() || form.state.isSubmitting}
            >
              {form.state.isSubmitting ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <>
                  <Text style={[styles.submitButtonText, { color: colors.textOnPrimary }]}>{t('auth.whatsappLogin.sendCode')}</Text>
                  <ArrowRight size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {t('auth.whatsappLogin.infoText')}
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
    gap: SPACING.md,
  },
  submitButton: {
    height: LAYOUT.buttonHeight,
    borderRadius: BORDER.radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  infoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },
});
