import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
} from 'react-native';
import {
    Users,
    Globe,
    SquarePen,
    Trash2,
    Monitor,
    MapPin,
    Bookmark,
    BookmarkCheck,
    Eye,
    Lock,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT, OPACITY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatCompactNumber } from '../../utils/number';
import { getFullImageUrl } from '../../utils/image';
import type { Community } from '../../types/models';
import { COMMUNITY_TYPE_LABELS, VISIBILITY_LABELS } from '../../types/models';

interface StatusOverlay {
    label: string;
    color: string;
    bgColor: string;
    icon?: React.ReactNode;
}

interface CommunityCardProps {
    community: Community;
    onPress: () => void;
    isBookmarked?: boolean;
    onBookmarkToggle?: () => void;
    showBookmark?: boolean;
    showMoreAction?: boolean;
    onMorePress?: () => void;
    isMenuVisible?: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
    isLast?: boolean;
    isManagement?: boolean;
    statusOverlay?: StatusOverlay;
}

export const CommunityCard: React.FC<CommunityCardProps> = React.memo(({
    community,
    onPress,
    isBookmarked = false,
    onBookmarkToggle,
    showBookmark = false,
    showMoreAction = false,
    onMorePress,
    isMenuVisible = false,
    onEdit,
    onDelete,
    isLast = false,
    isManagement = false,
    statusOverlay,
}) => {
    const { colors } = useTheme();

    const getTypeIcon = () => {
        switch (community.type) {
            case 'ONLINE':
                return <Monitor size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />;
            case 'HYBRID':
                return <MapPin size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />;
            default:
                return <Globe size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />;
        }
    };

    const getTypeText = () => {
        if (!community.type) return getVisibilityText();
        return COMMUNITY_TYPE_LABELS[community.type as keyof typeof COMMUNITY_TYPE_LABELS] || getVisibilityText();
    };

    const getVisibilityText = () => {
        const accessType = (community as any).access_type || 'PUBLIC';
        return VISIBILITY_LABELS[accessType as keyof typeof VISIBILITY_LABELS] || accessType;
    };

    const isPrivateCommunity = () => {
        const accessType = (community as any).access_type || 'PUBLIC';
        return accessType === 'PRIVATE' || accessType === 'MEMBERSHIP';
    };

    return (
        <TouchableOpacity
            style={[
                styles.container,
                { backgroundColor: withOpacity(colors.primary, OPACITY[8]), borderColor: withOpacity(colors.primary, OPACITY[15]) },
                isLast && styles.noBorder,
            ]}
            activeOpacity={0.8}
            onPress={onPress}
        >
            <View style={styles.imageContainer}>
                {community.cover_image_url || (community.images && community.images.length > 0) ? (
                    <Image
                        source={{ uri: getFullImageUrl(community.cover_image_url || community.images?.[0]) || '' }}
                        style={styles.image}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.imagePlaceholder, { backgroundColor: colors.gray100 }]}>
                        <Users size={ICON.size.xl} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                    </View>
                )}

                <View style={styles.badgesRow}>
                    {community.type && (
                        <View style={[styles.typeBadge, { backgroundColor: colors.primary }]}>
                            <Text style={[styles.typeBadgeText, { color: colors.textOnPrimary }]}>
                                {COMMUNITY_TYPE_LABELS[community.type as keyof typeof COMMUNITY_TYPE_LABELS] || community.type}
                            </Text>
                        </View>
                    )}
                    {/* Visibility badge */}
                    <View style={[styles.visibilityBadge, {
                        backgroundColor: isPrivateCommunity() ? colors.warning : colors.success
                    }]}>
                        {isPrivateCommunity() ? (
                            <Lock size={ICON.size.xxs} color={colors.textOnPrimary} strokeWidth={2.5} />
                        ) : (
                            <Globe size={ICON.size.xxs} color={colors.textOnPrimary} strokeWidth={2.5} />
                        )}
                        <Text style={[styles.visibilityBadgeText, { color: colors.textOnPrimary }]}>
                            {getVisibilityText()}
                        </Text>
                    </View>
                    {isManagement && (
                        <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
                            <Text style={[styles.statusBadgeText, { color: colors.textOnPrimary }]}>Active</Text>
                        </View>
                    )}
                </View>

                {statusOverlay && (
                    <View style={styles.statusOverlayRow}>
                        <View style={[styles.statusOverlayBadge, { backgroundColor: colors.surface }]}>
                            {statusOverlay.icon}
                            <Text style={[styles.statusOverlayText, { color: statusOverlay.color }]}>
                                {statusOverlay.label}
                            </Text>
                        </View>
                    </View>
                )}
            </View>

            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <View style={styles.mainInfo}>
                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                            {community.name}
                        </Text>
                        {community.organization?.name && (
                            <Text style={[styles.orgName, { color: colors.textSecondary }]} numberOfLines={1}>
                                {community.organization.name}
                            </Text>
                        )}
                    </View>
                    {showBookmark && onBookmarkToggle && !showMoreAction && (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={onBookmarkToggle}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            {isBookmarked ? (
                                <BookmarkCheck size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} fill={colors.primary} />
                            ) : (
                                <Bookmark size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                            )}
                        </TouchableOpacity>
                    )}
                    {showMoreAction && (
                        <>
                            {onEdit && (
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={onEdit}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <SquarePen size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                                </TouchableOpacity>
                            )}
                            {onDelete && (
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={onDelete}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Trash2 size={ICON.size.md} color={colors.error} strokeWidth={ICON.strokeWidth} />
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
                {community.description && (
                    <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
                        {community.description}
                    </Text>
                )}

                <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                        <Users size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                            {formatCompactNumber(community.members_count || 0)} {(community.members_count || 0) <= 1 ? 'membre' : 'membres'}
                        </Text>
                    </View>
                    {isManagement ? (
                        <>
                            <View style={styles.metaItem}>
                                <MapPin size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                                    {community.city && community.country
                                        ? `${community.city}, ${community.country}`
                                        : community.city || 'En ligne'}
                                </Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Eye size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                                    {formatCompactNumber((community as any).views_count || 0)} {((community as any).views_count || 0) <= 1 ? 'vue' : 'vues'}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <View style={styles.metaItem}>
                            {getTypeIcon()}
                            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                                {getTypeText()}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
});

// Display name for debugging
CommunityCard.displayName = 'CommunityCard';

const styles = StyleSheet.create({
    container: {
        borderRadius: BORDER.radius.sm,
        overflow: 'hidden',
        borderWidth: BORDER.width.thin,
        marginBottom: SPACING.md,
    },
    noBorder: {
        borderWidth: 0,
        borderRadius: 0,
    },
    imageContainer: {
        height: LAYOUT.cardImageHeightSm,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    imagePlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgesRow: {
        position: 'absolute',
        bottom: SPACING.sm,
        left: SPACING.sm,
        flexDirection: 'row',
        gap: SPACING.xs,
    },
    typeBadge: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: BORDER.radius.xs,
    },
    typeBadgeText: {
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    statusBadge: {
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.sm,
        borderRadius: BORDER.radius.xs,
    },
    statusBadgeText: {
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    visibilityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xxs,
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.sm,
        borderRadius: BORDER.radius.xs,
    },
    visibilityBadgeText: {
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    statusOverlayRow: {
        position: 'absolute',
        top: SPACING.sm,
        right: SPACING.sm,
    },
    statusOverlayBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.sm,
        borderRadius: BORDER.radius.full,
    },
    statusOverlayText: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    mainInfo: {
        flex: 1,
    },
    actionButton: {
        padding: SPACING.xs,
    },
    content: {
        padding: SPACING.md,
    },
    name: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    orgName: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        marginTop: 2,
    },
    description: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        marginTop: 4,
        lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
    },
    metaRow: {
        flexDirection: 'row',
        gap: SPACING.lg,
        marginTop: SPACING.md,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    metaText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
    },
});
