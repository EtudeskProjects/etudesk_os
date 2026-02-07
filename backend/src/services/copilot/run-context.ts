/**
 * Copilot Run Context
 * Typed context passed to the agent run for state tracking.
 */

export interface CopilotRunContext {
  talentId: string;
  mode: 'explore' | 'study' | 'org';
  sessionId: string;
  language: 'fr' | 'en';

  // Mutable state tracked during the run
  skillsAdded: string[];
  actionsPerformed: string[];

  // Optional: active skill for progressive disclosure
  activeSkill?: string;
}

export function createCopilotRunContext(params: {
  talentId: string;
  mode: 'explore' | 'study' | 'org';
  sessionId: string;
  language?: 'fr' | 'en';
}): CopilotRunContext {
  return {
    talentId: params.talentId,
    mode: params.mode,
    sessionId: params.sessionId,
    language: params.language || 'fr',
    skillsAdded: [],
    actionsPerformed: [],
  };
}
