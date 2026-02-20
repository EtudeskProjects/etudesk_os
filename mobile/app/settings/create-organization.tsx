import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Check,
  ArrowLeft,
  Camera,
  MapPin,
	} from 'lucide-react-native';
	import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../src/constants/theme';
	import { Chip, IconButton, Input, Button, StepIndicator } from '../../src/components/ui';
	import { FormTextArea } from '../../src/components/forms/FormTextArea';
	import { useTheme } from '../../src/hooks/useTheme';
	import { useSpace } from '../../src/contexts/SpaceContext';
	import { COUNTRIES, getRegionsByCountry, getCommunesByRegion } from '../../src/constants/location';
import {
  ORGANIZATION_TYPE_LABELS,
  OrganizationType,
} from '../../src/types/models';
import { organizationService, talentService, imageService } from '../../src/services';
import { SECTOR_DATA, MAX_SECTORS, Sector } from '../../src/constants/talent';
import MapLocationPicker from '../../src/components/MapLocationPicker';
import { useForm } from '../../src/hooks/useForm';
import { useAlert } from '../../src/contexts/AlertContext';
import { ScrollToInputContext } from '../../src/contexts/ScrollToInputContext';

type Step = 'info' | 'location';

const MAX_ORG_TYPES = 3;

const ORGANIZATION_TYPE_OPTIONS = Object.entries(ORGANIZATION_TYPE_LABELS).map(([id, label]) => ({
  id: id as OrganizationType,
  label,
}));

// Type for form values
interface OrganizationFormValues {
  name: string;
  orgTypes: OrganizationType[];
  description: string;
  logoUri: string | null;
  sectors: Sector[];
  websiteUrl: string;
  contactEmail: string;
  contactPhone: string;
  country: string;
  region: string;
  city: string;
  coordinates: { latitude: number; longitude: number } | null;
}

export default function CreateOrganizationScreen() {
  const router = useRouter();
  const { refreshOrganizations } = useSpace();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState<Step>('info');

  // Form management with useForm hook
  const form = useForm<OrganizationFormValues>({
    fields: {
      name: { initialValue: '', required: true, requiredMessage: 'Le nom est requis' },
      orgTypes: { initialValue: [], required: true, requiredMessage: 'Sélectionnez au moins un type' },
      description: { initialValue: '' },
      logoUri: { initialValue: null },
      sectors: { initialValue: [] },
      websiteUrl: { initialValue: '' },
      contactEmail: { initialValue: '' },
      contactPhone: { initialValue: '' },
      country: { initialValue: '', required: true, requiredMessage: 'Le pays est requis' },
      region: { initialValue: '' },
      city: { initialValue: '' },
      coordinates: { initialValue: null },
    },
    onSubmit: async (values) => {
      await organizationService.create({
        name: values.name.trim(),
        types: values.orgTypes.length > 0 ? values.orgTypes : undefined,
        description: values.description.trim() || undefined,
        logo_url: values.logoUri || undefined,
        headquarters_city: values.city || undefined,
        headquarters_region: values.region || undefined,
        headquarters_country: values.country || undefined,
        headquarters_coordinates: values.coordinates || undefined,
        sectors: values.sectors.length > 0 ? values.sectors : undefined,
        website_url: values.websiteUrl.trim() || undefined,
        contact_email: values.contactEmail.trim() || undefined,
        contact_phone: values.contactPhone.trim() || undefined,
      });

      await refreshOrganizations();

      void alerts.showAlert({ title: 'Organisation créée', message: `${values.name} a été créée avec succès !`, buttons: [{ text: 'OK', onPress: () => router.back() }] });
    },
  });

  // Refs for auto-scroll to selected country
  const countryScrollRef = useRef<ScrollView>(null);
  const alerts = useAlert();
  const mainScrollRef = useRef<ScrollView>(null);
  const COUNTRY_CHIP_WIDTH = 80;

  const scrollToInput = useCallback((targetNodeHandle: number, extraOffset = 96) => {
    const sv = mainScrollRef.current;
    if (!sv) return;
    const delay = Platform.OS === 'android' ? 120 : 0;
    setTimeout(() => {
      sv.scrollResponderScrollNativeHandleToKeyboard(targetNodeHandle, extraOffset, true);
    }, delay);
  }, []);

  // Get form values for convenience
  const country = form.getValue('country');
  const region = form.getValue('region');
  const city = form.getValue('city');
  const orgTypes = form.getValue('orgTypes');
  const sectors = form.getValue('sectors');
  const name = form.getValue('name');
  const description = form.getValue('description');
  const logoUri = form.getValue('logoUri');
  const coordinates = form.getValue('coordinates');
  const websiteUrl = form.getValue('websiteUrl');
  const contactEmail = form.getValue('contactEmail');
  const contactPhone = form.getValue('contactPhone');

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

  // Load user profile for default location
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const response = await talentService.getMyProfile();
      if (response.data) {
        // Pre-fill location from user profile
        form.setValues({
          country: response.data.country || '',
          region: response.data.region || '',
          city: response.data.city || '',
        });
      }
    } catch (error) {
    }
  };

  // Get regions and cities dynamically
  const availableRegions = country ? getRegionsByCountry(country) : [];
  const availableCities = country && region ? getCommunesByRegion(country, region) : [];

  const pickLogo = async () => {
    try {
      const image = await imageService.pickImage({ type: 'logo' });
      if (image) {
        form.setValue('logoUri', image.uri);
      }
    } catch (error) {
      if (__DEV__) console.error('Erreur lors de la sélection du logo:', error);
    }
  };

  // Toggle organization type selection (max 3)
  const toggleOrgType = (typeId: OrganizationType) => {
    const current = form.getValue('orgTypes');
    if (current.includes(typeId)) {
      form.setValue('orgTypes', current.filter((id) => id !== typeId));
    } else if (current.length < MAX_ORG_TYPES) {
      form.setValue('orgTypes', [...current, typeId]);
    }
  };

  // Toggle sector selection (max 5)
  const toggleSector = (sectorId: Sector) => {
    const current = form.getValue('sectors');
    if (current.includes(sectorId)) {
      form.setValue('sectors', current.filter((id) => id !== sectorId));
    } else if (current.length < MAX_SECTORS) {
      form.setValue('sectors', [...current, sectorId]);
    }
  };

  // Handle map location selection
  const handleMapLocationSelect = (location: any) => {
    const updates: Partial<OrganizationFormValues> = {};

    if (location.coordinates) {
      updates.coordinates = location.coordinates;
    }

    // Update location fields from geocoding
    if (location.countryCode) {
      updates.country = location.countryCode;
    }
    if (location.region) {
      const matchedRegion = availableRegions.find(r =>
        r.label.toLowerCase().includes(location.region.toLowerCase()) ||
        location.region.toLowerCase().includes(r.label.toLowerCase())
      );
      if (matchedRegion) {
        updates.region = matchedRegion.id;
      }
    }
    if (location.city) {
      const matchedCity = availableCities.find(c =>
        c.label.toLowerCase().includes(location.city.toLowerCase()) ||
        location.city.toLowerCase().includes(c.label.toLowerCase())
      );
      if (matchedCity) {
        updates.city = matchedCity.id;
      }
    }

    form.setValues(updates);
  };

  const handleNext = async () => {
    if (currentStep === 'info') {
      setCurrentStep('location');
    } else {
      try {
        await form.handleSubmit();
      } catch (error: any) {
        if (__DEV__) console.error('Error creating organization:', error);
        void alerts.showAlert({ title: 'Erreur', message: error?.message || 'Une erreur est survenue lors de la création de l\'organisation.', buttons: [{ text: 'OK' }] });
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 'info') {
      router.back();
    } else {
      setCurrentStep('info');
    }
  };

  const canProceed = () => {
    if (currentStep === 'info') {
      return name.trim().length >= 2 && orgTypes.length > 0;
    }
    return country.length > 0;
  };

  const STEPS_DATA = [
    { id: 'info', label: 'Infos' },
    { id: 'location', label: 'Localisation' },
  ];

  const renderStepIndicator = () => (
    <StepIndicator steps={STEPS_DATA} currentStepId={currentStep} />
  );

  const renderInfoStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Infos de l'organisation</Text>
      </View>

      <View style={styles.formFields}>
	        {/* Logo */}
	        <View style={styles.logoSection}>
	          <Pressable
	            style={[styles.logoContainer, { backgroundColor: colors.gray100, borderColor: colors.borderColor }]}
	            onPress={pickLogo}
	            accessibilityRole="button"
	            accessibilityLabel="Ajouter un logo"
	          >
	            {logoUri ? (
	              <Image source={{ uri: logoUri }} style={styles.logoImage} resizeMode="cover" />
	            ) : (
	              <Camera size={ICON.size.lg} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
	            )}
	          </Pressable>
	          <Text style={[styles.logoHint, { color: colors.textSecondary }]}>
	            Ajouter un logo
	          </Text>
	        </View>

        {/* Nom */}
        <Input
          label="Nom de l'organisation *"
          placeholder="Ex: Etudesk"
          value={name}
          onChangeText={(value) => form.setValue('name', value)}
          autoCapitalize="words"
          autoFocus
        />

        {/* Type - Multi-select (max 3) */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
            Type d'organisation * (max {MAX_ORG_TYPES})
          </Text>
	          <View style={styles.tagsContainer}>
	            {ORGANIZATION_TYPE_OPTIONS.map((type) => {
	              const isSelected = orgTypes.includes(type.id);
	              return (
	                <Chip
	                  key={type.id}
	                  onPress={() => toggleOrgType(type.id)}
	                  label={type.label}
	                  selected={isSelected}
	                  leftIcon={isSelected ? <Check size={14} color={colors.primary} strokeWidth={2.5} /> : undefined}
	                  style={[
	                    styles.selectableTag,
	                    { backgroundColor: colors.surface, borderColor: colors.gray200 },
	                    isSelected && { backgroundColor: withOpacity(colors.primary, OPACITY[10]), borderColor: colors.primary },
	                  ]}
	                  textStyle={[
	                    styles.selectableTagText,
	                    { color: colors.gray600 },
	                    isSelected && { color: colors.primary },
	                  ]}
	                />
	              );
	            })}
	          </View>
          <Text style={[styles.selectionHint, { color: colors.gray500 }]}>
            {orgTypes.length}/{MAX_ORG_TYPES} sélectionnés
          </Text>
        </View>

        {/* Secteurs */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
            Secteurs d'activité (max {MAX_SECTORS})
          </Text>
	          <View style={styles.tagsContainer}>
	            {SECTOR_DATA.map((sector) => {
	              const isSelected = sectors.includes(sector.id);
	              return (
	                <Chip
	                  key={sector.id}
	                  onPress={() => toggleSector(sector.id)}
	                  label={sector.label}
	                  selected={isSelected}
	                  leftIcon={isSelected ? <Check size={14} color={colors.primary} strokeWidth={2.5} /> : undefined}
	                  style={[
	                    styles.selectableTag,
	                    { backgroundColor: colors.surface, borderColor: colors.gray200 },
	                    isSelected && { backgroundColor: withOpacity(colors.primary, OPACITY[10]), borderColor: colors.primary },
	                  ]}
	                  textStyle={[
	                    styles.selectableTagText,
	                    { color: colors.gray600 },
	                    isSelected && { color: colors.primary },
	                  ]}
	                />
	              );
	            })}
	          </View>
          <Text style={[styles.selectionHint, { color: colors.gray500 }]}>
            {sectors.length}/{MAX_SECTORS} sélectionnés
          </Text>
        </View>

        {/* Description */}
        <FormTextArea
          label="Description"
          placeholder="Décrivez votre organisation en quelques mots..."
          value={description}
          onChangeText={(value) => form.setValue('description', value)}
          rows={4}
          maxLength={500}
        />

        {/* Contact - Site web */}
        <Input
          label="Site web"
          placeholder="https://www.exemple.com"
          value={websiteUrl}
          onChangeText={(value) => form.setValue('websiteUrl', value)}
          keyboardType="url"
          autoCapitalize="none"
        />

        {/* Contact - Email */}
        <Input
          label="Email de contact"
          placeholder="contact@exemple.com"
          value={contactEmail}
          onChangeText={(value) => form.setValue('contactEmail', value)}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Contact - Téléphone */}
        <Input
          label="Téléphone"
          placeholder="+225 00 00 00 00 00"
          value={contactPhone}
          onChangeText={(value) => form.setValue('contactPhone', value)}
          keyboardType="phone-pad"
        />
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
        {/* Inline Map */}
        <View style={[styles.inlineMapContainer, { borderColor: colors.gray200 }]}>
          <MapLocationPicker
            initialCoordinates={coordinates || undefined}
            onLocationSelect={handleMapLocationSelect}
            height={220}
          />
        </View>


        {/* Pays */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Pays *</Text>
          <ScrollView
            ref={countryScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalScroll}
            contentContainerStyle={styles.horizontalScrollContent}
          >
	            {COUNTRIES.map((c) => (
	              <Chip
	                key={c.id}
	                onPress={() => {
	                  form.setValues({ country: c.id, region: '', city: '' });
	                }}
	                label={c.label}
	                selected={country === c.id}
	                style={[
	                  styles.optionChip,
	                  { backgroundColor: colors.gray100, borderColor: colors.gray200 },
	                  country === c.id && { backgroundColor: colors.primary, borderColor: colors.primary },
	                ]}
	                textStyle={[
	                  styles.optionChipText,
	                  { color: colors.gray700 },
	                  country === c.id && { color: colors.textOnPrimary },
	                ]}
	              />
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
	                <Chip
	                  key={r.id}
	                  onPress={() => {
	                    form.setValues({ region: r.id, city: '' });
	                  }}
	                  label={r.label}
	                  selected={region === r.id}
	                  style={[
	                    styles.optionChip,
	                    { backgroundColor: colors.gray100, borderColor: colors.gray200 },
	                    region === r.id && { backgroundColor: colors.primary, borderColor: colors.primary },
	                  ]}
	                  textStyle={[
	                    styles.optionChipText,
	                    { color: colors.gray700 },
	                    region === r.id && { color: colors.textOnPrimary },
	                  ]}
	                />
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
	                <Chip
	                  key={c.id}
	                  onPress={() => form.setValue('city', c.id)}
	                  label={c.label}
	                  selected={city === c.id}
	                  style={[
	                    styles.optionChip,
	                    { backgroundColor: colors.gray100, borderColor: colors.gray200 },
	                    city === c.id && { backgroundColor: colors.primary, borderColor: colors.primary },
	                  ]}
	                  textStyle={[
	                    styles.optionChipText,
	                    { color: colors.gray700 },
	                    city === c.id && { color: colors.textOnPrimary },
	                  ]}
	                />
	              ))}
	            </ScrollView>
	          </View>
	        )}
      </View>
    </View>
  );

	  return (
	    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
	      {/* Header */}
	      <View style={styles.header}>
	        <IconButton
	          onPress={handleBack}
	          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
	          accessibilityLabel="Retour"
	          style={styles.backButton}
	        />
	        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Nouvelle organisation</Text>
	        <View style={styles.headerSpacer} />
	      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollToInputContext.Provider value={scrollToInput}>
          <ScrollView
            ref={mainScrollRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            {renderStepIndicator()}

            {currentStep === 'info' && renderInfoStep()}
            {currentStep === 'location' && renderLocationStep()}
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: Math.max(SPACING.lg, insets.bottom + SPACING.md) }]}>
            <Button
              title={currentStep === 'location' ? (form.state.isSubmitting ? 'Création...' : 'Créer l\'organisation') : 'Continuer'}
              onPress={handleNext}
              disabled={!canProceed() || form.state.isSubmitting}
              fullWidth
              icon={
                form.state.isSubmitting ? undefined :
                  <ChevronRight
                    size={ICON.size.md}
                    color={colors.textOnPrimary}
                    strokeWidth={ICON.strokeWidth}
                  />
              }
              iconPosition="right"
            />
          </View>
        </ScrollToInputContext.Provider>
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

  inlineMapContainer: {
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
    borderWidth: BORDER.width.thin,
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
});
