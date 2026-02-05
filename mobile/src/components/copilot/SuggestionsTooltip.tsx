/**
 * SuggestionsTooltip Component
 * Displays AI-generated intent suggestions in a floating tooltip
 * with refresh functionality (3 max per hour)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Dimensions,
    Animated,
} from 'react-native';
import { RefreshCw, X, Lightbulb } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { copilotService, CopilotMode } from '../../services/copilotService';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../constants/theme';

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
    const isOrg = !!user?.organizationMemberships && user.organizationMemberships.length > 0;

    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [fadeAnim] = useState(new Animated.Value(0));

    // Get default suggestions based on mode and user type
    const getDefaultSuggestions = useCallback(() => {
        if (mode === 'study') {
            return isOrg
                ? ['Analyser l\'engagement', 'Gérer les ressources', 'Optimiser la formation', 'Synthèse des membres']
                : ['Élucider ce concept', 'Évaluer mes acquis', 'Synthétiser la session', 'Approfondir la leçon'];
        } else {
            return isOrg
                ? ['Statistiques d\'excellence', 'Découvrir des talents', 'Raffiner une annonce', 'Convier des membres']
                : ['Explorer les opportunités', 'Bonifier mon profil', 'Institutions partenaires', 'Écosystèmes de croissance'];
        }
    }, [mode, isOrg]);

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

    const loadAISuggestions = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await copilotService.getSuggestions(
                mode,
                sessionId || undefined
            );
            setSuggestions(result.suggestions);
        } catch (error) {
            console.error('Failed to load suggestions:', error);
            setSuggestions(getDefaultSuggestions());
        } finally {
            setIsLoading(false);
        }
    }, [mode, sessionId, getDefaultSuggestions]);

    const handleRefresh = useCallback(async () => {
        if (isLoading) return;
        await loadAISuggestions();
    }, [isLoading, loadAISuggestions]);

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
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <Animated.View
                    style={[
                        styles.tooltip,
                        {
                            backgroundColor: withOpacity(colors.surface, 0.95), // Slight transparency for glass effect
                            borderColor: withOpacity(colors.primary, 0.2), // Subtle primary border
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
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTitle}>
                            <Lightbulb size={ICON.size.sm} color={colors.primary} />
                            <Text style={[styles.title, { color: colors.textPrimary }]}>
                                Suggestions
                            </Text>
                        </View>
                        <View style={styles.headerActions}>
                            {/* Refresh button */}
                            <TouchableOpacity
                                style={[
                                    styles.refreshButton,
                                    { borderColor: colors.borderColor },
                                ]}
                                onPress={handleRefresh}
                                disabled={isLoading}
                                activeOpacity={0.7}
                            >
                                <RefreshCw
                                    size={14}
                                    color={colors.primary}
                                    strokeWidth={ICON.strokeWidth}
                                    style={isLoading ? styles.spinning : undefined}
                                />
                            </TouchableOpacity>
                            {/* Close button */}
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={onClose}
                                activeOpacity={0.7}
                            >
                                <X size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>



                    {/* Suggestions list */}
                    <View style={styles.suggestionsContainer}>
                        {isLoading ? (
                            <View style={styles.loadingContainer}>
                                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                                    Chargement...
                                </Text>
                            </View>
                        ) : (
                            suggestions.map((suggestion, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.suggestionItem,
                                        {
                                            backgroundColor: withOpacity(colors.primary, 0.03),
                                            borderColor: withOpacity(colors.primary, 0.08),
                                            borderWidth: 1,
                                        },
                                        index < suggestions.length - 1 && { marginBottom: SPACING.xs },
                                    ]}
                                    onPress={() => handleSelectSuggestion(suggestion)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.suggestionIcon, { backgroundColor: withOpacity(colors.primary, 0.12) }]}>
                                        <Lightbulb size={12} color={colors.primary} />
                                    </View>
                                    <Text
                                        style={[styles.suggestionText, { color: colors.textPrimary }]}
                                        numberOfLines={1}
                                    >
                                        {suggestion}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </Animated.View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'flex-end',
    },
    tooltip: {
        position: 'absolute',
        borderRadius: BORDER.radius.xl,
        borderWidth: 1.5,
        padding: SPACING.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
        paddingHorizontal: SPACING.xs,
    },
    headerTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    title: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontFamily: TYPOGRAPHY.fontFamily.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    refreshButton: {
        padding: 6,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: 'transparent',
    },
    closeButton: {
        padding: 6,
        borderRadius: 20,
    },
    suggestionsContainer: {
        gap: SPACING.xs,
    },
    loadingContainer: {
        paddingVertical: SPACING.lg,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        fontStyle: 'italic',
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.sm,
        borderRadius: BORDER.radius.md,
        gap: SPACING.sm,
    },
    suggestionIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    suggestionText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        flex: 1,
    },
});

export default SuggestionsTooltip;
