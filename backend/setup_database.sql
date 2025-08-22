-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    location VARCHAR(100),
    full_name VARCHAR(100),
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

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
    
-- Create login_history table
CREATE TABLE IF NOT EXISTS login_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL,
    ip_address VARCHAR(50),
    device_info TEXT
);

-- Create motorcycles table with all required columns
CREATE TABLE IF NOT EXISTS motorcycles (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    specifications JSONB NOT NULL,
    image_url TEXT,
    condition VARCHAR(50),
    kilometers_driven INTEGER,
    registration_year INTEGER,
    registration_number VARCHAR(50),
    description TEXT,
    contact_number VARCHAR(20),
    location VARCHAR(100),
    owner_id INTEGER REFERENCES users(id),
    listing_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    listing_status VARCHAR(20) DEFAULT 'available',
    additional_images JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for motorcycles table
CREATE TRIGGER update_motorcycles_updated_at
    BEFORE UPDATE ON motorcycles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create user-motorcycle interactions table
CREATE TABLE IF NOT EXISTS user_motorcycle_interactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    motorcycle_id INTEGER REFERENCES motorcycles(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, motorcycle_id, interaction_type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_motorcycles_brand ON motorcycles(brand);
CREATE INDEX IF NOT EXISTS idx_motorcycles_price ON motorcycles(price);
CREATE INDEX IF NOT EXISTS idx_motorcycles_listing_status ON motorcycles(listing_status);
CREATE INDEX IF NOT EXISTS idx_motorcycles_location ON motorcycles(location);

-- Add trigger for listing_date update
CREATE OR REPLACE FUNCTION update_listing_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.listing_status != OLD.listing_status THEN
        NEW.listing_date = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_motorcycle_listing_date
    BEFORE UPDATE ON motorcycles
    FOR EACH ROW
    EXECUTE FUNCTION update_listing_date();