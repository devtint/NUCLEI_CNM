import path from "path";
import os from "os";

// Detect if running in Docker/production (hardcoded Linux paths) or development
const IS_DOCKER = process.env.DOCKER_ENV === 'true' || process.platform === 'linux';
const HOME_DIR = IS_DOCKER ? '/root' : os.homedir();
const isWindows = !IS_DOCKER && process.platform === 'win32';

export const NUCLEI_PATHS = {
    // Config:
    // Docker/Linux: /root/.config/nuclei
    // Windows: %APPDATA%\nuclei
    // Mac: ~/.config/nuclei
    CONFIG_DIR: IS_DOCKER
        ? path.join(HOME_DIR, ".config", "nuclei")
        : isWindows
            ? path.join(HOME_DIR, "AppData", "Roaming", "nuclei")
            : path.join(HOME_DIR, ".config", "nuclei"),

    // Cache:
    // Docker/Linux: /root/.cache/nuclei
    // Windows: %LOCALAPPDATA%\nuclei
    // Mac: ~/.cache/nuclei
    CACHE_DIR: IS_DOCKER
        ? path.join(HOME_DIR, ".cache", "nuclei")
        : isWindows
            ? path.join(HOME_DIR, "AppData", "Local", "nuclei")
            : path.join(HOME_DIR, ".cache", "nuclei"),

    // PDCP: ~/.pdcp (Same on all platforms)
    PDCP_DIR: path.join(HOME_DIR, ".pdcp"),

    // Templates:
    // Docker/Linux: /root/nuclei-templates
    // Windows: %USERPROFILE%\nuclei-templates
    // Mac: ~/nuclei-templates
    TEMPLATES_DIR: path.join(HOME_DIR, "nuclei-templates"),
};

export const NUCLEI_BINARY = "nuclei"; // Assuming it is in PATH as per guide

export interface ScanConfig {
    target: string;
    targetMode?: 'url' | 'list';
    templateId?: string; // For searching specific CVEs
    tags?: string[]; // e.g., ["cve", "panel"]
    severity?: string[]; // e.g., ["critical", "high"]
    rateLimit?: number;
    concurrency?: number;
    bulkSize?: number;
    customArgs?: string;
}

export function constructCommand(config: ScanConfig, outputFile: string): string[] {
    const args = [];

    // Choose flag based on mode
    if (config.targetMode === 'list') {
        args.push("-l", config.target);
    } else {
        args.push("-u", config.target);
    }

    // Output format
    args.push("-json-export", outputFile);
    // args.push("-o", outputFile); // Removed: conflicting with json-export
    // args.push("-json"); // Removed: causing "flag provided but not defined" error

    if (config.templateId) {
        args.push("-t", config.templateId);
    }

    if (config.severity && config.severity.length > 0) {
        args.push("-s", config.severity.join(","));
    }

    if (config.tags && config.tags.length > 0) {
        args.push("-tags", config.tags.join(","));
    }

    // Performance Flags
    if (config.rateLimit) {
        args.push("-rl", config.rateLimit.toString());
    }
    if (config.concurrency) {
        args.push("-c", config.concurrency.toString());
    }
    if (config.bulkSize) {
        args.push("-bs", config.bulkSize.toString());
    }

    if (config.customArgs) {
        // Simple splitting by space, handles basic flags
        // For more complex quoting, we might need a parser, but this is sufficient for now
        const custom = config.customArgs.split(" ").filter(Boolean);
        args.push(...custom);
    }

    return args;
}
