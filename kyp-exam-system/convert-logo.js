const fs = require('fs');
const path = require('path');

// Function to convert image to base64
function imageToBase64(imagePath) {
    try {
        const imageBuffer = fs.readFileSync(imagePath);
        const base64String = imageBuffer.toString('base64');
        const mimeType = getMimeType(path.extname(imagePath));
        return `data:${mimeType};base64,${base64String}`;
    } catch (error) {
        console.error('Error converting image:', error.message);
        return null;
    }
}

function getMimeType(extension) {
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
    };
    return mimeTypes[extension.toLowerCase()] || 'image/png';
}

// Check if logo file exists and convert
const logoPath = path.join(__dirname, 'mews-logo.png');
if (fs.existsSync(logoPath)) {
    const base64Logo = imageToBase64(logoPath);
    if (base64Logo) {
        console.log('=== MEWS LOGO BASE64 ===');
        console.log(base64Logo);
        console.log('========================');
        
        // Save to file for easy copying
        fs.writeFileSync('logo-base64.txt', base64Logo);
        console.log('Base64 saved to logo-base64.txt');
    }
} else {
    console.log('Please save your logo as mews-logo.png in the project directory');
    console.log('Current directory:', __dirname);
}