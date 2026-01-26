import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { TYPOGRAPHY } from '../../../constants/theme';
import { useTheme } from '../../../hooks/useTheme';

interface TimestampProps {
    date: string | Date;
    prefix?: string;
}

export const formatRelativeTime = (dateInput: string | Date): string => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return 'À l\'instant';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes}min`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours}h`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `${diffInDays}j`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        return `${diffInWeeks}sem`;
    }

    // Format as date
    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
    });
};

export const Timestamp: React.FC<TimestampProps> = ({ date, prefix }) => {
    const { colors } = useTheme();
    const formatted = formatRelativeTime(date);

    return (
        <Text style={[styles.text, { color: colors.textSecondary }]}>
            {prefix ? `${prefix} ` : ''}{formatted}
        </Text>
    );
};

const styles = StyleSheet.create({
    text: {
        fontSize: TYPOGRAPHY.fontSize.xs,
    },
});
