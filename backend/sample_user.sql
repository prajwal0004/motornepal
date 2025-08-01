-- Insert a sample user with hashed password (the password is 'password123')
INSERT INTO users (
    full_name,
    email,
    password,
    phone,
    address,
    gender,
    occupation,
    license_number,
    preferred_bike_type,
    riding_experience,
    emergency_contact,
    social_media,
    notifications
) VALUES (
    'Prajwal Khatiwada',
    'opusprajwal@gmail.com',
    '$2b$10$YourHashedPasswordHere',  -- You'll need to register through the app to get a proper hashed password
    '+977 9841234567',
    'Kathmandu, Nepal',
    'Male',
    'Software Developer',
    'L123456789',
    'Sport',
    '5 years',
    '{"name": "Emergency Contact", "phone": "+977 9841234567", "relationship": "Family"}',
    '{"twitter": "@prajwal", "facebook": "prajwal.khatiwada", "instagram": "prajwal.khatiwada"}',
    '{"newBikeAlerts": true, "priceDropAlerts": true, "smsNotifications": true, "emailNotifications": true}'
);