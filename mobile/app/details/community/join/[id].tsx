import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  FileText,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../../src/constants/theme';
import { Button, IconButton, Input, SelectCard, StepIndicator, LoadingShimmer } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { useAuth } from '../../../../src/contexts/AuthContext';
import { useAlert } from '../../../../src/contexts/AlertContext';
import { useI18n } from '../../../../src/contexts/I18nContext';
import { ScrollToInputContext } from '../../../../src/contexts/ScrollToInputContext';
import { communityService, talentService, kycService, MembershipAnswer } from '../../../../src/services';
import type { Community, ApplicationQuestion, TalentObjectData } from '../../../../src/types/models';
// Getter functions available if needed: getVisibilityLabel, getCommunityTypeLabel from types/models
import { getFullImageUrl } from '../../../../src/utils/image';

type JoinStep = 'profile' | 'rules' | 'questions' | 'preview' | 'success';

const STEPS: JoinStep[] = ['profile', 'rules', 'questions', 'preview', 'success'];

const STEP_TITLES: Record<JoinStep, string> = {
  profile: 'community.joinFlow.steps.profile',
  rules: 'community.joinFlow.steps.rules',
  questions: 'community.joinFlow.steps.questions',
  preview: 'community.joinFlow.steps.preview',
  success: 'community.joinFlow.steps.confirmation',
};

const MAX_ANSWER_LENGTH = 200;

export default function JoinCommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { error: showError, success: showSuccess } = useAlert();
  const mainScrollRef = useRef<ScrollView>(null);

  const scrollToInput = useCallback((targetNodeHandle: number, extraOffset = 96) => {
    const sv = mainScrollRef.current;
    if (!sv) return;
    const delay = Platform.OS === 'android' ? 120 : 0;
    setTimeout(() => {
      sv.scrollResponderScrollNativeHandleToKeyboard(targetNodeHandle, extraOffset, true);
    }, delay);
  }, []);

  const [currentStep, setCurrentStep] = useState<JoinStep>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [community, setCommunity] = useState<Community | null>(null);
  const [profile, setProfile] = useState<TalentObjectData | null>(null);

  // Form state
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const alerts = useAlert();

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
      // KYC gate: identity verification required
      try {
        const kycRes = await kycService.getStatus();
        if (!kycRes?.data || kycRes.data.status !== 'VERIFIED') {
          void alerts.showAlert({ title: t('screens.settings.kycRequiredTitle'), message: t('community.joinFlow.kycRequiredMessage'), buttons: [
              { text: t('common.cancel'), style: 'cancel', onPress: () => router.back() },
              { text: t('screens.settings.kycVerifyIdentity'), onPress: () => { router.back(); router.push('/settings/kyc'); } },
            ] });
          setIsLoading(false);
          return;
        }
      } catch {
        void alerts.showAlert({ title: t('screens.settings.kycRequiredTitle'), message: t('community.joinFlow.kycRequiredMessage'), buttons: [
            { text: t('common.cancel'), style: 'cancel', onPress: () => router.back() },
            { text: t('screens.settings.kycVerifyIdentity'), onPress: () => { router.back(); router.push('/settings/kyc'); } },
          ] });
        setIsLoading(false);
        return;
      }

      // Check if already member
      const membershipResponse = await communityService.checkMembership(id);
      if (membershipResponse.data?.is_member) {
        void alerts.showAlert({ title: t('common.information'), message: t('community.alreadyMember'), buttons: [
          { text: t('common.close'), onPress: () => router.back() }
        ] });
        return;
      }
      if (membershipResponse.data?.has_pending_request) {
        void alerts.showAlert({ title: t('community.joinFlow.pendingTitle'), message: t('community.joinFlow.pendingMessage'), buttons: [
          { text: t('common.close'), onPress: () => router.back() }
        ] });
        return;
      }

      const [communityResponse, profileResponse] = await Promise.all([
        communityService.getById(id),
        talentService.getMyTalentObject({ includeHidden: false }).catch(() => talentService.getMyProfile().then(r => {
          const p = r.data as any;
          return { data: { ...p, avatar_url: p.avatar_url || p.profile_picture_url || null, display_name: `${p.first_name || ''} ${p.last_name || ''}`.trim(), skills: p.skills || [], sectors: p.sectors || [], goals: p.goals || [], profile_tags: p.profile_tags || [], documents_metadata: [], remote_ready: false, willing_to_relocate: false } as any };
        }).catch(() => null)),
      ]);

      setCommunity(communityResponse.data);
      if (profileResponse?.data) {
        setProfile(profileResponse.data);
      }

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
      void alerts.alert(t('common.error'), t('common.genericError'));
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
        t('common.error'),
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

    // Create step objects for the indicator
    const stepsData = visibleSteps.map(step => ({
      id: step,
      label: t(STEP_TITLES[step]),
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
            {t('community.joinFlow.profile.title')}
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            {t('community.joinFlow.profile.description')}
          </Text>
        </View>

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

          {profile?.skills && profile.skills.length > 0 && (
            <View style={[styles.profileTagsSection, { borderTopColor: colors.borderColor }]}>
              <Text style={[styles.profileTagsLabel, { color: colors.gray500 }]}>{t('profile.skills')}</Text>
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

          {!profileComplete && (
            <View style={[styles.warningBox, { backgroundColor: withOpacity(colors.warning, OPACITY[15]) }]}>
              <AlertCircle size={20} color={colors.warning} strokeWidth={ICON.strokeWidth} />
              <View style={styles.warningContent}>
                <Text style={[styles.warningTitle, { color: colors.warning }]}>{t('community.joinFlow.profile.incompleteTitle')}</Text>
                <Text style={[styles.warningText, { color: colors.textSecondary }]}>
                  {t('community.joinFlow.profile.incompleteDesc')}
                </Text>
              </View>
            </View>
          )}
        </View>

        <Button
          title={t('settings.editProfile')}
          onPress={() => router.push('/settings/edit-profile')}
          variant="outline"
          fullWidth
          icon={<SquarePen size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
        />
      </View>
    );
  };

  const renderRulesStep = () => {
    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Shield size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
            {t('community.joinFlow.rules.title')}
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            {t('community.joinFlow.rules.description')}
          </Text>
        </View>

        {/* Rules Box */}
        <View style={[styles.rulesBox, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
          <Text style={[styles.rulesText, { color: colors.textSecondary }]}>
            {community?.rules}
          </Text>
        </View>

        {/* Accept Rules Checkbox */}
        <SelectCard
          style={[
            styles.checkboxContainer,
            { borderColor: acceptedRules ? colors.primary : colors.gray300, backgroundColor: 'transparent' },
          ]}
          onPress={() => setAcceptedRules(!acceptedRules)}
          selected={false}
          accessibilityLabel={t('community.joinFlow.rules.acceptA11y')}
        >
          <View style={[
            styles.checkbox,
            { borderColor: acceptedRules ? colors.primary : colors.gray400 },
            acceptedRules && { backgroundColor: colors.primary }
          ]}>
            {acceptedRules && <Check size={14} color={colors.textOnPrimary} strokeWidth={3} />}
          </View>
          <Text style={[styles.checkboxLabel, { color: colors.textPrimary }]}>
            {t('community.joinFlow.rules.acceptLabel')}
          </Text>
        </SelectCard>
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
            {t('community.joinFlow.questions.title')}
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            {t('community.joinFlow.questions.description')}
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
                <Input
                  placeholder={t('common.yourAnswer')}
                  placeholderTextColor={colors.gray400}
                  value={answers[question.id] || ''}
                  onChangeText={(text) => updateAnswer(question.id, text)}
                  maxLength={question.max_length || MAX_ANSWER_LENGTH}
                  multiline
                  numberOfLines={3}
                  inputContainerStyle={{
                    borderWidth: 0,
                    backgroundColor: 'transparent',
                    height: undefined,
                    minHeight: undefined,
                  }}
                  inputStyle={{
                    color: colors.textPrimary,
                    paddingHorizontal: 0,
                    paddingTop: 0,
                    paddingBottom: 0,
                    fontSize: TYPOGRAPHY.fontSize.md,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
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
            {t('community.joinFlow.preview.title')}
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            {t('community.joinFlow.preview.description')}
          </Text>
        </View>

        <View style={styles.previewContainer}>
          {/* Community Info */}
          <View style={[styles.previewSection, { backgroundColor: colors.gray50 }]}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
              {t('myCommunities.detail.sections.community')}
            </Text>
            <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
              {community?.name}
            </Text>
            <Text style={[styles.previewHint, { color: colors.gray500 }]}>
              {community?.organization?.name}
            </Text>
          </View>

          {/* Profile Preview */}
          <View style={[styles.previewSection, { backgroundColor: withOpacity(colors.primary, OPACITY[8]) }]}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
              {t('community.joinFlow.preview.yourProfile')}
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
                {t('community.joinFlow.preview.rules')}
              </Text>
              <View style={styles.previewRulesStatus}>
                <CheckCircle2 size={18} color={colors.success} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.previewRulesText, { color: colors.success }]}>
                  {t('community.joinFlow.preview.accepted')}
                </Text>
              </View>
            </View>
          )}

          {/* Answers Preview */}
          {questions.length > 0 && (
            <View style={styles.previewSection}>
              <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
                {t('myCommunities.detail.sections.answers')}
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

  const renderSuccessStep = () => {
    return (
      <View style={styles.successContainer}>
        <View style={[styles.successIcon, { backgroundColor: withOpacity(colors.success, OPACITY[15]) }]}>
          <CheckCircle2 size={64} color={colors.success} strokeWidth={ICON.strokeWidth} />
        </View>
        <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
          {t('community.joinFlow.success.title')}
        </Text>
        <Text style={[styles.successDescription, { color: colors.textSecondary }]}>
          {t('community.joinFlow.success.description', { name: community?.name })}
        </Text>

        <View style={styles.successActions}>
          <Button
            title={t('myCommunities.detail.viewCommunity')}
            onPress={() => router.replace(`/details/community/${id}`)}
            fullWidth
          />
          <Button
            title={t('myCommunities.explore')}
            onPress={() => router.replace('/(tabs)/explore')}
            variant="ghost"
            fullWidth
            style={styles.backToExploreButton}
            textStyle={[styles.backToExploreText, { color: colors.primary }]}
          />
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
        <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: Math.max(SPACING.lg, insets.bottom + SPACING.md) }]}>
          <View style={styles.footerButtons}>
            <Button
              title={t('common.back')}
              onPress={handleBack}
              disabled={isSubmitting}
              variant="outline"
              icon={<ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />}
              style={[styles.backButton, { borderColor: colors.gray300 }]}
              textStyle={[styles.backButtonText, { color: colors.gray700 }]}
            />
            <View style={styles.submitButton}>
              <Button
                title={isSubmitting ? t('common.sending') : t('community.joinFlow.submit')}
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
      <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: Math.max(SPACING.lg, insets.bottom + SPACING.md) }]}>
        <View style={styles.footerButtons}>
          <Button
            title={isFirstStep ? t('common.cancel') : t('common.back')}
            onPress={handleBack}
            variant="outline"
            icon={<ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />}
            style={[styles.backButton, { borderColor: colors.gray300 }]}
            textStyle={[styles.backButtonText, { color: colors.gray700 }]}
          />
          <View style={styles.continueButton}>
            <Button
              title={t('common.continue')}
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
        <LoadingShimmer variant="fullPage" />
      </SafeAreaView>
    );
  }

  if (!community) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
          {t('community.notFound')}
        </Text>
        <Button title={t('common.back')} onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          onPress={handleBack}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel={t('common.back')}
          size="sm"
          variant="ghost"
          style={styles.headerBackButton}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {t('community.join')} {community.name}
        </Text>
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
            {currentStep !== 'success' && renderStepIndicator()}

            {currentStep === 'profile' && renderProfileStep()}
            {currentStep === 'rules' && renderRulesStep()}
            {currentStep === 'questions' && renderQuestionsStep()}
            {currentStep === 'preview' && renderPreviewStep()}
            {currentStep === 'success' && renderSuccessStep()}
          </ScrollView>

          {renderFooter()}
        </ScrollToInputContext.Provider>
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
