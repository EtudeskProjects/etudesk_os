import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import { BORDER, OPACITY, SPACING, withOpacity, ICON } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Tap } from './Tap';

type SelectCardProps = {
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

// Card-like selectable option used for "mode/visibility/type" pickers.
// This is a design-system primitive so screens don't hand-roll <Tap> cards.
export function SelectCard({
  selected = false,
  disabled = false,
  onPress,
  children,
  style,
  accessibilityLabel,
}: SelectCardProps) {
  const { colors } = useTheme();

  const backgroundColor = selected ? withOpacity(colors.primary, OPACITY[10]) : colors.surface;
  const borderColor = selected ? colors.primary : colors.gray200;

  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[styles.base, { backgroundColor, borderColor }, style]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
    >
      {children}
      {selected ? (
        <View style={[styles.check, { backgroundColor: colors.primary }]}>
          <Check size={12} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth + 1} />
        </View>
      ) : null}
    </Tap>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.5,
    borderRadius: BORDER.radius.md,
    position: 'relative',
  },
  check: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    width: 20,
    height: 20,
    borderRadius: BORDER.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

