import { pool } from './database';
import { CommunityRole } from '../types/community-activity.types';

// Permission types
export interface MemberPermissions {
    can_post: boolean;
    can_create_event: boolean;
    can_create_poll: boolean;
}

export const DEFAULT_MEMBER_PERMISSIONS: MemberPermissions = {
    can_post: true,
    can_create_event: false,
    can_create_poll: false,
};

export const ADMIN_PERMISSIONS: MemberPermissions = {
    can_post: true,
    can_create_event: true,
    can_create_poll: true,
};

export class CommunityPermissionService {
    /**
     * Get the role of a user in a community.
     *
     * SIMPLIFIED LOGIC:
     * - ADMIN = User is member of the organization that owns the community
     *           OR user created the community
     * - MEMBER = All other users who are members of the community
     */
    async getUserRole(userId: string, communityId: string): Promise<CommunityRole | null> {
        // 1. Check if user is the creator OR member of the owning organization
        const communityQuery = `
            SELECT c.created_by, c.organization_id,
                   EXISTS(SELECT 1 FROM organization_members om
                          WHERE om.organization_id = c.organization_id
                          AND om.talent_id = $1) as is_org_member
            FROM communities c
            WHERE c.id = $2
        `;

        const communityResult = await pool.query(communityQuery, [userId, communityId]);

        if (communityResult.rows.length === 0) return null; // Community not found

        const community = communityResult.rows[0];

        // If user created the community, they are ADMIN
        if (community.created_by === userId) return 'ADMIN';

        // If user is ANY member of the organization, they are ADMIN
        if (community.organization_id && community.is_org_member) {
            return 'ADMIN';
        }

        // 2. Check if user is a community member (they would be MEMBER role)
        const memberQuery = `
            SELECT 1 FROM community_members
            WHERE talent_id = $1 AND community_id = $2 AND status = 'ACTIVE'
        `;

        const memberResult = await pool.query(memberQuery, [userId, communityId]);

        if (memberResult.rows.length > 0) {
            return 'MEMBER';
        }

        return null; // Not a member
    }

    /**
     * Get member permissions for a specific user in a community
     * Returns individual permissions if set, otherwise community defaults, or system defaults
     */
    async getMemberPermissions(userId: string, communityId: string): Promise<MemberPermissions> {
        const role = await this.getUserRole(userId, communityId);

        // If not a member, no permissions
        if (!role) {
            return { can_post: false, can_create_event: false, can_create_poll: false };
        }

        // ADMIN always has full permissions
        if (role === 'ADMIN') {
            return ADMIN_PERMISSIONS;
        }

        // For MEMBER, check individual permissions first, then community defaults
        const query = `
            SELECT
                cm.permissions as member_permissions,
                c.default_member_permissions as community_defaults
            FROM community_members cm
            JOIN communities c ON cm.community_id = c.id
            WHERE cm.talent_id = $1 AND cm.community_id = $2 AND cm.status = 'ACTIVE'
        `;

        const result = await pool.query(query, [userId, communityId]);

        if (result.rows.length === 0) {
            return DEFAULT_MEMBER_PERMISSIONS;
        }

        const row = result.rows[0];

        // Use individual permissions if set, otherwise community defaults, otherwise system defaults
        if (row.member_permissions) {
            return {
                can_post: row.member_permissions.can_post ?? DEFAULT_MEMBER_PERMISSIONS.can_post,
                can_create_event: row.member_permissions.can_create_event ?? DEFAULT_MEMBER_PERMISSIONS.can_create_event,
                can_create_poll: row.member_permissions.can_create_poll ?? DEFAULT_MEMBER_PERMISSIONS.can_create_poll,
            };
        }

        if (row.community_defaults) {
            return {
                can_post: row.community_defaults.can_post ?? DEFAULT_MEMBER_PERMISSIONS.can_post,
                can_create_event: row.community_defaults.can_create_event ?? DEFAULT_MEMBER_PERMISSIONS.can_create_event,
                can_create_poll: row.community_defaults.can_create_poll ?? DEFAULT_MEMBER_PERMISSIONS.can_create_poll,
            };
        }

        return DEFAULT_MEMBER_PERMISSIONS;
    }

    /**
     * Get permissions for a membership by membership ID (for admin management)
     */
    async getMembershipPermissions(membershipId: string): Promise<{
        permissions: MemberPermissions;
        isCustom: boolean;
        communityDefaults: MemberPermissions;
        role: 'ADMIN' | 'MEMBER';
    }> {
        const query = `
            SELECT
                cm.permissions as member_permissions,
                cm.talent_id,
                cm.community_id,
                c.default_member_permissions as community_defaults,
                c.created_by,
                c.organization_id,
                EXISTS(SELECT 1 FROM organization_members om
                       WHERE om.organization_id = c.organization_id
                       AND om.talent_id = cm.talent_id) as is_org_member
            FROM community_members cm
            JOIN communities c ON cm.community_id = c.id
            WHERE cm.id = $1
        `;

        const result = await pool.query(query, [membershipId]);

        if (result.rows.length === 0) {
            throw new Error('Membership not found');
        }

        const row = result.rows[0];

        // Determine if user is admin
        const isAdmin = row.created_by === row.talent_id || row.is_org_member;

        const communityDefaults: MemberPermissions = row.community_defaults || DEFAULT_MEMBER_PERMISSIONS;

        if (isAdmin) {
            return {
                permissions: ADMIN_PERMISSIONS,
                isCustom: false,
                communityDefaults,
                role: 'ADMIN',
            };
        }

        const isCustom = row.member_permissions !== null;
        const permissions: MemberPermissions = isCustom
            ? {
                can_post: row.member_permissions.can_post ?? communityDefaults.can_post,
                can_create_event: row.member_permissions.can_create_event ?? communityDefaults.can_create_event,
                can_create_poll: row.member_permissions.can_create_poll ?? communityDefaults.can_create_poll,
            }
            : communityDefaults;

        return {
            permissions,
            isCustom,
            communityDefaults,
            role: 'MEMBER',
        };
    }

    /**
     * Update individual member permissions
     */
    async updateMemberPermissions(membershipId: string, permissions: Partial<MemberPermissions> | null): Promise<MemberPermissions> {
        // If null, reset to community defaults
        if (permissions === null) {
            await pool.query(
                'UPDATE community_members SET permissions = NULL, updated_at = NOW() WHERE id = $1',
                [membershipId]
            );

            // Get community defaults
            const result = await pool.query(`
                SELECT c.default_member_permissions
                FROM community_members cm
                JOIN communities c ON cm.community_id = c.id
                WHERE cm.id = $1
            `, [membershipId]);

            return result.rows[0]?.default_member_permissions || DEFAULT_MEMBER_PERMISSIONS;
        }

        // Update with specific permissions
        const newPermissions: MemberPermissions = {
            can_post: permissions.can_post ?? DEFAULT_MEMBER_PERMISSIONS.can_post,
            can_create_event: permissions.can_create_event ?? DEFAULT_MEMBER_PERMISSIONS.can_create_event,
            can_create_poll: permissions.can_create_poll ?? DEFAULT_MEMBER_PERMISSIONS.can_create_poll,
        };

        await pool.query(
            'UPDATE community_members SET permissions = $1, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(newPermissions), membershipId]
        );

        return newPermissions;
    }

    /**
     * Update community default permissions
     */
    async updateCommunityDefaultPermissions(communityId: string, permissions: Partial<MemberPermissions>): Promise<MemberPermissions> {
        const newDefaults: MemberPermissions = {
            can_post: permissions.can_post ?? DEFAULT_MEMBER_PERMISSIONS.can_post,
            can_create_event: permissions.can_create_event ?? DEFAULT_MEMBER_PERMISSIONS.can_create_event,
            can_create_poll: permissions.can_create_poll ?? DEFAULT_MEMBER_PERMISSIONS.can_create_poll,
        };

        await pool.query(
            'UPDATE communities SET default_member_permissions = $1, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(newDefaults), communityId]
        );

        return newDefaults;
    }

    /**
     * Get community default permissions
     */
    async getCommunityDefaultPermissions(communityId: string): Promise<MemberPermissions> {
        const result = await pool.query(
            'SELECT default_member_permissions FROM communities WHERE id = $1',
            [communityId]
        );

        if (result.rows.length === 0) {
            throw new Error('Community not found');
        }

        return result.rows[0].default_member_permissions || DEFAULT_MEMBER_PERMISSIONS;
    }

    /**
     * Check if user has permission to perform an action.
     *
     * SIMPLIFIED:
     * - ADMIN: Can do everything
     * - MEMBER: Based on their permissions
     */
    async canPerformAction(userId: string, communityId: string, action: 'POST' | 'EVENT' | 'POLL' | 'COMMENT' | 'MODERATE' | 'PIN' | 'DELETE_ANY'): Promise<boolean> {
        const role = await this.getUserRole(userId, communityId);

        if (!role) return false;

        // ADMIN can do everything
        if (role === 'ADMIN') return true;

        // For moderation actions, only ADMIN can do
        if (['MODERATE', 'PIN', 'DELETE_ANY'].includes(action)) {
            return false;
        }

        // COMMENT is always allowed for members
        if (action === 'COMMENT') return true;

        // For content creation, check permissions
        const permissions = await this.getMemberPermissions(userId, communityId);

        switch (action) {
            case 'POST':
                return permissions.can_post;
            case 'EVENT':
                return permissions.can_create_event;
            case 'POLL':
                return permissions.can_create_poll;
            default:
                return false;
        }
    }

    /**
     * Check if user is an admin of the community
     */
    async isAdmin(userId: string, communityId: string): Promise<boolean> {
        const role = await this.getUserRole(userId, communityId);
        return role === 'ADMIN';
    }
}

export const communityPermissionService = new CommunityPermissionService();
