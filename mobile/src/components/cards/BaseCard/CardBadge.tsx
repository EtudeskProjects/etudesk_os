/**
 * CardBadge - Badge components for cards
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../../constants/theme';

export interface CardBadgeProps {
  label: string;
  backgroundColor: string;
  textColor: string;
  Icon?: LucideIcon;
}

export const CardBadge: React.FC<CardBadgeProps> = ({
  label,
  backgroundColor,
  textColor,
  Icon,
}) => {
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      {Icon && (
        <Icon size={ICON.size.xxs} color={textColor} strokeWidth={2.5} />
      )}
      <Text style={[styles.badgeText, { color: textColor }]}>{label}</Text>
    </View>
  );
};

export interface CardBadgeRowProps {
  children: React.ReactNode;
  /** Position: 'bottom-left' | 'top-left' | 'top-right' */
  position?: 'bottom-left' | 'top-left' | 'top-right';
  style?: ViewStyle;
}

export const CardBadgeRow: React.FC<CardBadgeRowProps> = ({
  children,
  position = 'bottom-left',
  style,
}) => {
  const positionStyle = getPositionStyle(position);

  return (
    <View style={[styles.badgeRow, positionStyle, style]}>
      {children}
    </View>
  );
};

const getPositionStyle = (position: string): ViewStyle => {
  switch (position) {
    case 'top-left':
      return { top: SPACING.sm, left: SPACING.sm };
    case 'top-right':
      return { top: SPACING.sm, right: SPACING.sm };
    case 'bottom-left':
    default:
      return { bottom: SPACING.sm, left: SPACING.sm };
  }
};

const styles = StyleSheet.create({
  badgeRow: {
    position: 'absolute',
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});
