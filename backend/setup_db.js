const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create a new pool using the connection string
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME
});

async function setupDatabase() {
  try {
    console.log('Setting up database...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'setup_database.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL
    await pool.query(sql);
    
    console.log('Database setup completed successfully!');
    
    // Close the pool
    await pool.end();
    
    console.log('Connection closed.');
  } catch (err) {
    console.error('Error setting up database:', err);
    process.exit(1);
  }
}

// Run the setup
setupDatabase();