export type ActivityType = 'POST' | 'EVENT' | 'POLL';
export type ModerationStatus = 'APPROVED' | 'FLAGGED' | 'PENDING' | 'REJECTED';

export interface PollOption {
    id: string;
    activity_id: string;
    text: string;
    votes_count: number;
    is_voted_by_user?: boolean;
}

export interface ActivityMetadata {
    // Common
    title?: string;

    // Event
    start_date?: string;
    end_date?: string;
    location_type?: 'ONLINE' | 'IN_PERSON';
    location?: string;
    meeting_url?: string;

    // Poll
    multiple_choice?: boolean;
    poll_end_date?: string;
    show_results?: boolean;
    options?: string[]; // For creation
    poll_options?: PollOption[]; // From API
}

export interface ActivityAuthor {
    id: string;
    display_name: string;
    avatar_url: string;
    headline?: string;
}

export interface CommunityActivity {
    id: string;
    community_id: string;
    author_id: string;
    type: ActivityType;
    content: string;
    metadata: ActivityMetadata;
    attachments: string[];
    is_pinned: boolean;
    moderation_status: ModerationStatus;
    likes_count: number;
    comments_count: number;
    bookmarks_count: number;
    created_at: string;
    updated_at: string;
    scheduled_at?: string;
    published_at?: string;

    author?: ActivityAuthor;
    is_liked?: boolean;
    user_vote_id?: string | null;
    is_bookmarked?: boolean;
    poll_options?: PollOption[]; // For polls - returned directly from API
}

export interface ActivityComment {
    id: string;
    activity_id: string;
    author_id: string;
    content: string;
    parent_id?: string;
    moderation_status: ModerationStatus;
    likes_count: number;
    replies_count: number;
    mentions?: string[];
    edited_at?: string;
    created_at: string;
    updated_at: string;

    author?: ActivityAuthor;
    replies?: ActivityComment[];
    is_liked?: boolean;

    // For optimistic UI updates
    _optimistic?: boolean;
}

export interface CreateActivityData {
    community_id: string;
    type: ActivityType;
    content: string;
    metadata?: ActivityMetadata;
    attachments?: any[]; // Files
    scheduled_at?: string; // ISO date string for scheduled posts
    is_draft?: boolean; // Save as draft without publishing
}
