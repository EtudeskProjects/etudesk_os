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
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  MapPin,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { SpaceCard } from '../../../src/components/cards';
import { FooterNav } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { useAlert } from '../../../src/contexts/AlertContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { spaceService, Space } from '../../../src/services';

export default function SpacesListScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { confirm, success } = useAlert();
  const { selectedOrg } = useSpace();

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadSpaces = useCallback(async () => {
    if (!selectedOrg?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await spaceService.getByOrganization(selectedOrg.id);
      if (response.data) {
        setSpaces(response.data);
      }
    } catch (error) {
      console.error('Error loading spaces:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedOrg?.id]);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  // Rafraîchir la liste quand l'écran redevient visible (ex. retour après création)
  useFocusEffect(
    useCallback(() => {
      loadSpaces();
    }, [loadSpaces])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSpaces();
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm(
      'Supprimer cet espace ?',
      `"${name}" sera supprime definitivement.`
    );
    if (confirmed) {
      try {
        await spaceService.delete(id);
        setSpaces(prev => prev.filter(s => s.id !== id));
        success('Supprime', 'L\'espace a ete supprime.');
      } catch (error) {
        console.error('Error deleting space:', error);
      }
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/settings/organization/edit-space/${id}` as any);
  };

  const handleViewBookings = (id: string) => {
    router.push(`/gestion/spaces/bookings/${id}` as any);
  };

  const renderItem = ({ item, index }: { item: Space; index: number }) => (
    <SpaceCard
      space={item}
      onPress={() => router.push(`/details/space/${item.id}` as any)}
      showMoreAction
      onEdit={() => handleEdit(item.id)}
      onDelete={() => handleDelete(item.id, item.name)}
      onViewBookings={() => handleViewBookings(item.id)}
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
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Espaces</Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/settings/organization/create-space' as any)}
        >
          <Plus size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
      <FlatList
        data={spaces}
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
              Aucun espace
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Creez votre premier espace reservable.
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/settings/organization/create-space' as any)}
            >
              <Plus size={ICON.size.sm} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.emptyButtonText, { color: colors.textOnPrimary }]}>Creer un espace</Text>
            </TouchableOpacity>
          </View>
        }
      />
      )}

      <FooterNav activeTab="gestion" />
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
  },
});
