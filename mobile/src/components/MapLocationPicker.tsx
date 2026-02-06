/**
 * MapLocationPicker Component
 * Displays an interactive map using Leaflet/OpenStreetMap in a WebView
 * Works in Expo Go without native dependencies
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { MapPin, Navigation, X } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../contexts/I18nContext';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationResult {
  coordinates: Coordinates;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  address?: string;
}

interface MapLocationPickerProps {
  initialCoordinates?: Coordinates;
  onLocationSelect: (location: LocationResult) => void;
  onClose?: () => void;
  height?: number;
  /** Mode inline: appelle onLocationSelect automatiquement au clic */
  inline?: boolean;
}

// Reverse geocode using Nominatim (OpenStreetMap)
const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<Partial<LocationResult>> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=fr`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Etudesk Mobile App',
      },
    });

    if (!response.ok) {
      return {};
    }

    const data = await response.json();

    if (!data.address) {
      return {};
    }

    const address = data.display_name || '';
    const city = data.address.city || data.address.town || data.address.village || data.address.municipality || '';
    const region = data.address.state || data.address.region || '';
    const country = data.address.country || '';
    const countryCode = data.address.country_code?.toUpperCase() || '';

    return { country, countryCode, region, city, address };
  } catch (error) {
    return {};
  }
};

// HTML for the Leaflet map - Theme: Luxe Africain
const getMapHTML = (lat: number, lng: number, hasMarker: boolean, primaryColor: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }

    /* Hide all Leaflet branding */
    .leaflet-control-attribution,
    .leaflet-control-zoom,
    .leaflet-control-layers {
      display: none !important;
    }

    /* Custom marker - Luxe Africain style */
    .custom-marker {
      background: none;
      border: none;
    }
    .marker-pin {
      width: 32px;
      height: 32px;
      background: ${primaryColor};
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      position: relative;
      border: 2px solid #FFFFFF;
    }
    .marker-pin::after {
      content: '';
      width: 12px;
      height: 12px;
      background: #FFFFFF;
      border-radius: 50%;
      position: absolute;
      top: 8px;
      left: 8px;
    }

    /* Pulse animation for marker */
    .marker-pulse {
      width: 40px;
      height: 40px;
      background: ${primaryColor}20;
      border-radius: 50%;
      position: absolute;
      top: -4px;
      left: -4px;
      animation: pulse 2s ease-out infinite;
    }
    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(2); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Initialize map without any controls
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([${lat}, ${lng}], 14);

    // Use CartoDB Positron for a clean, minimal look
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    // Custom marker icon
    var markerIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div class="marker-pulse"></div><div class="marker-pin"></div>',
      iconSize: [32, 42],
      iconAnchor: [16, 42]
    });

    var marker = ${hasMarker} ? L.marker([${lat}, ${lng}], { icon: markerIcon }).addTo(map) : null;

    // Handle map click
    map.on('click', function(e) {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;

      if (marker) {
        marker.setLatLng(e.latlng);
      } else {
        marker = L.marker(e.latlng, { icon: markerIcon }).addTo(map);
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'locationSelected',
        latitude: lat,
        longitude: lng
      }));
    });

    // Function to update marker position from React Native
    function setMarkerPosition(lat, lng) {
      var latlng = L.latLng(lat, lng);
      if (marker) {
        marker.setLatLng(latlng);
      } else {
        marker = L.marker(latlng, { icon: markerIcon }).addTo(map);
      }
      map.setView(latlng, 15, { animate: true });

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'locationSelected',
        latitude: lat,
        longitude: lng
      }));
    }

    // Notify that map is ready
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
  </script>
</body>
</html>
`;

export function MapLocationPicker({
  initialCoordinates,
  onLocationSelect,
  onClose,
  height = 300,
  inline = false,
}: MapLocationPickerProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Default center (Abidjan, Cote d'Ivoire)
  const defaultCenter: Coordinates = {
    latitude: 5.3600,
    longitude: -4.0083,
  };

  const centerCoords = initialCoordinates || defaultCenter;

  // Request location permission on mount
  useEffect(() => {
    requestLocationPermission();
  }, []);

  // Timeout fallback to hide loading if map doesn't respond
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setMapReady(true);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted' && !initialCoordinates) {
        getCurrentLocation();
      }
    } catch (error) {
      // Silent fail
    }
  };

  const getCurrentLocation = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          t('map.permissionDenied'),
          t('map.permissionMessage')
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords: Coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      // Update map marker
      if (webViewRef.current && mapReady) {
        webViewRef.current.injectJavaScript(`
          setMarkerPosition(${coords.latitude}, ${coords.longitude});
          true;
        `);
      }
    } catch (error) {
      Alert.alert(
        t('map.locationError'),
        t('map.locationErrorMessage')
      );
    } finally {
      setIsLocating(false);
    }
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'mapReady') {
        setMapReady(true);
        setIsLoading(false);
      } else if (data.type === 'locationSelected') {
        const coords: Coordinates = {
          latitude: data.latitude,
          longitude: data.longitude,
        };

        // Reverse geocode
        const geoResult = await reverseGeocode(coords.latitude, coords.longitude);
        const locationResult: LocationResult = {
          coordinates: coords,
          ...geoResult,
        };

        setSelectedLocation(locationResult);

        // Toujours notifier le parent au clic
        onLocationSelect(locationResult);
      }
    } catch (error) {
      // Silent fail
    }
  };

  return (
    <View style={[styles.container, { height, borderColor: colors.borderColor }]}>
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: getMapHTML(centerCoords.latitude, centerCoords.longitude, !!initialCoordinates, colors.primary) }}
          style={[styles.map, { backgroundColor: colors.gray100 }]}
          onMessage={handleWebViewMessage}
          onLoad={() => {
            // Fallback: if mapReady message wasn't received, hide loading after WebView loads
            setTimeout(() => {
              if (isLoading) {
                setIsLoading(false);
                setMapReady(true);
              }
            }, 1000);
          }}
          onError={() => {
            setIsLoading(false);
            setMapReady(true);
          }}
          scrollEnabled={false}
          bounces={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          originWhitelist={['*']}
          mixedContentMode="compatibility"
        />

        {isLoading && (
          <View style={[styles.loadingOverlay, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              {t('map.loadingMap')}
            </Text>
          </View>
        )}

        {onClose && (
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
            onPress={onClose}
          >
            <X size={18} color={colors.textPrimary} strokeWidth={1.5} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.myLocationButton, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
          onPress={getCurrentLocation}
          disabled={isLocating}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Navigation size={18} color={colors.primary} strokeWidth={1.5} />
          )}
        </TouchableOpacity>
      </View>

      {/* Affichage de l'adresse sélectionnée */}
      {selectedLocation && !inline && (
        <View style={[styles.locationInfo, { backgroundColor: colors.gray50, borderTopColor: colors.borderColor }]}>
          <View style={styles.locationTextContainer}>
            <MapPin size={16} color={colors.primary} strokeWidth={1.5} />
            <Text style={[styles.locationText, { color: colors.textPrimary }]} numberOfLines={2}>
              {selectedLocation.address ||
               [selectedLocation.city, selectedLocation.region, selectedLocation.country]
                 .filter(Boolean)
                 .join(', ') ||
               t('map.selectedPosition')}
            </Text>
          </View>
        </View>
      )}

      {/* Instructions - seulement en mode non-inline */}
      {!selectedLocation && !isLoading && !inline && (
        <View style={[styles.instructions, { backgroundColor: colors.gray50, borderTopColor: colors.borderColor }]}>
          <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
            {t('map.tapToSelect')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
  },

  mapContainer: {
    flex: 1,
    position: 'relative',
  },

  map: {
    flex: 1,
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },

  closeButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 36,
    height: 36,
    borderRadius: BORDER.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  myLocationButton: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    width: 44,
    height: 44,
    borderRadius: BORDER.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderTopWidth: 1,
    gap: SPACING.md,
  },

  locationTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  locationText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },

  confirmButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.sm,
  },

  confirmButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  instructions: {
    padding: SPACING.md,
    alignItems: 'center',
    borderTopWidth: 1,
  },

  instructionsText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },
});

export default MapLocationPicker;
