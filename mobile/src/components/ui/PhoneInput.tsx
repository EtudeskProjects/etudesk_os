import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { ChevronDown, Search, X } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, LAYOUT, BORDER, ICON } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Tap } from './Tap';
import {
  PhoneCountry,
  PHONE_COUNTRIES,
  FAVORITE_COUNTRIES,
  getCountryByCode,
  parseE164,
} from '../../constants/phone-countries';

interface PhoneInputProps {
  label?: string;
  value: string;                        // E.164 complet "+2250700000000"
  onChangeValue: (e164: string) => void;
  defaultCountryCode?: string;          // 'CI' par defaut
  error?: string;
  hint?: string;
  editable?: boolean;
}

export function PhoneInput({
  label,
  value,
  onChangeValue,
  defaultCountryCode = 'CI',
  error,
  hint,
  editable = true,
}: PhoneInputProps) {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Parse value into country + local number
  const parsed = useMemo(() => parseE164(value, defaultCountryCode), [value, defaultCountryCode]);
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountry>(parsed.country);
  const [localNumber, setLocalNumber] = useState(parsed.localNumber);

  // Sync when value changes externally (e.g. pre-fill)
  useEffect(() => {
    const p = parseE164(value, defaultCountryCode);
    setSelectedCountry(p.country);
    setLocalNumber(p.localNumber);
  }, [value, defaultCountryCode]);

  // Sync when defaultCountryCode changes (e.g. country chip change in create-profile)
  useEffect(() => {
    const newCountry = getCountryByCode(defaultCountryCode);
    if (newCountry && newCountry.code !== selectedCountry.code) {
      setSelectedCountry(newCountry);
      // Recompose E.164 with new dial code
      const digits = localNumber.replace(/[^\d]/g, '');
      onChangeValue(digits ? `${newCountry.dialCode}${digits}` : '');
    }
  }, [defaultCountryCode]);

  const handleLocalNumberChange = useCallback((text: string) => {
    // Keep only digits
    const digits = text.replace(/[^\d]/g, '');
    setLocalNumber(digits);
    onChangeValue(digits ? `${selectedCountry.dialCode}${digits}` : '');
  }, [selectedCountry, onChangeValue]);

  const handleCountrySelect = useCallback((country: PhoneCountry) => {
    setSelectedCountry(country);
    setModalVisible(false);
    setSearchQuery('');
    // Recompose E.164 with new dial code
    const digits = localNumber.replace(/[^\d]/g, '');
    onChangeValue(digits ? `${country.dialCode}${digits}` : '');
  }, [localNumber, onChangeValue]);

  // Filter countries for modal search
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return PHONE_COUNTRIES;
    const q = searchQuery.toLowerCase().trim();
    return PHONE_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const renderCountryItem = useCallback(({ item }: { item: PhoneCountry }) => (
    <Tap
      style={[
        styles.countryItem,
        { borderBottomColor: colors.gray200 },
        item.code === selectedCountry.code && { backgroundColor: colors.gray100 },
      ]}
      onPress={() => handleCountrySelect(item)}
      activeOpacity={0.7}
    >
      <Text style={styles.countryFlag}>{item.flag}</Text>
      <Text style={[styles.countryName, { color: colors.textPrimary }]} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={[styles.countryDialCode, { color: colors.gray500 }]}>{item.dialCode}</Text>
    </Tap>
  ), [colors, selectedCountry.code, handleCountrySelect]);

  const keyExtractor = useCallback((item: PhoneCountry) => item.code, []);

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.gray100,
            borderColor: colors.borderColor,
          },
          isFocused && {
            borderColor: colors.primary,
            backgroundColor: colors.surface,
          },
          error ? { borderColor: colors.error } : undefined,
        ]}
      >
        {/* Country selector button */}
        <Tap
          style={styles.countrySelector}
          onPress={() => editable && setModalVisible(true)}
          disabled={!editable}
          activeOpacity={0.7}
        >
          <Text style={styles.selectorFlag}>{selectedCountry.flag}</Text>
          <Text style={[styles.selectorDialCode, { color: colors.textPrimary }]}>
            {selectedCountry.dialCode}
          </Text>
          <ChevronDown size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
        </Tap>

        {/* Vertical divider */}
        <View style={[styles.divider, { backgroundColor: colors.gray300 }]} />

        {/* Local number input */}
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          value={localNumber}
          onChangeText={handleLocalNumberChange}
          keyboardType="phone-pad"
          placeholder="07 00 00 00 00"
          placeholderTextColor={colors.gray500}
          editable={editable}
          autoCorrect={false}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>

      {/* Helper text / error */}
      {(error || hint) && (
        <View style={styles.helper}>
          <Text style={[styles.helperText, { color: error ? colors.error : colors.gray500 }]}>
            {error || hint}
          </Text>
        </View>
      )}

      {/* Country picker modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setModalVisible(false); setSearchQuery(''); }}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Modal header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.gray200 }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Indicatif pays
            </Text>
            <Tap
              onPress={() => { setModalVisible(false); setSearchQuery(''); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <X size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
            </Tap>
          </View>

          {/* Search bar */}
          <View style={[styles.searchContainer, { backgroundColor: colors.gray100, borderColor: colors.borderColor }]}>
            <Search size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher un pays..."
              placeholderTextColor={colors.gray500}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <Tap
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <X size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              </Tap>
            )}
          </View>

          {/* Favorites section (only when not searching) */}
          {!searchQuery.trim() && (
            <View style={styles.favoritesSection}>
              <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>Favoris</Text>
              {FAVORITE_COUNTRIES.map((c) => (
                <Tap
                  key={c.code}
                  style={[
                    styles.countryItem,
                    { borderBottomColor: colors.gray200 },
                    c.code === selectedCountry.code && { backgroundColor: colors.gray100 },
                  ]}
                  onPress={() => handleCountrySelect(c)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.countryFlag}>{c.flag}</Text>
                  <Text style={[styles.countryName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={[styles.countryDialCode, { color: colors.gray500 }]}>{c.dialCode}</Text>
                </Tap>
              ))}
              <Text style={[styles.sectionTitle, { color: colors.gray500, marginTop: SPACING.md }]}>
                Tous les pays
              </Text>
            </View>
          )}

          {/* Full country list */}
          <FlatList
            data={filteredCountries}
            keyExtractor={keyExtractor}
            renderItem={renderCountryItem}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={30}
            getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
  },

  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: LAYOUT.inputHeight,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
  },

  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
    gap: SPACING.xs,
    height: '100%',
  },

  selectorFlag: {
    fontSize: 20,
  },

  selectorDialCode: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  divider: {
    width: 1,
    height: 24,
  },

  input: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    height: '100%',
  },

  helper: {
    marginTop: SPACING.xs,
    minHeight: TYPOGRAPHY.fontSize.xs * 1.5,
  },

  helperText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },

  modalTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: SPACING.md,
    paddingHorizontal: SPACING.md,
    height: 40,
    borderRadius: BORDER.radius.sm,
    borderWidth: BORDER.width.thin,
    gap: SPACING.sm,
  },

  searchInput: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    height: '100%',
    padding: 0,
  },

  favoritesSection: {
    paddingBottom: SPACING.xs,
  },

  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },

  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: SPACING.md,
    height: 52,
  },

  countryFlag: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },

  countryName: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  countryDialCode: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});
