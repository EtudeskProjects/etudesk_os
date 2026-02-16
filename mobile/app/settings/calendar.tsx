import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Calendar,
  Briefcase,
  Users,
  MapPin,
  FileText,
  Send,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  MessageCircle,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SPACING, TYPOGRAPHY, ICON, BORDER, ThemeColors } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useSpace } from '../../src/contexts/SpaceContext';
import { PageLayout, EmptyState, IconButton } from '../../src/components/ui';
import { api } from '../../src/services/api';

type EventType = 'event' | 'scheduled_post' | 'opportunity' | 'reservation' | 'application' | 'trigger';

interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  description?: string;
  date: string;
  time: string;
  location?: string;
  community_id?: string;
  community_name?: string;
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const getEventColor = (type: EventType, colors: ThemeColors): string => {
  switch (type) {
    case 'event': return colors.primary;
    case 'scheduled_post': return colors.info;
    case 'opportunity': return colors.success;
    case 'reservation': return colors.warning;
    case 'application': return colors.cardTalentAccent;
    case 'trigger': return colors.primary;
    default: return colors.gray500;
  }
};

const formatDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(date);
  eventDay.setHours(0, 0, 0, 0);

  if (eventDay.getTime() === today.getTime()) return "Aujourd'hui";

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (eventDay.getTime() === tomorrow.getTime()) return 'Demain';

  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
};

const isToday = (dateStr: string): boolean => {
  const date = new Date(dateStr);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

type SheetMode = 'menu' | 'reminder';

export default function CalendarScreen() {
  const { colors } = useTheme();
  const { isOrganizationSpace, selectedOrg } = useSpace();
  const router = useRouter();
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // FAB sheet state
  const [showSheet, setShowSheet] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>('menu');
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchCalendarEvents = useCallback(async () => {
    try {
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

      const response = await api.get('/api/calendar/events', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        ...(isOrganizationSpace && selectedOrg?.id ? { organizationId: selectedOrg.id } : {}),
      });

      if (response?.data) {
        const transformedEvents: CalendarEvent[] = (response.data as any[]).map((item: any) => {
          let type: EventType = 'event';
          let title = item.title || item.name || 'Sans titre';
          let eventDate = item.scheduled_at || item.start_date || item.date;

          if (item.source === 'trigger' || item.type === 'TRIGGER') {
            type = 'trigger';
            title = item.title || item.metadata?.title || 'Rappel';
          } else if (item.source === 'application_received' || item.type === 'APPLICATION') {
            type = 'application';
            title = item.title || 'Candidature';
          } else if (item.source === 'scheduled_post' || item.type === 'POST') {
            type = 'scheduled_post';
            title = item.content?.substring(0, 50) || 'Publication programmée';
          } else if (item.source === 'opportunity' || item.type === 'OPPORTUNITY') {
            type = 'opportunity';
          } else if (item.source === 'reservation' || item.type === 'RESERVATION') {
            type = 'reservation';
          } else if (item.source === 'event' || item.type === 'EVENT') {
            type = 'event';
            title = item.metadata?.title || title;
          }

          return {
            id: item.id,
            type,
            title,
            description: item.description || item.content?.substring(0, 100),
            date: eventDate?.split('T')[0] || new Date().toISOString().split('T')[0],
            time: formatTime(eventDate || new Date().toISOString()),
            location: item.location || item.metadata?.location,
            community_id: item.community_id,
            community_name: item.community_name || item.community?.name,
          };
        });

        setEvents(transformedEvents);
      }
    } catch (error) {
      setEvents([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentMonth, currentYear, isOrganizationSpace, selectedOrg?.id]);

  useEffect(() => {
    setIsLoading(true);
    fetchCalendarEvents();
  }, [fetchCalendarEvents]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchCalendarEvents();
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
  });

  const groupedEvents = filteredEvents.reduce((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = [];
    }
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  const handleEventPress = (event: CalendarEvent) => {
    if ((event.type === 'event' || event.type === 'scheduled_post') && event.community_id) {
      router.push(`/details/community/${event.community_id}`);
    } else if (event.type === 'application') {
      router.push(`/gestion/opportunities/applications/details/${event.id}` as any);
    } else if (event.type === 'opportunity') {
      router.push(`/details/opportunity/${event.id}`);
    } else if (event.type === 'reservation') {
      router.push(isOrganizationSpace ? (`/gestion/spaces/bookings/details/${event.id}` as any) : (`/settings/my-reservations/${event.id}` as any));
    }
  };

  const sortedDates = Object.keys(groupedEvents).sort();

  // --- FAB / Sheet handlers ---
  const openSheet = () => {
    setSheetMode('menu');
    setReminderTitle('');
    setReminderDate(new Date());
    setShowSheet(true);
  };

  const closeSheet = () => {
    setShowSheet(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const handleCreateReminder = async () => {
    if (!reminderTitle.trim()) return;
    setIsCreating(true);
    try {
      await api.post('/api/calendar/triggers', {
        code: 'user_reminder',
        title: reminderTitle.trim(),
        due_at: reminderDate.toISOString(),
        ...(isOrganizationSpace && selectedOrg?.id ? { organizationId: selectedOrg.id } : {}),
      });
      closeSheet();
      handleRefresh();
    } catch (_) {
      // silently fail
    } finally {
      setIsCreating(false);
    }
  };

  const formatReminderDate = (d: Date) => {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} à ${time}`;
  };

  // --- Header ---
  const headerContent = (
    <View style={styles.monthSelector}>
      <IconButton
        onPress={handlePrevMonth}
        icon={<ChevronLeft size={20} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
        accessibilityLabel="Mois précédent"
        size="sm"
        variant="ghost"
        style={styles.monthButton}
      />
      <Text style={[styles.monthText, { color: colors.textPrimary }]}>
        {MONTHS[currentMonth]} {currentYear}
      </Text>
      <IconButton
        onPress={handleNextMonth}
        icon={<ChevronRight size={20} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
        accessibilityLabel="Mois suivant"
        size="sm"
        variant="ghost"
        style={styles.monthButton}
      />
    </View>
  );

  // --- Sheet menu options ---
  const menuOptions = [
    {
      icon: Sparkles,
      label: 'Créer un rappel',
      onPress: () => setSheetMode('reminder'),
    },
    {
      icon: MessageCircle,
      label: "Demander à l'assistant",
      onPress: () => {
        closeSheet();
        router.push('/(tabs)/assistant');
      },
    },
    ...(isOrganizationSpace ? [{
      icon: Users,
      label: 'Créer un événement',
      onPress: () => {
        closeSheet();
        // Navigate to communities tab for event creation
        router.push('/(tabs)/communities' as any);
      },
    }] : []),
  ];

  return (
    <View style={{ flex: 1 }}>
      <PageLayout
        title="Agenda"
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        isLoading={isLoading}
        headerContent={headerContent}
      >
        {sortedDates.map((date) => {
          const dateEvents = groupedEvents[date];
          const todayDate = isToday(date);
          const label = formatDateLabel(date);

          return (
            <View key={date} style={styles.dateSection}>
              {/* Date separator */}
              <View style={styles.dateLabelRow}>
                <Text style={[
                  styles.dateLabel,
                  todayDate
                    ? { color: colors.primary, fontWeight: TYPOGRAPHY.fontWeight.bold }
                    : { color: colors.textSecondary, fontWeight: TYPOGRAPHY.fontWeight.semibold },
                ]}>
                  {label}
                </Text>
              </View>
              <View style={[styles.dateDivider, { backgroundColor: todayDate ? colors.primary : colors.gray200 }]} />

              {/* Event rows */}
              {dateEvents.map((event, index) => {
                const eventColor = getEventColor(event.type, colors);
                const isLast = index === dateEvents.length - 1;

                return (
                  <Pressable
                    key={event.id}
                    style={[
                      styles.eventRow,
                      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray100 },
                    ]}
                    onPress={() => handleEventPress(event)}
                    accessibilityRole="button"
                    accessibilityLabel={`Voir: ${event.title}`}
                  >
                    <View style={[styles.eventDot, { backgroundColor: eventColor }]} />
                    <Text style={[styles.eventTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={[styles.eventTime, { color: colors.gray500 }]}>{event.time}</Text>
                    <ChevronRight size={14} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                  </Pressable>
                );
              })}
            </View>
          );
        })}

        {sortedDates.length === 0 && (
          <EmptyState
            icon={Calendar}
            title={isOrganizationSpace ? `Agenda ${selectedOrg?.name || 'Organisation'}` : 'Aucun événement ce mois-ci'}
            subtitle={
              isOrganizationSpace
                ? "Candidatures, réservations, événements et relances de l'agent apparaîtront ici."
                : 'Vos événements, publications programmées et opportunités apparaîtront ici'
            }
          />
        )}

        {/* Bottom spacer for FAB */}
        <View style={{ height: 80 }} />
      </PageLayout>

      {/* FAB */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel="Ajouter"
      >
        <Plus size={24} color={colors.textOnPrimary} strokeWidth={2} />
      </Pressable>

      {/* Bottom sheet modal */}
      <Modal visible={showSheet} transparent animationType="fade" onRequestClose={closeSheet}>
        <Pressable style={styles.overlay} onPress={closeSheet}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            {sheetMode === 'menu' ? (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Nouvelle action</Text>
                  <Pressable onPress={closeSheet} hitSlop={8}>
                    <X size={20} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                  </Pressable>
                </View>
                {menuOptions.map((option, i) => {
                  const Icon = option.icon;
                  return (
                    <Pressable
                      key={i}
                      style={[styles.sheetOption, { borderBottomColor: colors.gray100 }]}
                      onPress={option.onPress}
                    >
                      <View style={[styles.sheetOptionIcon, { backgroundColor: colors.backgroundSecondary }]}>
                        <Icon size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                      </View>
                      <Text style={[styles.sheetOptionLabel, { color: colors.textPrimary }]}>
                        {option.label}
                      </Text>
                      <ChevronRight size={16} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                    </Pressable>
                  );
                })}
              </>
            ) : (
              <>
                <View style={styles.sheetHeader}>
                  <Pressable onPress={() => setSheetMode('menu')} hitSlop={8}>
                    <ChevronLeft size={20} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
                  </Pressable>
                  <Text style={[styles.sheetTitle, { color: colors.textPrimary, flex: 1, textAlign: 'center' }]}>
                    Créer un rappel
                  </Text>
                  <Pressable onPress={closeSheet} hitSlop={8}>
                    <X size={20} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                  </Pressable>
                </View>

                <TextInput
                  style={[styles.reminderInput, {
                    color: colors.textPrimary,
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.borderColor,
                  }]}
                  placeholder="Ex: Relancer le candidat..."
                  placeholderTextColor={colors.textTertiary}
                  value={reminderTitle}
                  onChangeText={setReminderTitle}
                  autoFocus
                />

                <View style={styles.dateTimeRow}>
                  <Pressable
                    style={[styles.dateTimeButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderColor }]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={[styles.dateTimeText, { color: colors.textPrimary }]}>
                      {formatReminderDate(reminderDate)}
                    </Text>
                  </Pressable>
                </View>

                {(showDatePicker || showTimePicker) && (
                  <DateTimePicker
                    value={reminderDate}
                    mode={showDatePicker ? 'date' : 'time'}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onChange={(_, selectedDate) => {
                      if (Platform.OS === 'android') {
                        setShowDatePicker(false);
                        setShowTimePicker(false);
                      }
                      if (selectedDate) {
                        setReminderDate(selectedDate);
                        // On Android, chain date → time picker
                        if (Platform.OS === 'android' && showDatePicker) {
                          setTimeout(() => setShowTimePicker(true), 300);
                        }
                      }
                    }}
                  />
                )}

                {Platform.OS === 'ios' && showDatePicker && (
                  <Pressable
                    style={[styles.pickerDone, { borderTopColor: colors.gray200 }]}
                    onPress={() => {
                      setShowDatePicker(false);
                      setShowTimePicker(true);
                    }}
                  >
                    <Text style={[styles.pickerDoneText, { color: colors.primary }]}>Choisir l'heure</Text>
                  </Pressable>
                )}

                {Platform.OS === 'ios' && showTimePicker && (
                  <Pressable
                    style={[styles.pickerDone, { borderTopColor: colors.gray200 }]}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Text style={[styles.pickerDoneText, { color: colors.primary }]}>OK</Text>
                  </Pressable>
                )}

                <Pressable
                  style={[
                    styles.createButton,
                    { backgroundColor: reminderTitle.trim() ? colors.primary : colors.gray300 },
                  ]}
                  onPress={handleCreateReminder}
                  disabled={!reminderTitle.trim() || isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  ) : (
                    <Text style={[styles.createButtonText, { color: colors.textOnPrimary }]}>Créer</Text>
                  )}
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Month Selector — compact, no background
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },

  monthButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  monthText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Date section
  dateSection: {
    marginBottom: SPACING.lg,
  },

  dateLabelRow: {
    marginBottom: 4,
  },

  dateLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  dateDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: SPACING.xs,
  },

  // Event row — compact ~44px
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },

  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  eventTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  eventTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginRight: 4,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sheet
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },

  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },

  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },

  sheetTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: SPACING.md,
  },

  sheetOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sheetOptionLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Reminder form
  reminderInput: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    marginBottom: SPACING.md,
  },

  dateTimeRow: {
    marginBottom: SPACING.md,
  },

  dateTimeButton: {
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },

  dateTimeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  pickerDone: {
    alignItems: 'flex-end',
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: SPACING.xs,
  },

  pickerDoneText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  createButton: {
    borderRadius: BORDER.radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },

  createButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
