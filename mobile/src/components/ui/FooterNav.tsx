/**
 * FooterNav - Unified navigation footer component
 * Use this component on all screens that need the main navigation footer
 * Matches the styling of the main tabs layout
 * Dynamically shows different tabs based on space context (talent vs organization)
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  MessageCircle,
  Compass,
  Settings,
} from 'lucide-react-native';
import { COLORS, SPACING, ICON, BORDER, LAYOUT } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

type TabName = 'home' | 'assistant' | 'explore' | 'settings';

interface FooterNavProps {
  activeTab?: TabName;
}

export const FooterNav: React.FC<FooterNavProps> = ({ activeTab }) => {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const tabs: { name: TabName; icon: typeof Home; route: string }[] = [
    { name: 'home', icon: Home, route: '/(tabs)/graphe' },
    { name: 'assistant', icon: MessageCircle, route: '/(tabs)/assistant' },
    { name: 'explore', icon: Compass, route: '/(tabs)/explore' },
    { name: 'settings', icon: Settings, route: '/(tabs)/settings' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, SPACING.xs) }]}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.name;

        // Match the tabs layout styling:
        // Active: white icon on blue squared background
        // Inactive: gray icon, no background
        const iconColor = isActive ? '#FFFFFF' : colors.textSecondary;

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => router.push(tab.route as any)}
          >
            <View style={[
              styles.tabIcon,
              isActive && styles.tabIconActive,
            ]}>
              <Icon
                size={ICON.size.lg}
                color={iconColor}
                strokeWidth={isActive ? 1.5 : ICON.strokeWidth}
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingTop: SPACING.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
  },
  tabIconActive: {
    backgroundColor: '#26449F', // Same blue as tabs layout
    borderRadius: BORDER.radius.md,
  },
});

export default FooterNav;
