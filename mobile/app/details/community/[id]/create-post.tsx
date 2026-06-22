import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    ScrollView,
    Platform,
    KeyboardAvoidingView,
    Keyboard,
    ActionSheetIOS,
    BackHandler,
    NativeSyntheticEvent,
    TextInputSelectionChangeEventData,
    Animated,
    Pressable,
} from 'react-native';
import type { TextInput as RNTextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, X, FileText, Plus, Calendar, Save, SquarePen, Clock } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
	import DateTimePicker from '@react-native-community/datetimepicker';
	import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../../src/constants/theme';
	import { useTheme } from '../../../../src/hooks/useTheme';
	import { useForm } from '../../../../src/hooks/useForm';
	import { Button, Chip, IconButton, Input } from '../../../../src/components/ui';
import { communityActivityService, communityService } from '../../../../src/services';
import { useAlert } from '../../../../src/contexts/AlertContext';
import { ScrollToInputContext } from '../../../../src/contexts/ScrollToInputContext';
import { useI18n } from '../../../../src/contexts/I18nContext';

interface Attachment {
    uri: string;
    type: string;
    name: string;
    isImage: boolean;
}

interface CommunityMember {
    id: string;
    talent_id: string;
    talent?: {
        id: string;
        display_name?: string;
        first_name?: string;
        last_name?: string;
        avatar_url?: string;
        profile_picture_url?: string;
    };
}

interface PostFormValues {
    content: string;
    attachments: Attachment[];
    isScheduled: boolean;
    scheduledDate: Date;
}

const MAX_FILES = 5;

export default function CreatePostScreen() {
    const { id, activityId } = useLocalSearchParams<{ id: string; activityId?: string }>();
    const router = useRouter();
    const { colors, isDark } = useTheme();
    const { t, locale } = useI18n();
    const inputRef = useRef<RNTextInput>(null);
    const scrollRef = useRef<ScrollView>(null);

    const scrollToInput = useCallback((targetNodeHandle: number, extraOffset = 120) => {
        const sv = scrollRef.current;
        if (!sv) return;
        const delay = Platform.OS === 'android' ? 120 : 0;
        setTimeout(() => {
            sv.scrollResponderScrollNativeHandleToKeyboard(targetNodeHandle, extraOffset, true);
        }, delay);
    }, []);

    // Edit mode - when activityId is provided, we're editing an existing activity
    const isEditMode = !!activityId;

    // Draft state (UI state)
    const [isLoadingDraft, setIsLoadingDraft] = useState(true);
    const [existingDraftId, setExistingDraftId] = useState<string | null>(null);
    const [hasDraft, setHasDraft] = useState(false);
    const [initialContent, setInitialContent] = useState('');

    // Date/Time picker state (UI state)
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Upload progress (UI state)
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const progressAnim = useRef(new Animated.Value(0)).current;

    // Mentions (UI state)
    const [members, setMembers] = useState<CommunityMember[]>([]);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const [cursorPosition, setCursorPosition] = useState(0);

    // Form state using useForm
    const form = useForm<PostFormValues>({
        fields: {
            content: { initialValue: '' },
            attachments: { initialValue: [] },
            isScheduled: { initialValue: false },
            scheduledDate: { initialValue: new Date(Date.now() + 60 * 60 * 1000) },
        },
        onSubmit: async (values) => {
            if (!values.content.trim() && values.attachments.length === 0) {
                void alerts.alert(t('common.error'), t('community.createPost.validationTextOrFile'));
                return;
            }

            // Validate scheduled date is in the future (only for new posts)
            if (!isEditMode && values.isScheduled && values.scheduledDate <= new Date()) {
                void alerts.alert(t('common.error'), t('community.createPost.validationFutureDate'));
                return;
            }

            let completeProgress: (() => void) | undefined;
            if (values.attachments.length > 0) {
                completeProgress = simulateUploadProgress();
            }

            if (isEditMode && activityId) {
                // Update existing activity
                await communityActivityService.updateActivity(activityId, {
                    content: values.content,
                    attachments: values.attachments.map(att => ({
                        uri: att.uri,
                        type: att.type,
                        name: att.name,
                    })),
                });
            } else if (existingDraftId) {
                await communityActivityService.updateDraft(existingDraftId, {
                    content: values.content,
                    attachments: values.attachments.map(att => ({
                        uri: att.uri,
                        type: att.type,
                        name: att.name,
                    })),
                    scheduled_at: values.isScheduled ? values.scheduledDate.toISOString() : undefined,
                });
                await communityActivityService.publishDraft(existingDraftId);
            } else {
                await communityActivityService.createActivity(id!, {
                    community_id: id!,
                    type: 'POST',
                    content: values.content,
                    attachments: values.attachments.map(att => ({
                        uri: att.uri,
                        type: att.type,
                        name: att.name,
                    })),
                    scheduled_at: values.isScheduled ? values.scheduledDate.toISOString() : undefined,
                });
            }

            if (completeProgress) completeProgress();
            const message = isEditMode
                ? t('community.createPost.updatedSuccess')
                : values.isScheduled
                    ? t('community.createPost.scheduledSuccess', {
                        date: values.scheduledDate.toLocaleDateString(locale),
                        time: values.scheduledDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
                    })
                    : t('community.createPost.createdSuccess');

            void alerts.showAlert({ title: t('common.success'), message: message, buttons: [
                { text: t('community.createPost.ok'), onPress: () => router.back() }
            ] });
        },
    });

    // Convenience getters
    const content = form.getValue('content');
    const attachments = form.getValue('attachments');
    const isScheduled = form.getValue('isScheduled');
    const scheduledDate = form.getValue('scheduledDate');
    const isSubmitting = form.state.isSubmitting;

    // Track unsaved changes
    const hasUnsavedChanges = content !== initialContent || attachments.length > 0;
    const alerts = useAlert();

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

    // Keyboard listeners
    useEffect(() => {
        const showSub = Keyboard.addListener('keyboardDidShow', () => {});
        const hideSub = Keyboard.addListener('keyboardDidHide', () => {});
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

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
                        form.setValue('content', activity.content || '');
                        setInitialContent(activity.content || '');
                        if (activity.attachments && Array.isArray(activity.attachments)) {
                            const activityAttachments: Attachment[] = activity.attachments.map((att: any) => ({
                                uri: typeof att === 'string' ? att : (att.url || att),
                                type: att.type || 'image/jpeg',
                                name: att.name || 'attachment',
                                isImage: typeof att === 'string' ? !att.includes('.pdf') : (att.type?.startsWith('image/') || true),
                            }));
                            form.setValue('attachments', activityAttachments);
                        }
                    }
                } else {
                    // Load draft for new posts
                    const response = await communityActivityService.getDraftByType(id, 'POST');
                    if (response?.data) {
                        const draft = response.data;
                        setExistingDraftId(draft.id);
                        setHasDraft(true);
                        form.setValue('content', draft.content || '');
                        setInitialContent(draft.content || '');
                        if (draft.attachments && Array.isArray(draft.attachments)) {
                            const draftAttachments: Attachment[] = draft.attachments.map((att: any) => ({
                                uri: att.url || att,
                                type: att.type || 'image/jpeg',
                                name: att.name || 'attachment',
                                isImage: att.type?.startsWith('image/') || true,
                            }));
                            form.setValue('attachments', draftAttachments);
                        }
                        if (draft.scheduled_at) {
                            form.setValue('isScheduled', true);
                            form.setValue('scheduledDate', new Date(draft.scheduled_at));
                        }
                    }
                }
            } catch (error) {
            } finally {
                setIsLoadingDraft(false);
            }
        };
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, isEditMode, activityId]);

    // Fetch community members for mentions
    const fetchMembersForMentions = useCallback(async (searchTerm: string) => {
        if (!id || !searchTerm || searchTerm.length < 1) {
            setMembers([]);
            return;
        }
        try {
            const response = await communityService.getCommunityMembers(id, {
                status: 'ACTIVE',
                limit: 20,
                search: searchTerm
            });
            if (response?.data?.data) {
                setMembers(response.data.data);
            }
        } catch (error) {
            setMembers([]);
        }
    }, [id]);

    const handleTextChange = (text: string) => {
        form.setValue('content', text);
        const textBeforeCursor = text.substring(0, cursorPosition + (text.length - content.length));
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
            if (/^[\w\s]*$/.test(textAfterAt) && textAfterAt.length <= 20) {
                setMentionStartIndex(lastAtIndex);
                const searchTerm = textAfterAt.toLowerCase();
                setMentionSearch(searchTerm);
                setShowMentions(true);
                if (searchTerm.length > 0) {
                    fetchMembersForMentions(searchTerm);
                } else {
                    setMembers([]);
                }
                return;
            }
        }
        setShowMentions(false);
        setMembers([]);
    };

    const handleSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        setCursorPosition(e.nativeEvent.selection.start);
    };

    const filteredMembers = members.filter(member => {
        const name = member.talent?.display_name ||
            `${member.talent?.first_name || ''} ${member.talent?.last_name || ''}`.trim();
        return name.toLowerCase().includes(mentionSearch);
    }).slice(0, 5);

    const insertMention = (member: CommunityMember) => {
        const name = member.talent?.display_name ||
            `${member.talent?.first_name || ''} ${member.talent?.last_name || ''}`.trim();
        const beforeMention = content.substring(0, mentionStartIndex);
        const afterMention = content.substring(cursorPosition);
        const newContent = `${beforeMention}@${name} ${afterMention}`;
        form.setValue('content', newContent);
        setShowMentions(false);
        setMentionSearch('');
        inputRef.current?.focus();
    };

    // Show file picker options
    const showFilePicker = () => {
        if (attachments.length >= MAX_FILES) {
            void alerts.alert(t('common.limitReached'), t('community.createPost.maxFilesAllowed', { max: MAX_FILES }));
            return;
        }

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: [t('common.cancel'), t('community.createPost.photosVideos'), t('community.createPost.pdfDocument')],
                    cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) pickMedia();
                    if (buttonIndex === 2) pickDocuments();
                }
            );
        } else {
            void alerts.showAlert({ title: t('community.createPost.addFileTitle'), message: t('community.createPost.chooseFileType'), buttons: [
                    { text: t('community.createPost.photosVideos'), onPress: pickMedia },
                    { text: t('community.createPost.pdfDocument'), onPress: pickDocuments },
                    { text: t('common.cancel'), style: 'cancel' },
                ] });
        }
    };

    const pickMedia = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                allowsMultipleSelection: true,
                quality: 0.8,
                selectionLimit: MAX_FILES - attachments.length,
            });

            if (!result.canceled) {
                const remainingSlots = MAX_FILES - attachments.length;
                const assetsToAdd = result.assets.slice(0, remainingSlots);
                const newAttachments: Attachment[] = assetsToAdd.map(asset => {
                    const isVideo = asset.type === 'video' || (asset.mimeType && asset.mimeType.startsWith('video/'));
                    return {
                        uri: asset.uri,
                        type: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
                        name: asset.fileName || `${isVideo ? 'video' : 'image'}-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
                        isImage: !isVideo,
                    };
                });
                form.setValue('attachments', [...attachments, ...newAttachments]);
            }
        } catch (error) {
            void alerts.alert(t('common.error'), t('community.createPost.pickMediaError'));
        }
    };

    const pickDocuments = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf'],
                multiple: true,
            });

            if (!result.canceled && result.assets) {
                const remainingSlots = MAX_FILES - attachments.length;
                const filesToAdd = result.assets.slice(0, remainingSlots);
                const newAttachments: Attachment[] = filesToAdd.map(file => ({
                    uri: file.uri,
                    type: file.mimeType || 'application/pdf',
                    name: file.name || `document-${Date.now()}.pdf`,
                    isImage: false,
                }));
                form.setValue('attachments', [...attachments, ...newAttachments]);
            }
        } catch (error) {
            void alerts.alert(t('common.error'), t('community.createPost.pickDocumentError'));
        }
    };

    const removeAttachment = (index: number) => {
        form.setValue('attachments', attachments.filter((_, i) => i !== index));
    };

    // Animate upload progress
    const animateProgress = useCallback((toValue: number) => {
        Animated.timing(progressAnim, {
            toValue,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [progressAnim]);

    // Simulate upload progress for visual feedback
    const simulateUploadProgress = useCallback(() => {
        setIsUploading(true);
        setUploadProgress(0);
        animateProgress(0);

        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15 + 5;
            if (progress >= 90) {
                progress = 90;
                clearInterval(interval);
            }
            setUploadProgress(progress);
            animateProgress(progress / 100);
        }, 200);

        return () => {
            clearInterval(interval);
            setUploadProgress(100);
            animateProgress(1);
            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress(0);
                progressAnim.setValue(0);
            }, 500);
        };
    }, [animateProgress, progressAnim]);

    const [isSavingDraft, setIsSavingDraft] = useState(false);

    const handleSaveAsDraft = async () => {
        if (!content.trim() && attachments.length === 0) {
            void alerts.alert(t('common.error'), t('community.createPost.validationDraftTextOrFile'));
            return;
        }

        try {
            setIsSavingDraft(true);
            let completeProgress: (() => void) | undefined;
            if (attachments.length > 0) {
                completeProgress = simulateUploadProgress();
            }

            if (existingDraftId) {
                await communityActivityService.updateDraft(existingDraftId, {
                    content: content,
                    attachments: attachments.map(att => ({
                        uri: att.uri,
                        type: att.type,
                        name: att.name,
                    })),
                    scheduled_at: isScheduled ? scheduledDate.toISOString() : undefined,
                });
            } else {
                await communityActivityService.createActivity(id!, {
                    community_id: id!,
                    type: 'POST',
                    content: content,
                    attachments: attachments.map(att => ({
                        uri: att.uri,
                        type: att.type,
                        name: att.name,
                    })),
                    scheduled_at: isScheduled ? scheduledDate.toISOString() : undefined,
                    is_draft: true,
                });
            }

            if (completeProgress) completeProgress();
            void alerts.showAlert({ title: t('common.success'), message: t('common.draftSaved'), buttons: [
                { text: t('community.createPost.ok'), onPress: () => router.back() }
            ] });
        } catch (error: any) {
            setIsUploading(false);
            setUploadProgress(0);
            progressAnim.setValue(0);
            const message = error?.response?.data?.error || error?.message || t('common.saveDraftError');
            void alerts.alert(t('common.error'), message);
        } finally {
            setIsSavingDraft(false);
        }
    };

    const toggleSchedule = () => {
        if (isScheduled) {
            form.setValue('isScheduled', false);
        } else {
            form.setValue('isScheduled', true);
            // Set default to 1 hour from now
            const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
            form.setValue('scheduledDate', defaultDate);
            // Dismiss keyboard before showing date picker
            Keyboard.dismiss();
            setTimeout(() => setShowDatePicker(true), 100);
        }
    };

    const openDatePicker = () => {
        Keyboard.dismiss();
        setTimeout(() => setShowDatePicker(true), 100);
    };

    const openTimePicker = () => {
        Keyboard.dismiss();
        setTimeout(() => setShowTimePicker(true), 100);
    };

    const canAddMore = attachments.length < MAX_FILES;

    // Format scheduled button label
    const getScheduleButtonLabel = () => {
        if (!isScheduled) return t('common.publish');
        const dateStr = scheduledDate.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
        return t('community.createPost.publishOn', { date: dateStr });
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
		                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('community.createPost.publication')}</Text>
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
	            {/* Header */}
	            <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
		                <IconButton
		                    onPress={handleBack}
		                    icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
		                    accessibilityLabel={t('common.back')}
		                    style={styles.headerButton}
		                />
		                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
		                    {isEditMode ? t('common.edit') : hasDraft ? t('common.draft') : t('community.createPost.publication')}
		                </Text>
		                <View style={{ width: 44 }} />
		            </View>

            {/* Draft Banner - only show for drafts, not for edit mode */}
            {!isEditMode && hasDraft && (
                <View style={[styles.draftBanner, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                    <SquarePen size={14} color={colors.primary} />
	                    <Text style={[styles.draftBannerText, { color: colors.primary }]}>
	                        {t('common.unpublishedChanges')}
	                    </Text>
	                </View>
	            )}

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollToInputContext.Provider value={scrollToInput}>
                    <ScrollView
                        ref={scrollRef}
                        style={styles.content}
                        contentContainerStyle={styles.contentContainer}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                    >
                    {/* Text Input */}
	                    <Input
	                        ref={inputRef}
	                        multiline
	                        placeholder={t('community.createPost.writeSomething')}
	                        placeholderTextColor={colors.gray400}
                        value={content}
                        onChangeText={handleTextChange}
                        onSelectionChange={handleSelectionChange}
                        autoFocus
                        textAlignVertical="top"
                        // Editor look: no "input box" chrome; keep unified Input under the hood.
                        inputContainerStyle={{
                            backgroundColor: 'transparent',
                            borderWidth: 0,
                            height: undefined,
                            minHeight: 150,
                        }}
                        inputStyle={StyleSheet.flatten([
                            styles.input,
                            {
                                color: colors.textPrimary,
                                paddingHorizontal: 0,
                                paddingTop: 0,
                                paddingBottom: 0,
                            },
                        ])}
                    />

                    {/* Mention suggestions */}
                    {showMentions && filteredMembers.length > 0 && (
                        <View style={[styles.mentionContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
	                            {filteredMembers.map((member) => {
	                                const name = member.talent?.display_name ||
	                                    `${member.talent?.first_name || ''} ${member.talent?.last_name || ''}`.trim();
	                                const avatar = member.talent?.profile_picture_url || member.talent?.avatar_url;
	
	                                return (
	                                    <Pressable
	                                        key={member.id}
	                                        style={styles.mentionItem}
	                                        onPress={() => insertMention(member)}
		                                        accessibilityRole="button"
		                                        accessibilityLabel={t('community.createPost.mentionMember', { name: name || t('common.member') })}
		                                    >
	                                        {avatar ? (
	                                            <Image source={{ uri: avatar }} style={styles.mentionAvatar} />
	                                        ) : (
	                                            <View style={[styles.mentionAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                                                <Text style={[styles.mentionAvatarText, { color: colors.textOnPrimary }]}>
                                                    {name.charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
	                                        <Text style={[styles.mentionName, { color: colors.textPrimary }]}>
	                                            {name}
	                                        </Text>
	                                    </Pressable>
	                                );
	                            })}
	                        </View>
	                    )}

                    {/* Upload Progress */}
                    {isUploading && (
                        <View style={styles.uploadProgressContainer}>
                            <View style={[styles.uploadProgressTrack, { backgroundColor: colors.gray200 }]}>
                                <Animated.View
                                    style={[
                                        styles.uploadProgressBar,
                                        {
                                            backgroundColor: colors.primary,
                                            width: progressAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ['0%', '100%'],
                                            }),
                                        },
                                    ]}
                                />
                            </View>
	                            <Text style={[styles.uploadProgressText, { color: colors.textSecondary }]}>
	                                {t('community.createPost.uploadingProgress', { progress: Math.round(uploadProgress) })}
	                            </Text>
	                        </View>
	                    )}

                    {/* Attachments Grid */}
                    {attachments.length > 0 && (
                        <View style={styles.attachmentsGrid}>
                            {attachments.map((att, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.attachmentItem,
                                        { backgroundColor: colors.gray100, borderColor: colors.borderColor }
                                    ]}
                                >
                                    {att.isImage ? (
                                        <Image source={{ uri: att.uri }} style={styles.attachmentImage} />
                                    ) : (
                                        <View style={styles.attachmentDoc}>
                                            <FileText size={24} color={colors.error} />
                                            <Text
                                                style={[styles.attachmentDocName, { color: colors.textSecondary }]}
                                                numberOfLines={1}
                                            >
                                                {att.name}
                                            </Text>
                                        </View>
                                    )}
			                                    <IconButton
			                                        onPress={() => removeAttachment(index)}
			                                        disabled={isUploading}
			                                        icon={<X size={12} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
			                                        accessibilityLabel={t('community.createPost.removeFile')}
			                                        size="sm"
			                                        variant="filled"
			                                        style={[styles.removeButton, { backgroundColor: withOpacity(colors.black, OPACITY[80]) }]}
		                                    />
	                                </View>
	                            ))}
	                        </View>
	                    )}

                    </ScrollView>

                {/* Schedule indicator - above toolbar (not shown in edit mode) */}
                {!isEditMode && isScheduled && (
                    <View style={[styles.scheduleIndicator, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
		                        <IconButton
		                            onPress={openDatePicker}
		                            icon={<Calendar size={16} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
		                            accessibilityLabel={t('community.createPost.editScheduledDate')}
		                            variant="filled"
		                            size="sm"
		                            style={[styles.scheduleIconContainer, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}
		                        />
		                        <View style={styles.scheduleContent}>
		                            <Text style={[styles.scheduleLabel, { color: colors.textSecondary }]}>
		                                {t('community.createPost.scheduledPublication')}
		                            </Text>
		                            <View style={styles.scheduleDateTimeRow}>
		                                <Chip
		                                    label={scheduledDate.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
		                                    onPress={openDatePicker}
		                                    leftIcon={<Calendar size={14} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
		                                    style={[styles.scheduleDateBtn, { backgroundColor: colors.gray100, borderWidth: 0 }]}
		                                    textStyle={[styles.scheduleDateText, { color: colors.textPrimary }]}
		                                />
		                                <Chip
		                                    label={scheduledDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
		                                    onPress={openTimePicker}
		                                    leftIcon={<Clock size={14} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
		                                    style={[styles.scheduleDateBtn, { backgroundColor: colors.gray100, borderWidth: 0 }]}
	                                    textStyle={[styles.scheduleDateText, { color: colors.textPrimary }]}
	                                />
	                            </View>
	                        </View>
		                        <IconButton
		                            onPress={() => form.setValue('isScheduled', false)}
		                            icon={<X size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />}
		                            accessibilityLabel={t('community.createPost.cancelSchedule')}
		                            variant="filled"
		                            size="sm"
		                            style={[styles.scheduleRemoveBtn, { backgroundColor: colors.gray100 }]}
	                        />
	                    </View>
	                )}

                {/* Toolbar - moves above keyboard */}
                <View style={[styles.toolbar, { borderTopColor: colors.borderColor, backgroundColor: colors.background }]}>
                    <View style={styles.toolbarLeft}>
                        {/* Add file button */}
	                        <IconButton
	                            onPress={showFilePicker}
	                            disabled={!canAddMore}
	                            icon={<Plus size={20} color={colors.textOnPrimary} strokeWidth={2.5} />}
	                            accessibilityLabel={t('community.createPost.addFileA11y')}
	                            variant="filled"
                            style={[
                                styles.iconButton,
                                { backgroundColor: colors.primary, opacity: canAddMore ? 1 : 0.4 }
                            ]}
                        />

                        {/* Schedule button - hide in edit mode */}
                        {!isEditMode && (
	                            <IconButton
	                                onPress={toggleSchedule}
	                                icon={<Calendar size={18} color={isScheduled ? colors.textOnPrimary : colors.gray600} strokeWidth={2} />}
	                                accessibilityLabel={t('community.createPost.scheduleA11y')}
	                                variant="filled"
                                style={[
                                    styles.iconButton,
                                    { backgroundColor: isScheduled ? colors.primary : colors.gray200 }
                                ]}
                            />
                        )}

                        {/* File count indicator */}
                        {attachments.length > 0 && (
                            <View style={[styles.fileCountBadge, { backgroundColor: colors.gray100 }]}>
                                <Text style={[styles.fileCountText, { color: colors.gray600 }]}>
                                    {attachments.length}/{MAX_FILES}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.toolbarRight}>
                        {/* Draft button - hide in edit mode */}
	                        {!isEditMode && (
		                            <IconButton
		                                onPress={handleSaveAsDraft}
		                                disabled={(!content.trim() && attachments.length === 0) || isSubmitting || isSavingDraft}
		                                icon={<Save size={18} color={colors.gray500} strokeWidth={ICON.strokeWidth} />}
		                                accessibilityLabel={t('common.saveDraft')}
		                                variant="outline"
	                                style={[
	                                    styles.draftBtn,
	                                    {
	                                        borderColor: colors.borderColor,
	                                        opacity: (!content.trim() && attachments.length === 0) || isSubmitting || isSavingDraft ? 0.5 : 1
	                                    }
	                                ]}
	                            />
	                        )}

                        {/* Publish/Update button */}
	                        <Button
	                            title={isEditMode ? t('common.edit') : getScheduleButtonLabel()}
	                            onPress={form.handleSubmit}
	                            loading={isSubmitting}
                            disabled={(!content.trim() && attachments.length === 0) || isSubmitting}
                            size="sm"
                        />
                    </View>
                </View>
                </ScrollToInputContext.Provider>
            </KeyboardAvoidingView>

            {showDatePicker && (
                <DateTimePicker
                    value={scheduledDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant={isDark ? 'dark' : 'light'}
                    textColor={colors.textPrimary}
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                        if (Platform.OS === 'android') {
                            setShowDatePicker(false);
                        }
                        if (event.type === 'set' && selectedDate) {
                            form.setValue('scheduledDate', selectedDate);
                            if (Platform.OS === 'ios') {
                                // On iOS with spinner, user confirms manually
                            } else {
                                setShowTimePicker(true);
                            }
                        } else if (event.type === 'dismissed') {
                            setShowDatePicker(false);
                        }
                    }}
                />
            )}

	            {/* iOS Date Picker Confirm Button */}
	            {Platform.OS === 'ios' && showDatePicker && (
	                <View style={[styles.pickerConfirmContainer, { backgroundColor: colors.surface, borderTopColor: colors.borderColor }]}>
		                    <Button
		                        title={t('common.cancel')}
		                        onPress={() => setShowDatePicker(false)}
	                        variant="outline"
	                        style={[styles.pickerCancelBtn, { borderColor: colors.borderColor }]}
	                        textStyle={[styles.pickerCancelText, { color: colors.gray500 }]}
	                    />
		                    <Button
		                        title={t('common.next')}
		                        onPress={() => {
	                            setShowDatePicker(false);
	                            setShowTimePicker(true);
	                        }}
	                        variant="primary"
	                        style={[styles.pickerConfirmBtn, { backgroundColor: colors.primary }]}
	                        textStyle={[styles.pickerConfirmText, { color: colors.textOnPrimary }]}
	                    />
	                </View>
	            )}

            {showTimePicker && (
                <DateTimePicker
                    value={scheduledDate}
                    mode="time"
                    is24Hour={true}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant={isDark ? 'dark' : 'light'}
                    textColor={colors.textPrimary}
                    onChange={(event, selectedDate) => {
                        if (Platform.OS === 'android') {
                            setShowTimePicker(false);
                            if (event.type === 'set' && selectedDate) {
                                // Validate time
                                if (selectedDate <= new Date()) {
                                    const futureDate = new Date();
                                    futureDate.setMinutes(futureDate.getMinutes() + 5);
                                    form.setValue('scheduledDate', futureDate);
                                    void alerts.alert(t('community.createPost.timeAdjustedTitle'), t('community.createPost.timeAdjustedMessage'));
                                } else {
                                    form.setValue('scheduledDate', selectedDate);
                                }
                            }
                        } else if (selectedDate) {
                            form.setValue('scheduledDate', selectedDate);
                        }
                    }}
                />
            )}

	            {/* iOS Time Picker Confirm Button */}
	            {Platform.OS === 'ios' && showTimePicker && (
	                <View style={[styles.pickerConfirmContainer, { backgroundColor: colors.surface, borderTopColor: colors.borderColor }]}>
		                    <Button
		                        title={t('common.cancel')}
		                        onPress={() => setShowTimePicker(false)}
	                        variant="outline"
	                        style={[styles.pickerCancelBtn, { borderColor: colors.borderColor }]}
	                        textStyle={[styles.pickerCancelText, { color: colors.gray500 }]}
	                    />
		                    <Button
		                        title={t('common.confirm')}
		                        onPress={() => {
	                            setShowTimePicker(false);
	                            // Validate time
		                            if (scheduledDate <= new Date()) {
		                                const futureDate = new Date();
		                                futureDate.setMinutes(futureDate.getMinutes() + 5);
		                                form.setValue('scheduledDate', futureDate);
		                                void alerts.alert(t('community.createPost.timeAdjustedTitle'), t('community.createPost.timeAdjustedMessage'));
		                            }
		                        }}
	                        variant="primary"
	                        style={[styles.pickerConfirmBtn, { backgroundColor: colors.primary }]}
	                        textStyle={[styles.pickerConfirmText, { color: colors.textOnPrimary }]}
	                    />
	                </View>
	            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
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
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: SPACING.lg,
        paddingBottom: SPACING.xl,
    },
    input: {
        fontSize: TYPOGRAPHY.fontSize.md,
        minHeight: 150,
        lineHeight: 24,
    },
    mentionContainer: {
        borderRadius: BORDER.radius.md,
        borderWidth: BORDER.width.thin,
        marginTop: SPACING.sm,
        overflow: 'hidden',
    },
    mentionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.sm,
        gap: SPACING.sm,
    },
    mentionAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    mentionAvatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mentionAvatarText: {
        // color set dynamically via inline style
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    mentionName: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    attachmentsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginTop: SPACING.lg,
    },
    attachmentItem: {
        width: 80,
        height: 80,
        borderRadius: BORDER.radius.md,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: BORDER.width.thin,
    },
    attachmentImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    attachmentDoc: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xs,
    },
    attachmentDocName: {
        fontSize: 10,
        textAlign: 'center',
        marginTop: 2,
    },
	    removeButton: {
	        position: 'absolute',
	        top: 4,
	        right: 4,
	        width: 20,
	        height: 20,
	        borderRadius: 10,
	        alignItems: 'center',
        justifyContent: 'center',
    },
    scheduleIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: SPACING.md,
        marginBottom: SPACING.xs,
        padding: SPACING.sm,
        borderRadius: BORDER.radius.md,
        borderWidth: BORDER.width.thin,
    },
    scheduleIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scheduleContent: {
        flex: 1,
        marginLeft: SPACING.sm,
    },
    scheduleLabel: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        marginBottom: SPACING.xs,
    },
    scheduleDateTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    scheduleDateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER.radius.sm,
    },
    scheduleDateText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    scheduleRemoveBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderTopWidth: BORDER.width.thin,
    },
    toolbarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    toolbarRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fileCountBadge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER.radius.sm,
    },
    fileCountText: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    draftBtn: {
        width: 40,
        height: 40,
        borderRadius: BORDER.radius.sm,
        borderWidth: BORDER.width.thin,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadProgressContainer: {
        marginTop: SPACING.md,
        marginBottom: SPACING.sm,
    },
    uploadProgressTrack: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    uploadProgressBar: {
        height: '100%',
        borderRadius: 3,
    },
    uploadProgressText: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        marginTop: SPACING.xs,
        textAlign: 'center',
    },
    pickerConfirmContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderTopWidth: BORDER.width.thin,
    },
    pickerCancelBtn: {
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
    },
    pickerCancelText: {
        fontSize: TYPOGRAPHY.fontSize.md,
    },
    pickerConfirmBtn: {
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER.radius.sm,
    },
    pickerConfirmText: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
        // color set dynamically via inline style
    },
});
