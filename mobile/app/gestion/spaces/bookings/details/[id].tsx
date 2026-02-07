import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
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
import { FooterNav } from '../../../../../src/components/ui';
import { ChatMessage, ChatInput } from '../../../../../src/components/chat';
import { useTheme } from '../../../../../src/hooks/useTheme';
import { spaceBookingService, spaceBookingMessageService, SpaceBookingDetails, BookingStatus, BookingMessage } from '../../../../../src/services';
import { formatRelativeTime, formatDate } from '../../../../../src/utils/date';

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
    label: 'En attente',
    description: 'Réservation en attente de confirmation',
    color: colors.warning,
  },
  CONFIRMED: {
    label: 'Confirmée',
    description: 'Réservation confirmée',
    color: colors.info,
  },
  COMPLETED: {
    label: 'Terminée',
    description: 'Réservation terminée avec succès',
    color: colors.success,
  },
  CANCELLED: {
    label: 'Annulée',
    description: 'Réservation annulée',
    color: colors.error,
  },
  NO_SHOW: {
    label: 'Absent',
    description: 'Le client ne s\'est pas présenté',
    color: colors.gray500,
  },
});

type Tab = 'profile' | 'messages' | 'notes';

export default function BookingDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
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
      await spaceBookingMessageService.markAsRead(booking.id);
    } catch (error) {
      console.error('Error loading messages:', error);
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
      Alert.alert('Succes', `Statut mis a jour: ${STATUS_FLOW[newStatus].label}`);
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Impossible de mettre a jour le statut.');
    }
  };

  const handleDeleteBooking = () => {
    if (!booking) return;

    Alert.alert(
      'Supprimer la reservation',
      'Etes-vous sur de vouloir supprimer cette reservation ? Cette action est irreversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await spaceBookingService.deleteBooking(booking.id);
              Alert.alert('Succes', 'Reservation supprimee.');
              router.back();
            } catch (error: any) {
              Alert.alert('Erreur', error.error || 'Impossible de supprimer la reservation.');
            }
          },
        },
      ]
    );
  };

  const handleSaveNotes = async () => {
    if (!booking) return;

    try {
      await spaceBookingService.updateInternalNotes(booking.id, internalNotes);
      setIsEditingNotes(false);
      Alert.alert('Succes', 'Notes enregistrees.');
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Impossible de sauvegarder les notes.');
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
      Alert.alert('Erreur', error.error || 'Impossible d\'envoyer le message.');
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
    return new Date(datetime).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatBookingTime = (startDatetime: string, endDatetime: string): string => {
    const start = new Date(startDatetime);
    const end = new Date(endDatetime);
    const startTime = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
  };

  const renderTab = (tab: Tab, label: string) => {
    const isActive = activeTab === tab;

    return (
      <TouchableOpacity
        style={[styles.tab, isActive && { borderBottomColor: colors.primary }]}
        onPress={() => setActiveTab(tab)}
      >
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

  const renderProfileTab = () => {
    const talent = booking?.talent;
    const talentName = talent?.display_name ||
      (talent?.first_name && talent?.last_name
        ? `${talent.first_name} ${talent.last_name}`
        : 'Client');

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
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Contact</Text>

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
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Details de la reservation</Text>

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
              Duree: {booking ? formatDuration(booking.start_datetime, booking.end_datetime) : '-'}
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
                {booking.attendees_count} participant{booking.attendees_count > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Price Breakdown */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Tarification</Text>

          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Prix unitaire</Text>
            <Text style={[styles.priceValue, { color: colors.textPrimary }]}>
              {booking ? formatPrice(booking.unit_price) : '-'}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
              Quantite ({booking?.units_count || 0} {booking?.pricing_type === 'HOURLY' ? 'heures' : booking?.pricing_type === 'DAILY' ? 'jours' : 'unites'})
            </Text>
            <Text style={[styles.priceValue, { color: colors.textPrimary }]}>
              {booking ? formatPrice(booking.subtotal) : '-'}
            </Text>
          </View>

          <View style={[styles.priceRow, styles.totalRow, { borderTopColor: colors.gray200 }]}>
            <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>
              {booking ? formatPrice(booking.total_amount) : '-'}
            </Text>
          </View>
        </View>

        {/* Status */}
        {booking?.status && (
          <View style={[styles.section, { borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Statut de la reservation</Text>

            <View style={[styles.currentStatusDisplay, { backgroundColor: withOpacity(STATUS_FLOW[booking.status]?.color || colors.warning, OPACITY[10]) }]}>
              {(() => {
                const config = STATUS_CONFIG[booking.status] || STATUS_CONFIG.PENDING;
                const StatusIcon = config.icon;
                return <StatusIcon size={20} color={STATUS_FLOW[booking.status]?.color || colors.warning} strokeWidth={ICON.strokeWidth} />;
              })()}
              <Text style={[styles.currentStatusDisplayText, { color: STATUS_FLOW[booking.status]?.color || colors.warning }]}>
                {STATUS_FLOW[booking.status]?.label || booking.status}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.statusPickerButton, { borderColor: colors.gray300, backgroundColor: colors.gray100 }]}
              onPress={() => setShowStatusPicker(!showStatusPicker)}
            >
              <Text style={[styles.statusPickerButtonText, { color: colors.textPrimary }]}>
                Changer le statut
              </Text>
              <ChevronDown
                size={20}
                color={colors.gray500}
                strokeWidth={ICON.strokeWidth}
                style={{ transform: [{ rotate: showStatusPicker ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>

            {showStatusPicker && (
              <View style={[styles.statusOptions, { borderColor: colors.gray200, backgroundColor: colors.surface }]}>
                {(Object.keys(STATUS_FLOW) as BookingStatus[])
                  .filter(status => status !== booking.status)
                  .map((status) => {
                    const config = STATUS_CONFIG[status];
                    const flow = STATUS_FLOW[status];
                    const Icon = config.icon;

                    return (
                      <TouchableOpacity
                        key={status}
                        style={[styles.statusOption, { borderBottomColor: colors.gray200, backgroundColor: colors.surface }]}
                        onPress={() => handleUpdateStatus(status)}
                      >
                        <View style={[styles.statusOptionIcon, { backgroundColor: withOpacity(config.color, OPACITY[15]) }]}>
                          <Icon size={16} color={config.color} strokeWidth={ICON.strokeWidth} />
                        </View>
                        <View style={styles.statusOptionInfo}>
                          <Text style={[styles.statusOptionLabel, { color: colors.textPrimary }]}>
                            {flow.label}
                          </Text>
                          <Text style={[styles.statusOptionDesc, { color: colors.gray500 }]}>
                            {flow.description}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            )}
          </View>
        )}

        {/* Special Requests */}
        {booking?.special_requests && (
          <View style={[styles.section, { borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Demandes speciales</Text>
            <Text style={[styles.specialRequestsText, { color: colors.textSecondary }]}>
              {booking.special_requests}
            </Text>
          </View>
        )}

        {/* Purpose */}
        {booking?.purpose && (
          <View style={[styles.section, { borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Objet de la reservation</Text>
            <Text style={[styles.specialRequestsText, { color: colors.textSecondary }]}>
              {booking.purpose}
            </Text>
          </View>
        )}

        {/* Delete button */}
        <TouchableOpacity
          style={[styles.deleteButton, { borderColor: colors.error }]}
          onPress={handleDeleteBooking}
        >
          <Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.deleteButtonText, { color: colors.error }]}>
            Supprimer cette reservation
          </Text>
        </TouchableOpacity>

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

    const talent = booking?.talent;
    const talentName = talent?.display_name ||
      (talent?.first_name && talent?.last_name
        ? `${talent.first_name} ${talent.last_name}`
        : 'Client');

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
                Envoyez un message au client pour demarrer la conversation.
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
          placeholder="Ecrivez votre message..."
          showDatetimeOption={true}
        />
      </View>
    );
  };

  const renderNotesTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.notesCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
        <View style={styles.notesHeader}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Notes internes</Text>
          <TouchableOpacity onPress={() => isEditingNotes ? handleSaveNotes() : setIsEditingNotes(true)}>
            {isEditingNotes ? (
              <Save size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            ) : (
              <SquarePen size={20} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            )}
          </TouchableOpacity>
        </View>
        <TextInput
          style={[styles.notesInput, { backgroundColor: colors.gray50, color: colors.textPrimary }]}
          placeholder="Ajoutez des notes internes sur cette reservation..."
          placeholderTextColor={colors.gray400}
          value={internalNotes}
          onChangeText={setInternalNotes}
          multiline
          numberOfLines={8}
          editable={isEditingNotes}
        />
        <Text style={[styles.notesHint, { color: colors.gray400 }]}>
          Ces notes sont visibles uniquement par votre equipe.
        </Text>
      </View>
    </View>
  );

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

  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusConfig.icon;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={[styles.statusBadge, { backgroundColor: withOpacity(statusConfig.color, OPACITY[15]) }]}>
            <StatusIcon size={14} color={statusConfig.color} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {STATUS_FLOW[booking.status]?.label || booking.status}
            </Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: colors.gray200 }]}>
        {renderTab('profile', 'Profil')}
        {renderTab('messages', 'Messages')}
        {renderTab('notes', 'Notes')}
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.contentContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
