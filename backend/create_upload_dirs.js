const fs = require('fs');
const path = require('path');

// Create directories if they don't exist
const dirs = [
    './uploads',
    './uploads/motorcycle_images',
    './uploads/profile_pictures'
];

dirs.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Created directory: ${fullPath}`);
    }
});