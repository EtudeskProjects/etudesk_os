import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MapPin,
  Building2,
  MessageCircle,
  Trash2,
  CalendarDays,
  Users,
  DollarSign,
  Info,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { Button, FooterNav, IconButton, LoadingShimmer, TabBar } from '../../../src/components/ui';
import { ChatMessage, ChatInput } from '../../../src/components/chat';
import { useAuth } from '../../../src/contexts/AuthContext';
import { spaceBookingService, spaceBookingMessageService } from '../../../src/services';
import type { SpaceBookingDetails } from '../../../src/services/spaceBookingService';
import type { BookingMessage } from '../../../src/services/spaceBookingMessageService';
import { formatDate, formatTime } from '../../../src/utils/date';
import { formatNumberNoTrailingZeros } from '../../../src/utils/number';
import { useAlert } from '../../../src/contexts/AlertContext';
import { useI18n } from '../../../src/contexts/I18nContext';

// Booking status types
type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

// Status configuration
const getStatusConfig = (colors: any): Record<BookingStatus, { color: string; icon: typeof Clock; bgColor: string; label: string }> => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: withOpacity(colors.warning, OPACITY[15]), label: 'gestion.bookingStatus.pending' },
  CONFIRMED: { color: colors.info, icon: CheckCircle2, bgColor: withOpacity(colors.info, OPACITY[15]), label: 'gestion.bookingStatus.confirmed' },
  COMPLETED: { color: colors.success, icon: CheckCircle2, bgColor: withOpacity(colors.success, OPACITY[15]), label: 'gestion.bookingStatus.completed' },
  CANCELLED: { color: colors.error, icon: XCircle, bgColor: withOpacity(colors.error, OPACITY[15]), label: 'gestion.bookingStatus.cancelled' },
  NO_SHOW: { color: colors.gray500, icon: AlertCircle, bgColor: colors.gray200, label: 'gestion.bookingStatus.noShow' },
});

type Tab = 'details' | 'messages';

export default function ReservationDetailsScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [booking, setBooking] = useState<SpaceBookingDetails | null>(null);
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(tab === 'messages' ? 'messages' : 'details');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const alerts = useAlert();

  // Handle keyboard events for proper input positioning
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

      // Mark all as read
      await spaceBookingMessageService.markAsRead(booking.id);
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

      // Scroll to bottom
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

  const handleCancelBooking = () => {
    if (!booking) return;

    // Can only cancel pending or confirmed bookings
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      void alerts.alert(t('myReservations.detail.cannotCancel'), t('myReservations.detail.cannotCancelMessage'));
      return;
    }

    void alerts.showAlert({ title: t('gestion.bookings.cancelTitle'), message: t('gestion.bookings.cancelMessage'), buttons: [
        { text: t('common.no'), style: 'cancel' },
        {
          text: t('gestion.bookings.cancelYes'),
          style: 'destructive',
          onPress: async () => {
            try {
              await spaceBookingService.updateBookingStatus(booking.id, 'CANCELLED');
              void alerts.showAlert({ title: t('common.success'), message: t('myReservations.detail.cancelSuccessMessage'), buttons: [
                { text: 'OK', onPress: () => router.back() },
              ] });
            } catch (error: any) {
              void alerts.alert(t('common.error'), error.error || t('gestion.bookings.cancelError'));
            }
          },
        },
      ] });
  };

  const renderDetailsTab = () => {
    if (!booking) return null;

    const statusConfig = getStatusConfig(colors)[booking.status as BookingStatus];
    const StatusIcon = statusConfig?.icon || Clock;
    const space = booking.space;

    const startDate = new Date(booking.start_datetime);
    const endDate = new Date(booking.end_datetime);
    const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: statusConfig?.bgColor || colors.gray100 }]}>
          <StatusIcon size={24} color={statusConfig?.color || colors.gray500} strokeWidth={ICON.strokeWidth} />
          <View style={styles.statusInfo}>
            <Text style={[styles.statusLabel, { color: statusConfig?.color || colors.gray500 }]}>
              {statusConfig?.label ? t(statusConfig.label) : booking.status}
            </Text>
            <Text style={[styles.statusDate, { color: colors.gray600 }]}>
              Ref: {(booking as any).reference || booking.id.slice(0, 8).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Space Info */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('myReservations.detail.sections.space')}</Text>
          <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
            {space?.name || t('myReservations.detail.spaceFallback')}
          </Text>

          <View style={styles.itemDetails}>
            <View style={styles.detailRow}>
              <Building2 size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {space?.organization?.name || t('myReservations.detail.organizationFallback')}
                </Text>
              </View>
            {space?.city && (
              <View style={styles.detailRow}>
                <MapPin size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {space.city}{space.country ? `, ${space.country}` : ''}
                </Text>
              </View>
            )}
          </View>

          <Button
            title={t('myReservations.detail.viewSpace')}
            onPress={() => router.push(`/details/space/${space?.id}`)}
            variant="outline"
            fullWidth
            style={[styles.viewButton, { borderColor: colors.primary, backgroundColor: 'transparent' }]}
            textStyle={[styles.viewButtonText, { color: colors.primary }]}
          />
        </View>

        {/* Date & Time */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('myReservations.detail.sections.dateTime')}</Text>

          <View style={styles.dateTimeGrid}>
            <View style={styles.dateTimeItem}>
              <CalendarDays size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View>
                <Text style={[styles.dateTimeLabel, { color: colors.gray500 }]}>{t('myReservations.detail.dateLabel')}</Text>
                <Text style={[styles.dateTimeValue, { color: colors.textPrimary }]}>
                  {formatDate(startDate)}
                </Text>
              </View>
            </View>
            <View style={styles.dateTimeItem}>
              <Clock size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View>
                <Text style={[styles.dateTimeLabel, { color: colors.gray500 }]}>{t('myReservations.detail.timeLabel')}</Text>
                <Text style={[styles.dateTimeValue, { color: colors.textPrimary }]}>
                  {formatTime(startDate)} - {formatTime(endDate)}
                </Text>
              </View>
            </View>
            <View style={styles.dateTimeItem}>
              <Users size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View>
                <Text style={[styles.dateTimeLabel, { color: colors.gray500 }]}>{t('myReservations.detail.attendeesLabel')}</Text>
                <Text style={[styles.dateTimeValue, { color: colors.textPrimary }]}>
                  {formatNumberNoTrailingZeros(booking.attendees_count || 1, 0)} {(booking.attendees_count || 1) > 1 ? t('myReservations.detail.persons') : t('myReservations.detail.person')}
                </Text>
              </View>
            </View>
            <View style={styles.dateTimeItem}>
              <Info size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View>
                <Text style={[styles.dateTimeLabel, { color: colors.gray500 }]}>{t('myReservations.detail.durationLabel')}</Text>
                <Text style={[styles.dateTimeValue, { color: colors.textPrimary }]}>
                  {formatNumberNoTrailingZeros(durationHours)} {durationHours > 1 ? t('gestion.bookings.hours') : t('myReservations.detail.hour')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Price Details */}
        {(booking as any).total_price && (booking as any).total_price > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('myReservations.detail.sections.priceDetails')}</Text>

            <View style={[styles.priceRow, styles.priceTotalRow, { borderTopColor: colors.gray200 }]}>
              <Text style={[styles.priceTotalLabel, { color: colors.textPrimary }]}>{t('gestion.bookings.total')}</Text>
              <Text style={[styles.priceTotalValue, { color: colors.primary }]}>
                {formatNumberNoTrailingZeros((booking as any).total_price, 0)} FCFA
              </Text>
            </View>
          </View>
        )}

        {/* Special Requests */}
        {booking.special_requests && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>{t('gestion.bookings.specialRequests')}</Text>
            <Text style={[styles.specialRequestText, { color: colors.textPrimary }]}>
              {booking.special_requests}
            </Text>
          </View>
        )}

        {/* Actions */}
        {['PENDING', 'CONFIRMED'].includes(booking.status) && (
          <Button
            title={t('gestion.bookings.cancelTitle')}
            onPress={handleCancelBooking}
            variant="outline"
            fullWidth
            icon={<Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />}
            style={[styles.cancelButton, { borderColor: colors.error }]}
            textStyle={[styles.cancelText, { color: colors.error }]}
          />
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

    const canSendMessage = messages.length > 0;

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
                {t('myReservations.detail.noMessagesHint')}
              </Text>
            </View>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                content={message.content}
                isMe={message.sender_type?.toUpperCase() === 'TALENT'}
                senderName={message.sender_type?.toUpperCase() === 'ORGANIZATION' ? (message.sender_name || t('myReservations.detail.organizationMessageFallback')) : undefined}
                createdAt={message.created_at}
                proposedDatetime={message.proposed_datetime}
                attachments={message.attachments}
              />
            ))
          )}
        </ScrollView>

        {/* Message Input or Waiting Message */}
        {canSendMessage ? (
          <ChatInput
            onSend={handleSendMessage}
            isSending={isSending}
            placeholder={t('gestion.bookings.messagePlaceholder')}
            showDatetimeOption={true}
          />
        ) : (
          <View style={[styles.waitingMessage, { backgroundColor: colors.gray50, borderTopColor: colors.gray200 }]}>
            <Text style={[styles.waitingText, { color: colors.gray500 }]}>
              {t('myReservations.detail.waitingMessage')}
            </Text>
          </View>
        )}
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

  if (!booking) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
          {t('gestion.bookings.notFound')}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel={t('common.back')}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {booking.space?.name || t('myReservations.detail.headerFallback')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <TabBar
        tabs={[
          { key: 'details', label: t('myReservations.detail.tabs.details'), icon: CalendarDays },
          { key: 'messages', label: t('gestion.memberDetails.tabMessages'), icon: MessageCircle },
        ]}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as Tab)}
      />

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {activeTab === 'details' ? renderDetailsTab() : renderMessagesTab()}
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
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
  },

  headerSpacer: {
    width: 40,
  },

  keyboardAvoidingView: {
    flex: 1,
  },

  tabContent: {
    flex: 1,
    padding: SPACING.lg,
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.md,
  },

  statusInfo: {
    flex: 1,
  },

  statusLabel: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  statusDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
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

  itemTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.md,
  },

  itemDetails: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  detailText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  viewButton: {
    padding: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
  },

  viewButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  dateTimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },

  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    width: '45%',
  },

  dateTimeLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  dateTimeValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },

  priceLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  priceValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  priceTotalRow: {
    borderTopWidth: BORDER.width.thin,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
  },

  priceTotalLabel: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  priceTotalValue: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  specialRequestText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },

  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    marginTop: SPACING.md,
  },

  cancelText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
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

  waitingMessage: {
    padding: SPACING.md,
    borderTopWidth: BORDER.width.thin,
    alignItems: 'center',
  },

  waitingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
