import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  ArrowLeft,
  MapPin,
  Image as ImageIcon,
  Eye,
  Lock,
  Plus,
  X,
  Upload,
  Ruler,
  Users,
  Clock,
  Wand2,
  FileText,
  HelpCircle,
  Trash2,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT, OPACITY, withOpacity } from '../../../src/constants/theme';
import { Input, Button, CheckboxRow, Chip, IconButton, SelectCard, Toggle, StepIndicator, useToast, Tap } from '../../../src/components/ui';
import MapLocationPicker from '../../../src/components/MapLocationPicker';
import { useTheme } from '../../../src/hooks/useTheme';
import { useForm } from '../../../src/hooks/useForm';
import { COUNTRIES, getRegionsByCountry, getCommunesByRegion } from '../../../src/constants/location';
import {
  SPACE_TYPE_DATA,
  SPACE_EQUIPMENT_DATA,
  SPACE_AMENITY_DATA,
  ACCESSIBILITY_DATA,
  SPACE_TYPE_LABELS,
  SPACE_VISIBILITY_DATA,
  SpaceType,
  SpaceEquipment,
  SpaceAmenity,
  AccessibilityFeature,
  calculateSpaceCapacity,
  formatPrice,
} from '../../../src/constants/space';
import { Visibility, ApplicationQuestion } from '../../../src/types/models';
import { SECTOR_DATA, MAX_SECTORS, Sector } from '../../../src/constants/talent';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { useAlert } from '../../../src/contexts/AlertContext';
import { ScrollToInputContext } from '../../../src/contexts/ScrollToInputContext';
import { FormTextArea } from '../../../src/components/forms/FormTextArea';
import { spaceService, CreateSpaceData, imageService, organizationService } from '../../../src/services';

type Step = 'info' | 'location' | 'capacity' | 'conditions' | 'media' | 'preview';

const STEPS: Step[] = ['info', 'location', 'capacity', 'conditions', 'media', 'preview'];

const STEP_TITLES: Record<Step, string> = {
  info: 'Infos',
  location: 'Lieu',
  capacity: 'Capacité',
  conditions: 'Conditions',
  media: 'Média',
  preview: 'Aperçu',
};

const MAX_IMAGES = 5;
const MAX_RULES = 10;
const MAX_QUESTIONS = 5;
const MAX_QUESTION_LENGTH = 200;

const DAYS_OF_WEEK = [
  { id: 1, label: 'Lundi', short: 'Lun' },
  { id: 2, label: 'Mardi', short: 'Mar' },
  { id: 3, label: 'Mercredi', short: 'Mer' },
  { id: 4, label: 'Jeudi', short: 'Jeu' },
  { id: 5, label: 'Vendredi', short: 'Ven' },
  { id: 6, label: 'Samedi', short: 'Sam' },
  { id: 0, label: 'Dimanche', short: 'Dim' },
];

interface ImageItem {
  id: string;
  uri: string;
}

interface DayAvailability {
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

// Form values interface
interface SpaceFormValues {
  // Info
  name: string;
  spaceType: SpaceType | null;
  description: string;
  selectedSectors: Sector[];
  // Location
  address: string;
  country: string;
  region: string;
  city: string;
  coordinates: { lat: number; lng: number } | null;
  // Capacity
  surfaceM2: string;
  capacity: string;
  autoCapacity: boolean;
  selectedEquipment: SpaceEquipment[];
  selectedAmenities: SpaceAmenity[];
  isAccessible: boolean;
  selectedAccessibility: AccessibilityFeature[];
  // Conditions
  visibility: Visibility;
  hourlyRate: string;
  dailyRate: string;
  weeklyRate: string;
  monthlyRate: string;
  paymentCollectionInfo: string;
  requiresApproval: boolean;
  availability: Record<number, DayAvailability>;
  rules: string;
  questions: ApplicationQuestion[];
  // Media
  images: ImageItem[];
}

// Format number without decimals
const formatNumber = (value: number): string => {
  if (!value && value !== 0) return '';
  return Math.round(value).toLocaleString('fr-FR');
};

// Default availability schedule
const DEFAULT_AVAILABILITY: Record<number, DayAvailability> = {
  0: { isOpen: false, startTime: '09:00', endTime: '18:00' },
  1: { isOpen: true, startTime: '08:00', endTime: '20:00' },
  2: { isOpen: true, startTime: '08:00', endTime: '20:00' },
  3: { isOpen: true, startTime: '08:00', endTime: '20:00' },
  4: { isOpen: true, startTime: '08:00', endTime: '20:00' },
  5: { isOpen: true, startTime: '08:00', endTime: '20:00' },
  6: { isOpen: false, startTime: '09:00', endTime: '18:00' },
};

export default function CreateSpaceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { selectedOrgId, selectedOrg } = useSpace();
  const alerts = useAlert();
  const { showToast } = useToast();

  // Keep these states for step navigation and UI
  const [currentStep, setCurrentStep] = useState<Step>('info');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgLocationLoaded, setOrgLocationLoaded] = useState(false);
  const countryScrollRef = useRef<ScrollView>(null);
  const mainScrollRef = useRef<ScrollView>(null);

  const scrollToInput = useCallback((targetNodeHandle: number, extraOffset = 96) => {
    const sv = mainScrollRef.current;
    if (!sv) return;
    const delay = Platform.OS === 'android' ? 120 : 0;
    setTimeout(() => {
      sv.scrollResponderScrollNativeHandleToKeyboard(targetNodeHandle, extraOffset, true);
    }, delay);
  }, []);

  // Helper functions for building payloads
  const isRemoteUrl = (uri: string): boolean => {
    return uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('/uploads/');
  };

  const buildImagesPayload = async (images: ImageItem[]): Promise<string[] | null> => {
    const localImages = images.filter((img) => !isRemoteUrl(img.uri));
    const uploadedUrls: string[] = [];

    for (const image of localImages) {
      try {
        const uploaded = await imageService.uploadImage(
          { uri: image.uri, width: 800, height: 600 },
          'illustration',
          'space'
        );
        uploadedUrls.push(uploaded.url);
      } catch (error) {
        await alerts.error('Erreur', 'Impossible d\'uploader une image.');
        return null;
      }
    }

    const remoteUrls = images.filter((img) => isRemoteUrl(img.uri)).map(img => img.uri);
    return [...remoteUrls, ...uploadedUrls];
  };

  // Convert availability state to backend format
  const buildAvailabilities = (availability: Record<number, DayAvailability>) => {
    const availabilities: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }> = [];

    Object.entries(availability).forEach(([dayId, dayAvail]) => {
      if (dayAvail.isOpen) {
        availabilities.push({
          day_of_week: parseInt(dayId),
          start_time: dayAvail.startTime,
          end_time: dayAvail.endTime,
        });
      }
    });

    return availabilities.length > 0 ? availabilities : undefined;
  };

  const buildSpaceData = (values: SpaceFormValues, imageUrls?: string[]): CreateSpaceData => ({
    name: values.name,
    type: values.spaceType!,
    description: values.description || undefined,
    address: values.address || undefined,
    city: values.city || undefined,
    region: values.region || undefined,
    country: values.country || 'CI',
    surface_m2: parseFloat(values.surfaceM2),
    capacity: parseInt(values.capacity),
    equipment: values.selectedEquipment,
    amenities: values.selectedAmenities,
    sectors: values.selectedSectors.length > 0 ? values.selectedSectors : undefined,
    is_accessible: values.isAccessible,
    accessibility_features: values.isAccessible ? values.selectedAccessibility : [],
    hourly_rate: values.hourlyRate ? parseFloat(values.hourlyRate) : undefined,
    daily_rate: values.dailyRate ? parseFloat(values.dailyRate) : undefined,
    weekly_rate: values.weeklyRate ? parseFloat(values.weeklyRate) : undefined,
    monthly_rate: values.monthlyRate ? parseFloat(values.monthlyRate) : undefined,
    payment_collection_info: values.paymentCollectionInfo.trim() || undefined,
    is_bookable: true,
    requires_approval: true,
    booking_rules: values.rules.trim() ? [values.rules.trim()] : undefined,
    questions: values.questions.filter(q => q.question.trim().length > 0).map(q => q.question) as any,
    cover_image_url: imageUrls && imageUrls.length > 0 ? imageUrls[0] : undefined,
    gallery_images: imageUrls && imageUrls.length > 0 ? imageUrls : undefined,
    organization_id: selectedOrgId!,
    coordinates: values.coordinates || undefined,
    visibility: values.visibility,
    availabilities: buildAvailabilities(values.availability),
  });

  // Form hook with all fields
  const form = useForm<SpaceFormValues>({
    fields: {
      // Info
      name: { initialValue: '' },
      spaceType: { initialValue: null },
      description: { initialValue: '' },
      selectedSectors: { initialValue: [] },
      // Location
      address: { initialValue: '' },
      country: { initialValue: 'CI' },
      region: { initialValue: '' },
      city: { initialValue: '' },
      coordinates: { initialValue: null },
      // Capacity
      surfaceM2: { initialValue: '' },
      capacity: { initialValue: '' },
      autoCapacity: { initialValue: true },
      selectedEquipment: { initialValue: [] },
      selectedAmenities: { initialValue: [] },
      isAccessible: { initialValue: false },
      selectedAccessibility: { initialValue: [] },
      // Conditions
      visibility: { initialValue: 'PUBLIC' },
      hourlyRate: { initialValue: '' },
      dailyRate: { initialValue: '' },
      weeklyRate: { initialValue: '' },
      monthlyRate: { initialValue: '' },
      paymentCollectionInfo: { initialValue: '' },
      requiresApproval: { initialValue: false },
      availability: { initialValue: DEFAULT_AVAILABILITY },
      rules: { initialValue: '' },
      questions: { initialValue: [] },
      // Media
      images: { initialValue: [] },
    },
    onSubmit: async (values) => {
      if (isSubmitting) return;
      if (!selectedOrgId) {
        await alerts.error('Erreur', 'Aucune organisation sélectionnée.');
        return;
      }

      setIsSubmitting(true);
      try {
        const imageUrls = await buildImagesPayload(values.images);
        if (imageUrls === null) {
          setIsSubmitting(false);
          return;
        }

        const data = buildSpaceData(values, imageUrls.length > 0 ? imageUrls : undefined);
        await spaceService.create(data);

        await alerts.showAlert({
          type: 'success',
          title: 'Espace créé',
          message: `"${values.name}" a été créé avec succès !`,
          buttons: [{ text: 'OK', onPress: () => router.back() }],
        });
      } catch (error: any) {
        await alerts.error('Erreur', error.error || 'Une erreur est survenue.');
      } finally {
        setIsSubmitting(false);
      }
    },
    validateOnChange: false,
  });

  // Convenience getters for all form values
  const name = form.getValue('name');
  const spaceType = form.getValue('spaceType');
  const description = form.getValue('description');
  const selectedSectors = form.getValue('selectedSectors');
  const address = form.getValue('address');
  const country = form.getValue('country');
  const region = form.getValue('region');
  const city = form.getValue('city');
  const coordinates = form.getValue('coordinates');
  const surfaceM2 = form.getValue('surfaceM2');
  const capacity = form.getValue('capacity');
  const autoCapacity = form.getValue('autoCapacity');
  const selectedEquipment = form.getValue('selectedEquipment');
  const selectedAmenities = form.getValue('selectedAmenities');
  const isAccessible = form.getValue('isAccessible');
  const selectedAccessibility = form.getValue('selectedAccessibility');
  const visibility = form.getValue('visibility');
  const hourlyRate = form.getValue('hourlyRate');
  const dailyRate = form.getValue('dailyRate');
  const weeklyRate = form.getValue('weeklyRate');
  const monthlyRate = form.getValue('monthlyRate');
  const paymentCollectionInfo = form.getValue('paymentCollectionInfo');
  const requiresApproval = form.getValue('requiresApproval');
  const availability = form.getValue('availability');
  const rules = form.getValue('rules');
  const questions = form.getValue('questions');
  const images = form.getValue('images');

  // Get regions and cities
  const availableRegions = country ? getRegionsByCountry(country) : [];
  const availableCities = country && region ? getCommunesByRegion(country, region) : [];

  // Check if can generate suggestions
  const canGenerate = name.trim().length >= 3 && spaceType !== null;

  // Auto-calculate capacity when surface or type changes
  useEffect(() => {
    if (autoCapacity && surfaceM2 && spaceType) {
      const calculatedCapacity = calculateSpaceCapacity(parseFloat(surfaceM2), spaceType);
      form.setValue('capacity', calculatedCapacity.toString());
    }
  }, [surfaceM2, spaceType, autoCapacity]);

  // Load organization location
  useEffect(() => {
    const loadOrgLocation = async () => {
      if (selectedOrgId && !orgLocationLoaded) {
        try {
          const response = await organizationService.get(selectedOrgId);
          const org = response.data;
          if (org) {
            form.setValues({
              country: org.headquarters_country || 'CI',
              region: org.headquarters_region || '',
              city: org.headquarters_city || '',
            });
          }
        } catch (error) {
          form.setValue('country', 'CI');
        }
        setOrgLocationLoaded(true);
      }
    };
    loadOrgLocation();
  }, [selectedOrgId, orgLocationLoaded]);

  // Handle AI generation
  const handleGenerate = async () => {
    if (!canGenerate || isGenerating || !selectedOrgId || !spaceType) return;

    setIsGenerating(true);
    const startTime = Date.now();

    try {
      // Collect all existing form data
      const existingData: Partial<CreateSpaceData> = {
        name: name.trim(),
        type: spaceType,
        description: description || undefined,
        sectors: selectedSectors.length > 0 ? selectedSectors : undefined,
        equipment: selectedEquipment.length > 0 ? selectedEquipment : undefined,
        amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
        booking_rules: rules ? [rules] : undefined,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        daily_rate: dailyRate ? parseFloat(dailyRate) : undefined,
        weekly_rate: weeklyRate ? parseFloat(weeklyRate) : undefined,
        monthly_rate: monthlyRate ? parseFloat(monthlyRate) : undefined,
        address: address || undefined,
        city: city || undefined,
        region: region || undefined,
        country: country || undefined,
        coordinates: coordinates || undefined,
        surface_m2: surfaceM2 ? parseFloat(surfaceM2) : undefined,
        capacity: capacity ? parseInt(capacity, 10) : undefined,
      };

      const response = await spaceService.generate({
        name: name.trim(),
        type: spaceType,
        organization_id: selectedOrgId,
        existing_data: existingData,
      });

      const duration = Date.now() - startTime;

      if (response.success && response.data) {
        const data = response.data;

        // Apply generated data to form fields
        if (data.suggested_name) form.setValue('name', data.suggested_name);
        if (data.description) form.setValue('description', data.description);

        // Sectors - apply up to 5 sectors
        if (data.sectors && data.sectors.length > 0) {
          form.setValue('selectedSectors', data.sectors.slice(0, MAX_SECTORS) as Sector[]);
        }

        // Equipment
        if (data.equipment && data.equipment.length > 0) {
          form.setValue('selectedEquipment', data.equipment.filter(e => SPACE_EQUIPMENT_DATA.some(d => d.id === e)) as SpaceEquipment[]);
        }

        // Amenities
        if (data.amenities && data.amenities.length > 0) {
          form.setValue('selectedAmenities', data.amenities.filter(a => SPACE_AMENITY_DATA.some(d => d.id === a)) as SpaceAmenity[]);
        }

        // Surface & Capacity
        if (data.surface_m2) form.setValue('surfaceM2', Math.round(data.surface_m2).toString());
        if (data.capacity) form.setValue('capacity', Math.round(data.capacity).toString());

        // Rules
        if (data.rules) form.setValue('rules', data.rules);

        // Pricing
        if (data.hourly_rate) form.setValue('hourlyRate', Math.round(data.hourly_rate).toString());
        if (data.daily_rate) form.setValue('dailyRate', Math.round(data.daily_rate).toString());
        if (data.weekly_rate) form.setValue('weeklyRate', Math.round(data.weekly_rate).toString());
        if (data.monthly_rate) form.setValue('monthlyRate', Math.round(data.monthly_rate).toString());

        // Questions
        if (data.questions && data.questions.length > 0) {
          const newQuestions: ApplicationQuestion[] = data.questions.slice(0, MAX_QUESTIONS).map((q, idx) => ({
            id: Date.now().toString() + idx,
            question: q,
            required: false,
            max_length: MAX_QUESTION_LENGTH,
          }));
          form.setValue('questions', newQuestions);
        }
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[CreateSpace] AI Generation - Failed after ${duration}ms:`, error);
      showToast({
        type: 'error',
        title: 'Erreur de génération',
        message: error?.error || 'Une erreur est survenue lors de la génération.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const pickImage = async () => {
    const currentImages = form.getValue('images');
    if (currentImages.length >= MAX_IMAGES) {
      showToast({ type: 'warning', title: 'Limite atteinte', message: `Maximum ${MAX_IMAGES} images.` });
      return;
    }
    try {
      const image = await imageService.pickImage({ type: 'illustration' });
      if (image) {
        form.setValue('images', [...currentImages, { id: Date.now().toString(), uri: image.uri }]);
      }
    } catch (error) {
      showToast({ type: 'error', title: 'Erreur', message: 'Impossible de sélectionner l\'image.' });
    }
  };

  const removeImage = (id: string) => {
    const currentImages = form.getValue('images');
    form.setValue('images', currentImages.filter((img) => img.id !== id));
  };

  const toggleEquipment = (id: SpaceEquipment) => {
    const current = form.getValue('selectedEquipment');
    if (current.includes(id)) {
      form.setValue('selectedEquipment', current.filter((e) => e !== id));
    } else {
      form.setValue('selectedEquipment', [...current, id]);
    }
  };

  const toggleAmenity = (id: SpaceAmenity) => {
    const current = form.getValue('selectedAmenities');
    if (current.includes(id)) {
      form.setValue('selectedAmenities', current.filter((a) => a !== id));
    } else {
      form.setValue('selectedAmenities', [...current, id]);
    }
  };

  const toggleAccessibility = (id: AccessibilityFeature) => {
    const current = form.getValue('selectedAccessibility');
    if (current.includes(id)) {
      form.setValue('selectedAccessibility', current.filter((a) => a !== id));
    } else {
      form.setValue('selectedAccessibility', [...current, id]);
    }
  };

  const toggleSector = (sectorId: Sector) => {
    const current = form.getValue('selectedSectors');
    if (current.includes(sectorId)) {
      form.setValue('selectedSectors', current.filter((s) => s !== sectorId));
    } else if (current.length < MAX_SECTORS) {
      form.setValue('selectedSectors', [...current, sectorId]);
    } else {
      showToast({
        type: 'warning',
        title: 'Limite atteinte',
        message: `Vous pouvez sélectionner au maximum ${MAX_SECTORS} secteurs.`,
      });
    }
  };

  const toggleDayAvailability = (dayId: number) => {
    const current = form.getValue('availability');
    form.setValue('availability', {
      ...current,
      [dayId]: { ...current[dayId], isOpen: !current[dayId].isOpen },
    });
  };

  const updateDayTime = (dayId: number, field: 'startTime' | 'endTime', value: string) => {
    const current = form.getValue('availability');
    form.setValue('availability', {
      ...current,
      [dayId]: { ...current[dayId], [field]: value },
    });
  };


  const addQuestion = () => {
    const current = form.getValue('questions');
    if (current.length >= MAX_QUESTIONS) {
      showToast({
        type: 'warning',
        title: 'Limite atteinte',
        message: `Vous pouvez ajouter au maximum ${MAX_QUESTIONS} questions.`,
      });
      return;
    }
    const newQuestion: ApplicationQuestion = {
      id: Date.now().toString(),
      question: '',
      required: false,
      max_length: MAX_QUESTION_LENGTH,
    };
    form.setValue('questions', [...current, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<ApplicationQuestion>) => {
    const current = form.getValue('questions');
    form.setValue('questions', current.map((q) =>
      q.id === id ? { ...q, ...updates } : q
    ));
  };

  const removeQuestion = (id: string) => {
    const current = form.getValue('questions');
    form.setValue('questions', current.filter((q) => q.id !== id));
  };

  const handleMapLocationSelect = (location: any) => {
    const currentCountry = form.getValue('country');
    const currentRegion = form.getValue('region');

    if (location.coordinates) {
      form.setValue('coordinates', {
        lat: location.coordinates.latitude,
        lng: location.coordinates.longitude,
      });
    }

    if (location.address) {
      form.setValue('address', location.address);
    }

    const targetCountry = location.countryCode || currentCountry;
    if (targetCountry) {
      if (location.countryCode && location.countryCode !== currentCountry) {
        form.setValue('region', '');
        form.setValue('city', '');
      }
      form.setValue('country', targetCountry);
    }

    const regionOptions = getRegionsByCountry(targetCountry);
    let matchedRegionId = location.countryCode && location.countryCode !== currentCountry ? '' : currentRegion;
    if (location.region && regionOptions.length > 0) {
      const matchedRegion = regionOptions.find(r =>
        r.label.toLowerCase().includes(location.region.toLowerCase()) ||
        location.region.toLowerCase().includes(r.label.toLowerCase())
      );
      if (matchedRegion) {
        matchedRegionId = matchedRegion.id;
        form.setValue('region', matchedRegion.id);
      }
    }

    if (location.city && matchedRegionId) {
      const cityOptions = getCommunesByRegion(targetCountry, matchedRegionId);
      const matchedCity = cityOptions.find(c =>
        c.label.toLowerCase().includes(location.city.toLowerCase()) ||
        location.city.toLowerCase().includes(c.label.toLowerCase())
      );
      if (matchedCity) {
        form.setValue('city', matchedCity.id);
      }
    }
  };

  const handleNext = () => {
    const idx = STEPS.indexOf(currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1]);
  };

  const handleBack = () => {
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1]);
    else router.back();
  };


  const canProceed = () => {
    switch (currentStep) {
      case 'info':
        return name.trim().length >= 3 && spaceType !== null;
      case 'location':
        return country.length > 0;
      case 'capacity':
        return surfaceM2.length > 0 && parseInt(capacity) > 0;
      case 'conditions':
        return hourlyRate.length > 0 || dailyRate.length > 0;
      case 'media':
        return true;
      case 'preview':
        return true;
      default:
        return true;
    }
  };

  const renderStepIndicator = () => {
    const stepsData = STEPS.map((step) => ({
      id: step,
      label: STEP_TITLES[step],
    }));
    return <StepIndicator steps={stepsData} currentStepId={currentStep} />;
  };

  const renderInfoStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <MapPin size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Informations</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Decrivez votre espace reservable
        </Text>
      </View>

      <View style={styles.formFields}>
        <Input
          label="Nom de l'espace *"
          placeholder="Ex: Salle de reunion Cocody"
          value={name}
          onChangeText={(val) => form.setValue('name', val)}
          autoCapitalize="words"
        />

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Type d'espace *</Text>
          <View style={styles.tagsContainer}>
            {SPACE_TYPE_DATA.map((type) => {
              const isSelected = spaceType === type.id;
              return (
                <Chip
                  key={type.id}
                  label={type.label}
                  selected={isSelected}
                  onPress={() => form.setValue('spaceType', type.id)}
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
        </View>

        {/* AI Suggestion Button */}
        {canGenerate && (
          <View style={styles.generateButtonContainer}>
            <Button
              title="Suggérer"
              onPress={handleGenerate}
              disabled={isGenerating}
              loading={isGenerating}
              size="sm"
              icon={<Wand2 size={16} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
              style={[
                styles.generateButton,
                { backgroundColor: colors.primary },
                isGenerating && { opacity: 0.7 },
              ]}
              textStyle={[styles.generateButtonText, { color: colors.textOnPrimary }]}
            />
          </View>
        )}

        {/* Sectors Selection */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
            Secteurs d'activité ({selectedSectors.length}/{MAX_SECTORS})
          </Text>
          <View style={styles.tagsContainer}>
            {SECTOR_DATA.map((sector) => {
              const isSelected = selectedSectors.includes(sector.id);
              return (
                <Chip
                  key={sector.id}
                  label={sector.label}
                  selected={isSelected}
                  onPress={() => toggleSector(sector.id)}
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
        </View>

        <FormTextArea
          label="Description"
          placeholder="Décrivez l'espace, ses caractéristiques..."
          value={description}
          onChangeText={(val) => form.setValue('description', val)}
          rows={4}
          maxLength={500}
        />
      </View>
    </View>
  );

  const renderLocationStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <MapPin size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Localisation</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Ou se trouve l'espace ?
        </Text>
      </View>

      <View style={styles.formFields}>
        <Input
          label="Adresse"
          placeholder="Ex: 123 Boulevard Latrille"
          value={address}
          onChangeText={(val) => form.setValue('address', val)}
        />

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Pays *</Text>
          <ScrollView
            ref={countryScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollContent}
          >
            {COUNTRIES.map((c) => {
              const isSelected = country === c.id;
              return (
                <Chip
                  key={c.id}
                  label={c.label}
                  selected={isSelected}
                  onPress={() => {
                    form.setValue('country', c.id);
                    form.setValue('region', '');
                    form.setValue('city', '');
                  }}
                  style={[
                    styles.optionChip,
                    { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                    isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  textStyle={[
                    styles.optionChipText,
                    { color: colors.gray700 },
                    isSelected && { color: colors.textOnPrimary },
                  ]}
                />
              );
            })}
          </ScrollView>
        </View>

        {availableRegions.length > 0 && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Region</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
              {availableRegions.map((r) => {
                const isSelected = region === r.id;
                return (
                  <Chip
                    key={r.id}
                    label={r.label}
                    selected={isSelected}
                    onPress={() => {
                      form.setValue('region', r.id);
                      form.setValue('city', '');
                    }}
                    style={[
                      styles.optionChip,
                      { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                      isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    textStyle={[
                      styles.optionChipText,
                      { color: colors.gray700 },
                      isSelected && { color: colors.textOnPrimary },
                    ]}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        {availableCities.length > 0 && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Ville</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
              {availableCities.map((c) => {
                const isSelected = city === c.id;
                return (
                  <Chip
                    key={c.id}
                    label={c.label}
                    selected={isSelected}
                    onPress={() => form.setValue('city', c.id)}
                    style={[
                      styles.optionChip,
                      { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                      isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    textStyle={[
                      styles.optionChipText,
                      { color: colors.gray700 },
                      isSelected && { color: colors.textOnPrimary },
                    ]}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Position sur la carte - Carte inline */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Position sur la carte</Text>
          <View style={[styles.inlineMapContainer, { borderColor: colors.borderColor }]}>
            <MapLocationPicker
              initialCoordinates={
                coordinates
                  ? { latitude: coordinates.lat, longitude: coordinates.lng }
                  : undefined
              }
              onLocationSelect={handleMapLocationSelect}
              height={250}
              inline
            />
          </View>
          {address && (
            <Text style={[styles.selectedAddressText, { color: colors.textSecondary }]}>
              {address}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  const renderCapacityStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Ruler size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Capacités & Équipements</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Surface, capacité et équipements
        </Text>
      </View>

      <View style={styles.formFields}>
        <View style={styles.rowFields}>
          <View style={styles.halfField}>
            <Input
              label="Surface (m2) *"
              placeholder="Ex: 25"
              value={surfaceM2}
              onChangeText={(val) => form.setValue('surfaceM2', val)}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfField}>
            <Input
              label="Capacité (Personnes) *"
              placeholder="Ex: 10"
              value={capacity}
              onChangeText={(val) => form.setValue('capacity', val)}
              keyboardType="numeric"
              editable={!autoCapacity}
            />
          </View>
        </View>

        <View style={[styles.toggleContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
          <View style={styles.toggleInfo}>
            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Calcul automatique</Text>
            <Text style={[styles.toggleDescription, { color: colors.gray500 }]}>
              Capacité calculée selon le type
            </Text>
          </View>
          <Toggle value={autoCapacity} onValueChange={(val) => form.setValue('autoCapacity', val)} />
        </View>

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Équipements techniques</Text>
          <View style={styles.tagsContainer}>
            {SPACE_EQUIPMENT_DATA.map((item) => {
              const isSelected = selectedEquipment.includes(item.id);
              return (
                <Chip
                  key={item.id}
                  label={item.label}
                  selected={isSelected}
                  onPress={() => toggleEquipment(item.id)}
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
        </View>

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Services et commodites</Text>
          <View style={styles.tagsContainer}>
            {SPACE_AMENITY_DATA.map((item) => {
              const isSelected = selectedAmenities.includes(item.id);
              return (
                <Chip
                  key={item.id}
                  label={item.label}
                  selected={isSelected}
                  onPress={() => toggleAmenity(item.id)}
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
        </View>

        <View style={[styles.toggleContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
          <View style={styles.toggleInfo}>
            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Accessible PMR</Text>
            <Text style={[styles.toggleDescription, { color: colors.gray500 }]}>
              Accessible aux personnes a mobilite reduite
            </Text>
          </View>
          <Toggle value={isAccessible} onValueChange={(val) => form.setValue('isAccessible', val)} />
        </View>

        {isAccessible && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Équipements d'accessibilite</Text>
            <View style={styles.tagsContainer}>
              {ACCESSIBILITY_DATA.map((item) => {
                const isSelected = selectedAccessibility.includes(item.id);
                return (
                  <Chip
                    key={item.id}
                    label={item.label}
                    selected={isSelected}
                    onPress={() => toggleAccessibility(item.id)}
                    leftIcon={isSelected ? <Check size={14} color={colors.info} strokeWidth={2.5} /> : undefined}
                    style={[
                      styles.selectableTag,
                      { backgroundColor: colors.surface, borderColor: colors.gray200 },
                      isSelected && { backgroundColor: withOpacity(colors.info, OPACITY[10]), borderColor: colors.info },
                    ]}
                    textStyle={[
                      styles.selectableTagText,
                      { color: colors.gray600 },
                      isSelected && { color: colors.info },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );

  const renderConditionsStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <FileText size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Conditions</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Tarifs, disponibilites et regles
        </Text>
      </View>

      <View style={styles.formFields}>
        {/* Pricing */}
        <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Tarification (FCFA)</Text>

        <View style={styles.rowFields}>
          <View style={styles.halfField}>
            <Input
              label="Tarif horaire *"
              placeholder="Ex: 5000"
              value={hourlyRate}
              onChangeText={(val) => form.setValue('hourlyRate', val)}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfField}>
            <Input
              label="Tarif journalier"
              placeholder="Ex: 25000"
              value={dailyRate}
              onChangeText={(val) => form.setValue('dailyRate', val)}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.rowFields}>
          <View style={styles.halfField}>
            <Input
              label="Tarif hebdomadaire"
              placeholder="Ex: 100000"
              value={weeklyRate}
              onChangeText={(val) => form.setValue('weeklyRate', val)}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfField}>
            <Input
              label="Tarif mensuel"
              placeholder="Ex: 350000"
              value={monthlyRate}
              onChangeText={(val) => form.setValue('monthlyRate', val)}
              keyboardType="numeric"
            />
          </View>
        </View>

        <Input
          label="Mode d'encaissement"
          placeholder="Ex: Espèces, Orange Money, Wave, Mobile Money..."
          value={paymentCollectionInfo}
          onChangeText={(val) => form.setValue('paymentCollectionInfo', val)}
          multiline
          numberOfLines={2}
        />

        {/* Visibility */}
        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Visibilité *</Text>
          <View style={styles.locationTypeRow}>
            {SPACE_VISIBILITY_DATA.map((type) => {
              const isSelected = visibility === type.id;
              const IconComponent = type.id === 'PUBLIC' ? Eye : type.id === 'PRIVATE' ? Lock : Eye;
              return (
                <SelectCard
                  key={type.id}
                  selected={isSelected}
                  onPress={() => form.setValue('visibility', type.id)}
                  style={styles.locationTypeCard}
                  accessibilityLabel={type.label}
                >
                  <IconComponent
                    size={24}
                    color={isSelected ? colors.primary : colors.gray500}
                    strokeWidth={ICON.strokeWidth}
                  />
                  <Text
                    style={[
                      styles.locationTypeLabel,
                      { color: colors.textPrimary },
                      isSelected && { color: colors.primary, fontWeight: TYPOGRAPHY.fontWeight.semibold },
                    ]}
                  >
                    {type.label}
                  </Text>
                </SelectCard>
              );
            })}
          </View>
        </View>

        {/* Availability */}
        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />
        <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Disponibilités</Text>

        <View style={styles.availabilityContainer}>
          {DAYS_OF_WEEK.map((day) => {
            const dayAvail = availability[day.id];
            return (
              <View key={day.id} style={[styles.dayRow, { borderBottomColor: colors.gray100 }]}>
                <CheckboxRow
                  label={day.label}
                  checked={dayAvail.isOpen}
                  onPress={() => toggleDayAvailability(day.id)}
                  style={styles.dayToggle}
                  checkboxStyle={[
                    styles.dayCheckbox,
                    { borderColor: colors.gray300 },
                    dayAvail.isOpen && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  labelStyle={[styles.dayLabel, { color: dayAvail.isOpen ? colors.textPrimary : colors.gray400 }]}
                />

                {dayAvail.isOpen ? (
                  <View style={styles.timeInputs}>
                    <Input
                      value={dayAvail.startTime}
                      onChangeText={(val) => updateDayTime(day.id, 'startTime', val)}
                      placeholder="08:00"
                      keyboardType="numeric"
                      maxLength={5}
                      autoCapitalize="none"
                      autoCorrect={false}
                      inputContainerStyle={[styles.timeInput, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}
                      inputStyle={{ color: colors.textPrimary, paddingHorizontal: 0 }}
                    />
                    <Text style={[styles.timeSeparator, { color: colors.gray500 }]}>-</Text>
                    <Input
                      value={dayAvail.endTime}
                      onChangeText={(val) => updateDayTime(day.id, 'endTime', val)}
                      placeholder="18:00"
                      keyboardType="numeric"
                      maxLength={5}
                      autoCapitalize="none"
                      autoCorrect={false}
                      inputContainerStyle={[styles.timeInput, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}
                      inputStyle={{ color: colors.textPrimary, paddingHorizontal: 0 }}
                    />
                  </View>
                ) : (
                  <Text style={[styles.closedText, { color: colors.gray400 }]}>Ferme</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Rules */}
        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />
        <FormTextArea
          label="Règlement intérieur"
          placeholder="Ex:\n• Respecter les horaires de réservation\n• Maintenir l'espace propre après utilisation\n• Ne pas fumer dans les locaux..."
          value={rules}
          onChangeText={(val) => form.setValue('rules', val)}
          rows={5}
          maxLength={1000}
        />

        {/* Questions */}
        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
            Questions supplémentaires ({questions.length}/{MAX_QUESTIONS})
          </Text>
          <Text style={[styles.fieldHint, { color: colors.gray500 }]}>
            Posez des questions aux demandeurs (réponse courte, max {MAX_QUESTION_LENGTH} caractères)
          </Text>

          {/* Questions List */}
          {questions.map((question, index) => (
            <View
              key={question.id}
              style={[styles.questionItem, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
            >
              <View style={styles.questionHeader}>
                <Text style={[styles.questionNumber, { color: colors.primary }]}>
                  Question {index + 1}
                </Text>
                <IconButton
                  onPress={() => removeQuestion(question.id)}
                  icon={<Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />}
                  accessibilityLabel="Supprimer la question"
                  size="sm"
                  variant="ghost"
                />
              </View>

              <FormTextArea
                placeholder="Écrivez votre question..."
                value={question.question}
                onChangeText={(text) => updateQuestion(question.id, { question: text })}
                maxLength={MAX_QUESTION_LENGTH}
                rows={2}
                showCounter
                containerStyle={{ marginTop: SPACING.sm }}
              />

              <View style={styles.questionFooter}>
                <View style={styles.requiredToggle}>
                  <Text style={[styles.requiredLabel, { color: colors.gray600 }]}>Obligatoire</Text>
                  <Toggle
                    value={question.required}
                    onValueChange={(value) => updateQuestion(question.id, { required: value })}
                    size="small"
                  />
                </View>
              </View>
            </View>
          ))}

          {/* Add Question Button */}
          {questions.length < MAX_QUESTIONS && (
            <Button
              title="Ajouter une question"
              onPress={addQuestion}
              variant="outline"
              icon={<Plus size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
              style={[styles.addQuestionButton, { borderColor: colors.primary }]}
              textStyle={[styles.addQuestionText, { color: colors.primary }]}
            />
          )}
        </View>
      </View>
    </View>
  );

  const renderMediaStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <ImageIcon size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Photos</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Ajoutez des photos de l'espace
        </Text>
      </View>

      <View style={styles.formFields}>
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700, textAlign: 'center' }]}>
            Images ({images.length}/{MAX_IMAGES})
          </Text>

          <View style={styles.imageUploadContainer}>
            {images.length < MAX_IMAGES && (
              <Button
                title="Ajouter une image"
                onPress={pickImage}
                variant="outline"
                icon={<Upload size={32} color={colors.gray400} strokeWidth={ICON.strokeWidth} />}
                style={[styles.addImageButton, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}
                textStyle={[styles.addImageText, { color: colors.gray500 }]}
                fullWidth
              />
            )}

            {images.length > 0 && (
              <View style={styles.imagesGrid}>
                {images.map((image) => (
                  <View key={image.id} style={styles.imageItemContainer}>
                    <Image source={{ uri: image.uri }} style={styles.imageItem} />
                    <IconButton
                      onPress={() => removeImage(image.id)}
                      icon={<X size={14} color={colors.textOnPrimary} strokeWidth={2.5} />}
                      accessibilityLabel="Retirer l'image"
                      size="sm"
                      variant="filled"
                      style={[styles.removeImageBtn, { backgroundColor: colors.error }]}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  const renderPreviewStep = () => {
    // Get visibility label
    const visibilityData = SPACE_VISIBILITY_DATA.find(v => v.id === visibility);
    const visibilityLabel = visibilityData?.label || 'Public';

    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Eye size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Aperçu</Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Vérifiez toutes les informations avant publication
          </Text>
        </View>

        <View style={styles.previewContainer}>
          {images.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewImagesScroll}>
              {images.map((img) => (
                <Image key={img.id} source={{ uri: img.uri }} style={styles.previewImageItem} />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.previewNoImage, { backgroundColor: colors.gray100 }]}>
              <ImageIcon size={32} color={colors.gray400} />
              <Text style={[styles.previewNoImageText, { color: colors.gray500 }]}>Aucune image</Text>
            </View>
          )}

          <View style={styles.previewSection}>
            <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{name || 'Sans nom'}</Text>
            <View style={styles.previewTags}>
              {spaceType && (
                <View style={[styles.typeBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.typeBadgeText, { color: colors.textOnPrimary }]}>
                    {SPACE_TYPE_LABELS[spaceType]}
                  </Text>
                </View>
              )}
              {/* Visibility badge */}
              <View style={[
                styles.previewTagWithIcon,
                { backgroundColor: visibility === 'PUBLIC' ? withOpacity(colors.success, OPACITY[15]) : withOpacity(colors.warning, OPACITY[15]) }
              ]}>
                {visibility === 'PUBLIC' ? (
                  <Eye size={14} color={colors.success} strokeWidth={2} />
                ) : (
                  <Lock size={14} color={colors.warning} strokeWidth={2} />
                )}
                <Text style={[
                  styles.previewTagText,
                  { color: visibility === 'PUBLIC' ? colors.success : colors.warning }
                ]}>
                  {visibilityLabel}
                </Text>
              </View>
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray700 }]}>
                  {formatNumber(parseFloat(surfaceM2) || 0)} m2 - {capacity} pers.
                </Text>
              </View>
            </View>
          </View>

          {/* Location - outside grid */}
          <View style={[styles.previewLocationRow, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
            <MapPin size={16} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.previewLocationText, { color: colors.textPrimary }]}>
              {[address, city, region, country].filter(Boolean).join(', ') || 'Lieu non défini'}
            </Text>
          </View>

          <View style={styles.previewGrid}>
            {!hourlyRate && !dailyRate && !weeklyRate && !monthlyRate ? (
              <View style={[styles.previewGridItem, { borderColor: colors.gray100, flex: 1 }]}>
                <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Tarification</Text>
                <Text style={[styles.previewValue, { color: colors.success, fontWeight: '600' }]}>
                  Gratuit
                </Text>
              </View>
            ) : (
              <>
                {hourlyRate ? (
                  <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
                    <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Tarif horaire</Text>
                    <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
                      {formatPrice(parseInt(hourlyRate))}
                    </Text>
                  </View>
                ) : null}
                {dailyRate ? (
                  <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
                    <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Tarif journalier</Text>
                    <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
                      {formatPrice(parseInt(dailyRate))}
                    </Text>
                  </View>
                ) : null}
                {weeklyRate ? (
                  <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
                    <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Tarif hebdomadaire</Text>
                    <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
                      {formatPrice(parseInt(weeklyRate))}
                    </Text>
                  </View>
                ) : null}
                {monthlyRate ? (
                  <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
                    <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Tarif mensuel</Text>
                    <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
                      {formatPrice(parseInt(monthlyRate))}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {paymentCollectionInfo && (
            <View style={styles.previewSection}>
              <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Mode d'encaissement</Text>
              <Text style={[styles.previewText, { color: colors.textSecondary }]}>{paymentCollectionInfo}</Text>
            </View>
          )}

          <View style={styles.previewSection}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Description</Text>
            {description ? (
              <Text style={[styles.previewText, { color: colors.textSecondary }]}>{description}</Text>
            ) : (
              <Text style={[styles.previewText, { color: colors.gray400 }]}>Aucune description</Text>
            )}
          </View>

          {/* Equipment preview */}
          {selectedEquipment.length > 0 && (
            <View style={styles.previewSection}>
              <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
                Équipements ({selectedEquipment.length})
              </Text>
              <View style={styles.previewTagsWrap}>
                {selectedEquipment.map((equipId) => {
                  const equip = SPACE_EQUIPMENT_DATA.find(e => e.id === equipId);
                  return equip ? (
                    <View key={equipId} style={[styles.previewSmallTag, { backgroundColor: colors.gray100 }]}>
                      <Text style={[styles.previewSmallTagText, { color: colors.gray700 }]}>{equip.label}</Text>
                    </View>
                  ) : null;
                })}
              </View>
            </View>
          )}

          {/* Amenities preview */}
          {selectedAmenities.length > 0 && (
            <View style={styles.previewSection}>
              <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
                Commodités ({selectedAmenities.length})
              </Text>
              <View style={styles.previewTagsWrap}>
                {selectedAmenities.map((amenityId) => {
                  const amenity = SPACE_AMENITY_DATA.find(a => a.id === amenityId);
                  return amenity ? (
                    <View key={amenityId} style={[styles.previewSmallTag, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
                      <Text style={[styles.previewSmallTagText, { color: colors.primary }]}>{amenity.label}</Text>
                    </View>
                  ) : null;
                })}
              </View>
            </View>
          )}

          {/* Availability preview */}
          <View style={styles.previewSection}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Disponibilités</Text>
            <View style={styles.availabilityPreview}>
              {DAYS_OF_WEEK.map((day) => {
                const dayAvail = availability[day.id];
                return (
                  <View
                    key={day.id}
                    style={[
                      styles.availabilityPreviewCard,
                      {
                        backgroundColor: dayAvail.isOpen ? withOpacity(colors.primary, OPACITY[8]) : colors.gray50,
                        borderColor: dayAvail.isOpen ? withOpacity(colors.primary, OPACITY[30]) : colors.gray200,
                      },
                    ]}
                  >
                    <Text style={[styles.availabilityPreviewDay, { color: dayAvail.isOpen ? colors.textPrimary : colors.gray400 }]}>
                      {day.short}
                    </Text>
                    <Text style={[styles.availabilityPreviewTime, { color: dayAvail.isOpen ? colors.primary : colors.gray400 }]}>
                      {dayAvail.isOpen ? `${dayAvail.startTime}-${dayAvail.endTime}` : 'Fermé'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Règlements intérieurs */}
          <View style={styles.previewSection}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Règlements intérieurs</Text>
            {rules.trim() ? (
              <Text style={[styles.previewText, { color: colors.textSecondary }]}>{rules}</Text>
            ) : (
              <Text style={[styles.previewText, { color: colors.gray400 }]}>Aucun règlement défini</Text>
            )}
          </View>

          {/* Questions complémentaires */}
          <View style={[styles.previewSection, { backgroundColor: colors.gray50 }]}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Questions complémentaires</Text>
            <View style={styles.previewApplicationSettings}>
              <View style={styles.previewSettingRow}>
                <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Nombre de questions</Text>
                <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
                  {questions.filter(q => q.question.trim()).length}
                </Text>
              </View>
            </View>
            {questions.filter(q => q.question.trim()).length > 0 && (
              <View style={styles.previewQuestionsList}>
                {questions.filter(q => q.question.trim()).map((q, index) => (
                  <View key={q.id} style={styles.previewQuestionItem}>
                    <Text style={[styles.previewQuestionLabel, { color: colors.gray500 }]}>
                      Q{index + 1}{q.required ? ' *' : ''}
                    </Text>
                    <Text style={[styles.previewQuestionText, { color: colors.textSecondary }]}>
                      {q.question}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    const isFirstStep = currentStep === 'info';
    const isSubmitting = form.state.isSubmitting;

    if (currentStep === 'preview') {
      return (
        <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: Math.max(SPACING.lg, insets.bottom + SPACING.md) }]}>
          <View style={styles.footerButtons}>
            <Button
              title="Retour"
              onPress={handleBack}
              disabled={isSubmitting}
              variant="outline"
              icon={<ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />}
              style={[styles.backStepButton, { borderColor: colors.gray300 }]}
              textStyle={[styles.backStepButtonText, { color: colors.gray700 }]}
            />
            <View style={styles.publishButton}>
              <Button
                title={isSubmitting ? 'Publication...' : 'Publier'}
                onPress={form.handleSubmit}
                disabled={isSubmitting}
                fullWidth
              />
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: Math.max(SPACING.lg, insets.bottom + SPACING.md) }]}>
        <View style={styles.footerButtons}>
          {!isFirstStep && (
            <Button
              title="Retour"
              onPress={handleBack}
              variant="outline"
              icon={<ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />}
              style={[styles.backStepButton, { borderColor: colors.gray300 }]}
              textStyle={[styles.backStepButtonText, { color: colors.gray700 }]}
            />
          )}
          <View style={[styles.continueButton, !isFirstStep && { flex: 1 }]}>
            <Button
              title="Continuer"
              onPress={handleNext}
              disabled={!canProceed()}
              fullWidth
              icon={<ChevronRight size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
              iconPosition="right"
            />
          </View>
        </View>
      </View>
    );
  };

	  return (
	    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
	      <View style={styles.header}>
	        <IconButton
	          onPress={() => router.back()}
	          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
	          accessibilityLabel="Retour"
	        />
	        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Nouvel espace</Text>
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
            {currentStep === 'capacity' && renderCapacityStep()}
            {currentStep === 'conditions' && renderConditionsStep()}
            {currentStep === 'media' && renderMediaStep()}
            {currentStep === 'preview' && renderPreviewStep()}
          </ScrollView>

          {renderFooter()}
        </ScrollToInputContext.Provider>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  headerSpacer: { width: 40 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xl },
  stepContent: { flex: 1 },
  stepHeader: { alignItems: 'center', marginBottom: SPACING.xl, gap: SPACING.sm },
  stepTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold },
  stepDescription: { fontSize: TYPOGRAPHY.fontSize.md, textAlign: 'center' },
  formFields: { gap: SPACING.lg },
  fieldContainer: { gap: SPACING.xs },
  fieldLabel: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium, marginBottom: SPACING.xs },
  fieldHint: { fontSize: TYPOGRAPHY.fontSize.xs, marginTop: -SPACING.xs },
  sectionLabel: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.semibold, marginBottom: SPACING.sm },
  labelWithIcon: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  horizontalScrollContent: { paddingHorizontal: SPACING.lg, gap: SPACING.sm, flexDirection: 'row' },
  optionChip: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.full },
  optionChipText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },

  // Type badge style (like communities/opportunities)
  typeBadge: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md, borderRadius: BORDER.radius.xs },
  typeBadgeText: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.medium },
  categoryTag: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: BORDER.radius.xs },
  categoryTagText: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },

  selectableTag: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.full },
  selectableTagText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  // Text areas are handled by <FormTextArea />
  textAreaContainer: {},
  textArea: {},
  charCount: {},
  toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.md },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.medium },
  toggleDescription: { fontSize: TYPOGRAPHY.fontSize.xs, marginTop: 2 },
  separator: { height: 1, marginVertical: SPACING.lg },
  rowFields: { flexDirection: 'row', gap: SPACING.md },
  halfField: { flex: 1 },

  // Generate/Suggest button
  generateButtonContainer: { alignItems: 'flex-start', marginBottom: SPACING.md },
  generateButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: BORDER.radius.full },
  generateButtonText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold },

  // Map inline
  inlineMapContainer: { borderRadius: BORDER.radius.md, overflow: 'hidden', borderWidth: 1, borderColor: 'transparent' },
  selectedAddressText: { fontSize: TYPOGRAPHY.fontSize.sm, marginTop: SPACING.xs, paddingHorizontal: SPACING.xs },

  // Availability
  availabilityContainer: { gap: SPACING.xs },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1 },
  dayToggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  dayCheckbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  timeInputs: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  timeInput: { width: 60, height: 32, borderWidth: 1, borderRadius: BORDER.radius.xs, textAlign: 'center', fontSize: TYPOGRAPHY.fontSize.sm },
  timeSeparator: { fontSize: TYPOGRAPHY.fontSize.sm },
  closedText: { fontSize: TYPOGRAPHY.fontSize.sm },

  // Question item styles
  questionItem: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  questionNumber: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  questionInput: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  questionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requiredToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  requiredLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.sm,
    borderStyle: 'dashed',
    marginTop: SPACING.md,
  },
  addQuestionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Media
  imageUploadContainer: { marginTop: SPACING.md, alignItems: 'center' },
  addImageButton: { width: '100%', aspectRatio: 16 / 9, borderWidth: 2, borderRadius: BORDER.radius.md, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  addImageText: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.medium },
  imagesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md, width: '100%' },
  imageItemContainer: { width: '31%', aspectRatio: 16 / 9, borderRadius: BORDER.radius.sm, overflow: 'hidden', position: 'relative' },
  imageItem: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImageBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  // Preview
  previewContainer: { gap: SPACING.md },
  previewImagesScroll: { marginHorizontal: -SPACING.lg, paddingHorizontal: SPACING.lg },
  previewImageItem: { width: 200, height: 120, borderRadius: BORDER.radius.md, marginRight: SPACING.sm, resizeMode: 'cover' },
  previewNoImage: { height: 100, borderRadius: BORDER.radius.md, alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  previewNoImageText: { fontSize: TYPOGRAPHY.fontSize.sm },
  previewSection: { paddingHorizontal: SPACING.sm },
  previewTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold },
  previewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  previewTag: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, borderRadius: BORDER.radius.full },
  previewTagWithIcon: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, borderRadius: BORDER.radius.full },
  previewTagText: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.medium },
  previewLocationRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, marginHorizontal: SPACING.sm, marginVertical: SPACING.sm, borderRadius: BORDER.radius.md, borderWidth: 1 },
  previewLocationText: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  previewGridItem: { width: '50%', padding: SPACING.md, borderWidth: 0.5 },
  previewLabel: { fontSize: TYPOGRAPHY.fontSize.xs, marginBottom: 2 },
  previewValue: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  previewSectionTitle: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, marginBottom: SPACING.xs },
  previewText: { fontSize: TYPOGRAPHY.fontSize.sm, lineHeight: 20 },
  availabilityPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  availabilityPreviewCard: { alignItems: 'center', justifyContent: 'center', minWidth: 60, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, borderRadius: BORDER.radius.sm, borderWidth: 1 },
  availabilityPreviewDay: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.semibold, marginBottom: 2 },
  availabilityPreviewTime: { fontSize: TYPOGRAPHY.fontSize.xxs, fontWeight: TYPOGRAPHY.fontWeight.medium },
  previewTagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs },
  previewSmallTag: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, borderRadius: BORDER.radius.full },
  previewSmallTagText: { fontSize: TYPOGRAPHY.fontSize.xs },
  previewSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs },
  previewRulesBox: { padding: SPACING.md, borderRadius: BORDER.radius.sm, borderWidth: 1, marginTop: SPACING.xs },
  previewRulesText: { fontSize: TYPOGRAPHY.fontSize.sm, lineHeight: 20 },
  previewApplicationSettings: {
    gap: SPACING.sm,
  },
  previewSettingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewQuestionsList: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  previewQuestionItem: {
    gap: 2,
  },
  previewQuestionLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  previewQuestionNumber: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, marginRight: SPACING.xs },
  previewQuestionText: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm },

  // Footer
  footer: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  footerButtons: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backStepButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, height: LAYOUT.buttonHeight, paddingHorizontal: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.sm },
  backStepButtonText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  continueButton: { flex: 1 },
  publishButton: { flex: 1 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },

  // Location type / Visibility styles
  locationTypeRow: { flexDirection: 'row', gap: SPACING.sm },
  locationTypeCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.md, gap: SPACING.xs, position: 'relative' },
  locationTypeLabel: { fontSize: TYPOGRAPHY.fontSize.xs, textAlign: 'center' },
  locationTypeCheck: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
