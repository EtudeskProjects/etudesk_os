/**
 * ConfirmationBlock — Action confirmation card with structured preview
 * Shows a rich preview of the entity to create, then confirm/cancel buttons.
 * States: idle → loading → success / error
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Zap,
  CheckCircle2,
  X,
  RefreshCw,
  Briefcase,
  MapPin,
  Clock,
  Banknote,
  Users,
  Star,
  Calendar,
  Maximize2,
} from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';
import { copilotService } from '../../../services/copilotService';
import { formatNumberNoTrailingZeros } from '../../../utils/number';
import { Button, ShimmerPlaceholder } from '../../ui';


export interface ConfirmationData {
  action: string;
  entity_id: string;
  title: string;
  description?: string;
  confirm_label?: string;
  cancel_label?: string;
  data?: Record<string, any>;
}

interface ConfirmationBlockProps {
  data: ConfirmationData;
  sessionId?: string;
  interactive?: boolean;
}

type BlockState = 'idle' | 'loading' | 'success' | 'error';

// --- Human-Readable Mappings ---
const CONTRACT_LABELS: Record<string, string> = {
  CDI: 'CDI', CDD: 'CDD', STAGE: 'Stage', FREELANCE: 'Freelance',
  ALTERNANCE: 'Alternance', INTERIM: 'Intérim', BENEVOLAT: 'Bénévolat',
};
const RHYTHM_LABELS: Record<string, string> = {
  FULL_TIME: 'Temps plein', PART_TIME: 'Temps partiel', FLEXIBLE: 'Flexible',
};
const LOCATION_LABELS: Record<string, string> = {
  ON_SITE: 'Sur site', REMOTE: 'À distance', HYBRID: 'Hybride',
};
const COMMUNITY_TYPE_LABELS: Record<string, string> = {
  PROFESSIONAL: 'Professionnel', ACADEMIC: 'Académique', SOCIAL: 'Social',
  INDUSTRY: 'Industrie', ALUMNI: 'Alumni', RESEARCH: 'Recherche',
};
const ACCESS_LABELS: Record<string, string> = {
  OPEN: 'Ouvert', APPROVAL_REQUIRED: 'Sur approbation', INVITE_ONLY: 'Sur invitation',
};
const SPACE_TYPE_LABELS: Record<string, string> = {
  COWORKING: 'Coworking', MEETING_ROOM: 'Salle de réunion', CONFERENCE: 'Conférence',
  OFFICE: 'Bureau', EVENT_SPACE: 'Événementiel', WORKSHOP: 'Atelier',
  STUDIO: 'Studio', CLASSROOM: 'Salle de cours', LAB: 'Laboratoire',
  LIBRARY: 'Bibliothèque', OTHER: 'Autre',
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return amount.toString();
}

// --- Preview Renderers ---
function OpportunityPreview({ data, colors }: { data: Record<string, any>; colors: any }) {
  const contract = CONTRACT_LABELS[data.contract_type] || data.contract_type;
  const rhythm = RHYTHM_LABELS[data.work_rhythm] || null;
  const locationType = LOCATION_LABELS[data.location_type] || null;
  const location = data.locations?.[0];
  const locationStr = location ? `${location.city || ''}${location.country ? ', ' + location.country : ''}`.trim() : null;
  const hasCompensation = data.compensation_min || data.compensation_max;

  return (
    <View style={styles.previewBody}>
      {/* Title */}
      <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{data.title}</Text>

      {/* Chips row */}
      <View style={styles.chipsRow}>
        <Chip icon={Briefcase} label={contract} colors={colors} />
        {rhythm && <Chip icon={Clock} label={rhythm} colors={colors} />}
        {locationType && <Chip icon={MapPin} label={locationType} colors={colors} />}
      </View>

      {/* Details */}
      {locationStr && (
        <DetailRow icon={MapPin} text={locationStr} colors={colors} />
      )}
      {hasCompensation && (
        <DetailRow
          icon={Banknote}
          text={`${data.compensation_min ? formatCurrency(data.compensation_min) : '—'} - ${data.compensation_max ? formatCurrency(data.compensation_max) : '—'} ${data.currency || 'XOF'}/${data.compensation_frequency === 'ANNUAL' ? 'an' : 'mois'}`}
          colors={colors}
        />
      )}
      {data.deadline && (
        <DetailRow icon={Calendar} text={`Deadline : ${new Date(data.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`} colors={colors} />
      )}

      {/* Summary */}
      {data.summary && (
        <Text style={[styles.previewSummary, { color: colors.textSecondary }]} numberOfLines={3}>
          {data.summary}
        </Text>
      )}

      {/* Requirements */}
      {data.requirements && (
        <View style={[styles.previewSection, { borderTopColor: colors.borderColor }]}>
          <Text style={[styles.previewSectionLabel, { color: colors.textSecondary }]}>Profil recherché</Text>
          <Text style={[styles.previewSectionText, { color: colors.textPrimary }]} numberOfLines={3}>
            {data.requirements}
          </Text>
        </View>
      )}

      {/* Nice to have */}
      {data.nice_to_have && (
        <View style={styles.previewInlineSection}>
          <Star size={12} color={colors.warning} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.previewInlineText, { color: colors.textSecondary }]} numberOfLines={2}>
            {data.nice_to_have}
          </Text>
        </View>
      )}
    </View>
  );
}

function CommunityPreview({ data, colors }: { data: Record<string, any>; colors: any }) {
  const type = COMMUNITY_TYPE_LABELS[data.type] || data.type || 'Professionnel';
  const access = ACCESS_LABELS[data.access_type] || data.access_type || 'Ouvert';

  return (
    <View style={styles.previewBody}>
      <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{data.name}</Text>

      <View style={styles.chipsRow}>
        <Chip icon={Users} label={type} colors={colors} />
        <Chip icon={Zap} label={access} colors={colors} />
      </View>

      {/* Sectors */}
      {data.sectors && data.sectors.length > 0 && (
        <View style={styles.chipsRow}>
          {data.sectors.slice(0, 4).map((s: string, i: number) => (
            <View key={i} style={[styles.sectorChip, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
              <Text style={[styles.sectorChipText, { color: colors.primary }]}>
                {s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')}
              </Text>
            </View>
          ))}
        </View>
      )}

      {data.description && (
        <Text style={[styles.previewSummary, { color: colors.textSecondary }]} numberOfLines={3}>
          {data.description}
        </Text>
      )}
    </View>
  );
}

function SpacePreview({ data, colors }: { data: Record<string, any>; colors: any }) {
  const type = SPACE_TYPE_LABELS[data.type] || data.type;
  const locationStr = data.city ? `${data.city}${data.country ? ', ' + data.country : ''}` : null;

  return (
    <View style={styles.previewBody}>
      <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{data.name}</Text>

      <View style={styles.chipsRow}>
        <Chip icon={Briefcase} label={type} colors={colors} />
        {data.surface_m2 && <Chip icon={Maximize2} label={`${formatNumberNoTrailingZeros(data.surface_m2)} m²`} colors={colors} />}
        {data.capacity && <Chip icon={Users} label={`${formatNumberNoTrailingZeros(data.capacity, 0)} pers.`} colors={colors} />}
      </View>

      {locationStr && <DetailRow icon={MapPin} text={locationStr} colors={colors} />}

      {(data.hourly_rate || data.daily_rate) && (
        <DetailRow
          icon={Banknote}
          text={[
            data.hourly_rate ? `${formatCurrency(data.hourly_rate)} XOF/h` : null,
            data.daily_rate ? `${formatCurrency(data.daily_rate)} XOF/jour` : null,
          ].filter(Boolean).join(' · ')}
          colors={colors}
        />
      )}

      {/* Equipment */}
      {data.equipment && data.equipment.length > 0 && (
        <View style={styles.chipsRow}>
          {data.equipment.slice(0, 5).map((e: string, i: number) => (
            <View key={i} style={[styles.sectorChip, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
              <Text style={[styles.sectorChipText, { color: colors.primary }]}>{e}</Text>
            </View>
          ))}
        </View>
      )}

      {data.description && (
        <Text style={[styles.previewSummary, { color: colors.textSecondary }]} numberOfLines={2}>
          {data.description}
        </Text>
      )}
    </View>
  );
}

// --- Shared Small Components ---
function Chip({ icon: Icon, label, colors }: { icon: any; label: string; colors: any }) {
  return (
    <View style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <Icon size={12} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
      <Text style={[styles.chipText, { color: colors.textPrimary }]}>{label}</Text>
    </View>
  );
}

function DetailRow({ icon: Icon, text, colors }: { icon: any; text: string; colors: any }) {
  return (
    <View style={styles.detailRow}>
      <Icon size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
      <Text style={[styles.detailText, { color: colors.textPrimary }]}>{text}</Text>
    </View>
  );
}

// --- Determine Which Preview To Render ---
function renderPreview(action: string, data: Record<string, any> | undefined, colors: any) {
  if (!data) return null;

  switch (action) {
    case 'publish_opportunity':
      return data.title ? <OpportunityPreview data={data} colors={colors} /> : null;
    case 'create_community':
      return data.name ? <CommunityPreview data={data} colors={colors} /> : null;
    case 'create_space':
      return data.name ? <SpacePreview data={data} colors={colors} /> : null;
    default:
      return null;
  }
}

// --- Main Component ---
export const ConfirmationBlock: React.FC<ConfirmationBlockProps> = ({
  data,
  sessionId,
  interactive = true,
}) => {
  const { colors } = useTheme();
  const [state, setState] = useState<BlockState>('idle');
  const [resultMessage, setResultMessage] = useState('');

  const confirmLabel = data.confirm_label || 'Confirmer';
  const cancelLabel = data.cancel_label || 'Annuler';
  const hasPreview = renderPreview(data.action, data.data, colors) !== null;

  const handleConfirm = async () => {
    if (state !== 'idle') return;
    setState('loading');

    try {
      const response = await copilotService.confirmAction(
        data.action,
        data.entity_id,
        sessionId,
        data.data
      );

      if (response.success && response.data) {
        setState('success');
        setResultMessage(response.data.message || 'Action effectuée.');
      } else {
        setState('error');
        setResultMessage(response.error || 'Une erreur est survenue.');
      }
    } catch (err: any) {
      setState('error');
      setResultMessage(err.message || 'Erreur de connexion.');
    }
  };

  const handleCancel = () => {
    setState('success');
    setResultMessage('Action annulée.');
  };

  const handleRetry = () => {
    setState('idle');
    setResultMessage('');
  };

  if (!data.action || !data.entity_id || !data.title) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Zap size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
          {data.title}
        </Text>
      </View>

      {/* Structured preview (for creation actions) */}
      {state === 'idle' && renderPreview(data.action, data.data, colors)}

      {/* Fallback description (for non-creation actions without preview) */}
      {data.description && state === 'idle' && !hasPreview && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {data.description}
        </Text>
      )}

      {/* Idle: show buttons */}
      {state === 'idle' && interactive && (
        <View style={styles.buttonsRow}>
          <Button
            title={cancelLabel}
            onPress={handleCancel}
            variant="outline"
            style={[styles.cancelButton, { borderColor: colors.borderColor }]}
            textStyle={[styles.cancelText, { color: colors.textSecondary }]}
          />

          <Button
            title={confirmLabel}
            onPress={handleConfirm}
            variant="primary"
            icon={<CheckCircle2 size={ICON.size.sm} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
            style={[styles.confirmButton, { backgroundColor: colors.primary }]}
            textStyle={[styles.confirmText, { color: colors.textOnPrimary }]}
          />
        </View>
      )}

      {/* Not interactive hint */}
      {!interactive && state === 'idle' && (
        <Text style={[styles.hintText, { color: colors.textDisabled }]}>
          Action expirée
        </Text>
      )}

      {/* Loading */}
      {state === 'loading' && (
        <View style={styles.statusRow}>
          <ShimmerPlaceholder width={24} height={14} variant="bar" />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            Traitement en cours...
          </Text>
        </View>
      )}

      {/* Success */}
      {state === 'success' && (
        <View style={[styles.statusRow, styles.successRow, { backgroundColor: withOpacity(colors.success, OPACITY[10]) }]}>
          <CheckCircle2 size={ICON.size.sm} color={colors.success} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.statusText, { color: colors.success }]}>
            {resultMessage}
          </Text>
        </View>
      )}

      {/* Error */}
      {state === 'error' && (
        <View style={styles.errorContainer}>
          <View style={[styles.statusRow, styles.errorRow, { backgroundColor: withOpacity(colors.error, OPACITY[10]) }]}>
            <X size={ICON.size.sm} color={colors.error} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, styles.errorText, { color: colors.error }]}>
              {resultMessage}
            </Text>
          </View>
          <Button
            title="Réessayer"
            onPress={handleRetry}
            variant="outline"
            icon={<RefreshCw size={12} color={colors.error} strokeWidth={ICON.strokeWidth} />}
            style={[styles.retryButton, { borderColor: colors.error, backgroundColor: 'transparent' }]}
            textStyle={[styles.retryText, { color: colors.error }]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    lineHeight: TYPOGRAPHY.fontSize.lg * TYPOGRAPHY.lineHeight.normal,
    flex: 1,
  },
  description: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.lg,
  },

  // --- Preview Styles ---
  previewBody: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  previewTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    lineHeight: TYPOGRAPHY.fontSize.xl * TYPOGRAPHY.lineHeight.tight,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER.radius.xs,
    borderWidth: BORDER.width.thin,
  },
  chipText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  sectorChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER.radius.xs,
  },
  sectorChipText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xxs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  previewSummary: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
  },
  previewSection: {
    borderTopWidth: BORDER.width.thin,
    paddingTop: SPACING.sm,
    gap: 2,
  },
  previewSectionLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  previewSectionText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
  },
  previewInlineSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
  },
  previewInlineText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: TYPOGRAPHY.fontSize.xs * TYPOGRAPHY.lineHeight.normal,
    flex: 1,
    fontStyle: 'italic',
  },

  // --- Button Styles ---
  buttonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
  },
  cancelText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: BORDER.radius.md,
  },
  confirmText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  hintText: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: SPACING.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  successRow: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
  },
  errorRow: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
  },
  statusText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  errorContainer: {
    gap: SPACING.sm,
  },
  errorText: {},
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER.radius.xs,
    alignSelf: 'flex-start',
  },
  retryText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});

export default ConfirmationBlock;
