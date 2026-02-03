import { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Camera,
  Laptop,
  Plane,
  Check,
  ChevronRight,
  Wand2,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, LAYOUT, BORDER, OPACITY, withOpacity } from '../../src/constants/theme';
import { Input, Button, Toggle, StepIndicator } from '../../src/components/ui';
import {
  SECTOR_DATA,
  PROFILE_TAG_DATA,
  GOAL_DATA,
  MAX_SECTORS,
  MAX_PROFILE_TAGS,
  MAX_GOALS,
} from '../../src/constants/talent';
import { COUNTRIES, GENDERS, getRegionsByCountry, getCommunesByRegion } from '../../src/constants/location';
import { useTheme } from '../../src/hooks/useTheme';
import { useAuth } from '../../src/contexts/AuthContext';
import { talentService, imageService } from '../../src/services';
import { useForm } from '../../src/hooks/useForm';

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

type Step = 'info' | 'sectors' | 'goals';

export default function EditProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { refreshUser } = useAuth();

  const [currentStep, setCurrentStep] = useState<Step>('info');

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);

  // Refs for auto-scroll to selected country
  const countryScrollRef = useRef<ScrollView>(null);
  const COUNTRY_CHIP_WIDTH = 80;

  // Form hook
  const form = useForm<ProfileFormValues>({
    fields: {
      firstName: { initialValue: '' },
      lastName: { initialValue: '' },
      gender: { initialValue: '' },
      country: { initialValue: '' },
      region: { initialValue: '' },
      commune: { initialValue: '' },
      bio: { initialValue: '' },
      phone: { initialValue: '' },
      email: { initialValue: '' },
      avatarUri: { initialValue: null },
      remoteReady: { initialValue: true },
      willingToRelocate: { initialValue: true },
      selectedTags: { initialValue: [] },
      selectedSectors: { initialValue: [] },
      selectedGoals: { initialValue: [] },
    },
    onSubmit: async (values) => {
      const displayName = `${values.firstName} ${values.lastName}`.trim() || values.firstName || values.lastName;
      await talentService.updateMyProfile({
        display_name: displayName,
        first_name: values.firstName || undefined,
        last_name: values.lastName || undefined,
        bio: values.bio.trim() || undefined,
        gender: values.gender as 'M' | 'F' | 'O' || undefined,
        country: values.country || undefined,
        region: values.region || undefined,
        city: values.commune || undefined,
        phone: values.phone || undefined,
        avatar_url: values.avatarUri || undefined,
        remote_ready: values.remoteReady,
        willing_to_relocate: values.willingToRelocate,
        profile_tags: values.selectedTags,
        sectors: values.selectedSectors,
        goals: values.selectedGoals,
      });
      await refreshUser();
      Alert.alert('Succes', 'Ton profil a ete mis a jour.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
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

  // Load profile data on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const response = await talentService.getMyProfile();
      const profile = response.data;

      if (profile) {
        form.setValues({
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          bio: profile.bio || '',
          gender: profile.gender || '',
          country: profile.country || '',
          region: profile.region || '',
          commune: profile.city || '',
          phone: profile.phone || '',
          email: profile.email || '',
          avatarUri: profile.avatar_url || null,
          remoteReady: profile.remote_ready || false,
          willingToRelocate: profile.willing_to_relocate || false,
          selectedTags: profile.profile_tags || [],
          selectedSectors: profile.sectors || [],
          selectedGoals: profile.goals || [],
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get regions and communes dynamically
  const availableRegions = country ? getRegionsByCountry(country) : [];
  const availableCommunes = country && region ? getCommunesByRegion(country, region) : [];

  // Auto-scroll to selected country after loading
  useEffect(() => {
    if (country && countryScrollRef.current && !isLoading && currentStep === 'info') {
      const countryIndex = COUNTRIES.findIndex(c => c.id === country);
      if (countryIndex > 0) {
        setTimeout(() => {
          countryScrollRef.current?.scrollTo({
            x: countryIndex * COUNTRY_CHIP_WIDTH,
            animated: true,
          });
        }, 300);
      }
    }
  }, [country, isLoading, currentStep]);

  const pickImage = async () => {
    try {
      const image = await imageService.pickImage({ type: 'avatar' });
      if (image) {
        form.setValue('avatarUri', image.uri);
      }
    } catch (error) {
      console.error('Erreur lors de la selection de l\'image:', error);
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

  const toggleSector = (sectorId: string) => {
    const currentSectors = form.getValue('selectedSectors');
    if (currentSectors.includes(sectorId)) {
      form.setValue('selectedSectors', currentSectors.filter((id) => id !== sectorId));
    } else if (currentSectors.length < MAX_SECTORS) {
      form.setValue('selectedSectors', [...currentSectors, sectorId]);
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

  const handleGenerateBio = async () => {
    if (isGeneratingBio) return;
    setIsGeneratingBio(true);
    try {
      const response = await talentService.generateBio();
      if (response.data?.bio) {
        form.setValue('bio', response.data.bio);
      }
    } catch (error: any) {
      Alert.alert('Erreur', error?.error || 'Impossible de generer la bio.');
    } finally {
      setIsGeneratingBio(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 'info') {
      setCurrentStep('sectors');
    } else if (currentStep === 'sectors') {
      setCurrentStep('goals');
    } else {
      await form.handleSubmit();
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

  const getInitials = () => {
    const f = firstName.charAt(0) || '';
    const l = lastName.charAt(0) || '';
    return `${f}${l}`.toUpperCase() || '?';
  };

  const STEPS_DATA = [
    { id: 'info', label: 'Infos' },
    { id: 'sectors', label: 'Secteurs' },
    { id: 'goals', label: 'Objectifs' },
  ];

  const renderInfoStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Tes informations</Text>
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
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={[styles.photoHint, { color: colors.textSecondary }]}>
            Appuie pour changer ta photo
          </Text>
        </View>

        {/* Prenom & Nom */}
        <View style={styles.rowFields}>
          <View style={styles.halfField}>
            <Input
              label="Prenom"
              placeholder=""
              value={firstName}
              onChangeText={(text) => form.setValue('firstName', text)}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.halfField}>
            <Input
              label="Nom"
              placeholder=""
              value={lastName}
              onChangeText={(text) => form.setValue('lastName', text)}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Genre */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Genre</Text>
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
            Ton profil ({selectedTags.length}/{MAX_PROFILE_TAGS})
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
          <View style={styles.generateButtonContainer}>
            <TouchableOpacity
              style={[
                styles.generateButton,
                { backgroundColor: colors.primary },
                isGeneratingBio && { opacity: 0.7 },
              ]}
              onPress={handleGenerateBio}
              disabled={isGeneratingBio}
              activeOpacity={0.8}
            >
              {isGeneratingBio ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Wand2 size={16} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
              )}
              <Text style={styles.generateButtonText}>
                {isGeneratingBio ? 'Suggestion...' : 'Suggérer'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Separator */}
        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        {/* Pays */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Pays</Text>
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
                  { borderColor: colors.gray200, backgroundColor: colors.gray100 },
                  country === c.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => {
                  form.setValue('country', c.id);
                  form.setValue('region', '');
                  form.setValue('commune', '');
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
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Région</Text>
            <ScrollView
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
                    { borderColor: colors.gray200, backgroundColor: colors.gray100 },
                    region === r.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => {
                    form.setValue('region', r.id);
                    form.setValue('commune', '');
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

        {/* Commune */}
        {availableCommunes.length > 0 && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Commune / Ville</Text>
            <ScrollView
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
                    { borderColor: colors.gray200, backgroundColor: colors.gray100 },
                    commune === c.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => form.setValue('commune', c.id)}
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

        {/* Separator */}
        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        {/* Telephone */}
        <Input
          label="Telephone"
          placeholder="+225 07 00 00 00 00"
          value={phone}
          onChangeText={(text) => form.setValue('phone', text)}
          keyboardType="phone-pad"
        />

        {/* Email */}
        <Input
          label="Email"
          placeholder="ton@email.com"
          value={email}
          onChangeText={(text) => form.setValue('email', text)}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Préférences de travail */}
        <View style={[styles.preferencesSection, { borderTopColor: colors.gray200 }]}>
          <Text style={[styles.preferencesSectionTitle, { color: colors.gray700 }]}>
            Préférences de travail
          </Text>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Laptop size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
              <View style={styles.preferenceTextContainer}>
                <Text style={[styles.preferenceLabel, { color: colors.textPrimary }]}>Disponible en remote</Text>
                <Text style={[styles.preferenceDescription, { color: colors.gray500 }]}>Je peux travailler à distance</Text>
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
                <Text style={[styles.preferenceLabel, { color: colors.textPrimary }]}>Ouvert à la relocalisation</Text>
                <Text style={[styles.preferenceDescription, { color: colors.gray500 }]}>Je peux déménager pour une opportunité</Text>
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
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Tes secteurs d'activité</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Choisis jusqu'à {MAX_SECTORS} secteurs qui t'intéressent
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
        {selectedSectors.length}/{MAX_SECTORS} sélectionnés
      </Text>
    </View>
  );

  const renderGoalsStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Tes objectifs</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Choisis jusqu'à {MAX_GOALS} objectifs
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
        {selectedGoals.length}/{MAX_GOALS} sélectionnés
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.gray200 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Modifier le profil</Text>
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
          <StepIndicator steps={STEPS_DATA} currentStepId={currentStep} />

          {currentStep === 'info' && renderInfoStep()}
          {currentStep === 'sectors' && renderSectorsStep()}
          {currentStep === 'goals' && renderGoalsStep()}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.background }]}>
          <View style={styles.footerButtons}>
            {currentStep !== 'info' && (
              <Button
                title="Précédent"
                onPress={handleBack}
                variant="outline"
                icon={<ArrowLeft size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
                iconPosition="left"
                style={styles.footerBackButton}
              />
            )}
            <Button
              title={
                form.state.isSubmitting
                  ? 'Enregistrement...'
                  : currentStep === 'goals'
                    ? 'Enregistrer'
                    : 'Suivant'
              }
              onPress={handleNext}
              disabled={form.state.isSubmitting}
              style={{ flex: 1 }}
              icon={
                form.state.isSubmitting ? undefined : (
                  currentStep === 'goals'
                    ? <Check size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                    : <ChevronRight size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                )
              }
              iconPosition="right"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  },

  keyboardView: {
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

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
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

  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#FFFFFF',
  },

  separator: {
    height: 1,
    marginVertical: SPACING.md,
  },

  formFields: {
    gap: SPACING.md,
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

  generateButtonContainer: {
    alignItems: 'flex-start',
    marginTop: SPACING.sm,
  },

  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.sm,
  },

  generateButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#FFFFFF',
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

  selectableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.full,
  },

  selectableTagText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  selectionHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },

  // Preferences
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

  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },

  footerButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  footerBackButton: {
    flex: 0,
  },
});
