import React from 'react';
import { Text, StyleSheet, View, type StyleProp, type ViewStyle, type TextStyle, type LayoutChangeEvent } from 'react-native';
import { SPACING, TYPOGRAPHY, BORDER, OPACITY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Tap } from './Tap';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  leftIcon?: React.ReactNode;
  disabled?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export function Chip({
  label,
  selected = false,
  onPress,
  leftIcon,
  disabled = false,
  onLayout,
  style,
  textStyle,
  accessibilityLabel,
}: ChipProps) {
  const { colors } = useTheme();

  const bg = selected ? withOpacity(colors.primary, OPACITY[12]) : colors.gray100;
  const borderColor = selected ? colors.primary : colors.borderColor;
  const color = selected ? colors.primary : colors.textPrimary;

  if (onPress) {
    return (
      <Tap
        onPress={onPress}
        disabled={disabled}
        onLayout={onLayout}
        activeOpacity={0.8}
        style={[styles.base, { backgroundColor: bg, borderColor }, style]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityState={{ disabled, selected }}
      >
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <Text style={[styles.text, { color }, textStyle]} numberOfLines={1}>
          {label}
        </Text>
      </Tap>
    );
  }

  return (
    <View
      onLayout={onLayout}
      style={[styles.base, { backgroundColor: bg, borderColor }, style]}
      accessible={true}
      accessibilityLabel={accessibilityLabel || label}
    >
      {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
      <Text style={[styles.text, { color }, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.full,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});
