/**
 * Copilot Run Context
 * Typed context passed to the agent run for state tracking.
 */

import { SupportedLanguage } from '../../i18n';

export interface CopilotRunContext {
  talentId: string;
  mode: 'explore' | 'study' | 'org';
  sessionId: string;
  language: SupportedLanguage;

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
  language?: SupportedLanguage;
}): CopilotRunContext {
  return {
    talentId: params.talentId,
    mode: params.mode,
    sessionId: params.sessionId,
    language: params.language || 'en',
    skillsAdded: [],
    actionsPerformed: [],
  };
}
