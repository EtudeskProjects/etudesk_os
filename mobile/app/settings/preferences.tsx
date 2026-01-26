import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    useColorScheme,
    ActivityIndicator,
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
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER, ThemeMode } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import { useNotifications, NotificationPreferences } from '../../src/hooks/useNotifications';
import { Toggle } from '../../src/components/ui';
import { Language } from '../../src/i18n';

type ThemePreference = 'light' | 'dark' | 'system';

export default function PreferencesScreen() {
    const router = useRouter();
    const { colors, mode, setTheme, isDark } = useTheme();
    const { language, setLanguage, t } = useI18n();
    const systemColorScheme = useColorScheme();
    const { preferences, updatePreferences, fetchPreferences } = useNotifications();

    // Theme preference (includes 'system' option)
    const [themePreference, setThemePreference] = useState<ThemePreference>('system');

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

    // Privacy settings (local only for now)
    const [profilePublic, setProfilePublic] = useState(true);
    const [showEmail, setShowEmail] = useState(false);
    const [showPhone, setShowPhone] = useState(false);

    // Load preferences from server
    useEffect(() => {
        const loadPreferences = async () => {
            setIsLoading(true);
            await fetchPreferences();
            setIsLoading(false);
        };
        loadPreferences();
    }, []);

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

    // Handle theme preference change
    const handleThemeChange = (preference: ThemePreference) => {
        setThemePreference(preference);
        if (preference === 'system') {
            const systemMode: ThemeMode = systemColorScheme === 'dark' ? 'dark' : 'light';
            setTheme(systemMode);
        } else {
            setTheme(preference as ThemeMode);
        }
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
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('preferences.title')}</Text>
                    <View style={styles.headerSpacer} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('preferences.title')}</Text>
                    {isSaving && (
                        <ActivityIndicator size="small" color={colors.primary} style={styles.savingIndicator} />
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
                        {/* Theme */}
                        <View style={styles.settingItem}>
                            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('preferences.theme')}</Text>
                        </View>
                        <View style={styles.optionsRow}>
                            {THEME_OPTIONS.map((option) => {
                                const Icon = option.icon;
                                const isSelected = themePreference === option.id;
                                return (
                                    <TouchableOpacity
                                        key={option.id}
                                        style={[
                                            styles.optionButton,
                                            { backgroundColor: colors.gray100, borderColor: colors.borderColor },
                                            isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                                        ]}
                                        onPress={() => handleThemeChange(option.id)}
                                    >
                                        <Icon
                                            size={ICON.size.sm}
                                            color={isSelected ? COLORS.white : colors.gray600}
                                            strokeWidth={ICON.strokeWidth}
                                        />
                                        <Text
                                            style={[
                                                styles.optionButtonText,
                                                { color: colors.textSecondary },
                                                isSelected && { color: COLORS.white },
                                            ]}
                                        >
                                            {t(option.labelKey)}
                                        </Text>
                                    </TouchableOpacity>
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
                                    <TouchableOpacity
                                        key={option.id}
                                        style={[
                                            styles.optionButton,
                                            { backgroundColor: colors.gray100, borderColor: colors.borderColor },
                                            isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                                        ]}
                                        onPress={() => handleLanguageChange(option.id)}
                                    >
                                        <Text style={styles.flagEmoji}>{option.flag}</Text>
                                        <Text
                                            style={[
                                                styles.optionButtonText,
                                                { color: colors.textSecondary },
                                                isSelected && { color: COLORS.white },
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </>
                )}

                {/* Notification Channels Section */}
                {renderSection(
                    language === 'fr' ? 'Canaux de notification' : 'Notification Channels',
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
                    language === 'fr' ? 'Types de notifications' : 'Notification Types',
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
                            language === 'fr' ? 'Candidatures' : 'Applications',
                            language === 'fr' ? 'Mises à jour de vos candidatures' : 'Updates on your applications',
                            localPrefs.notify_applications,
                            (value) => handlePreferenceChange('notify_applications', value),
                            !localPrefs.push_enabled && !localPrefs.email_enabled
                        )}
                        <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
                        {renderSwitchItem(
                            <Calendar size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />,
                            language === 'fr' ? 'Rappels' : 'Reminders',
                            language === 'fr' ? 'Rappels d\'événements et échéances' : 'Event and deadline reminders',
                            localPrefs.notify_reminders,
                            (value) => handlePreferenceChange('notify_reminders', value),
                            !localPrefs.push_enabled && !localPrefs.email_enabled
                        )}
                    </>
                )}

                {/* Privacy Section */}
                {renderSection(
                    language === 'fr' ? 'Confidentialité' : 'Privacy',
                    <>
                        {renderSwitchItem(
                            <Eye size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />,
                            language === 'fr' ? 'Profil public' : 'Public Profile',
                            language === 'fr' ? 'Votre profil est visible par tous' : 'Your profile is visible to everyone',
                            profilePublic,
                            setProfilePublic
                        )}
                        <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
                        {renderSwitchItem(
                            <Mail size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />,
                            language === 'fr' ? 'Afficher mon email' : 'Show my email',
                            language === 'fr' ? 'Visible sur votre profil public' : 'Visible on your public profile',
                            showEmail,
                            setShowEmail
                        )}
                        <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
                        {renderSwitchItem(
                            <MessageSquare size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />,
                            language === 'fr' ? 'Afficher mon téléphone' : 'Show my phone',
                            language === 'fr' ? 'Visible sur votre profil public' : 'Visible on your public profile',
                            showPhone,
                            setShowPhone
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
