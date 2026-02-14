/**
 * CardContainer - Base wrapper for card layouts
 * Provides consistent styling, theming and press handling
 */

import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, BORDER, OPACITY, withOpacity } from '../../../constants/theme';
import { Tap } from '../../ui';


export interface CardContainerProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** Custom primary color for the card */
  primaryColor?: string;
  /** Use default theme colors instead of primary-based colors */
  useDefaultColors?: boolean;
  /** Remove border on last item */
  isLast?: boolean;
  /** Custom style overrides */
  style?: StyleProp<ViewStyle>;
  /** Horizontal layout (row) */
  horizontal?: boolean;
}

export const CardContainer: React.FC<CardContainerProps> = ({
  children,
  onPress,
  primaryColor,
  useDefaultColors = false,
  isLast = false,
  style,
  horizontal = false,
}) => {
  const { colors } = useTheme();
  const cardColor = primaryColor || colors.primary;

  const containerColors = useDefaultColors
    ? { backgroundColor: colors.surface, borderColor: colors.gray200 }
    : {
        backgroundColor: withOpacity(cardColor, OPACITY[8]),
        borderColor: withOpacity(cardColor, OPACITY[15]),
      };

  return (
    <Tap
      style={[
        styles.container,
        containerColors,
        horizontal && styles.horizontal,
        isLast && styles.noBorder,
        style,
      ]}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={!onPress}
    >
      {children}
    </Tap>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
    borderWidth: BORDER.width.thin,
    marginBottom: SPACING.md,
  },
  horizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  noBorder: {
    borderWidth: 0,
    borderRadius: 0,
  },
});
