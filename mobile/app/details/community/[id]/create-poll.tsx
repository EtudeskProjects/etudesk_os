import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, TextInput, BackHandler } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, Trash2, Calendar, Clock, Save, SquarePen } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT } from '../../../../src/constants/theme';
import { useTheme } from '../../../../src/hooks/useTheme';
import { Button, Toggle } from '../../../../src/components/ui';
import { communityActivityService } from '../../../../src/services';

export default function CreatePollScreen() {
    const { id, activityId } = useLocalSearchParams<{ id: string; activityId?: string }>();
    const router = useRouter();
    const { colors } = useTheme();

    // Edit mode - when activityId is provided, we're editing an existing poll
    const isEditMode = !!activityId;

    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']); // Start with 2 empty options
    const [multipleChoice, setMultipleChoice] = useState(false);
    const [showResults, setShowResults] = useState(true); // Show results before poll ends
    const [hasDuration, setHasDuration] = useState(false); // Has poll end date
    const [pollEndDate, setPollEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // Default: 7 days
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isLoadingDraft, setIsLoadingDraft] = useState(true);

    // Draft state
    const [existingDraftId, setExistingDraftId] = useState<string | null>(null);
    const [hasDraft, setHasDraft] = useState(false);
    const [initialQuestion, setInitialQuestion] = useState('');

    // Track unsaved changes
    useEffect(() => {
        const hasContent = question !== initialQuestion || options.some(opt => opt.trim().length > 0);
        setHasUnsavedChanges(hasContent);
    }, [question, options, initialQuestion]);

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
                        setQuestion(activity.content || '');
                        setInitialQuestion(activity.content || '');
                        if (activity.metadata) {
                            const meta = activity.metadata as any;
                            if (meta.options) setOptions(meta.options);
                            if (meta.multiple_choice !== undefined) setMultipleChoice(meta.multiple_choice);
                            if (meta.show_results !== undefined) setShowResults(meta.show_results);
                            if (meta.poll_end_date) {
                                setHasDuration(true);
                                setPollEndDate(new Date(meta.poll_end_date));
                            }
                        }
                        // Also check poll_options for existing options
                        if (activity.poll_options && activity.poll_options.length > 0) {
                            setOptions(activity.poll_options.map((opt: any) => opt.text));
                        }
                    }
                } else {
                    // Load draft for new polls
                    const response = await communityActivityService.getDraftByType(id, 'POLL');
                    if (response?.data) {
                        const draft = response.data;
                        setExistingDraftId(draft.id);
                        setHasDraft(true);
                        setQuestion(draft.content || '');
                        setInitialQuestion(draft.content || '');
                        if (draft.metadata) {
                            const meta = draft.metadata as any;
                            if (meta.options) setOptions(meta.options);
                            if (meta.multiple_choice !== undefined) setMultipleChoice(meta.multiple_choice);
                            if (meta.show_results !== undefined) setShowResults(meta.show_results);
                            if (meta.poll_end_date) {
                                setHasDuration(true);
                                setPollEndDate(new Date(meta.poll_end_date));
                            }
                        }
                    }
                }
            } catch (error) {
                console.log('Could not load data:', error);
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

    const handleOptionChange = (text: string, index: number) => {
        const newOptions = [...options];
        newOptions[index] = text;
        setOptions(newOptions);
    };

    const addOption = () => {
        if (options.length >= 10) {
            Alert.alert('Limite atteinte', 'Vous ne pouvez pas ajouter plus de 10 options.');
            return;
        }
        setOptions([...options, '']);
    };

    const removeOption = (index: number) => {
        if (options.length <= 2) {
            Alert.alert('Attention', 'Un sondage doit avoir au moins 2 options.');
            return;
        }
        const newOptions = [...options];
        newOptions.splice(index, 1);
        setOptions(newOptions);
    };

    const handleSaveAsDraft = async () => {
        if (!question.trim()) {
            Alert.alert('Erreur', 'Veuillez ajouter une question pour sauvegarder.');
            return;
        }

        try {
            setIsSubmitting(true);
            const validOptions = options.filter(opt => opt.trim().length > 0);
            const metadata: any = {
                options: validOptions.length > 0 ? validOptions : ['', ''],
                multiple_choice: multipleChoice,
                show_results: showResults,
            };
            if (hasDuration) {
                metadata.poll_end_date = pollEndDate.toISOString();
            }

            if (existingDraftId) {
                await communityActivityService.updateDraft(existingDraftId, {
                    content: question,
                    metadata,
                });
            } else {
                await communityActivityService.createActivity(id!, {
                    community_id: id!,
                    type: 'POLL',
                    content: question,
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
        if (!question.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer une question.');
            return;
        }

        const validOptions = options.filter(opt => opt.trim().length > 0);
        if (validOptions.length < 2) {
            Alert.alert('Erreur', 'Veuillez remplir au moins 2 options.');
            return;
        }

        try {
            setIsSubmitting(true);

            const metadata: any = {
                options: validOptions,
                multiple_choice: multipleChoice,
                show_results: showResults,
            };

            if (hasDuration) {
                metadata.poll_end_date = pollEndDate.toISOString();
            }

            if (isEditMode && activityId) {
                // Update existing activity
                await communityActivityService.updateActivity(activityId, {
                    content: question,
                    metadata,
                });
            } else if (existingDraftId) {
                await communityActivityService.updateDraft(existingDraftId, {
                    content: question,
                    metadata,
                });
                await communityActivityService.publishDraft(existingDraftId);
            } else {
                await communityActivityService.createActivity(id!, {
                    community_id: id!,
                    type: 'POLL',
                    content: question,
                    metadata,
                });
            }

            setHasUnsavedChanges(false);
            Alert.alert('Succès', isEditMode ? 'Votre sondage a été modifié !' : 'Votre sondage a été créé !', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error: any) {
            console.error('Failed to save poll:', error);
            const message = error?.response?.data?.error || error?.message || 'Impossible de sauvegarder le sondage.';
            Alert.alert('Erreur', message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingDraft) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
                <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
                    <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
                        <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Sondage</Text>
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
                    {isEditMode ? 'Modifier le sondage' : hasDraft ? 'Brouillon' : 'Nouveau sondage'}
                </Text>
                <View style={{ width: 44 }} />
            </View>

            {!isEditMode && hasDraft && (
                <View style={[styles.draftBanner, { backgroundColor: colors.primary + '15' }]}>
                    <SquarePen size={14} color={colors.primary} />
                    <Text style={[styles.draftBannerText, { color: colors.primary }]}>
                        Modifications non publiées
                    </Text>
                </View>
            )}

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Question</Text>
                    <TextInput
                        style={[styles.questionInput, { color: colors.textPrimary, borderColor: colors.borderColor, backgroundColor: colors.gray100 }]}
                        multiline
                        placeholder="Posez votre question ici..."
                        placeholderTextColor={colors.gray500}
                        value={question}
                        onChangeText={setQuestion}
                        textAlignVertical="top"
                    />
                </View>

                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Options</Text>
                    {options.map((option, index) => (
                        <View key={index} style={styles.optionRow}>
                            <View style={[styles.optionInputContainer, { borderColor: colors.borderColor, backgroundColor: colors.surface }]}>
                                <Text style={[styles.optionIndex, { color: colors.textSecondary }]}>{index + 1}.</Text>
                                <TextInput
                                    style={[styles.optionInput, { color: colors.textPrimary }]}
                                    placeholder={`Option ${index + 1}`}
                                    placeholderTextColor={colors.gray400}
                                    value={option}
                                    onChangeText={(text) => handleOptionChange(text, index)}
                                />
                            </View>
                            {options.length > 2 && (
                                <TouchableOpacity onPress={() => removeOption(index)} style={styles.removeButton}>
                                    <Trash2 size={20} color={colors.error} />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}

                    <TouchableOpacity
                        style={[styles.addOptionButton, { borderColor: colors.primary }]}
                        onPress={addOption}
                    >
                        <Plus size={20} color={colors.primary} />
                        <Text style={[styles.addOptionText, { color: colors.primary }]}>Ajouter une option</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.settingsSection}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Choix multiple</Text>
                            <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>Autoriser les participants à voter pour plusieurs options</Text>
                        </View>
                        <Toggle value={multipleChoice} onValueChange={setMultipleChoice} />
                    </View>

                    <View style={[styles.settingRow, { marginTop: SPACING.lg }]}>
                        <View style={styles.settingInfo}>
                            <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Afficher les résultats</Text>
                            <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>Les votants peuvent voir les résultats avant la fin</Text>
                        </View>
                        <Toggle value={showResults} onValueChange={setShowResults} />
                    </View>

                    <View style={[styles.settingRow, { marginTop: SPACING.lg }]}>
                        <View style={styles.settingInfo}>
                            <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Définir une durée</Text>
                            <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>Le sondage se termine automatiquement</Text>
                        </View>
                        <Toggle value={hasDuration} onValueChange={setHasDuration} />
                    </View>

                    {hasDuration && (
                        <View style={styles.dateSection}>
                            <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Se termine le</Text>
                            <View style={styles.dateRow}>
                                <TouchableOpacity
                                    style={[styles.dateButton, { borderColor: colors.borderColor }]}
                                    onPress={() => setShowDatePicker(true)}
                                >
                                    <Calendar size={18} color={colors.primary} />
                                    <Text style={{ color: colors.textPrimary }}>
                                        {pollEndDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.dateButton, { borderColor: colors.borderColor }]}
                                    onPress={() => setShowTimePicker(true)}
                                >
                                    <Clock size={18} color={colors.primary} />
                                    <Text style={{ color: colors.textPrimary }}>
                                        {pollEndDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

            </ScrollView>

            <View style={[styles.footer, { borderTopColor: colors.borderColor }]}>
                {!isEditMode && (
                    <TouchableOpacity
                        style={[styles.draftBtn, { borderColor: colors.borderColor }]}
                        onPress={handleSaveAsDraft}
                        disabled={!question.trim() || isSubmitting}
                    >
                        <Save size={18} color={colors.gray500} />
                    </TouchableOpacity>
                )}
                <View style={styles.submitBtnContainer}>
                    <Button
                        title={isEditMode ? "Modifier le sondage" : hasDraft ? "Publier le sondage" : "Créer le sondage"}
                        onPress={handleSubmit}
                        loading={isSubmitting}
                        fullWidth
                    />
                </View>
            </View>

            {showDatePicker && (
                <DateTimePicker
                    value={pollEndDate}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) {
                            setPollEndDate(selectedDate);
                        }
                    }}
                />
            )}

            {showTimePicker && (
                <DateTimePicker
                    value={pollEndDate}
                    mode="time"
                    is24Hour={true}
                    display="default"
                    onChange={(event, selectedDate) => {
                        setShowTimePicker(false);
                        if (selectedDate) {
                            setPollEndDate(selectedDate);
                        }
                    }}
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
    section: {
        marginBottom: SPACING.xl,
    },
    label: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
        marginBottom: SPACING.sm,
    },
    questionInput: {
        minHeight: 80,
        padding: SPACING.md,
        borderRadius: BORDER.radius.sm,
        borderWidth: BORDER.width.thin,
        fontSize: TYPOGRAPHY.fontSize.lg,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
        gap: SPACING.sm,
    },
    optionInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: LAYOUT.inputHeight,
        borderRadius: BORDER.radius.sm,
        borderWidth: BORDER.width.thin,
        paddingHorizontal: SPACING.md,
    },
    optionIndex: {
        marginRight: SPACING.sm,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    optionInput: {
        flex: 1,
        height: '100%',
        fontSize: TYPOGRAPHY.fontSize.md,
    },
    removeButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addOptionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        height: LAYOUT.inputHeight,
        borderRadius: BORDER.radius.sm,
        borderWidth: 1,
        borderStyle: 'dashed',
        marginTop: SPACING.xs,
    },
    addOptionText: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    settingsSection: {
        marginBottom: SPACING.xl,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    settingInfo: {
        flex: 1,
        marginRight: SPACING.md,
    },
    settingTitle: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    settingDesc: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        marginTop: 2,
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
    dateSection: {
        marginTop: SPACING.md,
        paddingLeft: SPACING.sm,
    },
    dateLabel: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        marginBottom: SPACING.sm,
    },
    dateRow: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderWidth: BORDER.width.thin,
        borderRadius: BORDER.radius.sm,
    },
});
