/**
 * Activity Tools for Copilot
 * Tools for managing community activities (posts, comments, reactions)
 */

import { z } from 'zod';
import { pool } from '../../database';

// ═══════════════════════════════════════════════════════════════
// LIST COMMUNITY ACTIVITIES
// ═══════════════════════════════════════════════════════════════

export const listActivitiesSchema = z.object({
  communityId: z.string().uuid().describe('ID de la communauté'),
  type: z.enum(['POST', 'POLL', 'EVENT', 'ANNOUNCEMENT']).optional(),
  pinned: z.boolean().optional().describe('Afficher uniquement les épinglées'),
  limit: z.number().min(1).max(20).default(10),
  offset: z.number().min(0).default(0),
});

export async function listActivities(
  params: z.infer<typeof listActivitiesSchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { communityId, type, pinned, limit, offset } = params;

  // Verify membership
  const member = await pool.query(
    `SELECT id FROM community_members WHERE community_id = $1 AND talent_id = $2 AND status = 'ACTIVE'`,
    [communityId, talentId]
  );

  if (member.rows.length === 0) throw new Error("Vous n'êtes pas membre de cette communauté");

  let sql = `
    SELECT ca.id, ca.type, ca.title, ca.content, ca.is_pinned, ca.created_at,
           ca.media_urls, ca.poll_options, ca.event_date, ca.event_location,
           t.display_name as author_name, t.avatar_url as author_avatar,
           (SELECT COUNT(*) FROM activity_reactions ar WHERE ar.activity_id = ca.id) as reaction_count,
           (SELECT COUNT(*) FROM activity_comments ac WHERE ac.activity_id = ca.id AND ac.deleted_at IS NULL) as comment_count
    FROM community_activities ca
    JOIN talents t ON ca.author_id = t.id
    WHERE ca.community_id = $1 AND ca.deleted_at IS NULL AND ca.status = 'PUBLISHED'
  `;
  const queryParams: any[] = [communityId];
  let paramIndex = 2;

  if (type) {
    sql += ` AND ca.type = $${paramIndex}`;
    queryParams.push(type);
    paramIndex++;
  }

  if (pinned !== undefined) {
    sql += ` AND ca.is_pinned = $${paramIndex}`;
    queryParams.push(pinned);
    paramIndex++;
  }

  sql += ` ORDER BY ca.is_pinned DESC, ca.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  queryParams.push(limit, offset);

  const result = await pool.query(sql, queryParams);

  return {
    type: 'activity_list',
    activities: result.rows.map((r) => ({
      id: r.id,
      activityType: r.type,
      title: r.title,
      content: r.content?.slice(0, 300),
      isPinned: r.is_pinned,
      authorName: r.author_name,
      authorAvatar: r.author_avatar,
      reactionCount: parseInt(r.reaction_count) || 0,
      commentCount: parseInt(r.comment_count) || 0,
      mediaUrls: r.media_urls,
      eventDate: r.event_date?.toISOString(),
      eventLocation: r.event_location,
      createdAt: r.created_at?.toISOString(),
    })),
    totalCount: result.rows.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// CREATE ACTIVITY
// ═══════════════════════════════════════════════════════════════

export const createActivitySchema = z.object({
  communityId: z.string().uuid().describe('ID de la communauté'),
  type: z.enum(['POST', 'POLL', 'EVENT', 'ANNOUNCEMENT']).default('POST'),
  title: z.string().max(200).optional().describe('Titre (obligatoire pour EVENT/ANNOUNCEMENT)'),
  content: z.string().max(5000).describe('Contenu de la publication'),
  pollOptions: z.array(z.string()).max(6).optional().describe('Options du sondage (pour POLL)'),
  eventDate: z.string().optional().describe("Date de l'événement (ISO 8601, pour EVENT)"),
  eventLocation: z.string().max(200).optional().describe("Lieu de l'événement (pour EVENT)"),
});

export async function createActivity(
  params: z.infer<typeof createActivitySchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { communityId, type, title, content, pollOptions, eventDate, eventLocation } = params;

  // Verify membership
  const member = await pool.query(
    `SELECT id, role FROM community_members WHERE community_id = $1 AND talent_id = $2 AND status = 'ACTIVE'`,
    [communityId, talentId]
  );

  if (member.rows.length === 0) throw new Error("Vous n'êtes pas membre de cette communauté");

  // ANNOUNCEMENT requires admin role
  if (type === 'ANNOUNCEMENT' && !['ADMIN', 'MODERATOR'].includes(member.rows[0].role)) {
    throw new Error('Seuls les administrateurs peuvent créer des annonces');
  }

  const result = await pool.query(
    `INSERT INTO community_activities
     (community_id, author_id, type, title, content, poll_options, event_date, event_location, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PUBLISHED')
     RETURNING id`,
    [
      communityId,
      talentId,
      type,
      title || null,
      content,
      pollOptions ? JSON.stringify(pollOptions) : null,
      eventDate || null,
      eventLocation || null,
    ]
  );

  return {
    type: 'confirmation',
    title: 'Publication créée',
    message: `Votre ${type === 'POST' ? 'publication' : type === 'POLL' ? 'sondage' : type === 'EVENT' ? 'événement' : 'annonce'} a été créé(e) avec succès.`,
    actionParams: { activityId: result.rows[0].id },
  };
}

// ═══════════════════════════════════════════════════════════════
// EDIT ACTIVITY
// ═══════════════════════════════════════════════════════════════

export const editActivitySchema = z.object({
  activityId: z.string().uuid(),
  title: z.string().max(200).optional(),
  content: z.string().max(5000).optional(),
});

export async function editActivity(
  params: z.infer<typeof editActivitySchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { activityId, title, content } = params;

  const result = await pool.query(
    `UPDATE community_activities SET
     title = COALESCE($1, title),
     content = COALESCE($2, content),
     updated_at = NOW()
     WHERE id = $3 AND author_id = $4 AND deleted_at IS NULL
     RETURNING id`,
    [title || null, content || null, activityId, talentId]
  );

  if (result.rows.length === 0) throw new Error('Publication non trouvée ou vous ne pouvez pas la modifier');

  return {
    type: 'confirmation',
    title: 'Publication modifiée',
    message: 'La publication a été mise à jour avec succès.',
  };
}

// ═══════════════════════════════════════════════════════════════
// PIN/UNPIN ACTIVITY (Admin)
// ═══════════════════════════════════════════════════════════════

export const pinActivitySchema = z.object({
  activityId: z.string().uuid(),
  pin: z.boolean().describe('true pour épingler, false pour désépingler'),
});

export async function pinActivity(
  params: z.infer<typeof pinActivitySchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { activityId, pin } = params;

  // Check admin of the community
  const check = await pool.query(
    `SELECT ca.id, c.name as community_name
     FROM community_activities ca
     JOIN communities c ON ca.community_id = c.id
     JOIN organizations org ON c.organization_id = org.id
     JOIN organization_members om ON org.id = om.organization_id
     WHERE ca.id = $1 AND om.talent_id = $2 AND om.status = 'ACTIVE'
     AND om.role IN ('ADMIN', 'OWNER')`,
    [activityId, talentId]
  );

  if (check.rows.length === 0) throw new Error('Permission refusée');

  await pool.query(
    `UPDATE community_activities SET is_pinned = $1, updated_at = NOW() WHERE id = $2`,
    [pin, activityId]
  );

  return {
    type: 'confirmation',
    title: pin ? 'Publication épinglée' : 'Publication désépinglée',
    message: `La publication a été ${pin ? 'épinglée' : 'désépinglée'} avec succès.`,
  };
}

// ═══════════════════════════════════════════════════════════════
// COMMENT ON ACTIVITY
// ═══════════════════════════════════════════════════════════════

export const commentOnActivitySchema = z.object({
  activityId: z.string().uuid(),
  content: z.string().max(2000).describe('Contenu du commentaire'),
  parentCommentId: z.string().uuid().optional().describe('ID du commentaire parent (pour répondre)'),
});

export async function commentOnActivity(
  params: z.infer<typeof commentOnActivitySchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { activityId, content, parentCommentId } = params;

  // Verify user is member of the activity's community
  const check = await pool.query(
    `SELECT ca.community_id FROM community_activities ca
     JOIN community_members cm ON ca.community_id = cm.community_id
     WHERE ca.id = $1 AND cm.talent_id = $2 AND cm.status = 'ACTIVE'`,
    [activityId, talentId]
  );

  if (check.rows.length === 0) throw new Error("Vous n'avez pas accès à cette publication");

  await pool.query(
    `INSERT INTO activity_comments (activity_id, author_id, content, parent_comment_id)
     VALUES ($1, $2, $3, $4)`,
    [activityId, talentId, content, parentCommentId || null]
  );

  return {
    type: 'confirmation',
    title: 'Commentaire ajouté',
    message: 'Votre commentaire a été publié avec succès.',
  };
}

// ═══════════════════════════════════════════════════════════════
// REACT TO ACTIVITY
// ═══════════════════════════════════════════════════════════════

export const reactToActivitySchema = z.object({
  activityId: z.string().uuid(),
  reactionType: z.enum(['LIKE', 'LOVE', 'APPLAUSE', 'INSIGHTFUL', 'CURIOUS']).default('LIKE'),
});

export async function reactToActivity(
  params: z.infer<typeof reactToActivitySchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { activityId, reactionType } = params;

  await pool.query(
    `INSERT INTO activity_reactions (activity_id, talent_id, reaction_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (activity_id, talent_id) DO UPDATE SET reaction_type = $3, updated_at = NOW()`,
    [activityId, talentId, reactionType]
  );

  return {
    type: 'confirmation',
    title: 'Réaction ajoutée',
    message: `Réaction "${reactionType}" ajoutée.`,
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const activityToolDefinitions = {
  list_activities: {
    name: 'list_activities',
    description:
      "Liste les publications d'une communauté. Affiche le fil d'activité avec posts, sondages et événements.",
    parameters: listActivitiesSchema,
    execute: listActivities,
  },
  create_activity: {
    name: 'create_activity',
    description:
      "Crée une publication dans une communauté (post, sondage, événement ou annonce). Demande confirmation et le contenu à l'utilisateur.",
    parameters: createActivitySchema,
    execute: createActivity,
  },
  edit_activity: {
    name: 'edit_activity',
    description:
      "Modifie une publication existante. Seul l'auteur peut modifier sa publication.",
    parameters: editActivitySchema,
    execute: editActivity,
  },
  pin_activity: {
    name: 'pin_activity',
    description:
      "Épingle ou désépingle une publication dans une communauté. Réservé aux admins.",
    parameters: pinActivitySchema,
    execute: pinActivity,
  },
  comment_on_activity: {
    name: 'comment_on_activity',
    description:
      "Ajoute un commentaire sur une publication. Peut aussi répondre à un commentaire existant.",
    parameters: commentOnActivitySchema,
    execute: commentOnActivity,
  },
  react_to_activity: {
    name: 'react_to_activity',
    description:
      "Ajoute une réaction à une publication (like, love, applause, insightful, curious).",
    parameters: reactToActivitySchema,
    execute: reactToActivity,
  },
};
