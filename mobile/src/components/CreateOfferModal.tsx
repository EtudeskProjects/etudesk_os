import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    TouchableWithoutFeedback,
    Dimensions,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    Briefcase,
    Users,
    MapPin,
    ChevronRight,
    X,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CreateOfferModalProps {
    isVisible: boolean;
    onClose: () => void;
}

export const CreateOfferModal: React.FC<CreateOfferModalProps> = ({ isVisible, onClose }) => {
    const router = useRouter();
    const { colors } = useTheme();

    // Animation values
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 65,
                    friction: 11,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            // Reset values when not visible to prepare for next opening
            fadeAnim.setValue(0);
            slideAnim.setValue(SCREEN_HEIGHT);
        }
    }, [isVisible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => onClose());
    };

    const CREATE_OPTIONS = [
        {
            id: 'opportunity',
            label: 'Opportunité',
            description: 'Emploi, stage, mission freelance',
            icon: Briefcase,
            color: colors.primary,
            route: '/settings/organization/create-opportunity' as const,
        },
        {
            id: 'space',
            label: 'Espace',
            description: 'Salle de reunion, formation, coworking',
            icon: MapPin,
            color: colors.warning,
            route: '/settings/organization/create-space' as const,
        },
        {
            id: 'community',
            label: 'Communauté',
            description: 'Groupe, réseau, association',
            icon: Users,
            color: colors.success,
            route: '/settings/organization/create-community' as const,
        },
    ];

    return (
        <Modal
            visible={isVisible}
            transparent
            statusBarTranslucent
            onRequestClose={handleClose}
            animationType="none"
        >
            <View style={styles.modalContainer}>
                <TouchableWithoutFeedback onPress={handleClose}>
                    <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]} />
                </TouchableWithoutFeedback>
                <Animated.View
                    style={[
                        styles.modalContent,
                        {
                            backgroundColor: colors.surface,
                            transform: [{ translateY: slideAnim }],
                        }
                    ]}
                >
                    <View style={[styles.modalHandle, { backgroundColor: colors.gray300 }]} />
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Créer une offre</Text>
                            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                                Choisissez le type d'offre à publier
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={[styles.closeButton, { backgroundColor: colors.gray100 }]}>
                            <X size={ICON.size.sm} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView 
                        style={styles.modalOptionsContainer}
                        contentContainerStyle={styles.modalOptions}
                        showsVerticalScrollIndicator={false}
                    >
                        {CREATE_OPTIONS.map((option) => {
                            const IconComponent = option.icon;
                            return (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[styles.modalOptionCard, { backgroundColor: colors.background, borderColor: colors.borderColor }]}
                                    onPress={() => {
                                        handleClose();
                                        // Small delay to allow modal to close before navigating
                                        setTimeout(() => router.push(option.route), 250);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.modalOptionIconLarge, { backgroundColor: option.color + '15' }]}>
                                        <IconComponent size={28} color={option.color} strokeWidth={ICON.strokeWidth} />
                                    </View>
                                    <View style={styles.modalOptionContent}>
                                        <Text style={[styles.modalOptionTitle, { color: colors.textPrimary }]}>{option.label}</Text>
                                        <Text style={[styles.modalOptionDescription, { color: colors.textSecondary }]}>{option.description}</Text>
                                    </View>
                                    <View style={[styles.modalOptionArrow, { backgroundColor: option.color + '10' }]}>
                                        <ChevronRight size={ICON.size.sm} color={option.color} strokeWidth={ICON.strokeWidth} />
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },

    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },

    modalContent: {
        borderTopLeftRadius: BORDER.radius.xl,
        borderTopRightRadius: BORDER.radius.xl,
        paddingBottom: SPACING.xxl,
    },

    modalHandle: {
        width: LAYOUT.avatarMd,
        height: SPACING.xs,
        borderRadius: SPACING.xxs,
        alignSelf: 'center',
        marginTop: SPACING.sm,
        marginBottom: SPACING.xs,
    },

    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
    },

    modalTitle: {
        fontSize: TYPOGRAPHY.fontSize.xl,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
    },

    modalSubtitle: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        marginTop: 4,
    },

    closeButton: {
        width: 32,
        height: 32,
        borderRadius: BORDER.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
    },

    modalOptionsContainer: {
        maxHeight: SCREEN_HEIGHT * 0.5,
    },
    modalOptions: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.lg,
        gap: SPACING.sm,
    },

    modalOptionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderRadius: BORDER.radius.md,
        borderWidth: BORDER.width.thin,
    },

    modalOptionIconLarge: {
        width: 56,
        height: 56,
        borderRadius: BORDER.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },

    modalOptionContent: {
        flex: 1,
        marginLeft: SPACING.md,
    },

    modalOptionTitle: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },

    modalOptionDescription: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        marginTop: 2,
    },

    modalOptionArrow: {
        width: 32,
        height: 32,
        borderRadius: BORDER.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
