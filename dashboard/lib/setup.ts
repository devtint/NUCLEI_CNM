import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Config file location - in data directory for Docker volume persistence
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(process.cwd(), 'data', 'config.json');

export interface AppConfig {
    version: number;
    auth: {
        passwordHash: string;
        secret: string;
    };
    createdAt: string;
}

/**
 * Check if initial setup is required
 * Setup is required if:
 * 1. No ADMIN_PASSWORD_HASH in environment
 * 2. No config file exists
 */
export function isSetupRequired(): boolean {
    // If env var is set, setup is not required
    if (process.env.ADMIN_PASSWORD_HASH) {
        return false;
    }

    // Check if config file exists
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const config = getConfig();
            return !config?.auth?.passwordHash;
        }
    } catch (e) {
        // Config doesn't exist or is invalid
    }

    return true;
}

/**
 * Get stored configuration
 */
export function getConfig(): AppConfig | null {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            return null;
        }
        const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
        return JSON.parse(content) as AppConfig;
    } catch (e) {
        console.error('Failed to read config:', e);
        return null;
    }
}

/**
 * Save configuration to persistent storage
 */
export function saveConfig(config: AppConfig): void {
    try {
        // Ensure data directory exists
        const dataDir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        console.log('✅ Configuration saved to:', CONFIG_PATH);
    } catch (e) {
        console.error('Failed to save config:', e);
        throw new Error('Failed to save configuration');
    }
}

/**
 * Generate a secure random secret for AUTH_SECRET
 */
export function generateAuthSecret(): string {
    return crypto.randomBytes(32).toString('base64');
}

/**
 * Get the password hash from either env or config file
 */
export function getPasswordHash(): string {
    // Priority 1: Environment variable
    if (process.env.ADMIN_PASSWORD_HASH) {
        return process.env.ADMIN_PASSWORD_HASH;
    }

    // Priority 2: Config file
    const config = getConfig();
    if (config?.auth?.passwordHash) {
        return config.auth.passwordHash;
    }

    return '';
}

/**
 * Get the auth secret from either env or config file
 */
export function getAuthSecret(): string {
    // Priority 1: Environment variable
    if (process.env.AUTH_SECRET) {
        return process.env.AUTH_SECRET;
    }

    // Priority 2: Config file
    const config = getConfig();
    if (config?.auth?.secret) {
        return config.auth.secret;
    }

    return '';
}
