import cron, { ScheduledTask } from "node-cron";
import { getDatabase, getSetting, setSetting, insertSchedulerLog, updateSchedulerLog } from "./db";
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
    autoHttpx: boolean;
    lastRun: number | null;
}

// Get scheduler settings from DB
export function getSchedulerSettings(): SchedulerSettings {
    return {
        enabled: getSetting("scheduler_enabled") === "true",
        frequency: (getSetting("scheduler_frequency") as SchedulerSettings["frequency"]) || "24h",
        hour: parseInt(getSetting("scheduler_hour") || "2", 10),
        notifyMode: (getSetting("scheduler_notify_mode") as SchedulerSettings["notifyMode"]) || "new_only",
        autoHttpx: getSetting("scheduler_auto_httpx") === "true",
        lastRun: getSetting("scheduler_last_run") ? parseInt(getSetting("scheduler_last_run")!, 10) : null
    };
}

// Save scheduler settings to DB
export function saveSchedulerSettings(settings: Partial<SchedulerSettings>) {
    if (settings.enabled !== undefined) setSetting("scheduler_enabled", settings.enabled.toString());
    if (settings.frequency !== undefined) setSetting("scheduler_frequency", settings.frequency);
    if (settings.hour !== undefined) setSetting("scheduler_hour", settings.hour.toString());
    if (settings.notifyMode !== undefined) setSetting("scheduler_notify_mode", settings.notifyMode);
    if (settings.autoHttpx !== undefined) setSetting("scheduler_auto_httpx", settings.autoHttpx.toString());
    if (settings.lastRun !== undefined && settings.lastRun !== null) setSetting("scheduler_last_run", settings.lastRun.toString());
}

// Nuclei settings interface
interface NucleiSettings {
    scanMode: "quick" | "standard" | "full";
    templates: string;
    severity: string;
    rateLimit: number;
    concurrency: number;
    maxNewThreshold: number;
}

// Get nuclei settings from DB
export function getNucleiSettings(): NucleiSettings {
    return {
        scanMode: (getSetting("nuclei_scan_mode") as NucleiSettings["scanMode"]) || "standard",
        templates: getSetting("nuclei_templates") || "cves/,exposures/,technologies/",
        severity: getSetting("nuclei_severity") || "critical,high,medium",
        rateLimit: parseInt(getSetting("nuclei_rate_limit") || "100", 10),
        concurrency: parseInt(getSetting("nuclei_concurrency") || "25", 10),
        maxNewThreshold: parseInt(getSetting("nuclei_max_threshold") || "5", 10)
    };
}

// Save nuclei settings to DB
export function saveNucleiSettings(settings: Partial<NucleiSettings>) {
    if (settings.scanMode !== undefined) setSetting("nuclei_scan_mode", settings.scanMode);
    if (settings.templates !== undefined) setSetting("nuclei_templates", settings.templates);
    if (settings.severity !== undefined) setSetting("nuclei_severity", settings.severity);
    if (settings.rateLimit !== undefined) setSetting("nuclei_rate_limit", settings.rateLimit.toString());
    if (settings.concurrency !== undefined) setSetting("nuclei_concurrency", settings.concurrency.toString());
    if (settings.maxNewThreshold !== undefined) setSetting("nuclei_max_threshold", settings.maxNewThreshold.toString());
}

// Backup settings interface
interface BackupSettings {
    backupEnabled: boolean;
    backupMode: "local" | "telegram";
    backupHour: number;
    notifyDetail: "summary" | "detailed";
}

// Get backup settings from DB (secure defaults)
export function getBackupSettings(): BackupSettings {
    return {
        backupEnabled: getSetting("backup_enabled") === "true",
        backupMode: (getSetting("backup_mode") as BackupSettings["backupMode"]) || "local",
        backupHour: parseInt(getSetting("backup_hour") || "3", 10),
        notifyDetail: (getSetting("notify_detail") as BackupSettings["notifyDetail"]) || "summary"
    };
}

// Save backup settings to DB
export function saveBackupSettings(settings: Partial<BackupSettings>) {
    if (settings.backupEnabled !== undefined) setSetting("backup_enabled", settings.backupEnabled.toString());
    if (settings.backupMode !== undefined) setSetting("backup_mode", settings.backupMode);
    if (settings.backupHour !== undefined) setSetting("backup_hour", settings.backupHour.toString());
    if (settings.notifyDetail !== undefined) setSetting("notify_detail", settings.notifyDetail);
}

// Toggle nuclei_enabled for a specific domain
export function toggleDomainNuclei(targetId: number, enabled: boolean) {
    const db = getDatabase();
    if (!db) return;

    db.prepare("UPDATE monitored_targets SET nuclei_enabled = ? WHERE id = ?")
        .run(enabled ? 1 : 0, targetId);
}

// Get enabled domains for scheduled scanning
export function getEnabledDomainsForScheduler(): { id: number; target: string; last_scan_date: number | null; nuclei_enabled: number }[] {
    const db = getDatabase();
    if (!db) return [];

    const stmt = db.prepare(`
        SELECT id, target, last_scan_date, nuclei_enabled 
        FROM monitored_targets 
        WHERE scheduler_enabled = 1 
        ORDER BY COALESCE(last_scan_date, 0) ASC
    `);

    return stmt.all() as { id: number; target: string; last_scan_date: number | null; nuclei_enabled: number }[];
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
    const nucleiSettings = getNucleiSettings();
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

        // Log the scan start
        const logId = insertSchedulerLog(domain.target);

        try {
            const result = await triggerSubfinderScan(domain.target);

            if (result) {
                // Run HTTPX on new subdomains if enabled
                let httpxResult: { total: number; liveCount: number; liveHosts: { host: string; statusCode: number; title?: string }[] } | null = null;

                if (settings.autoHttpx && result.newCount > 0) {
                    console.log(`[Scheduler] Running HTTPX on ${result.newCount} new subdomains`);
                    httpxResult = await triggerHttpxScan(result.newSubdomains);
                }

                // Run Nuclei if enabled for this domain and we have live hosts
                let nucleiResult: { findingsCount: number; criticalCount: number; highCount: number } | null = null;
                let nucleiSkipped = false;
                let nucleiSkipReason = "";

                if (domain.nuclei_enabled) {
                    if (!settings.autoHttpx) {
                        nucleiSkipped = true;
                        nucleiSkipReason = "Auto-Probe (HTTPX) is disabled globally. Enable it to run Nuclei.";
                        console.log(`[Scheduler] Skipping Nuclei for ${domain.target}: ${nucleiSkipReason}`);
                    } else if (httpxResult && httpxResult.liveCount > 0) {
                        // Safety check: skip if too many new subdomains
                        if (result.newCount > nucleiSettings.maxNewThreshold) {
                            nucleiSkipped = true;
                            nucleiSkipReason = `Too many new subdomains (${result.newCount} > ${nucleiSettings.maxNewThreshold}). Manual scan recommended.`;
                            console.log(`[Scheduler] Skipping Nuclei for ${domain.target}: ${nucleiSkipReason}`);
                        } else {
                            console.log(`[Scheduler] Running Nuclei on ${httpxResult.liveCount} live hosts`);
                            const liveUrls = httpxResult.liveHosts.map(h => h.host);
                            nucleiResult = await triggerNucleiScan(liveUrls, nucleiSettings);
                        }
                    }
                }

                // Check if we should send notification
                const shouldNotify = settings.notifyMode === "always" || result.newCount > 0;

                if (shouldNotify) {
                    const backupSettings = getBackupSettings();
                    const isSummary = backupSettings.notifyDetail === "summary";

                    let msg = `🔍 *Scheduled Recon Scan*\n\n`;
                    msg += `🎯 *Target:* \`${domain.target}\`\n`;
                    msg += `⏰ *Completed:* ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC\n\n`;

                    if (isSummary) {
                        // Summary mode - counts only, no names
                        msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
                        msg += `📡 Subfinder: ${result.total} total`;
                        if (result.newCount > 0) msg += `, ${result.newCount} new`;
                        msg += `\n`;

                        if (httpxResult && httpxResult.total > 0) {
                            msg += `🌐 HTTPX: ${httpxResult.liveCount}/${httpxResult.total} live\n`;
                        }

                        if (nucleiResult && nucleiResult.findingsCount > 0) {
                            msg += `🔬 Nuclei: ${nucleiResult.findingsCount} findings`;
                            if (nucleiResult.criticalCount > 0) msg += ` (${nucleiResult.criticalCount} critical)`;
                            msg += `\n`;
                        } else if (nucleiResult && nucleiResult.findingsCount === 0) {
                            msg += `✓ Nuclei: No vulnerabilities\n`;
                        } else if (nucleiSkipped) {
                            msg += `⚠️ Nuclei skipped\n`;
                        }

                        msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
                        msg += `📊 _View details in dashboard_`;
                    } else {
                        // Detailed mode - includes names (existing behavior)
                        msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
                        msg += `📡 *Subfinder Results*\n`;
                        msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
                        msg += `📊 Total: ${result.total} subdomains\n`;

                        if (result.newCount > 0) {
                            const newList = result.newSubdomains.slice(0, 10);
                            const hasMore = result.newSubdomains.length > 10;

                            msg += `🆕 New: ${result.newCount} subdomains\n`;
                            newList.forEach(sub => {
                                msg += `   • ${sub}\n`;
                            });
                            if (hasMore) {
                                msg += `   _...and ${result.newSubdomains.length - 10} more_\n`;
                            }
                        } else {
                            msg += `✓ No new subdomains detected\n`;
                        }

                        // HTTPX results section (if enabled and ran)
                        if (httpxResult && httpxResult.total > 0) {
                            msg += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
                            msg += `🌐 *HTTPX Probe Results*\n`;
                            msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
                            msg += `✅ Live: ${httpxResult.liveCount}/${httpxResult.total}\n`;

                            const liveList = httpxResult.liveHosts.slice(0, 10);
                            const hasMoreLive = httpxResult.liveHosts.length > 10;

                            liveList.forEach(host => {
                                const title = host.title ? ` - ${host.title.substring(0, 30)}` : '';
                                msg += `   • ${host.host} [${host.statusCode}]${title}\n`;
                            });

                            if (hasMoreLive) {
                                msg += `   _...and ${httpxResult.liveHosts.length - 10} more_\n`;
                            }
                        } else if (settings.autoHttpx && result.newCount > 0 && !httpxResult) {
                            msg += `\n⚠️ HTTPX probe failed\n`;
                        }

                        // Nuclei results section
                        if (nucleiResult && nucleiResult.findingsCount > 0) {
                            msg += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
                            msg += `🔬 *Nuclei Scan Results*\n`;
                            msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
                            msg += `🎯 Findings: ${nucleiResult.findingsCount}\n`;
                            if (nucleiResult.criticalCount > 0) msg += `   🔴 Critical: ${nucleiResult.criticalCount}\n`;
                            if (nucleiResult.highCount > 0) msg += `   🟠 High: ${nucleiResult.highCount}\n`;
                        } else if (nucleiResult && nucleiResult.findingsCount === 0) {
                            msg += `\n✓ Nuclei: No vulnerabilities found\n`;
                        } else if (nucleiSkipped) {
                            msg += `\n⚠️ *Nuclei Skipped*\n`;
                            msg += `   ${nucleiSkipReason}\n`;
                        }
                    }

                    await sendTelegramNotification(msg);
                } else {
                    console.log(`[Scheduler] Skipping notification for ${domain.target} (no new subdomains, mode: new_only)`);
                }

                // Update scheduler log with success
                updateSchedulerLog(logId, {
                    completed_at: Date.now(),
                    status: 'completed',
                    subdomains_total: result.total,
                    subdomains_new: result.newCount,
                    live_hosts: httpxResult?.liveCount || 0,
                    findings_count: nucleiResult?.findingsCount || 0
                });
            } else {
                // Subfinder returned null
                updateSchedulerLog(logId, {
                    completed_at: Date.now(),
                    status: 'error',
                    error_message: 'Subfinder scan returned no results'
                });
            }
        } catch (e) {
            console.error(`[Scheduler] Error scanning ${domain.target}:`, e);
            // Log the error
            updateSchedulerLog(logId, {
                completed_at: Date.now(),
                status: 'error',
                error_message: e instanceof Error ? e.message : String(e)
            });
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

// Trigger HTTPX scan on a list of subdomains
async function triggerHttpxScan(subdomains: string[]): Promise<{ total: number; liveCount: number; liveHosts: { host: string; statusCode: number; title?: string }[] } | null> {
    const { spawn } = await import("child_process");
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const { HTTPX_BINARY } = await import("./nuclei/config");

    try {
        console.log(`[Scheduler/HTTPX] Probing ${subdomains.length} subdomains`);

        // Create temp file with subdomains
        const tempFile = path.join(os.tmpdir(), `httpx_scheduler_${Date.now()}.txt`);
        fs.writeFileSync(tempFile, subdomains.join("\n"));

        // Run httpx with JSON output
        const args = ["-l", tempFile, "-json", "-silent", "-sc", "-title", "-timeout", "10"];

        return new Promise((resolve) => {
            const child = spawn(HTTPX_BINARY, args);
            let jsonOutput = "";

            child.stdout.on("data", (data: Buffer) => {
                jsonOutput += data.toString();
            });

            child.stderr.on("data", (data: Buffer) => {
                console.log(`[Scheduler/HTTPX] ${data.toString().trim()}`);
            });

            child.on("close", (code: number | null) => {
                // Cleanup temp file
                try {
                    fs.unlinkSync(tempFile);
                } catch (e) { /* ignore */ }

                if (code !== 0 && code !== null) {
                    console.error(`[Scheduler/HTTPX] Process exited with code ${code}`);
                    // Still try to parse partial results
                }

                try {
                    const liveHosts: { host: string; statusCode: number; title?: string }[] = [];
                    const lines = jsonOutput.split("\n");

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.url || parsed.host) {
                                liveHosts.push({
                                    host: parsed.url || parsed.host,
                                    statusCode: parsed.status_code || parsed["status-code"] || 0,
                                    title: parsed.title || undefined
                                });
                            }
                        } catch (e) {
                            // Ignore invalid json lines
                        }
                    }

                    console.log(`[Scheduler/HTTPX] Found ${liveHosts.length} live hosts`);

                    resolve({
                        total: subdomains.length,
                        liveCount: liveHosts.length,
                        liveHosts
                    });

                } catch (error: any) {
                    console.error("[Scheduler/HTTPX] Error processing results:", error);
                    resolve(null);
                }
            });

            child.on("error", (err: Error) => {
                console.error(`[Scheduler/HTTPX] Process error: ${err.message}`);
                // Cleanup temp file
                try {
                    fs.unlinkSync(tempFile);
                } catch (e) { /* ignore */ }
                resolve(null);
            });
        });

    } catch (e) {
        console.error(`[Scheduler/HTTPX] Error:`, e);
        return null;
    }
}

// Nuclei settings type for function parameter
interface NucleiScanSettings {
    scanMode: "quick" | "standard" | "full";
    templates: string;
    severity: string;
    rateLimit: number;
    concurrency: number;
}

// Trigger Nuclei scan on a list of live hosts
async function triggerNucleiScan(liveUrls: string[], settings: NucleiScanSettings): Promise<{ findingsCount: number; criticalCount: number; highCount: number } | null> {
    const { spawn } = await import("child_process");
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const crypto = await import("crypto");
    const { NUCLEI_BINARY } = await import("./nuclei/config");
    const { getDatabase } = await import("./db");

    try {
        console.log(`[Scheduler/Nuclei] Scanning ${liveUrls.length} live hosts`);

        // Create temp file with targets
        const tempFile = path.join(os.tmpdir(), `nuclei_scheduler_${Date.now()}.txt`);
        fs.writeFileSync(tempFile, liveUrls.join("\n"));

        // Build nuclei args based on scan mode
        const args = ["-l", tempFile, "-json", "-silent"];

        if (settings.scanMode !== "full") {
            // Add template filter for quick/standard modes
            if (settings.templates) {
                args.push("-t", settings.templates);
            }
            // Add severity filter
            if (settings.severity) {
                args.push("-severity", settings.severity);
            }
        }

        args.push("-rl", String(settings.rateLimit));
        args.push("-c", String(settings.concurrency));

        console.log(`[Scheduler/Nuclei] Running: nuclei ${args.join(" ")}`);

        return new Promise((resolve) => {
            const child = spawn(NUCLEI_BINARY, args);
            let jsonOutput = "";
            const scanId = crypto.randomUUID();

            child.stdout.on("data", (data: Buffer) => {
                jsonOutput += data.toString();
            });

            child.stderr.on("data", (data: Buffer) => {
                console.log(`[Scheduler/Nuclei] ${data.toString().trim()}`);
            });

            child.on("close", async (code: number | null) => {
                // Cleanup temp file
                try {
                    fs.unlinkSync(tempFile);
                } catch (e) { /* ignore */ }

                try {
                    const findings: any[] = [];
                    let criticalCount = 0;
                    let highCount = 0;

                    const lines = jsonOutput.split("\n");
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.info) {
                                findings.push(parsed);
                                const sev = (parsed.info.severity || "").toLowerCase();
                                if (sev === "critical") criticalCount++;
                                if (sev === "high") highCount++;
                            }
                        } catch (e) {
                            // Ignore invalid json lines
                        }
                    }

                    console.log(`[Scheduler/Nuclei] Found ${findings.length} vulnerabilities`);

                    // Save findings to DB using upsertFinding for proper deduplication and regression detection
                    const regressions: { templateName: string; host: string; severity: string }[] = [];

                    if (findings.length > 0) {
                        const { upsertFinding } = await import("./db");

                        for (const finding of findings) {
                            try {
                                const result = upsertFinding({
                                    scan_id: `scheduled-${Date.now()}`,
                                    template_id: finding.info?.["template-id"] || finding["template-id"] || "",
                                    template_path: finding["template-path"] || "",
                                    name: finding.info?.name || "",
                                    severity: finding.info?.severity || "",
                                    type: finding.type || "http",
                                    host: finding.host || "",
                                    matched_at: finding["matched-at"] || finding.host || "",
                                    request: finding.request || "",
                                    response: finding.response || "",
                                    timestamp: new Date().toISOString(),
                                    raw_json: JSON.stringify(finding),
                                    status: "New",
                                    matcher_name: finding["matcher-name"] || ""
                                });

                                // Track regressions for notification
                                if (result.isRegression && result.templateName && result.host) {
                                    regressions.push({
                                        templateName: result.templateName,
                                        host: result.host,
                                        severity: result.severity || "unknown"
                                    });
                                }
                            } catch (e: any) {
                                console.log(`[Scheduler/Nuclei] Upsert error: ${e.message}`);
                            }
                        }

                        // Send Telegram notification for regressions
                        if (regressions.length > 0) {
                            try {
                                let notifMsg = `⚠️ *Vulnerability Regression Detected*\n\n`;
                                notifMsg += `${regressions.length} previously fixed finding(s) have reappeared:\n\n`;
                                regressions.slice(0, 5).forEach(r => {
                                    notifMsg += `• *${r.templateName}* [${r.severity}]\n`;
                                    notifMsg += `  on \`${r.host}\`\n`;
                                });
                                if (regressions.length > 5) {
                                    notifMsg += `\n_...and ${regressions.length - 5} more_`;
                                }
                                await sendTelegramNotification(notifMsg);
                            } catch (e) {
                                console.error("[Scheduler/Nuclei] Failed to send regression notification:", e);
                            }
                        }
                    }

                    resolve({
                        findingsCount: findings.length,
                        criticalCount,
                        highCount
                    });

                } catch (error: any) {
                    console.error("[Scheduler/Nuclei] Error processing results:", error);
                    resolve(null);
                }
            });

            child.on("error", (err: Error) => {
                console.error(`[Scheduler/Nuclei] Process error: ${err.message}`);
                // Cleanup temp file
                try {
                    fs.unlinkSync(tempFile);
                } catch (e) { /* ignore */ }
                resolve(null);
            });
        });

    } catch (e) {
        console.error(`[Scheduler/Nuclei] Error:`, e);
        return null;
    }
}

// Get current scheduler status
export function getSchedulerStatus(): { isProcessing: boolean; currentDomain: string | null; nextRun: Date | null } {
    const settings = getSchedulerSettings();

    let nextRun: Date | null = null;
    if (settings.enabled) {
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

// Trigger backup based on settings
export async function triggerBackup(): Promise<{ success: boolean; message: string; stats?: any }> {
    const fs = await import("fs");
    const path = await import("path");
    const backupSettings = getBackupSettings();

    try {
        const db = getDatabase();
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

        // Build backup data (same as /api/backup/export)
        const backup = {
            metadata: {
                version: "1.0.0",
                exportedAt: new Date().toISOString(),
                exportedBy: "Nuclei CC Scheduled Backup",
                format: "nuclei-cc-backup"
            },
            nuclei: {
                scans: db.prepare("SELECT * FROM scans").all(),
                findings: db.prepare("SELECT * FROM findings").all()
            },
            subfinder: {
                scans: db.prepare("SELECT * FROM subfinder_scans").all(),
                results: db.prepare("SELECT * FROM subfinder_results").all(),
                monitored_targets: db.prepare("SELECT * FROM monitored_targets").all(),
                monitored_subdomains: db.prepare("SELECT * FROM monitored_subdomains").all()
            },
            httpx: {
                scans: db.prepare("SELECT * FROM httpx_scans").all(),
                results: db.prepare("SELECT * FROM httpx_results").all()
            }
        };

        const jsonData = JSON.stringify(backup, null, 2);
        const filename = `nuclei-cc-backup_${timestamp}.json`;
        const fileSizeKb = Math.round(Buffer.byteLength(jsonData, 'utf8') / 1024);

        // Stats for notification
        const stats = {
            findings: backup.nuclei.findings.length,
            subdomains: backup.subfinder.results.length,
            httpxResults: backup.httpx.results.length,
            sizeKb: fileSizeKb
        };

        if (backupSettings.backupMode === "telegram") {
            // Save to temp file and send via Telegram
            const tempPath = path.join("/tmp", filename);
            fs.writeFileSync(tempPath, jsonData);

            const msg = `🗄️ *Scheduled Backup Complete*\n\n` +
                `📅 ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC\n` +
                `📊 ${stats.findings} findings | ${stats.subdomains} subdomains | ${stats.httpxResults} assets\n` +
                `💾 Size: ${fileSizeKb} KB`;

            await sendTelegramNotification(msg, tempPath);

            // Clean up temp file
            try { fs.unlinkSync(tempPath); } catch { }

            return { success: true, message: "Backup sent to Telegram", stats };
        } else {
            // Save locally
            const backupDir = "/data/backups";
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            const filePath = path.join(backupDir, filename);
            fs.writeFileSync(filePath, jsonData);

            const msg = `🗄️ *Scheduled Backup Complete*\n\n` +
                `📅 ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC\n` +
                `📊 ${stats.findings} findings | ${stats.subdomains} subdomains | ${stats.httpxResults} assets\n` +
                `💾 Size: ${fileSizeKb} KB\n` +
                `📍 Saved to: \`${filePath}\``;

            await sendTelegramNotification(msg);

            return { success: true, message: `Backup saved to ${filePath}`, stats };
        }
    } catch (error: any) {
        console.error("[Backup] Error:", error);
        await sendTelegramNotification(`⚠️ *Backup Failed*\n\n${error.message}`);
        return { success: false, message: error.message };
    }
}
