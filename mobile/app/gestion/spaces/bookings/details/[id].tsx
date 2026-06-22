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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  MapPin,
  SquarePen,
  Save,
  Trash2,
  ChevronDown,
  Calendar,
  DollarSign,
  AlertCircle,
  MessageCircle,
  FileText,
  Users,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../../../src/constants/theme';
import { Button, FooterNav, IconButton, Input, LoadingShimmer, SelectCard, TabBar } from '../../../../../src/components/ui';
import { ChatMessage, ChatInput } from '../../../../../src/components/chat';
import { useTheme } from '../../../../../src/hooks/useTheme';
import { spaceBookingService, spaceBookingMessageService, SpaceBookingDetails, BookingStatus, BookingMessage } from '../../../../../src/services';
import { formatRelativeTime, formatDate } from '../../../../../src/utils/date';
import { formatNumberNoTrailingZeros } from '../../../../../src/utils/number';
import { useAlert } from '../../../../../src/contexts/AlertContext';
import { useI18n } from '../../../../../src/contexts/I18nContext';

// Status configuration
const getStatusConfig = (colors: any): Record<BookingStatus, { color: string; icon: typeof Clock }> => ({
  PENDING: { color: colors.warning, icon: Clock },
  CONFIRMED: { color: colors.info, icon: CheckCircle2 },
  COMPLETED: { color: colors.success, icon: CheckCircle2 },
  CANCELLED: { color: colors.error, icon: XCircle },
  NO_SHOW: { color: colors.gray500, icon: AlertCircle },
});

// Status flow with descriptions
const getStatusFlow = (colors: any): Record<BookingStatus, {
  label: string;
  description: string;
  color: string;
}> => ({
  PENDING: {
    label: 'gestion.bookingStatus.pending',
    description: 'gestion.bookings.statusPendingDesc',
    color: colors.warning,
  },
  CONFIRMED: {
    label: 'gestion.bookingStatus.confirmed',
    description: 'gestion.bookings.statusConfirmedDesc',
    color: colors.info,
  },
  COMPLETED: {
    label: 'gestion.bookingStatus.completed',
    description: 'gestion.bookings.statusCompletedDesc',
    color: colors.success,
  },
  CANCELLED: {
    label: 'gestion.bookingStatus.cancelled',
    description: 'gestion.bookings.statusCancelledDesc',
    color: colors.error,
  },
  NO_SHOW: {
    label: 'gestion.bookingStatus.noShow',
    description: 'gestion.bookings.statusNoShowDesc',
    color: colors.gray500,
  },
});

type Tab = 'profile' | 'messages' | 'notes';

export default function BookingDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const scrollViewRef = useRef<ScrollView>(null);

  const STATUS_CONFIG = getStatusConfig(colors);
  const STATUS_FLOW = getStatusFlow(colors);

  const [booking, setBooking] = useState<SpaceBookingDetails | null>(null);
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Form states
  const [internalNotes, setInternalNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

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
    loadBooking();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'messages' && booking) {
      loadMessages();
    }
  }, [activeTab, booking]);

  const loadBooking = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const response = await spaceBookingService.getBookingDetails(id);
      setBooking(response.data);
      setInternalNotes(response.data?.internal_notes || '');
    } catch (error) {
      void alerts.alert(t('common.error'), t('gestion.bookings.detailsLoadError'));
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!booking) return;

    setIsLoadingMessages(true);
    try {
      const response = await spaceBookingMessageService.getMessages(booking.id);
      setMessages(response.data || []);
      await spaceBookingMessageService.markAsRead(booking.id);
    } catch (error) {
      if (__DEV__) console.error('Error loading messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleUpdateStatus = async (newStatus: BookingStatus) => {
    if (!booking) return;

    try {
      await spaceBookingService.updateBookingStatus(booking.id, newStatus);
      setBooking((prev) => prev ? { ...prev, status: newStatus } : null);
      setShowStatusPicker(false);
      void alerts.alert(t('common.success'), t('gestion.bookings.statusUpdated', { status: t(STATUS_FLOW[newStatus].label) }));
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.error || t('gestion.bookings.statusUpdateError'));
    }
  };

  const handleDeleteBooking = () => {
    if (!booking) return;

    void alerts.showAlert({ title: t('gestion.bookings.deleteTitle'), message: t('gestion.bookings.deleteConfirm'), buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await spaceBookingService.deleteBooking(booking.id);
              void alerts.alert(t('common.success'), t('gestion.bookings.deleteSuccess'));
              router.back();
            } catch (error: any) {
              void alerts.alert(t('common.error'), error.error || t('gestion.bookings.deleteError'));
            }
          },
        },
      ] });
  };

  const handleSaveNotes = async () => {
    if (!booking) return;

    try {
      await spaceBookingService.updateInternalNotes(booking.id, internalNotes);
      setIsEditingNotes(false);
      void alerts.alert(t('common.success'), t('gestion.bookings.notesSaved'));
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.error || t('gestion.bookings.notesSaveError'));
    }
  };

  const handleSendMessage = async (data: {
    content: string;
    attachments?: { name: string; uri: string; type: string; size?: number }[];
    proposedDatetime?: string;
    datetimeType?: string;
  }) => {
    if (!booking) return;

    setIsSending(true);
    try {
      const response = await spaceBookingMessageService.sendMessage(booking.id, {
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
      void alerts.alert(t('common.error'), error.error || t('gestion.bookings.sendMessageError'));
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

  const formatBookingDate = (datetime: string): string => {
    return new Date(datetime).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatBookingTime = (startDatetime: string, endDatetime: string): string => {
    const start = new Date(startDatetime);
    const end = new Date(endDatetime);
    const startTime = start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    const endTime = end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${startTime} - ${endTime}`;
  };

  const formatDuration = (startDatetime: string, endDatetime: string): string => {
    const start = new Date(startDatetime);
    const end = new Date(endDatetime);
    const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    if (hours < 24) return `${hours} heure${hours > 1 ? 's' : ''}`;
    const days = Math.round(hours / 24);
    return `${days} jour${days > 1 ? 's' : ''}`;
  };

  const formatPrice = (amount: number): string => {
    return new Intl.NumberFormat(locale).format(amount) + ' FCFA';
  };

  const renderProfileTab = () => {
    const talent = booking?.talent;
    const talentName = talent?.display_name ||
      (talent?.first_name && talent?.last_name
        ? `${talent.first_name} ${talent.last_name}`
        : t('gestion.bookings.client'));

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Talent Info */}
        <View style={[styles.profileHeader, { backgroundColor: colors.gray50 }]}>
          {talent?.avatar_url ? (
            <Image source={{ uri: talent.avatar_url }} style={styles.profileAvatar} />
          ) : (
            <View style={[styles.profileAvatarPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[20]) }]}>
              <Text style={[styles.profileAvatarText, { color: colors.primary }]}>
                {getInitials(talent?.first_name, talent?.last_name)}
              </Text>
            </View>
          )}
          <Text style={[styles.profileName, { color: colors.textPrimary }]}>
            {talentName}
          </Text>
          {talent?.current_role && (
            <Text style={[styles.profileHeadline, { color: colors.gray500 }]}>
              {talent.current_role}
            </Text>
          )}
        </View>

        {/* Contact Info */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('gestion.bookings.contact')}</Text>

          {(talent?.city || talent?.country) && (
            <View style={styles.infoRow}>
              <MapPin size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                {[talent?.city, talent?.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}

          {talent?.email && (
            <View style={styles.infoRow}>
              <Mail size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                {talent.email}
              </Text>
            </View>
          )}

          {talent?.phone && (
            <View style={styles.infoRow}>
              <Phone size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                {talent.phone}
              </Text>
            </View>
          )}
        </View>

        {/* Booking Details */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('gestion.bookings.detailsTitle')}</Text>

          <View style={styles.infoRow}>
            <Calendar size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.infoText, { color: colors.textPrimary }]}>
              {booking ? formatBookingDate(booking.start_datetime) : '-'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Clock size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.infoText, { color: colors.textPrimary }]}>
              {booking ? formatBookingTime(booking.start_datetime, booking.end_datetime) : '-'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Clock size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.infoText, { color: colors.textPrimary }]}>
              {t('gestion.bookings.durationLabel')}: {booking ? formatDuration(booking.start_datetime, booking.end_datetime) : '-'}
            </Text>
          </View>

          {booking?.space?.name && (
            <View style={styles.infoRow}>
              <MapPin size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                {booking.space.name}
              </Text>
            </View>
          )}

          {booking?.attendees_count && (
            <View style={styles.infoRow}>
              <Users size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                {formatNumberNoTrailingZeros(booking.attendees_count, 0)} participant{booking.attendees_count > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Price Breakdown */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('gestion.bookings.pricing')}</Text>

          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>{t('gestion.bookings.unitPrice')}</Text>
            <Text style={[styles.priceValue, { color: colors.textPrimary }]}>
              {booking ? formatPrice(booking.unit_price) : '-'}
            </Text>
          </View>

          <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
              {t('gestion.bookings.quantity')} ({formatNumberNoTrailingZeros(booking?.units_count || 0)} {booking?.pricing_type === 'HOURLY' ? t('gestion.bookings.hours') : booking?.pricing_type === 'DAILY' ? t('gestion.bookings.days') : t('gestion.bookings.units')})
            </Text>
            <Text style={[styles.priceValue, { color: colors.textPrimary }]}>
              {booking ? formatPrice(booking.subtotal) : '-'}
            </Text>
          </View>

          <View style={[styles.priceRow, styles.totalRow, { borderTopColor: colors.gray200 }]}>
            <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>{t('gestion.bookings.total')}</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>
              {booking ? formatPrice(booking.total_amount) : '-'}
            </Text>
          </View>
        </View>

        {/* Status */}
        {booking?.status && (
          <View style={[styles.section, { borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('gestion.bookings.statusTitle')}</Text>

            <View style={[styles.currentStatusDisplay, { backgroundColor: withOpacity(STATUS_FLOW[booking.status]?.color || colors.warning, OPACITY[10]) }]}>
              {(() => {
                const config = STATUS_CONFIG[booking.status] || STATUS_CONFIG.PENDING;
                const StatusIcon = config.icon;
                return <StatusIcon size={20} color={STATUS_FLOW[booking.status]?.color || colors.warning} strokeWidth={ICON.strokeWidth} />;
              })()}
              <Text style={[styles.currentStatusDisplayText, { color: STATUS_FLOW[booking.status]?.color || colors.warning }]}>
                {STATUS_FLOW[booking.status] ? t(STATUS_FLOW[booking.status].label) : booking.status}
              </Text>
            </View>

            <Button
              title={t('gestion.bookings.changeStatus')}
              onPress={() => setShowStatusPicker(!showStatusPicker)}
              variant="secondary"
              iconPosition="right"
              icon={
                <View style={{ transform: [{ rotate: showStatusPicker ? '180deg' : '0deg' }] }}>
                  <ChevronDown size={20} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                </View>
              }
              style={[styles.statusPickerButton, { borderColor: colors.gray300, backgroundColor: colors.gray100 }]}
              textStyle={[styles.statusPickerButtonText, { color: colors.textPrimary }]}
            />

            {showStatusPicker && (
              <View style={[styles.statusOptions, { borderColor: colors.gray200, backgroundColor: colors.surface }]}>
                {(Object.keys(STATUS_FLOW) as BookingStatus[])
                  .filter(status => status !== booking.status)
                  .map((status) => {
                    const config = STATUS_CONFIG[status];
                    const flow = STATUS_FLOW[status];
                    const Icon = config.icon;

                    return (
                      <SelectCard
                        key={status}
                        style={[styles.statusOption, { borderBottomColor: colors.gray200, backgroundColor: colors.surface }]}
                        onPress={() => handleUpdateStatus(status)}
                        selected={false}
                        accessibilityLabel={t('gestion.bookings.setStatus', { status: t(flow.label) })}
                      >
                        <View style={[styles.statusOptionIcon, { backgroundColor: withOpacity(config.color, OPACITY[15]) }]}>
                          <Icon size={16} color={config.color} strokeWidth={ICON.strokeWidth} />
                        </View>
                        <View style={styles.statusOptionInfo}>
                          <Text style={[styles.statusOptionLabel, { color: colors.textPrimary }]}>
                            {t(flow.label)}
                          </Text>
                          <Text style={[styles.statusOptionDesc, { color: colors.gray500 }]}>
                            {t(flow.description)}
                          </Text>
                        </View>
                      </SelectCard>
                    );
                  })}
              </View>
            )}
          </View>
        )}

        {/* Special Requests */}
        {booking?.special_requests && (
          <View style={[styles.section, { borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('gestion.bookings.specialRequests')}</Text>
            <Text style={[styles.specialRequestsText, { color: colors.textSecondary }]}>
              {booking.special_requests}
            </Text>
          </View>
        )}

        {/* Purpose */}
        {booking?.purpose && (
          <View style={[styles.section, { borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('gestion.bookings.purpose')}</Text>
            <Text style={[styles.specialRequestsText, { color: colors.textSecondary }]}>
              {booking.purpose}
            </Text>
          </View>
        )}

        {/* Delete button */}
        <Button
          title={t('gestion.bookings.deleteThisBooking')}
          onPress={handleDeleteBooking}
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

  const renderMessagesTab = () => {
    if (isLoadingMessages) {
      return (
        <View style={styles.loadingMessages}>
          <LoadingShimmer variant="fullPage" />
        </View>
      );
    }

    const talent = booking?.talent;
    const talentName = talent?.display_name ||
      (talent?.first_name && talent?.last_name
        ? `${talent.first_name} ${talent.last_name}`
        : t('gestion.bookings.client'));

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
                {t('gestion.bookings.noMessages')}
              </Text>
              <Text style={[styles.noMessagesText, { color: colors.gray500 }]}>
                {t('gestion.bookings.noMessagesHint')}
              </Text>
            </View>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                content={message.content}
                isMe={message.sender_type?.toUpperCase() === 'ORGANIZATION'}
                senderName={message.sender_type?.toUpperCase() === 'TALENT' ? (message.sender_name || talentName) : undefined}
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
          placeholder={t('gestion.bookings.messagePlaceholder')}
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
            placeholder={t('gestion.bookings.notesPlaceholder')}
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
          {t('gestion.bookings.notesHint')}
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

  if (!booking) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
          {t('gestion.bookings.notFound')}
        </Text>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusConfig.icon;

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
          <View style={[styles.statusBadge, { backgroundColor: withOpacity(statusConfig.color, OPACITY[15]) }]}>
            <StatusIcon size={14} color={statusConfig.color} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {STATUS_FLOW[booking.status] ? t(STATUS_FLOW[booking.status].label) : booking.status}
            </Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <TabBar
        tabs={[
          { key: 'profile', label: t('gestion.memberDetails.tabProfile') },
          { key: 'messages', label: t('gestion.memberDetails.tabMessages') },
          { key: 'notes', label: t('gestion.memberDetails.tabNotes') },
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

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },

  priceLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  priceValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  totalRow: {
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
    borderTopWidth: BORDER.width.thin,
    marginBottom: 0,
  },

  totalLabel: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  totalValue: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
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

  specialRequestsText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
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

  // Messages
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

  // Notes
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
});
