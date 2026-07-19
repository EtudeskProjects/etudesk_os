import { View, Text, StyleSheet, Dimensions, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PartyPopper, Search, Users, MessageCircle, ArrowRight, Globe, X } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../src/constants/theme';
import { Button, IconButton, SelectCard } from '../../src/components/ui';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import { LANGUAGE_OPTIONS } from '../../src/i18n';
import { useState } from 'react';
import { trackProductEvent } from '../../src/services/productEventService';

const { height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, language, setLanguage } = useI18n();
  const { finishWelcome } = useAuth();
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  const handleStart = () => {
    void trackProductEvent('welcome_started');
    finishWelcome();
    router.replace({ pathname: '/(tabs)/assistant', params: { mode: 'explore', prompt: t('auth.welcome.getStarted') } });
  };

  const features = [
    {
      icon: Search,
      title: t('auth.welcome.features.explore.title'),
      description: t('auth.welcome.features.explore.description'),
    },
    {
      icon: Users,
      title: t('auth.welcome.features.connect.title'),
      description: t('auth.welcome.features.connect.description'),
    },
    {
      icon: MessageCircle,
      title: t('auth.welcome.features.assistant.title'),
      description: t('auth.welcome.features.assistant.description'),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Top bar with discreet language toggle */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => setShowLanguageModal(true)}
            style={[styles.languageTrigger, { borderColor: colors.gray200, backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel={t('auth.welcome.languageTitle')}
          >
            <Globe size={ICON.size.sm} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.languageTriggerText, { color: colors.gray900 }]}>
              {LANGUAGE_OPTIONS.find((option) => option.id === language)?.flag || language.toUpperCase()}
            </Text>
          </Pressable>
        </View>

        {/* Header with celebration */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
            <PartyPopper
              size={ICON.size.xl * 1.5}
              color={colors.primary}
              strokeWidth={ICON.strokeWidth}
            />
          </View>

          <Text style={[styles.congratsText, { color: colors.primary }]}>{t('auth.welcome.congrats')}</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('auth.welcome.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('auth.welcome.subtitle')}
          </Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <Text style={[styles.featuresTitle, { color: colors.textPrimary }]}>{t('auth.welcome.whatYouCanDo')}</Text>

          {features.map((feature, index) => {
            const FeatureIcon = feature.icon;
            return (
              <View key={index} style={styles.featureItem}>
                <View style={[styles.featureIconContainer, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
                  <FeatureIcon
                    size={ICON.size.md}
                    color={colors.primary}
                    strokeWidth={ICON.strokeWidth}
                  />
                </View>
                <View style={styles.featureContent}>
                  <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>{feature.title}</Text>
                  <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>{feature.description}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title={t('auth.welcome.getStarted')}
            onPress={handleStart}
            fullWidth
            icon={
              <ArrowRight
                size={ICON.size.md}
                color={colors.textOnPrimary}
                strokeWidth={ICON.strokeWidth}
              />
            }
            iconPosition="right"
          />
        </View>
      </View>

      {/* Language modal */}
      <Modal visible={showLanguageModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowLanguageModal(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.gray900 }]}>
                  {t('auth.welcome.languageTitle')}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.gray600 }]}>
                  {t('auth.welcome.languageSubtitle')}
                </Text>
              </View>
              <IconButton
                onPress={() => setShowLanguageModal(false)}
                icon={<X size={ICON.size.sm} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
                accessibilityLabel={t('common.close')}
                variant="ghost"
                size="sm"
              />
            </View>
            <View style={styles.modalLanguageOptions}>
              {LANGUAGE_OPTIONS.map((option) => (
                <SelectCard
                  key={option.id}
                  selected={language === option.id}
                  onPress={() => {
                    setLanguage(option.id);
                    setShowLanguageModal(false);
                  }}
                  style={styles.modalLanguageCard}
                  accessibilityLabel={`${t('auth.welcome.languageTitle')} ${option.label}`}
                >
                  <Text style={[styles.languageFlag, { color: colors.primary }]}>{option.flag}</Text>
                  <Text style={[styles.languageLabel, { color: colors.textPrimary }]}>{option.label}</Text>
                </SelectCard>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: SPACING.sm,
  },

  languageTrigger: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.full,
    borderWidth: 1,
  },

  languageTriggerText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  header: {
    alignItems: 'center',
    paddingTop: height * 0.01,
    marginBottom: SPACING.xl,
  },

  iconContainer: {
    // Large icon container for welcome celebration - intentional oversized display
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    borderRadius: BORDER.radius.full,
  },

  congratsText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  title: {
    fontSize: TYPOGRAPHY.fontSize.xxxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },

  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.relaxed,
  },

  features: {
    flex: 1,
    paddingTop: SPACING.lg,
  },

  featuresTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.lg,
  },

  featureItem: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: 'flex-start',
  },

  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  featureContent: {
    flex: 1,
  },

  featureTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.xs,
  },

  featureDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.relaxed,
  },

  footer: {
    paddingVertical: SPACING.xl,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(9, 9, 11, 0.5)',
    padding: SPACING.lg,
  },

  modalCard: {
    width: '100%',
    borderRadius: BORDER.radius.lg,
    padding: SPACING.lg,
    borderWidth: 1,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },

  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.xs,
  },

  modalSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  modalLanguageOptions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  modalLanguageCard: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },

  languageFlag: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.xs,
    letterSpacing: 1,
  },

  languageLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});
