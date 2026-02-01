/**
 * Skill Service
 * API calls for talent skills management
 */

import { api } from './api';

export interface TalentSkill {
  id: string;
  skill_id: string;
  proficiency_level: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT' | 'MASTER';
  self_assessed: boolean;
  endorsed_count: number;
  years_of_experience: number | null;
  last_used_at: string | null;
  context: string | null;
  origin: 'declared' | 'inferred' | 'extracted';
  canonical_name: string;
  slug: string;
  type: 'KNOWLEDGE' | 'SOFT_SKILL' | 'HARD_SKILL';
  domain: string | null;
  aliases: string[] | null;
}

export interface SkillSearchResult {
  id: string;
  canonical_name: string;
  slug: string;
  type: string;
  domain: string | null;
  aliases: string[] | null;
}

export const PROFICIENCY_LABELS: Record<string, string> = {
  BEGINNER: 'Débutant',
  INTERMEDIATE: 'Intermédiaire',
  EXPERT: 'Expert',
  MASTER: 'Maître',
};

export const SKILL_TYPE_LABELS: Record<string, string> = {
  KNOWLEDGE: 'Savoir',
  HARD_SKILL: 'Savoir-faire',
  SOFT_SKILL: 'Savoir-être',
};

export const PROFICIENCY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'EXPERT', 'MASTER'] as const;

const skillService = {
  async getMySkills(): Promise<TalentSkill[]> {
    const response = await api.get<TalentSkill[]>('/api/skills/my');
    return response.data;
  },

  async searchSkills(query: string): Promise<SkillSearchResult[]> {
    const response = await api.get<SkillSearchResult[]>(`/api/skills/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  async addSkill(input: {
    skillId?: string;
    skillName?: string;
    proficiencyLevel: string;
    type?: string;
  }): Promise<{ id: string }> {
    const response = await api.post<{ id: string }>('/api/skills/my', input);
    return response.data;
  },

  async updateSkill(id: string, proficiencyLevel: string): Promise<void> {
    await api.put('/skills/my/' + id, { proficiencyLevel });
  },

  async deleteSkill(id: string): Promise<void> {
    await api.delete('/skills/my/' + id);
  },
};

export default skillService;
