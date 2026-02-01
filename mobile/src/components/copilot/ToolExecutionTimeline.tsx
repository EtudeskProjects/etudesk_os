/**
 * ToolExecutionTimeline
 * Shows tool calls with status (pending, running, success, error)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Search,
  Users,
  MapPin,
  Building2,
  Zap,
  CheckCircle,
  AlertCircle,
  Loader,
  Clock,
  Brain,
  BookOpen,
  Globe,
  User,
  FileText,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../constants/theme';
import { ShimmerPlaceholder } from '../ui/ShimmerPlaceholder';

type ToolStatus = 'pending' | 'running' | 'success' | 'error';

export interface ToolExecution {
  id: string;
  name: string;
  status: ToolStatus;
  result?: string;
  error?: string;
  duration?: number;
}

interface ToolExecutionTimelineProps {
  tools: ToolExecution[];
  showDetails?: boolean;
}

const TOOL_ICONS: Record<string, React.ComponentType<any>> = {
  search_opportunities: Search,
  search_communities: Users,
  search_spaces: MapPin,
  search_organizations: Building2,
  get_talent_profile: User,
  get_skill_graph: Zap,
  analyze_skill_gaps: Brain,
  get_learning_path: BookOpen,
  create_quiz: BookOpen,
  brave_web_search: Globe,
  search_youtube: Globe,
  search_wikipedia: Globe,
  generate_diagram: Zap,
  get_talent_documents: FileText,
};

const TOOL_LABELS: Record<string, string> = {
  search_opportunities: "Recherche d'opportunités",
  search_communities: 'Recherche de communautés',
  search_spaces: "Recherche d'espaces",
  search_organizations: "Recherche d'organisations",
  get_talent_profile: 'Chargement du profil',
  get_skill_graph: 'Analyse des compétences',
  analyze_skill_gaps: 'Analyse des lacunes',
  get_learning_path: "Parcours d'apprentissage",
  create_quiz: 'Création du quiz',
  brave_web_search: 'Recherche web',
  search_youtube: 'Recherche YouTube',
  search_wikipedia: 'Recherche Wikipedia',
  generate_diagram: 'Génération du diagramme',
  get_talent_documents: 'Récupération des documents',
};

export const ToolExecutionTimeline: React.FC<ToolExecutionTimelineProps> = ({
  tools,
  showDetails = false,
}) => {
  const { colors } = useTheme();

  const getStatusIcon = (status: ToolStatus) => {
    switch (status) {
      case 'pending':
        return <Clock size={14} color={colors.textTertiary} strokeWidth={ICON.strokeWidth} />;
      case 'running':
        return <Loader size={14} color={colors.warning} strokeWidth={ICON.strokeWidth} />;
      case 'success':
        return <CheckCircle size={14} color={colors.success} strokeWidth={ICON.strokeWidth} />;
      case 'error':
        return <AlertCircle size={14} color={colors.error} strokeWidth={ICON.strokeWidth} />;
    }
  };

  const getStatusColor = (status: ToolStatus) => {
    switch (status) {
      case 'pending':
        return colors.textTertiary;
      case 'running':
        return colors.warning;
      case 'success':
        return colors.success;
      case 'error':
        return colors.error;
    }
  };

  if (tools.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <Text style={[styles.title, { color: colors.textSecondary }]}>Actions en cours</Text>

      {tools.map((tool, index) => {
        const ToolIcon = TOOL_ICONS[tool.name] || Zap;
        const label = TOOL_LABELS[tool.name] || tool.name;
        const isLast = index === tools.length - 1;
        const statusColor = getStatusColor(tool.status);

        return (
          <View key={tool.id} style={styles.toolItem}>
            {/* Connector line */}
            <View style={styles.connector}>
              <View
                style={[
                  styles.connectorDot,
                  { backgroundColor: statusColor },
                ]}
              />
              {!isLast && (
                <View
                  style={[
                    styles.connectorLine,
                    { backgroundColor: colors.borderColor },
                  ]}
                />
              )}
            </View>

            {/* Tool content */}
            <View style={styles.toolContent}>
              <View style={styles.toolHeader}>
                <ToolIcon size={14} color={statusColor} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.toolName, { color: colors.textPrimary }]}>{label}</Text>
                {getStatusIcon(tool.status)}
              </View>

              {/* Running shimmer */}
              {tool.status === 'running' && (
                <View style={styles.shimmerRow}>
                  <ShimmerPlaceholder width="60%" height={12} />
                </View>
              )}

              {/* Result preview */}
              {showDetails && tool.status === 'success' && tool.result && (
                <Text
                  style={[styles.toolResult, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {tool.result}
                </Text>
              )}

              {/* Error message */}
              {tool.status === 'error' && tool.error && (
                <Text style={[styles.toolError, { color: colors.error }]} numberOfLines={1}>
                  {tool.error}
                </Text>
              )}

              {/* Duration */}
              {tool.duration !== undefined && tool.status === 'success' && (
                <Text style={[styles.toolDuration, { color: colors.textTertiary }]}>
                  {tool.duration}ms
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toolItem: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  connector: {
    width: 20,
    alignItems: 'center',
  },
  connectorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  connectorLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  toolContent: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  toolName: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  shimmerRow: {
    marginTop: SPACING.xs,
  },
  toolResult: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 4,
  },
  toolError: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 4,
  },
  toolDuration: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: 10,
    marginTop: 2,
  },
});

export default ToolExecutionTimeline;
