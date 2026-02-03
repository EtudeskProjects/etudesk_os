/**
 * OrganizationCard - Refactored to use BaseCard components
 * Supports variants: default, compact, featured
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Building2, MapPin, Globe } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, LAYOUT } from '../../constants/theme';
import { CardContainer, CardImage, CardContent, CardHeader } from './BaseCard';

export interface OrganizationCardData {
  id: string;
  name: string;
  logo_url?: string;
  cover_image_url?: string;
  description?: string;
  city?: string;
  country?: string;
  website?: string;
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

  // Compact variant - horizontal layout
  if (variant === 'compact') {
    return (
      <CardContainer
        onPress={onPress}
        horizontal
        style={[styles.compactContainer, { backgroundColor: colors.cardOrg, borderColor: colors.cardOrgAccent }]}
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
      </CardContainer>
    );
  }

  // Default and featured variants - vertical layout
  return (
    <CardContainer
      onPress={onPress}
      style={{ backgroundColor: colors.cardOrg, borderColor: colors.cardOrgAccent }}
    >
      {/* Cover Image (featured only) */}
      {variant === 'featured' && (
        <CardImage
          imageUrl={organization.cover_image_url}
          PlaceholderIcon={Building2}
          height={LAYOUT.cardImageHeightSm}
        />
      )}

      <CardContent>
        {/* Header with logo */}
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
        {organization.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {organization.description}
          </Text>
        )}

        {/* Stats */}
        {organization.website && (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Globe size={14} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            </View>
          </View>
        )}

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
      </CardContent>
    </CardContainer>
  );
};

const styles = StyleSheet.create({
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
    borderRadius: BORDER.radius.md,
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
