import React, { useState, useRef } from 'react';
import { View, StyleSheet, Text, Pressable, Animated } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { SPACING, BORDER, TYPOGRAPHY, LAYOUT, ICON, OPACITY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Tap } from './Tap';

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

const ACTION_ITEM_HEIGHT = LAYOUT.fabSizeSm;
const ACTION_ITEM_SPACING = SPACING.sm;

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
                    { backgroundColor: colors.black },
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
                <Tap
                    activeOpacity={0.9}
                    onPress={toggleMenu}
                    style={[
                        styles.fab,
                        { backgroundColor: colors.primary },
                    ]}
                >
                    <Animated.View style={mainButtonAnimatedStyle}>
                        <Plus size={ICON.size.xl} color={colors.textOnPrimary} />
                    </Animated.View>
                </Tap>
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
            <View style={[styles.labelContainer, { backgroundColor: colors.surface }]}>
                <Text style={[styles.labelText, { color: colors.textPrimary }]}>{action.label}</Text>
            </View>
            <Tap
                style={[
                    styles.actionButton,
                    { backgroundColor: action.color || colors.surface },
                ]}
                onPress={onPress}
                activeOpacity={0.8}
            >
                {action.icon}
            </Tap>
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
        width: LAYOUT.fabSize,
        height: LAYOUT.fabSize,
        borderRadius: LAYOUT.fabSize / 2,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    actionsContainer: {
        position: 'absolute',
        bottom: SPACING.sm,
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
        right: SPACING.xs,
        height: LAYOUT.fabSizeSm,
        minWidth: 200,
    },
    labelContainer: {
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.sm,
        borderRadius: BORDER.radius.sm,
        marginRight: SPACING.sm,
    },
    labelText: {
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    actionButton: {
        width: LAYOUT.fabSizeSm,
        height: LAYOUT.fabSizeSm,
        borderRadius: LAYOUT.fabSizeSm / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
