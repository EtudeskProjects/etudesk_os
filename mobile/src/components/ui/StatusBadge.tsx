import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TYPOGRAPHY, SPACING, BORDER, ICON, OPACITY, COMPONENT, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../contexts/I18nContext';
import { Clock, CheckCircle2, XCircle, Archive, AlertCircle } from 'lucide-react-native';

export type MemberStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'ARCHIVED';

interface StatusBadgeProps {
    status: MemberStatus;
    showIcon?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

// Status configuration using theme color keys
const getStatusConfig = (colors: ThemeColors, t: (key: string) => string) => ({
    PENDING: {
        color: colors.statusPending,
        icon: Clock,
        bgColor: colors.warningLight,
        label: t('statusBadge.pending'),
    },
    ACTIVE: {
        color: colors.statusActive,
        icon: CheckCircle2,
        bgColor: colors.successLight,
        label: t('statusBadge.active'),
    },
    REJECTED: {
        color: colors.statusRejected,
        icon: XCircle,
        bgColor: colors.errorLight,
        label: t('statusBadge.rejected'),
    },
    SUSPENDED: {
        color: colors.statusSuspended,
        icon: AlertCircle,
        bgColor: colors.infoLight,
        label: t('statusBadge.suspended'),
    },
    ARCHIVED: {
        color: colors.statusArchived,
        icon: Archive,
        bgColor: colors.gray100,
        label: t('statusBadge.archived'),
    },
});

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    showIcon = true,
    size = 'md'
}) => {
    const { colors } = useTheme();
    const { t } = useI18n();
    const STATUS_CONFIG = getStatusConfig(colors, t);
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
        borderRadius: COMPONENT.pill.borderRadius,
        alignSelf: 'flex-start',
    },
    label: {
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
});
