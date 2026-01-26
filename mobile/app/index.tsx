import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, TYPOGRAPHY, BORDER } from '../src/constants/theme';
import { useAuth } from '../src/contexts/AuthContext';

const { height, width } = Dimensions.get('window');

const STORAGE_KEY_ONBOARDING_SEEN = 'onboarding_seen';

const SLIDES = [
  {
    id: 1,
    image: require('../assets/onboarding_1.png'),
    title: 'Transforme tes compétences en carrière',
    description: 'Construis un profil professionnel percutant et valorise ton expertise unique auprès des recruteurs.',
  },
  {
    id: 2,
    image: require('../assets/onboarding_2.png'),
    title: 'Accède aux meilleures opportunités',
    description: 'Découvre des offres d\'emploi parfaitement ciblées selon tes talents et ambitions.',
  },
  {
    id: 3,
    image: require('../assets/onboarding_3.png'),
    title: 'Évolue avec l\'élite',
    description: 'Rejoins une communauté dynamique de talents et d\'entreprises pour booster ton réseau professionnel.',
  },
];

export default function SplashScreen() {
  const router = useRouter();
  const { status, isLoading, needsOnboarding } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  // Check if onboarding has been seen before
  useEffect(() => {
    checkOnboardingSeen();
  }, []);

  // Handle auth state changes
  useEffect(() => {
    if (isLoading || checkingOnboarding) return;

    // If authenticated and has complete profile, go to main app
    if (status === 'authenticated' && !needsOnboarding) {
      router.replace('/(tabs)/graphe');
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
  }, [status, isLoading, needsOnboarding, checkingOnboarding, hasSeenOnboarding]);

  const checkOnboardingSeen = async () => {
    try {
      const seen = await AsyncStorage.getItem(STORAGE_KEY_ONBOARDING_SEEN);
      setHasSeenOnboarding(seen === 'true');
    } catch (error) {
      console.log('[Onboarding] Error checking if seen:', error);
    } finally {
      setCheckingOnboarding(false);
    }
  };

  const markOnboardingSeen = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ONBOARDING_SEEN, 'true');
    } catch (error) {
      console.log('[Onboarding] Error marking as seen:', error);
    }
  };

  const handleNext = async () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      // Mark onboarding as seen and go to login
      await markOnboardingSeen();
      router.replace('/auth/login');
    }
  };

  // Show loading while checking auth state
  if (isLoading || checkingOnboarding) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  // If authenticated, AuthContext will handle redirect
  if (status === 'authenticated') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // If already seen onboarding, AuthContext will redirect to login
  if (hasSeenOnboarding) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Show onboarding slides
  const slide = SLIDES[currentSlide];
  const isLastSlide = currentSlide === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.slideContent}>
          <View style={styles.imageContainer}>
            <Image
              source={slide.image}
              style={styles.image}
              resizeMode="cover"
            />
          </View>

          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.description}</Text>
        </View>

        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentSlide === index && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {isLastSlide ? 'Continuer' : 'Suivant'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    gap: SPACING.md,
  },

  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.gray600,
  },

  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: height * 0.05,
    paddingBottom: SPACING.xxl,
  },

  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },

  imageContainer: {
    width: width * 0.85,
    height: height * 0.5,
    marginBottom: SPACING.xl,
    borderRadius: BORDER.radius.xl,
    overflow: 'hidden',
    shadowColor: COLORS.gray900,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },

  image: {
    width: '100%',
    height: '100%',
  },

  title: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.gray900,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },

  description: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.gray600,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.relaxed,
    paddingHorizontal: SPACING.md,
  },

  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  dot: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.gray300,
    borderRadius: BORDER.radius.full,
  },

  dotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
    borderRadius: BORDER.radius.full,
  },

  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },

  buttonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
