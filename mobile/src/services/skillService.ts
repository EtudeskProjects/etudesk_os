/**
 * Skill Service
 * API calls for talent skills management
 */

import { api } from './api';

export interface TalentSkill {
  id: string;
  proficiency_level: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT' | 'MASTER';
  context: string | null;
  origin: 'declared' | 'inferred' | 'extracted';
  canonical_name: string;
  type: 'KNOWLEDGE' | 'SOFT_SKILL' | 'HARD_SKILL';
  created_at: string | null;
}

export interface MergeReport {
  merged: number;
  kept_declared: number;
  new_extracted: number;
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

  async addSkill(input: {
    skillName: string;
    proficiencyLevel: string;
    type: string;
    context?: string;
  }): Promise<{ id: string }> {
    const response = await api.post<{ id: string }>('/api/skills/my', input);
    return response.data;
  },

  async updateSkill(id: string, proficiencyLevel: string): Promise<void> {
    await api.put('/api/skills/my/' + id, { proficiencyLevel });
  },

  async deleteSkill(id: string): Promise<void> {
    await api.delete('/api/skills/my/' + id);
  },

  async mergeSkills(): Promise<MergeReport> {
    const response = await api.post<MergeReport>('/api/skills/my/merge');
    return response.data;
  },
};

export default skillService;
