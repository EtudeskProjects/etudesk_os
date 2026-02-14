import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BORDER } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface DividerProps {
  inset?: number;
  style?: ViewStyle;
}

export function Divider({ inset = 0, style }: DividerProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: colors.borderColor, marginLeft: inset, marginRight: inset },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    height: BORDER.width.thin,
    width: '100%',
  },
});

