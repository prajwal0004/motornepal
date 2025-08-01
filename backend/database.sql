-- Users table with extended profile fields
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    date_of_birth DATE,
    gender VARCHAR(20),
    occupation VARCHAR(100),
    license_number VARCHAR(50),
    preferred_bike_type VARCHAR(50),
    riding_experience VARCHAR(50),
    emergency_contact JSONB DEFAULT '{"name": "", "phone": "", "relationship": ""}',
    social_media JSONB DEFAULT '{"twitter": "", "facebook": "", "instagram": ""}',
    notifications JSONB DEFAULT '{"newBikeAlerts": true, "priceDropAlerts": true, "smsNotifications": false, "emailNotifications": true}',
    profile_picture TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Motorcycles table
CREATE TABLE IF NOT EXISTS motorcycles (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    specifications JSONB NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_motorcycles_updated_at
    BEFORE UPDATE ON motorcycles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- User-Motorcycle interactions table
CREATE TABLE IF NOT EXISTS user_motorcycle_interactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    motorcycle_id INTEGER REFERENCES motorcycles(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL, -- 'view', 'save', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, motorcycle_id, interaction_type)
);