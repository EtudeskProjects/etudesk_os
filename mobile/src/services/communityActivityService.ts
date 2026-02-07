import { api, ApiResponse } from './api';
import { CommunityActivity, CreateActivityData, ActivityComment } from '../types/activity';

// Longer timeout for file uploads (2 minutes)
const UPLOAD_TIMEOUT = 120000;

class CommunityActivityService {

  /**
   * Get community feed
   */
  async getFeed(
    communityId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<{ data: CommunityActivity[], nextCursor: string | null }> {
    const params: any = { limit };
    if (cursor) params.cursor = cursor;
    const response = await api.get<any>(`/api/${communityId}/activities`, params);
    return { data: response.data?.data ?? response.data ?? [], nextCursor: response.data?.nextCursor ?? null };
  }

  /**
   * Create an activity
   */
  async createActivity(communityId: string, data: CreateActivityData): Promise<ApiResponse<CommunityActivity>> {
    // Always use FormData for consistency (handles both with and without attachments)
    const formData = new FormData();
    formData.append('type', data.type);
    formData.append('content', data.content);

    if (data.metadata) {
      formData.append('metadata', JSON.stringify(data.metadata));
    }
    if (data.scheduled_at) {
      formData.append('scheduled_at', data.scheduled_at);
    }
    if (data.is_draft !== undefined) {
      formData.append('is_draft', String(data.is_draft));
    }

    // Handle attachments for React Native
    if (data.attachments && data.attachments.length > 0) {
      data.attachments.forEach((file: any, index: number) => {
        // React Native requires { uri, type, name } format for file uploads
        formData.append('attachments', {
          uri: file.uri,
          type: file.type || 'application/octet-stream',
          name: file.name || `file-${index}`,
        } as any);
      });
    }

    // Use longer timeout for file uploads
    return api.post(`/api/${communityId}/activities`, formData, { timeout: UPLOAD_TIMEOUT });
  }

  /**
   * Toggle Like
   */
  async toggleLike(activityId: string): Promise<ApiResponse<{ isLiked: boolean }>> {
    return api.post(`/api/activities/${activityId}/like`, {});
  }

  /**
   * Add Comment
   */
  async addComment(activityId: string, content: string, parentId?: string): Promise<ApiResponse<ActivityComment>> {
    return api.post(`/api/activities/${activityId}/comments`, { content, parentId });
  }

  /**
   * Vote on a poll
   */
  async vote(activityId: string, optionId: string): Promise<ApiResponse<void>> {
    return api.post(`/api/activities/${activityId}/vote`, { optionId });
  }

  /**
   * Toggle Bookmark
   */
  async toggleBookmark(activityId: string): Promise<ApiResponse<{ success: boolean; isBookmarked: boolean }>> {
    return api.post(`/api/activities/${activityId}/bookmark`, {});
  }

  /**
   * Check Bookmark Status
   */
  async getBookmarkStatus(activityId: string): Promise<ApiResponse<{ isBookmarked: boolean }>> {
    return api.get(`/api/activities/${activityId}/bookmark`);
  }

  /**
   * Get activity details with comments
   */
  async getActivityDetails(activityId: string): Promise<{ activity: CommunityActivity; comments: ActivityComment[] }> {
    const response = await api.get(`/api/activities/${activityId}`);
    return response as unknown as { activity: CommunityActivity; comments: ActivityComment[] };
  }

  /**
   * Delete activity
   */
  async deleteActivity(activityId: string): Promise<ApiResponse<void>> {
    return api.delete(`/api/activities/${activityId}`);
  }

  /**
   * Toggle Pin
   */
  async togglePin(activityId: string): Promise<ApiResponse<{ success: boolean; isPinned: boolean }>> {
    return api.post(`/api/activities/${activityId}/pin`, {});
  }

  /**
   * Get my bookmarked activities
   */
  async getMyBookmarks(): Promise<ApiResponse<any[]>> {
    return api.get('/api/activities/bookmarks');
  }

  /**
   * Update a comment
   */
  async updateComment(activityId: string, commentId: string, content: string, mentions?: string[]): Promise<ApiResponse<ActivityComment>> {
    return api.put(`/api/activities/${activityId}/comments/${commentId}`, { content, mentions });
  }

  /**
   * Delete a comment
   */
  async deleteComment(activityId: string, commentId: string): Promise<ApiResponse<{ success: boolean }>> {
    return api.delete(`/api/activities/${activityId}/comments/${commentId}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // DRAFTS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get user's drafts for a community
   */
  async getDrafts(communityId: string, type?: 'POST' | 'EVENT' | 'POLL'): Promise<ApiResponse<CommunityActivity[]>> {
    const params = type ? `?type=${type}` : '';
    return api.get(`/api/${communityId}/activities/drafts${params}`);
  }

  /**
   * Get a single draft by type (for pre-filling forms)
   */
  async getDraftByType(communityId: string, type: 'POST' | 'EVENT' | 'POLL'): Promise<ApiResponse<CommunityActivity | null>> {
    return api.get(`/api/${communityId}/activities/draft/${type}`);
  }

  /**
   * Publish a draft
   */
  async publishDraft(activityId: string): Promise<ApiResponse<CommunityActivity>> {
    return api.put(`/api/activities/${activityId}/publish`, {});
  }

  /**
   * Update a draft
   */
  async updateDraft(activityId: string, data: {
    content?: string;
    metadata?: Record<string, unknown>;
    attachments?: { uri: string; type: string; name: string }[];
    scheduled_at?: string;
  }): Promise<ApiResponse<CommunityActivity>> {
    return api.put(`/api/activities/${activityId}`, data);
  }

  /**
   * Update a published activity (for editing)
   * Uses FormData to support file uploads
   */
  async updateActivity(activityId: string, data: {
    content?: string;
    metadata?: Record<string, unknown>;
    attachments?: { uri: string; type: string; name: string }[];
  }): Promise<ApiResponse<CommunityActivity>> {
    const formData = new FormData();

    if (data.content !== undefined) {
      formData.append('content', data.content);
    }
    if (data.metadata) {
      formData.append('metadata', JSON.stringify(data.metadata));
    }

    // Handle attachments for React Native
    if (data.attachments && data.attachments.length > 0) {
      data.attachments.forEach((file: any, index: number) => {
        formData.append('attachments', {
          uri: file.uri,
          type: file.type || 'application/octet-stream',
          name: file.name || `file-${index}`,
        } as any);
      });
    }

    // Use longer timeout for file uploads
    return api.put(`/api/activities/${activityId}`, formData, { timeout: UPLOAD_TIMEOUT });
  }

  /**
   * Delete a draft
   */
  async deleteDraft(activityId: string): Promise<ApiResponse<{ success: boolean }>> {
    return api.delete(`/api/activities/${activityId}`);
  }
}

export const communityActivityService = new CommunityActivityService();
