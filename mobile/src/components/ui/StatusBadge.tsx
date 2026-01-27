import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TYPOGRAPHY, SPACING, BORDER, ICON, OPACITY, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Clock, CheckCircle2, XCircle, Archive, AlertCircle } from 'lucide-react-native';

export type MemberStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'ARCHIVED';

interface StatusBadgeProps {
    status: MemberStatus;
    showIcon?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

// Status configuration using theme color keys
const getStatusConfig = (colors: ThemeColors) => ({
    PENDING: {
        color: colors.statusPending,
        icon: Clock,
        bgColor: colors.warningLight,
        label: 'En attente'
    },
    ACTIVE: {
        color: colors.statusActive,
        icon: CheckCircle2,
        bgColor: colors.successLight,
        label: 'Membre actif'
    },
    REJECTED: {
        color: colors.statusRejected,
        icon: XCircle,
        bgColor: colors.errorLight,
        label: 'Refusée'
    },
    SUSPENDED: {
        color: colors.statusSuspended,
        icon: AlertCircle,
        bgColor: colors.infoLight,
        label: 'Suspendu'
    },
    ARCHIVED: {
        color: colors.statusArchived,
        icon: Archive,
        bgColor: colors.gray100,
        label: 'Archivé'
    },
});

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    showIcon = true,
    size = 'md'
}) => {
    const { colors } = useTheme();
    const STATUS_CONFIG = getStatusConfig(colors);
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
    const StatusIcon = config.icon;

    const sizeStyles = {
        sm: {
            padding: SPACING.xs,
            fontSize: TYPOGRAPHY.fontSize.xs,
            iconSize: ICON.size.xxs,
        },
        md: {
            padding: SPACING.sm,
            fontSize: TYPOGRAPHY.fontSize.sm,
            iconSize: ICON.size.sm,
        },
        lg: {
            padding: SPACING.md,
            fontSize: TYPOGRAPHY.fontSize.md,
            iconSize: ICON.size.md,
        },
    };

    const currentSize = sizeStyles[size];

    return (
        <View style={[
            styles.badge,
            {
                backgroundColor: config.bgColor,
                padding: currentSize.padding,
            }
        ]}>
            {showIcon && (
                <StatusIcon
                    size={currentSize.iconSize}
                    color={config.color}
                    strokeWidth={ICON.strokeWidth}
                />
            )}
            <Text style={[
                styles.label,
                {
                    color: config.color,
                    fontSize: currentSize.fontSize,
                }
            ]}>
                {config.label}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        borderRadius: BORDER.radius.sm,
        alignSelf: 'flex-start',
    },
    label: {
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
});
