/**
 * Documents Screen
 * Talent document management - listing, upload, and delete
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import {
  ArrowLeft,
  Upload,
  FileText,
  Trash2,
  RotateCcw,
  File,
  Briefcase,
  GraduationCap,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { Button } from '../../src/components/ui';
import { useTheme } from '../../src/hooks/useTheme';
import documentService, {
  TalentDocument,
  DocumentStats,
  DocumentStatus,
  DocumentCategory,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_STATUS_LABELS,
  formatFileSize,
  getStatusColor,
} from '../../src/services/documentService';

export default function DocumentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<TalentDocument[]>([]);
  const [stats, setStats] = useState<DocumentStats | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const [docsResponse, statsResponse] = await Promise.all([
        documentService.listDocuments({ limit: 50 }),
        documentService.getDocumentStats(),
      ]);
      setDocuments(docsResponse.documents);
      setStats(statsResponse);
    } catch (error) {
      console.error('Error loading documents:', error);
      Alert.alert('Erreur', 'Impossible de charger les documents');
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await loadDocuments();
      setIsLoading(false);
    };
    load();
  }, [loadDocuments]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDocuments();
    setIsRefreshing(false);
  };

  const handleUpload = async () => {
    if (stats && !stats.canUpload) {
      Alert.alert(
        'Limite atteinte',
        `Tu as atteint la limite de ${stats.maxCount} documents. Supprime un document pour en ajouter un nouveau.`
      );
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];

      // Check file size
      if (file.size && file.size > 20 * 1024 * 1024) {
        Alert.alert('Fichier trop volumineux', 'La taille maximale est de 20 MB');
        return;
      }

      setIsUploading(true);

      await documentService.uploadDocument({
        file: {
          uri: file.uri,
          name: file.name || 'document',
          type: file.mimeType || 'application/pdf',
        },
      });

      Alert.alert('Succès', 'Document uploadé avec succès. Le traitement est en cours.');
      await loadDocuments();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      Alert.alert('Erreur', error?.message || "Erreur lors de l'upload");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (doc: TalentDocument) => {
    Alert.alert(
      'Supprimer le document',
      `Veux-tu vraiment supprimer "${doc.title || doc.original_filename}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await documentService.deleteDocument(doc.id);
              await loadDocuments();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer le document');
            }
          },
        },
      ]
    );
  };

  const handleRetry = async (doc: TalentDocument) => {
    try {
      await documentService.retryExtraction(doc.id);
      Alert.alert('Succès', "Nouvelle tentative d'extraction lancée");
      await loadDocuments();
    } catch (error) {
      Alert.alert('Erreur', "Impossible de relancer l'extraction");
    }
  };

  const getCategoryIcon = (category: DocumentCategory) => {
    switch (category) {
      case 'PROFESSIONAL':
        return Briefcase;
      case 'ACADEMIC':
        return GraduationCap;
      case 'IDENTITY':
        return CreditCard;
      default:
        return FileText;
    }
  };

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case 'PENDING':
      case 'PROCESSING':
        return Clock;
      case 'PROCESSED':
      case 'VERIFIED':
        return CheckCircle;
      case 'FAILED':
      case 'REJECTED':
        return XCircle;
      default:
        return AlertCircle;
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') {
      return FileText;
    }
    if (mimeType.startsWith('image/')) {
      return ImageIcon;
    }
    return File;
  };

  const renderDocument = (doc: TalentDocument) => {
    const CategoryIcon = getCategoryIcon(doc.category);
    const StatusIcon = getStatusIcon(doc.status);
    const FileIcon = getFileIcon(doc.mime_type);
    const statusColor = getStatusColor(doc.status);

    return (
      <View
        key={doc.id}
        style={[
          styles.documentCard,
          { backgroundColor: colors.surface, borderColor: colors.borderColor },
        ]}
      >
        {/* Header */}
        <View style={styles.documentHeader}>
          <View style={[styles.fileIconContainer, { backgroundColor: colors.gray100 }]}>
            <FileIcon size={ICON.size.lg} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
          </View>
          <View style={styles.documentInfo}>
            <Text style={[styles.documentTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {doc.title || doc.original_filename}
            </Text>
            <View style={styles.documentMeta}>
              <CategoryIcon size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.documentMetaText, { color: colors.textSecondary }]}>
                {DOCUMENT_TYPE_LABELS[doc.document_type]}
              </Text>
            </View>
          </View>
        </View>

        {/* Status */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
            <StatusIcon size={14} color={statusColor} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {DOCUMENT_STATUS_LABELS[doc.status]}
            </Text>
          </View>
          <Text style={[styles.fileSize, { color: colors.textDisabled }]}>
            {formatFileSize(doc.file_size)}
          </Text>
        </View>

        {/* Tags */}
        {doc.tags && doc.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {doc.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={[styles.tag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.tagText, { color: colors.textSecondary }]}>{tag}</Text>
              </View>
            ))}
            {doc.tags.length > 3 && (
              <Text style={[styles.moreTagsText, { color: colors.textDisabled }]}>
                +{doc.tags.length - 3}
              </Text>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          {doc.status === 'FAILED' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary + '10' }]}
              onPress={() => handleRetry(doc)}
            >
              <RotateCcw size={16} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Réessayer</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error + '10' }]}
            onPress={() => handleDelete(doc)}
          >
            <Trash2 size={16} color={colors.error} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.actionButtonText, { color: colors.error }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Mes documents</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
      >
        {/* Stats Card */}
        {stats && (
          <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {stats.currentCount}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Documents</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.gray200 }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {stats.maxCount - stats.currentCount}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Disponibles</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.gray200 }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {formatFileSize(stats.totalSize)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Utilisés</Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={[styles.progressBarContainer, { backgroundColor: colors.gray100 }]}>
              <View
                style={[
                  styles.progressBar,
                  {
                    backgroundColor: stats.canUpload ? colors.primary : colors.error,
                    width: `${Math.min((stats.currentCount / stats.maxCount) * 100, 100)}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.limitText, { color: colors.textDisabled }]}>
              {stats.currentCount} / {stats.maxCount} documents (max {stats.maxFileSizeMB} MB par fichier)
            </Text>
          </View>
        )}

        {/* Upload Button */}
        <View style={styles.uploadSection}>
          <Button
            title={isUploading ? 'Upload en cours...' : 'Ajouter un document'}
            onPress={handleUpload}
            fullWidth
            disabled={isUploading || (stats ? !stats.canUpload : false)}
            loading={isUploading}
            icon={!isUploading ? <Upload size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} /> : undefined}
            iconPosition="left"
          />
          <Text style={[styles.uploadHint, { color: colors.textDisabled }]}>
            PDF et images (JPEG, PNG, WebP) acceptés
          </Text>
        </View>

        {/* Documents List */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Documents ({documents.length})
          </Text>

          {documents.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
              <FileText size={48} color={colors.gray300} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>
                Aucun document
              </Text>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                Ajoute tes CV, diplômes, certificats et autres documents professionnels.
              </Text>
            </View>
          ) : (
            documents.map(renderDocument)
          )}
        </View>
      </ScrollView>
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

  // Stats Card
  statsCard: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: SPACING.md,
  },

  statItem: {
    alignItems: 'center',
  },

  statValue: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  statDivider: {
    width: 1,
    height: 30,
  },

  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },

  progressBar: {
    height: '100%',
    borderRadius: 3,
  },

  limitText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
  },

  // Upload Section
  uploadSection: {
    marginBottom: SPACING.lg,
  },

  uploadHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  // Section
  section: {
    marginBottom: SPACING.lg,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
  },

  emptyStateTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },

  emptyStateText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },

  // Document Card
  documentCard: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.sm,
  },

  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },

  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  documentInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },

  documentTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: 4,
  },

  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  documentMetaText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },

  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  fileSize: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },

  tag: {
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },

  tagText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  moreTagsText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },

  actionButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});
