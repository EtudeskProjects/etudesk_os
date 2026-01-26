import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  FileText,
  Upload,
  Trash2,
  Download,
  CheckCircle,
  Clock,
  Plus,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { SEED_DOCUMENTS_UI } from '../../src/data/seeds';

type DocumentType = 'cv' | 'certificate' | 'portfolio' | 'other';
type DocumentStatus = 'verified' | 'pending' | 'rejected';

interface Document {
  id: string;
  name: string;
  type: DocumentType;
  status: DocumentStatus;
  skillsCount: number;
  uploadedAt: string;
  size: string;
}

const getDocumentTypeLabel = (type: DocumentType): string => {
  switch (type) {
    case 'cv': return 'CV';
    case 'certificate': return 'Certificat';
    case 'portfolio': return 'Portfolio';
    default: return 'Autre';
  }
};

const getStatusColor = (status: DocumentStatus, colors: any): string => {
  switch (status) {
    case 'verified': return colors.success;
    case 'pending': return colors.warning;
    case 'rejected': return colors.error;
  }
};

const getStatusLabel = (status: DocumentStatus): string => {
  switch (status) {
    case 'verified': return 'Vérifié';
    case 'pending': return 'En attente';
    case 'rejected': return 'Rejeté';
  }
};

export default function DocumentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [documents, setDocuments] = useState<Document[]>(SEED_DOCUMENTS_UI);

  const totalSkills = documents.reduce((sum, doc) => sum + doc.skillsCount, 0);

  const handleUpload = () => {
    Alert.alert(
      'Ajouter un document',
      'Choisissez le type de document',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'CV', onPress: () => {} },
        { text: 'Certificat', onPress: () => {} },
        { text: 'Portfolio', onPress: () => {} },
      ]
    );
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Supprimer',
      'Voulez-vous vraiment supprimer ce document ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => setDocuments(documents.filter(d => d.id !== id)),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Documents</Text>
        <TouchableOpacity onPress={handleUpload} style={styles.backButton}>
          <Plus size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: colors.primary + '10' }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{documents.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Documents</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.primary + '30' }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{totalSkills}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Compétences</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.primary + '30' }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {documents.filter(d => d.status === 'verified').length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Vérifiés</Text>
          </View>
        </View>

        {/* Documents List */}
        <View style={[styles.listContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
          {documents.map((doc, index) => {
            const statusColor = getStatusColor(doc.status, colors);
            const isLast = index === documents.length - 1;

            return (
              <View
                key={doc.id}
                style={[
                  styles.documentItem,
                  { borderBottomColor: colors.gray100 },
                  isLast && styles.documentItemLast,
                ]}
              >
                <View style={[styles.documentIcon, { backgroundColor: colors.error + '15' }]}>
                  <FileText size={ICON.size.md} color={colors.error} strokeWidth={ICON.strokeWidth} />
                </View>

                <View style={styles.documentInfo}>
                  <Text style={[styles.documentName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {doc.name}
                  </Text>
                  <View style={styles.documentMeta}>
                    <View style={[styles.typeTag, { backgroundColor: colors.gray100 }]}>
                      <Text style={[styles.typeTagText, { color: colors.textSecondary }]}>
                        {getDocumentTypeLabel(doc.type)}
                      </Text>
                    </View>
                    <Text style={[styles.documentSize, { color: colors.gray400 }]}>{doc.size}</Text>
                  </View>
                  <View style={styles.documentFooter}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                      {doc.status === 'verified' ? (
                        <CheckCircle size={12} color={statusColor} strokeWidth={2} />
                      ) : (
                        <Clock size={12} color={statusColor} strokeWidth={2} />
                      )}
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {getStatusLabel(doc.status)}
                      </Text>
                    </View>
                    {doc.skillsCount > 0 && (
                      <View style={[styles.skillsTag, { backgroundColor: colors.success + '15' }]}>
                        <Text style={[styles.skillsTagText, { color: colors.success }]}>
                          {doc.skillsCount} compétences
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.documentActions}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Download size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(doc.id)}>
                    <Trash2 size={ICON.size.sm} color={colors.error} strokeWidth={ICON.strokeWidth} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Upload Button */}
        <TouchableOpacity
          style={[styles.uploadButton, { borderColor: colors.primary }]}
          onPress={handleUpload}
        >
          <Upload size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.uploadButtonText, { color: colors.primary }]}>
            Ajouter un document
          </Text>
        </TouchableOpacity>
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

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  // Stats
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: SPACING.lg,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
  },

  statItem: {
    alignItems: 'center',
  },

  statValue: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  statDivider: {
    width: 1,
    height: 40,
  },

  // List
  listContainer: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },

  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },

  documentItemLast: {
    borderBottomWidth: 0,
  },

  documentIcon: {
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

  documentName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 4,
  },

  typeTag: {
    paddingVertical: 2,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER.radius.xs,
  },

  typeTagText: {
    fontSize: TYPOGRAPHY.fontSize.xxs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  documentSize: {
    fontSize: TYPOGRAPHY.fontSize.xxs,
  },

  documentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER.radius.xs,
  },

  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xxs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  skillsTag: {
    paddingVertical: 2,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER.radius.xs,
  },

  skillsTagText: {
    fontSize: TYPOGRAPHY.fontSize.xxs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  documentActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },

  actionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Upload
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderStyle: 'dashed',
    borderRadius: BORDER.radius.sm,
  },

  uploadButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});
