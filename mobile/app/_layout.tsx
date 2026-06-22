import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { useFonts, Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { I18nProvider } from '../src/contexts/I18nContext';
import { AuthProvider } from '../src/contexts/AuthContext';
import { SpaceProvider } from '../src/contexts/SpaceContext';
import { OrganizationMemberProvider } from '../src/contexts/OrganizationMemberContext';
import { AlertProvider } from '../src/contexts/AlertContext';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { ToastProvider } from '../src/components/ui/Toast';
import { useTheme } from '../src/hooks/useTheme';
import { LIGHT_COLORS, DARK_COLORS } from '../src/constants/theme';
import { LoadingShimmerStatic } from '../src/components/ui';
import { applyDefaultFont } from '../src/lib/applyDefaultFont';

// Enforce the Montserrat brand font on every Text/TextInput, mapping legacy
// fontWeight-only styles to the right family. Runs once at module load.
applyDefaultFont();

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const themeColors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <LoadingShimmerStatic colors={themeColors} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <SpaceProvider>
              <OrganizationMemberProvider>
                <AlertProvider>
                  <ToastProvider>
                    <RootLayoutNav />
                  </ToastProvider>
                </AlertProvider>
              </OrganizationMemberProvider>
            </SpaceProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
