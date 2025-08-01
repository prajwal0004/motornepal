const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Get all motorcycles with filters
router.get('/', async (req, res) => {
    try {
        const { brand, priceRange, engineCapacity } = req.query;
        
        let query = `
            SELECT m.*, 
                   u.full_name as owner_name, 
                   u.phone as owner_phone
            FROM motorcycles m
            LEFT JOIN users u ON m.owner_id = u.id
            WHERE 1=1
        `;
        const queryParams = [];
        let paramIndex = 1;

        // Brand filter
        if (brand) {
            query += ` AND LOWER(m.brand) LIKE LOWER($${paramIndex})`;
            queryParams.push(`%${brand}%`);
            paramIndex++;
        }

        // Price range filter
        if (priceRange) {
            const [minPrice, maxPrice] = priceRange.split('-').map(Number);
            query += ` AND m.price >= $${paramIndex} AND m.price <= $${paramIndex + 1}`;
            queryParams.push(minPrice, maxPrice);
            paramIndex += 2;
        }

        // Engine capacity filter
        if (engineCapacity) {
            const [minCC, maxCC] = engineCapacity.split('-').map(Number);
            query += ` AND (m.specifications->>'engine')::text::integer >= $${paramIndex} 
                      AND (m.specifications->>'engine')::text::integer <= $${paramIndex + 1}`;
            queryParams.push(minCC, maxCC);
            paramIndex += 2;
        }

        query += ' ORDER BY m.created_at DESC';
        
        console.log('Executing query:', query, queryParams);
        const result = await pool.query(query, queryParams);
        
        // Parse the specifications JSON string for each motorcycle
        const motorcycles = result.rows.map(motorcycle => ({
            ...motorcycle,
            specifications: typeof motorcycle.specifications === 'string' 
                ? JSON.parse(motorcycle.specifications) 
                : motorcycle.specifications
        }));
        
        res.json(motorcycles);
    } catch (err) {
        console.error('Error fetching motorcycles:', err);
        res.status(500).json({ error: 'Failed to fetch motorcycles', details: err.message });
    }
});

// Get motorcycle by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT m.*, 
                   u.full_name as owner_name, 
                   u.phone as owner_phone
            FROM motorcycles m
            LEFT JOIN users u ON m.owner_id = u.id
            WHERE m.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Motorcycle not found' });
        }

        const motorcycle = {
            ...result.rows[0],
            specifications: typeof result.rows[0].specifications === 'string'
                ? JSON.parse(result.rows[0].specifications)
                : result.rows[0].specifications
        };
        
        res.json(motorcycle);
    } catch (err) {
        console.error('Error fetching motorcycle:', err);
        res.status(500).json({ error: 'Failed to fetch motorcycle' });
    }
});

// Track motorcycle views
router.post('/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id; // Assuming auth middleware sets req.user

        if (userId) {
            await pool.query(`
                INSERT INTO user_motorcycle_interactions 
                (user_id, motorcycle_id, interaction_type)
                VALUES ($1, $2, 'view')
                ON CONFLICT (user_id, motorcycle_id, interaction_type) 
                DO UPDATE SET created_at = CURRENT_TIMESTAMP
            `, [userId, id]);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error tracking motorcycle view:', err);
        res.status(500).json({ error: 'Failed to track view' });
    }
});

module.exports = router;