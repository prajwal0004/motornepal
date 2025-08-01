-- Sample motorcycle data
INSERT INTO motorcycles (brand, model, year, price, specifications, image_url) VALUES
(
    'Royal Enfield',
    'Classic 350',
    2023,
    750000.00,
    '{
        "engine": "349cc",
        "power": "20.2 bhp @ 6100 rpm",
        "torque": "27 Nm @ 4000 rpm",
        "mileage": "35 kmpl",
        "transmission": "5-speed",
        "fuel_capacity": "13L",
        "weight": "195 kg"
    }',
    'https://www.royalenfield.com/content/dam/royal-enfield/india/motorcycles/classic-350/landing/classic-350-motorcycle.png'
),
(
    'Bajaj',
    'Pulsar NS200',
    2023,
    425000.00,
    '{
        "engine": "199.5cc",
        "power": "24.5 PS @ 9750 rpm",
        "torque": "18.5 Nm @ 8000 rpm",
        "mileage": "40 kmpl",
        "transmission": "6-speed",
        "fuel_capacity": "12L",
        "weight": "156 kg"
    }',
    'https://www.bajajauto.com/bikes-images/pulsar/pulsar-ns200.png'
),
(
    'KTM',
    'Duke 390',
    2023,
    950000.00,
    '{
        "engine": "373cc",
        "power": "43.5 PS @ 9000 rpm",
        "torque": "37 Nm @ 7000 rpm",
        "mileage": "25 kmpl",
        "transmission": "6-speed",
        "fuel_capacity": "13.5L",
        "weight": "169 kg"
    }',
    'https://www.ktm.com/ktmgroup-storage/PHO_BIKE_90_RE_390-duke-orange-MY22-90-Right_%23SALL_%23AEPI_%23V1.png'
),
(
    'Yamaha',
    'MT-15',
    2023,
    475000.00,
    '{
        "engine": "155cc",
        "power": "18.5 PS @ 10000 rpm",
        "torque": "14.1 Nm @ 8500 rpm",
        "mileage": "45 kmpl",
        "transmission": "6-speed",
        "fuel_capacity": "10L",
        "weight": "138 kg"
    }',
    'https://www.yamaha-motor.com.np/sites/default/files/2021-03/MT15.png'
),
(
    'Honda',
    'CBR250R',
    2023,
    650000.00,
    '{
        "engine": "249cc",
        "power": "26.5 PS @ 8500 rpm",
        "torque": "22.9 Nm @ 7000 rpm",
        "mileage": "35 kmpl",
        "transmission": "6-speed",
        "fuel_capacity": "13L",
        "weight": "167 kg"
    }',
    'https://www.honda2wheelersindia.com/assets/images/bikes/cbr250r.png'
);

-- Add some sample interactions for testing
INSERT INTO user_motorcycle_interactions (user_id, motorcycle_id, interaction_type) VALUES
(1, 1, 'view'),
(1, 2, 'view'),
(1, 3, 'save'),
(1, 4, 'view'),
(1, 5, 'save');