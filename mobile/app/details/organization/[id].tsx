import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Globe,
  Share,
  CheckCircle,
  ExternalLink,
  Calendar,
  Mail,
  Phone,
  ChevronRight,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/contexts/I18nContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { Button, FooterNav } from '../../../src/components/ui';
import { formatRelativeTime } from '../../../src/utils/date';
import { getFullImageUrl } from '../../../src/utils/image';
import type { Organization, Opportunity } from '../../../src/types/models';
import {
  ORGANIZATION_TYPE_LABELS,
  WORK_RHYTHM_LABELS,
  LOCATION_TYPE_LABELS,
} from '../../../src/types/models';
import { organizationService } from '../../../src/services/organizationService';
import { opportunityService } from '../../../src/services/opportunityService';

// Sector labels for display
const SECTOR_LABELS: Record<string, string> = {
  DIGITAL: 'Digital & Tech',
  FINANCE: 'Finance',
  COMMERCE: 'Commerce',
  EDUCATION: 'Éducation',
  HEALTH: 'Santé',
  AGRICULTURE: 'Agriculture',
  ENERGY: 'Énergie',
  TRANSPORT: 'Transport',
  CONSTRUCTION: 'Construction',
  MANUFACTURING: 'Industrie',
  SERVICES: 'Services',
  PUBLIC: 'Secteur public',
  NGO: 'ONG / Associatif',
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
  const { t } = useI18n();
  const { currentSpace } = useSpace();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(true);

  useEffect(() => {
    if (id) {
      loadOrganization();
      loadOpportunities();
    }
  }, [id]);

  const loadOrganization = async () => {
    try {
      setIsLoading(true);
      const response = await organizationService.get(id!);
      if (response.data) {
        setOrganization(response.data);
      }
    } catch (error: any) {
      console.error('Error loading organization:', error);
      Alert.alert(t('common.error'), t('organizationDetail.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadOpportunities = async () => {
    try {
      setIsLoadingOpportunities(true);
      const response = await opportunityService.getByOrganization(id!, { status: 'OPEN' });
      if (response.data) {
        setOpportunities(response.data);
      }
    } catch (error: any) {
      console.error('Error loading opportunities:', error);
      // Silent fail for opportunities - not critical
    } finally {
      setIsLoadingOpportunities(false);
    }
  };

  const handleOpenWebsite = async () => {
    if (!organization?.website_url) return;
    try {
      let url = organization.website_url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening website:', error);
    }
  };

  const handleContact = async (type: 'email' | 'phone') => {
    try {
      const value = type === 'email'
        ? (organization?.contact_email || organization?.email)
        : (organization?.contact_phone || organization?.phone);

      if (!value) return;

      const url = type === 'email' ? `mailto:${value}` : `tel:${value}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error(`Error opening ${type}:`, error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (!organization) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.gray100 }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {t('organizationDetail.notFound')}
          </Text>
          <Button
            title={t('common.back')}
            onPress={() => router.back()}
            variant="outline"
            style={{ marginTop: SPACING.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const createdAt = organization.created_at ? formatRelativeTime(organization.created_at) : null;
  const contactEmail = organization.contact_email || organization.email;
  const contactPhone = organization.contact_phone || organization.phone;
  const primaryType = organization.types?.[0] || organization.type;
  const logoUrl = organization.logo_url ? getFullImageUrl(organization.logo_url) : null;

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
        <View style={styles.contentPadded}>
          {/* Organization Header */}
          <View style={styles.orgHeader}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logo} />
            ) : (
              <View style={[styles.logoPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={[styles.logoPlaceholderText, { color: colors.textOnPrimary }]}>
                  {getInitials(organization.name)}
                </Text>
              </View>
            )}

            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.textPrimary }]}>
                {organization.name}
              </Text>
              {organization.verification_status === 'VERIFIED' && (
                <CheckCircle size={ICON.size.lg} color={colors.success} fill={colors.success} strokeWidth={0} />
              )}
            </View>

            {/* Type & Location */}
            <View style={styles.infoRow}>
              {primaryType && (
                <View style={[styles.typeBadge, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                  <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
                    {ORGANIZATION_TYPE_LABELS[primaryType] || primaryType}
                  </Text>
                </View>
              )}
              {organization.headquarters_city && (
                <View style={styles.infoItem}>
                  <MapPin size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    {organization.headquarters_city}
                    {organization.headquarters_country ? `, ${organization.headquarters_country}` : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* About */}
          {organization.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('organizationDetail.about')}
              </Text>
              <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                {organization.description}
              </Text>
            </View>
          )}

          {/* Sectors */}
          {organization.sectors && organization.sectors.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('organizationDetail.sectors')}
              </Text>
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

          {/* Goals */}
          {organization.goals && organization.goals.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('organizationDetail.goals')}
              </Text>
              <View style={styles.tagsContainer}>
                {organization.goals.map((goal, index) => (
                  <View key={index} style={[styles.tag, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
                    <Text style={[styles.tagText, { color: colors.primary }]}>
                      {goal}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
            {organization.website_url && (
              <TouchableOpacity style={styles.infoCardRow} onPress={handleOpenWebsite}>
                <Globe size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <View style={styles.infoCardContent}>
                  <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>
                    {t('organizationDetail.website')}
                  </Text>
                  <Text style={[styles.infoCardValue, { color: colors.primary }]} numberOfLines={1}>
                    {organization.website_url.replace(/^https?:\/\//, '')}
                  </Text>
                </View>
                <ExternalLink size={ICON.size.sm} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            )}

            {contactEmail && (
              <TouchableOpacity style={styles.infoCardRow} onPress={() => handleContact('email')}>
                <Mail size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <View style={styles.infoCardContent}>
                  <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>
                    {t('organizationDetail.email')}
                  </Text>
                  <Text style={[styles.infoCardValue, { color: colors.primary }]} numberOfLines={1}>
                    {contactEmail}
                  </Text>
                </View>
                <ExternalLink size={ICON.size.sm} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            )}

            {contactPhone && (
              <TouchableOpacity style={styles.infoCardRow} onPress={() => handleContact('phone')}>
                <Phone size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <View style={styles.infoCardContent}>
                  <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>
                    {t('organizationDetail.phone')}
                  </Text>
                  <Text style={[styles.infoCardValue, { color: colors.primary }]}>
                    {contactPhone}
                  </Text>
                </View>
                <ExternalLink size={ICON.size.sm} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            )}

            {createdAt && (
              <View style={styles.infoCardRow}>
                <Calendar size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <View style={styles.infoCardContent}>
                  <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>
                    {t('organizationDetail.onEtudeskSince')}
                  </Text>
                  <Text style={[styles.infoCardValue, { color: colors.textPrimary }]}>{createdAt}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Culture */}
          {organization.culture_summary && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('organizationDetail.culture')}
              </Text>
              <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                {organization.culture_summary}
              </Text>
            </View>
          )}

          {/* Open Opportunities */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('organizationDetail.openOpportunities')}
              </Text>
              {opportunities.length > 3 && (
                <TouchableOpacity onPress={() => router.push(`/search?organization=${id}` as any)}>
                  <Text style={[styles.seeAllText, { color: colors.primary }]}>
                    {t('common.seeAll')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {isLoadingOpportunities ? (
              <View style={styles.loadingOpportunities}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : opportunities.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('organizationDetail.noOpportunities')}
                </Text>
              </View>
            ) : (
              opportunities.slice(0, 5).map((opportunity) => (
                <TouchableOpacity
                  key={opportunity.id}
                  style={[styles.opportunityCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
                  onPress={() => router.push(`/details/opportunity/${opportunity.id}`)}
                >
                  <View style={styles.opportunityContent}>
                    <Text style={[styles.opportunityTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                      {opportunity.title}
                    </Text>
                    <View style={styles.opportunityMeta}>
                      {opportunity.work_rhythm && (
                        <View style={[styles.opportunityBadge, { backgroundColor: colors.gray100 }]}>
                          <Text style={[styles.opportunityBadgeText, { color: colors.textSecondary }]}>
                            {WORK_RHYTHM_LABELS[opportunity.work_rhythm] || opportunity.work_rhythm}
                          </Text>
                        </View>
                      )}
                      {opportunity.location_type && (
                        <View style={[styles.opportunityBadge, { backgroundColor: colors.gray100 }]}>
                          <Text style={[styles.opportunityBadgeText, { color: colors.textSecondary }]}>
                            {LOCATION_TYPE_LABELS[opportunity.location_type] || opportunity.location_type}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <ChevronRight size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        {currentSpace !== 'organization' && contactEmail && (
          <View style={styles.ctaContainer}>
            <Button
              title={t('organizationDetail.contact')}
              onPress={() => handleContact('email')}
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

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  errorText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
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

  contentPadded: {
    paddingHorizontal: SPACING.lg,
  },

  orgHeader: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    paddingTop: SPACING.md,
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
    flexWrap: 'wrap',
    justifyContent: 'center',
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

  loadingOpportunities: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },

  emptyCard: {
    padding: SPACING.lg,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
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
    flexWrap: 'wrap',
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
