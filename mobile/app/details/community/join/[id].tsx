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
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Check,
  Shield,
  User,
  Mail,
  MapPin,
  Phone,
  SquarePen,
  AlertCircle,
  CheckCircle2,
  Users,
  Eye,
  Send,
  CreditCard,
  FileText,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../../src/constants/theme';
import { Button } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { useAuth } from '../../../../src/contexts/AuthContext';
import { useAlert } from '../../../../src/contexts/AlertContext';
import { communityService, talentService, MembershipAnswer } from '../../../../src/services';
import type { Community, ApplicationQuestion } from '../../../../src/types/models';
import { VISIBILITY_LABELS, COMMUNITY_TYPE_LABELS } from '../../../../src/types/models';

type JoinStep = 'profile' | 'rules' | 'questions' | 'preview' | 'success';

const STEPS: JoinStep[] = ['profile', 'rules', 'questions', 'preview', 'success'];

const STEP_TITLES: Record<JoinStep, string> = {
  profile: 'Mon profil',
  rules: 'Règles',
  questions: 'Questions',
  preview: 'Aperçu',
  success: 'Confirmation',
};

const MAX_ANSWER_LENGTH = 200;

interface UserProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  headline?: string;
  city?: string;
  country?: string;
  profile_picture_url?: string;
}

export default function JoinCommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { error: showError, success: showSuccess } = useAlert();

  const [currentStep, setCurrentStep] = useState<JoinStep>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [community, setCommunity] = useState<Community | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Form state
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Determine which steps are active based on community config
  const getActiveSteps = (): JoinStep[] => {
    const activeSteps: JoinStep[] = ['profile'];
    
    // Add rules step only if community has rules
    if (community?.rules) {
      activeSteps.push('rules');
    }
    
    // Add questions step only if community has questions
    const questions = getApplicationQuestions();
    if (questions.length > 0) {
      activeSteps.push('questions');
    }
    
    activeSteps.push('preview');
    
    // Note: Paywall step is no longer in join flow
    // Payment happens after admin approves the membership request
    
    activeSteps.push('success');
    
    return activeSteps;
  };

  const getApplicationQuestions = (): ApplicationQuestion[] => {
    if (!community?.application_questions) return [];
    
    return community.application_questions.map((q, idx) => {
      if (typeof q === 'string') {
        return {
          id: String(idx + 1),
          question: q,
          required: false,
          max_length: MAX_ANSWER_LENGTH,
        };
      }
      return {
        ...q,
        id: q.id || String(idx + 1),
        max_length: q.max_length || MAX_ANSWER_LENGTH,
      };
    });
  };

  // Load data
  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      // Check if already member
      const membershipResponse = await communityService.checkMembership(id);
      if (membershipResponse.data?.is_member) {
        Alert.alert('Information', 'Vous êtes déjà membre de cette communauté.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
        return;
      }
      if (membershipResponse.data?.has_pending_request) {
        Alert.alert('Demande en attente', 'Votre demande d\'adhésion est en cours de traitement.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
        return;
      }

      const [communityResponse, profileResponse] = await Promise.all([
        communityService.getById(id),
        talentService.getMyProfile(),
      ]);

      setCommunity(communityResponse.data);
      setProfile(profileResponse.data);

      // Initialize answers for each question
      if (communityResponse.data?.application_questions) {
        const initialAnswers: Record<string, string> = {};
        communityResponse.data.application_questions.forEach((q: any, idx: number) => {
          const questionId = typeof q === 'string' ? String(idx + 1) : q.id || String(idx + 1);
          initialAnswers[questionId] = '';
        });
        setAnswers(initialAnswers);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les données.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const updateAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleNext = () => {
    const activeSteps = getActiveSteps();
    const currentIndex = activeSteps.indexOf(currentStep);
    if (currentIndex < activeSteps.length - 1) {
      setCurrentStep(activeSteps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const activeSteps = getActiveSteps();
    const currentIndex = activeSteps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(activeSteps[currentIndex - 1]);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (!community) return;

    setIsSubmitting(true);
    try {
      // Build answers array
      const questions = getApplicationQuestions();
      const membershipAnswers: MembershipAnswer[] = [];
      
      questions.forEach((q) => {
        if (answers[q.id]?.trim()) {
          membershipAnswers.push({
            question: q.question,
            answer: answers[q.id].trim(),
          });
        }
      });

      const response = await communityService.join(id!, {
        answers: membershipAnswers.length > 0 ? membershipAnswers : undefined,
        accepted_rules: acceptedRules,
      });

      if (response.data) {
        setCurrentStep('success');
      }
    } catch (error: any) {
      showError(
        'Erreur',
        error.error || 'Une erreur est survenue lors de l\'envoi de votre demande.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isProfileComplete = (): boolean => {
    if (!profile) return false;
    return !!(profile.first_name && profile.last_name && profile.email);
  };

  const canProceed = (): boolean => {
    if (!community) return false;

    switch (currentStep) {
      case 'profile':
        return isProfileComplete();
      case 'rules':
        return acceptedRules;
      case 'questions':
        // Check if all required questions are answered
        const questions = getApplicationQuestions();
        for (const question of questions) {
          if (question.required && !answers[question.id]?.trim()) {
            return false;
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

  const getVisibleSteps = (): JoinStep[] => {
    return getActiveSteps().filter((s) => s !== 'success');
  };

  const renderStepIndicator = () => {
    const visibleSteps = getVisibleSteps();

    return (
      <View style={styles.stepIndicator}>
        {visibleSteps.map((step, index) => {
          const activeSteps = getActiveSteps();
          const isCompleted = activeSteps.indexOf(currentStep) > activeSteps.indexOf(step);
          const isCurrent = currentStep === step;

          return (
            <View key={step} style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  { backgroundColor: colors.gray200 },
                  (isCurrent || isCompleted) && { backgroundColor: colors.primary },
                ]}
              >
                {isCompleted ? (
                  <Check size={12} color={COLORS.white} strokeWidth={3} />
                ) : (
                  <Text style={[styles.stepNumber, isCurrent && { color: COLORS.white }]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  { color: colors.gray500 },
                  isCurrent && { color: colors.primary, fontWeight: TYPOGRAPHY.fontWeight.semibold },
                ]}
              >
                {STEP_TITLES[step]}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderProfileStep = () => {
    const profileComplete = isProfileComplete();

    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <User size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
            Vérifiez votre profil
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Ces informations seront partagées avec les administrateurs
          </Text>
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
          {/* Avatar */}
          <View style={styles.profileHeader}>
            {profile?.profile_picture_url ? (
              <Image source={{ uri: profile.profile_picture_url }} style={styles.profileAvatar} />
            ) : (
              <View style={[styles.profileAvatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.profileAvatarText, { color: colors.primary }]}>
                  {getInitials(profile?.first_name, profile?.last_name)}
                </Text>
              </View>
            )}
          </View>

          {/* Profile Info */}
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.textPrimary }]}>
              {profile?.first_name} {profile?.last_name}
            </Text>
            {profile?.headline && (
              <Text style={[styles.profileHeadline, { color: colors.textSecondary }]}>
                {profile.headline}
              </Text>
            )}
          </View>

          {/* Profile Details */}
          <View style={styles.profileDetails}>
            {profile?.email && (
              <View style={styles.profileDetailRow}>
                <Mail size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.profileDetailText, { color: colors.textSecondary }]}>
                  {profile.email}
                </Text>
              </View>
            )}
            {profile?.phone && (
              <View style={styles.profileDetailRow}>
                <Phone size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.profileDetailText, { color: colors.textSecondary }]}>
                  {profile.phone}
                </Text>
              </View>
            )}
            {(profile?.city || profile?.country) && (
              <View style={styles.profileDetailRow}>
                <MapPin size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.profileDetailText, { color: colors.textSecondary }]}>
                  {[profile.city, profile.country].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}
          </View>

          {/* Warning if profile incomplete */}
          {!profileComplete && (
            <View style={[styles.warningBox, { backgroundColor: colors.warning + '15' }]}>
              <AlertCircle size={20} color={colors.warning} strokeWidth={ICON.strokeWidth} />
              <View style={styles.warningContent}>
                <Text style={[styles.warningTitle, { color: colors.warning }]}>
                  Profil incomplet
                </Text>
                <Text style={[styles.warningText, { color: colors.textSecondary }]}>
                  Complétez votre profil (nom, prénom, email) pour continuer.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity
          style={[styles.editProfileButton, { borderColor: colors.primary }]}
          onPress={() => router.push('/settings/edit-profile')}
        >
          <SquarePen size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.editProfileText, { color: colors.primary }]}>
            Modifier mon profil
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRulesStep = () => {
    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Shield size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
            Règles de la communauté
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Lisez et acceptez les règles pour rejoindre
          </Text>
        </View>

        {/* Rules Box */}
        <View style={[styles.rulesBox, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
          <Text style={[styles.rulesText, { color: colors.textSecondary }]}>
            {community?.rules}
          </Text>
        </View>

        {/* Accept Rules Checkbox */}
        <TouchableOpacity
          style={[styles.checkboxContainer, { borderColor: acceptedRules ? colors.primary : colors.gray300 }]}
          onPress={() => setAcceptedRules(!acceptedRules)}
          activeOpacity={0.7}
        >
          <View style={[
            styles.checkbox,
            { borderColor: acceptedRules ? colors.primary : colors.gray400 },
            acceptedRules && { backgroundColor: colors.primary }
          ]}>
            {acceptedRules && <Check size={14} color={COLORS.white} strokeWidth={3} />}
          </View>
          <Text style={[styles.checkboxLabel, { color: colors.textPrimary }]}>
            J'ai lu et j'accepte les règles de la communauté
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderQuestionsStep = () => {
    const questions = getApplicationQuestions();

    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <FileText size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
            Questions complémentaires
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Répondez aux questions des administrateurs
          </Text>
        </View>

        <View style={styles.formFields}>
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
      </View>
    );
  };

  const renderPreviewStep = () => {
    const questions = getApplicationQuestions();

    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Eye size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
            Vérifiez votre demande
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Avant de soumettre, vérifiez les informations
          </Text>
        </View>

        <View style={styles.previewContainer}>
          {/* Community Info */}
          <View style={[styles.previewSection, { backgroundColor: colors.gray50 }]}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
              Communauté
            </Text>
            <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
              {community?.name}
            </Text>
            <Text style={[styles.previewHint, { color: colors.gray500 }]}>
              {community?.organization?.name}
            </Text>
          </View>

          {/* Profile Preview */}
          <View style={[styles.previewSection, { backgroundColor: colors.primary + '08' }]}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
              Votre profil
            </Text>
            <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
              {profile?.first_name} {profile?.last_name}
            </Text>
            <Text style={[styles.previewHint, { color: colors.gray500 }]}>
              {profile?.email}
            </Text>
          </View>

          {/* Rules accepted */}
          {community?.rules && (
            <View style={styles.previewSection}>
              <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
                Règles
              </Text>
              <View style={styles.previewRulesStatus}>
                <CheckCircle2 size={18} color={colors.success} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.previewRulesText, { color: colors.success }]}>
                  Acceptées
                </Text>
              </View>
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

          {/* Pricing Info */}
          {community?.is_paid && (
            <View style={[styles.previewSection, { backgroundColor: colors.warning + '10' }]}>
              <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
                Abonnement
              </Text>
              <View style={styles.previewPricing}>
                <CreditCard size={18} color={colors.warning} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.previewPricingText, { color: colors.warning }]}>
                  {community.monthly_price?.toLocaleString('fr-FR')} {community.currency || 'XOF'}/mois
                </Text>
              </View>
              <Text style={[styles.previewHint, { color: colors.gray500 }]}>
                Après approbation de votre demande par l'administration, vous pourrez procéder au paiement pour accéder à la communauté.
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderSuccessStep = () => {
    // All memberships now require admin approval
    const isPaid = community?.is_paid;

    return (
      <View style={styles.successContainer}>
        <View style={[styles.successIcon, { backgroundColor: colors.success + '15' }]}>
          <CheckCircle2 size={64} color={colors.success} strokeWidth={ICON.strokeWidth} />
        </View>
        <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
          Demande envoyée !
        </Text>
        <Text style={[styles.successDescription, { color: colors.textSecondary }]}>
          {isPaid 
            ? `Votre demande pour rejoindre "${community?.name}" a bien été envoyée. Après approbation par les administrateurs, vous pourrez procéder au paiement de l'abonnement.`
            : `Votre demande pour rejoindre "${community?.name}" a bien été envoyée. Les administrateurs vous contacteront pour valider votre adhésion.`
          }
        </Text>

        <View style={styles.successActions}>
          <Button
            title="Voir la communauté"
            onPress={() => router.replace(`/details/community/${id}`)}
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
  };

  const renderFooter = () => {
    if (currentStep === 'success') return null;

    const activeSteps = getActiveSteps();
    const isFirstStep = currentStep === activeSteps[0];
    const isPreview = currentStep === 'preview';

    if (isPreview) {
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
                title={isSubmitting ? 'Envoi...' : 'Envoyer ma demande'}
                onPress={handleSubmit}
                disabled={isSubmitting}
                fullWidth
                icon={<Send size={18} color={COLORS.white} strokeWidth={ICON.strokeWidth} />}
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
              icon={<ChevronRight size={18} color={COLORS.white} strokeWidth={ICON.strokeWidth} />}
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

  if (!community) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
          Communauté non trouvée
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
          Rejoindre {community.name}
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
          {currentStep === 'rules' && renderRulesStep()}
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
    color: COLORS.white,
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
    textAlign: 'center',
  },
  profileHeadline: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
    textAlign: 'center',
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
  // Rules Step
  rulesBox: {
    padding: SPACING.lg,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    marginBottom: SPACING.lg,
  },
  rulesText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * 1.6,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BORDER.radius.xs,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  // Questions Step
  formFields: {
    gap: SPACING.lg,
  },
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
  // Preview Step
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
  previewRulesStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  previewRulesText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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
  previewPricing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  previewPricingText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  // Payment info removed - payment happens after admin approval
  paymentInfoText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
  },
  // Success Step
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
    paddingVertical: SPACING.md,
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
