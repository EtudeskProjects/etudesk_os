/**
 * CopyButton — Copy markdown content to clipboard
 * Enriches entity blocks with real data before copying
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, Check } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../contexts/I18nContext';
import { ICON } from '../../constants/theme';
import { api } from '../../services/api';
import { formatNumberNoTrailingZeros } from '../../utils/number';
import { getLabel } from '../../utils/labels';
import { getMapPoints, hasMapEntityPayload } from '../../utils/mapEntity';
import { ShimmerPlaceholder } from '../ui';
import { getCurrentLocale } from '../../i18n';


interface CopyButtonProps {
  content: string;
  size?: number;
}

/** Entity type labels (i18n) */
const getEntityLabel = (type: string): string => getLabel('entityLabels', type);

function formatDateTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString(getCurrentLocale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format entity data into readable text */
function formatEntity(type: string, data: Record<string, any>): string {
  const label = getEntityLabel(type) || type;
  const parts: string[] = [];

  switch (type) {
    case 'opportunity': {
      const title = data.title || data.name || '';
      const org = data.organization?.name;
      const location = data.locations?.[0]?.city || data.city;
      const opType = data.type;
      parts.push(title);
      if (org) parts.push(org);
      if (location) parts.push(location);
      if (opType) parts.push(opType);
      break;
    }
    case 'community': {
      const name = data.name || '';
      const org = data.organization?.name;
      const members = data.members_count;
      const city = data.city;
      parts.push(name);
      if (org) parts.push(org);
      if (city) parts.push(city);
      if (members !== undefined) parts.push(`${members} membres`);
      break;
    }
    case 'space': {
      const name = data.name || '';
      const org = data.organization?.name;
      const city = data.city;
      const capacity = data.capacity;
      const rate = data.hourly_rate;
      parts.push(name);
      if (org) parts.push(org);
      if (city) parts.push(city);
      if (capacity) parts.push(`${formatNumberNoTrailingZeros(capacity, 0)} places`);
      if (rate) parts.push(`${formatNumberNoTrailingZeros(rate, 0)} FCFA/h`);
      break;
    }
    case 'organization': {
      const name = data.name || '';
      const city = data.headquarters_city;
      const opType = data.type;
      parts.push(name);
      if (city) parts.push(city);
      if (opType) parts.push(opType);
      break;
    }
    case 'talent': {
      const name = data.display_name || `${data.first_name || ''} ${data.last_name || ''}`.trim();
      const headline = data.headline || data.current_role;
      const city = data.city;
      parts.push(name);
      if (headline) parts.push(headline);
      if (city) parts.push(city);
      break;
    }
    case 'document': {
      const title = data.title || data.original_filename || '';
      const docType = data.document_type || data.category;
      parts.push(title);
      if (docType) parts.push(docType);
      break;
    }
    case 'event': {
      const title = data.title || data.metadata?.title || data.content || '';
      const community = data.community_name || data.community?.name;
      const eventDate = formatDateTime(data.startDate || data.start_date || data.metadata?.start_date);
      const location = data.location || data.metadata?.location;
      parts.push(title);
      if (community) parts.push(community);
      if (eventDate) parts.push(eventDate);
      if (location) parts.push(location);
      break;
    }
    case 'skill': {
      const title = data.title || data.canonical_name || data.name || '';
      const level = data.proficiencyLevel || data.proficiency_level;
      const skillType = data.skillType || data.type;
      parts.push(title);
      if (level) parts.push(getLabel('proficiencyLevels', level));
      if (skillType) parts.push(getLabel('skillTypes', skillType));
      break;
    }
    case 'notification': {
      const title = data.title || '';
      const body = data.body || data.subtitle;
      parts.push(title);
      if (body) parts.push(body);
      break;
    }
    case 'maps': {
      const label = data.title || data.label || data.name || '';
      const address = data.address || data.location;
      const point = getMapPoints(data)[0];
      parts.push(label);
      if (address) parts.push(address);
      if (point) parts.push(`${point.lat}, ${point.lng}`);
      break;
    }
    default: {
      const name = data.title || data.name || data.id || '';
      parts.push(name);
    }
  }

  return `[${label}] ${parts.filter(Boolean).join(' \u2014 ')}`;
}

/** Enrich message content by replacing entity blocks with readable text */
async function enrichContent(content: string): Promise<string> {
  const blockRegex = /`{2,}([\w:-]+)\n([\s\S]*?)`{2,}/g;
  const entityTypes = ['opportunity', 'community', 'space', 'organization', 'talent', 'event', 'document', 'skill', 'notification', 'maps'];

  // Collect all entity blocks
  const replacements: Array<{ full: string; type: string; id?: string; data: Record<string, any> }> = [];
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(content)) !== null) {
    const tag = match[1];
    const body = match[2].trim();
    const isEntity = tag.startsWith('entity:') || entityTypes.includes(tag);
    if (!isEntity) continue;

    const entityType = tag.startsWith('entity:') ? tag.replace('entity:', '') : tag;
    try {
      const parsed = JSON.parse(body);
      if (parsed?.id || (entityType === 'maps' && hasMapEntityPayload(parsed))) {
        replacements.push({ full: match[0], type: entityType, id: parsed?.id, data: parsed });
      }
    } catch {
      // Skip malformed JSON
    }
  }

  if (replacements.length === 0) return content;

  const batchKeys = replacements
    .filter((r) => r.id && r.type !== 'maps')
    .map((r) => `${r.type}:${r.id}`);

  let batchData: Record<string, any> = {};
  if (batchKeys.length > 0) {
    try {
      const response: any = await api.get(`/entities/batch?items=${encodeURIComponent(batchKeys.join(','))}`);
      batchData = response?.data || {};
    } catch {
      batchData = {};
    }
  }

  // Replace entity blocks with readable text
  let enriched = content;
  for (const replacement of replacements) {
    const fetched = replacement.id ? batchData[`${replacement.type}:${replacement.id}`] : null;
    const text = formatEntity(replacement.type, fetched || replacement.data);
    enriched = enriched.replace(replacement.full, text);
  }

  return enriched;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ content, size = ICON.size.sm }) => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const { t } = useI18n();

  const handleCopy = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const enriched = await enrichContent(content);
      await Clipboard.setStringAsync(enriched);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy raw content
      await Clipboard.setStringAsync(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      style={[styles.button, loading && { opacity: 0.6 }]}
      onPress={handleCopy}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={t('common.copy')}
    >
      {loading ? (
        <ShimmerPlaceholder width={(size || 18) + 4} height={12} variant="bar" />
      ) : copied ? (
        <Check size={size} color={colors.success} strokeWidth={ICON.strokeWidth} />
      ) : (
        <Copy size={size} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 4,
  },
});

export default CopyButton;
