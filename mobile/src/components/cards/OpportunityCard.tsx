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
    Clock,
    Bookmark,
    BookmarkCheck,
    Eye,
    Users,
    Edit,
    Trash2,
    Briefcase,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatRelativeTime, formatDeadline } from '../../utils/date';
import { formatCompactNumber } from '../../utils/number';
import { getFullImageUrl } from '../../utils/image';
import type { Opportunity, ContractType, WorkRhythm } from '../../types/models';
import { CONTRACT_TYPE_LABELS, WORK_RHYTHM_LABELS, LOCATION_TYPE_LABELS } from '../../types/models';

interface StatusOverlay {
    label: string;
    color: string;
    bgColor: string;
    icon?: React.ReactNode;
}

interface OpportunityCardProps {
    opportunity: Opportunity;
    onPress: () => void;
    isBookmarked?: boolean;
    onBookmarkToggle?: () => void;
    showBookmark?: boolean;
    showMoreAction?: boolean;
    onMorePress?: () => void;
    isMenuVisible?: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
    onViewCandidates?: () => void;
    showStats?: boolean;
    showStatus?: boolean;
    isLast?: boolean;
    statusOverlay?: StatusOverlay;
}


export const OpportunityCard: React.FC<OpportunityCardProps> = ({
    opportunity,
    onPress,
    isBookmarked = false,
    onBookmarkToggle,
    showBookmark = false,
    showMoreAction = false,
    onMorePress,
    isMenuVisible = false,
    onEdit,
    onDelete,
    onViewCandidates,
    showStats = false,
    showStatus = false,
    isLast = false,
    statusOverlay,
}) => {
    const { colors } = useTheme();
    const deadline = opportunity.deadline ? formatDeadline(opportunity.deadline) : null;

    const location = opportunity.locations?.[0];
    let locationLabel = '';
    
    if (opportunity.location_type === 'REMOTE') {
        locationLabel = LOCATION_TYPE_LABELS.REMOTE || 'Remote';
    } else if (opportunity.location_type === 'HYBRID') {
        const hybridLabel = LOCATION_TYPE_LABELS.HYBRID || 'Hybride';
        if (location?.city && location?.country) {
            locationLabel = `${hybridLabel} • ${location.city}, ${location.country}`;
        } else if (location?.city) {
            locationLabel = `${hybridLabel} • ${location.city}`;
        } else {
            locationLabel = hybridLabel;
        }
    } else if (opportunity.location_type === 'ON_SITE') {
        const onSiteLabel = LOCATION_TYPE_LABELS.ON_SITE || 'Sur site';
        if (location?.city && location?.country) {
            locationLabel = `${location.city}, ${location.country}`;
        } else if (location?.city) {
            locationLabel = location.city;
        } else {
            locationLabel = onSiteLabel;
        }
    } else {
        // Fallback: try to use location if available
        if (location?.city && location?.country) {
            locationLabel = `${location.city}, ${location.country}`;
        } else if (location?.city) {
            locationLabel = location.city;
        } else {
            locationLabel = LOCATION_TYPE_LABELS.REMOTE || 'Remote';
        }
    }

    return (
        <TouchableOpacity
            style={[
                styles.container,
                { backgroundColor: colors.primary + '08', borderColor: colors.primary + '15' },
                isLast && styles.lastItem,
            ]}
            activeOpacity={0.8}
            onPress={onPress}
        >
            {/* Cover Image */}
            <View style={styles.imageContainer}>
                {(opportunity.cover_image_url || (opportunity.images && opportunity.images.length > 0)) ? (
                    <Image
                        source={{ uri: getFullImageUrl(opportunity.cover_image_url || opportunity.images?.[0]) }}
                        style={styles.image}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.imagePlaceholder, { backgroundColor: colors.gray100 }]}>
                        <Briefcase size={ICON.size.xl} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                    </View>
                )}

                <View style={styles.badgesRow}>
                    {opportunity.contract_type && (
                        <View style={[styles.typeBadge, { backgroundColor: colors.primary }]}>
                            <Text style={[styles.typeBadgeText, { color: colors.textOnPrimary }]}>
                                {CONTRACT_TYPE_LABELS[opportunity.contract_type as ContractType] || opportunity.contract_type}
                            </Text>
                        </View>
                    )}
                    {showStatus && opportunity.status && (
                        <View style={[
                            styles.statusBadge,
                            { backgroundColor: opportunity.status === 'OPEN' ? colors.success : colors.warning }
                        ]}>
                            <Text style={[styles.statusBadgeText, { color: colors.textOnPrimary }]}>
                                {opportunity.status === 'OPEN' ? 'Active' : 'En pause'}
                            </Text>
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
                        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                            {opportunity.title}
                        </Text>
                        {opportunity.organization?.name && (
                            <View style={styles.orgRow}>
                                {opportunity.organization?.logo_url ? (
                                    <Image
                                        source={{ uri: opportunity.organization.logo_url }}
                                        style={styles.orgLogo}
                                    />
                                ) : (
                                    <View style={[styles.orgLogoPlaceholder, { backgroundColor: colors.gray200 }]}>
                                        <Text style={[styles.orgLogoText, { color: colors.gray500 }]}>
                                            {opportunity.organization.name.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                )}
                                <Text style={[styles.orgName, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {opportunity.organization.name}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.headerActions}>
                        {onEdit && (
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={onEdit}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Edit size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                            </TouchableOpacity>
                        )}
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
                        {showMoreAction && onDelete && (
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={onDelete}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Trash2 size={ICON.size.md} color={colors.error} strokeWidth={ICON.strokeWidth} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={styles.detailsRow}>
                    {showStats ? (
                        <>
                            <TouchableOpacity
                                style={[styles.detailItem, onViewCandidates && styles.candidatesButton]}
                                onPress={onViewCandidates}
                                disabled={!onViewCandidates}
                            >
                                <Users size={14} color={onViewCandidates ? colors.primary : colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                                <Text style={[styles.detailText, { color: onViewCandidates ? colors.primary : colors.textSecondary }]}>
                                    {formatCompactNumber(opportunity.applications_count || 0)} {(opportunity.applications_count || 0) <= 1 ? 'candidature' : 'candidatures'}
                                </Text>
                            </TouchableOpacity>
                            <View style={styles.detailItem}>
                                <MapPin size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                    {locationLabel}
                                </Text>
                            </View>
                            <View style={styles.detailItem}>
                                <Eye size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                    {formatCompactNumber(opportunity.views_count || 0)} {(opportunity.views_count || 0) <= 1 ? 'vue' : 'vues'}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <>
                            {deadline && (
                                <View style={styles.detailItem}>
                                    <Clock
                                        size={ICON.size.xs}
                                        color={deadline.isUrgent ? colors.error : colors.textSecondary}
                                        strokeWidth={ICON.strokeWidth}
                                    />
                                    <Text style={[
                                        styles.detailText,
                                        { color: deadline.isUrgent ? colors.error : colors.textSecondary }
                                    ]}>
                                        {deadline.text}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.detailItem}>
                                <MapPin size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                                    {locationLabel}
                                </Text>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </TouchableOpacity >
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: BORDER.radius.md,
        borderWidth: 1,
        marginBottom: SPACING.sm,
        overflow: 'hidden',
    },
    lastItem: {
        marginBottom: 0,
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
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    mainInfo: {
        flex: 1,
    },
    title: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
        lineHeight: TYPOGRAPHY.fontSize.md * 1.2,
    },
    orgRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        marginBottom: SPACING.xs,
        gap: 6,
    },
    orgLogo: {
        width: 18,
        height: 18,
        borderRadius: 4,
    },
    orgLogoPlaceholder: {
        width: 18,
        height: 18,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    orgLogoText: {
        fontSize: 10,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    orgName: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.xs,
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
    detailsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.md,
        marginTop: 4,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        fontSize: TYPOGRAPHY.fontSize.xs,
    },
    candidatesButton: {
        paddingVertical: 2,
        paddingHorizontal: 4,
        marginLeft: -4,
        borderRadius: BORDER.radius.xs,
    },
});
