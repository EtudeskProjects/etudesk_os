/**
 * ToolTrace — Displays tool execution traces (collapsible)
 * Persistent in history, shows tool name + duration
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Database,
  Globe,
  Youtube,
  Image as ImageIcon,
  GitBranch,
  Loader,
  CheckCircle,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../constants/theme';

export interface ToolTraceItem {
  name: string;
  args?: Record<string, unknown>;
  result?: unknown;
  duration?: number;
  status?: 'running' | 'done';
}

interface ToolTraceProps {
  traces: ToolTraceItem[];
}

const TOOL_ICONS: Record<string, any> = {
  vector_query: Search,
  graph_query: GitBranch,
  sql_query: Database,
  web_search: Globe,
  youtube_search: Youtube,
  image_generation: ImageIcon,
  file_search: Search,
};

const TOOL_LABELS: Record<string, string> = {
  vector_query: 'Recherche sémantique',
  graph_query: 'Graphe de connaissances',
  sql_query: 'Base de données',
  web_search: 'Recherche web',
  youtube_search: 'Recherche YouTube',
  image_generation: "Génération d'image",
  file_search: 'Recherche documents',
};

export const ToolTrace: React.FC<ToolTraceProps> = ({ traces }) => {
  const [expanded, setExpanded] = useState(false);
  const { colors } = useTheme();

  if (!traces || traces.length === 0) return null;

  return (
    <View style={[styles.container, { borderColor: colors.borderColor }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        {expanded ? (
          <ChevronDown size={14} color={colors.textSecondary} />
        ) : (
          <ChevronRight size={14} color={colors.textSecondary} />
        )}
        <Text style={[styles.headerText, { color: colors.textSecondary }]}>
          {traces.length} outil{traces.length > 1 ? 's' : ''} utilisé{traces.length > 1 ? 's' : ''}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.traceList}>
          {traces.map((trace, index) => {
            const ToolIcon = TOOL_ICONS[trace.name] || Search;
            const label = TOOL_LABELS[trace.name] || trace.name;
            const isRunning = trace.status === 'running';

            return (
              <View key={index} style={[styles.traceItem, { borderTopColor: colors.borderColor }]}>
                <View style={styles.traceRow}>
                  {isRunning ? (
                    <Loader size={12} color={colors.primary} />
                  ) : (
                    <ToolIcon size={12} color={colors.textSecondary} />
                  )}
                  <Text style={[styles.traceName, { color: colors.textPrimary }]}>
                    {label}
                  </Text>
                  {trace.duration && (
                    <Text style={[styles.traceDuration, { color: colors.textSecondary }]}>
                      {trace.duration < 1000
                        ? `${trace.duration}ms`
                        : `${(trace.duration / 1000).toFixed(1)}s`}
                    </Text>
                  )}
                  {!isRunning && (
                    <CheckCircle size={12} color={colors.success} />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    marginVertical: SPACING.xs,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  headerText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  traceList: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  traceItem: {
    borderTopWidth: 0.5,
    paddingTop: SPACING.xs,
    marginTop: SPACING.xs,
  },
  traceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  traceName: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  traceDuration: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
});

export default ToolTrace;
