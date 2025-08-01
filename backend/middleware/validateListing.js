const validateListing = (req, res, next) => {
    const {
        brand,
        model,
        year,
        price,
        condition,
        kilometers_driven,
        registration_year,
        registration_number,
        description,
        contact_number,
        location,
        specifications
    } = req.body;

    const errors = [];

    // Required fields check
    const requiredFields = {
        brand: 'Brand',
        model: 'Model',
        year: 'Year',
        price: 'Price',
        condition: 'Condition',
        kilometers_driven: 'Kilometers driven',
        registration_year: 'Registration year',
        registration_number: 'Registration number',
        description: 'Description',
        contact_number: 'Contact number',
        location: 'Location'
    };

    Object.entries(requiredFields).forEach(([field, label]) => {
        if (!req.body[field]) {
            errors.push(`${label} is required`);
        }
    });

    // Year validation
    if (year) {
        const yearNum = parseInt(year);
        const currentYear = new Date().getFullYear();
        if (isNaN(yearNum) || yearNum < 1970 || yearNum > currentYear + 1) {
            errors.push(`Year must be between 1970 and ${currentYear + 1}`);
        }
    }

    // Registration year validation
    if (registration_year) {
        const regYearNum = parseInt(registration_year);
        const currentYear = new Date().getFullYear();
        if (isNaN(regYearNum) || regYearNum < 1970 || regYearNum > currentYear) {
            errors.push(`Registration year must be between 1970 and ${currentYear}`);
        }
    }

    // Price validation
    if (price) {
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum <= 0) {
            errors.push('Price must be a positive number');
        }
    }

    // Kilometers driven validation
    if (kilometers_driven) {
        const kmNum = parseInt(kilometers_driven);
        if (isNaN(kmNum) || kmNum < 0) {
            errors.push('Kilometers driven must be a non-negative number');
        }
    }

    // Contact number validation (Nepali format)
    if (contact_number) {
        const phoneRegex = /^(\+977|0)?[9][6-9]\d{8}$/;
        if (!phoneRegex.test(contact_number)) {
            errors.push('Invalid Nepali phone number format (e.g., +9779812345678 or 9812345678)');
        }
    }

    // Specifications validation
    if (specifications) {
        try {
            const specs = typeof specifications === 'string' 
                ? JSON.parse(specifications) 
                : specifications;

            if (!specs.engine) {
                errors.push('Engine capacity (CC) is required');
            } else {
                const engineCC = parseInt(specs.engine.toString().replace(/[^0-9]/g, ''));
                if (isNaN(engineCC) || engineCC <= 0) {
                    errors.push('Engine capacity must be a positive number');
                }
            }
        } catch (err) {
            errors.push('Invalid specifications format');
        }
    } else {
        errors.push('Specifications are required');
    }

    // Description length validation
    if (description && description.length < 20) {
        errors.push('Description must be at least 20 characters long');
    }

    // Image validation
    if (!req.files || req.files.length === 0) {
        errors.push('At least one image is required');
    }

    if (errors.length > 0) {
        // Log the validation errors and received data for debugging
        console.log('Validation Errors:', errors);
        console.log('Received Data:', {
            body: req.body,
            files: req.files ? req.files.map(f => f.originalname) : []
        });

        return res.status(400).json({ 
            message: 'Validation failed',
            errors,
            receivedData: {
                body: req.body,
                files: req.files ? req.files.map(f => f.originalname) : []
            }
        });
    }

    next();
};

module.exports = validateListing;