/**
 * CardHeader - Title + subtitle + actions row
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, ICON } from '../../../constants/theme';

export interface CardAction {
  Icon: LucideIcon;
  color?: string;
  onPress: () => void;
  fill?: string;
}

export interface CardHeaderProps {
  title: string;
  /** Subtitle text or custom subtitle component */
  subtitle?: string | React.ReactNode;
  /** Action buttons on the right */
  actions?: CardAction[];
  /** Custom style */
  style?: ViewStyle;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  actions,
  style,
}) => {
  const { colors } = useTheme();

  const renderSubtitle = () => {
    if (!subtitle) return null;
    if (typeof subtitle === 'string') {
      return (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      );
    }
    return subtitle;
  };

  return (
    <View style={[styles.header, style]}>
      <View style={styles.mainInfo}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        {renderSubtitle()}
      </View>

      {actions && actions.length > 0 && (
        <View style={styles.actionsRow}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionButton}
              onPress={action.onPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <action.Icon
                size={ICON.size.md}
                color={action.color || colors.gray400}
                strokeWidth={ICON.strokeWidth}
                fill={action.fill || 'none'}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mainInfo: {
    flex: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  actionButton: {
    padding: SPACING.xs,
  },
});
