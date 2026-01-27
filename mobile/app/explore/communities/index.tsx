import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    FlatList,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ArrowLeft,
    Search,
    X,
    Users,
    LayoutGrid,
    TrendingUp,
    Star,
    Plus,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/contexts/I18nContext';
import { CommunityCard } from '../../../src/components/cards';
import { communityService } from '../../../src/services';
import type { Community } from '../../../src/types/models';

const COMMUNITY_CATEGORIES = [
    { id: 'all', label: 'Toutes', icon: LayoutGrid },
    { id: 'tech', label: 'Technologie', icon: TrendingUp },
    { id: 'business', label: 'Business', icon: Star },
    { id: 'design', label: 'Design', icon: Users },
];

export default function CommunitiesScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const { t } = useI18n();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [communities, setCommunities] = useState<Community[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        loadCommunities();
    }, []);

    const loadCommunities = async (refresh = false) => {
        if (refresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        try {
            // Only fetch public, active communities (private communities are filtered by backend)
            const response = await communityService.getAll({ limit: 50 });
            if (response.data) {
                setCommunities(response.data);
            }
        } catch (error) {
            console.error('Error loading communities:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const filteredCommunities = useMemo(() => {
        return communities.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, communities]);

    const renderCategoryItem = ({ item }: { item: typeof COMMUNITY_CATEGORIES[0] }) => {
        const isActive = activeCategory === item.id;
        const Icon = item.icon;
        return (
            <TouchableOpacity
                style={[
                    styles.categoryChip,
                    { backgroundColor: isActive ? colors.primary : colors.gray100 }
                ]}
                onPress={() => setActiveCategory(item.id)}
            >
                <Icon size={16} color={isActive ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.categoryLabel, { color: isActive ? colors.textOnPrimary : colors.textSecondary }]}>
                    {item.label}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderCommunityItem = ({ item }: { item: Community }) => (
        <View style={styles.cardWrapper}>
            <CommunityCard
                community={item}
                onPress={() => router.push(`/details/community/${item.id}` as any)}
            />
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Users size={48} color={colors.gray300} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery ? 'Aucune communauté trouvée' : 'Aucune communauté disponible'}
            </Text>
            {searchQuery && (
                <Text style={[styles.emptyHint, { color: colors.gray400 }]}>
                    Essayez avec d'autres mots-clés
                </Text>
            )}
        </View>
    );

    const renderLoading = () => (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Chargement des communautés...
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={[styles.customHeader, { borderBottomColor: colors.borderColor }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                    <ArrowLeft size={ICON.size.md} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Communautés</Text>
                <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.primary + '10' }]}>
                    <Plus size={ICON.size.md} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.searchSection}>
                <View style={[styles.searchBar, { backgroundColor: colors.gray100 }]}>
                    <Search size={18} color={colors.textSecondary} />
                    <TextInput
                        placeholder="Trouver une communauté..."
                        placeholderTextColor={colors.textDisabled}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={[styles.searchInput, { color: colors.textPrimary }]}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.categoriesContainer}>
                <FlatList
                    data={COMMUNITY_CATEGORIES}
                    renderItem={renderCategoryItem}
                    keyExtractor={item => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoriesList}
                />
            </View>

            {isLoading ? (
                renderLoading()
            ) : (
                <FlatList
                    data={filteredCommunities}
                    keyExtractor={item => item.id}
                    renderItem={renderCommunityItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => loadCommunities(true)}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                    ListEmptyComponent={renderEmptyState}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER.radius.sm,
    },
    searchSection: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        height: 48,
        borderRadius: BORDER.radius.md,
        gap: SPACING.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: TYPOGRAPHY.fontSize.md,
    },
    categoriesContainer: {
        marginBottom: SPACING.md,
    },
    categoriesList: {
        paddingHorizontal: SPACING.lg,
        gap: SPACING.sm,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: BORDER.radius.full,
    },
    categoryLabel: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    listContent: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.xl,
    },
    cardWrapper: {
        marginBottom: SPACING.md,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        gap: SPACING.md,
    },
    emptyText: {
        fontSize: TYPOGRAPHY.fontSize.md,
    },
    emptyHint: {
        fontSize: TYPOGRAPHY.fontSize.sm,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        gap: SPACING.md,
    },
    loadingText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
    },
    customHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        height: 64,
        borderBottomWidth: BORDER.width.thin,
    },
    headerTitle: {
        fontSize: TYPOGRAPHY.fontSize.lg,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
    },
});
