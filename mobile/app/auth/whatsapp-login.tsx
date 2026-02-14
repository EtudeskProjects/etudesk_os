import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { Button, IconButton, Input, KeyboardAwareScrollView } from '../../src/components/ui';

function isPhoneInvalid(value: string): boolean {
  const cleaned = value.replace(/[^\d+]/g, '');
  return !/^\+?\d{8,15}$/.test(cleaned);
}

export default function WhatsAppLoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const alerts = useAlert();

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
  }, [alerts, form, t]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel="Retour"
          size="sm"
          variant="filled"
          style={[styles.backButton, { backgroundColor: colors.surface }]}
        />
      </View>

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
            <Input
              label={t('auth.whatsappLogin.phoneLabel')}
              placeholder="+2250700000000"
              value={form.getValue('phone')}
              onChangeText={(text) => form.setValue('phone', text)}
              onBlur={() => form.setTouched('phone')}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={true}
              editable={!form.state.isSubmitting}
              leftIcon={<MessageCircle size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />}
              error={form.getError('phone') || undefined}
              inputContainerStyle={[
                styles.inputWrapper,
                { backgroundColor: colors.surface, borderColor: form.getError('phone') ? colors.error : colors.borderColor },
              ]}
              inputStyle={[styles.input, { color: colors.textPrimary, paddingHorizontal: 0 }]}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            title={t('auth.whatsappLogin.sendCode')}
            onPress={handleSendOTP}
            disabled={!form.getValue('phone').trim() || form.state.isSubmitting}
            loading={form.state.isSubmitting}
            fullWidth
            icon={<ArrowRight size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
            iconPosition="right"
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary },
              (!form.getValue('phone').trim() || form.state.isSubmitting) && styles.submitButtonDisabled,
            ]}
            textStyle={[styles.submitButtonText, { color: colors.textOnPrimary }]}
          />

          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {t('auth.whatsappLogin.infoText')}
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
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
