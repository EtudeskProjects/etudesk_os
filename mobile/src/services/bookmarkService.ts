/**
 * Bookmark Service
 * Handles bookmark operations for opportunities, spaces, and communities
 */

import { api, ApiResponse } from './api';
import type { Opportunity, Community } from '../types/models';
import type { Space } from './spaceService';

export type EntityType = 'opportunities' | 'spaces' | 'communities';

export interface BookmarkedOpportunity extends Opportunity {
  bookmarked_at: string;
  notes?: string;
}

export interface BookmarkedSpace extends Space {
  bookmarked_at: string;
  notes?: string;
}

export interface BookmarkedCommunity extends Community {
  bookmarked_at: string;
  notes?: string;
}

export interface BookmarkIdsResponse {
  opportunities: string[];
  spaces: string[];
  communities: string[];
}

export interface BookmarkToggleResponse {
  success: boolean;
  isBookmarked: boolean;
  message?: string;
}

class BookmarkService {
  // ============================================================================
  // GET ALL BOOKMARK IDS (for quick state hydration)
  // ============================================================================

  /**
   * Get all bookmark IDs grouped by entity type
   * Used to hydrate the bookmark state on app load
   */
  async getAllBookmarkIds(): Promise<ApiResponse<BookmarkIdsResponse>> {
    return api.get<BookmarkIdsResponse>('/api/bookmarks/all/ids');
  }

  // ============================================================================
  // OPPORTUNITIES
  // ============================================================================

  /**
   * Get all bookmarked opportunities
   */
  async getOpportunities(params?: { limit?: number; offset?: number }): Promise<ApiResponse<BookmarkedOpportunity[]>> {
    return api.get<BookmarkedOpportunity[]>('/api/bookmarks/opportunities', params);
  }

  /**
   * Get opportunity bookmark IDs
   */
  async getOpportunityIds(): Promise<ApiResponse<string[]>> {
    return api.get<string[]>('/api/bookmarks/opportunities/ids');
  }

  /**
   * Check if an opportunity is bookmarked
   */
  async isOpportunityBookmarked(id: string): Promise<ApiResponse<{ isBookmarked: boolean }>> {
    return api.get<{ isBookmarked: boolean }>(`/api/bookmarks/opportunities/${id}/status`);
  }

  /**
   * Add an opportunity to bookmarks
   */
  async addOpportunity(id: string, notes?: string): Promise<ApiResponse<BookmarkToggleResponse>> {
    return api.post<BookmarkToggleResponse>(`/api/bookmarks/opportunities/${id}`, { notes });
  }

  /**
   * Remove an opportunity from bookmarks
   */
  async removeOpportunity(id: string): Promise<ApiResponse<BookmarkToggleResponse>> {
    return api.delete<BookmarkToggleResponse>(`/api/bookmarks/opportunities/${id}`);
  }

  /**
   * Toggle opportunity bookmark
   */
  async toggleOpportunity(id: string, isCurrentlyBookmarked: boolean): Promise<ApiResponse<BookmarkToggleResponse>> {
    if (isCurrentlyBookmarked) {
      return this.removeOpportunity(id);
    }
    return this.addOpportunity(id);
  }

  // ============================================================================
  // SPACES
  // ============================================================================

  /**
   * Get all bookmarked spaces
   */
  async getSpaces(params?: { limit?: number; offset?: number }): Promise<ApiResponse<BookmarkedSpace[]>> {
    return api.get<BookmarkedSpace[]>('/api/bookmarks/spaces', params);
  }

  /**
   * Get space bookmark IDs
   */
  async getSpaceIds(): Promise<ApiResponse<string[]>> {
    return api.get<string[]>('/api/bookmarks/spaces/ids');
  }

  /**
   * Add a space to bookmarks
   */
  async addSpace(id: string): Promise<ApiResponse<BookmarkToggleResponse>> {
    return api.post<BookmarkToggleResponse>(`/api/bookmarks/spaces/${id}`, {});
  }

  /**
   * Remove a space from bookmarks
   */
  async removeSpace(id: string): Promise<ApiResponse<BookmarkToggleResponse>> {
    return api.delete<BookmarkToggleResponse>(`/api/bookmarks/spaces/${id}`);
  }

  /**
   * Toggle space bookmark
   */
  async toggleSpace(id: string, isCurrentlyBookmarked: boolean): Promise<ApiResponse<BookmarkToggleResponse>> {
    if (isCurrentlyBookmarked) {
      return this.removeSpace(id);
    }
    return this.addSpace(id);
  }

  // ============================================================================
  // COMMUNITIES
  // ============================================================================

  /**
   * Get all bookmarked communities
   */
  async getCommunities(params?: { limit?: number; offset?: number }): Promise<ApiResponse<BookmarkedCommunity[]>> {
    return api.get<BookmarkedCommunity[]>('/api/bookmarks/communities', params);
  }

  /**
   * Get community bookmark IDs
   */
  async getCommunityIds(): Promise<ApiResponse<string[]>> {
    return api.get<string[]>('/api/bookmarks/communities/ids');
  }

  /**
   * Add a community to bookmarks
   */
  async addCommunity(id: string): Promise<ApiResponse<BookmarkToggleResponse>> {
    return api.post<BookmarkToggleResponse>(`/api/bookmarks/communities/${id}`, {});
  }

  /**
   * Remove a community from bookmarks
   */
  async removeCommunity(id: string): Promise<ApiResponse<BookmarkToggleResponse>> {
    return api.delete<BookmarkToggleResponse>(`/api/bookmarks/communities/${id}`);
  }

  /**
   * Toggle community bookmark
   */
  async toggleCommunity(id: string, isCurrentlyBookmarked: boolean): Promise<ApiResponse<BookmarkToggleResponse>> {
    if (isCurrentlyBookmarked) {
      return this.removeCommunity(id);
    }
    return this.addCommunity(id);
  }

  // ============================================================================
  // GENERIC METHODS
  // ============================================================================

  /**
   * Toggle bookmark for any entity type
   */
  async toggle(
    entityType: EntityType,
    id: string,
    isCurrentlyBookmarked: boolean
  ): Promise<ApiResponse<BookmarkToggleResponse>> {
    switch (entityType) {
      case 'opportunities':
        return this.toggleOpportunity(id, isCurrentlyBookmarked);
      case 'spaces':
        return this.toggleSpace(id, isCurrentlyBookmarked);
      case 'communities':
        return this.toggleCommunity(id, isCurrentlyBookmarked);
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Get bookmark IDs for a specific entity type
   */
  async getIds(entityType: EntityType): Promise<ApiResponse<string[]>> {
    switch (entityType) {
      case 'opportunities':
        return this.getOpportunityIds();
      case 'spaces':
        return this.getSpaceIds();
      case 'communities':
        return this.getCommunityIds();
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }
}

export const bookmarkService = new BookmarkService();
