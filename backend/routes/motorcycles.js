const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/motorcycle_images');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `motorcycle-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});

// Get all motorcycles with filters
router.get('/', async (req, res) => {
    try {
        const { brand, priceRange, engineCapacity, model, year, condition, sortBy } = req.query;
        
        let query = `
            SELECT m.*, 
                   u.full_name as owner_name, 
                   u.phone as owner_phone,
                   u.email as owner_email
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

        // Model filter
        if (model) {
            query += ` AND LOWER(m.model) LIKE LOWER($${paramIndex})`;
            queryParams.push(`%${model}%`);
            paramIndex++;
        }

        // Year filter
        if (year) {
            query += ` AND m.year = $${paramIndex}`;
            queryParams.push(year);
            paramIndex++;
        }

        // Condition filter
        if (condition) {
            query += ` AND LOWER(m.condition) = LOWER($${paramIndex})`;
            queryParams.push(condition);
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

        // Sorting
        if (sortBy === 'price_asc') {
            query += ' ORDER BY m.price ASC';
        } else if (sortBy === 'price_desc') {
            query += ' ORDER BY m.price DESC';
        } else if (sortBy === 'year_desc') {
            query += ' ORDER BY m.year DESC';
        } else if (sortBy === 'year_asc') {
            query += ' ORDER BY m.year ASC';
        } else {
            query += ' ORDER BY m.created_at DESC';
        }
        
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

// Create a new motorcycle listing
router.post('/', auth, upload.array('images', 5), async (req, res) => {
    try {
        const { 
            title, 
            description, 
            brand, 
            model, 
            year, 
            price, 
            condition,
            specifications
        } = req.body;

        // Validate required fields
        if (!title || !description || !brand || !model || !year || !price || !condition) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Process uploaded images
        const images = req.files ? req.files.map(file => {
            const filename = file.filename;
            return `/uploads/motorcycle_images/${filename}`;
        }) : [];

        // Parse specifications if provided as string
        let parsedSpecs = specifications;
        if (typeof specifications === 'string') {
            try {
                parsedSpecs = JSON.parse(specifications);
            } catch (err) {
                console.error('Error parsing specifications:', err);
                return res.status(400).json({ error: 'Invalid specifications format' });
            }
        }

        // Insert into database
        const result = await pool.query(`
            INSERT INTO motorcycles (
                title, 
                description, 
                brand, 
                model, 
                year, 
                price, 
                condition, 
                specifications, 
                images, 
                owner_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            title, 
            description, 
            brand, 
            model, 
            year, 
            price, 
            condition, 
            parsedSpecs, 
            images, 
            req.user.id
        ]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating motorcycle listing:', err);
        res.status(500).json({ error: 'Failed to create motorcycle listing', details: err.message });
    }
});

// Update a motorcycle listing
router.put('/:id', auth, upload.array('images', 5), async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            title, 
            description, 
            brand, 
            model, 
            year, 
            price, 
            condition,
            specifications,
            removeImages
        } = req.body;

        // Check if motorcycle exists and belongs to user
        const motorcycleCheck = await pool.query(
            'SELECT * FROM motorcycles WHERE id = $1', 
            [id]
        );

        if (motorcycleCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Motorcycle not found' });
        }

        const motorcycle = motorcycleCheck.rows[0];
        if (motorcycle.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to update this listing' });
        }

        // Process uploaded images
        let images = motorcycle.images || [];
        
        // Remove images if specified
        if (removeImages && Array.isArray(removeImages)) {
            images = images.filter(img => !removeImages.includes(img));
        }
        
        // Add new images
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => {
                const filename = file.filename;
                return `/uploads/motorcycle_images/${filename}`;
            });
            images = [...images, ...newImages];
        }

        // Parse specifications if provided as string
        let parsedSpecs = specifications;
        if (typeof specifications === 'string') {
            try {
                parsedSpecs = JSON.parse(specifications);
            } catch (err) {
                console.error('Error parsing specifications:', err);
                return res.status(400).json({ error: 'Invalid specifications format' });
            }
        }

        // Update in database
        const result = await pool.query(`
            UPDATE motorcycles SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                brand = COALESCE($3, brand),
                model = COALESCE($4, model),
                year = COALESCE($5, year),
                price = COALESCE($6, price),
                condition = COALESCE($7, condition),
                specifications = COALESCE($8, specifications),
                images = $9,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $10 AND owner_id = $11
            RETURNING *
        `, [
            title, 
            description, 
            brand, 
            model, 
            year, 
            price, 
            condition, 
            parsedSpecs, 
            images, 
            id,
            req.user.id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Motorcycle not found or not authorized' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating motorcycle listing:', err);
        res.status(500).json({ error: 'Failed to update motorcycle listing', details: err.message });
    }
});

// Delete a motorcycle listing
router.delete('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if motorcycle exists and belongs to user
        const motorcycleCheck = await pool.query(
            'SELECT * FROM motorcycles WHERE id = $1', 
            [id]
        );

        if (motorcycleCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Motorcycle not found' });
        }

        const motorcycle = motorcycleCheck.rows[0];
        if (motorcycle.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this listing' });
        }

        // Delete from database
        await pool.query('DELETE FROM motorcycles WHERE id = $1 AND owner_id = $2', [id, req.user.id]);

        res.json({ message: 'Motorcycle listing deleted successfully' });
    } catch (err) {
        console.error('Error deleting motorcycle listing:', err);
        res.status(500).json({ error: 'Failed to delete motorcycle listing', details: err.message });
    }
});

module.exports = router;