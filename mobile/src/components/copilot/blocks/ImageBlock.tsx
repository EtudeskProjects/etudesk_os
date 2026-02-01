/**
 * ImageBlock Component
 * Displays an image with caption and optional source attribution
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import { Image as ImageIcon, ExternalLink } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../../constants/theme';

interface ImageBlockProps {
  data: {
    url: string;
    alt: string;
    caption?: string;
    source?: string;
  };
}

export const ImageBlock: React.FC<ImageBlockProps> = ({ data }) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

  const handleImageLoad = (event: any) => {
    const { width, height } = event.nativeEvent.source;
    if (width && height) {
      setAspectRatio(width / height);
    }
    setLoading(false);
  };

  const handleImageError = () => {
    setLoading(false);
    setError(true);
  };

  const handleSourcePress = async () => {
    if (!data.source) return;

    try {
      const supported = await Linking.canOpenURL(data.source);
      if (supported) {
        await Linking.openURL(data.source);
      } else {
        Alert.alert('Erreur', 'Impossible d\'ouvrir le lien');
      }
    } catch (err) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'ouverture du lien');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Image */}
      <View style={[styles.imageContainer, { backgroundColor: colors.gray100 }]}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {error ? (
          <View style={styles.errorContainer}>
            <ImageIcon
              size={ICON.size.xxl}
              color={colors.textTertiary}
              strokeWidth={ICON.strokeWidth}
            />
            <Text style={[styles.errorText, { color: colors.textTertiary }]}>
              Impossible de charger l'image
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri: data.url }}
            style={[styles.image, { aspectRatio }]}
            resizeMode="contain"
            onLoad={handleImageLoad}
            onError={handleImageError}
            accessibilityLabel={data.alt}
          />
        )}
      </View>

      {/* Caption and Source */}
      {(data.caption || data.source) && (
        <View style={styles.footer}>
          {data.caption && (
            <Text style={[styles.caption, { color: colors.textSecondary }]}>
              {data.caption}
            </Text>
          )}

          {data.source && (
            <TouchableOpacity
              style={styles.sourceButton}
              onPress={handleSourcePress}
              activeOpacity={0.7}
            >
              <ExternalLink
                size={ICON.size.xs}
                color={colors.primary}
                strokeWidth={ICON.strokeWidth}
              />
              <Text style={[styles.sourceText, { color: colors.primary }]} numberOfLines={1}>
                {data.source}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    overflow: 'hidden',
    marginVertical: SPACING.sm,
  },
  imageContainer: {
    width: '100%',
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  image: {
    width: '100%',
  },
  footer: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  caption: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  sourceText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    flex: 1,
  },
});

export default ImageBlock;
