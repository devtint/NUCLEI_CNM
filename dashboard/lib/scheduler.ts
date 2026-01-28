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

// Trigger a subfinder scan and wait for completion
async function triggerSubfinderScan(domain: string): Promise<{ total: number; newCount: number; newSubdomains: string[] } | null> {
    try {
        // Call the internal API to start a scan
        const startResponse = await fetch(`http://localhost:3000/api/subfinder`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain, isScheduled: true })
        });

        if (!startResponse.ok) {
            console.error(`[Scheduler] Failed to start scan for ${domain}`);
            return null;
        }

        const { scanId } = await startResponse.json();

        // Poll for completion (max 10 minutes)
        const maxWait = 10 * 60 * 1000;
        const pollInterval = 5000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            const statusResponse = await fetch(`http://localhost:3000/api/subfinder?scanId=${scanId}`);
            if (!statusResponse.ok) continue;

            const data = await statusResponse.json();
            const scan = data.scans?.find((s: any) => s.id === scanId);

            if (scan && scan.status === "completed") {
                // Get the results with new subdomain info
                const resultsResponse = await fetch(`http://localhost:3000/api/subfinder?scanId=${scanId}&results=true`);
                if (resultsResponse.ok) {
                    const resultsData = await resultsResponse.json();
                    const results = resultsData.results || [];
                    const newSubdomains = results.filter((r: any) => r.is_new).map((r: any) => r.subdomain);

                    return {
                        total: results.length,
                        newCount: newSubdomains.length,
                        newSubdomains
                    };
                }
                return { total: scan.count || 0, newCount: 0, newSubdomains: [] };
            }

            if (scan && scan.status === "failed") {
                console.error(`[Scheduler] Scan failed for ${domain}`);
                return null;
            }
        }

        console.error(`[Scheduler] Scan timed out for ${domain}`);
        return null;

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
