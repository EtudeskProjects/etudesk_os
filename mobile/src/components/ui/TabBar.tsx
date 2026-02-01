import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import type { LucideIcon } from 'lucide-react-native';

interface Tab {
  key: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { borderBottomColor: colors.borderColor }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const color = isActive ? colors.primary : colors.textSecondary;
        const TabIcon = tab.icon;

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabChange(tab.key)}
          >
            <TabIcon size={18} color={color} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.tabText, { color }]}>{tab.label}</Text>
            {tab.count !== undefined && tab.count > 0 && (
              <View style={[styles.badge, { backgroundColor: isActive ? colors.primary : colors.gray300 }]}>
                <Text style={[styles.badgeText, { color: colors.textOnPrimary }]}>{tab.count}</Text>
              </View>
            )}
            {isActive && <View style={[styles.indicator, { backgroundColor: colors.primary }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: BORDER.width.thin,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
    position: 'relative',
  },
  tabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: SPACING.lg,
    right: SPACING.lg,
    height: 2,
    borderRadius: 1,
  },
});
