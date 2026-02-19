/**
 * FooterNav - Unified navigation footer component
 * Use this component on all screens that need the main navigation footer
 * Matches the styling of the main tabs layout
 * Dynamically shows different tabs based on space context (talent vs organization)
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  LayoutGrid,
  MessageCircle,
  Compass,
  Settings,
} from 'lucide-react-native';
import { SPACING, ICON, BORDER } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useSpace } from '../../contexts/SpaceContext';
import { Tap } from './Tap';

type TabName = 'home' | 'gestion' | 'assistant' | 'explore' | 'settings';

interface FooterNavProps {
  activeTab?: TabName;
}

// Accessibility labels for each tab
const TAB_ACCESSIBILITY: Record<TabName, { label: string; hint: string }> = {
  home: { label: 'Accueil', hint: 'Aller à la page d\'accueil' },
  gestion: { label: 'Gestion', hint: 'Aller à votre espace organisation' },
  assistant: { label: 'Assistant', hint: 'Ouvrir l\'assistant IA' },
  explore: { label: 'Explorer', hint: 'Parcourir les opportunités et communautés' },
  settings: { label: 'Paramètres', hint: 'Accéder aux paramètres' },
};

export const FooterNav: React.FC<FooterNavProps> = ({ activeTab }) => {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isOrganizationSpace } = useSpace();

  const normalizedActiveTab: TabName | undefined =
    isOrganizationSpace && activeTab === 'home' ? 'gestion' : activeTab;
  const bottomPadding =
    Platform.OS === 'android'
      ? Math.max(SPACING.xxxl, insets.bottom + SPACING.sm)
      : Math.max(insets.bottom, SPACING.sm);

  const tabs: { name: TabName; icon: typeof Home; route: string }[] = [
    isOrganizationSpace
      ? { name: 'gestion', icon: LayoutGrid, route: '/(tabs)/gestion' }
      : { name: 'home', icon: Home, route: '/(tabs)/home' },
    { name: 'assistant', icon: MessageCircle, route: '/(tabs)/assistant' },
    { name: 'explore', icon: Compass, route: '/(tabs)/explore' },
    { name: 'settings', icon: Settings, route: '/(tabs)/settings' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderTopColor: colors.borderColor, paddingBottom: bottomPadding }]}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = normalizedActiveTab === tab.name;
        const iconColor = isActive ? colors.textOnPrimary : colors.textSecondary;

        return (
          <Tap
            key={tab.name}
            style={styles.tab}
            onPress={() => router.push(tab.route as any)}
            activeOpacity={0.7}
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel={TAB_ACCESSIBILITY[tab.name].label}
            accessibilityHint={TAB_ACCESSIBILITY[tab.name].hint}
            accessibilityState={{ selected: isActive }}
          >
            <View style={[
              styles.tabIcon,
              isActive && [styles.tabIconActive, { backgroundColor: colors.primary }],
            ]}>
              <Icon
                size={ICON.size.lg}
                color={iconColor}
                strokeWidth={isActive ? ICON.strokeWidthThick : ICON.strokeWidth}
              />
            </View>
          </Tap>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: BORDER.width.thin,
    paddingTop: SPACING.sm,
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
    borderRadius: BORDER.radius.md,
  },
});

export default FooterNav;
