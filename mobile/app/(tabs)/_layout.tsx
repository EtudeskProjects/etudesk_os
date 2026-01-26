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
        name="assistant"
        options={{}}
      />
      <Tabs.Screen
        name="explore"
        options={{}}
      />
      <Tabs.Screen
        name="graphe"
        options={{
          href: isOrganizationSpace ? null : '/(tabs)/graphe',
        }}
      />
      <Tabs.Screen
        name="gestion"
        options={{
          href: isOrganizationSpace ? '/(tabs)/gestion' : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{}}
      />
    </Tabs>
  );
}
