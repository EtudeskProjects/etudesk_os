import { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Check,
  ArrowLeft,
  Camera,
  MapPin,
  Loader2,
  Building2,
  Banknote,
  Image as ImageIcon,
  Eye,
  Save,
  Send,
  Wifi,
  Car,
  Users,
  Phone,
  Coffee,
  Lock,
  Printer,
  Monitor,
  Thermometer,
  Shield,
  Mail,
  Calendar,
  Sun,
  Activity,
  Settings,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { Input, Button } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { useGeolocation } from '../../../src/hooks/useGeolocation';
import { COUNTRIES, getRegionsByCountry, getCommunesByRegion } from '../../../src/constants/location';
import {
  HUB_TYPE_DATA,
  HUB_ACCESS_TYPE_DATA,
  HUB_AMENITY_DATA,
  PRICING_TYPE_DATA,
  CAPACITY_DATA,
  WEEKDAY_DATA,
  HubAmenity,
  PricingType,
} from '../../../src/constants/hub';
import {
  HubType,
  AccessType,
  HUB_TYPE_LABELS,
  ACCESS_TYPE_LABELS,
} from '../../../src/types/models';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { hubService, CreateHubData, imageService } from '../../../src/services';

type Step = 'info' | 'lieu' | 'conditions' | 'media' | 'preview';

const STEPS: Step[] = ['info', 'lieu', 'conditions', 'media', 'preview'];

const STEP_TITLES: Record<Step, string> = {
  info: 'Infos',
  lieu: 'Lieu',
  conditions: 'Conditions',
  media: 'Media',
  preview: 'Aperçu',
};

const AMENITY_ICONS: Record<string, React.ComponentType<any>> = {
  wifi: Wifi,
  car: Car,
  users: Users,
  phone: Phone,
  coffee: Coffee,
  lock: Lock,
  printer: Printer,
  monitor: Monitor,
  thermometer: Thermometer,
  shield: Shield,
  mail: Mail,
  calendar: Calendar,
  sun: Sun,
  activity: Activity,
};

interface OpeningHour {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export default function CreateHubScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { selectedOrgId } = useSpace();
  const { isLoading: isGeoLoading, getCurrentLocation } = useGeolocation();
  const [currentStep, setCurrentStep] = useState<Step>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state - Info
  const [name, setName] = useState('');
  const [hubType, setHubType] = useState<HubType | null>(null);
  const [description, setDescription] = useState('');

  // Form state - Lieu
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('CI');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // Form state - Conditions
  const [accessType, setAccessType] = useState<AccessType | null>(null);
  const [pricingType, setPricingType] = useState<PricingType | null>(null);
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState<string | null>(null);
  const [selectedAmenities, setSelectedAmenities] = useState<HubAmenity[]>([]);
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>(
    WEEKDAY_DATA.map((day) => ({
      day: day.id,
      isOpen: day.id !== 'SUNDAY',
      openTime: '08:00',
      closeTime: '18:00',
    }))
  );

  // Form state - Media
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [illustrations, setIllustrations] = useState<string[]>([]);

  // Get regions and cities dynamically
  const availableRegions = country ? getRegionsByCountry(country) : [];
  const availableCities = country && region ? getCommunesByRegion(country, region) : [];

  const handleGeolocation = async () => {
    const result = await getCurrentLocation();
    if (result) {
      if (result.countryCode) setCountry(result.countryCode);
      if (result.regionCode) setRegion(result.regionCode);
      if (result.cityCode) setCity(result.cityCode);
    }
  };

  const pickImage = async (type: 'logo' | 'illustration') => {
    try {
      const image = await imageService.pickImage({ type });

      if (image) {
        if (type === 'logo') {
          setLogoUri(image.uri);
        } else if (illustrations.length < 5) {
          setIllustrations([...illustrations, image.uri]);
        }
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de la sélection de l\'image.');
    }
  };

  const removeIllustration = (index: number) => {
    setIllustrations(illustrations.filter((_, i) => i !== index));
  };

  const toggleAmenity = (amenityId: HubAmenity) => {
    setSelectedAmenities((prev) => {
      if (prev.includes(amenityId)) {
        return prev.filter((id) => id !== amenityId);
      }
      return [...prev, amenityId];
    });
  };

  const toggleDayOpen = (dayId: string) => {
    setOpeningHours((prev) =>
      prev.map((hour) =>
        hour.day === dayId ? { ...hour, isOpen: !hour.isOpen } : hour
      )
    );
  };

  const handleNext = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1]);
    } else {
      router.back();
    }
  };

  const buildHubData = (): CreateHubData => ({
    name,
    type: hubType || undefined,
    description: description || undefined,
    amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
    address: address || undefined,
    city: city || undefined,
    region: region || undefined,
    country: country || undefined,
    access_type: accessType || undefined,
    pricing_type: pricingType || undefined,
    price: price || undefined,
    capacity: capacity || undefined,
    opening_hours: openingHours.filter((h) => h.isOpen),
    contact_phone: contactPhone || undefined,
    contact_email: contactEmail || undefined,
    website_url: websiteUrl || undefined,
    organization_id: selectedOrgId || undefined,
  });

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    try {
      const data = buildHubData();
      await hubService.saveDraft(data);
      Alert.alert('Brouillon enregistré', 'L\'espace a été enregistré comme brouillon.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Une erreur est survenue lors de l\'enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    setIsSubmitting(true);
    try {
      const data = buildHubData();
      await hubService.create(data);
      Alert.alert('Espace créé', `"${name}" a été créé avec succès !`, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Une erreur est survenue lors de la création.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'info':
        return name.trim().length >= 3 && hubType !== null;
      case 'lieu':
        if (hubType === 'VIRTUAL_COMMUNITY') return true;
        return country.length > 0 && address.trim().length > 0;
      case 'conditions':
        return accessType !== null;
      case 'media':
        return true;
      case 'preview':
        return true;
      default:
        return false;
    }
  };

  const getPricingLabel = () => {
    if (!pricingType) return 'Non défini';
    const pt = PRICING_TYPE_DATA.find((p) => p.id === pricingType);
    if (pricingType === 'FREE') return 'Gratuit';
    if (pricingType === 'CUSTOM') return 'Sur devis';
    return price ? `${price} FCFA ${pt?.label || ''}` : pt?.label || '';
  };

  const getCapacityLabel = () => {
    if (!capacity) return 'Non définie';
    return CAPACITY_DATA.find((c) => c.id === capacity)?.label || capacity;
  };

  const getAmenityLabels = () => {
    return selectedAmenities.map((id) => {
      const amenity = HUB_AMENITY_DATA.find((a) => a.id === id);
      return amenity?.label || id;
    });
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, index) => {
        const isCompleted = STEPS.indexOf(currentStep) > index;
        const isCurrent = currentStep === step;
        return (
          <View key={step} style={styles.stepItem}>
            <View style={[styles.stepDot, { backgroundColor: colors.gray200 }, (isCurrent || isCompleted) && { backgroundColor: colors.primary }]}>
              {isCompleted ? <Check size={12} color={COLORS.white} strokeWidth={ICON.strokeWidth + 0.5} /> : <Text style={[styles.stepNumber, isCurrent && { color: COLORS.white }]}>{index + 1}</Text>}
            </View>
            <Text style={[styles.stepLabel, { color: colors.gray500 }, isCurrent && { color: colors.primary, fontWeight: TYPOGRAPHY.fontWeight.semibold }]}>{STEP_TITLES[step]}</Text>
          </View>
        );
      })}
    </View>
  );

  const renderInfoStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Building2 size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Informations de base</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>Décrivez votre espace</Text>
      </View>

      <View style={styles.formFields}>
        <Input label="Nom de l'espace *" placeholder="Ex: Impact Hub Abidjan" value={name} onChangeText={setName} autoCapitalize="words" />

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Type d'espace *</Text>
          <View style={styles.optionCards}>
            {HUB_TYPE_DATA.map((type) => {
              const isSelected = hubType === type.id;
              return (
                <TouchableOpacity key={type.id} style={[styles.optionCardSmall, { backgroundColor: colors.surface, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary }]} onPress={() => setHubType(type.id)} activeOpacity={0.7}>
                  <View style={styles.optionCardHeader}>
                    <Text style={[styles.optionCardTitleSmall, { color: colors.textPrimary }, isSelected && { color: colors.primary }]}>{type.label}</Text>
                    {isSelected && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
                  </View>
                  <Text style={[styles.optionCardDescriptionSmall, { color: colors.gray500 }]}>{type.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Description</Text>
          <View style={[styles.textAreaContainer, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
            <TextInput style={[styles.textArea, { color: colors.textPrimary }]} placeholder="Décrivez votre espace, ses avantages et son ambiance..." value={description} onChangeText={setDescription} multiline numberOfLines={4} maxLength={500} placeholderTextColor={colors.gray500} />
          </View>
          <Text style={[styles.charCount, { color: colors.gray500 }]}>{description.length}/500</Text>
        </View>
      </View>
    </View>
  );

  const renderLieuStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <MapPin size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Lieu & Contact</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>{hubType === 'VIRTUAL_COMMUNITY' ? 'Coordonnées de contact (optionnel)' : 'Où se situe votre espace ?'}</Text>
      </View>

      <View style={styles.formFields}>
        {hubType !== 'VIRTUAL_COMMUNITY' && (
          <>
            <TouchableOpacity style={[styles.geolocationButton, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]} onPress={handleGeolocation} disabled={isGeoLoading} activeOpacity={0.7}>
              {isGeoLoading ? <Loader2 size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} /> : <MapPin size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
              <Text style={[styles.geolocationButtonText, { color: colors.primary }]}>{isGeoLoading ? 'Localisation en cours...' : 'Utiliser ma position'}</Text>
            </TouchableOpacity>

            <Input label="Adresse *" placeholder="Ex: Cocody, Rue des Jardins" value={address} onChangeText={setAddress} autoCapitalize="words" />

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Pays *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={styles.horizontalScrollContent}>
                {COUNTRIES.map((c) => {
                  const isSelected = country === c.id;
                  return (
                    <TouchableOpacity key={c.id} style={[styles.optionChip, { backgroundColor: colors.gray100, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => { setCountry(c.id); setRegion(''); setCity(''); }}>
                      <Text style={[styles.optionChipText, { color: colors.gray700 }, isSelected && { color: COLORS.white }]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {availableRegions.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Région</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={styles.horizontalScrollContent}>
                  {availableRegions.map((r) => {
                    const isSelected = region === r.id;
                    return (
                      <TouchableOpacity key={r.id} style={[styles.optionChip, { backgroundColor: colors.gray100, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => { setRegion(r.id); setCity(''); }}>
                        <Text style={[styles.optionChipText, { color: colors.gray700 }, isSelected && { color: COLORS.white }]}>{r.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {availableCities.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Ville</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={styles.horizontalScrollContent}>
                  {availableCities.map((c) => {
                    const isSelected = city === c.id;
                    return (
                      <TouchableOpacity key={c.id} style={[styles.optionChip, { backgroundColor: colors.gray100, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setCity(c.id)}>
                        <Text style={[styles.optionChipText, { color: colors.gray700 }, isSelected && { color: COLORS.white }]}>{c.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />
          </>
        )}

        <Input label="Téléphone" placeholder="+225 07 00 00 00 00" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
        <Input label="Email" placeholder="contact@example.com" value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" />
        <Input label="Site web" placeholder="https://www.example.com" value={websiteUrl} onChangeText={setWebsiteUrl} keyboardType="url" autoCapitalize="none" />
      </View>
    </View>
  );

  const renderConditionsStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Banknote size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Conditions</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>Accès, tarifs et équipements</Text>
      </View>

      <View style={styles.formFields}>
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Type d'accès *</Text>
          <View style={styles.optionCards}>
            {HUB_ACCESS_TYPE_DATA.map((type) => {
              const isSelected = accessType === type.id;
              return (
                <TouchableOpacity key={type.id} style={[styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary }]} onPress={() => setAccessType(type.id)} activeOpacity={0.7}>
                  <View style={styles.optionCardHeader}>
                    <Text style={[styles.optionCardTitle, { color: colors.textPrimary }, isSelected && { color: colors.primary }]}>{type.label}</Text>
                    {isSelected && <Check size={18} color={colors.primary} strokeWidth={2.5} />}
                  </View>
                  <Text style={[styles.optionCardDescription, { color: colors.gray500 }]}>{type.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Tarification</Text>
          <View style={styles.tagsContainer}>
            {PRICING_TYPE_DATA.map((type) => {
              const isSelected = pricingType === type.id;
              return (
                <TouchableOpacity key={type.id} style={[styles.selectableTag, { backgroundColor: colors.surface, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary }]} onPress={() => setPricingType(isSelected ? null : type.id)} activeOpacity={0.7}>
                  {isSelected && <Check size={14} color={colors.primary} strokeWidth={2.5} />}
                  <Text style={[styles.selectableTagText, { color: colors.gray600 }, isSelected && { color: colors.primary }]}>{type.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {pricingType && pricingType !== 'FREE' && pricingType !== 'CUSTOM' && (
          <Input label="Tarif (FCFA)" placeholder="Ex: 5000" value={price} onChangeText={setPrice} keyboardType="numeric" />
        )}

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Capacité</Text>
          <View style={styles.tagsContainer}>
            {CAPACITY_DATA.map((cap) => {
              const isSelected = capacity === cap.id;
              return (
                <TouchableOpacity key={cap.id} style={[styles.selectableTag, { backgroundColor: colors.surface, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary }]} onPress={() => setCapacity(isSelected ? null : cap.id)} activeOpacity={0.7}>
                  {isSelected && <Check size={14} color={colors.primary} strokeWidth={2.5} />}
                  <Text style={[styles.selectableTagText, { color: colors.gray600 }, isSelected && { color: colors.primary }]}>{cap.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.separator, { backgroundColor: colors.gray200 }]} />

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Équipements ({selectedAmenities.length})</Text>
          <View style={styles.amenitiesGrid}>
            {HUB_AMENITY_DATA.slice(0, 12).map((amenity) => {
              const isSelected = selectedAmenities.includes(amenity.id);
              const IconComponent = AMENITY_ICONS[amenity.icon] || Settings;
              return (
                <TouchableOpacity key={amenity.id} style={[styles.amenityCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }, isSelected && { backgroundColor: colors.primary + '10', borderColor: colors.primary }]} onPress={() => toggleAmenity(amenity.id)} activeOpacity={0.7}>
                  <IconComponent size={18} color={isSelected ? colors.primary : colors.gray500} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.amenityLabel, { color: colors.gray600 }, isSelected && { color: colors.primary }]} numberOfLines={1}>{amenity.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {hubType !== 'VIRTUAL_COMMUNITY' && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Horaires</Text>
            <View style={styles.hoursContainer}>
              {openingHours.map((hour) => {
                const dayData = WEEKDAY_DATA.find((d) => d.id === hour.day);
                return (
                  <View key={hour.day} style={[styles.hourRow, { borderBottomColor: colors.gray100 }]}>
                    <TouchableOpacity style={styles.dayToggle} onPress={() => toggleDayOpen(hour.day)}>
                      <View style={[styles.dayCheckbox, { borderColor: colors.gray300 }, hour.isOpen && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                        {hour.isOpen && <Check size={12} color={COLORS.white} strokeWidth={2.5} />}
                      </View>
                      <Text style={[styles.dayLabel, { color: hour.isOpen ? colors.textPrimary : colors.gray400 }]}>{dayData?.short}</Text>
                    </TouchableOpacity>
                    {hour.isOpen ? (
                      <Text style={[styles.hoursText, { color: colors.textSecondary }]}>{hour.openTime} - {hour.closeTime}</Text>
                    ) : (
                      <Text style={[styles.closedText, { color: colors.gray400 }]}>Fermé</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );

  const renderMediaStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <ImageIcon size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Media</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>Logo et illustrations</Text>
      </View>

      <View style={styles.formFields}>
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Logo</Text>
          <View style={styles.logoRow}>
            <TouchableOpacity style={[styles.logoUpload, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]} onPress={() => pickImage('logo')}>
              {logoUri ? <Image source={{ uri: logoUri }} style={styles.logoPreview} /> : <Camera size={32} color={colors.gray400} strokeWidth={ICON.strokeWidth} />}
            </TouchableOpacity>
            <View style={styles.logoInfo}>
              <Text style={[styles.logoInfoText, { color: colors.textSecondary }]}>Format carré (1:1)</Text>
              {logoUri && <TouchableOpacity onPress={() => setLogoUri(null)}><Text style={[styles.removeText, { color: colors.error }]}>Supprimer</Text></TouchableOpacity>}
            </View>
          </View>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.gray700 }]}>Illustrations ({illustrations.length}/5)</Text>
          <View style={styles.galleryGrid}>
            {illustrations.map((uri, index) => (
              <View key={index} style={styles.galleryItem}>
                <Image source={{ uri }} style={styles.galleryImage} />
                <TouchableOpacity style={[styles.galleryRemove, { backgroundColor: colors.error }]} onPress={() => removeIllustration(index)}>
                  <Text style={styles.galleryRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {illustrations.length < 5 && (
              <TouchableOpacity style={[styles.galleryAdd, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]} onPress={() => pickImage('illustration')}>
                <Camera size={24} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  const renderPreviewStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Eye size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Aperçu</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>Vérifiez avant publication</Text>
      </View>

      <View style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          {illustrations.length > 0 ? <Image source={{ uri: illustrations[0] }} style={styles.previewCover} /> : <View style={[styles.previewCoverPlaceholder, { backgroundColor: colors.gray200 }]} />}
          {logoUri && <View style={[styles.previewLogoContainer, { backgroundColor: colors.background, borderColor: colors.gray200 }]}><Image source={{ uri: logoUri }} style={styles.previewLogo} /></View>}
        </View>

        <View style={[styles.previewSection, { marginTop: logoUri ? 40 : SPACING.md }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{name || 'Sans nom'}</Text>
          <View style={styles.previewTags}>
            {hubType && <View style={[styles.previewTag, { backgroundColor: colors.primary + '15' }]}><Text style={[styles.previewTagText, { color: colors.primary }]}>{HUB_TYPE_LABELS[hubType]}</Text></View>}
            {accessType && <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}><Text style={[styles.previewTagText, { color: colors.gray700 }]}>{ACCESS_TYPE_LABELS[accessType]}</Text></View>}
          </View>
        </View>

        {hubType !== 'VIRTUAL_COMMUNITY' && (
          <View style={styles.previewSection}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Adresse</Text>
            <Text style={[styles.previewValue, { color: colors.textPrimary }]}>{[address, city, region, country].filter(Boolean).join(', ') || 'Non définie'}</Text>
          </View>
        )}

        <View style={styles.previewGrid}>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Tarif</Text>
            <Text style={[styles.previewGridValue, { color: colors.textPrimary }]}>{getPricingLabel()}</Text>
          </View>
          <View style={[styles.previewGridItem, { borderColor: colors.gray100 }]}>
            <Text style={[styles.previewLabel, { color: colors.gray500 }]}>Capacité</Text>
            <Text style={[styles.previewGridValue, { color: colors.textPrimary }]}>{getCapacityLabel()}</Text>
          </View>
        </View>

        {selectedAmenities.length > 0 && (
          <View style={styles.previewSection}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Équipements ({selectedAmenities.length})</Text>
            <View style={styles.previewTags}>
              {getAmenityLabels().slice(0, 4).map((label, idx) => (
                <View key={idx} style={[styles.previewTag, { backgroundColor: colors.gray100 }]}><Text style={[styles.previewTagText, { color: colors.gray700 }]}>{label}</Text></View>
              ))}
              {selectedAmenities.length > 4 && <View style={[styles.previewTag, { backgroundColor: colors.gray100 }]}><Text style={[styles.previewTagText, { color: colors.gray700 }]}>+{selectedAmenities.length - 4}</Text></View>}
            </View>
          </View>
        )}

        {description && (
          <View style={styles.previewSection}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>Description</Text>
            <Text style={[styles.previewText, { color: colors.textSecondary }]} numberOfLines={3}>{description}</Text>
          </View>
        )}

        {illustrations.length > 1 && (
          <View style={styles.previewSection}>
            <Text style={[styles.previewSectionTitle, { color: colors.gray700 }]}>{illustrations.length} illustration(s)</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderFooter = () => {
    if (currentStep === 'preview') {
      return (
        <View style={[styles.footer, { backgroundColor: colors.background }]}>
          <View style={styles.footerButtons}>
            <TouchableOpacity style={[styles.draftButton, { borderColor: colors.gray300 }]} onPress={handleSaveDraft} disabled={isSubmitting}>
              <Save size={18} color={colors.gray600} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.draftButtonText, { color: colors.gray700 }]}>Brouillon</Text>
            </TouchableOpacity>
            <View style={styles.publishButton}>
              <Button title="Publier" onPress={handlePublish} disabled={isSubmitting} fullWidth icon={<Send size={18} color={COLORS.white} strokeWidth={ICON.strokeWidth} />} iconPosition="right" />
            </View>
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        <Button title="Continuer" onPress={handleNext} disabled={!canProceed()} fullWidth icon={<ChevronRight size={ICON.size.md} color={COLORS.white} strokeWidth={ICON.strokeWidth} />} iconPosition="right" />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}><ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Nouvel espace</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {renderStepIndicator()}
          {currentStep === 'info' && renderInfoStep()}
          {currentStep === 'lieu' && renderLieuStep()}
          {currentStep === 'conditions' && renderConditionsStep()}
          {currentStep === 'media' && renderMediaStep()}
          {currentStep === 'preview' && renderPreviewStep()}
        </ScrollView>
        {renderFooter()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  headerSpacer: { width: 40 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xl },
  stepIndicator: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xl },
  stepItem: { alignItems: 'center', gap: SPACING.xs },
  stepDot: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: BORDER.radius.full },
  stepNumber: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.white },
  stepLabel: { fontSize: TYPOGRAPHY.fontSize.xs },
  stepContent: { flex: 1 },
  stepHeader: { alignItems: 'center', marginBottom: SPACING.xl, gap: SPACING.sm },
  stepTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold },
  stepDescription: { fontSize: TYPOGRAPHY.fontSize.md, textAlign: 'center' },
  formFields: { gap: SPACING.lg },
  fieldContainer: { gap: SPACING.xs },
  fieldLabel: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium, marginBottom: SPACING.xs },
  horizontalScroll: { marginHorizontal: -SPACING.lg },
  horizontalScrollContent: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  optionChip: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.full },
  optionChipText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  selectableTag: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.full },
  selectableTagText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  textAreaContainer: { borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.sm, padding: SPACING.md },
  textArea: { fontSize: TYPOGRAPHY.fontSize.md, minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: TYPOGRAPHY.fontSize.xs, textAlign: 'right', marginTop: SPACING.xs },
  optionCards: { gap: SPACING.sm },
  optionCard: { padding: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.md },
  optionCardSmall: { padding: SPACING.sm, borderWidth: 1.5, borderRadius: BORDER.radius.md },
  optionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionCardTitle: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  optionCardTitleSmall: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  optionCardDescription: { fontSize: TYPOGRAPHY.fontSize.sm, marginTop: SPACING.xs },
  optionCardDescriptionSmall: { fontSize: TYPOGRAPHY.fontSize.xs, marginTop: 2 },
  separator: { height: 1, marginVertical: SPACING.md },
  geolocationButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.md, borderWidth: 1.5, borderRadius: BORDER.radius.sm, borderStyle: 'dashed' },
  geolocationButtonText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  amenityCard: { width: '31%', padding: SPACING.sm, borderWidth: 1.5, borderRadius: BORDER.radius.md, alignItems: 'center', gap: 4 },
  amenityLabel: { fontSize: TYPOGRAPHY.fontSize.xs, textAlign: 'center' },
  hoursContainer: { gap: SPACING.xs },
  hourRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1 },
  dayToggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dayCheckbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium, width: 40 },
  hoursText: { fontSize: TYPOGRAPHY.fontSize.sm },
  closedText: { fontSize: TYPOGRAPHY.fontSize.sm, fontStyle: 'italic' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  logoUpload: { width: 80, height: 80, borderRadius: BORDER.radius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden' },
  logoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  logoInfo: { flex: 1, gap: SPACING.xs },
  logoInfoText: { fontSize: TYPOGRAPHY.fontSize.sm },
  removeText: { fontSize: TYPOGRAPHY.fontSize.sm },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  galleryItem: { width: '31%', aspectRatio: 4 / 3, borderRadius: BORDER.radius.sm, overflow: 'hidden', position: 'relative' },
  galleryImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  galleryRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  galleryRemoveText: { color: COLORS.white, fontSize: 14, fontWeight: 'bold' },
  galleryAdd: { width: '31%', aspectRatio: 4 / 3, borderRadius: BORDER.radius.sm, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  previewContainer: { gap: SPACING.md },
  previewHeader: { position: 'relative' },
  previewCover: { width: '100%', height: 120, borderRadius: BORDER.radius.md, resizeMode: 'cover' },
  previewCoverPlaceholder: { width: '100%', height: 120, borderRadius: BORDER.radius.md },
  previewLogoContainer: { position: 'absolute', bottom: -30, left: SPACING.md, width: 64, height: 64, borderRadius: BORDER.radius.md, borderWidth: 3, overflow: 'hidden' },
  previewLogo: { width: '100%', height: '100%', resizeMode: 'cover' },
  previewSection: { paddingHorizontal: SPACING.sm },
  previewTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold },
  previewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  previewTag: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, borderRadius: BORDER.radius.full },
  previewTagText: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.medium },
  previewSectionTitle: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, marginBottom: SPACING.xs },
  previewValue: { fontSize: TYPOGRAPHY.fontSize.sm },
  previewGrid: { flexDirection: 'row' },
  previewGridItem: { flex: 1, padding: SPACING.md, borderWidth: 0.5 },
  previewLabel: { fontSize: TYPOGRAPHY.fontSize.xs, marginBottom: 2 },
  previewGridValue: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  previewText: { fontSize: TYPOGRAPHY.fontSize.sm, lineHeight: 20 },
  footer: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  footerButtons: { flexDirection: 'row', gap: SPACING.md },
  draftButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, borderWidth: 1.5, borderRadius: BORDER.radius.sm },
  draftButtonText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  publishButton: { flex: 1 },
});
