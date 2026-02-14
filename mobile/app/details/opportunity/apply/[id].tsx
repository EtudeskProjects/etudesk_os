import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Check,
  FileText,
  X,
  Eye,
  CheckCircle2,
  Briefcase,
  User,
  Mail,
  MapPin,
  Phone,
  SquarePen,
  AlertCircle,
  FolderOpen,
  Plus,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../../src/constants/theme';
import { Button, StepIndicator } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { useForm } from '../../../../src/hooks/useForm';
import { useAuth } from '../../../../src/contexts/AuthContext';
import { useAlert } from '../../../../src/contexts/AlertContext';
import { opportunityService, applicationService, talentService, documentService, kycService } from '../../../../src/services';
import type { Opportunity, ApplicationQuestion, ApplicationAnswer, TalentObjectData } from '../../../../src/types/models';
import type { TalentDocument } from '../../../../src/services/documentService';
import { getFullImageUrl } from '../../../../src/utils/image';

type ApplyStep = 'profile' | 'questions' | 'preview' | 'success';

const STEPS: ApplyStep[] = ['profile', 'questions', 'preview', 'success'];

const STEP_TITLES: Record<ApplyStep, string> = {
  profile: 'Mon profil',
  questions: 'Candidature',
  preview: 'Aperçu',
  success: 'Confirmation',
};

const MAX_ANSWER_LENGTH = 200;

interface CVFile {
  name: string;
  uri: string;
  type: string;
  size?: number;
  isFromDocuments?: boolean;
  documentId?: string;
}

type CVSource = 'existing' | 'upload' | null;

interface ApplicationFormValues {
  answers: Record<string, string>;
  cvSource: CVSource;
  selectedExistingCV: TalentDocument | null;
  uploadedCV: CVFile | null;
}

export default function ApplyOpportunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { error: showError } = useAlert();

  const [currentStep, setCurrentStep] = useState<ApplyStep>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [profile, setProfile] = useState<TalentObjectData | null>(null);

  // CV State (loaded data)
  const [existingCVs, setExistingCVs] = useState<TalentDocument[]>([]);
  const [hasExistingCV, setHasExistingCV] = useState(false);

  // Form state using useForm
  const form = useForm<ApplicationFormValues>({
    fields: {
      answers: { initialValue: {} },
      cvSource: { initialValue: null },
      selectedExistingCV: { initialValue: null },
      uploadedCV: { initialValue: null },
    },
    onSubmit: async (values) => {
      if (!opportunity) return;

      // Build application answers
      const applicationAnswers: ApplicationAnswer[] = [];
      if (opportunity.application_questions) {
        opportunity.application_questions.forEach((q) => {
          if (values.answers[q.id]?.trim()) {
            applicationAnswers.push({
              question_id: q.id,
              answer: values.answers[q.id].trim(),
            });
          }
        });
      }

      // Get CV URL
      const selectedCV = getSelectedCV();
      let cvUrl: string | undefined;

      if (selectedCV) {
        if (selectedCV.isFromDocuments) {
          // Use the file_url from documents
          cvUrl = selectedCV.uri;
        } else {
          // TODO: Upload the file first, then use the returned URL
          // For now, using the local URI (would need real upload implementation)
          cvUrl = selectedCV.uri;
        }
      }

      await applicationService.apply({
        opportunity_id: opportunity.id,
        resume_url: cvUrl,
        answers: applicationAnswers.length > 0 ? applicationAnswers : undefined,
      });

      setCurrentStep('success');
    },
  });
  const alerts = useAlert();

  // Convenience getters
  const answers = form.getValue('answers');
  const cvSource = form.getValue('cvSource');
  const selectedExistingCV = form.getValue('selectedExistingCV');
  const uploadedCV = form.getValue('uploadedCV');
  const isSubmitting = form.state.isSubmitting;


  // Load data
  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      // KYC gate: vérification d'identité obligatoire
      try {
        const kycRes = await kycService.getStatus();
        if (!kycRes?.data || kycRes.data.status !== 'VERIFIED') {
          void alerts.showAlert({ title: 'Vérification requise', message: 'Tu dois vérifier ton identité avant de postuler.', buttons: [
              { text: 'Plus tard', style: 'cancel', onPress: () => router.back() },
              { text: 'Vérifier', onPress: () => { router.back(); router.push('/settings/kyc'); } },
            ] });
          setIsLoading(false);
          return;
        }
      } catch {
        void alerts.showAlert({ title: 'Vérification requise', message: 'Tu dois vérifier ton identité avant de postuler.', buttons: [
            { text: 'Plus tard', style: 'cancel', onPress: () => router.back() },
            { text: 'Vérifier', onPress: () => { router.back(); router.push('/settings/kyc'); } },
          ] });
        setIsLoading(false);
        return;
      }

      const [oppResponse, profileResponse, cvsResponse] = await Promise.all([
        opportunityService.getById(id),
        talentService.getMyTalentObject({ includeHidden: false }).catch(() => null),
        documentService.listDocuments({ type: 'CV' }).catch(() => null),
      ]);

      if (!oppResponse?.data) {
        void alerts.alert('Erreur', 'Impossible de charger cette opportunité.');
        router.back();
        return;
      }

      setOpportunity(oppResponse.data);

      if (profileResponse?.data) {
        setProfile(profileResponse.data);
      }

      // Set existing CVs from talent_documents
      if (cvsResponse?.documents && cvsResponse.documents.length > 0) {
        setExistingCVs(cvsResponse.documents);
        setHasExistingCV(true);
        form.setValue('selectedExistingCV', cvsResponse.documents[0]);
        form.setValue('cvSource', 'existing');
      }

      // Initialize answers for each question
      if (oppResponse.data.application_questions) {
        const initialAnswers: Record<string, string> = {};
        oppResponse.data.application_questions.forEach((q: ApplicationQuestion) => {
          initialAnswers[q.id] = '';
        });
        form.setValue('answers', initialAnswers);
      }
    } catch (error) {
      console.error('Error loading apply data:', error);
      void alerts.alert('Erreur', 'Impossible de charger les données.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const pickCV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        const maxSize = 20 * 1024 * 1024; // 20MB max

        if (doc.size && doc.size > maxSize) {
          void alerts.alert('Fichier trop volumineux', 'Le CV ne doit pas dépasser 20 MB.');
          return;
        }

        form.setValue('uploadedCV', {
          name: doc.name,
          uri: doc.uri,
          type: doc.mimeType || 'application/pdf',
          size: doc.size,
          isFromDocuments: false,
        });
        form.setValue('cvSource', 'upload');
        form.setValue('selectedExistingCV', null);
      }
    } catch (error) {
      void alerts.alert('Erreur', 'Une erreur est survenue lors de la sélection du fichier.');
    }
  };

  const selectExistingCV = (cv: TalentDocument) => {
    form.setValue('selectedExistingCV', cv);
    form.setValue('cvSource', 'existing');
    form.setValue('uploadedCV', null);
  };

  const removeCV = () => {
    if (cvSource === 'upload') {
      form.setValue('uploadedCV', null);
    } else {
      form.setValue('selectedExistingCV', null);
    }
    form.setValue('cvSource', null);
  };

  const getSelectedCV = (): CVFile | null => {
    if (cvSource === 'upload' && uploadedCV) {
      return uploadedCV;
    }
    if (cvSource === 'existing' && selectedExistingCV) {
      return {
        name: selectedExistingCV.title || selectedExistingCV.original_filename || 'CV',
        uri: selectedExistingCV.file_url || '',
        type: 'application/pdf',
        isFromDocuments: true,
        documentId: selectedExistingCV.id,
      };
    }
    return null;
  };

  const updateAnswer = (questionId: string, value: string) => {
    form.setValue('answers', {
      ...answers,
      [questionId]: value,
    });
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

  const handleSubmit = async () => {
    if (!opportunity) return;

    try {
      await form.handleSubmit();
    } catch (error: any) {
      if (error.status === 403 && error.error?.includes('propre opportunité')) {
        showError(
          'Action non autorisée',
          'Vous ne pouvez pas postuler à votre propre opportunité.'
        );
      } else {
        showError(
          'Erreur',
          error.error || 'Une erreur est survenue lors de l\'envoi de votre candidature.'
        );
      }
    }
  };

  const isProfileComplete = (): boolean => {
    if (!profile) return false;
    return !!(profile.first_name && profile.last_name && profile.email);
  };

  const canProceed = (): boolean => {
    if (!opportunity) return false;

    switch (currentStep) {
      case 'profile':
        return isProfileComplete();
      case 'questions':
        // Check if CV is required and provided
        if (opportunity.cv_required && !getSelectedCV()) {
          return false;
        }

        // Check if all required questions are answered
        if (opportunity.application_questions) {
          for (const question of opportunity.application_questions) {
            if (question.required && !answers[question.id]?.trim()) {
              return false;
            }
          }
        }

        return true;
      case 'preview':
        return true;
      default:
        return false;
    }
  };

  const getInitials = (firstName?: string, lastName?: string): string => {
    const f = firstName?.[0] || '';
    const l = lastName?.[0] || '';
    return (f + l).toUpperCase() || '?';
  };

  const renderStepIndicator = () => {
    const visibleSteps = STEPS.filter((s) => s !== 'success');

    // Create step objects for the indicator
    const stepsData = visibleSteps.map(step => ({
      id: step,
      label: STEP_TITLES[step],
    }));

    return <StepIndicator steps={stepsData} currentStepId={currentStep} />;
  };

  const renderProfileStep = () => {
    const profileComplete = isProfileComplete();
    const avatarUrl = profile?.avatar_url ? getFullImageUrl(profile.avatar_url) : null;
    const location = [profile?.city, profile?.region, profile?.country].filter(Boolean).join(', ');

    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <User size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
            Vérifiez votre profil
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Ces informations seront partagées avec le recruteur
          </Text>
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
          <View style={styles.profileHeader}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
            ) : (
              <View style={[styles.profileAvatarPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[20]) }]}>
                <Text style={[styles.profileAvatarText, { color: colors.primary }]}>
                  {getInitials(profile?.first_name || undefined, profile?.last_name || undefined)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.textPrimary }]}>
              {profile?.display_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()}
            </Text>
            {profile?.bio && (
              <Text style={[styles.profileHeadline, { color: colors.textSecondary }]} numberOfLines={2}>
                {profile.bio}
              </Text>
            )}
          </View>

          {/* Contact */}
          <View style={styles.profileDetails}>
            {profile?.email && (
              <View style={styles.profileDetailRow}>
                <Mail size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.profileDetailText, { color: colors.textSecondary }]}>{profile.email}</Text>
              </View>
            )}
            {profile?.phone && (
              <View style={styles.profileDetailRow}>
                <Phone size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.profileDetailText, { color: colors.textSecondary }]}>{profile.phone}</Text>
              </View>
            )}
            {location ? (
              <View style={styles.profileDetailRow}>
                <MapPin size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.profileDetailText, { color: colors.textSecondary }]}>{location}</Text>
              </View>
            ) : null}
          </View>

          {/* Skills */}
          {profile?.skills && profile.skills.length > 0 && (
            <View style={[styles.profileTagsSection, { borderTopColor: colors.borderColor }]}>
              <Text style={[styles.profileTagsLabel, { color: colors.gray500 }]}>Compétences</Text>
              <View style={styles.profileTagsRow}>
                {profile.skills.slice(0, 8).map((skill, i) => (
                  <View key={i} style={[styles.profileTag, { backgroundColor: withOpacity(colors.primary, OPACITY[12]) }]}>
                    <Text style={[styles.profileTagText, { color: colors.primary }]}>{skill}</Text>
                  </View>
                ))}
                {profile.skills.length > 8 && (
                  <Text style={[styles.profileTagMore, { color: colors.gray400 }]}>+{profile.skills.length - 8}</Text>
                )}
              </View>
            </View>
          )}

          {/* Sectors */}
          {profile?.sectors && profile.sectors.length > 0 && (
            <View style={[styles.profileTagsSection, { borderTopColor: colors.borderColor }]}>
              <Text style={[styles.profileTagsLabel, { color: colors.gray500 }]}>Secteurs</Text>
              <View style={styles.profileTagsRow}>
                {profile.sectors.map((s, i) => (
                  <View key={i} style={[styles.profileTag, { backgroundColor: colors.gray100 }]}>
                    <Text style={[styles.profileTagText, { color: colors.gray700 }]}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Documents */}
          {profile?.documents_metadata && profile.documents_metadata.length > 0 && (
            <View style={[styles.profileTagsSection, { borderTopColor: colors.borderColor }]}>
              <Text style={[styles.profileTagsLabel, { color: colors.gray500 }]}>Documents ({profile.documents_metadata.length})</Text>
              {profile.documents_metadata.slice(0, 3).map((doc) => (
                <View key={doc.id} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.xs }}>
                  <FileText size={14} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.profileDetailText, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
                    {doc.title || doc.original_filename}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Warning if profile incomplete */}
          {!profileComplete && (
            <View style={[styles.warningBox, { backgroundColor: withOpacity(colors.warning, OPACITY[15]) }]}>
              <AlertCircle size={20} color={colors.warning} strokeWidth={ICON.strokeWidth} />
              <View style={styles.warningContent}>
                <Text style={[styles.warningTitle, { color: colors.warning }]}>Profil incomplet</Text>
                <Text style={[styles.warningText, { color: colors.textSecondary }]}>
                  Complétez votre profil (nom, prénom, email) pour continuer.
                </Text>
              </View>
            </View>
          )}
        </View>

        <Button
          title="Modifier mon profil"
          onPress={() => router.push('/settings/edit-profile')}
          variant="outline"
          fullWidth
          icon={<SquarePen size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
        />
      </View>
    );
  };

  const renderCVSection = () => {
    const selectedCV = getSelectedCV();
    const cvRequired = opportunity?.cv_required || false;

    return (
      <View style={styles.fieldContainer}>
        <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>
          CV (PDF) {cvRequired ? '*' : '(optionnel)'}
        </Text>

        {/* If CV is selected, show preview */}
        {selectedCV ? (
          <View style={[styles.cvPreview, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
            <View style={[styles.cvIconContainer, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
              <FileText size={24} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            </View>
            <View style={styles.cvInfo}>
              <Text style={[styles.cvName, { color: colors.textPrimary }]} numberOfLines={1}>
                {selectedCV.name}
              </Text>
              <Text style={[styles.cvSource, { color: colors.gray500 }]}>
                {selectedCV.isFromDocuments ? 'Depuis mes documents' : 'Fichier uploadé'}
              </Text>
            </View>
            <TouchableOpacity onPress={removeCV} style={styles.removeCvButton}>
              <X size={20} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cvOptionsContainer}>
            {/* Existing CVs Section */}
            {hasExistingCV && (
              <>
                <Text style={[styles.cvOptionsTitle, { color: colors.gray600 }]}>
                  Choisir un CV existant
                </Text>
                <View style={styles.existingCvsList}>
                  {existingCVs.map((cv) => (
                    <TouchableOpacity
                      key={cv.id}
                      style={[
                        styles.existingCvItem,
                        { backgroundColor: colors.gray50, borderColor: colors.gray200 },
                        selectedExistingCV?.id === cv.id && {
                          borderColor: colors.primary,
                          backgroundColor: withOpacity(colors.primary, OPACITY[8]),
                        },
                      ]}
                      onPress={() => selectExistingCV(cv)}
                    >
                      <View style={[styles.existingCvIcon, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                        <FolderOpen size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                      </View>
                      <View style={styles.existingCvInfo}>
                        <Text style={[styles.existingCvName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {cv.title || cv.original_filename || 'CV'}
                        </Text>
                        {cv.is_primary && (
                          <View style={[styles.primaryBadge, { backgroundColor: withOpacity(colors.success, OPACITY[15]) }]}>
                            <Text style={[styles.primaryBadgeText, { color: colors.success }]}>
                              Principal
                            </Text>
                          </View>
                        )}
                      </View>
                      {selectedExistingCV?.id === cv.id && (
                        <Check size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.orDivider}>
                  <View style={[styles.orLine, { backgroundColor: colors.gray200 }]} />
                  <Text style={[styles.orText, { color: colors.gray500 }]}>ou</Text>
                  <View style={[styles.orLine, { backgroundColor: colors.gray200 }]} />
                </View>
              </>
            )}

            {/* Upload New CV */}
            <TouchableOpacity
              style={[styles.uploadButton, { borderColor: colors.primary }]}
              onPress={pickCV}
            >
              <Plus size={24} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.uploadText, { color: colors.primary }]}>
                {hasExistingCV ? 'Télécharger un autre CV' : 'Télécharger votre CV'}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.fieldHint, { color: colors.gray500 }]}>
              Format PDF, maximum 5 MB
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderQuestionsStep = () => {
    const questions = opportunity?.application_questions || [];
    const cvRequired = opportunity?.cv_required || false;

    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Briefcase size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
            Informations complémentaires
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Complétez les informations demandées
          </Text>
        </View>

        <View style={styles.formFields}>
          {/* CV Section - Always show if CV required or if user has CVs */}
          {(cvRequired || hasExistingCV) && renderCVSection()}

          {/* Separator */}
          {(cvRequired || hasExistingCV) && questions.length > 0 && (
            <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />
          )}

          {/* Questions Section */}
          {questions.length > 0 && (
            <View style={styles.fieldContainer}>
              <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>
                Questions du recruteur
              </Text>

              {questions.map((question) => (
                <View key={question.id} style={styles.questionContainer}>
                  <Text style={[styles.questionLabel, { color: colors.textPrimary }]}>
                    {question.question}
                    {question.required && <Text style={{ color: colors.error }}> *</Text>}
                  </Text>
                  <View style={[styles.answerInputContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
                    <TextInput
                      style={[styles.answerInput, { color: colors.textPrimary }]}
                      placeholder="Votre réponse..."
                      placeholderTextColor={colors.gray400}
                      value={answers[question.id] || ''}
                      onChangeText={(text) => updateAnswer(question.id, text)}
                      maxLength={question.max_length || MAX_ANSWER_LENGTH}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                  <Text style={[styles.charCount, { color: colors.gray500 }]}>
                    {(answers[question.id] || '').length}/{question.max_length || MAX_ANSWER_LENGTH}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* No requirements message */}
          {!cvRequired && !hasExistingCV && questions.length === 0 && (
            <View style={[styles.noRequirements, { backgroundColor: colors.gray50 }]}>
              <CheckCircle2 size={32} color={colors.success} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.noRequirementsText, { color: colors.textPrimary }]}>
                Aucune information supplémentaire requise
              </Text>
              <Text style={[styles.noRequirementsHint, { color: colors.gray500 }]}>
                Vous pouvez passer à l'étape suivante
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderPreviewStep = () => {
    const questions = opportunity?.application_questions || [];
    const selectedCV = getSelectedCV();

    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Eye size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
            Vérifiez votre candidature
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Avant de soumettre, vérifiez les informations
          </Text>
        </View>

        <View style={styles.previewContainer}>
          {/* Opportunity Info */}
          <View style={[styles.previewSection, { backgroundColor: colors.gray50 }]}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
              Opportunité
            </Text>
            <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
              {opportunity?.title}
            </Text>
            <Text style={[styles.previewHint, { color: colors.gray500 }]}>
              {opportunity?.organization?.name}
            </Text>
          </View>

          {/* Profile Preview */}
          <View style={[styles.previewSection, { backgroundColor: withOpacity(colors.primary, OPACITY[8]) }]}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
              Votre profil
            </Text>
            <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
              {profile?.first_name} {profile?.last_name}
            </Text>
            <Text style={[styles.previewHint, { color: colors.gray500 }]}>
              {profile?.email}
            </Text>
            {profile?.bio && (
              <Text style={[styles.previewHint, { color: colors.gray500 }]} numberOfLines={1}>
                {profile.bio}
              </Text>
            )}
          </View>

          {/* CV Preview */}
          {(opportunity?.cv_required || selectedCV) && (
            <View style={styles.previewSection}>
              <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
                CV
              </Text>
              {selectedCV ? (
                <View style={styles.previewCv}>
                  <FileText size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                  <View>
                    <Text style={[styles.previewCvName, { color: colors.textPrimary }]}>
                      {selectedCV.name}
                    </Text>
                    <Text style={[styles.previewCvSource, { color: colors.gray500 }]}>
                      {selectedCV.isFromDocuments ? 'Depuis mes documents' : 'Fichier uploadé'}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.previewMissing, { color: colors.error }]}>
                  CV non fourni
                </Text>
              )}
            </View>
          )}

          {/* Answers Preview */}
          {questions.length > 0 && (
            <View style={styles.previewSection}>
              <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
                Vos réponses
              </Text>
              {questions.map((question) => (
                <View key={question.id} style={styles.previewAnswer}>
                  <Text style={[styles.previewQuestionLabel, { color: colors.gray500 }]}>
                    {question.question}
                  </Text>
                  <Text style={[styles.previewAnswerText, { color: colors.textPrimary }]}>
                    {answers[question.id]?.trim() || '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderSuccessStep = () => (
    <View style={styles.successContainer}>
      <View style={[styles.successIcon, { backgroundColor: withOpacity(colors.success, OPACITY[15]) }]}>
        <CheckCircle2 size={64} color={colors.success} strokeWidth={ICON.strokeWidth} />
      </View>
      <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
        Candidature envoyée !
      </Text>
      <Text style={[styles.successDescription, { color: colors.textSecondary }]}>
        Votre candidature pour "{opportunity?.title}" a bien été envoyée. L'organisation vous contactera si votre profil correspond.
      </Text>

      <View style={styles.successActions}>
        <Button
          title="Voir mes candidatures"
          onPress={() => router.replace('/settings/my-applications')}
          fullWidth
        />
        <TouchableOpacity
          style={styles.backToExploreButton}
          onPress={() => router.replace('/(tabs)/explore')}
        >
          <Text style={[styles.backToExploreText, { color: colors.primary }]}>
            Continuer à explorer
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (currentStep === 'success') return null;

    const isFirstStep = currentStep === 'profile';

    if (currentStep === 'preview') {
      return (
        <View style={[styles.footer, { backgroundColor: colors.background }]}>
          <View style={styles.footerButtons}>
            <TouchableOpacity
              style={[styles.backButton, { borderColor: colors.gray300 }]}
              onPress={handleBack}
              disabled={isSubmitting}
            >
              <ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.backButtonText, { color: colors.gray700 }]}>Retour</Text>
            </TouchableOpacity>
            <View style={styles.submitButton}>
              <Button
                title={isSubmitting ? 'Envoi...' : 'Envoyer ma candidature'}
                onPress={handleSubmit}
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
          <TouchableOpacity
            style={[styles.backButton, { borderColor: colors.gray300 }]}
            onPress={handleBack}
          >
            <ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.backButtonText, { color: colors.gray700 }]}>
              {isFirstStep ? 'Annuler' : 'Retour'}
            </Text>
          </TouchableOpacity>
          <View style={styles.continueButton}>
            <Button
              title="Continuer"
              onPress={handleNext}
              disabled={!canProceed()}
              fullWidth
              icon={<ChevronRight size={18} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
              iconPosition="right"
            />
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Chargement...
        </Text>
      </SafeAreaView>
    );
  }

  if (!opportunity) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
          Opportunité non trouvée
        </Text>
        <Button title="Retour" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBackButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {opportunity.title}
        </Text>
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
          {currentStep !== 'success' && renderStepIndicator()}

          {currentStep === 'profile' && renderProfileStep()}
          {currentStep === 'questions' && renderQuestionsStep()}
          {currentStep === 'preview' && renderPreviewStep()}
          {currentStep === 'success' && renderSuccessStep()}
        </ScrollView>

        {renderFooter()}
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
    gap: SPACING.md,
  },

  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.lg,
  },

  errorText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  headerBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
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
    gap: SPACING.lg,
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

  // Profile Step
  profileCard: {
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },

  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },

  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },

  profileAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileAvatarText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  profileInfo: {
    marginBottom: SPACING.md,
  },

  profileName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  profileHeadline: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  profileDetails: {
    gap: SPACING.sm,
  },

  profileDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  profileDetailText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  profileTagsSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
  profileTagsLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },
  profileTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  profileTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER.radius.full,
  },
  profileTagText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  profileTagMore: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    alignSelf: 'center',
  },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    marginTop: SPACING.md,
  },

  warningContent: {
    flex: 1,
  },

  warningTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  warningText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
  },

  editProfileText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Form fields
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
    marginTop: SPACING.xs,
  },

  separator: {
    height: 1,
    marginVertical: SPACING.md,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.md,
  },

  // CV Section
  cvOptionsContainer: {
    gap: SPACING.sm,
  },

  cvOptionsTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  existingCvsList: {
    gap: SPACING.sm,
  },

  existingCvItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
  },

  existingCvIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  existingCvInfo: {
    flex: 1,
    gap: SPACING.xs,
  },

  existingCvName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  primaryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER.radius.full,
  },

  primaryBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginVertical: SPACING.md,
  },

  orLine: {
    flex: 1,
    height: 1,
  },

  orText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // CV Upload
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderWidth: 2,
    borderRadius: BORDER.radius.md,
    borderStyle: 'dashed',
  },

  uploadText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  cvPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
  },

  cvIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cvInfo: {
    flex: 1,
  },

  cvName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  cvSource: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  cvSize: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  removeCvButton: {
    padding: SPACING.xs,
  },

  // Questions
  questionContainer: {
    marginBottom: SPACING.md,
  },

  questionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.sm,
  },

  answerInputContainer: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    padding: SPACING.md,
  },

  answerInput: {
    fontSize: TYPOGRAPHY.fontSize.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  charCount: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },

  // No requirements
  noRequirements: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: BORDER.radius.md,
    gap: SPACING.md,
  },

  noRequirementsText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  noRequirementsHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },

  // Preview
  previewContainer: {
    gap: SPACING.md,
  },

  previewSection: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
  },

  previewSectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },

  previewValue: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  previewHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  previewCv: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  previewCvName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  previewCvSource: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  previewMissing: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontStyle: 'italic',
  },

  previewAnswer: {
    marginBottom: SPACING.md,
  },

  previewQuestionLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: 4,
  },

  previewAnswerText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Success
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    minHeight: 400,
  },

  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },

  successTitle: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },

  successDescription: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.xl,
  },

  successActions: {
    width: '100%',
    gap: SPACING.md,
  },

  backToExploreButton: {
    padding: SPACING.md,
    alignItems: 'center',
  },

  backToExploreText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Footer
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },

  footerButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.sm,
  },

  backButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  continueButton: {
    flex: 1,
  },

  submitButton: {
    flex: 1,
  },
});
