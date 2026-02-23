import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Smartphone,
  Check,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../src/constants/theme';
import { Button, IconButton, Input, LoadingShimmer, SelectCard } from '../../src/components/ui';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import { paymentService, PaymentMethod, PaymentProvider, PAYMENT_PROVIDERS } from '../../src/services/paymentService';
import { useAlert } from '../../src/contexts/AlertContext';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Fetch payment methods on mount
  const fetchPaymentMethods = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      const response = await paymentService.getPaymentMethods();
      if (response.data) {
        setPaymentMethods(response.data);
      }
    } catch (error) {
      if (__DEV__) console.error('Error fetching payment methods:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  const alerts = useAlert();

  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchPaymentMethods(false);
  };

  const validatePhone = (phone: string): string | null => {
    const cleanPhone = phone.replace(/\s+/g, '');
    if (!cleanPhone) {
      return t('payment.phoneRequired');
    }
    if (cleanPhone.length < 8) {
      return t('payment.phoneMinDigits');
    }
    if (!/^[\d+]+$/.test(cleanPhone)) {
      return t('payment.phoneDigitsOnly');
    }
    return null;
  };

  const handlePhoneChange = (text: string) => {
    setPhoneNumber(text);
    // Clear error when user starts typing
    if (phoneError) {
      setPhoneError(null);
    }
    if (formError) {
      setFormError(null);
    }
  };

  const handleAddMethod = async () => {
    // Reset errors
    setFormError(null);
    setPhoneError(null);

    // Validate provider
    if (!selectedProvider) {
      setFormError(t('payment.selectProvider'));
      return;
    }

    // Validate phone
    const phoneValidationError = validatePhone(phoneNumber);
    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await paymentService.addPaymentMethod({
        provider: selectedProvider,
        phone: phoneNumber.trim(),
      });

      if (response.data) {
        setPaymentMethods([...paymentMethods, response.data]);
        setIsAdding(false);
        setSelectedProvider(null);
        setPhoneNumber('');
        setFormError(null);
        setPhoneError(null);
      } else if (response.error) {
        // Map backend errors to user-friendly messages
        const errorMessage = mapErrorMessage(response.error);
        if (response.error.toLowerCase().includes('phone')) {
          setPhoneError(errorMessage);
        } else {
          setFormError(errorMessage);
        }
      }
    } catch (error) {
      setFormError(t('common.genericError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const mapErrorMessage = (error: string): string => {
    const errorMap: Record<string, string> = {
      'Invalid phone number': t('payment.invalidPhone'),
      'Invalid payment provider': t('payment.invalidProvider'),
      'This payment method already exists': t('payment.alreadyExists'),
    };
    return errorMap[error] || error;
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await paymentService.setDefaultPaymentMethod(id);
      if (response.data) {
        setPaymentMethods(response.data);
      }
    } catch (error) {
      void alerts.alert(t('common.error'), t('payment.errorOccurred'));
    }
  };

  const handleDelete = (id: string) => {
    void alerts.showAlert({ title: t('payment.deleteTitle'), message: t('payment.deleteConfirm'), buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await paymentService.deletePaymentMethod(id);
              if (response.data) {
                setPaymentMethods(response.data);
              }
            } catch (error) {
              void alerts.alert(t('common.error'), t('payment.errorOccurred'));
            }
          },
        },
      ] });
  };

  const getProviderInfo = (providerId: PaymentProvider) => {
    return PAYMENT_PROVIDERS.find(p => p.id === providerId);
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setSelectedProvider(null);
    setPhoneNumber('');
    setFormError(null);
    setPhoneError(null);
  };

  const handleSelectProvider = (providerId: PaymentProvider) => {
    setSelectedProvider(providerId);
    if (formError) {
      setFormError(null);
    }
  };

  const renderAddForm = () => (
    <View style={[styles.addForm, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <Text style={[styles.formTitle, { color: colors.textPrimary }]}>
        {t('payment.addMethod')}
      </Text>

      {/* Form-level error */}
      {formError && (
        <View style={[styles.errorBanner, { backgroundColor: withOpacity(colors.error, OPACITY[15]) }]}>
          <Text style={[styles.errorBannerText, { color: colors.error }]}>{formError}</Text>
        </View>
      )}

      <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('payment.provider')}</Text>
      <View style={styles.providersGrid}>
        {PAYMENT_PROVIDERS.map((provider) => (
          <SelectCard
            key={provider.id}
            style={[
              styles.providerCard,
              { borderColor: colors.gray200, backgroundColor: colors.gray50 },
              selectedProvider === provider.id && { borderColor: provider.color, backgroundColor: withOpacity(provider.color, OPACITY[15]) },
              { borderRadius: BORDER.radius.sm },
            ]}
            onPress={() => {
              if (isSubmitting) return;
              handleSelectProvider(provider.id);
            }}
            selected={false}
            accessibilityLabel={provider.label}
          >
            <View style={[styles.providerIcon, { backgroundColor: provider.color }]}>
              <Smartphone size={ICON.size.sm} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
            </View>
            <Text style={[styles.providerLabel, { color: colors.textPrimary }]}>
              {provider.label}
            </Text>
            {selectedProvider === provider.id && (
              <View style={[styles.checkMark, { backgroundColor: provider.color }]}>
                <Check size={12} color={colors.textOnPrimary} strokeWidth={3} />
              </View>
            )}
          </SelectCard>
        ))}
      </View>

      <View style={styles.phoneInput}>
        <Input
          label={t('payment.phoneLabel')}
          placeholder={t('payment.phonePlaceholder')}
          value={phoneNumber}
          onChangeText={handlePhoneChange}
          keyboardType="phone-pad"
          editable={!isSubmitting}
          error={phoneError || undefined}
        />
      </View>

      <View style={styles.formActions}>
        <Button
          title={t('common.cancel')}
          onPress={handleCancelAdd}
          disabled={isSubmitting}
          variant="outline"
          style={[styles.cancelButton, { borderColor: colors.gray200 }]}
          textStyle={[styles.cancelButtonText, { color: colors.textSecondary }]}
        />
        <View style={styles.addButtonContainer}>
          <Button
            title={isSubmitting ? t('payment.adding') : t('common.add')}
            onPress={handleAddMethod}
            disabled={isSubmitting}
            loading={isSubmitting}
          />
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <IconButton
            onPress={() => router.back()}
            icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
            accessibilityLabel={t('common.back')}
          />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('payment.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingShimmer variant="fullPage" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel={t('common.back')}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('payment.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Info */}
        <View style={[styles.infoCard, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
          <Text style={[styles.infoText, { color: colors.primary }]}>
            {t('payment.infoText')}
          </Text>
        </View>

        {/* Payment Methods List */}
        {paymentMethods.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {t('payment.myMethods')}
            </Text>
            <View style={[styles.methodsList, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
              {paymentMethods.map((method, index) => {
                const providerInfo = getProviderInfo(method.provider);
                return (
                  <SelectCard
                    key={method.id}
                    style={[
                      styles.methodItem,
                      { borderBottomColor: colors.gray100 },
                      index === paymentMethods.length - 1 && styles.methodItemLast,
                      { borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0 },
                    ]}
                    onPress={() => handleSetDefault(method.id)}
                    selected={false}
                    accessibilityLabel={t('payment.setDefault', { provider: providerInfo?.label || '' })}
                  >
                    <View style={[styles.methodIcon, { backgroundColor: providerInfo?.color }]}>
                      <Smartphone size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                    </View>
                    <View style={styles.methodInfo}>
                      <Text style={[styles.methodName, { color: colors.textPrimary }]}>
                        {providerInfo?.label}
                      </Text>
                      <Text style={[styles.methodPhone, { color: colors.textSecondary }]}>
                        {method.phone}
                      </Text>
                    </View>
                    {method.isDefault && (
                      <View style={[styles.defaultBadge, { backgroundColor: withOpacity(colors.success, OPACITY[20]) }]}>
                        <Text style={[styles.defaultBadgeText, { color: colors.success }]}>{t('payment.default')}</Text>
                      </View>
                    )}
                    <IconButton
                      onPress={() => handleDelete(method.id)}
                      icon={<Trash2 size={ICON.size.sm} color={colors.error} strokeWidth={ICON.strokeWidth} />}
                      accessibilityLabel={t('common.delete')}
                      style={styles.deleteButton}
                    />
                  </SelectCard>
                );
              })}
            </View>
          </View>
        )}

        {/* Empty State */}
        {paymentMethods.length === 0 && !isAdding && (
          <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
            <Smartphone size={ICON.size.xxl} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>
              {t('payment.noMethods')}
            </Text>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              {t('payment.noMethodsHint')}
            </Text>
          </View>
        )}

        {/* Add Form or Button */}
        {isAdding ? (
          renderAddForm()
        ) : (
          <Button
            title={t('payment.addMethod')}
            onPress={() => setIsAdding(true)}
            variant="outline"
            fullWidth
            icon={<Plus size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
            style={[styles.addButton, { borderColor: colors.primary }]}
            textStyle={[styles.addButtonText, { color: colors.primary }]}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  headerSpacer: {
    width: 40,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  infoCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.lg,
  },

  infoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },

  section: {
    marginBottom: SPACING.lg,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },

  methodsList: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
  },

  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },

  methodItemLast: {
    borderBottomWidth: 0,
  },

  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  methodInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },

  methodName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  methodPhone: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  defaultBadge: {
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
    marginRight: SPACING.sm,
  },

  defaultBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  deleteButton: {
    padding: SPACING.xs,
    marginRight: SPACING.sm,
  },

  emptyState: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
  },

  emptyStateTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.md,
  },

  emptyStateText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderStyle: 'dashed',
    borderRadius: BORDER.radius.sm,
  },

  addButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Add Form
  addForm: {
    padding: SPACING.lg,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
  },

  formTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.lg,
  },

  errorBanner: {
    padding: SPACING.sm,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.md,
  },

  errorBannerText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textAlign: 'center',
  },

  fieldLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.sm,
  },

  providersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  providerCard: {
    width: '48%',
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    position: 'relative',
  },

  providerIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },

  providerLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  checkMark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  phoneInput: {
    marginBottom: SPACING.lg,
  },

  formActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
  },

  cancelButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  addButtonContainer: {
    flex: 1,
  },
});
