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
  const trendBg = trend?.direction === 'up' ? colors.successLight : colors.errorLight;
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : TrendingDown;

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderColor }]}>
      <Text style={[styles.label, { color: colors.textTertiary }]}>{title}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.textPrimary }]}>
          {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
        </Text>
        {unit && <Text style={[styles.unit, { color: colors.textSecondary }]}>{unit}</Text>}
      </View>
      {trend && (
        <View style={[styles.trendPill, { backgroundColor: trendBg }]}>
          <TrendIcon size={ICON.size.xs} color={trendColor} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.trendDelta, { color: trendColor }]}>
            {trend.direction === 'up' ? '+' : '-'}{trend.delta}{unit || ''}
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
    marginVertical: SPACING.xs,
    borderWidth: 1,
    borderRadius: BORDER.radius.md,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xxs,
  },
  value: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xxxl,
  },
  unit: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.xxs,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER.radius.full,
  },
  trendDelta: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  trendPeriod: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xxs,
  },
});

export default MetricCard;
