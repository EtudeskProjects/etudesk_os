import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Compass, MapPin, Navigation } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../contexts/I18nContext';
import { BORDER, OPACITY, SPACING, TYPOGRAPHY, withOpacity } from '../../constants/theme';
import { MAPBOX_CONFIG } from '../../constants/config';
import { buildMapboxStaticMapUrl, getMapPoints } from '../../utils/mapEntity';

interface MapEntityCardProps {
  data: Record<string, any>;
  title?: string;
  subtitle?: string;
  onPress: () => void;
}

export function MapEntityCard({ data, title, subtitle, onPress }: MapEntityCardProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [previewError, setPreviewError] = useState(false);

  const points = useMemo(() => getMapPoints(data), [data]);
  const previewUrl = useMemo(() => {
    if (previewError) return null;
    return buildMapboxStaticMapUrl({
      raw: data,
      token: MAPBOX_CONFIG.ACCESS_TOKEN,
    });
  }, [data, previewError]);

  const pointCount = points.length;
  const fallbackLocation = [data.address || data.location || data.city, data.country].filter(Boolean).join(', ');
  const locationText = subtitle || points[0]?.subtitle || fallbackLocation;

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title || t('copilot.entity.maps')}
    >
      <View style={[styles.mapFrame, { backgroundColor: colors.gray100 }]}>
        {previewUrl ? (
          <Image source={{ uri: previewUrl }} style={styles.mapImage} resizeMode="cover" onError={() => setPreviewError(true)} />
        ) : (
          <View style={[styles.mapFallback, { backgroundColor: withOpacity(colors.success, OPACITY[10]) }]}>
            <Compass size={22} color={colors.success} />
          </View>
        )}

        <View style={[styles.mapBadge, { backgroundColor: withOpacity(colors.gray900, OPACITY[80]) }]}>
          <Compass size={11} color={colors.success} />
          <Text style={styles.mapBadgeText}>Mapbox</Text>
        </View>

        {pointCount > 1 ? (
          <View style={[styles.countBadge, { backgroundColor: withOpacity(colors.gray900, OPACITY[80]) }]}>
            <Text style={styles.countBadgeText}>{pointCount}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.typeLabel, { color: colors.success }]}>{t('copilot.entity.maps')}</Text>
          <View style={[styles.actionPill, { borderColor: colors.borderColor, backgroundColor: withOpacity(colors.success, OPACITY[8]) }]}>
            <Navigation size={14} color={colors.success} />
          </View>
        </View>

        {title ? (
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}

        {locationText ? (
          <View style={styles.locationRow}>
            <MapPin size={12} color={colors.textSecondary} />
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
              {locationText}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: BORDER.radius.md,
    marginVertical: SPACING.xs,
    overflow: 'hidden',
  },
  mapFrame: {
    height: 148,
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    borderRadius: BORDER.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapBadgeText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  countBadge: {
    position: 'absolute',
    right: SPACING.sm,
    bottom: SPACING.sm,
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  content: {
    padding: SPACING.sm,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  typeLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  actionPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDER.width.thin,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  subtitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 16,
  },
});

export default MapEntityCard;
