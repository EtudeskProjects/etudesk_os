/**
 * Talent Graph Ontology - Main Export
 */

// Schema exports
export {
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
  type GraphNode,
  ProficiencyLevels,
  type ProficiencyLevel,
  MasteryLevelRanges,
  getMasteryLabel,
  GRAPH_CONSTRAINTS,
  GRAPH_INDEXES,
} from './schema';

// Relationship exports
export {
  RelationshipTypes,
  type RelationshipType,
  type PossedeCompetenceProps,
  type TravailleChez_Props,
  type ATravailleChezProps,
  type AEtudieAProps,
  type APostuleAProps,
  type AMisEnFavorisProps,
  type EstMembreDeProps,
  type AReserveProps,
  type PossedeDocumentProps,
  type EtudieSujetProps,
  type AEvenementProps,
  type ConnecteAvecProps,
  type RecommandeParProps,
  type InteresseParProps,
  type DevraitApprendreProps,
  type SimilaireAProps,
  type PublieParProps,
  type AppartientAProps,
  type PrerequisPourProps,
  type ComplementaireAProps,
  type HebergeProps,
  type DansSecteurProps,
  type RelationshipProps,
  RelationshipDirections,
} from './relationships';

// Explanation exports
export {
  NodeExplanations,
  RelationshipExplanations,
  type RelationshipExplanation,
  explainRelationship,
  generateRelationshipContext,
  getRelationshipsFrom,
  formatRelationshipType,
} from './explanations';
