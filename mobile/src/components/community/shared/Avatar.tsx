import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { TYPOGRAPHY, LAYOUT, withOpacity, OPACITY } from '../../../constants/theme';
import { useTheme } from '../../../hooks/useTheme';

interface AvatarProps {
    uri?: string | null;
    name?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    showRing?: boolean;
    ringColor?: string;
}

const SIZES = {
    xs: LAYOUT.avatarXs,
    sm: LAYOUT.avatarSm,
    md: LAYOUT.avatarMd,
    lg: LAYOUT.avatarLg,
};

export const Avatar: React.FC<AvatarProps> = ({
    uri,
    name = '?',
    size = 'md',
    showRing = false,
    ringColor,
}) => {
    const { colors } = useTheme();
    const dimension = SIZES[size];
    const fontSize = dimension * 0.4;

    const getInitials = (fullName: string) => {
        return fullName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const avatarStyle = {
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
    };

    const ringStyle = showRing ? {
        borderWidth: 2,
        borderColor: ringColor || colors.primary,
    } : {};

    if (uri) {
        return (
            <Image
                source={{ uri }}
                style={[styles.image, avatarStyle, ringStyle, { backgroundColor: colors.gray200 }]}
            />
        );
    }

    return (
        <View style={[
            styles.placeholder,
            avatarStyle,
            ringStyle,
            { backgroundColor: withOpacity(colors.primary, OPACITY[20]) }
        ]}>
            <Text style={[styles.initials, { color: colors.primary, fontSize }]}>
                {getInitials(name)}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    image: {},
    placeholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    initials: {
        fontFamily: TYPOGRAPHY.fontFamily.semibold,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
});
