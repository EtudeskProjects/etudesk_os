import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import { BORDER, SPACING, TYPOGRAPHY, ICON } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Tap } from './Tap';

type RadioRowProps = {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  descriptionStyle?: StyleProp<TextStyle>;
  iconContainerStyle?: StyleProp<ViewStyle>;
  radioStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

// Selectable row with a radio indicator on the right.
export function RadioRow({
  title,
  description,
  selected,
  onPress,
  icon,
  style,
  titleStyle,
  descriptionStyle,
  iconContainerStyle,
  radioStyle,
  accessibilityLabel,
}: RadioRowProps) {
  const { colors } = useTheme();

  return (
    <Tap
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.row, style]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ selected }}
    >
      {icon ? <View style={[styles.iconWrap, iconContainerStyle]}>{icon}</View> : null}

      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.textPrimary }, titleStyle]} numberOfLines={1}>
          {title}
        </Text>
        {description ? (
          <Text style={[styles.description, { color: colors.textSecondary }, descriptionStyle]} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.radio,
          { borderColor: selected ? colors.primary : colors.gray300, backgroundColor: selected ? colors.primary : 'transparent' },
          radioStyle,
        ]}
      >
        {selected ? <Check size={14} color={colors.textOnPrimary} strokeWidth={3} /> : null}
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  description: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: BORDER.radius.full,
    borderWidth: BORDER.width.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

