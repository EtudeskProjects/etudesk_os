import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles, Search, Users, MessageCircle, ArrowRight } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../src/constants/theme';
import { Button } from '../../src/components/ui';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';

const { height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  const handleStart = () => {
    router.replace('/(tabs)/home');
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
        {/* Header with celebration */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
            <Sparkles
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

  header: {
    alignItems: 'center',
    paddingTop: height * 0.06,
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
});
