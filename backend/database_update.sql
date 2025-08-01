-- Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Add premium and featured flags to motorcycles table
ALTER TABLE motorcycles 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS listing_status VARCHAR(20) DEFAULT 'active';

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    motorcycle_id INTEGER REFERENCES motorcycles(id),
    amount DECIMAL(10,2) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Delete existing admin user if exists
DELETE FROM users WHERE username = 'admin123';

-- Create admin user with new credentials
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users WHERE username = 'admin123'
    ) THEN
        INSERT INTO users (
            username,
            email,
            password,
            role,
            full_name
        ) VALUES (
            'admin123',
            'admin@motonepal.com',
            '$2a$10$YourHashedPasswordHere', -- Will be updated in the next step
            'admin',
            'System Administrator'
        );
    END IF;
END
$$;