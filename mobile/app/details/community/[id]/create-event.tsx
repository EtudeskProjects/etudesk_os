import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, BackHandler, Platform, KeyboardAvoidingView, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, MapPin, Clock, Save, SquarePen, X } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../../src/constants/theme';
import { useTheme } from '../../../../src/hooks/useTheme';
import { Button, IconButton, Input, Toggle } from '../../../../src/components/ui';
import { communityActivityService } from '../../../../src/services';
import { useAlert } from '../../../../src/contexts/AlertContext';
import { ScrollToInputContext } from '../../../../src/contexts/ScrollToInputContext';
import { useI18n } from '../../../../src/contexts/I18nContext';

export default function CreateEventScreen() {
    const { id, activityId } = useLocalSearchParams<{ id: string; activityId?: string }>();
    const router = useRouter();
    const { colors, isDark } = useTheme();
    const { t, locale } = useI18n();

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
    const formScrollRef = useRef<ScrollView>(null);
    const alerts = useAlert();

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
            void alerts.showAlert({ title: t('common.unsavedChanges.title'), message: t('common.unsavedChanges.message'), buttons: [
                    { text: t('common.continueEditing'), style: 'cancel' },
                    { text: t('common.leave'), style: 'destructive', onPress: () => router.back() },
                ] });
            return true;
        }
        router.back();
        return true;
    }, [alerts, hasUnsavedChanges, isSubmitting, router, t]);

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
                void alerts.alert(t('common.error'), t('community.createEvent.endBeforeStartError'));
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

    const scrollToInput = useCallback((targetNodeHandle: number, extraOffset = 120) => {
        const sv = formScrollRef.current;
        if (!sv) return;
        const delay = Platform.OS === 'android' ? 120 : 0;
        setTimeout(() => {
            sv.scrollResponderScrollNativeHandleToKeyboard(targetNodeHandle, extraOffset, true);
        }, delay);
    }, []);

    const handleSaveAsDraft = async () => {
        if (!title.trim()) {
            void alerts.alert(t('common.error'), t('community.createEvent.titleRequiredDraft'));
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
            void alerts.showAlert({ title: t('common.success'), message: t('common.draftSaved'), buttons: [
                { text: t('community.createEvent.ok'), onPress: () => router.back() }
            ] });
        } catch (error: any) {
            const message = error?.response?.data?.error || error?.message || t('common.saveDraftError');
            void alerts.alert(t('common.error'), message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!title.trim() || (!isOnline && !location.trim())) {
            void alerts.alert(t('common.error'), t('community.createEvent.requiredFields'));
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
            void alerts.showAlert({ title: t('common.success'), message: isEditMode ? t('community.createEvent.updatedSuccess') : t('community.createEvent.createdSuccess'), buttons: [
                { text: t('community.createEvent.ok'), onPress: () => router.back() }
            ] });
        } catch (error: any) {
            if (__DEV__) console.error('Failed to save event:', error);
            const message = error?.response?.data?.error || error?.message || t('common.saveError');
            void alerts.alert(t('common.error'), message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    };

	    if (isLoadingDraft) {
	        return (
	            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
	                <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
                    <IconButton
                        onPress={() => router.back()}
                        icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
                        accessibilityLabel={t('common.back')}
                        style={styles.headerButton}
                    />
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('community.createEvent.event')}</Text>
                    <View style={{ width: 44 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <Text style={{ color: colors.textSecondary }}>{t('common.loading')}</Text>
                </View>
            </SafeAreaView>
        );
    }

	    return (
	        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
	            <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
                <IconButton
                    onPress={handleBack}
                    icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
                    accessibilityLabel={t('common.back')}
                    style={styles.headerButton}
                />
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                    {isEditMode ? t('community.createEvent.editEvent') : hasDraft ? t('common.draft') : t('community.createEvent.createEvent')}
                </Text>
                <View style={{ width: 44 }} />
            </View>

            {!isEditMode && hasDraft && (
                <View style={[styles.draftBanner, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                    <SquarePen size={14} color={colors.primary} />
                    <Text style={[styles.draftBannerText, { color: colors.primary }]}>
                        {t('common.unpublishedChanges')}
                    </Text>
                </View>
            )}

            <KeyboardAvoidingView
                style={styles.keyboardContent}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
            <ScrollToInputContext.Provider value={scrollToInput}>
            <ScrollView
                ref={formScrollRef}
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
                <Input
                    label={t('community.createEvent.eventTitleLabel')}
                    placeholder={t('community.createEvent.eventTitlePlaceholder')}
                    value={title}
                    onChangeText={setTitle}
                    containerStyle={styles.inputContainer}
                />

                <Input
                    label={t('community.createEvent.locationLabel')}
                    placeholder={t('community.createEvent.locationPlaceholder')}
                    value={location}
                    onChangeText={setLocation}
                    leftIcon={<MapPin size={20} color={colors.gray500} />}
                    containerStyle={styles.inputContainer}
                />

                <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('common.online')}</Text>
                    <Toggle value={isOnline} onValueChange={setIsOnline} />
                </View>

                {/* Date Selection */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('community.createEvent.dateTime')}</Text>

	                    <View style={styles.dateRow}>
		                        <View style={styles.dateCol}>
		                            <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{t('community.createEvent.start')}</Text>
	                            <Button
	                                title={formatDate(startDate)}
	                                onPress={() => openPicker('start', 'date')}
	                                variant="outline"
	                                size="sm"
	                                icon={<Calendar size={18} color={colors.primary} />}
	                                style={[styles.dateButton, { borderColor: colors.borderColor, justifyContent: 'flex-start' }]}
	                                textStyle={{ color: colors.textPrimary }}
	                            />
	                            <Button
	                                title={formatTime(startDate)}
	                                onPress={() => openPicker('start', 'time')}
	                                variant="outline"
	                                size="sm"
	                                icon={<Clock size={18} color={colors.primary} />}
	                                style={[styles.dateButton, { borderColor: colors.borderColor, marginTop: 8, justifyContent: 'flex-start' }]}
	                                textStyle={{ color: colors.textPrimary }}
	                            />
	                        </View>
	
		                        <View style={styles.dateCol}>
		                            <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{t('community.createEvent.end')}</Text>
	                            <Button
	                                title={formatDate(endDate)}
	                                onPress={() => openPicker('end', 'date')}
	                                variant="outline"
	                                size="sm"
	                                icon={<Calendar size={18} color={colors.primary} />}
	                                style={[styles.dateButton, { borderColor: colors.borderColor, justifyContent: 'flex-start' }]}
	                                textStyle={{ color: colors.textPrimary }}
	                            />
	                            <Button
	                                title={formatTime(endDate)}
	                                onPress={() => openPicker('end', 'time')}
	                                variant="outline"
	                                size="sm"
	                                icon={<Clock size={18} color={colors.primary} />}
	                                style={[styles.dateButton, { borderColor: colors.borderColor, marginTop: 8, justifyContent: 'flex-start' }]}
	                                textStyle={{ color: colors.textPrimary }}
	                            />
	                        </View>
	                    </View>
	                </View>

                <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('community.createEvent.description')}</Text>
                    <Input
                        multiline
                        placeholder={t('community.createEvent.descriptionPlaceholder')}
                        placeholderTextColor={colors.gray500}
                        value={description}
                        onChangeText={setDescription}
                        textAlignVertical="top"
                        inputContainerStyle={{ minHeight: 120 }}
                        inputStyle={{ fontSize: TYPOGRAPHY.fontSize.md }}
                    />
                </View>

            </ScrollView>

	            <View style={[styles.footer, { borderTopColor: colors.borderColor }]}>
                {!isEditMode && (
                    <IconButton
                        onPress={handleSaveAsDraft}
                        icon={<Save size={18} color={colors.gray500} />}
                        accessibilityLabel={t('common.saveDraft')}
                        variant="outline"
                        size="lg"
                        disabled={!title.trim() || isSubmitting}
	                        style={[styles.draftBtn, { borderColor: colors.borderColor }]}
	                    />
	                )}
	                <View style={styles.submitBtnContainer}>
                    <Button
                        title={isEditMode ? t('community.createEvent.editEvent') : hasDraft ? t('community.createEvent.publishEvent') : t('community.createEvent.createEvent')}
                        onPress={handleSubmit}
                        loading={isSubmitting}
                        fullWidth
                    />
                </View>
            </View>
            </ScrollToInputContext.Provider>
            </KeyboardAvoidingView>

            {/* Date/Time Picker Modal */}
            {showPicker && Platform.OS === 'ios' && (
                <Modal
                    transparent
                    animationType="fade"
                    visible={showPicker}
                    onRequestClose={() => setShowPicker(false)}
	                >
	                    <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
	                        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
	                            <View style={[styles.modalHeader, { borderBottomColor: colors.borderColor }]}>
                                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                                    {pickerMode === 'date' ? t('community.createEvent.selectDate') : t('community.createEvent.selectTime')}
                                </Text>
                                <IconButton
                                    onPress={() => setShowPicker(false)}
                                    icon={<X size={20} color={colors.textSecondary} />}
                                    accessibilityLabel={t('common.close')}
                                    size="sm"
                                />
	                            </View>
	                            <DateTimePicker
	                                value={tempDate}
	                                mode={pickerMode}
                                is24Hour={true}
                                display="spinner"
                                themeVariant={isDark ? 'dark' : 'light'}
                                textColor={colors.textPrimary}
                                onChange={handleDateChange}
                                style={styles.picker}
	                            />
	                            <View style={styles.modalButtons}>
                                <Button
                                    title={t('common.cancel')}
                                    onPress={() => setShowPicker(false)}
                                    variant="secondary"
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    title={t('common.confirm')}
                                    onPress={() => confirmDateSelection()}
                                    variant="primary"
                                    style={{ flex: 1 }}
	                                />
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
                    themeVariant={isDark ? 'dark' : 'light'}
                    textColor={colors.textPrimary}
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
    keyboardContent: {
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
