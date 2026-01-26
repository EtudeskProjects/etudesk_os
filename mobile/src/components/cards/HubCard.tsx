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
    Star,
    SquarePen,
    Trash2,
    Bookmark,
    BookmarkCheck,
    Eye,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatCompactNumber } from '../../utils/number';
import type { Hub } from '../../types/models';
import { HUB_TYPE_LABELS } from '../../types/models';

interface HubCardProps {
    hub: Hub;
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
}

export const HubCard: React.FC<HubCardProps> = ({
    hub,
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
}) => {
    const { colors } = useTheme();

    return (
        <TouchableOpacity
            style={[
                styles.container,
                { backgroundColor: colors.primary + '08', borderColor: colors.primary + '15' },
                isLast && styles.noBorder,
            ]}
            activeOpacity={0.8}
            onPress={onPress}
        >
            <View style={styles.imageContainer}>
                {(hub.image_url || (hub as any).images?.[0]) ? (
                    <Image
                        source={{ uri: hub.image_url || (hub as any).images?.[0] }}
                        style={styles.image}
                    />
                ) : (
                    <View style={[styles.imagePlaceholder, { backgroundColor: colors.gray100 }]}>
                        <MapPin size={ICON.size.xl} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                    </View>
                )}

                <View style={styles.badgesRow}>
                    {hub.type && (
                        <View style={[styles.typeBadge, { backgroundColor: colors.primary }]}>
                            <Text style={styles.typeBadgeText}>
                                {HUB_TYPE_LABELS[hub.type as keyof typeof HUB_TYPE_LABELS] || hub.type}
                            </Text>
                        </View>
                    )}
                    {isManagement && (
                        <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
                            <Text style={styles.statusBadgeText}>Active</Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <View style={styles.mainInfo}>
                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                            {hub.name}
                        </Text>
                        {hub.organization?.name && (
                            <Text style={[styles.orgName, { color: colors.textSecondary }]} numberOfLines={1}>
                                {hub.organization.name}
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
                            {formatCompactNumber(hub.capacity || 0)} {(hub.capacity || 0) <= 1 ? 'place' : 'places'}
                        </Text>
                    </View>
                    <View style={styles.detailItem}>
                        <MapPin size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                        <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {hub.city && hub.country ? `${hub.city}, ${hub.country}` : hub.city || 'Non spécifié'}
                        </Text>
                    </View>
                    {isManagement ? (
                        <View style={styles.detailItem}>
                            <Eye size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                {formatCompactNumber((hub as any).views_count || 0)} {((hub as any).views_count || 0) <= 1 ? 'vue' : 'vues'}
                            </Text>
                        </View>
                    ) : (hub as any).rating && (
                        <View style={styles.detailItem}>
                            <Star size={14} color={colors.warning} fill={colors.warning} strokeWidth={ICON.strokeWidth} />
                            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                {(hub as any).rating.toFixed(1)}
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
        height: 140,
        backgroundColor: COLORS.gray100,
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
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
        color: COLORS.white,
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: BORDER.radius.xs,
    },
    statusBadgeText: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
        color: COLORS.white,
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
