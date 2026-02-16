import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    Pressable,
    Animated,
    Dimensions,
    ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    Heart,
    MessageCircle,
    Bookmark,
    MoreHorizontal,
    Calendar,
    Clock,
    MapPin,
    Video,
    Check,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../../src/constants/theme';
import { useTheme } from '../../../../src/hooks/useTheme';
import { CommentSection } from '../../../../src/components/community/CommentSection';
import { RichTextContent } from '../../../../src/components/community/RichTextContent';
import { Avatar, Timestamp } from '../../../../src/components/community/shared';
import { communityActivityService } from '../../../../src/services';
import { CommunityActivity, ActivityComment, PollOption } from '../../../../src/types/activity';
import { useAuth } from '../../../../src/contexts/AuthContext';
import { getFullImageUrl } from '../../../../src/utils/image';
	import { useAlert } from '../../../../src/contexts/AlertContext';
	import { IconButton, LoadingShimmer, SelectCard } from '../../../../src/components/ui';


const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Format large numbers
const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return count.toString();
};

export default function ActivityDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { colors } = useTheme();
    const { user } = useAuth();

    const [activity, setActivity] = useState<CommunityActivity | null>(null);
    const [comments, setComments] = useState<ActivityComment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Engagement state
    const [liked, setLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [commentsCount, setCommentsCount] = useState(0);
    const [bookmarksCount, setBookmarksCount] = useState(0);
    const [isBookmarked, setIsBookmarked] = useState(false);

    // Poll state
    const [pollOptions, setPollOptions] = useState<PollOption[]>([]);
    const [userVotedOptionId, setUserVotedOptionId] = useState<string | null>(null);

    // Animation refs
    const likeScaleAnim = useRef(new Animated.Value(1)).current;
    const bookmarkScaleAnim = useRef(new Animated.Value(1)).current;

    const scrollViewRef = useRef<ScrollView>(null);
    const alerts = useAlert();

    useEffect(() => {
        loadDetails();
    }, [id]);

    // Scroll to bottom when new comment is added
    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, []);

    const loadDetails = async () => {
        try {
            setIsLoading(true);
            const response = await communityActivityService.getActivityDetails(id!);
            setActivity(response.activity);
            setComments(response.comments || []);

            // Initialize engagement state
            if (response.activity) {
                setLiked(response.activity.is_liked || false);
                setLikesCount(response.activity.likes_count || 0);
                // Count all comments including nested replies
                const countAll = (list: ActivityComment[]): number =>
                    list.reduce((sum, c) => sum + 1 + (c.replies ? countAll(c.replies) : 0), 0);
                const fromArray = countAll(response.comments || []);
                const commentsTotal = response.activity.comments_count || fromArray || 0;
                setCommentsCount(commentsTotal);
                setBookmarksCount(response.activity.bookmarks_count || 0);
                setIsBookmarked(response.activity.is_bookmarked || false);

                // Initialize poll state - poll_options comes directly from activity, not from metadata
                const options = response.activity.poll_options || [];
                setPollOptions(options);
                setUserVotedOptionId(
                    response.activity.user_vote_id || options.find((o: PollOption) => o.is_voted_by_user)?.id || null
                );
            }
        } catch (error) {
            console.error(error);
            void alerts.alert('Erreur', 'Impossible de charger l\'activité');
        } finally {
            setIsLoading(false);
        }
    };

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

    const handleLike = useCallback(async () => {
        animateIcon(likeScaleAnim);

        const newLiked = !liked;
        setLiked(newLiked);
        setLikesCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));

        try {
            await communityActivityService.toggleLike(id!);
        } catch (error) {
            // Revert on error
            setLiked(!newLiked);
            setLikesCount(prev => newLiked ? Math.max(0, prev - 1) : prev + 1);
            console.error('Like failed:', error);
        }
    }, [liked, id, likeScaleAnim]);

    const handleBookmark = useCallback(async () => {
        animateIcon(bookmarkScaleAnim);

        const newBookmarked = !isBookmarked;
        setIsBookmarked(newBookmarked);
        setBookmarksCount(prev => newBookmarked ? prev + 1 : Math.max(0, prev - 1));

        try {
            await communityActivityService.toggleBookmark(id!);
        } catch (error) {
            // Revert on error
            setIsBookmarked(!newBookmarked);
            setBookmarksCount(prev => newBookmarked ? Math.max(0, prev - 1) : prev + 1);
            console.error('Bookmark failed:', error);
        }
    }, [isBookmarked, id, bookmarkScaleAnim]);

    // Handle poll vote
    const handleVote = useCallback(async (optionId: string) => {
        if (userVotedOptionId) return; // Already voted

        // Optimistic update
        setUserVotedOptionId(optionId);
        setPollOptions(prev => prev.map(opt => ({
            ...opt,
            votes_count: opt.id === optionId ? opt.votes_count + 1 : opt.votes_count,
            is_voted_by_user: opt.id === optionId
        })));

        try {
            await communityActivityService.vote(id!, optionId);
        } catch (error) {
            // Revert on error
            setUserVotedOptionId(null);
            setPollOptions(prev => prev.map(opt => ({
                ...opt,
                votes_count: opt.id === optionId ? opt.votes_count - 1 : opt.votes_count,
                is_voted_by_user: false
            })));
            console.error('Vote failed:', error);
            void alerts.alert('Erreur', 'Impossible de voter');
        }
    }, [userVotedOptionId, id]);

    // Calculate total votes for poll
    const totalVotes = pollOptions.reduce((sum, opt) => sum + opt.votes_count, 0);

    // Check if current user is the author
    // Backend stores talent_id as author_id, so compare with user.talentId
    const activityAuthorId = activity?.author_id || activity?.author?.id;
    const currentUserId = user?.talentId || user?.id;
    const isAuthor = !!(currentUserId && activityAuthorId && (
        currentUserId === activityAuthorId ||
        String(currentUserId) === String(activityAuthorId)
    ));

    const handleEdit = () => {
        if (!activity) return;
        // Navigate to the appropriate edit form based on activity type
        const baseUrl = `/details/community/${activity.community_id}`;
        switch (activity.type) {
            case 'POST':
                router.push(`${baseUrl}/create-post?activityId=${activity.id}` as any);
                break;
            case 'EVENT':
                router.push(`${baseUrl}/create-event?activityId=${activity.id}` as any);
                break;
            case 'POLL':
                router.push(`${baseUrl}/create-poll?activityId=${activity.id}` as any);
                break;
        }
    };

    const handlePin = async () => {
        if (!activity) return;
        try {
            await communityActivityService.togglePin(activity.id);
            // Refresh activity to update pin state
            loadDetails();
        } catch (error) {
            console.error('Toggle pin failed:', error);
            void alerts.alert('Erreur', 'Impossible de modifier l\'épingle');
        }
    };

    const handleDelete = () => {
        void alerts.showAlert({ title: 'Supprimer', message: 'Êtes-vous sûr de vouloir supprimer cette activité ?', buttons: [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer', style: 'destructive', onPress: async () => {
                    try {
                        await communityActivityService.deleteActivity(id!);
                        router.back();
                    } catch (e) {
                        void alerts.alert('Erreur', 'Impossible de supprimer');
                    }
                }}
            ] });
    };

    const handleMore = () => {
        if (!activity || !user) return;

        const isPinned = activity.is_pinned || false;
        const options: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [];

        // Pin option - available for author (they can pin their own content)
        if (isAuthor) {
            options.push({
                text: isPinned ? 'Désépingler' : 'Épingler',
                onPress: handlePin,
            });
        }

        // Edit option - only for author
        if (isAuthor) {
            options.push({
                text: 'Modifier',
                onPress: handleEdit,
            });
        }

        // Delete option - for author
        if (isAuthor) {
            options.push({
                text: 'Supprimer',
                style: 'destructive',
                onPress: handleDelete,
            });
        }

        // Cancel option - always shown
        options.push({ text: 'Annuler', style: 'cancel' });

        void alerts.showAlert({ title: 'Options', message: undefined, buttons: options as any });
    };

    const handleCommentAdded = useCallback(() => {
        setCommentsCount(prev => prev + 1);
        scrollToBottom();
    }, [scrollToBottom]);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <LoadingShimmer variant="fullPage" />
                </View>
            </SafeAreaView>
        );
    }

    if (!activity) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <Text style={{ color: colors.textPrimary }}>Activité non trouvée</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Activity type badges
    const isPoll = activity.type === 'POLL';
    const isEvent = activity.type === 'EVENT';

    // Event info
    const eventStartDate = activity.metadata?.start_date ? new Date(activity.metadata.start_date) : null;
    const eventEndDate = activity.metadata?.end_date ? new Date(activity.metadata.end_date) : null;
    const isOnlineEvent = activity.metadata?.location_type === 'ONLINE';
    const eventLocation = activity.metadata?.location;
    const meetingUrl = activity.metadata?.meeting_url;

    // Check if scheduled
    const isScheduled = activity.scheduled_at && !activity.published_at && new Date(activity.scheduled_at) > new Date();
    const scheduledDate = isScheduled ? new Date(activity.scheduled_at!) : null;

    // Author info
    const authorName = activity.author?.display_name || 'Utilisateur';
    const avatarUrl = activity.author?.avatar_url ? getFullImageUrl(activity.author.avatar_url) : null;

    return (
	            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
	            {/* Header */}
	            <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
	                <IconButton
	                    onPress={() => router.back()}
	                    icon={<ArrowLeft size={20} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
	                    accessibilityLabel="Retour"
	                    size="sm"
	                    variant="filled"
	                    style={[styles.backButton, { backgroundColor: colors.gray100 }]}
	                />
	                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Publication</Text>
	                <View style={{ width: 40 }} />
	            </View>

            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Activity Card Style Container */}
                <View style={[styles.cardContainer, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
                    {/* Author Section */}
                    <View style={styles.authorSection}>
                        <View style={styles.authorLeft}>
                            <Avatar uri={avatarUrl} name={authorName} size="lg" />
                            <View style={styles.authorInfo}>
                                <View style={styles.authorNameRow}>
                                    <Text style={[styles.authorName, { color: colors.textPrimary }]}>
                                        {authorName}
                                    </Text>
                                    {isScheduled && (
                                        <View style={[styles.scheduledBadge, { backgroundColor: withOpacity(colors.warning, OPACITY[15]) }]}>
                                            <Clock size={10} color={colors.warning} />
                                            <Text style={[styles.scheduledBadgeText, { color: colors.warning }]}>
                                                Programmé
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
	                            onPress={handleMore}
	                            icon={<MoreHorizontal size={20} color={colors.gray400} strokeWidth={ICON.strokeWidth} />}
	                            accessibilityLabel="Options"
	                            size="sm"
	                            variant="ghost"
	                            style={styles.moreButton}
	                        />
	                    </View>

                    {/* Content */}
                    <View style={styles.contentSection}>
                        {activity.metadata?.title && (
                            <Text style={[styles.title, { color: colors.textPrimary }]}>
                                {activity.metadata.title}
                            </Text>
                        )}
                        <RichTextContent content={activity.content} />

                    </View>

                    {/* Poll Options */}
                    {isPoll && pollOptions.length === 0 && (
                        <View style={[styles.pollContainer, { paddingVertical: SPACING.sm }]}>
                            <Text style={{ color: colors.textSecondary, fontSize: TYPOGRAPHY.fontSize.sm, textAlign: 'center' }}>
                                Aucune option de sondage disponible
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
	                                        onPress={() => handleVote(option.id)}
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
                                {totalVotes} vote{totalVotes > 1 ? 's' : ''}
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
                                    <Text style={[styles.eventLabel, { color: colors.textSecondary }]}>Date</Text>
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
                                <View style={[styles.eventIconContainer, { backgroundColor: isOnlineEvent ? withOpacity(colors.success, OPACITY[15]) : withOpacity(colors.primary, OPACITY[15]) }]}>
                                    {isOnlineEvent ? (
                                        <Video size={16} color={colors.success} />
                                    ) : (
                                        <MapPin size={16} color={colors.primary} />
                                    )}
                                </View>
                                <View style={styles.eventInfo}>
                                    <Text style={[styles.eventLabel, { color: colors.textSecondary }]}>
                                        {isOnlineEvent ? 'En ligne' : 'Lieu'}
                                    </Text>
                                    <Text style={[styles.eventValue, { color: colors.textPrimary }]}>
                                        {isOnlineEvent
                                            ? (meetingUrl ? 'Lien de réunion disponible' : 'Détails à venir')
                                            : (eventLocation || 'Lieu à confirmer')
                                        }
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Media attachments */}
                    {activity.attachments && Array.isArray(activity.attachments) && activity.attachments.length > 0 && (() => {
                        const attachmentCount = Math.min(activity.attachments.length, 4);
                        const containerWidth = SCREEN_WIDTH - (SPACING.md * 4);
                        const gap = 4;
                        const isSingle = attachmentCount === 1;
                        const imageWidth = isSingle ? containerWidth : (containerWidth - gap) / 2;
                        const imageHeight = isSingle ? imageWidth * (9 / 16) : imageWidth;

                        return (
                            <View style={styles.mediaContainer}>
                                {activity.attachments.slice(0, 4).map((attachment, index) => {
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

	                    {/* Engagement Bar */}
	                    <View style={[styles.engagementBar, { borderTopColor: colors.borderColor }]}>
	                        {/* Likes */}
	                        <SelectCard
	                            selected={false}
	                            onPress={handleLike}
	                            style={[styles.engagementItem, { borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent' }]}
	                            accessibilityLabel="J’aime"
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
	                                {formatCount(likesCount)} j'aime
	                            </Text>
	                        </SelectCard>

                        {/* Comments */}
                        <View style={styles.engagementItem}>
                            <MessageCircle
                                size={18}
                                color={colors.primary}
                                strokeWidth={ICON.strokeWidth}
                            />
                            <Text style={[styles.engagementText, { color: colors.primary }]}>
                                {formatCount(commentsCount)} {commentsCount <= 1 ? 'commentaire' : 'commentaires'}
                            </Text>
                        </View>

	                        {/* Bookmarks */}
	                        <SelectCard
	                            selected={false}
	                            onPress={handleBookmark}
	                            style={[styles.engagementItem, { borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent' }]}
	                            accessibilityLabel="Bookmark"
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
	                                {formatCount(bookmarksCount)} {bookmarksCount <= 1 ? 'sauvegarde' : 'sauvegardes'}
	                            </Text>
	                        </SelectCard>
	                    </View>

                    {/* Comments Section - Inside the same card */}
                    <View style={[styles.commentsSection, { borderTopColor: colors.borderColor }]}>
                        <CommentSection
                            activityId={id!}
                            initialComments={comments}
                            totalCommentsCount={commentsCount}
                            onCommentAdded={handleCommentAdded}
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderBottomWidth: BORDER.width.thin,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: BORDER.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: TYPOGRAPHY.fontSize.lg,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    // Card Container (matches ActivityCard)
    cardContainer: {
        marginHorizontal: SPACING.md,
        marginTop: SPACING.md,
        borderRadius: BORDER.radius.xl,
        borderWidth: BORDER.width.thin,
        // borderColor set dynamically via inline style
        overflow: 'hidden',
    },
    // Author Section
    authorSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    authorLeft: {
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
    // Content Section
    contentSection: {
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
        gap: 4,
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
    // Comments Section (inside the card)
    commentsSection: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderTopWidth: BORDER.width.thin,
    },
    commentsTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    commentsTitle: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    commentCountBadge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
        borderRadius: BORDER.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    commentCountText: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
        // color set dynamically via inline style
    },
    emptyComments: {
        alignItems: 'center',
        paddingVertical: SPACING.xl,
    },
    emptyCommentsText: {
        marginTop: SPACING.sm,
        fontSize: TYPOGRAPHY.fontSize.sm,
    },
    commentWrapper: {
        // No extra padding needed as CommentItem handles it
    },
    // Input
    inputContainer: {
        padding: SPACING.md,
        borderTopWidth: BORDER.width.thin,
    },
    replyingToBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.sm,
        marginBottom: SPACING.sm,
        borderRadius: BORDER.radius.sm,
    },
    replyingToText: {
        fontSize: TYPOGRAPHY.fontSize.xs,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 100,
        borderRadius: 20,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderWidth: BORDER.width.thin,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
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
