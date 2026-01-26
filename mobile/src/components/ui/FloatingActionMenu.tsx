import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Pressable, Animated } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { COLORS, SPACING, SHADOW, BORDER, TYPOGRAPHY } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export interface ActionItem {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
    color?: string;
}

interface FloatingActionMenuProps {
    actions: ActionItem[];
    visible?: boolean;
    bottomOffset?: number;
}

const ACTION_ITEM_HEIGHT = 50;
const ACTION_ITEM_SPACING = 12;

export const FloatingActionMenu: React.FC<FloatingActionMenuProps> = ({
    actions,
    visible = true,
    bottomOffset = SPACING.xl,
}) => {
    const { colors } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    // Animation values using React Native Animated API
    const progress = useRef(new Animated.Value(0)).current;
    const rotation = useRef(new Animated.Value(0)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;

    const toggleMenu = () => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        
        Animated.parallel([
            Animated.spring(progress, {
                toValue: nextState ? 1 : 0,
                useNativeDriver: true,
                tension: 120,
                friction: 15,
            }),
            Animated.spring(rotation, {
                toValue: nextState ? 1 : 0,
                useNativeDriver: true,
                tension: 120,
                friction: 15,
            }),
            Animated.timing(overlayOpacity, {
                toValue: nextState ? 0.4 : 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const handlePressItem = (action: () => void) => {
        toggleMenu();
        // Use timeout to let animation start closing before action fires
        setTimeout(action, 100);
    };

    // Main button rotation style
    const mainButtonRotation = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '45deg'],
    });

    const mainButtonAnimatedStyle = {
        transform: [{ rotate: mainButtonRotation }],
    };

    // Background overlay style
    const overlayAnimatedStyle = {
        opacity: overlayOpacity,
    };

    // Create animated Pressable component
    const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

    if (!visible) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Backdrop Overlay */}
            <AnimatedPressable
                style={[
                    styles.overlay,
                    overlayAnimatedStyle,
                    { backgroundColor: '#000' },
                    { pointerEvents: isOpen ? 'auto' : 'none' }
                ]}
                onPress={toggleMenu}
            />

            <View style={[styles.container, { bottom: bottomOffset }]}>
                {/* Action Items */}
                <View style={styles.actionsContainer} pointerEvents="box-none">
                    {actions.map((action, index) => {
                        return (
                            <ActionItemComponent
                                key={index}
                                action={action}
                                index={index}
                                progress={progress}
                                totalItems={actions.length}
                                onPress={() => handlePressItem(action.onPress)}
                                colors={colors}
                            />
                        );
                    })}
                </View>

                {/* Main FAB */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={toggleMenu}
                    style={[
                        styles.fab,
                        { backgroundColor: colors.primary },
                        SHADOW.lg,
                    ]}
                >
                    <Animated.View style={mainButtonAnimatedStyle}>
                        <Plus size={28} color={COLORS.white} />
                    </Animated.View>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const ActionItemComponent = ({
    action,
    index,
    progress,
    totalItems,
    onPress,
    colors
}: {
    action: ActionItem;
    index: number;
    progress: Animated.Value;
    totalItems: number;
    onPress: () => void;
    colors: any;
}) => {
    // Items appear from bottom to top
    const translateY = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -((index + 1) * (ACTION_ITEM_HEIGHT + ACTION_ITEM_SPACING))],
        extrapolate: 'clamp',
    });

    const scale = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.8, 1],
        extrapolate: 'clamp',
    });

    const opacity = progress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0, 1],
        extrapolate: 'clamp',
    });

    const animatedStyle = {
        transform: [{ translateY }, { scale }],
        opacity,
    };

    return (
        <Animated.View style={[styles.actionItemContainer, animatedStyle]} pointerEvents="box-none">
            <View style={[styles.labelContainer, { backgroundColor: colors.surface }, SHADOW.sm]}>
                <Text style={[styles.labelText, { color: colors.textPrimary }]}>{action.label}</Text>
            </View>
            <TouchableOpacity
                style={[
                    styles.actionButton,
                    { backgroundColor: action.color || colors.surface },
                    SHADOW.md
                ]}
                onPress={onPress}
                activeOpacity={0.8}
            >
                {action.icon}
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    container: {
        position: 'absolute',
        right: SPACING.lg,
        alignItems: 'flex-end',
        zIndex: 2,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    actionsContainer: {
        position: 'absolute',
        bottom: 8, // Center align with FAB roughly to start
        right: 0,
        width: '100%',
        alignItems: 'flex-end',
        zIndex: 1,
    },
    actionItemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        position: 'absolute',
        bottom: 0,
        right: 4, // Align centers with FAB (56 wide vs 48 wide -> 4px offset)
        height: 48,
        minWidth: 200, // Enough space for label
    },
    labelContainer: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: BORDER.radius.sm,
        marginRight: SPACING.sm,
    },
    labelText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
    },
    actionButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
