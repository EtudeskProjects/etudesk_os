/**
 * TalentObject — Reusable context object for all AI services
 *
 * Single optimized query that builds a complete talent snapshot.
 * Used by: bio-gen, embedding, KYC, document extraction, recommendations, copilot…
 */

import { pool } from '../database';

// ═══════════════════════════════════════════════════════════════
// TYPE
// ═══════════════════════════════════════════════════════════════

export interface TalentObject {
  id: string;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  gender: string | null;
  bio: string | null;
  profile_tags: string[];
  sectors: string[];
  goals: string[];
  city: string | null;
  region: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  remote_ready: boolean;
  willing_to_relocate: boolean;
  skills: string[];
  documents_metadata: DocumentMeta[];
}

export interface DocumentMeta {
  id: string;
  file_name: string;
  document_type: string | null;
  extracted_title: string | null;
  uploaded_at: string;
}

// ═══════════════════════════════════════════════════════════════
// BUILDER
// ═══════════════════════════════════════════════════════════════

/**
 * Build a complete TalentObject from the database.
 * Returns null if talent not found.
 */
export async function buildTalentObject(talentId: string): Promise<TalentObject | null> {
  const result = await pool.query(
    `SELECT
       t.id,
       t.avatar_url,
       t.first_name,
       t.last_name,
       t.display_name,
       t.gender,
       t.bio,
       t.profile_tags,
       t.sectors,
       t.goals,
       t.city,
       t.region,
       t.country,
       t.phone,
       u.email,
       t.remote_ready,
       t.willing_to_relocate,
       COALESCE(
         ARRAY(
           SELECT s.canonical_name
           FROM talent_skills ts
           JOIN skills s ON s.id = ts.skill_id
           WHERE ts.talent_id = t.id
           ORDER BY ts.endorsement_count DESC NULLS LAST
           LIMIT 20
         ),
         '{}'
       ) AS skills,
       COALESCE(
         (SELECT json_agg(json_build_object(
           'id', d.id,
           'file_name', d.file_name,
           'document_type', d.document_type,
           'extracted_title', d.extracted_title,
           'uploaded_at', d.uploaded_at
         ) ORDER BY d.uploaded_at DESC)
         FROM documents d
         WHERE d.talent_id = t.id AND d.deleted_at IS NULL),
         '[]'
       ) AS documents_metadata
     FROM talents t
     JOIN users u ON u.id = t.user_id
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [talentId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  return {
    id: row.id,
    avatar_url: row.avatar_url || null,
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    display_name: row.display_name,
    gender: row.gender || null,
    bio: row.bio || null,
    profile_tags: row.profile_tags || [],
    sectors: row.sectors || [],
    goals: row.goals || [],
    city: row.city || null,
    region: row.region || null,
    country: row.country || null,
    phone: row.phone || null,
    email: row.email || null,
    remote_ready: !!row.remote_ready,
    willing_to_relocate: !!row.willing_to_relocate,
    skills: row.skills || [],
    documents_metadata: row.documents_metadata || [],
  };
}

// ═══════════════════════════════════════════════════════════════
// SERIALIZERS — Convert TalentObject to text for AI prompts
// ═══════════════════════════════════════════════════════════════

/**
 * Full text summary for AI agent context injection.
 * Skips null/empty fields automatically.
 */
export function talentObjectToText(t: TalentObject): string {
  const lines: string[] = [];

  lines.push(`Nom: ${t.display_name}`);
  if (t.first_name || t.last_name) {
    lines.push(`Identité: ${[t.first_name, t.last_name].filter(Boolean).join(' ')}`);
  }
  if (t.gender) lines.push(`Genre: ${t.gender}`);
  if (t.bio) lines.push(`Bio: ${t.bio}`);
  if (t.profile_tags.length) lines.push(`Profil: ${t.profile_tags.join(', ')}`);
  if (t.sectors.length) lines.push(`Secteurs: ${t.sectors.join(', ')}`);
  if (t.goals.length) lines.push(`Objectifs: ${t.goals.join(', ')}`);

  const location = [t.city, t.region, t.country].filter(Boolean).join(', ');
  if (location) lines.push(`Localisation: ${location}`);

  if (t.phone) lines.push(`Tél: ${t.phone}`);
  if (t.email) lines.push(`Email: ${t.email}`);
  if (t.remote_ready) lines.push('Disponible en remote');
  if (t.willing_to_relocate) lines.push('Prêt à se relocaliser');
  if (t.skills.length) lines.push(`Compétences: ${t.skills.join(', ')}`);
  if (t.documents_metadata.length) {
    lines.push(`Documents (${t.documents_metadata.length}): ${t.documents_metadata.map(d => d.extracted_title || d.file_name).join(', ')}`);
  }

  return lines.join('\n');
}
