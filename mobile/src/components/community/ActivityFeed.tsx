import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, TouchableOpacity, Alert, FlatList, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CommunityActivity, ActivityType } from '../../types/activity';
import { communityActivityService } from '../../services';
import { ActivityCard } from './ActivityCard';
import { COLORS, SPACING, TYPOGRAPHY, BORDER, OPACITY, withOpacity } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../contexts/I18nContext';
import { MessageSquare, Lock } from 'lucide-react-native';
import { Button } from '../ui';

interface PaywallInfo {
    community_id: string;
    community_name: string;
    monthly_price: number;
    currency: string;
    subscription_status: string | null;
    expired_at: string | null;
}

interface ActivityFeedProps {
    communityId: string;
    userRole?: string; // 'ADMIN' | 'MEMBER'
    onActivityPress?: (activity: CommunityActivity) => void;
    onCommentPress?: (activity: CommunityActivity) => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
    communityId,
    userRole,
    onActivityPress,
    onCommentPress,
}) => {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const router = useRouter();
    const [activities, setActivities] = useState<CommunityActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [paywallInfo, setPaywallInfo] = useState<PaywallInfo | null>(null);

    const { user } = useAuth();
    // Use talentId for author comparison since backend stores talent_id as author_id
    const currentUserId = user?.talentId || user?.id || '';

    type FilterType = 'ALL' | ActivityType;
    const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

    const filterChips: { key: FilterType; label: string }[] = [
        { key: 'ALL', label: t('community.feed.all') },
        { key: 'POST', label: t('community.feed.posts') },
        { key: 'EVENT', label: t('community.feed.events') },
        { key: 'POLL', label: t('community.feed.polls') },
    ];

    const filteredActivities = useMemo(() => {
        if (activeFilter === 'ALL') return activities;
        return activities.filter(a => a.type === activeFilter);
    }, [activities, activeFilter]);

    const loadFeed = useCallback(async (refresh = false) => {
        if (refresh) {
            setRefreshing(true);
        } else {
            // Only load more if we have a nextCursor
            if (!nextCursor) return;
            setLoadingMore(true);
        }

        try {
            const cursor = refresh ? undefined : nextCursor;
            const response = await communityActivityService.getFeed(communityId, 10, cursor ?? undefined);

            // Response is { data: activities[], nextCursor: string | null }
            const feedData = response.data ?? [];
            setPaywallInfo(null); // Clear paywall on successful load
            if (refresh) {
                setActivities(feedData);
                setNextCursor(response.nextCursor ?? null);
            } else {
                setActivities((prev) => [...prev, ...feedData]);
                setNextCursor(response.nextCursor ?? null);
            }
        } catch (error: any) {
            console.error('Failed to load feed:', error);
            // Handle 402 Paywall error
            if (error?.status === 402 && error?.data?.paywall) {
                setPaywallInfo(error.data.paywall);
            } else if (error?.response?.status === 402 && error?.response?.data?.paywall) {
                setPaywallInfo(error.response.data.paywall);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, [communityId, nextCursor]);

    // Separate refresh function that doesn't depend on nextCursor
    const refreshFeed = useCallback(async () => {
        setRefreshing(true);
        try {
            const response = await communityActivityService.getFeed(communityId, 10, undefined);
            // Response is { data: activities[], nextCursor: string | null }
            setPaywallInfo(null); // Clear paywall on successful load
            setActivities(response.data ?? []);
            setNextCursor(response.nextCursor ?? null);
        } catch (error: any) {
            console.error('Failed to refresh feed:', error);
            // Handle 402 Paywall error
            if (error?.status === 402 && error?.data?.paywall) {
                setPaywallInfo(error.data.paywall);
            } else if (error?.response?.status === 402 && error?.response?.data?.paywall) {
                setPaywallInfo(error.response.data.paywall);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [communityId]);

    useEffect(() => {
        loadFeed(true);
    }, [communityId]); // Only depend on communityId, not loadFeed

    // Refresh feed when screen comes into focus (e.g., after creating a post)
    useFocusEffect(
        useCallback(() => {
            // Only refresh if component is already mounted and has loaded at least once
            if (!loading) {
                refreshFeed();
            }
        }, [communityId, loading, refreshFeed])
    );

    const handleLike = useCallback(async (activityId: string) => {
        try {
            await communityActivityService.toggleLike(activityId);
            // Optimistic update is already handled in ActivityCard
        } catch (error) {
            console.error('Like failed:', error);
        }
    }, []);

    const handleBookmark = useCallback(async (activityId: string) => {
        try {
            await communityActivityService.toggleBookmark(activityId);
            // Refresh feed to update bookmark status
            refreshFeed();
        } catch (error) {
            console.error('Bookmark failed:', error);
        }
    }, [refreshFeed]);

    const handleVote = useCallback(async (activityId: string, optionId: string) => {
        try {
            await communityActivityService.vote(activityId, optionId);
            // Optimistic update is already handled in ActivityCard
        } catch (error) {
            console.error('Vote failed:', error);
            Alert.alert(t('common.error'), t('community.feed.voteError'));
        }
    }, []);

    const handlePin = useCallback(async (activityId: string) => {
        try {
            await communityActivityService.togglePin(activityId);
            refreshFeed();
        } catch (error) {
            console.error('Toggle pin failed:', error);
            Alert.alert(t('common.error'), t('community.feed.pinError'));
        }
    }, [refreshFeed]);

    const handleDelete = useCallback((activityId: string) => {
        Alert.alert(
            t('community.feed.deleteTitle'),
            t('community.feed.deleteMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.delete'), style: 'destructive', onPress: async () => {
                    try {
                        await communityActivityService.deleteActivity(activityId);
                        refreshFeed();
                    } catch (e) {
                        Alert.alert(t('common.error'), t('community.feed.deleteError'));
                    }
                }}
            ]
        );
    }, [refreshFeed, t]);

    const handleActivityPress = useCallback((activity: CommunityActivity) => {
        // Navigate to activity detail
        router.push(`/details/community/activity/${activity.id}`);
    }, [router]);

    const handleEdit = useCallback((activity: CommunityActivity) => {
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
    }, [router]);

    const renderItem = useCallback(({ item }: { item: CommunityActivity }) => (
        <ActivityCard
            activity={item}
            currentUserId={currentUserId}
            userRole={userRole}
            onLike={handleLike}
            onBookmark={handleBookmark}
            onEdit={handleEdit}
            onPin={handlePin}
            onDelete={handleDelete}
            onPress={handleActivityPress}
            onVote={handleVote}
        />
    ), [currentUserId, userRole, handleLike, handleBookmark, handleEdit, handlePin, handleDelete, handleActivityPress, handleVote]);

    // Must be declared before any early return to keep hooks order consistent
    const handleEndReached = useCallback(() => {
        if (nextCursor && !loadingMore && !refreshing) {
            loadFeed(false);
        }
    }, [nextCursor, loadingMore, refreshing, loadFeed]);

    if (loading && !refreshing && (activities?.length ?? 0) === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    // Show Paywall if subscription is required
    if (paywallInfo) {
        const handleSubscribe = () => {
            router.push(`/details/community/${communityId}/subscribe`);
        };

        return (
            <View style={[styles.paywallContainer, { backgroundColor: colors.surface }]}>
                <View style={[styles.paywallIconContainer, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                    <Lock size={48} color={colors.primary} strokeWidth={1.5} />
                </View>
                <Text style={[styles.paywallTitle, { color: colors.textPrimary }]}>
                    {t('community.feed.subscribersOnly')}
                </Text>
                <Text style={[styles.paywallSubtext, { color: colors.textSecondary }]}>
                    {paywallInfo.subscription_status === 'EXPIRED'
                        ? t('community.feed.expiredSubscription', { name: paywallInfo.community_name })
                        : t('community.feed.subscribePrompt', { name: paywallInfo.community_name })
                    }
                </Text>
                <View style={styles.paywallPrice}>
                    <Text style={[styles.paywallPriceText, { color: colors.primary }]}>
                        {paywallInfo.monthly_price.toLocaleString()} {paywallInfo.currency}{t('community.feed.perMonth')}
                    </Text>
                </View>
                <Button
                    title={paywallInfo.subscription_status === 'EXPIRED' ? t('community.feed.renew') : t('community.feed.subscribe')}
                    onPress={handleSubscribe}
                    style={styles.paywallButton}
                />
            </View>
        );
    }

    // Using FlatList for better performance
    const renderFooter = () => {
        if (!nextCursor) return null;
        
        if (loadingMore) {
            return (
                <View style={styles.loaderFooter}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            );
        }
        
        return (
            <TouchableOpacity 
                style={[styles.loadMoreButton, { backgroundColor: colors.surface, borderColor: colors.borderColor }]} 
                onPress={() => loadFeed(false)}
            >
                <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                    {t('community.feed.loadMore')}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => {
        if (loading) return null;

        return (
            <View style={styles.emptyContainer}>
                <MessageSquare size={32} color={colors.gray300} strokeWidth={1.5} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {t('community.feed.noActivity')}
                </Text>
            </View>
        );
    };

    const renderFilterHeader = () => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
            style={styles.filterContainer}
        >
            {filterChips.map((chip) => {
                const isActive = activeFilter === chip.key;
                const count = chip.key === 'ALL' ? activities.length : activities.filter(a => a.type === chip.key).length;
                return (
                    <TouchableOpacity
                        key={chip.key}
                        style={[
                            styles.filterChip,
                            { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                            isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => setActiveFilter(chip.key)}
                    >
                        <Text
                            style={[
                                styles.filterChipText,
                                { color: colors.gray700 },
                                isActive && { color: colors.textOnPrimary },
                            ]}
                        >
                            {chip.label} ({count})
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );

    return (
        <FlatList
            data={filteredActivities}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={renderFilterHeader}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            onRefresh={refreshFeed}
            refreshing={refreshing}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            // Performance optimizations
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={7}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={50}
        />
    );
};

const styles = StyleSheet.create({
    filterContainer: {
        marginBottom: SPACING.sm,
    },
    filterContent: {
        paddingHorizontal: SPACING.lg,
        gap: SPACING.sm,
    },
    filterChip: {
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.md,
        borderWidth: BORDER.width.thin,
        borderRadius: BORDER.radius.full,
    },
    filterChipText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    listContent: {
        paddingHorizontal: 0,
        paddingVertical: SPACING.sm,
        paddingBottom: SPACING.xxl,
        flexGrow: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xxl,
    },
    loaderFooter: {
        paddingVertical: SPACING.lg,
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.xxl,
        gap: SPACING.sm,
    },
    emptyText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        textAlign: 'center',
    },
    loadMoreButton: {
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER.radius.md,
        alignItems: 'center',
        marginTop: SPACING.md,
        marginHorizontal: SPACING.lg,
        borderWidth: BORDER.width.thin,
    },
    loadMoreText: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    // Paywall styles
    paywallContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xxl,
        marginTop: SPACING.xxl,
        marginHorizontal: SPACING.lg,
        borderRadius: BORDER.radius.lg,
        borderWidth: BORDER.width.thin,
    },
    paywallIconContainer: {
        width: 96,
        height: 96,
        borderRadius: BORDER.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
    },
    paywallTitle: {
        fontSize: TYPOGRAPHY.fontSize.xl,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    paywallSubtext: {
        fontSize: TYPOGRAPHY.fontSize.md,
        textAlign: 'center',
        lineHeight: TYPOGRAPHY.fontSize.md * 1.5,
        paddingHorizontal: SPACING.md,
        marginBottom: SPACING.lg,
    },
    paywallPrice: {
        marginBottom: SPACING.lg,
    },
    paywallPriceText: {
        fontSize: TYPOGRAPHY.fontSize.xxl,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
    },
    paywallButton: {
        minWidth: 200,
    },
});
