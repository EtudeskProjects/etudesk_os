/**
 * ToolBlock — Inline tool call indicator with rich execution details
 * 3 states: running (pulsing icon + args), success (args + summary), error (retry)
 * Shows tool-specific formatted args and result summaries
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import {
  Search,
  Database,
  Globe,
  Youtube,
  FileText,
  GitBranch,
  Image as ImageIcon,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  ArrowRight,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, OPACITY, withOpacity } from '../../constants/theme';
import type { ToolSegmentData } from '../../services/copilotService';

interface ToolBlockProps {
  tool: ToolSegmentData;
  onRetry?: () => void;
}

const TOOL_ICONS: Record<string, any> = {
  vector_query: Search,
  sql_query: Database,
  youtube_search: Youtube,
  generate_document: FileText,
  generate_image: ImageIcon,
  generate_diagram: GitBranch,
  web_search: Globe,
  file_read: FileText,
};

const TOOL_LABELS: Record<string, string> = {
  vector_query: 'Recherche sémantique',
  sql_query: 'Base de données',
  youtube_search: 'Recherche YouTube',
  generate_document: 'Génération document',
  generate_image: "Génération d'image",
  generate_diagram: 'Génération diagramme',
  web_search: 'Recherche web',
  file_read: 'Lecture document',
};

function formatDuration(ms?: number): string {
  if (!ms) return '';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

/**
 * Format tool args into a human-readable detail line, specific to each tool type.
 */
function formatToolDetail(toolName: string, args?: Record<string, unknown>): string {
  if (!args) return '';

  switch (toolName) {
    case 'vector_query': {
      const query = args.query as string | undefined;
      const ns = args.namespace as string | undefined;
      const nsLabels: Record<string, string> = {
        opportunities: 'opportunités',
        communities: 'communautés',
        spaces: 'espaces',
        talents: 'talents',
        organizations: 'organisations',
      };
      const parts: string[] = [];
      if (query) parts.push(`« ${truncate(query, 55)} »`);
      if (ns) parts.push(nsLabels[ns] || ns);
      return parts.join(' · ');
    }

    case 'sql_query': {
      const intent = args.intent as string | undefined;
      if (!intent) return '';
      const intentLabels: Record<string, string> = {
        my_profile: 'Mon profil',
        my_applications: 'Mes candidatures',
        my_reservations: 'Mes réservations',
        my_invitations: 'Mes invitations',
        my_communities: 'Mes communautés',
        my_bookmarks: 'Mes favoris',
        my_documents: 'Mes documents',
        my_skills: 'Mes compétences',
        org_members: 'Membres org.',
        org_applications: 'Candidatures reçues',
        org_stats: 'Statistiques org.',
        org_opportunities: 'Opportunités org.',
        org_communities: 'Communautés org.',
        org_spaces: 'Espaces org.',
        org_revenue: 'Revenus org.',
        org_invitations: 'Invitations org.',
        search_opportunities: 'Recherche opportunités',
        search_communities: 'Recherche communautés',
        search_spaces: 'Recherche espaces',
        search_organizations: 'Recherche organisations',
        search_talents: 'Recherche talents',
        apply_opportunity: 'Candidature',
        join_community: 'Adhésion communauté',
        book_space: 'Réservation espace',
        create_activity: 'Création activité',
        respond_invitation: 'Réponse invitation',
        update_application: 'MAJ candidature',
      };
      return intentLabels[intent] || intent.replace(/_/g, ' ');
    }

    case 'youtube_search': {
      const query = args.query as string | undefined;
      return query ? `« ${truncate(query, 55)} »` : '';
    }

    case 'web_search': {
      const query = args.query as string | undefined;
      return query ? `« ${truncate(query, 55)} »` : '';
    }

    case 'generate_document': {
      const title = (args.title || args.name || args.topic) as string | undefined;
      const format = args.format as string | undefined;
      const parts: string[] = [];
      if (title) parts.push(truncate(title, 50));
      if (format) parts.push(format.toUpperCase());
      return parts.join(' · ');
    }

    case 'generate_image': {
      const prompt = (args.prompt || args.description) as string | undefined;
      return prompt ? `« ${truncate(prompt, 55)} »` : '';
    }

    case 'generate_diagram': {
      const title = (args.title || args.topic) as string | undefined;
      const type = args.type as string | undefined;
      const parts: string[] = [];
      if (title) parts.push(truncate(title, 50));
      if (type) parts.push(type);
      return parts.join(' · ');
    }

    case 'file_read': {
      const name = (args.fileName || args.name || args.file) as string | undefined;
      return name ? truncate(name, 60) : '';
    }

    default: {
      // Generic: show first string value
      const entries = Object.entries(args).filter(([, v]) => typeof v === 'string' && v);
      if (entries.length === 0) return '';
      return truncate(String(entries[0][1]), 55);
    }
  }
}

export const ToolBlock: React.FC<ToolBlockProps> = ({ tool, onRetry }) => {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  const isRunning = tool.status === 'running';
  const isError = tool.status === 'error';
  const isSuccess = tool.status === 'success';

  useEffect(() => {
    if (isRunning) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRunning, pulseAnim]);

  const ToolIcon = TOOL_ICONS[tool.name] || Search;
  const label = TOOL_LABELS[tool.name] || tool.name;
  const detail = formatToolDetail(tool.name, tool.args);

  const borderColor = isRunning
    ? colors.primary
    : isError
      ? colors.error
      : colors.borderColor;

  return (
    <View style={[styles.container, { borderColor }]}>
      {/* Main row: icon + label + status indicators */}
      <View style={styles.mainRow}>
        {isRunning ? (
          <Animated.View style={{ opacity: pulseAnim }}>
            <ToolIcon size={14} color={colors.primary} />
          </Animated.View>
        ) : (
          <ToolIcon size={14} color={isError ? colors.error : colors.textSecondary} />
        )}

        <View style={styles.labelContainer}>
          {isRunning ? (
            <Animated.Text
              style={[styles.label, { color: colors.primary, opacity: pulseAnim }]}
              numberOfLines={1}
            >
              {label}
            </Animated.Text>
          ) : (
            <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
              {label}
            </Text>
          )}
        </View>

        <View style={styles.rightSide}>
          {isSuccess && tool.duration ? (
            <>
              <Clock size={10} color={colors.textDisabled} />
              <Text style={[styles.durationText, { color: colors.textDisabled }]}>
                {formatDuration(tool.duration)}
              </Text>
            </>
          ) : null}
          {isSuccess && <CheckCircle size={13} color={colors.success} />}
          {isError && <AlertTriangle size={13} color={colors.error} />}
        </View>
      </View>

      {/* Detail line: tool-specific formatted args (shown in ALL states) */}
      {detail ? (
        isRunning ? (
          <Animated.Text
            style={[styles.detailText, { color: colors.textSecondary, opacity: pulseAnim }]}
            numberOfLines={1}
          >
            {detail}
          </Animated.Text>
        ) : (
          <Text
            style={[styles.detailText, { color: colors.textTertiary }]}
            numberOfLines={1}
          >
            {detail}
          </Text>
        )
      ) : null}

      {/* Result summary with arrow indicator (success only) */}
      {isSuccess && tool.summary ? (
        <View style={styles.summaryRow}>
          <ArrowRight size={10} color={colors.success} />
          <Text style={[styles.summaryText, { color: colors.textSecondary }]} numberOfLines={2}>
            {tool.summary}
          </Text>
        </View>
      ) : null}

      {/* Error message */}
      {isError && tool.error ? (
        <Text style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>
          {tool.error}
        </Text>
      ) : null}

      {/* Retry button */}
      {isError && onRetry ? (
        <TouchableOpacity
          style={[styles.retryButton, { borderColor: colors.error }]}
          onPress={onRetry}
          activeOpacity={0.7}
        >
          <RefreshCw size={11} color={colors.error} />
          <Text style={[styles.retryText, { color: colors.error }]}>Réessayer</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    marginVertical: 3,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  rightSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  detailText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 3,
    paddingLeft: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingLeft: 20,
  },
  summaryText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    flex: 1,
  },
  errorText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
    paddingLeft: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 4,
    marginLeft: 20,
    paddingVertical: 3,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER.radius.xs,
  },
  retryText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});

export default ToolBlock;
