/**
 * CardContent - Content wrapper with standard padding
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { SPACING } from '../../../constants/theme';

export interface CardContentProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Remove padding */
  noPadding?: boolean;
}

export const CardContent: React.FC<CardContentProps> = ({
  children,
  style,
  noPadding = false,
}) => {
  return (
    <View style={[styles.content, noPadding && styles.noPadding, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: SPACING.md,
  },
  noPadding: {
    padding: 0,
  },
});
