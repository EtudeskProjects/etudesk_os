import { useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { BORDER, LAYOUT, OPACITY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  color?: string; // Custom color for the toggle (defaults to primary)
  size?: 'normal' | 'small'; // Size variant
}

const SIZES = {
  normal: {
    trackWidth: 48,
    trackHeight: 8,
    thumbSize: 28,
  },
  small: {
    trackWidth: 36,
    trackHeight: 6,
    thumbSize: 20,
  },
};

export function Toggle({ value, onValueChange, disabled = false, color, size = 'normal' }: ToggleProps) {
  const { colors } = useTheme();
  const activeColor = color || colors.primary;
  const { trackWidth, trackHeight, thumbSize } = SIZES[size];

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
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled}
      style={[{ width: trackWidth, height: thumbSize, justifyContent: 'center' }, disabled && styles.disabled]}
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: OPACITY[50],
  },
});
