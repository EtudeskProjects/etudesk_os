import { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { otpService } from '../../src/services/otpService';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function VerifyOTPScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { signIn } = useAuth();

  const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [error, setError] = useState('');

  const inputRefs = useRef<(TextInput | null)[]>([]);

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
      const success = await signIn(email || '', otpCode);

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
      Alert.alert(
        t('common.error'),
        t('auth.verifyOtp.verifyError'),
        [{ text: t('common.close') }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    try {
      await otpService.sendOTP(email || '');
      setResendCooldown(RESEND_COOLDOWN);
      setOtp(new Array(OTP_LENGTH).fill(''));
      setError('');
      Alert.alert(
        t('common.success'),
        t('auth.verifyOtp.codeSent'),
        [{ text: t('common.close') }]
      );
    } catch (err) {
      Alert.alert(
        t('common.error'),
        t('auth.emailLogin.sendError'),
        [{ text: t('common.close') }]
      );
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
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.surface }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
            <Mail size={ICON.size.xxl} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('auth.verifyOtp.title')}
          </Text>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('auth.verifyOtp.subtitle')}
          </Text>

          <Text style={[styles.emailText, { color: colors.primary }]}>
            {email}
          </Text>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[
                  styles.otpInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: error ? colors.error : digit ? colors.primary : colors.borderColor,
                    color: colors.textPrimary,
                  },
                ]}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                selectTextOnFocus
                editable={!isLoading}
              />
            ))}
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResendOTP}
            disabled={resendCooldown > 0 || isLoading}
            activeOpacity={0.8}
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
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.verifyButton,
              { backgroundColor: colors.primary },
              (!isOtpComplete || isLoading) && styles.verifyButtonDisabled,
            ]}
            onPress={handleVerifyOTP}
            activeOpacity={0.8}
            disabled={!isOtpComplete || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={[styles.verifyButtonText, { color: colors.textOnPrimary }]}>{t('auth.verifyOtp.verify')}</Text>
            )}
          </TouchableOpacity>
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

  otpInput: {
    width: 48,
    height: 56,
    borderWidth: BORDER.width.medium,
    borderRadius: BORDER.radius.sm,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
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
