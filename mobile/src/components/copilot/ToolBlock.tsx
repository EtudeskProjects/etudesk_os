/**
 * ToolBlock — Inline tool call indicator with rich execution details
 * 3 states: running (pulsing icon + args), success (args + summary), error (retry)
 * Shows contextual title (bold) + result summaries
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
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
  Compass,
  Wrench,
  Zap,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../contexts/I18nContext';
import { SPACING, TYPOGRAPHY, BORDER, OPACITY, withOpacity } from '../../constants/theme';
import type { ToolSegmentData } from '../../services/copilotService';
import { Button } from '../ui';


interface ToolBlockProps {
  tool: ToolSegmentData;
  onRetry?: () => void;
}

const TOOL_ICONS: Record<string, any> = {
  vector_query: Compass,
  sql_query: Database,
  youtube_search: Youtube,
  generate_document: FileText,
  generate_image: ImageIcon,
  generate_diagram: GitBranch,
  web_search: Globe,
  file_read: FileText,
  file_reader: FileText,
  manage_skills: Wrench,
  execute_action: Zap,
};

function formatDuration(ms?: number): string {
  if (!ms) return '';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1).replace(/\.0$/, '')}s`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

/** Decode URL-encoded strings (e.g. %20 → space) for display */
function decodeDisplay(str: string): string {
  try { return decodeURIComponent(str); } catch { return str; }
}

/**
 * Generate a contextual bold title describing what the tool is doing.
 * Uses i18n t() for all user-facing strings.
 */
function getToolTitle(t: (key: string, params?: Record<string, string>) => string, toolName: string, args?: Record<string, unknown>, result?: unknown): string {
  switch (toolName) {
    case 'vector_query': {
      const ns = args?.namespace as string | undefined;
      const nsKeys: Record<string, string> = {
        opportunities: 'copilot.tool.searchOpportunities',
        communities: 'copilot.tool.searchCommunities',
        spaces: 'copilot.tool.searchSpaces',
        talents: 'copilot.tool.searchTalents',
        organizations: 'copilot.tool.searchOrganizations',
      };
      return ns ? t(nsKeys[ns] || 'copilot.tool.searchPlatform') : t('copilot.tool.searchPlatform');
    }

    case 'sql_query': {
      const intent = args?.intent as string | undefined;
      if (!intent) return t('copilot.tool.dataQuery');
      const intentKeys: Record<string, string> = {
        my_profile: 'copilot.tool.myProfile',
        my_applications: 'copilot.tool.myApplications',
        my_reservations: 'copilot.tool.myReservations',
        my_invitations: 'copilot.tool.myInvitations',
        my_communities: 'copilot.tool.myCommunities',
        my_bookmarks: 'copilot.tool.myBookmarks',
        my_documents: 'copilot.tool.myDocuments',
        my_skills: 'copilot.tool.mySkills',
        org_members: 'copilot.tool.orgMembers',
        org_applications: 'copilot.tool.orgApplications',
        org_stats: 'copilot.tool.orgStats',
        org_opportunities: 'copilot.tool.orgOpportunities',
        org_communities: 'copilot.tool.orgCommunities',
        org_spaces: 'copilot.tool.orgSpaces',
        org_revenue: 'copilot.tool.orgRevenue',
        org_invitations: 'copilot.tool.orgInvitations',
        search_opportunities: 'copilot.tool.advSearchOpportunities',
        search_communities: 'copilot.tool.advSearchCommunities',
        search_spaces: 'copilot.tool.advSearchSpaces',
        search_organizations: 'copilot.tool.advSearchOrganizations',
        search_talents: 'copilot.tool.advSearchTalents',
        apply_opportunity: 'copilot.tool.submitApplication',
        join_community: 'copilot.tool.joinRequest',
        book_space: 'copilot.tool.spaceBooking',
        create_activity: 'copilot.tool.createActivity',
        respond_invitation: 'copilot.tool.respondInvitation',
        update_application: 'copilot.tool.updateApplication',
      };
      return t(intentKeys[intent] || 'copilot.tool.dataQuery');
    }

    case 'youtube_search':
      return t('copilot.tool.videoSearch');

    case 'web_search':
      return t('copilot.tool.webSearch');

    case 'generate_document': {
      const title = (args?.title || args?.name || args?.topic) as string | undefined;
      return title ? t('copilot.tool.generatePrefix', { title: truncate(title, 40) }) : t('copilot.tool.generateDoc');
    }

    case 'generate_image':
      return t('copilot.tool.generateImage');

    case 'generate_diagram':
      return t('copilot.tool.createDiagram');

    case 'file_read':
    case 'file_reader': {
      const res = result as any;
      if (res?.document?.title) {
        return t('copilot.tool.readPrefix', { name: truncate(decodeDisplay(res.document.title), 45) });
      }
      const input = args?.input as string | undefined;
      if (input) {
        const decodedInput = decodeDisplay(input);
        const nameMatch = decodedInput.match(/(?:document|fichier|file|cv|CV)\s*[:—-]?\s*([^\n\[\]()]+)/i);
        if (nameMatch) return t('copilot.tool.readPrefix', { name: truncate(nameMatch[1].trim(), 45) });
        const fileMatch = decodedInput.match(/([A-Za-z0-9_\-. ]+\.(?:pdf|docx?|xlsx?|csv|txt|png|jpg|jpeg))/i);
        if (fileMatch) return t('copilot.tool.readPrefix', { name: truncate(fileMatch[1], 45) });
      }
      const name = (args?.fileName || args?.name || args?.file) as string | undefined;
      if (name) return t('copilot.tool.readPrefix', { name: truncate(decodeDisplay(name), 45) });
      return t('copilot.tool.readDocument');
    }

    case 'manage_skills': {
      const skill = args?.skillQuery as string | undefined;
      if (skill) return t('copilot.tool.addSkillPrefix', { skill });
      return t('copilot.tool.updateSkills');
    }

    case 'execute_action': {
      const action = args?.action as string | undefined;
      const actionKeys: Record<string, string> = {
        apply_opportunity: 'copilot.tool.applyInProgress',
        join_community: 'copilot.tool.joinInProgress',
        book_space: 'copilot.tool.bookingInProgress',
        accept_invitation: 'copilot.tool.acceptInvitation',
        decline_invitation: 'copilot.tool.declineInvitation',
      };
      return action ? t(actionKeys[action] || 'copilot.tool.executeAction') : t('copilot.tool.executeAction');
    }

    default:
      return toolName.replace(/_/g, ' ');
  }
}

/**
 * Format tool args into a detail line (secondary information below the title).
 */
function formatToolDetail(toolName: string, args?: Record<string, unknown>): string {
  if (!args) return '';

  switch (toolName) {
    case 'vector_query': {
      const query = args.query as string | undefined;
      return query ? `\u00ab ${truncate(query, 55)} \u00bb` : '';
    }

    case 'sql_query':
      // Intent is already shown in the title — no need to repeat
      return '';

    case 'youtube_search':
    case 'web_search': {
      const query = args.query as string | undefined;
      return query ? `\u00ab ${truncate(query, 55)} \u00bb` : '';
    }

    case 'generate_document': {
      const format = args.format as string | undefined;
      return format ? format.toUpperCase() : '';
    }

    case 'generate_image': {
      const prompt = (args.prompt || args.description) as string | undefined;
      return prompt ? `\u00ab ${truncate(prompt, 55)} \u00bb` : '';
    }

    case 'generate_diagram': {
      const type = args.type as string | undefined;
      return type || '';
    }

    case 'file_read':
    case 'file_reader':
      // Title already shows the document name
      return '';

    default: {
      const entries = Object.entries(args).filter(([, v]) => typeof v === 'string' && v);
      if (entries.length === 0) return '';
      return truncate(String(entries[0][1]), 55);
    }
  }
}

export const ToolBlock: React.FC<ToolBlockProps> = ({ tool, onRetry }) => {
  const { colors } = useTheme();
  const { t } = useI18n();
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
  const title = getToolTitle(t, tool.name, tool.args, tool.result);
  const detail = formatToolDetail(tool.name, tool.args);

  const borderColor = isRunning
    ? colors.primary
    : isError
      ? colors.error
      : colors.borderColor;

  return (
    <View style={[styles.container, { borderColor }]}>
      {/* Main row: icon + title/subtitle + status indicators */}
      <View style={styles.mainRow}>
        {isRunning ? (
          <Animated.View style={{ opacity: pulseAnim }}>
            <ToolIcon size={14} color={colors.primary} />
          </Animated.View>
        ) : (
          <ToolIcon size={14} color={isError ? colors.error : colors.textSecondary} />
        )}

        <View style={styles.labelContainer}>
          {/* Title: bold, contextual objective */}
          {isRunning ? (
            <Animated.Text
              style={[styles.title, { color: colors.textPrimary, opacity: pulseAnim }]}
              numberOfLines={1}
            >
              {title}
            </Animated.Text>
          ) : (
            <Text
              style={[styles.title, { color: isError ? colors.error : colors.textPrimary }]}
              numberOfLines={1}
            >
              {title}
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

      {/* Detail line: search query or other context (shown in ALL states) */}
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
            {decodeDisplay(tool.summary)}
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
        <Button
          title={t('common.retry')}
          onPress={onRetry}
          variant="outline"
          size="sm"
          icon={<RefreshCw size={11} color={colors.error} />}
          style={[styles.retryButton, { borderColor: colors.error }]}
          textStyle={[styles.retryText, { color: colors.error }]}
        />
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
  title: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
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
