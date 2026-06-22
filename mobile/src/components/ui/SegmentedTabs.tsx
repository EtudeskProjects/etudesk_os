import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, COMPONENT } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import type { LucideIcon } from 'lucide-react-native';
import { Tap } from './Tap';

/**
 * SegmentedTabs — canonical pill segmented control.
 *
 * Single source of truth for the "two/three pill toggle on a gray track"
 * pattern that was copy-pasted (with diverging square/rounded resets) across
 * many screens. Reproduces the help screen's rounded-pill design so every
 * segmented control in the app looks identical.
 *
 * For full-width underline tabs, use <TabBar /> instead.
 */
export interface SegmentedTab {
  key: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

interface SegmentedTabsProps {
  tabs: SegmentedTab[];
  activeKey: string;
  onChange: (key: string) => void;
  /** Per-screen container overrides (margins, etc.). */
  containerStyle?: StyleProp<ViewStyle>;
}

export function SegmentedTabs({ tabs, activeKey, onChange, containerStyle }: SegmentedTabsProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.gray100 }, containerStyle]}>
      {tabs.map((tab) => {
        const isActive = activeKey === tab.key;
        const color = isActive ? colors.primary : colors.gray500;
        const TabIcon = tab.icon;

        return (
          <Tap
            key={tab.key}
            style={[styles.tab, isActive && { backgroundColor: colors.surface }]}
            onPress={() => onChange(tab.key)}
            accessibilityLabel={tab.label}
          >
            {TabIcon && (
              <TabIcon size={ICON.size.sm} color={color} strokeWidth={ICON.strokeWidth} />
            )}
            <Text style={[styles.tabText, { color }]}>{tab.label}</Text>
            {tab.count !== undefined && tab.count > 0 && (
              <View style={[styles.badge, { backgroundColor: isActive ? colors.primary : colors.gray300 }]}>
                <Text style={[styles.badgeText, { color: colors.textOnPrimary }]}>{tab.count}</Text>
              </View>
            )}
          </Tap>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: SPACING.xs,
    borderRadius: BORDER.radius.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },
  tabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  badge: {
    minWidth: COMPONENT.badgeDimensions.minWidth,
    height: COMPONENT.badgeDimensions.height,
    paddingHorizontal: COMPONENT.badgeDimensions.paddingHorizontal,
    borderRadius: COMPONENT.badgeDimensions.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: COMPONENT.badgeDimensions.fontSize,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
