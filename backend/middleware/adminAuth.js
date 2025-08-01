const jwt = require('jsonwebtoken');
const pool = require('../config/db');

module.exports = async (req, res, next) => {
    try {
        // Check for token
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user exists and is admin
        const result = await pool.query(
            'SELECT * FROM users WHERE id = $1 AND role = $2',
            [decoded.id, 'admin']
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        req.user = result.rows[0];
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};