import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeColors, ThemeMode, LIGHT_COLORS, DARK_COLORS } from '../constants/theme';
import { STORAGE_KEYS } from '../constants/config';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  themePreference: ThemePreference;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode | ThemePreference) => void;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  themePreference: 'system',
  colors: LIGHT_COLORS,
  toggleTheme: () => { },
  setTheme: () => { },
  isDark: false,
});

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [mode, setMode] = useState<ThemeMode>(systemColorScheme === 'dark' ? 'dark' : 'light');
  const [hasHydrated, setHasHydrated] = useState(false);

  // Load stored theme preference on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemePreferenceState(stored);
          if (stored !== 'system') {
            setMode(stored);
          } else {
            setMode(systemColorScheme === 'dark' ? 'dark' : 'light');
          }
        }
      } catch {
        // ignore
      }
      setHasHydrated(true);
    })();
  }, []);

  // When preference is 'system', follow system; otherwise keep current mode (set by user)
  useEffect(() => {
    if (!hasHydrated) return;
    if (themePreference === 'system' && systemColorScheme) {
      setMode(systemColorScheme === 'dark' ? 'dark' : 'light');
    }
  }, [themePreference, systemColorScheme, hasHydrated]);

  const setTheme = useCallback(async (newMode: ThemeMode | ThemePreference) => {
    const preference: ThemePreference = newMode === 'light' || newMode === 'dark' ? newMode : 'system';
    setThemePreferenceState(preference);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME, preference);
    } catch {
      // ignore
    }
    if (preference === 'system') {
      setMode(systemColorScheme === 'dark' ? 'dark' : 'light');
    } else {
      setMode(preference);
    }
  }, [systemColorScheme]);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      setThemePreferenceState(next);
      AsyncStorage.setItem(STORAGE_KEYS.THEME, next).catch(() => { });
      return next;
    });
  }, []);

  // Force light mode for now as per user request
  const colors = LIGHT_COLORS; // was: mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  return (
    <ThemeContext.Provider
      value={{
        mode: 'light', // Force 'light' instead of passing internal 'mode' state
        themePreference,
        colors,
        toggleTheme: () => { }, // Disable toggling
        setTheme,
        isDark: false, // Force false
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
