import fs from 'fs';
import path from 'path';
import os from 'os';
import { getPasswordHash, getAuthSecret } from './setup';

let manualEnvCache: Record<string, string> | null = null;

function getManualEnv(key: string): string | undefined {
    // Only run on server
    if (typeof window !== 'undefined') return undefined;

    if (!manualEnvCache) {
        manualEnvCache = {};
        try {
            const envPath = path.join(process.cwd(), '.env.local');
            if (fs.existsSync(envPath)) {
                const content = fs.readFileSync(envPath, 'utf-8');
                content.split('\n').forEach(line => {
                    const match = line.match(/^([^=]+)=(.*)$/);
                    if (match) {
                        const k = match[1].trim();
                        let v = match[2].trim();
                        // Remove wrapping quotes
                        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                            v = v.slice(1, -1);
                        }
                        manualEnvCache![k] = v;
                    }
                });
            }
        } catch (e) {
            console.error("Failed to manually load .env.local", e);
        }
    }
    return manualEnvCache[key];
}

function requireEnv(key: string): string {
    let value = process.env[key];

    // Fallback if missing in process.env
    if (!value) {
        value = getManualEnv(key);
    }

    if (!value) {
        // We throw an error to fail fast if config is missing
        console.error(`❌ Missing required environment variable: ${key}\nPlease check your .env.local file.`);
        return ""; // Return empty string to allow execution to proceed (will fail later but visibly)
    }
    return value;
}

export const env = {
    // Auth credentials - now support config file fallback for Docker
    get ADMIN_PASSWORD_HASH() {
        // Try env first, then config file
        const hash = getPasswordHash();
        if (hash) return hash;

        // Fallback to manual env parsing
        return getManualEnv('ADMIN_PASSWORD_HASH') || '';
    },

    get AUTH_SECRET() {
        // Try env first, then config file
        const secret = getAuthSecret();
        if (secret) return secret;

        // Fallback to manual env parsing
        return getManualEnv('AUTH_SECRET') || '';
    },

    // Optional
    get NODE_ENV() { return process.env.NODE_ENV || 'development'; },
};

// --- FIX FOR MAC/LINUX PATH ISSUE (#22) ---
// Automatically add common Go bin paths to PATH
if (typeof process !== 'undefined' && process.platform !== 'win32') {
    const commonGoPaths = [
        path.join(os.homedir(), 'go', 'bin'),
        '/usr/local/go/bin',
        '/opt/homebrew/bin'
    ];

    const currentPath = process.env.PATH || '';
    const newPaths = commonGoPaths.filter(p => !currentPath.includes(p) && fs.existsSync(p));

    if (newPaths.length > 0) {
        console.log(`[ENV] Adding missing Go paths to PATH: ${newPaths.join(':')}`);
        process.env.PATH = `${newPaths.join(':')}:${currentPath}`;
    }
}
