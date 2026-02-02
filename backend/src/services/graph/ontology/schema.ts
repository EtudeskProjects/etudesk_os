/**
 * Talent Graph Ontology - Schema Definitions
 *
 * Defines all node labels and their properties for the Neo4j graph
 */

// ═══════════════════════════════════════════════════════════════
// NODE LABELS
// ═══════════════════════════════════════════════════════════════

export const NodeLabels = {
  TALENT: 'Talent',
  SKILL: 'Skill',
  ORGANIZATION: 'Organization',
  OPPORTUNITY: 'Opportunity',
  COMMUNITY: 'Community',
  SPACE: 'Space',
  LEARNING_TOPIC: 'LearningTopic',
  DOCUMENT: 'Document',
  EVENT: 'Event',
  SECTOR: 'Sector',
} as const;

export type NodeLabel = (typeof NodeLabels)[keyof typeof NodeLabels];

// ═══════════════════════════════════════════════════════════════
// NODE PROPERTY TYPES
// ═══════════════════════════════════════════════════════════════

export interface TalentNode {
  id: string;
  name: string;
  email: string;
  headline?: string;
  city?: string;
  country?: string;
  goals?: string[];
  availability_status?: string;
  created_at: string;
  updated_at: string;
}

export interface SkillNode {
  id: string;
  canonical_name: string;
  type: 'technical' | 'soft' | 'language' | 'tool' | 'domain';
}

export interface OrganizationNode {
  id: string;
  name: string;
  type: 'company' | 'startup' | 'ngo' | 'government' | 'educational' | 'other';
  sectors?: string[];
  size?: 'micro' | 'small' | 'medium' | 'large' | 'enterprise';
  city?: string;
  country?: string;
}

export interface OpportunityNode {
  id: string;
  title: string;
  type: 'job' | 'internship' | 'freelance' | 'volunteer' | 'project';
  contract_type?: string;
  status: 'draft' | 'published' | 'closed' | 'archived';
  deadline?: string;
  salary_min?: number;
  salary_max?: number;
  location_type?: 'remote' | 'onsite' | 'hybrid';
  city?: string;
  country?: string;
}

export interface CommunityNode {
  id: string;
  name: string;
  type: 'professional' | 'learning' | 'networking' | 'mentorship' | 'other';
  sectors?: string[];
  is_paid: boolean;
  member_count?: number;
}

export interface SpaceNode {
  id: string;
  name: string;
  type: 'coworking' | 'meeting_room' | 'event_space' | 'private_office' | 'virtual';
  capacity?: number;
  hourly_rate?: number;
  daily_rate?: number;
  city?: string;
  country?: string;
}

export interface LearningTopicNode {
  id: string;
  name: string;
  slug: string;
  mastery_level: number; // 0-100
  first_studied_at?: string;
  last_studied_at?: string;
  total_study_time_minutes?: number;
}

export interface DocumentNode {
  id: string;
  type: string;
  filename: string;
  title?: string;
  extracted_skills?: string[];
  uploaded_at: string;
  is_verified: boolean;
}

export interface EventNode {
  id: string;
  type: 'interview' | 'meeting' | 'deadline' | 'reminder' | 'session';
  title: string;
  scheduled_at: string;
  status: 'pending' | 'completed' | 'cancelled';
}

export interface SectorNode {
  id: string;
  name: string;
  slug?: string;
}

// Union type for all nodes
export type GraphNode =
  | TalentNode
  | SkillNode
  | OrganizationNode
  | OpportunityNode
  | CommunityNode
  | SpaceNode
  | LearningTopicNode
  | DocumentNode
  | EventNode
  | SectorNode;

// ═══════════════════════════════════════════════════════════════
// PROFICIENCY LEVELS
// ═══════════════════════════════════════════════════════════════

export const ProficiencyLevels = {
  DEBUTANT: 'debutant',
  INTERMEDIAIRE: 'intermediaire',
  AVANCE: 'avance',
  EXPERT: 'expert',
} as const;

export type ProficiencyLevel = (typeof ProficiencyLevels)[keyof typeof ProficiencyLevels];

// ═══════════════════════════════════════════════════════════════
// MASTERY LEVELS FOR LEARNING
// ═══════════════════════════════════════════════════════════════

export const MasteryLevelRanges = {
  NOVICE: { min: 0, max: 20, label: 'Novice' },
  DEBUTANT: { min: 21, max: 40, label: 'Débutant' },
  INTERMEDIAIRE: { min: 41, max: 60, label: 'Intermédiaire' },
  AVANCE: { min: 61, max: 80, label: 'Avancé' },
  EXPERT: { min: 81, max: 100, label: 'Expert' },
} as const;

export function getMasteryLabel(level: number): string {
  if (level <= 20) return MasteryLevelRanges.NOVICE.label;
  if (level <= 40) return MasteryLevelRanges.DEBUTANT.label;
  if (level <= 60) return MasteryLevelRanges.INTERMEDIAIRE.label;
  if (level <= 80) return MasteryLevelRanges.AVANCE.label;
  return MasteryLevelRanges.EXPERT.label;
}

// ═══════════════════════════════════════════════════════════════
// CYPHER CONSTRAINTS & INDEXES (to run on startup)
// ═══════════════════════════════════════════════════════════════

export const GRAPH_CONSTRAINTS = [
  // Unique constraints
  'CREATE CONSTRAINT talent_id IF NOT EXISTS FOR (t:Talent) REQUIRE t.id IS UNIQUE',
  'CREATE CONSTRAINT skill_name IF NOT EXISTS FOR (s:Skill) REQUIRE s.canonical_name IS UNIQUE',
  'CREATE CONSTRAINT org_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE',
  'CREATE CONSTRAINT opp_id IF NOT EXISTS FOR (o:Opportunity) REQUIRE o.id IS UNIQUE',
  'CREATE CONSTRAINT community_id IF NOT EXISTS FOR (c:Community) REQUIRE c.id IS UNIQUE',
  'CREATE CONSTRAINT space_id IF NOT EXISTS FOR (s:Space) REQUIRE s.id IS UNIQUE',
  'CREATE CONSTRAINT topic_id IF NOT EXISTS FOR (t:LearningTopic) REQUIRE t.id IS UNIQUE',
  'CREATE CONSTRAINT doc_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE',
  'CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE',
  'CREATE CONSTRAINT sector_name IF NOT EXISTS FOR (s:Sector) REQUIRE s.name IS UNIQUE',
];

export const GRAPH_INDEXES = [
  // Search indexes
  'CREATE INDEX talent_email IF NOT EXISTS FOR (t:Talent) ON (t.email)',
  'CREATE INDEX talent_city IF NOT EXISTS FOR (t:Talent) ON (t.city)',
  'CREATE INDEX skill_type IF NOT EXISTS FOR (s:Skill) ON (s.type)',
  'CREATE INDEX org_types IF NOT EXISTS FOR (o:Organization) ON (o.types)',
  'CREATE INDEX opp_status IF NOT EXISTS FOR (o:Opportunity) ON (o.status)',
  'CREATE INDEX opp_type IF NOT EXISTS FOR (o:Opportunity) ON (o.type)',
  'CREATE INDEX community_type IF NOT EXISTS FOR (c:Community) ON (c.type)',
  'CREATE INDEX space_type IF NOT EXISTS FOR (s:Space) ON (s.type)',
  'CREATE INDEX topic_mastery IF NOT EXISTS FOR (t:LearningTopic) ON (t.mastery_level)',
  'CREATE INDEX doc_type IF NOT EXISTS FOR (d:Document) ON (d.type)',

  // Full-text search indexes
  'CREATE FULLTEXT INDEX talent_search IF NOT EXISTS FOR (t:Talent) ON EACH [t.name, t.headline]',
  'CREATE FULLTEXT INDEX skill_search IF NOT EXISTS FOR (s:Skill) ON EACH [s.canonical_name]',
  'CREATE FULLTEXT INDEX org_search IF NOT EXISTS FOR (o:Organization) ON EACH [o.name]',
  'CREATE FULLTEXT INDEX opp_search IF NOT EXISTS FOR (o:Opportunity) ON EACH [o.title]',
  'CREATE FULLTEXT INDEX sector_search IF NOT EXISTS FOR (s:Sector) ON EACH [s.name]',
];
