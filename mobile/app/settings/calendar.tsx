import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Calendar,
  Briefcase,
  Users,
  MapPin,
  Clock,
  ChevronRight,
  ChevronLeft,
  FileText,
  Send,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { api } from '../../src/services/api';

type EventType = 'event' | 'scheduled_post' | 'opportunity' | 'reservation';

interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  description?: string;
  date: string;
  time: string;
  location?: string;
  community_name?: string;
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const getEventColor = (type: EventType): string => {
  switch (type) {
    case 'event': return '#9C27B0';
    case 'scheduled_post': return '#2196F3';
    case 'opportunity': return '#4CAF50';
    case 'reservation': return '#FF9800';
    default: return '#757575';
  }
};

const getEventIcon = (type: EventType) => {
  switch (type) {
    case 'event': return Users;
    case 'scheduled_post': return Send;
    case 'opportunity': return Briefcase;
    case 'reservation': return MapPin;
    default: return FileText;
  }
};

const formatDate = (dateStr: string): { day: string; month: string; weekday: string } => {
  const date = new Date(dateStr);
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

  return {
    day: date.getDate().toString(),
    month: months[date.getMonth()],
    weekday: days[date.getDay()],
  };
};

const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

export default function CalendarScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCalendarEvents = useCallback(async () => {
    try {
      // Calculate date range for the selected month
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

      const response = await api.get('/api/calendar/events', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });

      if (response?.data) {
        // Transform API response to CalendarEvent format
        const transformedEvents: CalendarEvent[] = response.data.map((item: any) => {
          let type: EventType = 'event';
          let title = item.title || item.name || 'Sans titre';
          let eventDate = item.scheduled_at || item.start_date || item.date;

          // Determine event type based on source
          if (item.source === 'scheduled_post' || item.type === 'POST') {
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
            community_name: item.community_name || item.community?.name,
          };
        });

        setEvents(transformedEvents);
      }
    } catch (error) {
      console.log('Could not fetch calendar events:', error);
      // Keep empty events array on error
      setEvents([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentMonth, currentYear]);

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

  // Filter events for current month
  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
  });

  // Group events by date
  const groupedEvents = filteredEvents.reduce((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = [];
    }
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  const sortedDates = Object.keys(groupedEvents).sort();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Calendrier</Text>
        <View style={styles.backButton} />
      </View>

      {/* Month Selector */}
      <View style={[styles.monthSelector, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.monthButton}>
          <ChevronLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <View style={styles.monthDisplay}>
          <Calendar size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.monthText, { color: colors.textPrimary }]}>
            {MONTHS[currentMonth]} {currentYear}
          </Text>
        </View>
        <TouchableOpacity onPress={handleNextMonth} style={styles.monthButton}>
          <ChevronRight size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: getEventColor('event') }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Événements</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: getEventColor('scheduled_post') }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Publications</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: getEventColor('opportunity') }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Opportunités</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Events by Date */}
          {sortedDates.map((date) => {
            const dateEvents = groupedEvents[date];
            const { day, month, weekday } = formatDate(date);

            return (
              <View key={date} style={styles.dateSection}>
                {/* Date Header */}
                <View style={styles.dateHeader}>
                  <View style={[styles.dateBox, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.dateDay, { color: colors.primary }]}>{day}</Text>
                    <Text style={[styles.dateMonth, { color: colors.primary }]}>{month}</Text>
                  </View>
                  <Text style={[styles.dateWeekday, { color: colors.textSecondary }]}>{weekday}</Text>
                </View>

                {/* Events for this date */}
                <View style={[styles.eventsContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
                  {dateEvents.map((event, index) => {
                    const eventColor = getEventColor(event.type);
                    const EventIcon = getEventIcon(event.type);
                    const isLast = index === dateEvents.length - 1;

                    return (
                      <TouchableOpacity
                        key={event.id}
                        style={[
                          styles.eventItem,
                          { borderBottomColor: colors.gray100 },
                          isLast && styles.eventItemLast,
                        ]}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.eventIndicator, { backgroundColor: eventColor }]} />
                        <View style={[styles.eventIcon, { backgroundColor: eventColor + '15' }]}>
                          <EventIcon size={ICON.size.sm} color={eventColor} strokeWidth={ICON.strokeWidth} />
                        </View>
                        <View style={styles.eventInfo}>
                          <Text style={[styles.eventTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                            {event.title}
                          </Text>
                          {event.community_name && (
                            <Text style={[styles.eventCommunity, { color: colors.primary }]} numberOfLines={1}>
                              {event.community_name}
                            </Text>
                          )}
                          {event.description && (
                            <Text style={[styles.eventDescription, { color: colors.textSecondary }]} numberOfLines={1}>
                              {event.description}
                            </Text>
                          )}
                          <View style={styles.eventMeta}>
                            <Clock size={12} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                            <Text style={[styles.eventTime, { color: colors.gray400 }]}>{event.time}</Text>
                            {event.location && (
                              <>
                                <Text style={[styles.eventDot, { color: colors.gray400 }]}>•</Text>
                                <MapPin size={12} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                                <Text style={[styles.eventLocation, { color: colors.gray400 }]} numberOfLines={1}>
                                  {event.location}
                                </Text>
                              </>
                            )}
                          </View>
                        </View>
                        <ChevronRight size={ICON.size.sm} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {sortedDates.length === 0 && (
            <View style={styles.emptyState}>
              <Calendar size={ICON.size.xl} color={colors.gray300} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Aucun événement ce mois-ci
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.gray400 }]}>
                Vos événements, publications programmées et opportunités apparaîtront ici
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Month Selector
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },

  monthButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  monthDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  monthText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  legendText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  // Date Section
  dateSection: {
    marginBottom: SPACING.lg,
  },

  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  dateBox: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dateDay: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  dateMonth: {
    fontSize: TYPOGRAPHY.fontSize.xxs,
    textTransform: 'uppercase',
  },

  dateWeekday: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Events Container
  eventsContainer: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
    marginLeft: 56,
  },

  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },

  eventItemLast: {
    borderBottomWidth: 0,
  },

  eventIndicator: {
    width: 4,
    height: '100%',
    position: 'absolute',
    left: 0,
    borderRadius: 2,
  },

  eventIcon: {
    width: 36,
    height: 36,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.xs,
  },

  eventInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },

  eventTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  eventCommunity: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginTop: 1,
  },

  eventDescription: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },

  eventTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  eventDot: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  eventLocation: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    flex: 1,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
  },

  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    marginTop: SPACING.md,
  },

  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.xl,
  },
});
