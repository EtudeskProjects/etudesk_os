import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { SPACING, BORDER, ICON, OPACITY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Tap } from './Tap';

type IconButtonSize = 'sm' | 'md' | 'lg';
type IconButtonVariant = 'ghost' | 'filled' | 'outline';

interface IconButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  children?: React.ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
}

export function IconButton({
  onPress,
  icon,
  children,
  size = 'md',
  variant = 'ghost',
  disabled = false,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: IconButtonProps) {
  const { colors } = useTheme();

  const sizeStyle = styles[`size_${size}`];
  const baseBg =
    variant === 'filled' ? colors.gray100 : 'transparent';
  const bg = disabled ? withOpacity(baseBg, OPACITY[50]) : baseBg;
  const borderWidth = variant === 'outline' ? BORDER.width.thin : 0;
  const borderColor = variant === 'outline' ? colors.borderColorStrong : 'transparent';

  return (
    <Tap
      style={[
        styles.base,
        sizeStyle,
        { backgroundColor: bg, borderWidth, borderColor },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={{ top: SPACING.sm, bottom: SPACING.sm, left: SPACING.sm, right: SPACING.sm }}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      {icon}
      {children}
    </Tap>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },
  size_sm: {
    width: ICON.size.xl,
    height: ICON.size.xl,
  },
  size_md: {
    width: 40,
    height: 40,
  },
  size_lg: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.md,
  },
  disabled: {
    opacity: OPACITY[60],
  },
});
