import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Linking,
    Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Play, ExternalLink } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface RichTextContentProps {
    content: string;
    onMentionPress?: (username: string) => void;
}

interface ParsedSegment {
    type: 'text' | 'bold' | 'italic' | 'link' | 'mention' | 'youtube';
    content: string;
    url?: string;
    videoId?: string;
}

// YouTube URL patterns
const YOUTUBE_PATTERNS = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:[&\S]*)?/gi,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?\S*)?/gi,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:\?\S*)?/gi,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(?:\?\S*)?/gi,
];

// Generic URL pattern - matches http/https URLs
const URL_PATTERN = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

// WhatsApp-style formatting patterns
const BOLD_PATTERN = /\*([^*]+)\*/g;
const ITALIC_PATTERN = /_([^_]+)_/g;
const STRIKETHROUGH_PATTERN = /~([^~]+)~/g;
const MENTION_PATTERN = /@(\w+(?:\s\w+)?)/g;

// Extract YouTube video ID from URL
const extractYouTubeId = (url: string): string | null => {
    for (const pattern of YOUTUBE_PATTERNS) {
        pattern.lastIndex = 0; // Reset regex state
        const match = pattern.exec(url);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
};

// Check if URL is YouTube
const isYouTubeUrl = (url: string): boolean => {
    return YOUTUBE_PATTERNS.some(pattern => {
        pattern.lastIndex = 0;
        return pattern.test(url);
    });
};

// Get YouTube thumbnail URL
const getYouTubeThumbnail = (videoId: string, quality: 'default' | 'medium' | 'high' | 'maxres' = 'high'): string => {
    const qualityMap = {
        default: 'default',
        medium: 'mqdefault',
        high: 'hqdefault',
        maxres: 'maxresdefault',
    };
    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
};

// YouTube Player Component
const YouTubeEmbed: React.FC<{ videoId: string; onPress?: () => void }> = ({ videoId, onPress }) => {
    const { colors } = useTheme();
    const [isPlaying, setIsPlaying] = useState(false);
    const [thumbnailError, setThumbnailError] = useState(false);

    const screenWidth = Dimensions.get('window').width;
    const playerWidth = screenWidth - (SPACING.lg * 2) - (SPACING.md * 2);
    const playerHeight = playerWidth * (9 / 16); // 16:9 aspect ratio

    const thumbnailUrl = thumbnailError
        ? getYouTubeThumbnail(videoId, 'medium')
        : getYouTubeThumbnail(videoId, 'high');

    const handlePlay = () => {
        setIsPlaying(true);
    };

    const openInYouTube = () => {
        Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`);
    };

    if (isPlaying) {
        return (
            <View style={[styles.youtubeContainer, { height: playerHeight }]}>
                <WebView
                    source={{ uri: `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1` }}
                    style={styles.webview}
                    allowsFullscreenVideo
                    allowsInlineMediaPlayback
                    mediaPlaybackRequiresUserAction={false}
                    javaScriptEnabled
                />
            </View>
        );
    }

    return (
        <View style={[styles.youtubeContainer, { height: playerHeight }]}>
            <Image
                source={{ uri: thumbnailUrl }}
                style={styles.thumbnail}
                resizeMode="cover"
                onError={() => setThumbnailError(true)}
            />
            <View style={styles.youtubeOverlay}>
                <TouchableOpacity style={styles.playButton} onPress={handlePlay}>
                    <View style={styles.playButtonInner}>
                        <Play size={ICON.size.xxl} color={colors.white} fill={colors.white} />
                    </View>
                </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.openExternalButton} onPress={openInYouTube}>
                <ExternalLink size={ICON.size.sm} color={colors.white} />
            </TouchableOpacity>
            <View style={styles.youtubeBadge}>
                <Text style={styles.youtubeBadgeText}>YouTube</Text>
            </View>
        </View>
    );
};

// Link Preview Component (for non-YouTube links)
const LinkPreview: React.FC<{ url: string }> = ({ url }) => {
    const { colors } = useTheme();

    const handlePress = () => {
        Linking.openURL(url);
    };

    // Extract domain for display
    const domain = useMemo(() => {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch {
            return url;
        }
    }, [url]);

    return (
        <TouchableOpacity
            style={[styles.linkPreview, { backgroundColor: colors.gray100, borderColor: colors.borderColor }]}
            onPress={handlePress}
        >
            <ExternalLink size={16} color={colors.primary} />
            <Text style={[styles.linkDomain, { color: colors.primary }]} numberOfLines={1}>
                {domain}
            </Text>
            <Text style={[styles.linkUrl, { color: colors.textSecondary }]} numberOfLines={1}>
                {url}
            </Text>
        </TouchableOpacity>
    );
};

// Parse content and extract all elements
const parseContent = (content: string): { segments: ParsedSegment[]; youtubeVideos: string[]; links: string[] } => {
    const youtubeVideos: string[] = [];
    const links: string[] = [];

    // First, find all YouTube URLs and regular URLs
    let processedContent = content;

    // Extract YouTube videos
    for (const pattern of YOUTUBE_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const videoId = match[1];
            if (videoId && !youtubeVideos.includes(videoId)) {
                youtubeVideos.push(videoId);
            }
        }
    }

    // Extract regular links (excluding YouTube)
    const urlMatches = content.match(URL_PATTERN) || [];
    for (const url of urlMatches) {
        if (!isYouTubeUrl(url) && !links.includes(url)) {
            links.push(url);
        }
    }

    // Now parse the text for formatting
    const segments: ParsedSegment[] = [];

    // Simple tokenization - we'll handle inline formatting
    // For now, treat the whole content as text and let the render handle inline styles
    segments.push({ type: 'text', content: processedContent });

    return { segments, youtubeVideos, links };
};

// Check if line is a bullet point
const isBulletLine = (line: string): { isBullet: boolean; content: string } => {
    const bulletMatch = line.match(/^[\s]*[•\-\*][\s]+(.*)$/);
    if (bulletMatch) {
        return { isBullet: true, content: bulletMatch[1] };
    }
    return { isBullet: false, content: line };
};

// Render inline formatted text
const renderInlineText = (
    text: string,
    baseStyle: any,
    colors: any,
    onMentionPress?: (username: string) => void,
    keyPrefix: string = ''
): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    // Combined pattern: bold, italic, strikethrough, mention, URL
    const combinedPattern = /(\*[^*]+\*)|(_[^_]+_)|(~[^~]+~)|(@\w+(?:\s\w+)?)|(https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*))/g;

    let match;
    while ((match = combinedPattern.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            parts.push(
                <Text key={`${keyPrefix}-${key++}`} style={baseStyle}>
                    {text.substring(lastIndex, match.index)}
                </Text>
            );
        }

        const matchedText = match[0];

        if (matchedText.startsWith('*') && matchedText.endsWith('*') && !matchedText.startsWith('**')) {
            // Bold
            parts.push(
                <Text key={`${keyPrefix}-${key++}`} style={[baseStyle, styles.boldText]}>
                    {matchedText.slice(1, -1)}
                </Text>
            );
        } else if (matchedText.startsWith('_') && matchedText.endsWith('_')) {
            // Italic
            parts.push(
                <Text key={`${keyPrefix}-${key++}`} style={[baseStyle, styles.italicText]}>
                    {matchedText.slice(1, -1)}
                </Text>
            );
        } else if (matchedText.startsWith('~') && matchedText.endsWith('~')) {
            // Strikethrough
            parts.push(
                <Text key={`${keyPrefix}-${key++}`} style={[baseStyle, styles.strikethroughText]}>
                    {matchedText.slice(1, -1)}
                </Text>
            );
        } else if (matchedText.startsWith('@')) {
            // Mention
            const username = matchedText.slice(1);
            parts.push(
                <Text
                    key={`${keyPrefix}-${key++}`}
                    style={[baseStyle, styles.mentionText, { color: colors.primary }]}
                    onPress={() => onMentionPress?.(username)}
                >
                    {matchedText}
                </Text>
            );
        } else if (matchedText.startsWith('http')) {
            // Link - all links are clickable, including YouTube
            parts.push(
                <Text
                    key={`${keyPrefix}-${key++}`}
                    style={[baseStyle, styles.linkText, { color: colors.primary }]}
                    onPress={() => Linking.openURL(matchedText)}
                >
                    {matchedText}
                </Text>
            );
        }

        lastIndex = match.index + matchedText.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(
            <Text key={`${keyPrefix}-${key++}`} style={baseStyle}>
                {text.substring(lastIndex)}
            </Text>
        );
    }

    return parts;
};

// Render formatted text with inline styles and bullet lists
const FormattedText: React.FC<{
    text: string;
    baseStyle: any;
    colors: any;
    onMentionPress?: (username: string) => void;
}> = ({ text, baseStyle, colors, onMentionPress }) => {
    // Split by lines to handle bullet points
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
        const { isBullet, content } = isBulletLine(line);

        if (isBullet) {
            // Render as bullet point
            elements.push(
                <View key={`line-${lineIndex}`} style={styles.bulletLine}>
                    <Text style={[baseStyle, styles.bulletPoint]}>•</Text>
                    <Text style={[baseStyle, styles.bulletContent]}>
                        {renderInlineText(content, baseStyle, colors, onMentionPress, `bullet-${lineIndex}`)}
                    </Text>
                </View>
            );
        } else {
            // Regular line with inline formatting
            const inlineContent = renderInlineText(line, baseStyle, colors, onMentionPress, `line-${lineIndex}`);
            elements.push(
                <Text key={`line-${lineIndex}`} style={baseStyle}>
                    {inlineContent}
                    {lineIndex < lines.length - 1 ? '\n' : ''}
                </Text>
            );
        }
    });

    return <View>{elements}</View>;
};

export const RichTextContent: React.FC<RichTextContentProps> = ({ content, onMentionPress }) => {
    const { colors } = useTheme();

    const { youtubeVideos, links } = useMemo(() => parseContent(content), [content]);

    const baseTextStyle = [styles.bodyText, { color: colors.textPrimary }];

    return (
        <View style={styles.container}>
            {/* Formatted text content */}
            <FormattedText
                text={content}
                baseStyle={baseTextStyle}
                colors={colors}
                onMentionPress={onMentionPress}
            />

            {/* YouTube embeds */}
            {youtubeVideos.length > 0 && (
                <View style={styles.embedsContainer}>
                    {youtubeVideos.map((videoId, index) => (
                        <YouTubeEmbed key={`yt-${videoId}-${index}`} videoId={videoId} />
                    ))}
                </View>
            )}

            {/* Link previews (non-YouTube) */}
            {links.length > 0 && (
                <View style={styles.linksContainer}>
                    {links.slice(0, 3).map((url, index) => (
                        <LinkPreview key={`link-${index}`} url={url} />
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    bodyText: {
        fontSize: TYPOGRAPHY.fontSize.md,
        lineHeight: TYPOGRAPHY.fontSize.md * 1.15,
    },
    boldText: {
        fontWeight: TYPOGRAPHY.fontWeight.bold,
    },
    italicText: {
        fontStyle: 'italic',
    },
    strikethroughText: {
        textDecorationLine: 'line-through',
    },
    mentionText: {
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    linkText: {
        textDecorationLine: 'underline',
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    bulletLine: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginVertical: 2,
    },
    bulletPoint: {
        marginRight: SPACING.sm,
        lineHeight: TYPOGRAPHY.fontSize.md * 1.15,
    },
    bulletContent: {
        flex: 1,
        lineHeight: TYPOGRAPHY.fontSize.md * 1.15,
    },
    embedsContainer: {
        marginTop: SPACING.md,
        gap: SPACING.sm,
    },
    linksContainer: {
        marginTop: SPACING.sm,
        gap: SPACING.xs,
    },
    youtubeContainer: {
        width: '100%',
        borderRadius: BORDER.radius.md,
        overflow: 'hidden',
        backgroundColor: '#1F1C18', // gray900
        position: 'relative',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    youtubeOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(26, 26, 26, 0.3)', // black 30% opacity
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButton: {
        width: 68,
        height: 48,
        backgroundColor: 'rgba(139, 74, 60, 0.9)', // error/terracotta 90% opacity
        borderRadius: BORDER.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButtonInner: {
        marginLeft: SPACING.xs, // Offset for play icon visual balance
    },
    openExternalButton: {
        position: 'absolute',
        top: SPACING.sm,
        right: SPACING.sm,
        backgroundColor: 'rgba(26, 26, 26, 0.6)', // black 60% opacity
        padding: SPACING.xs,
        borderRadius: BORDER.radius.sm,
    },
    youtubeBadge: {
        position: 'absolute',
        bottom: SPACING.sm,
        left: SPACING.sm,
        backgroundColor: 'rgba(139, 74, 60, 0.9)', // error/terracotta 90% opacity
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xxs,
        borderRadius: BORDER.radius.xs,
    },
    youtubeBadgeText: {
        color: '#FFFFFF',
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    linkPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.sm,
        borderRadius: BORDER.radius.sm,
        borderWidth: BORDER.width.thin,
        gap: SPACING.xs,
    },
    linkDomain: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    linkUrl: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        flex: 1,
    },
});

export default RichTextContent;
