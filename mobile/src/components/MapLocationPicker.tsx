/**
 * MapLocationPicker Component
 * Displays a Mapbox map for location selection with geocoding
 * Falls back to a simple selector when native code is unavailable (Expo Go)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { MapPin, Navigation, X, AlertCircle } from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER } from '../constants/theme';
import { MAPBOX_CONFIG } from '../constants/config';
import { useTheme } from '../hooks/useTheme';

// Try to import Mapbox - will fail in Expo Go
let MapboxGL: any = null;
let isMapboxAvailable = false;

try {
  MapboxGL = require('@rnmapbox/maps').default;
  MapboxGL.setAccessToken(MAPBOX_CONFIG.ACCESS_TOKEN);
  isMapboxAvailable = true;
} catch (error) {
  console.log('Mapbox not available (expected in Expo Go)');
  isMapboxAvailable = false;
}

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
}

// Reverse geocode using Mapbox API
const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<Partial<LocationResult>> => {
  try {
    const url = `${MAPBOX_CONFIG.GEOCODING_URL}/${longitude},${latitude}.json?access_token=${MAPBOX_CONFIG.ACCESS_TOKEN}&types=place,region,country&language=fr`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('Mapbox geocoding error:', response.status);
      return {};
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return {};
    }

    let country = '';
    let countryCode = '';
    let region = '';
    let city = '';
    let address = '';

    // Get the first feature as the main address
    if (data.features[0]) {
      address = data.features[0].place_name || '';
    }

    // Parse features and context
    for (const feature of data.features) {
      if (feature.place_type?.includes('place')) {
        city = feature.text;
      }
      if (feature.place_type?.includes('region')) {
        region = feature.text;
      }
      if (feature.place_type?.includes('country')) {
        country = feature.text;
        if (feature.properties?.short_code) {
          countryCode = feature.properties.short_code.toUpperCase();
        }
      }

      // Also check context for additional info
      if (feature.context) {
        for (const ctx of feature.context) {
          if (ctx.id?.startsWith('region')) {
            region = ctx.text;
          }
          if (ctx.id?.startsWith('country')) {
            country = ctx.text;
            if (ctx.short_code) {
              countryCode = ctx.short_code.toUpperCase();
            }
          }
          if (ctx.id?.startsWith('place')) {
            city = ctx.text;
          }
        }
      }
    }

    return { country, countryCode, region, city, address };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return {};
  }
};

// Fallback component when Mapbox is not available
function MapFallback({
  onLocationSelect,
  onClose,
  height,
}: MapLocationPickerProps) {
  const { colors } = useTheme();
  const [isLocating, setIsLocating] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);

  const getCurrentLocation = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission refusee',
          'Nous avons besoin de votre permission pour acceder a votre position.'
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

      // Reverse geocode
      const geoResult = await reverseGeocode(coords.latitude, coords.longitude);
      const locationResult: LocationResult = {
        coordinates: coords,
        ...geoResult,
      };
      setSelectedLocation(locationResult);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert(
        'Erreur de localisation',
        'Impossible de recuperer votre position.'
      );
    } finally {
      setIsLocating(false);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation);
    }
  };

  return (
    <View style={[styles.fallbackContainer, { height, backgroundColor: colors.gray100 }]}>
      <View style={styles.fallbackContent}>
        <AlertCircle size={48} color={colors.gray400} strokeWidth={1.5} />
        <Text style={[styles.fallbackTitle, { color: colors.textPrimary }]}>
          Carte non disponible
        </Text>
        <Text style={[styles.fallbackText, { color: colors.textSecondary }]}>
          La carte interactive n'est pas disponible dans Expo Go.{'\n'}
          Utilisez votre position actuelle.
        </Text>

        <TouchableOpacity
          style={[styles.fallbackButton, { backgroundColor: colors.primary }]}
          onPress={getCurrentLocation}
          disabled={isLocating}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Navigation size={20} color={COLORS.white} strokeWidth={2} />
              <Text style={styles.fallbackButtonText}>Utiliser ma position</Text>
            </>
          )}
        </TouchableOpacity>

        {selectedLocation && (
          <View style={[styles.selectedBox, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
            <MapPin size={16} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.selectedText, { color: colors.textPrimary }]} numberOfLines={2}>
              {selectedLocation.address ||
               [selectedLocation.city, selectedLocation.region, selectedLocation.country]
                 .filter(Boolean)
                 .join(', ') ||
               `${selectedLocation.coordinates.latitude.toFixed(4)}, ${selectedLocation.coordinates.longitude.toFixed(4)}`}
            </Text>
          </View>
        )}

        {selectedLocation && (
          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: colors.primary }]}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmButtonText}>Confirmer cette position</Text>
          </TouchableOpacity>
        )}
      </View>

      {onClose && (
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: colors.surface }]}
          onPress={onClose}
        >
          <X size={20} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// Main component with Mapbox
function MapLocationPickerWithMapbox({
  initialCoordinates,
  onLocationSelect,
  onClose,
  height = 300,
}: MapLocationPickerProps) {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(
    initialCoordinates || null
  );
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const cameraRef = useRef<any>(null);

  // Default center (Abidjan, Cote d'Ivoire)
  const defaultCenter: Coordinates = {
    latitude: 5.3600,
    longitude: -4.0083,
  };

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted' && !initialCoordinates) {
        getCurrentLocation();
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Permission error:', error);
      setIsLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setIsLocating(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newCoords: Coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCoordinates(newCoords);

      cameraRef.current?.setCamera({
        centerCoordinate: [newCoords.longitude, newCoords.latitude],
        zoomLevel: 14,
        animationDuration: 1000,
      });

      const geoResult = await reverseGeocode(newCoords.latitude, newCoords.longitude);
      const locationResult: LocationResult = {
        coordinates: newCoords,
        ...geoResult,
      };
      setSelectedLocation(locationResult);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert(
        'Erreur de localisation',
        'Impossible de recuperer votre position. Vous pouvez selectionner manuellement sur la carte.'
      );
    } finally {
      setIsLoading(false);
      setIsLocating(false);
    }
  };

  const handleMapPress = async (event: any) => {
    const { geometry } = event;
    if (geometry?.coordinates) {
      const [longitude, latitude] = geometry.coordinates;
      const newCoords: Coordinates = { latitude, longitude };

      setCoordinates(newCoords);

      const geoResult = await reverseGeocode(latitude, longitude);
      const locationResult: LocationResult = {
        coordinates: newCoords,
        ...geoResult,
      };
      setSelectedLocation(locationResult);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation);
    } else if (coordinates) {
      onLocationSelect({ coordinates });
    }
  };

  const centerCoords = coordinates || initialCoordinates || defaultCenter;

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.mapContainer}>
        <MapboxGL.MapView
          style={styles.map}
          styleURL={MapboxGL.StyleURL.Street}
          onPress={handleMapPress}
          logoEnabled={false}
          attributionEnabled={false}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            zoomLevel={12}
            centerCoordinate={[centerCoords.longitude, centerCoords.latitude]}
            animationDuration={0}
          />

          <MapboxGL.UserLocation visible animated />

          {coordinates && (
            <MapboxGL.PointAnnotation
              id="selected-location"
              coordinate={[coordinates.longitude, coordinates.latitude]}
            >
              <View style={styles.markerContainer}>
                <MapPin size={32} color={colors.primary} fill={colors.primary} strokeWidth={1.5} />
              </View>
            </MapboxGL.PointAnnotation>
          )}
        </MapboxGL.MapView>

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Chargement de la carte...
            </Text>
          </View>
        )}

        {onClose && (
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.surface }]}
            onPress={onClose}
          >
            <X size={20} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.myLocationButton, { backgroundColor: colors.surface }]}
          onPress={getCurrentLocation}
          disabled={isLocating}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Navigation size={20} color={colors.primary} strokeWidth={2} />
          )}
        </TouchableOpacity>
      </View>

      {selectedLocation && (
        <View style={[styles.locationInfo, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
          <View style={styles.locationTextContainer}>
            <MapPin size={16} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.locationText, { color: colors.textPrimary }]} numberOfLines={2}>
              {selectedLocation.address ||
               [selectedLocation.city, selectedLocation.region, selectedLocation.country]
                 .filter(Boolean)
                 .join(', ') ||
               'Position selectionnee'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: colors.primary }]}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmButtonText}>Confirmer</Text>
          </TouchableOpacity>
        </View>
      )}

      {!selectedLocation && !isLoading && (
        <View style={[styles.instructions, { backgroundColor: colors.gray100 }]}>
          <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
            Touchez la carte pour selectionner une position
          </Text>
        </View>
      )}
    </View>
  );
}

// Export the appropriate component based on Mapbox availability
export function MapLocationPicker(props: MapLocationPickerProps) {
  if (isMapboxAvailable && MapboxGL) {
    return <MapLocationPickerWithMapbox {...props} />;
  }
  return <MapFallback {...props} />;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  closeButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  myLocationButton: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
  },

  confirmButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.sm,
  },

  confirmButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  instructions: {
    padding: SPACING.md,
    alignItems: 'center',
  },

  instructionsText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },

  // Fallback styles
  fallbackContainer: {
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
    position: 'relative',
  },

  fallbackContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },

  fallbackTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
  },

  fallbackText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },

  fallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER.radius.md,
    marginTop: SPACING.md,
  },

  fallbackButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    borderWidth: 1,
    width: '100%',
    marginTop: SPACING.md,
  },

  selectedText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export default MapLocationPicker;
