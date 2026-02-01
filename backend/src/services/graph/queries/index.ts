/**
 * Graph Queries Module Exports
 */

export { talentQueries, type TalentGraphSummary, type SkillWithContext } from './talent.queries';

export {
  opportunityQueries,
  type OpportunityMatch,
  type SkillGap,
} from './opportunity.queries';

export {
  learningQueries,
  type LearningProgress,
  type LearningPath,
  type SkillRecommendation,
} from './learning.queries';
