import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
} from 'react-native';
import {
    MapPin,
    Users,
    SquarePen,
    Trash2,
    Bookmark,
    BookmarkCheck,
    Eye,
    Clock,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT, OPACITY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatCompactNumber } from '../../utils/number';
import { SPACE_TYPE_LABELS, formatPrice } from '../../constants/space';
import { getFullImageUrl } from '../../utils/image';
import type { Space } from '../../services/spaceService';

interface StatusOverlay {
    label: string;
    color: string;
    bgColor: string;
    icon?: React.ReactNode;
}

interface SpaceCardProps {
    space: Space;
    onPress: () => void;
    isBookmarked?: boolean;
    onBookmarkToggle?: () => void;
    showBookmark?: boolean;
    showMoreAction?: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
    onViewBookings?: () => void;
    isLast?: boolean;
    isManagement?: boolean;
    statusOverlay?: StatusOverlay;
}

export const SpaceCard: React.FC<SpaceCardProps> = ({
    space,
    onPress,
    isBookmarked = false,
    onBookmarkToggle,
    showBookmark = false,
    showMoreAction = false,
    onEdit,
    onDelete,
    onViewBookings,
    isLast = false,
    isManagement = false,
    statusOverlay,
}) => {
    const { colors } = useTheme();

    // Get the best price to display
    const getDisplayPrice = (): { text: string; isFree: boolean } => {
        if (space.hourly_rate && space.hourly_rate > 0) return { text: formatPrice(space.hourly_rate) + '/h', isFree: false };
        if (space.daily_rate && space.daily_rate > 0) return { text: formatPrice(space.daily_rate) + '/j', isFree: false };
        if (space.weekly_rate && space.weekly_rate > 0) return { text: formatPrice(space.weekly_rate) + '/sem', isFree: false };
        if (space.monthly_rate && space.monthly_rate > 0) return { text: formatPrice(space.monthly_rate) + '/mois', isFree: false };
        return { text: 'Gratuit', isFree: true };
    };

    const displayPrice = getDisplayPrice();

    return (
        <TouchableOpacity
            style={[
                styles.container,
                { backgroundColor: withOpacity(colors.primary, OPACITY['08']), borderColor: withOpacity(colors.primary, OPACITY[15]) },
                isLast && styles.noBorder,
            ]}
            activeOpacity={0.8}
            onPress={onPress}
        >
            <View style={styles.imageContainer}>
                {space.cover_image_url ? (
                    <Image
                        source={{ uri: getFullImageUrl(space.cover_image_url) || '' }}
                        style={styles.image}
                    />
                ) : (
                    <View style={[styles.imagePlaceholder, { backgroundColor: colors.gray100 }]}>
                        <MapPin size={ICON.size.xl} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                    </View>
                )}

                <View style={styles.badgesRow}>
                    {space.type && (
                        <View style={[styles.typeBadge, { backgroundColor: colors.primary }]}>
                            <Text style={[styles.typeBadgeText, { color: colors.textOnPrimary }]}>
                                {SPACE_TYPE_LABELS[space.type as keyof typeof SPACE_TYPE_LABELS] || space.type}
                            </Text>
                        </View>
                    )}
                    {isManagement && space.status === 'ACTIVE' && (
                        <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
                            <Text style={[styles.statusBadgeText, { color: colors.textOnPrimary }]}>Actif</Text>
                        </View>
                    )}
                    {isManagement && space.status === 'INACTIVE' && (
                        <View style={[styles.statusBadge, { backgroundColor: colors.gray400 }]}>
                            <Text style={[styles.statusBadgeText, { color: colors.textOnPrimary }]}>Inactif</Text>
                        </View>
                    )}
                    {isManagement && space.status === 'MAINTENANCE' && (
                        <View style={[styles.statusBadge, { backgroundColor: colors.warning }]}>
                            <Text style={[styles.statusBadgeText, { color: colors.textOnPrimary }]}>Maintenance</Text>
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
                            {space.name}
                        </Text>
                        {space.organization?.name && (
                            <Text style={[styles.orgName, { color: colors.textSecondary }]} numberOfLines={1}>
                                {space.organization.name}
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

                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <Users size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                        <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                            {formatCompactNumber(space.capacity || 0)} {(space.capacity || 0) <= 1 ? 'place' : 'places'}
                        </Text>
                    </View>
                    <View style={styles.detailItem}>
                        <MapPin size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                        <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {space.city && space.country ? `${space.city}, ${space.country}` : space.city || 'Non specifie'}
                        </Text>
                    </View>
                    {isManagement ? (
                        <View style={styles.detailItem}>
                            <Eye size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                {formatCompactNumber(space.views_count || 0)} {(space.views_count || 0) <= 1 ? 'vue' : 'vues'}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.detailItem}>
                            <Clock size={14} color={displayPrice.isFree ? colors.success : colors.primary} strokeWidth={ICON.strokeWidth} />
                            <Text style={[styles.detailText, { color: displayPrice.isFree ? colors.success : colors.primary, fontWeight: '600' }]}>
                                {displayPrice.text}
                            </Text>
                        </View>
                    )}
                </View>

            </View>
        </TouchableOpacity>
    );
};

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
        height: LAYOUT.cardImageHeightSm + 20,
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
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: SPACING.lg,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
    },
});
