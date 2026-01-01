import path from "path";
import os from "os";

// We need to resolve the user's home directory dynamically to be safe,
// or hardcode it as per the guide if strict adherence is required.
// The guide explicitly listed: C:\Users\naing\...
// But using os.homedir() is safer for the specific machine running this.

const HOME_DIR = os.homedir();
const isWindows = process.platform === 'win32';

export const NUCLEI_PATHS = {
    // Config:
    // Windows: %APPDATA%\nuclei
    // Linux/Mac: ~/.config/nuclei
    CONFIG_DIR: isWindows
        ? path.join(HOME_DIR, "AppData", "Roaming", "nuclei")
        : path.join(HOME_DIR, ".config", "nuclei"),

    // Cache:
    // Windows: %LOCALAPPDATA%\nuclei
    // Linux/Mac: ~/.cache/nuclei
    CACHE_DIR: isWindows
        ? path.join(HOME_DIR, "AppData", "Local", "nuclei")
        : path.join(HOME_DIR, ".cache", "nuclei"),

    // PDCP: ~/.pdcp (Same on all platforms ideally)
    PDCP_DIR: path.join(HOME_DIR, ".pdcp"),

    // Templates:
    // Windows: %USERPROFILE%\nuclei-templates
    // Linux/Mac: ~/nuclei-templates
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
