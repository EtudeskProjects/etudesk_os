import { useState, useCallback } from 'react';
import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { COUNTRIES, getRegionsByCountry, getCommunesByRegion } from '../constants/location';
import { useTranslation } from '../contexts/I18nContext';
import { alertsGlobal } from '../contexts/AlertContext';

interface GeolocationResult {
  country: string;
  region: string;
  city: string;
  countryCode: string;
  regionCode: string;
  cityCode: string;
}

interface UseGeolocationReturn {
  isLoading: boolean;
  error: string | null;
  getCurrentLocation: () => Promise<GeolocationResult | null>;
}

// Map country names to our country codes
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'Côte d\'Ivoire': 'CI',
  'Ivory Coast': 'CI',
  'Senegal': 'SN',
  'Sénégal': 'SN',
  'Mali': 'ML',
  'Burkina Faso': 'BF',
  'Guinea': 'GN',
  'Guinée': 'GN',
  'Benin': 'BJ',
  'Bénin': 'BJ',
  'Togo': 'TG',
  'Niger': 'NE',
  'Cameroon': 'CM',
  'Cameroun': 'CM',
  'Ghana': 'GH',
  'Nigeria': 'NG',
  'Nigéria': 'NG',
  'Morocco': 'MA',
  'Maroc': 'MA',
  'Tunisia': 'TN',
  'Tunisie': 'TN',
  'France': 'FR',
  'Canada': 'CA',
  'United States': 'US',
  'États-Unis': 'US',
};

// Find the best matching region from our data based on geocoded region name
const findMatchingRegion = (countryCode: string, geocodedRegion: string): string => {
  const regions = getRegionsByCountry(countryCode);
  if (regions.length === 0) return '';

  const normalizedGeocoded = geocodedRegion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Try exact match first
  const exactMatch = regions.find(r =>
    r.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalizedGeocoded
  );
  if (exactMatch) return exactMatch.id;

  // Try partial match
  const partialMatch = regions.find(r => {
    const normalizedLabel = r.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedLabel.includes(normalizedGeocoded) || normalizedGeocoded.includes(normalizedLabel);
  });
  if (partialMatch) return partialMatch.id;

  return '';
};

// Find the best matching city/commune from our data
const findMatchingCity = (countryCode: string, regionCode: string, geocodedCity: string): string => {
  const cities = getCommunesByRegion(countryCode, regionCode);
  if (cities.length === 0) return '';

  const normalizedGeocoded = geocodedCity.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Try exact match first
  const exactMatch = cities.find(c =>
    c.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalizedGeocoded
  );
  if (exactMatch) return exactMatch.id;

  // Try partial match
  const partialMatch = cities.find(c => {
    const normalizedLabel = c.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedLabel.includes(normalizedGeocoded) || normalizedGeocoded.includes(normalizedLabel);
  });
  if (partialMatch) return partialMatch.id;

  return '';
};

export function useGeolocation(): UseGeolocationReturn {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const getCurrentLocation = useCallback(async (): Promise<GeolocationResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if location services are enabled
      const serviceEnabled = await Location.hasServicesEnabledAsync();
      if (!serviceEnabled) {
        void alertsGlobal.showAlert({
          title: t('geolocation.servicesDisabled'),
          message: t('geolocation.enableServices'),
          buttons: [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('geolocation.settings'), onPress: openSettings },
          ],
        });
        setIsLoading(false);
        return null;
      }

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        void alertsGlobal.showAlert({
          title: t('geolocation.permissionDenied'),
          message: t('geolocation.permissionMessage'),
          buttons: [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('geolocation.settings'), onPress: openSettings },
          ],
        });
        setIsLoading(false);
        return null;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      // Use expo-location for reverse geocoding
      const [geocodeResult] = await Location.reverseGeocodeAsync({ latitude, longitude });

      if (!geocodeResult) {
        setError(t('geolocation.addressError'));
        setIsLoading(false);
        return null;
      }

      const countryName = geocodeResult.country || '';
      const countryCode = COUNTRY_NAME_TO_CODE[countryName] || '';
      const geocodedRegion = geocodeResult.region || geocodeResult.subregion || '';
      const geocodedCity = geocodeResult.city || geocodeResult.subregion || '';


      // Check if we support this country
      const supportedCountry = COUNTRIES.find(c => c.id === countryCode);
      if (!supportedCountry) {
        void alertsGlobal.alert(
          t('geolocation.unsupportedCountry'),
          t('geolocation.unsupportedCountryMessage', { country: countryName })
        );
        setIsLoading(false);
        return null;
      }

      const regionCode = findMatchingRegion(countryCode, geocodedRegion);
      const cityCode = regionCode ? findMatchingCity(countryCode, regionCode, geocodedCity) : '';

      const result: GeolocationResult = {
        country: countryName,
        region: geocodedRegion,
        city: geocodedCity,
        countryCode,
        regionCode,
        cityCode,
      };

      setIsLoading(false);
      return result;

    } catch (err: any) {
      if (__DEV__) console.error('Geolocation error:', err);

      if (err.code === 'ERR_LOCATION_TIMEOUT') {
        setError(t('geolocation.timeout'));
      } else {
        setError(t('geolocation.genericError'));
      }

      void alertsGlobal.alert(t('geolocation.errorTitle'), t('geolocation.errorMessage'));

      setIsLoading(false);
      return null;
    }
  }, []);

  return {
    isLoading,
    error,
    getCurrentLocation,
  };
}
