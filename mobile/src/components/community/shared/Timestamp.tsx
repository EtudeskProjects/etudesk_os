import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { TYPOGRAPHY } from '../../../constants/theme';
import { useTheme } from '../../../hooks/useTheme';
import i18n from '../../../i18n';

interface TimestampProps {
    date: string | Date;
    prefix?: string;
}

export const formatRelativeTime = (dateInput: string | Date): string => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return i18n.t('date.compact.justNow');
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return i18n.t('date.compact.minutes', { minutes: diffInMinutes });
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return i18n.t('date.compact.hours', { hours: diffInHours });
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return i18n.t('date.compact.days', { days: diffInDays });
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        return i18n.t('date.compact.weeks', { weeks: diffInWeeks });
    }

    // Format as short date
    const localeCode = i18n.locale === 'en' ? 'en-US' : `${i18n.locale}-${i18n.locale.toUpperCase()}`;
    return date.toLocaleDateString(localeCode, {
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
