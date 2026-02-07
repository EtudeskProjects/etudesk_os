import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert, TouchableOpacity, BackHandler, Platform, KeyboardAvoidingView, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, MapPin, Clock, Save, SquarePen, X } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../../src/constants/theme';
import { useTheme } from '../../../../src/hooks/useTheme';
import { Button, Input, Toggle } from '../../../../src/components/ui';
import { communityActivityService } from '../../../../src/services';

export default function CreateEventScreen() {
    const { id, activityId } = useLocalSearchParams<{ id: string; activityId?: string }>();
    const router = useRouter();
    const { colors } = useTheme();

    // Edit mode - when activityId is provided, we're editing an existing event
    const isEditMode = !!activityId;

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [isOnline, setIsOnline] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Dates
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date(new Date().getTime() + 3600000)); // +1 hour

    // Date Picker state
    const [showPicker, setShowPicker] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');
    const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
    const [tempDate, setTempDate] = useState(new Date());

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingDraft, setIsLoadingDraft] = useState(true);

    // Draft state
    const [existingDraftId, setExistingDraftId] = useState<string | null>(null);
    const [hasDraft, setHasDraft] = useState(false);
    const [initialTitle, setInitialTitle] = useState('');

    // Track unsaved changes
    useEffect(() => {
        const hasChanges = title !== initialTitle || description.trim().length > 0 || location.trim().length > 0;
        setHasUnsavedChanges(hasChanges);
    }, [title, description, location, initialTitle]);

    // Load existing draft or activity on mount
    useEffect(() => {
        const loadData = async () => {
            if (!id) return;
            try {
                setIsLoadingDraft(true);

                // If we're in edit mode, load the existing activity
                if (isEditMode && activityId) {
                    const response = await communityActivityService.getActivityDetails(activityId);
                    if (response?.activity) {
                        const activity = response.activity;
                        setDescription(activity.content || '');
                        if (activity.metadata) {
                            const meta = activity.metadata as any;
                            if (meta.title) {
                                setTitle(meta.title);
                                setInitialTitle(meta.title);
                            }
                            if (meta.location) setLocation(meta.location);
                            if (meta.location_type === 'ONLINE') setIsOnline(true);
                            if (meta.start_date) setStartDate(new Date(meta.start_date));
                            if (meta.end_date) setEndDate(new Date(meta.end_date));
                        }
                    }
                } else {
                    // Load draft for new events
                    const response = await communityActivityService.getDraftByType(id, 'EVENT');
                    if (response?.data) {
                        const draft = response.data;
                        setExistingDraftId(draft.id);
                        setHasDraft(true);
                        setDescription(draft.content || '');
                        if (draft.metadata) {
                            const meta = draft.metadata as any;
                            if (meta.title) {
                                setTitle(meta.title);
                                setInitialTitle(meta.title);
                            }
                            if (meta.location) setLocation(meta.location);
                            if (meta.location_type === 'ONLINE') setIsOnline(true);
                            if (meta.start_date) setStartDate(new Date(meta.start_date));
                            if (meta.end_date) setEndDate(new Date(meta.end_date));
                        }
                    }
                }
            } catch (error) {
            } finally {
                setIsLoadingDraft(false);
            }
        };
        loadData();
    }, [id, isEditMode, activityId]);

    // Handle back button with confirmation
    const handleBack = useCallback(() => {
        if (hasUnsavedChanges && !isSubmitting) {
            Alert.alert(
                'Modifications non sauvegardées',
                'Voulez-vous quitter sans sauvegarder ?',
                [
                    { text: 'Continuer', style: 'cancel' },
                    { text: 'Quitter', style: 'destructive', onPress: () => router.back() },
                ]
            );
            return true;
        }
        router.back();
        return true;
    }, [hasUnsavedChanges, isSubmitting, router]);

    // Android back button handler
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (hasUnsavedChanges && !isSubmitting) {
                handleBack();
                return true;
            }
            return false;
        });
        return () => backHandler.remove();
    }, [hasUnsavedChanges, isSubmitting, handleBack]);

    const handleDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowPicker(false);
        }
        if (selectedDate) {
            setTempDate(selectedDate);
            // On Android, confirm immediately
            if (Platform.OS === 'android') {
                confirmDateSelection(selectedDate);
            }
        }
    };

    const confirmDateSelection = (dateToConfirm?: Date) => {
        const selectedDate = dateToConfirm || tempDate;

        if (pickerTarget === 'start') {
            setStartDate(selectedDate);
            // Auto update end date if it becomes before start date
            if (selectedDate > endDate) {
                setEndDate(new Date(selectedDate.getTime() + 3600000));
            }
        } else {
            if (selectedDate < startDate) {
                Alert.alert("Erreur", "La date de fin ne peut pas être avant la date de début");
                return;
            }
            setEndDate(selectedDate);
        }
        setShowPicker(false);
    };

    const openPicker = (target: 'start' | 'end', mode: 'date' | 'time') => {
        setPickerTarget(target);
        setPickerMode(mode);
        setTempDate(target === 'start' ? startDate : endDate);
        setShowPicker(true);
    };

    const handleSaveAsDraft = async () => {
        if (!title.trim()) {
            Alert.alert('Erreur', 'Veuillez ajouter un titre pour sauvegarder.');
            return;
        }

        try {
            setIsSubmitting(true);
            const metadata = {
                title: title.trim(),
                location,
                location_type: (isOnline ? 'ONLINE' : 'IN_PERSON') as 'ONLINE' | 'IN_PERSON',
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
            };

            if (existingDraftId) {
                await communityActivityService.updateDraft(existingDraftId, {
                    content: description,
                    metadata,
                });
            } else {
                await communityActivityService.createActivity(id!, {
                    community_id: id!,
                    type: 'EVENT',
                    content: description,
                    metadata,
                    is_draft: true,
                });
            }

            setHasUnsavedChanges(false);
            Alert.alert('Succès', 'Brouillon sauvegardé !', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error: any) {
            const message = error?.response?.data?.error || error?.message || 'Impossible de sauvegarder le brouillon.';
            Alert.alert('Erreur', message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!title.trim() || (!isOnline && !location.trim())) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
            return;
        }

        try {
            setIsSubmitting(true);
            const metadata = {
                title: title.trim(),
                location,
                location_type: (isOnline ? 'ONLINE' : 'IN_PERSON') as 'ONLINE' | 'IN_PERSON',
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
            };

            if (isEditMode && activityId) {
                // Update existing activity
                await communityActivityService.updateActivity(activityId, {
                    content: description,
                    metadata,
                });
            } else if (existingDraftId) {
                await communityActivityService.updateDraft(existingDraftId, {
                    content: description,
                    metadata,
                });
                await communityActivityService.publishDraft(existingDraftId);
            } else {
                await communityActivityService.createActivity(id!, {
                    community_id: id!,
                    type: 'EVENT',
                    content: description,
                    metadata,
                });
            }

            setHasUnsavedChanges(false);
            Alert.alert('Succès', isEditMode ? 'Votre événement a été modifié !' : 'Votre événement a été créé !', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error: any) {
            console.error('Failed to save event:', error);
            const message = error?.response?.data?.error || error?.message || 'Impossible de sauvegarder l\'événement.';
            Alert.alert('Erreur', message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    if (isLoadingDraft) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
                <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
                    <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
                        <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Événement</Text>
                    <View style={{ width: 44 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <Text style={{ color: colors.textSecondary }}>Chargement...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
                <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
                    <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                    {isEditMode ? 'Modifier l\'événement' : hasDraft ? 'Brouillon' : 'Créer un événement'}
                </Text>
                <View style={{ width: 44 }} />
            </View>

            {!isEditMode && hasDraft && (
                <View style={[styles.draftBanner, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                    <SquarePen size={14} color={colors.primary} />
                    <Text style={[styles.draftBannerText, { color: colors.primary }]}>
                        Modifications non publiées
                    </Text>
                </View>
            )}

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <Input
                    label="Titre de l'événement"
                    placeholder="Ex: Conférence sur l'IA"
                    value={title}
                    onChangeText={setTitle}
                    containerStyle={styles.inputContainer}
                />

                <Input
                    label="Lieu"
                    placeholder="Ex: Paris ou Lien Zoom"
                    value={location}
                    onChangeText={setLocation}
                    leftIcon={<MapPin size={20} color={colors.gray500} />}
                    containerStyle={styles.inputContainer}
                />

                <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>En ligne</Text>
                    <Toggle value={isOnline} onValueChange={setIsOnline} />
                </View>

                {/* Date Selection */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Date et heure</Text>

                    <View style={styles.dateRow}>
                        <View style={styles.dateCol}>
                            <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Début</Text>
                            <TouchableOpacity onPress={() => openPicker('start', 'date')} style={[styles.dateButton, { borderColor: colors.borderColor }]}>
                                <Calendar size={18} color={colors.primary} />
                                <Text style={{ color: colors.textPrimary }}>{formatDate(startDate)}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => openPicker('start', 'time')} style={[styles.dateButton, { borderColor: colors.borderColor, marginTop: 8 }]}>
                                <Clock size={18} color={colors.primary} />
                                <Text style={{ color: colors.textPrimary }}>{formatTime(startDate)}</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.dateCol}>
                            <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Fin</Text>
                            <TouchableOpacity onPress={() => openPicker('end', 'date')} style={[styles.dateButton, { borderColor: colors.borderColor }]}>
                                <Calendar size={18} color={colors.primary} />
                                <Text style={{ color: colors.textPrimary }}>{formatDate(endDate)}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => openPicker('end', 'time')} style={[styles.dateButton, { borderColor: colors.borderColor, marginTop: 8 }]}>
                                <Clock size={18} color={colors.primary} />
                                <Text style={{ color: colors.textPrimary }}>{formatTime(endDate)}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
                    <TextInput
                        style={[styles.textArea, { color: colors.textPrimary, borderColor: colors.borderColor, backgroundColor: colors.gray100 }]}
                        multiline
                        placeholder="Détails de l'événement..."
                        placeholderTextColor={colors.gray500}
                        value={description}
                        onChangeText={setDescription}
                        textAlignVertical="top"
                    />
                </View>

            </ScrollView>

            <View style={[styles.footer, { borderTopColor: colors.borderColor }]}>
                {!isEditMode && (
                    <TouchableOpacity
                        style={[styles.draftBtn, { borderColor: colors.borderColor }]}
                        onPress={handleSaveAsDraft}
                        disabled={!title.trim() || isSubmitting}
                    >
                        <Save size={18} color={colors.gray500} />
                    </TouchableOpacity>
                )}
                <View style={styles.submitBtnContainer}>
                    <Button
                        title={isEditMode ? "Modifier l'événement" : hasDraft ? "Publier l'événement" : "Créer l'événement"}
                        onPress={handleSubmit}
                        loading={isSubmitting}
                        fullWidth
                    />
                </View>
            </View>

            {/* Date/Time Picker Modal */}
            {showPicker && Platform.OS === 'ios' && (
                <Modal
                    transparent
                    animationType="fade"
                    visible={showPicker}
                    onRequestClose={() => setShowPicker(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                            <View style={[styles.modalHeader, { borderBottomColor: colors.borderColor }]}>
                                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                                    {pickerMode === 'date' ? 'Sélectionner une date' : 'Sélectionner une heure'}
                                </Text>
                                <TouchableOpacity onPress={() => setShowPicker(false)}>
                                    <X size={24} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={tempDate}
                                mode={pickerMode}
                                is24Hour={true}
                                display="spinner"
                                onChange={handleDateChange}
                                style={styles.picker}
                            />
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[styles.modalButton, { backgroundColor: colors.gray100 }]}
                                    onPress={() => setShowPicker(false)}
                                >
                                    <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>Annuler</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, { backgroundColor: colors.primary }]}
                                    onPress={() => confirmDateSelection()}
                                >
                                    <Text style={[styles.modalButtonText, { color: colors.textOnPrimary }]}>Confirmer</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Android DateTimePicker (native dialog) */}
            {showPicker && Platform.OS === 'android' && (
                <DateTimePicker
                    value={tempDate}
                    mode={pickerMode}
                    is24Hour={true}
                    display="default"
                    onChange={handleDateChange}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderBottomWidth: BORDER.width.thin,
    },
    headerButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: TYPOGRAPHY.fontSize.lg,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: SPACING.lg,
    },
    inputContainer: {
        marginBottom: SPACING.lg,
    },
    label: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
        marginBottom: SPACING.xs,
    },
    textArea: {
        minHeight: 120,
        padding: SPACING.md,
        borderRadius: BORDER.radius.sm,
        borderWidth: BORDER.width.thin,
        fontSize: TYPOGRAPHY.fontSize.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.lg,
    },
    section: {
        marginBottom: SPACING.lg,
    },
    sectionTitle: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
        marginBottom: SPACING.md,
    },
    dateRow: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    dateCol: {
        flex: 1,
    },
    dateLabel: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        marginBottom: 4,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        padding: SPACING.sm,
        borderWidth: BORDER.width.thin,
        borderRadius: BORDER.radius.sm,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        padding: SPACING.lg,
        borderTopWidth: BORDER.width.thin,
    },
    draftBtn: {
        width: 48,
        height: 48,
        borderRadius: BORDER.radius.sm,
        borderWidth: BORDER.width.thin,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitBtnContainer: {
        flex: 1,
    },
    draftBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.xs,
    },
    draftBannerText: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.lg,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: BORDER.radius.lg,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.md,
        borderBottomWidth: BORDER.width.thin,
    },
    modalTitle: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    picker: {
        height: 200,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: SPACING.sm,
        padding: SPACING.md,
    },
    modalButton: {
        flex: 1,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER.radius.md,
        alignItems: 'center',
    },
    modalButtonText: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
});
