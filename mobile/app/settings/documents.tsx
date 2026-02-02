/**
 * Documents Screen
 * Talent document management - listing, upload, and delete
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import {
  Upload,
  FileText,
  Trash2,
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { Button, PageLayout, EmptyState } from '../../src/components/ui';
import { useTheme } from '../../src/hooks/useTheme';
import { API_CONFIG } from '../../src/constants/config';
import documentService, {
  TalentDocument,
  DocumentStatus,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  UPLOAD_LIMITS,
  formatFileSize,
  getStatusColor,
} from '../../src/services/documentService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DocumentsScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<TalentDocument[]>([]);
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  const [previewDoc, setPreviewDoc] = useState<TalentDocument | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getFullFileUrl = (doc: TalentDocument) => {
    if (doc.file_url.startsWith('http')) return doc.file_url;
    return `${API_CONFIG.BASE_URL}${doc.file_url.startsWith('/') ? '' : '/'}${doc.file_url}`;
  };

  const loadDocuments = useCallback(async () => {
    try {
      const docsResponse = await documentService.listDocuments({ limit: 50 });
      setDocuments(docsResponse.documents);
      return docsResponse.documents;
    } catch (error) {
      console.error('Error loading documents:', error);
      Alert.alert('Erreur', 'Impossible de charger les documents');
      return [];
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const docsResponse = await documentService.listDocuments({ limit: 50 });
        setDocuments(docsResponse.documents);
        const hasPending = docsResponse.documents.some(
          (d: TalentDocument) => d.status === 'PENDING' || d.status === 'PROCESSING'
        );
        if (!hasPending && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch {}
    }, 3000);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const docs = await loadDocuments();
      setIsLoading(false);
      const hasPending = docs.some(
        (d: TalentDocument) => d.status === 'PENDING' || d.status === 'PROCESSING'
      );
      if (hasPending) startPolling();
    };
    load();
    return () => stopPolling();
  }, [loadDocuments, startPolling, stopPolling]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDocuments();
    setIsRefreshing(false);
  };

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const assets = result.assets.slice(0, UPLOAD_LIMITS.MAX_FILES_PER_REQUEST);

      for (const file of assets) {
        if (file.size && file.size > UPLOAD_LIMITS.MAX_FILE_SIZE_BYTES) {
          Alert.alert('Fichier trop volumineux', `"${file.name}" dépasse la taille maximale de ${UPLOAD_LIMITS.MAX_FILE_SIZE_MB} MB`);
          return;
        }
      }

      setIsUploading(true);

      if (assets.length === 1) {
        const file = assets[0];
        await documentService.uploadDocument({
          file: {
            uri: file.uri,
            name: file.name || 'document',
            type: file.mimeType || 'application/pdf',
          },
        });
      } else {
        await documentService.uploadMultipleDocuments(
          assets.map((file) => ({
            uri: file.uri,
            name: file.name || 'document',
            type: file.mimeType || 'application/pdf',
          }))
        );
      }

      const msg = assets.length === 1
        ? 'Document uploadé avec succès. Le traitement est en cours.'
        : `${assets.length} documents uploadés avec succès. Le traitement est en cours.`;
      Alert.alert('Succès', msg);
      await loadDocuments();
      startPolling();
    } catch (error: any) {
      console.error('Error uploading document:', error);

      // KYC gate: redirect to identity verification
      if (error?.code === 'IDENTITY_REQUIRED') {
        Alert.alert(
          'Vérification requise',
          'Tu dois vérifier ton identité avant d\'ajouter des documents.',
          [
            { text: 'Plus tard', style: 'cancel' },
            {
              text: 'Vérifier',
              onPress: () => router.push('/settings/kyc'),
            },
          ]
        );
        return;
      }

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
      startPolling();
    } catch (error) {
      Alert.alert('Erreur', "Impossible de relancer l'extraction");
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

  const formatRelativeDate = (dateStr: string | null): string | null => {
    if (!dateStr) return null;
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);
    const diffW = Math.floor(diffD / 7);
    const diffM = Math.floor(diffD / 30);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffH < 24) return `Il y a ${diffH}h`;
    if (diffD < 7) return `Il y a ${diffD}j`;
    if (diffW < 5) return `Il y a ${diffW} sem.`;
    if (diffM < 12) return `Il y a ${diffM} mois`;
    return `Il y a ${Math.floor(diffD / 365)} an${Math.floor(diffD / 365) > 1 ? 's' : ''}`;
  };

  const renderDocument = (doc: TalentDocument) => {
    const StatusIcon = getStatusIcon(doc.status);
    const statusColor = getStatusColor(doc.status);
    const relativeDate = formatRelativeDate(doc.created_at);
    const extracted = doc.extracted_data as Record<string, any> | undefined;
    const summaryText = doc.description || extracted?.summary || extracted?.description || null;
    const isExpanded = expandedDocs[doc.id] ?? false;
    const isImage = doc.mime_type.startsWith('image/');
    const fileUrl = getFullFileUrl(doc);

    return (
      <View
        key={doc.id}
        style={[
          styles.documentCard,
          { backgroundColor: colors.surface, borderColor: colors.borderColor },
        ]}
      >
        {/* Delete button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(doc)}
        >
          <Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>

        <View style={styles.cardContent}>
          {/* Thumbnail */}
          <TouchableOpacity
            style={[styles.thumbnail, { backgroundColor: colors.gray100 }]}
            onPress={() => setPreviewDoc(doc)}
            activeOpacity={0.7}
          >
            {isImage ? (
              <Image source={{ uri: fileUrl }} style={styles.thumbnailImage} resizeMode="cover" />
            ) : (
              <FileText size={24} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
            )}
          </TouchableOpacity>

          {/* Info */}
          <View style={styles.cardInfo}>
            {/* Title */}
            <TouchableOpacity onPress={() => setPreviewDoc(doc)} activeOpacity={0.7}>
              <Text style={[styles.documentTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {doc.title || doc.original_filename}
              </Text>
            </TouchableOpacity>

            {/* Type · Size */}
            <Text style={[styles.documentMeta, { color: colors.textSecondary }]}>
              {DOCUMENT_TYPE_LABELS[doc.document_type]} · {formatFileSize(doc.file_size)}
            </Text>

            {/* Tags row: status + retry + date */}
            <View style={styles.tagsRow}>
              <View style={[styles.tag, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
                {(doc.status === 'PENDING' || doc.status === 'PROCESSING') ? (
                  <ActivityIndicator size="small" color={statusColor} style={{ transform: [{ scale: 0.55 }] }} />
                ) : (
                  <StatusIcon size={12} color={statusColor} strokeWidth={ICON.strokeWidth} />
                )}
                <Text style={[styles.tagText, { color: statusColor }]}>
                  {DOCUMENT_STATUS_LABELS[doc.status]}
                </Text>
              </View>
              {doc.status === 'FAILED' && (
                <TouchableOpacity
                  style={[styles.tag, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                  onPress={() => handleRetry(doc)}
                >
                  <RotateCcw size={12} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.tagText, { color: colors.primary }]}>Réessayer</Text>
                </TouchableOpacity>
              )}
              {relativeDate && (
                <Text style={[styles.dateText, { color: colors.textDisabled }]}>
                  {relativeDate}
                </Text>
              )}
            </View>

            {/* Skills count badge */}
            {(() => {
              const extractedSkillsCount = extracted?.skills_count ?? extracted?.skills?.length ?? 0;
              return extractedSkillsCount > 0 ? (
                <Text style={[styles.skillsCount, { color: colors.primary }]}>
                  {extractedSkillsCount} compétence{extractedSkillsCount > 1 ? 's' : ''} extraite{extractedSkillsCount > 1 ? 's' : ''}
                </Text>
              ) : null;
            })()}
          </View>
        </View>

        {/* Summary / Description */}
        {summaryText && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setExpandedDocs((prev) => ({ ...prev, [doc.id]: !prev[doc.id] }))}
          >
            <Text
              style={[styles.summaryText, { color: colors.textSecondary }]}
              numberOfLines={isExpanded ? undefined : 2}
              onTextLayout={(e) => {
                // Only show "Voir plus" if text is actually truncated
                if (!isExpanded && e.nativeEvent.lines.length <= 2 && summaryText.length <= 100) {
                  // Text fits in 2 lines — no need for toggle
                }
              }}
            >
              {summaryText}
            </Text>
            {summaryText.length > 100 && (
              <Text style={[styles.seeMore, { color: colors.primary }]}>
                {isExpanded ? 'Voir moins' : 'Voir plus'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <>
      <PageLayout
        title="Mes documents"
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        isLoading={isLoading}
      >
        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Aucun document"
            subtitle="Ajoute tes CV, diplômes, certificats et autres documents professionnels."
            actionLabel="Ajouter un document"
            onAction={handleUpload}
          />
        ) : (
          <>
            <View style={styles.uploadSection}>
              <Button
                title={isUploading ? 'Upload en cours...' : 'Ajouter un document'}
                onPress={handleUpload}
                fullWidth
                disabled={isUploading}
                loading={isUploading}
                icon={!isUploading ? <Upload size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} /> : undefined}
                iconPosition="left"
              />
              <Text style={[styles.uploadHint, { color: colors.textDisabled }]}>
                PDF et images (JPEG, PNG, WebP) · Max {UPLOAD_LIMITS.MAX_FILES_PER_REQUEST} fichiers, {UPLOAD_LIMITS.MAX_FILE_SIZE_MB} MB chacun
              </Text>
            </View>
            {documents.map(renderDocument)}
          </>
        )}
      </PageLayout>

      {/* Preview Modal */}
      <Modal visible={!!previewDoc} animationType="fade" transparent>
        <View style={styles.previewOverlay}>
          <View style={[styles.previewContainer, { backgroundColor: colors.background }]}>
            <View style={styles.previewHeader}>
              <Text style={[styles.previewTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {previewDoc?.title || previewDoc?.original_filename}
              </Text>
              <TouchableOpacity onPress={() => setPreviewDoc(null)}>
                <X size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            </View>
            {previewDoc && (
              <View style={styles.previewContent}>
                {previewDoc.mime_type.startsWith('image/') ? (
                  <Image
                    source={{ uri: getFullFileUrl(previewDoc) }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                ) : (
                  <WebView
                    source={{ uri: getFullFileUrl(previewDoc) }}
                    style={styles.previewWebView}
                    startInLoadingState
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  uploadSection: { marginBottom: SPACING.lg },

  uploadHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  // Document Card
  documentCard: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.sm,
  },

  deleteButton: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  cardContent: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  thumbnail: {
    width: 48,
    height: 56,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  thumbnailImage: {
    width: '100%',
    height: '100%',
  },

  cardInfo: {
    flex: 1,
    paddingRight: SPACING.xl,
  },

  documentTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  documentMeta: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },

  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.full,
    borderWidth: BORDER.width.thin,
  },

  tagText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  dateText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginLeft: 'auto' as any,
  },

  skillsCount: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },

  summaryText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: 16,
    marginTop: SPACING.sm,
  },

  seeMore: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginTop: 2,
  },

  // Preview Modal
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  previewContainer: {
    width: SCREEN_WIDTH - SPACING.lg * 2,
    height: SCREEN_HEIGHT * 0.75,
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
  },

  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },

  previewTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    flex: 1,
    marginRight: SPACING.md,
  },

  previewContent: {
    flex: 1,
  },

  previewImage: {
    width: '100%',
    height: '100%',
  },

  previewWebView: {
    flex: 1,
  },
});
