import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { BORDER, OPACITY, SPACING, TYPOGRAPHY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Tap } from './Tap';

type IconTileProps = {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  selected?: boolean;
  selectedColor?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

// Icon + label stacked vertically. Useful for compact action bars.
export function IconTile({
  onPress,
  icon,
  label,
  disabled = false,
  selected = false,
  selectedColor,
  style,
  labelStyle,
  accessibilityLabel,
}: IconTileProps) {
  const { colors } = useTheme();
  const highlight = selectedColor || colors.primary;

  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        { backgroundColor: selected ? withOpacity(highlight, OPACITY[15]) : colors.gray100 },
        style,
      ]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled, selected }}
    >
      {icon}
      <Text style={[styles.label, { color: colors.textSecondary }, labelStyle]} numberOfLines={1}>
        {label}
      </Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.sm,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textAlign: 'center',
  },
});

