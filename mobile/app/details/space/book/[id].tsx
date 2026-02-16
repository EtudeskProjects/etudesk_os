import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
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
  CreditCard,
  Calendar,
  Clock,
  HelpCircle,
  Home,
  Minus,
  Plus,
	CalendarDays,
	Info,
	FileText,
} from 'lucide-react-native';
	import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT, OPACITY, withOpacity } from '../../../../src/constants/theme';
	import { Button, CheckboxRow, Chip, IconButton, Input, StepIndicator, LoadingShimmer } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { useAuth } from '../../../../src/contexts/AuthContext';
import { useAlert } from '../../../../src/contexts/AlertContext';
import { ScrollToInputContext } from '../../../../src/contexts/ScrollToInputContext';
import {
  spaceService,
  Space,
  SpaceAvailability,
  AvailabilityCheckResult,
  talentService,
  kycService,
} from '../../../../src/services';
import type { TalentObjectData } from '../../../../src/types/models';
import { getFullImageUrl } from '../../../../src/utils/image';
import {
  SPACE_TYPE_LABELS,
  formatPrice,
  WEEKDAYS,
  PRICING_TYPE_LABELS,
  PRICING_TYPE_UNITS,
} from '../../../../src/constants/space';
import { formatNumberNoTrailingZeros } from '../../../../src/utils/number';

// ===================================================================
// TYPES
// ===================================================================

type BookingStep = 'profile' | 'datetime' | 'rules' | 'questions' | 'preview' | 'success';

const STEPS: BookingStep[] = ['profile', 'datetime', 'rules', 'questions', 'preview', 'success'];

const STEP_TITLES: Record<BookingStep, string> = {
  profile: 'Profil',
  datetime: 'Date & Heure',
  rules: 'Regles',
  questions: 'Questions',
  preview: 'Apercu',
  success: 'Confirmation',
};

interface BookingQuestion {
  id: string;
  question: string;
  required?: boolean;
}

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

// Generate time slots (e.g., "08:00", "08:30", "09:00", ...)
const generateTimeSlots = (startTime: string, endTime: string): string[] => {
  const slots: string[] = [];
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  let currentHour = startHour;
  let currentMinute = startMinute;

  while (
    currentHour < endHour ||
    (currentHour === endHour && currentMinute < endMinute)
  ) {
    const time = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
    slots.push(time);
    currentMinute += 30;
    if (currentMinute >= 60) {
      currentMinute = 0;
      currentHour++;
    }
  }

  return slots;
};

// Format date for display
const formatDateDisplay = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return date.toLocaleDateString('fr-FR', options);
};

// Format datetime for API
const formatDatetimeForApi = (date: Date, time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  const newDate = new Date(date);
  newDate.setHours(hours, minutes, 0, 0);
  return newDate.toISOString();
};

// Calculate end datetime based on duration
const calculateEndDatetime = (date: Date, startTime: string, durationHours: number): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const newDate = new Date(date);
  newDate.setHours(hours + durationHours, minutes, 0, 0);
  return newDate.toISOString();
};

// Generate calendar days
const generateCalendarDays = (year: number, month: number): (Date | null)[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];

  // Add empty slots for days before the first day
  const firstDayOfWeek = firstDay.getDay();
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }

  // Add all days of the month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  return days;
};

// ===================================================================
// COMPONENT
// ===================================================================

export default function BookSpaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
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

  // Loading & data states
  const [currentStep, setCurrentStep] = useState<BookingStep>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [space, setSpace] = useState<Space | null>(null);
  const [profile, setProfile] = useState<TalentObjectData | null>(null);
  const [availabilities, setAvailabilities] = useState<SpaceAvailability[]>([]);
  const [availabilityResult, setAvailabilityResult] = useState<AvailabilityCheckResult | null>(null);
  const [bookingReference, setBookingReference] = useState<string>('');

  // Form states
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedStartTime, setSelectedStartTime] = useState<string>('');
  const [durationHours, setDurationHours] = useState(1);
  const [attendeesCount, setAttendeesCount] = useState(1);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [specialRequests, setSpecialRequests] = useState('');

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // ===================================================================
  // COMPUTED VALUES
  // ===================================================================

  // Get booking questions from space (if any)
  // Backend stores questions as TEXT[] (array of strings)
  const bookingQuestions = useMemo((): BookingQuestion[] => {
    const questions = (space as any)?.questions;
    if (!questions || !Array.isArray(questions) || questions.length === 0) return [];
    return questions.map((q: any, idx: number) => {
      if (typeof q === 'string') {
        return { id: String(idx + 1), question: q, required: false };
      }
      return { ...q, id: q.id || String(idx + 1) };
    });
  }, [space]);

  // Get space rules (booking_rules is TEXT[] in backend)
  const spaceRules = useMemo((): string | null => {
    const rules = (space as any)?.booking_rules;
    if (!rules) return null;
    // If it's an array, join with line breaks
    if (Array.isArray(rules) && rules.length > 0) {
      return rules.join('\n');
    }
    // If it's a string, return as is
    if (typeof rules === 'string' && rules.trim()) {
      return rules;
    }
    return null;
  }, [space]);

  // Determine which steps are active based on space config
  const getActiveSteps = (): BookingStep[] => {
    const activeSteps: BookingStep[] = ['profile', 'datetime'];

    if (spaceRules) {
      activeSteps.push('rules');
    }

    if (bookingQuestions.length > 0) {
      activeSteps.push('questions');
    }

    activeSteps.push('preview', 'success');

    return activeSteps;
  };

  // Check if space is free
  const isFreeSpace = useMemo((): boolean => {
    if (!space) return true;
    return !space.hourly_rate && !space.daily_rate && !space.weekly_rate && !space.monthly_rate;
  }, [space]);

  // Get available time slots for selected date
  const availableTimeSlots = useMemo((): string[] => {
    if (!selectedDate || !availabilities.length) return [];

    const dayOfWeek = selectedDate.getDay();
    const dayAvailability = availabilities.find(
      a => a.day_of_week === dayOfWeek && a.is_active
    );

    if (!dayAvailability) return [];

    return generateTimeSlots(dayAvailability.start_time, dayAvailability.end_time);
  }, [selectedDate, availabilities]);

  // Get calendar days
  const calendarDays = useMemo(
    () => generateCalendarDays(calendarYear, calendarMonth),
    [calendarYear, calendarMonth]
  );
  const alerts = useAlert();

  // Check if a date is available (has availability for that day of week)
  const isDateAvailable = (date: Date): boolean => {
    if (!availabilities.length) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Can't book in the past
    if (date < today) return false;

    // Check advance booking limit
    if (space?.advance_booking_days) {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + space.advance_booking_days);
      if (date > maxDate) return false;
    }

    const dayOfWeek = date.getDay();
    return availabilities.some(a => a.day_of_week === dayOfWeek && a.is_active);
  };

  // ===================================================================
  // DATA LOADING
  // ===================================================================

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      // KYC gate: vérification d'identité obligatoire
      try {
        const kycRes = await kycService.getStatus();
        if (!kycRes?.data || kycRes.data.status !== 'VERIFIED') {
          void alerts.showAlert({ title: 'Vérification requise', message: 'Tu dois vérifier ton identité avant de réserver un espace.', buttons: [
              { text: 'Plus tard', style: 'cancel', onPress: () => router.back() },
              { text: 'Vérifier', onPress: () => { router.back(); router.push('/settings/kyc'); } },
            ] });
          setIsLoading(false);
          return;
        }
      } catch {
        void alerts.showAlert({ title: 'Vérification requise', message: 'Tu dois vérifier ton identité avant de réserver un espace.', buttons: [
            { text: 'Plus tard', style: 'cancel', onPress: () => router.back() },
            { text: 'Vérifier', onPress: () => { router.back(); router.push('/settings/kyc'); } },
          ] });
        setIsLoading(false);
        return;
      }

      // Load space and availabilities first (may not require auth for public spaces)
      const [spaceResponse, availabilitiesResponse] = await Promise.all([
        spaceService.getById(id),
        spaceService.getAvailabilities(id),
      ]);

      setSpace(spaceResponse.data);
      setAvailabilities(availabilitiesResponse.data || []);

      // Set default duration based on min_booking_hours
      if (spaceResponse.data?.min_booking_hours) {
        setDurationHours(spaceResponse.data.min_booking_hours);
      }

      // Initialize answers for questions
      const questions = (spaceResponse.data as any)?.booking_questions || [];
      if (questions.length > 0) {
        const initialAnswers: Record<string, string> = {};
        questions.forEach((q: any, idx: number) => {
          const questionId = typeof q === 'string' ? String(idx + 1) : q.id || String(idx + 1);
          initialAnswers[questionId] = '';
        });
        setAnswers(initialAnswers);
      }

      // Try to load user profile (requires auth)
      try {
        const profileResponse = await talentService.getMyTalentObject({ includeHidden: false });
        setProfile(profileResponse.data);
      } catch (profileError: any) {
        // If session expired (401), redirect to login
        if (profileError?.status === 401) {
          void alerts.showAlert({ title: 'Session expiree', message: 'Votre session a expire. Veuillez vous reconnecter.', buttons: [{ text: 'OK', onPress: () => router.replace('/auth/login') }] });
          return;
        }
        // For other errors, use user data from AuthContext as fallback
        if (user) {
          setProfile({
            id: user.id || '',
            first_name: (user as any).firstName || (user as any).first_name || null,
            last_name: (user as any).lastName || (user as any).last_name || null,
            display_name: `${(user as any).firstName || (user as any).first_name || ''} ${(user as any).lastName || (user as any).last_name || ''}`.trim(),
            email: user.email || null,
            phone: (user as any).phone || null,
            avatar_url: (user as any).profilePictureUrl || (user as any).profile_picture_url || null,
            gender: null,
            bio: null,
            profile_tags: [],
            sectors: [],
            goals: [],
            city: (user as any).city || null,
            region: null,
            country: (user as any).country || null,
            remote_ready: false,
            willing_to_relocate: false,
            learning_preferences: {} as any,
            skills: [],
            documents_metadata: [],
          });
        }
      }
    } catch (error: any) {
      // Handle session expiration for space loading
      if (error?.status === 401) {
        void alerts.showAlert({ title: 'Session expiree', message: 'Votre session a expire. Veuillez vous reconnecter.', buttons: [{ text: 'OK', onPress: () => router.replace('/auth/login') }] });
        return;
      }
      void alerts.alert('Erreur', 'Impossible de charger les donnees de l\'espace.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  // ===================================================================
  // AVAILABILITY CHECK
  // ===================================================================

  const checkAvailability = async (): Promise<boolean> => {
    if (!selectedDate || !selectedStartTime || !space) return false;

    setIsCheckingAvailability(true);
    try {
      const startDatetime = formatDatetimeForApi(selectedDate, selectedStartTime);
      const endDatetime = calculateEndDatetime(selectedDate, selectedStartTime, durationHours);

      const response = await spaceService.checkAvailability(space.id, startDatetime, endDatetime);

      setAvailabilityResult(response.data);

      // Backend returns 'is_available', not 'available'
      if (!response.data?.is_available) {
        void alerts.alert('Creneau non disponible', 'Ce creneau est deja reserve. Veuillez choisir un autre horaire.');
        return false;
      }

      return true;
    } catch (error) {
      showError('Erreur', 'Impossible de verifier la disponibilite.');
      return false;
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  // ===================================================================
  // FORM HANDLERS
  // ===================================================================

  const updateAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = async () => {
    const activeSteps = getActiveSteps();
    const currentIndex = activeSteps.indexOf(currentStep);

    // Special handling for datetime step - check availability before proceeding
    if (currentStep === 'datetime') {
      const isAvailable = await checkAvailability();
      if (!isAvailable) return;
    }

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
    if (!space || !selectedDate || !selectedStartTime) return;

    setIsSubmitting(true);
    try {
      const startDatetime = formatDatetimeForApi(selectedDate, selectedStartTime);
      const endDatetime = calculateEndDatetime(selectedDate, selectedStartTime, durationHours);

      // Build answers if any questions
      let bookingAnswers: Array<{ question: string; answer: string }> | undefined;
      if (bookingQuestions.length > 0) {
        bookingAnswers = bookingQuestions
          .filter(q => answers[q.id]?.trim())
          .map(q => ({
            question: q.question,
            answer: answers[q.id].trim(),
          }));
      }

      const response = await spaceService.createBooking(space.id, {
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        purpose: specialRequests || undefined,
        attendees_count: attendeesCount,
        special_requests: specialRequests || undefined,
      });

      if (response.data) {
        setBookingReference(response.data.id.slice(0, 8).toUpperCase());
        setCurrentStep('success');
      }
    } catch (error: any) {
      showError(
        'Erreur',
        error.error || 'Une erreur est survenue lors de la reservation.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===================================================================
  // VALIDATION
  // ===================================================================

  const isProfileComplete = (): boolean => {
    if (!profile) return false;
    return !!(profile.first_name && profile.last_name && profile.email);
  };

  const canProceed = (): boolean => {
    if (!space) return false;

    switch (currentStep) {
      case 'profile':
        return isProfileComplete();
      case 'datetime':
        return !!(
          selectedDate &&
          selectedStartTime &&
          durationHours >= (space.min_booking_hours || 1) &&
          durationHours <= (space.max_booking_hours || 24) &&
          attendeesCount > 0 &&
          attendeesCount <= space.capacity
        );
      case 'rules':
        return acceptedRules;
      case 'questions':
        // Check required questions
        for (const question of bookingQuestions) {
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

  const getVisibleSteps = (): BookingStep[] => {
    return getActiveSteps().filter(s => s !== 'success');
  };

  // ===================================================================
  // RENDER STEP INDICATOR
  // ===================================================================

  const renderStepIndicator = () => {
    const visibleSteps = getVisibleSteps();
    const stepsData = visibleSteps.map(step => ({
      id: step,
      label: STEP_TITLES[step],
    }));

    return <StepIndicator steps={stepsData} currentStepId={currentStep} />;
  };

  // ===================================================================
  // RENDER PROFILE STEP
  // ===================================================================

  const renderProfileStep = () => {
    const profileComplete = isProfileComplete();
    const avatarUrl = profile?.avatar_url ? getFullImageUrl(profile.avatar_url) : null;
    const location = [profile?.city, profile?.region, profile?.country].filter(Boolean).join(', ');

    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <User size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
            Vérifiez votre profil
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Ces informations seront partagées avec le gestionnaire de l'espace
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
              <Text style={[styles.profileTagsLabel, { color: colors.gray500 }]}>Compétences</Text>
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
                <Text style={[styles.warningTitle, { color: colors.warning }]}>Profil incomplet</Text>
                <Text style={[styles.warningText, { color: colors.textSecondary }]}>
                  Complétez votre profil (nom, prénom, email) pour continuer.
                </Text>
              </View>
            </View>
          )}
        </View>

        <Button
          title="Modifier mon profil"
          onPress={() => router.push('/settings/edit-profile')}
          variant="outline"
          fullWidth
          icon={<SquarePen size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
        />
      </View>
    );
  };

  // ===================================================================
  // RENDER DATE & TIME STEP
  // ===================================================================

  const renderDateTimeStep = () => {
    const monthNames = [
      'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
    ];

    const handlePrevMonth = () => {
      if (calendarMonth === 0) {
        setCalendarMonth(11);
        setCalendarYear(calendarYear - 1);
      } else {
        setCalendarMonth(calendarMonth - 1);
      }
    };

    const handleNextMonth = () => {
      if (calendarMonth === 11) {
        setCalendarMonth(0);
        setCalendarYear(calendarYear + 1);
      } else {
        setCalendarMonth(calendarMonth + 1);
      }
    };

    const handleDateSelect = (date: Date) => {
      if (isDateAvailable(date)) {
        setSelectedDate(date);
        setSelectedStartTime(''); // Reset time when date changes
        setAvailabilityResult(null);
      }
    };

    const handleDurationChange = (delta: number) => {
      const newDuration = durationHours + delta;
      const minHours = space?.min_booking_hours || 1;
      const maxHours = space?.max_booking_hours || 24;

      if (newDuration >= minHours && newDuration <= maxHours) {
        setDurationHours(newDuration);
        setAvailabilityResult(null);
      }
    };

    const handleAttendeesChange = (delta: number) => {
      const newCount = attendeesCount + delta;
      if (newCount >= 1 && newCount <= (space?.capacity || 100)) {
        setAttendeesCount(newCount);
      }
    };

    // Calculate estimated price
    const getEstimatedPrice = (): { subtotal: number; total: number } | null => {
      if (!space) return null;
      if (isFreeSpace) return { subtotal: 0, total: 0 };

      // Use pricing from availability check if available
      if (availabilityResult?.pricing) {
        return {
          subtotal: availabilityResult.pricing.subtotal,
          total: availabilityResult.pricing.total,
        };
      }

      // Otherwise estimate based on hourly rate
      if (space.hourly_rate) {
        const subtotal = space.hourly_rate * durationHours;
        return { subtotal, total: subtotal };
      }

      return null;
    };

    const estimatedPrice = getEstimatedPrice();

    // Show message if no availabilities configured
    if (availabilities.length === 0) {
      return (
        <View style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <AlertCircle size={48} color={colors.warning} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
              Aucune disponibilite configuree
            </Text>
            <Text style={[styles.stepDescription, { color: colors.textSecondary, textAlign: 'center' }]}>
              Le proprietaire de cet espace n'a pas encore configure ses disponibilites. Veuillez reessayer plus tard ou contacter le proprietaire.
            </Text>
          </View>
          <Button
            title="Retour"
            onPress={() => router.back()}
            variant="outline"
            fullWidth
            style={{ marginTop: SPACING.xl }}
          />
        </View>
      );
    }

    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Calendar size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
            Choisissez votre creneau
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Selectionnez la date et l'heure de votre reservation
          </Text>
        </View>

        {/* Calendar */}
        <View style={[styles.calendarContainer, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
          {/* Calendar Header */}
          <View style={styles.calendarHeader}>
            <IconButton
              onPress={handlePrevMonth}
              icon={<ChevronLeft size={24} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
              accessibilityLabel="Mois précédent"
              size="sm"
              variant="ghost"
              style={styles.calendarNavButton}
            />
            <Text style={[styles.calendarTitle, { color: colors.textPrimary }]}>
              {monthNames[calendarMonth]} {calendarYear}
            </Text>
            <IconButton
              onPress={handleNextMonth}
              icon={<ChevronRight size={24} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
              accessibilityLabel="Mois suivant"
              size="sm"
              variant="ghost"
              style={styles.calendarNavButton}
            />
          </View>

          {/* Weekday Headers */}
          <View style={styles.weekdayHeaders}>
            {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((day, index) => (
              <Text key={index} style={[styles.weekdayHeader, { color: colors.gray500 }]}>
                {day}
              </Text>
            ))}
          </View>

          {/* Calendar Days */}
          <View style={styles.calendarDays}>
            {calendarDays.map((date, index) => {
              if (!date) {
                return <View key={`empty-${index}`} style={styles.calendarDayEmpty} />;
              }

              const isAvailable = isDateAvailable(date);
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              const isToday = date.toDateString() === new Date().toDateString();

              return (
                <Pressable
                  key={date.toISOString()}
                  onPress={() => handleDateSelect(date)}
                  disabled={!isAvailable}
                  style={({ pressed }) => [
                    styles.calendarDay,
                    !isAvailable && styles.calendarDayDisabled,
                    isSelected && { backgroundColor: colors.primary },
                    isToday && !isSelected && { borderColor: colors.primary, borderWidth: 1 },
                    pressed && isAvailable && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      { color: isAvailable ? colors.textPrimary : colors.gray300 },
                      isSelected && { color: colors.textOnPrimary },
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Selected Date Display */}
        {selectedDate && (
          <View style={[styles.selectedDateCard, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
            <CalendarDays size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.selectedDateText, { color: colors.primary }]}>
              {formatDateDisplay(selectedDate)}
            </Text>
          </View>
        )}

        {/* Time Slots */}
        {selectedDate && availableTimeSlots.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
              Heure de debut
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timeSlotsContainer}
            >
	              {availableTimeSlots.map((time) => {
	                const isSelected = selectedStartTime === time;
	                return (
	                  <Chip
	                    key={time}
	                    label={time}
	                    selected={isSelected}
	                    onPress={() => {
	                      setSelectedStartTime(time);
	                      setAvailabilityResult(null);
	                    }}
	                    style={[
	                      styles.timeSlot,
	                      { borderColor: isSelected ? colors.primary : colors.gray200 },
	                      isSelected && { backgroundColor: colors.primary },
	                    ]}
	                    textStyle={[
	                      styles.timeSlotText,
	                      { color: isSelected ? colors.textOnPrimary : colors.textPrimary },
	                    ]}
	                  />
	                );
	              })}
            </ScrollView>
          </View>
        )}

        {/* No slots message */}
        {selectedDate && availableTimeSlots.length === 0 && (
          <View style={[styles.noSlotsCard, { backgroundColor: withOpacity(colors.warning, OPACITY[15]) }]}>
            <AlertCircle size={20} color={colors.warning} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.noSlotsText, { color: colors.warning }]}>
              Aucun creneau disponible pour cette date
            </Text>
          </View>
        )}

        {/* Duration Selector */}
        {selectedDate && selectedStartTime && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
              Duree (heures)
            </Text>
	            <View style={[styles.counterContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
	              <IconButton
	                onPress={() => handleDurationChange(-1)}
	                disabled={durationHours <= (space?.min_booking_hours || 1)}
	                icon={
	                  <Minus
	                    size={20}
	                    color={durationHours <= (space?.min_booking_hours || 1) ? colors.gray300 : colors.textPrimary}
	                    strokeWidth={ICON.strokeWidth}
	                  />
	                }
	                accessibilityLabel="Réduire la durée"
	                variant="filled"
	                style={[styles.counterButton, { backgroundColor: colors.gray100 }]}
	              />
	              <View style={styles.counterValue}>
                <Text style={[styles.counterValueText, { color: colors.textPrimary }]}>
                  {formatNumberNoTrailingZeros(durationHours)}h
                </Text>
              </View>
	              <IconButton
	                onPress={() => handleDurationChange(1)}
	                disabled={durationHours >= (space?.max_booking_hours || 24)}
	                icon={
	                  <Plus
	                    size={20}
	                    color={durationHours >= (space?.max_booking_hours || 24) ? colors.gray300 : colors.textPrimary}
	                    strokeWidth={ICON.strokeWidth}
	                  />
	                }
	                accessibilityLabel="Augmenter la durée"
	                variant="filled"
	                style={[styles.counterButton, { backgroundColor: colors.gray100 }]}
	              />
	            </View>
            <Text style={[styles.hintText, { color: colors.gray500 }]}>
              Min: {formatNumberNoTrailingZeros(space?.min_booking_hours || 1)}h - Max: {formatNumberNoTrailingZeros(space?.max_booking_hours || 24)}h
            </Text>
          </View>
        )}

        {/* Attendees Selector */}
        {selectedDate && selectedStartTime && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
              Nombre de participants
            </Text>
	            <View style={[styles.counterContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
	              <IconButton
	                onPress={() => handleAttendeesChange(-1)}
	                disabled={attendeesCount <= 1}
	                icon={
	                  <Minus
	                    size={20}
	                    color={attendeesCount <= 1 ? colors.gray300 : colors.textPrimary}
	                    strokeWidth={ICON.strokeWidth}
	                  />
	                }
	                accessibilityLabel="Réduire le nombre de participants"
	                variant="filled"
	                style={[styles.counterButton, { backgroundColor: colors.gray100 }]}
	              />
	              <View style={styles.counterValue}>
	                <Users size={18} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
	                <Text style={[styles.counterValueText, { color: colors.textPrimary }]}>
	                  {attendeesCount}
	                </Text>
	              </View>
	              <IconButton
	                onPress={() => handleAttendeesChange(1)}
	                disabled={attendeesCount >= (space?.capacity || 100)}
	                icon={
	                  <Plus
	                    size={20}
	                    color={attendeesCount >= (space?.capacity || 100) ? colors.gray300 : colors.textPrimary}
	                    strokeWidth={ICON.strokeWidth}
	                  />
	                }
	                accessibilityLabel="Augmenter le nombre de participants"
	                variant="filled"
	                style={[styles.counterButton, { backgroundColor: colors.gray100 }]}
	              />
	            </View>
            <Text style={[styles.hintText, { color: colors.gray500 }]}>
              Capacite maximale: {formatNumberNoTrailingZeros(space?.capacity || 0, 0)} personnes
            </Text>
          </View>
        )}

        {/* Estimated Price */}
        {selectedDate && selectedStartTime && estimatedPrice && (
          <View style={[styles.priceCard, { backgroundColor: withOpacity(colors.success, OPACITY[10]), borderColor: withOpacity(colors.success, OPACITY[30]) }]}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
              {isFreeSpace ? 'Tarif' : 'Tarif estime'}
            </Text>
            {isFreeSpace ? (
              <Text style={[styles.priceFree, { color: colors.success }]}>Gratuit</Text>
            ) : (
              <>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceItemLabel, { color: colors.textSecondary }]}>
                    {formatNumberNoTrailingZeros(durationHours)}h x {formatPrice(space?.hourly_rate || 0)}
                  </Text>
                  <Text style={[styles.priceItemValue, { color: colors.textPrimary }]}>
                    {formatPrice(estimatedPrice.subtotal)}
                  </Text>
                </View>
                <View style={[styles.priceTotalRow, { borderTopColor: colors.gray200 }]}>
                  <Text style={[styles.priceTotalLabel, { color: colors.textPrimary }]}>
                    Total
                  </Text>
                  <Text style={[styles.priceTotalValue, { color: colors.primary }]}>
                    {formatPrice(estimatedPrice.total)}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Checking availability indicator */}
        {isCheckingAvailability && (
          <View style={styles.checkingContainer}>
            <LoadingShimmer variant="inline" />
            <Text style={[styles.checkingText, { color: colors.textSecondary }]}>
              Verification de la disponibilite...
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ===================================================================
  // RENDER RULES STEP
  // ===================================================================

  const renderRulesStep = () => {
    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Shield size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
            Regles de l'espace
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Lisez et acceptez les conditions d'utilisation
          </Text>
        </View>

        <View style={[styles.rulesBox, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
          <Text style={[styles.rulesText, { color: colors.textSecondary }]}>
            {spaceRules}
          </Text>
        </View>

	        <CheckboxRow
	          label="J'accepte les conditions d'utilisation de l'espace"
	          checked={acceptedRules}
	          onPress={() => setAcceptedRules(!acceptedRules)}
	          style={[styles.checkboxContainer, { borderColor: acceptedRules ? colors.primary : colors.gray300 }]}
	          labelStyle={[styles.checkboxLabel, { color: colors.textPrimary }]}
	          checkboxStyle={[
	            styles.checkbox,
	            { borderColor: acceptedRules ? colors.primary : colors.gray400 },
	            acceptedRules && { backgroundColor: colors.primary },
	          ]}
	        />
      </View>
    );
  };

  // ===================================================================
  // RENDER QUESTIONS STEP
  // ===================================================================

  const renderQuestionsStep = () => {
    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <HelpCircle size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
            Questions complementaires
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Repondez aux questions du gestionnaire
          </Text>
        </View>

        <View style={styles.formFields}>
          {bookingQuestions.map((question) => (
            <View key={question.id} style={styles.questionContainer}>
              <Text style={[styles.questionLabel, { color: colors.textPrimary }]}>
                {question.question}
                {question.required && <Text style={{ color: colors.error }}> *</Text>}
	              </Text>
	              <View style={[styles.answerInputContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
	                <Input
	                  placeholder="Votre reponse..."
	                  placeholderTextColor={colors.gray400}
	                  value={answers[question.id] || ''}
	                  onChangeText={(text) => updateAnswer(question.id, text)}
	                  maxLength={500}
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
                {(answers[question.id] || '').length}/500
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ===================================================================
  // RENDER PREVIEW STEP
  // ===================================================================

  const renderPreviewStep = () => {
    const getEstimatedPrice = (): { subtotal: number; total: number } | null => {
      if (!space) return null;
      if (isFreeSpace) return { subtotal: 0, total: 0 };

      if (availabilityResult?.pricing) {
        return {
          subtotal: availabilityResult.pricing.subtotal,
          total: availabilityResult.pricing.total,
        };
      }

      if (space.hourly_rate) {
        const subtotal = space.hourly_rate * durationHours;
        return { subtotal, total: subtotal };
      }

      return null;
    };

    const estimatedPrice = getEstimatedPrice();

    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Eye size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
            Verifiez votre reservation
          </Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Avant de confirmer, verifiez les informations
          </Text>
        </View>

        <View style={styles.previewContainer}>
          {/* Space Info */}
          <View style={[styles.previewSection, { backgroundColor: colors.gray50 }]}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
              Espace
            </Text>
            <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
              {space?.name}
            </Text>
            <Text style={[styles.previewHint, { color: colors.gray500 }]}>
              {space?.organization?.name}
            </Text>
            {space?.address && (
              <Text style={[styles.previewHint, { color: colors.gray500 }]}>
                {space.address}{space.city ? `, ${space.city}` : ''}
              </Text>
            )}
          </View>

          {/* Date & Time Info */}
          <View style={[styles.previewSection, { backgroundColor: withOpacity(colors.primary, OPACITY[8]) }]}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
              Date & Heure
            </Text>
            <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
              {selectedDate && formatDateDisplay(selectedDate)}
            </Text>
            <Text style={[styles.previewHint, { color: colors.gray500 }]}>
              {selectedStartTime} - {durationHours} heure{durationHours > 1 ? 's' : ''}
            </Text>
            <View style={styles.previewAttendeesRow}>
              <Users size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.previewHint, { color: colors.gray500 }]}>
                {attendeesCount} participant{attendeesCount > 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Profile Preview */}
          <View style={styles.previewSection}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
              Votre profil
            </Text>
            <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
              {profile?.first_name} {profile?.last_name}
            </Text>
            <Text style={[styles.previewHint, { color: colors.gray500 }]}>
              {profile?.email}
            </Text>
            {profile?.phone && (
              <Text style={[styles.previewHint, { color: colors.gray500 }]}>
                {profile.phone}
              </Text>
            )}
          </View>

          {/* Rules accepted */}
          {spaceRules && (
            <View style={styles.previewSection}>
              <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
                Conditions
              </Text>
              <View style={styles.previewRulesStatus}>
                <CheckCircle2 size={18} color={colors.success} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.previewRulesText, { color: colors.success }]}>
                  Acceptees
                </Text>
              </View>
            </View>
          )}

          {/* Answers Preview */}
          {bookingQuestions.length > 0 && (
            <View style={styles.previewSection}>
              <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
                Vos reponses
              </Text>
              {bookingQuestions.map((question) => (
                <View key={question.id} style={styles.previewAnswer}>
                  <Text style={[styles.previewQuestionLabel, { color: colors.gray500 }]}>
                    {question.question}
                  </Text>
                  <Text style={[styles.previewAnswerText, { color: colors.textPrimary }]}>
                    {answers[question.id]?.trim() || '-'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Special Requests */}
          <View style={styles.previewSection}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
              Demandes speciales (optionnel)
	            </Text>
	            <View style={[styles.specialRequestsInput, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
	              <Input
	                placeholder="Configuration particuliere, besoins specifiques..."
	                placeholderTextColor={colors.gray400}
	                value={specialRequests}
	                onChangeText={setSpecialRequests}
	                maxLength={500}
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
	          </View>

          {/* Price Breakdown */}
          {estimatedPrice && (
            <View style={[styles.previewSection, { backgroundColor: isFreeSpace ? withOpacity(colors.success, OPACITY[10]) : withOpacity(colors.warning, OPACITY[10]) }]}>
              <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>
                Tarification
              </Text>
              {isFreeSpace ? (
                <View style={styles.previewPricing}>
                  <CheckCircle2 size={18} color={colors.success} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.previewPricingText, { color: colors.success }]}>
                    Gratuit
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceItemLabel, { color: colors.textSecondary }]}>
                      {formatNumberNoTrailingZeros(durationHours)}h x {formatPrice(space?.hourly_rate || 0)}
                    </Text>
                    <Text style={[styles.priceItemValue, { color: colors.textPrimary }]}>
                      {formatPrice(estimatedPrice.subtotal)}
                    </Text>
                  </View>
                  <View style={[styles.priceTotalRow, { borderTopColor: colors.gray200 }]}>
                    <Text style={[styles.priceTotalLabel, { color: colors.textPrimary }]}>
                      Total a payer
                    </Text>
                    <Text style={[styles.priceTotalValue, { color: colors.primary }]}>
                      {formatPrice(estimatedPrice.total)}
                    </Text>
                  </View>
                </>
              )}

              {/* Payment Info */}
              {!isFreeSpace && (
                <View style={[styles.paymentInfo, { backgroundColor: colors.gray100 }]}>
                  <Info size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.paymentInfoText, { color: colors.gray600 }]}>
                    Votre reservation sera soumise a validation par l'administration. Vous recevrez une notification pour proceder au paiement une fois approuvee.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  // ===================================================================
  // RENDER SUCCESS STEP
  // ===================================================================

  const renderSuccessStep = () => {
    return (
      <View style={styles.successContainer}>
        <View style={[styles.successIcon, { backgroundColor: withOpacity(colors.success, OPACITY[15]) }]}>
          <CheckCircle2 size={64} color={colors.success} strokeWidth={ICON.strokeWidth} />
        </View>
        <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
          Reservation envoyee !
        </Text>
        <Text style={[styles.successDescription, { color: colors.textSecondary }]}>
          Votre demande de reservation pour "{space?.name}" a ete envoyee avec succes.
          {!isFreeSpace && ' Vous recevrez une notification une fois votre reservation validee par l\'administration.'}
        </Text>

        {/* Booking Reference */}
        <View style={[styles.referenceCard, { backgroundColor: withOpacity(colors.primary, OPACITY[10]), borderColor: withOpacity(colors.primary, OPACITY[30]) }]}>
          <Text style={[styles.referenceLabel, { color: colors.gray500 }]}>
            Reference de reservation
          </Text>
          <Text style={[styles.referenceValue, { color: colors.primary }]}>
            #{bookingReference}
          </Text>
        </View>

        <View style={styles.successActions}>
          <Button
            title="Voir mes reservations"
            onPress={() => router.replace('/settings/my-reservations')}
            fullWidth
          />
          <Button
            title="Retour a l'espace"
            onPress={() => router.replace(`/details/space/${id}`)}
            variant="ghost"
            fullWidth
            style={styles.backToSpaceButton}
            textStyle={[styles.backToSpaceText, { color: colors.primary }]}
          />
        </View>
      </View>
    );
  };

  // ===================================================================
  // RENDER FOOTER
  // ===================================================================

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
              title="Retour"
              onPress={handleBack}
              disabled={isSubmitting}
              variant="outline"
              icon={<ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />}
              style={[styles.backButton, { borderColor: colors.gray300 }]}
              textStyle={[styles.backButtonText, { color: colors.gray700 }]}
            />
            <View style={styles.submitButton}>
              <Button
                title={
                  isSubmitting
                    ? 'Envoi...'
                    : isFreeSpace
                    ? 'Confirmer la reservation'
                    : 'Envoyer la demande'
                }
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
            title={isFirstStep ? 'Annuler' : 'Retour'}
            onPress={handleBack}
            disabled={isCheckingAvailability}
            variant="outline"
            icon={<ChevronLeft size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />}
            style={[styles.backButton, { borderColor: colors.gray300 }]}
            textStyle={[styles.backButtonText, { color: colors.gray700 }]}
          />
          <View style={styles.continueButton}>
            <Button
              title={isCheckingAvailability ? 'Verification...' : 'Continuer'}
              onPress={handleNext}
              disabled={!canProceed() || isCheckingAvailability}
              fullWidth
              icon={
                isCheckingAvailability ? undefined : (
                  <ChevronRight size={18} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                )
              }
              iconPosition="right"
            />
          </View>
        </View>
      </View>
    );
  };

  // ===================================================================
  // LOADING & ERROR STATES
  // ===================================================================

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <LoadingShimmer variant="fullPage" />
      </SafeAreaView>
    );
  }

  if (!space) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
          Espace non trouve
        </Text>
        <Button title="Retour" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (!space.is_bookable) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
          Cet espace n'est pas reservable
        </Text>
        <Button title="Retour" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  // ===================================================================
  // MAIN RENDER
  // ===================================================================

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          onPress={handleBack}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel="Retour"
          size="sm"
          variant="ghost"
          style={styles.headerBackButton}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          Reserver {space.name}
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
            {currentStep === 'datetime' && renderDateTimeStep()}
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

// ===================================================================
// STYLES
// ===================================================================

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
    textAlign: 'center',
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

  // Calendar
  calendarContainer: {
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  calendarNavButton: {
    padding: SPACING.xs,
  },
  calendarTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  weekdayHeaders: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  weekdayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },
  calendarDayEmpty: {
    width: '14.28%',
    aspectRatio: 1,
  },
  calendarDayDisabled: {
    opacity: 0.3,
  },
  calendarDayText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Selected Date
  selectedDateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.md,
  },
  selectedDateText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Sections
  section: {
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },

  // Time Slots
  timeSlotsContainer: {
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  timeSlot: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.sm,
    borderWidth: 1,
  },
  timeSlotText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // No Slots
  noSlotsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.md,
  },
  noSlotsText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },

  // Counter
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER.radius.sm,
    borderWidth: BORDER.width.thin,
    overflow: 'hidden',
  },
  counterButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  counterValueText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  hintText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },

  // Price Card
  priceCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
  },
  priceLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },
  priceFree: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  priceItemLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  priceItemValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  priceTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
  },
  priceTotalLabel: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  priceTotalValue: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  // Checking Availability
  checkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  checkingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
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
  previewAttendeesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
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
  specialRequestsInput: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    padding: SPACING.md,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    marginTop: SPACING.md,
  },
  paymentInfoText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: TYPOGRAPHY.fontSize.xs * 1.5,
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
    marginBottom: SPACING.lg,
  },
  referenceCard: {
    padding: SPACING.lg,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    alignItems: 'center',
    marginBottom: SPACING.xl,
    width: '100%',
  },
  referenceLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xs,
  },
  referenceValue: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    letterSpacing: 2,
  },
  successActions: {
    width: '100%',
    gap: SPACING.md,
  },
  backToSpaceButton: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  backToSpaceText: {
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
    height: LAYOUT.buttonHeight,
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
