import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, ScrollView, NativeSyntheticEvent, NativeScrollEvent, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Globe, X } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../src/constants/theme';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/hooks/useTheme';
import { useI18n } from '../src/contexts/I18nContext';
import { Button, IconButton, LoadingShimmer, SelectCard } from '../src/components/ui';
import { LANGUAGE_OPTIONS } from '../src/i18n';

const { height, width } = Dimensions.get('window');

const STORAGE_KEY_ONBOARDING_SEEN = 'onboarding_seen';

const SLIDES = [
  {
    id: 1,
    image: require('../assets/onboarding_1.jpg'),
    titleKey: 'onboarding.slide1Title',
    descKey: 'onboarding.slide1Desc',
  },
  {
    id: 2,
    image: require('../assets/onboarding_2.jpg'),
    titleKey: 'onboarding.slide2Title',
    descKey: 'onboarding.slide2Desc',
  },
  {
    id: 3,
    image: require('../assets/onboarding_3.jpg'),
    titleKey: 'onboarding.slide3Title',
    descKey: 'onboarding.slide3Desc',
  },
];

export default function SplashScreen() {
  const router = useRouter();
  const { status, isLoading, needsOnboarding } = useAuth();
  const { colors } = useTheme();
  const { t, language, setLanguage } = useI18n();
  const insets = useSafeAreaInsets();
  const slidesRef = useRef<ScrollView>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // Check if onboarding has been seen before
  useEffect(() => {
    checkOnboardingSeen();
  }, []);

  // Handle auth state changes
  useEffect(() => {
    if (isLoading || checkingOnboarding) return;

    // If authenticated and has complete profile, go to main app
    if (status === 'authenticated' && !needsOnboarding) {
      router.replace('/(tabs)/home');
      return;
    }

    // If authenticated but needs onboarding (profile creation)
    if (status === 'authenticated' && needsOnboarding) {
      router.replace('/auth/create-profile');
      return;
    }

    // If not authenticated but has seen onboarding, go to login
    if (status === 'unauthenticated' && hasSeenOnboarding) {
      router.replace('/auth/login');
      return;
    }

    // Otherwise, show onboarding slides
  }, [status, isLoading, needsOnboarding, checkingOnboarding, hasSeenOnboarding, router]);

  const checkOnboardingSeen = async () => {
    try {
      const seen = await AsyncStorage.getItem(STORAGE_KEY_ONBOARDING_SEEN);
      setHasSeenOnboarding(seen === 'true');
    } catch {
    } finally {
      setCheckingOnboarding(false);
    }
  };

  const markOnboardingSeen = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ONBOARDING_SEEN, 'true');
    } catch {
    }
  };

  const handleNext = async () => {
    if (currentSlide < SLIDES.length - 1) {
      const nextSlide = currentSlide + 1;
      slidesRef.current?.scrollTo({ x: nextSlide * width, animated: true });
      setCurrentSlide(nextSlide);
    } else {
      // Mark onboarding as seen and go to login
      await markOnboardingSeen();
      router.replace('/auth/login');
    }
  };

  const handleSlideScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextSlide = Math.round(event.nativeEvent.contentOffset.x / width);
    if (nextSlide !== currentSlide) {
      setCurrentSlide(nextSlide);
    }
  };

  // Show loading while checking auth state
  if (isLoading || checkingOnboarding) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <LoadingShimmer variant="fullPage" />
      </View>
    );
  }

  // If authenticated, AuthContext will handle redirect
  if (status === 'authenticated') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <LoadingShimmer variant="fullPage" />
      </View>
    );
  }

  // If already seen onboarding, AuthContext will redirect to login
  if (hasSeenOnboarding) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <LoadingShimmer variant="fullPage" />
      </View>
    );
  }

  // Show onboarding slides
  const isLastSlide = currentSlide === SLIDES.length - 1;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.content,
          // Android gesture/3-button bars often report 0 inset; keep a generous bottom gutter.
          {
            paddingTop: Math.max(SPACING.md, insets.top + SPACING.xs),
            paddingBottom: Math.max(SPACING.xxxl, insets.bottom + SPACING.xl),
          },
        ]}
      >
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

        <ScrollView
          ref={slidesRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={handleSlideScrollEnd}
          style={styles.slidesWrapper}
          contentContainerStyle={styles.slidesContent}
        >
          {SLIDES.map((slide) => (
            <View key={slide.id} style={styles.slideContent}>
              <View style={styles.imageContainer}>
                <Image
                  source={slide.image}
                  style={styles.image}
                  resizeMode="cover"
                />
              </View>

              <Text style={[styles.title, { color: colors.gray900 }]}>{t(slide.titleKey)}</Text>
              <Text style={[styles.description, { color: colors.gray600 }]}>{t(slide.descKey)}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                { backgroundColor: colors.gray300 },
                currentSlide === index && [styles.dotActive, { backgroundColor: colors.primary }],
              ]}
            />
          ))}
        </View>

        <Button
          title={isLastSlide ? t('common.continue') : t('onboarding.next')}
          onPress={handleNext}
          size="lg"
          fullWidth
          style={styles.button}
        />
      </View>

      <Modal
        visible={showLanguageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
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
                  <Text style={[styles.languageLabel, { color: colors.gray900 }]}>{option.label}</Text>
                </SelectCard>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },

  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: 0,
    paddingBottom: SPACING.xxl,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: SPACING.sm,
  },

  languageTrigger: {
    minHeight: 40,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 2,
    borderRadius: BORDER.radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  languageTriggerText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    letterSpacing: 0.5,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },

  modalCard: {
    borderRadius: BORDER.radius.xl,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.md,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },

  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: 4,
  },

  modalSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: TYPOGRAPHY.fontSize.xs * TYPOGRAPHY.lineHeight.relaxed,
  },

  modalLanguageOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },

  modalLanguageCard: {
    width: '47%',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
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

  slideContent: {
    flex: 1,
    width,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: SPACING.sm,
  },

  slidesWrapper: {
    flex: 1,
    marginHorizontal: -SPACING.lg,
  },

  slidesContent: {
    alignItems: 'stretch',
  },

  imageContainer: {
    width: width * 0.85,
    height: height * 0.47,
    marginBottom: SPACING.lg,
    borderRadius: BORDER.radius.xl,
    overflow: 'hidden',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  title: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },

  description: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.relaxed,
    paddingHorizontal: SPACING.md,
  },

  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: BORDER.radius.full,
  },

  dotActive: {
    width: 24,
    borderRadius: BORDER.radius.full,
  },

  button: {
    marginTop: SPACING.sm,
  },
});
