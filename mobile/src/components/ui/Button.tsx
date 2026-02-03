import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { SPACING, TYPOGRAPHY, LAYOUT, BORDER, OPACITY } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  /** Accessibility label - defaults to title if not provided */
  accessibilityLabel?: string;
  /** Accessibility hint - describes what happens when button is pressed */
  accessibilityHint?: string;
  /** Test ID for testing */
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();

  // Dynamic background colors based on variant and theme
  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary':
        return colors.primary;
      case 'secondary':
        return colors.gray100;
      case 'outline':
        return 'transparent';
      case 'ghost':
        return 'transparent';
      case 'destructive':
        return colors.error;
      default:
        return colors.primary;
    }
  };

  // Dynamic text colors based on variant and theme
  const getTextColor = () => {
    switch (variant) {
      case 'primary':
        return colors.textOnPrimary;
      case 'secondary':
        return colors.textPrimary;
      case 'outline':
        return colors.primary;
      case 'ghost':
        return colors.primary;
      case 'destructive':
        return colors.textOnPrimary;
      default:
        return colors.textOnPrimary;
    }
  };

  // Dynamic border color for outline variant
  const getBorderColor = () => {
    return variant === 'outline' ? colors.borderColorStrong : 'transparent';
  };

  const buttonStyles: ViewStyle[] = [
    styles.base,
    styles[`size_${size}`],
    {
      backgroundColor: getBackgroundColor(),
      borderColor: getBorderColor(),
      borderWidth: variant === 'outline' ? BORDER.width.thin : 0,
    },
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[];

  const textStyles: TextStyle[] = [
    styles.text,
    styles[`textSize_${size}`],
    { color: getTextColor() },
    disabled && styles.textDisabled,
    textStyle as TextStyle,
  ].filter(Boolean) as TextStyle[];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: disabled || loading,
        busy: loading,
      }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'destructive' ? colors.textOnPrimary : colors.primary}
          size="small"
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text style={textStyles}>{title}</Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },

  // Sizes - Using design system layout constants
  size_sm: {
    height: LAYOUT.buttonHeightSm,
    paddingHorizontal: SPACING.md,
  },
  size_md: {
    height: LAYOUT.buttonHeight,
    paddingHorizontal: SPACING.lg,
  },
  size_lg: {
    height: LAYOUT.buttonHeightLg,
    paddingHorizontal: SPACING.xl,
  },

  fullWidth: {
    width: '100%',
  },

  disabled: {
    opacity: OPACITY[50],
  },

  // Text styles
  text: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  textSize_sm: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  textSize_md: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  textSize_lg: {
    fontSize: TYPOGRAPHY.fontSize.lg,
  },

  textDisabled: {
    opacity: 0.7,
  },
});
