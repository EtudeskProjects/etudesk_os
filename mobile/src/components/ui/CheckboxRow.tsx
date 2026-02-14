import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import { BORDER, ICON, OPACITY, SPACING, TYPOGRAPHY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Tap } from './Tap';

type CheckboxRowProps = {
  label: string;
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
  checkboxPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  checkboxStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function CheckboxRow({
  label,
  checked,
  onPress,
  disabled = false,
  checkboxPosition = 'left',
  style,
  labelStyle,
  checkboxStyle,
  accessibilityLabel,
}: CheckboxRowProps) {
  const { colors } = useTheme();

  const boxBg = checked ? colors.primary : 'transparent';
  const boxBorder = checked ? colors.primary : colors.gray300;

  const checkbox = (
    <View
      style={[
        styles.checkbox,
        { backgroundColor: boxBg, borderColor: boxBorder },
        disabled && { opacity: OPACITY[60] },
        checkboxStyle,
      ]}
    >
      {checked ? <Check size={12} color={colors.textOnPrimary} strokeWidth={3} /> : null}
    </View>
  );

  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[styles.row, style]}
      accessible={true}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ checked, disabled }}
    >
      {checkboxPosition === 'left' ? checkbox : null}
      <Text style={[styles.label, { color: colors.textPrimary }, labelStyle]} numberOfLines={1}>
        {label}
      </Text>
      {checkboxPosition === 'right' ? checkbox : null}
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: BORDER.radius.xs,
    borderWidth: BORDER.width.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

