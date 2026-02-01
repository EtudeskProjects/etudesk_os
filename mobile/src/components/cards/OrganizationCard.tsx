/**
 * OrganizationCard
 * Elegant card for displaying organizations
 * Design: Minimalist, warm earth tones, no shadows
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Building2, MapPin, Users, Globe, Briefcase } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, LAYOUT } from '../../constants/theme';
import { formatCompactNumber } from '../../utils/number';

export interface OrganizationCardData {
  id: string;
  name: string;
  logo_url?: string;
  cover_image_url?: string;
  description?: string;
  city?: string;
  country?: string;
  website?: string;
  employees_count?: number;
  opportunities_count?: number;
  sectors?: string[];
}

interface OrganizationCardProps {
  organization: OrganizationCardData;
  onPress?: () => void;
  variant?: 'default' | 'compact' | 'featured';
}

export const OrganizationCard: React.FC<OrganizationCardProps> = ({
  organization,
  onPress,
  variant = 'default',
}) => {
  const { colors } = useTheme();

  const location = [organization.city, organization.country].filter(Boolean).join(', ');

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={[
          styles.compactContainer,
          { backgroundColor: colors.cardOrg, borderColor: colors.cardOrgAccent },
        ]}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={!onPress}
      >
        {organization.logo_url ? (
          <Image source={{ uri: organization.logo_url }} style={styles.compactLogo} />
        ) : (
          <View style={[styles.compactLogoPlaceholder, { backgroundColor: colors.cardOrgAccent }]}>
            <Building2 size={ICON.size.md} color={colors.cardOrgText} strokeWidth={ICON.strokeWidth} />
          </View>
        )}
        <View style={styles.compactContent}>
          <Text style={[styles.compactName, { color: colors.textPrimary }]} numberOfLines={1}>
            {organization.name}
          </Text>
          {location && (
            <Text style={[styles.compactLocation, { color: colors.cardOrgText }]} numberOfLines={1}>
              {location}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: colors.cardOrg, borderColor: colors.cardOrgAccent },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
    >
      {/* Cover Image */}
      {variant === 'featured' && (
        <View style={styles.coverContainer}>
          {organization.cover_image_url ? (
            <Image source={{ uri: organization.cover_image_url }} style={styles.coverImage} />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: colors.cardOrgAccent }]}>
              <Building2 size={ICON.size.xxxl} color={colors.cardOrgText} strokeWidth={ICON.strokeWidth} />
            </View>
          )}
        </View>
      )}

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          {organization.logo_url ? (
            <Image source={{ uri: organization.logo_url }} style={styles.logo} />
          ) : (
            <View style={[styles.logoPlaceholder, { backgroundColor: colors.cardOrgAccent }]}>
              <Building2 size={ICON.size.lg} color={colors.cardOrgText} strokeWidth={ICON.strokeWidth} />
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
              {organization.name}
            </Text>
            {location && (
              <View style={styles.row}>
                <MapPin size={12} color={colors.cardOrgText} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.location, { color: colors.cardOrgText }]} numberOfLines={1}>
                  {location}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        {organization.description && variant !== 'compact' && (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {organization.description}
          </Text>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          {organization.employees_count !== undefined && organization.employees_count > 0 && (
            <View style={styles.stat}>
              <Users size={14} color={colors.cardOrgText} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.statText, { color: colors.cardOrgText }]}>
                {formatCompactNumber(organization.employees_count)} employés
              </Text>
            </View>
          )}
          {organization.opportunities_count !== undefined && organization.opportunities_count > 0 && (
            <View style={styles.stat}>
              <Briefcase size={14} color={colors.cardOrgText} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.statText, { color: colors.cardOrgText }]}>
                {organization.opportunities_count} offres
              </Text>
            </View>
          )}
          {organization.website && (
            <View style={styles.stat}>
              <Globe size={14} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            </View>
          )}
        </View>

        {/* Sectors */}
        {organization.sectors && organization.sectors.length > 0 && (
          <View style={styles.sectorsContainer}>
            {organization.sectors.slice(0, 2).map((sector, index) => (
              <View
                key={index}
                style={[styles.sectorChip, { backgroundColor: colors.cardOrgAccent }]}
              >
                <Text style={[styles.sectorText, { color: colors.cardOrgText }]}>
                  {sector}
                </Text>
              </View>
            ))}
            {organization.sectors.length > 2 && (
              <Text style={[styles.moreSectors, { color: colors.cardOrgText }]}>
                +{organization.sectors.length - 2}
              </Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  coverContainer: {
    height: LAYOUT.cardImageHeightSm,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: LAYOUT.avatarMd,
    height: LAYOUT.avatarMd,
    borderRadius: BORDER.radius.sm,
  },
  logoPlaceholder: {
    width: LAYOUT.avatarMd,
    height: LAYOUT.avatarMd,
    borderRadius: BORDER.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  name: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  location: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    flex: 1,
  },
  description: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    gap: SPACING.lg,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  sectorsContainer: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    gap: SPACING.xs,
    alignItems: 'center',
  },
  sectorChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER.radius.full,
  },
  sectorText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  moreSectors: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Compact variant
  compactContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  },
  compactLogo: {
    width: LAYOUT.avatarMd,
    height: LAYOUT.avatarMd,
    borderRadius: BORDER.radius.sm,
  },
  compactLogoPlaceholder: {
    width: LAYOUT.avatarMd,
    height: LAYOUT.avatarMd,
    borderRadius: BORDER.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  compactName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  compactLocation: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
});

export default OrganizationCard;
