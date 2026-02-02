import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, generateSlug } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import {
  generateCommunitySuggestion,
  canGenerate,
  GenerationInput,
} from '../services/community-generation.service';
import { autoModerationService } from '../services/auto-moderation.service';
import { communityPermissionService } from '../services/community-permission.service';
import { safeParseJson } from '../utils';

// Type for SQL query parameters
type QueryParam = string | number | boolean | null | Date;

const router = Router();

// ============================================================================
// AI GENERATION ROUTES
// ============================================================================

/**
 * POST /api/communities/generate - Generate community suggestions using AI
 * Requires: Auth + organization_id, name
 * Returns: Structured suggestions to prefill the form
 */
router.post('/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { name, organization_id, existing_data } = req.body;

    // Validate minimum required fields
    if (!canGenerate(name)) {
      return res.status(400).json({
        error: 'Name (min 3 chars) is required',
        canGenerate: false,
      });
    }

    if (!organization_id) {
      return res.status(400).json({
        error: 'organization_id is required',
        canGenerate: false,
      });
    }

    // Verify user is a member of the organization
    const memberCheck = await pool.query(
      `SELECT 1 FROM organization_members
       WHERE organization_id = $1 AND talent_id = $2`,
      [organization_id, talentId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'Vous n\'êtes pas membre de cette organisation',
      });
    }

    // Generate suggestions
    const input: GenerationInput = {
      name,
      organization_id,
      existing_data,
    };

    const result = await generateCommunitySuggestion(input);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Échec de la génération',
      });
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error generating community suggestions:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération des suggestions',
    });
  }
});

// GET /api/communities - List all communities (public only by default)
router.get('/', async (req: Request, res: Response) => {
  let query = '';
  let params: QueryParam[] = [];

  try {
    const { type, status, limit = 50, offset = 0, include_private = 'false' } = req.query;

    // First, check if visibility column exists
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'communities' AND column_name = 'visibility'
    `);
    const hasVisibilityColumn = columnCheck.rows.length > 0;

    // Check if community_members.status exists
    const memberStatusCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'community_members' AND column_name = 'status'
    `);
    const hasMemberStatus = memberStatusCheck.rows.length > 0;

    query = `
      SELECT c.*,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id${hasMemberStatus ? " AND (status IS NULL OR status = 'ACTIVE')" : ''}) as members_count,
        json_build_object(
          'id', o.id,
          'name', o.name,
          'slug', o.slug,
          'logo_url', o.logo_url,
          'verification_status', o.verification_status
        ) as organization
      FROM communities c
      LEFT JOIN organizations o ON c.organization_id = o.id
      WHERE c.deleted_at IS NULL
    `;
    params = [];
    let paramIndex = 1;

    // Filter out private communities unless explicitly requested
    // Private communities (visibility = 'PRIVATE') should not appear in explore
    // PUBLIC communities should always appear in explore
    if (include_private !== 'true') {
      if (hasVisibilityColumn) {
        query += ` AND c.visibility = 'PUBLIC'`;
      }
      // Public listing: always show only active communities
      query += ` AND c.status = 'ACTIVE'`;
    } else {
      // Private listing (for organization management)
      if (status) {
        query += ` AND c.status = $${paramIndex++}`;
        params.push(status as string);
      }
    }

    if (type) {
      query += ` AND c.type = $${paramIndex++}`;
      params.push(type as string);
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (error: any) {
    console.error('Error fetching communities:', error);
    console.error('Query:', query);
    console.error('Params:', params);

    // If error is about missing column, provide helpful message
    if (error?.message?.includes('access_type')) {
      res.status(500).json({
        error: 'Database schema mismatch',
        message: 'The access_type column is missing. Please run migration 011_add_access_type_to_communities.sql',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    } else {
      res.status(500).json({
        error: 'Failed to fetch communities',
        message: error?.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  }
});

// GET /api/communities/organization/:orgId - Get communities by organization
// NOTE: This must be defined BEFORE /:id to avoid route conflicts
router.get('/organization/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Get total count first
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM communities c
       WHERE c.organization_id = $1 AND c.deleted_at IS NULL`,
      [orgId]
    );
    const totalCount = parseInt(countResult.rows[0].total);

    const result = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as members_count
      FROM communities c
      WHERE c.organization_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `, [orgId, Number(limit), Number(offset)]);

    res.json({ data: result.rows, count: totalCount });
  } catch (error) {
    console.error('Error fetching organization communities:', error);
    res.status(500).json({ error: 'Failed to fetch communities' });
  }
});

// GET /api/communities/:id - Get single community with full details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const memberStatusCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'community_members' AND column_name = 'status'
    `);
    const hasMemberStatus = memberStatusCheck.rows.length > 0;

    const memberRoleCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'community_members' AND column_name = 'role'
    `);
    const hasMemberRole = memberRoleCheck.rows.length > 0;

    const activeMemberFilter = hasMemberStatus ? " AND cm.status = 'ACTIVE'" : '';
    const activeMemberFilterNoAlias = hasMemberStatus ? " AND status = 'ACTIVE'" : '';

    // Build moderators query based on available columns
    let moderatorsQuery = '';
    if (hasMemberRole) {
      moderatorsQuery = `
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', t.id, 'display_name', COALESCE(t.first_name || ' ' || t.last_name, t.email), 'avatar_url', t.avatar_url, 'role', cm.role
          ))
          FROM community_members cm
          JOIN talents t ON cm.talent_id = t.id
          WHERE cm.community_id = c.id AND cm.role = 'ADMIN'${activeMemberFilter}
          LIMIT 5),
          '[]'
        )`;
    } else {
      // Fallback: use membership_type if role doesn't exist
      moderatorsQuery = `
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', t.id, 'display_name', COALESCE(t.first_name || ' ' || t.last_name, t.email), 'avatar_url', t.avatar_url
          ))
          FROM community_members cm
          JOIN talents t ON cm.talent_id = t.id
          WHERE cm.community_id = c.id AND (cm.membership_type = 'STAFF' OR cm.membership_type = 'ADMIN')${activeMemberFilter}
          LIMIT 5),
          '[]'
        )`;
    }

    const result = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id${activeMemberFilterNoAlias}) as members_count,
        ${moderatorsQuery} as moderators,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', t.id,
              'display_name', COALESCE(t.first_name || ' ' || t.last_name, t.email),
              'avatar_url', t.avatar_url,
              'role', cm.role,
              'city', t.city,
              'country', t.country,
              'bio', LEFT(t.bio, 100),
              'joined_at', cm.joined_at
            ) ORDER BY
              CASE WHEN cm.role = 'ADMIN' THEN 0 ELSE 1 END,
              cm.joined_at DESC
          )
          FROM community_members cm
          JOIN talents t ON cm.talent_id = t.id
          WHERE cm.community_id = c.id${activeMemberFilter}
          LIMIT 20),
          '[]'
        ) as members_preview,
        CASE WHEN o.id IS NOT NULL THEN
          json_build_object(
            'id', o.id,
            'name', o.name,
            'slug', o.slug,
            'logo_url', o.logo_url,
            'types', o.types,
            'description', o.description,
            'headquarters_city', o.headquarters_city,
            'headquarters_country', o.headquarters_country,
            'verification_status', o.verification_status
          )
        ELSE NULL END as organization
      FROM communities c
      LEFT JOIN organizations o ON c.organization_id = o.id
      WHERE c.id = $1 AND c.deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error fetching community:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
      position: error?.position,
    });
    res.status(500).json({
      error: 'Failed to fetch community',
      message: error?.message || 'Unknown error',
      detail: process.env.NODE_ENV === 'development' ? error?.detail : undefined
    });
  }
});

// POST /api/communities/:id/views - Increment view count
router.post('/:id/views', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE communities
       SET views_count = COALESCE(views_count, 0) + 1, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, views_count`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    res.json({ data: { views_count: result.rows[0].views_count } });
  } catch (error) {
    console.error('Error incrementing community views:', error);
    res.status(500).json({ error: 'Failed to increment views' });
  }
});

// POST /api/communities - Create community (requires authentication)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  let insertColumns: string[] = [];
  let insertValues: string[] = [];
  let params: any[] = [];

  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const {
      name,
      type,
      description,
      rules,
      application_questions,
      tags,
      sectors,
      visibility,
      is_paid,
      monthly_price,
      currency,
      city,
      region,
      country,
      coordinates,
      cover_image_url,
      images,
      status = 'INACTIVE',
      organization_id,
      default_member_permissions,
      // Legacy fields for backward compatibility
      access_type,
    } = req.body;

    // Log pour debug des images
    console.log('[Communities POST] Received images data:', {
      cover_image_url,
      images,
      imagesType: typeof images,
      imagesIsArray: Array.isArray(images),
    });

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Validate tags: max 3 tags
    if (tags && Array.isArray(tags) && tags.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 tags allowed' });
    }

    // Content moderation for user-generated text fields
    try {
      await autoModerationService.assertContentApproved({
        name,
        description,
        rules,
      });
    } catch (moderationError: any) {
      console.log(`[Moderation] Community creation rejected: ${moderationError.message}`);
      return res.status(400).json({ 
        error: moderationError.message,
        code: 'CONTENT_MODERATION_FAILED',
        field: moderationError.flaggedField,
      });
    }

    const id = uuidv4();
    const slug = generateSlug(name) + '-' + id.slice(0, 8);

    // Use access_type column for visibility (backward compatibility)
    const visibilityToStore = visibility || access_type;

    // Check which columns exist in the database
    const columnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'communities' 
      AND column_name = 'access_type'
    `);
    const existingColumns = columnsCheck.rows.map((row: any) => row.column_name);
    const hasAccessType = existingColumns.includes('access_type');

    // Build dynamic INSERT query based on available columns
    // Store tags as JSON in a text field or use a tags column if it exists
    insertColumns = ['id', 'name', 'slug', 'type', 'description', 'rules', 'application_questions'];
    insertValues = ['$1', '$2', '$3', '$4', '$5', '$6', '$7'];
    let paramIndex = 8;
    // application_questions is stored as TEXT[] in the DB
    params = [id, name, slug, type, description, rules, Array.isArray(application_questions) ? application_questions : null];

    // Check which additional columns exist (single query for efficiency)
    // Note: logo_url is NOT used for communities (only organizations have logos)
    // cover_image_url is used as the hero image (like opportunities)
    const additionalColumnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'communities' 
      AND column_name IN ('tags', 'sectors', 'images', 'is_paid', 'monthly_price', 'currency', 'cover_image_url')
    `);
    const existingAdditionalColumns = additionalColumnsCheck.rows.map((row: any) => row.column_name);
    const hasTags = existingAdditionalColumns.includes('tags');
    const hasSectors = existingAdditionalColumns.includes('sectors');
    const hasImages = existingAdditionalColumns.includes('images');
    const hasIsPaid = existingAdditionalColumns.includes('is_paid');
    const hasMonthlyPrice = existingAdditionalColumns.includes('monthly_price');
    const hasCurrency = existingAdditionalColumns.includes('currency');
    const hasCoverImageUrl = existingAdditionalColumns.includes('cover_image_url');

    if (hasTags && tags) {
      insertColumns.push('tags');
      insertValues.push(`$${paramIndex++}`);
      // tags is JSONB, pass as JSON string
      params.push(JSON.stringify(tags));
    }

    if (hasSectors && sectors) {
      insertColumns.push('sectors');
      insertValues.push(`$${paramIndex++}`);
      // sectors is JSONB, pass as JSON string
      params.push(JSON.stringify(sectors));
    }

    insertColumns.push('city', 'region', 'country', 'coordinates');
    insertValues.push(`$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`);
    params.push(city, region, country, coordinates ? `(${coordinates.lat}, ${coordinates.lng})` : null);

    // Add cover_image_url if column exists (hero image, like opportunities)
    // Note: logo_url is NOT used for communities - organizations have logos, not communities
    if (hasCoverImageUrl) {
      insertColumns.push('cover_image_url');
      insertValues.push(`$${paramIndex++}`);
      params.push(cover_image_url);
    }

    console.log('[Communities POST] Image column check:', { hasImages, hasCoverImageUrl, imagesValue: images, coverImageUrlValue: cover_image_url });

    if (hasImages && images) {
      insertColumns.push('images');
      insertValues.push(`$${paramIndex++}`);
      // images is already a TEXT[] array, pass it directly
      const imagesToInsert = Array.isArray(images) ? images : [images];
      params.push(imagesToInsert);
      console.log('[Communities POST] Inserting images:', imagesToInsert);
    } else {
      console.log('[Communities POST] Images NOT inserted - hasImages:', hasImages, 'images:', images);
    }

    if (hasIsPaid) {
      insertColumns.push('is_paid');
      insertValues.push(`$${paramIndex++}`);
      params.push(is_paid || false);
    }

    if (hasMonthlyPrice) {
      insertColumns.push('monthly_price');
      insertValues.push(`$${paramIndex++}`);
      params.push(monthly_price ? parseFloat(monthly_price.toString()) : null);
    }

    if (hasCurrency) {
      insertColumns.push('currency');
      insertValues.push(`$${paramIndex++}`);
      params.push(currency || 'XOF');
    }

    if (hasAccessType) {
      insertColumns.push('access_type');
      insertValues.push(`$${paramIndex++}`);
      params.push(visibilityToStore);
    }

    // Add default member permissions if provided
    if (default_member_permissions) {
      insertColumns.push('default_member_permissions');
      insertValues.push(`$${paramIndex++}`);
      params.push(JSON.stringify(default_member_permissions));
    }

    insertColumns.push('status', 'organization_id', 'created_by', 'created_at', 'updated_at');
    insertValues.push(`$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, 'NOW()', 'NOW()');
    params.push(status, organization_id, talentId);

    const result = await pool.query(`
      INSERT INTO communities (${insertColumns.join(', ')})
      VALUES (${insertValues.join(', ')})
      RETURNING *
    `, params);

    // Add creator as admin member
    // Check if id and status columns exist in community_members
    const memberColumnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'community_members' 
      AND column_name IN ('id', 'status')
    `);
    const existingMemberColumns = memberColumnsCheck.rows.map((row: any) => row.column_name);
    const hasMemberId = existingMemberColumns.includes('id');
    const hasMemberStatus = existingMemberColumns.includes('status');

    if (hasMemberId) {
      const memberId = uuidv4();
      await pool.query(`
        INSERT INTO community_members (id, community_id, talent_id, membership_type, role, joined_at${hasMemberStatus ? ', status' : ''})
        VALUES ($1, $2, $3, 'STAFF', 'ADMIN', NOW()${hasMemberStatus ? ", 'ACTIVE'" : ''})
      `, [memberId, id, talentId]);
    } else {
      await pool.query(`
        INSERT INTO community_members (community_id, talent_id, membership_type, role, joined_at${hasMemberStatus ? ', status' : ''})
        VALUES ($1, $2, 'STAFF', 'ADMIN', NOW()${hasMemberStatus ? ", 'ACTIVE'" : ''})
      `, [id, talentId]);
    }

    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating community:', error);
    console.error('Error message:', error?.message);
    console.error('Error code:', error?.code);
    console.error('Error detail:', error?.detail);
    console.error('Query columns:', insertColumns);
    console.error('Query values:', insertValues);
    console.error('Params count:', params.length);
    console.error('Params:', JSON.stringify(params, null, 2));
    if (insertColumns.length > 0 && insertValues.length > 0) {
      console.error('Generated SQL:', `INSERT INTO communities (${insertColumns.join(', ')}) VALUES (${insertValues.join(', ')})`);
    }
    res.status(500).json({
      error: 'Failed to create community',
      message: error?.message || 'Unknown error',
      code: error?.code,
      detail: error?.detail,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

// PUT /api/communities/:id - Update community
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      description,
      rules,
      application_questions,
      tags,
      sectors,
      visibility,
      is_paid,
      monthly_price,
      currency,
      city,
      region,
      country,
      coordinates,
      cover_image_url,
      images,
      status,
      // Legacy fields for backward compatibility
      access_type,
    } = req.body;

    const existingResult = await pool.query('SELECT * FROM communities WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    // Authorization: must be creator or org member (OWNER/ADMIN)
    const community = existingResult.rows[0];
    const isCreator = community.created_by === req.talentId;
    let isOrgAdmin = false;
    if (community.organization_id) {
      const memberCheck = await pool.query(
        `SELECT role FROM organization_members WHERE organization_id = $1 AND talent_id = $2 AND role IN ('OWNER', 'ADMIN')`,
        [community.organization_id, req.talentId]
      );
      isOrgAdmin = memberCheck.rows.length > 0;
    }
    if (!isCreator && !isOrgAdmin) {
      return res.status(403).json({ error: 'Non autorisé à modifier cette communauté' });
    }

    // Validate tags: max 3 tags
    if (tags !== undefined && Array.isArray(tags) && tags.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 tags allowed' });
    }

    // Content moderation for user-generated text fields
    try {
      await autoModerationService.assertContentApproved({
        name,
        description,
        rules,
      });
    } catch (moderationError: any) {
      console.log(`[Moderation] Community update rejected for ${id}: ${moderationError.message}`);
      return res.status(400).json({ 
        error: moderationError.message,
        code: 'CONTENT_MODERATION_FAILED',
        field: moderationError.flaggedField,
      });
    }

    // Use access_type column for visibility (backward compatibility)
    const visibilityToStore = visibility !== undefined ? visibility : (access_type !== undefined ? access_type : undefined);

    // Check which columns exist in the database
    const columnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'communities' 
      AND column_name = 'access_type'
    `);
    const existingColumns = columnsCheck.rows.map((row: any) => row.column_name);
    const hasAccessType = existingColumns.includes('access_type');

    // Build dynamic UPDATE query based on available columns
    let updateFields = [
      'name = COALESCE($1, name)',
      'type = COALESCE($2, type)',
      'description = COALESCE($3, description)',
      'rules = COALESCE($4, rules)',
      'application_questions = COALESCE($5, application_questions)'
    ];
    let paramIndex = 6;
    // application_questions is stored as TEXT[] in the DB
    let params: any[] = [name, type, description, rules, Array.isArray(application_questions) ? application_questions : null];

    // Check if tags column exists
    const tagsColumnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'communities' 
      AND column_name = 'tags'
    `);
    const hasTagsColumn = tagsColumnCheck.rows.length > 0;

    if (hasTagsColumn && tags !== undefined) {
      updateFields.push(`tags = COALESCE($${paramIndex++}, tags)`);
      params.push(tags ? JSON.stringify(tags) : null);
    }

    if (hasAccessType) {
      updateFields.push(`access_type = COALESCE($${paramIndex++}, access_type)`);
      params.push(visibilityToStore);
    }

    // Check if cover_image_url column exists
    const coverImageCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'communities' 
      AND column_name = 'cover_image_url'
    `);
    const hasCoverImageColumn = coverImageCheck.rows.length > 0;

    updateFields.push(
      'city = COALESCE($' + paramIndex++ + ', city)',
      'region = COALESCE($' + paramIndex++ + ', region)',
      'country = COALESCE($' + paramIndex++ + ', country)',
      'coordinates = COALESCE($' + paramIndex++ + ', coordinates)',
      'status = COALESCE($' + paramIndex++ + ', status)',
      'updated_at = NOW()'
    );
    params.push(
      city, region, country,
      coordinates ? `(${coordinates.lat}, ${coordinates.lng})` : null,
      status
    );

    // Add cover_image_url if column exists (logo_url is NOT used for communities)
    if (hasCoverImageColumn && cover_image_url !== undefined) {
      updateFields.push(`cover_image_url = COALESCE($${paramIndex++}, cover_image_url)`);
      params.push(cover_image_url);
    }

    const whereParamIndex = paramIndex;
    params.push(id);

    const result = await pool.query(`
      UPDATE communities SET
        ${updateFields.join(',\n        ')}
      WHERE id = $${whereParamIndex} AND deleted_at IS NULL
      RETURNING *
    `, params);

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error updating community:', error);
    res.status(500).json({ error: 'Failed to update community' });
  }
});

// DELETE /api/communities/:id - Soft delete community
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Verify ownership before deletion
    const ownershipCheck = await pool.query(`
      SELECT id, created_by, organization_id FROM communities
      WHERE id = $1 AND deleted_at IS NULL
    `, [id]);

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    const community = ownershipCheck.rows[0];
    
    // Check if user is creator or organization member
    if (community.created_by !== talentId) {
      if (community.organization_id) {
        const orgCheck = await pool.query(`
          SELECT 1 FROM organization_members
          WHERE organization_id = $1 AND talent_id = $2
        `, [community.organization_id, talentId]);
        
        if (orgCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Unauthorized: Only creator or organization members can delete' });
        }
      } else {
        return res.status(403).json({ error: 'Unauthorized: Only creator can delete' });
      }
    }

    const result = await pool.query(`
      UPDATE communities SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    res.json({ success: true, message: 'Community deleted' });
  } catch (error) {
    console.error('Error deleting community:', error);
    res.status(500).json({ error: 'Failed to delete community' });
  }
});

// ============================================================================
// MEMBERSHIP ROUTES
// ============================================================================

/**
 * GET /api/communities/:id/membership - Check if current user is member of community
 * Returns membership status and details
 */
router.get('/:id/membership', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    const result = await pool.query(`
      SELECT cm.*, c.name as community_name
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.community_id = $1 AND cm.talent_id = $2 AND c.deleted_at IS NULL
    `, [id, talentId]);

    if (result.rows.length === 0) {
      return res.json({
        data: {
          is_member: false,
          has_pending_request: false,
        },
      });
    }

    const membership = result.rows[0];
    res.json({
      data: {
        is_member: membership.status === 'ACTIVE',
        has_pending_request: membership.status === 'PENDING',
        membership_id: membership.id,
        role: membership.role,
        status: membership.status,
        joined_at: membership.joined_at,
      },
    });
  } catch (error) {
    console.error('Error checking membership:', error);
    res.status(500).json({ error: 'Failed to check membership' });
  }
});

/**
 * POST /api/communities/:id/join - Request to join a community
 * Body: { answers?: { question: string, answer: string }[], accepted_rules?: boolean }
 */
router.post('/:id/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;
    const { answers, accepted_rules } = req.body;

    if (!talentId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Content moderation for answers (if provided)
    if (answers && Array.isArray(answers) && answers.length > 0) {
      const answersText = answers
        .filter((a: any) => a && a.answer && typeof a.answer === 'string')
        .map((a: any) => a.answer)
        .join('\n');
      
      if (answersText.trim().length > 0) {
        try {
          await autoModerationService.assertContentApproved({ answers: answersText });
        } catch (moderationError: any) {
          console.log(`[Moderation] Community join request rejected for ${talentId}: ${moderationError.message}`);
          return res.status(400).json({ 
            error: moderationError.message,
            code: 'CONTENT_MODERATION_FAILED',
            field: 'answers',
          });
        }
      }
    }

    // Check which columns exist in community_members
    const columnsCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'community_members'
      AND column_name IN ('id', 'status', 'role', 'answers', 'accepted_rules', 'created_at', 'updated_at')
    `);
    const existingColumns = columnsCheck.rows.map((row: any) => row.column_name);
    const hasId = existingColumns.includes('id');
    const hasStatus = existingColumns.includes('status');
    const hasRole = existingColumns.includes('role');
    const hasAnswers = existingColumns.includes('answers');
    const hasAcceptedRules = existingColumns.includes('accepted_rules');
    const hasCreatedAt = existingColumns.includes('created_at');
    const hasUpdatedAt = existingColumns.includes('updated_at');

    // Check if community exists
    const communityResult = await pool.query(`
      SELECT * FROM communities WHERE id = $1 AND deleted_at IS NULL
    `, [id]);

    if (communityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Communauté non trouvée' });
    }

    const community = communityResult.rows[0];

    // Note: All memberships require admin approval regardless of access_type

    // Check if user already has a membership (active or pending)
    const existingMembership = await pool.query(`
      SELECT * FROM community_members 
      WHERE community_id = $1 AND talent_id = $2
    `, [id, talentId]);

    if (existingMembership.rows.length > 0) {
      const membership = existingMembership.rows[0];

      // Check status only if column exists
      if (hasStatus) {
        const currentStatus = membership.status;

        if (currentStatus === 'ACTIVE') {
          return res.status(400).json({ error: 'Vous êtes déjà membre de cette communauté' });
        }
        if (currentStatus === 'PENDING') {
          return res.status(400).json({ error: 'Vous avez déjà une demande d\'adhésion en attente' });
        }
        // If rejected or NULL, allow them to reapply by updating the existing record
        if (currentStatus === 'REJECTED' || currentStatus === null || currentStatus === undefined) {
          const updateFields: string[] = [];
          const updateValues: any[] = [];
          let paramIndex = 1;

          if (hasStatus) {
            updateFields.push(`status = $${paramIndex++}`);
            // Always set to PENDING - requires admin approval
            updateValues.push('PENDING');
          }
          if (hasAnswers) {
            updateFields.push(`answers = $${paramIndex++}`);
            updateValues.push(answers ? JSON.stringify(answers) : null);
          }
          if (hasAcceptedRules) {
            updateFields.push(`accepted_rules = $${paramIndex++}`);
            updateValues.push(accepted_rules || false);
          }
          if (hasUpdatedAt) {
            updateFields.push(`updated_at = NOW()`);
          }

          const whereClause = hasId ? `WHERE id = $${paramIndex}` : `WHERE community_id = $${paramIndex} AND talent_id = $${paramIndex + 1}`;
          if (hasId) {
            updateValues.push(membership.id);
          } else {
            updateValues.push(id, talentId);
          }

          const updateResult = await pool.query(`
            UPDATE community_members 
            SET ${updateFields.join(', ')}
            ${whereClause}
            RETURNING *
          `, updateValues);

          return res.json({
            data: {
              membership_id: hasId ? updateResult.rows[0].id : `${id}-${talentId}`,
              status: hasStatus ? updateResult.rows[0].status : 'PENDING',
              message: 'Votre demande d\'adhésion a été soumise et est en attente d\'approbation.',
            },
          });
        }
      } else {
        // If no status column, check is_active
        // If is_active is true or NULL (default), consider them as active member
        if (membership.is_active === true || membership.is_active === null || membership.is_active === undefined) {
          return res.status(400).json({ error: 'Vous êtes déjà membre de cette communauté' });
        }
        // If is_active is false, allow them to rejoin by updating
        // This handles the case where they left but want to rejoin
        const updateFields: string[] = ['is_active = TRUE'];
        const updateValues: any[] = [];
        let paramIndex = 1;

        if (hasAnswers) {
          updateFields.push(`answers = $${paramIndex++}`);
          updateValues.push(answers ? JSON.stringify(answers) : null);
        }
        if (hasAcceptedRules) {
          updateFields.push(`accepted_rules = $${paramIndex++}`);
          updateValues.push(accepted_rules || false);
        }

        const whereClause = hasId ? `WHERE id = $${paramIndex}` : `WHERE community_id = $${paramIndex} AND talent_id = $${paramIndex + 1}`;
        if (hasId) {
          updateValues.push(membership.id);
        } else {
          updateValues.push(id, talentId);
        }

        const updateResult = await pool.query(`
          UPDATE community_members 
          SET ${updateFields.join(', ')}
          ${whereClause}
          RETURNING *
        `, updateValues);

        return res.json({
          data: {
            membership_id: hasId ? updateResult.rows[0].id : `${id}-${talentId}`,
            status: 'ACTIVE',
            message: 'Bienvenue dans la communauté !',
          },
        });
      }
    }

    // All membership requests require admin approval
    // Status is always PENDING until admin approves
    const membershipStatus: string = 'PENDING';

    // Build dynamic INSERT query based on available columns
    const insertColumns: string[] = [];
    const insertValues: string[] = [];
    const insertParams: any[] = [];
    let paramIndex = 1;

    if (hasId) {
      insertColumns.push('id');
      insertValues.push(`$${paramIndex++}`);
      insertParams.push(uuidv4());
    }

    insertColumns.push('community_id', 'talent_id', 'membership_type');
    insertValues.push(`$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`);
    insertParams.push(id, talentId, 'MEMBER');

    if (hasRole) {
      insertColumns.push('role');
      insertValues.push(`$${paramIndex++}`);
      insertParams.push('MEMBER');
    }

    if (hasStatus) {
      insertColumns.push('status');
      insertValues.push(`$${paramIndex++}`);
      insertParams.push(membershipStatus);
    }

    if (hasAnswers) {
      insertColumns.push('answers');
      insertValues.push(`$${paramIndex++}`);
      insertParams.push(answers ? JSON.stringify(answers) : null);
    }

    if (hasAcceptedRules) {
      insertColumns.push('accepted_rules');
      insertValues.push(`$${paramIndex++}`);
      insertParams.push(accepted_rules || false);
    }

    insertColumns.push('joined_at');
    insertValues.push(membershipStatus === 'ACTIVE' ? 'NOW()' : 'NULL');

    if (hasCreatedAt) {
      insertColumns.push('created_at');
      insertValues.push('NOW()');
    }

    if (hasUpdatedAt) {
      insertColumns.push('updated_at');
      insertValues.push('NOW()');
    }

    const insertResult = await pool.query(`
      INSERT INTO community_members (${insertColumns.join(', ')})
      VALUES (${insertValues.join(', ')})
      RETURNING *
    `, insertParams);

    // Notify organization about new membership request (all memberships require approval)
    if (hasId && insertResult.rows[0]?.id) {
      notifyNewMembershipRequest(insertResult.rows[0].id).catch(err => console.error('Notification error:', err));
    }

    res.status(201).json({
      data: {
        membership_id: hasId ? insertResult.rows[0].id : `${id}-${talentId}`,
        status: hasStatus ? (insertResult.rows[0].status || membershipStatus) : membershipStatus,
        message: 'Votre demande d\'adhésion a été soumise et est en attente d\'approbation.',
      },
    });
  } catch (error: any) {
    console.error('Error joining community:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
    });
    res.status(500).json({
      error: 'Erreur lors de la demande d\'adhésion',
      message: error?.message || 'Unknown error',
      detail: process.env.NODE_ENV === 'development' ? error?.detail : undefined
    });
  }
});

/**
 * POST /api/communities/:id/leave - Leave a community
 */
router.post('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    const result = await pool.query(`
      DELETE FROM community_members
      WHERE community_id = $1 AND talent_id = $2
      RETURNING id
    `, [id, talentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vous n\'êtes pas membre de cette communauté' });
    }

    res.json({ success: true, message: 'Vous avez quitté la communauté' });
  } catch (error) {
    console.error('Error leaving community:', error);
    res.status(500).json({ error: 'Erreur lors du départ de la communauté' });
  }
});

/**
 * POST /api/communities/:id/cancel-request - Cancel a pending membership request
 */
router.post('/:id/cancel-request', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Only delete if status is PENDING
    const result = await pool.query(`
      DELETE FROM community_members
      WHERE community_id = $1 AND talent_id = $2 AND status = 'PENDING'
      RETURNING id
    `, [id, talentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aucune demande en attente trouvée' });
    }

    res.json({ success: true, message: 'Demande d\'adhésion annulée' });
  } catch (error) {
    console.error('Error cancelling membership request:', error);
    res.status(500).json({ error: 'Erreur lors de l\'annulation de la demande' });
  }
});

/**
 * GET /api/communities/memberships/me - Get current user's memberships
 */
router.get('/memberships/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { status, limit = 50, offset = 0 } = req.query;

    if (!talentId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Check which columns exist
    const columnsCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'community_members' AND column_name = 'status'
      UNION
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'communities' AND column_name IN ('cover_image_url', 'images')
    `);
    const existingColumns = columnsCheck.rows.map((r: any) => r.column_name);
    const hasMemberStatus = existingColumns.includes('status');
    const hasCoverImageUrl = existingColumns.includes('cover_image_url');
    const hasImages = existingColumns.includes('images');

    const memberCountFilter = hasMemberStatus ? " AND status = 'ACTIVE'" : '';
    const coverImageField = hasCoverImageUrl ? "'cover_image_url', c.cover_image_url," : '';
    const imagesField = hasImages ? "'images', c.images," : '';

    // Build count query
    let countQuery = `
      SELECT COUNT(*) as total
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.talent_id = $1 AND c.deleted_at IS NULL
    `;
    const countParams: QueryParam[] = [talentId as string];
    let countParamIndex = 2;

    if (status && hasMemberStatus) {
      countQuery += ` AND cm.status = $${countParamIndex++}`;
      countParams.push(status as string);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    // Build data query
    let query = `
      SELECT
        cm.*,
        json_build_object(
          'id', c.id,
          'name', c.name,
          'slug', c.slug,
          'type', c.type,
          'description', c.description,
          ${coverImageField}
          ${imagesField}
          'members_count', (SELECT COUNT(*) FROM community_members WHERE community_id = c.id${memberCountFilter})
        ) as community
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.talent_id = $1 AND c.deleted_at IS NULL
    `;
    const params: QueryParam[] = [talentId as string];
    let paramIndex = 2;

    if (status && hasMemberStatus) {
      query += ` AND cm.status = $${paramIndex++}`;
      params.push(status as string);
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);
    res.json({ data: { memberships: result.rows }, count: totalCount });
  } catch (error) {
    console.error('Error fetching memberships:', error);
    res.status(500).json({ error: 'Failed to fetch memberships' });
  }
});

// ============================================================================
// ORGANIZATION MANAGEMENT ROUTES (for community managers)
// ============================================================================

/**
 * GET /api/communities/:id/members - Get all members of a community (for organization)
 * Requires: Auth (organization member)
 */
router.get('/:id/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;
    const { status, limit = 50, offset = 0 } = req.query;

    // Verify user is explicit community ADMIN (not just org member)
    const role = await communityPermissionService.getUserRole(talentId!, id);
    if (role !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Accès non autorisé: seuls les administrateurs de la communauté peuvent gérer les membres' 
      });
    }

    // Verify community exists and is not deleted
    const communityCheck = await pool.query(`
      SELECT id FROM communities WHERE id = $1 AND deleted_at IS NULL
    `, [id]);

    if (communityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Communauté non trouvée' });
    }

    const memberStatusCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'community_members' AND column_name = 'status'
    `);
    const hasMemberStatus = memberStatusCheck.rows.length > 0;

    const memberCreatedAtCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'community_members' AND column_name = 'created_at'
    `);
    const hasMemberCreatedAt = memberCreatedAtCheck.rows.length > 0;

    const memberIdCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'community_members' AND column_name = 'id'
    `);
    const hasMemberId = memberIdCheck.rows.length > 0;

    const hasTalentCurrentRole = false; // Column does not exist on talents table

    // Build membership_id reference for unread messages subquery
    // If id column exists, use it; otherwise use composite key (community_id, talent_id)
    const membershipIdRef = hasMemberId
      ? 'cm.id'
      : `CONCAT(cm.community_id, '-', cm.talent_id)`;

    let query = `
      SELECT 
        cm.*,
        t.id as talent_id,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name,
        t.first_name as talent_first_name,
        t.last_name as talent_last_name,
        t.email as talent_email,
        t.avatar_url as talent_avatar,
        t.city as talent_city,
        t.country as talent_country,
        t.bio as talent_bio,
        ${hasTalentCurrentRole ? 't.current_role' : 'NULL'} as talent_current_role,
        0 as unread_messages
      FROM community_members cm
      JOIN talents t ON cm.talent_id = t.id
      WHERE cm.community_id = $1
    `;
    const params: QueryParam[] = [id];
    let paramIndex = 2;

    if (status && hasMemberStatus) {
      query += ` AND cm.status = $${paramIndex++}`;
      params.push(status as string);
    }

    // Use created_at if available, otherwise use joined_at
    const orderByColumn = hasMemberCreatedAt ? 'cm.created_at' : 'cm.joined_at';
    query += ` ORDER BY ${orderByColumn} DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    // Get status counts
    const statusCounts: Record<string, number> = {};
    if (hasMemberStatus) {
      const countResult = await pool.query(`
        SELECT status, COUNT(*) as count
        FROM community_members
        WHERE community_id = $1
        GROUP BY status
      `, [id]);
      countResult.rows.forEach(row => {
        statusCounts[row.status] = parseInt(row.count, 10);
      });
    } else {
      const countResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM community_members
        WHERE community_id = $1
      `, [id]);
      statusCounts.ACTIVE = parseInt(countResult.rows[0].count, 10);
    }

    // Transform data to match frontend expectations
    const members = result.rows.map(row => ({
      ...row,
      talent: {
        id: row.talent_id,
        display_name: row.talent_name,
        first_name: row.talent_first_name,
        last_name: row.talent_last_name,
        email: row.talent_email,
        avatar_url: row.talent_avatar,
        profile_picture_url: row.talent_avatar,
        city: row.talent_city,
        country: row.talent_country,
        bio: row.talent_bio,
        current_role: row.talent_current_role,
      },
    }));

    res.json({
      data: members,
      count: result.rowCount,
      statusCounts
    });
  } catch (error: any) {
    console.error('Error fetching community members:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
      position: error?.position,
    });
    res.status(500).json({
      error: 'Erreur lors de la récupération des membres',
      message: error?.message || 'Unknown error',
      detail: process.env.NODE_ENV === 'development' ? error?.detail : undefined
    });
  }
});

/**
 * GET /api/communities/members/:membershipId - Get single membership details (for organization)
 * Requires: Auth (organization member)
 */
router.get('/members/:membershipId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId } = req.params;
    const talentId = req.talentId;

    // First get the community_id from the membership
    const membershipCheck = await pool.query(`
      SELECT cm.community_id FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.id = $1 AND c.deleted_at IS NULL
    `, [membershipId]);

    if (membershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Adhésion non trouvée' });
    }

    const communityId = membershipCheck.rows[0].community_id;

    // Verify user is explicit community ADMIN (not just org member)
    const role = await communityPermissionService.getUserRole(talentId!, communityId);
    if (role !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Accès non autorisé: seuls les administrateurs de la communauté peuvent voir les détails des membres' 
      });
    }

    const result = await pool.query(`
      SELECT
        cm.*,
        c.id as community_id,
        c.name as community_name,
        c.application_questions,
        c.rules as community_rules,
        t.id as talent_id,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name,
        t.first_name as talent_first_name,
        t.last_name as talent_last_name,
        t.email as talent_email,
        t.phone as talent_phone,
        t.avatar_url as talent_avatar,
        t.city as talent_city,
        t.country as talent_country,
        t.bio as talent_bio
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      JOIN talents t ON cm.talent_id = t.id
      WHERE cm.id = $1 AND c.deleted_at IS NULL
    `, [membershipId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Adhésion non trouvée' });
    }

    const row = result.rows[0];

    // Mark as viewed if pending
    if (row.status === 'PENDING' && !row.viewed_at) {
      await pool.query(
        'UPDATE community_members SET viewed_at = NOW(), updated_at = NOW() WHERE id = $1',
        [membershipId]
      );
    }

    // Structure response
    const membership = {
      ...row,
      community: {
        id: row.community_id,
        name: row.community_name,
        application_questions: row.application_questions,
        rules: row.community_rules,
      },
      talent: {
        id: row.talent_id,
        display_name: row.talent_name,
        first_name: row.talent_first_name,
        last_name: row.talent_last_name,
        email: row.talent_email,
        phone: row.talent_phone,
        avatar_url: row.talent_avatar,
        profile_picture_url: row.talent_avatar,
        city: row.talent_city,
        country: row.talent_country,
        bio: row.talent_bio,
        headline: row.talent_bio,
      },
      answers: safeParseJson(row.answers, []),
    };

    res.json({ data: membership });
  } catch (error) {
    console.error('Error fetching membership details:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails' });
  }
});

/**
 * PUT /api/communities/members/:membershipId/status - Update membership status
 * Requires: Auth (organization member)
 */
router.put('/members/:membershipId/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId } = req.params;
    const { status, rejection_reason } = req.body;
    const talentId = req.talentId;

    const memberStatusCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'community_members' AND column_name = 'status'
    `);
    if (memberStatusCheck.rows.length === 0) {
      return res.status(500).json({
        error: 'Missing membership status column',
        message: 'community_members.status is required. Run migration 009_add_community_membership_fields.sql',
      });
    }

    const validStatuses = ['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    // First get the community_id from the membership
    const membershipInfo = await pool.query(`
      SELECT cm.community_id, cm.status as old_status, cm.talent_id as member_talent_id,
             c.name as community_name
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.id = $1 AND c.deleted_at IS NULL
    `, [membershipId]);

    if (membershipInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Adhésion non trouvée' });
    }

    const communityId = membershipInfo.rows[0].community_id;

    // Verify user is explicit community ADMIN (not just org member)
    const role = await communityPermissionService.getUserRole(talentId!, communityId);
    if (role !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Accès non autorisé: seuls les administrateurs de la communauté peuvent modifier le statut des membres' 
      });
    }

    const oldStatus = membershipInfo.rows[0].old_status;
    const memberTalentId = membershipInfo.rows[0].member_talent_id;
    const communityName = membershipInfo.rows[0].community_name;

    // Update membership
    const updateFields: string[] = ['status = $1', 'updated_at = NOW()'];
    const updateParams: QueryParam[] = [status];
    let paramIndex = 2;

    if (status === 'ACTIVE') {
      updateFields.push('joined_at = COALESCE(joined_at, NOW())');
      updateFields.push('rejected_at = NULL');
      updateFields.push('rejection_reason = NULL');
    } else if (status === 'REJECTED') {
      updateFields.push(`rejected_at = NOW()`);
      if (rejection_reason) {
        updateFields.push(`rejection_reason = $${paramIndex++}`);
        updateParams.push(rejection_reason);
      }
    }

    updateParams.push(membershipId);
    const result = await pool.query(`
      UPDATE community_members
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, updateParams);

    // Notify member about status change
    if (oldStatus !== status) {
      notifyMembershipStatusChanged(membershipId, memberTalentId, communityName, oldStatus, status)
        .catch(err => console.error('Notification error:', err));
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `Statut mis à jour: ${status}`
    });
  } catch (error) {
    console.error('Error updating membership status:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

/**
 * PUT /api/communities/members/:membershipId/notes - Update internal notes
 * Requires: Auth (explicit community ADMIN)
 */
router.put('/members/:membershipId/notes', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId } = req.params;
    const { notes } = req.body;
    const talentId = req.talentId;

    // First get the community_id from the membership
    const membershipCheck = await pool.query(`
      SELECT cm.community_id FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.id = $1 AND c.deleted_at IS NULL
    `, [membershipId]);

    if (membershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Adhésion non trouvée' });
    }

    const communityId = membershipCheck.rows[0].community_id;

    // Verify user is explicit community ADMIN (not just org member)
    const role = await communityPermissionService.getUserRole(talentId!, communityId);
    if (role !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Accès non autorisé: seuls les administrateurs de la communauté peuvent modifier les notes' 
      });
    }

    const result = await pool.query(`
      UPDATE community_members
      SET internal_notes = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [notes, membershipId]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating notes:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des notes' });
  }
});

/**
 * PUT /api/communities/members/:membershipId/rating - Update rating
 * Requires: Auth (explicit community ADMIN)
 */
router.put('/members/:membershipId/rating', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId } = req.params;
    const { rating } = req.body;
    const talentId = req.talentId;

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'La note doit être entre 1 et 5' });
    }

    // First get the community_id from the membership
    const membershipCheck = await pool.query(`
      SELECT cm.community_id FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.id = $1 AND c.deleted_at IS NULL
    `, [membershipId]);

    if (membershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Adhésion non trouvée' });
    }

    const communityId = membershipCheck.rows[0].community_id;

    // Verify user is explicit community ADMIN (not just org member)
    const role = await communityPermissionService.getUserRole(talentId!, communityId);
    if (role !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Accès non autorisé: seuls les administrateurs de la communauté peuvent modifier les notes' 
      });
    }

    const result = await pool.query(`
      UPDATE community_members
      SET rating = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [rating, membershipId]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating rating:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la note' });
  }
});

/**
 * GET /api/communities/members/:membershipId/permissions - Get member permissions
 * Requires: Auth (explicit community ADMIN)
 */
router.get('/members/:membershipId/permissions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId } = req.params;
    const talentId = req.talentId;

    // First get the community_id from the membership
    const membershipCheck = await pool.query(`
      SELECT cm.community_id FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.id = $1 AND c.deleted_at IS NULL
    `, [membershipId]);

    if (membershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Adhésion non trouvée' });
    }

    const communityId = membershipCheck.rows[0].community_id;

    // Verify user is explicit community ADMIN
    const role = await communityPermissionService.getUserRole(talentId!, communityId);
    if (role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Accès non autorisé: seuls les administrateurs peuvent gérer les permissions'
      });
    }

    const permissionsData = await communityPermissionService.getMembershipPermissions(membershipId);
    res.json({ success: true, data: permissionsData });
  } catch (error) {
    console.error('Error getting member permissions:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des permissions' });
  }
});

/**
 * PUT /api/communities/members/:membershipId/permissions - Update member permissions
 * Requires: Auth (explicit community ADMIN)
 * Body: { permissions: { can_post, can_create_event, can_create_poll } | null }
 * Pass null to reset to community defaults
 */
router.put('/members/:membershipId/permissions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId } = req.params;
    const { permissions } = req.body;
    const talentId = req.talentId;

    // First get the community_id from the membership
    const membershipCheck = await pool.query(`
      SELECT cm.community_id, cm.talent_id FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.id = $1 AND c.deleted_at IS NULL
    `, [membershipId]);

    if (membershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Adhésion non trouvée' });
    }

    const communityId = membershipCheck.rows[0].community_id;
    const memberTalentId = membershipCheck.rows[0].talent_id;

    // Verify user is explicit community ADMIN
    const role = await communityPermissionService.getUserRole(talentId!, communityId);
    if (role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Accès non autorisé: seuls les administrateurs peuvent gérer les permissions'
      });
    }

    // Check if the member being modified is also an admin (cannot modify admin permissions)
    const memberRole = await communityPermissionService.getUserRole(memberTalentId, communityId);
    if (memberRole === 'ADMIN') {
      return res.status(400).json({
        error: 'Impossible de modifier les permissions d\'un administrateur'
      });
    }

    const updatedPermissions = await communityPermissionService.updateMemberPermissions(membershipId, permissions);
    res.json({
      success: true,
      data: {
        permissions: updatedPermissions,
        isCustom: permissions !== null
      },
      message: permissions === null ? 'Permissions réinitialisées aux valeurs par défaut' : 'Permissions mises à jour'
    });
  } catch (error) {
    console.error('Error updating member permissions:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des permissions' });
  }
});

/**
 * GET /api/communities/:id/default-permissions - Get community default member permissions
 * Requires: Auth (explicit community ADMIN)
 */
router.get('/:id/default-permissions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id: communityId } = req.params;
    const talentId = req.talentId;

    // Verify user is explicit community ADMIN
    const role = await communityPermissionService.getUserRole(talentId!, communityId);
    if (role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Accès non autorisé: seuls les administrateurs peuvent voir les permissions par défaut'
      });
    }

    const defaultPermissions = await communityPermissionService.getCommunityDefaultPermissions(communityId);
    res.json({ success: true, data: defaultPermissions });
  } catch (error) {
    console.error('Error getting default permissions:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des permissions par défaut' });
  }
});

/**
 * PUT /api/communities/:id/default-permissions - Update community default member permissions
 * Requires: Auth (explicit community ADMIN)
 * Body: { can_post, can_create_event, can_create_poll }
 */
router.put('/:id/default-permissions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id: communityId } = req.params;
    const { can_post, can_create_event, can_create_poll } = req.body;
    const talentId = req.talentId;

    // Verify user is explicit community ADMIN
    const role = await communityPermissionService.getUserRole(talentId!, communityId);
    if (role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Accès non autorisé: seuls les administrateurs peuvent modifier les permissions par défaut'
      });
    }

    const updatedPermissions = await communityPermissionService.updateCommunityDefaultPermissions(communityId, {
      can_post,
      can_create_event,
      can_create_poll,
    });

    res.json({
      success: true,
      data: updatedPermissions,
      message: 'Permissions par défaut mises à jour'
    });
  } catch (error) {
    console.error('Error updating default permissions:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des permissions par défaut' });
  }
});

/**
 * DELETE /api/communities/members/:membershipId - Hard delete a membership
 * Allows organization to remove member so they can reapply
 * Requires: Auth (explicit community ADMIN)
 */
router.delete('/members/:membershipId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId } = req.params;
    const talentId = req.talentId;

    // First get the community_id from the membership
    const membershipCheck = await pool.query(`
      SELECT cm.community_id FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.id = $1 AND c.deleted_at IS NULL
    `, [membershipId]);

    if (membershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Adhésion non trouvée' });
    }

    const communityId = membershipCheck.rows[0].community_id;

    // Verify user is explicit community ADMIN (not just org member)
    const role = await communityPermissionService.getUserRole(talentId!, communityId);
    if (role !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Accès non autorisé: seuls les administrateurs de la communauté peuvent supprimer des membres' 
      });
    }

    // Delete the membership
    await pool.query('DELETE FROM community_members WHERE id = $1', [membershipId]);

    res.json({ success: true, message: 'Membre supprimé. Il pourra postuler à nouveau.' });
  } catch (error) {
    console.error('Error deleting membership:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du membre' });
  }
});

// ============================================================================
// NOTIFICATION HELPERS FOR COMMUNITIES
// ============================================================================

/**
 * Notify talent when their membership status changes
 */
async function notifyMembershipStatusChanged(
  membershipId: string,
  memberTalentId: string,
  communityName: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  try {
    const pushService = await import('../services/push-notification.service');

    const statusMessages: Record<string, string> = {
      ACTIVE: 'a été acceptée',
      REJECTED: 'n\'a pas été retenue',
      SUSPENDED: 'a été suspendue',
      PENDING: 'est en attente de validation',
    };

    const statusText = statusMessages[newStatus] || 'a été mise à jour';
    const title = 'Mise à jour d\'adhésion';
    const body = `Votre demande d'adhésion à "${communityName}" ${statusText}.`;

    await pushService.sendToUser(memberTalentId, {
      type: 'APPLICATION',
      title,
      body,
      data: {
        membershipId,
        communityName,
        newStatus,
        screen: 'my-community-details',
      },
    });
  } catch (error) {
    console.error('Error sending membership status notification:', error);
  }
}

/**
 * Notify organization when a new membership request is received
 */
async function notifyNewMembershipRequest(membershipId: string): Promise<void> {
  try {
    const pushService = await import('../services/push-notification.service');

    const result = await pool.query(`
      SELECT
        cm.id,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name,
        c.name as community_name,
        c.organization_id
      FROM community_members cm
      JOIN talents t ON cm.talent_id = t.id
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.id = $1
    `, [membershipId]);

    if (result.rows.length === 0) return;

    const membership = result.rows[0];

    // Get organization members
    const orgMembers = await pool.query(
      `SELECT om.talent_id FROM organization_members om
       WHERE om.organization_id = $1`,
      [membership.organization_id]
    );

    const title = 'Nouvelle demande d\'adhésion';
    const body = `${membership.talent_name} souhaite rejoindre "${membership.community_name}"`;

    for (const member of orgMembers.rows) {
      await pushService.sendToUser(member.talent_id, {
        type: 'APPLICATION',
        title,
        body,
        data: {
          membershipId,
          talentName: membership.talent_name,
          communityName: membership.community_name,
          screen: 'org-community-member-details',
        },
      });
    }
  } catch (error) {
    console.error('Error sending new membership request notification:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMBERSHIP MESSAGES ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/communities/members/:membershipId/messages - Get messages for a membership
 * Requires: Auth (organization member or the talent)
 */
router.get('/members/:membershipId/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId } = req.params;
    const talentId = req.talentId;
    const { limit = 50, offset = 0 } = req.query;

    // Get membership and verify access
    const membershipResult = await pool.query(`
      SELECT cm.*, c.organization_id
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.id = $1 AND c.deleted_at IS NULL
    `, [membershipId]);

    if (membershipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Adhésion non trouvée' });
    }

    const membership = membershipResult.rows[0];

    // Check access: must be the talent OR an org member
    const isOrgMember = await pool.query(
      `SELECT 1 FROM organization_members WHERE organization_id = $1 AND talent_id = $2`,
      [membership.organization_id, talentId]
    );

    if (membership.talent_id !== talentId && isOrgMember.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Get messages
    const messages = await pool.query(`
      SELECT
        m.*,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as sender_name,
        t.avatar_url as sender_avatar
      FROM community_membership_messages m
      JOIN talents t ON m.sender_id = t.id
      WHERE m.membership_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3
    `, [membershipId, limit, offset]);

    res.json({ data: messages.rows });
  } catch (error) {
    console.error('Error fetching membership messages:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
  }
});

/**
 * POST /api/communities/members/:membershipId/messages - Send a message
 * Requires: Auth (organization member or the talent)
 */
router.post('/members/:membershipId/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId } = req.params;
    const talentId = req.talentId;
    const { content, attachments, proposed_datetime, datetime_type } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Le message ne peut pas être vide' });
    }

    // Get membership and verify access
    const membershipResult = await pool.query(`
      SELECT cm.*, c.organization_id, c.name as community_name
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.id = $1 AND c.deleted_at IS NULL
    `, [membershipId]);

    if (membershipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Adhésion non trouvée' });
    }

    const membership = membershipResult.rows[0];

    // Check access: must be the talent OR an org member
    const isOrgMember = await pool.query(
      `SELECT 1 FROM organization_members WHERE organization_id = $1 AND talent_id = $2`,
      [membership.organization_id, talentId]
    );

    const isTalent = membership.talent_id === talentId;
    const isOrg = isOrgMember.rows.length > 0;

    if (!isTalent && !isOrg) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const senderType = isOrg ? 'ORGANIZATION' : 'TALENT';

    // Insert message
    const result = await pool.query(`
      INSERT INTO community_membership_messages
        (membership_id, sender_type, sender_id, content, attachments, proposed_datetime, datetime_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      membershipId,
      senderType,
      talentId,
      content.trim(),
      JSON.stringify(attachments || []),
      proposed_datetime || null,
      datetime_type || null
    ]);

    // Get sender info
    const senderInfo = await pool.query(
      `SELECT COALESCE(first_name || ' ' || last_name, email) as sender_name, avatar_url as sender_avatar FROM talents WHERE id = $1`,
      [talentId]
    );

    const message = {
      ...result.rows[0],
      sender_name: senderInfo.rows[0]?.sender_name,
      sender_avatar: senderInfo.rows[0]?.sender_avatar
    };

    // Update unread count for recipient
    if (senderType === 'ORGANIZATION') {
      // Org sent message, increment unread for talent
      await pool.query(
        `UPDATE community_members SET unread_messages = COALESCE(unread_messages, 0) + 1 WHERE id = $1`,
        [membershipId]
      );
    }

    // Send push notification to recipient
    try {
      const pushService = await import('../services/push-notification.service');

      if (senderType === 'ORGANIZATION') {
        // Notify the talent
        await pushService.sendToUser(membership.talent_id, {
          type: 'MESSAGE',
          title: 'Nouveau message',
          body: `${membership.community_name}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
          data: {
            membershipId,
            screen: 'community-membership-messages',
          },
        });
      } else {
        // Notify org members
        const orgMembers = await pool.query(
          `SELECT talent_id FROM organization_members WHERE organization_id = $1`,
          [membership.organization_id]
        );
        for (const member of orgMembers.rows) {
          await pushService.sendToUser(member.talent_id, {
            type: 'MESSAGE',
            title: 'Nouveau message',
            body: `Message de ${senderInfo.rows[0]?.sender_name || 'un membre'}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
            data: {
              membershipId,
              screen: 'org-community-member-messages',
            },
          });
        }
      }
    } catch (pushError) {
      console.error('Error sending message notification:', pushError);
    }

    res.status(201).json({ data: message });
  } catch (error) {
    console.error('Error sending membership message:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
  }
});

/**
 * PUT /api/communities/members/:membershipId/messages/read-all - Mark all messages as read
 * Requires: Auth (organization member or the talent)
 */
router.put('/members/:membershipId/messages/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId } = req.params;
    const talentId = req.talentId;

    // Get membership and verify access
    const membershipResult = await pool.query(`
      SELECT cm.*, c.organization_id
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.id = $1 AND c.deleted_at IS NULL
    `, [membershipId]);

    if (membershipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Adhésion non trouvée' });
    }

    const membership = membershipResult.rows[0];

    // Check access
    const isOrgMember = await pool.query(
      `SELECT 1 FROM organization_members WHERE organization_id = $1 AND talent_id = $2`,
      [membership.organization_id, talentId]
    );

    const isTalent = membership.talent_id === talentId;
    const isOrg = isOrgMember.rows.length > 0;

    if (!isTalent && !isOrg) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Mark messages as read (only those sent by the OTHER party)
    const senderTypeToMark = isOrg ? 'TALENT' : 'ORGANIZATION';

    const result = await pool.query(`
      UPDATE community_membership_messages
      SET read_at = NOW()
      WHERE membership_id = $1 AND sender_type = $2 AND read_at IS NULL
    `, [membershipId, senderTypeToMark]);

    // Reset unread count if talent is reading
    if (isTalent) {
      await pool.query(
        `UPDATE community_members SET unread_messages = 0 WHERE id = $1`,
        [membershipId]
      );
    }

    res.json({ marked: result.rowCount });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Erreur lors du marquage des messages' });
  }
});

export default router;
