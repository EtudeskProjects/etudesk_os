/**
 * SuggestionsTooltip Component
 * Displays intent suggestions in a clean floating tooltip
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Dimensions,
    Animated,
    Pressable,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { CopilotMode } from '../../services/copilotService';
import { SPACING, TYPOGRAPHY, ICON, BORDER, withOpacity } from '../../constants/theme';
import { IconButton } from '../ui';


interface SuggestionsTooltipProps {
    visible: boolean;
    onClose: () => void;
    onSelectSuggestion: (suggestion: string) => void;
    mode: CopilotMode;
    sessionId?: string | null;
    anchorPosition?: { x: number; y: number };
}

export function SuggestionsTooltip({
    visible,
    onClose,
    onSelectSuggestion,
    mode,
    sessionId,
    anchorPosition,
}: SuggestionsTooltipProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { t } = useI18n();
    const isOrg = !!user?.organizationMemberships && user.organizationMemberships.length > 0;

    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [fadeAnim] = useState(new Animated.Value(0));

    // Get default suggestions based on mode and user type
    const getDefaultSuggestions = useCallback(() => {
        if (mode === 'study') {
            return isOrg
                ? (t('copilot.suggestions.orgStudy') as unknown as string[])
                : (t('copilot.suggestions.talentStudy') as unknown as string[]);
        } else {
            return isOrg
                ? (t('copilot.suggestions.orgExplore') as unknown as string[])
                : (t('copilot.suggestions.talentExplore') as unknown as string[]);
        }
    }, [mode, isOrg, t]);

    // Initial load: show defaults when visible
    useEffect(() => {
        if (visible) {
            setSuggestions(getDefaultSuggestions());
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } else {
            fadeAnim.setValue(0);
        }
    }, [visible, getDefaultSuggestions]);

    const handleSelectSuggestion = useCallback((suggestion: string) => {
        onSelectSuggestion(suggestion);
        onClose();
    }, [onSelectSuggestion, onClose]);

    if (!visible) return null;

    const screenWidth = Dimensions.get('window').width;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <Pressable
                style={[styles.overlay, { backgroundColor: colors.overlayLight }]}
                onPress={onClose}
            >
                <Animated.View
                    style={[
                        styles.tooltip,
                        {
                            backgroundColor: colors.surface,
                            borderColor: colors.borderColor,
                            opacity: fadeAnim,
                            transform: [
                                {
                                    translateY: fadeAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [15, 0],
                                    }),
                                },
                            ],
                            bottom: 125,
                            left: SPACING.md,
                            right: SPACING.md,
                            maxWidth: screenWidth - SPACING.md * 2,
                        },
                    ]}
                >
                    {/* Header — minimal */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.textSecondary }]}>
                            Suggestions
                        </Text>
                        <IconButton
                            onPress={onClose}
                            icon={<X size={16} color={colors.textSecondary} />}
                            accessibilityLabel={t('common.close')}
                            size="sm"
                            variant="ghost"
                            style={styles.closeButton}
                        />
                    </View>

                    {/* Suggestions list */}
                    <View style={styles.suggestionsContainer}>
                        {suggestions.map((suggestion, index) => (
                            <Pressable
                                key={index}
                                style={({ pressed }) => [
                                    styles.suggestionItem,
                                    { backgroundColor: withOpacity(colors.primary, 0.04) },
                                    pressed && { backgroundColor: withOpacity(colors.primary, 0.10) },
                                ]}
                                onPress={() => handleSelectSuggestion(suggestion)}
                                accessibilityLabel={suggestion}
                            >
                                <Text
                                    style={[styles.suggestionText, { color: colors.textPrimary }]}
                                    numberOfLines={1}
                                >
                                    {suggestion}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    tooltip: {
        position: 'absolute',
        borderRadius: BORDER.radius.lg,
        borderWidth: 1,
        padding: SPACING.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
        paddingHorizontal: SPACING.xs,
    },
    title: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    closeButton: {
        padding: 4,
        borderRadius: 16,
    },
    suggestionsContainer: {
        gap: 6,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER.radius.sm,
    },
    suggestionText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
        flex: 1,
    },
});

export default SuggestionsTooltip;
