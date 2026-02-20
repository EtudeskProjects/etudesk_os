import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Briefcase,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { OpportunityCard } from '../../../src/components/cards';
import { Button, FooterNav, IconButton, Tap, LoadingShimmer } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { useAlert } from '../../../src/contexts/AlertContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { opportunityService } from '../../../src/services';
import { Opportunity } from '../../../src/types/models';

export default function OpportunitiesListScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { confirm, success } = useAlert();
  const { selectedOrg } = useSpace();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadOpportunities = useCallback(async () => {
    if (!selectedOrg?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await opportunityService.getByOrganization(selectedOrg.id);
      if (response.data) {
        // Transform organizations array to organization object
        const transformedOpps = response.data.map((opp: any) => ({
          ...opp,
          organization: opp.organizations?.[0] || opp.organization,
        }));
        setOpportunities(transformedOpps);
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading opportunities:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedOrg?.id]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadOpportunities();
    }, [loadOpportunities])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadOpportunities();
  };

  const handleDelete = async (id: string, title: string) => {
    const confirmed = await confirm(
      'Supprimer cette opportunité ?',
      `"${title}" sera supprimée définitivement.`
    );
    if (confirmed) {
      try {
        await opportunityService.delete(id);
        setOpportunities(prev => prev.filter(o => o.id !== id));
        success('Supprimé', 'L\'opportunité a été supprimée.');
      } catch (error) {
        if (__DEV__) console.error('Error deleting opportunity:', error);
      }
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/settings/organization/edit-opportunity/${id}` as any);
  };

  const handleViewCandidates = (id: string) => {
    router.push(`/gestion/opportunities/applications/${id}` as any);
  };

  const renderItem = ({ item, index }: { item: Opportunity; index: number }) => (
    <OpportunityCard
      opportunity={item}
      onPress={() => router.push(`/details/opportunity/${item.id}` as any)}
      showMoreAction
      onMorePress={() => setSelectedId(selectedId === item.id ? null : item.id)}
      isMenuVisible={selectedId === item.id}
      onEdit={() => handleEdit(item.id)}
      onDelete={() => handleDelete(item.id, item.title)}
      onViewCandidates={() => handleViewCandidates(item.id)}
      showStats
      showStatus
      isLast={index === opportunities.length - 1}
    />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel="Retour"
        />
        <View style={styles.headerCenter}>
          <Briefcase size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Opportunités</Text>
        </View>
        <IconButton
          variant="filled"
          onPress={() => router.push('/settings/organization/create-opportunity' as any)}
          icon={<Plus size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel="Créer une opportunité"
          style={{ backgroundColor: colors.primary }}
        />
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <LoadingShimmer variant="fullPage" />
        </View>
      ) : (
      <FlatList
        data={opportunities}
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
              <Briefcase size={32} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Aucune opportunité
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Créez votre première opportunité pour attirer des talents.
            </Text>
            <Button
              title="Créer une opportunité"
              onPress={() => router.push('/settings/organization/create-opportunity' as any)}
              icon={<Plus size={ICON.size.sm} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
            />
          </View>
        }
      />
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
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orgLogo: {
    width: 44,
    height: 44,
    borderRadius: BORDER.radius.sm,
  },
  cardInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  cardOrg: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },
  moreButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    position: 'absolute',
    top: 50,
    right: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    zIndex: 10,
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
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  statusBadge: {
    position: 'absolute',
    top: SPACING.md,
    right: 50,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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
    // replaced by unified <Button />
    // keep as no-op to avoid touching layout elsewhere if referenced
  },
  emptyButtonText: {
    // replaced by unified <Button />
  },
});
