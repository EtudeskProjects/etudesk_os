/**
 * App Configuration Constants
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  TIMEOUT: 30000,
};

// Mapbox Configuration
export const MAPBOX_CONFIG = {
  ACCESS_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoibGFtaW5lYmFycm8iLCJhIjoiY20zZHMzOW9zMDc5dzJsczgwdWVoZ2NqYyJ9.3baMsQ3_mpKlnBdHCeu0kg',
  GEOCODING_URL: 'https://api.mapbox.com/geocoding/v5/mapbox.places',
};

// AsyncStorage Keys - Centralized to avoid duplication
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER: 'auth_user',
  ONBOARDING_SEEN: 'onboarding_seen',
  LANGUAGE: 'app_language',
  THEME: 'app_theme',
} as const;
