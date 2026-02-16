import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  type TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, MessageCircle, CheckCircle } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { otpService } from '../../src/services/otpService';
import { useAlert } from '../../src/contexts/AlertContext';
import { Button, IconButton, Input, SelectCard } from '../../src/components/ui';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function VerifyOTPScreen() {
  const router = useRouter();
  const { email, phone, channel } = useLocalSearchParams<{ email?: string; phone?: string; channel?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { signIn, signInWhatsApp } = useAuth();
  const isWhatsAppFlow = channel === 'whatsapp';
  const identifier = isWhatsAppFlow ? (phone || '') : (email || '');

  const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [error, setError] = useState('');

  const inputRefs = useRef<(RNTextInput | null)[]>([]);
  const alerts = useAlert();

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleOtpChange = (value: string, index: number) => {
    setError('');

    // Filter only digits
    const cleanValue = value.replace(/[^0-9]/g, '');

    if (cleanValue.length > 1) {
      // Handle paste - distribute digits across all inputs starting from index 0
      const pastedCode = cleanValue.slice(0, OTP_LENGTH).split('');
      const newOtp = new Array(OTP_LENGTH).fill('');
      pastedCode.forEach((char, i) => {
        if (i < OTP_LENGTH) {
          newOtp[i] = char;
        }
      });
      setOtp(newOtp);

      // Focus last filled input or trigger verification if complete
      const lastFilledIndex = Math.min(pastedCode.length, OTP_LENGTH) - 1;
      inputRefs.current[lastFilledIndex]?.focus();
    } else {
      const newOtp = [...otp];
      newOtp[index] = cleanValue;
      setOtp(newOtp);

      if (cleanValue && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');

    if (otpCode.length !== OTP_LENGTH) {
      setError(t('auth.verifyOtp.incompleteCode'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Use AuthContext signIn which properly updates auth state
      // Navigation will be handled automatically by AuthContext's navigation guard
      const success = isWhatsAppFlow
        ? await signInWhatsApp(phone || '', otpCode)
        : await signIn(email || '', otpCode);

      if (success) {
        setIsVerified(true);
        // AuthContext navigation guard will redirect to the appropriate screen
        // based on needsOnboarding status after showing success animation
      } else {
        setError(t('auth.verifyOtp.invalidCode'));
        setOtp(new Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      void alerts.showAlert({ title: t('common.error'), message: t('auth.verifyOtp.verifyError'), buttons: [{ text: t('common.close') }] });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    try {
      if (isWhatsAppFlow) {
        await otpService.sendWhatsAppOTP(phone || '');
      } else {
        await otpService.sendOTP(email || '');
      }
      setResendCooldown(RESEND_COOLDOWN);
      setOtp(new Array(OTP_LENGTH).fill(''));
      setError('');
      void alerts.showAlert({ title: t('common.success'), message: t('auth.verifyOtp.codeSent'), buttons: [{ text: t('common.close') }] });
    } catch (err) {
      void alerts.showAlert({ title: t('common.error'), message: isWhatsAppFlow ? t('auth.whatsappLogin.sendError') : t('auth.emailLogin.sendError'), buttons: [{ text: t('common.close') }] });
    } finally {
      setIsLoading(false);
    }
  };

  const isOtpComplete = otp.every((digit) => digit !== '');

  if (isVerified) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: withOpacity(colors.success, OPACITY[15]) }]}>
            <CheckCircle size={ICON.size.xxl} color={colors.success} strokeWidth={ICON.strokeWidth} />
          </View>
          <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
            {t('auth.verifyOtp.verified')}
          </Text>
          <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
            {t('auth.verifyOtp.redirecting')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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

        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
            {isWhatsAppFlow ? (
              <MessageCircle size={ICON.size.xxl} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            ) : (
              <Mail size={ICON.size.xxl} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            )}
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isWhatsAppFlow ? t('auth.verifyOtp.titleWhatsApp') : t('auth.verifyOtp.title')}
          </Text>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isWhatsAppFlow ? t('auth.verifyOtp.subtitleWhatsApp') : t('auth.verifyOtp.subtitle')}
          </Text>

          <Text style={[styles.emailText, { color: colors.primary }]}>
            {identifier}
          </Text>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <Input
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                selectTextOnFocus
                editable={!isLoading}
                containerStyle={{ width: 48 }}
                inputContainerStyle={{
                  width: 48,
                  height: 56,
                  borderWidth: BORDER.width.medium,
                  borderRadius: BORDER.radius.sm,
                  backgroundColor: colors.surface,
                  borderColor: error ? colors.error : digit ? colors.primary : colors.borderColor,
                }}
                inputStyle={{
                  color: colors.textPrimary,
                  fontSize: TYPOGRAPHY.fontSize.xl,
                  fontWeight: TYPOGRAPHY.fontWeight.bold,
                  textAlign: 'center',
                  paddingVertical: 0,
                  paddingHorizontal: 0,
                }}
              />
            ))}
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          ) : null}

          <SelectCard
            style={[styles.resendButton, { borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent' }]}
            onPress={() => {
              if (resendCooldown > 0 || isLoading) return;
              void handleResendOTP();
            }}
            selected={false}
            accessibilityLabel="Renvoyer le code"
          >
            <Text
              style={[
                styles.resendText,
                { color: resendCooldown > 0 ? colors.gray400 : colors.primary },
              ]}
            >
              {resendCooldown > 0
                ? t('auth.verifyOtp.resendIn', { seconds: resendCooldown })
                : t('auth.verifyOtp.resendCode')}
            </Text>
          </SelectCard>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(SPACING.lg, insets.bottom + SPACING.md) }]}>
          <Button
            title={t('auth.verifyOtp.verify')}
            onPress={handleVerifyOTP}
            disabled={!isOtpComplete || isLoading}
            loading={isLoading}
            fullWidth
            style={[
              styles.verifyButton,
              { backgroundColor: colors.primary },
              (!isOtpComplete || isLoading) && styles.verifyButtonDisabled,
            ]}
            textStyle={[styles.verifyButtonText, { color: colors.textOnPrimary }]}
          />
        </View>
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

  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: BORDER.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
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
  },

  emailText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xl,
  },

  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  errorText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },

  resendButton: {
    marginTop: SPACING.lg,
    padding: SPACING.sm,
  },

  resendText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  footer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  verifyButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: BORDER.radius.sm,
  },

  verifyButtonDisabled: {
    opacity: 0.6,
  },

  verifyButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },

  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },

  successTitle: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },

  successSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
  },
});
