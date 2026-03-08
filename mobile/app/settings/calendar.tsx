import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT, ThemeColors } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useSpace } from '../../src/contexts/SpaceContext';
import { PageLayout, EmptyState, IconButton } from '../../src/components/ui';
import { getCurrentLocale } from '../../src/i18n';
import { api } from '../../src/services/api';
import { useI18n } from '../../src/contexts/I18nContext';

type EventType = 'event' | 'scheduled_post' | 'opportunity' | 'reservation' | 'application' | 'trigger';

interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  description?: string;
  isoDateTime?: string;
  date: string;
  time: string;
  location?: string;
  community_id?: string;
  community_name?: string;
}

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

const formatDateLabel = (dateStr: string, t: (key: string) => string, daysShort: string[], monthsShort: string[]): string => {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(date);
  eventDay.setHours(0, 0, 0, 0);

  if (eventDay.getTime() === today.getTime()) return t('calendar.today');

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (eventDay.getTime() === tomorrow.getTime()) return t('calendar.tomorrow');

  return `${daysShort[date.getDay()]} ${date.getDate()} ${monthsShort[date.getMonth()]}`;
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
  return date.toLocaleTimeString(getCurrentLocale(), { hour: '2-digit', minute: '2-digit' });
};

export default function CalendarScreen() {
  const { colors, isDark } = useTheme();
  const { isOrganizationSpace, selectedOrg } = useSpace();
  const { t, locale } = useI18n();
  const router = useRouter();
  const now = new Date();

  const MONTHS = useMemo(() => [
    t('calendar.months.january'), t('calendar.months.february'), t('calendar.months.march'),
    t('calendar.months.april'), t('calendar.months.may'), t('calendar.months.june'),
    t('calendar.months.july'), t('calendar.months.august'), t('calendar.months.september'),
    t('calendar.months.october'), t('calendar.months.november'), t('calendar.months.december'),
  ], [t]);

  const DAYS_SHORT = useMemo(() => [
    t('calendar.daysShort.sun'), t('calendar.daysShort.mon'), t('calendar.daysShort.tue'),
    t('calendar.daysShort.wed'), t('calendar.daysShort.thu'), t('calendar.daysShort.fri'),
    t('calendar.daysShort.sat'),
  ], [t]);

  const MONTHS_SHORT = useMemo(() => [
    t('calendar.monthsShort.jan'), t('calendar.monthsShort.feb'), t('calendar.monthsShort.mar'),
    t('calendar.monthsShort.apr'), t('calendar.monthsShort.may'), t('calendar.monthsShort.jun'),
    t('calendar.monthsShort.jul'), t('calendar.monthsShort.aug'), t('calendar.monthsShort.sep'),
    t('calendar.monthsShort.oct'), t('calendar.monthsShort.nov'), t('calendar.monthsShort.dec'),
  ], [t]);
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // FAB sheet state
  const [showSheet, setShowSheet] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState(new Date());
  const [eventDescription, setEventDescription] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTriggerId, setEditingTriggerId] = useState<string | null>(null);

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
            isoDateTime: eventDate || undefined,
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
    } else if (event.type === 'trigger') {
      const dueDate = event.isoDateTime ? new Date(event.isoDateTime) : new Date(`${event.date}T08:00:00`);
      setEditingTriggerId(event.id);
      setReminderTitle(event.title || '');
      setEventDescription(event.description || '');
      setReminderDate(isNaN(dueDate.getTime()) ? new Date() : dueDate);
      setShowSheet(true);
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
    setEditingTriggerId(null);
    setReminderTitle('');
    setReminderDate(new Date());
    setEventDescription('');
    setShowSheet(true);
  };

  const closeSheet = () => {
    setShowSheet(false);
    setEditingTriggerId(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const handleCreate = async () => {
    if (!reminderTitle.trim()) return;
    setIsCreating(true);
    try {
      if (editingTriggerId) {
        await api.patch(`/api/calendar/triggers/${editingTriggerId}`, {
          title: reminderTitle.trim(),
          description: eventDescription.trim() || null,
          due_at: reminderDate.toISOString(),
          status: 'PENDING',
        });
      } else {
        await api.post('/api/calendar/triggers', {
          code: 'user_event',
          title: reminderTitle.trim(),
          due_at: reminderDate.toISOString(),
          ...(eventDescription.trim() ? { description: eventDescription.trim() } : {}),
          ...(isOrganizationSpace && selectedOrg?.id ? { organizationId: selectedOrg.id } : {}),
        });
      }
      closeSheet();
      handleRefresh();
    } catch (_) {
      // silently fail
    } finally {
      setIsCreating(false);
    }
  };

  const formatReminderDate = (d: Date) => {
    const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${t('calendar.at')} ${time}`;
  };

  // --- Header ---
  const headerContent = (
    <View style={styles.monthSelector}>
      <IconButton
        onPress={handlePrevMonth}
        icon={<ChevronLeft size={20} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
        accessibilityLabel={t('calendar.previousMonth')}
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
        accessibilityLabel={t('calendar.nextMonth')}
        size="sm"
        variant="ghost"
        style={styles.monthButton}
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <PageLayout
        title={t('calendar.title')}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        isLoading={isLoading}
        headerContent={headerContent}
      >
        {sortedDates.map((date) => {
          const dateEvents = groupedEvents[date];
          const todayDate = isToday(date);
          const label = formatDateLabel(date, t, DAYS_SHORT, MONTHS_SHORT);

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
                    accessibilityLabel={t('calendar.viewEvent', { title: event.title })}
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
            icon={CalendarIcon}
            title={isOrganizationSpace ? t('calendar.emptyOrg', { name: selectedOrg?.name || 'Organisation' }) : t('calendar.title')}
            subtitle={
              isOrganizationSpace
                ? t('calendar.emptyOrgSubtitle')
                : t('calendar.emptyTalentSubtitle')
            }
          />
        )}

        {/* Bottom spacer for FAB */}
        <View style={{ height: 80 }} />
      </PageLayout>

      {/* FAB — direct open modal */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={t('calendar.createEvent')}
      >
        <Plus size={ICON.size.xl} color={colors.textOnPrimary} strokeWidth={2} />
      </Pressable>

      {/* Bottom sheet modal */}
      <Modal visible={showSheet} transparent animationType="slide" onRequestClose={closeSheet}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <Pressable style={styles.overlay} onPress={closeSheet}>
            <View
              style={[styles.sheet, { backgroundColor: colors.surface }]}
              onStartShouldSetResponder={() => true}
            >
              {/* Header */}
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                  {editingTriggerId ? t('calendar.editEvent') : t('calendar.newEvent')}
                </Text>
                <Pressable onPress={closeSheet} hitSlop={8}>
                  <X size={20} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                </Pressable>
              </View>

              {/* Title */}
              <TextInput
                style={[styles.input, {
                  color: colors.textPrimary,
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.borderColor,
                }]}
                placeholder={t('calendar.eventTitle')}
                placeholderTextColor={colors.textTertiary}
                value={reminderTitle}
                onChangeText={setReminderTitle}
                autoFocus
              />

              {/* Description */}
              <TextInput
                style={[styles.input, styles.descriptionInput, {
                  color: colors.textPrimary,
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.borderColor,
                }]}
                placeholder={t('calendar.eventDescription')}
                placeholderTextColor={colors.textTertiary}
                value={eventDescription}
                onChangeText={setEventDescription}
                multiline
                numberOfLines={2}
              />

              {/* Date & Time */}
              <Pressable
                style={[styles.dateTimeButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderColor }]}
                onPress={() => setShowDatePicker(true)}
              >
                <CalendarIcon size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.dateTimeText, { color: colors.textPrimary }]}>
                  {formatReminderDate(reminderDate)}
                </Text>
              </Pressable>

              {(showDatePicker || showTimePicker) && (
                <DateTimePicker
                  value={reminderDate}
                  mode={showDatePicker ? 'date' : 'time'}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  themeVariant={isDark ? 'dark' : 'light'}
                  textColor={colors.textPrimary}
                  minimumDate={new Date()}
                  onChange={(_, selectedDate) => {
                    if (Platform.OS === 'android') {
                      setShowDatePicker(false);
                      setShowTimePicker(false);
                    }
                    if (selectedDate) {
                      setReminderDate(selectedDate);
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
                  onPress={() => { setShowDatePicker(false); setShowTimePicker(true); }}
                >
                  <Text style={[styles.pickerDoneText, { color: colors.primary }]}>{t('calendar.chooseTime')}</Text>
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

              {/* Create button */}
              <Pressable
                style={[
                  styles.createButton,
                  { backgroundColor: reminderTitle.trim() ? colors.primary : colors.gray300 },
                ]}
                onPress={handleCreate}
                disabled={!reminderTitle.trim() || isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Text style={[styles.createButtonText, { color: colors.textOnPrimary }]}>
                    {editingTriggerId ? t('common.save') : t('common.create')}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
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
    bottom: SPACING.xl,
    right: SPACING.lg,
    width: LAYOUT.fabSize,
    height: LAYOUT.fabSize,
    borderRadius: LAYOUT.fabSize / 2,
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sheetTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Form
  input: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    marginBottom: SPACING.sm,
  },
  descriptionInput: {
    minHeight: 56,
    textAlignVertical: 'top',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    marginBottom: SPACING.sm,
  },
  dateTimeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
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
    marginTop: SPACING.xs,
  },
  createButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
