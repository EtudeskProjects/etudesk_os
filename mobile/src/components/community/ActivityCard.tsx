import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Animated,
    Image,
    Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { CommunityActivity, ActivityComment, PollOption } from '../../types/activity';
import { SPACING, TYPOGRAPHY, BORDER, ICON, withOpacity, OPACITY } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../contexts/I18nContext';
import { alertsGlobal } from '../../contexts/AlertContext';
import {
    Heart,
    MessageCircle,
    Bookmark,
    MoreHorizontal,
    Calendar,
    Clock,
    MapPin,
    Video,
    Check,
    Pin,
} from 'lucide-react-native';
	import { CommentSection } from './CommentSection';
	import { RichTextContent } from './RichTextContent';
	import { Avatar, Timestamp } from './shared';
	import { getFullImageUrl } from '../../utils/image';
	import { IconButton, SelectCard } from '../ui';


interface ActivityCardProps {
    activity: CommunityActivity;
    currentUserId: string;
    userRole?: string; // 'ADMIN' | 'MEMBER'
    onLike: (activityId: string) => void;
    onComment?: (activityId: string) => void;
    onBookmark?: (activityId: string) => void;
    onEdit?: (activity: CommunityActivity) => void;
    onPin?: (activityId: string) => void;
    onDelete?: (activityId: string) => void;
    onMentionPress?: (username: string) => void;
    onViewAllComments?: (activityId: string) => void;
    onPress?: (activity: CommunityActivity) => void;
    onVote?: (activityId: string, optionId: string) => void;
}

// Format large numbers
const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return count.toString();
};

export const ActivityCard: React.FC<ActivityCardProps> = React.memo(({
    activity,
    currentUserId,
    userRole,
    onLike,
    onComment,
    onBookmark,
    onEdit,
    onPin,
    onDelete,
    onMentionPress,
    onViewAllComments,
    onPress,
    onVote,
}) => {
    const { colors } = useTheme();
    const { t } = useTranslation();

    // State - Initialize from activity data
    const [liked, setLiked] = useState<boolean>(activity.is_liked || false);
    const [likesCount, setLikesCount] = useState(activity.likes_count || 0);
    const [commentsCount, setCommentsCount] = useState(activity.comments_count || 0);
    const [bookmarksCount, setBookmarksCount] = useState(activity.bookmarks_count || 0);
    const [isBookmarked, setIsBookmarked] = useState(activity.is_bookmarked || false);
    const [showComments, setShowComments] = useState(false);

    // Poll state - poll_options comes directly from activity, not from metadata
    const [pollOptions, setPollOptions] = useState<PollOption[]>(
        activity.poll_options || []
    );
    const [userVotedOptionId, setUserVotedOptionId] = useState<string | null>(
        activity.user_vote_id || activity.poll_options?.find(o => o.is_voted_by_user)?.id || null
    );

    // Sync poll state when activity changes
    useEffect(() => {

        if (activity.poll_options) {
            setPollOptions(activity.poll_options);
            setUserVotedOptionId(
                activity.user_vote_id || activity.poll_options.find(o => o.is_voted_by_user)?.id || null
            );
        }
    }, [activity.id, activity.poll_options, activity.user_vote_id]);

    // Animation for like
    const likeScaleAnim = useRef(new Animated.Value(1)).current;
    const bookmarkScaleAnim = useRef(new Animated.Value(1)).current;

    // Animate icon
    const animateIcon = (anim: Animated.Value) => {
        Animated.sequence([
            Animated.timing(anim, {
                toValue: 1.3,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(anim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();
    };

    // Handle like with animation
    const handleLike = useCallback(() => {
        animateIcon(likeScaleAnim);

        const newLiked = !liked;
        setLiked(newLiked);
        setLikesCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));

        onLike(activity.id);
    }, [liked, activity.id, onLike, likeScaleAnim]);

    // Handle double tap to like
    const lastTap = useRef<number>(0);
    const handleDoubleTap = useCallback(() => {
        const now = Date.now();
        if (now - lastTap.current < 300) {
            if (!liked) handleLike();
        }
        lastTap.current = now;
    }, [liked, handleLike]);

    // Handle bookmark with animation
    const handleBookmark = useCallback(() => {
        animateIcon(bookmarkScaleAnim);

        const newBookmarked = !isBookmarked;
        setIsBookmarked(newBookmarked);
        setBookmarksCount(prev => newBookmarked ? prev + 1 : Math.max(0, prev - 1));

        onBookmark?.(activity.id);
    }, [isBookmarked, activity.id, onBookmark, bookmarkScaleAnim]);

    // Handle comment click - toggle comments visibility (no auto-focus)
    const handleCommentClick = useCallback(() => {
        setShowComments(prev => !prev);
    }, []);

    // Handle comment added
    const handleCommentAdded = useCallback((comment: ActivityComment) => {
        setCommentsCount(prev => prev + 1);
    }, []);

    // Handle poll vote
    const handleVote = useCallback((optionId: string) => {
        if (userVotedOptionId) return; // Already voted

        // Optimistic update
        setUserVotedOptionId(optionId);
        setPollOptions(prev => prev.map(opt => ({
            ...opt,
            votes_count: opt.id === optionId ? opt.votes_count + 1 : opt.votes_count,
            is_voted_by_user: opt.id === optionId
        })));

        onVote?.(activity.id, optionId);
    }, [userVotedOptionId, activity.id, onVote]);

    // Calculate total votes for poll
    const totalVotes = pollOptions.reduce((sum, opt) => sum + opt.votes_count, 0);

    // Activity type badges
    const isPoll = activity.type === 'POLL';
    const isEvent = activity.type === 'EVENT';

    // Event info
    const eventStartDate = activity.metadata?.start_date ? new Date(activity.metadata.start_date) : null;
    const eventEndDate = activity.metadata?.end_date ? new Date(activity.metadata.end_date) : null;
    const isOnlineEvent = activity.metadata?.location_type === 'ONLINE';
    const eventLocation = activity.metadata?.location;
    const meetingUrl = activity.metadata?.meeting_url;

    // Check if scheduled (not yet published)
    const isScheduled = activity.scheduled_at && !activity.published_at && new Date(activity.scheduled_at) > new Date();
    const scheduledDate = isScheduled ? new Date(activity.scheduled_at!) : null;

    // Author info
    const authorName = activity.author?.display_name || 'Utilisateur';
    const avatarUrl = activity.author?.avatar_url ? getFullImageUrl(activity.author.avatar_url) : null;

    // Check if current user is the author (compare both author_id and author.id for robustness)
    const activityAuthorId = activity.author_id || activity.author?.id;
    const isAuthor = !!(currentUserId && activityAuthorId && (
        currentUserId === activityAuthorId ||
        String(currentUserId) === String(activityAuthorId)
    ));

    // Handle more button press - show options menu
    const isAdmin = userRole === 'ADMIN';
    const isPinned = activity.is_pinned || false;

    const handleMorePress = useCallback(() => {
        const options: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [];

        // Pin option - only for admins
        if (isAdmin && onPin) {
            options.push({
                text: isPinned ? t('community.activity.unpin') : t('community.activity.pin'),
                onPress: () => onPin(activity.id),
            });
        }

        // Edit option - only for author
        if (isAuthor && onEdit) {
            options.push({
                text: t('common.edit'),
                onPress: () => onEdit(activity),
            });
        }

        // Delete option - for author or admin
        if ((isAuthor || isAdmin) && onDelete) {
            options.push({
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => onDelete(activity.id),
            });
        }

        // Cancel option - always shown
        options.push({ text: t('common.cancel'), style: 'cancel' });

        void alertsGlobal.showAlert({ title: 'Options', message: undefined, buttons: options as any });
    }, [isAuthor, isAdmin, isPinned, onEdit, onPin, onDelete, activity]);

    return (
        <Pressable
            style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
            onPress={() => onPress?.(activity)}
        >
	            {/* Header */}
	            <View style={styles.header}>
	                <View style={styles.authorSection}>
	                    <Avatar uri={avatarUrl} name={authorName} size="lg" />
	                    <View style={styles.authorInfo}>
	                        <View style={styles.authorNameRow}>
	                            <Text style={[styles.authorName, { color: colors.textPrimary }]}>
	                                {authorName}
                            </Text>
                            {isPinned && (
                                <View style={[styles.scheduledBadge, { backgroundColor: withOpacity(colors.primary, OPACITY[20]) }]}>
                                    <Pin size={10} color={colors.primary} />
                                    <Text style={[styles.scheduledBadgeText, { color: colors.primary }]}>
                                        {t('community.activity.pinned')}
                                    </Text>
                                </View>
                            )}
                            {isScheduled && (
                                <View style={[styles.scheduledBadge, { backgroundColor: colors.warningLight }]}>
                                    <Clock size={10} color={colors.warning} />
                                    <Text style={[styles.scheduledBadgeText, { color: colors.warning }]}>
                                        {t('community.activity.scheduled')}
                                    </Text>
                                </View>
                            )}
                        </View>
                        {isScheduled && scheduledDate ? (
                            <Text style={[styles.scheduledTime, { color: colors.warning }]}>
                                {scheduledDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
	                        ) : (
	                            <Timestamp date={activity.created_at} />
	                        )}
	                    </View>
	                </View>
	
	                <IconButton
	                    onPress={handleMorePress}
	                    icon={<MoreHorizontal size={20} color={colors.gray400} strokeWidth={ICON.strokeWidth} />}
	                    accessibilityLabel={t('common.more')}
	                    size="sm"
	                    variant="ghost"
	                    style={styles.moreButton}
	                />
	            </View>

            {/* Content - Double tap to like */}
            <Pressable style={styles.content} onPress={handleDoubleTap}>
                {activity.metadata?.title && (
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        {activity.metadata.title}
                    </Text>
                )}
                <RichTextContent content={activity.content} onMentionPress={onMentionPress} />

            </Pressable>

            {/* Poll Options */}
            {isPoll && pollOptions.length === 0 && (
                <View style={[styles.pollContainer, { paddingVertical: SPACING.sm }]}>
                    <Text style={{ color: colors.textSecondary, fontSize: TYPOGRAPHY.fontSize.sm, textAlign: 'center' }}>
                        {t('community.activity.pollLoading')}
                    </Text>
                </View>
            )}
            {isPoll && pollOptions.length > 0 && (
                <View style={styles.pollContainer}>
                    {pollOptions.map((option) => {
                        const percentage = totalVotes > 0 ? Math.round((option.votes_count / totalVotes) * 100) : 0;
                        const isVoted = userVotedOptionId === option.id;
                        const hasVoted = userVotedOptionId !== null;

                        return (
                            <SelectCard
                                key={option.id}
                                style={[
                                    styles.pollOption,
                                    {
                                        backgroundColor: colors.background,
                                        borderColor: isVoted ? colors.primary : colors.borderColor
                                    }
                                ]}
                                onPress={hasVoted ? () => {} : () => handleVote(option.id)}
                                selected={false}
                                accessibilityLabel={option.text}
                            >
                                {/* Progress bar background */}
                                {hasVoted && (
                                    <View
                                        style={[
                                            styles.pollProgressBar,
                                            {
                                                backgroundColor: isVoted ? withOpacity(colors.primary, OPACITY[20]) : colors.gray100,
                                                width: `${percentage}%`,
                                            }
                                        ]}
                                    />
                                )}
                                <View style={styles.pollOptionContent}>
                                    <View style={styles.pollOptionLeft}>
                                        {isVoted && (
                                            <View style={[styles.pollCheckIcon, { backgroundColor: colors.primary }]}>
                                                <Check size={10} color={colors.textOnPrimary} strokeWidth={3} />
                                            </View>
                                        )}
                                        <Text style={[
                                            styles.pollOptionText,
                                            { color: colors.textPrimary },
                                            isVoted && styles.pollOptionTextVoted
                                        ]}>
                                            {option.text}
                                        </Text>
                                    </View>
                                    {hasVoted && (
                                        <Text style={[
                                            styles.pollPercentage,
                                            { color: isVoted ? colors.primary : colors.textSecondary }
                                        ]}>
                                            {percentage}%
                                        </Text>
                                    )}
                                </View>
                            </SelectCard>
                        );
                    })}
                    <Text style={[styles.pollVotesCount, { color: colors.textSecondary }]}>
                        {t('community.activity.votes', { count: totalVotes })}
                    </Text>
                </View>
            )}

            {/* Event Details */}
            {isEvent && eventStartDate && (
                <View style={[styles.eventContainer, { backgroundColor: colors.background, borderColor: colors.borderColor }]}>
                    {/* Date & Time */}
                    <View style={styles.eventRow}>
                        <View style={[styles.eventIconContainer, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                            <Calendar size={16} color={colors.primary} />
                        </View>
                        <View style={styles.eventInfo}>
                            <Text style={[styles.eventLabel, { color: colors.textSecondary }]}>{t('community.activity.dateLabel')}</Text>
                            <Text style={[styles.eventValue, { color: colors.textPrimary }]}>
                                {eventStartDate.toLocaleDateString('fr-FR', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                })}
                            </Text>
                            <Text style={[styles.eventTime, { color: colors.primary }]}>
                                {eventStartDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                {eventEndDate && ` - ${eventEndDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                            </Text>
                        </View>
                    </View>

                    {/* Location */}
                    <View style={styles.eventRow}>
                        <View style={[styles.eventIconContainer, { backgroundColor: isOnlineEvent ? colors.successLight : withOpacity(colors.primary, OPACITY[15]) }]}>
                            {isOnlineEvent ? (
                                <Video size={16} color={colors.success} />
                            ) : (
                                <MapPin size={16} color={colors.primary} />
                            )}
                        </View>
                        <View style={styles.eventInfo}>
                            <Text style={[styles.eventLabel, { color: colors.textSecondary }]}>
                                {isOnlineEvent ? t('community.activity.online') : t('community.activity.location')}
                            </Text>
                            <Text style={[styles.eventValue, { color: colors.textPrimary }]}>
                                {isOnlineEvent
                                    ? (meetingUrl ? t('community.activity.meetingLinkAvailable') : t('community.activity.detailsComingSoon'))
                                    : (eventLocation || t('community.activity.locationTbc'))
                                }
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Media attachments */}
            {activity.attachments && Array.isArray(activity.attachments) && activity.attachments.length > 0 && (() => {
                const attachmentCount = Math.min(activity.attachments.length, 4);
                const containerWidth = SCREEN_WIDTH - (SPACING.md * 2) - (SPACING.md * 2); // Screen - card margins - padding
                const gap = 4;
                const isSingle = attachmentCount === 1;
                const imageWidth = isSingle ? containerWidth : (containerWidth - gap) / 2;
                const imageHeight = isSingle ? imageWidth * (9 / 16) : imageWidth;

                return (
                    <View style={styles.mediaContainer}>
                        {activity.attachments.slice(0, 4).map((attachment, index) => {
                            // Handle both string URLs and object attachments
                            const imageUrl = typeof attachment === 'string'
                                ? attachment
                                : (attachment as any)?.url || (attachment as any)?.uri;

                            if (!imageUrl) return null;

                            const fullUrl = getFullImageUrl(imageUrl);
                            if (!fullUrl) return null;

                            return (
                                <Image
                                    key={index}
                                    source={{ uri: fullUrl }}
                                    style={{
                                        width: imageWidth,
                                        height: imageHeight,
                                        borderRadius: BORDER.radius.sm,
                                    }}
                                    resizeMode="cover"
                                />
                            );
                        })}
                    </View>
                );
            })()}

            {/* Engagement Bar - Stats with clickable icons */}
            <View style={[styles.engagementBar, { borderTopColor: colors.borderColor }]}>
                {/* Likes */}
                <SelectCard
                    selected={false}
                    onPress={handleLike}
                    style={[styles.engagementItem, { borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent' }]}
                    accessibilityLabel={t('common.like')}
                >
                    <Animated.View style={{ transform: [{ scale: likeScaleAnim }] }}>
                        <Heart
                            size={18}
                            color={liked ? colors.error : colors.gray500}
                            fill={liked ? colors.error : 'transparent'}
                            strokeWidth={ICON.strokeWidth}
                        />
                    </Animated.View>
                    <Text style={[
                        styles.engagementText,
                        { color: liked ? colors.error : colors.textSecondary }
                    ]}>
                        {t('community.activity.likes', { count: likesCount, formattedCount: formatCount(likesCount) })}
                    </Text>
                </SelectCard>

                {/* Comments */}
                <SelectCard
                    selected={false}
                    onPress={handleCommentClick}
                    style={[styles.engagementItem, { borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent' }]}
                    accessibilityLabel={t('common.comments')}
                >
                    <MessageCircle
                        size={18}
                        color={showComments ? colors.primary : colors.gray500}
                        strokeWidth={ICON.strokeWidth}
                    />
                    <Text style={[
                        styles.engagementText,
                        { color: showComments ? colors.primary : colors.textSecondary }
                    ]}>
                        {t('community.activity.comments', { count: commentsCount, formattedCount: formatCount(commentsCount) })}
                    </Text>
                </SelectCard>

                {/* Bookmarks */}
                <SelectCard
                    selected={false}
                    onPress={handleBookmark}
                    style={[styles.engagementItem, { borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent' }]}
                    accessibilityLabel={t('common.favorites')}
                >
                    <Animated.View style={{ transform: [{ scale: bookmarkScaleAnim }] }}>
                        <Bookmark
                            size={18}
                            color={isBookmarked ? colors.primary : colors.gray500}
                            fill={isBookmarked ? colors.primary : 'transparent'}
                            strokeWidth={ICON.strokeWidth}
                        />
                    </Animated.View>
                    <Text style={[
                        styles.engagementText,
                        { color: isBookmarked ? colors.primary : colors.textSecondary }
                    ]}>
                        {t('community.activity.bookmarks', { count: bookmarksCount, formattedCount: formatCount(bookmarksCount) })}
                    </Text>
                </SelectCard>
            </View>

            {/* Comments Section */}
            {showComments && (
                <View style={[styles.commentsContainer, { borderTopColor: colors.borderColor }]}>
                    <CommentSection
                        activityId={activity.id}
                        totalCommentsCount={commentsCount}
                        onCommentAdded={handleCommentAdded}
                        onViewAllComments={onViewAllComments ? () => onViewAllComments(activity.id) : undefined}
                    />
                </View>
            )}
        </Pressable>
    );
});

// Display name for debugging
ActivityCard.displayName = 'ActivityCard';

const styles = StyleSheet.create({
    container: {
        marginHorizontal: SPACING.md,
        marginBottom: SPACING.md,
        borderRadius: BORDER.radius.xl,
        borderWidth: BORDER.width.thin,
        overflow: 'hidden',
    },
    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    authorSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    authorInfo: {
        marginLeft: SPACING.sm,
    },
    authorNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    authorName: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    scheduledBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingHorizontal: SPACING.xs,
        paddingVertical: 2,
        borderRadius: BORDER.radius.sm,
    },
    scheduledBadgeText: {
        fontSize: 9,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    scheduledTime: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    moreButton: {
        padding: SPACING.xs,
    },
    // Content
    content: {
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
    },
    title: {
        fontSize: TYPOGRAPHY.fontSize.lg,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
        marginBottom: SPACING.xs,
        lineHeight: TYPOGRAPHY.fontSize.lg * 1.3,
    },
    // Media
    mediaContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
        gap: 2,
    },
    mediaImage: {
        width: '49%',
        aspectRatio: 1,
        borderRadius: BORDER.radius.sm,
    },
    mediaImageSingle: {
        width: '100%',
        aspectRatio: 16 / 9,
    },
    // Engagement Bar
    engagementBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.sm,
        borderTopWidth: BORDER.width.thin,
    },
    engagementItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.sm,
    },
    engagementText: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    // Comments
    commentsContainer: {
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
        borderTopWidth: BORDER.width.thin,
    },
    // Poll styles
    pollContainer: {
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
        gap: SPACING.sm,
    },
    pollOption: {
        position: 'relative',
        borderWidth: BORDER.width.thin,
        borderRadius: BORDER.radius.md,
        overflow: 'hidden',
    },
    pollProgressBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        borderRadius: BORDER.radius.md,
    },
    pollOptionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.sm,
        paddingHorizontal: SPACING.md,
    },
    pollOptionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: SPACING.sm,
    },
    pollCheckIcon: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pollOptionText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        flex: 1,
    },
    pollOptionTextVoted: {
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    pollPercentage: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
        marginLeft: SPACING.sm,
    },
    pollVotesCount: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        textAlign: 'center',
        marginTop: SPACING.xs,
    },
    // Event styles
    eventContainer: {
        marginHorizontal: SPACING.md,
        marginBottom: SPACING.md,
        padding: SPACING.md,
        borderRadius: BORDER.radius.lg,
        borderWidth: BORDER.width.thin,
        gap: SPACING.md,
    },
    eventRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.sm,
    },
    eventIconContainer: {
        width: 36,
        height: 36,
        borderRadius: BORDER.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    eventInfo: {
        flex: 1,
    },
    eventLabel: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        marginBottom: 2,
    },
    eventValue: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    eventTime: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
        marginTop: 2,
    },
});

export default ActivityCard;
