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
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT } from '../../../../src/constants/theme';
import { Input, Button, Toggle } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { COUNTRIES, getRegionsByCountry, getCommunesByRegion } from '../../../../src/constants/location';
import { SECTOR_DATA } from '../../../../src/constants/talent';
import {
  OPPORTUNITY_TYPE_DATA,
  CONTRACT_TYPE_DATA,
  WORK_RHYTHM_DATA,
  LOCATION_TYPE_DATA,
  COMPENSATION_FREQUENCY_DATA,
  CURRENCY_DATA,
  OPPORTUNITY_VISIBILITY_DATA,
} from '../../../../src/constants/opportunity';
import {
  OpportunityType,
  ContractType,
  WorkRhythm,
  LocationType,
  CompensationFrequency,
  OpportunityStatus,
  OPPORTUNITY_TYPE_LABELS,
  CONTRACT_TYPE_LABELS,
  WORK_RHYTHM_LABELS,
  LOCATION_TYPE_LABELS,
  COMPENSATION_FREQUENCY_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  ApplicationQuestion,
  Visibility,
} from '../../../../src/types/models';
import { opportunityService, UpdateOpportunityData, imageService } from '../../../../src/services';
import { uploadFile } from '../../../../src/services/fileService';
import { getFullImageUrl } from '../../../../src/utils/image';

type Step = 'info' | 'lieu' | 'conditions' | 'media' | 'preview';

const STEPS: Step[] = ['info', 'lieu', 'conditions', 'media', 'preview'];

const STEP_TITLES: Record<Step, string> = {
  info: 'Infos',
  lieu: 'Lieu',
  conditions: 'Conditions',
  media: 'Média',
  preview: 'Aperçu',
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
  const { colors } = useTheme();

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
      setVisibility((opp.visibility as Visibility) || 'PUBLIC');

      // Set organization ID for AI generation
      if (opp.organizations && opp.organizations.length > 0) {
        setOrganizationId(opp.organizations[0].id);
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
      Alert.alert('Erreur', error.error || 'Impossible de charger l\'opportunite.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

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
      Alert.alert('Erreur', 'Une erreur est survenue lors de la selection de l\'image.');
    }
  };

  const removeImage = (imgId: string) => {
    setImages(images.filter((img) => img.id !== imgId));
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
      Alert.alert('Limite atteinte', `Vous pouvez ajouter au maximum ${MAX_ATTACHMENTS} pieces jointes.`);
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
          Alert.alert('Fichier trop volumineux', `Le fichier ne doit pas depasser ${MAX_ATTACHMENT_SIZE_MB} MB.`);
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
      Alert.alert('Erreur', 'Une erreur est survenue lors de la selection du document.');
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
      Alert.alert('Limite atteinte', `Vous pouvez selectionner au maximum ${MAX_SECTORS} secteurs.`);
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
      console.error('Error generating opportunity:', error);
      Alert.alert(
        'Erreur de génération',
        error?.error || 'Une erreur est survenue lors de la génération. Veuillez réessayer.',
      );
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
          console.error('Error uploading image:', uploadError);
          Alert.alert('Erreur', 'Impossible d\'uploader une image. Veuillez réessayer.');
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
          console.error('Error uploading attachment:', uploadError);
          Alert.alert('Erreur', 'Impossible d\'uploader une pièce jointe. Veuillez réessayer.');
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
      Alert.alert('Modifications enregistrees', 'L\'opportunite a ete mise a jour.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Une erreur est survenue lors de la mise a jour.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer l\'opportunite',
      `Etes-vous sur de vouloir supprimer "${title}" ? Cette action est irreversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await opportunityService.delete(id!);
              Alert.alert('Supprime', 'L\'opportunite a ete supprimee.', [{ text: 'OK', onPress: () => router.back() }]);
            } catch (error: any) {
              Alert.alert('Erreur', error.error || 'Une erreur est survenue lors de la suppression.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'info': return title.trim().length >= 5 && opportunityType !== null;
      case 'lieu': return locationType !== null && (locationType === 'REMOTE' || country.length > 0);
      case 'conditions': return contractType !== null;
      default: return true;
    }
  };

  const formatDate = (date: Date | null) => date ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Non définie';

  const formatNumber = (num: string | number | null | undefined): string => {
    if (!num) return '';
    const numStr = typeof num === 'number' ? num.toString() : num;
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const getCurrencySymbol = (currencyId: string): string => {
    const currency = CURRENCY_DATA.find(c => c.id === currencyId);
    return currency?.symbol || currencyId;
  };

  const formatFileSize = (bytes: number | undefined | null): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
        <Briefcase size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Informations de base</Text>
      </View>
      <View style={styles.formFields}>
        <Input label="Titre du poste *" placeholder="Ex: Developpeur Full Stack" value={title} onChangeText={setTitle} />

        {/* Type d'opportunite */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Type d'opportunite *</Text>
          <View style={styles.tagsContainer}>
            {OPPORTUNITY_TYPE_DATA.map((type) => {
              const isSelected = opportunityType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.selectableTag, { backgroundColor: colors.surface, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}
                  onPress={() => setOpportunityType(type.id)}
                >
                  {isSelected && <Check size={14} color={colors.primary} strokeWidth={2.5} />}
                  <Text style={[styles.selectableTagText, { color: colors.gray600 }, isSelected && { color: colors.primary }]}>{type.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bouton Suggérer - Visible quand title >= 3 chars et type sélectionné */}
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
                  style={[styles.selectableTag, { backgroundColor: colors.surface, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}
                  onPress={() => toggleSector(sector.id)}
                >
                  {isSelected && <Check size={14} color={colors.primary} strokeWidth={2.5} />}
                  <Text style={[styles.selectableTagText, { color: colors.gray600 }, isSelected && { color: colors.primary }]}>{sector.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Description */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Description du poste</Text>
          <View style={[styles.textAreaContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
            <TextInput style={[styles.textArea, { color: colors.textPrimary }]} placeholder="Decrivez les missions..." value={summary} onChangeText={setSummary} multiline maxLength={1000} placeholderTextColor={colors.gray500} />
          </View>
          <Text style={[styles.charCount, { color: colors.gray500 }]}>{summary.length}/1000</Text>
        </View>

        {/* Prérequis */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Prérequis</Text>
          <View style={[styles.textAreaContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
            <TextInput style={[styles.textArea, { color: colors.textPrimary }]} placeholder="Competences requises..." value={requirements} onChangeText={setRequirements} multiline maxLength={500} placeholderTextColor={colors.gray500} />
          </View>
          <Text style={[styles.charCount, { color: colors.gray500 }]}>{requirements.length}/500</Text>
        </View>

        {/* Atouts appréciés */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Atouts appréciés</Text>
          <View style={[styles.textAreaContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
            <TextInput style={[styles.textArea, { color: colors.textPrimary }]} placeholder="Competences bonus..." value={niceToHave} onChangeText={setNiceToHave} multiline maxLength={300} placeholderTextColor={colors.gray500} />
          </View>
          <Text style={[styles.charCount, { color: colors.gray500 }]}>{niceToHave.length}/300</Text>
        </View>
      </View>
    </View>
  );

  const renderLieuStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <MapPin size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Lieu de travail</Text>
      </View>
      <View style={styles.formFields}>
        {/* Mode de travail - 3 options horizontales avec icones */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Mode de travail *</Text>
          <View style={styles.locationTypeRow}>
            {LOCATION_TYPE_DATA.map((type) => {
              const isSelected = locationType === type.id;
              const IconComponent = LOCATION_TYPE_ICONS[type.id];
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.locationTypeCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}
                  onPress={() => setLocationType(type.id)}
                >
                  <IconComponent size={24} color={isSelected ? colors.primary : colors.gray500} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.locationTypeLabel, { color: colors.textPrimary }, isSelected && { color: colors.primary, fontWeight: TYPOGRAPHY.fontWeight.semibold }]}>{type.label}</Text>
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

        {/* Localisation (seulement si pas "A distance") */}
        {locationType && locationType !== 'REMOTE' && (
          <>
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Pays *</Text>
              <ScrollView ref={countryScrollRef} horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={styles.horizontalScrollContent}>
                {COUNTRIES.map((c) => {
                  const isSelected = country === c.id;
                  return (
                    <TouchableOpacity key={c.id} style={[styles.optionChip, { backgroundColor: colors.gray100, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => { setCountry(c.id); setRegion(''); setCity(''); }}>
                      <Text style={[styles.optionChipText, { color: colors.gray700 }, isSelected && { color: colors.textOnPrimary }]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {availableRegions.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Region</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={styles.horizontalScrollContent}>
                  {availableRegions.map((r) => {
                    const isSelected = region === r.id;
                    return (
                      <TouchableOpacity key={r.id} style={[styles.optionChip, { backgroundColor: colors.gray100, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => { setRegion(r.id); setCity(''); }}>
                        <Text style={[styles.optionChipText, { color: colors.gray700 }, isSelected && { color: colors.textOnPrimary }]}>{r.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {availableCities.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Ville</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={styles.horizontalScrollContent}>
                  {availableCities.map((c) => {
                    const isSelected = city === c.id;
                    return (
                      <TouchableOpacity key={c.id} style={[styles.optionChip, { backgroundColor: colors.gray100, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setCity(c.id)}>
                        <Text style={[styles.optionChipText, { color: colors.gray700 }, isSelected && { color: colors.textOnPrimary }]}>{c.label}</Text>
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
      </View>
      <View style={styles.formFields}>
        {/* Type de contrat */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Type de contrat *</Text>
          <View style={styles.tagsContainer}>
            {CONTRACT_TYPE_DATA.map((type) => {
              const isSelected = contractType === type.id;
              return (
                <TouchableOpacity key={type.id} style={[styles.selectableTag, { backgroundColor: colors.surface, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary }]} onPress={() => setContractType(type.id)}>
                  {isSelected && <Check size={14} color={colors.primary} strokeWidth={2.5} />}
                  <Text style={[styles.selectableTagText, { color: colors.gray600 }, isSelected && { color: colors.primary }]}>{type.label}</Text>
                </TouchableOpacity>
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
                <TouchableOpacity key={rhythm.id} style={[styles.selectableTag, { backgroundColor: colors.surface, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary }]} onPress={() => setWorkRhythm(isSelected ? null : rhythm.id)}>
                  {isSelected && <Check size={14} color={colors.primary} strokeWidth={2.5} />}
                  <Text style={[styles.selectableTagText, { color: colors.gray600 }, isSelected && { color: colors.primary }]}>{rhythm.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Durée du contrat - Input libre */}
        <Input
          label="Durée du contrat"
          placeholder="ex: 1 mois, 6 mois, CDI..."
          value={duration}
          onChangeText={setDuration}
        />

        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        {/* Remuneration */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Rémunération</Text>
          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <Input label="Minimum" placeholder="150000" value={compensationMin} onChangeText={setCompensationMin} keyboardType="numeric" />
            </View>
            <View style={styles.halfField}>
              <Input label="Maximum" placeholder="300000" value={compensationMax} onChangeText={setCompensationMax} keyboardType="numeric" />
            </View>
          </View>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Devise</Text>
          <View style={styles.tagsContainer}>
            {CURRENCY_DATA.map((c) => {
              const isSelected = currency === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.selectableTag,
                    { backgroundColor: colors.surface, borderColor: colors.gray200 },
                    isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary },
                  ]}
                  onPress={() => setCurrency(c.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.selectableTagText, { color: colors.gray600 }, isSelected && { color: colors.primary }]}>{c.symbol}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Frequence</Text>
          <View style={styles.tagsContainer}>
            {COMPENSATION_FREQUENCY_DATA.map((freq) => {
              const isSelected = compensationFrequency === freq.id;
              return (
                <TouchableOpacity key={freq.id} style={[styles.selectableTag, { backgroundColor: colors.surface, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary }]} onPress={() => setCompensationFrequency(freq.id)}>
                  {isSelected && <Check size={14} color={colors.primary} strokeWidth={2.5} />}
                  <Text style={[styles.selectableTagText, { color: colors.gray600 }, isSelected && { color: colors.primary }]}>{freq.label}</Text>
                </TouchableOpacity>
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

        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        {/* Dates */}
        <View style={styles.rowFields}>
          <View style={styles.halfField}>
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Date limite</Text>
            <TouchableOpacity style={[styles.dateButton, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]} onPress={() => setShowDeadlinePicker(true)}>
              <Calendar size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.dateButtonText, { color: deadline ? colors.textPrimary : colors.gray500 }]} numberOfLines={1}>{deadline ? formatDate(deadline) : 'Selectionner'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.halfField}>
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Date de début</Text>
            <TouchableOpacity style={[styles.dateButton, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]} onPress={() => setShowStartDatePicker(true)}>
              <Calendar size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.dateButtonText, { color: startDate ? colors.textPrimary : colors.gray500 }]} numberOfLines={1}>{startDate ? formatDate(startDate) : 'Selectionner'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showDeadlinePicker && (
          <DateTimePicker
            value={deadline || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, selectedDate) => {
              setShowDeadlinePicker(Platform.OS === 'ios');
              if (selectedDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (selectedDate <= today) {
                  Alert.alert('Date invalide', 'La date limite doit etre superieure a aujourd\'hui.');
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
            onChange={(_, selectedDate) => {
              setShowStartDatePicker(Platform.OS === 'ios');
              if (selectedDate) {
                if (deadline && selectedDate <= deadline) {
                  Alert.alert('Date invalide', 'La date de debut doit etre superieure a la date limite.');
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
            onValueChange={setCvRequired}
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

        {/* Pieces jointes - Max 3 x 20MB */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
            Pieces jointes ({attachments.length}/{MAX_ATTACHMENTS})
          </Text>
          <Text style={[styles.fieldHint, { color: colors.gray500 }]}>
            Fiche de poste, description detaillee, etc. (PDF, Word) - Max {MAX_ATTACHMENT_SIZE_MB}MB par fichier
          </Text>

          {attachments.map((attachment) => (
            <View key={attachment.id} style={[styles.attachmentItem, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
              <FileText size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View style={styles.attachmentInfo}>
                <Text style={[styles.attachmentName, { color: colors.textPrimary }]} numberOfLines={1}>{attachment.name}</Text>
                {attachment.size && <Text style={[styles.attachmentSize, { color: colors.gray500 }]}>{(attachment.size / (1024 * 1024)).toFixed(1)} MB</Text>}
              </View>
              <TouchableOpacity onPress={() => removeAttachment(attachment.id)}>
                <X size={18} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            </View>
          ))}

          {attachments.length < MAX_ATTACHMENTS && (
            <TouchableOpacity style={[styles.addAttachmentButton, { borderColor: colors.gray300 }]} onPress={pickDocument}>
              <Plus size={20} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.addAttachmentText, { color: colors.gray600 }]}>Ajouter un document</Text>
            </TouchableOpacity>
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
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Aperçu</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Vérifiez toutes les informations avant enregistrement
        </Text>
      </View>

      {/* Status Management Card */}
      <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
        <View style={styles.statusHeader}>
          <View>
            <Text style={[styles.statusLabel, { color: colors.gray600 }]}>Statut de l'offre</Text>
            <View style={styles.statusBadgeContainer}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                <Text style={[styles.statusBadgeText, { color: getStatusColor() }]}>
                  {OPPORTUNITY_STATUS_LABELS[status]}
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
          {status === 'DRAFT' ? 'Activez pour publier cette offre et la rendre visible.' :
            status === 'OPEN' ? 'L\'offre est publiée et visible par les candidats.' :
              status === 'PAUSED' ? 'L\'offre est en pause. Activez pour la republier.' :
                status === 'FILLED' ? 'Cette offre a été pourvue.' :
                  status === 'EXPIRED' ? 'Cette offre a expiré.' : ''}
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
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{title || 'Sans titre'}</Text>
          <View style={styles.previewTags}>
            {opportunityType ? (
              <View style={[styles.previewTag, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.previewTagText, { color: colors.primary }]}>{OPPORTUNITY_TYPE_LABELS[opportunityType]}</Text>
              </View>
            ) : (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray500 }]}>Type non défini</Text>
              </View>
            )}
            {contractType ? (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray700 }]}>{CONTRACT_TYPE_LABELS[contractType]}</Text>
              </View>
            ) : (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray500 }]}>Contrat non défini</Text>
              </View>
            )}
            {workRhythm && (
              <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.previewTagText, { color: colors.gray700 }]}>{WORK_RHYTHM_LABELS[workRhythm]}</Text>
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
                    <Text style={[styles.previewTagText, { color: colors.gray700 }]}>{sector?.label || sectorId}</Text>
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
            <Text style={[styles.previewValue, { color: locationType ? colors.textPrimary : colors.gray400 }]}>{getLocationLabel()}</Text>
          </View>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Rythme de travail</Text>
            <Text style={[styles.previewValue, { color: workRhythm ? colors.textPrimary : colors.gray400 }]}>{workRhythm ? WORK_RHYTHM_LABELS[workRhythm] : 'Non défini'}</Text>
          </View>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Durée du contrat</Text>
            <Text style={[styles.previewValue, { color: duration.trim() ? colors.textPrimary : colors.gray400 }]}>{duration.trim() || 'Non définie'}</Text>
          </View>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Date limite</Text>
            <Text style={[styles.previewValue, { color: deadline ? colors.textPrimary : colors.gray400 }]}>{formatDate(deadline)}</Text>
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
              <Text style={[styles.previewValue, { color: deadline ? colors.textPrimary : colors.gray400 }]}>{formatDate(deadline)}</Text>
            </View>
            <View>
              <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Date de début</Text>
              <Text style={[styles.previewValue, { color: startDate ? colors.textPrimary : colors.gray400 }]}>{formatDate(startDate)}</Text>
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Description du poste</Text>
          {summary ? <Text style={[styles.previewText, { color: colors.textSecondary }]}>{summary}</Text> : <Text style={[styles.previewText, { color: colors.gray400 }]}>Aucune description</Text>}
        </View>

        {/* Prérequis */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Prérequis</Text>
          {requirements ? <Text style={[styles.previewText, { color: colors.textSecondary }]}>{requirements}</Text> : <Text style={[styles.previewText, { color: colors.gray400 }]}>Aucun prérequis défini</Text>}
        </View>

        {/* Atouts appréciés */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Atouts appréciés</Text>
          {niceToHave ? <Text style={[styles.previewText, { color: colors.textSecondary }]}>{niceToHave}</Text> : <Text style={[styles.previewText, { color: colors.gray400 }]}>Aucun atout défini</Text>}
        </View>

        {/* Paramètres de candidature */}
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

        {/* Médias */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Médias</Text>
          <Text style={[styles.previewText, { color: images.length > 0 ? colors.textSecondary : colors.gray400 }]}>
            {images.length} image(s) d'illustration
          </Text>
          <Text style={[styles.previewText, { color: attachments.length > 0 ? colors.textSecondary : colors.gray400 }]}>
            {attachments.length} pièce(s) jointe(s)
          </Text>
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
            <TouchableOpacity style={[styles.backStepButton, { borderColor: colors.gray300 }]} onPress={handleBack} disabled={isSubmitting}>
              <ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.backStepButtonText, { color: colors.gray700 }]}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.deleteButton, { borderColor: colors.error }]} onPress={handleDelete} disabled={isSubmitting}>
              <Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
            </TouchableOpacity>
            <View style={styles.saveButtonContainer}>
              <Button title="Enregistrer" onPress={handleSave} disabled={isSubmitting} fullWidth />
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        <View style={styles.footerButtons}>
          {!isFirstStep && (
            <TouchableOpacity style={[styles.backStepButton, { borderColor: colors.gray300 }]} onPress={handleBack}>
              <ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.backStepButtonText, { color: colors.gray700 }]}>Retour</Text>
            </TouchableOpacity>
          )}
          <View style={[styles.continueButton, !isFirstStep && { flex: 1 }]}>
            <Button title="Continuer" onPress={handleNext} disabled={!canProceed()} fullWidth icon={<ChevronRight size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />} iconPosition="right" />
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}><ArrowLeft size={ICON.size.md} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Modifier l'opportunite</Text>
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
