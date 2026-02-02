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
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, LAYOUT, BORDER } from '../../src/constants/theme';
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

type Step = 'info' | 'sectors' | 'goals';

export default function EditProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { refreshUser } = useAuth();

  const [currentStep, setCurrentStep] = useState<Step>('info');

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Profile photo
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Form state - Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [commune, setCommune] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Refs for auto-scroll to selected country
  const countryScrollRef = useRef<ScrollView>(null);
  const COUNTRY_CHIP_WIDTH = 80;

  // Preferences
  const [remoteReady, setRemoteReady] = useState(true);
  const [willingToRelocate, setWillingToRelocate] = useState(true);

  // Tags, sectors, goals
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

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
        setFirstName(profile.first_name || '');
        setLastName(profile.last_name || '');
        setBio(profile.bio || '');
        setGender(profile.gender || '');
        setCountry(profile.country || '');
        setRegion(profile.region || '');
        setCommune(profile.city || '');
        setPhone(profile.phone || '');
        setEmail(profile.email || '');
        setAvatarUri(profile.avatar_url || null);
        setRemoteReady(profile.remote_ready || false);
        setWillingToRelocate(profile.willing_to_relocate || false);
        setSelectedTags(profile.profile_tags || []);
        setSelectedSectors(profile.sectors || []);
        setSelectedGoals(profile.goals || []);
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
        setAvatarUri(image.uri);
      }
    } catch (error) {
      console.error('Erreur lors de la sélection de l\'image:', error);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tagId)) return prev.filter((id) => id !== tagId);
      if (prev.length >= MAX_PROFILE_TAGS) return prev;
      return [...prev, tagId];
    });
  };

  const toggleSector = (sectorId: string) => {
    setSelectedSectors((prev) => {
      if (prev.includes(sectorId)) return prev.filter((id) => id !== sectorId);
      if (prev.length >= MAX_SECTORS) return prev;
      return [...prev, sectorId];
    });
  };

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((prev) => {
      if (prev.includes(goalId)) return prev.filter((id) => id !== goalId);
      if (prev.length >= MAX_GOALS) return prev;
      return [...prev, goalId];
    });
  };

  const handleNext = async () => {
    if (currentStep === 'info') {
      setCurrentStep('sectors');
    } else if (currentStep === 'sectors') {
      setCurrentStep('goals');
    } else {
      await handleSave();
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

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const displayName = `${firstName} ${lastName}`.trim() || firstName || lastName;

      await talentService.updateMyProfile({
        display_name: displayName,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        bio: bio.trim() || undefined,
        gender: gender as 'M' | 'F' | 'O' || undefined,
        country: country || undefined,
        region: region || undefined,
        city: commune || undefined,
        phone: phone || undefined,
        avatar_url: avatarUri || undefined,
        remote_ready: remoteReady,
        willing_to_relocate: willingToRelocate,
        profile_tags: selectedTags,
        sectors: selectedSectors,
        goals: selectedGoals,
      });

      await refreshUser();

      Alert.alert('Succès', 'Ton profil a été mis à jour.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert(
        'Erreur',
        error?.error || 'Une erreur est survenue lors de la mise à jour du profil.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
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

        {/* Prénom & Nom */}
        <View style={styles.rowFields}>
          <View style={styles.halfField}>
            <Input
              label="Prénom"
              placeholder=""
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.halfField}>
            <Input
              label="Nom"
              placeholder=""
              value={lastName}
              onChangeText={setLastName}
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
                onPress={() => setGender(g.id)}
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

        {/* Bio */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Bio</Text>
          <View style={[styles.textAreaContainer, { borderColor: colors.gray200, backgroundColor: colors.surface }]}>
            <TextInput
              style={[styles.textArea, { color: colors.textPrimary }]}
              placeholder="Décris-toi en quelques mots..."
              placeholderTextColor={colors.gray400}
              value={bio}
              onChangeText={(text) => setBio(text.slice(0, 300))}
              multiline
              maxLength={300}
            />
            <Text style={[styles.charCount, { color: colors.gray400 }]}>{bio.length}/300</Text>
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
                  setCountry(c.id);
                  setRegion('');
                  setCommune('');
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
                    setRegion(r.id);
                    setCommune('');
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
                  onPress={() => setCommune(c.id)}
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

        {/* Téléphone */}
        <Input
          label="Téléphone"
          placeholder="+225 07 00 00 00 00"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        {/* Email */}
        <Input
          label="Email"
          placeholder="ton@email.com"
          value={email}
          onChangeText={setEmail}
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
              onValueChange={setRemoteReady}
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
                isSaving
                  ? 'Enregistrement...'
                  : currentStep === 'goals'
                    ? 'Enregistrer'
                    : 'Suivant'
              }
              onPress={handleNext}
              disabled={isSaving}
              style={{ flex: 1 }}
              icon={
                isSaving ? undefined : (
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
