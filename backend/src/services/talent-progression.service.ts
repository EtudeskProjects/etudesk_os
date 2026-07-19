import { pool } from './database';

export type ProgressionFocus = 'passport' | 'evidence' | 'community' | 'application_feedback' | 'practice';

export interface TalentProgressionSnapshot {
  direction: string;
  status: 'EXPLORING' | 'ACTIVE' | 'REORIENTING' | 'PAUSED';
  priorityCompetencies: string[];
  currentFocus: { type: ProgressionFocus; reason: string; nextEvidence?: string };
  summary: {
    skillsCount: number;
    acceptedApplications: number;
    rejectedApplications: number;
    activeApplications: number;
    communitiesCount: number;
    completedBookings: number;
    evidenceDocuments: number;
  };
  lastSignalAt?: string;
}

type Signal = { sourceType: string; sourceId: string; signalType: string; occurredAt: string; payload: Record<string, unknown> };

function inferDirection(sectors: string[], goals: string[], stored?: string): string {
  if (stored && stored !== 'digital_skills') return stored;
  if (sectors.includes('DIGITAL')) return 'digital_skills';
  if (goals.includes('FIND_JOB') || goals.includes('ADVANCE_CAREER')) return 'professional_insertion';
  return 'digital_skills';
}

function selectFocus(summary: TalentProgressionSnapshot['summary'], priorities: string[]): TalentProgressionSnapshot['currentFocus'] {
  if (summary.skillsCount === 0) return { type: 'passport', reason: 'Le passeport ne contient pas encore de compétence numérique vérifiable.', nextEvidence: 'Déclarer ou faire évaluer une compétence numérique réelle.' };
  if (summary.evidenceDocuments === 0) return { type: 'evidence', reason: 'Aucune preuve réutilisable n’est encore reliée au passeport.', nextEvidence: 'Produire une preuve courte liée à une compétence prioritaire.' };
  if (summary.rejectedApplications > 0 && summary.acceptedApplications === 0) return { type: 'application_feedback', reason: 'Les candidatures récentes n’ont pas encore abouti.', nextEvidence: 'Renforcer une preuve ou préparer une réponse d’entretien ciblée.' };
  if (summary.communitiesCount === 0) return { type: 'community', reason: 'Aucun contexte de pairs n’est encore actif.', nextEvidence: 'Rejoindre une communauté utile à la direction actuelle.' };
  return { type: 'practice', reason: priorities.length ? `Consolider ${priorities[0]}.` : 'Consolider une compétence numérique avec une preuve concrète.', nextEvidence: 'Réaliser une activité courte et conservable dans le passeport.' };
}

function toIso(value: unknown): string {
  return new Date(value as string | Date).toISOString();
}

async function upsertSignals(talentId: string, signals: Signal[]): Promise<void> {
  await Promise.all(signals.map((signal) => pool.query(
    `INSERT INTO talent_progression_signals (talent_id, source_type, source_id, signal_type, occurred_at, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (talent_id, source_type, source_id, signal_type)
     DO UPDATE SET occurred_at = EXCLUDED.occurred_at, payload = EXCLUDED.payload`,
    [talentId, signal.sourceType, signal.sourceId, signal.signalType, signal.occurredAt, JSON.stringify(signal.payload)]
  )));
}

/**
 * Refreshes one compact, durable progression snapshot from existing primitives.
 * It never upgrades a skill: the digital passport remains the sole source of
 * truth for competency level, provenance and evidence.
 */
export async function refreshTalentProgression(talentId: string): Promise<TalentProgressionSnapshot> {
  const [profileResult, skillsResult, applicationsResult, membershipsResult, bookingsResult, documentsResult, eventsResult, storedResult] = await Promise.all([
    pool.query(`SELECT goals, sectors FROM talents WHERE id = $1`, [talentId]),
    pool.query(`SELECT ts.competency_slug, ts.level, ts.score, ts.updated_at, c.name_fr, c.name
                FROM talent_skills ts JOIN competencies c ON c.slug = ts.competency_slug
                WHERE ts.talent_id = $1 AND ts.decay_state = 'active'
                ORDER BY ts.score ASC NULLS FIRST, ts.updated_at ASC NULLS FIRST LIMIT 12`, [talentId]),
    pool.query(`SELECT id, status, updated_at FROM opportunity_applications WHERE talent_id = $1 AND deleted_at IS NULL`, [talentId]),
    pool.query(`SELECT id, community_id, joined_at, status FROM community_members WHERE talent_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`, [talentId]),
    pool.query(`SELECT id, status, updated_at FROM space_bookings WHERE talent_id = $1`, [talentId]),
    pool.query(`SELECT id, created_at FROM talent_documents WHERE talent_id = $1 AND deleted_at IS NULL AND status IN ('PROCESSED', 'VERIFIED')`, [talentId]),
    pool.query(`SELECT id, name, occurred_at, properties FROM product_events
                WHERE talent_id = $1 AND occurred_at > NOW() - INTERVAL '90 days'
                  AND (name ILIKE '%space%' OR name ILIKE '%community%' OR name ILIKE '%opportunit%')
                ORDER BY occurred_at DESC LIMIT 30`, [talentId]),
    pool.query(`SELECT direction, status FROM talent_progressions WHERE talent_id = $1`, [talentId]),
  ]);

  const profile = profileResult.rows[0] || {};
  const applications = applicationsResult.rows;
  const memberships = membershipsResult.rows;
  const bookings = bookingsResult.rows;
  const documents = documentsResult.rows;
  const events = eventsResult.rows;
  const skills = skillsResult.rows;
  const stored = storedResult.rows[0];
  const summary = {
    skillsCount: skills.length,
    acceptedApplications: applications.filter((row) => row.status === 'ACCEPTED').length,
    rejectedApplications: applications.filter((row) => row.status === 'REJECTED').length,
    activeApplications: applications.filter((row) => !['ACCEPTED', 'REJECTED', 'WITHDRAWN'].includes(row.status)).length,
    communitiesCount: memberships.length,
    completedBookings: bookings.filter((row) => row.status === 'COMPLETED').length,
    evidenceDocuments: documents.length,
  };
  const priorityCompetencies = skills.slice(0, 3).map((row) => row.competency_slug);
  const currentFocus = selectFocus(summary, priorityCompetencies);
  const direction = inferDirection(profile.sectors || [], profile.goals || [], stored?.direction);
  const signals: Signal[] = [
    ...applications.map((row) => ({ sourceType: 'application', sourceId: row.id, signalType: `application_${String(row.status).toLowerCase()}`, occurredAt: toIso(row.updated_at), payload: { status: row.status } })),
    ...memberships.map((row) => ({ sourceType: 'community', sourceId: row.id, signalType: 'community_joined', occurredAt: toIso(row.joined_at), payload: { communityId: row.community_id } })),
    ...bookings.map((row) => ({ sourceType: 'space_booking', sourceId: row.id, signalType: `booking_${String(row.status).toLowerCase()}`, occurredAt: toIso(row.updated_at), payload: { status: row.status } })),
    ...documents.map((row) => ({ sourceType: 'document', sourceId: row.id, signalType: 'evidence_document', occurredAt: toIso(row.created_at), payload: {} })),
    ...events.map((row) => ({ sourceType: 'product_event', sourceId: row.id, signalType: row.name, occurredAt: toIso(row.occurred_at), payload: row.properties || {} })),
  ];
  await upsertSignals(talentId, signals);
  const lastSignalAt = signals.map((signal) => signal.occurredAt).sort().at(-1);
  const snapshot: TalentProgressionSnapshot = { direction, status: stored?.status || 'EXPLORING', priorityCompetencies, currentFocus, summary, lastSignalAt };
  await pool.query(
    `INSERT INTO talent_progressions (talent_id, direction, status, priority_competencies, current_focus, summary, last_signal_at, last_reviewed_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, NOW())
     ON CONFLICT (talent_id) DO UPDATE SET direction = EXCLUDED.direction, priority_competencies = EXCLUDED.priority_competencies,
       current_focus = EXCLUDED.current_focus, summary = EXCLUDED.summary, last_signal_at = EXCLUDED.last_signal_at,
       last_reviewed_at = EXCLUDED.last_reviewed_at, updated_at = NOW()`,
    [talentId, snapshot.direction, snapshot.status, snapshot.priorityCompetencies, JSON.stringify(snapshot.currentFocus), JSON.stringify(snapshot.summary), snapshot.lastSignalAt || null]
  );
  return snapshot;
}

export function progressionPromptBlock(progression: TalentProgressionSnapshot): string {
  return `<talent_progression>\nDirection: ${progression.direction}\nFocus: ${progression.currentFocus.type} - ${progression.currentFocus.reason}\nPriorités: ${progression.priorityCompetencies.join(', ') || 'à confirmer'}\nSignaux: ${progression.summary.activeApplications} candidatures actives, ${progression.summary.rejectedApplications} refus, ${progression.summary.communitiesCount} communautés, ${progression.summary.completedBookings} visites/réservations réalisées, ${progression.summary.evidenceDocuments} preuves documentaires.\n</talent_progression>`;
}
