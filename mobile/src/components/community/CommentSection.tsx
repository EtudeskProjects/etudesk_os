import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Pressable,
    ActivityIndicator,
    Alert,
    Keyboard,
    Platform,
    Modal,
    Dimensions,
    KeyboardAvoidingView,
    ActionSheetIOS,
} from 'react-native';
import { ActivityComment } from '../../types/activity';
import { communityActivityService } from '../../services';
import { useAuth } from '../../contexts/AuthContext';
import { CommentItem } from './CommentItem';
import { SPACING, TYPOGRAPHY, BORDER, withOpacity, OPACITY } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Send, X, ChevronDown } from 'lucide-react-native';

// Extended comment type for optimistic updates
interface OptimisticComment extends ActivityComment {
    _optimistic?: boolean;
    _tempId?: string;
}

const MAX_VISIBLE_COMMENTS = 3;

interface CommentSectionProps {
    activityId: string;
    initialComments?: ActivityComment[];
    totalCommentsCount?: number;
    onCommentAdded?: (comment: ActivityComment) => void;
    onViewAllComments?: () => void;
    inputRef?: React.RefObject<TextInput>;
    autoFocus?: boolean; // Auto-open the input modal when mounted
}

export const CommentSection: React.FC<CommentSectionProps> = ({
    activityId,
    initialComments,
    totalCommentsCount = 0,
    onCommentAdded,
    onViewAllComments,
    inputRef: externalInputRef,
    autoFocus = false,
}) => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [comments, setComments] = useState<OptimisticComment[]>(initialComments || []);
    const [loading, setLoading] = useState(!initialComments);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<ActivityComment | null>(null);
    const [showAllComments, setShowAllComments] = useState(false);
    const localInputRef = useRef<TextInput>(null);
    const inputRef = externalInputRef || localInputRef;

    // Counter for generating unique temp IDs
    const tempIdCounter = useRef(0);

    // Keyboard handling
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    // Track if we're in the middle of submitting to avoid closing modal prematurely
    const isSubmittingRef = useRef(false);

    useEffect(() => {
        const keyboardWillShow = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                setKeyboardHeight(e.endCoordinates.height);
            }
        );

        const keyboardWillHide = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                setKeyboardHeight(0);
                // Add a small delay to allow button press to register before closing modal
                // This prevents the modal from closing when user taps the send button
                setTimeout(() => {
                    // Don't close modal if we're submitting - the submit handler will close it
                    // Only close if user taps outside or dismisses keyboard manually
                    if (!isSubmittingRef.current) {
                        setIsInputFocused(false);
                    }
                }, 100);
            }
        );

        return () => {
            keyboardWillShow.remove();
            keyboardWillHide.remove();
        };
    }, []);

    const loadComments = useCallback(async () => {
        if (initialComments !== undefined) return;

        try {
            setLoading(true);
            const response = await communityActivityService.getActivityDetails(activityId);

            setComments(currentComments => {
                const serverComments = response.comments || [];
                // Preserve optimistic comments that haven't been confirmed/replaced yet
                const optimisticComments = currentComments.filter(c => c._optimistic);

                if (optimisticComments.length > 0) {
                    return [...optimisticComments, ...serverComments];
                }

                return serverComments;
            });

        } catch (error) {
            console.error('[CommentSection] Failed to load comments:', error);
        } finally {
            setLoading(false);
        }
    }, [activityId, initialComments]);

    useEffect(() => {
        loadComments();
    }, [loadComments]);

    useEffect(() => {
        if (initialComments !== undefined) {
            setComments(currentComments => {
                // Use same logic as loadComments to preserve optimistic updates
                const optimisticComments = currentComments.filter(c => c._optimistic);

                if (optimisticComments.length > 0) {
                    console.log('[CommentSection] Preserving optimistic comments during prop update:', optimisticComments.length);
                    // Combine optimistic comments with new props
                    return [...optimisticComments, ...initialComments];
                }

                return initialComments;
            });
            setLoading(false);
        }
    }, [initialComments]);

    // Auto-focus: open input modal when mounted with autoFocus=true
    useEffect(() => {
        if (autoFocus && !loading) {
            // Small delay to ensure component is fully rendered
            const timer = setTimeout(() => {
                setIsInputFocused(true);
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [autoFocus, loading]);

    const handleSubmit = async () => {
        const textToSubmit = commentText.trim();
        if (!textToSubmit || submitting) return;

        // Mark as submitting to prevent keyboard listener from closing modal
        isSubmittingRef.current = true;
        setSubmitting(true);

        const content = textToSubmit;
        // If replying to a reply (comment has parent_id), use that parent_id instead
        // This keeps nesting to max 2 levels: comments and replies to comments
        const parentId = replyingTo
            ? (replyingTo.parent_id || replyingTo.id)
            : undefined;
        const pendingContent = content;
        const pendingReplyingTo = replyingTo;

        // Generate temp ID for optimistic comment
        tempIdCounter.current += 1;
        const tempId = `temp_${Date.now()}_${tempIdCounter.current}`;

        // Get user display name (firstName + lastName, or displayName, or email)
        const userDisplayName = user?.firstName && user?.lastName
            ? `${user.firstName} ${user.lastName}`
            : user?.displayName || user?.email?.split('@')[0] || 'Moi';

        // Create optimistic comment
        const optimisticComment: OptimisticComment = {
            id: tempId,
            activity_id: activityId,
            author_id: user?.id || '',
            content,
            parent_id: parentId,
            moderation_status: 'PENDING',
            likes_count: 0,
            replies_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            author: {
                id: user?.id || '',
                display_name: userDisplayName,
                avatar_url: user?.avatarUrl || '',
            },
            _optimistic: true,
            _tempId: tempId,
        };

        // Helper function to recursively add reply to nested comments
        const addReplyToComment = (comments: OptimisticComment[], targetId: string, newReply: OptimisticComment): OptimisticComment[] => {
            return comments.map(comment => {
                if (comment.id === targetId) {
                    return {
                        ...comment,
                        replies: [newReply, ...(comment.replies || [])],
                    };
                }
                if (comment.replies && comment.replies.length > 0) {
                    return {
                        ...comment,
                        replies: addReplyToComment(comment.replies as OptimisticComment[], targetId, newReply),
                    };
                }
                return comment;
            });
        };

        // Optimistic update: add comment immediately
        if (parentId) {
            // For replies, recursively find parent and add reply
            setComments(prev => addReplyToComment(prev, parentId, optimisticComment));
        } else {
            // For top-level comments, add to beginning
            setComments(prev => [optimisticComment, ...prev]);
        }

        // Clear input immediately for better UX
        setCommentText('');
        setReplyingTo(null);
        // Close modal and dismiss keyboard AFTER state updates are scheduled
        setIsInputFocused(false);
        Keyboard.dismiss();

        // Notify parent immediately (for counter update)
        onCommentAdded?.(optimisticComment);

        try {
            const response = await communityActivityService.addComment(activityId, content, parentId);

            // Backend returns comment directly (not wrapped in { data: ... })
            // Handle both cases for safety: response.data or response itself
            const realComment = (response as any).data || response;

            if (realComment && realComment.id) {
                // Helper function to recursively replace optimistic comment with real one
                const replaceOptimisticComment = (comments: OptimisticComment[], targetTempId: string, replacement: ActivityComment): OptimisticComment[] => {
                    return comments.map(comment => {
                        if (comment._tempId === targetTempId) {
                            return {
                                ...replacement,
                                _optimistic: undefined,
                                _tempId: undefined,
                            } as OptimisticComment;
                        }
                        if (comment.replies && comment.replies.length > 0) {
                            return {
                                ...comment,
                                replies: replaceOptimisticComment(comment.replies as OptimisticComment[], targetTempId, replacement),
                            };
                        }
                        return comment;
                    });
                };

                // Replace optimistic comment with real one from server
                setComments(prev => replaceOptimisticComment(prev, tempId, realComment));
            }
        } catch (error: any) {
            console.error('[CommentSection] Failed to post comment:', error);

            // Helper function to recursively remove optimistic comment on error
            const removeOptimisticComment = (comments: OptimisticComment[], targetTempId: string): OptimisticComment[] => {
                return comments
                    .filter(comment => comment._tempId !== targetTempId)
                    .map(comment => {
                        if (comment.replies && comment.replies.length > 0) {
                            return {
                                ...comment,
                                replies: removeOptimisticComment(comment.replies as OptimisticComment[], targetTempId),
                            };
                        }
                        return comment;
                    });
            };

            // Remove optimistic comment on error
            setComments(prev => removeOptimisticComment(prev, tempId));

            // Restore input so user can retry without retyping
            setCommentText(pendingContent);
            setReplyingTo(pendingReplyingTo);
            // Reopen modal so user can retry
            setIsInputFocused(true);

            const message = error?.response?.data?.error || error?.message || 'Impossible de publier.';
            Alert.alert('Erreur', message);
        } finally {
            setSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    const handleReply = (comment: ActivityComment) => {
        setReplyingTo(comment);
        // Open the input modal
        setIsInputFocused(true);
    };

    const cancelReply = () => {
        setReplyingTo(null);
    };

    const handleLikeComment = async (commentId: string) => {
        // Optimistic update handled in CommentItem
        // Call API here if needed
    };

    // Helper function to recursively delete a comment from the tree
    const deleteCommentFromTree = (comments: OptimisticComment[], targetId: string): OptimisticComment[] => {
        return comments
            .filter(comment => comment.id !== targetId)
            .map(comment => {
                if (comment.replies && comment.replies.length > 0) {
                    return {
                        ...comment,
                        replies: deleteCommentFromTree(comment.replies as OptimisticComment[], targetId),
                    };
                }
                return comment;
            });
    };

    const handleDeleteComment = async (comment: ActivityComment) => {
        try {
            // Optimistic delete
            setComments(prev => deleteCommentFromTree(prev, comment.id));

            // Call API
            await communityActivityService.deleteComment(activityId, comment.id);
        } catch (error: any) {
            console.error('[CommentSection] Failed to delete comment:', error);
            // Reload comments on error
            loadComments();
            Alert.alert('Erreur', 'Impossible de supprimer le commentaire.');
        }
    };

    const handleMoreOptions = (comment: ActivityComment) => {
        const isAuthor = user?.talentId === comment.author_id;

        if (Platform.OS === 'ios') {
            const options = isAuthor
                ? ['Supprimer', 'Annuler']
                : ['Signaler', 'Annuler'];
            const destructiveButtonIndex = isAuthor ? 0 : undefined;
            const cancelButtonIndex = isAuthor ? 1 : 1;

            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options,
                    destructiveButtonIndex,
                    cancelButtonIndex,
                },
                (buttonIndex) => {
                    if (isAuthor && buttonIndex === 0) {
                        Alert.alert(
                            'Supprimer le commentaire',
                            'Êtes-vous sûr de vouloir supprimer ce commentaire ?',
                            [
                                { text: 'Annuler', style: 'cancel' },
                                {
                                    text: 'Supprimer',
                                    style: 'destructive',
                                    onPress: () => handleDeleteComment(comment)
                                },
                            ]
                        );
                    }
                }
            );
        } else {
            // Android - use Alert
            if (isAuthor) {
                Alert.alert(
                    'Options',
                    '',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Supprimer',
                            style: 'destructive',
                            onPress: () => {
                                Alert.alert(
                                    'Supprimer le commentaire',
                                    'Êtes-vous sûr de vouloir supprimer ce commentaire ?',
                                    [
                                        { text: 'Annuler', style: 'cancel' },
                                        {
                                            text: 'Supprimer',
                                            style: 'destructive',
                                            onPress: () => handleDeleteComment(comment)
                                        },
                                    ]
                                );
                            }
                        },
                    ]
                );
            }
        }
    };

    const hasComments = comments.length > 0;

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    }
    // Sort comments: most recent first
    const sortedComments = [...comments].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const visibleComments = showAllComments ? sortedComments : sortedComments.slice(0, MAX_VISIBLE_COMMENTS);
    const hiddenCount = sortedComments.length - MAX_VISIBLE_COMMENTS;
    const hasMoreComments = hiddenCount > 0 && !showAllComments;

    return (
        <View style={styles.container}>
            {/* Comments Header */}
            {hasComments && (
                <View style={styles.commentsHeader}>
                    <Text style={[styles.commentsTitle, { color: colors.textSecondary }]}>
                        Commentaires
                    </Text>
                </View>
            )}

            {/* Comments List */}
            {hasComments ? (
                <View style={styles.commentsList}>
                    {visibleComments.map((comment, index) => (
                        <CommentItem
                            key={comment.id}
                            comment={comment}
                            currentUserId={user?.talentId}
                            isLast={index === visibleComments.length - 1 && !hasMoreComments}
                            onReply={handleReply}
                            onLike={handleLikeComment}
                            onMore={handleMoreOptions}
                        />
                    ))}

                    {/* Show more comments */}
                    {hasMoreComments && (
                        <TouchableOpacity
                            style={styles.showMoreContainer}
                            onPress={() => {
                                if (onViewAllComments) {
                                    onViewAllComments();
                                } else {
                                    setShowAllComments(true);
                                }
                            }}
                        >
                            <View style={[styles.showMoreLine, { backgroundColor: colors.borderColor }]} />
                            <View style={[styles.showMoreButton, { backgroundColor: colors.surface }]}>
                                <Text style={[styles.showMoreText, { color: colors.primary }]}>
                                    Voir {hiddenCount} autre{hiddenCount > 1 ? 's' : ''} commentaire{hiddenCount > 1 ? 's' : ''}
                                </Text>
                                <ChevronDown size={14} color={colors.primary} />
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                <View style={styles.commentsList}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', paddingVertical: 8 }}>
                        Aucun commentaire. Soyez le premier !
                    </Text>
                </View>
            )}

            {/* Input Area - Inline when keyboard hidden */}
            {!isInputFocused && (
                <View style={styles.inputSection}>
                    {/* Reply indicator with message preview */}
                    {replyingTo && (
                        <View style={[styles.replyIndicator, { backgroundColor: colors.primary + '10' }]}>
                            <View style={styles.replyContent}>
                                <Text style={[styles.replyIndicatorText, { color: colors.primary }]} numberOfLines={1}>
                                    Répondre à {replyingTo.author?.display_name || 'utilisateur'}
                                </Text>
                                <Text style={[styles.replyMessagePreview, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {replyingTo.content}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={cancelReply}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <X size={16} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Input pill - tap to open modal */}
                    <TouchableOpacity
                        style={[styles.inlineInputPill, { backgroundColor: colors.gray100 }]}
                        onPress={() => {
                            setIsInputFocused(true);
                            setTimeout(() => inputRef.current?.focus(), 100);
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.inputPlaceholder, { color: colors.gray400 }]}>
                            {replyingTo ? "Votre réponse..." : "Ajouter un commentaire..."}
                        </Text>
                        <View style={[styles.inlineSendButton, { backgroundColor: colors.gray300 }]}>
                            <Send size={16} color={colors.textOnPrimary} />
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            {/* Modal for input when keyboard is visible */}
            <Modal
                visible={isInputFocused}
                transparent
                animationType="none"
                onRequestClose={() => {
                    Keyboard.dismiss();
                    setIsInputFocused(false);
                }}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalContainer}
                >
                    {/* Backdrop */}
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={() => {
                            Keyboard.dismiss();
                            setIsInputFocused(false);
                        }}
                    />

                    {/* Input area at bottom */}
                    <View style={[styles.modalInputContainer, { backgroundColor: colors.surface }]}>
                        {/* Reply indicator with message preview */}
                        {replyingTo && (
                            <View style={[styles.replyIndicator, { backgroundColor: colors.primary + '10' }]}>
                                <View style={styles.replyContent}>
                                    <Text style={[styles.replyIndicatorText, { color: colors.primary }]} numberOfLines={1}>
                                        Répondre à {replyingTo.author?.display_name || 'utilisateur'}
                                    </Text>
                                    <Text style={[styles.replyMessagePreview, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {replyingTo.content}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={cancelReply}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <X size={16} color={colors.primary} />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Input with button inside */}
                        <View style={[
                            styles.modalInputPill,
                            { backgroundColor: colors.gray100 }
                        ]}>
                            <TextInput
                                ref={inputRef}
                                style={[styles.modalInput, { color: colors.textPrimary }]}
                                placeholder={replyingTo ? "Votre réponse..." : "Ajouter un commentaire..."}
                                placeholderTextColor={colors.gray400}
                                value={commentText}
                                onChangeText={setCommentText}
                                multiline
                                maxLength={1000}
                                autoFocus
                                blurOnSubmit={false}
                            />
                            {/* Send button inside input */}
                            <View
                                style={[
                                    styles.modalSendButton,
                                    {
                                        backgroundColor: commentText.trim() && !submitting
                                            ? colors.primary
                                            : colors.gray300,
                                    }
                                ]}
                                onTouchEnd={(e) => {
                                    e.stopPropagation();
                                    if (commentText.trim() && !submitting) {
                                        isSubmittingRef.current = true;
                                        handleSubmit();
                                    }
                                }}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                                ) : (
                                    <Send size={16} color={colors.textOnPrimary} />
                                )}
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: SPACING.sm,
    },
    loadingContainer: {
        padding: SPACING.lg,
        alignItems: 'center',
    },
    commentsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: SPACING.sm,
        gap: SPACING.xs,
    },
    commentsTitle: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    commentsList: {
        marginBottom: SPACING.sm,
    },
    showMoreContainer: {
        position: 'relative',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        marginTop: SPACING.xs,
    },
    showMoreLine: {
        position: 'absolute',
        left: 19, // Align with thread line (AVATAR_SIZE/2 - LINE_WIDTH/2 = 40/2 - 1)
        top: 0,
        width: 2,
        height: '100%',
    },
    showMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER.radius.full,
        gap: SPACING.xs,
    },
    showMoreText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    inputSection: {
        paddingTop: SPACING.sm,
    },
    inlineInputPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: BORDER.radius.xl,
        paddingLeft: SPACING.md,
        paddingRight: SPACING.xs,
        paddingVertical: SPACING.xs,
        minHeight: 44,
    },
    inputPlaceholder: {
        flex: 1,
        fontSize: TYPOGRAPHY.fontSize.sm,
        paddingVertical: SPACING.sm,
    },
    inlineSendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    modalInputContainer: {
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.08)',
    },
    modalInputPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BORDER.radius.lg,
        paddingLeft: SPACING.sm,
        paddingRight: 4,
        paddingVertical: 4,
        minHeight: 40,
    },
    modalInput: {
        flex: 1,
        fontSize: TYPOGRAPHY.fontSize.sm,
        paddingTop: 0,
        paddingBottom: 0,
        paddingVertical: 8,
        maxHeight: 80,
        marginRight: SPACING.xs,
    },
    modalSendButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    replyIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.sm,
        borderRadius: BORDER.radius.sm,
        marginBottom: SPACING.xs,
    },
    replyContent: {
        flex: 1,
        marginRight: SPACING.sm,
    },
    replyIndicatorText: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    replyMessagePreview: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        marginTop: 2,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: SPACING.sm,
    },
    inputPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BORDER.radius.xl,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderWidth: 2,
        minHeight: 44,
    },
    input: {
        flex: 1,
        fontSize: TYPOGRAPHY.fontSize.sm,
        paddingTop: 0,
        paddingBottom: 0,
        marginVertical: SPACING.xs,
        maxHeight: 100,
        textAlignVertical: 'center',
    },
    sendButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: SPACING.xs,
    },
    sendButtonOuter: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default CommentSection;
