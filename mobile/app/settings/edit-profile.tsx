import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Camera,
  Laptop,
  Plane,
  Check,
  MapPin,
  Loader2,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SPACING, TYPOGRAPHY, ICON, LAYOUT, BORDER } from '../../src/constants/theme';
import { Input, Button, Toggle } from '../../src/components/ui';
import { COUNTRIES, GENDERS, getRegionsByCountry, getCommunesByRegion } from '../../src/constants/location';
import { useTheme } from '../../src/hooks/useTheme';
import { useGeolocation } from '../../src/hooks/useGeolocation';
import { useAuth } from '../../src/contexts/AuthContext';
import { talentService, imageService } from '../../src/services';

export default function EditProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isLoading: isGeoLoading, getCurrentLocation } = useGeolocation();
  const { refreshUser } = useAuth();

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Profile photo
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Form state - Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [commune, setCommune] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Refs for auto-scroll to selected country
  const countryScrollRef = useRef<ScrollView>(null);
  const COUNTRY_CHIP_WIDTH = 80;

  // Preferences
  const [remoteReady, setRemoteReady] = useState(false);
  const [willingToRelocate, setWillingToRelocate] = useState(false);

  // Load profile data on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const response = await talentService.getMyProfile();
      const profile = response.data;

      if (profile) {
        setFirstName(profile.first_name || '');
        setLastName(profile.last_name || '');
        setGender(profile.gender || '');
        setBirthday(profile.birthday ? new Date(profile.birthday) : null);
        setCountry(profile.country || '');
        setRegion(profile.region || '');
        setCommune(profile.city || '');
        setPhone(profile.phone || '');
        setEmail(profile.email || '');
        setAvatarUri(profile.avatar_url || null);
        setRemoteReady(profile.remote_ready || false);
        setWillingToRelocate(profile.willing_to_relocate || false);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      // Use default values if profile can't be loaded
    } finally {
      setIsLoading(false);
    }
  };

  // Get regions and communes dynamically
  const availableRegions = country ? getRegionsByCountry(country) : [];
  const availableCommunes = country && region ? getCommunesByRegion(country, region) : [];

  // Auto-scroll to selected country after loading
  useEffect(() => {
    if (country && countryScrollRef.current && !isLoading) {
      const countryIndex = COUNTRIES.findIndex(c => c.id === country);
      if (countryIndex > 0) {
        setTimeout(() => {
          countryScrollRef.current?.scrollTo({
            x: countryIndex * COUNTRY_CHIP_WIDTH,
            animated: true,
          });
        }, 300);
      }
    }
  }, [country, isLoading]);

  const formatBirthday = (date: Date | null): string => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setBirthday(selectedDate);
    }
  };

  const handleDatePickerDone = () => {
    setShowDatePicker(false);
  };

  const pickImage = async () => {
    try {
      // Use centralized imageService for optimized image picking
      const image = await imageService.pickImage({ type: 'avatar' });
      if (image) {
        setAvatarUri(image.uri);
        console.log(`[EditProfile] Avatar selected: ${image.width}x${image.height}`);
      }
    } catch (error) {
      console.error('Erreur lors de la sélection de l\'image:', error);
    }
  };

  // Handle geolocation
  const handleGeolocation = async () => {
    const result = await getCurrentLocation();
    if (result) {
      if (result.countryCode) {
        setCountry(result.countryCode);
      }
      if (result.regionCode) {
        setRegion(result.regionCode);
      }
      if (result.cityCode) {
        setCommune(result.cityCode);
      }
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const displayName = `${firstName} ${lastName}`.trim() || firstName || lastName;

      await talentService.updateMyProfile({
        display_name: displayName,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        gender: gender as 'M' | 'F' | 'O' || undefined,
        birthday: birthday?.toISOString().split('T')[0] || undefined,
        country: country || undefined,
        region: region || undefined,
        city: commune || undefined,
        phone: phone || undefined,
        avatar_url: avatarUri || undefined,
        remote_ready: remoteReady,
        willing_to_relocate: willingToRelocate,
      });

      // Refresh user data in AuthContext to update avatar everywhere
      await refreshUser();

      Alert.alert('Succès', 'Ton profil a été mis à jour.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert(
        'Erreur',
        error?.error || 'Une erreur est survenue lors de la mise à jour du profil.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = () => {
    const f = firstName.charAt(0) || '';
    const l = lastName.charAt(0) || '';
    return `${f}${l}`.toUpperCase() || '?';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Modifier le profil</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>{getInitials()}</Text>
                </View>
              )}
              <View style={[styles.cameraButton, { backgroundColor: colors.primary }]}>
                <Camera size={ICON.size.sm} color={COLORS.white} strokeWidth={ICON.strokeWidth} />
              </View>
            </TouchableOpacity>
            <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>
              Appuie pour changer ta photo
            </Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formFields}>
            {/* Prénom & Nom */}
            <View style={styles.rowFields}>
              <View style={styles.halfField}>
                <Input
                  label="Prénom"
                  placeholder=""
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.halfField}>
                <Input
                  label="Nom"
                  placeholder=""
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Genre */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Genre</Text>
              <View style={styles.optionsRow}>
                {GENDERS.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={[
                      styles.optionButton,
                      { borderColor: colors.gray200, backgroundColor: colors.gray100 },
                      gender === g.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setGender(g.id)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        { color: colors.gray700 },
                        gender === g.id && { color: COLORS.white },
                      ]}
                    >
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date de naissance */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Date de naissance</Text>
              <TouchableOpacity
                style={[styles.datePickerButton, { borderColor: colors.gray200, backgroundColor: colors.gray50 }]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.datePickerText, { color: colors.textPrimary }, !birthday && { color: colors.gray500 }]}>
                  {birthday ? formatBirthday(birthday) : 'Sélectionner une date'}
                </Text>
              </TouchableOpacity>
              {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={birthday || new Date(2000, 0, 1)}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  minimumDate={new Date(1940, 0, 1)}
                />
              )}
              {Platform.OS === 'ios' && (
                <Modal
                  visible={showDatePicker}
                  transparent
                  animationType="slide"
                >
                  <View style={styles.datePickerModalOverlay}>
                    <View style={[styles.datePickerModalContent, { backgroundColor: colors.background }]}>
                      <View style={[styles.datePickerModalHeader, { borderBottomColor: colors.borderColor }]}>
                        <TouchableOpacity onPress={handleDatePickerDone}>
                          <Text style={[styles.datePickerDoneButton, { color: colors.primary }]}>Terminer</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={birthday || new Date(2000, 0, 1)}
                        mode="date"
                        display="spinner"
                        onChange={handleDateChange}
                        maximumDate={new Date()}
                        minimumDate={new Date(1940, 0, 1)}
                        locale="fr-FR"
                        style={styles.iosDatePicker}
                      />
                    </View>
                  </View>
                </Modal>
              )}
            </View>

            {/* Geolocation Button */}
            <TouchableOpacity
              style={[
                styles.geolocationButton,
                { backgroundColor: colors.primary + '10', borderColor: colors.primary },
              ]}
              onPress={handleGeolocation}
              disabled={isGeoLoading}
              activeOpacity={0.7}
            >
              {isGeoLoading ? (
                <Loader2 size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              ) : (
                <MapPin size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              )}
              <Text style={[styles.geolocationButtonText, { color: colors.primary }]}>
                {isGeoLoading ? 'Localisation en cours...' : 'Utiliser ma position actuelle'}
              </Text>
            </TouchableOpacity>

            {/* Pays */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Pays</Text>
              <ScrollView
                ref={countryScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalScroll}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {COUNTRIES.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.optionChip,
                      { borderColor: colors.gray200, backgroundColor: colors.gray100 },
                      country === c.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      setCountry(c.id);
                      setRegion('');
                      setCommune('');
                    }}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        { color: colors.gray700 },
                        country === c.id && { color: COLORS.white },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Région */}
            {availableRegions.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Région</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.horizontalScroll}
                  contentContainerStyle={styles.horizontalScrollContent}
                >
                  {availableRegions.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[
                        styles.optionChip,
                        { borderColor: colors.gray200, backgroundColor: colors.gray100 },
                        region === r.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => {
                        setRegion(r.id);
                        setCommune('');
                      }}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          { color: colors.gray700 },
                          region === r.id && { color: COLORS.white },
                        ]}
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Commune */}
            {availableCommunes.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Commune / Ville</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.horizontalScroll}
                  contentContainerStyle={styles.horizontalScrollContent}
                >
                  {availableCommunes.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.optionChip,
                        { borderColor: colors.gray200, backgroundColor: colors.gray100 },
                        commune === c.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => setCommune(c.id)}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          { color: colors.gray700 },
                          commune === c.id && { color: COLORS.white },
                        ]}
                      >
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Téléphone */}
            <Input
              label="Téléphone"
              placeholder="+225 07 00 00 00 00"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            {/* Email */}
            <Input
              label="Email"
              placeholder="ton@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Préférences de travail */}
            <View style={[styles.preferencesSection, { borderTopColor: colors.gray200 }]}>
              <Text style={[styles.preferencesSectionTitle, { color: colors.gray700 }]}>
                Préférences de travail
              </Text>

              <View style={styles.preferenceItem}>
                <View style={styles.preferenceInfo}>
                  <Laptop size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
                  <View style={styles.preferenceTextContainer}>
                    <Text style={[styles.preferenceLabel, { color: colors.textPrimary }]}>Disponible en remote</Text>
                    <Text style={[styles.preferenceDescription, { color: colors.gray500 }]}>Je peux travailler à distance</Text>
                  </View>
                </View>
                <Toggle
                  value={remoteReady}
                  onValueChange={setRemoteReady}
                />
              </View>

              <View style={styles.preferenceItem}>
                <View style={styles.preferenceInfo}>
                  <Plane size={ICON.size.md} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
                  <View style={styles.preferenceTextContainer}>
                    <Text style={[styles.preferenceLabel, { color: colors.textPrimary }]}>Ouvert à la relocalisation</Text>
                    <Text style={[styles.preferenceDescription, { color: colors.gray500 }]}>Je peux déménager pour une opportunité</Text>
                  </View>
                </View>
                <Toggle
                  value={willingToRelocate}
                  onValueChange={setWillingToRelocate}
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: colors.background }]}>
          <Button
            title={isSaving ? "Enregistrement..." : "Enregistrer"}
            onPress={handleSave}
            fullWidth
            disabled={isSaving}
            icon={isSaving ? undefined : <Check size={ICON.size.md} color={COLORS.white} strokeWidth={ICON.strokeWidth} />}
            iconPosition="right"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  headerSpacer: {
    width: 40,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },

  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.sm,
  },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: BORDER.radius.lg,
  },

  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: BORDER.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },

  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  avatarHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Form
  formFields: {
    gap: SPACING.md,
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

  geolocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.sm,
    borderStyle: 'dashed',
  },

  geolocationButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  datePickerButton: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    height: LAYOUT.inputHeight,
    justifyContent: 'center',
  },

  datePickerText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  datePickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },

  datePickerModalContent: {
    borderTopLeftRadius: BORDER.radius.lg,
    borderTopRightRadius: BORDER.radius.lg,
    paddingBottom: SPACING.xl,
  },

  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: BORDER.width.thin,
  },

  datePickerDoneButton: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  iosDatePicker: {
    height: 200,
  },

  textAreaContainer: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    padding: SPACING.md,
  },

  textArea: {
    fontSize: TYPOGRAPHY.fontSize.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  charCount: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },

  // Preferences
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

  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
});
