import cron, { ScheduledTask } from "node-cron";
import { getDatabase, getSetting, setSetting } from "./db";
import { sendTelegramNotification } from "./notifications";

let schedulerTask: ScheduledTask | null = null;
let isProcessing = false;
let currentDomain: string | null = null;

// Scheduler settings interface
interface SchedulerSettings {
    enabled: boolean;
    frequency: "6h" | "12h" | "24h" | "168h";
    hour: number;
    notifyMode: "always" | "new_only";
    lastRun: number | null;
}

// Get scheduler settings from DB
export function getSchedulerSettings(): SchedulerSettings {
    return {
        enabled: getSetting("scheduler_enabled") === "true",
        frequency: (getSetting("scheduler_frequency") as SchedulerSettings["frequency"]) || "24h",
        hour: parseInt(getSetting("scheduler_hour") || "2", 10),
        notifyMode: (getSetting("scheduler_notify_mode") as SchedulerSettings["notifyMode"]) || "new_only",
        lastRun: getSetting("scheduler_last_run") ? parseInt(getSetting("scheduler_last_run")!, 10) : null
    };
}

// Save scheduler settings to DB
export function saveSchedulerSettings(settings: Partial<SchedulerSettings>) {
    if (settings.enabled !== undefined) setSetting("scheduler_enabled", settings.enabled.toString());
    if (settings.frequency !== undefined) setSetting("scheduler_frequency", settings.frequency);
    if (settings.hour !== undefined) setSetting("scheduler_hour", settings.hour.toString());
    if (settings.notifyMode !== undefined) setSetting("scheduler_notify_mode", settings.notifyMode);
    if (settings.lastRun !== undefined && settings.lastRun !== null) setSetting("scheduler_last_run", settings.lastRun.toString());
}

// Get enabled domains for scheduled scanning
export function getEnabledDomainsForScheduler(): { id: number; target: string; last_scan_date: number | null }[] {
    const db = getDatabase();
    if (!db) return [];

    const stmt = db.prepare(`
        SELECT id, target, last_scan_date 
        FROM monitored_targets 
        WHERE scheduler_enabled = 1 
        ORDER BY COALESCE(last_scan_date, 0) ASC
    `);

    return stmt.all() as { id: number; target: string; last_scan_date: number | null }[];
}

// Toggle scheduler_enabled for a specific domain
export function toggleDomainScheduler(targetId: number, enabled: boolean) {
    const db = getDatabase();
    if (!db) return;

    db.prepare("UPDATE monitored_targets SET scheduler_enabled = ? WHERE id = ?")
        .run(enabled ? 1 : 0, targetId);
}

// Convert frequency to cron expression
function frequencyToCron(frequency: string, hour: number): string {
    switch (frequency) {
        case "6h":
            return "0 */6 * * *"; // Every 6 hours
        case "12h":
            return "0 */12 * * *"; // Every 12 hours
        case "24h":
            return `0 ${hour} * * *`; // Daily at specified hour
        case "168h":
            return `0 ${hour} * * 0`; // Weekly on Sunday at specified hour
        default:
            return `0 ${hour} * * *`; // Default to daily
    }
}

// Initialize the scheduler
export function initScheduler() {
    const settings = getSchedulerSettings();

    // Stop existing task if any
    if (schedulerTask) {
        schedulerTask.stop();
        schedulerTask = null;
    }

    if (!settings.enabled) {
        console.log("[Scheduler] Scheduler is disabled");
        return;
    }

    const cronExpression = frequencyToCron(settings.frequency, settings.hour);
    console.log(`[Scheduler] Starting with cron: ${cronExpression}`);

    schedulerTask = cron.schedule(cronExpression, async () => {
        console.log("[Scheduler] Triggered at", new Date().toISOString());
        await runScheduledScans();
    });

    console.log("[Scheduler] Initialized successfully");
}

// Run scheduled scans for all enabled domains
export async function runScheduledScans() {
    if (isProcessing) {
        console.log("[Scheduler] Already processing, skipping this run");
        return;
    }

    isProcessing = true;
    const settings = getSchedulerSettings();
    const domains = getEnabledDomainsForScheduler();

    console.log(`[Scheduler] Running scans for ${domains.length} domains`);

    if (domains.length === 0) {
        console.log("[Scheduler] No domains enabled for scheduling");
        isProcessing = false;
        return;
    }

    for (const domain of domains) {
        currentDomain = domain.target;
        console.log(`[Scheduler] Scanning: ${domain.target}`);

        try {
            const result = await triggerSubfinderScan(domain.target);

            if (result) {
                // Check if we should send notification
                const shouldNotify = settings.notifyMode === "always" || result.newCount > 0;

                if (shouldNotify) {
                    const newList = result.newSubdomains.slice(0, 10); // Cap at 10
                    const hasMore = result.newSubdomains.length > 10;

                    let msg = `🔍 *Scheduled Subfinder Scan*\n\n`;
                    msg += `🎯 *Target:* \`${domain.target}\`\n`;
                    msg += `📊 *Total Subdomains:* ${result.total}\n`;

                    if (result.newCount > 0) {
                        msg += `🆕 *New Discoveries:* ${result.newCount}\n`;
                        newList.forEach(sub => {
                            msg += `   • ${sub}\n`;
                        });
                        if (hasMore) {
                            msg += `   _...and ${result.newSubdomains.length - 10} more_\n`;
                        }
                    } else {
                        msg += `✓ *No new subdomains detected*\n`;
                    }

                    msg += `\n✅ *Status:* Completed`;

                    await sendTelegramNotification(msg);
                } else {
                    console.log(`[Scheduler] Skipping notification for ${domain.target} (no new subdomains, mode: new_only)`);
                }
            }
        } catch (e) {
            console.error(`[Scheduler] Error scanning ${domain.target}:`, e);
        }

        currentDomain = null;
    }

    // Update last run timestamp
    saveSchedulerSettings({ lastRun: Math.floor(Date.now() / 1000) });

    isProcessing = false;
    console.log("[Scheduler] All scheduled scans completed");
}

// Trigger a subfinder scan and wait for completion (direct process spawn)
async function triggerSubfinderScan(domain: string): Promise<{ total: number; newCount: number; newSubdomains: string[] } | null> {
    const { spawn } = await import("child_process");
    const fs = await import("fs");
    const path = await import("path");
    const crypto = await import("crypto");
    const { SUBFINDER_BINARY } = await import("./nuclei/config");
    const { insertSubfinderScan, updateSubfinderScan, saveSubfinderResults, getDatabase } = await import("./db");

    try {
        const scanId = crypto.randomUUID();

        // Insert scan record
        insertSubfinderScan({
            id: scanId,
            target: domain,
            start_time: Date.now(),
            status: 'running',
            count: 0
        });

        const cmdArgs = ["-d", domain, "-json"];
        console.log(`[Scheduler] Starting subfinder: ${SUBFINDER_BINARY} ${cmdArgs.join(" ")}`);

        const scansDir = path.join(process.cwd(), "scans");
        if (!fs.existsSync(scansDir)) {
            fs.mkdirSync(scansDir, { recursive: true });
        }

        return new Promise((resolve) => {
            const child = spawn(SUBFINDER_BINARY, cmdArgs);
            let jsonOutput = "";

            child.stdout.on("data", (data: Buffer) => {
                jsonOutput += data.toString();
            });

            child.stderr.on("data", (data: Buffer) => {
                // Log stderr for debugging
                console.log(`[Scheduler/Subfinder] ${data.toString().trim()}`);
            });

            child.on("close", (code: number | null) => {
                if (code !== 0) {
                    updateSubfinderScan(scanId, {
                        status: 'failed',
                        end_time: Date.now()
                    });
                    resolve(null);
                    return;
                }

                try {
                    // Parse JSONL results
                    const subdomains: string[] = [];
                    const lines = jsonOutput.split("\n");
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.host) {
                                subdomains.push(parsed.host);
                            }
                        } catch (e) {
                            // ignore invalid json lines
                        }
                    }

                    console.log(`[Scheduler] Parsed ${subdomains.length} subdomains for ${domain}`);

                    // Save results - this function marks new subdomains with is_new flag
                    saveSubfinderResults(scanId, domain, subdomains);

                    // Update scan status
                    updateSubfinderScan(scanId, {
                        status: 'completed',
                        end_time: Date.now(),
                        count: subdomains.length
                    });

                    // Query for new subdomains from this scan
                    const db = getDatabase();
                    const newResults = db.prepare(
                        "SELECT subdomain FROM subfinder_results WHERE scan_id = ? AND is_new = 1"
                    ).all(scanId) as { subdomain: string }[];

                    const newSubdomains = newResults.map(r => r.subdomain);

                    resolve({
                        total: subdomains.length,
                        newCount: newSubdomains.length,
                        newSubdomains
                    });

                } catch (error: any) {
                    console.error("[Scheduler] Error processing scan results:", error);
                    updateSubfinderScan(scanId, {
                        status: 'failed',
                        end_time: Date.now()
                    });
                    resolve(null);
                }
            });

            child.on("error", (err: Error) => {
                console.error(`[Scheduler] Process error: ${err.message}`);
                updateSubfinderScan(scanId, {
                    status: 'failed',
                    end_time: Date.now()
                });
                resolve(null);
            });
        });

    } catch (e) {
        console.error(`[Scheduler] Error during scan for ${domain}:`, e);
        return null;
    }
}

// Get current scheduler status
export function getSchedulerStatus(): { isProcessing: boolean; currentDomain: string | null; nextRun: Date | null } {
    const settings = getSchedulerSettings();

    let nextRun: Date | null = null;
    if (settings.enabled && schedulerTask) {
        // Calculate next run based on frequency
        const now = new Date();
        switch (settings.frequency) {
            case "6h":
                nextRun = new Date(now.getTime() + (6 - (now.getHours() % 6)) * 60 * 60 * 1000);
                nextRun.setMinutes(0, 0, 0);
                break;
            case "12h":
                nextRun = new Date(now.getTime() + (12 - (now.getHours() % 12)) * 60 * 60 * 1000);
                nextRun.setMinutes(0, 0, 0);
                break;
            case "24h":
                nextRun = new Date(now);
                nextRun.setHours(settings.hour, 0, 0, 0);
                if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
                break;
            case "168h":
                nextRun = new Date(now);
                nextRun.setHours(settings.hour, 0, 0, 0);
                const daysTillSunday = (7 - now.getDay()) % 7 || 7;
                nextRun.setDate(nextRun.getDate() + daysTillSunday);
                break;
        }
    }

    return {
        isProcessing,
        currentDomain,
        nextRun
    };
}

// Manual trigger for testing
export async function triggerManualRun() {
    if (isProcessing) {
        throw new Error("Scheduler is already running");
    }
    await runScheduledScans();
}
