import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  ArrowLeft,
  Laptop,
  Plane,
  Camera,
	} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
	import { Chip, IconButton, Input, Button, Toggle, PhoneInput } from '../../src/components/ui';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import { useForm } from '../../src/hooks/useForm';
import { COUNTRIES, GENDERS, getRegionsByCountry, getCommunesByRegion } from '../../src/constants/location';
import { otpService } from '../../src/services/otpService';
import { onboardingService } from '../../src/services/onboardingService';
import { imageService } from '../../src/services';
import { getFullImageUrl } from '../../src/utils/image';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { ScrollToInputContext } from '../../src/contexts/ScrollToInputContext';

interface ProfileFormValues {
  firstName: string;
  lastName: string;
  gender: string;
  country: string;
  region: string;
  commune: string;
  phone: string;
  email: string;
  avatarUri: string | null;
  remoteReady: boolean;
  willingToRelocate: boolean;
}

export default function CreateProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { completeOnboarding, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  // Form management with useForm hook
  const form = useForm<ProfileFormValues>({
    fields: {
      firstName: { initialValue: '', required: true, requiredMessage: t('auth.createProfile.firstNameRequired') },
      lastName: { initialValue: '', required: true, requiredMessage: t('auth.createProfile.lastNameRequired') },
      gender: { initialValue: '' },
      country: { initialValue: 'CI' },
      region: { initialValue: '' },
      commune: { initialValue: '' },
      phone: { initialValue: '', required: false },
      email: { initialValue: '' },
      avatarUri: { initialValue: null },
      remoteReady: { initialValue: true },
      willingToRelocate: { initialValue: true },
    },
    onSubmit: async (values) => {
      const displayName = `${values.firstName.trim()} ${values.lastName.trim()}`.trim();
      const profileData = {
        displayName,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: values.phone.trim() || undefined,
        email: values.email.trim() || undefined,
        city: values.commune || undefined,
        region: values.region || undefined,
        country: values.country || undefined,
        remoteReady: values.remoteReady,
        willingToRelocate: values.willingToRelocate,
        gender: values.gender || undefined,
        avatarUrl: values.avatarUri || undefined,
      };
      const response = await onboardingService.complete(profileData);
      if (response.data) {
        completeOnboarding();
        router.replace('/auth/welcome');
      } else {
        throw new Error(t('auth.createProfile.profileCreationFailed'));
      }
    },
  });

  // Convenience getters for form values
  const firstName = form.getValue('firstName');
  const lastName = form.getValue('lastName');
  const gender = form.getValue('gender');
  const country = form.getValue('country');
  const region = form.getValue('region');
  const commune = form.getValue('commune');
  const phone = form.getValue('phone');
  const email = form.getValue('email');
  const avatarUri = form.getValue('avatarUri');
  const remoteReady = form.getValue('remoteReady');
  const willingToRelocate = form.getValue('willingToRelocate');

  // Main vertical scroll (used for keyboard-aware scrolling on focus)
  const mainScrollRef = useRef<ScrollView>(null);

  // Refs for horizontal scrolls
  const countryScrollRef = useRef<ScrollView>(null);
  const regionScrollRef = useRef<ScrollView>(null);
  const communeScrollRef = useRef<ScrollView>(null);
  const countryChipPositions = useRef<{ [key: string]: { x: number; width: number } }>({});
  const regionChipPositions = useRef<{ [key: string]: { x: number; width: number } }>({});
  const communeChipPositions = useRef<{ [key: string]: { x: number; width: number } }>({});
  const alerts = useAlert();

  const scrollToInput = useCallback((targetNodeHandle: number, extraOffset = 96) => {
    const sv = mainScrollRef.current;
    if (!sv) return;
    const delay = Platform.OS === 'android' ? 120 : 0;
    setTimeout(() => {
      sv.scrollResponderScrollNativeHandleToKeyboard(targetNodeHandle, extraOffset, true);
    }, delay);
  }, []);

  // Track if user signed up via WhatsApp (phone becomes mandatory + locked)
  const [isWhatsAppSignup, setIsWhatsAppSignup] = useState(false);

  const loadAuthData = useCallback(async () => {
    try {
      const user = await otpService.getUser();
      if (user) {
        if (user.hasTalentProfile === true || user.onboardingComplete === true || user.talentId) {
          completeOnboarding();
          router.replace('/(tabs)/home');
          return;
        }

        if (user.email && !user.email.includes('@etudesk.local')) {
          form.setValues({ email: user.email });
        }

        if (user.phone) {
          form.setValues({ phone: user.phone });
        }

        if (user.authMethod === 'whatsapp') {
          setIsWhatsAppSignup(true);
        }
      }
    } catch {
    }
  }, [completeOnboarding, form, router]);

  // Pre-fill email/phone from authentication and check if user needs onboarding
  useEffect(() => {
    void loadAuthData();
  }, [loadAuthData]);

  // Generic scroll function for chips
  const scrollToChip = (
    scrollRef: React.RefObject<ScrollView | null>,
    positions: React.MutableRefObject<{ [key: string]: { x: number; width: number } }>,
    chipId: string,
    animated: boolean = true
  ) => {
    const position = positions.current[chipId];
    if (position && scrollRef.current) {
      const scrollContainerWidth = 350;
      const offset = Math.max(0, position.x - (scrollContainerWidth - position.width) / 2);
      scrollRef.current.scrollTo({ x: offset, animated });
    }
  };

  // Scroll to selected country on mount
  useEffect(() => {
    if (country) {
      const timer = setTimeout(() => {
        scrollToChip(countryScrollRef, countryChipPositions, country, false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [country]);

  // Handle chip layout to track positions
  const handleChipLayout = (
    positions: React.MutableRefObject<{ [key: string]: { x: number; width: number } }>,
    id: string,
    x: number,
    width: number
  ) => {
    positions.current[id] = { x, width };
  };

  // Get regions and communes dynamically
  const availableRegions = country ? getRegionsByCountry(country) : [];
  const availableCommunes = country && region ? getCommunesByRegion(country, region) : [];

  // Pick profile photo
  const pickImage = async () => {
    try {
      const uploaded = await imageService.pickAndUploadImage('avatar');
      if (uploaded) {
        form.setValue('avatarUri', uploaded.url);
      }
    } catch (error) {
      if (__DEV__) console.error('Error selecting image:', error);
      void alerts.showAlert({ title: t('common.error'), message: t('auth.createProfile.photoError'), buttons: [{ text: 'OK' }] });
    }
  };

  const handleSubmitProfile = async () => {
    if (form.state.isSubmitting) return;

    // Validate required fields
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName || trimmedFirstName.length < 2) {
      void alerts.alert(t('common.error'), t('auth.createProfile.firstNameMinChars'));
      return;
    }

    if (!trimmedLastName || trimmedLastName.length < 2) {
      void alerts.alert(t('common.error'), t('auth.createProfile.lastNameMinChars'));
      return;
    }

    const displayName = `${trimmedFirstName} ${trimmedLastName}`.trim();

    if (!displayName || displayName.length < 3) {
      void alerts.alert(t('common.error'), t('auth.createProfile.displayNameRequired'));
      return;
    }

    try {
      await form.handleSubmit();
    } catch (error: any) {
      if (__DEV__) console.error('[CreateProfile] Error creating profile:', JSON.stringify(error, null, 2));

      // Check if profile already exists - redirect to main app
      const errorMsg = error.error || error.message || '';
      if (errorMsg.includes('existe déjà') || errorMsg.includes('already exists')) {
        completeOnboarding();
        router.replace('/(tabs)/home');
        return;
      }

      let errorMessage = t('common.genericError');

      if (error.status === 500) {
        errorMessage = t('auth.createProfile.serverError');
        if (__DEV__) console.error('[CreateProfile] Server error details:', {
          status: error.status,
          error: error.error,
          message: error.message,
        });
      } else if (error.error) {
        errorMessage = error.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      void alerts.showAlert({ title: t('common.error'), message: errorMessage, buttons: [{ text: 'OK' }] });
    }
  };

  const handleDeleteAccount = () => {
    void alerts.showAlert({
      title: t('auth.createProfile.deleteAccountTitle'),
      message: t('auth.createProfile.deleteAccountMessage'),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            void alerts.showAlert({
              title: t('auth.createProfile.deleteAccountConfirmTitle'),
              message: t('auth.createProfile.deleteAccountConfirmMessage'),
              buttons: [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('auth.createProfile.deleteAccountConfirm'),
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const result = await otpService.deleteAccount();
                      if (!result.success) {
                        void alerts.alert(
                          t('common.error'),
                          result.error || t('auth.createProfile.deleteAccountError')
                        );
                        return;
                      }

                      await signOut();
                    } catch {
                      void alerts.alert(
                        t('common.error'),
                        t('auth.createProfile.deleteAccountError')
                      );
                    }
                  },
                },
              ],
            });
          },
        },
      ],
    });
  };

  const canProceed = () => {
    const baseValid = firstName.trim().length >= 2 && lastName.trim().length >= 2 && country.length > 0;
    // WhatsApp signup requires phone
    if (isWhatsAppSignup && !phone.trim()) return false;
    return baseValid;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header with back button */}
	    <View style={styles.header}>
	      <IconButton
	        onPress={() => router.back()}
	        icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
	        accessibilityLabel={t('common.back')}
	      />
	      <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('auth.createProfile.title')}</Text>
	      <Pressable
          onPress={handleDeleteAccount}
          accessibilityRole="button"
          accessibilityLabel={t('auth.createProfile.deleteAccountCta')}
        >
          <Text style={[styles.deleteHeaderButton, { color: colors.gray600 }]}>
            {t('auth.createProfile.deleteAccountCta')}
          </Text>
        </Pressable>
	    </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollToInputContext.Provider value={scrollToInput}>
          <ScrollView
            ref={mainScrollRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            <View style={styles.stepContent}>
              <View style={styles.stepHeader}>
                <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{t('auth.createProfile.tellUsAboutYou')}</Text>
              </View>

              <View style={styles.formFields}>
	              {/* Photo de profil */}
	              <View style={styles.photoSection}>
	                <Pressable
	                  style={[styles.photoContainer, { backgroundColor: colors.gray100, borderColor: colors.borderColor }]}
	                  onPress={pickImage}
	                  accessibilityRole="button"
	                  accessibilityLabel={t('auth.createProfile.addPhoto')}
	                >
	                  {avatarUri ? (
	                    <Image source={{ uri: getFullImageUrl(avatarUri) || avatarUri }} style={styles.photoImage} resizeMode="cover" />
	                  ) : (
	                    <Camera size={ICON.size.lg} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
	                  )}
	                </Pressable>
	                <Text style={[styles.photoHint, { color: colors.textSecondary }]}>
	                  {t('auth.createProfile.addPhoto')}
	                </Text>
	              </View>

                {/* Prénom & Nom */}
                <View style={styles.rowFields}>
                  <View style={styles.halfField}>
                    <Input
                      label={`${t('auth.createProfile.firstName')} *`}
                      placeholder=""
                      value={firstName}
                      onChangeText={(value) => form.setValue('firstName', value)}
                      autoCapitalize="words"
                      autoFocus
                    />
                  </View>
                  <View style={styles.halfField}>
                    <Input
                      label={`${t('auth.createProfile.lastName')} *`}
                      placeholder=""
                      value={lastName}
                      onChangeText={(value) => form.setValue('lastName', value)}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                {/* Genre */}
	              <View style={styles.fieldContainer}>
	                <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('auth.createProfile.gender')}</Text>
	                <View style={styles.optionsRow}>
	                  {GENDERS.map((g) => (
	                    <Chip
	                      key={g.id}
	                      label={t(`labels.genders.${g.id}`)}
	                      selected={gender === g.id}
	                      onPress={() => form.setValue('gender', g.id)}
	                      style={[
	                        styles.optionButton,
	                        { backgroundColor: colors.gray100, borderColor: colors.gray200 },
	                        gender === g.id && { backgroundColor: colors.primary, borderColor: colors.primary },
	                      ]}
	                      textStyle={[
	                        styles.optionButtonText,
	                        { color: colors.gray700 },
	                        gender === g.id && { color: colors.textOnPrimary },
	                      ]}
	                    />
	                  ))}
	                </View>
	              </View>

                {/* Separator - Localisation */}
                <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

                {/* Pays */}
                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('auth.createProfile.country')} *</Text>
                  <ScrollView
                    ref={countryScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.horizontalScroll}
                    contentContainerStyle={styles.horizontalScrollContent}
                  >
	                  {COUNTRIES.map((c) => (
	                    <Chip
	                      key={c.id}
	                      label={c.label}
	                      selected={country === c.id}
	                      onLayout={(event) => {
	                        const { x, width } = event.nativeEvent.layout;
	                        handleChipLayout(countryChipPositions, c.id, x, width);
	                      }}
	                      onPress={() => {
	                        form.setValue('country', c.id);
	                        form.setValue('region', '');
	                        form.setValue('commune', '');
	                        setTimeout(() => scrollToChip(countryScrollRef, countryChipPositions, c.id, true), 50);
	                      }}
	                      style={[
	                        styles.optionChip,
	                        { backgroundColor: colors.gray100, borderColor: colors.gray200 },
	                        country === c.id && { backgroundColor: colors.primary, borderColor: colors.primary },
	                      ]}
	                      textStyle={[
	                        styles.optionChipText,
	                        { color: colors.gray700 },
	                        country === c.id && { color: colors.textOnPrimary },
	                      ]}
	                    />
	                  ))}
	                </ScrollView>
	              </View>

                {/* Région */}
                {availableRegions.length > 0 && (
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('auth.createProfile.region')}</Text>
                    <ScrollView
                      ref={regionScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.horizontalScroll}
                      contentContainerStyle={styles.horizontalScrollContent}
                    >
	                    {availableRegions.map((r) => (
	                      <Chip
	                        key={r.id}
	                        label={r.label}
	                        selected={region === r.id}
	                        onLayout={(event) => {
	                          const { x, width } = event.nativeEvent.layout;
	                          handleChipLayout(regionChipPositions, r.id, x, width);
	                        }}
	                        onPress={() => {
	                          form.setValue('region', r.id);
	                          form.setValue('commune', '');
	                          setTimeout(() => scrollToChip(regionScrollRef, regionChipPositions, r.id, true), 50);
	                        }}
	                        style={[
	                          styles.optionChip,
	                          { backgroundColor: colors.gray100, borderColor: colors.gray200 },
	                          region === r.id && { backgroundColor: colors.primary, borderColor: colors.primary },
	                        ]}
	                        textStyle={[
	                          styles.optionChipText,
	                          { color: colors.gray700 },
	                          region === r.id && { color: colors.textOnPrimary },
	                        ]}
	                      />
	                    ))}
	                  </ScrollView>
	                </View>
                )}

                {/* Commune / Ville */}
                {availableCommunes.length > 0 && (
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>{t('auth.createProfile.commune')}</Text>
                    <ScrollView
                      ref={communeScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.horizontalScroll}
                      contentContainerStyle={styles.horizontalScrollContent}
                    >
	                    {availableCommunes.map((c) => (
	                      <Chip
	                        key={c.id}
	                        label={c.label}
	                        selected={commune === c.id}
	                        onLayout={(event) => {
	                          const { x, width } = event.nativeEvent.layout;
	                          handleChipLayout(communeChipPositions, c.id, x, width);
	                        }}
	                        onPress={() => {
	                          form.setValue('commune', c.id);
	                          setTimeout(() => scrollToChip(communeScrollRef, communeChipPositions, c.id, true), 50);
	                        }}
	                        style={[
	                          styles.optionChip,
	                          { backgroundColor: colors.gray100, borderColor: colors.gray200 },
	                          commune === c.id && { backgroundColor: colors.primary, borderColor: colors.primary },
	                        ]}
	                        textStyle={[
	                          styles.optionChipText,
	                          { color: colors.gray700 },
	                          commune === c.id && { color: colors.textOnPrimary },
	                        ]}
	                      />
	                    ))}
	                  </ScrollView>
	                </View>
                )}

                {/* Separator - Contact */}
                <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

                {/* Téléphone */}
                <PhoneInput
                  label={isWhatsAppSignup ? `${t('auth.createProfile.phone')} *` : t('auth.createProfile.phone')}
                  value={phone}
                  onChangeValue={(e164) => form.setValue('phone', e164)}
                  defaultCountryCode={country}
                  editable={!isWhatsAppSignup}
                  hint={isWhatsAppSignup ? t('auth.createProfile.whatsappVerified') : t('common.optional')}
                />

                {/* Email */}
                <Input
                  label={t('auth.createProfile.email')}
                  placeholder="ton@email.com"
                  value={email}
                  onChangeText={(value) => form.setValue('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                {/* Préférences de travail */}
                <View style={[styles.preferencesSection, { borderTopColor: colors.gray200 }]}>
                  <Text style={[styles.preferencesSectionTitle, { color: colors.gray700 }]}>{t('auth.createProfile.workPreferences')}</Text>

                  <View style={styles.preferenceItem}>
                    <View style={styles.preferenceInfo}>
                      <Laptop size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
                      <View style={styles.preferenceTextContainer}>
                        <Text style={[styles.preferenceLabel, { color: colors.textPrimary }]}>{t('auth.createProfile.remoteAvailable')}</Text>
                        <Text style={[styles.preferenceDescription, { color: colors.gray500 }]}>{t('auth.createProfile.remoteAvailableDesc')}</Text>
                      </View>
                    </View>
                    <Toggle
                      value={remoteReady}
                      onValueChange={(value) => form.setValue('remoteReady', value)}
                    />
                  </View>

                  <View style={styles.preferenceItem}>
                    <View style={styles.preferenceInfo}>
                      <Plane size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
                      <View style={styles.preferenceTextContainer}>
                        <Text style={[styles.preferenceLabel, { color: colors.textPrimary }]}>{t('auth.createProfile.willingToRelocate')}</Text>
                        <Text style={[styles.preferenceDescription, { color: colors.gray500 }]}>{t('auth.createProfile.willingToRelocateDesc')}</Text>
                      </View>
                    </View>
                    <Toggle
                      value={willingToRelocate}
                      onValueChange={(value) => form.setValue('willingToRelocate', value)}
                    />
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { backgroundColor: colors.background, paddingBottom: Math.max(SPACING.lg, insets.bottom + SPACING.md) },
            ]}
          >
            <Pressable
              onPress={handleDeleteAccount}
              accessibilityRole="button"
              accessibilityLabel={t('auth.createProfile.deleteAccountCta')}
              style={styles.deleteFooterAction}
            >
              <Text style={[styles.deleteFooterText, { color: colors.gray600 }]}>
                {t('auth.createProfile.deleteAccountCta')}
              </Text>
            </Pressable>
            <Button
              title={
                form.state.isSubmitting
                  ? t('common.creating')
                  : t('auth.createProfile.complete')
              }
              onPress={handleSubmitProfile}
              disabled={!canProceed() || form.state.isSubmitting}
              fullWidth
              icon={
                form.state.isSubmitting ? undefined : (
                  <ChevronRight
                    size={ICON.size.md}
                    color={colors.textOnPrimary}
                    strokeWidth={ICON.strokeWidth}
                  />
                )
              }
              iconPosition="right"
            />
          </View>
        </ScrollToInputContext.Provider>
      </KeyboardAvoidingView>
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.width.thin,
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  deleteHeaderButton: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textAlign: 'right',
    maxWidth: 112,
  },

  keyboardView: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  deleteFooterAction: {
    alignSelf: 'center',
    marginBottom: SPACING.md,
    paddingVertical: SPACING.xs,
  },

  deleteFooterText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textDecorationLine: 'underline',
  },

  stepContent: {
    flex: 1,
  },

  stepHeader: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },

  stepTitle: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.sm,
  },

  formFields: {
    gap: SPACING.md,
  },

  // Photo section
  photoSection: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },

  photoContainer: {
    width: 100,
    height: 100,
    borderRadius: BORDER.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDER.width.thin,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },

  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  photoHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.sm,
  },

  separator: {
    height: 1,
    marginVertical: SPACING.md,
  },

  rowFields: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  halfField: {
    flex: 1,
  },

  fieldContainer: {
    gap: SPACING.xs,
  },

  fieldLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  optionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  optionButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
  },

  optionButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  horizontalScroll: {
    marginHorizontal: -SPACING.lg,
  },

  horizontalScrollContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },

  optionChip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.full,
  },

  optionChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },

  // Preferences Section
  preferencesSection: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: BORDER.width.thin,
    gap: SPACING.sm,
  },

  preferencesSectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.xs,
  },

  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },

  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },

  preferenceTextContainer: {
    flex: 1,
  },

  preferenceLabel: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  preferenceDescription: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
});
