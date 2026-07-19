import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Star,
  Mail,
	  MapPin,
	  Phone,
	  User,
	  SquarePen,
	  Save,
	  Trash2,
	  ChevronDown,
  UserX,
  MessageCircle,
  FileText,
  Calendar,
  BarChart2,
  Shield,
  RefreshCw,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../../../src/constants/theme';
	import { Button, FooterNav, IconButton, Input, TabBar, Toggle, LoadingShimmer, ShimmerPlaceholder } from '../../../../../src/components/ui';
import { ChatMessage, ChatInput } from '../../../../../src/components/chat';
import { useTheme } from '../../../../../src/hooks/useTheme';
import { communityService, CommunityMemberDetails, MemberStatus, communityMembershipMessageService, MembershipMessage, MemberPermissions, DEFAULT_MEMBER_PERMISSIONS } from '../../../../../src/services';
import { formatRelativeTime, formatDate } from '../../../../../src/utils/date';
import { getFullImageUrl } from '../../../../../src/utils/image';
import { useAlert } from '../../../../../src/contexts/AlertContext';
import { useI18n } from '../../../../../src/contexts/I18nContext';

// Status configuration - colors resolved dynamically via colorKey
const STATUS_CONFIG: Record<MemberStatus, { colorKey: 'warning' | 'success' | 'error' | 'gray500'; icon: typeof Clock; labelKey: string }> = {
  PENDING: { colorKey: 'warning', icon: Clock, labelKey: 'gestion.memberDetails.statusPending' },
  ACTIVE: { colorKey: 'success', icon: CheckCircle2, labelKey: 'gestion.memberDetails.statusActive' },
  REJECTED: { colorKey: 'error', icon: XCircle, labelKey: 'gestion.memberDetails.statusRejected' },
  SUSPENDED: { colorKey: 'gray500', icon: UserX, labelKey: 'gestion.memberDetails.statusSuspended' },
};

// Status flow with descriptions - colors resolved dynamically via colorKey
const STATUS_FLOW: Record<MemberStatus, { labelKey: string; descriptionKey: string; colorKey: 'warning' | 'success' | 'error' | 'gray500' }> = {
  PENDING: { labelKey: 'gestion.memberDetails.statusPending', descriptionKey: 'gestion.memberDetails.statusPendingDesc', colorKey: 'warning' },
  ACTIVE: { labelKey: 'gestion.memberDetails.statusActive', descriptionKey: 'gestion.memberDetails.statusActiveDesc', colorKey: 'success' },
  REJECTED: { labelKey: 'gestion.memberDetails.statusRejected', descriptionKey: 'gestion.memberDetails.statusRejectedDesc', colorKey: 'error' },
  SUSPENDED: { labelKey: 'gestion.memberDetails.statusSuspended', descriptionKey: 'gestion.memberDetails.statusSuspendedDesc', colorKey: 'gray500' },
};

type Tab = 'profile' | 'answers' | 'messages' | 'notes';

export default function CommunityMemberDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const scrollViewRef = useRef<ScrollView>(null);

  const [member, setMember] = useState<CommunityMemberDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Messages state
  const [messages, setMessages] = useState<MembershipMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Form states
  const [internalNotes, setInternalNotes] = useState('');
  const [rating, setRating] = useState(0);
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Status picker
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Permissions state
  const [permissions, setPermissions] = useState<MemberPermissions>(DEFAULT_MEMBER_PERMISSIONS);
  const [communityDefaults, setCommunityDefaults] = useState<MemberPermissions>(DEFAULT_MEMBER_PERMISSIONS);
  const [isCustomPermissions, setIsCustomPermissions] = useState(false);
  const [memberRole, setMemberRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
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
    loadMember();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'messages' && member) {
      loadMessages();
    }
  }, [activeTab, member]);

  const loadMember = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const response = await communityService.getMembershipDetails(id);
      setMember(response.data);
      setInternalNotes(response.data.internal_notes || '');
      setRating(response.data.rating || 0);
      // Load permissions after member is loaded
      loadPermissions();
    } catch (error) {
      void alerts.alert(t('common.error'), t('gestion.members.detailsLoadError'));
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const loadPermissions = async () => {
    if (!id) return;

    setIsLoadingPermissions(true);
    try {
      const response = await communityService.getMemberPermissions(id);
      if (response.data) {
        setPermissions(response.data.permissions);
        setCommunityDefaults(response.data.communityDefaults);
        setIsCustomPermissions(response.data.isCustom);
        setMemberRole(response.data.role);
      }
    } catch (error: any) {
      if (error?.status !== 404) {
        if (__DEV__) console.error('Error loading permissions:', error);
      }
      setPermissions(DEFAULT_MEMBER_PERMISSIONS);
      setCommunityDefaults(DEFAULT_MEMBER_PERMISSIONS);
      setIsCustomPermissions(false);
      setMemberRole('MEMBER');
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  const handleTogglePermission = async (key: keyof MemberPermissions) => {
    if (memberRole === 'ADMIN') {
      void alerts.alert(t('common.information'), t('gestion.memberDetails.adminHasAllPermissions'));
      return;
    }

    const newPermissions = {
      ...permissions,
      [key]: !permissions[key],
    };

    setIsSavingPermissions(true);
    try {
      const response = await communityService.updateMemberPermissions(id!, newPermissions);
      if (response.data) {
        setPermissions(response.data.permissions);
        setIsCustomPermissions(response.data.isCustom);
        void alerts.alert(t('common.success'), response.data.message || t('gestion.memberDetails.permissionsUpdated'));
      }
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.error || t('gestion.memberDetails.permissionsUpdateError'));
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleResetToDefaults = () => {
    if (memberRole === 'ADMIN') {
      void alerts.alert(t('common.information'), t('gestion.memberDetails.adminHasAllPermissions'));
      return;
    }

    void alerts.showAlert({ title: t('gestion.memberDetails.resetPermissionsTitle'), message: t('gestion.memberDetails.resetPermissionsConfirm'), buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('gestion.memberDetails.resetPermissions'),
          onPress: async () => {
            setIsSavingPermissions(true);
            try {
              const response = await communityService.updateMemberPermissions(id!, null);
              if (response.data) {
                setPermissions(communityDefaults);
                setIsCustomPermissions(false);
                void alerts.alert(t('common.success'), t('gestion.memberDetails.permissionsResetSuccess'));
              }
            } catch (error: any) {
              void alerts.alert(t('common.error'), error.error || t('gestion.memberDetails.permissionsResetError'));
            } finally {
              setIsSavingPermissions(false);
            }
          },
        },
      ] });
  };

  const loadMessages = async () => {
    if (!member) return;

    setIsLoadingMessages(true);
    try {
      const response = await communityMembershipMessageService.getMessages(member.id);
      setMessages(response.data || []);
      await communityMembershipMessageService.markAllAsRead(member.id);
    } catch (error) {
      if (__DEV__) console.error('Error loading messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async (data: {
    content: string;
    attachments?: { name: string; uri: string; type: string; size?: number }[];
    proposedDatetime?: string;
    datetimeType?: string;
  }) => {
    if (!member) return;

    setIsSending(true);
    try {
      const response = await communityMembershipMessageService.sendMessage(member.id, {
        content: data.content,
        attachments: data.attachments?.map(a => ({
          name: a.name,
          url: a.uri,
          type: a.type,
          size: a.size,
        })),
        proposed_datetime: data.proposedDatetime,
        datetime_type: data.datetimeType as any,
      });

      setMessages((prev) => [...prev, response.data]);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.error || t('gestion.members.sendMessageError'));
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  const handleUpdateStatus = async (newStatus: MemberStatus, rejectionReason?: string) => {
    if (!member?.community_id) return;

    try {
      await communityService.updateMembershipStatus(member.community_id, member.id, newStatus, rejectionReason);
      setMember((prev) => prev ? { ...prev, status: newStatus } : null);
      setShowStatusPicker(false);
      void alerts.alert(t('common.success'), t('gestion.members.statusUpdated', { status: t(STATUS_FLOW[newStatus].labelKey) }));
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.error || t('gestion.members.statusUpdateError'));
    }
  };

  const handleDeleteMember = () => {
    if (!member?.community_id) return;

    void alerts.showAlert({ title: t('gestion.memberDetails.deleteTitle'), message: t('gestion.memberDetails.deleteConfirmSimple', { name: t('gestion.memberDetails.thisMember') }), buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await communityService.deleteMember(member.community_id, member.id);
              void alerts.alert(t('common.success'), t('gestion.members.removeSuccess'));
              router.back();
            } catch (error: any) {
              void alerts.alert(t('common.error'), error.error || t('gestion.members.removeError'));
            }
          },
        },
      ] });
  };

  const handleSaveNotes = async () => {
    if (!member) return;

    try {
      await communityService.updateMemberNotes(member.id, internalNotes);
      setIsEditingNotes(false);
      void alerts.alert(t('common.success'), t('gestion.members.notesSaved'));
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.error || t('gestion.members.notesSaveError'));
    }
  };

  const handleUpdateRating = async (newRating: number) => {
    if (!member) return;

    try {
      await communityService.updateMemberRating(member.id, newRating);
      setRating(newRating);
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.error || t('gestion.members.ratingUpdateError'));
    }
  };

  const getInitials = (firstName?: string, lastName?: string, displayName?: string): string => {
    if (displayName) {
      return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    const f = firstName?.[0] || '';
    const l = lastName?.[0] || '';
    return (f + l).toUpperCase() || '?';
  };

  const tabs = [
    { key: 'profile', label: t('gestion.memberDetails.tabProfile'), icon: User },
    { key: 'messages', label: t('gestion.memberDetails.tabMessages'), icon: MessageCircle },
    { key: 'notes', label: t('gestion.memberDetails.tabNotes'), icon: SquarePen },
  ] as const;

  const renderProfileTab = () => {
    const talent = member?.talent;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Talent Info */}
        <View style={[styles.profileHeader, { backgroundColor: colors.gray50 }]}>
          {talent?.avatar_url || talent?.profile_picture_url ? (
            <Image
              source={{ uri: getFullImageUrl(talent.avatar_url || talent.profile_picture_url) || '' }}
              style={styles.profileAvatar}
            />
          ) : (
            <View style={[styles.profileAvatarPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[20]) }]}>
              <Text style={[styles.profileAvatarText, { color: colors.primary }]}>
                {getInitials(talent?.first_name, talent?.last_name, talent?.display_name)}
              </Text>
            </View>
          )}
          <Text style={[styles.profileName, { color: colors.textPrimary }]}>
            {talent?.display_name || `${talent?.first_name} ${talent?.last_name}` || t('gestion.memberDetails.thisMember')}
          </Text>
          {talent?.headline && (
            <Text style={[styles.profileHeadline, { color: colors.gray500 }]}>
              {talent.headline}
            </Text>
          )}
        </View>

        {/* Talent Details */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('gestion.memberDetails.information')}</Text>

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
            <View style={[styles.bioContainer, { marginTop: SPACING.sm, borderTopColor: colors.gray200 }]}>
              <Text style={[styles.bioText, { color: colors.textSecondary }]}>
                {talent.bio}
              </Text>
            </View>
          )}
        </View>

        {/* Rating */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
	          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('gestion.memberDetails.memberRating')}</Text>
	          <View style={styles.ratingContainer}>
	            {[1, 2, 3, 4, 5].map((star) => (
	              <IconButton
	                key={star}
	                onPress={() => handleUpdateRating(star)}
	                icon={
	                  <Star
	                    size={32}
	                    color={star <= rating ? colors.warning : colors.gray300}
	                    fill={star <= rating ? colors.warning : 'transparent'}
	                    strokeWidth={ICON.strokeWidth}
	                  />
	                }
	                accessibilityLabel={t('gestion.memberDetails.rateStars', { count: star })}
	                variant="ghost"
	                style={{ width: 44, height: 44, borderRadius: 22 }}
	              />
	            ))}
	          </View>
	        </View>

        {/* Permissions Section */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Shield size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.sectionTitle, { color: colors.gray700, marginBottom: 0 }]}>
                {t('gestion.memberDetails.permissions')}
              </Text>
            </View>
            {memberRole === 'ADMIN' && (
              <View style={[styles.adminBadge, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                <Text style={[styles.adminBadgeText, { color: colors.primary }]}>{t('gestion.memberDetails.admin')}</Text>
              </View>
            )}
          </View>

          {isLoadingPermissions ? (
            <LoadingShimmer variant="inline" />
          ) : memberRole === 'ADMIN' ? (
            <View style={[styles.permissionInfo, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
              <Text style={[styles.permissionInfoText, { color: colors.primary }]}>
                {t('gestion.memberDetails.adminHasAllPermissions')}
              </Text>
            </View>
          ) : (
            <>
              {/* Permission toggles */}
              <View style={styles.permissionsList}>
                {/* Can Post */}
                <View style={[styles.permissionItem, { borderColor: colors.gray200 }]}>
                  <View style={styles.permissionLeft}>
                    <View style={[styles.permissionIcon, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                      <FileText size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                    </View>
                    <View>
                      <Text style={[styles.permissionLabel, { color: colors.textPrimary }]}>
                        {t('gestion.memberDetails.canCreatePosts')}
                      </Text>
                      <Text style={[styles.permissionDesc, { color: colors.gray500 }]}>
                        {t('gestion.memberDetails.canCreatePostsDesc')}
                      </Text>
                    </View>
                  </View>
                  <Toggle
                    value={permissions.can_post}
                    onValueChange={() => handleTogglePermission('can_post')}
                    disabled={isSavingPermissions}
                  />
                </View>

                {/* Can Create Event */}
                <View style={[styles.permissionItem, { borderColor: colors.gray200 }]}>
                  <View style={styles.permissionLeft}>
                    <View style={[styles.permissionIcon, { backgroundColor: withOpacity(colors.warning, OPACITY[15]) }]}>
                      <Calendar size={18} color={colors.warning} strokeWidth={ICON.strokeWidth} />
                    </View>
                    <View>
                      <Text style={[styles.permissionLabel, { color: colors.textPrimary }]}>
                        {t('gestion.memberDetails.canCreateEvents')}
                      </Text>
                      <Text style={[styles.permissionDesc, { color: colors.gray500 }]}>
                        {t('gestion.memberDetails.canCreateEventsDesc')}
                      </Text>
                    </View>
                  </View>
                  <Toggle
                    value={permissions.can_create_event}
                    onValueChange={() => handleTogglePermission('can_create_event')}
                    disabled={isSavingPermissions}
                  />
                </View>

                {/* Can Create Poll */}
                <View style={[styles.permissionItem, { borderColor: colors.gray200, borderBottomWidth: 0 }]}>
                  <View style={styles.permissionLeft}>
                    <View style={[styles.permissionIcon, { backgroundColor: withOpacity(colors.info, OPACITY[15]) }]}>
                      <BarChart2 size={18} color={colors.info} strokeWidth={ICON.strokeWidth} />
                    </View>
                    <View>
                      <Text style={[styles.permissionLabel, { color: colors.textPrimary }]}>
                        {t('gestion.memberDetails.canCreatePolls')}
                      </Text>
                      <Text style={[styles.permissionDesc, { color: colors.gray500 }]}>
                        {t('gestion.memberDetails.canCreatePollsDesc')}
                      </Text>
                    </View>
                  </View>
                  <Toggle
                    value={permissions.can_create_poll}
                    onValueChange={() => handleTogglePermission('can_create_poll')}
                    disabled={isSavingPermissions}
                  />
                </View>
              </View>

	              {/* Custom permissions indicator and reset button */}
	              {isCustomPermissions && (
	                <Button
	                  title={t('gestion.memberDetails.customPermissionsReset')}
	                  onPress={handleResetToDefaults}
	                  disabled={isSavingPermissions}
	                  variant="outline"
	                  icon={<RefreshCw size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />}
	                  style={[
	                    styles.resetPermissionsButton,
	                    {
	                      borderColor: colors.gray300,
	                      backgroundColor: 'transparent',
	                      justifyContent: 'center',
	                      borderStyle: 'dashed',
	                    },
	                  ]}
	                  textStyle={[styles.resetPermissionsText, { color: colors.gray600 }]}
	                  fullWidth
	                />
	              )}

	              {isSavingPermissions && (
	                <View style={[styles.savingOverlay, { backgroundColor: withOpacity(colors.background, OPACITY[70]) }]}>
	                  <ShimmerPlaceholder width={24} height={14} variant="bar" />
	                </View>
	              )}
            </>
          )}
        </View>

        {/* Answers to membership questions */}
        {member?.answers && member.answers.length > 0 && (
          <View style={[styles.section, { borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('gestion.memberDetails.answers')}</Text>
            {member.answers.map((answer, index) => (
              <View
                key={index}
                style={[
                  styles.answerItem,
                  index > 0 && { borderTopColor: colors.gray200, borderTopWidth: 1, paddingTop: SPACING.md, marginTop: SPACING.md }
                ]}
              >
                <Text style={[styles.answerQuestion, { color: colors.gray600 }]}>
                  {answer.question || t('community.form.questionN', { index: index + 1 })}
                </Text>
                <Text style={[styles.answerText, { color: colors.textPrimary }]}>
                  {answer.answer}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Current Status with Picker */}
        {member?.status && (
          <View style={[styles.section, { borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('gestion.memberDetails.membershipStatus')}</Text>

            {/* Current status display */}
            <View style={[styles.currentStatusDisplay, { backgroundColor: withOpacity(colors[STATUS_FLOW[member.status]?.colorKey || 'warning'], OPACITY[10]) }]}>
              {(() => {
                const config = STATUS_CONFIG[member.status] || STATUS_CONFIG.PENDING;
                const StatusIcon = config.icon;
                return <StatusIcon size={20} color={colors[STATUS_FLOW[member.status]?.colorKey || 'warning']} strokeWidth={ICON.strokeWidth} />;
              })()}
              <Text style={[styles.currentStatusDisplayText, { color: colors[STATUS_FLOW[member.status]?.colorKey || 'warning'] }]}>
                {STATUS_FLOW[member.status] ? t(STATUS_FLOW[member.status].labelKey) : member.status}
              </Text>
            </View>

            {/* Status picker */}
            <Button
              title={t('gestion.memberDetails.changeStatus')}
              onPress={() => setShowStatusPicker(!showStatusPicker)}
              variant="outline"
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
              fullWidth
            />

            {/* Status options */}
            {showStatusPicker && (
              <View style={[styles.statusOptions, { borderColor: colors.gray200, backgroundColor: colors.surface }]}>
                {(Object.keys(STATUS_FLOW) as MemberStatus[])
                  .filter(status => status !== member.status)
                  .map((status) => {
                    const config = STATUS_CONFIG[status];
                    const flow = STATUS_FLOW[status];
                    const Icon = config.icon;

                    return (
	                      <Pressable
	                        key={status}
	                        style={[styles.statusOption, { borderBottomColor: colors.gray200, backgroundColor: colors.surface }]}
	                        onPress={() => {
                          if (status === 'REJECTED') {
                            void (async () => {
                              const reason = await alerts.prompt(
                                t('gestion.memberDetails.rejectMemberTitle'),
                                t('gestion.membersList.rejectRequestMessage'),
                                { placeholder: t('gestion.membersList.rejectReasonPlaceholder'), confirmText: t('gestion.membersList.reject'), cancelText: t('common.cancel') }
                              );
                              if (reason === null) return;
                              await handleUpdateStatus(status, reason || undefined);
                            })();
                          } else {
                            handleUpdateStatus(status);
	                          }
		                        }}
		                        accessibilityRole="button"
		                        accessibilityLabel={t(flow.labelKey)}
		                      >
                        <View style={[styles.statusOptionIcon, { backgroundColor: withOpacity(colors[config.colorKey], OPACITY[15]) }]}>
                          <Icon size={16} color={colors[config.colorKey]} strokeWidth={ICON.strokeWidth} />
                        </View>
	                        <View style={styles.statusOptionInfo}>
	                          <Text style={[styles.statusOptionLabel, { color: colors.textPrimary }]}>
	                            {t(flow.labelKey)}
	                          </Text>
                          <Text style={[styles.statusOptionDesc, { color: colors.gray500 }]}>
                            {t(flow.descriptionKey)}
                          </Text>
                        </View>
	                      </Pressable>
	                    );
	                  })}
              </View>
            )}
          </View>
        )}

        {/* Rejection reason if rejected */}
        {member?.status === 'REJECTED' && member.rejection_reason && (
          <View style={[styles.section, { backgroundColor: withOpacity(colors.error, OPACITY[10]), borderColor: withOpacity(colors.error, OPACITY[30]) }]}>
            <Text style={[styles.sectionTitle, { color: colors.error }]}>{t('gestion.memberDetails.rejectionReason')}</Text>
            <Text style={[styles.rejectionReason, { color: colors.textPrimary }]}>
              {member.rejection_reason}
            </Text>
          </View>
        )}

        {/* Meta info */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('gestion.memberDetails.requestInfo')}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: colors.gray500 }]}>{t('gestion.memberDetails.requestDate')}</Text>
            <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
              {formatDate(member?.created_at!)}
            </Text>
          </View>
          {member?.joined_at && (
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.gray500 }]}>{t('gestion.memberDetails.memberSince')}</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                {formatDate(member.joined_at)}
              </Text>
            </View>
          )}
          {member?.accepted_rules && (
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.gray500 }]}>{t('gestion.memberDetails.rulesAccepted')}</Text>
              <CheckCircle2 size={16} color={colors.success} strokeWidth={ICON.strokeWidth} />
            </View>
          )}
        </View>

        {/* Delete member */}
        <Button
          title={t('gestion.memberDetails.deleteMember')}
          onPress={handleDeleteMember}
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

  const renderAnswersTab = () => {
    const answers = member?.answers || [];
    const questions = member?.community?.application_questions || [];

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {answers.length === 0 ? (
          <View style={styles.noContent}>
            <Text style={[styles.noContentText, { color: colors.gray500 }]}>
              {t('gestion.memberDetails.noAnswers')}
            </Text>
          </View>
        ) : (
          answers.map((answer, index) => (
            <View key={index} style={[styles.answerCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
              <Text style={[styles.answerQuestion, { color: colors.gray600 }]}>
                {answer.question || t('community.form.questionN', { index: index + 1 })}
              </Text>
              <Text style={[styles.answerText, { color: colors.textPrimary }]}>
                {answer.answer}
              </Text>
            </View>
          ))
        )}

        {/* Community rules if available */}
        {member?.community?.rules && (
          <View style={[styles.rulesCard, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('gestion.memberDetails.communityRules')}</Text>
            <Text style={[styles.rulesText, { color: colors.textSecondary }]}>
              {member.community.rules}
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  };

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
                {t('gestion.memberDetails.startConversation')}
              </Text>
              <Text style={[styles.noMessagesText, { color: colors.gray500 }]}>
                {t('gestion.memberDetails.noMessagesHint')}
              </Text>
            </View>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                content={message.content}
                isMe={message.sender_type === 'ORGANIZATION'}
                senderName={message.sender_type === 'TALENT' ? (message.sender_name || member?.talent?.first_name || t('gestion.memberDetails.thisMember')) : undefined}
                createdAt={message.created_at}
                proposedDatetime={message.proposed_datetime}
                datetimeType={message.datetime_type as any}
                attachments={message.attachments}
              />
            ))
          )}
        </ScrollView>

        {/* Message Input */}
        <ChatInput
          onSend={handleSendMessage}
          isSending={isSending}
          placeholder={t('gestion.memberDetails.messagePlaceholder')}
          showDatetimeOption={true}
        />
      </View>
    );
  };

  const renderNotesTab = () => (
    <View style={styles.tabContent}>
        <View style={[styles.notesCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
          <View style={styles.notesHeader}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('gestion.memberDetails.internalNotes')}</Text>
            <IconButton
              onPress={() => isEditingNotes ? handleSaveNotes() : setIsEditingNotes(true)}
              size="sm"
              icon={
                isEditingNotes
                  ? <Save size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                  : <SquarePen size={20} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              }
              accessibilityLabel={isEditingNotes ? t('common.save') : t('common.edit')}
            />
          </View>
          <Input
            placeholder={t('gestion.memberDetails.notesPlaceholder')}
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
          {t('gestion.memberDetails.notesHint')}
        </Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <LoadingShimmer variant="fullPage" />
      </SafeAreaView>
    );
  }

  if (!member) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
          {t('gestion.memberDetails.notFound')}
        </Text>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[member.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusConfig.icon;
  const statusColor = colors[statusConfig.colorKey];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel={t('common.back')}
        />
        <View style={styles.headerContent}>
          <View style={[styles.statusBadge, { backgroundColor: withOpacity(statusColor, OPACITY[15]) }]}>
            <StatusIcon size={14} color={statusColor} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {t(statusConfig.labelKey)}
            </Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <TabBar
        tabs={tabs as any}
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
  },

  bioText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },

  ratingContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
  },

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

  rejectionReason: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },

  metaLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  metaValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

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
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  answerText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: 22,
  },

  rulesCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    marginTop: SPACING.md,
  },

  rulesText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
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

  // Content container for keyboard avoiding
  contentContainer: {
    flex: 1,
  },

  // Messages styles
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

  // Answer item in profile
  answerItem: {
    marginBottom: SPACING.sm,
  },

  // Permissions styles
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  adminBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER.radius.full,
  },

  adminBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  permissionInfo: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
  },

  permissionInfoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },

  permissionsList: {
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
  },

  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },

  permissionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },

  permissionIcon: {
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

  resetPermissionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    borderStyle: 'dashed',
  },

  resetPermissionsText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

	  savingOverlay: {
	    position: 'absolute',
	    top: 0,
	    left: 0,
	    right: 0,
	    bottom: 0,
	    justifyContent: 'center',
	    alignItems: 'center',
	  },
});
