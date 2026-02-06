import { Tabs } from 'expo-router';
import { useSpace } from '../../src/contexts/SpaceContext';

/**
 * TabsLayout - Main tabs navigation
 *
 * NOTE: The default tab bar is hidden. Each tab screen includes
 * the unified FooterNav component directly for consistent navigation.
 */
export default function TabsLayout() {
  const { isOrganizationSpace } = useSpace();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Hide the default tab bar - we use FooterNav component instead
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="assistant/index"
        options={{
          href: '/(tabs)/assistant',
        }}
      />
      <Tabs.Screen
        name="explore/index"
        options={{
          href: '/(tabs)/explore',
        }}
      />
      <Tabs.Screen
        name="home/index"
        options={{
          href: isOrganizationSpace ? null : '/(tabs)/home',
        }}
      />
      <Tabs.Screen
        name="gestion/index"
        options={{
          href: isOrganizationSpace ? '/(tabs)/gestion' : null,
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          href: '/(tabs)/settings',
        }}
      />
    </Tabs>
  );
}
