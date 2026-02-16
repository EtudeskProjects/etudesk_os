/**
 * OpportunityCard - Refactored to use BaseCard components
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  MapPin,
  Clock,
  Bookmark,
  BookmarkCheck,
  Users,
  Edit,
  Trash2,
  Briefcase,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatDeadline } from '../../utils/date';
import { formatCompactNumber } from '../../utils/number';
import type { Opportunity, ContractType } from '../../types/models';
import { CONTRACT_TYPE_LABELS, LOCATION_TYPE_LABELS } from '../../types/models';
import {
  CardContainer,
  CardImage,
  CardBadgeRow,
  CardBadge,
  CardContent,
  CardHeader,
  type CardAction,
} from './BaseCard';
import { RemoteImage } from '../ui/RemoteImage';

interface StatusOverlay {
  label: string;
  color: string;
  bgColor: string;
  icon?: React.ReactNode;
}

interface OpportunityCardProps {
  opportunity: Opportunity;
  onPress: () => void;
  isBookmarked?: boolean;
  onBookmarkToggle?: () => void;
  showBookmark?: boolean;
  showMoreAction?: boolean;
  onMorePress?: () => void;
  isMenuVisible?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onViewCandidates?: () => void;
  showStats?: boolean;
  showStatus?: boolean;
  isLast?: boolean;
  statusOverlay?: StatusOverlay;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  opportunity,
  onPress,
  isBookmarked = false,
  onBookmarkToggle,
  showBookmark = false,
  showMoreAction = false,
  onEdit,
  onDelete,
  onViewCandidates,
  showStats = false,
  showStatus = false,
  isLast = false,
  statusOverlay,
}) => {
  const { colors } = useTheme();
  const deadline = opportunity.deadline ? formatDeadline(opportunity.deadline) : null;

  // Location label logic
  const location = opportunity.locations?.[0];
  let locationLabel = '';

  if (opportunity.location_type === 'REMOTE') {
    locationLabel = LOCATION_TYPE_LABELS.REMOTE || 'Remote';
  } else if (opportunity.location_type === 'HYBRID') {
    const hybridLabel = LOCATION_TYPE_LABELS.HYBRID || 'Hybride';
    if (location?.city && location?.country) {
      locationLabel = `${hybridLabel} • ${location.city}, ${location.country}`;
    } else if (location?.city) {
      locationLabel = `${hybridLabel} • ${location.city}`;
    } else {
      locationLabel = hybridLabel;
    }
  } else if (opportunity.location_type === 'ON_SITE') {
    if (location?.city && location?.country) {
      locationLabel = `${location.city}, ${location.country}`;
    } else if (location?.city) {
      locationLabel = location.city;
    } else {
      locationLabel = LOCATION_TYPE_LABELS.ON_SITE || 'Sur site';
    }
  } else {
    if (location?.city && location?.country) {
      locationLabel = `${location.city}, ${location.country}`;
    } else if (location?.city) {
      locationLabel = location.city;
    } else {
      locationLabel = LOCATION_TYPE_LABELS.REMOTE || 'Remote';
    }
  }

  // Build actions
  const actions: CardAction[] = [];
  if (onEdit) {
    actions.push({ Icon: Edit, color: colors.primary, onPress: onEdit, accessibilityLabel: 'Modifier' });
  }
  if (showBookmark && onBookmarkToggle && !showMoreAction) {
    actions.push({
      Icon: isBookmarked ? BookmarkCheck : Bookmark,
      color: isBookmarked ? colors.primary : colors.gray400,
      fill: isBookmarked ? colors.primary : undefined,
      onPress: onBookmarkToggle,
      accessibilityLabel: isBookmarked ? 'Retirer des favoris' : 'Ajouter aux favoris',
    });
  }
  if (showMoreAction && onDelete) {
    actions.push({ Icon: Trash2, color: colors.error, onPress: onDelete, accessibilityLabel: 'Supprimer' });
  }

  // Organization subtitle component
  const renderOrgSubtitle = () => {
    if (!opportunity.organization?.name) return null;
    return (
      <View style={styles.orgRow}>
        {opportunity.organization?.logo_url ? (
          <RemoteImage uri={opportunity.organization.logo_url} style={styles.orgLogo} />
        ) : (
          <View style={[styles.orgLogoPlaceholder, { backgroundColor: colors.gray200 }]}>
            <Text style={[styles.orgLogoText, { color: colors.gray500 }]}>
              {opportunity.organization.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={[styles.orgName, { color: colors.textSecondary }]} numberOfLines={1}>
          {opportunity.organization.name}
        </Text>
      </View>
    );
  };

  const imageUrl = opportunity.cover_image_url || opportunity.images?.[0];

  return (
    <CardContainer onPress={onPress} isLast={isLast} style={styles.container}>
      <CardImage
        imageUrl={imageUrl}
        PlaceholderIcon={Briefcase}
        height={LAYOUT.cardImageHeightSm + 20}
      >
        <CardBadgeRow>
          {opportunity.contract_type && (
            <CardBadge
              label={CONTRACT_TYPE_LABELS[opportunity.contract_type as ContractType] || opportunity.contract_type}
              backgroundColor={colors.primary}
              textColor={colors.textOnPrimary}
            />
          )}
          {showStatus && opportunity.status && (
            <CardBadge
              label={opportunity.status === 'OPEN' ? 'Active' : 'En pause'}
              backgroundColor={opportunity.status === 'OPEN' ? colors.success : colors.warning}
              textColor={colors.textOnPrimary}
            />
          )}
        </CardBadgeRow>

        {statusOverlay && (
          <View style={styles.statusOverlayRow}>
            <View style={[styles.statusOverlayBadge, { backgroundColor: colors.surface }]}>
              {statusOverlay.icon}
              <Text style={[styles.statusOverlayText, { color: statusOverlay.color }]}>
                {statusOverlay.label}
              </Text>
            </View>
          </View>
        )}
      </CardImage>

      <CardContent>
        <CardHeader
          title={opportunity.title}
          subtitle={renderOrgSubtitle()}
          actions={actions}
        />

        <View style={styles.detailsRow}>
          {showStats ? (
            <>
              <Pressable
                style={[styles.detailItem, onViewCandidates && styles.candidatesButton, !onViewCandidates && { opacity: 0.6 }]}
                onPress={onViewCandidates}
                disabled={!onViewCandidates}
                accessibilityRole="button"
                accessibilityLabel="Voir les candidatures"
              >
                <Users size={14} color={onViewCandidates ? colors.primary : colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.detailText, { color: onViewCandidates ? colors.primary : colors.textSecondary }]}>
                  {formatCompactNumber(opportunity.applications_count || 0)} {(opportunity.applications_count || 0) <= 1 ? 'candidature' : 'candidatures'}
                </Text>
              </Pressable>
              <View style={styles.detailItem}>
                <MapPin size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {locationLabel}
                </Text>
              </View>
            </>
          ) : (
            <>
              {deadline && (
                <View style={styles.detailItem}>
                  <Clock
                    size={ICON.size.xs}
                    color={deadline.isUrgent ? colors.error : colors.textSecondary}
                    strokeWidth={ICON.strokeWidth}
                  />
                  <Text style={[styles.detailText, { color: deadline.isUrgent ? colors.error : colors.textSecondary }]}>
                    {deadline.text}
                  </Text>
                </View>
              )}
              <View style={styles.detailItem}>
                <MapPin size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {locationLabel}
                </Text>
              </View>
            </>
          )}
        </View>
      </CardContent>
    </CardContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.sm,
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: SPACING.xs,
    gap: 6,
  },
  orgLogo: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  orgLogoPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgLogoText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  orgName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  candidatesButton: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginLeft: -4,
    borderRadius: BORDER.radius.xs,
  },
  statusOverlayRow: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
  },
  statusOverlayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.full,
  },
  statusOverlayText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
