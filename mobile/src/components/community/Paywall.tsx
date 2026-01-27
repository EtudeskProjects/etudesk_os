import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
} from 'react-native';
import { Lock, CreditCard, Calendar, CheckCircle } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { PaywallInfo, communitySubscriptionService } from '../../services';

interface PaywallProps {
    paywall: PaywallInfo;
    onSubscriptionSuccess?: () => void;
    onClose?: () => void;
}

const formatPrice = (price: number, currency: string): string => {
    const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency || 'XOF';
    return `${price.toLocaleString('fr-FR')} ${currencySymbol}`;
};

export const Paywall: React.FC<PaywallProps> = ({
    paywall,
    onSubscriptionSuccess,
    onClose,
}) => {
    const { colors } = useTheme();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'info' | 'processing'>('info');

    const hasTrial = paywall.trial_days && paywall.trial_days > 0;
    const isExpired = paywall.subscription_status === 'EXPIRED';
    const isCancelled = paywall.subscription_status === 'CANCELLED';

    const handleSubscribe = async () => {
        setIsLoading(true);
        setStep('processing');

        try {
            // First, create/start the subscription
            const subscribeResult = await communitySubscriptionService.subscribe(paywall.community_id);

            if (!subscribeResult.data?.success) {
                throw new Error('Failed to start subscription');
            }

            const subscription = subscribeResult.data.subscription;

            // If it's a trial, we're done
            if (subscription.status === 'TRIAL') {
                Alert.alert(
                    'Essai gratuit activé',
                    subscribeResult.data.message,
                    [{ text: 'OK', onPress: onSubscriptionSuccess }]
                );
                return;
            }

            // Otherwise, initialize payment
            const paymentResult = await communitySubscriptionService.initializePayment(
                subscription.id,
                'etudesk://community-subscription-callback'
            );

            if (!paymentResult.data?.authorization_url) {
                throw new Error('Failed to get payment URL');
            }

            // Open Paystack payment page
            const canOpen = await Linking.canOpenURL(paymentResult.data.authorization_url);
            if (canOpen) {
                await Linking.openURL(paymentResult.data.authorization_url);
                // Payment verification will happen when user returns via deep link
                Alert.alert(
                    'Paiement en cours',
                    'Complétez le paiement dans votre navigateur. Revenez ici une fois terminé.',
                    [{ text: 'OK' }]
                );
            } else {
                throw new Error('Cannot open payment URL');
            }
        } catch (error: any) {
            console.error('Subscription error:', error);
            Alert.alert(
                'Erreur',
                error?.message || 'Une erreur est survenue. Veuillez réessayer.'
            );
            setStep('info');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReactivate = async () => {
        // For reactivation, we need to create a new payment first
        handleSubscribe();
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
            {/* Header Icon */}
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Lock size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: colors.textPrimary }]}>
                {isExpired ? 'Abonnement expiré' : isCancelled ? 'Abonnement annulé' : 'Contenu réservé aux abonnés'}
            </Text>

            {/* Community Name */}
            <Text style={[styles.communityName, { color: colors.primary }]}>
                {paywall.community_name}
            </Text>

            {/* Description */}
            <Text style={[styles.description, { color: colors.textSecondary }]}>
                {isExpired || isCancelled
                    ? 'Renouvelez votre abonnement pour accéder au contenu de cette communauté.'
                    : 'Abonnez-vous pour accéder à tout le contenu exclusif de cette communauté.'}
            </Text>

            {/* Price Card */}
            <View style={[styles.priceCard, { backgroundColor: colors.gray50, borderColor: colors.borderColor }]}>
                <View style={styles.priceRow}>
                    <CreditCard size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                        Abonnement mensuel
                    </Text>
                </View>
                <Text style={[styles.price, { color: colors.textPrimary }]}>
                    {formatPrice(paywall.monthly_price, paywall.currency)}/mois
                </Text>

                {hasTrial && !isExpired && !isCancelled && (
                    <View style={[styles.trialBadge, { backgroundColor: colors.success + '15' }]}>
                        <Calendar size={14} color={colors.success} strokeWidth={ICON.strokeWidth} />
                        <Text style={[styles.trialText, { color: colors.success }]}>
                            {paywall.trial_days} jours d'essai gratuit
                        </Text>
                    </View>
                )}
            </View>

            {/* Benefits */}
            <View style={styles.benefits}>
                {['Accès à toutes les publications', 'Participation aux événements', 'Sondages et discussions'].map((benefit, index) => (
                    <View key={index} style={styles.benefitRow}>
                        <CheckCircle size={16} color={colors.success} fill={colors.success} strokeWidth={0} />
                        <Text style={[styles.benefitText, { color: colors.textSecondary }]}>
                            {benefit}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Action Button */}
            <TouchableOpacity
                style={[styles.subscribeButton, { backgroundColor: colors.primary }]}
                onPress={isExpired || isCancelled ? handleReactivate : handleSubscribe}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                    <Text style={[styles.subscribeButtonText, { color: colors.textOnPrimary }]}>
                        {hasTrial && !isExpired && !isCancelled
                            ? `Commencer l'essai gratuit`
                            : isExpired || isCancelled
                                ? 'Renouveler mon abonnement'
                                : "S'abonner maintenant"}
                    </Text>
                )}
            </TouchableOpacity>

            {/* Close/Cancel */}
            {onClose && (
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>
                        Plus tard
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: SPACING.xl,
        borderRadius: BORDER.radius.xl,
        alignItems: 'center',
        marginHorizontal: SPACING.lg,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
    },
    title: {
        fontSize: TYPOGRAPHY.fontSize.xl,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
        textAlign: 'center',
        marginBottom: SPACING.xs,
    },
    communityName: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
        textAlign: 'center',
        marginBottom: SPACING.md,
    },
    description: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        textAlign: 'center',
        lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
        marginBottom: SPACING.lg,
    },
    priceCard: {
        width: '100%',
        padding: SPACING.md,
        borderRadius: BORDER.radius.md,
        borderWidth: BORDER.width.thin,
        marginBottom: SPACING.lg,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.xs,
    },
    priceLabel: {
        fontSize: TYPOGRAPHY.fontSize.sm,
    },
    price: {
        fontSize: TYPOGRAPHY.fontSize.xxl,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
        marginBottom: SPACING.sm,
    },
    trialBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.sm,
        borderRadius: BORDER.radius.full,
        gap: SPACING.xs,
    },
    trialText: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    benefits: {
        width: '100%',
        marginBottom: SPACING.lg,
        gap: SPACING.sm,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    benefitText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
    },
    subscribeButton: {
        width: '100%',
        paddingVertical: SPACING.md,
        borderRadius: BORDER.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    subscribeButtonText: {
        fontFamily: TYPOGRAPHY.fontFamily.semibold,
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    closeButton: {
        marginTop: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    closeButtonText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
    },
});

export default Paywall;
