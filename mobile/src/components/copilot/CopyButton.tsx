/**
 * CopyButton — Copy markdown content to clipboard
 * Enriches entity blocks with real data before copying
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, Check } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { ICON } from '../../constants/theme';
import { api } from '../../services/api';
import { ShimmerPlaceholder } from '../ui';


interface CopyButtonProps {
  content: string;
  size?: number;
}

/** API endpoints for each entity type */
const ENTITY_ENDPOINTS: Record<string, string> = {
  opportunity: '/api/opportunities',
  community: '/api/communities',
  space: '/api/spaces',
  organization: '/api/organizations',
  talent: '/api/talents',
  document: '/api/documents',
};

/** Entity type labels in French */
const ENTITY_LABELS: Record<string, string> = {
  opportunity: 'Opportunit\u00e9',
  community: 'Communaut\u00e9',
  space: 'Espace',
  organization: 'Organisation',
  talent: 'Talent',
  document: 'Document',
};

/** Format entity data into readable text */
function formatEntity(type: string, data: Record<string, any>): string {
  const label = ENTITY_LABELS[type] || type;
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
      if (capacity) parts.push(`${capacity} places`);
      if (rate) parts.push(`${rate} FCFA/h`);
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
  const replacements: Array<{ full: string; type: string; id: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(content)) !== null) {
    const tag = match[1];
    const body = match[2].trim();
    const isEntity = tag.startsWith('entity:') || entityTypes.includes(tag);
    if (!isEntity) continue;

    const entityType = tag.startsWith('entity:') ? tag.replace('entity:', '') : tag;
    try {
      const parsed = JSON.parse(body);
      if (parsed?.id) {
        replacements.push({ full: match[0], type: entityType, id: parsed.id });
      }
    } catch {
      // Skip malformed JSON
    }
  }

  if (replacements.length === 0) return content;

  // Fetch all entities in parallel
  const fetches = await Promise.allSettled(
    replacements.map(async (r) => {
      const endpoint = ENTITY_ENDPOINTS[r.type];
      if (!endpoint) return { ...r, text: `[${ENTITY_LABELS[r.type] || r.type}]` };
      try {
        const response = await api.get<any>(`${endpoint}/${r.id}`);
        const data = response.data || response;
        return { ...r, text: formatEntity(r.type, data) };
      } catch {
        return { ...r, text: `[${ENTITY_LABELS[r.type] || r.type}]` };
      }
    })
  );

  // Replace entity blocks with readable text
  let enriched = content;
  for (const result of fetches) {
    if (result.status === 'fulfilled') {
      enriched = enriched.replace(result.value.full, result.value.text);
    }
  }

  return enriched;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ content, size = ICON.size.sm }) => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();

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
      accessibilityLabel="Copier"
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
