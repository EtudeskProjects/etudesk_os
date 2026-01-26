import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  MapPin,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { HubCard } from '../../../src/components/cards';
import { FooterNav } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { useAlert } from '../../../src/contexts/AlertContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { hubService } from '../../../src/services';
import { Hub } from '../../../src/types/models';

export default function HubsListScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { confirm, success } = useAlert();
  const { selectedOrg } = useSpace();

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadHubs = useCallback(async () => {
    if (!selectedOrg?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await hubService.getByOrganization(selectedOrg.id);
      if (response.data) {
        setHubs(response.data);
      }
    } catch (error) {
      console.error('Error loading hubs:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedOrg?.id]);

  useEffect(() => {
    loadHubs();
  }, [loadHubs]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadHubs();
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm(
      'Supprimer ce hub ?',
      `"${name}" sera supprimé définitivement.`
    );
    if (confirmed) {
      try {
        await hubService.delete(id);
        setHubs(prev => prev.filter(h => h.id !== id));
        success('Supprimé', 'Le hub a été supprimé.');
      } catch (error) {
        console.error('Error deleting hub:', error);
      }
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/settings/organization/edit-hub/${id}` as any);
  };

  const renderItem = ({ item, index }: { item: Hub; index: number }) => (
    <HubCard
      hub={item}
      onPress={() => router.push(`/details/hub/${item.id}` as any)}
      showMoreAction
      onMorePress={() => setSelectedId(selectedId === item.id ? null : item.id)}
      isMenuVisible={selectedId === item.id}
      onEdit={() => handleEdit(item.id)}
      onDelete={() => handleDelete(item.id, item.name)}
      isManagement
    />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MapPin size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Hubs</Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/settings/organization/create-hub' as any)}
        >
          <Plus size={ICON.size.md} color={COLORS.white} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
      <FlatList
        data={hubs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.gray100 }]}>
              <MapPin size={32} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Aucun hub
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Créez votre premier hub pour accueillir des talents.
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/settings/organization/create-hub' as any)}
            >
              <Plus size={ICON.size.sm} color={COLORS.white} strokeWidth={ICON.strokeWidth} />
              <Text style={styles.emptyButtonText}>Créer un hub</Text>
            </TouchableOpacity>
          </View>
        }
      />
      )}

      <FooterNav activeTab="home" />
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
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  card: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
  },
  cardHeader: {
    height: 140,
    backgroundColor: COLORS.gray100,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  moreButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 36,
    height: 36,
    borderRadius: BORDER.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },
  typeBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.white,
  },
  dropdown: {
    position: 'absolute',
    top: 40,
    right: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  dropdownText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  cardContent: {
    padding: SPACING.md,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  cardStats: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: BORDER.width.thin,
    borderTopColor: COLORS.gray100,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: BORDER.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER.radius.sm,
  },
  emptyButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.white,
  },
});
