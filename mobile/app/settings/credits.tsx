import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { ArrowLeft, Coins, CreditCard, RefreshCcw, Receipt } from 'lucide-react-native';

import { IconButton, Input, Button, LoadingShimmer } from '../../src/components/ui';
import { useTheme } from '../../src/hooks/useTheme';
import { useSpace } from '../../src/contexts/SpaceContext';
import { billingService, BillingScope, BillingBalance, BillingInvoice } from '../../src/services/billingService';
import { BORDER, ICON, OPACITY, SPACING, TYPOGRAPHY, withOpacity } from '../../src/constants/theme';
import { useAlert } from '../../src/contexts/AlertContext';
import { formatNumberNoTrailingZeros } from '../../src/utils/number';
import { useI18n } from '../../src/contexts/I18nContext';

function parseError(error: any, fallback: string): string {
  if (!error) return fallback;
  return String(error?.error || error?.message || fallback);
}

function formatFcfa(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

function formatCredits(value: number): string {
  return formatNumberNoTrailingZeros(value || 0, 2);
}

export default function CreditsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const { currentSpace, selectedOrgId, selectedOrg } = useSpace();
  const alerts = useAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [balance, setBalance] = useState<BillingBalance | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);

  const [amountInput, setAmountInput] = useState('');

  const scopeConfig = useMemo(() => {
    if (currentSpace === 'organization' && selectedOrgId) {
      return {
        scope: 'ORGANIZATION' as BillingScope,
        ownerId: selectedOrgId,
        label: selectedOrg?.name || t('settings.creditsScreen.organizationLabel'),
        minAmount: 10000,
      };
    }

    return {
      scope: 'TALENT' as BillingScope,
      ownerId: undefined,
      label: t('settings.creditsScreen.myTalentAccount'),
      minAmount: 2000,
    };
  }, [currentSpace, selectedOrgId, selectedOrg?.name, t]);

  const quickPacks = useMemo(
    () => [scopeConfig.minAmount, scopeConfig.minAmount * 2, scopeConfig.minAmount * 5],
    [scopeConfig.minAmount]
  );

  const loadData = useCallback(async (showLoading: boolean = true) => {
    try {
      if (showLoading) setLoading(true);

      const [balanceRes, invoicesRes] = await Promise.all([
        billingService.getBalance(scopeConfig.scope, scopeConfig.ownerId),
        billingService.getInvoices(scopeConfig.scope, scopeConfig.ownerId, 8),
      ]);

      if (balanceRes.data) {
        setBalance(balanceRes.data);
      }

      if (invoicesRes.data) {
        setInvoices(invoicesRes.data);
      }
    } catch (error) {
      void alerts.alert(t('common.error'), parseError(error, t('settings.creditsScreen.genericError')));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [alerts, scopeConfig.ownerId, scopeConfig.scope, t]);

  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const handleCheckout = async () => {
    const amount = Number(amountInput.replace(/\s+/g, ''));

    if (!Number.isFinite(amount) || amount <= 0) {
      void alerts.alert(t('settings.creditsScreen.invalidAmountTitle'), t('settings.creditsScreen.invalidAmountMessage'));
      return;
    }

    if (amount < scopeConfig.minAmount) {
      void alerts.alert(t('settings.creditsScreen.amountTooLowTitle'), t('settings.creditsScreen.amountTooLowMessage', { min: formatFcfa(scopeConfig.minAmount, locale) }));
      return;
    }

    const ownerId = scopeConfig.ownerId || balance?.owner_id;
    if (!ownerId) {
      void alerts.alert(t('common.loading'), t('settings.creditsScreen.walletLoading'));
      return;
    }

    try {
      setSubmitting(true);
      const response = await billingService.initCheckout({
        scope: scopeConfig.scope,
        ownerId,
        amountFcfa: amount,
        metadata: {
          source: 'mobile_settings_credits',
        },
      });

      const payload = response.data;
      if (!payload) {
        void alerts.alert(t('common.error'), t('settings.creditsScreen.invalidPaymentResponse'));
        return;
      }

      if (payload.checkout_url) {
        await Linking.openURL(payload.checkout_url);
      }

      void alerts.alert(t('settings.creditsScreen.paymentStartedTitle'), t('settings.creditsScreen.paymentStartedMessage'));
    } catch (error) {
      void alerts.alert(t('settings.creditsScreen.paymentTitle'), parseError(error, t('settings.creditsScreen.genericError')));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
	        <View style={styles.header}>
		          <IconButton
		            onPress={() => router.back()}
		            icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
		            accessibilityLabel={t('common.back')}
		            style={styles.headerButton}
		          />
		          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings.creditsBilling')}</Text>
		          <View style={styles.headerButton} />
		        </View>
        <View style={styles.loadingContainer}>
          <LoadingShimmer variant="fullPage" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
	      <View style={styles.header}>
		        <IconButton
		          onPress={() => router.back()}
		          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
		          accessibilityLabel={t('common.back')}
		          style={styles.headerButton}
		        />
		        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings.creditsBilling')}</Text>
		        <IconButton
		          onPress={handleRefresh}
		          icon={<RefreshCcw size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
		          accessibilityLabel={t('settings.creditsScreen.refreshA11y')}
		          style={styles.headerButton}
		        />
		      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
	        <View style={[styles.scopeCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}> 
	          <Text style={[styles.scopeLabel, { color: colors.textSecondary }]}>{t('settings.creditsScreen.billedSpace')}</Text>
	          <Text style={[styles.scopeValue, { color: colors.textPrimary }]}>{scopeConfig.label}</Text>
	        </View>

        <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}> 
          <View style={styles.balanceRow}>
	            <Coins size={ICON.size.lg} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
	            <Text style={[styles.balanceTitle, { color: colors.textOnPrimary }]}>{t('settings.creditsScreen.balanceCredits')}</Text>
	          </View>
          <Text style={[styles.balanceValue, { color: colors.textOnPrimary }]}>
            {formatCredits(balance?.balance_credits || 0)}
          </Text>
	          <Text style={[styles.balanceHint, { color: withOpacity(colors.textOnPrimary, OPACITY[80]) }]}> 
	            {t('settings.creditsScreen.lastUpdated')}: {balance?.updated_at ? new Date(balance.updated_at).toLocaleString(locale) : '—'}
	          </Text>
	        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}> 
          <View style={styles.sectionTitleRow}>
	            <CreditCard size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
	            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('settings.creditsScreen.topUp')}</Text>
	          </View>

	          <Input
	            label={t('settings.creditsScreen.amountLabel', { min: formatFcfa(scopeConfig.minAmount, locale) })}
	            value={amountInput}
	            onChangeText={setAmountInput}
	            placeholder={String(scopeConfig.minAmount)}
            keyboardType="number-pad"
          />

	        <View style={styles.quickPackRow}>
	          {quickPacks.map((amount) => (
	              <Pressable
	                key={amount}
	                style={[
	                  styles.quickPack,
	                  { borderColor: colors.borderColor, backgroundColor: colors.gray100 },
	                  submitting && { opacity: 0.6 },
	                ]}
	                onPress={() => setAmountInput(String(amount))}
		                disabled={submitting}
		                accessibilityRole="button"
		                accessibilityLabel={t('settings.creditsScreen.chooseAmountA11y', { amount: formatFcfa(amount, locale) })}
		              >
		                <Text style={[styles.quickPackText, { color: colors.textPrimary }]}>{formatFcfa(amount, locale)} FCFA</Text>
		              </Pressable>
		            ))}
		        </View>

	          <Button
	            title={submitting ? t('settings.creditsScreen.initializing') : t('settings.creditsScreen.payNow')}
	            onPress={handleCheckout}
	            loading={submitting}
	            disabled={submitting}
	          />

	          <Text style={[styles.paymentMethodsText, { color: colors.textSecondary }]}>
	            {t('settings.creditsScreen.availableMethods')}
	          </Text>
	        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}> 
          <View style={styles.sectionTitleRow}>
	            <Receipt size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
	            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('settings.creditsScreen.latestInvoices')}</Text>
	          </View>

	          {invoices.length === 0 ? (
	            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('settings.creditsScreen.noInvoices')}</Text>
	          ) : (
            invoices.map((invoice) => (
              <View key={invoice.id} style={[styles.listItem, { borderBottomColor: colors.borderColor }]}>
                <Text style={[styles.listItemTitle, { color: colors.textPrimary }]}>{invoice.invoice_number}</Text>
	                <Text style={[styles.listItemMeta, { color: colors.textSecondary }]}>
	                  {formatFcfa(Number(invoice.total_fcfa || 0), locale)} FCFA • {invoice.status}
	                </Text>
              </View>
            ))
          )}
        </View>

        {/* Credit ledger intentionally removed from UI */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  scrollView: { flex: 1 },
  scrollContent: {
    gap: SPACING.md,
    paddingBottom: SPACING.xxxl,
    paddingHorizontal: SPACING.lg,
  },
  scopeCard: {
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    gap: SPACING.xs,
    padding: SPACING.md,
  },
  scopeLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  scopeValue: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  balanceCard: {
    borderRadius: BORDER.radius.lg,
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  balanceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  balanceTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  balanceValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 32,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    letterSpacing: -0.5,
  },
  balanceHint: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  section: {
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    gap: SPACING.md,
    padding: SPACING.md,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  quickPackRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  quickPack: {
    borderRadius: BORDER.radius.sm,
    borderWidth: BORDER.width.thin,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  quickPackText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  listItem: {
    borderBottomWidth: BORDER.width.thin,
    gap: 2,
    paddingBottom: SPACING.sm,
  },
  listItemTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  listItemMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  paymentMethodsText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    opacity: 0.85,
  },
});
