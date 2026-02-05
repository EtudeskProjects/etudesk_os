import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share as RNShare,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Globe,
  Share,
  Wifi,
  Users,
  Phone,
  Mail,
  Navigation,
  CheckCircle,
  Bookmark,
  BookmarkCheck,
  Calendar,
  Ruler,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  Accessibility,
  X,
  Monitor,
  Square,
  ClipboardList,
  Speaker,
  Mic,
  Camera,
  Tv,
  Video,
  Laptop,
  Printer,
  Phone as PhoneIcon,
  Thermometer,
  Flame,
  Car,
  Coffee,
  UtensilsCrossed,
  Droplet,
  User,
  Shield,
  ArrowUp,
  Sun,
  VolumeX,
  Maximize,
  Headphones,
  EyeOff,
  Projector,
  Banknote,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { Button, ImageSlider, FooterNav } from '../../../src/components/ui';
import { spaceService, Space, bookmarkService } from '../../../src/services';
import { getFullImageUrl } from '../../../src/utils/image';
import {
  SPACE_TYPE_LABELS,
  SPACE_AMENITY_LABELS,
  SPACE_EQUIPMENT_LABELS,
  ACCESSIBILITY_FEATURE_LABELS,
  SPACE_STATUS_LABELS,
  formatPrice,
  WEEKDAYS,
} from '../../../src/constants/space';
import { ORGANIZATION_TYPE_LABELS } from '../../../src/types/models';

// Fallback image for spaces without images
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80';

// Helper to get initials from a name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Equipment icons mapping
const EQUIPMENT_ICONS: Record<string, any> = {
  VIDEOPROJECTOR: Projector,
  WHITEBOARD: Square,
  FLIPCHART: ClipboardList,
  SCREEN: Monitor,
  SOUND_SYSTEM: Speaker,
  MICROPHONE: Mic,
  WEBCAM: Camera,
  TV_SCREEN: Tv,
  VIDEO_CONFERENCE: Video,
  COMPUTERS: Laptop,
  PRINTERS: Printer,
  PHONE: PhoneIcon,
};

// Amenity icons mapping
const AMENITY_ICONS: Record<string, any> = {
  WIFI: Wifi,
  AIR_CONDITIONING: Thermometer,
  HEATING: Flame,
  PARKING: Car,
  CAFETERIA: Coffee,
  KITCHEN: UtensilsCrossed,
  RESTROOMS: Droplet,
  RECEPTION: User,
  SECURITY: Shield,
  ELEVATOR: ArrowUp,
  NATURAL_LIGHT: Sun,
  SOUNDPROOF: VolumeX,
};

// Accessibility icons mapping
const ACCESSIBILITY_ICONS: Record<string, any> = {
  WHEELCHAIR_ACCESS: Accessibility,
  ELEVATOR: ArrowUp,
  ACCESSIBLE_RESTROOM: Droplet,
  WIDE_DOORS: Maximize,
  TACTILE_GUIDANCE: Navigation,
  HEARING_LOOP: Headphones,
  HANDICAP_PARKING: Car,
  BRAILLE_SIGNAGE: EyeOff,
};

// Description text limit for expandable text
const DESCRIPTION_LIMIT = 200;

export default function SpaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { currentSpace, selectedOrg } = useSpace();

  const [space, setSpace] = useState<Space | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Only show manage button if owner AND connected as organization
  const canManageSpace = isOwner && currentSpace === 'organization';

  useEffect(() => {
    loadSpace();
    checkBookmark();
  }, [id]);

  // Reload space when screen comes into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      loadSpace();
    }, [id])
  );

  const loadSpace = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const response = await spaceService.getById(id);
      if (response.data) {
        setSpace(response.data);
        // Check if current organization owns this space
        if (selectedOrg && response.data.organization_id === selectedOrg.id) {
          setIsOwner(true);
        } else {
          setIsOwner(false);
        }

      }
    } catch (error) {
      console.error('Error loading space:', error);
      Alert.alert('Erreur', 'Impossible de charger cet espace');
    } finally {
      setIsLoading(false);
    }
  };

  const checkBookmark = async () => {
    if (!id) return;
    try {
      const response = await bookmarkService.isSpaceBookmarked(id);
      if (response.data) {
        setIsBookmarked(response.data.isBookmarked);
      }
    } catch (error) {
      // User might not be logged in, ignore
    }
  };

  const handleBookmarkToggle = async () => {
    if (!id) return;

    // Optimistic update
    setIsBookmarked(!isBookmarked);

    try {
      await bookmarkService.toggleSpace(id, isBookmarked);
    } catch (error) {
      // Revert on error
      setIsBookmarked(isBookmarked);
      console.error('Error toggling bookmark:', error);
    }
  };

  const handleShare = async () => {
    if (!space) return;
    try {
      await RNShare.share({
        message: `Decouvrez cet espace: ${space.name}\n\nhttps://etudesk.com/spaces/${space.slug}`,
        title: space.name,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleBookNow = () => {
    if (!space) return;
    router.push(`/details/space/book/${space.id}` as any);
  };

  const handleManageSpace = () => {
    if (!space) return;
    router.push(`/gestion/spaces/${space.id}` as any);
  };

  const handleCallPhone = () => {
    if (space?.contact_phone) {
      Linking.openURL(`tel:${space.contact_phone}`);
    }
  };

  const handleSendEmail = () => {
    if (space?.contact_email) {
      Linking.openURL(`mailto:${space.contact_email}`);
    }
  };

  const handleOpenMaps = () => {
    if (space?.coordinates) {
      const url = `https://www.google.com/maps/search/?api=1&query=${space.coordinates.lat},${space.coordinates.lng}`;
      Linking.openURL(url);
    } else if (space?.address) {
      const address = encodeURIComponent(`${space.address}, ${space.city || ''}, ${space.country || ''}`);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${address}`);
    }
  };

  // Get best price display
  const getBestPrice = (): { amount: number; unit: string; isFree: boolean } | null => {
    if (!space) return null;
    if (space.hourly_rate && space.hourly_rate > 0) return { amount: space.hourly_rate, unit: '/heure', isFree: false };
    if (space.daily_rate && space.daily_rate > 0) return { amount: space.daily_rate, unit: '/jour', isFree: false };
    if (space.weekly_rate && space.weekly_rate > 0) return { amount: space.weekly_rate, unit: '/semaine', isFree: false };
    if (space.monthly_rate && space.monthly_rate > 0) return { amount: space.monthly_rate, unit: '/mois', isFree: false };
    return { amount: 0, unit: '', isFree: true };
  };

  // Helper to check if a rate value is positive (handles strings and numbers)
  const hasPositiveRate = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    const numVal = typeof val === 'string' ? parseFloat(val) : val;
    return typeof numVal === 'number' && !isNaN(numVal) && numVal > 0;
  };

  // Check if space is free (all rates are zero or not set)
  const isFreeSpace = (): boolean => {
    if (!space) return false;
    return !hasPositiveRate(space.hourly_rate) &&
           !hasPositiveRate(space.daily_rate) &&
           !hasPositiveRate(space.weekly_rate) &&
           !hasPositiveRate(space.monthly_rate);
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
        return colors.success;
      case 'INACTIVE':
        return colors.textDisabled;
      case 'MAINTENANCE':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Chargement de l'espace...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!space) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <X size={48} color={colors.textDisabled} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
            Espace non trouve
          </Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            Cet espace n'existe pas ou a ete supprime.
          </Text>
          <TouchableOpacity
            style={[styles.errorButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.errorButtonText, { color: colors.textOnPrimary }]}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const bestPrice = getBestPrice();
  const images = (() => {
    const imageList = space.gallery_images && space.gallery_images.length > 0
      ? space.gallery_images
      : (space.cover_image_url ? [space.cover_image_url] : []);
    return imageList.map(img => getFullImageUrl(img) || '').filter(Boolean);
  })();

  const shouldTruncateDescription = space.description && space.description.length > DESCRIPTION_LIMIT;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.gray100 }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.gray100 }]}
            onPress={handleShare}
          >
            <Share size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: isBookmarked ? withOpacity(colors.primary, OPACITY[15]) : colors.gray100 }]}
            onPress={handleBookmarkToggle}
          >
            {isBookmarked ? (
              <BookmarkCheck size={ICON.size.md} color={colors.primary} fill={colors.primary} strokeWidth={ICON.strokeWidth} />
            ) : (
              <Bookmark size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Slider */}
        <View style={styles.sliderContainer}>
          <ImageSlider images={images.filter(Boolean)} height={220} />
        </View>

        <View style={styles.contentPadded}>
          {/* Organization Card */}
          {space.organization && (
            <TouchableOpacity
              style={[styles.orgCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
              onPress={() => router.push(`/details/organization/${space.organization?.id}`)}
            >
              {space.organization.logo_url ? (
                <Image
                  source={{ uri: getFullImageUrl(space.organization.logo_url) || '' }}
                  style={styles.orgLogo}
                />
              ) : (
                <View style={[styles.orgLogoPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.orgLogoText, { color: colors.textOnPrimary }]}>
                    {getInitials(space.organization.name || '')}
                  </Text>
                </View>
              )}
              <View style={styles.orgInfo}>
                <View style={styles.orgNameRow}>
                  <Text style={[styles.orgName, { color: colors.textPrimary }]}>
                    {space.organization.name}
                  </Text>
                  {(space.organization as any).verification_status === 'VERIFIED' && (
                    <CheckCircle size={ICON.size.sm} color={colors.success} fill={colors.success} strokeWidth={0} />
                  )}
                </View>
                <View style={styles.orgTagsRow}>
                  {(space.organization as any).type && (
                    <View style={[styles.orgTag, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                      <Text style={[styles.orgTagText, { color: colors.primary }]}>
                        {ORGANIZATION_TYPE_LABELS[(space.organization as any).type] || (space.organization as any).type}
                      </Text>
                    </View>
                  )}
                  {space.city && (
                    <Text style={[styles.orgLocation, { color: colors.textSecondary }]}>
                      {space.city}{space.country ? `, ${space.country}` : ''}
                    </Text>
                  )}
                </View>
              </View>
              <ChevronRight size={ICON.size.sm} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
            </TouchableOpacity>
          )}

          {/* Title */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {space.name}
          </Text>

          {/* Tags Row: Type, Status, Accessibility */}
          <View style={styles.tagsRow}>
            {space.type && (
              <View style={[styles.tag, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                <Text style={[styles.tagText, { color: colors.primary }]}>
                  {SPACE_TYPE_LABELS[space.type as keyof typeof SPACE_TYPE_LABELS] || space.type}
                </Text>
              </View>
            )}
            {space.is_accessible && (
              <View style={[styles.tag, { backgroundColor: withOpacity(colors.info, OPACITY[15]) }]}>
                <Accessibility size={12} color={colors.info} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.tagText, { color: colors.info, marginLeft: 4 }]}>Accessible PMR</Text>
              </View>
            )}
          </View>

          {/* Stats Card */}
          <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
            {/* Capacity + Surface */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Users size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <View>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Capacite</Text>
                  <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                    {space.capacity} {space.capacity > 1 ? 'personnes' : 'personne'}
                  </Text>
                </View>
              </View>
              <View style={styles.metaItem}>
                <Ruler size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <View>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Surface</Text>
                  <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                    {Math.round(space.surface_m2)} m2
                  </Text>
                </View>
              </View>
            </View>

            {/* Location - Full Width */}
            <View style={styles.metaRowFull}>
              <MapPin size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View style={styles.metaItemFull}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Adresse</Text>
                <Text style={[styles.metaValue, { color: colors.textPrimary }]} numberOfLines={2}>
                  {space.address || space.city || 'Non specifiee'}
                </Text>
              </View>
            </View>
          </View>

          {/* Pricing Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Tarification</Text>
            <View style={[styles.pricingCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
              {isFreeSpace() ? (
                <View style={styles.priceRow}>
                  <View style={styles.priceLeft}>
                    <CheckCircle size={ICON.size.sm} color={colors.success} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Acces</Text>
                  </View>
                  <Text style={[styles.priceValue, { color: colors.success, fontWeight: '600' }]}>
                    Gratuit
                  </Text>
                </View>
              ) : (
                <>
                  {hasPositiveRate(space.hourly_rate) && (
                    <View style={styles.priceRow}>
                      <View style={styles.priceLeft}>
                        <Clock size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                        <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>A l'heure</Text>
                      </View>
                      <Text style={[styles.priceValue, { color: colors.textPrimary }]}>
                        {formatPrice(space.hourly_rate)}
                      </Text>
                    </View>
                  )}
                  {hasPositiveRate(space.daily_rate) && (
                    <View style={styles.priceRow}>
                      <View style={styles.priceLeft}>
                        <Calendar size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                        <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>A la journee</Text>
                      </View>
                      <Text style={[styles.priceValue, { color: colors.textPrimary }]}>
                        {formatPrice(space.daily_rate)}
                      </Text>
                    </View>
                  )}
                  {hasPositiveRate(space.weekly_rate) && (
                    <View style={styles.priceRow}>
                      <View style={styles.priceLeft}>
                        <Calendar size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                        <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>A la semaine</Text>
                      </View>
                      <Text style={[styles.priceValue, { color: colors.textPrimary }]}>
                        {formatPrice(space.weekly_rate)}
                      </Text>
                    </View>
                  )}
                  {hasPositiveRate(space.monthly_rate) && (
                    <View style={styles.priceRow}>
                      <View style={styles.priceLeft}>
                        <Calendar size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                        <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Au mois</Text>
                      </View>
                      <Text style={[styles.priceValue, { color: colors.textPrimary }]}>
                        {formatPrice(space.monthly_rate)}
                      </Text>
                    </View>
                  )}
                </>
              )}

              {space.payment_collection_info && (
                <View style={[styles.priceRow, { marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: BORDER.width.thin, borderTopColor: colors.borderColor }]}>
                  <View style={styles.priceLeft}>
                    <Banknote size={ICON.size.sm} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Mode d'encaissement</Text>
                      <Text style={[styles.priceValue, { color: colors.textPrimary, marginTop: 2 }]}>{space.payment_collection_info}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Description Section */}
          {space.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>A propos</Text>
              <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                {shouldTruncateDescription && !isDescriptionExpanded
                  ? space.description.slice(0, DESCRIPTION_LIMIT) + '...'
                  : space.description}
              </Text>
              {shouldTruncateDescription && (
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                >
                  <Text style={[styles.expandButtonText, { color: colors.primary }]}>
                    {isDescriptionExpanded ? 'Voir moins' : 'Voir plus'}
                  </Text>
                  {isDescriptionExpanded ? (
                    <ChevronUp size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                  ) : (
                    <ChevronDown size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Equipment Section */}
          {space.equipment && space.equipment.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Equipements</Text>
              <View style={styles.itemsGrid}>
                {space.equipment.map((item, index) => {
                  const IconComponent = EQUIPMENT_ICONS[item] || CheckCircle;
                  return (
                    <View key={index} style={[styles.gridItem, { backgroundColor: colors.gray50 }]}>
                      <IconComponent size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                      <Text style={[styles.gridItemText, { color: colors.textSecondary }]}>
                        {SPACE_EQUIPMENT_LABELS[item as keyof typeof SPACE_EQUIPMENT_LABELS] || item}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Amenities Section */}
          {space.amenities && space.amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Services & Commodites</Text>
              <View style={styles.itemsGrid}>
                {space.amenities.map((amenity, index) => {
                  const IconComponent = AMENITY_ICONS[amenity] || CheckCircle;
                  return (
                    <View key={index} style={[styles.gridItem, { backgroundColor: colors.gray50 }]}>
                      <IconComponent size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                      <Text style={[styles.gridItemText, { color: colors.textSecondary }]}>
                        {SPACE_AMENITY_LABELS[amenity as keyof typeof SPACE_AMENITY_LABELS] || amenity}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Accessibility Section */}
          {space.is_accessible && space.accessibility_features && space.accessibility_features.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Accessibilite PMR</Text>
              <View style={styles.itemsGrid}>
                {space.accessibility_features.map((feature, index) => {
                  const IconComponent = ACCESSIBILITY_ICONS[feature] || CheckCircle;
                  return (
                    <View key={index} style={[styles.gridItem, { backgroundColor: withOpacity(colors.success, OPACITY[10]) }]}>
                      <IconComponent size={ICON.size.sm} color={colors.success} strokeWidth={ICON.strokeWidth} />
                      <Text style={[styles.gridItemText, { color: colors.success }]}>
                        {ACCESSIBILITY_FEATURE_LABELS[feature as keyof typeof ACCESSIBILITY_FEATURE_LABELS] || feature}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {space.accessibility_notes && (
                <Text style={[styles.accessibilityNotes, { color: colors.textSecondary }]}>
                  {space.accessibility_notes}
                </Text>
              )}
            </View>
          )}

          {/* Availability Section */}
          {space.availabilities && space.availabilities.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Disponibilites</Text>
              <View style={[styles.availabilityCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
                {WEEKDAYS.map((day) => {
                  const availability = space.availabilities?.find(a => a.day_of_week === day.id && a.is_active);
                  const isOpen = !!availability;
                  return (
                    <View key={day.id} style={[styles.availabilityRow, { borderBottomColor: colors.borderColor }]}>
                      <Text style={[styles.availabilityDay, { color: colors.textPrimary }]}>{day.label}</Text>
                      {isOpen ? (
                        <Text style={[styles.availabilityTime, { color: colors.success }]}>
                          {availability.start_time} - {availability.end_time}
                        </Text>
                      ) : (
                        <Text style={[styles.availabilityTime, { color: colors.textDisabled }]}>
                          Ferme
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Booking Rules Section */}
          {space.is_bookable && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Regles de reservation</Text>
              <View style={[styles.rulesCard, { backgroundColor: colors.gray50 }]}>
                {space.min_booking_hours !== undefined && (
                  <View style={styles.ruleRow}>
                    <Text style={[styles.ruleLabel, { color: colors.textSecondary }]}>Duree minimum</Text>
                    <Text style={[styles.ruleValue, { color: colors.textPrimary }]}>{space.min_booking_hours}h</Text>
                  </View>
                )}
                {space.max_booking_hours !== undefined && (
                  <View style={styles.ruleRow}>
                    <Text style={[styles.ruleLabel, { color: colors.textSecondary }]}>Duree maximum</Text>
                    <Text style={[styles.ruleValue, { color: colors.textPrimary }]}>{space.max_booking_hours}h</Text>
                  </View>
                )}
                {space.advance_booking_days !== undefined && (
                  <View style={styles.ruleRow}>
                    <Text style={[styles.ruleLabel, { color: colors.textSecondary }]}>Reservation a l'avance</Text>
                    <Text style={[styles.ruleValue, { color: colors.textPrimary }]}>Jusqu'a {space.advance_booking_days} jours</Text>
                  </View>
                )}
                {space.cancellation_hours !== undefined && (
                  <View style={styles.ruleRow}>
                    <Text style={[styles.ruleLabel, { color: colors.textSecondary }]}>Annulation gratuite</Text>
                    <Text style={[styles.ruleValue, { color: colors.textPrimary }]}>{space.cancellation_hours}h avant</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Contact Section */}
          {(space.contact_name || space.contact_phone || space.contact_email) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Contact</Text>
              <View style={[styles.contactCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
                {space.contact_name && (
                  <View style={styles.contactRow}>
                    <User size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.contactText, { color: colors.textPrimary }]}>{space.contact_name}</Text>
                  </View>
                )}
                {space.contact_phone && (
                  <TouchableOpacity style={styles.contactRow} onPress={handleCallPhone}>
                    <Phone size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.contactText, styles.contactLink, { color: colors.primary }]}>
                      {space.contact_phone}
                    </Text>
                  </TouchableOpacity>
                )}
                {space.contact_email && (
                  <TouchableOpacity style={styles.contactRow} onPress={handleSendEmail}>
                    <Mail size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.contactText, styles.contactLink, { color: colors.primary }]}>
                      {space.contact_email}
                    </Text>
                  </TouchableOpacity>
                )}
                {(space.address || space.coordinates) && (
                  <TouchableOpacity style={styles.contactRow} onPress={handleOpenMaps}>
                    <Navigation size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.contactText, styles.contactLink, { color: colors.primary }]}>
                      Voir sur la carte
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer with CTA and Navigation */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        <View style={styles.ctaContainer}>
          {canManageSpace ? (
            <Button
              title="Gerer l'espace"
              onPress={handleManageSpace}
              fullWidth
              variant="outline"
              icon={<Settings size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
            />
          ) : currentSpace !== 'organization' && space.is_bookable && space.status === 'ACTIVE' ? (
            <Button
              title="Reserver l'espace"
              onPress={handleBookNow}
              fullWidth
              variant="primary"
              icon={<Calendar size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
            />
          ) : null}
        </View>
        <FooterNav activeTab="explore" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },

  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  // Error State
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },

  errorTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
  },

  errorText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
  },

  errorButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER.radius.md,
    marginTop: SPACING.md,
  },

  errorButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.width.thin,
  },

  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },

  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: SPACING.xxxl,
  },

  sliderContainer: {
    marginBottom: SPACING.lg,
  },

  contentPadded: {
    paddingHorizontal: SPACING.lg,
  },

  // Organization Card
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },

  orgLogo: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.sm,
  },

  orgLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  orgLogoText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  orgInfo: {
    flex: 1,
  },

  orgNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  orgName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  orgTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 4,
    flexWrap: 'wrap',
  },

  orgTag: {
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },

  orgTagText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  orgLocation: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Title
  title: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.sm,
  },

  // Tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },

  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },

  tagText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Meta Card (Stats)
  metaCard: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },

  metaRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },

  metaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },

  metaRowFull: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },

  metaItemFull: {
    flex: 1,
  },

  metaLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  metaValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginTop: 2,
  },

  // Sections
  section: {
    marginBottom: SPACING.lg,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },

  sectionText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * 1.6,
  },

  // Expand Button
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },

  expandButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Pricing Card
  pricingCard: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    gap: SPACING.sm,
  },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  priceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  priceLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  priceValue: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Items Grid (Equipment, Amenities, Accessibility)
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },

  gridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.sm,
  },

  gridItemText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  accessibilityNotes: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
  },

  // Availability Card
  availabilityCard: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
  },

  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.width.thin,
  },

  availabilityDay: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  availabilityTime: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Rules Card
  rulesCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    gap: SPACING.sm,
  },

  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  ruleLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  ruleValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Contact Card
  contactCard: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    gap: SPACING.md,
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },

  contactText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  contactLink: {
    textDecorationLine: 'underline',
  },

  // Footer
  footer: {
    // No paddingBottom - FooterNav handles safe area
  },

  ctaContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
});
