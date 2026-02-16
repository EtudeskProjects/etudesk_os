import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  ArrowLeft,
  MapPin,
  Calendar,
  Briefcase,
  FileText,
  Image as ImageIcon,
  Eye,
  Lock,
  Upload,
  X,
  Plus,
  Save,
  Send,
  Building2,
  Home,
  Laptop,
  ClipboardList,
  Trash2,
  Wand2,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT, OPACITY, withOpacity } from '../../../src/constants/theme';
import { Input, Button, Toggle, StepIndicator, Chip, KeyboardAwareScrollView, IconButton, SelectCard, useToast } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { useForm } from '../../../src/hooks/useForm';
import { COUNTRIES, getRegionsByCountry, getCommunesByRegion } from '../../../src/constants/location';
import { SECTOR_DATA } from '../../../src/constants/talent';
import {
  OPPORTUNITY_TYPE_DATA,
  CONTRACT_TYPE_DATA,
  WORK_RHYTHM_DATA,
  LOCATION_TYPE_DATA,
  COMPENSATION_FREQUENCY_DATA,
  getCurrencySymbol,
  OPPORTUNITY_VISIBILITY_DATA,
  generateOpportunitySlug,
} from '../../../src/constants/opportunity';
import {
  OpportunityType,
  ContractType,
  WorkRhythm,
  LocationType,
  CompensationFrequency,
  OPPORTUNITY_TYPE_LABELS,
  CONTRACT_TYPE_LABELS,
  WORK_RHYTHM_LABELS,
  LOCATION_TYPE_LABELS,
  COMPENSATION_FREQUENCY_LABELS,
  ApplicationQuestion,
  Visibility,
} from '../../../src/types/models';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { useAlert } from '../../../src/contexts/AlertContext';
import { FormTextArea } from '../../../src/components/forms/FormTextArea';
import { opportunityService, CreateOpportunityData, imageService } from '../../../src/services';
import { organizationService } from '../../../src/services';
import { uploadFile } from '../../../src/services/fileService';
import { formatNumberNoTrailingZeros } from '../../../src/utils/number';

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
const MAX_SECTORS = 5;
const MAX_IMAGES = 5;
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_SIZE_MB = 20;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
const MAX_QUESTIONS = 5;
const MAX_QUESTION_LENGTH = 200;

interface Attachment {
  id: string;
  name: string;
  uri: string;
  type: string;
  size?: number;
}

interface ImageItem {
  id: string;
  uri: string;
}

// Form values interface
interface OpportunityFormValues {
  // Info
  title: string;
  opportunityType: OpportunityType | null;
  summary: string;
  requirements: string;
  niceToHave: string;
  selectedSectors: string[];
  // Lieu
  locationType: LocationType | null;
  country: string;
  region: string;
  city: string;
  // Conditions
  visibility: Visibility;
  contractType: ContractType | null;
  workRhythm: WorkRhythm | null;
  compensationMin: string;
  compensationMax: string;
  currency: string;
  compensationFrequency: CompensationFrequency | null;
  duration: string;
  deadline: Date | null;
  startDate: Date | null;
  // Media
  images: ImageItem[];
  attachments: Attachment[];
  // Application
  cvRequired: boolean;
  applicationQuestions: ApplicationQuestion[];
}

// Icons for location types
const LOCATION_TYPE_ICONS: Record<LocationType, React.ComponentType<any>> = {
  ON_SITE: Building2,
  HYBRID: Home,
  REMOTE: Laptop,
};

export default function CreateOpportunityScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { selectedOrgId, selectedOrg } = useSpace();
  const alerts = useAlert();
  const { showToast } = useToast();

  // UI state (not form data)
  const [currentStep, setCurrentStep] = useState<Step>('info');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgLocationLoaded, setOrgLocationLoaded] = useState(false);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);

  // Form hook with all form fields
  const form = useForm<OpportunityFormValues>({
    fields: {
      // Info
      title: { initialValue: '' },
      opportunityType: { initialValue: null },
      summary: { initialValue: '' },
      requirements: { initialValue: '' },
      niceToHave: { initialValue: '' },
      selectedSectors: { initialValue: [] },
      // Lieu
      locationType: { initialValue: null },
      country: { initialValue: '' },
      region: { initialValue: '' },
      city: { initialValue: '' },
      // Conditions
      visibility: { initialValue: 'PUBLIC' },
      contractType: { initialValue: null },
      workRhythm: { initialValue: null },
      compensationMin: { initialValue: '' },
      compensationMax: { initialValue: '' },
      currency: { initialValue: 'XOF' },
      compensationFrequency: { initialValue: null },
      duration: { initialValue: '' },
      deadline: { initialValue: null },
      startDate: { initialValue: null },
      // Media
      images: { initialValue: [] },
      attachments: { initialValue: [] },
      // Application
      cvRequired: { initialValue: false },
      applicationQuestions: { initialValue: [] },
    },
    onSubmit: async (values) => {
      // Submit logic handled by handlePublish
    },
  });

  // Convenience getters for all form values
  const title = form.getValue('title');
  const opportunityType = form.getValue('opportunityType');
  const summary = form.getValue('summary');
  const requirements = form.getValue('requirements');
  const niceToHave = form.getValue('niceToHave');
  const selectedSectors = form.getValue('selectedSectors');
  const locationType = form.getValue('locationType');
  const country = form.getValue('country');
  const region = form.getValue('region');
  const city = form.getValue('city');
  const visibility = form.getValue('visibility');
  const contractType = form.getValue('contractType');
  const workRhythm = form.getValue('workRhythm');
  const compensationMin = form.getValue('compensationMin');
  const compensationMax = form.getValue('compensationMax');
  const currency = form.getValue('currency');
  const compensationFrequency = form.getValue('compensationFrequency');
  const duration = form.getValue('duration');
  const deadline = form.getValue('deadline');
  const startDate = form.getValue('startDate');
  const images = form.getValue('images');
  const attachments = form.getValue('attachments');
  const cvRequired = form.getValue('cvRequired');
  const applicationQuestions = form.getValue('applicationQuestions');

  // Get regions and cities dynamically
  const availableRegions = country ? getRegionsByCountry(country) : [];
  const availableCities = country && region ? getCommunesByRegion(country, region) : [];

  // Refs for auto-scroll to selected country
  const countryScrollRef = useRef<ScrollView>(null);
  const COUNTRY_CHIP_WIDTH = 80; // Approximate width of each country chip

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
            // Set default values from organization using setValues
            form.setValues({
              country: org.headquarters_country || '',
              region: org.headquarters_region || '',
              city: org.headquarters_city || '',
            });
          }
        } catch (error) {
          // Fallback to CI if org not found
          form.setValue('country', 'CI');
        }
        setOrgLocationLoaded(true);
      }
    };
    loadOrgLocation();
  }, [selectedOrgId, orgLocationLoaded]);

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
        form.setValue('images', [...images, newImage]);
      }
    } catch (error) {
      showToast({ type: 'error', title: 'Erreur', message: 'Une erreur est survenue lors de la sélection de l\'image.' });
    }
  };

  const removeImage = (id: string) => {
    form.setValue('images', images.filter((img) => img.id !== id));
  };

  const pickDocument = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      showToast({ type: 'warning', title: 'Limite atteinte', message: `Vous pouvez ajouter au maximum ${MAX_ATTACHMENTS} pièces jointes.` });
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        const fileSize = doc.size || 0;

        if (fileSize > MAX_ATTACHMENT_SIZE_BYTES) {
          showToast({ type: 'warning', title: 'Fichier trop volumineux', message: `Le fichier ne doit pas dépasser ${MAX_ATTACHMENT_SIZE_MB} MB.` });
          return;
        }

        const newAttachment: Attachment = {
          id: Date.now().toString(),
          name: doc.name,
          uri: doc.uri,
          type: doc.mimeType || 'application/pdf',
          size: fileSize,
        };
        form.setValue('attachments', [...attachments, newAttachment]);
      }
    } catch (error) {
      showToast({ type: 'error', title: 'Erreur', message: 'Une erreur est survenue lors de la sélection du document.' });
    }
  };

  const removeAttachment = (id: string) => {
    form.setValue('attachments', attachments.filter((a) => a.id !== id));
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
          'opportunity'
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

  const buildAttachmentsPayload = async () => {
    const remoteAttachments = attachments.filter((att) => isRemoteUrl(att.uri));
    const localAttachments = attachments.filter((att) => !isRemoteUrl(att.uri));
    const uploadedAttachments: Attachment[] = [];

    for (const attachment of localAttachments) {
      try {
        const uploaded = await uploadFile({
          uri: attachment.uri,
          name: attachment.name,
          type: attachment.type || 'application/octet-stream',
          category: 'opportunities',
        });
        uploadedAttachments.push({ ...attachment, uri: uploaded.url });
      } catch (error) {
        console.error('Error uploading attachment:', error);
        await alerts.error('Erreur', 'Impossible d\'uploader une pièce jointe. Veuillez réessayer.');
        return null;
      }
    }

    const allAttachments = [...remoteAttachments, ...uploadedAttachments];
    return allAttachments.map((att) => ({
      name: att.name,
      url: att.uri,
      type: att.type || undefined,
      size: att.size || undefined,
    }));
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
    form.setValue('applicationQuestions', [...applicationQuestions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<ApplicationQuestion>) => {
    form.setValue('applicationQuestions', applicationQuestions.map((q) =>
      q.id === id ? { ...q, ...updates } : q
    ));
  };

  const removeQuestion = (id: string) => {
    form.setValue('applicationQuestions', applicationQuestions.filter((q) => q.id !== id));
  };

  // Handle sector selection (multi-select with max 5)
  const toggleSector = (sectorId: string) => {
    if (selectedSectors.includes(sectorId)) {
      form.setValue('selectedSectors', selectedSectors.filter((s) => s !== sectorId));
    } else if (selectedSectors.length < MAX_SECTORS) {
      form.setValue('selectedSectors', [...selectedSectors, sectorId]);
    } else {
      showToast({ type: 'warning', title: 'Limite atteinte', message: `Vous pouvez sélectionner au maximum ${MAX_SECTORS} secteurs.` });
    }
  };

  // Check if generation is possible (title >= 3 chars and type selected)
  const canGenerate = title.trim().length >= 3 && opportunityType !== null && selectedOrgId !== null;

  // Handle AI generation
  const handleGenerate = async () => {
    if (!canGenerate || isGenerating) return;

    setIsGenerating(true);
    try {
      const response = await opportunityService.generate({
        title: title.trim(),
        type: opportunityType!,
        organization_id: selectedOrgId!,
      });

      if (response.success && response.data) {
        const data = response.data;

        // Apply generated data to form fields using setValues for batch update
        const updates: Partial<OpportunityFormValues> = {};

        // Title - apply suggested title
        if (data.suggested_title) updates.title = data.suggested_title;
        if (data.summary) updates.summary = data.summary;
        if (data.requirements) updates.requirements = data.requirements;
        if (data.nice_to_have) updates.niceToHave = data.nice_to_have;
        if (data.contract_type) updates.contractType = data.contract_type as ContractType;
        if (data.work_rhythm) updates.workRhythm = data.work_rhythm as WorkRhythm;

        // Sectors - apply 2-5 sectors
        if (data.sectors && data.sectors.length > 0) {
          updates.selectedSectors = data.sectors.slice(0, MAX_SECTORS);
        }

        if (data.compensation_min) updates.compensationMin = Math.floor(data.compensation_min).toString();
        if (data.compensation_max) updates.compensationMax = Math.floor(data.compensation_max).toString();
        if (data.currency) updates.currency = data.currency;
        if (data.compensation_frequency) updates.compensationFrequency = data.compensation_frequency as CompensationFrequency;
        if (data.location_type) updates.locationType = data.location_type as LocationType;
        if (data.duration) updates.duration = data.duration;

        // Deadline - calculate date from deadline_days
        if (data.deadline_days && data.deadline_days > 0) {
          const deadlineDate = new Date();
          deadlineDate.setDate(deadlineDate.getDate() + data.deadline_days);
          updates.deadline = deadlineDate;
        }

        if (data.cv_required !== undefined) updates.cvRequired = data.cv_required;
        if (data.application_questions && data.application_questions.length > 0) {
          updates.applicationQuestions = data.application_questions.slice(0, MAX_QUESTIONS);
        }

        form.setValues(updates);
      }
    } catch (error: any) {
      console.error('Error generating opportunity:', error);
      showToast({
        type: 'error',
        title: 'Erreur de génération',
        message: error?.error || 'Une erreur est survenue lors de la génération. Veuillez réessayer.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNext = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1]);
    } else {
      router.back();
    }
  };

  const buildOpportunityData = (
    imageUrls?: string[],
    attachmentPayload?: CreateOpportunityData['attachments']
  ): CreateOpportunityData => ({
    title,
    slug: generateOpportunitySlug(title),
    type: opportunityType || undefined,
    contract_type: contractType || undefined,
    work_rhythm: workRhythm || undefined,
    summary: summary || undefined,
    requirements: requirements || undefined,
    nice_to_have: niceToHave || undefined,
    sectors: selectedSectors.length > 0 ? selectedSectors : undefined,
    compensation_min: compensationMin ? parseInt(compensationMin, 10) : undefined,
    compensation_max: compensationMax ? parseInt(compensationMax, 10) : undefined,
    currency: currency || undefined,
    compensation_frequency: compensationFrequency || undefined,
    location_type: locationType || undefined,
    locations: locationType !== 'REMOTE' && country ? [{
      country,
      region: region || undefined,
      city: city || undefined,
      is_primary: true,
    }] : undefined,
    deadline: deadline?.toISOString() || undefined,
    start_date: startDate?.toISOString().split('T')[0] || undefined,
    duration: duration.trim() || undefined,
    organization_id: selectedOrgId || undefined,
    cover_image_url: imageUrls && imageUrls.length > 0 ? imageUrls[0] : undefined,
    images: imageUrls && imageUrls.length > 0 ? imageUrls : undefined,
    attachments: attachmentPayload && attachmentPayload.length > 0 ? attachmentPayload : undefined,
    // Application settings
    cv_required: cvRequired,
    application_questions: applicationQuestions.filter(q => q.question.trim().length > 0),
    // Visibility
    visibility,
  });

  const handleSaveDraft = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const imageUrls = await buildImagesPayload();
      if (imageUrls === null) {
        setIsSubmitting(false);
        return;
      }
      const attachmentPayload = await buildAttachmentsPayload();
      if (attachmentPayload === null) {
        setIsSubmitting(false);
        return;
      }
      const data = buildOpportunityData(imageUrls, attachmentPayload);
      await opportunityService.saveDraft(data);
      await alerts.showAlert({
        type: 'success',
        title: 'Brouillon enregistré',
        message: 'L\'opportunité a été enregistrée comme brouillon.',
        buttons: [{ text: 'OK', onPress: () => router.back() }],
      });
    } catch (error: any) {
      await alerts.error('Erreur', error.error || 'Une erreur est survenue lors de l\'enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const imageUrls = await buildImagesPayload();
      if (imageUrls === null) {
        setIsSubmitting(false);
        return;
      }
      const attachmentPayload = await buildAttachmentsPayload();
      if (attachmentPayload === null) {
        setIsSubmitting(false);
        return;
      }
      const data = { ...buildOpportunityData(imageUrls, attachmentPayload), status: 'OPEN' as const };
      await opportunityService.create(data);
      await alerts.showAlert({
        type: 'success',
        title: 'Opportunité publiée',
        message: `"${title}" a été publiée avec succès !`,
        buttons: [{ text: 'OK', onPress: () => router.back() }],
      });
    } catch (error: any) {
      await alerts.error('Erreur', error.error || 'Une erreur est survenue lors de la publication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'info':
        return title.trim().length >= 5 && opportunityType !== null;
      case 'lieu':
        return locationType !== null && (locationType === 'REMOTE' || country.length > 0);
      case 'conditions':
        return contractType !== null && deadline !== null;
      case 'media':
        return true; // Media is optional
      case 'preview':
        return true;
      default:
        return false;
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Non définie';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatNumber = (num: string | number | null | undefined): string => {
    if (!num) return '';
    const numStr = typeof num === 'number' ? num.toString() : num;
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const getSectorsLabel = (ids: string[]) => {
    if (ids.length === 0) return 'Non défini';
    return ids
      .map((id) => SECTOR_DATA.find((s) => s.id === id)?.label || id)
      .join(', ');
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
        <Briefcase size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Informations de base</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Décrivez l'opportunité que vous proposez
        </Text>
      </View>

      <View style={styles.formFields}>
        {/* Titre */}
        <Input
          label="Titre du poste *"
          placeholder="Ex: Développeur Full Stack"
          value={title}
          onChangeText={(value) => form.setValue('title', value)}
          autoCapitalize="words"
        />

        {/* Type d'opportunité */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Type d'opportunité *</Text>
          <View style={styles.tagsContainer}>
            {OPPORTUNITY_TYPE_DATA.map((type) => {
              const isSelected = opportunityType === type.id;
              return (
                <Chip
                  key={type.id}
                  label={type.label}
                  selected={isSelected}
                  leftIcon={isSelected ? <Check size={14} color={colors.primary} strokeWidth={2.5} /> : undefined}
                  onPress={() => form.setValue('opportunityType', type.id)}
                  style={styles.selectableTag}
                  textStyle={styles.selectableTagText}
                />
              );
            })}
          </View>
        </View>

        {/* Bouton Générer - Visible quand title >= 3 chars et type sélectionné */}
        {canGenerate && (
          <View style={styles.generateButtonContainer}>
            <Button
              title={isGenerating ? 'Suggestion...' : 'Suggérer'}
              onPress={handleGenerate}
              loading={isGenerating}
              disabled={isGenerating}
              size="sm"
              icon={!isGenerating ? <Wand2 size={16} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} /> : undefined}
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

        <FormTextArea
          label="Description du poste"
          placeholder="Décrivez les missions et responsabilités..."
          value={summary}
          onChangeText={(value) => form.setValue('summary', value)}
          rows={4}
          maxLength={1000}
        />

        <FormTextArea
          label="Prérequis"
          placeholder="Compétences et qualifications requises..."
          value={requirements}
          onChangeText={(value) => form.setValue('requirements', value)}
          rows={3}
          maxLength={500}
        />

        <FormTextArea
          label="Atouts appréciés"
          placeholder="Compétences bonus appréciées..."
          value={niceToHave}
          onChangeText={(value) => form.setValue('niceToHave', value)}
          rows={2}
          maxLength={300}
        />
      </View>
    </View>
  );

  const renderLieuStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <MapPin size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Lieu de travail</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Où se déroulera le travail ?
        </Text>
      </View>

      <View style={styles.formFields}>
        {/* Mode de travail - 3 options horizontales avec icônes */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Mode de travail *</Text>
          <View style={styles.locationTypeRow}>
            {LOCATION_TYPE_DATA.map((type) => {
              const isSelected = locationType === type.id;
              const IconComponent = LOCATION_TYPE_ICONS[type.id];
              return (
                <SelectCard
                  key={type.id}
                  selected={isSelected}
                  onPress={() => form.setValue('locationType', type.id)}
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

        {/* Localisation (seulement si pas "A distance") */}
        {locationType && locationType !== 'REMOTE' && (
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
                    <Chip
                      key={c.id}
                      label={c.label}
                      selected={isSelected}
                      onPress={() => {
                        form.setValues({
                          country: c.id,
                          region: '',
                          city: '',
                        });
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
                      <Chip
                        key={r.id}
                        label={r.label}
                        selected={isSelected}
                        onPress={() => {
                          form.setValues({
                            region: r.id,
                            city: '',
                          });
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
          Contrat, rémunération et dates
        </Text>
      </View>

      <View style={styles.formFields}>
        {/* Type de contrat */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Type de contrat *</Text>
          <View style={styles.tagsContainer}>
            {CONTRACT_TYPE_DATA.map((type) => {
              const isSelected = contractType === type.id;
              return (
                <Chip
                  key={type.id}
                  label={type.label}
                  selected={isSelected}
                  onPress={() => form.setValue('contractType', type.id)}
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

        {/* Rythme de travail */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Rythme de travail</Text>
          <View style={styles.tagsContainer}>
            {WORK_RHYTHM_DATA.map((rhythm) => {
              const isSelected = workRhythm === rhythm.id;
              return (
                <Chip
                  key={rhythm.id}
                  label={rhythm.label}
                  selected={isSelected}
                  onPress={() => form.setValue('workRhythm', isSelected ? null : rhythm.id)}
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

        {/* Durée du contrat - Input libre */}
        <Input
          label="Durée du contrat"
          placeholder="ex: 1 mois, 6 mois, CDI..."
          value={duration}
          onChangeText={(value) => form.setValue('duration', value)}
        />

        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        {/* Rémunération */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Rémunération</Text>
          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <Input
                label="Minimum"
                placeholder="150000"
                value={compensationMin}
                onChangeText={(value) => form.setValue('compensationMin', value)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfField}>
              <Input
                label="Maximum"
                placeholder="300000"
                value={compensationMax}
                onChangeText={(value) => form.setValue('compensationMax', value)}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <Input
          label="Devise (ex: XOF, EUR)"
          placeholder="XOF"
          value={currency}
          onChangeText={(v) => form.setValue('currency', v || 'XOF')}
          maxLength={10}
          autoCapitalize="characters"
        />

        {/* Fréquence */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Fréquence</Text>
          <View style={styles.tagsContainer}>
            {COMPENSATION_FREQUENCY_DATA.map((freq) => {
              const isSelected = compensationFrequency === freq.id;
              return (
                <Chip
                  key={freq.id}
                  label={freq.label}
                  selected={isSelected}
                  onPress={() => form.setValue('compensationFrequency', freq.id)}
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

        {/* Visibility */}
        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Visibilité *</Text>
          <View style={styles.locationTypeRow}>
            {OPPORTUNITY_VISIBILITY_DATA.map((type) => {
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

        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        {/* Dates */}
        <View style={styles.rowFields}>
          <View style={styles.halfField}>
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
              Date limite <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <Button
              title={deadline ? formatDate(deadline) : 'Sélectionner'}
              onPress={() => setShowDeadlinePicker(true)}
              variant="outline"
              icon={<Calendar size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />}
              style={[
                styles.dateButton,
                {
                  backgroundColor: colors.gray50,
                  borderColor: deadline ? colors.gray200 : colors.error,
                  justifyContent: 'flex-start',
                },
              ]}
              textStyle={[styles.dateButtonText, { color: deadline ? colors.textPrimary : colors.gray500 }]}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Date de début</Text>
            <Button
              title={startDate ? formatDate(startDate) : 'Sélectionner'}
              onPress={() => setShowStartDatePicker(true)}
              variant="outline"
              icon={<Calendar size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />}
              style={[
                styles.dateButton,
                { backgroundColor: colors.gray50, borderColor: colors.gray200, justifyContent: 'flex-start' },
              ]}
              textStyle={[styles.dateButtonText, { color: startDate ? colors.textPrimary : colors.gray500 }]}
            />
          </View>
        </View>

        {showDeadlinePicker && (
          <DateTimePicker
            value={deadline || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant={isDark ? 'dark' : 'light'}
            textColor={colors.textPrimary}
            onChange={(_, selectedDate) => {
              setShowDeadlinePicker(false);
              if (selectedDate) {
                // Date limite doit être > aujourd'hui
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (selectedDate <= today) {
                  showToast({ type: 'warning', title: 'Date invalide', message: 'La date limite doit être supérieure à aujourd\'hui.' });
                  return;
                }
                form.setValue('deadline', selectedDate);
                // Si la date de début existe et est <= nouvelle date limite, la réinitialiser
                if (startDate && startDate <= selectedDate) {
                  form.setValue('startDate', null);
                }
              }
            }}
            minimumDate={new Date(Date.now() + 24 * 60 * 60 * 1000)} // Minimum = demain
          />
        )}

        {showStartDatePicker && (
          <DateTimePicker
            value={startDate || (deadline ? new Date(deadline.getTime() + 24 * 60 * 60 * 1000) : new Date())}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant={isDark ? 'dark' : 'light'}
            textColor={colors.textPrimary}
            onChange={(_, selectedDate) => {
              setShowStartDatePicker(false);
              if (selectedDate) {
                // Date de début doit être > date limite
                if (deadline && selectedDate <= deadline) {
                  showToast({ type: 'warning', title: 'Date invalide', message: 'La date de début doit être supérieure à la date limite.' });
                  return;
                }
                form.setValue('startDate', selectedDate);
              }
            }}
            minimumDate={deadline ? new Date(deadline.getTime() + 24 * 60 * 60 * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000)}
          />
        )}

        {/* Separator before candidature settings */}
        <View style={[styles.sectionSeparator, { backgroundColor: colors.gray200 }]} />

        {/* Candidature Settings Section */}
        <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Paramètres de candidature</Text>

        {/* CV Required Toggle */}
        <View style={[styles.toggleContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
          <View style={styles.toggleInfo}>
            <ClipboardList size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            <View style={styles.toggleTextContainer}>
              <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>CV requis</Text>
              <Text style={[styles.toggleDescription, { color: colors.gray500 }]}>
                Les candidats devront joindre leur CV
              </Text>
            </View>
          </View>
          <Toggle
            value={cvRequired}
            onValueChange={(value) => form.setValue('cvRequired', value)}
          />
        </View>

        {/* Complementary Questions */}
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
          {applicationQuestions.length < MAX_QUESTIONS && (
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
              <Button
                title="Ajouter une image"
                onPress={pickImage}
                variant="outline"
                icon={<Upload size={32} color={colors.gray400} strokeWidth={ICON.strokeWidth} />}
                style={[styles.addImageButtonFullWidth, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}
                textStyle={[styles.addImageTextLarge, { color: colors.gray500 }]}
                fullWidth
              />
            )}

            {/* Grille d'images uploadées */}
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

        {/* Pièces jointes - Max 3 x 20MB */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
            Pièces jointes ({attachments.length}/{MAX_ATTACHMENTS})
          </Text>
          <Text style={[styles.fieldHint, { color: colors.gray500 }]}>
            Fiche de poste, description détaillée, etc. (PDF, Word) - Max {MAX_ATTACHMENT_SIZE_MB}MB par fichier
          </Text>

          {/* Liste des attachments */}
          {attachments.map((attachment) => (
            <View
              key={attachment.id}
              style={[styles.attachmentItem, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}
            >
              <FileText size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View style={styles.attachmentInfo}>
                <Text style={[styles.attachmentName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {attachment.name}
                </Text>
                  {attachment.size && (
                    <Text style={[styles.attachmentSize, { color: colors.gray500 }]}>
                    {formatNumberNoTrailingZeros(attachment.size / (1024 * 1024), 1)} MB
                    </Text>
                  )}
              </View>
              <IconButton
                onPress={() => removeAttachment(attachment.id)}
                icon={<X size={18} color={colors.gray500} strokeWidth={ICON.strokeWidth} />}
                accessibilityLabel="Retirer la pièce jointe"
                size="sm"
                variant="ghost"
              />
            </View>
          ))}

          {/* Bouton ajouter si pas encore 3 */}
          {attachments.length < MAX_ATTACHMENTS && (
            <Button
              title="Ajouter un document"
              onPress={pickDocument}
              variant="outline"
              icon={<Plus size={20} color={colors.gray500} strokeWidth={ICON.strokeWidth} />}
              style={[styles.addAttachmentButton, { borderColor: colors.gray300 }]}
              textStyle={[styles.addAttachmentText, { color: colors.gray600 }]}
            />
          )}
        </View>
      </View>
    </View>
  );

  // Helper to get location label
  const getLocationLabel = () => {
    if (!locationType) return 'Non défini';
    const locationLabel = LOCATION_TYPE_LABELS[locationType];
    if (!locationLabel) return 'Non défini';
    if (locationType === 'REMOTE') return locationLabel;
    const parts = [locationLabel];
    if (city) {
      const cityLabel = availableCities.find((c) => c.id === city)?.label || city;
      parts.push(cityLabel);
    } else if (region) {
      const regionLabel = availableRegions.find((r) => r.id === region)?.label || region;
      parts.push(regionLabel);
    } else if (country) {
      const countryLabel = COUNTRIES.find((c) => c.id === country)?.label || country;
      parts.push(countryLabel);
    }
    return parts.join(' - ');
  };

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
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{title || 'Sans titre'}</Text>
          <View style={styles.previewTags}>
            {opportunityType ? (
              <View style={[styles.previewTag, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                <Text style={[styles.previewTagText, { color: colors.primary }]}>
                  {OPPORTUNITY_TYPE_LABELS[opportunityType]}
                </Text>
              </View>
            ) : (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray500 }]}>Type non défini</Text>
              </View>
            )}
            {contractType ? (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray700 }]}>
                  {CONTRACT_TYPE_LABELS[contractType]}
                </Text>
              </View>
            ) : (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray500 }]}>Contrat non défini</Text>
              </View>
            )}
            {workRhythm && (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray700 }]}>
                  {WORK_RHYTHM_LABELS[workRhythm]}
                </Text>
              </View>
            )}
          </View>
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
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Mode de travail</Text>
            <Text style={[styles.previewValue, { color: locationType ? colors.textPrimary : colors.gray400 }]}>
              {getLocationLabel()}
            </Text>
          </View>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Rythme de travail</Text>
            <Text style={[styles.previewValue, { color: workRhythm ? colors.textPrimary : colors.gray400 }]}>
              {workRhythm ? WORK_RHYTHM_LABELS[workRhythm] : 'Non défini'}
            </Text>
          </View>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Durée du contrat</Text>
            <Text style={[styles.previewValue, { color: duration.trim() ? colors.textPrimary : colors.gray400 }]}>
              {duration.trim() || 'Non définie'}
            </Text>
          </View>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Date limite</Text>
            <Text style={[styles.previewValue, { color: deadline ? colors.textPrimary : colors.gray400 }]}>
              {formatDate(deadline)}
            </Text>
          </View>
        </View>

        {/* Compensation */}
        <View style={[styles.previewSection, { backgroundColor: colors.gray50 }]}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
            Rémunération{compensationFrequency ? ` / ${COMPENSATION_FREQUENCY_LABELS[compensationFrequency]}` : ''}
          </Text>
          <View style={{ marginTop: SPACING.xs }}>
            <Text style={[styles.previewText, { color: colors.textPrimary, marginBottom: SPACING.xs }]}>
              Min : {compensationMin ? `${formatNumber(compensationMin)} ${getCurrencySymbol(currency)}` : 'Non définie'}
            </Text>
            <Text style={[styles.previewText, { color: colors.textPrimary }]}>
              Max : {compensationMax ? `${formatNumber(compensationMax)} ${getCurrencySymbol(currency)}` : 'Non définie'}
            </Text>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Dates</Text>
          <View style={styles.previewDates}>
            <View>
              <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Date limite</Text>
              <Text style={[styles.previewValue, { color: deadline ? colors.textPrimary : colors.gray400 }]}>
                {formatDate(deadline)}
              </Text>
            </View>
            <View>
              <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Date de début</Text>
              <Text style={[styles.previewValue, { color: startDate ? colors.textPrimary : colors.gray400 }]}>
                {formatDate(startDate)}
              </Text>
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Description du poste</Text>
          {summary ? (
            <Text style={[styles.previewText, { color: colors.textSecondary }]}>{summary}</Text>
          ) : (
            <Text style={[styles.previewText, { color: colors.gray400 }]}>Aucune description</Text>
          )}
        </View>

        {/* Prérequis */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Prérequis</Text>
          {requirements ? (
            <Text style={[styles.previewText, { color: colors.textSecondary }]}>{requirements}</Text>
          ) : (
            <Text style={[styles.previewText, { color: colors.gray400 }]}>Aucun prérequis défini</Text>
          )}
        </View>

        {/* Atouts appréciés */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Atouts appréciés</Text>
          {niceToHave ? (
            <Text style={[styles.previewText, { color: colors.textSecondary }]}>{niceToHave}</Text>
          ) : (
            <Text style={[styles.previewText, { color: colors.gray400 }]}>Aucun atout défini</Text>
          )}
        </View>

        {/* Application Settings */}
        <View style={[styles.previewSection, { backgroundColor: colors.gray50 }]}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Paramètres de candidature</Text>
          <View style={styles.previewApplicationSettings}>
            <View style={styles.previewSettingRow}>
              <Text style={[styles.previewLabel, { color: colors.gray500 }]}>CV requis</Text>
              <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
                {cvRequired ? 'Oui' : 'Non'}
              </Text>
            </View>
            <View style={styles.previewSettingRow}>
              <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Questions complémentaires</Text>
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

        {/* Pièces jointes */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Pièces jointes</Text>
          {attachments.length > 0 ? (
            <View style={{ gap: SPACING.xs }}>
              {attachments.map((att) => (
                <View key={att.id} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                  <FileText size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.previewText, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                    {att.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.previewText, { color: colors.gray400 }]}>Aucune pièce jointe</Text>
          )}
        </View>
      </View>
    </View>
  );

  const renderFooter = () => {
    const isFirstStep = currentStep === 'info';

    if (currentStep === 'preview') {
      return (
        <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: Math.max(SPACING.lg, insets.bottom + SPACING.md) }]}>
          <View style={styles.footerButtons}>
            {/* Bouton Retour */}
            <Button
              title="Retour"
              onPress={handleBack}
              disabled={form.state.isSubmitting}
              variant="outline"
              icon={<ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />}
              style={[styles.backStepButton, { borderColor: colors.gray300 }]}
              textStyle={[styles.backStepButtonText, { color: colors.gray700 }]}
            />
            {/* Bouton Brouillon */}
            <IconButton
              onPress={handleSaveDraft}
              disabled={form.state.isSubmitting}
              icon={<Save size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />}
              accessibilityLabel="Enregistrer le brouillon"
              variant="outline"
              style={[styles.draftButton, { borderColor: colors.gray300 }]}
            />
            {/* Bouton Publier */}
            <View style={styles.publishButton}>
              <Button
                title="Publier"
                onPress={handlePublish}
                disabled={form.state.isSubmitting}
                loading={form.state.isSubmitting}
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
          {/* Bouton Retour (sauf sur le premier step) */}
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
        <IconButton
          onPress={handleBack}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel="Retour"
          style={styles.backButton}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Nouvelle opportunité</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        afterScrollChildren={renderFooter()}
      >
        {renderStepIndicator()}

        {currentStep === 'info' && renderInfoStep()}
        {currentStep === 'lieu' && renderLieuStep()}
        {currentStep === 'conditions' && renderConditionsStep()}
        {currentStep === 'media' && renderMediaStep()}
        {currentStep === 'preview' && renderPreviewStep()}
      </KeyboardAwareScrollView>
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
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },

  stepItem: {
    alignItems: 'center',
    gap: SPACING.xs,
  },

  stepDot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.full,
  },

  stepNumber: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  stepLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  stepContent: {
    flex: 1,
  },

  stepHeader: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  },

  stepTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  stepDescription: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
  },

  formFields: {
    gap: SPACING.lg,
  },

  fieldContainer: {
    gap: SPACING.xs,
  },

  fieldLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  fieldHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: SPACING.sm,
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

  // Text areas are handled by <FormTextArea />
  textAreaContainer: {},
  textArea: {},
  charCount: {},

  optionCards: {
    gap: SPACING.sm,
  },

  optionCard: {
    padding: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.md,
  },

  optionCardSmall: {
    padding: SPACING.sm,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.md,
  },

  optionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  optionCardTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  optionCardTitleSmall: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  optionCardDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
  },

  separator: {
    height: 1,
    marginVertical: SPACING.md,
  },

  sectionSeparator: {
    height: 1,
    marginVertical: SPACING.lg,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.md,
  },

  rowFields: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  halfField: {
    flex: 1,
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

  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
  },

  dateButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },

  coverUpload: {
    height: 160,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.md,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },

  coverPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },

  uploadText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  uploadHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  removeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-end',
    marginTop: SPACING.sm,
  },

  removeImageText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    marginTop: SPACING.sm,
  },

  attachmentName: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  addAttachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.sm,
    borderStyle: 'dashed',
    marginTop: SPACING.sm,
  },

  addAttachmentText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  previewContainer: {
    gap: SPACING.md,
  },

  previewCover: {
    width: '100%',
    height: 180,
    borderRadius: BORDER.radius.md,
    resizeMode: 'cover',
  },

  previewSection: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
  },

  previewTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  previewTags: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },

  previewTag: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.full,
  },

  previewTagText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  previewGridItem: {
    width: '50%',
    padding: SPACING.md,
    borderWidth: 0.5,
  },

  previewLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: 2,
  },

  previewValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  previewSectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },

  previewCompensation: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  previewDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  previewText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },

  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },

  footerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },

  draftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    height: LAYOUT.buttonHeight,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.sm,
  },

  draftButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  publishButton: {
    flex: 1,
  },

  // New styles for location type horizontal row with icons
  locationTypeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  locationTypeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.md,
    gap: SPACING.xs,
    position: 'relative',
  },

  locationTypeLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
  },

  locationTypeCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Images upload styles
  imageUploadContainer: {
    marginTop: SPACING.md,
    alignItems: 'center',
  },

  addImageButtonFullWidth: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderWidth: 2,
    borderRadius: BORDER.radius.md,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },

  addImageTextLarge: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    width: '100%',
  },

  imageItemContainer: {
    width: '31%',
    aspectRatio: 16 / 9,
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },

  imageItem: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addImageButton: {
    width: '31%',
    aspectRatio: 16 / 9,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.sm,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },

  addImageText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Attachment info styles
  attachmentInfo: {
    flex: 1,
    gap: 2,
  },

  attachmentSize: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Preview images styles
  previewImagesScroll: {
    marginHorizontal: -SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },

  previewImageItem: {
    width: 200,
    height: 120,
    borderRadius: BORDER.radius.md,
    marginRight: SPACING.sm,
    resizeMode: 'cover',
  },

  previewNoImage: {
    height: 100,
    borderRadius: BORDER.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },

  previewNoImageText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Back step button styles
  backStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    height: LAYOUT.buttonHeight,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.sm,
  },

  backStepButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  continueButton: {
    flex: 1,
  },

  // Candidature step styles
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

  questionInput: {},

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
});
