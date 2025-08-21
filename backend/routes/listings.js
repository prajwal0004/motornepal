const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const validateListing = require('../middleware/validateListing');
const jwt = require('jsonwebtoken');

// Get recent views for a user
router.get('/recent-views', auth, async (req, res) => {
    console.log('Fetching recent views for user:', req.user.id);
    try {
        // First, let's check if the user exists
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [req.user.id]);
        if (userCheck.rows.length === 0) {
            console.log('User not found:', req.user.id);
            return res.status(404).json({ message: 'User not found' });
        }

        // Now get the recent views
        const query = `
            SELECT DISTINCT ON (l.id) 
                l.*, 
                u.username as owner_name,
                i.viewed_at
            FROM motorcycles l
            LEFT JOIN user_motorcycle_interactions i ON l.id = i.motorcycle_id
            LEFT JOIN users u ON l.owner_id = u.id
            WHERE i.user_id = $1 
                AND i.interaction_type = 'view'
            ORDER BY l.id, i.viewed_at DESC
            LIMIT 10
        `;
        console.log('Executing query for user:', req.user.id);
        const result = await pool.query(query, [req.user.id]);
        console.log('Found recent views:', result.rows.length);
        
        res.json({ listings: result.rows });
    } catch (err) {
        console.error('Error in recent-views:', err);
        res.status(500).json({ 
            message: 'Failed to fetch recent views',
            error: err.message 
        });
    }
});

// Get all listings with filters
router.get('/', async (req, res) => {
    try {
        let query = `
            SELECT l.*, 
                   u.username as owner_name,
                   u.full_name as owner_full_name,
                   u.phone as owner_phone,
                   u.email as owner_email
            FROM motorcycles l 
            JOIN users u ON l.owner_id = u.id 
            WHERE 1=1
        `;
        const values = [];

        if (req.query.brand) {
            values.push(`%${req.query.brand}%`);
            query += ` AND LOWER(l.brand) LIKE LOWER($${values.length})`;
        }

        if (req.query.model) {
            values.push(`%${req.query.model}%`);
            query += ` AND LOWER(l.model) LIKE LOWER($${values.length})`;
        }

        if (req.query.year) {
            values.push(req.query.year);
            query += ` AND l.year = $${values.length}`;
        }

        if (req.query.condition) {
            values.push(req.query.condition);
            query += ` AND LOWER(l.condition) = LOWER($${values.length})`;
        }

        if (req.query.priceRange) {
            const [min, max] = req.query.priceRange.split('-').map(Number);
            values.push(min, max);
            query += ` AND l.price BETWEEN $${values.length - 1} AND $${values.length}`;
        }

        if (req.query.engineCapacity) {
            const [min, max] = req.query.engineCapacity.split('-').map(Number);
            values.push(min, max);
            query += ` AND CAST(l.specifications->>'engine' AS INTEGER) BETWEEN $${values.length - 1} AND $${values.length}`;
        }

        // Sorting
        if (req.query.sortBy === 'price_asc') {
            query += ' ORDER BY l.price ASC';
        } else if (req.query.sortBy === 'price_desc') {
            query += ' ORDER BY l.price DESC';
        } else if (req.query.sortBy === 'year_desc') {
            query += ' ORDER BY l.year DESC';
        } else if (req.query.sortBy === 'year_asc') {
            query += ' ORDER BY l.year ASC';
        } else {
            query += ' ORDER BY l.created_at DESC';
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        query += ` LIMIT ${limit} OFFSET ${offset}`;

        const result = await pool.query(query, values);
        
        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(*) 
            FROM motorcycles l 
            JOIN users u ON l.owner_id = u.id 
            WHERE 1=1
        `;
        
        // Apply the same filters to count query
        if (req.query.brand) {
            countQuery += ` AND LOWER(l.brand) LIKE LOWER($1)`;
        }
        
        if (req.query.model && values.length >= 2) {
            countQuery += ` AND LOWER(l.model) LIKE LOWER($2)`;
        }
        
        if (req.query.year && values.length >= 3) {
            countQuery += ` AND l.year = $3`;
        }
        
        if (req.query.condition && values.length >= 4) {
            countQuery += ` AND LOWER(l.condition) = LOWER($4)`;
        }
        
        if (req.query.priceRange && values.length >= 6) {
            countQuery += ` AND l.price BETWEEN $5 AND $6`;
        }
        
        if (req.query.engineCapacity && values.length >= 8) {
            countQuery += ` AND CAST(l.specifications->>'engine' AS INTEGER) BETWEEN $7 AND $8`;
        }
        
        const countResult = await pool.query(countQuery, values.slice(0, 8));
        const totalCount = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalCount / limit);
        
        // Parse specifications for each listing
        const listings = result.rows.map(listing => ({
            ...listing,
            specifications: typeof listing.specifications === 'string'
                ? JSON.parse(listing.specifications)
                : listing.specifications
        }));
        
        res.json({
            listings,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages
            }
        });
    } catch (err) {
        console.error('Error getting listings:', err);
        res.status(500).json({ message: 'Server error', details: err.message });
    }
});

// Get user's listings
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.query;
        
        let query = `
            SELECT l.*, 
                   u.username as owner_name,
                   u.full_name as owner_full_name
            FROM motorcycles l 
            JOIN users u ON l.owner_id = u.id 
            WHERE l.owner_id = $1
        `;
        
        const values = [userId];
        
        if (status) {
            query += ` AND l.status = $2`;
            values.push(status);
        }
        
        query += ' ORDER BY l.created_at DESC';
        
        const result = await pool.query(query, values);
        
        // Parse specifications for each listing
        const listings = result.rows.map(listing => ({
            ...listing,
            specifications: typeof listing.specifications === 'string'
                ? JSON.parse(listing.specifications)
                : listing.specifications
        }));
        
        res.json({ listings });
    } catch (err) {
        console.error('Error getting user listings:', err);
        res.status(500).json({ message: 'Server error', details: err.message });
    }
});

// Get a single listing
router.get('/:id', async (req, res) => {
    try {
        const query = `
            SELECT l.*, 
                   u.username as owner_name,
                   u.full_name as owner_full_name,
                   u.phone as owner_phone,
                   u.email as owner_email
            FROM motorcycles l 
            JOIN users u ON l.owner_id = u.id 
            WHERE l.id = $1
        `;
        const result = await pool.query(query, [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        // If user is authenticated, record the view
        if (req.headers.authorization) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                
                await pool.query(
                    `INSERT INTO user_motorcycle_interactions 
                    (user_id, motorcycle_id, interaction_type, viewed_at) 
                    VALUES ($1, $2, 'view', NOW())`,
                    [decoded.id, req.params.id]
                );
                console.log('Recorded view for user:', decoded.id, 'motorcycle:', req.params.id);
            } catch (err) {
                console.error('Error recording view:', err);
                // Don't fail the request if view recording fails
            }
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error getting listing:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/motorcycle_images/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { 
        fileSize: 5000000, // 5MB limit
        files: 5 // Maximum 5 files
    },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
    }
}).array('images', 5);

const handleUpload = (req, res, next) => {
    upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    message: 'File upload failed',
                    errors: ['Each image must be less than 5MB']
                });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({
                    message: 'File upload failed',
                    errors: ['Maximum 5 images allowed']
                });
            }
            return res.status(400).json({
                message: 'File upload failed',
                errors: [err.message]
            });
        } else if (err) {
            return res.status(400).json({
                message: 'File upload failed',
                errors: [err.message]
            });
        }
        next();
    });
};

// Create a new listing
router.post('/', auth, handleUpload, validateListing, async (req, res) => {
    try {
        const {
            brand, model, year, price, condition,
            kilometers_driven, registration_year,
            registration_number, description,
            contact_number, location, specifications
        } = req.body;

        // Process uploaded images
        const mainImage = req.files[0] ? '/uploads/motorcycle_images/' + req.files[0].filename : null;
        const additionalImages = req.files.slice(1).map(file => '/uploads/motorcycle_images/' + file.filename);

        const result = await pool.query(
            `INSERT INTO motorcycles (
                brand, model, year, price, condition,
                kilometers_driven, registration_year,
                registration_number, description,
                contact_number, location, specifications,
                image_url, additional_images, owner_id,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
            RETURNING *`,
            [
                brand, model, year, price, condition,
                kilometers_driven, registration_year,
                registration_number, description,
                contact_number, location, specifications,
                mainImage, JSON.stringify(additionalImages),
                req.user.id
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating listing:', err);
        res.status(500).json({ 
            message: 'Failed to create listing',
            error: err.message 
        });
    }
});

module.exports = router;