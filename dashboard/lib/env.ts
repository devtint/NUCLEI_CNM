import fs from 'fs';
import path from 'path';

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
    // Critical Security Variables
    get ADMIN_PASSWORD_HASH() { return requireEnv('ADMIN_PASSWORD_HASH'); },
    get AUTH_SECRET() { return requireEnv('AUTH_SECRET'); },

    // Optional
    get GEMINI_API_KEY() { return process.env.GEMINI_API_KEY; },
    get NODE_ENV() { return process.env.NODE_ENV || 'development'; },
};
