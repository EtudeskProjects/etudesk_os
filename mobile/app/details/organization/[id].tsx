import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Users,
  Globe,
  Share,
  Briefcase,
  Building2,
  CheckCircle,
  ExternalLink,
  Calendar,
  Award,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { Button, ImageSlider, FooterNav } from '../../../src/components/ui';
import { formatRelativeTime } from '../../../src/utils/date';
import type { Organization, Opportunity } from '../../../src/types/models';
import {
  ORGANIZATION_TYPE_LABELS,
  ORGANIZATION_SIZE_LABELS,
} from '../../../src/types/models';

// Mock data - in real app, fetch from API based on id
const MOCK_ORGANIZATION: Organization & {
  employees_count?: number;
  opportunities_count?: number;
  founded_year?: number;
  social_links?: { type: string; url: string }[];
  opportunities?: Opportunity[];
  images?: string[];
} = {
  id: '1',
  name: 'TechCorp Africa',
  slug: 'techcorp-africa',
  type: 'STARTUP',
  sectors: ['DIGITAL', 'FINANCE'],
  size: 'MEDIUM',
  description: `TechCorp Africa est une startup technologique qui développe des solutions innovantes pour le marché africain.

Notre mission est de démocratiser l'accès aux services financiers numériques en Afrique de l'Ouest.

Nous croyons en l'innovation locale et au potentiel des talents africains.`,
  logo_url: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=400&q=80',
  website_url: 'https://techcorp.africa',
  headquarters_city: 'Abidjan',
  headquarters_region: 'Lagunes',
  headquarters_country: 'CI',
  verification_status: 'VERIFIED',
  culture_summary: 'Culture remote-first, équipe diverse et inclusive, focus sur l\'innovation.',
  created_at: '2022-06-15T00:00:00Z',
  // Extended data
  images: [
    'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=800&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=800&q=80',
  ],
  employees_count: 45,
  opportunities_count: 3,
  founded_year: 2020,
  social_links: [
    { type: 'twitter', url: 'https://twitter.com/techcorpafrica' },
  ],
  opportunities: [
    {
      id: '1',
      title: 'Développeur React Native Senior',
      slug: 'dev-react-native-senior',
      type: 'EMPLOYMENT',
      contract_type: 'CDI',
      work_rhythm: 'FULL_TIME',
      location_type: 'HYBRID',
      posted_at: '2026-01-15T10:00:00Z',
    },
    {
      id: '2',
      title: 'Product Designer',
      slug: 'product-designer',
      type: 'EMPLOYMENT',
      contract_type: 'CDI',
      work_rhythm: 'FULL_TIME',
      location_type: 'REMOTE',
      posted_at: '2026-01-10T10:00:00Z',
    },
  ],
};

const SECTOR_LABELS: Record<string, string> = {
  DIGITAL: 'Digital & Tech',
  FINANCE: 'Finance',
  COMMERCE: 'Commerce',
  EDUCATION: 'Éducation',
  HEALTH: 'Santé',
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export default function OrganizationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { currentSpace } = useSpace();

  // In real app, fetch organization by id
  const organization = MOCK_ORGANIZATION;

  const createdAt = organization.created_at ? formatRelativeTime(organization.created_at) : null;

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
        <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.gray100 }]}>
          <Share size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Slider */}
        <View style={styles.sliderContainer}>
          <ImageSlider
            images={organization.images || []}
            height={220}
          />
        </View>

        <View style={styles.contentPadded}>
        {/* Organization Header */}
        <View style={styles.orgHeader}>
          {organization.logo_url ? (
            <Image source={{ uri: organization.logo_url }} style={styles.logo} />
          ) : (
            <View style={[styles.logoPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.logoPlaceholderText}>
                {getInitials(organization.name)}
              </Text>
            </View>
          )}

          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.textPrimary }]}>
              {organization.name}
            </Text>
            {organization.verification_status === 'VERIFIED' && (
              <CheckCircle size={ICON.size.lg} color={COLORS.success} fill={COLORS.success} strokeWidth={0} />
            )}
          </View>

          {/* Type & Location */}
          <View style={styles.infoRow}>
            {organization.type && (
              <View style={[styles.typeBadge, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
                  {ORGANIZATION_TYPE_LABELS[organization.type] || organization.type}
                </Text>
              </View>
            )}
            {organization.headquarters_city && (
              <View style={styles.infoItem}>
                <MapPin size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  {organization.headquarters_city}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
          {organization.founded_year && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{organization.founded_year}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Fondée</Text>
            </View>
          )}
          {organization.employees_count && (
            <>
              <View style={[styles.statDivider, { backgroundColor: colors.borderColor }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{organization.employees_count}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Employés</Text>
              </View>
            </>
          )}
          {organization.opportunities_count !== undefined && (
            <>
              <View style={[styles.statDivider, { backgroundColor: colors.borderColor }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{organization.opportunities_count}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Offres</Text>
              </View>
            </>
          )}
        </View>

        {/* About */}
        {organization.description && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>À propos</Text>
            <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
              {organization.description}
            </Text>
          </View>
        )}

        {/* Sectors */}
        {organization.sectors && organization.sectors.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Secteurs</Text>
            <View style={styles.tagsContainer}>
              {organization.sectors.map((sector, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: colors.gray100 }]}>
                  <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                    {SECTOR_LABELS[sector] || sector}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
          {organization.size && (
            <View style={styles.infoCardRow}>
              <Users size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View style={styles.infoCardContent}>
                <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>Taille</Text>
                <Text style={[styles.infoCardValue, { color: colors.textPrimary }]}>
                  {ORGANIZATION_SIZE_LABELS[organization.size] || organization.size}
                </Text>
              </View>
            </View>
          )}
          {organization.website_url && (
            <TouchableOpacity style={styles.infoCardRow}>
              <Globe size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View style={styles.infoCardContent}>
                <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>Site web</Text>
                <Text style={[styles.infoCardValue, { color: colors.primary }]}>
                  {organization.website_url.replace('https://', '')}
                </Text>
              </View>
              <ExternalLink size={ICON.size.sm} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
            </TouchableOpacity>
          )}
          {createdAt && (
            <View style={styles.infoCardRow}>
              <Calendar size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View style={styles.infoCardContent}>
                <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>Sur Etudesk depuis</Text>
                <Text style={[styles.infoCardValue, { color: colors.textPrimary }]}>{createdAt}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Culture */}
        {organization.culture_summary && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Culture d'entreprise</Text>
            <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
              {organization.culture_summary}
            </Text>
          </View>
        )}

        {/* Open Opportunities */}
        {organization.opportunities && organization.opportunities.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Opportunités ouvertes</Text>
              <TouchableOpacity>
                <Text style={[styles.seeAllText, { color: colors.primary }]}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            {organization.opportunities.map((opportunity) => (
              <TouchableOpacity
                key={opportunity.id}
                style={[styles.opportunityCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
                onPress={() => router.push(`/details/opportunity/${opportunity.id}`)}
              >
                <View style={styles.opportunityContent}>
                  <Text style={[styles.opportunityTitle, { color: colors.textPrimary }]}>
                    {opportunity.title}
                  </Text>
                  <View style={styles.opportunityMeta}>
                    <View style={[styles.opportunityBadge, { backgroundColor: colors.gray100 }]}>
                      <Text style={[styles.opportunityBadgeText, { color: colors.textSecondary }]}>
                        {opportunity.work_rhythm === 'FULL_TIME' ? 'Temps plein' : opportunity.work_rhythm}
                      </Text>
                    </View>
                    {opportunity.location_type === 'REMOTE' && (
                      <View style={[styles.opportunityBadge, { backgroundColor: colors.gray100 }]}>
                        <Text style={[styles.opportunityBadgeText, { color: colors.textSecondary }]}>
                          Remote
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <ExternalLink size={ICON.size.sm} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        </View>
      </ScrollView>

      {/* Footer with Floating CTA and Navigation */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        {currentSpace !== 'organization' && (
          <View style={styles.ctaContainer}>
            <Button
              title="Suivre l'organisation"
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

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: SPACING.xl,
  },

  sliderContainer: {
    marginBottom: SPACING.lg,
  },

  contentPadded: {
    paddingHorizontal: SPACING.lg,
  },

  orgHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },

  logo: {
    width: 100,
    height: 100,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.md,
  },

  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: BORDER.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },

  logoPlaceholderText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.xxxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  name: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },

  typeBadge: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },

  typeBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  infoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: SPACING.lg,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
  },

  statItem: {
    alignItems: 'center',
  },

  statValue: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },

  statDivider: {
    width: 1,
    height: 40,
  },

  section: {
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

  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
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

  infoCard: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },

  infoCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },

  infoCardContent: {
    flex: 1,
  },

  infoCardLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  infoCardValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginTop: 2,
  },

  opportunityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.sm,
  },

  opportunityContent: {
    flex: 1,
    gap: SPACING.xs,
  },

  opportunityTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  opportunityMeta: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },

  opportunityBadge: {
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },

  opportunityBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
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
