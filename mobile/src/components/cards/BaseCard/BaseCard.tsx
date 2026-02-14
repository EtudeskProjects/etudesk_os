/**
 * BaseCard - Reusable card component for consistent card layouts
 *
 * Used by: OpportunityCard, CommunityCard, SpaceCard
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT, OPACITY, withOpacity, COMPONENT } from '../../../constants/theme';
import { useTheme } from '../../../hooks/useTheme';
import { getFullImageUrl } from '../../../utils/image';
import type { BaseCardProps } from './types';

export const BaseCard: React.FC<BaseCardProps> = React.memo(({
  onPress,
  imageUrl,
  placeholderIcon: PlaceholderIcon,
  title,
  subtitle,
  description,
  badges = [],
  statusOverlay,
  metaItems = [],
  actions = [],
  isLast = false,
  primaryColor,
}) => {
  const { colors } = useTheme();
  const cardColor = primaryColor || colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: withOpacity(cardColor, OPACITY[8]),
          borderColor: withOpacity(cardColor, OPACITY[15]),
        },
        isLast && styles.noBorder,
      ]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      {/* Image Section */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: getFullImageUrl(imageUrl) || '' }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.gray100 }]}>
            <PlaceholderIcon
              size={ICON.size.xl}
              color={colors.gray400}
              strokeWidth={ICON.strokeWidth}
            />
          </View>
        )}

        {/* Badges (bottom-left) */}
        {badges.length > 0 && (
          <View style={styles.badgesRow}>
            {badges.map((badge, index) => (
              <View
                key={index}
                style={[styles.badge, { backgroundColor: badge.backgroundColor }]}
              >
                {badge.icon && (
                  <badge.icon
                    size={ICON.size.xxs}
                    color={badge.textColor}
                    strokeWidth={2.5}
                  />
                )}
                <Text style={[styles.badgeText, { color: badge.textColor }]}>
                  {badge.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Status Overlay (top-right) */}
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
      </View>

      {/* Content Section */}
      <View style={styles.content}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.mainInfo}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>

          {/* Actions */}
          {actions.length > 0 && (
            <View style={styles.actionsRow}>
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.actionButton}
                  onPress={action.onPress}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <action.Icon
                    size={ICON.size.md}
                    color={action.color || colors.gray400}
                    strokeWidth={ICON.strokeWidth}
                    fill={action.fill || 'none'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Description */}
        {description && (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {description}
          </Text>
        )}

        {/* Meta Row */}
        {metaItems.length > 0 && (
          <View style={styles.metaRow}>
            {metaItems.map((meta, index) => (
              <View key={index} style={styles.metaItem}>
                <meta.icon
                  size={14}
                  color={colors.textSecondary}
                  strokeWidth={ICON.strokeWidth}
                />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {meta.text}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

BaseCard.displayName = 'BaseCard';

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
    borderWidth: BORDER.width.thin,
    marginBottom: SPACING.md,
  },
  noBorder: {
    borderWidth: 0,
    borderRadius: 0,
  },
  imageContainer: {
    height: LAYOUT.cardImageHeightSm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgesRow: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMPONENT.pill.gap,
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  statusOverlayRow: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
  },
  statusOverlayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMPONENT.pill.gap,
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
  },
  statusOverlayText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },
  content: {
    padding: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mainInfo: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  actionButton: {
    padding: SPACING.xs,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },
  description: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 4,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },
  metaRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.md,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  metaText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
