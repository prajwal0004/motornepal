const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
    destination: './uploads/profile_pictures',
    filename: (req, file, cb) => {
        cb(null, 'profile-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
    }
});

// Register route
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    const { full_name, email, password, phone, location } = req.body;

    // Validate input
    if (!full_name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }
    
    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }
    
    // Check if database tables exist
    try {
      await pool.query('SELECT 1 FROM users LIMIT 1');
    } catch (dbErr) {
      console.error('Database table check failed:', dbErr);
      return res.status(500).json({ 
        message: 'Database not properly set up. Please run setup script.',
        error: dbErr.message
      });
    }

    // Check if user exists
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password, phone, address, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, full_name, email`,
      [full_name, email, hashedPassword, phone || null, location || null]
    );

    // Create token
    const token = jwt.sign(
      { id: result.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('User registered successfully:', result.rows[0].username);

    res.status(201).json({
      token,
      user: {
        id: result.rows[0].id,
        username: result.rows[0].full_name, // Return full_name as username for frontend compatibility
        email: result.rows[0].email
      }
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const result = await pool.query(
            'SELECT id, full_name, email, password FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Create token
        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Log login attempt
        await pool.query(
            'INSERT INTO login_history (user_id, login_time, status) VALUES ($1, NOW(), $2)',
            [user.id, 'success']
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.full_name, // Return full_name as username for frontend compatibility
                full_name: user.full_name,
                email: user.email
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Add password reset route (optional)
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        // Check if user exists
        const userResult = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate reset token
        const resetToken = jwt.sign(
            { id: userResult.rows[0].id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Store reset token in database
        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = NOW() + interval \'1 hour\' WHERE id = $2',
            [resetToken, userResult.rows[0].id]
        );

        // In a real application, send email with reset link
        // For demo, just return success message
        res.json({ message: 'Password reset instructions sent to email' });

    } catch (err) {
        console.error('Password reset error:', err);
        res.status(500).json({ message: 'Server error during password reset' });
    }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        console.log('Profile Route - User ID:', req.user.id);
        
        // Get user profile information
        const userQuery = `
            SELECT id, full_name, email, phone, address, date_of_birth,
            gender, occupation, license_number, preferred_bike_type,
            riding_experience, emergency_contact, social_media,
            notifications, profile_picture
            FROM users WHERE id = $1`;
        
        console.log('Executing query:', userQuery);
        const userResult = await pool.query(userQuery, [req.user.id]);
        console.log('Profile Route - User query result:', userResult.rows);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get saved bikes count
        const savedBikesQuery = `
            SELECT m.* FROM motorcycles m
            INNER JOIN user_motorcycle_interactions umi
            ON m.id = umi.motorcycle_id
            WHERE umi.user_id = $1 AND umi.interaction_type = 'save'
            ORDER BY umi.created_at DESC`;
        
        const savedBikesResult = await pool.query(savedBikesQuery, [req.user.id]);
        console.log('Profile Route - Saved bikes count:', savedBikesResult.rows.length);

        // Get recent views
        const recentViewsQuery = `
            SELECT m.* FROM motorcycles m
            INNER JOIN user_motorcycle_interactions umi
            ON m.id = umi.motorcycle_id
            WHERE umi.user_id = $1 AND umi.interaction_type = 'view'
            ORDER BY umi.created_at DESC
            LIMIT 5`;
        
        const recentViewsResult = await pool.query(recentViewsQuery, [req.user.id]);
        console.log('Profile Route - Recent views count:', recentViewsResult.rows.length);

        // Combine all data
        const profileData = {
            ...userResult.rows[0],
            savedBikes: savedBikesResult.rows,
            recentViews: recentViewsResult.rows
        };

        console.log('Profile Route - Sending response');
        res.json(profileData);
    } catch (err) {
        console.error('Profile Route - Error:', err);
        res.status(500).json({ message: 'Server error', details: err.message });
    }
});

// Get user's saved motorcycles
router.get('/saved-motorcycles', auth, async (req, res) => {
    try {
        const query = `
            SELECT m.*, 
                   u.username as owner_name,
                   u.full_name as owner_full_name,
                   umi.created_at as saved_at
            FROM motorcycles m
            INNER JOIN user_motorcycle_interactions umi ON m.id = umi.motorcycle_id
            INNER JOIN users u ON m.owner_id = u.id
            WHERE umi.user_id = $1 AND umi.interaction_type = 'save'
            ORDER BY umi.created_at DESC
        `;
        
        const result = await pool.query(query, [req.user.id]);
        
        // Parse specifications for each motorcycle
        const motorcycles = result.rows.map(motorcycle => ({
            ...motorcycle,
            specifications: typeof motorcycle.specifications === 'string'
                ? JSON.parse(motorcycle.specifications)
                : motorcycle.specifications
        }));
        
        res.json({ motorcycles });
    } catch (err) {
        console.error('Error fetching saved motorcycles:', err);
        res.status(500).json({ message: 'Server error', details: err.message });
    }
});

// Save/unsave a motorcycle
router.post('/save-motorcycle/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'save' or 'unsave'
        
        // Check if motorcycle exists
        const motorcycleCheck = await pool.query('SELECT id FROM motorcycles WHERE id = $1', [id]);
        if (motorcycleCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Motorcycle not found' });
        }
        
        if (action === 'save') {
            // Save the motorcycle
            await pool.query(`
                INSERT INTO user_motorcycle_interactions 
                (user_id, motorcycle_id, interaction_type)
                VALUES ($1, $2, 'save')
                ON CONFLICT (user_id, motorcycle_id, interaction_type) 
                DO UPDATE SET created_at = CURRENT_TIMESTAMP
            `, [req.user.id, id]);
            
            res.json({ message: 'Motorcycle saved successfully' });
        } else if (action === 'unsave') {
            // Unsave the motorcycle
            await pool.query(`
                DELETE FROM user_motorcycle_interactions
                WHERE user_id = $1 AND motorcycle_id = $2 AND interaction_type = 'save'
            `, [req.user.id, id]);
            
            res.json({ message: 'Motorcycle unsaved successfully' });
        } else {
            res.status(400).json({ message: 'Invalid action. Use "save" or "unsave".' });
        }
    } catch (err) {
        console.error('Error saving/unsaving motorcycle:', err);
        res.status(500).json({ message: 'Server error', details: err.message });
    }
});

// Update user profile
router.put('/profile', auth, upload.single('profile_picture'), async (req, res) => {
    try {
        const {
            full_name, phone, address, date_of_birth,
            gender, occupation, license_number, preferred_bike_type,
            riding_experience, emergency_contact, social_media,
            notifications
        } = req.body;

        // Process profile picture if uploaded
        let profilePicture = undefined;
        if (req.file) {
            profilePicture = `/uploads/profile_pictures/${req.file.filename}`;
        }

        // Validate required fields
        if (!full_name) {
            return res.status(400).json({ message: 'Full name is required' });
        }

        // Prepare query based on whether profile picture is being updated
        let updateQuery, values;
        
        if (profilePicture) {
            updateQuery = `
                UPDATE users
                SET full_name = $1,
                    phone = $2,
                    address = $3,
                    date_of_birth = $4,
                    gender = $5,
                    occupation = $6,
                    license_number = $7,
                    preferred_bike_type = $8,
                    riding_experience = $9,
                    emergency_contact = $10,
                    social_media = $11,
                    notifications = $12,
                    profile_picture = $13
                WHERE id = $14
                RETURNING *`;
            
            values = [
                full_name,
                phone,
                address,
                date_of_birth,
                gender,
                occupation,
                license_number,
                preferred_bike_type,
                riding_experience,
                emergency_contact,
                social_media,
                notifications,
                profilePicture,
                req.user.id
            ];
        } else {
            updateQuery = `
                UPDATE users
                SET full_name = $1,
                    phone = $2,
                    address = $3,
                    date_of_birth = $4,
                    gender = $5,
                    occupation = $6,
                    license_number = $7,
                    preferred_bike_type = $8,
                    riding_experience = $9,
                    emergency_contact = $10,
                    social_media = $11,
                    notifications = $12
                WHERE id = $13
                RETURNING *`;
            
            values = [
                full_name,
                phone,
                address,
                date_of_birth,
                gender,
                occupation,
                license_number,
                preferred_bike_type,
                riding_experience,
                emergency_contact,
                social_media,
                notifications,
                req.user.id
            ];
        }

        const result = await pool.query(updateQuery, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update Profile Route - Error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Upload profile picture
router.post('/profile/picture', auth, upload.single('profile_picture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const profilePicturePath = `/uploads/profile_pictures/${req.file.filename}`;
        
        const updateQuery = `
            UPDATE users
            SET profile_picture = $1
            WHERE id = $2
            RETURNING profile_picture`;

        const result = await pool.query(updateQuery, [profilePicturePath, req.user.id]);

        res.json({ profile_picture: result.rows[0].profile_picture });
    } catch (err) {
        console.error('Upload Profile Picture - Error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get user's saved motorcycles
router.get('/saved-motorcycles', auth, async (req, res) => {
    try {
        const query = `
            SELECT m.*, umi.created_at as saved_at
            FROM motorcycles m
            INNER JOIN user_motorcycle_interactions umi
            ON m.id = umi.motorcycle_id
            WHERE umi.user_id = $1 AND umi.interaction_type = 'save'
            ORDER BY umi.created_at DESC`;

        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Get Saved Motorcycles - Error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get user's recently viewed motorcycles
router.get('/recent-views', auth, async (req, res) => {
    try {
        const query = `
            SELECT m.*, umi.created_at as viewed_at
            FROM motorcycles m
            INNER JOIN user_motorcycle_interactions umi
            ON m.id = umi.motorcycle_id
            WHERE umi.user_id = $1 AND umi.interaction_type = 'view'
            ORDER BY umi.created_at DESC
            LIMIT 5`;

        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Get Recent Views - Error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;