const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = function(req, res, next) {
    console.log('Auth Middleware - Headers:', req.headers);
    
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    console.log('Auth Middleware - Token:', token);

    // Check if no token
    if (!token) {
        console.log('Auth Middleware - No token provided');
        return res.status(401).json({ error: 'No token, authorization denied' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Auth Middleware - Decoded token:', decoded);
        
        // Add user from payload
        req.user = decoded.user;
        next();
    } catch (err) {
        console.error('Auth Middleware - Token verification failed:', err);
        res.status(401).json({ error: 'Token is not valid' });
    }
};