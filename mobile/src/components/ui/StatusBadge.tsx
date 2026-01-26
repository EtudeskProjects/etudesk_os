import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, BORDER } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Clock, CheckCircle2, XCircle } from 'lucide-react-native';
import { ICON } from '../../constants/theme';

export type MemberStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'ARCHIVED';

interface StatusBadgeProps {
    status: MemberStatus;
    showIcon?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

const STATUS_CONFIG: Record<MemberStatus, { 
    color: string; 
    icon: typeof Clock; 
    bgColor: string; 
    label: string;
}> = {
    PENDING: { 
        color: COLORS.warning, 
        icon: Clock, 
        bgColor: COLORS.warning + '15', 
        label: 'En attente' 
    },
    ACTIVE: { 
        color: COLORS.success, 
        icon: CheckCircle2, 
        bgColor: COLORS.success + '15', 
        label: 'Membre actif' 
    },
    REJECTED: { 
        color: COLORS.error, 
        icon: XCircle, 
        bgColor: COLORS.error + '15', 
        label: 'Refusée' 
    },
    SUSPENDED: { 
        color: COLORS.gray500, 
        icon: XCircle, 
        bgColor: COLORS.gray500 + '15', 
        label: 'Suspendu' 
    },
    ARCHIVED: { 
        color: COLORS.gray500, 
        icon: Clock, 
        bgColor: COLORS.gray500 + '15', 
        label: 'Archivé' 
    },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
    status, 
    showIcon = true,
    size = 'md'
}) => {
    const { colors } = useTheme();
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
    const StatusIcon = config.icon;

    const sizeStyles = {
        sm: {
            padding: SPACING.xs,
            fontSize: TYPOGRAPHY.fontSize.xs,
            iconSize: 12,
        },
        md: {
            padding: SPACING.sm,
            fontSize: TYPOGRAPHY.fontSize.sm,
            iconSize: 16,
        },
        lg: {
            padding: SPACING.md,
            fontSize: TYPOGRAPHY.fontSize.md,
            iconSize: 20,
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
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
});
