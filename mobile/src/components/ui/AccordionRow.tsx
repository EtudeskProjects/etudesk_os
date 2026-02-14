import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { BORDER, ICON, SPACING, TYPOGRAPHY } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Tap } from './Tap';

type AccordionRowProps = {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

export function AccordionRow({
  title,
  subtitle,
  expanded,
  onPress,
  style,
  titleStyle,
  subtitleStyle,
  accessibilityLabel,
}: AccordionRowProps) {
  const { colors } = useTheme();

  return (
    <Tap
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.row, style]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ expanded }}
    >
      <View style={styles.left}>
        <Text style={[styles.title, { color: colors.textPrimary }, titleStyle]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }, subtitleStyle]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {expanded ? (
        <ChevronUp size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
      ) : (
        <ChevronDown size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
      )}
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },
  left: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

