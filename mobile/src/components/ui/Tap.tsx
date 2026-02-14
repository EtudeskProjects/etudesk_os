import React from 'react';
import {
  Pressable,
  StyleProp,
  ViewStyle,
  PressableStateCallbackType,
} from 'react-native';

export type TapProps = Omit<React.ComponentProps<typeof Pressable>, 'style'> & {
  /**
   * Same semantics as TouchableOpacity: 1 = no dim, 0 = invisible.
   * Pressable doesn't support it natively, so we emulate with pressed opacity.
   */
  activeOpacity?: number;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

export function Tap({
  activeOpacity = 0.8,
  style,
  disabled,
  ...props
}: TapProps) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={(state) => {
        const pressed = state.pressed && !disabled;
        const opacityStyle = pressed ? { opacity: activeOpacity } : null;
        if (typeof style === 'function') {
          return [style(state), opacityStyle];
        }
        return [style, opacityStyle];
      }}
    />
  );
}

