import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Keyboard,
  Modal,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
	import {
	  ArrowLeft,
	  Clock,
	  CheckCircle2,
	  XCircle,
  Eye,
  Star,
  User,
  FileText,
  MessageCircle,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  SquarePen,
  Save,
  X,
  Trash2,
	  ChevronDown,
	  TrendingUp,
	} from 'lucide-react-native';
	import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity, MATCH_COLORS } from '../../../../../src/constants/theme';
	import { Button, FooterNav, IconButton, Input, LoadingShimmer, RadioRow, ShimmerPlaceholder, TabBar } from '../../../../../src/components/ui';
	import { ChatMessage, ChatInput } from '../../../../../src/components/chat';
	import { useTheme } from '../../../../../src/hooks/useTheme';
	import { useI18n } from '../../../../../src/contexts/I18nContext';
	import { API_CONFIG } from '../../../../../src/constants/config';
	import { applicationService, applicationMessageService } from '../../../../../src/services';
import { formatRelativeTime, formatDate } from '../../../../../src/utils/date';
import type { Application, ApplicationMessage, ApplicationStatus } from '../../../../../src/types/models';
import { APPLICATION_STATUS_LABELS } from '../../../../../src/types/models';
import { useAlert } from '../../../../../src/contexts/AlertContext';

// Status configuration - colors are set dynamically using theme colors
const getStatusConfig = (colors: any): Record<ApplicationStatus, { color: string; icon: typeof Clock }> => ({
  SUBMITTED: { color: colors.warning, icon: Clock },
  IN_REVIEW: { color: colors.info, icon: Eye },
  ACCEPTED: { color: colors.success, icon: CheckCircle2 },
  REJECTED: { color: colors.error, icon: XCircle },
});

// Status flow with descriptions - colors are set dynamically using theme colors
const getStatusFlow = (colors: any, t: (key: string) => string): Record<ApplicationStatus, {
  label: string;
  description: string;
  color: string;
}> => ({
  SUBMITTED: {
    label: t('applicationDetail.status.submitted'),
    description: t('applicationDetail.status.submittedDesc'),
    color: colors.warning,
  },
  IN_REVIEW: {
    label: t('applicationDetail.status.inReview'),
    description: t('applicationDetail.status.inReviewDesc'),
    color: colors.info,
  },
  ACCEPTED: {
    label: t('applicationDetail.status.accepted'),
    description: t('applicationDetail.status.acceptedDesc'),
    color: colors.success,
  },
  REJECTED: {
    label: t('applicationDetail.status.rejected'),
    description: t('applicationDetail.status.rejectedDesc'),
    color: colors.error,
  },
});

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Match category configuration - Luxe Africain design system
const getMatchCategoryConfig = (t: (key: string) => string) => ({
  excellent: { label: t('applicationDetail.match.excellent'), color: MATCH_COLORS.excellent.color, bgColor: MATCH_COLORS.excellent.bgColor },
  good: { label: t('applicationDetail.match.good'), color: MATCH_COLORS.good.color, bgColor: MATCH_COLORS.good.bgColor },
  average: { label: t('applicationDetail.match.average'), color: MATCH_COLORS.average.color, bgColor: MATCH_COLORS.average.bgColor },
  low: { label: t('applicationDetail.match.low'), color: MATCH_COLORS.low.color, bgColor: MATCH_COLORS.low.bgColor },
});

type MatchCategory = 'excellent' | 'good' | 'average' | 'low';

type Tab = 'profile' | 'messages' | 'notes';

export default function ApplicationOrgDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const scrollViewRef = useRef<ScrollView>(null);

  const STATUS_CONFIG = getStatusConfig(colors);
  const STATUS_FLOW = getStatusFlow(colors, t);
  const MATCH_CATEGORY_CONFIG = getMatchCategoryConfig(t);

  const [application, setApplication] = useState<Application | null>(null);
  const [messages, setMessages] = useState<ApplicationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Form states
  const [internalNotes, setInternalNotes] = useState('');
  const [rating, setRating] = useState(0);
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // AI Recommendation
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [matchCategory, setMatchCategory] = useState<MatchCategory | null>(null);
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);

  // CV Viewer
  const [showCVViewer, setShowCVViewer] = useState(false);
  const [cvLoadState, setCvLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');

  // Status picker
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const alerts = useAlert();

  // Handle keyboard events
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    loadApplication();
  }, [id]);

  // Reset CV load state when application or resume_url changes
  useEffect(() => {
    if (application?.resume_url) {
      setCvLoadState('loading');
    }
  }, [application?.resume_url]);

  // Timeout: if CV WebView still loading after 8s, show fallback (PDF often doesn't render in WebView)
  useEffect(() => {
    if (!application?.resume_url || cvLoadState !== 'loading') return;
    const t = setTimeout(() => setCvLoadState('error'), 8000);
    return () => clearTimeout(t);
  }, [application?.resume_url, cvLoadState]);

  useEffect(() => {
    if (activeTab === 'messages' && application) {
      loadMessages();
    }
  }, [activeTab, application]);

  const loadApplication = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const response = await applicationService.getApplication(id);
      setApplication(response.data);
      setInternalNotes(response.data.internal_notes || '');
      setRating(response.data.rating || 0);

      // Check for cached recommendation from application data
      if ((response.data as any).ai_recommendation) {
        setRecommendation((response.data as any).ai_recommendation);
      }
      if ((response.data as any).matchCategory) {
        setMatchCategory((response.data as any).matchCategory);
      }

      // Mark as viewed if pending
      if (response.data.status === 'SUBMITTED') {
        await applicationService.markAsViewed(id);
        setApplication((prev) => prev ? { ...prev, status: 'IN_REVIEW' as ApplicationStatus } : null);
      }

      // Load recommendation if not already cached
      if (!(response.data as any).ai_recommendation) {
        loadRecommendation(id);
      }
    } catch (error) {
      void alerts.alert(t('common.error'), t('applicationDetail.loadError'));
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecommendation = async (applicationId: string) => {
    setIsLoadingRecommendation(true);
    try {
      const response = await applicationService.getRecommendation(applicationId);
      if (response.data?.recommendation) {
        setRecommendation(response.data.recommendation);
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading recommendation:', error);
    } finally {
      setIsLoadingRecommendation(false);
    }
  };

  const loadMessages = async () => {
    if (!application) return;

    setIsLoadingMessages(true);
    try {
      const response = await applicationMessageService.getMessages(application.id);
      setMessages(response.data || []);
      await applicationMessageService.markAllAsRead(application.id);
    } catch (error) {
      if (__DEV__) console.error('Error loading messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleUpdateStatus = async (newStatus: ApplicationStatus) => {
    if (!application) return;

    try {
      await applicationService.updateStatus(application.id, newStatus);
      setApplication((prev) => prev ? { ...prev, status: newStatus } : null);
      setShowStatusPicker(false);
      void alerts.alert(t('common.success'), t('applicationDetail.statusUpdated', { status: APPLICATION_STATUS_LABELS[newStatus] }));
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.error || t('applicationDetail.statusUpdateError'));
    }
  };

  const handleDeleteApplication = () => {
    void alerts.showAlert({ title: t('applicationDetail.deleteTitle'), message: t('applicationDetail.deleteConfirm'), buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              // For now, we'll reject the application as there's no delete endpoint
              await applicationService.updateStatus(application!.id, 'REJECTED');
              void alerts.alert(t('common.success'), t('applicationDetail.deleteSuccess'));
              router.back();
            } catch (error: any) {
              void alerts.alert(t('common.error'), error.error || t('applicationDetail.deleteError'));
            }
          },
        },
      ] });
  };

  const handleSaveNotes = async () => {
    if (!application) return;

    try {
      await applicationService.updateNotes(application.id, internalNotes);
      setIsEditingNotes(false);
      void alerts.alert(t('common.success'), t('applicationDetail.notesSaved'));
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.error || t('applicationDetail.notesSaveError'));
    }
  };

  const handleUpdateRating = async (newRating: number) => {
    if (!application) return;

    try {
      await applicationService.updateRating(application.id, newRating);
      setRating(newRating);
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.error || t('applicationDetail.ratingUpdateError'));
    }
  };

  const handleSendMessage = async (data: {
    content: string;
    attachments?: { name: string; uri: string; type: string; size?: number }[];
    proposedDatetime?: string;
    datetimeType?: string;
  }) => {
    if (!application) return;

    setIsSending(true);
    try {
      const response = await applicationMessageService.sendMessage(application.id, {
        content: data.content,
        attachments: data.attachments?.map(a => ({
          name: a.name,
          url: a.uri, // In production, upload first and use returned URL
          type: a.type,
          size: a.size || 0,
        })),
        proposed_datetime: data.proposedDatetime,
        datetime_type: data.datetimeType as any,
      });

      setMessages((prev) => [...prev, response.data]);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.error || t('applicationDetail.sendMessageError'));
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (firstName?: string, lastName?: string): string => {
    const f = firstName?.[0] || '';
    const l = lastName?.[0] || '';
    return (f + l).toUpperCase() || '?';
  };

  // Server path wrongly returned as file:///uploads/... → convert to HTTP URL
  const getResumeOpenUrl = (url: string) => {
    if (url.startsWith('file:///uploads/') || (url.startsWith('file://') && url.includes('/uploads/'))) {
      const path = url.replace(/^file:\/\//, '');
      const base = API_CONFIG.BASE_URL.replace(/\/$/, '');
      return `${base}/${path.startsWith('/') ? path.slice(1) : path}`;
    }
    return url;
  };

  // True only for real local device paths (e.g. file:///var/... or file:///data/...), not server path
  const isLocalFile = (url: string) =>
    url.startsWith('file://') && !url.startsWith('file:///uploads/') && !url.includes('/uploads/');

  // Open CV - handles local files, server paths (file:///uploads/...) and remote HTTP URLs
  const handleOpenCV = async () => {
    if (!application?.resume_url) return;

    const openUrl = getResumeOpenUrl(application.resume_url);

    try {
      if (isLocalFile(application.resume_url)) {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          const fileInfo = await FileSystem.getInfoAsync(application.resume_url);
          if (fileInfo.exists) {
            await Sharing.shareAsync(application.resume_url, {
              mimeType: 'application/pdf',
              dialogTitle: t('applicationDetail.cvDialogTitle'),
            });
          } else {
            void alerts.alert(t('applicationDetail.cvFileNotFound'), t('applicationDetail.cvFileNotFoundDesc'));
          }
        } else {
          void alerts.alert(t('applicationDetail.sharingUnavailable'), t('applicationDetail.sharingUnavailableDesc'));
        }
      } else {
        await Linking.openURL(openUrl);
      }
    } catch (error) {
      if (__DEV__) console.error('Error opening CV:', error);
      void alerts.alert(t('common.error'), t('applicationDetail.cvOpenError'));
    }
  };

	  const renderProfileTab = () => {
	    const talent = application?.talent;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Talent Info */}
        <View style={[styles.profileHeader, { backgroundColor: colors.gray50 }]}>
          {(talent?.profile_picture_url || talent?.avatar_url) ? (
            <Image source={{ uri: (talent.profile_picture_url || talent.avatar_url)! }} style={styles.profileAvatar} />
          ) : (
            <View style={[styles.profileAvatarPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[20]) }]}>
              <Text style={[styles.profileAvatarText, { color: colors.primary }]}>
                {getInitials(talent?.first_name, talent?.last_name)}
              </Text>
            </View>
          )}
          <Text style={[styles.profileName, { color: colors.textPrimary }]}>
            {talent ? `${talent.first_name} ${talent.last_name}` : t('common.candidate')}
          </Text>
          {talent?.headline && (
            <Text style={[styles.profileHeadline, { color: colors.gray500 }]}>
              {talent.headline}
            </Text>
          )}
        </View>

        {/* Talent Details - Before Rating */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('applicationDetail.information')}</Text>

          {/* Location */}
          {(talent?.city || talent?.country) && (
            <View style={styles.infoRow}>
              <MapPin size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                {[talent?.city, talent?.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}

          {/* Email */}
          {talent?.email && (
            <View style={styles.infoRow}>
              <Mail size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                {talent.email}
              </Text>
            </View>
          )}

          {/* Phone */}
          {talent?.phone && (
            <View style={styles.infoRow}>
              <Phone size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                {talent.phone}
              </Text>
            </View>
          )}

          {/* Bio */}
          {talent?.bio && (
            <View style={[styles.bioContainer, { marginTop: SPACING.sm, borderTopColor: colors.borderColor }]}>
              <Text style={[styles.bioText, { color: colors.textSecondary }]}>
                {talent.bio}
              </Text>
            </View>
          )}
        </View>

	        {/* Rating - Évaluation du candidat */}
	        <View style={[styles.section, { borderColor: colors.gray200 }]}>
	          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('applicationDetail.candidateRating')}</Text>
	          <View style={styles.ratingContainer}>
	            {[1, 2, 3, 4, 5].map((star) => (
	              <IconButton
	                key={star}
	                onPress={() => handleUpdateRating(star)}
	                icon={
	                  <Star
	                    size={28}
	                    color={star <= rating ? colors.warning : colors.gray300}
	                    fill={star <= rating ? colors.warning : 'transparent'}
	                    strokeWidth={ICON.strokeWidth}
	                  />
	                }
	                accessibilityLabel={`Noter ${star} étoile${star > 1 ? 's' : ''}`}
	                size="md"
	                variant="ghost"
	                style={{ width: 40, height: 40 }}
	              />
	            ))}
	          </View>
	        </View>

        {/* Recommendation */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
          <View style={styles.recommendationHeader}>
            <Text style={[styles.sectionTitle, { color: colors.gray700, marginBottom: 0 }]}>
              {t('applicationDetail.recommendation')}
            </Text>
            {matchCategory && (
              <View style={[styles.matchCategoryBadge, { backgroundColor: MATCH_CATEGORY_CONFIG[matchCategory].bgColor }]}>
                <TrendingUp size={12} color={MATCH_CATEGORY_CONFIG[matchCategory].color} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.matchCategoryText, { color: MATCH_CATEGORY_CONFIG[matchCategory].color }]}>
                  {MATCH_CATEGORY_CONFIG[matchCategory].label}
                </Text>
              </View>
            )}
          </View>
          {isLoadingRecommendation ? (
            <View style={styles.recommendationLoading}>
              <ShimmerPlaceholder width={24} height={14} variant="bar" />
              <Text style={[styles.recommendationLoadingText, { color: colors.gray500 }]}>
                {t('applicationDetail.analyzing')}
              </Text>
            </View>
          ) : recommendation ? (
            <View style={[styles.recommendationContent, { backgroundColor: colors.gray50 }]}>
              <Text style={[styles.recommendationText, { color: colors.textSecondary }]}>
                {recommendation}
              </Text>
            </View>
          ) : (
            <Text style={[styles.noRecommendationText, { color: colors.gray400 }]}>
              {t('applicationDetail.recommendationAuto')}
            </Text>
          )}
        </View>

        {/* Current Status with Picker */}
        {application?.status && (
          <View style={[styles.section, { borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('applicationDetail.applicationStatus')}</Text>

            {/* Current status display */}
            <View style={[styles.currentStatusDisplay, { backgroundColor: withOpacity(STATUS_FLOW[application.status as ApplicationStatus]?.color || colors.warning, OPACITY[10]) }]}>
              {(() => {
                const config = STATUS_CONFIG[application.status as ApplicationStatus] || STATUS_CONFIG.SUBMITTED;
                const StatusIcon = config.icon;
                return <StatusIcon size={20} color={STATUS_FLOW[application.status as ApplicationStatus]?.color || colors.warning} strokeWidth={ICON.strokeWidth} />;
              })()}
              <Text style={[styles.currentStatusDisplayText, { color: STATUS_FLOW[application.status as ApplicationStatus]?.color || colors.warning }]}>
                {STATUS_FLOW[application.status as ApplicationStatus]?.label || application.status}
              </Text>
            </View>

            {/* Status picker */}
	            <Button
	              title={t('applicationDetail.changeStatus')}
	              onPress={() => setShowStatusPicker(!showStatusPicker)}
	              variant="secondary"
	              fullWidth
	              icon={
	                <ChevronDown
	                  size={20}
	                  color={colors.gray500}
	                  strokeWidth={ICON.strokeWidth}
	                  style={{ transform: [{ rotate: showStatusPicker ? '180deg' : '0deg' }] }}
	                />
	              }
	              iconPosition="right"
	              style={[styles.statusPickerButton, { borderColor: colors.gray300, backgroundColor: colors.gray100 }]}
	              textStyle={[styles.statusPickerButtonText, { color: colors.textPrimary }]}
	            />

            {/* Status options */}
            {showStatusPicker && (
              <View style={[styles.statusOptions, { borderColor: colors.gray200, backgroundColor: colors.surface }]}>
                {(Object.keys(STATUS_FLOW) as ApplicationStatus[])
                  .filter(status => status !== application.status)
                  .map((status) => {
                    const config = STATUS_CONFIG[status];
                    const flow = STATUS_FLOW[status];
                    const Icon = config.icon;

	                    return (
	                      <RadioRow
	                        key={status}
	                        onPress={() => handleUpdateStatus(status)}
	                        selected={false}
	                        title={flow.label}
	                        description={flow.description}
	                        icon={
	                          <View style={[styles.statusOptionIcon, { backgroundColor: withOpacity(config.color, OPACITY[15]) }]}>
	                            <Icon size={16} color={config.color} strokeWidth={ICON.strokeWidth} />
	                          </View>
	                        }
	                        style={[styles.statusOption, { borderBottomColor: colors.gray200, backgroundColor: colors.surface }]}
	                        titleStyle={[styles.statusOptionLabel, { color: colors.textPrimary }]}
	                        descriptionStyle={[styles.statusOptionDesc, { color: colors.gray500 }]}
	                        iconContainerStyle={{ width: undefined, height: undefined, borderRadius: 0 }}
	                        radioStyle={{ width: 0, height: 0, borderWidth: 0, opacity: 0 }}
	                      />
	                    );
	                  })}
	              </View>
            )}
          </View>
        )}

        {/* Informations complémentaires */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('applicationDetail.additionalInfo')}</Text>

          {/* CV Viewer */}
          {application?.resume_url && (
            <>
              <Text style={[styles.subsectionTitle, { color: colors.gray600 }]}>{t('applicationDetail.candidateCV')}</Text>
              <View style={[styles.cvContainer, { borderColor: colors.gray200 }]}>
                {cvLoadState === 'error' ? (
                  <View style={[styles.cvFallback, { backgroundColor: colors.gray50 }]}>
                    <FileText size={40} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.cvFallbackTitle, { color: colors.textPrimary }]}>
                      {t('applicationDetail.cvDisplayUnavailable')}
                    </Text>
                    <Text style={[styles.cvFallbackText, { color: colors.gray500 }]}>
                      {t('applicationDetail.cvDisplayHint')}
                    </Text>
                  </View>
                ) : (
                  <>
                    <WebView
                      source={{ uri: getResumeOpenUrl(application.resume_url) }}
                      style={[styles.cvWebView, { backgroundColor: colors.gray50 }]}
                      originWhitelist={['*']}
                      allowFileAccess={true}
                      allowFileAccessFromFileURLs={true}
                      allowUniversalAccessFromFileURLs={true}
                      startInLoadingState={false}
                      onLoadEnd={() => setCvLoadState('loaded')}
                      onError={() => setCvLoadState('error')}
                      onHttpError={() => setCvLoadState('error')}
                    />
                    {cvLoadState === 'loading' && (
                      <View style={[StyleSheet.absoluteFill, styles.cvLoading, { backgroundColor: colors.gray50 }]} pointerEvents="none">
                        <LoadingShimmer variant="inline" label={t('applicationDetail.loadingCV')} />
                      </View>
                    )}
                  </>
                )}
              </View>

	              <Button
	                title={t('applicationDetail.openCV')}
	                onPress={handleOpenCV}
	                variant="outline"
	                icon={<FileText size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
	                iconPosition="left"
	                style={[styles.cvDownloadButton, { borderColor: colors.primary }]}
	                textStyle={[styles.cvDownloadButtonText, { color: colors.primary }]}
	              />
            </>
          )}

          {/* Questions complémentaires */}
          {application?.opportunity?.application_questions && application.opportunity.application_questions.length > 0 && (
            <>
              {application?.resume_url && (
                <View style={[styles.separator, { backgroundColor: colors.gray200, marginVertical: SPACING.md }]} />
              )}
              <Text style={[styles.subsectionTitle, { color: colors.gray600 }]}>{t('applicationDetail.additionalQuestions')}</Text>
              {application.opportunity.application_questions.map((question, index) => {
                const answer = application.answers?.find((a) => a.question_id === question.id);
                return (
                  <View key={question.id} style={[styles.qaItem, index > 0 && { borderTopColor: colors.gray200, borderTopWidth: 1, paddingTop: SPACING.md, marginTop: SPACING.md }]}>
                    <Text style={[styles.qaQuestion, { color: colors.gray600 }]}>
                      {question.question}
                      {question.required && <Text style={{ color: colors.error }}> *</Text>}
                    </Text>
                    {answer ? (
                      <Text style={[styles.qaAnswer, { color: colors.textPrimary }]}>
                        {answer.answer}
                      </Text>
                    ) : (
                      <Text style={[styles.qaAnswer, { color: colors.gray400, fontStyle: 'italic' }]}>
                        {t('applicationDetail.noAnswer')}
                      </Text>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* Final status message */}
        {application?.status === 'ACCEPTED' && (
          <View style={[styles.finalStatusCard, { backgroundColor: withOpacity(colors.success, OPACITY[10]), borderColor: withOpacity(colors.success, OPACITY[30]) }]}>
            <Text style={[styles.finalStatusText, { color: colors.success }]}>
              {t('applicationDetail.candidateAccepted')}
            </Text>
          </View>
        )}

        {/* Delete application */}
        <Button
          title={t('applicationDetail.deleteApplication')}
          onPress={handleDeleteApplication}
          variant="outline"
          fullWidth
          icon={<Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />}
          style={[styles.deleteButton, { borderColor: colors.error }]}
          textStyle={[styles.deleteButtonText, { color: colors.error }]}
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  };

  const renderNotesTab = () => (
    <View style={styles.tabContent}>
        <View style={[styles.notesCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
          <View style={styles.notesHeader}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('applicationDetail.internalNotes')}</Text>
            <IconButton
              onPress={() => isEditingNotes ? handleSaveNotes() : setIsEditingNotes(true)}
              size="sm"
              icon={
                isEditingNotes
                  ? <Save size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                  : <SquarePen size={20} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              }
              accessibilityLabel={isEditingNotes ? 'Enregistrer' : 'Modifier'}
            />
          </View>
          <Input
            placeholder={t('applicationDetail.notesPlaceholder')}
            placeholderTextColor={colors.gray400}
          value={internalNotes}
          onChangeText={setInternalNotes}
          multiline
          numberOfLines={8}
          editable={isEditingNotes}
          inputContainerStyle={{
            backgroundColor: colors.gray50,
            borderWidth: 0,
            minHeight: 150,
            borderRadius: BORDER.radius.sm,
          }}
          inputStyle={{
            color: colors.textPrimary,
            padding: SPACING.md,
            fontSize: TYPOGRAPHY.fontSize.md,
            textAlignVertical: 'top',
          }}
        />
        <Text style={[styles.notesHint, { color: colors.gray400 }]}>
          {t('applicationDetail.notesHint')}
        </Text>
      </View>
    </View>
  );

  const renderMessagesTab = () => {
    if (isLoadingMessages) {
      return (
        <View style={styles.loadingMessages}>
          <LoadingShimmer variant="fullPage" />
        </View>
      );
    }

    return (
      <View style={styles.messagesContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesList}
          contentContainerStyle={[
            styles.messagesContent,
            { paddingBottom: keyboardHeight > 0 ? SPACING.md : SPACING.lg },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (keyboardHeight > 0) {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }
          }}
        >
          {messages.length === 0 ? (
            <View style={styles.noMessages}>
              <MessageCircle size={48} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.noMessagesTitle, { color: colors.textPrimary }]}>
                {t('applicationDetail.noMessages')}
              </Text>
              <Text style={[styles.noMessagesText, { color: colors.gray500 }]}>
                {t('applicationDetail.noMessagesHint')}
              </Text>
            </View>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                content={message.content}
                isMe={message.sender_type === 'ORGANIZATION'}
                senderName={message.sender_type === 'TALENT' ? (message.sender_name || application?.talent?.first_name || t('common.candidate')) : undefined}
                createdAt={message.created_at}
                proposedDatetime={message.proposed_datetime}
                datetimeType={message.datetime_type}
                attachments={message.attachments}
              />
            ))
          )}
        </ScrollView>

        {/* Message Input */}
        <ChatInput
          onSend={handleSendMessage}
          isSending={isSending}
          placeholder={t('applicationDetail.writeMessage')}
          showDatetimeOption={true}
        />
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

  if (!application) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
          {t('applicationDetail.notFound')}
        </Text>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[application.status as ApplicationStatus] || STATUS_CONFIG.SUBMITTED;
  const StatusIcon = statusConfig.icon;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel="Retour"
        />
        <View style={styles.headerContent}>
          <View style={[styles.statusBadge, { backgroundColor: withOpacity(statusConfig.color, OPACITY[15]) }]}>
            <StatusIcon size={14} color={statusConfig.color} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {APPLICATION_STATUS_LABELS[application.status]}
            </Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
	      <TabBar
	        tabs={[
	          { key: 'profile', label: t('applicationDetail.tabProfile'), icon: User },
	          { key: 'messages', label: t('applicationDetail.tabMessages'), icon: MessageCircle },
	          { key: 'notes', label: t('applicationDetail.tabNotes'), icon: SquarePen },
	        ]}
	        activeTab={activeTab}
	        onTabChange={(key) => setActiveTab(key as Tab)}
	      />

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.contentContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'messages' && renderMessagesTab()}
        {activeTab === 'notes' && renderNotesTab()}

      </KeyboardAvoidingView>

      {/* CV Fullscreen Modal - Only for remote URLs */}
      {application?.resume_url && !isLocalFile(application.resume_url) && (
        <Modal
          visible={showCVViewer}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowCVViewer(false)}
        >
	          <SafeAreaView style={[styles.cvModalContainer, { backgroundColor: colors.background }]}>
	            <View style={[styles.cvModalHeader, { borderBottomColor: colors.gray200 }]}>
	              <Text style={[styles.cvModalTitle, { color: colors.textPrimary }]}>CV du candidat</Text>
	              <View style={styles.cvModalHeaderActions}>
	                <Button
	                  title="Ouvrir externe"
	                  onPress={handleOpenCV}
	                  variant="secondary"
	                  size="sm"
	                  style={[styles.cvModalOpenExternal, { backgroundColor: colors.gray100 }]}
	                  textStyle={[styles.cvModalOpenExternalText, { color: colors.primary }]}
	                />
	                <IconButton
	                  onPress={() => setShowCVViewer(false)}
	                  icon={<X size={24} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
	                  accessibilityLabel="Fermer"
	                  size="sm"
	                  variant="ghost"
	                  style={styles.cvModalCloseButton}
	                />
	              </View>
	            </View>
            <WebView
              source={{ uri: getResumeOpenUrl(application.resume_url) }}
              style={styles.cvModalWebView}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.cvModalLoading}>
                  <LoadingShimmer variant="inline" label={t('applicationDetail.loadingCV')} />
                </View>
              )}
            />
          </SafeAreaView>
        </Modal>
      )}

      {/* Footer Navigation */}
      <FooterNav activeTab="home" />
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
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },

  errorText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerContent: {
    flex: 1,
    alignItems: 'center',
  },

  headerSpacer: {
    width: 40,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.full,
  },

  statusText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: BORDER.width.thin,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },

  tabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  contentContainer: {
    flex: 1,
  },

  tabContent: {
    flex: 1,
    padding: SPACING.lg,
  },

  profileHeader: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.md,
  },

  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: SPACING.md,
  },

  profileAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },

  profileAvatarText: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  profileName: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  profileHeadline: {
    fontSize: TYPOGRAPHY.fontSize.md,
    marginTop: 4,
  },

  ratingContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
  },

  // Recommendation styles
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  matchCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },

  matchCategoryText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  recommendationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
  },

  recommendationLoadingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  recommendationContent: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
  },

  recommendationText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },

  noRecommendationText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontStyle: 'italic',
  },

  section: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    marginBottom: SPACING.md,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },

  subsectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },

  separator: {
    height: 1,
    width: '100%',
  },

  noAnswersContainer: {
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noAnswersText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontStyle: 'italic',
  },

  contactText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  cvButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.md,
  },

  cvButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  currentStatusCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },

  currentStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },

  currentStatusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },

  currentStatusInfo: {
    flex: 1,
  },

  currentStatusLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  currentStatusText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  // New status display
  currentStatusDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.sm,
  },

  currentStatusDisplayText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Status picker
  statusPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
  },

  statusPickerButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  statusOptions: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
  },

  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderBottomWidth: 1,
  },

  statusOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusOptionInfo: {
    flex: 1,
  },

  statusOptionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  statusOptionDesc: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  // Delete button
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.md,
  },

  deleteButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  currentStatusDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginLeft: 40,
  },

  actionsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    minHeight: 100,
  },

  actionButtonLabel: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginTop: SPACING.sm,
  },

  actionButtonDesc: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    marginTop: 2,
  },

  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
  },

  rejectButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  finalStatusCard: {
    padding: SPACING.lg,
    borderRadius: BORDER.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },

  finalStatusText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textAlign: 'center',
  },

  bottomSpacer: {
    height: SPACING.xl,
  },

  noContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    minHeight: 200,
  },

  noContentText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  answerCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    marginBottom: SPACING.md,
  },

  answerQuestion: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xs,
  },

  answerText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  notesCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
  },

  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  notesInput: {
    minHeight: 150,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlignVertical: 'top',
  },

  notesHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.sm,
  },

  messagesContainer: {
    flex: 1,
  },

  loadingMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  messagesList: {
    flex: 1,
  },

  messagesContent: {
    padding: SPACING.lg,
    flexGrow: 1,
  },

  noMessages: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    minHeight: 300,
  },

  noMessagesTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },

  noMessagesText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },

  modal: {
    width: '100%',
    padding: SPACING.lg,
    borderRadius: BORDER.radius.lg,
    maxHeight: '80%',
  },

  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.lg,
  },

  modalField: {
    marginBottom: SPACING.md,
  },

  modalLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
  },

  dateButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  modalInput: {
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },

  modalButton: {
    flex: 1,
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
  },

  modalButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  modalButtonPrimary: {
    flex: 1,
  },

  // Talent Info
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  infoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },

  bioContainer: {
    paddingTop: SPACING.sm,
    borderTopWidth: BORDER.width.thin,
    borderTopColor: 'transparent',
  },

  bioText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },

  // CV Viewer
  cvContainer: {
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
    borderWidth: BORDER.width.thin,
    minHeight: 280,
    position: 'relative',
  },

  cvWebView: {
    height: 400,
  },

  cvLoading: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  cvLoadingText: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  cvFallback: {
    minHeight: 280,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cvFallbackTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.md,
    textAlign: 'center',
  },

  cvFallbackText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },

  cvPlaceholder: {
    padding: SPACING.xl,
    borderRadius: BORDER.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cvPlaceholderText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.md,
  },

  cvPlaceholderHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  cvOpenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    marginTop: SPACING.sm,
  },

  cvOpenButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  cvDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },

  cvDownloadButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Questions & Answers
  qaItem: {
    marginBottom: SPACING.md,
  },

  qaQuestion: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  qaAnswer: {
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: 22,
  },

  // CV Modal
  cvModalContainer: {
    flex: 1,
  },

  cvModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },

  cvModalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    flex: 1,
  },

  cvModalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  cvModalOpenExternal: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER.radius.sm,
  },

  cvModalOpenExternalText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  cvModalCloseButton: {
    padding: SPACING.sm,
  },

  cvModalWebView: {
    flex: 1,
  },

  cvModalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
