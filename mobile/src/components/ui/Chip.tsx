import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ViewStyle, TextStyle } from 'react-native';
import { SPACING, TYPOGRAPHY, BORDER, OPACITY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  leftIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export function Chip({
  label,
  selected = false,
  onPress,
  leftIcon,
  style,
  textStyle,
  accessibilityLabel,
}: ChipProps) {
  const { colors } = useTheme();

  const bg = selected ? withOpacity(colors.primary, OPACITY[12]) : colors.gray100;
  const borderColor = selected ? colors.primary : colors.borderColor;
  const color = selected ? colors.primary : colors.textPrimary;

  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress
    ? { onPress, activeOpacity: 0.8 as const, accessibilityRole: 'button' as const }
    : {};

  return (
    <Container
      style={[styles.base, { backgroundColor: bg, borderColor }, style]}
      accessible={true}
      accessibilityLabel={accessibilityLabel || label}
      {...(containerProps as any)}
    >
      {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
      <Text style={[styles.text, { color }, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </Container>
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

