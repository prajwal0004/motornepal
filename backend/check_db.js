const pool = require('./config/db');

async function checkDatabaseConnection() {
  try {
    // Connect to the database
    const client = await pool.connect();
    console.log('Successfully connected to the database');
    
    // Check if users table exists
    const tableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (tableResult.rows[0].exists) {
      console.log('Users table exists');
      
      // Check users table structure
      const columnResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users';
      `);
      
      console.log('Users table columns:');
      columnResult.rows.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('Users table does not exist');
    }
    
    // Release the client
    client.release();
    
    // Close the pool
    await pool.end();
    
  } catch (err) {
    console.error('Database connection error:', err);
  }
}

checkDatabaseConnection();