import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
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
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { FooterNav } from '../../../src/components/ui';
import { ChatMessage, ChatInput } from '../../../src/components/chat';
import { useAuth } from '../../../src/contexts/AuthContext';
import { spaceBookingService, spaceBookingMessageService } from '../../../src/services';
import type { SpaceBookingDetails } from '../../../src/services/spaceBookingService';
import type { BookingMessage } from '../../../src/services/spaceBookingMessageService';
import { formatDate, formatTime } from '../../../src/utils/date';

// Booking status types
type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

// Status configuration
const getStatusConfig = (colors: any): Record<BookingStatus, { color: string; icon: typeof Clock; bgColor: string; label: string }> => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: colors.warning + '15', label: 'En attente' },
  CONFIRMED: { color: colors.info, icon: CheckCircle2, bgColor: colors.info + '15', label: 'Confirmée' },
  COMPLETED: { color: colors.success, icon: CheckCircle2, bgColor: colors.success + '15', label: 'Terminée' },
  CANCELLED: { color: colors.error, icon: XCircle, bgColor: colors.error + '15', label: 'Annulée' },
  NO_SHOW: { color: colors.gray500, icon: AlertCircle, bgColor: colors.gray200, label: 'Absent' },
});

type Tab = 'details' | 'messages';

export default function ReservationDetailsScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [booking, setBooking] = useState<SpaceBookingDetails | null>(null);
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(tab === 'messages' ? 'messages' : 'details');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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
      Alert.alert('Erreur', 'Impossible de charger les details de la reservation.');
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
      console.error('Error loading messages:', error);
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
      Alert.alert('Erreur', error.error || 'Impossible d\'envoyer le message.');
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelBooking = () => {
    if (!booking) return;

    // Can only cancel pending or confirmed bookings
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      Alert.alert('Impossible', 'Cette reservation ne peut plus etre annulee.');
      return;
    }

    Alert.alert(
      'Annuler la reservation',
      'Etes-vous sur de vouloir annuler cette reservation ? Cette action est irreversible.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await spaceBookingService.updateBookingStatus(booking.id, 'CANCELLED');
              Alert.alert('Reservation annulee', 'Votre reservation a ete annulee avec succes.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error: any) {
              Alert.alert('Erreur', error.error || 'Impossible d\'annuler la reservation.');
            }
          },
        },
      ]
    );
  };

  const renderTab = (tab: Tab, label: string, icon: typeof CalendarDays) => {
    const isActive = activeTab === tab;
    const Icon = icon;

    return (
      <TouchableOpacity
        style={[
          styles.tab,
          { borderBottomColor: isActive ? colors.primary : 'transparent' },
        ]}
        onPress={() => setActiveTab(tab)}
      >
        <Icon
          size={18}
          color={isActive ? colors.primary : colors.gray500}
          strokeWidth={ICON.strokeWidth}
        />
        <Text
          style={[
            styles.tabText,
            { color: isActive ? colors.primary : colors.gray500 },
            isActive && { fontWeight: TYPOGRAPHY.fontWeight.semibold },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
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
              {statusConfig?.label || booking.status}
            </Text>
            <Text style={[styles.statusDate, { color: colors.gray600 }]}>
              Ref: {booking.reference || booking.id.slice(0, 8).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Space Info */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Espace</Text>
          <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
            {space?.name || 'Espace'}
          </Text>

          <View style={styles.itemDetails}>
            <View style={styles.detailRow}>
              <Building2 size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {space?.organization?.name || 'Organisation'}
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

          <TouchableOpacity
            style={[styles.viewButton, { borderColor: colors.primary }]}
            onPress={() => router.push(`/details/space/${space?.id}`)}
          >
            <Text style={[styles.viewButtonText, { color: colors.primary }]}>
              Voir l'espace
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date & Time */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Date et horaire</Text>

          <View style={styles.dateTimeGrid}>
            <View style={styles.dateTimeItem}>
              <CalendarDays size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View>
                <Text style={[styles.dateTimeLabel, { color: colors.gray500 }]}>Date</Text>
                <Text style={[styles.dateTimeValue, { color: colors.textPrimary }]}>
                  {formatDate(startDate)}
                </Text>
              </View>
            </View>
            <View style={styles.dateTimeItem}>
              <Clock size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View>
                <Text style={[styles.dateTimeLabel, { color: colors.gray500 }]}>Horaire</Text>
                <Text style={[styles.dateTimeValue, { color: colors.textPrimary }]}>
                  {formatTime(startDate)} - {formatTime(endDate)}
                </Text>
              </View>
            </View>
            <View style={styles.dateTimeItem}>
              <Users size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View>
                <Text style={[styles.dateTimeLabel, { color: colors.gray500 }]}>Participants</Text>
                <Text style={[styles.dateTimeValue, { color: colors.textPrimary }]}>
                  {booking.attendees_count || 1} {(booking.attendees_count || 1) > 1 ? 'personnes' : 'personne'}
                </Text>
              </View>
            </View>
            <View style={styles.dateTimeItem}>
              <Info size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View>
                <Text style={[styles.dateTimeLabel, { color: colors.gray500 }]}>Duree</Text>
                <Text style={[styles.dateTimeValue, { color: colors.textPrimary }]}>
                  {durationHours} {durationHours > 1 ? 'heures' : 'heure'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Price Details */}
        {booking.total_price && booking.total_price > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Details du prix</Text>

            <View style={[styles.priceRow, styles.priceTotalRow, { borderTopColor: colors.gray200 }]}>
              <Text style={[styles.priceTotalLabel, { color: colors.textPrimary }]}>Total</Text>
              <Text style={[styles.priceTotalValue, { color: colors.primary }]}>
                {booking.total_price.toLocaleString()} FCFA
              </Text>
            </View>
          </View>
        )}

        {/* Special Requests */}
        {booking.special_requests && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Demandes speciales</Text>
            <Text style={[styles.specialRequestText, { color: colors.textPrimary }]}>
              {booking.special_requests}
            </Text>
          </View>
        )}

        {/* Actions */}
        {['PENDING', 'CONFIRMED'].includes(booking.status) && (
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.error }]}
            onPress={handleCancelBooking}
          >
            <Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.cancelText, { color: colors.error }]}>
              Annuler la reservation
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  };

  const renderMessagesTab = () => {
    if (isLoadingMessages) {
      return (
        <View style={styles.loadingMessages}>
          <ActivityIndicator size="large" color={colors.primary} />
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
                Pas encore de messages
              </Text>
              <Text style={[styles.noMessagesText, { color: colors.gray500 }]}>
                L'organisation vous contactera si elle souhaite échanger avec vous.
              </Text>
            </View>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                content={message.content}
                isMe={message.sender_type?.toUpperCase() === 'TALENT'}
                senderName={message.sender_type?.toUpperCase() === 'ORGANIZATION' ? (message.sender_name || 'Organisation') : undefined}
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
            placeholder="Ecrivez votre message..."
            showDatetimeOption={true}
          />
        ) : (
          <View style={[styles.waitingMessage, { backgroundColor: colors.gray50, borderTopColor: colors.gray200 }]}>
            <Text style={[styles.waitingText, { color: colors.gray500 }]}>
              L'organisation doit vous contacter en premier
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
          Reservation non trouvee
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {booking.space?.name || 'Reservation'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: colors.gray200 }]}>
        {renderTab('details', 'Details', CalendarDays)}
        {renderTab('messages', 'Messages', MessageCircle)}
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: BORDER.width.thin,
  },

  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderBottomWidth: 2,
  },

  tabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
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
