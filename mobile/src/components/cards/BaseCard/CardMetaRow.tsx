/**
 * CardMetaRow - Meta items row (icons + text)
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, ICON } from '../../../constants/theme';

export interface MetaItem {
  Icon: LucideIcon;
  text: string;
  color?: string;
  fontWeight?: string;
}

export interface CardMetaRowProps {
  items: MetaItem[];
  style?: ViewStyle;
}

export const CardMetaRow: React.FC<CardMetaRowProps> = ({ items, style }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.metaRow, style]}>
      {items.map((item, index) => {
        const color = item.color || colors.textSecondary;
        return (
          <View key={index} style={styles.metaItem}>
            <item.Icon
              size={14}
              color={color}
              strokeWidth={ICON.strokeWidth}
            />
            <Text
              style={[
                styles.metaText,
                { color },
                item.fontWeight && { fontWeight: item.fontWeight as any },
              ]}
            >
              {item.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.md,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  metaText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
