import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CreditCard,
  Camera,
  Upload,
  Check,
  XCircle,
  Shield,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../src/constants/theme';
import { Button } from '../../src/components/ui';
import { useTheme } from '../../src/hooks/useTheme';
import { kycService, KYCDocumentType, imageService } from '../../src/services';
import { getFullImageUrl } from '../../src/utils/image';

type VerificationStatus = 'none' | 'verified' | 'rejected';
type DocumentType = 'id_card' | 'passport' | 'driver_license' | 'student_card';

const DOCUMENT_TYPES = [
  { id: 'id_card' as DocumentType, label: "Carte d'identité" },
  { id: 'passport' as DocumentType, label: 'Passeport' },
  { id: 'driver_license' as DocumentType, label: 'Permis de conduire' },
  { id: 'student_card' as DocumentType, label: 'Carte scolaire / étudiante' },
];

export default function KYCScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('none');
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(null);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);

  // Submitted document info
  const [submittedDocType, setSubmittedDocType] = useState<DocumentType | null>(null);
  const [submittedFrontImage, setSubmittedFrontImage] = useState<string | null>(null);
  const [submittedBackImage, setSubmittedBackImage] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    loadKYCStatus();
  }, []);

  const loadKYCStatus = async () => {
    try {
      setIsLoading(true);
      const response = await kycService.getStatus();
      const data = response.data;

      if (data && data.status) {
        // Map API status to local status (PENDING treated as none to allow resubmit)
        if (data.status === 'VERIFIED') {
          setVerificationStatus('verified');
        } else if (data.status === 'REJECTED') {
          setVerificationStatus('rejected');
        } else {
          setVerificationStatus('none');
        }

        // Document type
        if (data.document_type) {
          const docTypeMap: Record<string, DocumentType> = {
            'ID_CARD': 'id_card',
            'PASSPORT': 'passport',
            'DRIVER_LICENSE': 'driver_license',
            'STUDENT_CARD': 'student_card',
          };
          setSubmittedDocType(docTypeMap[data.document_type] || null);
        }

        // Images
        if (data.front_image_url) setSubmittedFrontImage(data.front_image_url);
        if (data.back_image_url) setSubmittedBackImage(data.back_image_url);
        if (data.rejection_reason) setRejectionReason(data.rejection_reason);
      }
    } catch (error) {
      console.error('Error loading KYC status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async (side: 'front' | 'back') => {
    try {
      const image = await imageService.pickImage({ type: 'identity' });
      if (image) {
        if (side === 'front') setFrontImage(image.uri);
        else setBackImage(image.uri);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
    }
  };

  const takePhoto = async (side: 'front' | 'back') => {
    try {
      const image = await imageService.takePhoto({ type: 'identity' });
      if (image) {
        if (side === 'front') setFrontImage(image.uri);
        else setBackImage(image.uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
    }
  };

  const showImageOptions = (side: 'front' | 'back') => {
    Alert.alert(
      'Ajouter une photo',
      'Comment voulez-vous ajouter la photo ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Prendre une photo', onPress: () => takePhoto(side) },
        { text: 'Galerie', onPress: () => pickImage(side) },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!selectedDocType || !frontImage) {
      Alert.alert('Erreur', 'Sélectionne un type de document et ajoute le recto.');
      return;
    }

    try {
      setIsSubmitting(true);

      const docTypeMap: Record<DocumentType, KYCDocumentType> = {
        'id_card': 'ID_CARD',
        'passport': 'PASSPORT',
        'driver_license': 'DRIVER_LICENSE',
        'student_card': 'STUDENT_CARD',
      };

      const frontImageUrl = await kycService.uploadImage(frontImage, `front_${Date.now()}.jpg`);
      const backImageUrl = backImage ? await kycService.uploadImage(backImage, `back_${Date.now()}.jpg`) : undefined;

      const result = await kycService.submit({
        document_type: docTypeMap[selectedDocType],
        front_image_url: frontImageUrl,
        back_image_url: backImageUrl,
      });

      // Reload status to get actual verification result
      await loadKYCStatus();

      if (result.data?.status === 'VERIFIED') {
        Alert.alert('Vérifié', 'Ton identité a été vérifiée avec succès.');
      } else {
        Alert.alert(
          'Non vérifié',
          result.data?.rejection_reason || 'Le document n\'a pas pu être vérifié. Réessaie avec une meilleure photo.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Error submitting KYC:', error);
      Alert.alert('Erreur', error?.error || 'Erreur lors de la soumission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDocTypeLabel = (docType: DocumentType | null): string => {
    if (!docType) return '';
    const labels: Record<DocumentType, string> = {
      'id_card': "Carte d'identité",
      'passport': 'Passeport',
      'driver_license': 'Permis de conduire',
      'student_card': 'Carte scolaire / étudiante',
    };
    return labels[docType] || '';
  };

  const renderSubmittedDocuments = () => {
    if (!submittedFrontImage) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Document soumis ({getDocTypeLabel(submittedDocType)})
        </Text>

        <View style={[styles.imagesRow]}>
          <View style={[styles.submittedImageCard, { borderColor: colors.borderColor, backgroundColor: colors.surface }]}>
            <Text style={[styles.submittedImageLabel, { color: colors.textSecondary }]}>Recto</Text>
            <Image source={{ uri: getFullImageUrl(submittedFrontImage) }} style={[styles.submittedImage, { backgroundColor: colors.gray100 }]} />
          </View>

          {submittedBackImage && (
            <View style={[styles.submittedImageCard, { borderColor: colors.borderColor, backgroundColor: colors.surface }]}>
              <Text style={[styles.submittedImageLabel, { color: colors.textSecondary }]}>Verso</Text>
              <Image source={{ uri: getFullImageUrl(submittedBackImage) }} style={[styles.submittedImage, { backgroundColor: colors.gray100 }]} />
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderStatus = () => {
    if (verificationStatus === 'verified') {
      return (
        <View style={[styles.statusCard, { backgroundColor: withOpacity(colors.success, OPACITY[15]), borderColor: colors.success }]}>
          <Check size={ICON.size.lg} color={colors.success} strokeWidth={ICON.strokeWidth} />
          <View style={styles.statusContent}>
            <Text style={[styles.statusTitle, { color: colors.success }]}>Identité vérifiée</Text>
            <Text style={[styles.statusDescription, { color: colors.textSecondary }]}>
              Tu peux maintenant créer une organisation, publier des offres et recevoir des paiements.
            </Text>
          </View>
        </View>
      );
    }

    if (verificationStatus === 'rejected') {
      return (
        <View style={[styles.statusCard, { backgroundColor: withOpacity(colors.error, OPACITY[15]), borderColor: colors.error }]}>
          <XCircle size={ICON.size.lg} color={colors.error} strokeWidth={ICON.strokeWidth} />
          <View style={styles.statusContent}>
            <Text style={[styles.statusTitle, { color: colors.error }]}>Vérification échouée</Text>
            {rejectionReason && (
              <Text style={[styles.statusDescription, { color: colors.textSecondary }]}>
                {rejectionReason}
              </Text>
            )}
          </View>
        </View>
      );
    }

    return null;
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Vérification d'identité</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card - only show if not verified */}
        {verificationStatus !== 'verified' && (
          <View style={[styles.infoCard, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
            <Shield size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.infoText, { color: colors.primary }]}>
              La vérification est requise pour créer une organisation, publier des offres et recevoir des paiements.
            </Text>
          </View>
        )}

        {/* Status */}
        {renderStatus()}

        {/* Submitted documents for verified status */}
        {verificationStatus === 'verified' && renderSubmittedDocuments()}

        {/* Form for none or rejected status */}
        {(verificationStatus === 'none' || verificationStatus === 'rejected') && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Type de document</Text>
              <View style={[styles.optionsList, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
                {DOCUMENT_TYPES.map((docType, index) => (
                  <TouchableOpacity
                    key={docType.id}
                    style={[
                      styles.optionItem,
                      { borderBottomColor: colors.gray100 },
                      index === DOCUMENT_TYPES.length - 1 && styles.optionItemLast,
                    ]}
                    onPress={() => setSelectedDocType(docType.id)}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: colors.gray100 }]}>
                      <CreditCard size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                    </View>
                    <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{docType.label}</Text>
                    <View style={[
                      styles.radioButton,
                      { borderColor: colors.gray300 },
                      selectedDocType === docType.id && { borderColor: colors.primary, backgroundColor: colors.primary },
                    ]}>
                      {selectedDocType === docType.id && (
                        <Check size={12} color={colors.textOnPrimary} strokeWidth={3} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Document Upload */}
            {selectedDocType && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Photos du document</Text>

                {/* Front */}
                <TouchableOpacity
                  style={[styles.uploadCard, { borderColor: colors.borderColor, backgroundColor: colors.surface }]}
                  onPress={() => showImageOptions('front')}
                >
                  {frontImage ? (
                    <>
                      <Image source={{ uri: frontImage }} style={styles.uploadedImage} />
                      <View style={[styles.uploadBadge, { backgroundColor: colors.success }]}>
                        <Check size={14} color={colors.textOnPrimary} strokeWidth={3} />
                      </View>
                    </>
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Camera size={ICON.size.xl} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                      <Text style={[styles.uploadLabel, { color: colors.textPrimary }]}>Recto</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Back */}
                <TouchableOpacity
                  style={[styles.uploadCard, { borderColor: colors.borderColor, backgroundColor: colors.surface }]}
                  onPress={() => showImageOptions('back')}
                >
                  {backImage ? (
                    <>
                      <Image source={{ uri: backImage }} style={styles.uploadedImage} />
                      <View style={[styles.uploadBadge, { backgroundColor: colors.success }]}>
                        <Check size={14} color={colors.textOnPrimary} strokeWidth={3} />
                      </View>
                    </>
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Camera size={ICON.size.xl} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                      <Text style={[styles.uploadLabel, { color: colors.textPrimary }]}>Verso (optionnel)</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Footer */}
      {(verificationStatus === 'none' || verificationStatus === 'rejected') && selectedDocType && frontImage && (
        <View style={[styles.footer, { backgroundColor: colors.background }]}>
          <Button
            title={isSubmitting ? "Vérification..." : "Vérifier mon identité"}
            onPress={handleSubmit}
            fullWidth
            disabled={isSubmitting}
            loading={isSubmitting}
            icon={!isSubmitting ? <Upload size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} /> : undefined}
            iconPosition="right"
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

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingBottom: SPACING.xxl,
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.lg,
  },

  infoText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.lg,
  },

  statusContent: {
    flex: 1,
  },

  statusTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.xs,
  },

  statusDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },

  section: {
    marginBottom: SPACING.lg,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.sm,
  },

  optionsList: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
  },

  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },

  optionItemLast: {
    borderBottomWidth: 0,
  },

  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  optionLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginLeft: SPACING.md,
  },

  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  uploadCard: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    height: 120,
    position: 'relative',
  },

  uploadPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },

  uploadLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  uploadBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  imagesRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  submittedImageCard: {
    flex: 1,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
  },

  submittedImageLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    padding: SPACING.xs,
    textAlign: 'center',
  },

  submittedImage: {
    width: '100%',
    height: 150,
    resizeMode: 'contain',
  },

  footer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
});
