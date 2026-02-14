import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  Trash2,
  Upload,
  Home,
  Laptop,
  Wand2,
  ClipboardList,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT, OPACITY, withOpacity } from '../../../../src/constants/theme';
import { Input, Button, Toggle, Chip, IconButton, useToast } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { COUNTRIES, getRegionsByCountry, getCommunesByRegion } from '../../../../src/constants/location';
import {
  COMMUNITY_TYPE_DATA,
  VISIBILITY_DATA,
  COMMUNITY_TAG_DATA,
  MAX_COMMUNITY_TAGS,
  MAX_MEMBERSHIP_QUESTIONS,
} from '../../../../src/constants/community';
import { SECTOR_DATA, MAX_SECTORS } from '../../../../src/constants/talent';
import {
  CommunityType,
  Visibility,
  COMMUNITY_TYPE_LABELS,
  VISIBILITY_LABELS,
  Sector,
  ApplicationQuestion,
  CommunityStatus,
  COMMUNITY_STATUS_LABELS,
} from '../../../../src/types/models';
import { communityService, UpdateCommunityData, CreateCommunityData, imageService } from '../../../../src/services';
import { getFullImageUrl } from '../../../../src/utils/image';
import { useAlert } from '../../../../src/contexts/AlertContext';
import { FormTextArea } from '../../../../src/components/forms/FormTextArea';

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

type Step = 'info' | 'lieu' | 'conditions' | 'media' | 'preview';

const STEPS: Step[] = ['info', 'lieu', 'conditions', 'media', 'preview'];
const STEP_TITLES: Record<Step, string> = {
  info: 'Infos',
  lieu: 'Lieu',
  conditions: 'Conditions',
  media: 'Média',
  preview: 'Aperçu',
};

export default function EditCommunityScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const alerts = useAlert();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
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
  const countryScrollRef = useRef<ScrollView>(null);
  const COUNTRY_CHIP_WIDTH = 80;

  // Form state - Conditions
  const [visibility, setVisibility] = useState<Visibility | null>('PUBLIC');
  const [rules, setRules] = useState('');
  const [applicationQuestions, setApplicationQuestions] = useState<ApplicationQuestion[]>([]);

  // Form state - Media
  const [images, setImages] = useState<ImageItem[]>([]);

  // Status management
  const [status, setStatus] = useState<CommunityStatus>('INACTIVE');
  const [organizationId, setOrganizationId] = useState<string | null>(null);

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

  useEffect(() => {
    loadCommunity();
  }, [id]);

  const loadCommunity = async () => {
    setIsLoading(true);
    try {
      const response = await communityService.getById(id!);
      const comm = response.data;

      setName(comm.name || '');
      setCommunityType(comm.type || 'ONLINE');
      setDescription(comm.description || '');
      setRules(comm.rules || '');
      
      // New fields
      setVisibility(comm.visibility || (comm.access_type === 'PUBLIC' ? 'PUBLIC' : comm.access_type === 'MEMBERSHIP' ? 'PRIVATE' : 'PUBLIC'));
      setSelectedTags(comm.tags || []);
      setSelectedSectors(comm.sectors || []);
      
      // Legacy fields for backward compatibility
      if (comm.application_questions) {
        setApplicationQuestions(comm.application_questions.map((q, idx) => ({
          id: String(idx + 1),
          question: typeof q === 'string' ? q : q.question || '',
          required: typeof q === 'string' ? false : q.required || false,
          max_length: MAX_QUESTION_LENGTH,
        })));
      }
      
      setCountry(comm.country || 'CI');
      setRegion(comm.region || '');
      setCity(comm.city || '');
      setStatus((comm as any).status || 'INACTIVE');
      setOrganizationId(comm.organization_id || null);
      
      // Load images
      if (comm.images && comm.images.length > 0) {
        setImages(comm.images.map((uri, idx) => ({ id: String(idx + 1), uri })));
      } else if (comm.cover_image_url) {
        setImages([{ id: '1', uri: comm.cover_image_url }]);
      }
      
    } catch (error: any) {
      await alerts.showAlert({
        type: 'error',
        title: 'Erreur',
        message: error.error || 'Impossible de charger la communauté.',
        buttons: [{ text: 'OK', onPress: () => router.back() }],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    if (images.length >= MAX_IMAGES) {
      showToast({ type: 'warning', title: 'Limite atteinte', message: `Vous pouvez ajouter au maximum ${MAX_IMAGES} images.` });
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
      showToast({ type: 'error', title: 'Erreur', message: 'Une erreur est survenue lors de la sélection de l\'image.' });
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
      showToast({ type: 'warning', title: 'Limite atteinte', message: `Vous pouvez sélectionner au maximum ${MAX_COMMUNITY_TAGS} tags.` });
    }
  };

  const toggleSector = (sectorId: Sector) => {
    if (selectedSectors.includes(sectorId)) {
      setSelectedSectors(selectedSectors.filter((s) => s !== sectorId));
    } else if (selectedSectors.length < MAX_SECTORS) {
      setSelectedSectors([...selectedSectors, sectorId]);
    } else {
      showToast({ type: 'warning', title: 'Limite atteinte', message: `Vous pouvez sélectionner au maximum ${MAX_SECTORS} secteurs.` });
    }
  };

  // Check if generation is possible
  const canGenerate = name.trim().length >= 3;

  // Handle AI generation
  const handleGenerate = async () => {
    if (!canGenerate || isGenerating || !organizationId) return;

    setIsGenerating(true);
    try {
      // Collect all existing form data
      const existingData: Partial<CreateCommunityData> = {
        name: name.trim(),
        type: communityType || undefined,
        description: description || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        sectors: selectedSectors.length > 0 ? selectedSectors : undefined,
        visibility: visibility || undefined,
        rules: rules || undefined,
        application_questions: applicationQuestions.filter(q => q.question.trim().length > 0).map(q => q.question),
        city: communityType === 'HYBRID' ? city || undefined : undefined,
        region: communityType === 'HYBRID' ? region || undefined : undefined,
        country: communityType === 'HYBRID' ? country || undefined : undefined,
      };

      const response = await communityService.generate({
        name: name.trim(),
        organization_id: organizationId,
        existing_data: existingData,
      });

      if (response.success && response.data) {
        const data = response.data;

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
      console.error('Error generating community:', error);
      showToast({ type: 'error', title: 'Erreur de génération', message: error?.error || 'Une erreur est survenue lors de la génération.' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Question handlers
  const addQuestion = () => {
    if (applicationQuestions.length >= MAX_QUESTIONS) {
      showToast({ type: 'warning', title: 'Limite atteinte', message: `Vous pouvez ajouter au maximum ${MAX_QUESTIONS} questions.` });
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
    const remoteImages = images.filter((img) => isRemoteUrl(img.uri));
    const localImages = images.filter((img) => !isRemoteUrl(img.uri));
    const uploadedImageUrls: string[] = [];

    for (const image of localImages) {
      try {
        const uploaded = await imageService.uploadImage(
          { uri: image.uri, width: 800, height: 600 },
          'illustration',
          'community'
        );
        uploadedImageUrls.push(uploaded.url);
      } catch (error) {
        console.error('Error uploading image:', error);
        await alerts.error('Erreur', 'Impossible d\'uploader une image. Veuillez réessayer.');
        return null;
      }
    }

    const allImageUrls = [...remoteImages.map(img => img.uri), ...uploadedImageUrls];
    return allImageUrls;
  };


  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const imageUrls = await buildImagesPayload();
      if (imageUrls === null) {
        setIsSubmitting(false);
        return;
      }

      const data: UpdateCommunityData = {
        name,
        type: communityType || undefined,
        description: description || undefined,
        rules: rules || undefined,
        application_questions: applicationQuestions.filter(q => q.question.trim().length > 0).map(q => q.question),
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        sectors: selectedSectors.length > 0 ? selectedSectors : undefined,
        visibility: visibility || undefined,
        city: communityType === 'HYBRID' ? city || undefined : undefined,
        region: communityType === 'HYBRID' ? region || undefined : undefined,
        country: communityType === 'HYBRID' ? country || undefined : undefined,
        cover_image_url: imageUrls && imageUrls.length > 0 ? imageUrls[0] : undefined,
        images: imageUrls && imageUrls.length > 0 ? imageUrls : undefined,
        status,
      };
      await communityService.update(id!, data);
      await alerts.showAlert({
        type: 'success',
        title: 'Modifications enregistrées',
        message: 'La communauté a été mise à jour.',
        buttons: [{ text: 'OK', onPress: () => router.back() }],
      });
    } catch (error: any) {
      await alerts.error('Erreur', error.error || 'Une erreur est survenue lors de la mise à jour.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await alerts.confirm(
      'Supprimer la communauté',
      `Êtes-vous sûr de vouloir supprimer "${name}" ? Cette action est irréversible.`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await communityService.delete(id!);
      await alerts.showAlert({
        type: 'success',
        title: 'Supprimé',
        message: 'La communauté a été supprimée.',
        buttons: [{ text: 'OK', onPress: () => router.back() }],
      });
    } catch (error: any) {
      await alerts.error('Erreur', error.error || 'Une erreur est survenue lors de la suppression.');
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

  const getStatusColor = () => {
    switch (status) {
      case 'ACTIVE': return colors.success;
      case 'INACTIVE': return colors.gray500;
      default: return colors.gray500;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, index) => {
        const isCompleted = STEPS.indexOf(currentStep) > index;
        const isCurrent = currentStep === step;
        return (
          <View key={step} style={styles.stepItem}>
            <View style={[styles.stepDot, { backgroundColor: colors.gray200 }, (isCurrent || isCompleted) && { backgroundColor: colors.primary }]}>
              {isCompleted ? <Check size={12} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth + 0.5} /> : <Text style={[styles.stepNumber, { color: colors.gray600 }, isCurrent && { color: colors.textOnPrimary }]}>{index + 1}</Text>}
            </View>
            <Text style={[styles.stepLabel, { color: colors.gray500 }, isCurrent && { color: colors.primary, fontWeight: TYPOGRAPHY.fontWeight.semibold }]}>{STEP_TITLES[step]}</Text>
          </View>
        );
      })}
    </View>
  );

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
                <Chip
                  key={tag.id}
                  label={tag.label}
                  selected={isSelected}
                  leftIcon={isSelected ? <Check size={14} color={colors.primary} strokeWidth={2.5} /> : undefined}
                  onPress={() => toggleTag(tag.id)}
                  style={styles.selectableTag}
                  textStyle={styles.selectableTagText}
                />
              );
            })}
          </View>
        </View>

        {/* Bouton Générer */}
        {canGenerate && (
          <View style={styles.generateButtonContainer}>
            <Button
              title={isGenerating ? 'Suggestion...' : 'Suggérer'}
              onPress={handleGenerate}
              loading={isGenerating}
              disabled={isGenerating}
              icon={!isGenerating ? <Wand2 size={16} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} /> : undefined}
              fullWidth
              style={styles.generateButton}
            />
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
                <Chip
                  key={sector.id}
                  label={sector.label}
                  selected={isSelected}
                  leftIcon={isSelected ? <Check size={14} color={colors.primary} strokeWidth={2.5} /> : undefined}
                  onPress={() => toggleSector(sector.id)}
                  style={styles.selectableTag}
                  textStyle={styles.selectableTagText}
                />
              );
            })}
          </View>
        </View>

        {/* Description */}
        <FormTextArea
          label="Description"
          placeholder="Décrivez votre communauté, ses objectifs et sa mission..."
          value={description}
          onChangeText={setDescription}
          rows={4}
          maxLength={1000}
        />
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
                    isSelected && { backgroundColor: withOpacity(colors.primary, OPACITY[10]), borderColor: colors.primary },
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
                    isSelected && { backgroundColor: withOpacity(colors.primary, OPACITY[10]), borderColor: colors.primary },
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

        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        {/* Règles */}
        <FormTextArea
          label="Règles de la communauté"
          placeholder={'Ex: 1. Respectez les autres membres\n2. Pas de spam\n3. Restez courtois...'}
          value={rules}
          onChangeText={setRules}
          rows={5}
          maxLength={1000}
        />

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
                containerStyle={{ marginTop: 0 }}
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
          {applicationQuestions.length < MAX_QUESTIONS && (
            <Button
              title="Ajouter une question"
              onPress={addQuestion}
              variant="outline"
              icon={<Plus size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
              fullWidth
              style={styles.addQuestionButton}
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
                    <Image source={{ uri: getFullImageUrl(image.uri) || image.uri }} style={styles.imageItem} />
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
          Vérifiez toutes les informations avant enregistrement
        </Text>
      </View>

      {/* Status Management Card */}
      <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
        <View style={styles.statusHeader}>
          <View>
            <Text style={[styles.statusLabel, { color: colors.gray600 }]}>Statut de la communauté</Text>
            <View style={styles.statusBadgeContainer}>
              <View style={[styles.statusBadge, { backgroundColor: withOpacity(getStatusColor(), OPACITY[20]) }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                <Text style={[styles.statusBadgeText, { color: getStatusColor() }]}>
                  {COMMUNITY_STATUS_LABELS[status]}
                </Text>
              </View>
            </View>
          </View>
          <Toggle
            value={status === 'ACTIVE'}
            onValueChange={(value) => setStatus(value ? 'ACTIVE' : 'INACTIVE')}
            color={colors.success}
          />
        </View>
        <Text style={[styles.statusHint, { color: colors.gray500 }]}>
          {status === 'INACTIVE' ? 'Activez pour publier cette communauté et la rendre visible.' :
           status === 'ACTIVE' ? 'La communauté est publiée et visible par les membres.' : ''}
        </Text>
      </View>

      <View style={styles.previewContainer}>
        {/* Images Preview */}
        {images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewImagesScroll}>
            {images.map((img) => (
              <Image key={img.id} source={{ uri: getFullImageUrl(img.uri) || img.uri }} style={styles.previewImageItem} />
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
              <View style={[styles.previewTag, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
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
            {/* Bouton Supprimer */}
            <TouchableOpacity
              style={[styles.deleteButton, { borderColor: colors.error }]}
              onPress={handleDelete}
              disabled={isSubmitting}
            >
              <Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
            </TouchableOpacity>
            {/* Bouton Enregistrer */}
            <View style={styles.saveButtonContainer}>
              <Button
                title="Enregistrer"
                onPress={handleSave}
                disabled={isSubmitting}
                fullWidth
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
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}><ArrowLeft size={ICON.size.md} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Modifier la communauté</Text>
        <View style={styles.headerSpacer} />
      </View>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: TYPOGRAPHY.fontSize.md },
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
  formFields: { gap: SPACING.lg },
  fieldContainer: { gap: SPACING.xs },
  fieldLabel: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium, marginBottom: SPACING.xs },
  horizontalScroll: { marginHorizontal: -SPACING.lg },
  horizontalScrollContent: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  optionChip: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.full },
  optionChipText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  selectableTag: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.full },
  selectableTagText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  textAreaContainer: { borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.sm, padding: SPACING.md },
  textArea: { fontSize: TYPOGRAPHY.fontSize.md, minHeight: 80, textAlignVertical: 'top' },
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
  questionText: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm, marginRight: SPACING.sm },
  addQuestionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm },
  addButton: { width: 44, height: 44, borderRadius: BORDER.radius.sm, alignItems: 'center', justifyContent: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  logoUpload: { width: 80, height: 80, borderRadius: BORDER.radius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden' },
  logoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  logoInfo: { flex: 1, gap: SPACING.xs },
  logoInfoText: { fontSize: TYPOGRAPHY.fontSize.sm },
  removeText: { fontSize: TYPOGRAPHY.fontSize.sm },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  galleryItem: { width: '31%', aspectRatio: 4 / 3, borderRadius: BORDER.radius.sm, overflow: 'hidden', position: 'relative' },
  galleryImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  galleryRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  galleryRemoveText: { fontSize: 14, fontWeight: 'bold' },
  galleryAdd: { width: '31%', aspectRatio: 4 / 3, borderRadius: BORDER.radius.sm, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
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
  previewText: { fontSize: TYPOGRAPHY.fontSize.sm, lineHeight: 20 },
  footer: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  footerButtons: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  deleteButton: { width: 48, height: 48, borderRadius: BORDER.radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  saveButtonContainer: { flex: 1 },
  
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
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.full,
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
  fieldHint: { fontSize: TYPOGRAPHY.fontSize.xs, marginBottom: SPACING.sm },
  charCount: { fontSize: TYPOGRAPHY.fontSize.xs, textAlign: 'right', marginTop: SPACING.xs },
  stepDescription: { fontSize: TYPOGRAPHY.fontSize.md, textAlign: 'center' },
  
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
  previewSectionCard: { padding: SPACING.md, borderRadius: BORDER.radius.md },
  
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
  
  // Status card styles
  statusCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  statusLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: SPACING.xs,
  },
  statusBadgeContainer: {
    flexDirection: 'row',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.full,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  statusHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: 16,
  },
  
  // Back step button styles
  backStepButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, height: LAYOUT.buttonHeight, paddingHorizontal: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.sm },
  backStepButtonText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  continueButton: { flex: 1 },
});
