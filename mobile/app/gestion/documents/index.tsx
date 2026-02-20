import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { WebView } from 'react-native-webview';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Upload,
  FileText,
  FolderOpen,
  Trash2,
  Download,
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { Button, Chip, IconButton, PageLayout, EmptyState, SelectCard, ShimmerPlaceholder } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { API_CONFIG } from '../../../src/constants/config';
import {
  orgDocumentService,
  OrgDocument,
  OrgDocumentStatus,
  ORG_DOCUMENT_TYPE_LABELS,
  ORG_DOCUMENT_STATUS_LABELS,
  getOrgDocStatusColor,
  formatOrgFileSize,
} from '../../../src/services';
import { useAlert } from '../../../src/contexts/AlertContext';
import { downloadAndOpenDocument } from '../../../src/utils/documentDownload';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OrgDocumentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { selectedOrg } = useSpace();

  const [documents, setDocuments] = useState<OrgDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  const [previewDoc, setPreviewDoc] = useState<OrgDocument | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getFullFileUrl = (doc: OrgDocument) => {
    if (doc.file_url.startsWith('http')) return doc.file_url;
    return `${API_CONFIG.BASE_URL}${doc.file_url.startsWith('/') ? '' : '/'}${doc.file_url}`;
  };

  const loadDocuments = useCallback(async () => {
    if (!selectedOrg?.id) {
      setIsLoading(false);
      return [];
    }

    try {
      const result = await orgDocumentService.listDocuments(selectedOrg.id, { limit: 50 });
      setDocuments(result.documents);
      setTotal(result.total);
      return result.documents;
    } catch (error) {
      if (__DEV__) console.error('Error loading org documents:', error);
      return [];
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedOrg?.id]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      if (!selectedOrg?.id) return;
      try {
        const result = await orgDocumentService.listDocuments(selectedOrg.id, { limit: 50 });
        setDocuments(result.documents);
        const hasPending = result.documents.some(
          (d) => d.status === 'PENDING' || d.status === 'PROCESSING'
        );
        if (!hasPending && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch {}
    }, 3000);
  }, [selectedOrg?.id]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);
  const alerts = useAlert();

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const docs = await loadDocuments();
      const hasPending = docs.some(
        (d: OrgDocument) => d.status === 'PENDING' || d.status === 'PROCESSING'
      );
      if (hasPending) startPolling();
    };
    load();
    return () => stopPolling();
  }, [loadDocuments, startPolling, stopPolling]);

  useFocusEffect(
    useCallback(() => {
      loadDocuments();
    }, [loadDocuments])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDocuments();
    setIsRefreshing(false);
  };

  const handleUpload = async () => {
    if (!selectedOrg?.id) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const assets = result.assets.slice(0, 5);

      for (const file of assets) {
        if (file.size && file.size > 20 * 1024 * 1024) {
          void alerts.alert('Fichier trop volumineux', `"${file.name}" dépasse la taille maximale de 20 MB`);
          return;
        }
      }

      setIsUploading(true);

      for (const file of assets) {
        await orgDocumentService.uploadDocument(selectedOrg.id, {
          file: {
            uri: file.uri,
            name: file.name || 'document',
            type: file.mimeType || 'application/pdf',
          },
        });
      }

      const msg = assets.length === 1
        ? 'Document uploadé. Le traitement est en cours.'
        : `${assets.length} documents uploadés. Le traitement est en cours.`;
      void alerts.alert('Succès', msg);
      await loadDocuments();
      startPolling();
    } catch (error: any) {
      if (__DEV__) console.error('Error uploading document:', error);
      void alerts.alert('Erreur', error?.message || "Erreur lors de l'upload");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (doc: OrgDocument) => {
    try {
      await downloadAndOpenDocument({
        url: doc.file_url,
        filename: doc.original_filename,
        mimeType: doc.mime_type,
      });
    } catch (error) {
      void alerts.alert('Erreur', 'Impossible de télécharger le document');
    }
  };

  const handleDelete = (doc: OrgDocument) => {
    if (!selectedOrg?.id) return;
    void alerts.showAlert({ title: 'Supprimer le document', message: `Veux-tu vraiment supprimer "${doc.title || doc.original_filename}" ?`, buttons: [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await orgDocumentService.deleteDocument(selectedOrg!.id, doc.id);
              await loadDocuments();
            } catch (error) {
              void alerts.alert('Erreur', 'Impossible de supprimer le document');
            }
          },
        },
      ] });
  };

  const handleRetry = async (doc: OrgDocument) => {
    if (!selectedOrg?.id) return;
    try {
      await orgDocumentService.retryExtraction(selectedOrg.id, doc.id);
      void alerts.alert('Succès', "Nouvelle tentative d'extraction lancée");
      await loadDocuments();
      startPolling();
    } catch (error) {
      void alerts.alert('Erreur', "Impossible de relancer l'extraction");
    }
  };

  const getStatusIcon = (status: OrgDocumentStatus) => {
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

  const renderDocument = (doc: OrgDocument) => {
    const StatusIcon = getStatusIcon(doc.status as OrgDocumentStatus);
    const statusColor = getOrgDocStatusColor(doc.status as OrgDocumentStatus);
    const relativeDate = formatRelativeDate(doc.created_at);
    const summaryText = doc.description || null;
    const isExpanded = expandedDocs[doc.id] ?? false;
    const isImage = doc.mime_type?.startsWith('image/');
    const fileUrl = getFullFileUrl(doc);

    return (
      <View
        key={doc.id}
        style={[styles.documentCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      >
        {/* Action buttons */}
        <View style={styles.cardActions}>
          <IconButton
            onPress={() => handleDownload(doc)}
            icon={<Download size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
            accessibilityLabel="Télécharger"
          />
          <IconButton
            onPress={() => handleDelete(doc)}
            icon={<Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />}
            accessibilityLabel="Supprimer"
          />
        </View>

        <View style={styles.cardContent}>
          {/* Thumbnail */}
          <SelectCard
            style={[styles.thumbnail, { backgroundColor: colors.gray100, borderWidth: 0, borderColor: 'transparent' }]}
            onPress={() => setPreviewDoc(doc)}
            selected={false}
            accessibilityLabel="Prévisualiser"
          >
            {isImage ? (
              <Image source={{ uri: fileUrl }} style={styles.thumbnailImage} resizeMode="cover" />
            ) : (
              <FileText size={24} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
            )}
          </SelectCard>

          {/* Info */}
          <View style={styles.cardInfo}>
            <SelectCard
              onPress={() => setPreviewDoc(doc)}
              selected={false}
              accessibilityLabel="Prévisualiser"
              style={{ borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent' }}
            >
              <Text style={[styles.documentTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {doc.title || doc.original_filename}
              </Text>
            </SelectCard>

            <Text style={[styles.documentMeta, { color: colors.textSecondary }]}>
              {ORG_DOCUMENT_TYPE_LABELS[doc.document_type]} · {formatOrgFileSize(doc.file_size)}
            </Text>

            {/* Status row */}
            <View style={styles.tagsRow}>
              <View style={[styles.tag, { backgroundColor: withOpacity(statusColor, OPACITY[20]), borderColor: statusColor }]}>
                {(doc.status === 'PENDING' || doc.status === 'PROCESSING') ? (
                  <ShimmerPlaceholder width={14} height={10} variant="bar" />
                ) : (
                  <StatusIcon size={12} color={statusColor} strokeWidth={ICON.strokeWidth} />
                )}
                <Text style={[styles.tagText, { color: statusColor }]}>
                  {ORG_DOCUMENT_STATUS_LABELS[doc.status as OrgDocumentStatus] || doc.status}
                </Text>
              </View>
              {doc.status === 'FAILED' && (
                <Chip
                  label="Réessayer"
                  onPress={() => handleRetry(doc)}
                  leftIcon={<RotateCcw size={12} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
                  style={[styles.tag, { backgroundColor: withOpacity(colors.primary, OPACITY[20]), borderColor: colors.primary }]}
                  textStyle={[styles.tagText, { color: colors.primary }]}
                />
              )}
              {relativeDate && (
                <Text style={[styles.dateText, { color: colors.textDisabled }]}>
                  {relativeDate}
                </Text>
              )}
            </View>

            {/* AI tags */}
            {doc.tags && doc.tags.length > 0 && (
              <View style={styles.aiTagsRow}>
                {doc.tags.slice(0, 3).map((tag, i) => (
                  <View key={i} style={[styles.aiTag, { backgroundColor: colors.gray100 }]}>
                    <Text style={[styles.aiTagText, { color: colors.textSecondary }]}>{tag}</Text>
                  </View>
                ))}
                {doc.tags.length > 3 && (
                  <Text style={[styles.moreTagsText, { color: colors.gray400 }]}>
                    +{doc.tags.length - 3}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Summary / Description */}
        {summaryText && (
          <SelectCard
            onPress={() => setExpandedDocs((prev) => ({ ...prev, [doc.id]: !prev[doc.id] }))}
            selected={false}
            accessibilityLabel={isExpanded ? 'Réduire le résumé' : 'Déployer le résumé'}
            style={{ borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent' }}
          >
            <Text
              style={[styles.summaryText, { color: colors.textSecondary }]}
              numberOfLines={isExpanded ? undefined : 2}
            >
              {summaryText}
            </Text>
            {summaryText.length > 100 && (
              <Text style={[styles.seeMore, { color: colors.primary }]}>
                {isExpanded ? 'Voir moins' : 'Voir plus'}
              </Text>
            )}
          </SelectCard>
        )}
      </View>
    );
  };

  return (
    <>
      <PageLayout
        title={`Mes Documents (${total})`}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        isLoading={isLoading}
      >
        {documents.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="Aucun document"
            subtitle="Uploadez vos documents d'organisation pour les analyser automatiquement."
            actionLabel="Ajouter un document"
            onAction={handleUpload}
            tip="Astuce : l'assistant a accès à tous les documents chargés ici et peut également en sauvegarder depuis une conversation."
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
                PDF et images (JPEG, PNG, WebP) · Max 5 fichiers, 20 MB chacun
              </Text>
            </View>
            {documents.map(renderDocument)}
          </>
        )}
      </PageLayout>

      {/* Preview Modal */}
      <Modal visible={!!previewDoc} animationType="fade" transparent>
        <View style={[styles.previewOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.previewContainer, { backgroundColor: colors.background }]}>
            <View style={styles.previewHeader}>
              <Text style={[styles.previewTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {previewDoc?.title || previewDoc?.original_filename}
              </Text>
              <IconButton
                onPress={() => setPreviewDoc(null)}
                icon={<X size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
                accessibilityLabel="Fermer"
                size="sm"
                variant="ghost"
              />
            </View>
            {previewDoc && (
              <View style={styles.previewContent}>
                {previewDoc.mime_type?.startsWith('image/') ? (
                  <Image
                    source={{ uri: getFullFileUrl(previewDoc) }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                ) : (
                  <WebView
                    source={{ uri: Platform.OS === 'android'
                      ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(getFullFileUrl(previewDoc))}`
                      : getFullFileUrl(previewDoc)
                    }}
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
  // Upload section
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

  cardActions: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
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
    paddingRight: 80,
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

  aiTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: SPACING.xs,
  },

  aiTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER.radius.full,
  },

  aiTagText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  moreTagsText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: 16,
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
