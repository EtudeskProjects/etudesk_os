/**
 * ChartBlock Component
 * Simple bar chart implementation using View components
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart3 } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';

interface ChartData {
  label: string;
  value: number;
}

interface ChartBlockProps {
  data: {
    type: string;
    title: string;
    data: ChartData[];
  };
}

export const ChartBlock: React.FC<ChartBlockProps> = ({ data }) => {
  const { colors } = useTheme();

  // Calculate max value for scaling
  const maxValue = Math.max(...data.data.map(item => item.value), 1);

  // Color palette for bars
  const barColors = [
    colors.primary,
    colors.success,
    colors.warning,
    colors.info,
    colors.primaryLight,
    colors.successDark,
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <BarChart3
          size={ICON.size.md}
          color={colors.primary}
          strokeWidth={ICON.strokeWidth}
        />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {data.title}
          </Text>
          <Text style={[styles.type, { color: colors.textTertiary }]}>
            Graphique {data.type}
          </Text>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chart}>
        {data.data.map((item, index) => {
          const barWidth = (item.value / maxValue) * 100;
          const barColor = barColors[index % barColors.length];

          return (
            <View key={index} style={styles.barRow}>
              {/* Label */}
              <View style={styles.labelContainer}>
                <Text style={[styles.label, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.label}
                </Text>
              </View>

              {/* Bar and Value */}
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${barWidth}%`,
                      backgroundColor: barColor,
                    },
                  ]}
                >
                  {barWidth > 20 && (
                    <Text style={[styles.valueInside, { color: colors.white }]}>
                      {item.value}
                    </Text>
                  )}
                </View>
                {barWidth <= 20 && (
                  <Text style={[styles.valueOutside, { color: colors.textSecondary }]}>
                    {item.value}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={[styles.legend, { backgroundColor: colors.backgroundSecondary, borderTopColor: withOpacity(colors.textPrimary, OPACITY[5]) }]}>
        <Text style={[styles.legendText, { color: colors.textTertiary }]}>
          Valeur maximale: {maxValue}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    overflow: 'hidden',
    marginVertical: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    marginBottom: SPACING.xxs,
  },
  type: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  chart: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  barRow: {
    gap: SPACING.xs,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    gap: SPACING.sm,
  },
  bar: {
    height: '100%',
    minWidth: 2,
    borderRadius: BORDER.radius.xs,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.sm,
  },
  valueInside: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  valueOutside: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  legend: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: BORDER.width.thin,
    borderTopColor: 'transparent',
  },
  legendText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export default ChartBlock;
