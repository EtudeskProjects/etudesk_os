/**
 * SpaceCard - Refactored to use BaseCard components
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  MapPin,
  Users,
  SquarePen,
  Trash2,
  Bookmark,
  BookmarkCheck,
  Clock,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER, LAYOUT } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../contexts/I18nContext';
import { formatCompactNumber } from '../../utils/number';
import { SPACE_TYPE_LABELS, formatPrice } from '../../constants/space';
import type { Space } from '../../services/spaceService';
import {
  CardContainer,
  CardImage,
  CardBadgeRow,
  CardBadge,
  CardContent,
  CardHeader,
  CardMetaRow,
  type CardAction,
  type MetaItem,
} from './BaseCard';

interface StatusOverlay {
  label: string;
  color: string;
  bgColor: string;
  icon?: React.ReactNode;
}

interface SpaceCardProps {
  space: Space;
  onPress: () => void;
  isBookmarked?: boolean;
  onBookmarkToggle?: () => void;
  showBookmark?: boolean;
  showMoreAction?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onViewBookings?: () => void;
  isLast?: boolean;
  isManagement?: boolean;
  statusOverlay?: StatusOverlay;
}

export const SpaceCard: React.FC<SpaceCardProps> = ({
  space,
  onPress,
  isBookmarked = false,
  onBookmarkToggle,
  showBookmark = false,
  showMoreAction = false,
  onEdit,
  onDelete,
  isLast = false,
  isManagement = false,
  statusOverlay,
}) => {
  const { colors } = useTheme();
  const { t } = useI18n();

  // Get the best price to display
  const getDisplayPrice = (): { text: string; isFree: boolean } => {
    if (space.hourly_rate && space.hourly_rate > 0) return { text: formatPrice(space.hourly_rate) + '/h', isFree: false };
    if (space.daily_rate && space.daily_rate > 0) return { text: formatPrice(space.daily_rate) + '/j', isFree: false };
    if (space.weekly_rate && space.weekly_rate > 0) return { text: formatPrice(space.weekly_rate) + '/sem', isFree: false };
    if (space.monthly_rate && space.monthly_rate > 0) return { text: formatPrice(space.monthly_rate) + '/mois', isFree: false };
    return { text: t('common.free'), isFree: true };
  };

  const displayPrice = getDisplayPrice();

  // Build actions
  const actions: CardAction[] = [];
  if (showBookmark && onBookmarkToggle && !showMoreAction) {
    actions.push({
      Icon: isBookmarked ? BookmarkCheck : Bookmark,
      color: isBookmarked ? colors.primary : colors.gray400,
      fill: isBookmarked ? colors.primary : undefined,
      onPress: onBookmarkToggle,
    });
  }
  if (showMoreAction) {
    if (onEdit) {
      actions.push({ Icon: SquarePen, color: colors.gray400, onPress: onEdit });
    }
    if (onDelete) {
      actions.push({ Icon: Trash2, color: colors.error, onPress: onDelete });
    }
  }

  // Build meta items
  const metaItems: MetaItem[] = [
    {
      Icon: Users,
      text: `${formatCompactNumber(space.capacity || 0)} ${(space.capacity || 0) <= 1 ? t('common.place') : t('common.places')}`,
    },
    {
      Icon: MapPin,
      text: space.city && space.country ? `${space.city}, ${space.country}` : space.city || t('common.notSpecified'),
    },
  ];

  if (!isManagement) {
    metaItems.push({
      Icon: Clock,
      text: displayPrice.text,
      color: displayPrice.isFree ? colors.success : colors.primary,
      fontWeight: '600',
    });
  }

  // Status badge color
  const getStatusBadgeColor = () => {
    switch (space.status) {
      case 'ACTIVE':
        return colors.success;
      case 'INACTIVE':
        return colors.gray400;
      case 'MAINTENANCE':
        return colors.warning;
      default:
        return colors.gray400;
    }
  };

  const getStatusLabel = () => {
    switch (space.status) {
      case 'ACTIVE':
        return t('space.status.active');
      case 'INACTIVE':
        return t('space.status.inactive');
      case 'MAINTENANCE':
        return t('space.status.maintenance');
      default:
        return space.status;
    }
  };

  return (
    <CardContainer onPress={onPress} isLast={isLast}>
      <CardImage
        imageUrl={space.cover_image_url || space.gallery_images?.[0]}
        PlaceholderIcon={MapPin}
        height={LAYOUT.cardImageHeightSm + 20}
      >
        <CardBadgeRow>
          {space.type && (
            <CardBadge
              label={SPACE_TYPE_LABELS[space.type as keyof typeof SPACE_TYPE_LABELS] || space.type}
              backgroundColor={colors.primary}
              textColor={colors.textOnPrimary}
            />
          )}
          {isManagement && space.status && (
            <CardBadge
              label={getStatusLabel()}
              backgroundColor={getStatusBadgeColor()}
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
          title={space.name}
          subtitle={space.organization?.name}
          actions={actions}
        />

        <CardMetaRow items={metaItems} style={styles.metaRow} />
      </CardContent>
    </CardContainer>
  );
};

const styles = StyleSheet.create({
  metaRow: {
    marginTop: 8,
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
