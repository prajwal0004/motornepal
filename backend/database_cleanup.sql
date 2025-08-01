-- Drop existing tables in the correct order (due to foreign key constraints)
DROP TABLE IF EXISTS user_motorcycle_interactions;
DROP TABLE IF EXISTS motorcycles;
DROP TABLE IF EXISTS users;