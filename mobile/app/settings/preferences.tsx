import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    Sun,
    Moon,
    Monitor,
    Bell,
    Mail,
    MessageSquare,
    Globe,
    Eye,
    Briefcase,
    Calendar,
    Smartphone,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { STORAGE_KEYS } from '../../src/constants/config';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import { useNotifications, NotificationPreferences } from '../../src/hooks/useNotifications';
    import { Button, IconButton, Toggle, LoadingShimmer, ShimmerPlaceholder } from '../../src/components/ui';
import { Language } from '../../src/i18n';
import type { ThemePreference } from '../../src/contexts/ThemeContext';


export default function PreferencesScreen() {
    const router = useRouter();
    const { colors, themePreference, setTheme } = useTheme();
    const { language, setLanguage, t } = useI18n();
    const { preferences, updatePreferences, fetchPreferences } = useNotifications();

    // Local notification preferences state
    const [localPrefs, setLocalPrefs] = useState<NotificationPreferences>({
        push_enabled: true,
        email_enabled: true,
        sms_enabled: false,
        notify_opportunities: true,
        notify_messages: true,
        notify_applications: true,
        notify_reminders: true,
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    // Privacy settings (persisted locally to AsyncStorage)
    const [profilePublic, setProfilePublic] = useState(true);
    const [showEmail, setShowEmail] = useState(false);
    const [showPhone, setShowPhone] = useState(false);

    const setProfilePublicAndSave = useCallback((value: boolean) => {
        setProfilePublic(value);
        AsyncStorage.setItem(
            STORAGE_KEYS.PRIVACY_PREFERENCES,
            JSON.stringify({ profilePublic: value, showEmail, showPhone })
        ).catch(() => { });
    }, [showEmail, showPhone]);
    const setShowEmailAndSave = useCallback((value: boolean) => {
        setShowEmail(value);
        AsyncStorage.setItem(
            STORAGE_KEYS.PRIVACY_PREFERENCES,
            JSON.stringify({ profilePublic, showEmail: value, showPhone })
        ).catch(() => { });
    }, [profilePublic, showPhone]);
    const setShowPhoneAndSave = useCallback((value: boolean) => {
        setShowPhone(value);
        AsyncStorage.setItem(
            STORAGE_KEYS.PRIVACY_PREFERENCES,
            JSON.stringify({ profilePublic, showEmail, showPhone: value })
        ).catch(() => { });
    }, [profilePublic, showEmail]);

    const loadPreferences = useCallback(async () => {
        setIsLoading(true);
        setLoadError(false);
        try {
            await fetchPreferences();
            const storedPrivacy = await AsyncStorage.getItem(STORAGE_KEYS.PRIVACY_PREFERENCES);
            if (storedPrivacy) {
                try {
                    const parsed = JSON.parse(storedPrivacy);
                    if (typeof parsed.profilePublic === 'boolean') setProfilePublic(parsed.profilePublic);
                    if (typeof parsed.showEmail === 'boolean') setShowEmail(parsed.showEmail);
                    if (typeof parsed.showPhone === 'boolean') setShowPhone(parsed.showPhone);
                } catch {
                    // ignore invalid JSON
                }
            }
        } catch (error) {
            if (__DEV__) console.error('Error loading preferences:', error);
            setLoadError(true);
        } finally {
            setIsLoading(false);
        }
    }, [fetchPreferences]);
    useEffect(() => {
        loadPreferences();
    }, [loadPreferences]);

    // Sync server preferences to local state
    useEffect(() => {
        if (preferences) {
            setLocalPrefs(preferences);
        }
    }, [preferences]);

    // Handle preference change
    const handlePreferenceChange = async (key: keyof NotificationPreferences, value: boolean) => {
        // Update local state immediately
        setLocalPrefs(prev => ({ ...prev, [key]: value }));

        // Save to server
        setIsSaving(true);
        const success = await updatePreferences({ [key]: value });
        setIsSaving(false);

        if (!success) {
            // Revert on failure
            setLocalPrefs(prev => ({ ...prev, [key]: !value }));
        }
    };

    // Handle theme preference change (context persists to AsyncStorage)
    const handleThemeChange = (preference: ThemePreference) => {
        setTheme(preference);
    };

    // Handle language change
    const handleLanguageChange = (lang: Language) => {
        setLanguage(lang);
    };

    const THEME_OPTIONS: { id: ThemePreference; labelKey: string; icon: any }[] = [
        { id: 'light', labelKey: 'preferences.themes.light', icon: Sun },
        { id: 'dark', labelKey: 'preferences.themes.dark', icon: Moon },
        { id: 'system', labelKey: 'preferences.themes.system', icon: Monitor },
    ];

    const LANGUAGE_OPTIONS: { id: Language; label: string; flag: string }[] = [
        { id: 'fr', label: 'Français', flag: '🇫🇷' },
        { id: 'en', label: 'English', flag: '🇬🇧' },
    ];

    const renderSection = (title: string, children: React.ReactNode) => (
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
            <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>
                {children}
            </View>
        </View>
    );

    const renderSwitchItem = (
        icon: any,
        label: string,
        description: string,
        value: boolean,
        onValueChange: (value: boolean) => void,
        disabled?: boolean
    ) => (
        <View style={[styles.settingItem, disabled && styles.settingItemDisabled]}>
            <View style={styles.settingInfo}>
                {icon}
                <View style={styles.settingTextContainer}>
                    <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{label}</Text>
                    <Text style={[styles.settingDescription, { color: colors.gray500 }]}>{description}</Text>
                </View>
            </View>
            <Toggle
                value={value}
                onValueChange={onValueChange}
                disabled={disabled}
            />
        </View>
    );

    if (isLoading) {
        return (
	            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
	                <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
	                    <IconButton
	                        onPress={() => router.back()}
	                        icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
	                        accessibilityLabel="Retour"
	                    />
	                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('preferences.title')}</Text>
	                    <View style={styles.headerSpacer} />
	                </View>
                <View style={styles.loadingContainer}>
                    <LoadingShimmer variant="fullPage" />
                </View>
            </SafeAreaView>
        );
    }

    if (loadError) {
	        return (
	            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
	                <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
	                    <IconButton
	                        onPress={() => router.back()}
	                        icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
	                        accessibilityLabel="Retour"
	                    />
	                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('preferences.title')}</Text>
	                    <View style={styles.headerSpacer} />
	                </View>
                    <View style={styles.loadingContainer}>
                        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{t('preferences.loadError')}</Text>
                    <Button
                        title={t('preferences.retry')}
                        onPress={() => loadPreferences()}
                        variant="primary"
                        style={styles.retryButton}
                        textStyle={styles.retryButtonText}
                    />
                    </View>
            </SafeAreaView>
        );
    }

	    return (
	        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
	            {/* Header */}
	            <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
	                <IconButton
	                    onPress={() => router.back()}
	                    icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
	                    accessibilityLabel="Retour"
	                />
	                <View style={styles.headerCenter}>
	                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('preferences.title')}</Text>
	                    {isSaving && (
	                        <ShimmerPlaceholder width={20} height={14} variant="bar" style={styles.savingIndicator} />
	                    )}
	                </View>
	                <View style={styles.headerSpacer} />
	            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Appearance Section */}
                {renderSection(
                    t('preferences.display'),
                    <>
                        <View style={styles.settingItem}>
                            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('preferences.theme')}</Text>
                        </View>
                        <View style={styles.optionsRow}>
                            {THEME_OPTIONS.map((option) => {
                                const Icon = option.icon;
                                const isSelected = themePreference === option.id;
                                return (
                                    <Button
                                        key={option.id}
                                        onPress={() => handleThemeChange(option.id)}
                                        title={t(option.labelKey)}
                                        variant={isSelected ? 'primary' : 'secondary'}
                                        size="sm"
                                        icon={<Icon size={ICON.size.sm} color={isSelected ? colors.textOnPrimary : colors.gray600} strokeWidth={ICON.strokeWidth} />}
                                        style={[
                                            styles.optionButton,
                                            { backgroundColor: colors.gray100, borderColor: colors.borderColor },
                                            isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                                        ]}
                                        textStyle={[
                                            styles.optionButtonText,
                                            { color: colors.textSecondary },
                                            isSelected && { color: colors.textOnPrimary },
                                        ]}
                                    />
                                );
                            })}
                        </View>
                    </>
                )}

                {/* Language Section */}
                {renderSection(
                    t('preferences.language'),
                    <>
                        <View style={styles.settingItem}>
                            <View style={styles.settingInfo}>
                                <Globe size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
                                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('preferences.language')}</Text>
                            </View>
                        </View>
                        <View style={styles.optionsRow}>
                            {LANGUAGE_OPTIONS.map((option) => {
                                const isSelected = language === option.id;
                                return (
                                    <Button
                                        key={option.id}
                                        onPress={() => handleLanguageChange(option.id)}
                                        title={option.label}
                                        variant={isSelected ? 'primary' : 'secondary'}
                                        size="sm"
                                        icon={<Text style={styles.flagEmoji}>{option.flag}</Text>}
                                        style={[
                                            styles.optionButton,
                                            { backgroundColor: colors.gray100, borderColor: colors.borderColor },
                                            isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                                        ]}
                                        textStyle={[
                                            styles.optionButtonText,
                                            { color: colors.textSecondary },
                                            isSelected && { color: colors.textOnPrimary },
                                        ]}
                                    />
                                );
                            })}
                        </View>
                    </>
                )}

                {/* Notification Channels Section */}
                {renderSection(
                    t('preferences.notificationChannels'),
                    <>
                        {renderSwitchItem(
                            <Smartphone size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />,
                            t('preferences.notifications.push'),
                            t('preferences.notifications.pushDesc'),
                            localPrefs.push_enabled,
                            (value) => handlePreferenceChange('push_enabled', value)
                        )}
                        <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
                        {renderSwitchItem(
                            <Mail size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />,
                            t('preferences.notifications.email'),
                            t('preferences.notifications.emailDesc'),
                            localPrefs.email_enabled,
                            (value) => handlePreferenceChange('email_enabled', value)
                        )}
                    </>
                )}

                {/* Notification Types Section */}
                {renderSection(
                    t('preferences.notificationTypes'),
                    <>
                        {renderSwitchItem(
                            <Briefcase size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />,
                            t('preferences.notifications.opportunities'),
                            t('preferences.notifications.opportunitiesDesc'),
                            localPrefs.notify_opportunities,
                            (value) => handlePreferenceChange('notify_opportunities', value),
                            !localPrefs.push_enabled && !localPrefs.email_enabled
                        )}
                        <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
                        {renderSwitchItem(
                            <MessageSquare size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />,
                            t('preferences.notifications.messages'),
                            t('preferences.notifications.messagesDesc'),
                            localPrefs.notify_messages,
                            (value) => handlePreferenceChange('notify_messages', value),
                            !localPrefs.push_enabled && !localPrefs.email_enabled
                        )}
                        <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
                        {renderSwitchItem(
                            <Bell size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />,
                            t('preferences.applications'),
                            t('preferences.applicationsDesc'),
                            localPrefs.notify_applications,
                            (value) => handlePreferenceChange('notify_applications', value),
                            !localPrefs.push_enabled && !localPrefs.email_enabled
                        )}
                        <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
                        {renderSwitchItem(
                            <Calendar size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />,
                            t('preferences.reminders'),
                            t('preferences.remindersDesc'),
                            localPrefs.notify_reminders,
                            (value) => handlePreferenceChange('notify_reminders', value),
                            !localPrefs.push_enabled && !localPrefs.email_enabled
                        )}
                    </>
                )}

                {/* Privacy Section */}
                {renderSection(
                    t('preferences.privacy'),
                    <>
                        {renderSwitchItem(
                            <Eye size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />,
                            t('preferences.publicProfile'),
                            t('preferences.publicProfileDesc'),
                            profilePublic,
                            setProfilePublicAndSave
                        )}
                        <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
                        {renderSwitchItem(
                            <Mail size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />,
                            t('preferences.showEmail'),
                            t('preferences.showEmailDesc'),
                            showEmail,
                            setShowEmailAndSave
                        )}
                        <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
                        {renderSwitchItem(
                            <MessageSquare size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />,
                            t('preferences.showPhone'),
                            t('preferences.showPhoneDesc'),
                            showPhone,
                            setShowPhoneAndSave
                        )}
                    </>
                )}
            </ScrollView>
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

    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },

    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },

    headerTitle: {
        fontSize: TYPOGRAPHY.fontSize.lg,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },

    savingIndicator: {
        marginLeft: SPACING.xs,
    },

    headerSpacer: {
        width: 40,
    },

    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    errorText: {
        fontSize: TYPOGRAPHY.fontSize.md,
        textAlign: 'center',
        marginBottom: SPACING.lg,
        paddingHorizontal: SPACING.xl,
    },

    retryButton: {
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: BORDER.radius.md,
    },

    retryButtonText: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },

    scrollView: {
        flex: 1,
    },

    scrollContent: {
        paddingBottom: SPACING.xl,
    },

    section: {
        marginTop: SPACING.lg,
    },

    sectionTitle: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
    },

    sectionContent: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
    },

    subsectionTitle: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: SPACING.sm,
        marginBottom: SPACING.xs,
    },

    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.sm,
    },

    settingItemDisabled: {
        opacity: 0.5,
    },

    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        flex: 1,
    },

    settingTextContainer: {
        flex: 1,
    },

    settingLabel: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },

    settingDescription: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        marginTop: 2,
    },

    optionsRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginTop: SPACING.xs,
    },

    optionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xs,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.sm,
        borderWidth: BORDER.width.thin,
        borderRadius: BORDER.radius.sm,
    },

    optionButtonText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },

    flagEmoji: {
        fontSize: TYPOGRAPHY.fontSize.lg,
    },

    divider: {
        height: 1,
        marginVertical: SPACING.sm,
    },
});
