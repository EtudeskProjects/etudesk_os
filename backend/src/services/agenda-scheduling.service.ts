import { pool } from './database';

export type AgendaScheduleScope = 'TALENT' | 'ORGANIZATION';

export interface ResolveAgendaScheduleParams {
  scope: AgendaScheduleScope;
  talentId?: string;
  organizationId?: string;
  requestedDueAt: Date;
  excludeTriggerId?: string | null;
  latestAllowedAt?: Date | null;
}

export interface ResolveAgendaScheduleResult {
  dueAt: Date;
  adjusted: boolean;
  reasons: string[];
  requestedDueAt: Date;
}

interface OccupiedInterval {
  source: string;
  startsAt: Date;
  endsAt: Date;
}

const SLOT_MS = 15 * 60 * 1000;
const MIN_FUTURE_BUFFER_MS = 60 * 1000;
const LOOKAHEAD_MS = 30 * 24 * 60 * 60 * 1000;

function ceilToQuarterHour(value: Date): Date {
  return new Date(Math.ceil(value.getTime() / SLOT_MS) * SLOT_MS);
}

function floorToQuarterHour(value: Date): Date {
  return new Date(Math.floor(value.getTime() / SLOT_MS) * SLOT_MS);
}

function overlaps(slotStart: Date, slotEnd: Date, interval: OccupiedInterval): boolean {
  return interval.startsAt < slotEnd && interval.endsAt > slotStart;
}

function buildTalentIntervalsQuery(): string {
  return `
    SELECT source, starts_at, ends_at
    FROM (
      SELECT
        'community_event'::text AS source,
        (ca.metadata->>'start_date')::timestamptz AS starts_at,
        COALESCE((ca.metadata->>'end_date')::timestamptz, ((ca.metadata->>'start_date')::timestamptz + interval '15 minutes')) AS ends_at
      FROM community_activities ca
      JOIN community_members cm ON cm.community_id = ca.community_id
      WHERE cm.talent_id = $1::uuid
        AND ca.type = 'EVENT'
        AND ca.is_draft = false
        AND (ca.metadata->>'start_date') IS NOT NULL

      UNION ALL

      SELECT
        'opportunity_deadline'::text AS source,
        o.deadline AS starts_at,
        o.deadline + interval '15 minutes' AS ends_at
      FROM opportunities o
      JOIN opportunity_applications oa ON oa.opportunity_id = o.id
      WHERE oa.talent_id = $1::uuid
        AND o.deadline IS NOT NULL
        AND o.deleted_at IS NULL

      UNION ALL

      SELECT
        'space_booking'::text AS source,
        sb.start_datetime AS starts_at,
        COALESCE(sb.end_datetime, sb.start_datetime + interval '15 minutes') AS ends_at
      FROM space_bookings sb
      JOIN spaces s ON s.id = sb.space_id
      WHERE sb.talent_id = $1::uuid
        AND sb.status IN ('CONFIRMED', 'PENDING')
        AND s.deleted_at IS NULL

      UNION ALL

      SELECT
        'agenda_trigger'::text AS source,
        at.due_at AS starts_at,
        at.due_at + interval '15 minutes' AS ends_at
      FROM agenda_triggers at
      WHERE at.scope = 'TALENT'
        AND at.talent_id = $1::uuid
        AND at.status = 'PENDING'
        AND ($4::uuid IS NULL OR at.id <> $4::uuid)
    ) occupied
    WHERE starts_at < $3::timestamptz
      AND ends_at > $2::timestamptz
    ORDER BY starts_at ASC
  `;
}

function buildOrganizationIntervalsQuery(): string {
  return `
    SELECT source, starts_at, ends_at
    FROM (
      SELECT
        'application_received'::text AS source,
        oa.applied_at AS starts_at,
        oa.applied_at + interval '15 minutes' AS ends_at
      FROM opportunity_applications oa
      JOIN opportunities o ON o.id = oa.opportunity_id
      WHERE o.deleted_at IS NULL
        AND (
          o.organization_id = $1::uuid
          OR EXISTS (
            SELECT 1
            FROM opportunity_posters op
            WHERE op.opportunity_id = o.id
              AND op.poster_organization_id = $1::uuid
          )
        )

      UNION ALL

      SELECT
        'space_booking'::text AS source,
        sb.start_datetime AS starts_at,
        COALESCE(sb.end_datetime, sb.start_datetime + interval '15 minutes') AS ends_at
      FROM space_bookings sb
      JOIN spaces s ON s.id = sb.space_id
      WHERE s.organization_id = $1::uuid
        AND s.deleted_at IS NULL
        AND sb.status IN ('CONFIRMED', 'PENDING')

      UNION ALL

      SELECT
        'community_event'::text AS source,
        (ca.metadata->>'start_date')::timestamptz AS starts_at,
        COALESCE((ca.metadata->>'end_date')::timestamptz, ((ca.metadata->>'start_date')::timestamptz + interval '15 minutes')) AS ends_at
      FROM community_activities ca
      JOIN communities c ON c.id = ca.community_id
      WHERE c.organization_id = $1::uuid
        AND ca.type = 'EVENT'
        AND ca.is_draft = false
        AND (ca.metadata->>'start_date') IS NOT NULL

      UNION ALL

      SELECT
        'agenda_trigger'::text AS source,
        at.due_at AS starts_at,
        at.due_at + interval '15 minutes' AS ends_at
      FROM agenda_triggers at
      WHERE at.scope = 'ORGANIZATION'
        AND at.organization_id = $1::uuid
        AND at.status = 'PENDING'
        AND ($4::uuid IS NULL OR at.id <> $4::uuid)
    ) occupied
    WHERE starts_at < $3::timestamptz
      AND ends_at > $2::timestamptz
    ORDER BY starts_at ASC
  `;
}

async function fetchOccupiedIntervals(params: {
  scope: AgendaScheduleScope;
  talentId?: string;
  organizationId?: string;
  windowStart: Date;
  windowEnd: Date;
  excludeTriggerId?: string | null;
}): Promise<OccupiedInterval[]> {
  const query =
    params.scope === 'ORGANIZATION'
      ? buildOrganizationIntervalsQuery()
      : buildTalentIntervalsQuery();

  const principalId = params.scope === 'ORGANIZATION' ? params.organizationId : params.talentId;
  if (!principalId) return [];

  const result = await pool.query(query, [
    principalId,
    params.windowStart.toISOString(),
    params.windowEnd.toISOString(),
    params.excludeTriggerId || null,
  ]);

  return result.rows
    .map((row) => ({
      source: String(row.source || 'agenda'),
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
    }))
    .filter((row) => !Number.isNaN(row.startsAt.getTime()) && !Number.isNaN(row.endsAt.getTime()));
}

function buildForwardSlots(start: Date, end: Date): Date[] {
  const slots: Date[] = [];
  for (let ts = start.getTime(); ts <= end.getTime(); ts += SLOT_MS) {
    slots.push(new Date(ts));
  }
  return slots;
}

function buildNearestSlots(start: Date, end: Date, preferred: Date): Date[] {
  const slots = buildForwardSlots(start, end);
  return slots.sort((a, b) => {
    const distance = Math.abs(a.getTime() - preferred.getTime()) - Math.abs(b.getTime() - preferred.getTime());
    if (distance !== 0) return distance;
    return a.getTime() - b.getTime();
  });
}

export async function resolveAgendaSchedule(params: ResolveAgendaScheduleParams): Promise<ResolveAgendaScheduleResult | null> {
  const requestedDueAt = new Date(params.requestedDueAt);
  if (Number.isNaN(requestedDueAt.getTime())) return null;

  const reasons = new Set<string>();
  const minFuture = ceilToQuarterHour(new Date(Date.now() + MIN_FUTURE_BUFFER_MS));

  let preferredDueAt = new Date(requestedDueAt);
  if (params.latestAllowedAt && preferredDueAt > params.latestAllowedAt) {
    preferredDueAt = new Date(params.latestAllowedAt);
    reasons.add('capped_by_latest_allowed');
  }

  if (preferredDueAt < minFuture) {
    preferredDueAt = new Date(minFuture);
    reasons.add('moved_to_future');
  }

  let roundedPreferred = ceilToQuarterHour(preferredDueAt);
  if (roundedPreferred.getTime() !== preferredDueAt.getTime()) {
    reasons.add('rounded_to_quarter_hour');
  }

  const upperBound = params.latestAllowedAt
    ? floorToQuarterHour(params.latestAllowedAt)
    : new Date(roundedPreferred.getTime() + LOOKAHEAD_MS);

  if (upperBound < minFuture) return null;
  if (roundedPreferred > upperBound) {
    roundedPreferred = new Date(upperBound);
  }

  const candidateSlots = params.latestAllowedAt
    ? buildNearestSlots(minFuture, upperBound, roundedPreferred)
    : buildForwardSlots(roundedPreferred, upperBound);

  if (candidateSlots.length === 0) return null;

  const minTs = Math.min(...candidateSlots.map((slot) => slot.getTime()));
  const maxTs = Math.max(...candidateSlots.map((slot) => slot.getTime()));
  const occupiedIntervals = await fetchOccupiedIntervals({
    scope: params.scope,
    talentId: params.talentId,
    organizationId: params.organizationId,
    windowStart: new Date(minTs),
    windowEnd: new Date(maxTs + SLOT_MS),
    excludeTriggerId: params.excludeTriggerId,
  });

  const chosen = candidateSlots.find((slot) => {
    const slotEnd = new Date(slot.getTime() + SLOT_MS);
    return !occupiedIntervals.some((interval) => overlaps(slot, slotEnd, interval));
  });

  if (!chosen) return null;
  if (chosen.getTime() !== requestedDueAt.getTime()) {
    reasons.add('avoided_conflict_or_invalid_slot');
  }

  return {
    dueAt: chosen,
    adjusted: chosen.getTime() !== requestedDueAt.getTime(),
    reasons: [...reasons],
    requestedDueAt,
  };
}
