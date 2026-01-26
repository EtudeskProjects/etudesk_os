import { useState, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { COUNTRIES, getRegionsByCountry, getCommunesByRegion } from '../constants/location';
import { MAPBOX_CONFIG } from '../constants/config';

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

// Mapbox reverse geocoding for better accuracy
interface MapboxFeature {
  place_type: string[];
  text: string;
  properties: {
    short_code?: string;
  };
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
}

interface MapboxResponse {
  features: MapboxFeature[];
}

const reverseGeocodeWithMapbox = async (
  latitude: number,
  longitude: number
): Promise<{ country: string; countryCode: string; region: string; city: string } | null> => {
  try {
    const url = `${MAPBOX_CONFIG.GEOCODING_URL}/${longitude},${latitude}.json?access_token=${MAPBOX_CONFIG.ACCESS_TOKEN}&types=place,region,country&language=fr`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error('Mapbox geocoding error:', response.status);
      return null;
    }

    const data: MapboxResponse = await response.json();

    if (!data.features || data.features.length === 0) {
      return null;
    }

    let country = '';
    let countryCode = '';
    let region = '';
    let city = '';

    // Parse features and context
    for (const feature of data.features) {
      if (feature.place_type.includes('place')) {
        city = feature.text;
      }
      if (feature.place_type.includes('region')) {
        region = feature.text;
      }
      if (feature.place_type.includes('country')) {
        country = feature.text;
        if (feature.properties.short_code) {
          countryCode = feature.properties.short_code.toUpperCase();
        }
      }

      // Also check context for additional info
      if (feature.context) {
        for (const ctx of feature.context) {
          if (ctx.id.startsWith('region')) {
            region = ctx.text;
          }
          if (ctx.id.startsWith('country')) {
            country = ctx.text;
            if (ctx.short_code) {
              countryCode = ctx.short_code.toUpperCase();
            }
          }
          if (ctx.id.startsWith('place')) {
            city = ctx.text;
          }
        }
      }
    }

    return { country, countryCode, region, city };
  } catch (error) {
    console.error('Mapbox reverse geocoding error:', error);
    return null;
  }
};

export function useGeolocation(): UseGeolocationReturn {
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
        Alert.alert(
          'Services de localisation désactivés',
          'Veuillez activer les services de localisation dans les paramètres de votre appareil.',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Paramètres', onPress: openSettings },
          ]
        );
        setIsLoading(false);
        return null;
      }

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'Etudesk a besoin de votre permission pour accéder à votre localisation.',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Paramètres', onPress: openSettings },
          ]
        );
        setIsLoading(false);
        return null;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      // Try Mapbox first for better accuracy, fallback to expo-location
      let countryName = '';
      let countryCode = '';
      let geocodedRegion = '';
      let geocodedCity = '';

      const mapboxResult = await reverseGeocodeWithMapbox(latitude, longitude);

      if (mapboxResult) {
        countryName = mapboxResult.country;
        countryCode = mapboxResult.countryCode || COUNTRY_NAME_TO_CODE[countryName] || '';
        geocodedRegion = mapboxResult.region;
        geocodedCity = mapboxResult.city;
        console.log('[Geolocation] Mapbox result:', mapboxResult);
      } else {
        // Fallback to expo-location
        console.log('[Geolocation] Mapbox failed, using expo-location fallback');
        const [geocodeResult] = await Location.reverseGeocodeAsync({ latitude, longitude });

        if (!geocodeResult) {
          setError('Impossible de déterminer votre adresse');
          setIsLoading(false);
          return null;
        }

        countryName = geocodeResult.country || '';
        countryCode = COUNTRY_NAME_TO_CODE[countryName] || '';
        geocodedRegion = geocodeResult.region || geocodeResult.subregion || '';
        geocodedCity = geocodeResult.city || geocodeResult.subregion || '';
      }

      // Check if we support this country
      const supportedCountry = COUNTRIES.find(c => c.id === countryCode);
      if (!supportedCountry) {
        Alert.alert(
          'Pays non supporté',
          `Nous ne supportons pas encore ${countryName}. Veuillez sélectionner votre localisation manuellement.`
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

      console.log('[Geolocation] Final result:', result);
      setIsLoading(false);
      return result;

    } catch (err: any) {
      console.error('Geolocation error:', err);

      if (err.code === 'ERR_LOCATION_TIMEOUT') {
        setError('La localisation a pris trop de temps. Veuillez réessayer.');
      } else {
        setError('Une erreur est survenue lors de la récupération de votre position.');
      }

      Alert.alert(
        'Erreur de localisation',
        'Impossible de récupérer votre position. Veuillez réessayer ou sélectionner votre localisation manuellement.'
      );

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
