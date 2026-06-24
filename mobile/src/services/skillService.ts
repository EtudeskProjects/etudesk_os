/**
 * Skill Service
 * API calls for talent skills management — catalog-constrained model.
 */

import { api } from './api';
import i18n from '../i18n';
import { CatalogType, Level } from '../constants/skills';

/** A talent's catalog-constrained competency (UserCompetency). */
export interface TalentSkill {
  id: string;
  competency_slug: string;
  name: string;
  name_fr?: string | null;
  family?: string | null;
  type: CatalogType;
  level: Level;
  score?: number;
  confidence?: number;
  origin: 'declared' | 'inferred' | 'extracted' | 'validated';
  decay_state?: 'active' | 'stale' | 'archived';
  context?: string[] | string | null;
  is_visible: boolean;
  created_at?: string | null;
}

/** A catalog competency returned by the search endpoint. */
export interface CatalogCompetency {
  slug: string;
  name: string;
  name_fr?: string | null;
  family: string;
  type: CatalogType;
}

/** A skill tag attached to an opportunity / community / space. */
export interface EntitySkillTag {
  slug: string;
  name: string;
  name_fr?: string | null;
  type: CatalogType;
  family?: string | null;
  requirement?: 'required' | 'nice_to_have'; // opportunities
  role?: 'validates' | 'topic' | 'equipment'; // communities / spaces
  min_level?: Level | null;
}

export interface DecayReport {
  active: number;
  stale: number;
  archived: number;
}

export const getProficiencyLabel = (key: string): string =>
  i18n.t(`labels.proficiencyLevels.${key}`);

export const getSkillTypeLabel = (key: string): string =>
  i18n.t(`labels.skillTypes.${key}`);

export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced', 'master'];

const skillService = {
  async getMySkills(): Promise<TalentSkill[]> {
    const response = await api.get<TalentSkill[]>('/api/skills/my');
    return response.data;
  },

  /** Search the referential catalog (autocomplete for the skill picker). */
  async searchCatalog(query: string): Promise<CatalogCompetency[]> {
    const response = await api.get<CatalogCompetency[]>(
      `/api/skills/catalog/search?q=${encodeURIComponent(query)}`
    );
    return response.data;
  },

  /**
   * Declare a catalog skill. `skillOrLabel` is a catalog slug or a label that the
   * backend resolves to one. On a non-catalog label the API returns 400 with
   * `suggestions` — surfaced to the caller via the thrown error payload.
   */
  async addSkill(input: {
    skillOrLabel: string;
    level: Level;
    context?: string;
    is_visible?: boolean;
  }): Promise<{ competency_slug: string; name: string; level: Level; confidence?: number }> {
    const response = await api.post<{ competency_slug: string; name: string; level: Level; confidence?: number }>(
      '/api/skills/my',
      input
    );
    return response.data;
  },

  async updateSkill(id: string, level: Level): Promise<void> {
    await api.put('/api/skills/my/' + id, { level });
  },

  async deleteSkill(id: string): Promise<void> {
    await api.delete('/api/skills/my/' + id);
  },

  async toggleVisibility(skillId: string, isVisible: boolean): Promise<void> {
    await api.patch('/api/skills/my/' + skillId + '/visibility', { is_visible: isVisible });
  },
};

export default skillService;
