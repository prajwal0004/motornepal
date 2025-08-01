const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const adminAuth = require('../middleware/adminAuth');

// Admin Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if credentials match the hardcoded admin credentials
        if (username !== 'admin123') {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check if password matches
        if (password !== 'password123') {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Get admin user from database
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND role = $2',
            ['admin123', 'admin']
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Admin account not configured' });
        }

        const admin = result.rows[0];

        // Create and return token
        const token = jwt.sign(
            { id: admin.id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email
            }
        });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Admin Statistics
router.get('/stats', adminAuth, async (req, res) => {
    try {
        // Get total users
        const usersResult = await pool.query('SELECT COUNT(*) FROM users WHERE role != $1', ['admin']);
        const totalUsers = parseInt(usersResult.rows[0].count);

        // Get listings stats
        const listingsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_listings,
                COUNT(*) FILTER (WHERE listing_status = 'active') as active_listings,
                COUNT(*) FILTER (WHERE is_premium = true) as premium_listings,
                COUNT(*) FILTER (WHERE is_featured = true) as featured_listings
            FROM motorcycles
        `);
        const listingsStats = listingsResult.rows[0];

        // Get total views
        const viewsResult = await pool.query('SELECT COUNT(*) FROM user_motorcycle_interactions WHERE interaction_type = $1', ['view']);
        const totalViews = parseInt(viewsResult.rows[0].count);

        // Get earnings stats
        const earningsResult = await pool.query(`
            SELECT 
                COALESCE(SUM(amount), 0) as total_earnings,
                COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month'), 0) as monthly_earnings
            FROM transactions
        `);
        const earnings = earningsResult.rows[0];

        res.json({
            totalUsers,
            totalListings: parseInt(listingsStats.total_listings),
            activeListings: parseInt(listingsStats.active_listings),
            premiumListings: parseInt(listingsStats.premium_listings),
            featuredListings: parseInt(listingsStats.featured_listings),
            totalViews,
            totalEarnings: parseFloat(earnings.total_earnings),
            monthlyEarnings: parseFloat(earnings.monthly_earnings)
        });
    } catch (err) {
        console.error('Error fetching admin stats:', err);
        res.status(500).json({ message: 'Failed to fetch statistics' });
    }
});

module.exports = router;