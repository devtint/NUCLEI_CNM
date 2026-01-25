const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Path matching the application's config path
const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

function generateAuthSecret() {
    return crypto.randomBytes(32).toString('base64');
}

function init() {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
        console.log('Creating data directory:', DATA_DIR);
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    let config = {};

    // Read existing config if it exists
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
            config = JSON.parse(content);
        } catch (e) {
            console.error('Failed to parse existing config, starting fresh.');
        }
    }

    // Initialize version
    if (!config.version) config.version = 1;

    // Initialize auth object
    if (!config.auth) config.auth = {};

    // Ensure Secret exists
    if (!config.auth.secret) {
        console.log('Generating new AUTH_SECRET...');
        config.auth.secret = generateAuthSecret();

        // Save updated config
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        console.log('✅ Initialized config with AUTH_SECRET at:', CONFIG_PATH);
    } else {
        console.log('✅ AUTH_SECRET already exists.');
    }

    // Note: We do NOT generate passwordHash here. 
    // That is done via the Setup Wizard UI.
}

init();
