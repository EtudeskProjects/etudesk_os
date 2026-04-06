/**
 * YouTubeBlock Component
 * YouTube video: thumbnail with inline play via WebView
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import { Play, Youtube } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, STATIC_COLORS } from '../../../constants/theme';
import { getLabelDirect } from '../../../utils/labels';


interface YouTubeBlockProps {
  data: {
    videoId: string;
    title: string;
    channelName?: string;
    description?: string;
  };
}

function sanitizeText(value: unknown, max = 240): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

const buildPlayerHTML = (videoId: string, bgColor: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <style>*{margin:0;padding:0;overflow:hidden;background:${bgColor}}iframe{width:100%;height:100%;border:0}</style>
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
  const videoId = sanitizeText(data.videoId, 32)?.replace(/[^a-zA-Z0-9_-]/g, '') || '';
  const title = sanitizeText(data.title, 120) || '';
  const channelName = sanitizeText(data.channelName, 72) || '';
  const description = sanitizeText(data.description, 220) || '';

  if (!videoId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{getLabelDirect('noData')}</Text>
      </View>
    );
  }

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  const playerHeight = (Dimensions.get('window').width - SPACING.lg * 2) * (9 / 16);

  if (isPlaying) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
        <View style={[styles.playerContainer, { height: playerHeight }]}>
          <WebView
            source={{ html: buildPlayerHTML(videoId, STATIC_COLORS.black), baseUrl: 'https://etudesk.com' }}
            style={[styles.webview, { backgroundColor: STATIC_COLORS.black }]}
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
              {title || 'YouTube'}
            </Text>
          </View>
          {channelName && (
            <Text style={[styles.channelName, { color: colors.textSecondary }]}>{channelName}</Text>
          )}
          {description && description !== title && description !== channelName && (
            <Text style={[styles.description, { color: colors.textTertiary }]} numberOfLines={3}>
              {description}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <Pressable
        style={styles.thumbnailContainer}
        onPress={() => setIsPlaying(true)}
        accessibilityRole="button"
        accessibilityLabel={`Lire: ${title || 'YouTube'}`}
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
      </Pressable>

      <View style={styles.content}>
        <View style={styles.header}>
          <Youtube size={ICON.size.md} color={colors.error} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
            {title || 'YouTube'}
          </Text>
        </View>
        {channelName && (
          <Text style={[styles.channelName, { color: colors.textSecondary }]}>{channelName}</Text>
        )}
        {description && description !== title && description !== channelName && (
          <Text style={[styles.description, { color: colors.textTertiary }]} numberOfLines={3}>
            {description}
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
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    padding: SPACING.md,
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
