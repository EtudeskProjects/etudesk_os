/**
 * ImageBlock Component
 * Displays an image with caption and optional source attribution
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Image as ImageIcon, ExternalLink } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useTranslation } from '../../../contexts/I18nContext';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../../constants/theme';
import { getFullImageUrl } from '../../../utils/image';
import { getLabelDirect } from '../../../utils/labels';
import { showToastGlobal, LoadingShimmer } from '../../ui';

interface ImageBlockProps {
  data: {
    url: string;
    alt: string;
    caption?: string;
    source?: string;
  };
}

function sanitizeText(value: unknown, max = 220): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export const ImageBlock: React.FC<ImageBlockProps> = ({ data }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const safeAlt = sanitizeText(data.alt, 120) || 'image';
  const safeCaption = sanitizeText(data.caption, 180) || '';
  const safeSource = sanitizeText(data.source, 120) || '';

  // Resolve relative URLs (e.g. /uploads/...) to full absolute URLs
  const imageUrl = getFullImageUrl(data.url);
  if (!imageUrl) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
        <Text style={[styles.errorText, { color: colors.textTertiary }]}>{getLabelDirect('noData')}</Text>
      </View>
    );
  }

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
    if (!safeSource) return;

    try {
      await WebBrowser.openBrowserAsync(safeSource);
    } catch (err) {
      showToastGlobal({ type: 'error', title: t('common.error'), message: t('copilotImage.openLinkErrorMessage') });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Image */}
      <View style={[styles.imageContainer, { backgroundColor: colors.gray100 }]}>
        {loading && (
          <View style={styles.loadingContainer}>
            <LoadingShimmer variant="inline" />
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
              {t('copilotImage.loadError')}
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.image, { aspectRatio }]}
            resizeMode="contain"
            onLoad={handleImageLoad}
            onError={handleImageError}
            accessibilityLabel={safeAlt}
          />
        )}
      </View>

      {/* Caption and Source */}
      {(safeCaption || safeSource) && (
        <View style={styles.footer}>
          {safeCaption && (
            <Text style={[styles.caption, { color: colors.textSecondary }]}>
              {safeCaption}
            </Text>
          )}

          {safeSource && safeSource !== safeCaption && (
            <Pressable
              style={styles.sourceButton}
              onPress={handleSourcePress}
              accessibilityRole="button"
              accessibilityLabel={t('common.openSource')}
            >
              <ExternalLink
                size={ICON.size.xs}
                color={colors.primary}
                strokeWidth={ICON.strokeWidth}
              />
              <Text style={[styles.sourceText, { color: colors.primary }]} numberOfLines={1}>
                {safeSource}
              </Text>
            </Pressable>
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
