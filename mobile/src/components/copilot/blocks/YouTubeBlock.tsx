/**
 * YouTubeBlock Component
 * YouTube video: thumbnail with inline play via WebView
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
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

const buildPlayerHTML = (videoId: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <style>*{margin:0;padding:0;overflow:hidden;background:#000}iframe{width:100%;height:100%;border:0}</style>
</head>
<body>
  <iframe
    src="https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&origin=https://etudesk.com"
    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
    allowfullscreen
  ></iframe>
</body>
</html>`;

export const YouTubeBlock: React.FC<YouTubeBlockProps> = ({ data }) => {
  const { colors } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);

  const thumbnailUrl = `https://img.youtube.com/vi/${data.videoId}/mqdefault.jpg`;
  const playerHeight = (Dimensions.get('window').width - SPACING.lg * 2) * (9 / 16);

  if (isPlaying) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
        <View style={[styles.playerContainer, { height: playerHeight }]}>
          <WebView
            source={{ html: buildPlayerHTML(data.videoId), baseUrl: 'https://etudesk.com' }}
            style={[styles.webview, { backgroundColor: '#000' }]}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            originWhitelist={['*']}
          />
        </View>
        <View style={styles.content}>
          <View style={styles.header}>
            <Youtube size={ICON.size.md} color={colors.error} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
              {data.title}
            </Text>
          </View>
          {data.channelName && (
            <Text style={[styles.channelName, { color: colors.textSecondary }]}>{data.channelName}</Text>
          )}
          {data.description && (
            <Text style={[styles.description, { color: colors.textTertiary }]} numberOfLines={3}>
              {data.description}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <TouchableOpacity
        style={styles.thumbnailContainer}
        onPress={() => setIsPlaying(true)}
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

      <View style={styles.content}>
        <View style={styles.header}>
          <Youtube size={ICON.size.md} color={colors.error} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
            {data.title}
          </Text>
        </View>
        {data.channelName && (
          <Text style={[styles.channelName, { color: colors.textSecondary }]}>{data.channelName}</Text>
        )}
        {data.description && (
          <Text style={[styles.description, { color: colors.textTertiary }]} numberOfLines={3}>
            {data.description}
          </Text>
        )}
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
  },
  playerContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    width: '100%',
  },
});

export default YouTubeBlock;
