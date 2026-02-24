import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  Trash2,
  ClipboardList,
  Building2,
  Home,
  Laptop,
  Wand2,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT, OPACITY, withOpacity } from '../../../../src/constants/theme';
import { Input, Button, IconButton, Toggle, Chip, KeyboardAwareScrollView, SelectCard, useToast, LoadingShimmer } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { COUNTRIES, getRegionsByCountry, getCommunesByRegion } from '../../../../src/constants/location';
import { SECTOR_DATA } from '../../../../src/constants/talent';
import {
  getOpportunityTypeData,
  getContractTypeData,
  getWorkRhythmData,
  getLocationTypeData,
  getCompensationFrequencyData,
  getCurrencySymbol,
  getOpportunityVisibilityData,
} from '../../../../src/constants/opportunity';
import {
  OpportunityType,
  ContractType,
  WorkRhythm,
  LocationType,
  CompensationFrequency,
  OpportunityStatus,
  getOpportunityTypeLabel,
  getContractTypeLabel,
  getWorkRhythmLabel,
  getLocationTypeLabel,
  getCompensationFrequencyLabel,
  getOpportunityStatusLabel,
  ApplicationQuestion,
  Visibility,
} from '../../../../src/types/models';
import { opportunityService, UpdateOpportunityData, imageService } from '../../../../src/services';
import { useAlert } from '../../../../src/contexts/AlertContext';
import { useI18n } from '../../../../src/contexts/I18nContext';
import { FormTextArea } from '../../../../src/components/forms/FormTextArea';
import { uploadFile } from '../../../../src/services/fileService';
import { getFullImageUrl } from '../../../../src/utils/image';
import { formatNumberNoTrailingZeros } from '../../../../src/utils/number';

type Step = 'info' | 'lieu' | 'conditions' | 'media' | 'preview';

const STEPS: Step[] = ['info', 'lieu', 'conditions', 'media', 'preview'];

const STEP_TITLE_KEYS: Record<Step, string> = {
  info: 'opportunity.form.steps.info',
  lieu: 'opportunity.form.steps.location',
  conditions: 'opportunity.form.steps.conditions',
  media: 'opportunity.form.steps.media',
  preview: 'opportunity.form.steps.preview',
};

// Constants for limits
const MAX_SECTORS = 5;
const MAX_IMAGES = 5;
const MAX_ATTACHMENTS = 3;
const MAX_QUESTIONS = 5;
const MAX_QUESTION_LENGTH = 200;
const MAX_ATTACHMENT_SIZE_MB = 20;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

// Icons for location types
const LOCATION_TYPE_ICONS: Record<LocationType, React.ComponentType<any>> = {
  ON_SITE: Building2,
  HYBRID: Home,
  REMOTE: Laptop,
};

export default function EditOpportunityScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const alerts = useAlert();
  const { showToast } = useToast();

  // Resolve getter functions to data arrays
  const opportunityTypeData = getOpportunityTypeData();
  const contractTypeData = getContractTypeData();
  const workRhythmData = getWorkRhythmData();
  const locationTypeData = getLocationTypeData();
  const compensationFrequencyData = getCompensationFrequencyData();
  const opportunityVisibilityData = getOpportunityVisibilityData();

  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<Step>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state - Info
  const [title, setTitle] = useState('');
  const [opportunityType, setOpportunityType] = useState<OpportunityType | null>(null);
  const [summary, setSummary] = useState('');
  const [requirements, setRequirements] = useState('');
  const [niceToHave, setNiceToHave] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);

  // Form state - Lieu
  const [locationType, setLocationType] = useState<LocationType | null>(null);
  const [country, setCountry] = useState('CI');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');

  // Refs for auto-scroll to selected country
  const countryScrollRef = useRef<ScrollView>(null);
  const COUNTRY_CHIP_WIDTH = 80;

  // Form state - Conditions
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  const [contractType, setContractType] = useState<ContractType | null>(null);
  const [workRhythm, setWorkRhythm] = useState<WorkRhythm | null>(null);
  const [compensationMin, setCompensationMin] = useState('');
  const [compensationMax, setCompensationMax] = useState('');
  const [currency, setCurrency] = useState('XOF');
  const [compensationFrequency, setCompensationFrequency] = useState<CompensationFrequency | null>(null);
  const [duration, setDuration] = useState('');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);

  // Form state - Candidature
  const [cvRequired, setCvRequired] = useState(false);
  const [applicationQuestions, setApplicationQuestions] = useState<ApplicationQuestion[]>([]);

  // Form state - Media
  const [images, setImages] = useState<ImageItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Status management
  const [status, setStatus] = useState<OpportunityStatus>('DRAFT');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // AI Generation
  const [isGenerating, setIsGenerating] = useState(false);
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

  // Load existing data
  useEffect(() => {
    loadOpportunity();
  }, [id]);

  const loadOpportunity = async () => {
    setIsLoading(true);
    try {
      const response = await opportunityService.getById(id!);
      const opp = response.data;

      setTitle(opp.title || '');
      setOpportunityType(opp.type || null);
      setSummary(opp.summary || '');
      setRequirements(opp.requirements || '');
      setNiceToHave(opp.nice_to_have || '');
      setSelectedSectors(opp.sectors || []);
      setLocationType(opp.location_type || null);
      setContractType(opp.contract_type || null);
      setWorkRhythm(opp.work_rhythm || null);
      setCompensationMin(opp.compensation_min ? Math.floor(opp.compensation_min).toString() : '');
      setCompensationMax(opp.compensation_max ? Math.floor(opp.compensation_max).toString() : '');
      setCurrency(opp.currency || 'XOF');
      setCompensationFrequency(opp.compensation_frequency || null);
      setDuration(opp.duration || '');
      setStatus(opp.status || 'DRAFT');
      setVisibility(((opp as any).visibility as Visibility) || 'PUBLIC');

      // Set organization ID for AI generation
      if ((opp as any).organizations && (opp as any).organizations.length > 0) {
        setOrganizationId((opp as any).organizations[0].id);
      }

      if (opp.locations && opp.locations.length > 0) {
        const loc = opp.locations[0];
        setCountry(loc.country || 'CI');
        setRegion(loc.region || '');
        setCity(loc.city || '');
      }

      if (opp.deadline) setDeadline(new Date(opp.deadline));
      if (opp.start_date) setStartDate(new Date(opp.start_date));

      // Load images
      if (opp.images && opp.images.length > 0) {
        setImages(opp.images.map((uri, idx) => ({ id: String(idx + 1), uri })));
      } else if (opp.cover_image_url) {
        setImages([{ id: '1', uri: opp.cover_image_url }]);
      }

      // Load attachments
      if (opp.attachments && opp.attachments.length > 0) {
        setAttachments(opp.attachments.map((att, idx) => ({
          id: String(idx + 1),
          name: att.name,
          uri: att.url,
          type: att.type || 'application/octet-stream',
          size: att.size,
        })));
      }

      // Load candidature settings
      setCvRequired(opp.cv_required || false);
      if (opp.application_questions && Array.isArray(opp.application_questions)) {
        setApplicationQuestions(opp.application_questions.map((q: any, idx: number) => ({
          id: q.id || String(idx + 1),
          question: q.question || '',
          required: q.required || false,
          max_length: q.max_length || MAX_QUESTION_LENGTH,
        })));
      }
    } catch (error: any) {
      await alerts.error(t('common.error'), error.error || t('opportunity.form.loadError'));
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    if (images.length >= MAX_IMAGES) {
      showToast({ type: 'warning', title: t('common.limitReached'), message: t('opportunity.form.maxImages', { count: MAX_IMAGES }) });
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
      showToast({ type: 'error', title: t('common.error'), message: t('opportunity.form.imageSelectionError') });
    }
  };

  const removeImage = (imgId: string) => {
    setImages(images.filter((img) => img.id !== imgId));
  };

  // Question handlers
  const addQuestion = () => {
    if (applicationQuestions.length >= MAX_QUESTIONS) {
      showToast({ type: 'warning', title: t('common.limitReached'), message: t('opportunity.form.maxQuestions', { count: MAX_QUESTIONS }) });
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

  const updateQuestion = (qId: string, updates: Partial<ApplicationQuestion>) => {
    setApplicationQuestions(applicationQuestions.map((q) =>
      q.id === qId ? { ...q, ...updates } : q
    ));
  };

  const removeQuestion = (qId: string) => {
    setApplicationQuestions(applicationQuestions.filter((q) => q.id !== qId));
  };

  const pickDocument = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      showToast({ type: 'warning', title: t('common.limitReached'), message: t('opportunity.form.maxAttachments', { count: MAX_ATTACHMENTS }) });
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
          showToast({ type: 'warning', title: t('common.fileTooLarge'), message: t('opportunity.form.fileTooLargeMessage', { size: MAX_ATTACHMENT_SIZE_MB }) });
          return;
        }

        const newAttachment: Attachment = {
          id: Date.now().toString(),
          name: doc.name,
          uri: doc.uri,
          type: doc.mimeType || 'application/pdf',
          size: fileSize,
        };
        setAttachments([...attachments, newAttachment]);
      }
    } catch (error) {
      showToast({ type: 'error', title: t('common.error'), message: t('opportunity.form.documentSelectionError') });
    }
  };

  const removeAttachment = (attId: string) => {
    setAttachments(attachments.filter((a) => a.id !== attId));
  };

  // Handle sector selection (multi-select with max 5)
  const toggleSector = (sectorId: string) => {
    if (selectedSectors.includes(sectorId)) {
      setSelectedSectors(selectedSectors.filter((s) => s !== sectorId));
    } else if (selectedSectors.length < MAX_SECTORS) {
      setSelectedSectors([...selectedSectors, sectorId]);
    } else {
      showToast({ type: 'warning', title: t('common.limitReached'), message: t('opportunity.form.maxSectors', { count: MAX_SECTORS }) });
    }
  };

  // Check if AI generation is possible
  const canGenerate = title.trim().length >= 3 && opportunityType !== null && organizationId !== null;

  // Handle AI generation
  const handleGenerate = async () => {
    if (!canGenerate || isGenerating) return;

    setIsGenerating(true);
    try {
      const response = await opportunityService.generate({
        title: title.trim(),
        type: opportunityType!,
        organization_id: organizationId!,
      });

      if (response.success && response.data) {
        const data = response.data;

        // Apply generated data to form fields
        if (data.suggested_title) setTitle(data.suggested_title);
        if (data.summary) setSummary(data.summary);
        if (data.requirements) setRequirements(data.requirements);
        if (data.nice_to_have) setNiceToHave(data.nice_to_have);
        if (data.contract_type) setContractType(data.contract_type as ContractType);
        if (data.work_rhythm) setWorkRhythm(data.work_rhythm as WorkRhythm);

        // Sectors - apply 2-5 sectors
        if (data.sectors && data.sectors.length > 0) {
          setSelectedSectors(data.sectors.slice(0, MAX_SECTORS));
        }

        if (data.compensation_min) setCompensationMin(Math.floor(data.compensation_min).toString());
        if (data.compensation_max) setCompensationMax(Math.floor(data.compensation_max).toString());
        if (data.currency) setCurrency(data.currency);
        if (data.compensation_frequency) setCompensationFrequency(data.compensation_frequency as CompensationFrequency);
        if (data.location_type) setLocationType(data.location_type as LocationType);
        if (data.duration) setDuration(data.duration);

        // Deadline - calculate date from deadline_days
        if (data.deadline_days && data.deadline_days > 0) {
          const deadlineDate = new Date();
          deadlineDate.setDate(deadlineDate.getDate() + data.deadline_days);
          setDeadline(deadlineDate);
        }
      }
    } catch (error: any) {
      if (__DEV__) console.error('Error generating opportunity:', error);
      showToast({
        type: 'error',
        title: t('common.generationErrorTitle'),
        message: error?.error || t('common.generationError'),
      });
    } finally {
      setIsGenerating(false);
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

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      // Helper function to check if a URI is a remote URL (full URL or relative server path)
      const isRemoteUrl = (uri: string): boolean => {
        return uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('/uploads/');
      };

      // Separate local files and remote/server images
      const localImages = images.filter(img => !isRemoteUrl(img.uri));
      const remoteImages = images.filter(img => isRemoteUrl(img.uri)).map(img => img.uri);

      // Upload local images
      const uploadedImageUrls: string[] = [];
      for (const localImg of localImages) {
        try {
          const uploaded = await imageService.uploadImage(
            { uri: localImg.uri, width: 800, height: 600 },
            'illustration',
            'opportunity'
          );
          uploadedImageUrls.push(uploaded.url);
        } catch (uploadError) {
          if (__DEV__) console.error('Error uploading image:', uploadError);
          await alerts.error(t('common.error'), t('opportunity.form.uploadImageError'));
          setIsSubmitting(false);
          return;
        }
      }

      // Combine remote and newly uploaded images
      const allImages = [...remoteImages, ...uploadedImageUrls];
      const validCoverImage = allImages.length > 0 ? allImages[0] : undefined;

      const localAttachments = attachments.filter(att => !isRemoteUrl(att.uri));
      const remoteAttachments = attachments.filter(att => isRemoteUrl(att.uri));
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
        } catch (uploadError) {
          if (__DEV__) console.error('Error uploading attachment:', uploadError);
          await alerts.error(t('common.error'), t('opportunity.form.uploadAttachmentError'));
          setIsSubmitting(false);
          return;
        }
      }

      const allAttachments = [...remoteAttachments, ...uploadedAttachments];
      const validAttachments = allAttachments.map(att => ({
        name: att.name,
        url: att.uri,
        type: att.type || undefined,
        size: att.size || undefined,
      }));

      const data: UpdateOpportunityData = {
        title,
        type: opportunityType || undefined,
        contract_type: contractType || undefined,
        work_rhythm: workRhythm || undefined,
        summary: summary || undefined,
        requirements: requirements || undefined,
        nice_to_have: niceToHave || undefined,
        sectors: selectedSectors,
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
        cover_image_url: validCoverImage,
        images: allImages.length > 0 ? allImages : undefined,
        attachments: validAttachments.length > 0 ? validAttachments : undefined,
        cv_required: cvRequired,
        application_questions: applicationQuestions.filter(q => q.question.trim().length > 0),
        status,
        visibility,
      };
      await opportunityService.update(id!, data);
      await alerts.showAlert({
        type: 'success',
        title: t('opportunity.form.updatedTitle'),
        message: t('opportunity.form.updatedMessage'),
        buttons: [{ text: 'OK', onPress: () => router.back() }],
      });
    } catch (error: any) {
      await alerts.error(t('common.error'), error.error || t('opportunity.form.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    (async () => {
      const confirmed = await alerts.confirm(
        t('common.deleteTitle'),
        t('opportunity.form.deleteConfirm', { title })
      );
      if (!confirmed) return;
      setIsSubmitting(true);
      try {
        await opportunityService.delete(id!);
        await alerts.showAlert({
          type: 'success',
          title: t('opportunity.form.deletedTitle'),
          message: t('opportunity.form.deletedMessage'),
          buttons: [{ text: 'OK', onPress: () => router.back() }],
        });
      } catch (error: any) {
        await alerts.error(t('common.error'), error.error || t('opportunity.form.deleteError'));
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'info': return title.trim().length >= 5 && opportunityType !== null;
      case 'lieu': return locationType !== null && (locationType === 'REMOTE' || country.length > 0);
      case 'conditions': return contractType !== null;
      default: return true;
    }
  };

  const formatDate = (date: Date | null) => date ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : t('community.form.notDefinedFeminine');

  const formatNumber = (num: string | number | null | undefined): string => {
    if (!num) return '';
    const numStr = typeof num === 'number' ? num.toString() : num;
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const formatFileSize = (bytes: number | undefined | null): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${formatNumberNoTrailingZeros(bytes / 1024, 1)} KB`;
    return `${formatNumberNoTrailingZeros(bytes / (1024 * 1024), 1)} MB`;
  };

  const getLocationLabel = () => {
    if (!locationType) return t('community.form.notDefined');
    const locationLabel = getLocationTypeLabel(locationType);
    if (!locationLabel) return t('community.form.notDefined');
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

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <LoadingShimmer variant="fullPage" />
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
            <Text style={[styles.stepLabel, { color: colors.gray500 }, isCurrent && { color: colors.primary, fontWeight: TYPOGRAPHY.fontWeight.semibold }]}>{t(STEP_TITLE_KEYS[step])}</Text>
          </View>
        );
      })}
    </View>
  );

  const renderInfoStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Briefcase size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{t('opportunity.form.steps.info')}</Text>
      </View>
      <View style={styles.formFields}>
        <Input label={t('opportunity.form.jobTitleLabel')} placeholder={t('opportunity.form.jobTitlePlaceholder')} value={title} onChangeText={setTitle} />

        {/* Type d'opportunite */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('opportunity.form.opportunityTypeLabel')}</Text>
          <View style={styles.tagsContainer}>
            {opportunityTypeData.map((type: { id: OpportunityType; label: string }) => {
              const isSelected = opportunityType === type.id;
              return (
                <Chip
                  key={type.id}
                  label={type.label}
                  selected={isSelected}
                  leftIcon={isSelected ? <Check size={14} color={colors.primary} strokeWidth={2.5} /> : undefined}
                  onPress={() => setOpportunityType(type.id)}
                  style={styles.selectableTag}
                  textStyle={styles.selectableTagText}
                />
              );
            })}
          </View>
        </View>

        {/* Bouton Suggérer - Visible quand title >= 3 chars et type sélectionné */}
        {canGenerate && (
          <View style={styles.generateButtonContainer}>
            <Button
              title={isGenerating ? t('community.form.suggesting') : t('community.form.suggest')}
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
            {t('community.industries')} ({selectedSectors.length}/{MAX_SECTORS})
          </Text>
          <View style={styles.tagsContainer}>
            {SECTOR_DATA.slice(0, 15).map((sector) => {
              const isSelected = selectedSectors.includes(sector.id);
              return (
                <Chip
                  key={sector.id}
                  label={t(sector.labelKey)}
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
          label={t('opportunity.description')}
          placeholder={t('opportunity.form.summaryPlaceholder')}
          value={summary}
          onChangeText={setSummary}
          rows={4}
          maxLength={1000}
        />

        <FormTextArea
          label={t('opportunity.requirements')}
          placeholder={t('opportunity.form.requirementsPlaceholder')}
          value={requirements}
          onChangeText={setRequirements}
          rows={3}
          maxLength={500}
        />

        <FormTextArea
          label={t('opportunity.niceToHave')}
          placeholder={t('opportunity.form.niceToHavePlaceholder')}
          value={niceToHave}
          onChangeText={setNiceToHave}
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
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{t('opportunity.form.steps.location')}</Text>
      </View>
      <View style={styles.formFields}>
        {/* Mode de travail - 3 options horizontales avec icones */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('opportunity.form.workModeLabel')}</Text>
          <View style={styles.locationTypeRow}>
            {locationTypeData.map((type: { id: LocationType; label: string; description: string }) => {
              const isSelected = locationType === type.id;
              const IconComponent = LOCATION_TYPE_ICONS[type.id];
              return (
                <SelectCard
                  key={type.id}
                  selected={isSelected}
                  onPress={() => setLocationType(type.id)}
                  style={styles.locationTypeCard}
                  accessibilityLabel={type.label}
                >
                  <IconComponent size={24} color={isSelected ? colors.primary : colors.gray500} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.locationTypeLabel, { color: colors.textPrimary }, isSelected && { color: colors.primary, fontWeight: TYPOGRAPHY.fontWeight.semibold }]}>{type.label}</Text>
                </SelectCard>
              );
            })}
          </View>
        </View>

        {/* Localisation (seulement si pas "A distance") */}
        {locationType && locationType !== 'REMOTE' && (
          <>
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('auth.createProfile.country')} *</Text>
	              <ScrollView ref={countryScrollRef} horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={styles.horizontalScrollContent}>
	                {COUNTRIES.map((c) => {
	                  const isSelected = country === c.id;
	                  return (
	                    <Chip
	                      key={c.id}
	                      label={c.label}
	                      selected={isSelected}
	                      onPress={() => { setCountry(c.id); setRegion(''); setCity(''); }}
	                      style={[
	                        styles.optionChip,
	                        { backgroundColor: colors.gray100, borderColor: colors.gray200 },
	                        isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
	                      ]}
	                      textStyle={[styles.optionChipText, { color: isSelected ? colors.textOnPrimary : colors.gray700 }]}
	                    />
	                  );
	                })}
	              </ScrollView>
	            </View>

            {availableRegions.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('auth.createProfile.region')}</Text>
	                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={styles.horizontalScrollContent}>
	                  {availableRegions.map((r) => {
	                    const isSelected = region === r.id;
	                    return (
	                      <Chip
	                        key={r.id}
	                        label={r.label}
	                        selected={isSelected}
	                        onPress={() => { setRegion(r.id); setCity(''); }}
	                        style={[
	                          styles.optionChip,
	                          { backgroundColor: colors.gray100, borderColor: colors.gray200 },
	                          isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
	                        ]}
	                        textStyle={[styles.optionChipText, { color: isSelected ? colors.textOnPrimary : colors.gray700 }]}
	                      />
	                    );
	                  })}
	                </ScrollView>
	              </View>
	            )}

            {availableCities.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('auth.createProfile.city')}</Text>
	                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={styles.horizontalScrollContent}>
	                  {availableCities.map((c) => {
	                    const isSelected = city === c.id;
	                    return (
	                      <Chip
	                        key={c.id}
	                        label={c.label}
	                        selected={isSelected}
	                        onPress={() => setCity(c.id)}
	                        style={[
	                          styles.optionChip,
	                          { backgroundColor: colors.gray100, borderColor: colors.gray200 },
	                          isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
	                        ]}
	                        textStyle={[styles.optionChipText, { color: isSelected ? colors.textOnPrimary : colors.gray700 }]}
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
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{t('opportunity.form.steps.conditions')}</Text>
      </View>
      <View style={styles.formFields}>
        {/* Type de contrat */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('opportunity.form.contractTypeLabel')}</Text>
          <View style={styles.tagsContainer}>
            {contractTypeData.map((type: { id: ContractType; label: string }) => {
              const isSelected = contractType === type.id;
              return (
                <Chip
                  key={type.id}
                  label={type.label}
                  selected={isSelected}
                  leftIcon={isSelected ? <Check size={14} color={colors.primary} strokeWidth={2.5} /> : undefined}
                  onPress={() => setContractType(type.id)}
                  style={styles.selectableTag}
                  textStyle={styles.selectableTagText}
                />
              );
            })}
          </View>
        </View>

        {/* Rythme de travail */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('opportunity.form.workRhythmLabel')}</Text>
          <View style={styles.tagsContainer}>
            {workRhythmData.map((rhythm: { id: WorkRhythm; label: string; description: string }) => {
              const isSelected = workRhythm === rhythm.id;
              return (
                <Chip
                  key={rhythm.id}
                  label={rhythm.label}
                  selected={isSelected}
                  leftIcon={isSelected ? <Check size={14} color={colors.primary} strokeWidth={2.5} /> : undefined}
                  onPress={() => setWorkRhythm(isSelected ? null : rhythm.id)}
                  style={styles.selectableTag}
                  textStyle={styles.selectableTagText}
                />
              );
            })}
          </View>
        </View>

        {/* Durée du contrat - Input libre */}
        <Input
          label={t('opportunity.duration')}
          placeholder={t('opportunity.form.durationPlaceholder')}
          value={duration}
          onChangeText={setDuration}
        />

        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        {/* Remuneration */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('opportunity.salary')}</Text>
          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <Input label={t('opportunity.form.minLabel')} placeholder={t('opportunity.form.minPlaceholder')} value={compensationMin} onChangeText={setCompensationMin} keyboardType="numeric" />
            </View>
            <View style={styles.halfField}>
              <Input label={t('opportunity.form.maxLabel')} placeholder={t('opportunity.form.maxPlaceholder')} value={compensationMax} onChangeText={setCompensationMax} keyboardType="numeric" />
            </View>
          </View>
        </View>

        <Input
          label={t('opportunity.form.currencyLabel')}
          placeholder={t('opportunity.form.currencyPlaceholder')}
          value={currency}
          onChangeText={setCurrency}
          maxLength={10}
          autoCapitalize="characters"
        />

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('opportunity.form.frequencyLabel')}</Text>
          <View style={styles.tagsContainer}>
            {compensationFrequencyData.map((freq: { id: CompensationFrequency; label: string }) => {
              const isSelected = compensationFrequency === freq.id;
              return (
                <Chip
                  key={freq.id}
                  label={freq.label}
                  selected={isSelected}
                  leftIcon={isSelected ? <Check size={14} color={colors.primary} strokeWidth={2.5} /> : undefined}
                  onPress={() => setCompensationFrequency(freq.id)}
                  style={styles.selectableTag}
                  textStyle={styles.selectableTagText}
                />
              );
            })}
          </View>
        </View>

        {/* Visibility */}
        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('opportunity.form.visibilityLabel')}</Text>
          <View style={styles.locationTypeRow}>
            {opportunityVisibilityData.map((type: { id: Visibility; label: string; description: string }) => {
              const isSelected = visibility === type.id;
              const IconComponent = type.id === 'PUBLIC' ? Eye : type.id === 'PRIVATE' ? Lock : Eye;
              return (
                <SelectCard
                  key={type.id}
                  selected={isSelected}
                  onPress={() => setVisibility(type.id)}
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
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('opportunity.deadline')}</Text>
            <Button
              title={deadline ? formatDate(deadline) : t('common.select')}
              onPress={() => setShowDeadlinePicker(true)}
              variant="outline"
              icon={<Calendar size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />}
              style={[
                styles.dateButton,
                { backgroundColor: colors.gray50, borderColor: colors.gray200, justifyContent: 'flex-start' },
              ]}
              textStyle={[styles.dateButtonText, { color: deadline ? colors.textPrimary : colors.gray500 }]}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('opportunity.startDate')}</Text>
            <Button
              title={startDate ? formatDate(startDate) : t('common.select')}
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
              setShowDeadlinePicker(Platform.OS === 'ios');
              if (selectedDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (selectedDate <= today) {
                  showToast({ type: 'warning', title: t('opportunity.form.invalidDateTitle'), message: t('opportunity.form.deadlineMustBeAfterToday') });
                  return;
                }
                setDeadline(selectedDate);
                if (startDate && startDate <= selectedDate) {
                  setStartDate(null);
                }
              }
            }}
            minimumDate={new Date(Date.now() + 24 * 60 * 60 * 1000)}
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
              setShowStartDatePicker(Platform.OS === 'ios');
              if (selectedDate) {
                if (deadline && selectedDate <= deadline) {
                  showToast({ type: 'warning', title: t('opportunity.form.invalidDateTitle'), message: t('opportunity.form.startDateMustBeAfterDeadline') });
                  return;
                }
                setStartDate(selectedDate);
              }
            }}
            minimumDate={deadline ? new Date(deadline.getTime() + 24 * 60 * 60 * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000)}
          />
        )}

        {/* Separator before candidature settings */}
        <View style={[styles.sectionSeparator, { backgroundColor: colors.gray200 }]} />

        {/* Candidature Settings Section */}
        <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('opportunity.form.applicationSettings')}</Text>

        {/* CV Required Toggle */}
        <View style={[styles.toggleContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
          <View style={styles.toggleInfo}>
            <ClipboardList size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            <View style={styles.toggleTextContainer}>
              <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>{t('opportunity.form.cvRequired')}</Text>
              <Text style={[styles.toggleDescription, { color: colors.gray500 }]}>
                {t('opportunity.form.cvRequiredHint')}
              </Text>
            </View>
          </View>
          <Toggle
            value={cvRequired}
            onValueChange={setCvRequired}
          />
        </View>

        {/* Complementary Questions */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
            {t('opportunity.form.additionalQuestionsCount', { count: applicationQuestions.length, max: MAX_QUESTIONS })}
          </Text>
          <Text style={[styles.fieldHint, { color: colors.gray500 }]}>
            {t('opportunity.form.askCandidatesQuestions', { max: MAX_QUESTION_LENGTH })}
          </Text>

          {/* Questions List */}
          {applicationQuestions.map((question, index) => (
            <View
              key={question.id}
              style={[styles.questionItem, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
            >
              <View style={styles.questionHeader}>
                <Text style={[styles.questionNumber, { color: colors.primary }]}>
                  {t('opportunity.form.questionN', { index: index + 1 })}
                </Text>
                <IconButton
                  onPress={() => removeQuestion(question.id)}
                  icon={<Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />}
                  accessibilityLabel={t('community.form.removeQuestion')}
                  size="sm"
                  variant="ghost"
                />
              </View>

              <FormTextArea
                placeholder={t('community.form.questionPlaceholder')}
                value={question.question}
                onChangeText={(text) => updateQuestion(question.id, { question: text })}
                maxLength={MAX_QUESTION_LENGTH}
                rows={2}
                showCounter
                containerStyle={{ marginTop: SPACING.sm }}
              />

              <View style={styles.questionFooter}>
                <View style={styles.requiredToggle}>
                  <Text style={[styles.requiredLabel, { color: colors.gray600 }]}>{t('common.required')}</Text>
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
              title={t('community.form.addQuestion')}
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
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{t('opportunity.form.steps.media')}</Text>
      </View>
      <View style={styles.formFields}>
        {/* Images d'illustration - Max 5 */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700, textAlign: 'center' }]}>
            {t('community.form.illustrationImages')} ({images.length}/{MAX_IMAGES})
          </Text>
          <Text style={[styles.fieldHint, { color: colors.gray500, textAlign: 'center' }]}>
            {t('opportunity.form.imagesFormatHint', { max: MAX_IMAGES })}
          </Text>

          {/* Zone d'upload centrée et full width */}
          <View style={styles.imageUploadContainer}>
            {/* Bouton ajouter image si pas encore 5 */}
            {images.length < MAX_IMAGES && (
              <Button
                title={t('community.form.addImage')}
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
                    <Image source={{ uri: getFullImageUrl(image.uri) || image.uri }} style={styles.imageItem} />
                    <IconButton
                      onPress={() => removeImage(image.id)}
                      icon={<X size={14} color={colors.textOnPrimary} strokeWidth={2.5} />}
                      accessibilityLabel={t('community.form.removeImage')}
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

        {/* Pieces jointes - Max 3 x 20MB */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
            {t('opportunity.attachments')} ({attachments.length}/{MAX_ATTACHMENTS})
          </Text>
          <Text style={[styles.fieldHint, { color: colors.gray500 }]}>
            {t('opportunity.form.attachmentHint', { size: MAX_ATTACHMENT_SIZE_MB })}
          </Text>

          {attachments.map((attachment) => (
            <View key={attachment.id} style={[styles.attachmentItem, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
              <FileText size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View style={styles.attachmentInfo}>
                <Text style={[styles.attachmentName, { color: colors.textPrimary }]} numberOfLines={1}>{attachment.name}</Text>
                {attachment.size && <Text style={[styles.attachmentSize, { color: colors.gray500 }]}>{formatNumberNoTrailingZeros(attachment.size / (1024 * 1024), 1)} MB</Text>}
              </View>
              <IconButton
                onPress={() => removeAttachment(attachment.id)}
                icon={<X size={18} color={colors.gray500} strokeWidth={ICON.strokeWidth} />}
                accessibilityLabel={t('opportunity.form.removeAttachment')}
                size="sm"
                variant="ghost"
              />
            </View>
          ))}

          {attachments.length < MAX_ATTACHMENTS && (
            <Button
              title={t('opportunity.form.addDocument')}
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

  const handleImageScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / (SCREEN_WIDTH - SPACING.lg * 2));
    setCurrentImageIndex(slideIndex);
  };

  const toggleStatus = () => {
    if (status === 'DRAFT') {
      setStatus('OPEN');
    } else if (status === 'OPEN') {
      setStatus('PAUSED');
    } else if (status === 'PAUSED') {
      setStatus('OPEN');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'OPEN': return colors.success;
      case 'PAUSED': return colors.warning;
      case 'FILLED': return colors.info;
      case 'EXPIRED': return colors.error;
      default: return colors.gray500;
    }
  };

  const renderPreviewStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Eye size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{t('opportunity.form.steps.preview')}</Text>
        <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
          {t('opportunity.form.reviewBeforeSave')}
        </Text>
      </View>

      {/* Status Management Card */}
      <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
        <View style={styles.statusHeader}>
          <View>
            <Text style={[styles.statusLabel, { color: colors.gray600 }]}>{t('opportunity.form.offerStatus')}</Text>
            <View style={styles.statusBadgeContainer}>
              <View style={[styles.statusBadge, { backgroundColor: withOpacity(getStatusColor(), OPACITY[20]) }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                <Text style={[styles.statusBadgeText, { color: getStatusColor() }]}>
                  {getOpportunityStatusLabel(status)}
                </Text>
              </View>
            </View>
          </View>
          {status !== 'FILLED' && status !== 'EXPIRED' && (
            <Toggle
              value={status === 'OPEN'}
              onValueChange={(value) => setStatus(value ? 'OPEN' : (status === 'OPEN' ? 'PAUSED' : 'DRAFT'))}
              color={colors.success}
            />
          )}
        </View>
        <Text style={[styles.statusHint, { color: colors.gray500 }]}>
          {status === 'DRAFT' ? t('opportunity.form.statusHintDraft') :
            status === 'OPEN' ? t('opportunity.form.statusHintOpen') :
              status === 'PAUSED' ? t('opportunity.form.statusHintPaused') :
                status === 'FILLED' ? t('opportunity.form.statusHintFilled') :
                  status === 'EXPIRED' ? t('opportunity.form.statusHintExpired') : ''}
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
            <Text style={[styles.previewNoImageText, { color: colors.gray500 }]}>{t('community.form.noImage')}</Text>
          </View>
        )}

        {/* Title & Type */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{title || t('opportunity.form.untitled')}</Text>
          <View style={styles.previewTags}>
            {opportunityType ? (
              <View style={[styles.previewTag, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                <Text style={[styles.previewTagText, { color: colors.primary }]}>{getOpportunityTypeLabel(opportunityType)}</Text>
              </View>
            ) : (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray500 }]}>{t('community.form.typeNotDefined')}</Text>
              </View>
            )}
            {contractType ? (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray700 }]}>{getContractTypeLabel(contractType)}</Text>
              </View>
            ) : (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray500 }]}>{t('opportunity.form.contractNotDefined')}</Text>
              </View>
            )}
            {workRhythm && (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray700 }]}>{getWorkRhythmLabel(workRhythm)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Secteurs */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>{t('community.industries')}</Text>
          {selectedSectors.length > 0 ? (
            <View style={styles.previewTags}>
              {selectedSectors.map((sectorId) => {
                const sector = SECTOR_DATA.find((s) => s.id === sectorId);
                return (
                  <View key={sectorId} style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                    <Text style={[styles.previewTagText, { color: colors.gray700 }]}>{sector ? t(sector.labelKey) : sectorId}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.previewText, { color: colors.gray500 }]}>{t('community.form.noSectorSelected')}</Text>
          )}
        </View>

        {/* Info Grid */}
        <View style={styles.previewGrid}>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>{t('opportunity.form.workModeLabelNoStar')}</Text>
            <Text style={[styles.previewValue, { color: locationType ? colors.textPrimary : colors.gray400 }]}>{getLocationLabel()}</Text>
          </View>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>{t('opportunity.form.workRhythmLabel')}</Text>
            <Text style={[styles.previewValue, { color: workRhythm ? colors.textPrimary : colors.gray400 }]}>{workRhythm ? getWorkRhythmLabel(workRhythm) : t('community.form.notDefined')}</Text>
          </View>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>{t('opportunity.duration')}</Text>
            <Text style={[styles.previewValue, { color: duration.trim() ? colors.textPrimary : colors.gray400 }]}>{duration.trim() || t('community.form.notDefinedFeminine')}</Text>
          </View>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>{t('opportunity.deadline')}</Text>
            <Text style={[styles.previewValue, { color: deadline ? colors.textPrimary : colors.gray400 }]}>{formatDate(deadline)}</Text>
          </View>
        </View>

        {/* Compensation */}
        <View style={[styles.previewSection, { backgroundColor: colors.gray50 }]}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
            {t('opportunity.salary')}{compensationFrequency ? ` / ${getCompensationFrequencyLabel(compensationFrequency)}` : ''}
          </Text>
          <View style={{ marginTop: SPACING.xs }}>
            <Text style={[styles.previewText, { color: colors.textPrimary, marginBottom: SPACING.xs }]}>
              {t('opportunity.form.min')}: {compensationMin ? `${formatNumber(compensationMin)} ${getCurrencySymbol(currency)}` : t('community.form.notDefinedFeminine')}
            </Text>
            <Text style={[styles.previewText, { color: colors.textPrimary }]}>
              {t('opportunity.form.max')}: {compensationMax ? `${formatNumber(compensationMax)} ${getCurrencySymbol(currency)}` : t('community.form.notDefinedFeminine')}
            </Text>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>{t('opportunity.form.dates')}</Text>
          <View style={styles.previewDates}>
            <View>
              <Text style={[styles.previewLabel, { color: colors.gray500 }]}>{t('opportunity.deadline')}</Text>
              <Text style={[styles.previewValue, { color: deadline ? colors.textPrimary : colors.gray400 }]}>{formatDate(deadline)}</Text>
            </View>
            <View>
              <Text style={[styles.previewLabel, { color: colors.gray500 }]}>{t('opportunity.startDate')}</Text>
              <Text style={[styles.previewValue, { color: startDate ? colors.textPrimary : colors.gray400 }]}>{formatDate(startDate)}</Text>
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>{t('opportunity.description')}</Text>
          {summary ? <Text style={[styles.previewText, { color: colors.textSecondary }]}>{summary}</Text> : <Text style={[styles.previewText, { color: colors.gray400 }]}>{t('community.form.noDescription')}</Text>}
        </View>

        {/* Prérequis */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>{t('opportunity.requirements')}</Text>
          {requirements ? <Text style={[styles.previewText, { color: colors.textSecondary }]}>{requirements}</Text> : <Text style={[styles.previewText, { color: colors.gray400 }]}>{t('opportunity.form.noRequirements')}</Text>}
        </View>

        {/* Atouts appréciés */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>{t('opportunity.niceToHave')}</Text>
          {niceToHave ? <Text style={[styles.previewText, { color: colors.textSecondary }]}>{niceToHave}</Text> : <Text style={[styles.previewText, { color: colors.gray400 }]}>{t('opportunity.form.noNiceToHave')}</Text>}
        </View>

        {/* Paramètres de candidature */}
        <View style={[styles.previewSection, { backgroundColor: colors.gray50 }]}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>{t('opportunity.form.applicationSettings')}</Text>
          <View style={styles.previewApplicationSettings}>
            <View style={styles.previewSettingRow}>
              <Text style={[styles.previewLabel, { color: colors.gray500 }]}>{t('opportunity.form.cvRequired')}</Text>
              <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
                {cvRequired ? t('common.yes') : t('common.no')}
              </Text>
            </View>
            <View style={styles.previewSettingRow}>
              <Text style={[styles.previewLabel, { color: colors.gray500 }]}>{t('space.form.additionalQuestions')}</Text>
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
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>{t('opportunity.attachments')}</Text>
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
            <Text style={[styles.previewText, { color: colors.gray400 }]}>{t('opportunity.form.noAttachment')}</Text>
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
            <Button
              title={t('common.back')}
              onPress={handleBack}
              disabled={isSubmitting}
              variant="outline"
              icon={<ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />}
              style={[styles.backStepButton, { borderColor: colors.gray300 }]}
              textStyle={[styles.backStepButtonText, { color: colors.gray700 }]}
            />
            <IconButton
              onPress={handleDelete}
              disabled={isSubmitting}
              icon={<Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />}
              accessibilityLabel={t('opportunity.form.deleteA11y')}
              variant="outline"
              style={[styles.deleteButton, { borderColor: colors.error }]}
            />
            <View style={styles.saveButtonContainer}>
              <Button title={t('common.save')} onPress={handleSave} disabled={isSubmitting} fullWidth />
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
              title={t('common.back')}
              onPress={handleBack}
              variant="outline"
              icon={<ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />}
              style={[styles.backStepButton, { borderColor: colors.gray300 }]}
              textStyle={[styles.backStepButtonText, { color: colors.gray700 }]}
            />
          )}
          <View style={[styles.continueButton, !isFirstStep && { flex: 1 }]}>
            <Button title={t('common.next')} onPress={handleNext} disabled={!canProceed()} fullWidth icon={<ChevronRight size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />} iconPosition="right" />
          </View>
        </View>
      </View>
    );
  };

  return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton
          onPress={handleBack}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel={t('common.back')}
          style={styles.backButton}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('opportunity.form.editTitle')}</Text>
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
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: TYPOGRAPHY.fontSize.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  headerSpacer: { width: 40 },
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
  fieldHint: { fontSize: TYPOGRAPHY.fontSize.xs, marginBottom: SPACING.sm },
  horizontalScroll: { marginHorizontal: -SPACING.lg },
  horizontalScrollContent: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  optionChip: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.full },
  optionChipText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  selectableTag: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.full },
  selectableTagText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  // Text areas are handled by <FormTextArea />
  textAreaContainer: {},
  textArea: {},
  charCount: {},
  optionCards: { gap: SPACING.sm },
  optionCardSmall: { padding: SPACING.sm, borderWidth: 1.5, borderRadius: BORDER.radius.md },
  optionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionCardTitleSmall: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  separator: { height: 1, marginVertical: SPACING.md },
  rowFields: { flexDirection: 'row', gap: SPACING.md },
  halfField: { flex: 1 },
  dateButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.sm },
  dateButtonText: { fontSize: TYPOGRAPHY.fontSize.sm, flex: 1 },
  previewContainer: { gap: SPACING.md },
  previewSection: { padding: SPACING.md, borderRadius: BORDER.radius.md },
  previewTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold },
  previewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  previewTag: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, borderRadius: BORDER.radius.full },
  previewTagText: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.medium },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  previewGridItem: { width: '50%', padding: SPACING.md, borderWidth: 0.5 },
  previewLabel: { fontSize: TYPOGRAPHY.fontSize.xs, marginBottom: 2 },
  previewValue: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  previewSectionTitle: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, marginBottom: SPACING.sm },
  previewCompensation: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.bold },
  previewDates: { flexDirection: 'row', justifyContent: 'space-between' },
  previewText: { fontSize: TYPOGRAPHY.fontSize.sm, lineHeight: 20 },
  footer: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  footerButtons: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  deleteButton: { width: 48, height: 48, borderRadius: BORDER.radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  saveButtonContainer: { flex: 1 },

  // Location type styles
  locationTypeRow: { flexDirection: 'row', gap: SPACING.sm },
  locationTypeCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.md, gap: SPACING.xs, position: 'relative' },
  locationTypeLabel: { fontSize: TYPOGRAPHY.fontSize.xs, textAlign: 'center' },
  locationTypeCheck: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  // Images upload styles
  imageUploadContainer: { marginTop: SPACING.md, alignItems: 'center' },
  addImageButtonFullWidth: { width: '100%', aspectRatio: 16 / 9, borderWidth: 2, borderRadius: BORDER.radius.md, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  addImageTextLarge: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.medium },
  imagesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md, width: '100%' },
  imageItemContainer: { width: '31%', aspectRatio: 16 / 9, borderRadius: BORDER.radius.sm, overflow: 'hidden', position: 'relative' },
  imageItem: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImageBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  addImageButton: { width: '31%', aspectRatio: 16 / 9, borderWidth: 1.5, borderRadius: BORDER.radius.sm, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  addImageText: { fontSize: TYPOGRAPHY.fontSize.xs },

  // Attachment styles
  attachmentItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.sm, marginTop: SPACING.sm },
  attachmentInfo: { flex: 1, gap: 2 },
  attachmentName: { fontSize: TYPOGRAPHY.fontSize.sm },
  attachmentSize: { fontSize: TYPOGRAPHY.fontSize.xs },
  addAttachmentButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.sm, borderStyle: 'dashed', marginTop: SPACING.sm },
  addAttachmentText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },

  // Preview images styles
  previewImagesScroll: { marginHorizontal: -SPACING.lg, paddingHorizontal: SPACING.lg },
  previewImageItem: { width: 200, height: 120, borderRadius: BORDER.radius.md, marginRight: SPACING.sm, resizeMode: 'cover' },
  previewNoImage: { height: 150, borderRadius: BORDER.radius.md, alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  previewNoImageText: { fontSize: TYPOGRAPHY.fontSize.sm },

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

  // Image slider styles
  imageSliderContainer: {
    marginHorizontal: -SPACING.lg,
  },
  imageSlider: {
    paddingHorizontal: SPACING.lg,
  },
  sliderImage: {
    height: 200,
    borderRadius: BORDER.radius.md,
    marginRight: SPACING.sm,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Back step button styles
  backStepButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, height: LAYOUT.buttonHeight, paddingHorizontal: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.sm },
  backStepButtonText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  continueButton: { flex: 1 },

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

  // Candidature settings styles
  sectionSeparator: { height: 1, marginVertical: SPACING.lg },
  sectionTitle: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.semibold, marginBottom: SPACING.md },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderRadius: BORDER.radius.md, borderWidth: 1, marginBottom: SPACING.md },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  toggleTextContainer: { flex: 1 },
  toggleLabel: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  toggleDescription: { fontSize: TYPOGRAPHY.fontSize.xs, marginTop: 2 },
  questionItem: { padding: SPACING.md, borderRadius: BORDER.radius.md, borderWidth: 1, marginTop: SPACING.sm },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  questionNumber: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  questionInput: { borderWidth: 1, borderRadius: BORDER.radius.sm, padding: SPACING.sm, fontSize: TYPOGRAPHY.fontSize.sm, minHeight: 60, textAlignVertical: 'top' },
  questionFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm },
  requiredToggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  requiredLabel: { fontSize: TYPOGRAPHY.fontSize.xs },
  addQuestionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.md, borderStyle: 'dashed', marginTop: SPACING.sm },
  addQuestionText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },

  // Preview question styles
  previewApplicationSettings: { gap: SPACING.sm },
  previewSettingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewQuestionsList: { marginTop: SPACING.md, gap: SPACING.sm },
  previewQuestionItem: { gap: 2 },
  previewQuestionLabel: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.medium },
  previewQuestionText: { fontSize: TYPOGRAPHY.fontSize.sm },
});
