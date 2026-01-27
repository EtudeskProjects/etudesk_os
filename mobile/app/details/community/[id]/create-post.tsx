import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Image,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform,
    KeyboardAvoidingView,
    Keyboard,
    ActionSheetIOS,
    BackHandler,
    NativeSyntheticEvent,
    TextInputSelectionChangeEventData,
    Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, X, FileText, Plus, Calendar, Save, SquarePen, Clock } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../../src/constants/theme';
import { useTheme } from '../../../../src/hooks/useTheme';
import { Button } from '../../../../src/components/ui';
import { communityActivityService, communityService } from '../../../../src/services';

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

const MAX_FILES = 5;

export default function CreatePostScreen() {
    const { id, activityId } = useLocalSearchParams<{ id: string; activityId?: string }>();
    const router = useRouter();
    const { colors } = useTheme();
    const inputRef = useRef<TextInput>(null);

    // Edit mode - when activityId is provided, we're editing an existing activity
    const isEditMode = !!activityId;

    const [content, setContent] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingDraft, setIsLoadingDraft] = useState(true);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Draft state
    const [existingDraftId, setExistingDraftId] = useState<string | null>(null);
    const [hasDraft, setHasDraft] = useState(false);
    const [initialContent, setInitialContent] = useState('');

    // Scheduled publication
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledDate, setScheduledDate] = useState(new Date(Date.now() + 60 * 60 * 1000));
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Upload progress
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const progressAnim = useRef(new Animated.Value(0)).current;

    // Mentions
    const [members, setMembers] = useState<CommunityMember[]>([]);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const [cursorPosition, setCursorPosition] = useState(0);

    // Track unsaved changes
    useEffect(() => {
        const hasChanges = content !== initialContent || attachments.length > 0;
        setHasUnsavedChanges(hasChanges);
    }, [content, attachments, initialContent]);

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
                        setContent(activity.content || '');
                        setInitialContent(activity.content || '');
                        if (activity.attachments && Array.isArray(activity.attachments)) {
                            const activityAttachments: Attachment[] = activity.attachments.map((att: any) => ({
                                uri: typeof att === 'string' ? att : (att.url || att),
                                type: att.type || 'image/jpeg',
                                name: att.name || 'attachment',
                                isImage: typeof att === 'string' ? !att.includes('.pdf') : (att.type?.startsWith('image/') || true),
                            }));
                            setAttachments(activityAttachments);
                        }
                    }
                } else {
                    // Load draft for new posts
                    const response = await communityActivityService.getDraftByType(id, 'POST');
                    if (response?.data) {
                        const draft = response.data;
                        setExistingDraftId(draft.id);
                        setHasDraft(true);
                        setContent(draft.content || '');
                        setInitialContent(draft.content || '');
                        if (draft.attachments && Array.isArray(draft.attachments)) {
                            const draftAttachments: Attachment[] = draft.attachments.map((att: any) => ({
                                uri: att.url || att,
                                type: att.type || 'image/jpeg',
                                name: att.name || 'attachment',
                                isImage: att.type?.startsWith('image/') || true,
                            }));
                            setAttachments(draftAttachments);
                        }
                        if (draft.scheduled_at) {
                            setIsScheduled(true);
                            setScheduledDate(new Date(draft.scheduled_at));
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
            if (response?.data) {
                setMembers(response.data);
            }
        } catch (error) {
            setMembers([]);
        }
    }, [id]);

    const handleTextChange = (text: string) => {
        setContent(text);
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
        setContent(newContent);
        setShowMentions(false);
        setMentionSearch('');
        inputRef.current?.focus();
    };

    // Show file picker options
    const showFilePicker = () => {
        if (attachments.length >= MAX_FILES) {
            Alert.alert('Limite atteinte', `Maximum ${MAX_FILES} fichiers autorisés.`);
            return;
        }

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Annuler', 'Photos & Vidéos', 'Document PDF'],
                    cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) pickMedia();
                    if (buttonIndex === 2) pickDocuments();
                }
            );
        } else {
            Alert.alert(
                'Ajouter un fichier',
                'Choisissez le type de fichier',
                [
                    { text: 'Photos & Vidéos', onPress: pickMedia },
                    { text: 'Document PDF', onPress: pickDocuments },
                    { text: 'Annuler', style: 'cancel' },
                ]
            );
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
                setAttachments(prev => [...prev, ...newAttachments]);
            }
        } catch (error) {
            Alert.alert('Erreur', 'Impossible de sélectionner les médias');
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
                setAttachments(prev => [...prev, ...newAttachments]);
            }
        } catch (error) {
            Alert.alert('Erreur', 'Impossible de sélectionner le document');
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
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

    const handleSaveAsDraft = async () => {
        if (!content.trim() && attachments.length === 0) {
            Alert.alert('Erreur', 'Veuillez ajouter du texte ou un fichier pour sauvegarder.');
            return;
        }

        try {
            setIsSubmitting(true);
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
            setHasUnsavedChanges(false);
            Alert.alert('Succès', 'Brouillon sauvegardé !', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error: any) {
            setIsUploading(false);
            setUploadProgress(0);
            progressAnim.setValue(0);
            const message = error?.response?.data?.error || error?.message || 'Impossible de sauvegarder le brouillon.';
            Alert.alert('Erreur', message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!content.trim() && attachments.length === 0) {
            Alert.alert('Erreur', 'Veuillez ajouter du texte ou un fichier.');
            return;
        }

        // Validate scheduled date is in the future (only for new posts)
        if (!isEditMode && isScheduled && scheduledDate <= new Date()) {
            Alert.alert('Erreur', 'La date de publication programmée doit être dans le futur.');
            return;
        }

        try {
            setIsSubmitting(true);
            let completeProgress: (() => void) | undefined;
            if (attachments.length > 0) {
                completeProgress = simulateUploadProgress();
            }

            if (isEditMode && activityId) {
                // Update existing activity
                await communityActivityService.updateActivity(activityId, {
                    content: content,
                    attachments: attachments.map(att => ({
                        uri: att.uri,
                        type: att.type,
                        name: att.name,
                    })),
                });
            } else if (existingDraftId) {
                await communityActivityService.updateDraft(existingDraftId, {
                    content: content,
                    attachments: attachments.map(att => ({
                        uri: att.uri,
                        type: att.type,
                        name: att.name,
                    })),
                    scheduled_at: isScheduled ? scheduledDate.toISOString() : undefined,
                });
                await communityActivityService.publishDraft(existingDraftId);
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
                });
            }

            if (completeProgress) completeProgress();
            setHasUnsavedChanges(false);
            const message = isEditMode
                ? 'Votre publication a été modifiée !'
                : isScheduled
                    ? `Publication programmée pour le ${scheduledDate.toLocaleDateString('fr-FR')} à ${scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`
                    : 'Votre publication a été créée !';

            Alert.alert('Succès', message, [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error: any) {
            setIsUploading(false);
            setUploadProgress(0);
            progressAnim.setValue(0);
            const message = error?.response?.data?.error || error?.message || 'Impossible de publier.';
            Alert.alert('Erreur', message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleSchedule = () => {
        if (isScheduled) {
            setIsScheduled(false);
        } else {
            setIsScheduled(true);
            // Set default to 1 hour from now
            const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
            setScheduledDate(defaultDate);
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
        if (!isScheduled) return 'Publier';
        const dateStr = scheduledDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        const timeStr = scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return `Publier le ${dateStr}`;
    };

    if (isLoadingDraft) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
                <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
                    <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
                        <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Publication</Text>
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
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
                <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
                    <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                    {isEditMode ? 'Modifier' : hasDraft ? 'Brouillon' : 'Publication'}
                </Text>
                <View style={{ width: 44 }} />
            </View>

            {/* Draft Banner - only show for drafts, not for edit mode */}
            {!isEditMode && hasDraft && (
                <View style={[styles.draftBanner, { backgroundColor: colors.primary + '15' }]}>
                    <SquarePen size={14} color={colors.primary} />
                    <Text style={[styles.draftBannerText, { color: colors.primary }]}>
                        Modifications non publiées
                    </Text>
                </View>
            )}

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Text Input */}
                    <TextInput
                        ref={inputRef}
                        style={[styles.input, { color: colors.textPrimary }]}
                        multiline
                        placeholder="Écrivez quelque chose..."
                        placeholderTextColor={colors.gray400}
                        value={content}
                        onChangeText={handleTextChange}
                        onSelectionChange={handleSelectionChange}
                        textAlignVertical="top"
                        autoFocus
                    />

                    {/* Mention suggestions */}
                    {showMentions && filteredMembers.length > 0 && (
                        <View style={[styles.mentionContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
                            {filteredMembers.map((member) => {
                                const name = member.talent?.display_name ||
                                    `${member.talent?.first_name || ''} ${member.talent?.last_name || ''}`.trim();
                                const avatar = member.talent?.profile_picture_url || member.talent?.avatar_url;

                                return (
                                    <TouchableOpacity
                                        key={member.id}
                                        style={styles.mentionItem}
                                        onPress={() => insertMention(member)}
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
                                    </TouchableOpacity>
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
                                Téléchargement... {Math.round(uploadProgress)}%
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
                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={() => removeAttachment(index)}
                                        disabled={isUploading}
                                    >
                                        <X size={12} color={colors.textOnPrimary} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                </ScrollView>

                {/* Schedule indicator - above toolbar (not shown in edit mode) */}
                {!isEditMode && isScheduled && (
                    <View style={[styles.scheduleIndicator, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
                        <TouchableOpacity
                            style={[styles.scheduleIconContainer, { backgroundColor: colors.primary + '15' }]}
                            onPress={openDatePicker}
                        >
                            <Calendar size={16} color={colors.primary} />
                        </TouchableOpacity>
                        <View style={styles.scheduleContent}>
                            <Text style={[styles.scheduleLabel, { color: colors.textSecondary }]}>
                                Publication programmée
                            </Text>
                            <View style={styles.scheduleDateTimeRow}>
                                <TouchableOpacity
                                    style={[styles.scheduleDateBtn, { backgroundColor: colors.gray100 }]}
                                    onPress={openDatePicker}
                                >
                                    <Calendar size={14} color={colors.primary} />
                                    <Text style={[styles.scheduleDateText, { color: colors.textPrimary }]}>
                                        {scheduledDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.scheduleDateBtn, { backgroundColor: colors.gray100 }]}
                                    onPress={openTimePicker}
                                >
                                    <Clock size={14} color={colors.primary} />
                                    <Text style={[styles.scheduleDateText, { color: colors.textPrimary }]}>
                                        {scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => setIsScheduled(false)}
                            style={[styles.scheduleRemoveBtn, { backgroundColor: colors.gray100 }]}
                        >
                            <X size={16} color={colors.gray500} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Toolbar - moves above keyboard */}
                <View style={[styles.toolbar, { borderTopColor: colors.borderColor, backgroundColor: colors.background }]}>
                    <View style={styles.toolbarLeft}>
                        {/* Add file button */}
                        <TouchableOpacity
                            style={[
                                styles.iconButton,
                                { backgroundColor: colors.primary, opacity: canAddMore ? 1 : 0.4 }
                            ]}
                            onPress={showFilePicker}
                            disabled={!canAddMore}
                        >
                            <Plus size={20} color={colors.textOnPrimary} strokeWidth={2.5} />
                        </TouchableOpacity>

                        {/* Schedule button - hide in edit mode */}
                        {!isEditMode && (
                            <TouchableOpacity
                                style={[
                                    styles.iconButton,
                                    {
                                        backgroundColor: isScheduled ? colors.primary : colors.gray200,
                                    }
                                ]}
                                onPress={toggleSchedule}
                            >
                                <Calendar size={18} color={isScheduled ? colors.textOnPrimary : colors.gray600} strokeWidth={2} />
                            </TouchableOpacity>
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
                            <TouchableOpacity
                                style={[
                                    styles.draftBtn,
                                    {
                                        borderColor: colors.borderColor,
                                        opacity: (!content.trim() && attachments.length === 0) || isSubmitting ? 0.5 : 1
                                    }
                                ]}
                                onPress={handleSaveAsDraft}
                                disabled={(!content.trim() && attachments.length === 0) || isSubmitting}
                            >
                                <Save size={18} color={colors.gray500} />
                            </TouchableOpacity>
                        )}

                        {/* Publish/Update button */}
                        <Button
                            title={isEditMode ? 'Modifier' : getScheduleButtonLabel()}
                            onPress={handleSubmit}
                            loading={isSubmitting}
                            disabled={(!content.trim() && attachments.length === 0) || isSubmitting}
                            size="sm"
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>

            {showDatePicker && (
                <DateTimePicker
                    value={scheduledDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                        if (Platform.OS === 'android') {
                            setShowDatePicker(false);
                        }
                        if (event.type === 'set' && selectedDate) {
                            setScheduledDate(selectedDate);
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
                    <TouchableOpacity
                        style={styles.pickerCancelBtn}
                        onPress={() => setShowDatePicker(false)}
                    >
                        <Text style={[styles.pickerCancelText, { color: colors.gray500 }]}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.pickerConfirmBtn, { backgroundColor: colors.primary }]}
                        onPress={() => {
                            setShowDatePicker(false);
                            setShowTimePicker(true);
                        }}
                    >
                        <Text style={[styles.pickerConfirmText, { color: colors.textOnPrimary }]}>Suivant</Text>
                    </TouchableOpacity>
                </View>
            )}

            {showTimePicker && (
                <DateTimePicker
                    value={scheduledDate}
                    mode="time"
                    is24Hour={true}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                        if (Platform.OS === 'android') {
                            setShowTimePicker(false);
                            if (event.type === 'set' && selectedDate) {
                                // Validate time
                                if (selectedDate <= new Date()) {
                                    const futureDate = new Date();
                                    futureDate.setMinutes(futureDate.getMinutes() + 5);
                                    setScheduledDate(futureDate);
                                    Alert.alert('Heure ajustée', 'L\'heure a été ajustée car elle était dans le passé.');
                                } else {
                                    setScheduledDate(selectedDate);
                                }
                            }
                        } else if (selectedDate) {
                            setScheduledDate(selectedDate);
                        }
                    }}
                />
            )}

            {/* iOS Time Picker Confirm Button */}
            {Platform.OS === 'ios' && showTimePicker && (
                <View style={[styles.pickerConfirmContainer, { backgroundColor: colors.surface, borderTopColor: colors.borderColor }]}>
                    <TouchableOpacity
                        style={styles.pickerCancelBtn}
                        onPress={() => setShowTimePicker(false)}
                    >
                        <Text style={[styles.pickerCancelText, { color: colors.gray500 }]}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.pickerConfirmBtn, { backgroundColor: colors.primary }]}
                        onPress={() => {
                            setShowTimePicker(false);
                            // Validate time
                            if (scheduledDate <= new Date()) {
                                const futureDate = new Date();
                                futureDate.setMinutes(futureDate.getMinutes() + 5);
                                setScheduledDate(futureDate);
                                Alert.alert('Heure ajustée', 'L\'heure a été ajustée car elle était dans le passé.');
                            }
                        }}
                    >
                        <Text style={[styles.pickerConfirmText, { color: colors.textOnPrimary }]}>Confirmer</Text>
                    </TouchableOpacity>
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
        fontSize: 9,
        textAlign: 'center',
        marginTop: 2,
    },
    removeButton: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.8)',
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
