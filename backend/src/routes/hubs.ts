import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, generateSlug } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

// Type for SQL query parameters
type QueryParam = string | number | boolean | null | Date;

const router = Router();

// GET /api/hubs - List all hubs
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, access_type, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT h.*,
        (SELECT COUNT(*) FROM hub_bookings WHERE hub_id = h.id AND status = 'CONFIRMED') as active_bookings
      FROM hubs h
      WHERE h.deleted_at IS NULL
    `;
    const params: QueryParam[] = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND h.type = $${paramIndex++}`;
      params.push(type as string);
    }
    if (access_type) {
      query += ` AND h.access_type = $${paramIndex++}`;
      params.push(access_type as string);
    }

    query += ` ORDER BY h.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    console.error('Error fetching hubs:', error);
    res.status(500).json({ error: 'Failed to fetch hubs' });
  }
});

// GET /api/hubs/organization/:orgId - Get hubs by organization
// NOTE: This must be defined BEFORE /:id to avoid route conflicts
router.get('/organization/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT h.*,
        (SELECT COUNT(*) FROM hub_bookings WHERE hub_id = h.id AND status = 'CONFIRMED') as active_bookings
      FROM hubs h
      WHERE h.organization_id = $1 AND h.deleted_at IS NULL
      ORDER BY h.created_at DESC
      LIMIT $2 OFFSET $3
    `, [orgId, Number(limit), Number(offset)]);

    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    console.error('Error fetching organization hubs:', error);
    res.status(500).json({ error: 'Failed to fetch hubs' });
  }
});

// GET /api/hubs/:id - Get single hub
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT h.*,
        (SELECT COUNT(*) FROM hub_bookings WHERE hub_id = h.id AND status = 'CONFIRMED') as active_bookings
      FROM hubs h
      WHERE h.id = $1 AND h.deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hub not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching hub:', error);
    res.status(500).json({ error: 'Failed to fetch hub' });
  }
});

// POST /api/hubs - Create hub (requires authentication)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const {
      name,
      type,
      description,
      amenities,
      address,
      city,
      region,
      country,
      coordinates,
      access_type,
      pricing_type,
      price,
      capacity,
      opening_hours,
      contact_phone,
      contact_email,
      website_url,
      logo_url,
      cover_image_url,
      gallery_images,
      organization_id,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const id = uuidv4();
    const slug = generateSlug(name) + '-' + id.slice(0, 8);
    const pricing = pricing_type === 'FREE' ? 'Gratuit' :
                    pricing_type === 'CUSTOM' ? 'Sur devis' :
                    price ? `${price} FCFA/${pricing_type?.toLowerCase() || 'mois'}` : null;

    const result = await pool.query(`
      INSERT INTO hubs (
        id, name, slug, type, description, amenities, address, city, region, country,
        coordinates, access_type, pricing, capacity, opening_hours, contact_phone, contact_email,
        website_url, logo_url, cover_image_url, gallery_images, organization_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW()
      ) RETURNING *
    `, [
      id, name, slug, type, description,
      amenities ? amenities : null,
      address, city, region, country,
      coordinates ? `(${coordinates.lat}, ${coordinates.lng})` : null,
      access_type, pricing, capacity,
      opening_hours ? JSON.stringify(opening_hours) : null,
      contact_phone, contact_email, website_url, logo_url, cover_image_url,
      gallery_images ? gallery_images : null,
      organization_id
    ]);

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error creating hub:', error);
    res.status(500).json({ error: 'Failed to create hub' });
  }
});

// PUT /api/hubs/:id - Update hub
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      description,
      amenities,
      address,
      city,
      region,
      country,
      coordinates,
      access_type,
      pricing_type,
      price,
      capacity,
      opening_hours,
      contact_phone,
      contact_email,
      website_url,
      logo_url,
      cover_image_url,
      gallery_images,
    } = req.body;

    const existingResult = await pool.query('SELECT * FROM hubs WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hub not found' });
    }

    const pricing = pricing_type === 'FREE' ? 'Gratuit' :
                    pricing_type === 'CUSTOM' ? 'Sur devis' :
                    price ? `${price} FCFA/${pricing_type?.toLowerCase() || 'mois'}` : null;

    const result = await pool.query(`
      UPDATE hubs SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        description = COALESCE($3, description),
        amenities = COALESCE($4, amenities),
        address = COALESCE($5, address),
        city = COALESCE($6, city),
        region = COALESCE($7, region),
        country = COALESCE($8, country),
        coordinates = COALESCE($9, coordinates),
        access_type = COALESCE($10, access_type),
        pricing = COALESCE($11, pricing),
        capacity = COALESCE($12, capacity),
        opening_hours = COALESCE($13, opening_hours),
        contact_phone = COALESCE($14, contact_phone),
        contact_email = COALESCE($15, contact_email),
        website_url = COALESCE($16, website_url),
        logo_url = COALESCE($17, logo_url),
        cover_image_url = COALESCE($18, cover_image_url),
        gallery_images = COALESCE($19, gallery_images),
        updated_at = NOW()
      WHERE id = $20 AND deleted_at IS NULL
      RETURNING *
    `, [
      name, type, description,
      amenities ? amenities : null,
      address, city, region, country,
      coordinates ? `(${coordinates.lat}, ${coordinates.lng})` : null,
      access_type, pricing, capacity,
      opening_hours ? JSON.stringify(opening_hours) : null,
      contact_phone, contact_email, website_url, logo_url, cover_image_url,
      gallery_images ? gallery_images : null,
      id
    ]);

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error updating hub:', error);
    res.status(500).json({ error: 'Failed to update hub' });
  }
});

// DELETE /api/hubs/:id - Soft delete hub
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE hubs SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hub not found' });
    }

    res.json({ success: true, message: 'Hub deleted' });
  } catch (error) {
    console.error('Error deleting hub:', error);
    res.status(500).json({ error: 'Failed to delete hub' });
  }
});

export default router;
