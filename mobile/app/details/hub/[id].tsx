import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Globe,
  Share,
  Wifi,
  Coffee,
  Users,
  Calendar,
  Phone,
  Mail,
  Navigation,
  CheckCircle,
  Banknote,
  Bookmark,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { Button, ImageSlider, FooterNav } from '../../../src/components/ui';
import { formatRelativeTime } from '../../../src/utils/date';
import type { Hub } from '../../../src/types/models';
import { HUB_TYPE_LABELS, ACCESS_TYPE_LABELS } from '../../../src/types/models';

// Mock data - in real app, fetch from API based on id
const MOCK_HUB: Hub & {
  cover_image_url?: string;
  gallery?: string[];
  opening_hours?: { day: string; hours: string }[];
  contact_phone?: string;
  contact_email?: string;
  website_url?: string;
  social_links?: { type: string; url: string }[];
  features?: string[];
  capacity?: number;
  upcoming_events?: { id: string; title: string; date: string }[];
} = {
  id: '1',
  name: 'Impact Hub Abidjan',
  slug: 'impact-hub-abidjan',
  type: 'COWORKING',
  description: `Impact Hub Abidjan est un espace de coworking et une communauté d'entrepreneurs et d'innovateurs sociaux.

Nous offrons un environnement de travail collaboratif, des programmes d'accompagnement et un réseau international de plus de 100 Impact Hubs dans le monde.

Notre mission : accompagner les entrepreneurs qui créent un impact positif en Afrique de l'Ouest.`,
  city: 'Abidjan',
  region: 'Lagunes',
  country: 'CI',
  address: '123 Boulevard Latrille, Cocody',
  access_type: 'MEMBERSHIP',
  pricing: 'À partir de 50 000 XOF/mois',
  amenities: ['WiFi haut débit', 'Salles de réunion', 'Café & snacks', 'Espace événements', 'Imprimante', 'Casiers', 'Climatisation', 'Parking'],
  image_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
  created_at: '2023-01-15T00:00:00Z',
  // Extended data
  cover_image_url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&q=80',
  gallery: [
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=600&q=80',
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=600&q=80',
    'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=600&q=80',
  ],
  opening_hours: [
    { day: 'Lun - Ven', hours: '08:00 - 20:00' },
    { day: 'Samedi', hours: '09:00 - 17:00' },
    { day: 'Dimanche', hours: 'Fermé' },
  ],
  contact_phone: '+225 27 22 48 00 00',
  contact_email: 'hello@impacthub-abidjan.com',
  website_url: 'https://impacthub-abidjan.com',
  features: [
    'Accès 24/7 pour les membres Premium',
    'Événements networking hebdomadaires',
    'Programmes d\'incubation',
    'Accès au réseau mondial Impact Hub',
    'Mentorat par des experts',
  ],
  capacity: 120,
  upcoming_events: [
    { id: '1', title: 'Startup Pitch Night', date: '2026-01-25' },
    { id: '2', title: 'Workshop: Product Management', date: '2026-01-28' },
    { id: '3', title: 'Networking Breakfast', date: '2026-02-01' },
  ],
};

// Icon mapping for amenities
const AMENITY_ICONS: Record<string, any> = {
  'WiFi haut débit': Wifi,
  'Café & snacks': Coffee,
  'Salles de réunion': Users,
  'Espace événements': Calendar,
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export default function HubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { currentSpace } = useSpace();

  // In real app, fetch hub by id
  const hub = MOCK_HUB;

  const createdAt = hub.created_at ? formatRelativeTime(hub.created_at) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.gray100 }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.gray100 }]}>
            <Share size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.gray100 }]}>
            <Bookmark size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
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
          <ImageSlider
            images={hub.gallery && hub.gallery.length > 0
              ? hub.gallery
              : (hub.cover_image_url ? [hub.cover_image_url] : [])
            }
            height={220}
          />
        </View>

        {/* Hub Header */}
        <View style={styles.hubHeader}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.textPrimary }]}>
              {hub.name}
            </Text>
          </View>

          {/* Type & Access */}
          <View style={styles.tagsRow}>
            {hub.type && (
              <View style={[styles.tag, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.tagText, { color: colors.primary }]}>
                  {HUB_TYPE_LABELS[hub.type] || hub.type}
                </Text>
              </View>
            )}
            {hub.access_type && (
              <View style={[styles.tag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                  {ACCESS_TYPE_LABELS[hub.access_type] || hub.access_type}
                </Text>
              </View>
            )}
          </View>

          {/* Location */}
          {hub.address && (
            <TouchableOpacity style={styles.addressRow}>
              <MapPin size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.addressText, { color: colors.textSecondary }]}>
                {hub.address}, {hub.city}
              </Text>
              <Navigation size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            </TouchableOpacity>
          )}
        </View>

        {/* Pricing */}
        {hub.pricing && (
          <View style={[styles.pricingCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
            <Banknote size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.pricingText, { color: colors.primary }]}>
              {hub.pricing}
            </Text>
          </View>
        )}

        {/* Stats */}
        {hub.capacity && (
          <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
            <View style={styles.statItem}>
              <Users size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{hub.capacity}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>places</Text>
            </View>
          </View>
        )}

        {/* About */}
        {hub.description && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>À propos</Text>
            <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
              {hub.description}
            </Text>
          </View>
        )}

        {/* Features */}
        {hub.features && hub.features.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ce qu'on propose</Text>
            {hub.features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <CheckCircle size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>{feature}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Amenities */}
        {hub.amenities && hub.amenities.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Équipements</Text>
            <View style={styles.amenitiesGrid}>
              {hub.amenities.map((amenity, index) => {
                const IconComponent = AMENITY_ICONS[amenity] || CheckCircle;
                return (
                  <View key={index} style={[styles.amenityItem, { backgroundColor: colors.gray50 }]}>
                    <IconComponent size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.amenityText, { color: colors.textSecondary }]}>{amenity}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Opening Hours */}
        {hub.opening_hours && hub.opening_hours.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Horaires d'ouverture</Text>
            <View style={[styles.hoursCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
              {hub.opening_hours.map((item, index) => (
                <View key={index} style={styles.hoursRow}>
                  <Text style={[styles.hoursDay, { color: colors.textPrimary }]}>{item.day}</Text>
                  <Text style={[styles.hoursTime, { color: colors.textSecondary }]}>{item.hours}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Upcoming Events */}
        {hub.upcoming_events && hub.upcoming_events.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Événements à venir</Text>
              <TouchableOpacity>
                <Text style={[styles.seeAllText, { color: colors.primary }]}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            {hub.upcoming_events.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={[styles.eventCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
              >
                <View style={[styles.eventDate, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.eventDateText, { color: colors.primary }]}>
                    {new Date(event.date).getDate()}
                  </Text>
                  <Text style={[styles.eventMonthText, { color: colors.primary }]}>
                    {new Date(event.date).toLocaleDateString('fr-FR', { month: 'short' })}
                  </Text>
                </View>
                <Text style={[styles.eventTitle, { color: colors.textPrimary }]}>{event.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Contact */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Contact</Text>
          <View style={[styles.contactCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
            {hub.contact_phone && (
              <TouchableOpacity style={styles.contactRow}>
                <Phone size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.contactText, { color: colors.textPrimary }]}>{hub.contact_phone}</Text>
              </TouchableOpacity>
            )}
            {hub.contact_email && (
              <TouchableOpacity style={styles.contactRow}>
                <Mail size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.contactText, { color: colors.textPrimary }]}>{hub.contact_email}</Text>
              </TouchableOpacity>
            )}
            {hub.website_url && (
              <TouchableOpacity style={styles.contactRow}>
                <Globe size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.contactText, { color: colors.primary }]}>
                  {hub.website_url.replace('https://', '')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        </ScrollView>

      {/* Footer with Floating CTA and Navigation */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        {currentSpace !== 'organization' && (
          <View style={styles.ctaContainer}>
            <Button
              title="Réserver une visite"
              onPress={() => {}}
              fullWidth
            />
          </View>
        )}
        <FooterNav activeTab="explore" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
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

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: SPACING.xl,
  },

  sliderContainer: {
    marginBottom: SPACING.lg,
  },

  hubHeader: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },

  nameRow: {
    marginBottom: SPACING.sm,
  },

  name: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },

  tag: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },

  tagText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  addressText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  pricingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    marginBottom: SPACING.md,
  },

  pricingText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  statsCard: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
  },

  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  statValue: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },

  seeAllText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  sectionText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * 1.6,
  },

  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },

  featureText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    flex: 1,
  },

  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },

  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.sm,
  },

  amenityText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  hoursCard: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    gap: SPACING.sm,
  },

  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  hoursDay: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  hoursTime: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.sm,
  },

  eventDate: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },

  eventDateText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  eventMonthText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
  },

  eventTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

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

  footer: {
    // No paddingBottom - FooterNav handles safe area
  },

  ctaContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
});
