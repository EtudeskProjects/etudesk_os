import { pool } from './database';
import * as notificationService from './notification.service';
import { logger } from '../utils';

type TriggerScope = 'TALENT' | 'ORGANIZATION';
type TriggerStatus = 'PENDING' | 'DONE' | 'CANCELED';

type TriggerRow = {
  id: string;
  scope: TriggerScope;
  talent_id: string | null;
  organization_id: string | null;
  code: string;
  title: string;
  description: string | null;
  due_at: string;
  status: TriggerStatus;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  metadata: Record<string, any> | null;
  created_by: string | null;
};

type PolicyResult = {
  outcome: string;
  note?: string;
  nextDueAt?: Date | null;
  data?: Record<string, any>;
};

const TERMINAL_APPLICATION_STATUSES = new Set(['ACCEPTED', 'REJECTED', 'WITHDRAWN', 'CANCELED']);

let isAgendaCronRunning = false;

function toIso(value: Date): string {
  return value.toISOString();
}

function parseDateOnly(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function dayBeforeStartAt0900Utc(startDateOnly: string): Date {
  const start = parseDateOnly(startDateOnly);
  const due = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
    9, 0, 0, 0
  ));
  due.setUTCDate(due.getUTCDate() - 1);
  return due;
}

function computeRecurringNextDueAt(metadata: Record<string, any> | null, now: Date): Date | null {
  if (!metadata) return null;

  const explicitDays = Number(metadata.recurrenceDays ?? metadata.intervalDays ?? metadata.repeatEveryDays ?? 0);
  if (Number.isFinite(explicitDays) && explicitDays > 0) {
    return new Date(now.getTime() + explicitDays * 24 * 60 * 60 * 1000);
  }

  const recurrence = String(metadata.recurrence || metadata.repeat || '').toUpperCase();
  if (recurrence === 'DAILY') return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (recurrence === 'WEEKLY') return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (recurrence === 'MONTHLY') return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return null;
}

function mergeExecutionMetadata(
  previous: Record<string, any> | null,
  execution: Record<string, any>
): Record<string, any> {
  const prev = (previous && typeof previous === 'object') ? previous : {};
  const history = Array.isArray(prev.history) ? prev.history : [];
  const entry = {
    at: new Date().toISOString(),
    ...execution,
  };
  const newHistory = [...history, entry].slice(-10);

  return {
    ...prev,
    attempts: Number(prev.attempts || 0) + 1,
    lastRunAt: entry.at,
    output: execution,
    history: newHistory,
  };
}

async function fetchFollowUpContext(trigger: TriggerRow): Promise<null | {
  application_id: string;
  application_status: string;
  application_talent_id: string;
  opportunity_id: string;
  opportunity_title: string;
  opportunity_status: string;
  opportunity_start_date: string | null;
}> {
  const metadata = (trigger.metadata && typeof trigger.metadata === 'object') ? trigger.metadata : {};
  const applicationId = metadata.applicationId || metadata.application_id || null;
  const opportunityId = metadata.opportunityId || metadata.opportunity_id || null;

  if (applicationId) {
    const whereParts = ['oa.id = $1::uuid'];
    const params: any[] = [String(applicationId)];

    if (trigger.scope === 'TALENT' && trigger.talent_id) {
      whereParts.push(`oa.talent_id = $${params.length + 1}::uuid`);
      params.push(trigger.talent_id);
    } else if (trigger.scope === 'ORGANIZATION' && trigger.organization_id) {
      whereParts.push(`op.poster_organization_id = $${params.length + 1}::uuid`);
      params.push(trigger.organization_id);
    }

    const res = await pool.query(
      `
      SELECT
        oa.id AS application_id,
        oa.status AS application_status,
        oa.talent_id AS application_talent_id,
        o.id AS opportunity_id,
        o.title AS opportunity_title,
        o.status AS opportunity_status,
        o.start_date AS opportunity_start_date
      FROM opportunity_applications oa
      JOIN opportunities o ON o.id = oa.opportunity_id
      LEFT JOIN opportunity_posters op ON op.opportunity_id = o.id
      WHERE ${whereParts.join(' AND ')}
      LIMIT 1
      `,
      params
    );

    return res.rows[0] || null;
  }

  if (opportunityId) {
    const whereParts = ['oa.opportunity_id = $1::uuid'];
    const params: any[] = [String(opportunityId)];

    if (trigger.scope === 'TALENT' && trigger.talent_id) {
      whereParts.push(`oa.talent_id = $${params.length + 1}::uuid`);
      params.push(trigger.talent_id);
    } else if (trigger.scope === 'ORGANIZATION' && trigger.organization_id) {
      whereParts.push(`op.poster_organization_id = $${params.length + 1}::uuid`);
      params.push(trigger.organization_id);
    }

    const res = await pool.query(
      `
      SELECT
        oa.id AS application_id,
        oa.status AS application_status,
        oa.talent_id AS application_talent_id,
        o.id AS opportunity_id,
        o.title AS opportunity_title,
        o.status AS opportunity_status,
        o.start_date AS opportunity_start_date
      FROM opportunity_applications oa
      JOIN opportunities o ON o.id = oa.opportunity_id
      LEFT JOIN opportunity_posters op ON op.opportunity_id = o.id
      WHERE ${whereParts.join(' AND ')}
      ORDER BY oa.applied_at DESC
      LIMIT 1
      `,
      params
    );

    return res.rows[0] || null;
  }

  return null;
}

async function executeFollowUpPolicy(trigger: TriggerRow, now: Date): Promise<PolicyResult> {
  const context = await fetchFollowUpContext(trigger);
  if (!context) {
    return {
      outcome: 'MISSING_CONTEXT',
      note: 'No matching application/opportunity for FOLLOW_UP trigger.',
    };
  }

  if (TERMINAL_APPLICATION_STATUSES.has(String(context.application_status || '').toUpperCase())) {
    return {
      outcome: 'NOOP_TERMINAL_APPLICATION',
      note: `Application is already ${context.application_status}`,
      data: { applicationId: context.application_id, applicationStatus: context.application_status },
    };
  }

  if (context.opportunity_start_date) {
    const startDate = parseDateOnly(context.opportunity_start_date);

    // If start date is reached/past, a follow-up is no longer relevant.
    if (now >= startDate) {
      return {
        outcome: 'SKIPPED_START_DATE_REACHED',
        note: `Opportunity start_date ${context.opportunity_start_date} reached/past`,
        data: {
          applicationId: context.application_id,
          opportunityId: context.opportunity_id,
          startDate: context.opportunity_start_date,
        },
      };
    }

    // If due date is after start date, reschedule to day-before-start at 09:00 UTC.
    const triggerDueAt = new Date(trigger.due_at);
    if (!isNaN(triggerDueAt.getTime()) && triggerDueAt >= startDate) {
      const adjustedDueAt = dayBeforeStartAt0900Utc(context.opportunity_start_date);
      if (adjustedDueAt > now) {
        return {
          outcome: 'RESCHEDULED_BEFORE_START_DATE',
          note: 'Follow-up moved before opportunity start date.',
          nextDueAt: adjustedDueAt,
          data: {
            applicationId: context.application_id,
            opportunityId: context.opportunity_id,
            startDate: context.opportunity_start_date,
          },
        };
      }
    }
  }

  const targetTalentId = trigger.talent_id || context.application_talent_id;
  if (!targetTalentId) {
    return {
      outcome: 'NO_RECIPIENT',
      note: 'No target talent_id found to notify.',
      data: { applicationId: context.application_id, opportunityId: context.opportunity_id },
    };
  }

  await notificationService.create({
    talentId: targetTalentId,
    type: 'APPLICATION_REMINDER',
    title: 'Relance candidature',
    body: `Pense a relancer ta candidature pour "${context.opportunity_title}".`,
    data: {
      triggerId: trigger.id,
      applicationId: context.application_id,
      opportunityId: context.opportunity_id,
      opportunityTitle: context.opportunity_title,
      type: 'APPLICATION_REMINDER',
    },
    referenceType: 'agenda_trigger',
    referenceId: trigger.id,
  });

  return {
    outcome: 'FOLLOW_UP_SENT',
    data: {
      applicationId: context.application_id,
      opportunityId: context.opportunity_id,
    },
  };
}

async function executeTriggerPolicy(trigger: TriggerRow, now: Date): Promise<PolicyResult> {
  const code = String(trigger.code || '').toUpperCase().trim();

  if (code === 'FOLLOW_UP') {
    return executeFollowUpPolicy(trigger, now);
  }

  if (trigger.talent_id) {
    await notificationService.create({
      talentId: trigger.talent_id,
      type: 'REMINDER',
      title: trigger.title,
      body: trigger.description || 'Rappel agenda execute.',
      data: {
        triggerId: trigger.id,
        code: trigger.code,
        type: 'AGENDA_TRIGGER',
      },
      referenceType: 'agenda_trigger',
      referenceId: trigger.id,
    });
    return { outcome: 'REMINDER_SENT' };
  }

  return {
    outcome: 'NO_POLICY_ACTION',
    note: `No explicit action policy for code ${trigger.code}`,
  };
}

async function updateTriggerAfterRun(
  trigger: TriggerRow,
  now: Date,
  execution: PolicyResult,
  fallbackRescheduleOnError: boolean
): Promise<'done' | 'rescheduled'> {
  const previousMetadata = (trigger.metadata && typeof trigger.metadata === 'object') ? trigger.metadata : {};
  const mergedMetadata = mergeExecutionMetadata(previousMetadata, execution);

  const policyNextDue = execution.nextDueAt && !isNaN(execution.nextDueAt.getTime()) ? execution.nextDueAt : null;
  const recurringNextDue = computeRecurringNextDueAt(previousMetadata, now);

  let nextDueAt = policyNextDue || recurringNextDue || null;
  if (!nextDueAt && fallbackRescheduleOnError) {
    nextDueAt = new Date(now.getTime() + 15 * 60 * 1000);
  }

  const status: TriggerStatus = nextDueAt ? 'PENDING' : 'DONE';

  await pool.query(
    `
    UPDATE agenda_triggers
    SET
      status = $2::text,
      due_at = COALESCE($3::timestamptz, due_at),
      metadata = $4::jsonb,
      completed_at = CASE
        WHEN $2::text = 'DONE' THEN CURRENT_TIMESTAMP
        ELSE NULL
      END
    WHERE id = $1::uuid
    `,
    [trigger.id, status, nextDueAt ? toIso(nextDueAt) : null, JSON.stringify(mergedMetadata)]
  );

  return status === 'DONE' ? 'done' : 'rescheduled';
}

export async function processDueAgendaTriggers(limit: number = 100): Promise<{
  processed: number;
  done: number;
  rescheduled: number;
  failed: number;
  skipped: boolean;
}> {
  if (isAgendaCronRunning) {
    return { processed: 0, done: 0, rescheduled: 0, failed: 0, skipped: true };
  }

  isAgendaCronRunning = true;

  const stats = {
    processed: 0,
    done: 0,
    rescheduled: 0,
    failed: 0,
    skipped: false,
  };

  try {
    const due = await pool.query(
      `
      SELECT id, scope, talent_id, organization_id, code, title, description, due_at, status, priority, metadata, created_by
      FROM agenda_triggers
      WHERE status = 'PENDING'
        AND due_at <= NOW()
      ORDER BY due_at ASC
      LIMIT $1
      `,
      [limit]
    );

    for (const trigger of due.rows as TriggerRow[]) {
      stats.processed += 1;
      const now = new Date();

      try {
        const execution = await executeTriggerPolicy(trigger, now);
        const finalState = await updateTriggerAfterRun(trigger, now, execution, false);
        if (finalState === 'done') stats.done += 1;
        else stats.rescheduled += 1;
      } catch (err: any) {
        stats.failed += 1;
        logger.error('[agenda_trigger_cron] Trigger execution failed', {
          triggerId: trigger.id,
          code: trigger.code,
          error: err?.message || String(err),
        });

        try {
          const execution: PolicyResult = {
            outcome: 'ERROR',
            note: err?.message || 'Unknown error',
          };
          const finalState = await updateTriggerAfterRun(trigger, now, execution, true);
          if (finalState === 'done') stats.done += 1;
          else stats.rescheduled += 1;
        } catch (updateErr: any) {
          logger.error('[agenda_trigger_cron] Failed to update trigger after error', {
            triggerId: trigger.id,
            error: updateErr?.message || String(updateErr),
          });
        }
      }
    }

    return stats;
  } finally {
    isAgendaCronRunning = false;
  }
}

