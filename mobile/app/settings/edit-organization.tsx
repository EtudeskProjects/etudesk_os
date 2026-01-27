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
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Check,
  ArrowLeft,
  Camera,
  MapPin,
  Map,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { Input, Button } from '../../src/components/ui';
import { useTheme } from '../../src/hooks/useTheme';
import { useSpace } from '../../src/contexts/SpaceContext';
import { COUNTRIES, getRegionsByCountry, getCommunesByRegion } from '../../src/constants/location';
import {
  ORGANIZATION_TYPE_LABELS,
  OrganizationType,
} from '../../src/types/models';
import { organizationService, talentService, imageService } from '../../src/services';
import MapLocationPicker from '../../src/components/MapLocationPicker';

type Step = 'info' | 'location';

const MAX_ORG_TYPES = 3;

const ORGANIZATION_TYPE_OPTIONS = Object.entries(ORGANIZATION_TYPE_LABELS).map(([id, label]) => ({
  id: id as OrganizationType,
  label,
}));

export default function EditOrganizationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { refreshOrganizations } = useSpace();
  const [currentStep, setCurrentStep] = useState<Step>('info');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Form state - Info
  const [name, setName] = useState('');
  const [orgTypes, setOrgTypes] = useState<OrganizationType[]>([]);
  const [description, setDescription] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);

  // Form state - Location
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);

  // Refs for auto-scroll to selected country
  const countryScrollRef = useRef<ScrollView>(null);
  const COUNTRY_CHIP_WIDTH = 80;

  // Auto-scroll to selected country
  useEffect(() => {
    if (country && countryScrollRef.current && currentStep === 'location') {
      const countryIndex = COUNTRIES.findIndex(c => c.id === country);
      if (countryIndex > 0) {
        setTimeout(() => {
          countryScrollRef.current?.scrollTo({
            x: countryIndex * COUNTRY_CHIP_WIDTH,
            animated: true,
          });
        }, 100);
      }
    }
  }, [country, currentStep]);

  // Load organization data on mount
  useEffect(() => {
    if (id) {
      loadOrganization(id);
    } else {
      loadFirstOrganization();
    }
  }, [id]);

  const loadOrganization = async (orgId: string) => {
    try {
      setIsLoading(true);
      const response = await organizationService.get(orgId);
      const org = response.data;

      if (org) {
        setOrganizationId(org.id);
        setName(org.name || '');
        // Handle type - can be single or array
        if (org.type) {
          setOrgTypes([org.type as OrganizationType]);
        }
        setDescription(org.description || '');
        setLogoUri(org.logo_url || null);
        setCountry(org.headquarters_country || '');
        setRegion(org.headquarters_region || '');
        setCity(org.headquarters_city || '');
      }
    } catch (error) {
      console.error('Error loading organization:', error);
      // Try to load user profile for default location
      await loadUserProfileDefaults();
      Alert.alert('Erreur', 'Impossible de charger l\'organisation.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFirstOrganization = async () => {
    try {
      setIsLoading(true);
      const response = await organizationService.getMyOrganizations();
      if (response.data && response.data.length > 0) {
        const org = response.data[0];
        setOrganizationId(org.id);
        setName(org.name || '');
        if (org.type) {
          setOrgTypes([org.type as OrganizationType]);
        }
        setDescription(org.description || '');
        setLogoUri(org.logo_url || null);
        setCountry(org.headquarters_country || '');
        setRegion(org.headquarters_region || '');
        setCity(org.headquarters_city || '');
      } else {
        // No organization found, load user profile defaults
        await loadUserProfileDefaults();
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
      await loadUserProfileDefaults();
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserProfileDefaults = async () => {
    try {
      const response = await talentService.getMyProfile();
      if (response.data) {
        if (!country && response.data.country) setCountry(response.data.country);
        if (!region && response.data.region) setRegion(response.data.region);
        if (!city && response.data.city) setCity(response.data.city);
      }
    } catch (error) {
      console.log('Could not load user profile for defaults:', error);
    }
  };

  // Get regions and cities dynamically
  const availableRegions = country ? getRegionsByCountry(country) : [];
  const availableCities = country && region ? getCommunesByRegion(country, region) : [];

  const pickLogo = async () => {
    try {
      const image = await imageService.pickImage({ type: 'logo' });
      if (image) {
        setLogoUri(image.uri);
      }
    } catch (error) {
      console.error('Erreur lors de la sélection du logo:', error);
    }
  };

  // Toggle organization type selection (max 3)
  const toggleOrgType = (typeId: OrganizationType) => {
    setOrgTypes((prev) => {
      if (prev.includes(typeId)) {
        return prev.filter((id) => id !== typeId);
      }
      if (prev.length >= MAX_ORG_TYPES) {
        return prev;
      }
      return [...prev, typeId];
    });
  };

  // Handle map location selection
  const handleMapLocationSelect = (location: any) => {
    setShowMapPicker(false);

    if (location.coordinates) {
      setCoordinates(location.coordinates);
    }

    // Update location fields from geocoding
    if (location.countryCode) {
      setCountry(location.countryCode);
    }
    if (location.region) {
      const matchedRegion = availableRegions.find(r =>
        r.label.toLowerCase().includes(location.region.toLowerCase()) ||
        location.region.toLowerCase().includes(r.label.toLowerCase())
      );
      if (matchedRegion) {
        setRegion(matchedRegion.id);
      }
    }
    if (location.city) {
      const matchedCity = availableCities.find(c =>
        c.label.toLowerCase().includes(location.city.toLowerCase()) ||
        location.city.toLowerCase().includes(c.label.toLowerCase())
      );
      if (matchedCity) {
        setCity(matchedCity.id);
      }
    }
  };

  const handleNext = () => {
    if (currentStep === 'info') {
      setCurrentStep('location');
    } else {
      handleSave();
    }
  };

  const handleBack = () => {
    if (currentStep === 'info') {
      router.back();
    } else {
      setCurrentStep('info');
    }
  };

  const handleSave = async () => {
    if (!organizationId) {
      Alert.alert('Erreur', 'Aucune organisation à modifier.');
      return;
    }

    try {
      setIsSaving(true);

      await organizationService.update(organizationId, {
        name: name.trim() || undefined,
        type: orgTypes.length > 0 ? orgTypes[0] : undefined,
        description: description.trim() || undefined,
        logo_url: logoUri || undefined,
        headquarters_city: city || undefined,
        headquarters_region: region || undefined,
        headquarters_country: country || undefined,
      });

      // Refresh organizations in SpaceContext to update logo everywhere
      await refreshOrganizations();

      Alert.alert(
        'Succès',
        'Les informations de l\'organisation ont été mises à jour.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Error saving organization:', error);
      Alert.alert(
        'Erreur',
        error?.error || 'Une erreur est survenue lors de la mise à jour.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
    }
  };

  const canProceed = () => {
    if (currentStep === 'info') {
      return name.trim().length >= 2;
    }
    return true;
  };

  const STEPS: Step[] = ['info', 'location'];

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, index) => (
        <TouchableOpacity
          key={step}
          onPress={() => setCurrentStep(step)}
          style={[
            styles.stepDot,
            { backgroundColor: colors.gray200 },
            currentStep === step && { backgroundColor: colors.primary },
            STEPS.indexOf(currentStep) > index && { backgroundColor: colors.primary },
          ]}
        >
          {STEPS.indexOf(currentStep) > index && (
            <Check size={12} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth + 0.5} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderInfoStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Infos de l'organisation</Text>
      </View>

      <View style={styles.formFields}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <TouchableOpacity
            style={[styles.logoContainer, { backgroundColor: colors.gray100, borderColor: colors.borderColor }]}
            onPress={pickLogo}
          >
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImage} />
            ) : (
              <Camera size={ICON.size.lg} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            )}
          </TouchableOpacity>
          <Text style={[styles.logoHint, { color: colors.textSecondary }]}>
            Modifier le logo
          </Text>
        </View>

        {/* Nom */}
        <Input
          label="Nom de l'organisation *"
          placeholder="Ex: Etudesk"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        {/* Type - Multi-select (max 3) */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
            Type d'organisation (max {MAX_ORG_TYPES})
          </Text>
          <View style={styles.tagsContainer}>
            {ORGANIZATION_TYPE_OPTIONS.map((type) => {
              const isSelected = orgTypes.includes(type.id);
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.selectableTag,
                    { backgroundColor: colors.surface, borderColor: colors.gray200 },
                    isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary },
                  ]}
                  onPress={() => toggleOrgType(type.id)}
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
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.selectionHint, { color: colors.gray500 }]}>
            {orgTypes.length}/{MAX_ORG_TYPES} sélectionnés
          </Text>
        </View>

        {/* Description */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Description</Text>
          <View style={[styles.textAreaContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
            <TextInput
              style={[styles.textArea, { color: colors.textPrimary }]}
              placeholder="Décrivez votre organisation en quelques mots..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
              placeholderTextColor={colors.gray500}
            />
          </View>
          <Text style={[styles.charCount, { color: colors.gray500 }]}>{description.length}/500</Text>
        </View>
      </View>
    </View>
  );

  const renderLocationStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Localisation</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Où se trouve votre organisation ?
        </Text>
      </View>

      <View style={styles.formFields}>
        {/* Map Button */}
        <TouchableOpacity
          style={[
            styles.mapButton,
            { backgroundColor: colors.primary + '10', borderColor: colors.primary },
          ]}
          onPress={() => setShowMapPicker(true)}
          activeOpacity={0.7}
        >
          <Map size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <View style={styles.mapButtonTextContainer}>
            <Text style={[styles.mapButtonTitle, { color: colors.primary }]}>
              Sélectionner sur la carte
            </Text>
            <Text style={[styles.mapButtonSubtitle, { color: colors.gray500 }]}>
              {coordinates ? 'Position sélectionnée' : 'Appuyez pour ouvrir la carte'}
            </Text>
          </View>
          <ChevronRight size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>

        {/* Coordinates display */}
        {coordinates && (
          <View style={[styles.coordinatesBox, { backgroundColor: colors.gray100 }]}>
            <MapPin size={14} color={colors.gray600} strokeWidth={2} />
            <Text style={[styles.coordinatesText, { color: colors.gray600 }]}>
              {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
            </Text>
          </View>
        )}

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
                  { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                  country === c.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => {
                  setCountry(c.id);
                  setRegion('');
                  setCity('');
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
                    { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                    region === r.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => {
                    setRegion(r.id);
                    setCity('');
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

        {/* Ville */}
        {availableCities.length > 0 && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Ville</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
              contentContainerStyle={styles.horizontalScrollContent}
            >
              {availableCities.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.optionChip,
                    { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                    city === c.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setCity(c.id)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      { color: colors.gray700 },
                      city === c.id && { color: colors.textOnPrimary },
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Chargement...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Modifier l'organisation</Text>
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
          {currentStep === 'location' && renderLocationStep()}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.background }]}>
          <Button
            title={currentStep === 'location' ? (isSaving ? 'Enregistrement...' : 'Enregistrer') : 'Continuer'}
            onPress={handleNext}
            disabled={!canProceed() || isSaving}
            fullWidth
            icon={
              isSaving ? undefined :
                <ChevronRight
                  size={ICON.size.md}
                  color={colors.textOnPrimary}
                  strokeWidth={ICON.strokeWidth}
                />
            }
            iconPosition="right"
          />
        </View>
      </KeyboardAvoidingView>

      {/* Map Picker Modal */}
      <Modal
        visible={showMapPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMapPicker(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMapPicker(false)} style={styles.backButton}>
              <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Sélectionner la position</Text>
            <View style={styles.headerSpacer} />
          </View>
          <MapLocationPicker
            initialCoordinates={coordinates || undefined}
            onLocationSelect={handleMapLocationSelect}
            height={undefined}
          />
        </SafeAreaView>
      </Modal>
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
    gap: SPACING.md,
  },

  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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

  logoSection: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },

  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: BORDER.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDER.width.thin,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },

  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  logoHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.sm,
  },

  fieldContainer: {
    gap: SPACING.xs,
  },

  fieldLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
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
    minHeight: 100,
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
    marginTop: SPACING.md,
  },

  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.md,
    borderStyle: 'dashed',
  },

  mapButtonTextContainer: {
    flex: 1,
  },

  mapButtonTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  mapButtonSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  coordinatesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },

  coordinatesText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },

  modalContainer: {
    flex: 1,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
});
