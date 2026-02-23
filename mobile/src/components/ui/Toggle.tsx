import { useRef, useEffect } from 'react';
import {
  View,
  Animated,
  StyleSheet,
} from 'react-native';
import { BORDER, LAYOUT, OPACITY, COMPONENT, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../contexts/I18nContext';
import { Tap } from './Tap';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  color?: string; // Custom color for the toggle (defaults to primary)
  size?: 'normal' | 'small'; // Size variant
  /** Accessibility label describing the toggle */
  accessibilityLabel?: string;
  /** Accessibility hint describing what happens when toggled */
  accessibilityHint?: string;
}

export function Toggle({
  value,
  onValueChange,
  disabled = false,
  color,
  size = 'normal',
  accessibilityLabel,
  accessibilityHint,
}: ToggleProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const activeColor = color || colors.primary;
  // Use design system tokens instead of hardcoded values
  const { trackWidth, trackHeight, thumbSize } = COMPONENT.toggle[size];

  const translateX = useRef(new Animated.Value(value ? trackWidth - thumbSize : 0)).current;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: value ? trackWidth - thumbSize : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  }, [value, translateX, trackWidth, thumbSize]);

  const handlePress = () => {
    if (!disabled) {
      onValueChange(!value);
    }
  };

  return (
    <Tap
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled}
      style={[{ width: trackWidth, height: thumbSize, justifyContent: 'center' }, disabled && styles.disabled]}
      accessible={true}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint || (value ? t('common.disable') : t('common.enable'))}
      accessibilityState={{
        checked: value,
        disabled: disabled,
      }}
    >
      {/* Track (thin background) */}
      <View
        style={[
          {
            position: 'absolute',
            width: trackWidth,
            height: trackHeight,
            borderRadius: trackHeight / 2,
            backgroundColor: activeColor,
            opacity: value ? 1 : 0.3,
          },
        ]}
      />

      {/* Thumb (big circle) */}
      <Animated.View
        style={[
          {
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            backgroundColor: value ? activeColor : colors.white,
            borderWidth: value ? 0 : BORDER.width.thin,
            borderColor: withOpacity(activeColor, OPACITY[30]),
            transform: [{ translateX }],
          },
        ]}
      />
    </Tap>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: OPACITY[50],
  },
});
