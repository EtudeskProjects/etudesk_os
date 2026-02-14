import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BORDER, SPACING } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

type CardVariant = 'surface' | 'muted';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: keyof typeof SPACING | number;
  variant?: CardVariant;
}

export function Card({
  children,
  style,
  padding = 'lg',
  variant = 'surface',
}: CardProps) {
  const { colors } = useTheme();
  const p = typeof padding === 'number' ? padding : SPACING[padding];
  const backgroundColor = variant === 'muted' ? colors.gray50 : colors.surface;

  return (
    <View
      style={[
        styles.base,
        { backgroundColor, borderColor: colors.borderColor, padding: p },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
  },
});

