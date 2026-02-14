import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ActivityComment } from '../../types/activity';
import { SPACING, TYPOGRAPHY, BORDER, withOpacity, OPACITY } from '../../constants/theme';
	import { useTheme } from '../../hooks/useTheme';
	import { Heart, MoreHorizontal, ChevronDown } from 'lucide-react-native';
	import { Avatar, Timestamp } from './shared';
	import { RichTextContent } from './RichTextContent';
	import { getFullImageUrl } from '../../utils/image';
	import { Button, IconButton, ShimmerPlaceholder } from '../ui';


// Thread line constants - must match LAYOUT avatar sizes
const AVATAR_SIZE = 40; // LAYOUT.avatarMd
const AVATAR_SIZE_NESTED = 32; // LAYOUT.avatarSm
const THREAD_LINE_WIDTH = 2;
const THREAD_LINE_LEFT = AVATAR_SIZE / 2; // Center of parent avatar
const NESTED_INDENT = THREAD_LINE_LEFT + SPACING.md + 8; // Indentation for nested comments

interface CommentItemProps {
    comment: ActivityComment;
    currentUserId?: string;
    depth?: number;
    isLast?: boolean;
    showReplies?: boolean;
    maxVisibleReplies?: number;
    onReply: (comment: ActivityComment) => void;
    onLike?: (commentId: string) => void;
    onMore?: (comment: ActivityComment) => void;
    onEdit?: (comment: ActivityComment) => void;
}

const MAX_DEPTH = 2;
const DEFAULT_VISIBLE_REPLIES = 2;

export const CommentItem: React.FC<CommentItemProps> = React.memo(({
    comment,
    currentUserId,
    depth = 0,
    isLast = false,
    showReplies = true,
    maxVisibleReplies = DEFAULT_VISIBLE_REPLIES,
    onReply,
    onLike,
    onMore,
    onEdit,
}) => {
    const { colors } = useTheme();
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(comment.likes_count || 0);
    const [showAllReplies, setShowAllReplies] = useState(false);

    const isOptimistic = comment._optimistic === true;
    const isNested = depth > 0;
    const hasReplies = comment.replies && comment.replies.length > 0;
    const canShowMoreReplies = hasReplies && !showAllReplies && comment.replies!.length > maxVisibleReplies;
    const hiddenRepliesCount = hasReplies ? comment.replies!.length - maxVisibleReplies : 0;
    const isAuthor = currentUserId && comment.author_id === currentUserId;

    const visibleReplies = showAllReplies
        ? comment.replies
        : comment.replies?.slice(0, maxVisibleReplies);

    const handleLike = () => {
        setLiked(!liked);
        setLikeCount(prev => liked ? prev - 1 : prev + 1);
        onLike?.(comment.id);
    };

    const authorName = comment.author?.display_name || 'Utilisateur';
    const avatarUrl = comment.author?.avatar_url ? getFullImageUrl(comment.author.avatar_url) : null;

    // Calculate avatar center for thread positioning
    const currentAvatarSize = isNested ? AVATAR_SIZE_NESTED : AVATAR_SIZE;
    const currentAvatarCenter = currentAvatarSize / 2;

    return (
        <View style={[styles.wrapper, isOptimistic && [styles.optimisticWrapper, { backgroundColor: withOpacity(colors.primary, OPACITY[8]) }]]}>
            {/* Thread line - vertical connector to children */}
            {hasReplies && depth < MAX_DEPTH && (
                <View
                    style={[
                        styles.threadLine,
                        {
                            backgroundColor: colors.gray300,
                            left: isNested
                                ? NESTED_INDENT + currentAvatarCenter - THREAD_LINE_WIDTH / 2
                                : THREAD_LINE_LEFT - THREAD_LINE_WIDTH / 2,
                            top: currentAvatarSize + SPACING.sm,
                        },
                    ]}
                />
            )}

            <View style={[styles.container, isNested && styles.containerNested]}>
                {/* L-shaped connector for nested comments */}
                {isNested && (
                    <View
                        style={[
                            styles.lConnector,
                            {
                                borderLeftColor: colors.gray300,
                                borderBottomColor: colors.gray300,
                                left: -NESTED_INDENT + THREAD_LINE_LEFT - THREAD_LINE_WIDTH / 2,
                                width: NESTED_INDENT - THREAD_LINE_LEFT,
                            }
                        ]}
                    />
                )}

                {/* Avatar */}
                <View style={styles.avatarContainer}>
                    <Avatar
                        uri={avatarUrl}
                        name={authorName}
                        size={isNested ? 'sm' : 'md'}
                    />
                </View>

                {/* Content */}
                <View style={styles.contentContainer}>
                    {/* Header: Name + Time + More */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Text style={[styles.authorName, { color: colors.textPrimary }]}>
                                {authorName}
                            </Text>
                            {isOptimistic ? (
                                <View style={styles.sendingIndicator}>
                                    <ShimmerPlaceholder width={24} height={14} variant="bar" style={styles.spinner} />
                                    <Text style={[styles.sendingText, { color: colors.primary }]}>
                                        Envoi...
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    <Text style={[styles.dot, { color: colors.gray400 }]}>·</Text>
                                    <Timestamp date={comment.created_at} />
                                </>
                            )}
	                    </View>
	                    {!isOptimistic && (
	                            <IconButton
	                                onPress={() => onMore?.(comment)}
	                                icon={<MoreHorizontal size={16} color={colors.gray400} />}
	                                accessibilityLabel="Options"
	                                size="sm"
	                                variant="ghost"
	                                style={{ width: 28, height: 28 }}
	                            />
	                        )}
	                    </View>

                    {/* Comment text */}
                    <View style={styles.textContainer}>
                        <RichTextContent content={comment.content} />
                    </View>

                    {/* Actions: Like + Reply + Edit (hidden for optimistic comments) */}
                    {!isOptimistic && (
                        <View style={styles.actions}>
                            <Pressable
                                style={styles.actionButton}
                                onPress={handleLike}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Heart
                                    size={14}
                                    color={liked ? colors.error : colors.gray400}
                                    fill={liked ? colors.error : 'transparent'}
                                />
                                {likeCount > 0 && (
                                    <Text style={[
                                        styles.actionCount,
                                        { color: liked ? colors.error : colors.gray400 }
                                    ]}>
                                        {likeCount}
                                    </Text>
                                )}
                            </Pressable>

                            <Text style={[styles.actionDot, { color: colors.gray300 }]}>·</Text>

                            {depth < MAX_DEPTH && (
                                <Pressable
                                    style={styles.actionButton}
                                    onPress={() => onReply(comment)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={[styles.replyText, { color: colors.gray500 }]}>
                                        Répondre
                                    </Text>
                                </Pressable>
                            )}

                            {isAuthor && onEdit && (
                                <>
                                    <Text style={[styles.actionDot, { color: colors.gray300 }]}>·</Text>
                                    <Pressable
                                        style={styles.actionButton}
                                        onPress={() => onEdit(comment)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={[styles.replyText, { color: colors.gray500 }]}>
                                            Modifier
                                        </Text>
                                    </Pressable>
                                </>
                            )}
                        </View>
                    )}
                </View>
            </View>

            {/* Nested Replies */}
            {showReplies && hasReplies && depth < MAX_DEPTH && (
                <View style={styles.repliesContainer}>
                    {visibleReplies?.map((reply, index) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            currentUserId={currentUserId}
                            depth={depth + 1}
                            isLast={index === visibleReplies.length - 1 && !canShowMoreReplies}
                            onReply={onReply}
                            onLike={onLike}
                            onMore={onMore}
                            onEdit={onEdit}
                            maxVisibleReplies={maxVisibleReplies}
                        />
                    ))}

	                    {/* Show more replies button */}
	                    {canShowMoreReplies && (
	                        <View style={styles.showMoreButton}>
	                            {/* L-connector for show more */}
	                            <View
	                                style={[
	                                    styles.showMoreLConnector,
                                    {
                                        borderLeftColor: colors.gray300,
                                        borderBottomColor: colors.gray300,
                                        left: -NESTED_INDENT + THREAD_LINE_LEFT - THREAD_LINE_WIDTH / 2,
	                                        width: NESTED_INDENT - THREAD_LINE_LEFT - SPACING.xs,
	                                    }
	                                ]}
	                            />
	                            <Button
	                                title={`Voir ${hiddenRepliesCount} autre${hiddenRepliesCount > 1 ? 's' : ''} réponse${hiddenRepliesCount > 1 ? 's' : ''}`}
	                                onPress={() => setShowAllReplies(true)}
	                                variant="ghost"
	                                size="sm"
	                                icon={<ChevronDown size={14} color={colors.primary} />}
	                                iconPosition="left"
	                                style={{ paddingHorizontal: 0, height: undefined as any }}
	                                textStyle={[styles.showMoreText, { color: colors.primary }]}
	                            />
	                        </View>
	                    )}
	                </View>
	            )}
        </View>
    );
});

// Display name for debugging
CommentItem.displayName = 'CommentItem';

const styles = StyleSheet.create({
    wrapper: {
        position: 'relative',
    },
    optimisticWrapper: {
        opacity: 0.85,
        borderRadius: BORDER.radius.md,
        marginHorizontal: -SPACING.xs,
        paddingHorizontal: SPACING.xs,
    },
    container: {
        flexDirection: 'row',
        paddingVertical: SPACING.sm,
    },
    containerNested: {
        marginLeft: NESTED_INDENT,
    },
    avatarContainer: {
        marginRight: SPACING.sm,
        zIndex: 1,
    },
    contentContainer: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    authorName: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    dot: {
        marginHorizontal: SPACING.xs,
        fontSize: TYPOGRAPHY.fontSize.xs,
    },
    sendingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: SPACING.sm,
    },
    spinner: {
        transform: [{ scale: 0.6 }],
        marginRight: 2,
    },
    sendingText: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    textContainer: {
        marginBottom: SPACING.xs,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionCount: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    actionDot: {
        marginHorizontal: SPACING.sm,
        fontSize: 10,
    },
    replyText: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    // Thread line - vertical line connecting to replies
    threadLine: {
        position: 'absolute',
        bottom: 0,
        width: THREAD_LINE_WIDTH,
        borderRadius: THREAD_LINE_WIDTH / 2,
    },
    // L-shaped connector for nested comments (uses border to create L shape)
    lConnector: {
        position: 'absolute',
        top: 0,
        height: SPACING.sm + AVATAR_SIZE_NESTED / 2,
        borderLeftWidth: THREAD_LINE_WIDTH,
        borderBottomWidth: THREAD_LINE_WIDTH,
        borderBottomLeftRadius: 10,
        borderColor: 'transparent',
    },
    repliesContainer: {
        // No left margin - handled by containerNested
    },
    showMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        marginLeft: NESTED_INDENT,
        gap: SPACING.xs,
    },
    showMoreLConnector: {
        position: 'absolute',
        top: 0,
        height: SPACING.sm + 7,
        borderLeftWidth: THREAD_LINE_WIDTH,
        borderBottomWidth: THREAD_LINE_WIDTH,
        borderBottomLeftRadius: 8,
        borderColor: 'transparent',
    },
    showMoreText: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
});

export default CommentItem;
