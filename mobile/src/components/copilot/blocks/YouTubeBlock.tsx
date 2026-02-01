/**
 * YouTubeBlock Component
 * YouTube video preview with thumbnail and play button
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Alert } from 'react-native';
import { Play, Youtube } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../../constants/theme';

interface YouTubeBlockProps {
  data: {
    videoId: string;
    title: string;
    channelName?: string;
    description?: string;
  };
}

export const YouTubeBlock: React.FC<YouTubeBlockProps> = ({ data }) => {
  const { colors } = useTheme();

  const thumbnailUrl = `https://img.youtube.com/vi/${data.videoId}/mqdefault.jpg`;
  const videoUrl = `https://www.youtube.com/watch?v=${data.videoId}`;

  const handlePlayVideo = async () => {
    try {
      const supported = await Linking.canOpenURL(videoUrl);
      if (supported) {
        await Linking.openURL(videoUrl);
      } else {
        Alert.alert('Erreur', 'Impossible d\'ouvrir la vidéo YouTube');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'ouverture de la vidéo');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Thumbnail */}
      <TouchableOpacity
        style={styles.thumbnailContainer}
        onPress={handlePlayVideo}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <View style={[styles.playOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.playButton, { backgroundColor: colors.error }]}>
            <Play
              size={ICON.size.xl}
              color={colors.white}
              fill={colors.white}
              strokeWidth={0}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Youtube
            size={ICON.size.md}
            color={colors.error}
            strokeWidth={ICON.strokeWidth}
          />
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
            {data.title}
          </Text>
        </View>

        {data.channelName && (
          <Text style={[styles.channelName, { color: colors.textSecondary }]}>
            {data.channelName}
          </Text>
        )}

        {data.description && (
          <Text style={[styles.description, { color: colors.textTertiary }]} numberOfLines={3}>
            {data.description}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.watchButton, { backgroundColor: colors.error }]}
          onPress={handlePlayVideo}
          activeOpacity={0.8}
        >
          <Play
            size={ICON.size.sm}
            color={colors.white}
            fill={colors.white}
            strokeWidth={0}
          />
          <Text style={[styles.watchButtonText, { color: colors.white }]}>
            Regarder sur YouTube
          </Text>
        </TouchableOpacity>
      </View>
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
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: BORDER.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.snug,
    flex: 1,
  },
  channelName: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xs,
  },
  description: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.md,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER.radius.md,
  },
  watchButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
});

export default YouTubeBlock;
