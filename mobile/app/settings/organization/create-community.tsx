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
  ChevronRight,
  ChevronLeft,
  Check,
  ArrowLeft,
  MapPin,
  Users,
  FileText,
  Image as ImageIcon,
  Eye,
  Lock,
  Plus,
  X,
  Save,
  Send,
  Upload,
  Home,
  Laptop,
  Wand2,
  Trash2,
  ClipboardList,
  Shield,
  Calendar,
  BarChart2,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT } from '../../../src/constants/theme';
import { Input, Button, Toggle, StepIndicator } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { COUNTRIES, getRegionsByCountry, getCommunesByRegion } from '../../../src/constants/location';
import {
  COMMUNITY_TYPE_DATA,
  VISIBILITY_DATA,
  COMMUNITY_TAG_DATA,
  MAX_COMMUNITY_TAGS,
  MAX_MEMBERSHIP_QUESTIONS,
} from '../../../src/constants/community';
import { CURRENCY_DATA } from '../../../src/constants/opportunity';
import {
  CommunityType,
  Visibility,
  COMMUNITY_TYPE_LABELS,
  VISIBILITY_LABELS,
  ApplicationQuestion,
} from '../../../src/types/models';
import { SECTOR_DATA, MAX_SECTORS, Sector } from '../../../src/constants/talent';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { communityService, CreateCommunityData, imageService, organizationService, MemberPermissions, DEFAULT_MEMBER_PERMISSIONS } from '../../../src/services';

type Step = 'info' | 'lieu' | 'conditions' | 'media' | 'preview';

const STEPS: Step[] = ['info', 'lieu', 'conditions', 'media', 'preview'];

const STEP_TITLES: Record<Step, string> = {
  info: 'Infos',
  lieu: 'Lieu',
  conditions: 'Conditions',
  media: 'Media',
  preview: 'Aperçu',
};

// Constants for limits
const MAX_IMAGES = 5;
const MAX_QUESTIONS = 5;
const MAX_QUESTION_LENGTH = 200;

interface ImageItem {
  id: string;
  uri: string;
}

// Icons for location types
const LOCATION_TYPE_ICONS: Record<CommunityType, React.ComponentType<any>> = {
  HYBRID: Home,
  ONLINE: Laptop,
  OFFLINE: Home, // Fallback
};

export default function CreateCommunityScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { selectedOrgId, selectedOrg } = useSpace();
  const [currentStep, setCurrentStep] = useState<Step>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form state - Info
  const [name, setName] = useState('');
  const [communityType, setCommunityType] = useState<CommunityType | null>('ONLINE');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<Sector[]>([]);

  // Form state - Lieu
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [orgLocationLoaded, setOrgLocationLoaded] = useState(false);
  const countryScrollRef = useRef<ScrollView>(null);
  const COUNTRY_CHIP_WIDTH = 80;

  // Form state - Conditions
  const [visibility, setVisibility] = useState<Visibility | null>('PUBLIC');
  const [isPaid, setIsPaid] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [currency, setCurrency] = useState('XOF');
  const [rules, setRules] = useState('');
  const [applicationQuestions, setApplicationQuestions] = useState<ApplicationQuestion[]>([]);
  const [defaultPermissions, setDefaultPermissions] = useState<MemberPermissions>(DEFAULT_MEMBER_PERMISSIONS);

  // Form state - Media
  const [images, setImages] = useState<ImageItem[]>([]);

  // Get regions and cities dynamically
  const availableRegions = country ? getRegionsByCountry(country) : [];
  const availableCities = country && region ? getCommunesByRegion(country, region) : [];

  // Auto-scroll to selected country
  useEffect(() => {
    if (country && countryScrollRef.current && currentStep === 'lieu') {
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

  // Load organization default location
  useEffect(() => {
    const loadOrgLocation = async () => {
      if (selectedOrgId && !orgLocationLoaded) {
        try {
          const response = await organizationService.get(selectedOrgId);
          const org = response.data;
          if (org) {
            if (org.headquarters_country) setCountry(org.headquarters_country);
            if (org.headquarters_region) setRegion(org.headquarters_region);
            if (org.headquarters_city) setCity(org.headquarters_city);
          }
        } catch (error) {
          setCountry('CI');
        }
        setOrgLocationLoaded(true);
      }
    };
    loadOrgLocation();
  }, [selectedOrgId, orgLocationLoaded]);

  const pickImage = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limite atteinte', `Vous pouvez ajouter au maximum ${MAX_IMAGES} images.`);
      return;
    }

    try {
      const image = await imageService.pickImage({ type: 'illustration' });
      if (image) {
        const newImage: ImageItem = {
          id: Date.now().toString(),
          uri: image.uri,
        };
        setImages([...images, newImage]);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de la sélection de l\'image.');
    }
  };

  const removeImage = (id: string) => {
    setImages(images.filter((img) => img.id !== id));
  };


  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagId));
    } else if (selectedTags.length < MAX_COMMUNITY_TAGS) {
      setSelectedTags([...selectedTags, tagId]);
    } else {
      Alert.alert('Limite atteinte', `Vous pouvez sélectionner au maximum ${MAX_COMMUNITY_TAGS} tags.`);
    }
  };

  const toggleSector = (sectorId: Sector) => {
    if (selectedSectors.includes(sectorId)) {
      setSelectedSectors(selectedSectors.filter((s) => s !== sectorId));
    } else if (selectedSectors.length < MAX_SECTORS) {
      setSelectedSectors([...selectedSectors, sectorId]);
    } else {
      Alert.alert('Limite atteinte', `Vous pouvez sélectionner au maximum ${MAX_SECTORS} secteurs.`);
    }
  };

  // Check if generation is possible
  const canGenerate = name.trim().length >= 3;

  // Handle AI generation
  const handleGenerate = async () => {
    if (!canGenerate || isGenerating || !selectedOrgId) return;

    setIsGenerating(true);
    const startTime = Date.now();
    console.log('[CreateCommunity] AI Generation - Starting...');

    try {
      // Collect all existing form data
      const existingData: Partial<CreateCommunityData> = {
        name: name.trim(),
        type: communityType || undefined,
        description: description || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        sectors: selectedSectors.length > 0 ? selectedSectors : undefined,
        visibility: visibility || undefined,
        is_paid: isPaid,
        monthly_price: isPaid && monthlyPrice ? parseFloat(monthlyPrice) : undefined,
        currency: isPaid ? currency : undefined,
        rules: rules || undefined,
        application_questions: applicationQuestions.filter(q => q.question.trim().length > 0).map(q => q.question),
        default_member_permissions: defaultPermissions,
        city: communityType === 'HYBRID' ? city || undefined : undefined,
        region: communityType === 'HYBRID' ? region || undefined : undefined,
        country: communityType === 'HYBRID' ? country || undefined : undefined,
      };

      const response = await communityService.generate({
        name: name.trim(),
        organization_id: selectedOrgId,
        existing_data: existingData,
      });

      const duration = Date.now() - startTime;
      console.log(`[CreateCommunity] AI Generation - Completed in ${duration}ms`);

      if (response.success && response.data) {
        const data = response.data;
        console.log('[CreateCommunity] AI Generation - Data received:', Object.keys(data));

        // Apply generated data to form fields
        if (data.suggested_name) setName(data.suggested_name);
        if (data.description) setDescription(data.description);

        // Tags - apply up to 3 tags
        if (data.tags && data.tags.length > 0) {
          setSelectedTags(data.tags.slice(0, MAX_COMMUNITY_TAGS));
        }

        // Sectors - apply up to 5 sectors
        if (data.sectors && data.sectors.length > 0) {
          setSelectedSectors(data.sectors.slice(0, MAX_SECTORS));
        }

        if (data.rules) setRules(data.rules);
        if (data.visibility) setVisibility(data.visibility);

        // Pricing
        if (data.is_paid !== undefined) setIsPaid(data.is_paid);
        if (data.monthly_price) setMonthlyPrice(Math.floor(data.monthly_price).toString());
        if (data.currency) setCurrency(data.currency);

        // Application questions
        if (data.application_questions && data.application_questions.length > 0) {
          const newQuestions: ApplicationQuestion[] = data.application_questions.slice(0, MAX_QUESTIONS).map((q, idx) => ({
            id: Date.now().toString() + idx,
            question: q,
            required: false,
            max_length: MAX_QUESTION_LENGTH,
          }));
          setApplicationQuestions(newQuestions);
        }
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[CreateCommunity] AI Generation - Failed after ${duration}ms:`, error);
      Alert.alert('Erreur de génération', error?.error || 'Une erreur est survenue lors de la génération.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Question handlers
  const addQuestion = () => {
    if (applicationQuestions.length >= MAX_QUESTIONS) {
      Alert.alert('Limite atteinte', `Vous pouvez ajouter au maximum ${MAX_QUESTIONS} questions.`);
      return;
    }
    const newQuestion: ApplicationQuestion = {
      id: Date.now().toString(),
      question: '',
      required: false,
      max_length: MAX_QUESTION_LENGTH,
    };
    setApplicationQuestions([...applicationQuestions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<ApplicationQuestion>) => {
    setApplicationQuestions(applicationQuestions.map((q) =>
      q.id === id ? { ...q, ...updates } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setApplicationQuestions(applicationQuestions.filter((q) => q.id !== id));
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

  const isRemoteUrl = (uri: string): boolean => {
    return uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('/uploads/');
  };

  const buildImagesPayload = async (): Promise<string[] | null> => {
    console.log('[CreateCommunity] buildImagesPayload - Total images:', images.length);

    const remoteImages = images.filter((img) => isRemoteUrl(img.uri));
    const localImages = images.filter((img) => !isRemoteUrl(img.uri));

    console.log('[CreateCommunity] Remote images:', remoteImages.length);
    console.log('[CreateCommunity] Local images to upload:', localImages.length);

    const uploadedImageUrls: string[] = [];

    for (const image of localImages) {
      try {
        console.log('[CreateCommunity] Uploading image:', image.uri.substring(0, 50) + '...');
        const uploaded = await imageService.uploadImage(
          { uri: image.uri, width: 800, height: 600 },
          'illustration',
          'community'
        );
        console.log('[CreateCommunity] Upload success, URL:', uploaded.url);
        uploadedImageUrls.push(uploaded.url);
      } catch (error) {
        console.error('[CreateCommunity] Error uploading image:', error);
        Alert.alert('Erreur', 'Impossible d\'uploader une image. Veuillez réessayer.');
        return null;
      }
    }

    const allImageUrls = [...remoteImages.map(img => img.uri), ...uploadedImageUrls];
    console.log('[CreateCommunity] Final image URLs:', allImageUrls);
    return allImageUrls;
  };


  const buildCommunityData = async (
    imageUrls?: string[]
  ): Promise<CreateCommunityData> => ({
    name,
    type: communityType || undefined,
    description: description || undefined,
    rules: rules || undefined,
    application_questions: applicationQuestions.filter(q => q.question.trim().length > 0).map(q => q.question),
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    sectors: selectedSectors.length > 0 ? selectedSectors : undefined,
    visibility: visibility || undefined,
    is_paid: isPaid,
    monthly_price: isPaid && monthlyPrice ? parseFloat(monthlyPrice) : undefined,
    currency: isPaid ? currency : undefined,
    default_member_permissions: defaultPermissions,
    city: communityType === 'HYBRID' ? city || undefined : undefined,
    region: communityType === 'HYBRID' ? region || undefined : undefined,
    country: communityType === 'HYBRID' ? country || undefined : undefined,
    cover_image_url: imageUrls && imageUrls.length > 0 ? imageUrls[0] : undefined,
    images: imageUrls && imageUrls.length > 0 ? imageUrls : undefined,
    organization_id: selectedOrgId || undefined,
  });

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    try {
      const imageUrls = await buildImagesPayload();
      if (imageUrls === null) {
        setIsSubmitting(false);
        return;
      }
      const data = await buildCommunityData(imageUrls);
      await communityService.saveDraft(data);
      Alert.alert(
        'Brouillon enregistré',
        'La communauté a été enregistrée comme brouillon.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Une erreur est survenue lors de l\'enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    setIsSubmitting(true);
    try {
      console.log('[CreateCommunity] handlePublish - Starting...');
      const imageUrls = await buildImagesPayload();
      console.log('[CreateCommunity] handlePublish - Image URLs:', imageUrls);

      if (imageUrls === null) {
        setIsSubmitting(false);
        return;
      }

      const data = { ...(await buildCommunityData(imageUrls.length > 0 ? imageUrls : undefined)), status: 'ACTIVE' as const };
      console.log('[CreateCommunity] handlePublish - Data to send:', {
        ...data,
        cover_image_url: data.cover_image_url,
        images: data.images,
      });

      await communityService.create(data);
      Alert.alert(
        'Communauté créée',
        `"${name}" a été créée avec succès !`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('[CreateCommunity] handlePublish - Error:', error);
      Alert.alert('Erreur', error.error || 'Une erreur est survenue lors de la création.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'info': return name.trim().length >= 3 && selectedTags.length > 0;
      case 'lieu': return communityType !== null && (communityType === 'ONLINE' || country.length > 0);
      case 'conditions': return visibility !== null;
      case 'media': return true; // Media is optional
      case 'preview': return true;
      default: return true;
    }
  };

  const getTagLabels = () => {
    return selectedTags.map((id) => {
      const tag = COMMUNITY_TAG_DATA.find((t) => t.id === id);
      return tag?.label || id;
    });
  };

  const getSectorsLabel = (ids: Sector[]) => {
    if (ids.length === 0) return 'Non défini';
    return ids
      .map((id) => SECTOR_DATA.find((s) => s.id === id)?.label || id)
      .join(', ');
  };

  const formatNumber = (num: string | number | null | undefined): string => {
    if (!num) return '';
    const numStr = typeof num === 'number' ? num.toString() : num;
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const getCurrencySymbol = (currencyId: string): string => {
    const currency = CURRENCY_DATA.find(c => c.id === currencyId);
    return currency?.symbol || currencyId;
  };

  const renderStepIndicator = () => {
    const stepsData = STEPS.map(step => ({
      id: step,
      label: STEP_TITLES[step],
    }));
    return <StepIndicator steps={stepsData} currentStepId={currentStep} />;
  };

  const renderInfoStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Users size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Informations de base</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Décrivez votre communauté
        </Text>
      </View>

      <View style={styles.formFields}>
        {/* Nom */}
        <Input
          label="Nom de la communauté *"
          placeholder="Ex: Développeurs Abidjan"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        {/* Tags (replaces Categories) */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
            Tags ({selectedTags.length}/{MAX_COMMUNITY_TAGS})
          </Text>
          <View style={styles.tagsContainer}>
            {COMMUNITY_TAG_DATA.map((tag) => {
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
                  {isSelected && <Check size={14} color={colors.primary} strokeWidth={2.5} />}
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

        {/* Bouton Générer - Visible quand name >= 3 chars et type sélectionné */}
        {canGenerate && (
          <View style={styles.generateButtonContainer}>
            <TouchableOpacity
              style={[
                styles.generateButton,
                { backgroundColor: colors.primary },
                isGenerating && { opacity: 0.7 },
              ]}
              onPress={handleGenerate}
              disabled={isGenerating}
              activeOpacity={0.8}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Wand2 size={16} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
              )}
              <Text style={[styles.generateButtonText, { color: colors.textOnPrimary }]}>
                {isGenerating ? 'Suggestion...' : 'Suggérer'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Secteurs d'activité - Multi-selection (5 max) */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
            Secteurs d'activité ({selectedSectors.length}/{MAX_SECTORS})
          </Text>
          <View style={styles.tagsContainer}>
            {SECTOR_DATA.slice(0, 15).map((sector) => {
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
                  {isSelected && <Check size={14} color={colors.primary} strokeWidth={2.5} />}
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
        </View>

        {/* Description */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Description du poste</Text>
          <View style={[styles.textAreaContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
            <TextInput
              style={[styles.textArea, { color: colors.textPrimary }]}
              placeholder="Décrivez votre communauté, ses objectifs et sa mission..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={1000}
              placeholderTextColor={colors.gray500}
            />
          </View>
          <Text style={[styles.charCount, { color: colors.gray500 }]}>{description.length}/1000</Text>
        </View>
      </View>
    </View>
  );

  const renderLieuStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <MapPin size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Localisation</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Où se déroulera la communauté ?
        </Text>
      </View>

      <View style={styles.formFields}>
        {/* Mode de travail - 2 options horizontales avec icônes */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Type de communauté *</Text>
          <View style={styles.locationTypeRow}>
            {COMMUNITY_TYPE_DATA.map((type) => {
              const isSelected = communityType === type.id;
              const IconComponent = LOCATION_TYPE_ICONS[type.id];
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.locationTypeCard,
                    { backgroundColor: colors.surface, borderColor: colors.gray200 },
                    isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary },
                  ]}
                  onPress={() => setCommunityType(type.id)}
                  activeOpacity={0.7}
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
                  {isSelected && (
                    <View style={[styles.locationTypeCheck, { backgroundColor: colors.primary }]}>
                      <Check size={12} color={colors.textOnPrimary} strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Localisation (seulement si "Hybrid") */}
        {communityType === 'HYBRID' && (
          <>
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
                {COUNTRIES.map((c) => {
                  const isSelected = country === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.optionChip,
                        { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                        isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
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
                          isSelected && { color: colors.textOnPrimary },
                        ]}
                      >
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
                  {availableRegions.map((r) => {
                    const isSelected = region === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[
                          styles.optionChip,
                          { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                          isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
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
                            isSelected && { color: colors.textOnPrimary },
                          ]}
                        >
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
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
                  {availableCities.map((c) => {
                    const isSelected = city === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.optionChip,
                          { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                          isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => setCity(c.id)}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            { color: colors.gray700 },
                            isSelected && { color: colors.textOnPrimary },
                          ]}
                        >
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </>
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
          Visibilité, tarification, règles et questions
        </Text>
      </View>

      <View style={styles.formFields}>
        {/* Visibilité - 2 options horizontales avec icônes */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Visibilité *</Text>
          <View style={styles.locationTypeRow}>
            {VISIBILITY_DATA.map((type) => {
              const isSelected = visibility === type.id;
              const IconComponent = type.id === 'PUBLIC' ? Eye : Lock;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.locationTypeCard,
                    { backgroundColor: colors.surface, borderColor: colors.gray200 },
                    isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary },
                  ]}
                  onPress={() => setVisibility(type.id)}
                  activeOpacity={0.7}
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
                  {isSelected && (
                    <View style={[styles.locationTypeCheck, { backgroundColor: colors.primary }]}>
                      <Check size={12} color={colors.textOnPrimary} strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Pricing Toggle */}
        <View style={[styles.toggleContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
          <View style={styles.toggleInfo}>
            <View style={styles.toggleTextContainer}>
              <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>
                Communauté {isPaid ? 'payante' : 'gratuite'}
              </Text>
              <Text style={[styles.toggleDescription, { color: colors.gray500 }]}>
                {isPaid ? 'Les membres devront payer un abonnement' : 'Accès gratuit pour tous les membres'}
              </Text>
            </View>
          </View>
          <Toggle
            value={isPaid}
            onValueChange={setIsPaid}
          />
        </View>

        {/* Monthly Price (if paid) */}
        {isPaid && (
          <>
            <View style={styles.rowFields}>
              <View style={styles.halfField}>
                <Input
                  label="Coût abonnement mensuel *"
                  placeholder="5000"
                  value={monthlyPrice}
                  onChangeText={setMonthlyPrice}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfField}>
                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Devise</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.horizontalScroll}
                    contentContainerStyle={styles.horizontalScrollContent}
                  >
                    {CURRENCY_DATA.map((c) => {
                      const isSelected = currency === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[
                            styles.optionChip,
                            { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                            isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                          ]}
                          onPress={() => setCurrency(c.id)}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              { color: colors.gray700 },
                              isSelected && { color: colors.textOnPrimary },
                            ]}
                          >
                            {c.symbol}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </View>
          </>
        )}

        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        {/* Règles */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Règles de la communauté</Text>
          <View style={[styles.textAreaContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
            <TextInput
              style={[styles.textArea, { color: colors.textPrimary }]}
              placeholder="Ex: 1. Respectez les autres membres&#10;2. Pas de spam&#10;3. Restez courtois..."
              value={rules}
              onChangeText={setRules}
              multiline
              numberOfLines={5}
              maxLength={1000}
              placeholderTextColor={colors.gray500}
            />
          </View>
          <Text style={[styles.charCount, { color: colors.gray500 }]}>{rules.length}/1000</Text>
        </View>

        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        {/* Permissions des membres par défaut */}
        <View style={styles.fieldContainer}>
          <View style={styles.permissionSectionHeader}>
            <Text style={[styles.fieldLabel, { color: colors.gray700, marginBottom: 0 }]}>
              Permissions des membres
            </Text>
          </View>
          <Text style={[styles.fieldHint, { color: colors.gray500, marginTop: SPACING.xs }]}>
            Définissez ce que les nouveaux membres peuvent faire par défaut (personnalisable par membre)
          </Text>

          <View style={[styles.permissionsContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
            {/* Can Post */}
            <View style={[styles.permissionRow, { borderBottomColor: colors.gray200 }]}>
              <View style={styles.permissionInfo}>
                <View style={[styles.permissionIconBox, { backgroundColor: colors.primary + '15' }]}>
                  <FileText size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                </View>
                <View>
                  <Text style={[styles.permissionLabel, { color: colors.textPrimary }]}>
                    Créer des publications
                  </Text>
                  <Text style={[styles.permissionDesc, { color: colors.gray500 }]}>
                    Peut publier du contenu
                  </Text>
                </View>
              </View>
              <Toggle
                value={defaultPermissions.can_post}
                onValueChange={(value) => setDefaultPermissions(p => ({ ...p, can_post: value }))}
              />
            </View>

            {/* Can Create Event */}
            <View style={[styles.permissionRow, { borderBottomColor: colors.gray200 }]}>
              <View style={styles.permissionInfo}>
                <View style={[styles.permissionIconBox, { backgroundColor: colors.warning + '15' }]}>
                  <Calendar size={18} color={colors.warning} strokeWidth={ICON.strokeWidth} />
                </View>
                <View>
                  <Text style={[styles.permissionLabel, { color: colors.textPrimary }]}>
                    Créer des événements
                  </Text>
                  <Text style={[styles.permissionDesc, { color: colors.gray500 }]}>
                    Peut organiser des événements
                  </Text>
                </View>
              </View>
              <Toggle
                value={defaultPermissions.can_create_event}
                onValueChange={(value) => setDefaultPermissions(p => ({ ...p, can_create_event: value }))}
              />
            </View>

            {/* Can Create Poll */}
            <View style={[styles.permissionRow, { borderBottomWidth: 0 }]}>
              <View style={styles.permissionInfo}>
                <View style={[styles.permissionIconBox, { backgroundColor: colors.info + '15' }]}>
                  <BarChart2 size={18} color={colors.info} strokeWidth={ICON.strokeWidth} />
                </View>
                <View>
                  <Text style={[styles.permissionLabel, { color: colors.textPrimary }]}>
                    Créer des sondages
                  </Text>
                  <Text style={[styles.permissionDesc, { color: colors.gray500 }]}>
                    Peut lancer des sondages
                  </Text>
                </View>
              </View>
              <Toggle
                value={defaultPermissions.can_create_poll}
                onValueChange={(value) => setDefaultPermissions(p => ({ ...p, can_create_poll: value }))}
              />
            </View>
          </View>

          <Text style={[styles.fieldHint, { color: colors.gray400, marginTop: SPACING.xs, fontStyle: 'italic' }]}>
            Les administrateurs ont toujours toutes les permissions.
          </Text>
        </View>

        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        {/* Questions complémentaires */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
            Questions complémentaires ({applicationQuestions.length}/{MAX_QUESTIONS})
          </Text>
          <Text style={[styles.fieldHint, { color: colors.gray500 }]}>
            Posez des questions aux candidats (réponse courte, max {MAX_QUESTION_LENGTH} caractères)
          </Text>

          {/* Questions List */}
          {applicationQuestions.map((question, index) => (
            <View
              key={question.id}
              style={[styles.questionItem, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
            >
              <View style={styles.questionHeader}>
                <Text style={[styles.questionNumber, { color: colors.primary }]}>
                  Question {index + 1}
                </Text>
                <TouchableOpacity onPress={() => removeQuestion(question.id)}>
                  <Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.questionInput, { backgroundColor: colors.gray50, color: colors.textPrimary, borderColor: colors.gray200 }]}
                placeholder="Écrivez votre question..."
                placeholderTextColor={colors.gray400}
                value={question.question}
                onChangeText={(text) => updateQuestion(question.id, { question: text })}
                maxLength={MAX_QUESTION_LENGTH}
                multiline
                numberOfLines={2}
              />

              <View style={styles.questionFooter}>
                <Text style={[styles.charCount, { color: colors.gray500 }]}>
                  {question.question.length}/{MAX_QUESTION_LENGTH}
                </Text>

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
          {applicationQuestions.length < MAX_QUESTIONS && (
            <TouchableOpacity
              style={[styles.addQuestionButton, { borderColor: colors.primary }]}
              onPress={addQuestion}
            >
              <Plus size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.addQuestionText, { color: colors.primary }]}>
                Ajouter une question
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  const renderMediaStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <ImageIcon size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Media</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Ajoutez des visuels et documents
        </Text>
      </View>

      <View style={styles.formFields}>
        {/* Images d'illustration - Max 5 */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700, textAlign: 'center' }]}>
            Images d'illustration ({images.length}/{MAX_IMAGES})
          </Text>
          <Text style={[styles.fieldHint, { color: colors.gray500, textAlign: 'center' }]}>
            Format recommandé: 16:9 - Maximum {MAX_IMAGES} images
          </Text>

          {/* Zone d'upload centrée et full width */}
          <View style={styles.imageUploadContainer}>
            {/* Bouton ajouter image si pas encore 5 */}
            {images.length < MAX_IMAGES && (
              <TouchableOpacity
                style={[styles.addImageButtonFullWidth, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}
                onPress={pickImage}
              >
                <Upload size={32} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.addImageTextLarge, { color: colors.gray500 }]}>
                  Ajouter une image
                </Text>
              </TouchableOpacity>
            )}

            {/* Grille d'images uploadées */}
            {images.length > 0 && (
              <View style={styles.imagesGrid}>
                {images.map((image) => (
                  <View key={image.id} style={styles.imageItemContainer}>
                    <Image source={{ uri: image.uri }} style={styles.imageItem} />
                    <TouchableOpacity
                      style={[styles.removeImageBtn, { backgroundColor: colors.error }]}
                      onPress={() => removeImage(image.id)}
                    >
                      <X size={14} color={colors.textOnPrimary} strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

      </View>
    </View>
  );

  const renderPreviewStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Eye size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Aperçu</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Vérifiez toutes les informations avant publication
        </Text>
      </View>

      <View style={styles.previewContainer}>
        {/* Images Preview */}
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

        {/* Title & Type */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{name || 'Sans nom'}</Text>
          <View style={styles.previewTags}>
            {communityType ? (
              <View style={[styles.previewTag, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.previewTagText, { color: colors.primary }]}>
                  {COMMUNITY_TYPE_LABELS[communityType]}
                </Text>
              </View>
            ) : (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray500 }]}>Type non défini</Text>
              </View>
            )}
            {visibility ? (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray700 }]}>
                  {VISIBILITY_LABELS[visibility]}
                </Text>
              </View>
            ) : (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray500 }]}>Visibilité non définie</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tags */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Tags</Text>
          {selectedTags.length > 0 ? (
            <View style={styles.previewTags}>
              {getTagLabels().map((label, idx) => (
                <View key={idx} style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                  <Text style={[styles.previewTagText, { color: colors.gray700 }]}>{label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.previewText, { color: colors.gray500 }]}>Aucun tag sélectionné</Text>
          )}
        </View>

        {/* Secteurs */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Secteurs d'activité</Text>
          {selectedSectors.length > 0 ? (
            <View style={styles.previewTags}>
              {selectedSectors.map((sectorId) => {
                const sector = SECTOR_DATA.find((s) => s.id === sectorId);
                return (
                  <View key={sectorId} style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                    <Text style={[styles.previewTagText, { color: colors.gray700 }]}>
                      {sector?.label || sectorId}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.previewText, { color: colors.gray500 }]}>Aucun secteur sélectionné</Text>
          )}
        </View>

        {/* Info Grid */}
        <View style={styles.previewGrid}>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Lieu</Text>
            <Text style={[styles.previewValue, { color: communityType === 'HYBRID' ? colors.textPrimary : colors.gray400 }]}>
              {communityType === 'HYBRID'
                ? [city, region, country].filter(Boolean).join(', ') || 'Non défini'
                : communityType === 'ONLINE' ? 'En ligne' : 'Non défini'}
            </Text>
          </View>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Visibilité</Text>
            <Text style={[styles.previewValue, { color: visibility ? colors.textPrimary : colors.gray400 }]}>
              {visibility ? VISIBILITY_LABELS[visibility] : 'Non définie'}
            </Text>
          </View>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Tarification</Text>
            <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
              {isPaid ? 'Payante' : 'Gratuite'}
            </Text>
          </View>
          {isPaid && (
            <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
              <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Prix mensuel</Text>
              <Text style={[styles.previewValue, { color: monthlyPrice ? colors.textPrimary : colors.gray400 }]}>
                {monthlyPrice ? `${formatNumber(monthlyPrice)} ${getCurrencySymbol(currency)}` : 'Non défini'}
              </Text>
            </View>
          )}
        </View>

        {/* Description */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Description</Text>
          {description ? (
            <Text style={[styles.previewText, { color: colors.textSecondary }]}>{description}</Text>
          ) : (
            <Text style={[styles.previewText, { color: colors.gray400 }]}>Aucune description</Text>
          )}
        </View>

        {/* Rules */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Règles</Text>
          {rules ? (
            <Text style={[styles.previewText, { color: colors.textSecondary }]}>{rules}</Text>
          ) : (
            <Text style={[styles.previewText, { color: colors.gray400 }]}>Aucune règle définie</Text>
          )}
        </View>

        {/* Questions complémentaires */}
        <View style={[styles.previewSection, { backgroundColor: colors.gray50 }]}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Questions complémentaires</Text>
          <View style={styles.previewApplicationSettings}>
            <View style={styles.previewSettingRow}>
              <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Nombre de questions</Text>
              <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
                {applicationQuestions.filter(q => q.question.trim()).length}
              </Text>
            </View>
          </View>
          {applicationQuestions.filter(q => q.question.trim()).length > 0 && (
            <View style={styles.previewQuestionsList}>
              {applicationQuestions.filter(q => q.question.trim()).map((q, index) => (
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

  const renderFooter = () => {
    const isFirstStep = currentStep === 'info';

    if (currentStep === 'preview') {
      return (
        <View style={[styles.footer, { backgroundColor: colors.background }]}>
          <View style={styles.footerButtons}>
            {/* Bouton Retour */}
            <TouchableOpacity
              style={[styles.backStepButton, { borderColor: colors.gray300 }]}
              onPress={handleBack}
              disabled={isSubmitting}
            >
              <ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.backStepButtonText, { color: colors.gray700 }]}>Retour</Text>
            </TouchableOpacity>
            {/* Bouton Brouillon */}
            <TouchableOpacity
              style={[styles.draftButton, { borderColor: colors.gray300 }]}
              onPress={handleSaveDraft}
              disabled={isSubmitting}
            >
              <Save size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
            </TouchableOpacity>
            {/* Bouton Publier */}
            <View style={styles.publishButton}>
              <Button
                title="Publier"
                onPress={handlePublish}
                disabled={isSubmitting}
                fullWidth
                icon={<Send size={18} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
                iconPosition="right"
              />
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        <View style={styles.footerButtons}>
          {/* Bouton Retour (sauf sur le premier step) */}
          {!isFirstStep && (
            <TouchableOpacity
              style={[styles.backStepButton, { borderColor: colors.gray300 }]}
              onPress={handleBack}
            >
              <ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.backStepButtonText, { color: colors.gray700 }]}>Retour</Text>
            </TouchableOpacity>
          )}
          {/* Bouton Continuer */}
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Nouvelle communauté</Text>
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
          {currentStep === 'lieu' && renderLieuStep()}
          {currentStep === 'conditions' && renderConditionsStep()}
          {currentStep === 'media' && renderMediaStep()}
          {currentStep === 'preview' && renderPreviewStep()}
        </ScrollView>

        {renderFooter()}
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
  stepIndicator: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xl },
  stepItem: { alignItems: 'center', gap: SPACING.xs },
  stepDot: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: BORDER.radius.full },
  stepNumber: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  stepLabel: { fontSize: TYPOGRAPHY.fontSize.xs },
  stepContent: { flex: 1 },
  stepHeader: { alignItems: 'center', marginBottom: SPACING.xl, gap: SPACING.sm },
  stepTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold },
  stepDescription: { fontSize: TYPOGRAPHY.fontSize.md, textAlign: 'center' },
  formFields: { gap: SPACING.lg },
  fieldContainer: { gap: SPACING.xs },
  fieldLabel: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium, marginBottom: SPACING.xs },
  fieldHint: { fontSize: TYPOGRAPHY.fontSize.xs, marginBottom: SPACING.sm },
  horizontalScroll: { marginHorizontal: -SPACING.lg },
  horizontalScrollContent: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  optionChip: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.full },
  optionChipText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  selectableTag: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.full },
  selectableTagText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  textAreaContainer: { borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.sm, padding: SPACING.md },
  textArea: { fontSize: TYPOGRAPHY.fontSize.md, minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: TYPOGRAPHY.fontSize.xs, textAlign: 'right', marginTop: SPACING.xs },
  optionCards: { gap: SPACING.sm },
  optionCard: { padding: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.md },
  optionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionCardTitle: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  optionCardDescription: { fontSize: TYPOGRAPHY.fontSize.sm, marginTop: SPACING.xs },
  infoBox: { padding: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.md },
  infoBoxText: { fontSize: TYPOGRAPHY.fontSize.sm, textAlign: 'center' },
  geolocationButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.sm, borderStyle: 'dashed' },
  geolocationButtonText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  questionItem: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  suggestionsLabel: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium, marginTop: SPACING.md, marginBottom: SPACING.sm },
  suggestionChip: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.full },
  suggestionText: { fontSize: TYPOGRAPHY.fontSize.xs, maxWidth: 150 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  logoUpload: { width: 80, height: 80, borderRadius: BORDER.radius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden' },
  logoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  logoInfo: { flex: 1, gap: SPACING.xs },
  logoInfoText: { fontSize: TYPOGRAPHY.fontSize.sm },
  removeText: { fontSize: TYPOGRAPHY.fontSize.sm },
  uploadHint: { fontSize: TYPOGRAPHY.fontSize.xs },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  galleryItem: { width: '31%', aspectRatio: 4 / 3, borderRadius: BORDER.radius.sm, overflow: 'hidden', position: 'relative' },
  galleryImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  galleryRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  galleryRemoveText: { fontSize: 14, fontWeight: 'bold' },
  galleryAdd: { width: '31%', aspectRatio: 4 / 3, borderRadius: BORDER.radius.sm, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  previewContainer: { gap: SPACING.md },
  previewHeader: { position: 'relative' },
  previewCover: { width: '100%', height: 120, borderRadius: BORDER.radius.md, resizeMode: 'cover' },
  previewCoverPlaceholder: { width: '100%', height: 120, borderRadius: BORDER.radius.md },
  previewLogoContainer: { position: 'absolute', bottom: -30, left: SPACING.md, width: 64, height: 64, borderRadius: BORDER.radius.md, borderWidth: 3, overflow: 'hidden' },
  previewLogo: { width: '100%', height: '100%', resizeMode: 'cover' },
  previewSection: { paddingHorizontal: SPACING.sm },
  previewTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold },
  previewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  previewTag: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, borderRadius: BORDER.radius.full },
  previewTagText: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.medium },
  previewSectionTitle: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, marginBottom: SPACING.xs },
  previewValue: { fontSize: TYPOGRAPHY.fontSize.sm },
  previewText: { fontSize: TYPOGRAPHY.fontSize.sm, lineHeight: 20 },
  footer: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  footerButtons: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  draftButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, height: LAYOUT.buttonHeight, paddingHorizontal: SPACING.lg, borderWidth: 1.5, borderRadius: BORDER.radius.sm },
  draftButtonText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  publishButton: { flex: 1 },

  // Generate button styles
  generateButtonContainer: {
    alignItems: 'flex-start',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
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
  },

  // Location type styles
  locationTypeRow: { flexDirection: 'row', gap: SPACING.sm },
  locationTypeCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.md, gap: SPACING.xs, position: 'relative' },
  locationTypeLabel: { fontSize: TYPOGRAPHY.fontSize.xs, textAlign: 'center' },
  locationTypeCheck: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  // Toggle container styles
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  toggleDescription: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  // Question item styles
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

  // Separator
  separator: { height: 1, marginVertical: SPACING.md },
  rowFields: { flexDirection: 'row', gap: SPACING.md },
  halfField: { flex: 1 },

  // Images upload styles
  imageUploadContainer: { marginTop: SPACING.md, alignItems: 'center' },
  addImageButtonFullWidth: { width: '100%', aspectRatio: 16 / 9, borderWidth: 2, borderRadius: BORDER.radius.md, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  addImageTextLarge: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.medium },
  imagesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md, width: '100%' },
  imageItemContainer: { width: '31%', aspectRatio: 16 / 9, borderRadius: BORDER.radius.sm, overflow: 'hidden', position: 'relative' },
  imageItem: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImageBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },


  // Preview images styles
  previewImagesScroll: { marginHorizontal: -SPACING.lg, paddingHorizontal: SPACING.lg },
  previewImageItem: { width: 200, height: 120, borderRadius: BORDER.radius.md, marginRight: SPACING.sm, resizeMode: 'cover' },
  previewNoImage: { height: 100, borderRadius: BORDER.radius.md, alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  previewNoImageText: { fontSize: TYPOGRAPHY.fontSize.sm },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  previewGridItem: { width: '50%', padding: SPACING.md, borderWidth: 0.5 },
  previewLabel: { fontSize: TYPOGRAPHY.fontSize.xs, marginBottom: 2 },
  previewValue: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  previewSection: { padding: SPACING.md, borderRadius: BORDER.radius.md },

  // Preview application settings styles
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
  previewQuestionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Back step button styles
  backStepButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, height: LAYOUT.buttonHeight, paddingHorizontal: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.sm },
  backStepButtonText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  continueButton: { flex: 1 },

  // Permissions styles
  permissionSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  permissionsContainer: {
    marginTop: SPACING.sm,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    overflow: 'hidden',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  permissionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  permissionDesc: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
});
