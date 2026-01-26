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
  Modal,
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
  MapPin,
  Loader2,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SPACING, TYPOGRAPHY, ICON, LAYOUT, BORDER } from '../../src/constants/theme';
import { Input, Button, Toggle } from '../../src/components/ui';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import {
  SECTOR_DATA,
  PROFILE_TAG_DATA,
  GOAL_DATA,
  MAX_SECTORS,
  MAX_PROFILE_TAGS,
  MAX_GOALS,
} from '../../src/constants/talent';
import { COUNTRIES, GENDERS, getRegionsByCountry, getCommunesByRegion } from '../../src/constants/location';
import { useGeolocation } from '../../src/hooks/useGeolocation';
import { otpService } from '../../src/services/otpService';
import { onboardingService } from '../../src/services/onboardingService';
import { imageService } from '../../src/services';
import { useAuth } from '../../src/contexts/AuthContext';

type Step = 'info' | 'sectors' | 'goals';

export default function CreateProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { completeOnboarding } = useAuth();
  const { isLoading: isGeoLoading, getCurrentLocation } = useGeolocation();
  const [currentStep, setCurrentStep] = useState<Step>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state - Photo
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Form state - Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [country, setCountry] = useState('CI'); // Côte d'Ivoire par défaut
  const [region, setRegion] = useState('');
  const [commune, setCommune] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Form state - Preferences
  const [remoteReady, setRemoteReady] = useState(false);
  const [willingToRelocate, setWillingToRelocate] = useState(false);

  // Form state - Steps
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

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
            console.log('[CreateProfile] User already has profile, redirecting to main app');
            completeOnboarding();
            router.replace('/(tabs)/graphe');
            return;
          }

          // Pre-fill email if user logged in with email
          if (user.email) {
            setEmail(user.email);
          }
          // Pre-fill phone if user logged in with WhatsApp/phone
          if (user.phone) {
            setPhone(user.phone);
          }
        }
      } catch (error) {
        console.log('Could not load auth data:', error);
      }
    };
    loadAuthData();
  }, []);

  // Generic scroll function for chips
  const scrollToChip = (
    scrollRef: React.RefObject<ScrollView>,
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
        setAvatarUri(image.uri);
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

  // Handle geolocation
  const handleGeolocation = async () => {
    const result = await getCurrentLocation();
    if (result) {
      // Update country
      if (result.countryCode) {
        setCountry(result.countryCode);
        setTimeout(() => scrollToChip(countryScrollRef, countryChipPositions, result.countryCode, true), 100);
      }
      // Update region
      if (result.regionCode) {
        setRegion(result.regionCode);
        setTimeout(() => scrollToChip(regionScrollRef, regionChipPositions, result.regionCode, true), 150);
      }
      // Update commune/city
      if (result.cityCode) {
        setCommune(result.cityCode);
        setTimeout(() => scrollToChip(communeScrollRef, communeChipPositions, result.cityCode, true), 200);
      }
    }
  };

  const toggleSector = (sectorId: string) => {
    setSelectedSectors((prev) => {
      if (prev.includes(sectorId)) {
        return prev.filter((id) => id !== sectorId);
      }
      if (prev.length >= MAX_SECTORS) {
        return prev;
      }
      return [...prev, sectorId];
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      }
      if (prev.length >= MAX_PROFILE_TAGS) {
        return prev;
      }
      return [...prev, tagId];
    });
  };

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((prev) => {
      if (prev.includes(goalId)) {
        return prev.filter((id) => id !== goalId);
      }
      if (prev.length >= MAX_GOALS) {
        return prev;
      }
      return [...prev, goalId];
    });
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
    if (isSubmitting) return;

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

    setIsSubmitting(true);
    try {
      // Build the profile data
      const profileData = {
        displayName,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        phone: phone.trim() || undefined,
        city: commune || undefined,
        region: region || undefined,
        country: country || undefined,
        profileTags: selectedTags.length > 0 ? selectedTags : undefined,
        goals: selectedGoals.length > 0 ? selectedGoals : undefined,
        remoteReady,
        willingToRelocate,
        // Additional fields
        gender: gender || undefined,
        sectors: selectedSectors.length > 0 ? selectedSectors : undefined,
      };

      console.log('[CreateProfile] Submitting profile:', { displayName, firstName: trimmedFirstName, lastName: trimmedLastName });

      // Call the onboarding API
      const response = await onboardingService.complete(profileData);

      if (response.data) {
        console.log('[CreateProfile] Profile created successfully');

        // Update auth state
        completeOnboarding();

        // Navigate to welcome screen
        router.replace('/auth/welcome');
      } else {
        throw new Error('Échec de la création du profil');
      }
    } catch (error: any) {
      console.error('[CreateProfile] Error creating profile:', JSON.stringify(error, null, 2));

      // Check if profile already exists - redirect to main app
      const errorMsg = error.error || error.message || '';
      if (errorMsg.includes('existe déjà') || errorMsg.includes('already exists')) {
        console.log('[CreateProfile] Profile already exists, redirecting to main app');
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
    } finally {
      setIsSubmitting(false);
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
      // Required: firstName, lastName, country
      return (
        firstName.trim().length >= 2 &&
        lastName.trim().length >= 2 &&
        country.length > 0
      );
    }
    if (currentStep === 'sectors') {
      return selectedSectors.length > 0;
    }
    return selectedGoals.length > 0;
  };

  const STEPS: Step[] = ['info', 'sectors', 'goals'];

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, index) => (
        <View
          key={step}
          style={[
            styles.stepDot,
            { backgroundColor: colors.gray200 },
            currentStep === step && { backgroundColor: colors.primary },
            STEPS.indexOf(currentStep) > index && { backgroundColor: colors.primary },
          ]}
        >
          {STEPS.indexOf(currentStep) > index && (
            <Check size={12} color={COLORS.white} strokeWidth={ICON.strokeWidth + 0.5} />
          )}
        </View>
      ))}
    </View>
  );

  // Format date for display
  const formatBirthday = (date: Date | null): string => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setBirthday(selectedDate);
    }
  };

  const handleDatePickerDone = () => {
    setShowDatePicker(false);
  };

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
              <Image source={{ uri: avatarUri }} style={styles.photoImage} />
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
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoFocus
            />
          </View>
          <View style={styles.halfField}>
            <Input
              label={`${t('auth.createProfile.lastName')} *`}
              placeholder=""
              value={lastName}
              onChangeText={setLastName}
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
                onPress={() => setGender(g.id)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    { color: colors.gray700 },
                    gender === g.id && { color: COLORS.white },
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
                    isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary },
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

        {/* Date de naissance */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('auth.createProfile.birthDate')}</Text>
          <TouchableOpacity
            style={[styles.datePickerButton, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.datePickerText, { color: colors.textPrimary }, !birthday && { color: colors.gray500 }]}>
              {birthday ? formatBirthday(birthday) : t('auth.createProfile.selectDate')}
            </Text>
          </TouchableOpacity>
          {showDatePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={birthday || new Date(2000, 0, 1)}
              mode="date"
              display="default"
              onChange={handleDateChange}
              maximumDate={new Date()}
              minimumDate={new Date(1940, 0, 1)}
            />
          )}
          {Platform.OS === 'ios' && (
            <Modal
              visible={showDatePicker}
              transparent
              animationType="slide"
            >
              <View style={styles.datePickerModalOverlay}>
                <View style={[styles.datePickerModalContent, { backgroundColor: colors.background }]}>
                  <View style={[styles.datePickerModalHeader, { borderBottomColor: colors.gray200 }]}>
                    <TouchableOpacity onPress={handleDatePickerDone}>
                      <Text style={[styles.datePickerDoneButton, { color: colors.primary }]}>{t('common.done')}</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={birthday || new Date(2000, 0, 1)}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                    minimumDate={new Date(1940, 0, 1)}
                    locale="fr-FR"
                    style={styles.iosDatePicker}
                  />
                </View>
              </View>
            </Modal>
          )}
        </View>

        {/* Separator - Localisation */}
        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        {/* Geolocation Button */}
        <TouchableOpacity
          style={[
            styles.geolocationButton,
            { backgroundColor: colors.primary + '10', borderColor: colors.primary },
          ]}
          onPress={handleGeolocation}
          disabled={isGeoLoading}
          activeOpacity={0.7}
        >
          {isGeoLoading ? (
            <Loader2 size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          ) : (
            <MapPin size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          )}
          <Text style={[styles.geolocationButtonText, { color: colors.primary }]}>
            {isGeoLoading ? t('auth.createProfile.locating') : t('auth.createProfile.useMyLocation')}
          </Text>
        </TouchableOpacity>

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
                  setCountry(c.id);
                  setRegion('');
                  setCommune('');
                  setTimeout(() => scrollToChip(countryScrollRef, countryChipPositions, c.id, true), 50);
                }}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    { color: colors.gray700 },
                    country === c.id && { color: COLORS.white },
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
                    setRegion(r.id);
                    setCommune('');
                    setTimeout(() => scrollToChip(regionScrollRef, regionChipPositions, r.id, true), 50);
                  }}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      { color: colors.gray700 },
                      region === r.id && { color: COLORS.white },
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
                    setCommune(c.id);
                    setTimeout(() => scrollToChip(communeScrollRef, communeChipPositions, c.id, true), 50);
                  }}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      { color: colors.gray700 },
                      commune === c.id && { color: COLORS.white },
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
          label={t('auth.createProfile.phone')}
          placeholder="+225 07 00 00 00 00"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        {/* Email */}
        <Input
          label={t('auth.createProfile.email')}
          placeholder="ton@email.com"
          value={email}
          onChangeText={setEmail}
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
              onValueChange={setRemoteReady}
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
              onValueChange={setWillingToRelocate}
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
                isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary },
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
                isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary },
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
              isSubmitting
                ? 'Création...'
                : currentStep === 'goals'
                ? t('auth.createProfile.complete')
                : t('auth.createProfile.continue')
            }
            onPress={handleNext}
            disabled={!canProceed() || isSubmitting}
            fullWidth
            icon={
              isSubmitting ? undefined : (
                <ChevronRight
                  size={ICON.size.md}
                  color={COLORS.white}
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
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.width.thin,
    borderBottomColor: COLORS.gray200,
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
    color: COLORS.gray900,
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
    backgroundColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.full,
  },

  stepDotActive: {
    backgroundColor: COLORS.primary,
  },

  stepDotCompleted: {
    backgroundColor: COLORS.primary,
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
    color: COLORS.gray900,
    marginBottom: SPACING.sm,
  },

  stepDescription: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.gray600,
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

  geolocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.sm,
    borderStyle: 'dashed',
  },

  geolocationButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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
    color: COLORS.gray700,
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
    backgroundColor: COLORS.gray100,
    borderWidth: BORDER.width.thin,
    borderColor: COLORS.gray200,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
  },

  optionButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  optionButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.gray700,
  },

  optionButtonTextSelected: {
    color: COLORS.white,
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
    backgroundColor: COLORS.gray100,
    borderWidth: BORDER.width.thin,
    borderColor: COLORS.gray200,
    borderRadius: BORDER.radius.full,
  },

  optionChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  optionChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.gray700,
  },

  optionChipTextSelected: {
    color: COLORS.white,
  },

  datePickerButton: {
    backgroundColor: COLORS.gray50,
    borderWidth: BORDER.width.thin,
    borderColor: COLORS.gray200,
    borderRadius: BORDER.radius.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    height: LAYOUT.inputHeight,
    justifyContent: 'center',
  },

  datePickerText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.gray900,
  },

  datePickerPlaceholder: {
    color: COLORS.gray500,
  },

  datePickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },

  datePickerModalContent: {
    backgroundColor: COLORS.white,
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
    borderBottomColor: COLORS.gray200,
  },

  datePickerDoneButton: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
  },

  iosDatePicker: {
    height: 200,
  },

  textAreaContainer: {
    backgroundColor: COLORS.gray50,
    borderWidth: BORDER.width.thin,
    borderColor: COLORS.gray200,
    borderRadius: BORDER.radius.sm,
    padding: SPACING.md,
  },

  textArea: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.gray900,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  charCount: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.gray500,
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
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
    borderRadius: BORDER.radius.full,
  },

  selectableTagSelected: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
  },

  selectableTagText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.gray600,
  },

  selectableTagTextSelected: {
    color: COLORS.primary,
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
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
    borderRadius: BORDER.radius.md,
  },

  selectableItemSelected: {
    backgroundColor: COLORS.primary + '08',
    borderColor: COLORS.primary,
  },

  selectableItemCheckbox: {
    width: 24,
    height: 24,
    borderRadius: BORDER.radius.sm,
    borderWidth: 2,
    borderColor: COLORS.gray300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },

  selectableItemCheckboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  selectableItemText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.gray600,
  },

  selectableItemTextSelected: {
    color: COLORS.gray900,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Selection hint
  selectionHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.gray500,
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
    borderTopColor: COLORS.gray200,
    gap: SPACING.sm,
  },

  preferencesSectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.gray700,
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
    color: COLORS.gray900,
  },

  preferenceDescription: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.gray500,
    marginTop: 2,
  },
});
