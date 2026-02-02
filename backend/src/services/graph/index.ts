/**
 * Talent Graph Service - Main Exports
 *
 * Neo4j-based graph database for talent relationship management
 */

// Client
export { neo4jClient, type Neo4jConfig, type QueryOptions } from './neo4j.client';

// Main service
export { graphService, type GraphStats, type EgoNetworkResult } from './graph.service';

// Ontology
export {
  // Schema
  NodeLabels,
  type NodeLabel,
  type TalentNode,
  type SkillNode,
  type OrganizationNode,
  type OpportunityNode,
  type CommunityNode,
  type SpaceNode,
  type LearningTopicNode,
  type DocumentNode,
  type EventNode,
  type SectorNode,
  ProficiencyLevels,
  type ProficiencyLevel,
  getMasteryLabel,
  GRAPH_CONSTRAINTS,
  GRAPH_INDEXES,
  // Relationships
  RelationshipTypes,
  type RelationshipType,
  RelationshipDirections,
  // Explanations
  NodeExplanations,
  RelationshipExplanations,
  explainRelationship,
  generateRelationshipContext,
  getRelationshipsFrom,
  formatRelationshipType,
} from './ontology';

// Queries
export {
  talentQueries,
  type TalentGraphSummary,
  type SkillWithContext,
  opportunityQueries,
  type OpportunityMatch,
  type SkillGap,
  learningQueries,
  type LearningProgress,
  type LearningPath,
  type SkillRecommendation,
} from './queries';

// Mutations
export {
  nodeMutations,
  relationshipMutations,
  inferenceMutations,
  type InferenceResult,
} from './mutations';

// Sync
export { postgresSyncService, type SyncResult, type SyncOptions } from './sync';
