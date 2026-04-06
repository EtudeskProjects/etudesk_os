/**
 * ConfirmationBlock — Action confirmation card with structured preview
 * Shows a rich preview of the entity to create, then confirm/cancel buttons.
 * States: idle → loading → success / error
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { useI18n } from '../../../contexts/I18nContext';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';
import { copilotService } from '../../../services/copilotService';
import { formatNumberNoTrailingZeros } from '../../../utils/number';
import { getLabel } from '../../../utils/labels';
import i18n from '../../../i18n';
import { getCurrentLocale } from '../../../i18n';
import { Button, ShimmerPlaceholder } from '../../ui';

/** Storage key for persisting confirmation action results */
function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function getConfirmationKey(action: string, entityId: string, title: string, data?: Record<string, any>): string {
  const fingerprint = hashString(JSON.stringify({ title, data: data || null }));
  return `confirmation_done_${action}_${entityId}_${fingerprint}`;
}


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

// --- Human-Readable Mappings (i18n) ---
const getContractLabel = (key: string) => getLabel('confirmationLabels.contractTypes', key);
const getRhythmLabel = (key: string) => getLabel('confirmationLabels.workRhythms', key);
const getLocationLabel = (key: string) => getLabel('confirmationLabels.locationTypes', key);
const getCommunityTypeLabel = (key: string) => getLabel('confirmationLabels.communityCategories', key);
const getAccessLabel = (key: string) => getLabel('confirmationLabels.joinPolicies', key);
const getSpaceTypeLabel = (key: string) => getLabel('confirmationLabels.spaceCategories', key);

function sanitizeText(value: unknown, max = 160): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function sanitizeList(values: unknown, maxItems = 5): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  return values
    .map((value) => sanitizeText(value, 48))
    .filter((value): value is string => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return amount.toString();
}

// --- Preview Renderers ---
function OpportunityPreview({ data, colors, headerTitle }: { data: Record<string, any>; colors: any; headerTitle?: string }) {
  const contract = getContractLabel(data.contract_type) || data.contract_type;
  const rhythm = data.work_rhythm ? getRhythmLabel(data.work_rhythm) : null;
  const locationType = data.location_type ? getLocationLabel(data.location_type) : null;
  const location = data.locations?.[0];
  const locationStr = location ? sanitizeText(`${location.city || ''}${location.country ? ', ' + location.country : ''}`) : null;
  const hasCompensation = data.compensation_min || data.compensation_max;
  const previewTitle = sanitizeText(data.title, 88);
  const summary = sanitizeText(data.summary, 220);
  const requirements = sanitizeText(data.requirements, 220);
  const niceToHave = sanitizeText(data.nice_to_have, 120);

  return (
    <View style={styles.previewBody}>
      {previewTitle && previewTitle !== headerTitle ? (
        <Text style={[styles.previewTitle, { color: colors.textPrimary }]} numberOfLines={2}>{previewTitle}</Text>
      ) : null}

      <View style={styles.chipsRow}>
        {sanitizeText(contract, 32) && <Chip icon={Briefcase} label={sanitizeText(contract, 32)!} colors={colors} />}
        {sanitizeText(rhythm, 32) && <Chip icon={Clock} label={sanitizeText(rhythm, 32)!} colors={colors} />}
        {sanitizeText(locationType, 32) && <Chip icon={MapPin} label={sanitizeText(locationType, 32)!} colors={colors} />}
      </View>

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
        <DetailRow icon={Calendar} text={`${i18n.t('common.deadline')} : ${new Date(data.deadline).toLocaleDateString(getCurrentLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}`} colors={colors} />
      )}

      {summary && (
        <Text style={[styles.previewSummary, { color: colors.textSecondary }]} numberOfLines={3}>
          {summary}
        </Text>
      )}

      {requirements && (
        <View style={[styles.previewSection, { borderTopColor: colors.borderColor }]}>
          <Text style={[styles.previewSectionLabel, { color: colors.textSecondary }]}>{i18n.t('common.soughtProfile')}</Text>
          <Text style={[styles.previewSectionText, { color: colors.textPrimary }]} numberOfLines={3}>
            {requirements}
          </Text>
        </View>
      )}

      {niceToHave && (
        <View style={styles.previewInlineSection}>
          <Star size={12} color={colors.warning} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.previewInlineText, { color: colors.textSecondary }]} numberOfLines={2}>
            {niceToHave}
          </Text>
        </View>
      )}
    </View>
  );
}

function CommunityPreview({ data, colors, headerTitle }: { data: Record<string, any>; colors: any; headerTitle?: string }) {
  const type = getCommunityTypeLabel(data.type) || data.type;
  const access = getAccessLabel(data.access_type) || data.access_type;
  const name = sanitizeText(data.name, 88);
  const sectors = sanitizeList(data.sectors, 4);
  const description = sanitizeText(data.description, 220);

  return (
    <View style={styles.previewBody}>
      {name && name !== headerTitle ? (
        <Text style={[styles.previewTitle, { color: colors.textPrimary }]} numberOfLines={2}>{name}</Text>
      ) : null}

      <View style={styles.chipsRow}>
        {sanitizeText(type, 32) && <Chip icon={Users} label={sanitizeText(type, 32)!} colors={colors} />}
        {sanitizeText(access, 32) && <Chip icon={Zap} label={sanitizeText(access, 32)!} colors={colors} />}
      </View>

      {sectors.length > 0 && (
        <View style={styles.chipsRow}>
          {sectors.map((s: string, i: number) => (
            <View key={i} style={[styles.sectorChip, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
              <Text style={[styles.sectorChipText, { color: colors.primary }]}>
                {s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')}
              </Text>
            </View>
          ))}
        </View>
      )}

      {description && (
        <Text style={[styles.previewSummary, { color: colors.textSecondary }]} numberOfLines={3}>
          {description}
        </Text>
      )}
    </View>
  );
}

function SpacePreview({ data, colors, headerTitle }: { data: Record<string, any>; colors: any; headerTitle?: string }) {
  const type = getSpaceTypeLabel(data.type) || data.type;
  const locationStr = sanitizeText(data.city ? `${data.city}${data.country ? ', ' + data.country : ''}` : null);
  const name = sanitizeText(data.name, 88);
  const equipment = sanitizeList(data.equipment, 5);
  const description = sanitizeText(data.description, 160);

  return (
    <View style={styles.previewBody}>
      {name && name !== headerTitle ? (
        <Text style={[styles.previewTitle, { color: colors.textPrimary }]} numberOfLines={2}>{name}</Text>
      ) : null}

      <View style={styles.chipsRow}>
        {sanitizeText(type, 32) && <Chip icon={Briefcase} label={sanitizeText(type, 32)!} colors={colors} />}
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

      {equipment.length > 0 && (
        <View style={styles.chipsRow}>
          {equipment.map((e: string, i: number) => (
            <View key={i} style={[styles.sectorChip, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
              <Text style={[styles.sectorChipText, { color: colors.primary }]}>{e}</Text>
            </View>
          ))}
        </View>
      )}

      {description && (
        <Text style={[styles.previewSummary, { color: colors.textSecondary }]} numberOfLines={2}>
          {description}
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

function ProfileUpdatePreview({ data, colors }: { data: Record<string, any>; colors: any }) {
  const getFieldLabel = (key: string) => getLabel('profileFields', key);

  const PROFILE_FIELD_KEYS = ['bio', 'city', 'country', 'goals', 'sectors', 'remote_ready', 'willing_to_relocate', 'profile_tags'];

  /** Resolve enum value: try goals, profileTags, sectors in order */
  const resolveEnum = (v: string): string => {
    const goal = getLabel('goals', v);
    if (goal !== v) return goal;
    const tag = getLabel('profileTags', v);
    if (tag !== v) return tag;
    const sector = getLabel('sectors', v);
    if (sector !== v) return sector;
    return v;
  };

  const formatValue = (value: any): string => {
    if (typeof value === 'boolean') return value ? i18n.t('common.yes') : i18n.t('common.no');
    if (Array.isArray(value)) return sanitizeList(value, 5).map(v => resolveEnum(v)).join(', ');
    return sanitizeText(value, 220) || '';
  };

  const entries = Object.entries(data).filter(([key, value]) => PROFILE_FIELD_KEYS.includes(key) && (Array.isArray(value) ? sanitizeList(value).length > 0 : sanitizeText(value)));

  return (
    <View style={styles.previewBody}>
      {entries.map(([key, value]) => (
        <View key={key} style={styles.profileUpdateRow}>
          <Text style={[styles.profileUpdateLabel, { color: colors.textSecondary }]}>
            {getFieldLabel(key)}
          </Text>
          {Array.isArray(value) ? (
            <View style={styles.profileTagsWrap}>
              {value.map((v: string, i: number) => (
                <View key={i} style={[styles.profileTagChip, { backgroundColor: withOpacity(colors.primary, OPACITY[10]), borderColor: colors.primary }]}>
                  <Text style={[styles.profileTagChipText, { color: colors.primary }]}>
                    {resolveEnum(v) || v}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.profileUpdateValue, { color: colors.textPrimary }]} numberOfLines={4}>
              {formatValue(value)}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function renderPreviewWithHeader(action: string, data: Record<string, any> | undefined, colors: any, headerTitle?: string) {
  if (!data) return null;

  switch (action) {
    case 'publish_opportunity':
      return data.title ? <OpportunityPreview data={data} colors={colors} headerTitle={headerTitle} /> : null;
    case 'create_community':
      return data.name ? <CommunityPreview data={data} colors={colors} headerTitle={headerTitle} /> : null;
    case 'create_space':
      return data.name ? <SpacePreview data={data} colors={colors} headerTitle={headerTitle} /> : null;
    case 'update_profile':
      return <ProfileUpdatePreview data={data} colors={colors} />;
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
  const { t } = useI18n();
  const [state, setState] = useState<BlockState>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [loaded, setLoaded] = useState(false);

  const storageKey = getConfirmationKey(data.action, data.entity_id, data.title, data.data);

  // On mount, check if this action was already executed
  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((stored) => {
      if (stored) {
        try {
          const { state: savedState, message } = JSON.parse(stored);
          setState(savedState);
          setResultMessage(message);
        } catch { /* ignore parse errors */ }
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [storageKey]);

  const confirmLabel = sanitizeText(data.confirm_label, 32) || t('common.confirm');
  const cancelLabel = sanitizeText(data.cancel_label, 32) || t('common.cancel');
  const safeTitle = sanitizeText(data.title, 96);
  const safeDescription = sanitizeText(data.description, 160);
  const preview = renderPreviewWithHeader(data.action, data.data, colors, safeTitle);
  const hasPreview = preview !== null;

  /** Persist resolved state so it survives conversation reload */
  const persistState = (newState: BlockState, message: string) => {
    setState(newState);
    setResultMessage(message);
    if (newState === 'success') {
      AsyncStorage.setItem(storageKey, JSON.stringify({ state: newState, message })).catch(() => {});
    }
  };

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
        persistState('success', response.data.message || t('common.actionDone'));
      } else {
        setState('error');
        setResultMessage(response.data?.message || response.error || t('common.genericError'));
      }
    } catch (err: any) {
      setState('error');
      setResultMessage(err.message || t('common.connectionError'));
    }
  };

  const handleCancel = () => {
    persistState('success', t('common.actionCancelled'));
  };

  const handleRetry = () => {
    setState('idle');
    setResultMessage('');
  };

  if (!data.action || !data.entity_id || !safeTitle) return null;
  if (!loaded) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Zap size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
          {safeTitle}
        </Text>
      </View>

      {state === 'idle' && preview}

      {safeDescription && state === 'idle' && !hasPreview && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {safeDescription}
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
            style={[styles.confirmButton, { backgroundColor: colors.primary }]}
            textStyle={[styles.confirmText, { color: colors.textOnPrimary }]}
          />
        </View>
      )}

      {/* Not interactive: no hint needed — absence of buttons is sufficient */}

      {/* Loading */}
      {state === 'loading' && (
        <View style={styles.statusRow}>
          <ShimmerPlaceholder width={24} height={14} variant="bar" />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {t('common.processing')}
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
            title={t('common.retry')}
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
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.normal,
    flex: 1,
  },
  description: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.md,
  },

  // --- Preview Styles ---
  previewBody: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  previewTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    lineHeight: TYPOGRAPHY.fontSize.lg * TYPOGRAPHY.lineHeight.tight,
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
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.sm,
    borderWidth: BORDER.width.thin,
  },
  cancelText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },
  confirmText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
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
  profileUpdateRow: {
    gap: SPACING.xs,
  },
  profileUpdateLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  profileUpdateValue: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
  },
  profileTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  profileTagChip: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER.radius.full,
  },
  profileTagChipText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export default ConfirmationBlock;
