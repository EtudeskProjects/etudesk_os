/**
 * CommunityCard - Refactored to use BaseCard components
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Users,
  Globe,
  Monitor,
  MapPin,
  Bookmark,
  BookmarkCheck,
  SquarePen,
  Trash2,
  Lock,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatCompactNumber } from '../../utils/number';
import type { Community } from '../../types/models';
import { COMMUNITY_TYPE_LABELS, VISIBILITY_LABELS } from '../../types/models';
import {
  CardContainer,
  CardImage,
  CardBadgeRow,
  CardBadge,
  CardContent,
  CardHeader,
  CardMetaRow,
  type CardAction,
} from './BaseCard';

interface StatusOverlay {
  label: string;
  color: string;
  bgColor: string;
  icon?: React.ReactNode;
}

interface CommunityCardProps {
  community: Community;
  onPress: () => void;
  isBookmarked?: boolean;
  onBookmarkToggle?: () => void;
  showBookmark?: boolean;
  showMoreAction?: boolean;
  onMorePress?: () => void;
  isMenuVisible?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  isLast?: boolean;
  isManagement?: boolean;
  statusOverlay?: StatusOverlay;
}

export const CommunityCard: React.FC<CommunityCardProps> = React.memo(({
  community,
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

  // Helpers
  const getTypeIcon = () => {
    switch (community.type) {
      case 'ONLINE':
        return Monitor;
      case 'HYBRID':
        return MapPin;
      default:
        return Globe;
    }
  };

  const getTypeText = () => {
    if (!community.type) return getVisibilityText();
    return COMMUNITY_TYPE_LABELS[community.type as keyof typeof COMMUNITY_TYPE_LABELS] || getVisibilityText();
  };

  const getVisibilityText = () => {
    const accessType = (community as any).access_type || 'PUBLIC';
    return VISIBILITY_LABELS[accessType as keyof typeof VISIBILITY_LABELS] || accessType;
  };

  const isPrivateCommunity = () => {
    const accessType = (community as any).access_type || 'PUBLIC';
    return accessType === 'PRIVATE' || accessType === 'MEMBERSHIP';
  };

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
  const TypeIcon = getTypeIcon();
  const metaItems = [
    {
      Icon: Users,
      text: `${formatCompactNumber(community.members_count || 0)} ${(community.members_count || 0) <= 1 ? 'membre' : 'membres'}`,
    },
  ];

  if (isManagement) {
    metaItems.push({
      Icon: MapPin,
      text: community.city && community.country
        ? `${community.city}, ${community.country}`
        : community.city || 'En ligne',
    });
  } else {
    metaItems.push({
      Icon: TypeIcon,
      text: getTypeText(),
    });
  }

  const imageUrl = community.cover_image_url || community.images?.[0];

  return (
    <CardContainer onPress={onPress} isLast={isLast}>
      <CardImage imageUrl={imageUrl} PlaceholderIcon={Users}>
        <CardBadgeRow>
          {community.type && (
            <CardBadge
              label={COMMUNITY_TYPE_LABELS[community.type as keyof typeof COMMUNITY_TYPE_LABELS] || community.type}
              backgroundColor={colors.primary}
              textColor={colors.textOnPrimary}
            />
          )}
          <CardBadge
            label={getVisibilityText()}
            backgroundColor={isPrivateCommunity() ? colors.warning : colors.success}
            textColor={colors.textOnPrimary}
            Icon={isPrivateCommunity() ? Lock : Globe}
          />
          {isManagement && (
            <CardBadge
              label="Active"
              backgroundColor={colors.success}
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
          title={community.name}
          subtitle={community.organization?.name}
          actions={actions}
        />

        {community.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {community.description}
          </Text>
        )}

        <CardMetaRow items={metaItems} />
      </CardContent>
    </CardContainer>
  );
});

CommunityCard.displayName = 'CommunityCard';

const styles = StyleSheet.create({
  description: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 4,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
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
