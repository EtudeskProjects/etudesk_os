/**
 * MetricCard Component — Single KPI with trend indicator
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../../../constants/theme';

interface Trend {
  direction: 'up' | 'down';
  delta: number;
  period?: string;
}

interface MetricCardProps {
  title: string;
  value: number;
  unit?: string;
  trend?: Trend;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, unit, trend }) => {
  const { colors } = useTheme();

  const trendColor = trend?.direction === 'up' ? colors.success : colors.error;
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : TrendingDown;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <Text style={[styles.title, { color: colors.textTertiary }]}>{title}</Text>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.textPrimary }]}>
          {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
        </Text>
        {unit && <Text style={[styles.unit, { color: colors.textSecondary }]}>{unit}</Text>}
      </View>

      {trend && (
        <View style={styles.trendRow}>
          <TrendIcon size={ICON.size.sm} color={trendColor} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.trendDelta, { color: trendColor }]}>
            {trend.direction === 'up' ? '+' : '-'}{trend.delta}
            {unit ? unit : ''}
          </Text>
          {trend.period && (
            <Text style={[styles.trendPeriod, { color: colors.textTertiary }]}>{trend.period}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    marginBottom: SPACING.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
  },
  value: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 32,
  },
  unit: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  trendDelta: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  trendPeriod: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export default MetricCard;
