import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronRight,
  ArrowLeft,
  Check,
  Laptop,
  Plane,
  Camera,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, LAYOUT, BORDER, OPACITY, withOpacity } from '../../src/constants/theme';
import { Input, Button, Toggle, StepIndicator } from '../../src/components/ui';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import { useForm } from '../../src/hooks/useForm';
import {
  SECTOR_DATA,
  PROFILE_TAG_DATA,
  GOAL_DATA,
  MAX_SECTORS,
  MAX_PROFILE_TAGS,
  MAX_GOALS,
} from '../../src/constants/talent';
import { COUNTRIES, GENDERS, getRegionsByCountry, getCommunesByRegion } from '../../src/constants/location';
import { otpService } from '../../src/services/otpService';
import { onboardingService } from '../../src/services/onboardingService';
import { imageService } from '../../src/services';
import { useAuth } from '../../src/contexts/AuthContext';

type Step = 'info' | 'sectors' | 'goals';

interface ProfileFormValues {
  firstName: string;
  lastName: string;
  gender: string;
  country: string;
  region: string;
  commune: string;
  bio: string;
  phone: string;
  email: string;
  avatarUri: string | null;
  remoteReady: boolean;
  willingToRelocate: boolean;
  selectedTags: string[];
  selectedSectors: string[];
  selectedGoals: string[];
}

export default function CreateProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { completeOnboarding } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>('info');

  // Form management with useForm hook
  const form = useForm<ProfileFormValues>({
    fields: {
      firstName: { initialValue: '', required: true, requiredMessage: 'Le prénom est requis' },
      lastName: { initialValue: '', required: true, requiredMessage: 'Le nom est requis' },
      gender: { initialValue: '' },
      country: { initialValue: 'CI' },
      region: { initialValue: '' },
      commune: { initialValue: '' },
      bio: { initialValue: '' },
      phone: { initialValue: '', required: true, requiredMessage: 'Le téléphone est requis' },
      email: { initialValue: '' },
      avatarUri: { initialValue: null },
      remoteReady: { initialValue: true },
      willingToRelocate: { initialValue: true },
      selectedTags: { initialValue: [] },
      selectedSectors: { initialValue: [], required: true },
      selectedGoals: { initialValue: [], required: true },
    },
    onSubmit: async (values) => {
      const displayName = `${values.firstName.trim()} ${values.lastName.trim()}`.trim();
      const profileData = {
        displayName,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: values.phone.trim(),
        city: values.commune || undefined,
        region: values.region || undefined,
        country: values.country || undefined,
        profileTags: values.selectedTags.length > 0 ? values.selectedTags : undefined,
        goals: values.selectedGoals.length > 0 ? values.selectedGoals : undefined,
        bio: values.bio.trim() || undefined,
        remoteReady: values.remoteReady,
        willingToRelocate: values.willingToRelocate,
        gender: values.gender || undefined,
        sectors: values.selectedSectors.length > 0 ? values.selectedSectors : undefined,
      };
      const response = await onboardingService.complete(profileData);
      if (response.data) {
        completeOnboarding();
        router.replace('/auth/welcome');
      } else {
        throw new Error('Échec de la création du profil');
      }
    },
  });

  // Convenience getters for form values
  const firstName = form.getValue('firstName');
  const lastName = form.getValue('lastName');
  const gender = form.getValue('gender');
  const country = form.getValue('country');
  const region = form.getValue('region');
  const commune = form.getValue('commune');
  const bio = form.getValue('bio');
  const phone = form.getValue('phone');
  const email = form.getValue('email');
  const avatarUri = form.getValue('avatarUri');
  const remoteReady = form.getValue('remoteReady');
  const willingToRelocate = form.getValue('willingToRelocate');
  const selectedTags = form.getValue('selectedTags');
  const selectedSectors = form.getValue('selectedSectors');
  const selectedGoals = form.getValue('selectedGoals');

  // Refs for horizontal scrolls
  const countryScrollRef = useRef<ScrollView>(null);
  const regionScrollRef = useRef<ScrollView>(null);
  const communeScrollRef = useRef<ScrollView>(null);
  const countryChipPositions = useRef<{ [key: string]: { x: number; width: number } }>({});
  const regionChipPositions = useRef<{ [key: string]: { x: number; width: number } }>({});
  const communeChipPositions = useRef<{ [key: string]: { x: number; width: number } }>({});

  // Pre-fill email/phone from authentication and check if user needs onboarding
  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const user = await otpService.getUser();
        if (user) {
          // Check if user already has a profile - redirect to main app
          if (user.hasTalentProfile === true || user.onboardingComplete === true || user.talentId) {
            completeOnboarding();
            router.replace('/(tabs)/graphe');
            return;
          }

          // Pre-fill email if user logged in with email
          if (user.email) {
            form.setValues({ email: user.email });
          }
          // Pre-fill phone if user logged in with WhatsApp/phone
          if (user.phone) {
            form.setValues({ phone: user.phone });
          }
        }
      } catch (error) {
      }
    };
    loadAuthData();
  }, []);

  // Generic scroll function for chips
  const scrollToChip = (
    scrollRef: React.RefObject<ScrollView | null>,
    positions: React.MutableRefObject<{ [key: string]: { x: number; width: number } }>,
    chipId: string,
    animated: boolean = true
  ) => {
    const position = positions.current[chipId];
    if (position && scrollRef.current) {
      // Center the chip in the scroll view (approximate scroll container width ~350)
      const scrollContainerWidth = 350;
      const offset = Math.max(0, position.x - (scrollContainerWidth - position.width) / 2);
      scrollRef.current.scrollTo({ x: offset, animated });
    }
  };

  // Scroll to selected country on mount
  useEffect(() => {
    if (country) {
      const timer = setTimeout(() => {
        scrollToChip(countryScrollRef, countryChipPositions, country, false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle chip layout to track positions
  const handleChipLayout = (
    positions: React.MutableRefObject<{ [key: string]: { x: number; width: number } }>,
    id: string,
    x: number,
    width: number
  ) => {
    positions.current[id] = { x, width };
  };

  // Get regions and communes dynamically
  const availableRegions = country ? getRegionsByCountry(country) : [];
  const availableCommunes = country && region ? getCommunesByRegion(country, region) : [];

  // Pick profile photo
  const pickImage = async () => {
    try {
      const image = await imageService.pickImage({ type: 'avatar' });
      if (image) {
        form.setValue('avatarUri', image.uri);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert(
        t('common.error'),
        t('auth.createProfile.photoError'),
        [{ text: 'OK' }]
      );
    }
  };

  const toggleSector = (sectorId: string) => {
    const currentSectors = form.getValue('selectedSectors');
    if (currentSectors.includes(sectorId)) {
      form.setValue('selectedSectors', currentSectors.filter((id) => id !== sectorId));
    } else if (currentSectors.length < MAX_SECTORS) {
      form.setValue('selectedSectors', [...currentSectors, sectorId]);
    }
  };

  const toggleTag = (tagId: string) => {
    const currentTags = form.getValue('selectedTags');
    if (currentTags.includes(tagId)) {
      form.setValue('selectedTags', currentTags.filter((id) => id !== tagId));
    } else if (currentTags.length < MAX_PROFILE_TAGS) {
      form.setValue('selectedTags', [...currentTags, tagId]);
    }
  };

  const toggleGoal = (goalId: string) => {
    const currentGoals = form.getValue('selectedGoals');
    if (currentGoals.includes(goalId)) {
      form.setValue('selectedGoals', currentGoals.filter((id) => id !== goalId));
    } else if (currentGoals.length < MAX_GOALS) {
      form.setValue('selectedGoals', [...currentGoals, goalId]);
    }
  };

  const handleNext = async () => {
    if (currentStep === 'info') {
      setCurrentStep('sectors');
    } else if (currentStep === 'sectors') {
      setCurrentStep('goals');
    } else {
      // Submit profile to backend
      await handleSubmitProfile();
    }
  };

  const handleSubmitProfile = async () => {
    if (form.state.isSubmitting) return;

    // Validate required fields
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName || trimmedFirstName.length < 2) {
      Alert.alert(t('common.error'), 'Le prénom est requis (minimum 2 caractères)');
      return;
    }

    if (!trimmedLastName || trimmedLastName.length < 2) {
      Alert.alert(t('common.error'), 'Le nom est requis (minimum 2 caractères)');
      return;
    }

    const displayName = `${trimmedFirstName} ${trimmedLastName}`.trim();

    if (!displayName || displayName.length < 3) {
      Alert.alert(t('common.error'), 'Le nom d\'affichage est requis');
      return;
    }

    try {
      await form.handleSubmit();
    } catch (error: any) {
      console.error('[CreateProfile] Error creating profile:', JSON.stringify(error, null, 2));

      // Check if profile already exists - redirect to main app
      const errorMsg = error.error || error.message || '';
      if (errorMsg.includes('existe déjà') || errorMsg.includes('already exists')) {
        completeOnboarding();
        router.replace('/(tabs)/graphe');
        return;
      }

      // Build detailed error message for debugging
      let errorMessage = 'Une erreur est survenue lors de la création de votre profil.';

      if (error.status === 500) {
        errorMessage = 'Erreur serveur (500). Veuillez réessayer plus tard ou contacter le support.';
        console.error('[CreateProfile] Server error details:', {
          status: error.status,
          error: error.error,
          message: error.message,
        });
      } else if (error.error) {
        errorMessage = error.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert(
        t('common.error'),
        errorMessage,
        [{ text: 'OK' }]
      );
    }
  };

  const handleBack = () => {
    if (currentStep === 'info') {
      router.back();
    } else if (currentStep === 'sectors') {
      setCurrentStep('info');
    } else if (currentStep === 'goals') {
      setCurrentStep('sectors');
    }
  };

  const canProceed = () => {
    if (currentStep === 'info') {
      // Required: firstName, lastName, country, phone
      return (
        firstName.trim().length >= 2 &&
        lastName.trim().length >= 2 &&
        country.length > 0 &&
        phone.trim().length >= 8
      );
    }
    if (currentStep === 'sectors') {
      return selectedSectors.length > 0;
    }
    return selectedGoals.length > 0;
  };

  /*
   * STEP DATA
   */
  const STEPS_DATA = [
    { id: 'info', label: 'Infos' },
    { id: 'sectors', label: 'Secteurs' },
    { id: 'goals', label: 'Objectifs' },
  ];

  const renderStepIndicator = () => (
    <StepIndicator steps={STEPS_DATA} currentStepId={currentStep} />
  );

  const renderInfoStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{t('auth.createProfile.tellUsAboutYou')}</Text>
      </View>

      <View style={styles.formFields}>
        {/* Photo de profil */}
        <View style={styles.photoSection}>
          <TouchableOpacity
            style={[styles.photoContainer, { backgroundColor: colors.gray100, borderColor: colors.borderColor }]}
            onPress={pickImage}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.photoImage} resizeMode="cover" />
            ) : (
              <Camera size={ICON.size.lg} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            )}
          </TouchableOpacity>
          <Text style={[styles.photoHint, { color: colors.textSecondary }]}>
            {t('auth.createProfile.addPhoto')}
          </Text>
        </View>

        {/* Prénom & Nom */}
        <View style={styles.rowFields}>
          <View style={styles.halfField}>
            <Input
              label={`${t('auth.createProfile.firstName')} *`}
              placeholder=""
              value={firstName}
              onChangeText={(value) => form.setValue('firstName', value)}
              autoCapitalize="words"
              autoFocus
            />
          </View>
          <View style={styles.halfField}>
            <Input
              label={`${t('auth.createProfile.lastName')} *`}
              placeholder=""
              value={lastName}
              onChangeText={(value) => form.setValue('lastName', value)}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Genre */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('auth.createProfile.gender')}</Text>
          <View style={styles.optionsRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[
                  styles.optionButton,
                  { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                  gender === g.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => form.setValue('gender', g.id)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    { color: colors.gray700 },
                    gender === g.id && { color: colors.textOnPrimary },
                  ]}
                >
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Profil Tags */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
            {t('auth.createProfile.yourProfile')} ({selectedTags.length}/{MAX_PROFILE_TAGS})
          </Text>
          <View style={styles.tagsContainer}>
            {PROFILE_TAG_DATA.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.selectableTag,
                    { backgroundColor: colors.surface, borderColor: colors.gray200 },
                    isSelected && { backgroundColor: withOpacity(colors.primary, OPACITY[10]), borderColor: colors.primary },
                  ]}
                  onPress={() => toggleTag(tag.id)}
                  activeOpacity={0.7}
                >
                  {isSelected && (
                    <Check size={14} color={colors.primary} strokeWidth={2.5} />
                  )}
                  <Text
                    style={[
                      styles.selectableTagText,
                      { color: colors.gray600 },
                      isSelected && { color: colors.primary },
                    ]}
                  >
                    {tag.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bio */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Bio</Text>
          <View style={[styles.textAreaContainer, { borderColor: colors.gray200, backgroundColor: colors.surface }]}>
            <TextInput
              style={[styles.textArea, { color: colors.textPrimary }]}
              placeholder="Décris-toi en quelques mots..."
              placeholderTextColor={colors.gray400}
              value={bio}
              onChangeText={(text) => form.setValue('bio', text.slice(0, 300))}
              multiline
              maxLength={300}
            />
            <Text style={[styles.charCount, { color: colors.gray400 }]}>{bio.length}/300</Text>
          </View>
        </View>

        {/* Separator - Localisation */}
        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        {/* Pays */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('auth.createProfile.country')} *</Text>
          <ScrollView
            ref={countryScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalScroll}
            contentContainerStyle={styles.horizontalScrollContent}
          >
            {COUNTRIES.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.optionChip,
                  { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                  country === c.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  handleChipLayout(countryChipPositions, c.id, x, width);
                }}
                onPress={() => {
                  form.setValue('country', c.id);
                  form.setValue('region', '');
                  form.setValue('commune', '');
                  setTimeout(() => scrollToChip(countryScrollRef, countryChipPositions, c.id, true), 50);
                }}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    { color: colors.gray700 },
                    country === c.id && { color: colors.textOnPrimary },
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Région */}
        {availableRegions.length > 0 && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('auth.createProfile.region')}</Text>
            <ScrollView
              ref={regionScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
              contentContainerStyle={styles.horizontalScrollContent}
            >
              {availableRegions.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.optionChip,
                    { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                    region === r.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onLayout={(event) => {
                    const { x, width } = event.nativeEvent.layout;
                    handleChipLayout(regionChipPositions, r.id, x, width);
                  }}
                  onPress={() => {
                    form.setValue('region', r.id);
                    form.setValue('commune', '');
                    setTimeout(() => scrollToChip(regionScrollRef, regionChipPositions, r.id, true), 50);
                  }}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      { color: colors.gray700 },
                      region === r.id && { color: colors.textOnPrimary },
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Commune / Ville */}
        {availableCommunes.length > 0 && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('auth.createProfile.commune')}</Text>
            <ScrollView
              ref={communeScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
              contentContainerStyle={styles.horizontalScrollContent}
            >
              {availableCommunes.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.optionChip,
                    { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                    commune === c.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onLayout={(event) => {
                    const { x, width } = event.nativeEvent.layout;
                    handleChipLayout(communeChipPositions, c.id, x, width);
                  }}
                  onPress={() => {
                    form.setValue('commune', c.id);
                    setTimeout(() => scrollToChip(communeScrollRef, communeChipPositions, c.id, true), 50);
                  }}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      { color: colors.gray700 },
                      commune === c.id && { color: colors.textOnPrimary },
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Separator - Contact */}
        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        {/* Téléphone */}
        <Input
          label={`${t('auth.createProfile.phone')} *`}
          placeholder="+225 07 00 00 00 00"
          value={phone}
          onChangeText={(value) => form.setValue('phone', value)}
          keyboardType="phone-pad"
          hint="Ce numéro doit être unique pour votre profil"
        />

        {/* Email */}
        <Input
          label={t('auth.createProfile.email')}
          placeholder="ton@email.com"
          value={email}
          onChangeText={(value) => form.setValue('email', value)}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Préférences de travail */}
        <View style={[styles.preferencesSection, { borderTopColor: colors.gray200 }]}>
          <Text style={[styles.preferencesSectionTitle, { color: colors.gray700 }]}>{t('auth.createProfile.workPreferences')}</Text>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Laptop size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
              <View style={styles.preferenceTextContainer}>
                <Text style={[styles.preferenceLabel, { color: colors.textPrimary }]}>{t('auth.createProfile.remoteAvailable')}</Text>
                <Text style={[styles.preferenceDescription, { color: colors.gray500 }]}>{t('auth.createProfile.remoteAvailableDesc')}</Text>
              </View>
            </View>
            <Toggle
              value={remoteReady}
              onValueChange={(value) => form.setValue('remoteReady', value)}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Plane size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
              <View style={styles.preferenceTextContainer}>
                <Text style={[styles.preferenceLabel, { color: colors.textPrimary }]}>{t('auth.createProfile.willingToRelocate')}</Text>
                <Text style={[styles.preferenceDescription, { color: colors.gray500 }]}>{t('auth.createProfile.willingToRelocateDesc')}</Text>
              </View>
            </View>
            <Toggle
              value={willingToRelocate}
              onValueChange={(value) => form.setValue('willingToRelocate', value)}
            />
          </View>
        </View>
      </View>
    </View>
  );

  const renderSectorsStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{t('auth.createProfile.yourSectors')}</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          {t('auth.createProfile.sectorsHint', { max: MAX_SECTORS })}
        </Text>
      </View>

      <View style={styles.tagsContainer}>
        {SECTOR_DATA.map((sector) => {
          const isSelected = selectedSectors.includes(sector.id);
          return (
            <TouchableOpacity
              key={sector.id}
              style={[
                styles.selectableTag,
                { backgroundColor: colors.surface, borderColor: colors.gray200 },
                isSelected && { backgroundColor: withOpacity(colors.primary, OPACITY[10]), borderColor: colors.primary },
              ]}
              onPress={() => toggleSector(sector.id)}
              activeOpacity={0.7}
            >
              {isSelected && (
                <Check size={14} color={colors.primary} strokeWidth={2.5} />
              )}
              <Text
                style={[
                  styles.selectableTagText,
                  { color: colors.gray600 },
                  isSelected && { color: colors.primary },
                ]}
              >
                {sector.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.selectionHint, { color: colors.gray500 }]}>
        {t('auth.createProfile.selected', { count: selectedSectors.length, max: MAX_SECTORS })}
      </Text>
    </View>
  );

  const renderGoalsStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{t('auth.createProfile.yourGoals')}</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          {t('auth.createProfile.goalsHint', { max: MAX_GOALS })}
        </Text>
      </View>

      <View style={styles.tagsContainer}>
        {GOAL_DATA.map((goal) => {
          const isSelected = selectedGoals.includes(goal.id);
          return (
            <TouchableOpacity
              key={goal.id}
              style={[
                styles.selectableTag,
                { backgroundColor: colors.surface, borderColor: colors.gray200 },
                isSelected && { backgroundColor: withOpacity(colors.primary, OPACITY[10]), borderColor: colors.primary },
              ]}
              onPress={() => toggleGoal(goal.id)}
              activeOpacity={0.7}
            >
              {isSelected && (
                <Check size={14} color={colors.primary} strokeWidth={2.5} />
              )}
              <Text
                style={[
                  styles.selectableTagText,
                  { color: colors.gray600 },
                  isSelected && { color: colors.primary },
                ]}
              >
                {goal.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.selectionHint, { color: colors.gray500 }]}>
        {t('auth.createProfile.selected', { count: selectedGoals.length, max: MAX_GOALS })}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('auth.createProfile.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStepIndicator()}

          {currentStep === 'info' && renderInfoStep()}
          {currentStep === 'sectors' && renderSectorsStep()}
          {currentStep === 'goals' && renderGoalsStep()}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.background }]}>
          <Button
            title={
              form.state.isSubmitting
                ? 'Création...'
                : currentStep === 'goals'
                  ? t('auth.createProfile.complete')
                  : t('auth.createProfile.continue')
            }
            onPress={handleNext}
            disabled={!canProceed() || form.state.isSubmitting}
            fullWidth
            icon={
              form.state.isSubmitting ? undefined : (
                <ChevronRight
                  size={ICON.size.md}
                  color={colors.textOnPrimary}
                  strokeWidth={ICON.strokeWidth}
                />
              )
            }
            iconPosition="right"
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.width.thin,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.full,
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  headerSpacer: {
    width: 40,
  },

  keyboardView: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },

  stepDot: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.full,
  },


  stepContent: {
    flex: 1,
  },

  stepHeader: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },

  stepTitle: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.sm,
  },

  stepDescription: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
  },

  formFields: {
    gap: SPACING.md,
  },

  // Photo section
  photoSection: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },

  photoContainer: {
    width: 100,
    height: 100,
    borderRadius: BORDER.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDER.width.thin,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },

  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  photoHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.sm,
  },

  separator: {
    height: 1,
    marginVertical: SPACING.md,
  },

  rowFields: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  halfField: {
    flex: 1,
  },

  fieldContainer: {
    gap: SPACING.xs,
  },

  fieldLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  optionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  optionButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
  },


  optionButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  optionButtonTextSelected: {
    color: '#FFFFFF',
  },

  horizontalScroll: {
    marginHorizontal: -SPACING.lg,
  },

  horizontalScrollContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },

  optionChip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.full,
  },


  optionChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  optionChipTextSelected: {
    color: '#FFFFFF',
  },

  datePickerButton: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    height: LAYOUT.inputHeight,
    justifyContent: 'center',
  },

  datePickerText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  datePickerPlaceholder: {
  },

  datePickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },

  datePickerModalContent: {
    borderTopLeftRadius: BORDER.radius.lg,
    borderTopRightRadius: BORDER.radius.lg,
    paddingBottom: SPACING.xl,
  },

  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: BORDER.width.thin,
  },

  datePickerDoneButton: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  iosDatePicker: {
    height: 200,
  },

  textAreaContainer: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    padding: SPACING.md,
  },

  textArea: {
    fontSize: TYPOGRAPHY.fontSize.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  charCount: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },

  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },

  // Unified selectable tag style (for sectors and profile tags)
  selectableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.full,
  },

  selectableTagSelected: {
  },

  selectableTagText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  selectableTagTextSelected: {
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Goals container
  goalsContainer: {
    gap: SPACING.sm,
  },

  // Unified selectable item style (for goals - list style)
  selectableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.md,
  },


  selectableItemCheckbox: {
    width: 24,
    height: 24,
    borderRadius: BORDER.radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectableItemCheckboxSelected: {
  },

  selectableItemText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  selectableItemTextSelected: {
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Selection hint
  selectionHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },

  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },

  // Preferences Section
  preferencesSection: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: BORDER.width.thin,
    gap: SPACING.sm,
  },

  preferencesSectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.xs,
  },

  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },

  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },

  preferenceTextContainer: {
    flex: 1,
  },

  preferenceLabel: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  preferenceDescription: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
});
