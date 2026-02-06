/**
 * Daily Objective Service
 * Fetches personalized daily objectives for talents and organizations
 */

import { api, ApiResponse } from './api';

export interface DailyObjective {
  objective: string;
  generatedAt: string;
  expiresAt: string;
}

/**
 * Get daily objective for the authenticated talent
 */
async function getTalentObjective(): Promise<ApiResponse<DailyObjective>> {
  return api.get<DailyObjective>('/api/daily-objective/talent');
}

/**
 * Get daily objective for a specific organization
 */
async function getOrganizationObjective(orgId: string): Promise<ApiResponse<DailyObjective>> {
  return api.get<DailyObjective>(`/api/daily-objective/organization/${orgId}`);
}

export const dailyObjectiveService = {
  getTalentObjective,
  getOrganizationObjective,
};

export default dailyObjectiveService;
