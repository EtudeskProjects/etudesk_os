/**
 * Skill Library Types
 * Defines skill definition structure for progressive disclosure.
 */

export interface SkillDefinition {
  /** Unique skill identifier (matches filename without .skill.md) */
  id: string;
  /** Human-readable skill name */
  name: string;
  /** Short description for the agent to decide when to activate */
  description: string;
  /** Which modes this skill is available in */
  modes: Array<'explore' | 'study' | 'org'>;
  /** Tools required for this skill */
  tools: string[];
  /** User intent triggers (keywords/phrases the agent should match) */
  triggers: string[];
  /** Full instructions body (loaded on demand) */
  instructions: string;
}

/** Lightweight metadata injected into all prompts (~100 tokens total) */
export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  modes: string[];
}
